"""Build js/midtowngrid.js for Drive the grid: the legal direction of every
block of Manhattan's grid from 14th to 110th St, from NYC's street centerline
(CSCL, NYC Open Data). The avenue columns (names along each stretch, rule-of-
thumb direction, where they start and end) are defined here and written into
the output, so the game and the data can't disagree.

usage:
  1. Download the centerline (dataset inkn-q76z) for the area:
     curl -G -o cscl.geojson https://data.cityofnewyork.us/resource/inkn-q76z.geojson \\
       --data-urlencode "$select=full_street_name,trafdir,rw_type,segment_type,the_geom,modified_date" \\
       --data-urlencode "$where=boroughcode='1' AND within_box(the_geom, 40.808, -74.02, 40.725, -73.93)" \\
       --data-urlencode "$limit=50000"
  2. python3 -I tools/build_grid.py cscl.geojson js/midtowngrid.js report.txt
     (report.txt lists every block that differs from the rules of thumb)

trafdir: FT = traffic flows the way the line is drawn, TF = against it,
TW = both ways, NV = not for vehicles (ignored).
"""
import json, math, re, sys

src, out_js, report = sys.argv[1:4]
raw = json.load(open(src))

S_MIN, S_MAX = 14, 110
# Rule of thumb: odd streets west, even east, except these, which run both ways
TWO_WAY = [14, 23, 34, 42, 57, 59, 72, 79, 86, 96, 106, 110]

# Avenue columns, west to east. x: feet from 5th Ave in the straightened grid.
# ranges: [first street, name, short label, rule-of-thumb direction]
COLS = [
    dict(key='west', x=-5700, frm=24, to=110, names={'12 AVE', 'RIVERSIDE BLVD', 'RIVERSIDE DR'},
         ranges=[[24, 'West Side Hwy', 'W Side Hwy', 'two'], [59, 'Riverside Blvd', 'Riverside Blvd', 'two'], [72, 'Riverside Dr', 'Riverside', 'two']]),
    dict(key='11', x=-4960, frm=14, to=107, names={'11 AVE', 'W END AVE', 'WEST END AVE'},
         ranges=[[14, '11th Ave', '11th', 'two'], [59, 'West End Ave', 'West End', 'two']]),
    dict(key='bway', x=-4560, frm=73, to=110, names={'BROADWAY'},
         ranges=[[73, 'Broadway', 'Bway', 'two']]),
    dict(key='10', x=-4160, frm=14, to=110, names={'10 AVE', 'AMSTERDAM AVE'},
         ranges=[[14, '10th Ave', '10th', 'U'], [59, 'Amsterdam Ave', 'Amsterdam', 'U']]),
    dict(key='9', x=-3360, frm=14, to=110, names={'9 AVE', 'COLUMBUS AVE'},
         ranges=[[14, '9th Ave', '9th', 'D'], [59, 'Columbus Ave', 'Columbus', 'D']]),
    dict(key='8', x=-2560, frm=14, to=110, names={'8 AVE', 'CENTRAL PARK W', 'COLUMBUS CIR', 'FREDERICK DOUGLASS CIR'},
         ranges=[[14, '8th Ave', '8th', 'U'], [59, 'Central Park West', 'CPW', 'two']]),
    dict(key='7', x=-1760, frm=14, to=59, names={'7 AVE'}, ranges=[[14, '7th Ave', '7th', 'D']]),
    dict(key='6', x=-920, frm=14, to=59, names={'AVE OF THE AMERICAS', '6 AVE'}, ranges=[[14, '6th Ave', '6th', 'U']]),
    dict(key='5', x=0, frm=14, to=110, names={'5 AVE'}, ranges=[[14, '5th Ave', '5th', 'D']]),
    dict(key='madison', x=420, frm=23, to=110, names={'MADISON AVE'}, ranges=[[23, 'Madison Ave', 'Madison', 'U']]),
    dict(key='park', x=840, frm=14, to=110, names={'PARK AVE', 'PARK AVE S', 'UNION SQ E'},
         ranges=[[14, 'Park Ave S', 'Park S', 'two'], [32, 'Park Ave', 'Park', 'two']]),
    dict(key='lex', x=1260, frm=21, to=110, names={'LEXINGTON AVE'}, ranges=[[21, 'Lexington Ave', 'Lexington', 'D']]),
    dict(key='3', x=1660, frm=14, to=110, names={'3 AVE'}, ranges=[[14, '3rd Ave', '3rd', 'U']]),
    dict(key='2', x=2310, frm=14, to=110, names={'2 AVE'}, ranges=[[14, '2nd Ave', '2nd', 'D']]),
    dict(key='1', x=2960, frm=14, to=110, names={'1 AVE'}, ranges=[[14, '1st Ave', '1st', 'U']]),
    dict(key='york', x=3610, frm=59, to=92, names={'YORK AVE'}, ranges=[[59, 'York Ave', 'York', 'two']]),
]
KEYS = [c['key'] for c in COLS]
CI = {k: i for i, k in enumerate(KEYS)}
# Roads through Central Park, drawn on one row of the grid
TRANSVERSES = {65: '65 ST TRANSVERSE', 79: '79 ST TRANSVERSE', 86: '86 ST TRANSVERSE', 97: '97 ST TRANSVERSE'}
# Blocks the sampling can't read: Columbus Circle is wider than the search
# radius; you drive around it to get from 8th Ave to Central Park West.
AVE_OVERRIDES = {('8', 59): 'two'}
STREET_ALIASES = {
    'CENTRAL PARK S': 59, 'CENTRAL PARK N': 110, 'CATHEDRAL PKWY': 110,
    'GRAMERCY PARK S': 20, 'GRAMERCY PARK N': 21,
}

LAT0 = 40.765
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110540
def xy(c):
    return ((c[0] + 73.97) * KX, (c[1] - LAT0) * KY)
ANG = math.radians(29)
UP = (math.sin(ANG), math.cos(ANG))
EAST = (math.cos(ANG), -math.sin(ANG))

# ---- read the centerline ----------------------------------------------------------
streets, cols, transverse_ways = {}, {k: [] for k in KEYS}, {}
name2col = {n: c['key'] for c in COLS for n in c['names']}
latest = ''
for f in raw['features']:
    p = f['properties']
    latest = max(latest, p.get('modified_date') or '')
    td = p.get('trafdir')
    if td not in ('FT', 'TF', 'TW'):
        continue
    name = re.sub(r'\s+', ' ', p.get('full_street_name') or '').strip()
    g = f['geometry']
    lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for line in lines:
        w = {'pts': [xy(c) for c in line], 'ow': {'FT': 1, 'TF': -1, 'TW': 0}[td], 'name': name}
        m = re.match(r'^[EW] (\d+) ST$', name)
        if m and S_MIN <= int(m.group(1)) <= S_MAX:
            streets.setdefault(int(m.group(1)), []).append(w)
        elif name in STREET_ALIASES:
            streets.setdefault(STREET_ALIASES[name], []).append(w)
        elif name in name2col:
            cols[name2col[name]].append(w)
        for s, tn in TRANSVERSES.items():
            if name == tn:
                transverse_ways.setdefault(s, []).append(w)

def segs(w):
    return list(zip(w['pts'], w['pts'][1:]))

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

def crossing(s, k):
    if s not in streets or not cols[k]:
        return None
    best = None
    for w in streets[s]:
        for p0, p1 in segs(w):
            for t in range(5):
                q = (p0[0] + (p1[0] - p0[0]) * t / 4, p0[1] + (p1[1] - p0[1]) * t / 4)
                r = near(cols[k], q)
                if r and (best is None or r[0] < best[0]):
                    best = (r[0], ((q[0] + r[1][0]) / 2, (q[1] + r[1][1]) / 2))
    return best[1] if best and best[0] < 30 else None

def in_col(c, s):
    return c['frm'] <= s <= c['to']

real = {}
for c in COLS:
    for s in range(S_MIN, S_MAX + 1):
        if in_col(c, s) and c['key'] != 'west':
            real[(s, c['key'])] = crossing(s, c['key'])
        elif in_col(c, s) and s >= 59:
            real[(s, 'west')] = crossing(s, 'west')

def pos(s, k):
    """Where street s meets column k: the real crossing, or interpolated along the column."""
    if real.get((s, k)):
        return real[(s, k)]
    have = sorted(t for (t, kk), v in real.items() if kk == k and v)
    lo = [t for t in have if t < s]
    hi = [t for t in have if t > s]
    if lo and hi:
        a, b = lo[-1], hi[0]
    elif len(lo) >= 2:
        a, b = lo[-2], lo[-1]
    elif len(hi) >= 2:
        a, b = hi[0], hi[1]
    else:
        return None
    p, q = real[(a, k)], real[(b, k)]
    t = (s - a) / (b - a)
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)

def dirs(ws, q, axis, maxd=22, interior=False):
    """Directions allowed on the ways near q. interior: count a way only if q lies
    alongside one of its segments (so a wide search can't bridge a real gap)."""
    found, hit = set(), False
    for w in ws:
        for a, b in segs(w):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = dx * dx + dy * dy or 1e-9
            t0 = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L
            if interior and not (0 <= t0 <= 1):
                continue
            t = max(0, min(1, t0))
            p = (a[0] + t * dx, a[1] + t * dy)
            if math.hypot(p[0] - q[0], p[1] - q[1]) > maxd:
                continue
            hit = True
            sgn = 1 if dx * axis[0] + dy * axis[1] > 0 else -1
            found |= {1, -1} if w['ow'] == 0 else {sgn * w['ow']}
    return found if hit else None

def block(ws, p, q, axis, words, maxd=22, interior=False):
    acc = set()
    for t in (0.25, 0.5, 0.75):
        r = dirs(ws, (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t), axis, maxd, interior)
        if r is None:
            return None
        acc |= r
    return 'two' if acc == {1, -1} else words[0] if acc == {1} else words[1]

# ---- street blocks ------------------------------------------------------------------
st_out, av_out, cross_out = {}, {}, {}
for s in range(S_MIN, S_MAX + 1):
    row = []
    present = [i for i, c in enumerate(COLS) if in_col(c, s)]
    for i, c in enumerate(COLS):
        if i not in present or present[-1] == i:
            row.append(None)
            continue
        j = present[present.index(i) + 1]
        if c['key'] == 'west' and s < 59:
            # below 59th the edge road is the West Side Highway: a street reaches it
            # if it continues west of 11th Ave
            p = pos(s, '11')
            acc = set() if p else None
            for dist in (45, 75):
                r = dirs(streets.get(s, []), (p[0] - EAST[0] * dist, p[1] - EAST[1] * dist), EAST) if p else None
                if r is None:
                    acc = None
                    break
                acc |= r
            row.append(None if not acc else 'two' if acc == {1, -1} else 'E' if acc == {1} else 'W')
            continue
        if s in TRANSVERSES and c['key'] == '8' and KEYS[j] == '5':
            # through Central Park on the transverse road
            tw = transverse_ways.get(s, [])
            acc = set()
            for w in tw:
                acc |= {1, -1} if w['ow'] == 0 else {1 if (w['pts'][-1][0] - w['pts'][0][0]) * w['ow'] > 0 else -1}
            row.append('two' if acc == {1, -1} else 'E' if acc == {1} else 'W' if acc else None)
            continue
        p, q = pos(s, c['key']), pos(s, KEYS[j])
        row.append(block(streets.get(s, []), p, q, EAST, 'EW') if p and q else None)
    st_out[s] = row
    cross_out[s] = [1 if real.get((s, c['key'])) or (c['key'] == 'west' and s < 59 and row[0]) else 0 for c in COLS]

# ---- avenue blocks ------------------------------------------------------------------
for c in COLS:
    col = []
    for s in range(S_MIN, S_MAX):
        if not (in_col(c, s) and in_col(c, s + 1)):
            col.append(None)
            continue
        if c['key'] == 'west' and s < 59:
            col.append('two')  # Route 9A runs both ways
            continue
        if (c['key'], s) in AVE_OVERRIDES:
            col.append(AVE_OVERRIDES[(c['key'], s)])
            continue
        p, q = pos(s, c['key']), pos(s + 1, c['key'])
        # wider search: some avenues have two roadways (Park Ave beside the railroad viaduct)
        col.append(block(cols[c['key']], p, q, UP, 'UD', maxd=45, interior=True) if p and q else None)
    av_out[c['key']] = col

columns = [{'key': c['key'], 'x': c['x'], 'from': c['frm'], 'to': c['to'], 'ranges': c['ranges']} for c in COLS]
data = {'source': f"NYC street centerline (CSCL), NYC Open Data, last edited {latest[:10]}", 'sMin': S_MIN, 'sMax': S_MAX,
        'twoWay': TWO_WAY, 'columns': columns, 'streets': st_out, 'aves': av_out, 'crosses': cross_out}
open(out_js, 'w').write(
    "// Generated by tools/build_grid.py from NYC's street centerline (NYC Open Data).\n"
    "// columns: the avenues west to east (names along each stretch, rule-of-thumb direction).\n"
    "// streets[s][i]: street s from column i to the next column east: 'E' | 'W' | 'two' | null (doesn't go through).\n"
    "// aves[key][s - sMin]: that avenue from street s to s + 1: 'U' | 'D' | 'two' | null.\n"
    "// crosses[s][i]: 1 if street s actually meets column i.\n"
    f"export const GRID_DATA = {json.dumps(data, separators=(',', ':'))};\n")

# ---- report: blocks that break the rules of thumb ----------------------------------------
def rule_ave(c, s):
    r = [x for x in c['ranges'] if x[0] <= s][-1]
    return r[3]
lines = [data['source']]
n_st = n_av = d_st = d_av = 0
for s in range(S_MIN, S_MAX + 1):
    rule = 'two' if s in TWO_WAY else 'W' if s % 2 else 'E'
    present = [i for i, c in enumerate(COLS) if in_col(c, s)]
    for i in present[:-1]:
        j = present[present.index(i) + 1]
        n_st += 1
        v = st_out[s][i]
        if v != rule:
            d_st += 1
            lines.append(f'street {s} {KEYS[i]}->{KEYS[j]}: real {v}, rule {rule}')
for c in COLS:
    for s in range(S_MIN, S_MAX):
        if in_col(c, s) and in_col(c, s + 1):
            n_av += 1
            v = av_out[c['key']][s - S_MIN]
            if v != rule_ave(c, s):
                d_av += 1
                lines.append(f"avenue {c['key']} {s}-{s + 1}: real {v}, rule {rule_ave(c, s)}")
lines.append(f'street blocks differing: {d_st} of {n_st}; avenue blocks differing: {d_av} of {n_av}')
open(report, 'w').write('\n'.join(lines) + '\n')
print(lines[-1])
