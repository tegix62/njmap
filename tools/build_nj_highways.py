"""Highways for "Name that highway": reads /tmp/nj/hwy.pkl (tools/scan_nj_highways.py), builds a line for each road of the roster (clipped to
New Jersey, joined, simplified, oriented west->east or south->north), the roads each one meets, and appends them to data/nj-geoms.json and
data/nj-places.json as places of kind "highway" (idempotent: earlier highways are replaced). Towns along each road come from build_nj_geoms.list_towns."""
import json, math, os, pickle, re, sys
from shapely import wkb
from shapely.geometry import mapping, LineString, MultiLineString
from shapely.ops import linemerge, unary_union
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_nj_landmark_list as BL
import build_nj_geoms as BG
ROOT = BG.ROOT

I_REFS = ['78', '80', '95', '195', '278', '280', '287', '295', '676']
US_REFS = ['1', '9', '22', '30', '40', '46', '130', '202', '206', '322']
NJ_REFS = ['3', '4', '10', '17', '18', '21', '23', '24', '27', '31', '33', '35', '36', '38', '42', '47', '70', '72', '73']
ROSTER = {}
for r in I_REFS: ROSTER[f'I-{r}'] = ('US:I', r)
for r in US_REFS: ROSTER[f'Route {r}'] = ('US:US', r)
for r in NJ_REFS: ROSTER[f'Route {r}'] = ('US:NJ', r)
NAMED = {'Turnpike': r'New Jersey Turnpike', 'Parkway': r'Garden State Parkway', 'AC Expressway': r'Atlantic City Expressway'}
WORD = {'I-': 'Interstate ', 'Route ': 'Route '}

rows = pickle.load(open('/tmp/nj/hwy.pkl', 'rb'))
polys, props = BL.towns()
NJ = unary_union([p.buffer(0.0015) for p in polys])

def label_of(r):
    nm = r['name'] or ''
    for lab, rx in NAMED.items():
        if re.search(rx, nm) or any(n == 'US:NJ:GSP' for n, _ in r['routes']) and lab == 'Parkway': return [lab]
    out = []
    for lab, (net, ref) in ROSTER.items():
        if (net, ref) in r['routes']: out.append(lab)
    return out

lines = {}
for r in rows:
    for lab in label_of(r):
        g = wkb.loads(r['geometry'])
        g = g.intersection(NJ)
        if g.is_empty: continue
        lines.setdefault(lab, []).append(g)

def parts(g):
    if g.geom_type == 'LineString': return [g]
    if g.geom_type in ('MultiLineString', 'GeometryCollection'): return [x for gg in g.geoms for x in parts(gg)]
    return []

def orient(ln):
    c = list(ln.coords); dx = (c[-1][0] - c[0][0]) * 84.2; dy = (c[-1][1] - c[0][1]) * 111
    if abs(dy) >= abs(dx): flip = dy < 0
    else: flip = dx < 0
    return LineString(c[::-1]) if flip else ln

out = {}
meta = {}
for lab, gs in lines.items():
    ps = [p for g in gs for p in parts(g)]
    m = linemerge(ps)
    chains = [c for c in (m.geoms if m.geom_type == 'MultiLineString' else [m]) if c.length > 0.014]     # ~1.5 km
    if not chains: continue
    chains = [orient(c.simplify(0.00035)) for c in sorted(chains, key=lambda c: -c.length)[:12]]
    def km_of(c):
        cc = list(c.coords); return sum(math.hypot((cc[i][0] - cc[i - 1][0]) * 84.2, (cc[i][1] - cc[i - 1][1]) * 111) for i in range(1, len(cc)))
    tot = km_of(chains[0])                      # the longest unbroken stretch (one carriageway), in km
    if tot < 12: continue                                                                                  # (km) too short to be a quiz question
    geom = {'type': 'MultiLineString', 'coordinates': [[[round(x, 5), round(y, 5)] for x, y in c.coords] for c in chains]}
    out[lab] = geom
    main = chains[0]
    mid = main.interpolate(0.5, normalized=True)
    c0, c1 = main.coords[0], main.coords[-1]
    ang = (math.degrees(math.atan2((c1[0] - c0[0]) * 84.2, (c1[1] - c0[1]) * 111)) + 360) % 360
    meta[lab] = {'mid': [round(mid.x, 5), round(mid.y, 5)], 'ang': round(ang), 'km': round(tot), 'main': main, 'all': unary_union(chains)}

# the roads each one meets, in order along it
for lab, mt in meta.items():
    hits = []
    for o, om in meta.items():
        if o == lab: continue
        inter = mt['all'].buffer(0.0009).intersection(om['all'].buffer(0.0009))
        if inter.is_empty or inter.area < 4e-8: continue
        hits.append((mt['main'].project(inter.representative_point()) if mt['main'].distance(inter) < 0.003 else 99, o))
    mt['meets'] = [o for _, o in sorted(hits)]

def town_at(pt):
    from shapely.geometry import Point
    P = Point(pt)
    for i, pg in enumerate(polys):
        if pg.contains(P): return props[i]
    return None

geoms = json.load(open(os.path.join(ROOT, 'data/nj-geoms.json')))
places = json.load(open(os.path.join(ROOT, 'data/nj-places.json')))
places = [p for p in places if p.get('kind') != 'highway']
for lab in list(geoms):
    if lab in meta or (lab in out): geoms.pop(lab, None)
for lab in list(geoms):
    if geoms[lab].get('hwy'): geoms.pop(lab)
DIRW = lambda a: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][int(((a + 22.5) % 360) // 45)]
new = []
for lab, g in out.items():
    mt = meta[lab]
    g['hwy'] = True
    geoms[lab] = g
    tw = town_at(mt['mid'])
    fam = 'Interstate' if lab.startswith('I-') else 'Route' if lab.startswith('Route') else lab
    new.append({
        'n': lab, 'kind': 'highway', 'k': 'nat', 'p': mt['mid'], 'z': 11.2, 'pitch': 60, 'bearing': mt['ang'],
        'line': f"{'An Interstate' if lab.startswith('I-') else 'A state or US route' if lab.startswith('Route') else 'A toll road'} running {DIRW(mt['ang'])} through New Jersey",
        'at': tw['full'] if tw else '', 'c': tw['c'] if tw else '', 'meets': mt['meets'][:10],
    })
places += new
json.dump(geoms, open(os.path.join(ROOT, 'data/nj-geoms.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
BG.list_towns(places, geoms)          # writes data/nj-places.json (all places: towns along each road, in order)
print(len(new), 'highways:', ', '.join(p['n'] for p in new))
for p in new: print(f"  {p['n']:14s} {meta[p['n']]['km']:4d} km  bearing {p['bearing']:3d}  meets {', '.join(p['meets'][:6])}")
