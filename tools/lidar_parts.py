#!/usr/bin/env python3
"""Real roof shapes for the New Jersey landmarks from aerial lidar: data/nj-landmark-lidar.json, which tools/landmark_shapes.py uses in place of
its drawn recipe for every landmark listed there.

Sources (all USGS 3DEP, public domain):
  - Entwine point tiles on the public usgs-lidar-public bucket, read over HTTP a few octree nodes at a time (tools/ept_read.py):
    NJ_NW6Co_2017 (the north-west six counties), ARRA-NJ_3Counties_2010 (Atlantic, Cape May, Ocean), NJ_SouthernNJ_2018;
  - LAZ tiles of "NJ_New_Jersey_SANDY_LiDAR_15" (flown 2014) from rockyweb.usgs.gov, downloaded ahead into a folder (/tmp/lidar/tiles by
    default: the server allows one connection at a time, at about 40 KB/s, so they are fetched in the background first).

Method, for each landmark: the points within its footprint (from data/nj-landmarks.json's building, buffered 4 m) give the surface (the highest
return in each cell, 1 m cells, 1.5 m when the scan is sparse), its height over the ground (the median of the ground-classified points round it);
empty cells are filled from their neighbours inside the footprint. The surface is then cut into levels (every 1.5 m for a low building, up to
every 1/45 of the height for a tall one): each level is the outline of the cells at least that high, and is drawn as a part from the level
below to it. Two levels with nearly the same outline are merged. That is what the 3D map can draw (flat-topped prisms), so a dome comes out
as rings and a spire as a stack of shrinking blocks, but the shapes and heights are measured, not drawn.

  python3 tools/lidar_parts.py [names...]         (default: every landmark it has a source for)
"""
import glob, json, math, os, sys
import numpy as np
import laspy
from pyproj import Transformer
from scipy import ndimage
from skimage import measure
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ept_read

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.environ.get('LIDAR_TILES', '/tmp/lidar/tiles')
OUT = os.path.join(ROOT, 'data/nj-landmark-lidar.json')
# name -> EPT set on usgs-lidar-public; everything else is looked for in the downloaded LAZ tiles
EPT = {
    'Lambert Castle': 'NJ_NW6Co_2017',
    'Boardwalk Hall': 'ARRA-NJ_3Counties_2010', 'Absecon Lighthouse': 'ARRA-NJ_3Counties_2010', 'Great Auditorium': 'ARRA-NJ_3Counties_2010',
    'Barnegat Lighthouse': 'ARRA-NJ_3Counties_2010', 'Cape May Lighthouse': 'NJ_CapeMayCo_2008', 'High Point Monument': 'NJ_NW6Co_2017',
}
NOISE = {7, 18}


def footprint(name):
    """The landmark's own building outline (lon, lat) from data/nj-landmark-city.json: the flagged building nearest its point."""
    d = json.load(open(os.path.join(ROOT, 'data/nj-landmark-city.json')))
    lm = {l['n']: l for l in json.load(open(os.path.join(ROOT, 'data/nj-landmarks.json')))}[name]
    O, S = d['o'], d['s']
    best, bd = None, 1e9
    for b in d['b']:
        if not b[1]:
            continue
        x = y = 0
        ring = []
        for i in range(2, len(b), 2):
            x += b[i]; y += b[i + 1]
            ring.append((O[0] + x / S, O[1] + y / S))
        c = Polygon(ring).centroid
        dd = math.hypot((c.x - lm['p'][0]) * 84000, (c.y - lm['p'][1]) * 111000)
        if dd < bd:
            bd, best = dd, ring
    return lm, best


def laz_points(lon, lat, R):
    """Points within R m of the point from the downloaded LAZ tiles that hold any (each tile's header gives its bounds)."""
    out = []
    for f in sorted(glob.glob(os.path.join(TILES, '*.laz'))):
        with laspy.open(f) as fh:
            h = fh.header
            crs = h.parse_crs()
            if crs is None:
                continue
            tr = Transformer.from_crs(4326, crs.to_epsg() or crs, always_xy=True)
            x0, y0 = tr.transform(lon, lat)
            unit = 0.3048 if 'foot' in (crs.axis_info[0].unit_name or '').lower() else 1.0
            r = R / unit
            if x0 + r < h.mins[0] or x0 - r > h.maxs[0] or y0 + r < h.mins[1] or y0 - r > h.maxs[1]:
                continue
            for pts in fh.chunk_iterator(2_000_000):
                X, Y = np.asarray(pts.x), np.asarray(pts.y)
                m = (np.abs(X - x0) <= r) & (np.abs(Y - y0) <= r)
                if m.any():
                    zu = 0.3048 if unit != 1.0 else 1.0
                    out.append(((X[m] - x0) * unit, (Y[m] - y0) * unit, np.asarray(pts.z)[m] * zu, np.asarray(pts.classification)[m]))
    if not out:
        return None
    return tuple(np.concatenate([o[i] for o in out]) for i in range(4))


def ept_points(ds, lon, lat, R):
    X, Y, Z, C, n = ept_read.points(ds, lon, lat, R, base='https://s3-us-west-2.amazonaws.com/usgs-lidar-public/')
    meta = json.loads(ept_read.get(ept_read.BASE + ds + '/ept.json'))
    tr = Transformer.from_crs(int(meta['srs']['horizontal']), 4326, always_xy=True)
    lo, la = tr.transform(X, Y)
    kx, ky = 111320 * math.cos(math.radians(lat)), 110574
    return (np.asarray(lo) - lon) * kx, (np.asarray(la) - lat) * ky, Z, C


def build(name):
    lm, ring = footprint(name)
    lon, lat = lm['p']
    kx, ky = 111320 * math.cos(math.radians(lat)), 110574
    F = Polygon([((x - lon) * kx, (y - lat) * ky) for x, y in ring]).buffer(0)
    R = max(abs(v) for v in F.bounds) + 30
    pts = ept_points(EPT[name], lon, lat, R) if name in EPT else laz_points(lon, lat, R)
    if pts is None or len(pts[0]) < 200:
        print(f'  {name}: no points'); return None
    X, Y, Z, C = pts
    keep = ~np.isin(C, list(NOISE))
    X, Y, Z, C = X[keep], Y[keep], Z[keep], C[keep]
    ground = Z[C == 2]
    g0 = float(np.median(ground)) if len(ground) > 30 else float(np.percentile(Z, 5))
    zone = F.buffer(4)
    x0, y0, x1, y1 = zone.bounds
    dens = len(X) / ((2 * R) ** 2)
    cell = 1.0 if dens >= 6 else 1.5
    nx, ny = int((x1 - x0) / cell) + 1, int((y1 - y0) / cell) + 1
    ix, iy = ((X - x0) / cell).astype(int), ((Y - y0) / cell).astype(int)
    ok = (ix >= 0) & (ix < nx) & (iy >= 0) & (iy < ny) & (C != 2)
    H = np.full((ny, nx), -np.inf)
    np.maximum.at(H, (iy[ok], ix[ok]), Z[ok] - g0)
    # the footprint as a cell mask
    import shapely
    gx, gy = np.meshgrid(x0 + (np.arange(nx) + 0.5) * cell, y0 + (np.arange(ny) + 0.5) * cell)
    inside = shapely.contains_xy(zone, gx.ravel(), gy.ravel()).reshape(ny, nx)
    H[~inside] = -np.inf
    # fill empty cells inside from the nearest filled one (a sparse scan leaves gaps)
    empty = ~np.isfinite(H) & inside
    if (~empty & inside).sum() < 10:
        print(f'  {name}: too few roof points'); return None
    idx = ndimage.distance_transform_edt(empty | ~inside, return_distances=False, return_indices=True)
    Hf = H[idx[0], idx[1]]
    Hf[~inside] = 0
    Hf = np.where(np.isfinite(Hf), Hf, 0)
    Hf = ndimage.median_filter(Hf, size=3) if cell == 1.0 else Hf          # (single wild returns: a bird, a crane)
    top = float(np.percentile(Hf[inside], 99.7))
    if top < 3:
        print(f'  {name}: nothing standing ({top:.1f} m)'); return None
    # --- from a measured surface to a clean building: tiers, squared outlines, round towers ---------------------------------------------
    # 1. the roof heights fall into a few tiers (a main roof, a lower wing, a tower, a spire): one-dimensional k-means on the cell heights,
    #    tiers closer than max(2 m, 7% of the top) merged
    hs = Hf[inside & (Hf >= 2)]
    if len(hs) < 10:
        print(f'  {name}: too little roof'); return None
    centers = np.percentile(hs, np.linspace(10, 99, 6))
    for _ in range(30):
        lab = np.argmin(np.abs(hs[:, None] - centers[None, :]), axis=1)
        centers = np.array([hs[lab == k].mean() if (lab == k).any() else centers[k] for k in range(len(centers))])
    centers = np.sort(centers)
    merged = [centers[0]]
    for c in centers[1:]:
        if c - merged[-1] < max(2.0, 0.07 * top): merged[-1] = (merged[-1] + c) / 2
        else: merged.append(c)
    tiers = []                                                   # (threshold to belong, height the tier is drawn to)
    for i, c in enumerate(merged):
        lo_ = (merged[i - 1] + c) / 2 if i else 2.0
        hi_ = (c + merged[i + 1]) / 2 if i + 1 < len(merged) else top + 1
        sel = hs[(hs >= lo_) & (hs < hi_)]
        if len(sel) < 3: continue
        tiers.append((lo_, float(np.percentile(sel, 80)) if i + 1 < len(merged) else top))
    # 2. a grid turned to the building's own long side, so outlines come out square to it
    rr = F.minimum_rotated_rectangle
    cs = list(rr.exterior.coords)[:4]
    e = max([np.subtract(cs[1], cs[0]), np.subtract(cs[2], cs[1])], key=np.linalg.norm)
    ang = math.atan2(e[1], e[0])
    ca, sa = math.cos(ang), math.sin(ang)
    c0 = np.array(F.centroid.coords[0])
    span = max(x1 - x0, y1 - y0) * 0.8
    g = 1.0
    us = np.arange(-span, span, g) + g / 2
    U, V = np.meshgrid(us, us)
    Xr, Yr = c0[0] + U * ca - V * sa, c0[1] + U * sa + V * ca            # rotated grid points in the local frame
    ci, cj = ((Xr - x0) / cell).astype(int), ((Yr - y0) / cell).astype(int)
    okr = (ci >= 0) & (ci < nx) & (cj >= 0) & (cj < ny)
    Hr = np.zeros_like(U)
    Hr[okr] = Hf[cj[okr], ci[okr]]
    inr = np.zeros_like(U, dtype=bool)
    inr[okr] = inside[cj[okr], ci[okr]]
    Hr[~inr] = 0
    import shapely
    from shapely.geometry import box as sbox
    def cells_to_poly(mask):
        rects = []
        for r in range(mask.shape[0]):
            row = mask[r]; c = 0
            while c < len(row):
                if row[c]:
                    c2 = c
                    while c2 + 1 < len(row) and row[c2 + 1]: c2 += 1
                    rects.append(sbox(us[c] - g / 2, us[r] - g / 2, us[c2] + g / 2, us[r] + g / 2)); c = c2 + 1
                else: c += 1
        if not rects: return None
        u = unary_union(rects)
        u = u.buffer(1.2, join_style=2).buffer(-2.4, join_style=2).buffer(1.2, join_style=2)   # off the 1 m stair-steps and slivers, corners kept square
        return None if u.is_empty else u.simplify(0.6)
    def to_local(poly):                                          # rotated (u, v) back to the east/north frame
        return shapely.affinity.affine_transform(poly, [ca, -sa, sa, ca, c0[0], c0[1]])
    foot = F.buffer(1.0, join_style=2)
    parts, base = [], 0.0
    for lo_, h_ in tiers:
        m = ndimage.binary_opening(Hr >= lo_, iterations=1)
        m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=2))
        lab_, n_ = ndimage.label(m)
        for k in range(1, n_ + 1):
            if (lab_ == k).sum() < 6: m[lab_ == k] = False       # specks
        poly = cells_to_poly(m)
        if poly is None: continue
        poly = to_local(poly).intersection(foot)
        pieces = []
        for gg in (poly.geoms if hasattr(poly, 'geoms') else [poly]):
            if gg.geom_type != 'Polygon' or gg.area < 4: continue
            circ = 4 * math.pi * gg.area / gg.length ** 2
            if circ > 0.8 and gg.area < 900:                         # a round tower, a lantern, a dome: a circle of the same area
                cx_, cy_ = gg.centroid.coords[0]; r_ = math.sqrt(gg.area / math.pi)
                gg = Polygon([(cx_ + r_ * math.cos(2 * math.pi * t / 20), cy_ + r_ * math.sin(2 * math.pi * t / 20)) for t in range(20)])
            elif gg.area / gg.minimum_rotated_rectangle.area > 0.88:  # nearly a rectangle: a rectangle
                gg = gg.minimum_rotated_rectangle
            pieces.append(gg)
        if not pieces: continue
        parts.append([unary_union(pieces), base, h_])
        base = h_
    # a lighthouse: the scan is too sparse to see roundness on a 6 m tower, so it is drawn round, its radius measured at the foot and near the top
    # of the shaft and tapered between, with the gallery and lantern the scan shows as the top few metres
    if (lm.get('kind') or '').lower() == 'lighthouse':
        high = Hr >= 0.6 * top
        if high.sum() >= 3:
            cu, cv = U[high].mean(), V[high].mean()
            rad_at = lambda h: math.sqrt(max((Hr >= h).sum() * g * g, 4) / math.pi)
            r0, r1 = min(rad_at(0.25 * top), 7.0), min(rad_at(0.85 * top), rad_at(0.25 * top))
            shaft = top * 0.86
            circle = lambda r: to_local(Polygon([(cu + r * math.cos(2 * math.pi * t / 20), cv + r * math.sin(2 * math.pi * t / 20)) for t in range(20)]))
            parts = [[circle(r0 * 1.35), 0, 2.0]] + [[circle(r0 + (r1 - r0) * k / 12), max(2.0, shaft * k / 12), shaft * (k + 1) / 12] for k in range(12)]
            parts += [[circle(r1 * 1.25), shaft, shaft + 1.0], [circle(r1 * 0.75), shaft + 1.0, top - 1.5], [circle(r1 * 0.45), top - 1.5, top]]
    out = []
    for poly, b, t in parts:
        for g in (poly.geoms if hasattr(poly, 'geoms') else [poly]):
            if g.geom_type == 'Polygon' and g.area >= 2:
                out.append({'b': round(b, 1), 't': round(t, 1), 'ring': [[round(lon + x / kx, 6), round(lat + y / ky, 6)] for x, y in list(g.exterior.coords)[:-1]]})
    print(f'  {name}: {len(X)} points ({dens:.1f}/m²), ground {g0:.1f} m, top {top:.1f} m over it, {cell} m cells, {len(out)} parts')
    return {'parts': out, 'top': round(top, 1), 'src': EPT.get(name, 'NJ_New_Jersey_SANDY_LiDAR_15 (2014)'), 'density': round(dens, 1)}


def main():
    want = sys.argv[1:]
    lms = [l['n'] for l in json.load(open(os.path.join(ROOT, 'data/nj-landmarks.json')))]
    names = want or lms
    have = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for n in names:
        if n not in lms:
            print('  unknown', n); continue
        try:
            r = build(n)
        except Exception as e:
            print(f'  {n}: failed ({e})'); r = None
        if r:
            have[n] = r
            json.dump(have, open(OUT, 'w'), separators=(',', ':'))
    print(len(have), 'landmarks with lidar shapes in', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
