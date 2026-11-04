#!/usr/bin/env python3
"""Builds data/manhattan.topo.json: Manhattan neighborhoods by the names people
actually use, as one clean, non-overlapping map.

Sources
- Everyday names: OpenStreetMap neighborhood boundaries (admin_level=10),
  © OpenStreetMap contributors, ODbL. Snapshot via Overpass, 2019-01-27,
  from simboli/Snowflake-snowpark-geo-classification-python.
- Complete coverage: NYC Department of City Planning, 2020 Neighborhood
  Tabulation Areas (public domain), from takumanken/thesis.

Method
1. Manhattan's land = the union of its 2020 NTAs (minus Liberty, Ellis and
   Governors Islands).
2. OSM neighborhoods are clipped to that land and placed smallest-first, so
   a specific name (Times Square) wins over the one around it (Midtown).
3. Land no OSM neighborhood covers is filled from the NTAs; slivers left by
   the two sources' slightly different lines are merged into a neighbor.
4. Each neighborhood is grouped by where it sits along the street grid:
   Downtown (below 14th St), Midtown (14th–59th), Uptown (59th–110th),
   Upper Manhattan (above 110th).

Requires: pip install shapely==2.0.6 ; node/npx (for mapshaper)
Usage: python3 scripts/build-manhattan.py
"""
import json
import math
import os
import subprocess
import tempfile
import urllib.request

from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union, polylabel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OSM = "https://raw.githubusercontent.com/simboli/Snowflake-snowpark-geo-classification-python/43befda19ac382c1efffbee76ff64adbf0e78b29/USA%20New%20York%20City%20neighborhood%2020190128.geojson"
NTA = "https://raw.githubusercontent.com/takumanken/thesis/4e79ce489d1460d30924d2064d0cf7585b8b7d94/application/frontend/assets/geojson/2020_nyc_neighborhood_tabulation_areas_nta.geojson"

LAT0 = 40.78
KX = 111320 * math.cos(math.radians(LAT0))  # m per degree lon
KY = 110540  # m per degree lat


def m2(g):
    """Approximate area in square meters."""
    return g.area * KX * KY


# Grid axis: Manhattan's avenues run ~29° east of true north.
GRID = math.radians(29)


def grid_y(lon, lat):
    x = (lon + 73.97) * KX
    y = (lat - 40.75) * KY
    return x * math.sin(GRID) + y * math.cos(GRID)


# Street lines measured at Fifth Avenue.
Y14 = grid_y(-73.9935, 40.7367)
Y59 = grid_y(-73.9730, 40.7644)
Y110 = grid_y(-73.9495, 40.7966)


def group(pt):
    y = grid_y(pt.x, pt.y)
    if y < Y14:
        return "Downtown"
    if y < Y59:
        return "Midtown"
    if y < Y110:
        return "Uptown"
    return "Upper Manhattan"


# Tidier names for a few OSM / NTA labels
RENAME = {
    "TriBeCa": "Tribeca",
    "Stuy Town": "Stuyvesant Town",
    "Stuyvesant Town-Peter Cooper Village": "Stuyvesant Town",
    "The Battery-Governors Island-Ellis Island-Liberty Island": "The Battery",
    "Upper East Side-Lenox Hill-Roosevelt Island": "Roosevelt Island",
}
MIN_UNIT_M2 = 60_000  # smaller unnamed gap pieces are slivers, merged into a neighbor
MIN_NAMED_M2 = 8_000  # a named OSM neighborhood is kept even if tiny (Koreatown)


def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def polys(g):
    if g.is_empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    if g.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [p for p in getattr(g, "geoms", []) if p.geom_type == "Polygon"]
    return []


def main():
    nta = [f for f in get(NTA)["features"] if f["properties"]["boroname"] == "Manhattan"]
    # Land: drop the harbor islands (Liberty, Ellis, Governors)
    land_parts = []
    for f in nta:
        for p in polys(shape(f["geometry"]).buffer(0)):
            c = p.representative_point()
            # Liberty, Ellis and Governors Islands, and a Brooklyn-shore sliver
            if c.y < 40.70 or (c.y < 40.705 and c.x > -74.0):
                continue
            land_parts.append(p)
    land = unary_union(land_parts)

    osm = [f for f in get(OSM)["features"] if f["geometry"]["type"] in ("Polygon", "MultiPolygon") and f["properties"].get("name")]
    osm = [(RENAME.get(f["properties"]["name"], f["properties"]["name"]), shape(f["geometry"]).buffer(0).intersection(land)) for f in osm]
    osm = [(n, g) for n, g in osm if m2(g) > MIN_NAMED_M2]
    osm.sort(key=lambda t: m2(t[1]))

    units = {}  # name -> geometry
    taken = None
    for name, g in osm:
        piece = g if taken is None else g.difference(taken)
        if m2(piece) < MIN_NAMED_M2:
            continue
        units[name] = unary_union([units[name], piece]) if name in units else piece
        taken = piece if taken is None else unary_union([taken, piece])

    # Fill uncovered land from the NTAs
    gaps = land.difference(taken)
    slivers = []
    for f in nta:
        nname = RENAME.get(f["properties"]["ntaname"], f["properties"]["ntaname"])
        for p in polys(shape(f["geometry"]).buffer(0).intersection(gaps)):
            if m2(p) < MIN_UNIT_M2:
                slivers.append(p)
                continue
            # A leftover piece of "Harlem (North)" next to OSM's "Harlem" joins it
            base = nname.split(" (")[0]
            parts = [x.strip() for x in base.split("-")]
            match = next((u for u in units if u in parts and units[u].buffer(1e-5).intersects(p)), None)
            name = match or (nname if len(parts) == 1 else base)
            if name == "Roosevelt Island" and p.centroid.x < -73.957:
                name = "Lenox Hill"
            units[name] = unary_union([units[name], p]) if name in units else p

    # Slivers merge into whichever neighbor they share the most edge with
    for s in slivers:
        best, best_len = None, 0
        for name, g in units.items():
            ln = s.buffer(2e-5).intersection(g).area
            if ln > best_len:
                best, best_len = name, ln
        if best:
            units[best] = unary_union([units[best], s])

    feats = []
    for name, g in sorted(units.items()):
        g = g.buffer(0)
        main_part = max(polys(g), key=lambda p: p.area)
        lp = polylabel(main_part, tolerance=1e-5)
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "n": name,
                    "t": "Neighborhood",
                    "full": name,
                    "c": group(main_part.representative_point()),
                    "p": int(m2(g) / 100),  # size, used for label priority
                    "lx": round(lp.x, 6),
                    "ly": round(lp.y, 6),
                },
                "geometry": mapping(g),
            }
        )

    covered = unary_union([shape(f["geometry"]) for f in feats])
    print(f"{len(feats)} neighborhoods; land covered {covered.area / land.area:.4f}")
    for h in polys(land.difference(covered)):
        if m2(h) > 5000:
            c = h.representative_point()
            print(f"  uncovered: {m2(h):,.0f} m² at {c.y:.5f},{c.x:.5f}")
    for gname in ("Downtown", "Midtown", "Uptown", "Upper Manhattan"):
        print(f"  {gname}: {', '.join(f['properties']['n'] for f in feats if f['properties']['c'] == gname)}")

    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "mn.geojson")
        json.dump({"type": "FeatureCollection", "features": feats}, open(src, "w"))
        subprocess.run(
            [
                "npx", "--yes", "mapshaper@0.6", "-i", src, "name=munis",
                "-simplify", "interval=4", "keep-shapes",
                # label points: pole of inaccessibility computed above
                "-each", "", "-points", "x=lx", "y=ly", "+", "name=labels",
                "-filter-fields", "n,t,full,c,p", "target=munis",
                "-filter-fields", "n,t,full,c,p", "target=labels",
                "-dissolve", "c", "target=munis", "+", "name=counties",
                "-points", "inner", "+", "name=countylabels",
                "-o", os.path.join(ROOT, "data/manhattan.topo.json"), "format=topojson",
                "target=munis,counties,labels,countylabels", "quantization=200000",
            ],
            check=True,
        )
    print("wrote data/manhattan.topo.json")


if __name__ == "__main__":
    main()
