#!/usr/bin/env python3
"""Merge the per-district results of tools/extract_towers.py into data/towers.json.

  python3 tools/build_towers.py <dir with MNxx.json files> [min height in metres, default 150]

A building that two district files both cover (they overlap a little at their edges) is kept once, from the file that has
more slabs for it. Output: {"v": 1, "t": [[lon, lat, heightM, [[baseM, topM, [x, y, x, y, ...]], ...]], ...]} with the
outline coordinates in whole decimetres from the lon/lat (integers keep the file small).
"""
import glob, json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# The survey is a hybrid of CityGML levels 1 and 2: some towers come out with holes (no outline at some heights, from walls
# or roofs the model lacks) and some lose the part that matters. A tower is kept only when slabs cover at least 92% of 50
# heights between 2% and 80% of its height, and not if it is on this list (checked by eye against what the building really
# looks like): the Chrysler Building's survey has the right place and height (328 m) but a bare 5 m needle where its crown is.
NOT_THE_SHAPE = []
CHRYSLER = (-73.97535, 40.75166)  # built by hand from the survey (see chrysler() below)
HEARST = (-73.98301, 40.76711)  # the NW corner of 8th Ave and 57th St (see hearst() below)


def chrysler(b):
    """The Chrysler Building. The survey has its base and its shaft (the 113 m to 205 m slab) right but no crown, only a
    needle, so the base and shaft are kept (the base clipped to within 12 m of the shaft, which drops the low buildings the
    survey ran into it) and the crown is generated: seven terraced arches of thin rings, the shaft's own rectangle scaled down along a
    pointed curve (about 84% of the shaft's width at 205 m to a few percent at 282 m), then the needle to the survey's 328 m."""
    from shapely.geometry import Polygon
    from shapely import affinity
    slabs = [(s[0], s[1], Polygon(s[2])) for s in b['slabs'] if len(s[2]) >= 3]
    shaft = max((s for s in slabs if s[0] >= 100 and s[1] <= 215 and s[1] - s[0] > 60), key=lambda s: s[1] - s[0])
    sp = shaft[2]
    near = sp.buffer(12)
    out = []
    for lo, hi, p in slabs:
        if hi > shaft[0] + 0.5:
            continue
        q = p.intersection(near)
        if q.is_empty:
            continue
        for g in (q.geoms if q.geom_type == 'MultiPolygon' else [q]):
            if g.geom_type == 'Polygon' and g.area > 20:
                out.append((lo, hi, g))
    out.append(shaft)
    top = shaft[1]
    crown_top = 276.0   # where the arches end and the spire starts (the spire's tip is at the official 319 m)
    tip = 319.0
    STONE, SILVER, DARK, NEEDLE = '#e6e0d3', '#d6dbe0', '#5f6a74', '#c5cbd0'
    coloured = [(lo, hi, g, STONE) for lo, hi, g in out]
    # The crown is seven nested arches (upside-down U shapes) on each of the four faces, over a dark core that shows between them
    # as the triangular windows. Everything is in the shaft's own axes: u along its long side, v across it.
    mrr = sp.minimum_rotated_rectangle
    P = list(mrr.exterior.coords)[:4]
    e1 = (P[1][0] - P[0][0], P[1][1] - P[0][1]); e2 = (P[2][0] - P[1][0], P[2][1] - P[1][1])
    L1, L2 = math.hypot(*e1), math.hypot(*e2)
    uu = (e1[0] / L1, e1[1] / L1); vv = (e2[0] / L2, e2[1] / L2)
    hu, hv = L1 / 2, L2 / 2
    cx, cy = sp.centroid.coords[0]
    def rect(cu, cv, du, dv):
        pts = []
        for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            a_, b_ = cu + su * du, cv + sv * dv
            pts.append([round(cx + uu[0] * a_ + vv[0] * b_, 1), round(cy + uu[1] * a_ + vv[1] * b_, 1)])
        return Polygon(pts)
    C = crown_top - top
    def env(z):  # the crown's outline, as a share of the shaft's size: about 78% at the foot, closing like an ogive to ~8%
        u = max(0.0, min(1.0, (z - top) / C))
        return 0.78 * (1 - 0.92 * u ** 2.1)
    # the dark core
    z = top
    while z < crown_top - 0.01:
        z2 = min(z + 6.0, crown_top)
        k = env((z + z2) / 2) * 0.86
        coloured.append((z, z2, affinity.scale(sp, k, k, origin=sp.centroid), DARK))
        z = z2
    ARCHES, BAND, DEPTH = 7, 2.4, 1.2
    for k in range(ARCHES):
        apex = top + C * (0.34 + 0.095 * k)
        frac = 1 - 0.115 * k                    # each inner arch spans a little less of the face
        z = top
        while z < apex - 0.01:
            z2 = min(z + 3.0, apex)
            zm = (z + z2) / 2
            e = env(zm)
            t = (zm - top) / (apex - top)
            half = math.sqrt(max(0.0, 1 - t * t))   # a semi-ellipse standing on the foot of the crown
            for along_u in (True, False):
                span = (hu if along_u else hv) * e * frac * half   # how far each leg stands from the middle of the face
                off = (hv if along_u else hu) * e * 0.97           # how far out the face is
                for sgn in (-1, 1):
                    if span <= BAND:       # the two legs have met: the top of the arch, one piece
                        parts = [(0.0, max(span, 0.5))]
                    else:
                        parts = [(-(span - BAND / 2), BAND / 2), ((span - BAND / 2), BAND / 2)]
                    for cu_, du_ in parts:
                        g = rect(cu_, sgn * off, du_, DEPTH) if along_u else rect(sgn * off, cu_, DEPTH, du_)
                        coloured.append((z, z2, g, SILVER))
            z = z2
    # the spire: a needle from 10% of the shaft's width at the top of the arches down to 3% at the tip
    z = crown_top
    while z < tip - 0.01:
        z2 = min(z + 6.0, tip)
        k = 0.10 - 0.07 * ((z + z2) / 2 - crown_top) / (tip - crown_top)
        coloured.append((z, z2, affinity.scale(sp, k, k, origin=sp.centroid), NEEDLE))
        z = z2
    out = coloured
    rec = dict(b)
    rec['h'] = tip
    rec['slabs'] = [[round(lo, 1), round(hi, 1), [[round(x, 1), round(y, 1)] for x, y in list(g.exterior.coords)[:-1]], col] for lo, hi, g, col in out]
    return rec


def hearst(b):
    """Hearst Tower. The survey has its place and height (about 191 m with the roof gear; the tower is 182 m) and the 1928
    stone base (a 41 x 40 m block, 24 m high) and the lower shaft right, but steps the shaft in at 93 m and again near the
    top, which the real tower doesn't do (a flat-topped glass prism with notched corners, the same width all the way up). So:
    the base in stone, the survey's shaft outline carried straight up to the roof in glass, and a small roof stage."""
    base = next(s for s in b['slabs'] if s[0] == 0 and len(s[2]) >= 3)
    shaft = max((s for s in b['slabs'] if 20 < s[0] < 30 and len(s[2]) >= 12), key=lambda s: len(s[2]))
    top = 182.0
    def scaled(ring, k):
        cx = sum(p[0] for p in ring) / len(ring); cy = sum(p[1] for p in ring) / len(ring)
        return [[round(cx + (x - cx) * k, 1), round(cy + (y - cy) * k, 1)] for x, y in ring]
    rec = dict(b)
    rec['h'] = 186.0
    rec['slabs'] = [
        [0.0, round(base[1], 1), base[2], '#cdbfa5'],
        [round(base[1], 1), top, shaft[2], '#7f95a6'],
        [top, 186.0, scaled(shaft[2], 0.55), '#aab4bd'],
    ]
    return rec


def covered(slabs, height):
    ok = 0
    for k in range(50):
        h = height * (0.02 + 0.78 * k / 49)
        if any(s[0] <= h < s[1] and len(s[2]) >= 3 for s in slabs):
            ok += 1
    return ok / 50


def main():
    src = sys.argv[1]
    min_h = float(sys.argv[2]) if len(sys.argv) > 2 else 150
    allb, dropped = [], []
    for f in sorted(glob.glob(os.path.join(src, 'MN*.json'))):
        for b in json.load(open(f)):
            if b['h'] < min_h or len(b['slabs']) < 3:  # (a plain box needs no model: the footprint data draws it)
                continue
            if math.hypot((b['lon'] - HEARST[0]) * 84200, (b['lat'] - HEARST[1]) * 111000) < 25:
                allb.append(hearst(b))
                continue
            if math.hypot((b['lon'] - CHRYSLER[0]) * 84200, (b['lat'] - CHRYSLER[1]) * 111000) < 40:
                b = chrysler(b)
                allb.append(b)
                continue
            if covered(b['slabs'], b['h']) < 0.92:
                dropped.append((round(b['h']), b['lon'], b['lat'], 'holes'))
                continue
            if any(math.hypot((b['lon'] - lo) * 84200, (b['lat'] - la) * 111000) < 40 for _, lo, la in NOT_THE_SHAPE):
                dropped.append((round(b['h']), b['lon'], b['lat'], 'listed'))
                continue
            allb.append(b)
    keep = []
    for b in sorted(allb, key=lambda b: -len(b['slabs'])):
        if any(math.hypot((b['lon'] - k['lon']) * 84200, (b['lat'] - k['lat']) * 111000) < 20 for k in keep):
            continue
        keep.append(b)
    keep.sort(key=lambda b: -b['h'])
    t = []
    for b in keep:
        slabs = [[s[0], s[1], [round(v * 10) for xy in s[2] for v in xy]] + (list(s[3:4]) if len(s) > 3 else []) for s in b['slabs']]
        t.append([b['lon'], b['lat'], round(b['h']), slabs])
    path = os.path.join(ROOT, 'data/towers.json')
    json.dump({'v': 1, 't': t}, open(path, 'w'), separators=(',', ':'))
    print(f'dropped {len(dropped)} (holes or listed):', sorted(dropped, reverse=True)[:12])
    print(f'{len(allb)} -> {len(keep)} towers, {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    main()
