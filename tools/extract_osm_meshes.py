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
    '432 Park Avenue': (214, 212, 205), 'Four World Trade Center': (164, 178, 188),
    '53 West 53rd': (190, 197, 203),
}

# towers whose parts are constant-width columns but whose real shape tapers: (height where the taper starts, height where it ends,
# share of the width left at the end); the walls are split every 20 m so they slant smoothly
TAPER = {'One Vanderbilt': (120, 330, 0.60)}
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
    old = json.load(open(dst)) if os.path.exists(dst) else {'v': 2, 't': []}
    byname = {t['n']: t for t in old['t']}
    for name, rgb in TOWERS.items():
        s = sky[name]
        lon0, lat0 = s['p']
        kx, ky = 111320 * math.cos(math.radians(lat0)), 110574
        near = [(g, a, b) for g, a, b in parts if math.hypot((g.centroid.x - lon0) * kx, (g.centroid.y - lat0) * ky) < 60 and g.geom_type == 'Polygon']
        tall = [g for g, a, b in near if b >= 0.3 * s['h'] or a > 0]
        if not tall or max(b for g, a, b in near) < 0.8 * s['h']:
            print(' ', name, 'parts do not reach its height: skipped'); continue
        core = unary_union(tall).buffer(2.0 / kx)
        mine = [(g, a, b) for g, a, b in near if g.intersects(core)]
        cen = unary_union([g for g, a, b in mine if b >= 0.3 * s['h']]).centroid
        cx, cy = cen.x, cen.y
        verts, cols, idx, key = [], [], [], {}
        tp = TAPER.get(name)
        def vid(x, y, z):
            f = 1.0
            if tp:
                f = 1 - (1 - tp[2]) * min(1, max(0, (z - tp[0]) / (tp[1] - tp[0])))
            q = (round((x - cx) * kx * 10 * f), round((y - cy) * ky * 10 * f), round(z * 10))
            if q not in key:
                key[q] = len(verts); verts.append(q)
                c = np.array(rgb, float)
                cols.append(tuple(int(v) for v in np.clip(c * (0.93 + 0.07 * min(1, z / s['h'])), 0, 255)))
            return key[q]
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
                    a, b, c, d = vid(x0, y0, za), vid(x1, y1, za), vid(x1, y1, zb), vid(x0, y0, zb)
                    if len({a, b, c}) == 3: idx += [a, b, c]
                    if len({a, c, d}) == 3: idx += [a, c, d]
            for t in earclip([((x - cx) * kx, (y - cy) * ky) for x, y in ring]):
                tri = [vid(ring[i][0], ring[i][1], z1) for i in t]
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
