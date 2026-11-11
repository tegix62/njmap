#!/usr/bin/env python3
"""Pack New York City's building footprints (with roof heights) for the 3D view: data/buildings-midtown.json.

Source: NYC Open Data "Building Footprints" (data.cityofnewyork.us, dataset 5zhs-2jue): a polygon and a roof height
(feet) per building. We keep the buildings inside the Midtown game's box, drop the tiny low ones, simplify the outlines
(about 1 m) and pack them as delta-encoded integers, like the street data:

  {"o": [lon0, lat0], "s": 100000, "b": [[heightMetres, flag, dx, dy, dx, dy, ...], ...]}

flag 1 = the building a landmark (data/landmarks.json) sits in, so the game can colour it.
Usage: python3 -I tools/build_buildings.py [midtown|downtown|uptown]   (needs data.cityofnewyork.us)
"""
import json, math, os, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# area -> (lat1, lon1, lat2, lon2); the boxes overlap a little so no seam shows
AREAS = {
    'midtown': (40.7400, -74.0150, 40.7720, -73.9600),
    'downtown': (40.6990, -74.0260, 40.7410, -73.9680),
    'uptown': (40.7580, -74.0050, 40.8800, -73.9000),
}
BOX = AREAS['midtown']
URL = 'https://data.cityofnewyork.us/resource/5zhs-2jue.json'
S = 100000
TOWERS = [
    ('Empire State Building', -73.98566, 40.74844, 381),
    ('Chrysler Building', -73.97534, 40.75166, 319),
    ('GE Building (30 Rock)', -73.97931, 40.75874, 259),
    ('Bank of America Tower', -73.98458, 40.75537, 288),
    ('MetLife Building', -73.97665, 40.75339, 246),
    ('Citigroup Center', -73.97063, 40.75868, 279),
    ('Trump Tower', -73.97394, 40.76240, 202),
    ('432 Park Avenue', -73.97194, 40.76166, 426),
    ('Hearst Tower', -73.98300, 40.76726, 182),
    ('New York Times Building', -73.99032, 40.75570, 228),
    ('One Vanderbilt', -73.97839, 40.75263, 427),
    ('Central Park Tower', -73.98065, 40.76595, 472),
    ('Lipstick Building', -73.96890, 40.75960, 138),
    ('Waldorf Astoria', -73.97394, 40.75613, 191),
    ('Time Warner Center', -73.98287, 40.76846, 229),
    ('Metropolitan Life Tower', -73.98720, 40.74146, 213),
    ('Seagram Building', -73.97200, 40.75800, 157),
    # Downtown
    ('One World Trade Center', -74.01310, 40.71270, 417),
    ('Woolworth Building', -74.00797, 40.71264, 241),
    ('8 Spruce Street', -74.00570, 40.71070, 265),
    ('Municipal Building', -74.00440, 40.71270, 178),
]
MIN_H_M = 6.0      # drop anything lower than this (sheds, garages)
MIN_AREA_M2 = 40.0  # and anything smaller than this
# anything whose centre is inside the Midtown box belongs to the Midtown file (which has the tower models), not these
EXCLUDE = {'downtown': 'midtown', 'uptown': 'midtown'}
THIN = {'uptown': (9.0, 90.0)}  # Uptown is mostly low rows of houses: fewer, bigger, to keep the file small
TOL_M = 1.2        # outline simplification

def fetch():
    rows, off = [], 0
    while True:  # pages of 20,000, in a fixed order
        q = urllib.parse.urlencode({'$select': 'the_geom,height_roof', '$where': 'within_box(the_geom,%s,%s,%s,%s) AND height_roof IS NOT NULL' % BOX, '$order': ':id', '$limit': 20000, '$offset': off})
        req = urllib.request.Request(URL + '?' + q, headers={'User-Agent': 'njmap-building-packer/1.0'})
        with urllib.request.urlopen(req, timeout=180) as r:
            page = json.load(r)
        rows += page
        if len(page) < 20000:
            return rows
        off += 20000

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
    global BOX
    area = sys.argv[1] if len(sys.argv) > 1 else 'midtown'
    BOX = AREAS[area]
    global MIN_H_M, MIN_AREA_M2
    MIN_H_M, MIN_AREA_M2 = THIN.get(area, (MIN_H_M, MIN_AREA_M2))
    rows = fetch()
    lm = json.load(open(os.path.join(ROOT, 'data/landmarks.json')))
    lpts = [(l['n'], l['p']) for l in lm]
    origin = (BOX[1], BOX[0])
    out, flagged = [], {}
    cand = []  # (centroid lon, lat, height, index in out)
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
            if area in EXCLUDE:
                ex = AREAS[EXCLUDE[area]]
                cx, cy = sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
                if ex[0] <= cy <= ex[2] and ex[1] <= cx <= ex[3]:
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
            cand.append((sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring), h, len(out) - 1))
    # the towers with their own models: the nearest building of about the right height within 70 m
    models, used = [], set()
    for name, lon, lat, eh in TOWERS:
        best = None
        for clon, clat, h, i in cand:
            if i in used or abs(h - eh) / eh > 0.2:
                continue
            d = metres((lon, lat), (clon, clat))
            if d < 70 and (best is None or d < best[0]):
                best = (d, i, h)
        if best:
            used.add(best[1])
            models.append(name)
            out[best[1]][1] = len(models) + 1  # flag 2.. = the model's number + 1
            print(f'  model {name}: footprint {best[0]:.0f} m from the point, roof {best[2]:.0f} m (expected {eh})')
        else:
            print(f'  NO footprint for {name} near ({lon}, {lat}) at about {eh} m')
    path = os.path.join(ROOT, 'data/buildings-%s.json' % area)
    with open(path, 'w') as f:
        json.dump({'o': list(origin), 's': S, 'm': models, 'b': out}, f, separators=(',', ':'))
    print(f'{len(rows)} footprints -> {len(out)} buildings, {os.path.getsize(path) // 1024} KB; landmarks found inside a footprint: {len(flagged)} of {len(lpts)}')
    print('not found:', [n for n, _ in lpts if n not in flagged][:40])

if __name__ == '__main__':
    main()
