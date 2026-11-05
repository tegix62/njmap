"""Build js/midtowngrid.js: the real legal direction of every block in the game's
grid, from NYC's street centerline (CSCL, via cscl2osm.py's output).

usage:
  1. Download Manhattan's centerline around Midtown from NYC Open Data (CSCL, dataset inkn-q76z):
     curl -G -o cscl.geojson https://data.cityofnewyork.us/resource/inkn-q76z.geojson \
       --data-urlencode "$select=full_street_name,trafdir,rw_type,segment_type,the_geom,modified_date" \
       --data-urlencode "$where=boroughcode='1' AND within_box(the_geom, 40.775, -74.02, 40.725, -73.955)" \
       --data-urlencode "$limit=50000"
  2. python3 -I tools/cscl2osm.py cscl.geojson cscl-osm.json
  3. python3 -I tools/build_grid.py cscl-osm.json cscl.geojson js/midtowngrid.js report.txt
     (report.txt lists every block that differs from the rules of thumb)
"""
import json, math, re, sys

src, raw, out_js, report = sys.argv[1:5]
d = json.load(open(src))
ways = [e for e in d['elements'] if e.get('type') == 'way']

# Gramercy Park's sides carry 20th and 21st St
rawd = json.load(open(raw))
for i, f in enumerate(rawd['features']):
    p = f['properties']
    n = re.sub(r'\s+', ' ', p.get('full_street_name') or '').strip()
    if n in ('GRAMERCY PARK S', 'GRAMERCY PARK N') and p.get('trafdir') in ('FT', 'TF', 'TW'):
        g = f['geometry']
        for line in (g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]):
            ways.append({'type': 'way', 'tags': {'name': 'East 20th Street' if n.endswith('S') else 'East 21st Street',
                                                  'oneway': {'FT': 'yes', 'TF': '-1', 'TW': 'no'}[p['trafdir']]},
                         'geometry': [{'lon': c[0], 'lat': c[1]} for c in line]})

LAT0 = 40.755
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110540
def xy(p):
    return ((p['lon'] + 73.98) * KX, (p['lat'] - LAT0) * KY)
ANG = math.radians(29)
UP = (math.sin(ANG), math.cos(ANG))
EAST = (math.cos(ANG), -math.sin(ANG))

# must match js/gridgame.js AVES order
AVES = ['11th Ave', '10th Ave', '9th Ave', '8th Ave', '7th Ave', '6th Ave', '5th Ave', 'Madison Ave', 'Park Ave', 'Lexington Ave', '3rd Ave', '2nd Ave', '1st Ave']
FROM = {'Madison Ave': 23, 'Lexington Ave': 21}
NAMES = {
    '11th Ave': {'11th Avenue'}, '10th Ave': {'10th Avenue'}, '9th Ave': {'9th Avenue'}, '8th Ave': {'8th Avenue'},
    '7th Ave': {'7th Avenue'}, '6th Ave': {'Avenue of the Americas', '6th Avenue'}, '5th Ave': {'5th Avenue'},
    'Madison Ave': {'Madison Avenue'}, 'Park Ave': {'Park Avenue', 'Park Avenue South', 'Union Square East'},
    'Lexington Ave': {'Lexington Avenue'}, '3rd Ave': {'3rd Avenue'}, '2nd Ave': {'2nd Avenue'}, '1st Ave': {'1st Avenue'},
}
n2a = {n: a for a, ns in NAMES.items() for n in ns}
st_re = re.compile(r'^(West|East) (\d+)(st|nd|rd|th) Street$')
streets, aves = {}, {a: [] for a in AVES}
for w in ways:
    n = w['tags']['name']
    m = st_re.match(n)
    if m:
        streets.setdefault(int(m.group(2)), []).append(w)
    elif n in n2a:
        aves[n2a[n]].append(w)

def segs(w):
    pts = [xy(p) for p in w['geometry']]
    return list(zip(pts, pts[1:]))
def ow(w):
    o = w['tags'].get('oneway')
    return 1 if o == 'yes' else -1 if o == '-1' else 0

def near(ws, q):
    best = None
    for w in ws:
        for a, b in segs(w):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = dx * dx + dy * dy or 1e-9
            t = max(0, min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L))
            p = (a[0] + t * dx, a[1] + t * dy)
            dd = math.hypot(p[0] - q[0], p[1] - q[1])
            if best is None or dd < best[0]:
                best = (dd, p)
    return best

def crossing(s, a):
    if s not in streets or not aves[a]:
        return None
    best = None
    for w in streets[s]:
        for p0, p1 in segs(w):
            for k in range(5):
                q = (p0[0] + (p1[0] - p0[0]) * k / 4, p0[1] + (p1[1] - p0[1]) * k / 4)
                r = near(aves[a], q)
                if r and (best is None or r[0] < best[0]):
                    best = (r[0], ((q[0] + r[1][0]) / 2, (q[1] + r[1][1]) / 2))
    return best[1] if best and best[0] < 30 else None

S = range(14, 58)
real = {(s, a): crossing(s, a) for s in S for a in AVES}
def pos(s, a):
    """Where street s meets avenue a: the real crossing, or interpolated along the avenue."""
    if real[(s, a)]:
        return real[(s, a)]
    lo = next((k for k in range(s - 1, 13, -1) if real.get((k, a))), None)
    hi = next((k for k in range(s + 1, 58) if real.get((k, a))), None)
    if lo is None or hi is None:
        base = lo if hi is None else hi
        if base is None:
            return None
        other = next((k for k in (range(base - 1, 13, -1) if hi is None else range(base + 1, 58)) if real.get((k, a))), None)
        if other is None:
            return None
        p, q = real[(base, a)], real[(other, a)]
        t = (s - base) / (other - base)
        return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
    p, q = real[(lo, a)], real[(hi, a)]
    t = (s - lo) / (hi - lo)
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)

def dirs(ws, q, axis, maxd=22):
    found, hit = set(), False
    for w in ws:
        for a, b in segs(w):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = dx * dx + dy * dy or 1e-9
            t = max(0, min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L))
            p = (a[0] + t * dx, a[1] + t * dy)
            if math.hypot(p[0] - q[0], p[1] - q[1]) > maxd:
                continue
            hit = True
            sgn = 1 if dx * axis[0] + dy * axis[1] > 0 else -1
            o = ow(w)
            found |= {1, -1} if o == 0 else {sgn * o}
    return found if hit else None

def block(ws, p, q, axis, names):
    """Direction over a whole block: sampled at three points; any gap = doesn't go through."""
    acc = set()
    for t in (0.25, 0.5, 0.75):
        r = dirs(ws, (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t), axis)
        if r is None:
            return None
        acc |= r
    return 'two' if acc == {1, -1} else names[1] if acc == {1} else names[-1]

exists = lambda a, s: s >= FROM.get(a, 14)
st_out, av_out, cross_out = {}, {}, {}
for s in S:
    row = []
    for i, a in enumerate(AVES):
        if not exists(a, s):
            row.append(None)
            continue
        j = next((k for k in range(i + 1, len(AVES)) if exists(AVES[k], s)), None)
        if j is None:
            row.append(None)
            continue
        p, q = pos(s, a), pos(s, AVES[j])
        row.append(block(streets.get(s, []), p, q, EAST, {1: 'E', -1: 'W'}) if p and q else None)
    st_out[s] = row
    cross_out[s] = [1 if real[(s, a)] else 0 for a in AVES]
for a in AVES:
    col = []
    for s in range(14, 57):
        if not exists(a, s):
            col.append(None)
            continue
        p, q = pos(s, a), pos(s + 1, a)
        col.append(block(aves[a], p, q, UP, {1: 'U', -1: 'D'}) if p and q else None)
    av_out[a] = col

src_note = d.get('osm3s', {}).get('timestamp_osm_base', '')
js = f"""// Generated by tools/build_grid.py from NYC's street centerline (CSCL, NYC Open
// Data, {src_note.replace('NYC CSCL ', 'last edited ')}): the legal direction of every block in Drive the grid.
// streets[s][i]: the block of street s from AVES[i] to the next avenue east
// ('E', 'W', 'two', or null = doesn't go through). aves[name][s - 14]: the
// block of the avenue from street s to s + 1 ('U', 'D', 'two', null).
// crosses[s][i]: 1 if street s actually meets avenue i (0 = the avenue passes by).
export const GRID_DATA = {json.dumps({'streets': st_out, 'aves': av_out, 'crosses': cross_out}, separators=(',', ':'))};
"""
open(out_js, 'w').write(js)

TWO = {14, 23, 34, 42, 57}
RULE_AVE = {'11th Ave': 'two', '10th Ave': 'U', '9th Ave': 'D', '8th Ave': 'U', '7th Ave': 'D', '6th Ave': 'U', '5th Ave': 'D',
            'Madison Ave': 'U', 'Park Ave': 'two', 'Lexington Ave': 'D', '3rd Ave': 'U', '2nd Ave': 'D', '1st Ave': 'U'}
lines = [f'source: {src_note}']
for s in S:
    rule = 'two' if s in TWO else 'W' if s % 2 else 'E'
    for i, v in enumerate(st_out[s]):
        if v != rule and exists(AVES[i], s) and any(exists(AVES[k], s) for k in range(i + 1, len(AVES))):
            j = next(k for k in range(i + 1, len(AVES)) if exists(AVES[k], s))
            lines.append(f'street {s} {AVES[i]}->{AVES[j]}: real {v}, rule {rule}')
for a in AVES:
    for k, v in enumerate(av_out[a]):
        s = 14 + k
        if exists(a, s) and v != RULE_AVE[a]:
            lines.append(f'avenue {a} {s}-{s + 1}: real {v}, rule {RULE_AVE[a]}')
open(report, 'w').write('\n'.join(lines) + '\n')
print(len(lines) - 1, 'differences')
