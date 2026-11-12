#!/usr/bin/env python3
"""A building's real roof shape from the city's 2017 aerial LiDAR, as a mesh: merged into data/landmark-meshes.json.

  python3 tools/lidar_mesh.py "Javits Center"        (names from LIDAR below)

Source: "2017 NYC Topobathy Lidar" (NYC / NOAA, public domain), 2,500 ft tiles of cloud-optimised LAZ on NOAA's public bucket
(noaa-nos-coastal-lidar-pds): only the window round the building is read, over HTTP range requests. The points are put in a local
east/north frame (the tile grid is UTM, 0.65 degrees off true north here), the highest return in each cell is the surface, the
building is the connected block of cells above 3.5 m that touches the seed outline, and the surface (rounded to 1 m) becomes:
a top quad for each merged run of equal-height cells, and a wall wherever neighbouring cells differ in height. No facade detail:
the LiDAR sees roofs and the tops of walls.  Needs: pip install "laspy[lazrs]" fsspec aiohttp requests pyproj shapely numpy scipy
"""
import base64, json, math, os, re, sys, urllib.request
import numpy as np
from laspy import CopcReader, Bounds
import fsspec
from pyproj import Transformer
from scipy import ndimage
from skimage import measure
from shapely.geometry import Polygon, MultiPoint, box
from shapely.ops import unary_union, triangulate

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extract_osm_meshes as X
import shapely

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://noaa-nos-coastal-lidar-pds.s3.amazonaws.com/laz/geoid18/9306/'
CELL = 1.0          # metres
STEP = 1.5          # the surface is rounded to this many metres
SIMPLIFY = 0.9      # the outlines are simplified to this many metres
MINH = 3.5          # a building is above this
# name -> (rgb, seed: 'osm' parts from data/landmark-meshes.json's old record outline, or a radius in m round the landmark's position)
LIDAR = {'Javits Center': {'rgb': (168, 190, 200), 'radius': 190, 'sea': 40}}
to_utm = Transformer.from_crs(4326, 32618, always_xy=True)
to_ll = Transformer.from_crs(32618, 4326, always_xy=True)
to_ft = Transformer.from_crs(4326, 2263, always_xy=True)


def tile_files(lon, lat, R):
    """The tile files that cover a square of R metres round the point."""
    idx = urllib.request.urlopen(BASE + 'index.html').read().decode()
    files = {re.match(r'\d+_(\d+)\.', f).group(1): f for f in re.findall(r'href="([^"]+\.copc\.laz)"', idx)}
    dm = R / 0.3048
    x, y = to_ft.transform(lon, lat)
    out = set()
    for ax in (x - dm, x + dm):
        for ay in (y - dm, y + dm):
            kx, ky = math.floor(ax / 2500) * 2.5, math.floor(ay / 2500) * 2.5
            code = f'{int(kx)}{int(ky)}'
            if code in files:
                out.add(files[code])
    return sorted(out)


def read_points(lon, lat, R):
    x0, y0 = to_utm.transform(lon, lat)
    pts = []
    for f in tile_files(lon, lat, R * 1.5):
        r = CopcReader(fsspec.open(BASE + f, 'rb', block_size=4 * 1024 * 1024).open())
        q = r.query(Bounds(mins=[x0 - R * 1.4, y0 - R * 1.4, -20], maxs=[x0 + R * 1.4, y0 + R * 1.4, 300]))
        pts.append((np.array(q.x), np.array(q.y), np.array(q.z), np.array(q.classification)))
        print(f'  {f}: {len(q.x)} points', flush=True)
    X, Y, Z, C = (np.concatenate([p[i] for p in pts]) for i in range(4))
    lo, la = to_ll.transform(X, Y)
    kx, ky = 111320 * math.cos(math.radians(lat)), 110574
    return (lo - lon) * kx, (la - lat) * ky, Z, C, kx, ky


def build(name, cfg):
    sky = {s['n']: s for s in json.load(open(os.path.join(ROOT, 'data/skyscrapers.json')))}
    lon0, lat0 = sky[name]['p']
    R = cfg['radius']
    E, N, Z, C, kx, ky = read_points(lon0, lat0, R)
    # the building's own outline from OpenStreetMap's parts (the biggest one sets the grid's direction), so the walls come out straight
    box_ = (lon0 - 0.004, lat0 - 0.004, lon0 + 0.004, lat0 + 0.004)
    parts = [(g, a, b) for g, a, b in X.fetch_parts([box_]) if g.geom_type == 'Polygon' and b <= cfg.get('maxtop', 40) and g.area * kx * ky >= 800
             and math.hypot((g.centroid.x - lon0) * kx, (g.centroid.y - lat0) * ky) < R]
    local = [Polygon([((x - lon0) * kx, (y - lat0) * ky) for x, y in g.exterior.coords]) for g, a, b in parts]
    main = max(local, key=lambda p: p.area)
    rc = list(main.minimum_rotated_rectangle.exterior.coords)
    ang = math.atan2(rc[1][1] - rc[0][1], rc[1][0] - rc[0][0])
    ca, sa = math.cos(ang), math.sin(ang)
    clip = unary_union(local).buffer(cfg.get('pad', 4))
    print(f'  outline: {len(local)} parts, grid turned {math.degrees(ang):.1f} degrees', flush=True)
    U = E * ca + N * sa
    V = -E * sa + N * ca
    keep = (np.abs(U) < R) & (np.abs(V) < R)
    U, V, Z, C = U[keep], V[keep], Z[keep], C[keep]
    n = int(2 * R / CELL)
    gi = ((V + R) / CELL).astype(int).clip(0, n - 1)
    gj = ((U + R) / CELL).astype(int).clip(0, n - 1)
    surf = np.full((n, n), -1e9)
    use = ~np.isin(C, (2, 7, 9, 17, 18))
    np.maximum.at(surf, (gi[use], gj[use]), Z[use])
    gnd = np.full((n, n), 1e9)
    g = C == 2
    np.minimum.at(gnd, (gi[g], gj[g]), Z[g])
    z0 = float(np.median(gnd[gnd < 1e8]))
    surf[surf < -1e8] = z0
    h = ndimage.median_filter(surf - z0, size=5)               # (vents, equipment and birds out)
    mask = h > MINH
    mask = ndimage.binary_closing(mask, iterations=2)
    lab, nl = ndimage.label(mask)
    # the block that is the building: the one holding the cell nearest the landmark's position (within `sea` m of it) with the most cells
    c0 = n // 2
    best, bn = None, 0
    for l in range(1, nl + 1):
        ys, xs = np.nonzero(lab == l)
        if len(ys) < 60:
            continue
        d = np.hypot(ys - c0, xs - c0).min() * CELL
        if d < cfg['sea'] and len(ys) > bn:
            best, bn = l, len(ys)
    if best is None:
        raise SystemExit('no building found at the position')
    mask = ndimage.binary_fill_holes(lab == best)
    jj, ii = np.meshgrid((np.arange(n) + 0.5) * CELL - R, (np.arange(n) + 0.5) * CELL - R)     # cell centres in the turned frame
    Ec, Nc = jj * ca - ii * sa, jj * sa + ii * ca
    mask &= shapely.contains_xy(clip, Ec.ravel(), Nc.ravel()).reshape(n, n)
    L = np.where(mask, np.maximum(1, np.round(h / STEP)), 0).astype(int)
    # small patches of a level (vents, skylights, plant rooms: under about 150 m2) take the level round them
    for _ in range(3):
        for lv in np.unique(L[L > 0]):
            lab2, n2 = ndimage.label(L == lv)
            for k in range(1, n2 + 1):
                m2 = lab2 == k
                if m2.sum() < 70:
                    ring = ndimage.binary_dilation(m2, iterations=1) & ~m2
                    nb = L[ring]
                    if len(nb):
                        vals, cnt = np.unique(nb, return_counts=True)
                        L[m2] = vals[cnt.argmax()]
    print(f'  ground {z0:.1f} m, building {mask.sum()} cells ({mask.sum() * CELL * CELL:.0f} m2), top {L.max() * STEP:.0f} m', flush=True)
    ys, xs = np.nonzero(mask)
    um, vm = ((xs.min() + xs.max() + 1) / 2) * CELL - R, ((ys.min() + ys.max() + 1) / 2) * CELL - R
    cxm, cym = um * ca - vm * sa, um * sa + vm * ca
    verts, idx, key = [], [], {}
    rgb = cfg['rgb']
    def vid(u, v, z):
        e, nn = u * ca - v * sa, u * sa + v * ca
        q = (round((e - cxm) * 10), round((nn - cym) * 10), round(z * 10))
        if q not in key:
            key[q] = len(verts); verts.append(q)
        return key[q]
    def layer(M):
        """The outline of a mask as a polygon (with holes), from smooth contours: diagonals stay diagonals, no pixel stairs."""
        cs = measure.find_contours(np.pad(M.astype(float), 1), 0.5)
        out = None
        for c in cs:
            if len(c) < 4:
                continue
            p = Polygon([((x - 1 + 0.5) * CELL - R, (y - 1 + 0.5) * CELL - R) for y, x in c]).buffer(0)
            out = p if out is None else out.symmetric_difference(p)
        return out
    levels = sorted(int(v) for v in np.unique(L[L > 0]))
    prev_h = 0.0
    prev_poly = None
    for k, lv in enumerate(levels):
        top = lv * STEP
        poly = layer(L >= lv)
        if poly is None or poly.is_empty:
            continue
        poly = poly.simplify(SIMPLIFY, preserve_topology=True)
        nxt = layer(L >= levels[k + 1]) if k + 1 < len(levels) else None
        # the roof that shows: this layer less the next one up
        exposed = poly if nxt is None or nxt.is_empty else poly.difference(nxt.simplify(SIMPLIFY, preserve_topology=True))
        for g in (exposed.geoms if exposed.geom_type in ('MultiPolygon', 'GeometryCollection') else [exposed]):
            if g.geom_type != 'Polygon' or g.area < 6:
                continue
            gd = shapely.segmentize(g, 4.0)
            pts = [c for ring in [gd.exterior, *gd.interiors] for c in ring.coords[:-1]]
            if len(pts) < 3:
                continue
            for t in triangulate(MultiPoint(pts)):
                if g.contains(t.representative_point()):
                    tri = [vid(x, y, top) for x, y in list(t.exterior.coords)[:3]]
                    if len(set(tri)) == 3:
                        idx.extend(tri)
        # the walls of this layer, from the level below up to its top
        for g in (poly.geoms if poly.geom_type == 'MultiPolygon' else [poly]):
            if g.geom_type != 'Polygon':
                continue
            for ring in [g.exterior, *g.interiors]:
                cs_ = list(ring.coords)
                for (x0, y0), (x1, y1) in zip(cs_, cs_[1:]):
                    if math.hypot(x1 - x0, y1 - y0) < 1e-6:
                        continue
                    a_, b_, c_, d_ = vid(x0, y0, prev_h), vid(x1, y1, prev_h), vid(x1, y1, top), vid(x0, y0, top)
                    idx.extend([a_, b_, c_, a_, c_, d_])
        prev_h = top
    if len(verts) > 65000:
        raise SystemExit(f'too many vertices: {len(verts)}')
    P = np.array(verts, np.int16).reshape(-1)
    I = np.array(idx, np.uint16)
    cols = np.tile(np.array(rgb, np.uint8), (len(verts), 1)).reshape(-1)
    cells = [box(xx * CELL, yy * CELL, (xx + 1) * CELL, (yy + 1) * CELL) for yy, xx in zip(ys[::7], xs[::7])]
    hull = MultiPoint([(((xx * CELL - R) * ca - (yy * CELL - R) * sa) - cxm, ((xx * CELL - R) * sa + (yy * CELL - R) * ca) - cym) for yy, xx in zip(ys, xs)]).convex_hull.simplify(2.0)
    fpr = list(hull.exterior.coords)[:-1]
    lon = lon0 + (cxm) / kx
    lat = lat0 + (cym) / ky
    return {'fp': [int(round(v * 10)) for q in fpr for v in q], 'n': name, 'lon': round(lon, 6), 'lat': round(lat, 6), 'h': round(float(L.max() * STEP), 1),
            'tris': len(idx) // 3, 'p': base64.b64encode(P.tobytes()).decode(), 'c': base64.b64encode(cols.tobytes()).decode(), 'i': base64.b64encode(I.tobytes()).decode(), 'src': 'lidar2017'}


def main():
    names = sys.argv[1:] or list(LIDAR)
    dst = os.path.join(ROOT, 'data/landmark-meshes.json')
    d = json.load(open(dst))
    by = {t['n']: t for t in d['t']}
    for name in names:
        print(name, flush=True)
        rec = build(name, LIDAR[name])
        by[name] = rec
        print(f'  -> {rec["tris"]} triangles, top {rec["h"]} m', flush=True)
    json.dump({'v': 2, 't': list(by.values())}, open(dst, 'w'), separators=(',', ':'))
    print(len(by), 'meshes ->', dst, os.path.getsize(dst) // 1024, 'KB')


if __name__ == '__main__':
    main()
