"""Where tunnel, bridge and highway exit ramps put you on Manhattan's grid,
from NYC's street centerline (CSCL). For each exit ramp, find its downstream
end, the grid street or avenue it joins there, and which way traffic flows on
that street. Prints a report; the curated list in js/gridgame.js (ENTRIES)
is checked against it.

usage: python3 -I tools/entries.py cscl.geojson
"""
import json, math, re, sys

d = json.load(open(sys.argv[1]))
LAT0 = 40.765
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110540
xy = lambda c: ((c[0] + 73.97) * KX, (c[1] - LAT0) * KY)
ANG = math.radians(29)
UP = (math.sin(ANG), math.cos(ANG))
EAST = (math.cos(ANG), -math.sin(ANG))

EXIT = re.compile(r'(LINCOLN TUNNEL EXIT|QUEENS MIDTOWN TUNL EXIT|QUEENSBORO BRIDGE EXIT|FDR DRIVE EXIT|HENRY HUDSON PARKWAY ET|HENRY HUDSON PKWY .*ET|HARLEM RIVER DRIVE EXIT|RFK BRIDGE EXIT)')
ramps, roads = [], []
for f in d['features']:
    p = f['properties']
    n = re.sub(r'\s+', ' ', p.get('full_street_name') or '').strip()
    td = p.get('trafdir')
    if td not in ('FT', 'TF', 'TW'):
        continue
    g = f['geometry']
    for line in (g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]):
        pts = [xy(c) for c in line]
        w = {'name': n, 'td': td, 'pts': pts, 'll': line}
        if EXIT.search(n):
            ramps.append(w)
        elif re.match(r'^([EW] \d+ ST|\d+ AVE|.* AVE|CENTRAL PARK [SWN]|BROADWAY|RIVERSIDE (DR|BLVD)|12 AVE|YORK AVE|AVE OF THE AMERICAS)$', n):
            roads.append(w)

def ends(w):
    if w['td'] == 'FT':
        return [(w['pts'][-1], w['ll'][-1])]
    if w['td'] == 'TF':
        return [(w['pts'][0], w['ll'][0])]
    return [(w['pts'][0], w['ll'][0]), (w['pts'][-1], w['ll'][-1])]

def nearest_road(q, maxd=18):
    best = None
    for w in roads:
        for a, b in zip(w['pts'], w['pts'][1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = dx * dx + dy * dy or 1e-9
            t = max(0, min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L))
            p = (a[0] + t * dx, a[1] + t * dy)
            dd = math.hypot(p[0] - q[0], p[1] - q[1])
            if dd <= maxd and (best is None or dd < best[0]):
                best = (dd, w, (dx, dy))
    return best

def flow(w, seg):
    dx, dy = seg
    e = dx * EAST[0] + dy * EAST[1]
    u = dx * UP[0] + dy * UP[1]
    axis = ('E', 'W') if abs(e) > abs(u) else ('U', 'D')
    sgn = 1 if (e if abs(e) > abs(u) else u) > 0 else -1
    if w['td'] == 'TW':
        return 'both ' + '/'.join(axis)
    o = 1 if w['td'] == 'FT' else -1
    return axis[0] if sgn * o > 0 else axis[1]

seen = set()
for r in sorted(ramps, key=lambda w: w['name']):
    for q, ll in ends(r):
        hit = nearest_road(q)
        if not hit:
            continue
        _, w, seg = hit
        key = (r['name'], w['name'])
        if key in seen:
            continue
        seen.add(key)
        print(f"{r['name']:34s} -> {w['name']:22s} flow {flow(w, seg):8s} at {ll[1]:.5f},{ll[0]:.5f}")
