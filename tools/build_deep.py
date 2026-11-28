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
  provinces  The regions round New Jersey in full past the state line: USGS Physiographic Divisions (Fenneman and Johnson, 1946).
  icelines   All the ice-limit lines on the NK-18 sheet, across New York, Pennsylvania and Long Island.
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


REGION_BOX = box(-81.0, 36.5, -69.5, 43.6)       # wide enough to see each belt run past New Jersey
PROVINCES = [   # key, Fenneman (province, section) pairs, extra clip, name
    ('highlands', [('NEW ENGLAND', 'NEW ENGLAND UPLAND')], box(-76.5, 40.0, -73.2, 41.95), 'The Highlands (Reading Prong)'),
    ('valleyridge', [('VALLEY AND RIDGE', 'MIDDLE'), ('VALLEY AND RIDGE', 'HUDSON VALLEY')], None, 'Valley and Ridge'),
    ('piedmont', [('PIEDMONT', 'PIEDMONT LOWLANDS')], None, 'Piedmont Lowlands: the rift basins'),
    ('upland', [('PIEDMONT', 'PIEDMONT UPLAND')], None, 'Piedmont Upland'),
    ('coastal', [('COASTAL PLAIN', 'EMBAYED')], None, 'Coastal Plain'),
    ('plateau', [('APPALACHIAN PLATEAUS', 'SOUTHERN NEW YORK'), ('APPALACHIAN PLATEAUS', 'CATSKILL'), ('APPALACHIAN PLATEAUS', 'ALLEGHENY MOUNTAIN')], None, 'Appalachian Plateaus (Poconos, Catskills)'),
]


def provinces():
    """The physiographic regions round New Jersey, each drawn in full past the state line: USGS Physiographic Divisions of the
    Conterminous U.S. (Fenneman and Johnson, 1946; water.usgs.gov/GIS/dsdl/physio_shp.zip)."""
    import geopandas as gpd
    g = gpd.read_file(os.path.join(SRC, 'geo/physio/physio.shp')).to_crs(4326)
    feats = []
    for key, pairs, clip, name in PROVINCES:
        sel = g[[(p, s) in pairs for p, s in zip(g.PROVINCE, g.SECTION)]]
        geom = unary_union(list(sel.geometry)).intersection(REGION_BOX)
        if clip is not None: geom = geom.intersection(clip)
        geom = geom.simplify(0.008, preserve_topology=True)
        geom = MultiPolygon([p for p in getattr(geom, 'geoms', [geom]) if p.geom_type == 'Polygon' and p.area > 2e-4])
        # where to put its name: inside the part nearest New Jersey; and the box to fit when it is shown whole
        near = geom.intersection(box(-75.9, 39.2, -73.4, 41.6))
        lp = (near if not near.is_empty and near.area > 0.01 else geom).representative_point()
        feats.append({'type': 'Feature', 'properties': {'region': key, 'name': name, 'lp': [round(lp.x, 3), round(lp.y, 3)], 'bbox': [round(v, 2) for v in geom.bounds]}, 'geometry': mapping(rnd(geom, 3))})
    dump('provinces.json', feats)


def ice_anim():
    """Frames for the ice age played on the map: the New Jersey ice sheet (ice.json) cut off north of a line that sweeps south, from
    the state's top edge to the moraine. A simplification (the real ice edge was lobed, not straight); the app says so."""
    d = json.load(open(os.path.join(OUT, 'ice.json')))
    sheet = shape([f for f in d['features'] if f['properties']['kind'] == 'sheet'][0]['geometry'])
    top, low, n = 41.40, 40.45, 14
    feats = []
    for k in range(n + 1):
        lat = top - (top - low) * k / n
        g = sheet.intersection(box(-76, lat, -73, 42))
        if g.is_empty: continue
        feats.append({'type': 'Feature', 'properties': {'f': k, 'lat': round(lat, 3)}, 'geometry': mapping(rnd(g.simplify(0.002), 3))})
    dump('iceanim.json', feats)


def ice_region():
    """Every 'outer limit of glacial advance' line on the USGS NK-18 sheet (40-44 N, 72-78 W): the ice edges across New York,
    Pennsylvania and Long Island too, this and older advances."""
    import geopandas as gpd
    g = gpd.read_file(os.path.join(SRC, 'geo/nk18/gla_lin.e00')).to_crs(4326)
    lim = g[g.TYPE == 'OUTER LIMIT OF GLACIAL ADVANCE']
    lines = [rnd(x.simplify(0.004), 3) for x in lim.geometry]
    dump('icelines.json', [{'type': 'Feature', 'properties': {'last': i in WISCONSIN}, 'geometry': mapping(l)} for i, l in zip(lim.index, lines)])


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
    # only over New Jersey (outline from the state geology map): outside it these lines alone do not say where the ice stood
    r = shapefile.Reader(os.path.join(SRC, 'geo/NJ/NJ_geol_poly.shp'))
    nj = unary_union([shape(x.__geo_interface__).buffer(0.002) for x in r.shapes()]).buffer(-0.002).simplify(0.003)
    sheet = sheet.intersection(nj)
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



# ---- the lake drains: three flow lines, hand-placed (schematic, not surveyed channels) -----------------------------------------
DRAIN = {
    # Moggy Hollow, Far Hills (Wikipedia: Moggy Hollow Natural Area, 40.67351 N 74.61406 W): the lake's outlet at its western edge,
    # draining to the Raritan River (same article; USGS I-2540-C gives the spillway 103 m).
    'moggy': [(-74.585, 40.676), (-74.614, 40.6735), (-74.624, 40.648), (-74.638, 40.615), (-74.655, 40.585)],
    # Great Notch, in First Watchung Mountain at Clifton: its drainage carved the spillway that became the valley of the Third
    # River (Wikipedia: Lake Passaic, Great Notch Stage), which runs south through Clifton, Nutley and Bloomfield.
    'notch': [(-74.245, 40.876), (-74.212, 40.889), (-74.196, 40.862), (-74.188, 40.832), (-74.183, 40.801)],
    # The Passaic today: from the old lake floor north between the ridges, past Two Bridges, east through the Little Falls gap and
    # over the Great Falls at Paterson (Wikipedia: Lake Passaic, Postglacial stages; Great Falls (Passaic River)).
    'passaic': [(-74.46, 40.715), (-74.42, 40.735), (-74.37, 40.79), (-74.33, 40.85), (-74.27, 40.893), (-74.235, 40.884),
                (-74.217, 40.876), (-74.198, 40.902), (-74.181, 40.9157)],
}


def drain():
    feats = [{'type': 'Feature', 'properties': {'stage': k}, 'geometry': {'type': 'LineString', 'coordinates': [list(p) for p in pts]}}
             for k, pts in DRAIN.items()]
    dump('drain.json', feats)
    stages = sorted(f['properties']['stage'] for f in feats)
    assert stages == ['moggy', 'notch', 'passaic'], stages
    assert all(-75.0 <= x <= -74.0 and 40.4 <= y <= 41.1 for f in feats for x, y in f['geometry']['coordinates'])
    print('drain ok')



# ---- water: the northeast Jersey rivers (OpenStreetMap), lakes and ridge crests (the app's own data/nj-geoms.json) ----------------
RIVERS = ['Ramapo River', 'Pequannock River', 'Pompton River', 'Wanaque River', 'Rockaway River', 'Passaic River']
LAKES = ['Greenwood Lake', 'Lake Hopatcong', 'Boonton Reservoir', 'Wanaque Reservoir', 'Monksville Reservoir']
RIDGES = ['Ramapo Mountains', 'Garret Mountain', 'Bearfort Mountain']


def water():
    from shapely.geometry import LineString, MultiLineString, shape, mapping
    from shapely.ops import linemerge
    osm = json.load(open(os.path.join(SRC, 'osm_rivers.json')))   # Overpass: way[waterway=river][name~...](40.6,-74.8,41.35,-74.05); out geom
    feats = []
    for name in RIVERS:
        lines = [LineString([(p['lon'], p['lat']) for p in e['geometry']]) for e in osm['elements'] if e.get('tags', {}).get('name') == name and len(e.get('geometry', [])) > 1]
        if not lines:
            continue
        g = linemerge(MultiLineString(lines)).simplify(0.0002)
        feats.append({'type': 'Feature', 'properties': {'kind': 'river', 'name': name}, 'geometry': mapping(rnd(g))})
    geoms = json.load(open(os.path.join(ROOT, 'data/nj-geoms.json')))
    for name in LAKES:
        feats.append({'type': 'Feature', 'properties': {'kind': 'lake', 'name': name}, 'geometry': mapping(rnd(shape({'type': geoms[name]['type'], 'coordinates': geoms[name]['coordinates']})))})
    for name in RIDGES:
        feats.append({'type': 'Feature', 'properties': {'kind': 'ridge', 'name': name}, 'geometry': mapping(rnd(shape({'type': geoms[name]['type'], 'coordinates': geoms[name]['coordinates']})))})
    dump('water.json', feats)
    got = {f['properties']['name'] for f in feats}
    assert all(n in got for n in RIVERS + LAKES + RIDGES), set(RIVERS + LAKES + RIDGES) - got
    print('water ok')


if __name__ == '__main__':
    import urllib.parse
    what = sys.argv[1:] or ['rocks', 'ice', 'lakes', 'canal', 'sand', 'provinces', 'icelines', 'iceanim']
    fw = il = None
    if 'rocks' in what or 'lakes' in what: fw = rocks()
    if 'ice' in what or 'lakes' in what: il = ice()
    if 'lakes' in what: lakes(fw, il)
    if 'canal' in what: canal()
    if 'sand' in what: sand()
    if 'provinces' in what: provinces()
    if 'icelines' in what: ice_region()
    if 'iceanim' in what: ice_anim()
    if 'drain' in what: drain()
    if 'water' in what: water()
