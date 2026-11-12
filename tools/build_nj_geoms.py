#!/usr/bin/env python3
"""The shapes of the natural places in data/nj-places.json (rivers as lines, lakes and parks as polygons): data/nj-geoms.json, so the game can
outline what it is showing. From Overture Maps' water and land_use layers (tools/overture_names.py wrote /tmp/nj/water.pkl for the rivers,
water_lakes.pkl and parks.pkl); simplified to about 10 to 30 m and rounded to 5 decimals.   python3 tools/build_nj_geoms.py
"""
import io, json, math, os, pickle, sys, urllib.request
import numpy as np
from PIL import Image
from shapely import wkb
from shapely.geometry import mapping, shape, LineString, MultiLineString
from shapely.strtree import STRtree
from shapely.ops import unary_union, linemerge

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_nj_places as BP
import build_nj_landmark_list as BL

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# park (our name) -> the Overture names (prefixes) that make it up
PARKS = {
    'Liberty State Park': ['liberty state park'], 'Branch Brook Park': ['branch brook park'], 'Overpeck County Park': ['overpeck'],
    'Van Saun Park': ['van saun'], 'Eagle Rock Reservation': ['eagle rock reservation'], 'South Mountain Reservation': ['south mountain reservation'],
    'Ramapo Mountain State Forest': ['ramapo mountain state forest'], 'Skylands Manor': ['new jersey botanical garden', 'skylands'],
    'Great Swamp National Wildlife Refuge': ['great swamp national wildlife refuge'], 'Morristown National Historical Park': ['morristown national historical park'],
    'Stokes State Forest': ['stokes state forest'], 'Worthington State Forest': ['worthington state forest'], 'Hacklebarney State Park': ['hacklebarney'],
    'Washington Rock': ['washington rock'], 'Island Beach State Park': ['island beach state park'], 'Cheesequake State Park': ['cheesequake'],
    'Allaire State Park': ['allaire state park'], 'Monmouth Battlefield': ['monmouth battlefield'], 'Watchung Reservation': ['watchung reservation'],
}
RIVER_KEYS = {  # our river -> the name in the water layer
    'Delaware River': 'delaware river', 'Passaic River': 'passaic river', 'Hackensack River': 'hackensack river', 'Raritan River': 'raritan river',
    'Hudson River': 'hudson river', 'Musconetcong River': 'musconetcong river', 'Rockaway River': 'rockaway river', 'Mullica River': 'mullica river',
    'Toms River': 'toms river', 'Maurice River': 'maurice river', 'Great Egg Harbor River': 'great egg harbor river', 'Wallkill River': 'wallkill river',
    'Ramapo River': 'ramapo river', 'Millstone River': 'millstone river', 'Pequannock River': 'pequannock river', 'Paulins Kill': 'paulins kill',
    'Delaware and Raritan Canal': 'delaware and raritan canal',
}
LAKES = {'Lake Hopatcong': 'lake hopatcong', 'Greenwood Lake': 'greenwood lake', 'Round Valley Reservoir': 'round valley reservoir', 'Spruce Run Reservoir': 'spruce run reservoir',
         'Monksville Reservoir': 'monksville reservoir', 'Boonton Reservoir': 'boonton reservoir', 'Lake Mohawk': 'lake mohawk', 'Budd Lake': 'budd lake',
         'Swartswood Lake': 'swartswood lake', 'Oradell Reservoir': 'oradell reservoir', 'Manasquan Reservoir': 'manasquan reservoir', 'Union Lake': 'union lake',
         'Merrill Creek Reservoir': 'merrill creek reservoir', 'Wanaque Reservoir': 'wanaque reservoir'}


def rnd(c):
    return [[round(x, 5), round(y, 5)] for x, y in c]


def pack(g, tol):
    g = g.simplify(tol)
    if g.is_empty:
        return None
    if g.geom_type == 'Polygon':
        return {'type': 'Polygon', 'coordinates': [rnd(g.exterior.coords)]}                 # (the outer edge only: that is what is outlined)
    if g.geom_type == 'MultiPolygon':
        return {'type': 'MultiPolygon', 'coordinates': [[rnd(p.exterior.coords)] for p in g.geoms if p.area > 2e-8]}
    if g.geom_type == 'LineString':
        return {'type': 'LineString', 'coordinates': rnd(g.coords)}
    if g.geom_type == 'MultiLineString':
        return {'type': 'MultiLineString', 'coordinates': [rnd(l.coords) for l in g.geoms]}
    return None


# how far along each range to look for its crest (km each side of the point): the stored radii are for framing, not for length
RIDGE_KM = {'Kittatinny Ridge': 16, 'Ramapo Mountains': 9, 'The Palisades': 8, 'Schooley’s Mountain': 5.5, 'Sourland Mountain': 9, 'Jenny Jump Mountain': 5,
            'Bearfort Mountain': 6, 'Garret Mountain': 3.5}
FLAT = {'Hudson River': 'south'}      # tidal: no slope to read, so the direction is given
NO_FLOW = {'Delaware and Raritan Canal'}   # a canal: no direction to show
Z = 11


def dem_window(lon0, lat0, R_km):
    """Elevation (m) in a square round a point, with the lon and lat of every cell: tiles at zoom 11 laid side by side."""
    n = 2 ** Z
    def tile_of(lon, lat):
        return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    dlon, dlat = R_km / 84.2, R_km / 111.0
    x0, y1 = tile_of(lon0 - dlon, lat0 - dlat)
    x1, y0 = tile_of(lon0 + dlon, lat0 + dlat)
    tx0, tx1, ty0, ty1 = int(x0), int(x1), int(y0), int(y1)
    rows = []
    for ty in range(ty0, ty1 + 1):
        row = []
        for tx in range(tx0, tx1 + 1):
            if (tx, ty) not in BP._tiles:
                raw = urllib.request.urlopen(urllib.request.Request(BP.TILE.format(z=Z, x=tx, y=ty), headers={'User-Agent': 'nj-geoms-builder/1.0'}), timeout=30).read()
                a = np.array(Image.open(io.BytesIO(raw)).convert('RGB'), dtype=float)
                BP._tiles[(tx, ty)] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
            row.append(BP._tiles[(tx, ty)])
        rows.append(np.hstack(row))
    E = np.vstack(rows)
    px = (tx0 + (np.arange(E.shape[1]) + 0.5) / 256)
    py = (ty0 + (np.arange(E.shape[0]) + 0.5) / 256)
    lons = px / n * 360 - 180
    lats = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * py / n))))
    return E, lons, lats


def crest(lon0, lat0, R_km):
    """The crest line of a range round a point: the main direction of its high ground, then the highest ground across it, every 1.2 km along it."""
    E, lons, lats = dem_window(lon0, lat0, R_km * 1.15)
    LON, LAT = np.meshgrid(lons, lats)
    X, Y = (LON - lon0) * 84200, (LAT - lat0) * 111000
    inside = np.hypot(X, Y) < R_km * 1000
    cut = np.percentile(E[inside], 72)
    m = inside & (E >= cut)
    pts = np.column_stack([X[m], Y[m]])
    c = pts.mean(axis=0)
    w, v = np.linalg.eigh(np.cov((pts - c).T))
    ax = v[:, np.argmax(w)]
    perp = np.array([-ax[1], ax[0]])
    t = (pts - c) @ ax
    lo, hi = np.percentile(t, 3), np.percentile(t, 97)
    out = []
    for tt in np.arange(lo, hi + 1, 1200):
        cx = c + ax * tt
        d = (np.column_stack([X[inside].ravel(), Y[inside].ravel()]) - cx)
        along, across = d @ ax, d @ perp
        sel = (np.abs(along) < 700) & (np.abs(across) < 1800)
        if sel.sum() < 3:
            continue
        e = E[inside].ravel()[sel]
        j = np.argmax(e)
        px_, py_ = X[inside].ravel()[sel][j], Y[inside].ravel()[sel][j]
        out.append((lon0 + px_ / 84200, lat0 + py_ / 111000))
    # smooth the line a little (the highest cell hops about)
    arr = np.array(out)
    if len(arr) >= 5:
        k = np.ones(3) / 3
        sm = arr.copy()
        sm[1:-1] = np.column_stack([np.convolve(arr[:, i], k, mode='valid') for i in range(2)])
        arr = sm
    return [[round(float(a), 5), round(float(b), 5)] for a, b in arr]


def orient_down(line, name):
    """A line, as a list of coordinates, turned so it runs downhill (the way water goes)."""
    co = list(line.coords)
    if name in FLAT:
        return co if co[0][1] > co[-1][1] else co[::-1]
    e0 = BP.elevation(co[0][0], co[0][1], 2, z=Z)
    e1 = BP.elevation(co[-1][0], co[-1][1], 2, z=Z)
    return co if e0 >= e1 else co[::-1]


def list_towns(places, out):
    """The towns each place is in, from its shape against the town boundaries: a river or range in order along it (a river downstream), a lake or park
    biggest share first. Written back into data/nj-places.json as `towns` and `counties`."""
    polys, props = BL.towns()
    tree = STRtree(polys)
    for p in places:
        if p.get('k') != 'nat':
            continue
        g = out.get(p['n'])
        towns = []
        if g and g['type'] in ('LineString', 'MultiLineString'):
            gg = shape(g)
            chains = list(gg.geoms) if gg.geom_type == 'MultiLineString' else [gg]
            main = max(chains, key=lambda c: c.length)
            buf = unary_union([c.buffer(0.004 if g.get('ridge') else 0.0007) for c in chains])
            hits = []
            for i in tree.query(buf):
                inter = polys[i].intersection(buf)
                if inter.is_empty or inter.area < 1e-8:
                    continue
                pos = main.project(inter.representative_point()) if main.distance(inter) < 0.003 else 99
                hits.append((pos, props[i]['full'], props[i]['c']))
            towns = [(n, c) for pos, n, c in sorted(hits)]
        elif g and g['type'] in ('Polygon', 'MultiPolygon'):
            gg = shape(g)
            hits = []
            for i in tree.query(gg):
                inter = polys[i].intersection(gg)
                if inter.is_empty:
                    continue
                share = inter.area / gg.area
                if share >= 0.04 or inter.area * 84200 * 111000 > 150000:
                    hits.append((-inter.area, props[i]['full'], props[i]['c']))
            towns = [(n, c) for a, n, c in sorted(hits)]
        seen, uniq = set(), []
        for n, c in towns:
            if n not in seen:
                seen.add(n); uniq.append((n, c))
        if uniq:
            p['towns'] = [n for n, c in uniq]
            p['counties'] = list(dict.fromkeys(c for n, c in uniq))
        elif p.get('at'):
            p['towns'] = [p['at']]
            p['counties'] = [p['c']] if p.get('c') else []
    json.dump(places, open(os.path.join(ROOT, 'data/nj-places.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    for p in places:
        if p.get('k') == 'nat' and p.get('kind') in ('river', 'mountain', 'lake') and len(p.get('towns', [])) > 1:
            print(f"   {p['n']:30s} {len(p['towns']):3d} towns, {len(p['counties'])} counties: {', '.join(p['towns'][:5])}{'...' if len(p['towns']) > 5 else ''}")


def main():
    out = {}
    flow = {}
    water = pickle.load(open('/tmp/nj/water.pkl', 'rb'))
    lakes = pickle.load(open('/tmp/nj/water_lakes.pkl', 'rb'))
    parks = pickle.load(open('/tmp/nj/parks.pkl', 'rb'))
    for name, key in RIVER_KEYS.items():
        gs = [wkb.loads(g) for n, sub, c, g in water if n == key]
        lines = [g for g in gs if g.geom_type in ('LineString', 'MultiLineString')]
        if not lines:
            if gs:
                out[name] = pack(unary_union(gs), 0.0003)
            continue
        merged = linemerge(unary_union(lines))
        parts = list(merged.geoms) if merged.geom_type == 'MultiLineString' else [merged]
        parts = [p.simplify(0.0003) for p in parts if p.length > 0.002]
        if not parts:
            continue
        if name in NO_FLOW:
            out[name] = pack(MultiLineString(parts), 0.0001)
            continue
        oriented = [orient_down(p, name) for p in parts]
        out[name] = {'type': 'MultiLineString', 'coordinates': [rnd(c) for c in oriented]}
        main_line = max(oriented, key=lambda c: LineString(c).length)
        flow[name] = {'s': [round(main_line[0][0], 5), round(main_line[0][1], 5)], 'm': [round(main_line[-1][0], 5), round(main_line[-1][1], 5)],
                      'km': round(sum(LineString(c).length for c in oriented) * 96)}
    for name, key in LAKES.items():
        gs = [wkb.loads(g) for n, s, c, g in lakes if n == key or n.startswith(key)]
        gs = [g for g in gs if g.geom_type in ('Polygon', 'MultiPolygon')]
        if gs:
            out[name] = pack(unary_union(gs), 0.0001)
    for name, keys in PARKS.items():
        gs = [wkb.loads(g) for n, s, c, g in parks if any(n == k or n.startswith(k) for k in keys)]
        gs = [g for g in gs if g.geom_type in ('Polygon', 'MultiPolygon')]
        if gs:
            out[name] = pack(unary_union(gs), 0.0002)
    places = json.load(open(os.path.join(ROOT, 'data/nj-places.json')))
    for p in places:
        if p['kind'] == 'mountain' and 'elev' not in p and p['n'] in RIDGE_KM:      # a range: its crest line
            c = crest(p['p'][0], p['p'][1], RIDGE_KM[p['n']])
            if len(c) >= 3:
                out[p['n']] = {'type': 'LineString', 'coordinates': c, 'ridge': True}
    out = {k: v for k, v in out.items() if v}
    out['_flow'] = flow
    json.dump(out, open(os.path.join(ROOT, 'data/nj-geoms.json'), 'w'), separators=(',', ':'))
    list_towns(places, out)
    print(len(out) - 1, 'shapes,', os.path.getsize(os.path.join(ROOT, 'data/nj-geoms.json')) // 1024, 'KB')
    missing = [n for n in list(RIVER_KEYS) + list(LAKES) + list(PARKS) + list(RIDGE_KM) if n not in out]
    print('no shape for:', missing)


if __name__ == '__main__':
    main()
