#!/usr/bin/env python3
"""Put a landmark on the right building, in place, when its 3D building was the wrong one: data/nj-landmark-city.json and the landmark lists.

The buildings round every landmark are already in the city file; this flags the one standing at the given point as the landmark (and unflags the
old one), and moves the landmark's point and width there. Then run tools/landmark_shapes.py (and tools/lidar_parts.py for that landmark).
  python3 tools/move_landmark.py "Cathedral Basilica (Newark)" -74.1784 40.7549
Found by the lidar heightmap: the cathedral's cross plan and towers stand 150 m from the building the first build picked.
"""
import json, math, os, sys
from shapely.geometry import Polygon, Point

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name, lon, lat = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
cp = os.path.join(ROOT, 'data/nj-landmark-city.json')
d = json.load(open(cp)); O, S = d['o'], d['s']
def ring(b):
    x = y = 0; r = []
    for i in range(2, len(b), 2):
        x += b[i]; y += b[i + 1]; r.append((O[0] + x / S, O[1] + y / S))
    return r
lms = json.load(open(os.path.join(ROOT, 'data/nj-landmarks.json')))
lm = next(l for l in lms if l['n'] == name)
pt = Point(lon, lat)
polys = [(i, Polygon(ring(b))) for i, b in enumerate(d['b'])]
hit = [(i, p) for i, p in polys if p.is_valid and p.contains(pt)] or sorted(polys, key=lambda t: t[1].distance(pt))[:1]
new_i, new_p = max(hit, key=lambda t: t[1].area)
old = min((t for t in polys if d['b'][t[0]][1]), key=lambda t: t[1].centroid.distance(Point(*lm['p'])))
d['b'][old[0]][1] = 0
d['b'][new_i][1] = 1
d['b'][new_i][0] = max(d['b'][new_i][0], lm['h'])
d['g'] = [g for g in d['g'] if g[0] not in (old[0], new_i)]
json.dump(d, open(cp, 'w'), separators=(',', ':'))
c = new_p.centroid
kx = 111320 * math.cos(math.radians(c.y))
w = round(math.sqrt(new_p.area * kx * 110574))
for fn in ('data/nj-landmarks.json', 'data/nj-places.json'):
    fp = os.path.join(ROOT, fn); lst = json.load(open(fp))
    for x in lst:
        if x.get('k') == 'lm' and x['n'] == name:
            x['p'] = [round(c.x, 6), round(c.y, 6)]; x['w'] = w
    json.dump(lst, open(fp, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'{name}: building {old[0]} -> {new_i} ({new_p.area * kx * 110574:.0f} m2), point {c.x:.5f}, {c.y:.5f}')
