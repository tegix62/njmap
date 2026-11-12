#!/usr/bin/env python3
"""Meshes for the towers the 2014 survey lacks (built since), from OpenStreetMap's building parts as republished by Overture Maps
(https://overturemaps.org, theme buildings / building_part, ODbL: (c) OpenStreetMap contributors). Merged into data/tower-meshes.json.

  python3 tools/extract_osm_meshes.py [data/tower-meshes.json]

Each part is an outline with a bottom (min_height) and top (height): drawn as walls and a roof. A tower is the parts that touch the
footprint of its tall parts. Needs: pip install pyarrow fsspec aiohttp requests shapely numpy. Reads one row group of a 600 MB parquet
file over HTTP range requests, so only a few MB come down.
"""
import base64, json, math, os, sys
import fsspec, numpy as np, pyarrow.parquet as pq
from shapely import wkb
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE = '2026-10-21.0'
URL = None  # set below (needs the part file's name: listed from the bucket)
BOXES = [(-73.9860, 40.7480, -73.9690, 40.7690), (-74.0200, 40.7050, -74.0000, 40.7160)]  # Midtown, the Financial District
# the towers to build, with the colour of the glass/stone: name -> (rgb, min share of the official height the tallest part must reach)
TOWERS = {
    'One Vanderbilt': (176, 190, 202), 'Central Park Tower': (178, 192, 200), '111 West 57th Street': (196, 202, 206),
    '432 Park Avenue': (214, 212, 205), 'Seagram Building': (122, 102, 82), '53 West 53rd': (132, 140, 150), 'Four World Trade Center': (164, 178, 188),
    '53 West 53rd': (190, 197, 203),
}

# towers whose parts are constant-width columns but whose real shape tapers: (height where the taper starts, height where it ends,
# share of the width left at the end); the walls are split every 20 m so they slant smoothly
# a stone base and a glass shaft: name -> (height of the base, base rgb). Parts above the base start at its roof (the 1928 building's
# facade is a ring, the tower rises from inside it) and the colour changes at that height with its own vertices (no fade)
SPLIT = {}  # (none now: the survey's Hearst is better than a base and a plain box)
TAPER = {'One Vanderbilt': (120, 330, 0.60), '53 West 53rd': (90, 320, 0.72)}
# towers the parts do not have (or have wrong): extruded from the footprint data's outline to the official height, the shader draws the facade
# outlines taken from Overture's whole-building layer (OpenStreetMap's way, 320 m, 77 floors, 2,176 m2) where the NYC footprint is less exact:
# 53 West 53rd, a long sliver with a zig-zag edge
OUTLINE = {'53 West 53rd': [[-73.977804, 40.761918], [-73.977777, 40.761956], [-73.978122, 40.762097], [-73.97816, 40.762046], [-73.978208, 40.761984], [-73.978263, 40.761907], [-73.978322, 40.761932], [-73.978424, 40.761792], [-73.978484, 40.761709], [-73.978529, 40.761644], [-73.978122, 40.761479], [-73.978101, 40.761509], [-73.978032, 40.761606], [-73.977917, 40.761764], [-73.977996, 40.761797], [-73.977968, 40.761836], [-73.977887, 40.761803]]}
HULL = {'Seagram Building'}
PRISMS = {'Seagram Building': 157.0, '53 West 53rd': 320.0}
# open steel crowns above the roof: name -> roof height in metres (posts and rails round the roof's outline, 22 m up)
FRAMES = {'New York Times Building': 240.0}
# a pitched roof the survey lacks: name -> (official top m, rgb); a pyramid on the tower's top outline
CAPS = {}  # (the survey's Met Life Tower already has its stepped roof; extract_meshes.py colours it)
# masts and spires missing from the survey: name -> (top metres, width at the foot in metres, rgb); stood on the tower's roof
MASTS = {'New York Times Building': (319, 2.6, (150, 158, 166))}


def earclip(pts):
    n = len(pts)
    idx = list(range(n))
    if sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n)) < 0:
        idx.reverse()
    cr = lambda a, b, c: (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0])
    ins = lambda p, a, b, c: cr(a, b, p) >= -1e-9 and cr(b, c, p) >= -1e-9 and cr(c, a, p) >= -1e-9
    out, g = [], 0
    while len(idx) > 3 and g < 4 * n * n:
        g += 1
        for k in range(len(idx)):
            a, b, c = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            if cr(a, b, c) <= 1e-12 or any(ins(p, a, b, c) for p in idx if p not in (a, b, c)):
                continue
            out.append((a, b, c)); idx.pop(k); break
        else:
            break
    if len(idx) == 3:
        out.append(tuple(idx))
    return out


def footprint_prisms(sky):
    """name -> the outline (lon/lat polygon) of the tower's footprint in data/buildings-midtown.json: the biggest one whose middle is within 25 m."""
    d = json.load(open(os.path.join(ROOT, 'data/buildings-midtown.json')))
    o, sc = d['o'], d['s']
    out = {}
    for name in PRISMS:
        lon0, lat0 = sky[name]['p']
        best = None
        for b in d['b']:
            x = y = 0
            ring = []
            for i in range(2, len(b), 2):
                x += b[i]; y += b[i + 1]
                ring.append((o[0] + x / sc, o[1] + y / sc))
            if len(ring) < 3:
                continue
            g = Polygon(ring).buffer(0)
            c = g.centroid
            if g.geom_type == 'Polygon' and math.hypot((c.x - lon0) * 84200, (c.y - lat0) * 111000) < 25 and (best is None or g.area > best.area):
                best = g
        if name in OUTLINE:
            best = Polygon(OUTLINE[name]).buffer(0)
        if best is not None:
            if name in HULL:
                best = best.convex_hull        # (the outline has a notch cut into it; the real tower is a plain rectangle)
            out[name] = best
            print(f'  {name}: footprint {best.area * 84200 * 111000:.0f} m2')
    return out


def fetch_parts(boxes=None):
    BOXES_ = boxes or BOXES
    import urllib.request, re
    base = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
    key = re.search(r'<Key>([^<]+\.parquet)</Key>', urllib.request.urlopen(base + f'?list-type=2&prefix=release/{RELEASE}/theme=buildings/type=building_part/').read().decode()).group(1)
    pf = pq.ParquetFile(fsspec.open(base + key, 'rb', block_size=8 * 1024 * 1024).open())
    md = pf.metadata
    ix = {md.schema.column(i).path: i for i in range(md.num_columns)}
    out = []
    for g in range(md.num_row_groups):
        rg = md.row_group(g)
        st = lambda n: (rg.column(ix[n]).statistics.min, rg.column(ix[n]).statistics.max)
        if not any(not (st('bbox.xmax')[1] < B[0] or st('bbox.xmin')[0] > B[2] or st('bbox.ymax')[1] < B[1] or st('bbox.ymin')[0] > B[3]) for B in BOXES_):
            continue
        for r in pf.read_row_group(g, columns=['height', 'min_height', 'geometry', 'bbox']).to_pylist():
            b = r['bbox']
            if r['height'] and any(b['xmin'] > B[0] and b['xmax'] < B[2] and b['ymin'] > B[1] and b['ymax'] < B[3] for B in BOXES_):
                out.append((wkb.loads(bytes(r['geometry'])), r['min_height'] or 0.0, r['height']))
    return out


def main():
    dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data/tower-meshes.json')
    sky = {s['n']: s for s in json.load(open(os.path.join(ROOT, 'data/skyscrapers.json')))}
    parts = fetch_parts()
    print(len(parts), 'parts')
    prism_poly = footprint_prisms(sky)
    old = json.load(open(dst)) if os.path.exists(dst) else {'v': 2, 't': []}
    byname = {t['n']: t for t in old['t']}
    for name, rgb in TOWERS.items():
        s = sky[name]
        lon0, lat0 = s['p']
        kx, ky = 111320 * math.cos(math.radians(lat0)), 110574
        near = [(g, a, b) for g, a, b in parts if math.hypot((g.centroid.x - lon0) * kx, (g.centroid.y - lat0) * ky) < 60 and g.geom_type == 'Polygon']
        if name in PRISMS:
            near = [(prism_poly[name], 0.0, PRISMS[name])] if name in prism_poly else []
        tall = [g for g, a, b in near if b >= 0.3 * s['h'] or a > 0]
        if not tall or max(b for g, a, b in near) < 0.8 * s['h']:
            print(' ', name, 'parts do not reach its height: skipped'); continue
        core = unary_union(tall).buffer(2.0 / kx)
        mine = [(g, a, b) for g, a, b in near if g.intersects(core)]
        if name in SPLIT:                        # only what stands on the base: its largest part
            base = max(near, key=lambda t: t[0].area)[0].buffer(2.0 / kx)
            mine = [(g, a, b) for g, a, b in near if base.contains(g.representative_point())]
        cen = unary_union([g for g, a, b in mine if b >= 0.3 * s['h']]).centroid
        cx, cy = cen.x, cen.y
        verts, cols, idx, key = [], [], [], {}
        tp = TAPER.get(name)
        sp = SPLIT.get(name)
        def vid(x, y, z, up=None):
            f = 1.0
            if tp:
                f = 1 - (1 - tp[2]) * min(1, max(0, (z - tp[0]) / (tp[1] - tp[0])))
            q = (round((x - cx) * kx * 10 * f), round((y - cy) * ky * 10 * f), round(z * 10))
            stone = bool(sp) and (z < sp[0] if up is None else not up)
            q = q + (stone,)
            if q not in key:
                key[q] = len(verts); verts.append(q[:3])
                c = np.array(sp[1] if stone else rgb, float)
                cols.append(tuple(int(v) for v in np.clip(c * (0.93 + 0.07 * min(1, z / s['h'])), 0, 255)))
            return key[q]
        if sp:                                   # the shaft stands on the base's roof; the base is only the base
            mine = [(g, sp[0] if z1 > sp[0] + 20 else z0, z1) for g, z0, z1 in mine]
        for g, z0, z1 in mine:
            ring = list(g.exterior.coords)[:-1]
            if len(ring) < 3:
                continue
            for i in range(len(ring)):
                (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % len(ring)]
                zs = [z0, z1]
                if tp:
                    zs = sorted({z0, z1, *[z for z in range(0, 600, 20) if z0 < z < z1]})
                for za, zb in zip(zs, zs[1:]):
                    ub = None if not sp else (zb > sp[0] + 0.01 and za >= sp[0] - 0.01)   # a quad is stone below the base's roof, glass above
                    a, b, c, d = vid(x0, y0, za, ub), vid(x1, y1, za, ub), vid(x1, y1, zb, ub), vid(x0, y0, zb, ub)
                    if len({a, b, c}) == 3: idx += [a, b, c]
                    if len({a, c, d}) == 3: idx += [a, c, d]
            for t in earclip([((x - cx) * kx, (y - cy) * ky) for x, y in ring]):
                tri = [vid(ring[i][0], ring[i][1], z1, (z1 > sp[0] + 0.01) if sp else None) for i in t]
                if len(set(tri)) == 3: idx += tri
        if len(verts) > 65000:
            print(' ', name, 'too many vertices'); continue
        h = max(b for g, a, b in mine)
        rec = {'n': name, 'lon': round(cx, 6), 'lat': round(cy, 6), 'h': round(h, 1), 'tris': len(idx) // 3,
               'p': base64.b64encode(np.array(verts, np.int16).reshape(-1).tobytes()).decode(),
               'c': base64.b64encode(np.array(cols, np.uint8).reshape(-1).tobytes()).decode(),
               'i': base64.b64encode(np.array(idx, np.uint16).tobytes()).decode(), 'src': 'osm'}
        byname[name] = rec
        print(f'  {name}: {len(mine)} parts, {rec["tris"]} triangles, top {h:.0f} m (official {s["h"]})')
    def decode(t):
        return (np.frombuffer(base64.b64decode(t['p']), np.int16).reshape(-1, 3).tolist(), np.frombuffer(base64.b64decode(t['c']), np.uint8).reshape(-1, 3).tolist(), np.frombuffer(base64.b64decode(t['i']), np.uint16).tolist())
    def encode(t, p, c, i):
        t['p'] = base64.b64encode(np.array(p, np.int16).reshape(-1).tobytes()).decode()
        t['c'] = base64.b64encode(np.array(c, np.uint8).reshape(-1).tobytes()).decode()
        t['i'] = base64.b64encode(np.array(i, np.uint16).tobytes()).decode()
        t['tris'] = len(i) // 3
    def box(p, c, i, x0, y0, z0, x1, y1, z1, rgb):
        n0 = len(p)
        for z in (z0, z1):
            for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
                p.append([x, y, z]); c.append(list(rgb))
        for k in range(4):
            a, b = n0 + k, n0 + (k + 1) % 4
            i += [a, b, b + 4, a, b + 4, a + 4]
        i += [n0 + 4, n0 + 5, n0 + 6, n0 + 4, n0 + 6, n0 + 7]
    for name, roof in FRAMES.items():
        t = byname.get(name)
        if not t or t.get('frame'):
            continue
        p, c, i = decode(t)
        band = [q for q in p if roof * 10 - 150 <= q[2] <= roof * 10]
        x0, x1 = min(q[0] for q in band), max(q[0] for q in band)
        y0, y1 = min(q[1] for q in band), max(q[1] for q in band)
        z0, z1 = round(roof * 10), round(roof * 10 + 220)
        rgb = (214, 219, 224)
        step_ = 36
        xs = list(range(x0, x1 + 1, step_)) + [x1]
        ys = list(range(y0, y1 + 1, step_)) + [y1]
        for x in xs:
            for y in (y0, y1):
                box(p, c, i, x - 3, y - 3, z0, x + 3, y + 3, z1, rgb)
        for y in ys[1:-1]:
            for x in (x0, x1):
                box(p, c, i, x - 3, y - 3, z0, x + 3, y + 3, z1, rgb)
        for z in (z0 + 70, z0 + 140, z1 - 4):
            box(p, c, i, x0 - 2, y0 - 2, z, x1 + 2, y0 + 2, z + 4, rgb)
            box(p, c, i, x0 - 2, y1 - 2, z, x1 + 2, y1 + 2, z + 4, rgb)
            box(p, c, i, x0 - 2, y0 - 2, z, x0 + 2, y1 + 2, z + 4, rgb)
            box(p, c, i, x1 - 2, y0 - 2, z, x1 + 2, y1 + 2, z + 4, rgb)
        encode(t, p, c, i)
        t['frame'] = 1
        print(f'  {name}: steel crown on {(x1 - x0) / 10:.0f} x {(y1 - y0) / 10:.0f} m roof')
    for name, (top, rgb) in CAPS.items():
        t = byname.get(name)
        if not t or t.get('cap'):
            continue
        p, c, i = decode(t)
        zt = max(q[2] for q in p)
        band = [q for q in p if q[2] >= zt - 60]
        x0, x1 = min(q[0] for q in band), max(q[0] for q in band)
        y0, y1 = min(q[1] for q in band), max(q[1] for q in band)
        cx_, cy_ = (x0 + x1) // 2, (y0 + y1) // 2
        hx, hy = (x1 - x0) // 2, (y1 - y0) // 2
        print(f'  {name}: top outline {2 * hx / 10:.0f} x {2 * hy / 10:.0f} m at {zt / 10:.0f} m')
        n0 = len(p)
        for x, y in ((cx_ - hx, cy_ - hy), (cx_ + hx, cy_ - hy), (cx_ + hx, cy_ + hy), (cx_ - hx, cy_ + hy)):
            p.append([x, y, zt]); c.append(list(rgb))
        # a pyramid, then a small lantern on its tip
        zl = round(zt + (top * 10 - zt) * 0.72)
        for x, y in ((cx_ - hx // 4, cy_ - hy // 4), (cx_ + hx // 4, cy_ - hy // 4), (cx_ + hx // 4, cy_ + hy // 4), (cx_ - hx // 4, cy_ + hy // 4)):
            p.append([x, y, zl]); c.append(list(rgb))
        for k in range(4):
            a, b = n0 + k, n0 + (k + 1) % 4
            i += [a, b, b + 4, a, b + 4, a + 4]
        gold = (214, 178, 96)
        box(p, c, i, cx_ - hx // 4, cy_ - hy // 4, zl, cx_ + hx // 4, cy_ + hy // 4, round(top * 10), gold)
        encode(t, p, c, i)
        t['h'] = float(top)
        t['cap'] = 1
    for name, (top, w, rgb) in MASTS.items():
        t = byname.get(name)
        if not t or t.get('mast'):
            continue
        p = np.frombuffer(base64.b64decode(t['p']), np.int16).reshape(-1, 3).tolist()
        c = np.frombuffer(base64.b64decode(t['c']), np.uint8).reshape(-1, 3).tolist()
        i = np.frombuffer(base64.b64decode(t['i']), np.uint16).tolist()
        z0, z1 = (t['h'] - 6) * 10, top * 10
        n0 = len(p)
        # a four-sided needle, narrowing: rings at the foot, a third up and the tip
        ring = lambda z, hw: [(-hw, -hw, z), (hw, -hw, z), (hw, hw, z), (-hw, hw, z)]
        levels = [(z0, w * 5), (z0 + (z1 - z0) * 0.35, w * 3), (z1, w * 0.4)]
        for z, hw in levels:
            for q in ring(round(z), round(hw)):
                p.append(list(q)); c.append(list(rgb))
        for L in range(2):
            for k in range(4):
                a, b = n0 + L * 4 + k, n0 + L * 4 + (k + 1) % 4
                A, B = a + 4, b + 4
                i += [a, b, B, a, B, A]
        t['p'] = base64.b64encode(np.array(p, np.int16).reshape(-1).tobytes()).decode()
        t['c'] = base64.b64encode(np.array(c, np.uint8).reshape(-1).tobytes()).decode()
        t['i'] = base64.b64encode(np.array(i, np.uint16).tobytes()).decode()
        t['tris'] = len(i) // 3
        t['h'] = float(top)
        t['mast'] = 1
        print(f'  {name}: mast to {top} m')
    json.dump({'v': 2, 't': list(byname.values())}, open(dst, 'w'), separators=(',', ':'))
    print(len(byname), 'towers ->', dst, os.path.getsize(dst) // 1024, 'KB')


if __name__ == '__main__':
    main()
