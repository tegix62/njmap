#!/usr/bin/env python3
"""The shapes of the natural places in data/nj-places.json (rivers as lines, lakes and parks as polygons): data/nj-geoms.json, so the game can
outline what it is showing. From Overture Maps' water and land_use layers (tools/overture_names.py wrote /tmp/nj/water.pkl for the rivers,
water_lakes.pkl and parks.pkl); simplified to about 10 to 30 m and rounded to 5 decimals.   python3 tools/build_nj_geoms.py
"""
import json, math, os, pickle
from shapely import wkb
from shapely.geometry import mapping
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# park (our name) -> the Overture names (prefixes) that make it up
PARKS = {
    'Liberty State Park': ['liberty state park'], 'Branch Brook Park': ['branch brook park'], 'Overpeck County Park': ['overpeck'],
    'Van Saun Park': ['van saun'], 'Eagle Rock Reservation': ['eagle rock reservation'], 'South Mountain Reservation': ['south mountain reservation'],
    'Ramapo Mountain State Forest': ['ramapo mountain state forest'], 'Skylands Manor': ['new jersey botanical garden', 'skylands'],
    'Great Swamp National Wildlife Refuge': ['great swamp national wildlife refuge'], 'Morristown National Historical Park': ['morristown national historical park'],
    'Stokes State Forest': ['stokes state forest'], 'Worthington State Forest': ['worthington state forest'], 'Hacklebarney State Park': ['hacklebarney'],
    'Washington Rock': ['washington rock'], 'Island Beach State Park': ['island beach state park'], 'Cheesequake State Park': ['cheesequake'],
    'Allaire State Park': ['allaire state park'], 'Monmouth Battlefield': ['monmouth battlefield'], 'Watchung Reservation': ['watchung reservation'],
}
RIVER_KEYS = {  # our river -> the name in the water layer
    'Delaware River': 'delaware river', 'Passaic River': 'passaic river', 'Hackensack River': 'hackensack river', 'Raritan River': 'raritan river',
    'Hudson River': 'hudson river', 'Musconetcong River': 'musconetcong river', 'Rockaway River': 'rockaway river', 'Mullica River': 'mullica river',
    'Toms River': 'toms river', 'Maurice River': 'maurice river', 'Great Egg Harbor River': 'great egg harbor river', 'Wallkill River': 'wallkill river',
    'Ramapo River': 'ramapo river', 'Millstone River': 'millstone river', 'Pequannock River': 'pequannock river', 'Paulins Kill': 'paulins kill',
    'Delaware and Raritan Canal': 'delaware and raritan canal',
}
LAKES = {'Lake Hopatcong': 'lake hopatcong', 'Greenwood Lake': 'greenwood lake', 'Round Valley Reservoir': 'round valley reservoir', 'Spruce Run Reservoir': 'spruce run reservoir',
         'Monksville Reservoir': 'monksville reservoir', 'Boonton Reservoir': 'boonton reservoir', 'Lake Mohawk': 'lake mohawk', 'Budd Lake': 'budd lake',
         'Swartswood Lake': 'swartswood lake', 'Oradell Reservoir': 'oradell reservoir', 'Manasquan Reservoir': 'manasquan reservoir', 'Union Lake': 'union lake',
         'Merrill Creek Reservoir': 'merrill creek reservoir', 'Wanaque Reservoir': 'wanaque reservoir'}


def rnd(c):
    return [[round(x, 5), round(y, 5)] for x, y in c]


def pack(g, tol):
    g = g.simplify(tol)
    if g.is_empty:
        return None
    if g.geom_type == 'Polygon':
        return {'type': 'Polygon', 'coordinates': [rnd(g.exterior.coords)]}                 # (the outer edge only: that is what is outlined)
    if g.geom_type == 'MultiPolygon':
        return {'type': 'MultiPolygon', 'coordinates': [[rnd(p.exterior.coords)] for p in g.geoms if p.area > 2e-8]}
    if g.geom_type == 'LineString':
        return {'type': 'LineString', 'coordinates': rnd(g.coords)}
    if g.geom_type == 'MultiLineString':
        return {'type': 'MultiLineString', 'coordinates': [rnd(l.coords) for l in g.geoms]}
    return None


def main():
    out = {}
    water = pickle.load(open('/tmp/nj/water.pkl', 'rb'))
    lakes = pickle.load(open('/tmp/nj/water_lakes.pkl', 'rb'))
    parks = pickle.load(open('/tmp/nj/parks.pkl', 'rb'))
    for name, key in RIVER_KEYS.items():
        gs = [wkb.loads(g) for n, s, c, g in water if n == key]
        gs = [g for g in gs if g.geom_type in ('LineString', 'MultiLineString', 'Polygon', 'MultiPolygon')]
        if gs:
            lines = unary_union([g for g in gs if g.geom_type in ('LineString', 'MultiLineString')]) if any(g.geom_type in ('LineString', 'MultiLineString') for g in gs) else unary_union(gs)
            out[name] = pack(lines, 0.0003)
    for name, key in LAKES.items():
        gs = [wkb.loads(g) for n, s, c, g in lakes if n == key or n.startswith(key)]
        gs = [g for g in gs if g.geom_type in ('Polygon', 'MultiPolygon')]
        if gs:
            out[name] = pack(unary_union(gs), 0.0001)
    for name, keys in PARKS.items():
        gs = [wkb.loads(g) for n, s, c, g in parks if any(n == k or n.startswith(k) for k in keys)]
        gs = [g for g in gs if g.geom_type in ('Polygon', 'MultiPolygon')]
        if gs:
            out[name] = pack(unary_union(gs), 0.0002)
    out = {k: v for k, v in out.items() if v}
    json.dump(out, open(os.path.join(ROOT, 'data/nj-geoms.json'), 'w'), separators=(',', ':'))
    print(len(out), 'shapes,', os.path.getsize(os.path.join(ROOT, 'data/nj-geoms.json')) // 1024, 'KB')
    missing = [n for n in list(RIVER_KEYS) + list(LAKES) + list(PARKS) if n not in out]
    print('no shape for:', missing)


if __name__ == '__main__':
    main()
