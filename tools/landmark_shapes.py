#!/usr/bin/env python3
"""Give the New Jersey landmarks their real silhouettes: data/nj-landmark-city.json rewritten in place.

There is no public aerial LiDAR of Newark, Jersey City or Hoboken in the open buckets this project reads (checked 2026-11-16: the USGS
Entwine collection's New Jersey sets cover the north-west six counties and the south; NOAA's 955 coastal sets have no points there), so the
real roof shapes cannot be measured. Instead each landmark's own footprint (from Overture) is built up into the shape its kind of building has:
a cathedral's nave, pitched roof and two spired towers on its front; a dome on a drum; a lighthouse's tapering tower, gallery and lantern;
a stadium's bowl; a tower's setbacks and crown; a castle's turrets. Each recipe names its parts in metres and fractions of the landmark's
height. The shapes are drawn as stacked parts (base and top), the same form tools/build_nj_landmarks.py writes for buildings with parts,
so curves come out as small steps. They are drawings of the kind of building, not surveys: proportions are mine, footprints are real.

  python3 tools/landmark_shapes.py        (after tools/build_nj_landmarks.py; run again after any rebuild)
"""
import json, math, os
import numpy as np
from shapely.geometry import Polygon, Point, LineString, box
from shapely import affinity

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# name -> (recipe, options). Heights are the landmark's `h` (data/nj-landmarks.json) unless `top` is given (metres).
RECIPES = {
    'Cathedral Basilica (Newark)': ('cathedral', {'top': 70, 'nave': 32}),
    'New Jersey State House': ('dome', {'top': 44, 'body': 0.42, 'drum': 0.2}),
    'Newark City Hall': ('dome', {'top': 36, 'body': 0.55, 'drum': 0.16}),
    'Nassau Hall': ('cupola', {'top': 26, 'body': 0.55}),
    'Old Queens': ('cupola', {'top': 25, 'body': 0.55}),
    'Hudson County Courthouse': ('dome', {'top': 42, 'body': 0.55, 'drum': 0.18}),
    'Absecon Lighthouse': ('lighthouse', {'top': 52}),
    'Barnegat Lighthouse': ('lighthouse', {'top': 50}),
    'Cape May Lighthouse': ('lighthouse', {'top': 48}),
    'Sandy Hook Lighthouse': ('lighthouse', {'top': 31}),
    'High Point Monument': ('obelisk', {'top': 67}),
    'MetLife Stadium': ('bowl', {'top': 48}),
    'Red Bull Arena': ('bowl', {'top': 28, 'roof': True}),
    'Hinchliffe Stadium': ('bowl', {'top': 12, 'horseshoe': True}),
    'Yogi Berra Stadium': ('bowl', {'top': 12, 'horseshoe': True}),
    'Prudential Center': ('arena', {'top': 40}),
    'Boardwalk Hall': ('vault', {'top': 42, 'eave': 0.55}),
    'Great Auditorium': ('gable', {'top': 26, 'eave': 0.45}),
    'Hoboken Terminal': ('clocktower', {'top': 69, 'body': 22}),
    'Newark Broad Street Station': ('clocktower', {'top': 40, 'body': 14}),
    'Newark Penn Station': ('steps', {'top': 26, 'tiers': [(0, 0.8), (3, 1.0)]}),
    '99 Hudson Street': ('tower', {'top': 274, 'tiers': [(0, 0.86), (3, 0.93), (7, 0.97), (11, 1.0)]}),
    'Goldman Sachs Tower': ('tower', {'top': 238, 'tiers': [(0, 0.9), (2.5, 0.94), (5, 0.97), (8, 1.0)]}),
    'National Newark Building': ('tower', {'top': 142, 'tiers': [(0, 0.7), (4, 0.82), (8, 0.9), (11, 0.95)], 'spire': 0.05}),
    'Journal Square': ('steps', {'top': 40, 'tiers': [(0, 0.55), (6, 1.0)]}),
    'Lambert Castle': ('castle', {'top': 22, 'body': 0.65}),
    'Edison Laboratory (national park)': ('gable', {'top': 17, 'eave': 0.7}),
    'NJPAC': ('steps', {'top': 30, 'tiers': [(0, 0.6), (8, 1.0)]}),
    'Liberty Science Center': ('dome', {'top': 36, 'body': 0.6, 'drum': 0.3, 'nolantern': True}),
}
# every other landmark: a roof terrace and parapet, so no landmark is a bare box
DEFAULT = ('steps', {'tiers': [(0, 0.85), (2.5, 1.0)]})


def decode(b, o, s):
    flat = b[2:]
    x = y = 0
    ring = []
    for i in range(0, len(flat), 2):
        x += flat[i]; y += flat[i + 1]
        ring.append((o[0] + x / s, o[1] + y / s))
    return ring


def main():
    p = os.path.join(ROOT, 'data/nj-landmark-city.json')
    d = json.load(open(p))
    O, S = d['o'], d['s']
    lms = json.load(open(os.path.join(ROOT, 'data/nj-landmarks.json')))
    idx = [i for i, b in enumerate(d['b']) if b[1]]
    rings = {i: decode(d['b'][i], O, S) for i in idx}
    groups = {g[0]: g for g in d['g']}
    made = 0
    fit = {}
    for l in lms:
        lon0, lat0 = l['p']
        kx, ky = 111320 * math.cos(math.radians(lat0)), 110574
        def to_m(pt): return ((pt[0] - lon0) * kx, (pt[1] - lat0) * ky)
        def to_ll(pt): return (lon0 + pt[0] / kx, lat0 + pt[1] / ky)
        best = min(idx, key=lambda i: Polygon([to_m(q) for q in rings[i]]).centroid.distance(Point(0, 0)))
        F = Polygon([to_m(q) for q in rings[best]]).buffer(0)
        if F.geom_type != 'Polygon' or F.area < 20:
            continue
        name = l['n']
        recipe, opt = RECIPES.get(name, DEFAULT)
        H = opt.get('top', l['h'])
        parts = []
        def add(poly, base, top):
            if poly is None or poly.is_empty:
                return
            def holeless(g, depth=0):                        # a part is drawn from its outer ring only: a ring with a hole (a stadium's seats) is cut into quarters
                if not g.interiors or depth > 3:
                    return [g]
                cx, cy = g.interiors[0].centroid.coords[0]
                x0, y0, x1, y1 = g.bounds
                out = []
                for q in (box(x0 - 1, y0 - 1, cx, cy), box(cx, y0 - 1, x1 + 1, cy), box(x0 - 1, cy, cx, y1 + 1), box(cx, cy, x1 + 1, y1 + 1)):
                    piece = g.intersection(q)
                    for h in (piece.geoms if hasattr(piece, 'geoms') else [piece]):
                        if h.geom_type == 'Polygon' and not h.is_empty:
                            out += holeless(h, depth + 1)
                return out
            for g0 in (poly.geoms if hasattr(poly, 'geoms') else [poly]):
                if g0.geom_type != 'Polygon':
                    continue
                for g in holeless(g0):
                    if g.area > 0.5 and top > base:
                        parts.append((g.simplify(0.25), round(base, 1), round(top, 1)))
        rr = F.minimum_rotated_rectangle
        cs = list(rr.exterior.coords)[:4]
        e1, e2 = np.subtract(cs[1], cs[0]), np.subtract(cs[2], cs[1])
        long_, short_ = (e1, e2) if np.linalg.norm(e1) >= np.linalg.norm(e2) else (e2, e1)
        L, W = np.linalg.norm(long_), np.linalg.norm(short_)
        ax = long_ / L
        ang = math.degrees(math.atan2(ax[1], ax[0]))
        c = np.array(F.centroid.coords[0])
        def rect(cx, cy, along, across):                     # a rectangle aligned with the building's long side
            r = box(-along / 2, -across / 2, along / 2, across / 2)
            return affinity.translate(affinity.rotate(r, ang, origin=(0, 0)), cx, cy)
        def disc(cx, cy, r, n=16):
            return Polygon([(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)])
        def gable(poly, eave, ridge, steps=6):                # a pitched roof along the long axis, as strips that narrow toward the ridge
            add(poly, 0, eave)
            for k in range(steps):
                w = W * (1 - (k + 1) / (steps + 1))
                add(poly.intersection(rect(c[0], c[1], L * 2, w)), eave + (ridge - eave) * k / steps, eave + (ridge - eave) * (k + 1) / steps)
        def dome(cx, cy, r, base, rise, n=7):
            for k in range(n):
                t0, t1 = k / n, (k + 1) / n
                add(disc(cx, cy, r * math.cos(math.asin(min(t0, 0.999)))), base + rise * t0, base + rise * t1)
        def spire(cx, cy, w, base, top, n=8):
            for k in range(n):
                add(rect(cx, cy, w * (1 - k / n), w * (1 - k / n)), base + (top - base) * k / n, base + (top - base) * (k + 1) / n)
        if recipe == 'cathedral':
            nave = opt['nave']
            gable(F, nave * 0.62, nave)
            tw = min(W * 0.3, 16)
            end = c - ax * (L / 2 - tw / 2)                  # the two towers stand on one short end (the front)
            perp = np.array([-ax[1], ax[0]])
            for sgn in (-1, 1):
                tc = end + perp * sgn * (W / 2 - tw / 2)
                add(rect(tc[0], tc[1], tw, tw), 0, H * 0.62)
                add(rect(tc[0], tc[1], tw * 0.8, tw * 0.8), H * 0.62, H * 0.7)
                spire(tc[0], tc[1], tw * 0.7, H * 0.7, H)
            mid = c + ax * L * 0.12                          # the crossing: a lantern over where the transepts meet
            add(disc(mid[0], mid[1], W * 0.14, 8), nave, nave * 1.35)
            spire(mid[0], mid[1], W * 0.16, nave * 1.35, nave * 1.7, 5)
        elif recipe in ('dome', 'cupola'):
            body = H * opt['body']
            add(F, 0, body * 0.92)
            add(F.buffer(-1.2), body * 0.92, body)
            if recipe == 'cupola':
                r = min(W * 0.12, 5)
                add(disc(c[0], c[1], r, 8), body, body + (H - body) * 0.45)
                dome(c[0], c[1], r, body + (H - body) * 0.45, (H - body) * 0.35, 4)
                spire(c[0], c[1], r * 0.4, body + (H - body) * 0.8, H, 3)
            else:
                r = min(W, L) * opt['drum']
                drum_top = body + (H - body) * 0.32
                add(disc(c[0], c[1], r * 1.12), body, body + 1.5)
                add(disc(c[0], c[1], r), body + 1.5, drum_top)
                dome(c[0], c[1], r, drum_top, (H - drum_top) * (1 if opt.get('nolantern') else 0.78))
                if not opt.get('nolantern'):
                    lt = drum_top + (H - drum_top) * 0.78
                    add(disc(c[0], c[1], r * 0.22, 8), lt, H - 1)
                    spire(c[0], c[1], r * 0.2, H - 1, H, 2)
        elif recipe == 'lighthouse':
            r0 = max(3.5, min(math.sqrt(F.area / math.pi), 8))
            n = 12
            shaft = H * 0.82
            add(disc(c[0], c[1], r0 * 1.6), 0, 3)                   # the keeper's base
            for k in range(n):
                add(disc(c[0], c[1], r0 * (1 - 0.38 * k / n)), shaft * k / n, shaft * (k + 1) / n)
            add(disc(c[0], c[1], r0 * 0.85), shaft, shaft + 1)       # the gallery
            add(disc(c[0], c[1], r0 * 0.5), shaft + 1, H * 0.94)     # the lantern
            dome(c[0], c[1], r0 * 0.52, H * 0.94, H * 0.06, 3)
        elif recipe == 'obelisk':
            w0 = max(4, min(math.sqrt(F.area) * 0.6, 9))
            add(rect(c[0], c[1], w0 * 1.6, w0 * 1.6), 0, 3)
            n = 14
            for k in range(n):
                f = 1 - 0.45 * k / n
                add(rect(c[0], c[1], w0 * f, w0 * f), 3 + (H * 0.9 - 3) * k / n, 3 + (H * 0.9 - 3) * (k + 1) / n)
            spire(c[0], c[1], w0 * 0.55, H * 0.9, H, 4)
        elif recipe == 'bowl':
            ring_w = max(8, min(W, L) * 0.2)
            inner = F.buffer(-ring_w)
            seats = F.difference(inner)
            if opt.get('horseshoe'):                         # open at one end
                seats = seats.difference(rect(*(c + ax * L * 0.42), L * 0.3, W * 0.7))
            add(seats.difference(F.buffer(-ring_w * 0.35)), 0, H)
            add(F.buffer(-ring_w * 0.35).difference(F.buffer(-ring_w * 0.7)).intersection(seats), 0, H * 0.72)
            add(F.buffer(-ring_w * 0.7).difference(inner).intersection(seats), 0, H * 0.45)
            add(inner, 0, 0.6)
            if opt.get('roof'):
                add(F.difference(F.buffer(-ring_w * 0.9)), H, H + 1.5)
        elif recipe == 'arena':
            add(F, 0, H * 0.55)
            n = 6
            for k in range(n):
                add(F.buffer(-min(W, L) * 0.42 * (k + 1) / (n + 1)), H * 0.55 + H * 0.45 * k / n, H * 0.55 + H * 0.45 * (k + 1) / n)
        elif recipe == 'vault':                              # a barrel roof along the long side
            eave = H * opt['eave']
            add(F, 0, eave)
            n = 7
            for k in range(n):
                w = W * math.cos(math.asin((k + 1) / (n + 0.4)))
                add(F.intersection(rect(c[0], c[1], L * 2, w)), eave + (H - eave) * k / n, eave + (H - eave) * (k + 1) / n)
        elif recipe == 'gable':
            gable(F, H * opt['eave'], H)
        elif recipe == 'clocktower':
            body = opt['body']
            gable(F, body * 0.8, body)
            tw = max(6, min(W * 0.28, 13))
            tc = c + ax * (L / 2 - tw * 0.8)
            add(rect(tc[0], tc[1], tw, tw), 0, H * 0.72)
            add(rect(tc[0], tc[1], tw * 1.12, tw * 1.12), H * 0.72, H * 0.8)     # the clock stage
            spire(tc[0], tc[1], tw * 0.9, H * 0.8, H, 6)
        elif recipe == 'castle':
            body = H * opt['body']
            add(F, 0, body)
            for q in cs:                                     # a round turret on each corner
                add(disc(q[0], q[1], max(2.5, W * 0.11), 10), 0, H * 0.9)
                spire(q[0], q[1], max(3, W * 0.15), H * 0.9, H, 3)
            add(disc(c[0], c[1], max(3, W * 0.14), 10), 0, H)
        elif recipe in ('tower', 'steps'):
            tiers = opt['tiers']
            prev = 0
            for inset, frac in tiers:
                add(F.buffer(-inset, join_style=2) if inset else F, prev, H * frac)
                prev = H * frac
            if opt.get('spire'):
                spire(c[0], c[1], 3, H, H * (1 + opt['spire']), 4)
        if not parts:
            continue
        ent = [best]
        for poly, base, top in parts:
            ring = [to_ll(q) for q in list(poly.exterior.coords)[:-1]]
            flat, x, y = [], 0, 0
            for lo, la in ring:
                nx, ny = int(round((lo - O[0]) * S)), int(round((la - O[1]) * S))
                flat += [nx - x, ny - y]; x, y = nx, ny
            ent.append([base, top, *flat])
        groups[best] = ent
        made += 1
        # the camera frames a landmark by its point, height and width: make them those of the shape just built
        allp = [poly for poly, _, _ in parts]
        bx0 = min(g.bounds[0] for g in allp); by0 = min(g.bounds[1] for g in allp); bx1 = max(g.bounds[2] for g in allp); by1 = max(g.bounds[3] for g in allp)
        cll = to_ll(((bx0 + bx1) / 2, (by0 + by1) / 2))
        fit[name] = {'p': [round(cll[0], 6), round(cll[1], 6)], 'h': round(max(t for _, _, t in parts), 1), 'w': round(max(bx1 - bx0, by1 - by0))}
        print(f'  {name:36s} {recipe:10s} {len(parts):3d} parts, top {max(t for _, _, t in parts):.0f} m')
    d['g'] = [groups[k] for k in sorted(groups)]
    for fn in ('data/nj-landmarks.json', 'data/nj-places.json'):
        fp = os.path.join(ROOT, fn)
        lst = json.load(open(fp))
        for x in lst:
            if x.get('k') == 'lm' and x['n'] in fit:
                x.update(fit[x['n']])
        json.dump(lst, open(fp, 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(d, open(p, 'w'), separators=(',', ':'))
    print(made, 'landmarks shaped;', os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main()
