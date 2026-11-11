#!/usr/bin/env python3
"""Cut the street surfaces, sidewalks and parks out of NYC DCP's 3D Model (Rhino .3dm files by community district).

  python3 tools/extract_ground.py <out dir> <NYC_3DModel_MNxx.3dm> [more files ...]

The model's "Linework" layers hold flat outlines of the roadbed (street and intersection surfaces, with their true widths),
sidewalks, parks and open space. Each closed outline is simplified (about 1.5 ft), converted to lon/lat and packed as whole
units of 1e-6 degree, delta-encoded:

  {"o": [lon0, lat0], "road": [[x, y, dx, dy, ...], ...], "walk": [...], "park": [...]}

(each ring starts with its first point relative to o, then each following point relative to the one before.) One file per
part of the island, split where the building files are (lat 40.7405 and 40.772), written as <out>/ground-<part>.json.
Needs: pip install rhino3dm pyproj shapely numpy. Source: NYC Department of City Planning, "NYC 3D Model by Community
District" (planimetrics of 2014; the files are not kept in the repo, only the result).
"""
import json, os, sys
import numpy as np
import rhino3dm
from pyproj import Transformer
from shapely.geometry import Polygon

UNIT_FT = {'Feet': 1.0, 'Millimeters': 1 / 304.8, 'Meters': 1 / 0.3048, 'Centimeters': 1 / 30.48, 'Inches': 1 / 12.0}
LAYERS = {'Linework::Roadbed': 'road', 'Linework::Sidewalk': 'walk', 'Linework::Park': 'park', 'Linework::Open Space': 'park'}
TOL_FT = 1.5
MIN_AREA_FT2 = 40
PARTS = [('downtown', -90, 40.7405), ('midtown', 40.7405, 40.772), ('uptown', 40.772, 90)]
to_lonlat = Transformer.from_crs(2263, 4326, always_xy=True)
S = 1_000_000  # units per degree


def rings_of(path):
    m = rhino3dm.File3dm.Read(path)
    u = UNIT_FT[str(m.Settings.ModelUnitSystem).split('.')[-1]]
    out = []
    for o in m.Objects:
        kind = LAYERS.get(m.Layers[o.Attributes.LayerIndex].FullPath)
        if not kind:
            continue
        g = o.Geometry
        pts = [(g.Point(i).X * u, g.Point(i).Y * u) for i in range(g.PointCount)]
        if len(pts) < 4 or abs(pts[0][0] - pts[-1][0]) > 1e-3 or abs(pts[0][1] - pts[-1][1]) > 1e-3:
            continue
        try:
            p = Polygon(pts).buffer(0)
        except Exception:
            continue
        if p.is_empty or p.area < MIN_AREA_FT2:
            continue
        for q in (p.geoms if p.geom_type == 'MultiPolygon' else [p]):
            q = q.simplify(TOL_FT, preserve_topology=True)
            if q.is_empty or q.area < MIN_AREA_FT2:
                continue
            out.append((kind, list(q.exterior.coords)[:-1]))
    return out


def main():
    dst = sys.argv[1]
    os.makedirs(dst, exist_ok=True)
    acc = {name: {'road': [], 'walk': [], 'park': []} for name, _, _ in PARTS}
    for path in sys.argv[2:]:
        n = 0
        for kind, ring in rings_of(path):
            xs, ys = zip(*ring)
            lon, lat = to_lonlat.transform(np.array(xs), np.array(ys))
            la = float(np.mean(lat))
            part = next(name for name, lo, hi in PARTS if lo <= la < hi)
            acc[part][kind].append(list(zip(lon.tolist(), lat.tolist())))
            n += 1
        print(f'{path}: {n} outlines', flush=True)
    origin = (-74.03, 40.68)
    for name, _, _ in PARTS:
        rec = {'o': [round(origin[0] * S), round(origin[1] * S)]}
        for kind in ('road', 'walk', 'park'):
            rings = []
            for ring in acc[name][kind]:
                flat, px, py = [], round(origin[0] * S), round(origin[1] * S)
                for lo, la in ring:
                    x, y = round(lo * S), round(la * S)
                    flat += [x - px, y - py]
                    px, py = x, y
                rings.append(flat)
            rec[kind] = rings
        path = os.path.join(dst, f'ground-{name}.json')
        json.dump(rec, open(path, 'w'), separators=(',', ':'))
        print(f'{path}: {sum(len(r) // 2 for k in ("road", "walk", "park") for r in rec[k])} points, {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    main()
