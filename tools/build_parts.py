#!/usr/bin/env python3
"""Building parts for the 3D view: data/parts-<area>.json, from OpenStreetMap building parts via Overture Maps (ODbL, (c) OpenStreetMap
contributors; see tools/extract_osm_meshes.py for how the file is read).

Where OpenStreetMap maps a building as parts (a podium and a tower on it, setbacks, floating floors), the game draws the parts, each from
its min_height to its height, instead of one block at the roof height. Only buildings where that adds something are touched:
  - the parts cover at least 55% of the building's footprint,
  - the tallest part is within 0.6 to 1.6 times the footprint data's roof height,
  - there are two or more parts, or one that does not start at the ground or differs in height,
  - it is not one of the quiz towers (those are meshes, surveyed slabs or the target of the game).

  {"o": [lon0, lat0], "s": 100000, "g": [[buildingIndex, [base, top, dx, dy, dx, dy ...], ...], ...]}

buildingIndex is the building's place in data/buildings-<area>.json; rebuild both together.  python3 tools/build_parts.py [area ...]
"""
import json, math, os, sys
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extract_osm_meshes as X

ROOT = X.ROOT
AREAS = {'midtown': (40.7400, -74.0150, 40.7720, -73.9600), 'downtown': (40.6990, -74.0260, 40.7410, -73.9680), 'uptown': (40.7580, -74.0050, 40.8800, -73.9000)}
KX, KY = 84200, 111000
SIMPLIFY = 0.5  # metres


def main():
    names = sys.argv[1:] or list(AREAS)
    boxes = [(AREAS[a][1], AREAS[a][0], AREAS[a][3], AREAS[a][2]) for a in names]
    print('reading parts ...', flush=True)
    parts = X.fetch_parts(boxes)
    print(len(parts), 'parts', flush=True)
    quiz = [s['p'] for s in json.load(open(os.path.join(ROOT, 'data/skyscrapers.json')))]
    polys = []
    for g, a, b in parts:
        for p in (g.geoms if g.geom_type == 'MultiPolygon' else [g]):
            if p.geom_type == 'Polygon' and p.is_valid and p.area * KX * KY > 6:
                polys.append((p, a, b))
    for area in names:
        d = json.load(open(os.path.join(ROOT, f'data/buildings-{area}.json')))
        o, s = d['o'], d['s']
        rings = []
        for b in d['b']:
            x = y = 0
            ring = []
            for i in range(2, len(b), 2):
                x += b[i]; y += b[i + 1]
                ring.append((o[0] + x / s, o[1] + y / s))
            rings.append(Polygon(ring).buffer(0) if len(ring) >= 3 else None)
        tree = STRtree([r if r is not None else Polygon() for r in rings])
        groups = {}
        for p, a, h in polys:
            c = p.representative_point()
            for i in tree.query(c):
                if rings[i] is not None and rings[i].buffer(1.5 / KX).contains(c):
                    groups.setdefault(i, []).append((p, a, h)); break
        out, kept = [], 0
        for i, gp in groups.items():
            b = d['b'][i]
            if b[1] >= 2 or rings[i].area == 0:
                continue                                  # a stylised model's tower
            cen = rings[i].centroid
            if any(math.hypot((cen.x - q[0]) * KX, (cen.y - q[1]) * KY) < 60 for q in quiz):
                continue
            cover = unary_union([p for p, a, h in gp]).intersection(rings[i]).area / rings[i].area
            top = max(h for p, a, h in gp)
            if cover < 0.55 or not 0.6 * b[0] <= top <= 1.6 * b[0] + 2:
                continue
            if len(gp) < 2 and gp[0][1] == 0 and abs(gp[0][2] - b[0]) < 3:
                continue
            ent = [int(i)]
            for p, a, h in sorted(gp, key=lambda t: (t[1], t[2])):
                q = p.simplify(SIMPLIFY / KX)
                if q.geom_type != 'Polygon' or q.is_empty:
                    continue
                ring = list(q.exterior.coords)[:-1]
                flat, x, y = [], 0, 0
                for lo, la in ring:
                    nx, ny = int(round((lo - o[0]) * s)), int(round((la - o[1]) * s))
                    flat += [nx - x, ny - y]; x, y = nx, ny
                ent.append([float(round(a, 1)), float(round(max(h, a + 1), 1))] + flat)
            if len(ent) > 1:
                out.append(ent); kept += 1
        json.dump({'o': o, 's': s, 'g': out}, open(os.path.join(ROOT, f'data/parts-{area}.json'), 'w'), separators=(',', ':'))
        print(f'{area}: {len(d["b"])} buildings, {len(groups)} with parts, {kept} drawn from parts -> data/parts-{area}.json {os.path.getsize(os.path.join(ROOT, f"data/parts-{area}.json")) // 1024} KB', flush=True)


if __name__ == '__main__':
    main()
