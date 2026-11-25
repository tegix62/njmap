#!/usr/bin/env python3
"""Deep Jersey map data: rock eras, the ice limit, glacial Lake Passaic and what is left of the Morris Canal, into data/deep/.

Sources (all public):
  rocks  USGS State Geologic Map Compilation, New Jersey (mrdata.usgs.gov/geology/state/shp/NJ.zip), compiled from the NJ Geological
         Survey's 1:250,000 bedrock map (DGS04-6). Units grouped into six eras by province and age.
  ice    USGS Quaternary Geologic Map of the Hudson River 4x6 quadrangle (I-1420 NK-18, pubs.usgs.gov/imap/i-1420/nk-18/), line coverage
         gla_lin: "outer limit of glacial advance". The late Wisconsinan segments (Staten Island, Perth Amboy, Morristown, Denville,
         Dover, Hackettstown, Belvidere) are picked by id; the lines further south are older advances.
  lakes  Glacial Lake Passaic at its two highest stages, drawn from today's ground height (AWS Terrain Tiles, z12) below the stage's
         spillway altitude given in USGS I-2540-C (Surficial Geologic Map of Northern New Jersey, 2002): Moggy Hollow stage 103 m,
         Great Notch stage 93 m. The lake is kept west of First Watchung Mountain (its basalt, from the rock map) and south of the ice
         (approximate). So the outline is approximate: today's valley floor sits on the lake's own sediment.
  sand   The Cohansey and Kirkwood formations (the Pine Barrens' sand and the aquifer's two layers), from the same USGS compilation.
  canal  OpenStreetMap ways named "Morris Canal" (waterway canal / derelict / defunct): the stretches that survive. (c) OpenStreetMap
         contributors, ODbL.

  python3 tools/build_deep.py            (source files in $DEEP_SRC, default the session scratchpad; downloads cached there)
"""
import json, math, os, sys, csv, io, urllib.request, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('DEEP_SRC', '/tmp/deep-src')
OUT = os.path.join(ROOT, 'data/deep')
os.makedirs(OUT, exist_ok=True)

import shapefile
from shapely.geometry import shape, mapping, box, Polygon, MultiPolygon, LineString, MultiLineString
from shapely.ops import unary_union, linemerge
from shapely import set_precision

BOX = box(-75.6, 40.3, -73.85, 41.40)          # northern New Jersey and the edges of New York and Pennsylvania


def rnd(geom, nd=4):
    return set_precision(geom, 10 ** -nd)


def dump(name, feats):
    fc = {'type': 'FeatureCollection', 'features': feats}
    p = os.path.join(OUT, name)
    json.dump(fc, open(p, 'w'), separators=(',', ':'))
    print(f'{name}: {len(feats)} features, {os.path.getsize(p) // 1024} KB')


# ---- rocks ------------------------------------------------------------------------------------------------------------------
ERAS = [   # key, name, age words
    ('grenville', 'Highlands gneiss and granite', 'more than a billion years old'),
    ('paleozoic', 'Valley and Ridge sandstone, shale and limestone', 'about 540 to 380 million years old'),
    ('newark', 'Newark Basin red sandstone and shale', 'about 230 to 200 million years old'),
    ('basalt', 'Watchung lava flows (basalt)', 'about 200 million years old'),
    ('diabase', 'Palisades and other diabase (cooled underground)', 'about 200 million years old'),
    ('coastal', 'Coastal Plain sand and clay', 'less than 100 million years old'),
]
FLOW = {'Orange Mountain Basalt': 1, 'Preakness Basalt': 2, 'Hook Mt. Basalt': 3}


def era_of(u):
    prov, name, age = u['province'], u['unit_name'], u['unit_age']
    if name in FLOW: return 'basalt'
    if name == 'Diabase' and 'Jurassic' in age: return 'diabase'
    if 'Coastal Plain' in prov: return 'coastal'
    if 'Newark Basin' in prov: return 'newark'
    if 'Proterozoic' in age: return 'grenville'
    if any(k in prov for k in ('Valley and Ridge', 'Kittatinny', 'Green Pond', 'Jutland')): return 'paleozoic'
    return None


def rocks():
    d = os.path.join(SRC, 'geo/NJ')
    U = {r['unit_link']: r for r in csv.DictReader(open(os.path.join(d, 'NJ_units.csv'), encoding='latin-1'))}
    r = shapefile.Reader(os.path.join(d, 'NJ_geol_poly.shp'))
    parts = collections.defaultdict(list); flows = collections.defaultdict(list)
    for sr in r.iterShapeRecords():
        u = U.get(sr.record['UNIT_LINK'])
        if not u: continue
        e = era_of(u)
        if not e: continue
        g = shape(sr.shape.__geo_interface__).buffer(0)
        parts[e].append(g)
        if u['unit_name'] in FLOW: flows[FLOW[u['unit_name']]].append(g)
    feats = []
    for k, name, age in ERAS:
        g = unary_union(parts[k]).intersection(BOX).simplify(0.0015, preserve_topology=True)
        g = g.buffer(0.0004).buffer(-0.0004)          # close slivers between units
        feats.append({'type': 'Feature', 'properties': {'era': k, 'name': name, 'age': age}, 'geometry': mapping(rnd(g))})
    dump('rocks.json', feats)
    ff = []
    for n, nm in ((1, 'First Watchung (Orange Mountain Basalt)'), (2, 'Second Watchung (Preakness Basalt)'), (3, 'Third Watchung (Hook Mountain Basalt)')):
        g = unary_union(flows[n]).simplify(0.0008, preserve_topology=True)
        ff.append({'type': 'Feature', 'properties': {'flow': n, 'name': nm}, 'geometry': mapping(rnd(g))})
    dump('flows.json', ff)
    return unary_union(flows[1])


def sand():
    """The Pine Barrens' sand: the Cohansey Formation (Middle Miocene) over the Kirkwood Formation, from the same USGS compilation."""
    d = os.path.join(SRC, 'geo/NJ')
    U = {r['unit_link']: r for r in csv.DictReader(open(os.path.join(d, 'NJ_units.csv'), encoding='latin-1'))}
    r = shapefile.Reader(os.path.join(d, 'NJ_geol_poly.shp'))
    parts = collections.defaultdict(list)
    for sr in r.iterShapeRecords():
        u = U.get(sr.record['UNIT_LINK'])
        if not u: continue
        k = 'cohansey' if u['unit_name'] == 'Cohansey Formation' else 'kirkwood' if 'Kirkwood' in u['unit_name'] else None
        if k: parts[k].append(shape(sr.shape.__geo_interface__).buffer(0))
    feats = []
    for k, name, age in (('kirkwood', 'Kirkwood Formation: sand, silt and clay', 'early to middle Miocene'), ('cohansey', 'Cohansey Formation: the Pine Barrens sand', 'middle Miocene')):
        g = unary_union(parts[k]).buffer(0.0008).buffer(-0.0008).simplify(0.0035, preserve_topology=True)
        g = MultiPolygon([p for p in getattr(g, 'geoms', [g]) if p.area > 3e-5])          # drop the specks
        feats.append({'type': 'Feature', 'properties': {'unit': k, 'name': name, 'age': age}, 'geometry': mapping(rnd(g))})
    dump('sand.json', feats)


# ---- ice --------------------------------------------------------------------------------------------------------------------
WISCONSIN = [101, 77, 100, 99, 76, 93, 92]     # gla_lin ids of the late Wisconsinan limit, east to west (checked on a plot; 67 is an inner line west of Morristown)


def ice():
    import geopandas as gpd
    g = gpd.read_file(os.path.join(SRC, 'geo/nk18/gla_lin.e00')).to_crs(4326)
    lim = g[g.TYPE == 'OUTER LIMIT OF GLACIAL ADVANCE']
    segs = [lim.loc[i].geometry for i in WISCONSIN]
    # chain the segments end to end, east to west: start from the easternmost end, then each time take the nearest free segment end
    left = [list(x.coords) for x in segs]
    start = max(left, key=lambda cs: max(cs[0][0], cs[-1][0])); left.remove(start)
    pts = start if start[0][0] > start[-1][0] else start[::-1]
    while left:
        end = pts[-1]
        d = lambda c: (c[0] - end[0]) ** 2 + (c[1] - end[1]) ** 2
        nxt = min(left, key=lambda cs: min(d(cs[0]), d(cs[-1]))); left.remove(nxt)
        pts += nxt if d(nxt[0]) <= d(nxt[-1]) else nxt[::-1]
    line = LineString(pts).simplify(0.002)
    older = [rnd(x.simplify(0.002)) for i, x in lim.geometry.items() if i not in WISCONSIN and x.intersects(BOX)]
    # the ice sheet: north of the limit, inside a wide frame
    W, E, N = -75.9, -73.4, 42.6
    c = list(line.coords)
    ring = [(E, c[0][1])] + c + [(W, c[-1][1]), (W, N), (E, N)]
    sheet = Polygon(ring).buffer(0)
    feats = [
        {'type': 'Feature', 'properties': {'kind': 'limit', 'name': 'Edge of the last ice sheet (terminal moraine)', 'age': 'about 25,000 to 20,000 years ago'}, 'geometry': mapping(rnd(line))},
        {'type': 'Feature', 'properties': {'kind': 'sheet'}, 'geometry': mapping(rnd(sheet, 3))},
    ] + [{'type': 'Feature', 'properties': {'kind': 'older', 'name': 'Edge of an older ice advance'}, 'geometry': mapping(o)} for o in older]
    dump('ice.json', feats)
    return line


# ---- lakes (from ground height) -------------------------------------------------------------------------------------------
Z = 12


def tile_xy(lon, lat, z=Z):
    n = 2 ** z; x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def lonlat(x, y, z=Z):
    n = 2 ** z; lon = x / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon, lat


def dem(w, s, e, n):
    from PIL import Image
    import numpy as np
    x0, y0 = map(int, tile_xy(w, n)); x1, y1 = map(int, tile_xy(e, s))
    cache = os.path.join(SRC, 'dem'); os.makedirs(cache, exist_ok=True)
    H = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), dtype='float32')
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            p = os.path.join(cache, f'{Z}-{tx}-{ty}.png')
            if not os.path.exists(p):
                urllib.request.urlretrieve(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png', p)
            a = np.asarray(Image.open(p).convert('RGB')).astype('float32')
            H[(ty - y0) * 256:(ty - y0 + 1) * 256, (tx - x0) * 256:(tx - x0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    return H, x0, y0


def lakes(first_watchung, ice_line):
    import numpy as np
    from scipy import ndimage
    from shapely import contains_xy
    w, s, e, n = -74.80, 40.55, -74.10, 41.06
    H, x0, y0 = dem(w, s, e, n)
    rows, cols = H.shape
    # pixel centre coordinates
    xs = x0 + (np.arange(cols) + 0.5) / 256
    ys = y0 + (np.arange(rows) + 0.5) / 256
    LON = xs / 2 ** Z * 360 - 180
    LAT = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * ys / 2 ** Z))))
    LONg, LATg = np.meshgrid(LON, LAT)
    # walls: First Watchung's basalt (higher than either lake level except at its gaps); the ice sheet over the gaps at Paterson and
    # Great Notch in the north-east (the lake stood against it); beyond the north edge of each stage, ice (approximate)
    H = np.where(H < -100, np.nan, H)                    # a few bad pixels in the tiles
    wall = contains_xy(first_watchung.buffer(0.0015), LONg, LATg)
    ne_ice = (LATg > 40.86) & (LONg > -74.235)
    seed = (40.705, -74.47)                               # the Great Swamp
    si = int(np.argmin(abs(LAT - seed[0]))); sj = int(np.argmin(abs(LON - seed[1])))
    feats = []
    for key, level, name, north, note in (
        ('moggy', 103, 'Glacial Lake Passaic, Moggy Hollow stage', 41.01, 'deepest and largest: about 300 ft deep, spilling south-west over Moggy Hollow near Pluckemin'),
        ('notch', 93, 'Glacial Lake Passaic, Great Notch stage', 41.01, '34 ft lower, spilling east over Great Notch on First Watchung Mountain'),
    ):
        wet = (H < level) & ~wall & ~ne_ice & (LATg < north) & (LATg > 40.60)
        lab, _ = ndimage.label(wet)
        comp = lab == lab[si, sj]
        comp = ndimage.binary_opening(comp, iterations=1)
        # polygonize the mask: rows of runs -> boxes -> union
        boxes = []
        for i in range(rows):
            r = comp[i]
            if not r.any(): continue
            d = np.diff(np.concatenate([[0], r.view('int8'), [0]]))
            st, en = np.where(d == 1)[0], np.where(d == -1)[0]
            ytop = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y0 + i / 256) / 2 ** Z))))
            ybot = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y0 + (i + 1) / 256) / 2 ** Z))))
            dx = (LON[1] - LON[0]) / 2
            for a, b in zip(st, en): boxes.append(box(LON[a] - dx, ybot, LON[b - 1] + dx, ytop))
        g = unary_union(boxes).simplify(0.0012, preserve_topology=True)
        g = MultiPolygon([p for p in (g.geoms if hasattr(g, 'geoms') else [g]) if p.area > 2e-5])
        km2 = g.area * (111.0 * 111.0 * math.cos(math.radians(40.8)))
        print(f'{key}: level {level} m, about {km2:.0f} km2')
        feats.append({'type': 'Feature', 'properties': {'stage': key, 'level_m': level, 'name': name, 'note': note, 'km2': round(km2)}, 'geometry': mapping(rnd(g))})
    dump('lakes.json', feats)


# ---- canal ------------------------------------------------------------------------------------------------------------------
def canal():
    cache = os.path.join(SRC, 'osm-canal.json')
    if not os.path.exists(cache):
        q = '[out:json][timeout:120];way["name"="Morris Canal"]["waterway"](40.55,-75.25,41.0,-74.0);out geom;'
        req = urllib.request.Request('https://overpass.kumi.systems/api/interpreter', data=('data=' + urllib.parse.quote(q)).encode())
        open(cache, 'wb').write(urllib.request.urlopen(req, timeout=180).read())
    d = json.load(open(cache))
    lines = [LineString([(p['lon'], p['lat']) for p in e['geometry']]) for e in d['elements'] if e.get('geometry')]
    g = linemerge(MultiLineString(lines)).simplify(0.0002)
    dump('canal.json', [{'type': 'Feature', 'properties': {'name': 'Morris Canal (surviving stretches)', 'source': 'OpenStreetMap'}, 'geometry': mapping(rnd(g, 5))}])


if __name__ == '__main__':
    import urllib.parse
    what = sys.argv[1:] or ['rocks', 'ice', 'lakes', 'canal', 'sand']
    fw = il = None
    if 'rocks' in what or 'lakes' in what: fw = rocks()
    if 'ice' in what or 'lakes' in what: il = ice()
    if 'lakes' in what: lakes(fw, il)
    if 'canal' in what: canal()
    if 'sand' in what: sand()
