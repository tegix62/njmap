#!/usr/bin/env python3
"""The places of the New Jersey "Name that place" game: data/nj-places.json.

Mountains and lakes come from NATURE in js/knowledge.js (the app's lakes-and-mountains list, with its notes); rivers from Overture Maps'
water layer (a point ON the river near a chosen reach, and the direction it runs there, so the camera can look along it); parks and
forests from LANDMARKS; the twenty building landmarks of data/nj-landmarks.json stay in (they come up now and then). Each place gets its
town and county from the app's own boundaries, a camera (zoom, pitch, bearing) and, for mountains, its height read off the terrain tiles.

  python3 tools/build_nj_places.py        (needs /tmp/nj/water.pkl: tools/overture_scan.py's water scan, and AWS terrain tiles)
"""
import io, json, math, os, pickle, re, sys, urllib.request
import numpy as np
from PIL import Image
from shapely import wkb
from shapely.geometry import Point
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_nj_landmark_list as BL

ROOT = BL.ROOT
# river -> (the reach to show: lon, lat; a line about it)
RIVERS = {
    'delaware river': ('Delaware River', (-75.13, 40.97), "The state's western border; at the Water Gap it cuts straight through the Kittatinny Ridge."),
    'passaic river': ('Passaic River', (-74.181, 40.915), 'Winds through Morris, Essex, Passaic and Hudson counties to Newark Bay; the Great Falls drop at Paterson.'),
    'hackensack river': ('Hackensack River', (-74.04, 40.885), 'Runs south through Bergen and Hudson counties into the Meadowlands and Newark Bay.'),
    'raritan river': ('Raritan River', (-74.45, 40.495), 'The biggest river that lies wholly inside New Jersey, passing New Brunswick on its way to Raritan Bay.'),
    'hudson river': ('Hudson River', (-73.955, 40.85), 'The Palisades line its western bank from Fort Lee north.'),
    'musconetcong river': ('Musconetcong River', (-74.9, 40.7), 'A Skylands river on the Warren and Hunterdon line, running to the Delaware.'),
    'rockaway river': ('Rockaway River', (-74.4, 40.9), 'Flows through Morris County into the Boonton Reservoir.'),
    'mullica river': ('Mullica River', (-74.57, 39.63), "The Pine Barrens' main river, running to Great Bay."),
    'toms river': ('Toms River', (-74.19, 39.97), 'Flows through Ocean County to Barnegat Bay.'),
    'maurice river': ('Maurice River', (-74.99, 39.4), "South Jersey's wild and scenic river, running to Delaware Bay."),
    'great egg harbor river': ('Great Egg Harbor River', (-74.78, 39.45), 'A Pine Barrens river that reaches the sea at Great Egg Harbor.'),
    'wallkill river': ('Wallkill River', (-74.56, 41.14), 'One of the few rivers that flow north: from Sussex County into New York.'),
    'ramapo river': ('Ramapo River', (-74.19, 41.12), 'Comes out of the Ramapo Mountains and runs past Oakland to join the Pompton.'),
    'millstone river': ('Millstone River', (-74.64, 40.4), 'Flows north through Mercer and Somerset counties to the Raritan.'),
    'pequannock river': ('Pequannock River', (-74.37, 41.04), 'Runs from the Highlands near Newfoundland to Pompton Lakes.'),
    'paulins kill': ('Paulins Kill', (-74.93, 41.01), 'A Sussex and Warren river that runs to the Delaware.'),
    'delaware and raritan canal': ('Delaware and Raritan Canal', (-74.62, 40.35), 'The old canal from Trenton to New Brunswick, now a state park.'),
}
PEAKS = {'High Point', 'Mount Tammany (Delaware Water Gap)'}      # single summits (the rest of the app's "mountains" are ridges: no one height)
NOT_PARKS = {'High Point Monument', 'Garret Mountain Reservation', 'Sandy Hook'}   # the same place as a mountain above, or the shore (its own set later)
PARK_KINDS = {'Park', 'State park', 'State forest', 'Historic park', 'Wildlife refuge', 'Botanical garden'}
TILE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
_tiles = {}


def elevation(lon, lat, reach_px=0, z=11, where=False):
    """Metres above sea level at a point (the highest within `reach_px` pixels), from the AWS terrain tiles."""
    n = 2 ** z
    fx = (lon + 180) / 360 * n
    fy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    tx, ty = int(fx), int(fy)
    if (tx, ty) not in _tiles:
        raw = urllib.request.urlopen(urllib.request.Request(TILE.format(z=z, x=tx, y=ty), headers={'User-Agent': 'nj-places-builder/1.0'}), timeout=30).read()
        a = np.array(Image.open(io.BytesIO(raw)).convert('RGB'), dtype=float)
        _tiles[(tx, ty)] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    e = _tiles[(tx, ty)]
    px, py = int((fx - tx) * 256), int((fy - ty) * 256)
    y0, x0 = max(0, py - reach_px), max(0, px - reach_px)
    win = e[y0:py + reach_px + 1, x0:px + reach_px + 1]
    if where:                                                  # the highest cell in reach: (lon, lat, metres)
        j, i = np.unravel_index(win.argmax(), win.shape)
        gx, gy = tx + (x0 + i + 0.5) / 256, ty + (y0 + j + 0.5) / 256
        return (gx / n * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / n)))), float(win.max()))
    return float(win.max())


def zoom_for(r_km, lat):
    mpp0 = 78271.5 * math.cos(math.radians(lat))
    return round(max(10.2, min(12.8, math.log2(0.8 * 430 * mpp0 / (r_km * 3200)))), 2)


def main():
    polys, props = BL.towns()
    tree = STRtree(polys)
    def place(lon, lat):
        pt = Point(lon, lat)
        hit = [i for i in tree.query(pt) if polys[i].contains(pt)]
        if hit:
            return props[hit[0]]
        near = sorted((polys[i].distance(pt), i) for i in range(len(polys)))[:1]
        return props[near[0][1]] if near and near[0][0] < 0.02 else None
    out = []
    # --- mountains, lakes and reservoirs: the app's own list
    s = open(os.path.join(ROOT, 'js/knowledge.js')).read()
    blk = s[s.index('export const NATURE'):]
    blk = blk[:blk.index('];')]
    for m in re.finditer(r"\{ name: '((?:[^'\\]|\\.)*)', kind: '([^']+)', pt: \[([-\d.]+), ([-\d.]+)\], r: ([\d.]+), note: '((?:[^'\\]|\\.)*)' \}", blk):
        name, kind, lon, lat, r, note = m.groups()
        lon, lat, r = float(lon), float(lat), float(r)
        k = {'Lake': 'lake', 'Reservoir': 'lake', 'Ridge': 'mountain', 'Mountain': 'mountain'}.get(kind)
        if not k:
            continue
        p = place(lon, lat)
        nm = name.replace("\\'", "'")
        peak = nm in PEAKS
        if peak:                                               # on the summit itself: the highest ground within about a kilometre
            lon, lat, em = elevation(lon, lat, 40, z=12, where=True)
            p = place(lon, lat)
        e = {'n': nm, 'kind': k, 'k': 'nat', 'p': [round(lon, 5), round(lat, 5)], 'z': 11.8 if peak else zoom_for(r * (1.6 if k == 'mountain' else 1), lat), 'pitch': 64 if k == 'mountain' else 58, 'r': r,
             'line': note.replace("\\'", "'").rstrip('.'), 'at': p['full'] if p else '', 'c': p['c'] if p else ''}
        if peak:
            e['elev'] = int(round(em * 3.28084 / 10) * 10)
        out.append(e)
    # --- rivers
    water = pickle.load(open('/tmp/nj/water.pkl', 'rb'))
    for key, (name, (lon0, lat0), line) in RIVERS.items():
        gs = [wkb.loads(g) for n, sub, cl, g in water if n == key]
        if not gs:
            print('  no geometry for', name); continue
        pt0 = Point(lon0, lat0)
        g = min(gs, key=lambda g: g.distance(pt0))
        bearing = None
        if g.geom_type in ('LineString', 'MultiLineString'):
            ln = g if g.geom_type == 'LineString' else max(g.geoms, key=lambda x: x.length)
            d = ln.project(pt0, normalized=True)
            a, b = ln.interpolate(max(0, d - 0.04), normalized=True), ln.interpolate(min(1, d + 0.04), normalized=True)
            q = ln.interpolate(d, normalized=True)
            bearing = round(math.degrees(math.atan2((b.x - a.x) * 84200, (b.y - a.y) * 111000)) % 360)
        else:
            q = g.representative_point()
        p = place(q.x, q.y)
        out.append({'n': name, 'kind': 'river', 'k': 'nat', 'p': [round(q.x, 5), round(q.y, 5)], 'z': 11.6, 'pitch': 60, 'bearing': bearing, 'line': line.rstrip('.'),
                    'at': p['full'] if p else '', 'c': p['c'] if p else ''})
    # --- parks and forests
    kn = s[s.index('export const LANDMARKS'):]
    for m in re.finditer(r"\{ name: ((?:'[^']*'|\"[^\"]*\")), kind: '([^']+)', pt: \[([-\d.]+), ([-\d.]+)\], town: '([^']+)' \}", kn):
        name, kind, lon, lat, town = m.groups()
        name = name[1:-1]
        if kind not in PARK_KINDS or name in NOT_PARKS or any(o['n'] == name for o in out):
            continue
        lon, lat = float(lon), float(lat)
        p = place(lon, lat)
        out.append({'n': name, 'kind': 'park', 'k': 'nat', 'p': [lon, lat], 'z': 12.3, 'pitch': 60, 'line': f'{kind.lower()}' + (f' in {p["full"]}' if p else ''), 'at': p['full'] if p else '', 'c': p['c'] if p else ''})
    # --- the building landmarks, as they were
    for l in json.load(open(os.path.join(ROOT, 'data/nj-landmarks.json'))):
        out.append({**l, 'kind': 'landmark', 'c': l['town'].split('|')[1] if '|' in l.get('town', '') else '', 'at': l['at']})
    json.dump(out, open(os.path.join(ROOT, 'data/nj-places.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    import collections
    print(collections.Counter(o['kind'] for o in out), len(out), 'places ->', os.path.getsize(os.path.join(ROOT, 'data/nj-places.json')) // 1024, 'KB')
    for o in out:
        if o['k'] == 'nat':
            print(f"  {o['kind']:9s} {o['n']:34s} {o['at'][:26]:26s} {o['c']:11s} z{o['z']} {('elev ' + str(o['elev']) + ' ft') if 'elev' in o else ''}")


if __name__ == '__main__':
    main()
