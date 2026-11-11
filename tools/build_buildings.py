#!/usr/bin/env python3
"""Pack New York City's building footprints (with roof heights) for the 3D view: data/buildings-midtown.json.

Source: NYC Open Data "Building Footprints" (data.cityofnewyork.us, dataset 5zhs-2jue): a polygon and a roof height
(feet) per building. We keep the buildings inside the Midtown game's box, drop the tiny low ones, simplify the outlines
(about 1 m) and pack them as delta-encoded integers, like the street data:

  {"o": [lon0, lat0], "s": 100000, "b": [[heightMetres, flag, dx, dy, dx, dy, ...], ...]}

flag 1 = the building a landmark (data/landmarks.json) sits in, so the game can colour it.
Usage: python3 -I tools/build_buildings.py            (needs data.cityofnewyork.us)
"""
import json, math, os, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOX = (40.7400, -74.0150, 40.7720, -73.9600)  # Midtown: lat1, lon1, lat2, lon2
URL = 'https://data.cityofnewyork.us/resource/5zhs-2jue.json'
S = 100000
MIN_H_M = 6.0      # drop anything lower than this (sheds, garages)
MIN_AREA_M2 = 40.0  # and anything smaller than this
TOL_M = 1.2        # outline simplification

def fetch():
    q = urllib.parse.urlencode({'$select': 'the_geom,height_roof', '$where': 'within_box(the_geom,%s,%s,%s,%s) AND height_roof IS NOT NULL' % BOX, '$limit': 50000})
    req = urllib.request.Request(URL + '?' + q, headers={'User-Agent': 'njmap-building-packer/1.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)

def metres(a, b):
    return math.hypot((b[0] - a[0]) * 84200, (b[1] - a[1]) * 111000)

def simplify(pts, tol):
    """Douglas-Peucker on a closed ring (without its repeated last point)."""
    if len(pts) <= 4:
        return pts
    def rdp(p):
        a, b = p[0], p[-1]
        dmax, idx = 0, 0
        for i in range(1, len(p) - 1):
            d = seg_dist(p[i], a, b)
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol:
            return rdp(p[:idx + 1])[:-1] + rdp(p[idx:])
        return [a, b]
    # split the ring at its two farthest-apart points so both halves are open polylines
    i0 = 0
    j0 = max(range(len(pts)), key=lambda k: metres(pts[0], pts[k]))
    h1 = pts[i0:j0 + 1]
    h2 = pts[j0:] + [pts[0]]
    out = rdp(h1)[:-1] + rdp(h2)[:-1]
    return out if len(out) >= 3 else pts

def seg_dist(p, a, b):
    ax, ay = a[0] * 84200, a[1] * 111000
    bx, by = b[0] * 84200, b[1] * 111000
    px, py = p[0] * 84200, p[1] * 111000
    dx, dy = bx - ax, by - ay
    if dx == dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

def area_m2(pts):
    s = 0
    for i in range(len(pts)):
        x1, y1 = pts[i][0] * 84200, pts[i][1] * 111000
        x2, y2 = pts[(i + 1) % len(pts)][0] * 84200, pts[(i + 1) % len(pts)][1] * 111000
        s += x1 * y2 - x2 * y1
    return abs(s) / 2

def inside(pt, ring):
    x, y = pt
    c = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c

def main():
    rows = fetch()
    lm = json.load(open(os.path.join(ROOT, 'data/landmarks.json')))
    lpts = [(l['n'], l['p']) for l in lm]
    origin = (BOX[1], BOX[0])
    out, flagged = [], {}
    for r in rows:
        try:
            h = float(r['height_roof']) * 0.3048
        except (KeyError, ValueError):
            continue
        if h < MIN_H_M:
            continue
        g = r['the_geom']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            ring = [tuple(p) for p in poly[0]]
            if ring[0] == ring[-1]:
                ring = ring[:-1]
            if len(ring) < 3 or area_m2(ring) < MIN_AREA_M2:
                continue
            flag = 0
            for name, p in lpts:
                if inside(p, ring):
                    flag = 1
                    flagged[name] = flagged.get(name, 0) + 1
            ring = simplify(ring, TOL_M)
            flat, px, py = [], 0, 0
            for lon, lat in ring:
                x, y = round((lon - origin[0]) * S), round((lat - origin[1]) * S)
                flat += [x - px, y - py]
                px, py = x, y
            out.append([round(h), flag] + flat)
    path = os.path.join(ROOT, 'data/buildings-midtown.json')
    with open(path, 'w') as f:
        json.dump({'o': list(origin), 's': S, 'b': out}, f, separators=(',', ':'))
    print(f'{len(rows)} footprints -> {len(out)} buildings, {os.path.getsize(path) // 1024} KB; landmarks found inside a footprint: {len(flagged)} of {len(lpts)}')
    print('not found:', [n for n, _ in lpts if n not in flagged][:40])

if __name__ == '__main__':
    main()
