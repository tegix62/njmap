"""Build data/manhattan-streets.json for Drive Manhattan: every drivable street
in Manhattan with its legal direction, from NYC's street centerline (CSCL,
NYC Open Data, dataset inkn-q76z).

usage:
  1. Download Manhattan's centerline:
     curl -G -o cscl-mn.geojson https://data.cityofnewyork.us/resource/inkn-q76z.geojson \\
       --data-urlencode "$select=physicalid,full_street_name,trafdir,rw_type,from_level_code,to_level_code,status,the_geom,modified_date" \\
       --data-urlencode "$where=boroughcode='1'" --data-urlencode "$limit=50000"
  2. python3 -I tools/build_streets.py cscl-mn.geojson data/manhattan-streets.json report.txt

What it does:
- intersections are where segment ends meet at the same level (so an
  overpass doesn't connect to the street below it)
- trafdir: FT = traffic flows the way the line is drawn, TF = against, TW = both;
  NV (not for vehicles) and paths, alleys, driveways are left out
- keeps the largest part of the network where every intersection can reach
  every other one, so you can never get stuck, plus the lanes that lead into
  it from outside (tunnels and bridges): those are where rounds can start
- merges the pieces of one real corner (a divided road's two roadbeds, median
  crossings, short connectors) into one intersection, and writes links from
  corner to corner, through bends
- for each way into a corner, the ways on (no U-turns) and the button each gets:
  Left / Straight / Right when they fit one each, clearly apart; otherwise a
  named button per way out, one marked as the default (the road carrying on)
- refuses to write the file if any check fails: a link with no way on, two ways
  on one button; the link states kept are those that can all reach each other

Output (version 2): junctions (corner centres), jdeg (roads meeting there),
geoms (road shapes, delta-encoded; a two-way block's two links share one),
links [from, to, name, geom (~g = reversed), bearing out, bearing in],
turns per link [link, slot, ...] (slot 1 L, 2 S, 3 R, 4 named, 5 named default),
feeders (links on the way in), entries, places, areas.
"""
import json, math, re, sys
from collections import defaultdict, Counter

src, out, report = sys.argv[1:4]
# --downtown: the streets below 14th St only, no highways, ramps, tunnels or bridges
# (rounds from a tunnel or bridge start where it lands on a street)
# --midtown: the same, between 14th and 59th St
AREA = 'downtown' if '--downtown' in sys.argv[4:] else 'midtown' if '--midtown' in sys.argv[4:] else None
DOWNTOWN = AREA is not None  # streets only, one area
raw = json.load(open(src))
DRIVABLE = {'1', '2', '3', '4', '9'}  # street, highway, bridge, tunnel, ramp

ANG = math.radians(29)  # the street grid is turned ~29 degrees clockwise from north
LAT0 = 40.78
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110540

def grid_xy(lon, lat):
    """metres east/north -> (across, uptown) in the grid's frame"""
    x, y = (lon + 73.97) * KX, (lat - LAT0) * KY
    return (x * math.cos(ANG) - y * math.sin(ANG), x * math.sin(ANG) + y * math.cos(ANG))

# ---- names people use ---------------------------------------------------------------
def ordinal(n):
    n = int(n)
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"
WORDS = {'ST': 'St', 'AVE': 'Ave', 'PL': 'Pl', 'DR': 'Dr', 'BLVD': 'Blvd', 'RD': 'Rd', 'SQ': 'Sq', 'PKWY': 'Pkwy',
         'BRG': 'Bridge', 'TUNL': 'Tunnel', 'HWY': 'Hwy', 'EXPY': 'Expwy', 'EXPWY': 'Expwy', 'LN': 'Ln', 'TER': 'Ter',
         'CIR': 'Circle', 'PLZ': 'Plaza', 'SLIP': 'Slip', 'ALY': 'Alley', 'E': 'E', 'W': 'W', 'N': 'N', 'S': 'S',
         'FDR': 'FDR', 'RFK': 'RFK', 'OF': 'of', 'THE': 'the', 'AND': '&', 'NB': 'NB', 'SB': 'SB', 'EB': 'EB', 'WB': 'WB',
         'EN': 'entrance', 'ET': 'exit', 'EX': 'exit', 'BR': 'Bridge', 'PY': 'Pkwy', 'HUGH': 'Hugh', 'L': 'L'}
SPECIAL = {
    'AVE OF THE AMERICAS': '6th Ave', 'HUGH L CAREY TUNL': 'Brooklyn-Battery Tunnel', 'ED KOCH QUEENSBORO BRG': 'Queensboro Bridge',
    'FDR DR': 'FDR Drive', 'HENRY HUDSON PKWY': 'Henry Hudson Pkwy', 'W END AVE': 'West End Ave', 'CENTRAL PARK W': 'Central Park West',
    'CENTRAL PARK S': 'Central Park South', 'CENTRAL PARK N': 'Central Park North', 'ADAM C POWELL BLVD': 'Adam Clayton Powell Jr Blvd',
    'FREDERICK DOUGLASS BLVD': 'Frederick Douglass Blvd', 'MALCOLM X BLVD': 'Malcolm X Blvd (Lenox Ave)', 'ST NICHOLAS AVE': 'St Nicholas Ave',
    '12 AVE': '12th Ave (West Side Hwy)', 'WEST ST': 'West St (West Side Hwy)',
}
def pretty(n):
    if n in SPECIAL:
        return SPECIAL[n]
    m = re.match(r'^([EW]) (\d+) ST$', n)
    if m:
        return f"{m.group(1)} {ordinal(m.group(2))} St"
    m = re.match(r'^(\d+) (AVE|ST)$', n)
    if m:
        return f"{ordinal(m.group(1))} {WORDS[m.group(2)]}"
    out = []
    for w in n.split(' '):
        if w in WORDS:
            out.append(WORDS[w])
        elif re.match(r'^\d+$', w):
            out.append(ordinal(w) if len(out) == 0 or out[-1] in ('E', 'W') else w)
        else:
            out.append(w.capitalize() if not re.match(r"^\d", w) else w.lower())
    return ' '.join(out)

# ---- segments -> nodes and edges --------------------------------------------------------
nodes, node_ix = [], {}
def node(c, level):
    k = (round(c[0], 5), round(c[1], 5), level or '')
    if k not in node_ix:
        node_ix[k] = len(nodes)
        nodes.append((c[0], c[1]))
    return node_ix[k]

def metres(a, b):
    return math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY)

def simplify(pts, tol=2.5):
    """Douglas-Peucker on lon/lat points, tolerance in metres."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ax, ay = a[0] * KX, a[1] * KY
    bx, by = b[0] * KX, b[1] * KY
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy) or 1e-9
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i][0] * KX, pts[i][1] * KY
        d = abs(dy * (px - ax) - dx * (py - ay)) / L
        if d > best:
            best, bi = d, i
    if best <= tol:
        return [a, b]
    return simplify(pts[:bi + 1], tol)[:-1] + simplify(pts[bi:], tol)

names, name_ix = [], {}
def name_id(n):
    if n not in name_ix:
        name_ix[n] = len(names)
        names.append(n)
    return name_ix[n]

edges = []  # [a, b, name_id, dir (1 a->b, -1 b->a, 0 both), pts (lon/lat incl ends), length m, raw name]
latest = ''
for f in raw['features']:
    p = f['properties']
    if p.get('rw_type') not in DRIVABLE or p.get('trafdir') not in ('FT', 'TF', 'TW') or p.get('status') not in (None, '2'):
        continue
    latest = max(latest, p.get('modified_date') or '')
    rawname = re.sub(r'\s+', ' ', p.get('full_street_name') or '').strip()
    g = f['geometry']
    lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for line in lines:
        if len(line) < 2:
            continue
        a = node(line[0], p.get('from_level_code'))
        b = node(line[-1], p.get('to_level_code'))
        if a == b:
            continue
        pts = simplify([tuple(c) for c in line])
        length = sum(metres(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        d = {'FT': 1, 'TF': -1, 'TW': 0}[p['trafdir']]
        edges.append([a, b, name_id(pretty(rawname)), d, pts, length, rawname, p.get('rw_type')])

# ---- join road ends that meet at the same point but are coded at different levels ----------------
# A road that simply ends where another begins (a ramp onto the FDR, a parkway
# changing level) is a connection; true overpasses don't end at the same point.
spot = defaultdict(list)
for k, i in node_ix.items():
    spot[(k[0], k[1])].append(i)
degree = Counter()
for a, b, *_r in edges:
    degree[a] += 1; degree[b] += 1
alias = {}
for group in spot.values():
    if len(group) < 2:
        continue
    ends = [u for u in group if degree[u] == 1]
    others = [u for u in group if degree[u] != 1]
    if not ends:
        continue
    target = others[0] if len(others) == 1 else ends[0] if not others else None
    if target is None:
        continue  # several through-roads at different levels here: a real overpass; leave it
    for u in ends:
        if u != target:
            alias[u] = target
for e in edges:
    e[0] = alias.get(e[0], e[0])
    e[1] = alias.get(e[1], e[1])
edges = [e for e in edges if e[0] != e[1]]
# A road end that stops within a few metres of another road's end or junction
# is drawn slightly off, not a dead end: join them.
degree = Counter()
for a, b, *_r in edges:
    degree[a] += 1; degree[b] += 1
cell = defaultdict(list)
CELL = 0.00005  # ~5 m
for u in degree:
    cell[(int(nodes[u][0] / CELL), int(nodes[u][1] / CELL))].append(u)
alias2 = {}
for u, dg in degree.items():
    if dg != 1:
        continue
    cx, cy = int(nodes[u][0] / CELL), int(nodes[u][1] / CELL)
    best = None
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for v in cell[(cx + i, cy + j)]:
                if v == u or alias2.get(v) == u:
                    continue
                dd = metres(nodes[u], nodes[v])
                if dd <= 3 and (best is None or dd < best[0]):
                    best = (dd, v)
    if best:
        alias2[u] = best[1]
def root(u):
    seen = set()
    while u in alias2 and u not in seen:
        seen.add(u)
        u = alias2[u]
    return u
for e in edges:
    e[0], e[1] = root(e[0]), root(e[1])
edges = [e for e in edges if e[0] != e[1]]

# ---- directed graph; keep the strongly connected core and what feeds into it -------------------
out_adj, in_adj = defaultdict(list), defaultdict(list)
for i, (a, b, _, d, *_r) in enumerate(edges):
    if d >= 0:
        out_adj[a].append(b); in_adj[b].append(a)
    if d <= 0:
        out_adj[b].append(a); in_adj[a].append(b)

def reach(start, adj):
    seen, stack = set(start), list(start)
    while stack:
        u = stack.pop()
        for v in adj[u]:
            if v not in seen:
                seen.add(v)
                stack.append(v)
    return seen

# Kosaraju, iterative
N = len(nodes)
order, seen = [], [False] * N
for s in range(N):
    if seen[s]:
        continue
    stack = [(s, 0)]
    seen[s] = True
    while stack:
        u, i = stack[-1]
        nb = out_adj[u]
        if i < len(nb):
            stack[-1] = (u, i + 1)
            v = nb[i]
            if not seen[v]:
                seen[v] = True
                stack.append((v, 0))
        else:
            order.append(u)
            stack.pop()
comp = [-1] * N
c = 0
for s in reversed(order):
    if comp[s] != -1:
        continue
    stack = [s]
    comp[s] = c
    while stack:
        u = stack.pop()
        for v in in_adj[u]:
            if comp[v] == -1:
                comp[v] = c
                stack.append(v)
    c += 1
big = Counter(comp).most_common(1)[0][0]
core = {u for u in range(N) if comp[u] == big}
# Dead ends: a street that only leads back the way you came (a stub, a
# driveway the city lists, a road the background map doesn't even show). In
# the game they only make the car turn around, so drop them, repeatedly, so a
# chain of stubs goes too.
und = defaultdict(set)
for a, b, *_r in edges:
    if a in core and b in core:
        und[a].add(b); und[b].add(a)
pruned = 0
stack = [u for u in core if len(und[u]) <= 1]
while stack:
    u = stack.pop()
    if u not in core or len(und[u]) > 1:
        continue
    core.discard(u)
    pruned += 1
    for v in und.pop(u, ()):
        und[v].discard(u)
        if v in core and len(und[v]) <= 1:
            stack.append(v)
for u in core:
    out_adj[u] = [v for v in out_adj[u] if v in core or v not in und]
feeders = reach(core, in_adj) - core  # can drive into the core, but not back: inbound tunnel/bridge lanes and the like
feeders = {u for u in feeders if comp[u] != big}  # not the dead ends just dropped
keep = core | feeders

# ---- where you can come in from: the start of each inbound lane ----------------------------
CROSSINGS = [
    (r'HOLLAND', 'the Holland Tunnel'), (r'LINCOLN TUN', 'the Lincoln Tunnel'), (r'HUGH L CAREY|BATTERY TUN', 'the Brooklyn-Battery Tunnel'),
    (r'QUEENS MIDTOWN', 'the Queens-Midtown Tunnel'), (r'BROOKLYN BR', 'the Brooklyn Bridge'), (r'MANHATTAN BR', 'the Manhattan Bridge'),
    (r'WILLIAMSBURG', 'the Williamsburg Bridge'), (r'QUEENSBORO|QBORO', 'the Queensboro Bridge'), (r'RFK|TRIBOROUGH', 'the RFK (Triborough) Bridge'),
    (r'GEORGE WASHINGTON|GWB|TRANS MANHATTAN|CROSS BRONX', 'the George Washington Bridge'), (r'HENRY HUDSON', 'the Henry Hudson Pkwy (from the Bronx)'),
    (r'HARLEM RIVER', 'the Harlem River Drive'), (r'MADISON AVE BR', 'the Madison Ave Bridge'), (r'145 ST BR', 'the 145th St Bridge'),
    (r'MACOMBS', 'the Macombs Dam Bridge'), (r'3 AVE BR', 'the 3rd Ave Bridge'), (r'BROADWAY BR', 'the Broadway Bridge'),
    (r'UNIVERSITY HEIGHTS', 'the University Heights Bridge'), (r'WASHINGTON BR', 'the Washington Bridge'), (r'WILLIS', 'the Willis Ave Bridge'),
]
in_deg = Counter()
for i, (a, b, _, d, *_r) in enumerate(edges):
    if a in keep and b in keep:
        if d >= 0: in_deg[b] += 1
        if d <= 0: in_deg[a] += 1
sources = [u for u in feeders if in_deg[u] == 0]
edges_at = defaultdict(list)
for i, e in enumerate(edges):
    edges_at[e[0]].append(i); edges_at[e[1]].append(i)
entries, unnamed = [], []
for u in sources:
    raws = [edges[i][6] for i in edges_at[u]]
    label = next((lab for pat, lab in CROSSINGS for r in raws if re.search(pat, r)), None)
    if label:
        entries.append({'from': label, 'node': u, 'via': pretty(raws[0])})
    else:
        unnamed.append((u, raws))

# ---- the grid's frame and the area boundaries ----------------------------------------------
def gy(u):
    return grid_xy(*nodes[u])[1]
street_y = defaultdict(list)
for a, b, nid, d, pts, L, rawname, *_rw in edges:
    m = re.match(r'^[EW] (\d+) ST$', rawname)
    if m:
        street_y[int(m.group(1))].append(gy(a))
areas = {str(s): round(sorted(street_y[s])[len(street_y[s]) // 2]) for s in (14, 59, 110) if street_y.get(s)}

# ---- named destinations, snapped to a real intersection --------------------------------------
PLACES = [
    # Downtown
    ('the Holland Tunnel entrance (to NJ)', None, 'HOLLAND TUNNEL EN VARICK ST'),
    ('One World Trade Center', (-74.0123, 40.7128), None), ('the Stock Exchange (Wall St)', (-74.0109, 40.7069), None),
    ('City Hall', (-74.0061, 40.7128), None), ('the Staten Island Ferry', (-74.0131, 40.7022), None),
    ('Chinatown', (-73.9989, 40.7176), None), ('Washington Square Park', (-73.9973, 40.7313), None),
    ('SoHo', (-73.9977, 40.7243), None), ('Union Square', (-73.9906, 40.7359), None),
    ('Tribeca', (-74.0076, 40.7189), None), ('the Brooklyn Bridge (Manhattan end)', (-74.0036, 40.7116), None),
    ('Katz’s Deli', (-73.9874, 40.7223), None), ('Astor Place', (-73.9910, 40.7299), None),
    ('the Whitney', (-74.0089, 40.7396), None), ('Battery Park', (-74.0151, 40.7046), None),
    # Midtown
    ('Grand Central', (-73.9772, 40.7527), None), ('the Empire State Building', (-73.9857, 40.7484), None),
    ('Madison Square Garden', (-73.9934, 40.7505), None), ('Port Authority', (-73.9903, 40.7570), None),
    ('Times Square', (-73.9855, 40.7580), None), ('Radio City', (-73.9799, 40.7600), None), ('MoMA', (-73.9776, 40.7614), None),
    ('Carnegie Hall', (-73.9799, 40.7651), None), ('the Flatiron Building', (-73.9897, 40.7411), None),
    ('Chelsea Market', (-74.0060, 40.7424), None), ('the Javits Center', (-74.0024, 40.7578), None), ('the UN', (-73.9680, 40.7489), None),
    ('Hudson Yards', (-74.0021, 40.7539), None), ("Macy's (Herald Square)", (-73.9890, 40.7506), None),
    ('the Lincoln Tunnel entrance (to NJ)', None, 'LINCOLN TUNNEL ENTRANCE 9 AVE'),
    # Uptown and up
    ('Columbus Circle', (-73.9819, 40.7681), None), ('Lincoln Center', (-73.9835, 40.7725), None),
    ('the Natural History Museum', (-73.9740, 40.7813), None), ('the Met', (-73.9632, 40.7794), None),
    ('the Guggenheim', (-73.9590, 40.7830), None), ("Bloomingdale's", (-73.9675, 40.7620), None),
    ("Zabar's", (-73.9800, 40.7850), None), ('Mount Sinai Hospital', (-73.9529, 40.7900), None),
    ('Columbia University', (-73.9626, 40.8075), None), ('the Apollo Theater', (-73.9500, 40.8100), None),
    ('the George Washington Bridge (Manhattan end)', (-73.9465, 40.8507), None), ('the Cloisters', (-73.9319, 40.8649), None),
]
# ---- intersections: the pieces of one real corner become one ------------------------------
# The centerline draws a divided road (Park Ave, Broadway, Bowery, West St) as
# two roadbeds, so a cross street meets it twice a few metres apart, and many
# corners have short connector pieces and kinks. A driver sees one corner. Ends
# joined by a short piece are merged: under MERGE_M, or under MEDIAN_M when the
# piece just crosses between two roadbeds of the same road; a merged corner
# never grows wider than SPAN_M.
MERGE_M, MEDIAN_M, SPAN_M = 26, 34, 50
kept_ix = [i for i, e in enumerate(edges) if e[0] in keep and e[1] in keep]
names_at = defaultdict(set)
for i in kept_ix:
    a, b, nid, *_r = edges[i]
    names_at[a].add(nid); names_at[b].add(nid)
parent = {u: u for u in keep}
members = {u: [u] for u in keep}
def find(u):
    while parent[u] != u:
        parent[u] = parent[parent[u]]
        u = parent[u]
    return u
def median_crossing(i):
    a, b, nid, *_r = edges[i]
    return bool((names_at[a] & names_at[b]) - {nid})
cand = sorted((edges[i][5], i) for i in kept_ix if edges[i][5] < MERGE_M or (edges[i][5] < MEDIAN_M and median_crossing(i)))
for _L, i in cand:
    a, b = find(edges[i][0]), find(edges[i][1])
    if a == b:
        continue
    ms = members[a] + members[b]
    if max(metres(nodes[p], nodes[q]) for p in ms for q in ms) > SPAN_M:
        continue
    if len(members[a]) < len(members[b]):
        a, b = b, a
    parent[b] = a
    members[a] = ms
    del members[b]
cl = {u: find(u) for u in keep}
centroid = {c: (sum(nodes[u][0] for u in ms) / len(ms), sum(nodes[u][1] for u in ms) / len(ms)) for c, ms in members.items()}

# directed raw pieces
draw = []  # (from, to, edge index, pts)
out_raw = defaultdict(list)
for i in kept_ix:
    a, b, nid, d, pts, L, rawname, *_rw = edges[i]
    if d >= 0:
        out_raw[a].append(len(draw)); draw.append((a, b, i, pts))
    if d <= 0:
        out_raw[b].append(len(draw)); draw.append((b, a, i, pts[::-1]))
ext = defaultdict(list)  # cluster -> raw edges leaving it (undirected)
for i in kept_ix:
    a, b = edges[i][0], edges[i][1]
    if cl[a] != cl[b]:
        ext[cl[a]].append(i); ext[cl[b]].append(i)
_reach = {}
def reach_in(w):
    """raw nodes reachable from w without leaving its corner"""
    if w in _reach:
        return _reach[w]
    c, seen, stack = cl[w], {w}, [w]
    while stack:
        u = stack.pop()
        for k in out_raw[u]:
            v = draw[k][1]
            if cl[v] == c and v not in seen:
                seen.add(v); stack.append(v)
    _reach[w] = seen
    return seen
def exits(k_in):
    """directed raw pieces that leave the corner reached by piece k_in (no turning back on it)"""
    w, i_in = draw[k_in][1], draw[k_in][2]
    c = cl[w]
    return [k for x in reach_in(w) for k in out_raw[x] if cl[draw[k][1]] != c and draw[k][2] != i_in]

# A corner where only two roads meet and each way through has exactly one way on
# is just a bend: links run through it.
def through(c):
    if len(ext[c]) != 2:
        return False
    ins = [k for u in members[c] for k in out_raw_in[u] if cl[draw[k][0]] != c]
    return all(len(exits(k)) == 1 for k in ins)
out_raw_in = defaultdict(list)
for k, (a, b, i, pts) in enumerate(draw):
    out_raw_in[b].append(k)
src_c = {cl[u] for u in sources}  # where a tunnel or bridge lane comes in: always a corner of its own
junction = {c for c in members if c in src_c or not through(c)}

def bearing_pts(p, fwd=True, span=30):
    """direction over the first (or last) ~span metres"""
    q = p if fwd else p[::-1]
    acc, i = 0, 1
    while i < len(q) - 1 and acc + metres(q[i - 1], q[i]) < span:
        acc += metres(q[i - 1], q[i]); i += 1
    a, b = (q[0], q[i]) if fwd else (q[i], q[0])
    kx = math.cos(math.radians((a[1] + b[1]) / 2))
    return math.degrees(math.atan2((b[0] - a[0]) * kx, b[1] - a[1])) % 360
def adiff(to, frm):
    return (to - frm + 540) % 360 - 180

# links: corner to corner, through bends
links = []  # dict(from, to, pts, raws, name, start, end)
for c in junction:
    for u in members[c]:
        for k in out_raw[u]:
            if cl[draw[k][1]] == c:
                continue
            # the road itself, end to end (no detour to the corners' centre points: a
            # merged corner's centre can sit off the road); the game crosses each
            # corner straight from where one road ends to where the next begins
            pts = list(draw[k][3])
            road = list(draw[k][3])  # the road itself, without the corners' centre points
            raws, length_by = [k], Counter()
            cur, ok, seen = k, True, {c}
            while True:
                a, b, i, p = draw[cur]
                length_by[edges[i][2]] += edges[i][5]
                d = cl[b]
                if d in junction:
                    break
                if d in seen:
                    ok = False; break
                seen.add(d)
                nx = exits(cur)
                if len(nx) != 1:
                    ok = False; break
                cur = nx[0]
                raws.append(cur)
                pts += list(draw[cur][3])
                road += list(draw[cur][3])
            if not ok:
                continue
            end = cl[draw[cur][1]]
            clean = [pts[0]]
            for q in pts[1:]:
                if metres(q, clean[-1]) > 0.5:
                    clean.append(q)
            if len(clean) < 2:
                continue
            links.append({'from': c, 'to': end, 'pts': clean, 'road': road, 'raws': raws, 'name': length_by.most_common(1)[0][0],
                          'start': draw[k][0], 'end': draw[cur][1],
                          'len': sum(metres(clean[j], clean[j + 1]) for j in range(len(clean) - 1))})
# directions measured on the road where it leaves / reaches the corner (a merged
# corner's centre can sit off to one side and would skew them)
for L in links:
    L['b0'] = bearing_pts(L['road'], True)
    L['b1'] = bearing_pts(L['road'], False)
links_from = defaultdict(list)
for li, L in enumerate(links):
    links_from[L['from']].append(li)
UTURN = 155
turns = []
for li, L in enumerate(links):
    w, last_raw = L['end'], draw[L['raws'][-1]][2]
    ok = []
    for lo in links_from[L['to']]:
        O = links[lo]
        if O['start'] not in reach_in(w) or draw[O['raws'][0]][2] == last_raw:
            continue
        if abs(adiff(O['b0'], L['b1'])) > UTURN:
            continue  # a U-turn (across a median, or back the way you came)
        ok.append(lo)
    if AREA:
        # the same road twice the same way out of a corner (a service lane beside the
        # avenue, a duplicated roadbed in the city's data): one button, the plain block
        one = []
        for lo in sorted(ok, key=lambda x: links[x]['len']):
            O = links[lo]
            if any(links[x]['name'] == O['name'] and abs(adiff(links[x]['b0'], O['b0'])) < 15 for x in one):
                continue
            one.append(lo)
        ok = one
    turns.append(ok)

turns_full = turns
if DOWNTOWN:
    NOT_STREET = re.compile(r'FDR|ROOSEVELT|TUNNEL|TUNL|UNDERPASS|\bBRG\b|BRIDGE (?!ST$)|BRIDGE$|\bEN\b|\bET\b|\bEX\b|ENTRANCE|EXIT|\bRP\b|RAMP|EXPWY|EXPY|VIADUCT|\bEP\b')
    # the area's edge streets themselves are in (14th St for both; 59th St for Midtown)
    # (Midtown takes in 60th St: the Queensboro Bridge lets you out there)
    Y_LO, Y_HI = (-1e9, areas['14'] + 40) if AREA == 'downtown' else (areas['14'] - 40, areas['59'] + 110)
    def below14(c):  # in the area
        return Y_LO <= grid_xy(*centroid[c])[1] <= Y_HI
    street_l = {li for li, L in enumerate(links)
                if below14(L['from']) and below14(L['to'])
                and not any(NOT_STREET.search(edges[draw[k][2]][6]) or edges[draw[k][2]][7] == '4' for k in L['raws'])}
    turns = [[lo for lo in t if lo in street_l] if li in street_l else [] for li, t in enumerate(turns)]

# keep the link states from which every other can be reached, plus those that lead into them
def scc(n, adj):
    radj = [[] for _ in range(n)]
    for u in range(n):
        for v in adj[u]:
            radj[v].append(u)
    order, seen = [], [False] * n
    for s in range(n):
        if seen[s]:
            continue
        stack = [(s, 0)]; seen[s] = True
        while stack:
            u, i = stack[-1]
            if i < len(adj[u]):
                stack[-1] = (u, i + 1); v = adj[u][i]
                if not seen[v]:
                    seen[v] = True; stack.append((v, 0))
            else:
                order.append(u); stack.pop()
    comp, c = [-1] * n, 0
    for s in reversed(order):
        if comp[s] != -1:
            continue
        stack = [s]; comp[s] = c
        while stack:
            u = stack.pop()
            for v in radj[u]:
                if comp[v] == -1:
                    comp[v] = c; stack.append(v)
        c += 1
    return comp, radj
comp, radj = scc(len(links), turns)
bigc = Counter(comp).most_common(1)[0][0]
core_l = {i for i in range(len(links)) if comp[i] == bigc}
feed_l = set()
stack = list(core_l)
while stack:
    u = stack.pop()
    for v in radj[u]:
        if v not in core_l and v not in feed_l:
            feed_l.add(v); stack.append(v)
keep_l = core_l | feed_l

# ---- every way out of a corner gets a button ------------------------------------------------
# Simple corner: the ways out fit Left / Straight / Right one each, clearly apart.
# Otherwise (five-way junctions, forks, angled streets) each way out is its own
# named button with an arrow at its real angle; 'N' marks the way that carries
# on along the same road, taken if you don't choose.
SLOT = {'L': 1, 'S': 2, 'R': 3, 'n': 4, 'N': 5}
def classify(li, opts):
    L = links[li]
    ds = [(lo, adiff(links[lo]['b0'], L['b1'])) for lo in opts]
    if len(ds) == 1:
        lo, d = ds[0]
        return {lo: 'S' if abs(d) <= 35 else 'L' if d < 0 else 'R'}
    slots = {}
    st = [x for x in ds if abs(x[1]) <= 35]
    st.sort(key=lambda x: (links[x[0]]['name'] != L['name'], abs(x[1])))
    if st:
        slots[st[0][0]] = 'S'
    for lo, d in ds:
        if lo in slots:
            continue
        s = 'L' if d < 0 else 'R'
        if s in slots.values():
            slots = None; break
        slots[lo] = s
    if slots is not None:
        angs = sorted(d for _, d in ds)
        # Left / Right only for real turns (55-125 degrees): a shallow fork or a hairpin
        # on the Left button surprises you, so those corners get named buttons instead
        if all(b - a >= 30 for a, b in zip(angs, angs[1:])) and all(not (s in 'LR' and not 55 <= abs(d) <= 125) for (lo, d), s in ((x, slots[x[0]]) for x in ds)):
            return slots
    # named
    same = [x for x in ds if links[x[0]]['name'] == L['name'] and abs(x[1]) <= 45]
    ahead = [x for x in ds if abs(x[1]) <= 20]
    # carries on: the same road, else the one way that's dead ahead
    dflt = min(same, key=lambda x: abs(x[1]))[0] if same else ahead[0][0] if len(ahead) == 1 else None
    return {lo: 'N' if lo == dflt else 'n' for lo, _ in ds}

kl = sorted(keep_l)
lre = {li: j for j, li in enumerate(kl)}
jl = sorted({links[li]['from'] for li in kl} | {links[li]['to'] for li in kl})
jre = {c: j for j, c in enumerate(jl)}
turn_out, stats = [], Counter()
problems = []
for li in kl:
    opts = [lo for lo in turns[li] if lo in keep_l]
    if not opts:
        problems.append(f'no way on after link {li} ({names[links[li]["name"]]})')
    sl = classify(li, opts) if opts else {}
    kind = 'only' if len(opts) == 1 else 'named' if any(s in 'nN' for s in sl.values()) else 'simple'
    stats[kind] += 1
    if kind == 'simple' and len(set(sl.values())) != len(sl):
        problems.append(f'two ways out on one button after link {li}')
    turn_out.append([x for lo in opts for x in (lre[lo], SLOT[sl[lo]])])

# ---- entries, places, check -----------------------------------------------------------------------
def landing(li):
    """the first core link on the way in from link li"""
    seen = set()
    while li not in core_l and li not in seen:
        seen.add(li)
        nx = [lo for lo in turns[li] if lo in keep_l]
        if not nx:
            return None
        li = nx[0]
    return li if li in core_l else None
entries_out = []
def landing_straight(c):
    """downtown: follow the lane in straight on (the way traffic carries) until it's a street"""
    for li in links_from.get(c, []):
        seen, dist = set(), 0.0
        while li not in seen and dist < 2500:
            if li in core_l:
                return li
            if li not in street_l and not any(NOT_STREET.search(edges[draw[k][2]][6]) for k in links[li]['raws']):
                break  # an ordinary street outside the area: not the way in
            seen.add(li)
            nx = turns_full[li]
            if not nx:
                break
            dist += links[li]['len']
            li = min(nx, key=lambda lo, li=li: abs(adiff(links[lo]['b0'], links[li]['b1'])))
    return None
def landing_street(c):
    """downtown: from a tunnel or bridge's lane in, the first street link it puts you on,
    through ramps, tunnels and bridges only, within 2.5 km (so not round by the FDR)"""
    best = {}
    frontier = [(0.0, li) for li in links_from.get(c, [])]
    while frontier:
        frontier.sort()
        dist, li = frontier.pop(0)
        if li in core_l:
            return li
        if li in best or dist > 2500 or not any(NOT_STREET.search(edges[draw[k][2]][6]) for k in links[li]['raws']):
            continue
        best[li] = dist
        onto = [lo for lo in turns_full[li] if lo in core_l]
        if onto:  # off the ramp: the street it carries straight on to
            return min(onto, key=lambda lo: abs(adiff(links[lo]['b0'], links[li]['b1'])))
        for lo in turns_full[li]:
            frontier.append((dist + links[li]['len'], lo))
    return None
for en in (entries if DOWNTOWN else []):
    land = landing_straight(cl[en['node']])
    if land is None:
        land = landing_street(cl[en['node']])
    if land is not None and not any(e['from'] == en['from'] and e['link'] == lre[land] for e in entries_out):
        L = links[land]
        entries_out.append({'from': en['from'], 'via': names[L['name']], 'link': lre[land], 'landsAt': jre[L['from']]})
for en in ([] if DOWNTOWN else entries):
    c = cl[en['node']]
    for li in links_from.get(c, []):
        if li in keep_l:
            land = landing(li)
            if land is not None:
                entries_out.append({'from': en['from'], 'via': en['via'], 'link': lre[li], 'landsAt': jre[links[land]['from']]})
            break
core_j = {links[li]['from'] for li in core_l} & {links[li]['to'] for li in core_l}
def snap(pt):
    best = None
    for c in core_j:
        if len(ext[c]) < 3:
            continue
        d = metres(centroid[c], pt)
        if best is None or d < best[0]:
            best = (d, c)
    return best
places, place_report = [], []
for nm, pt, ramp in PLACES:
    if ramp:
        cand2 = [e for e in edges if e[6] == ramp]
        if not cand2:
            place_report.append(f'MISSING ramp {ramp}')
            continue
        e = cand2[0]
        hit = snap(nodes[e[0] if e[3] >= 0 else e[1]])
    else:
        hit = snap(pt)
    if hit and hit[0] < 150:
        places.append({'name': nm, 'node': jre[hit[1]]})
        place_report.append(f'{nm}: {hit[0]:.0f} m from the point')
    else:
        place_report.append(f'SKIPPED {nm}: nearest intersection {hit[0]:.0f} m away' if hit else f'SKIPPED {nm}')
for en in entries_out:
    if en['landsAt'] is None:
        problems.append(f"entry {en['from']} never reaches the streets")

spans = [max((metres(nodes[p], nodes[q]) for p in ms for q in ms), default=0) for c, ms in members.items() if c in jre]
short_links = sum(1 for li in kl if links[li]['len'] < 15)
if problems:
    print('\n'.join(['BUILD CHECK FAILED:'] + problems[:30]))
    sys.exit(1)

# ---- write ---------------------------------------------------------------------------
O = (-74.03, 40.68)
enc = lambda c: [round((c[0] - O[0]) * 1e5), round((c[1] - O[1]) * 1e5)]
# each road's shape once: a two-way block's two links share it (~g = the same shape reversed);
# points as differences from the one before
geoms, geo_ix, link_out = [], {}, []
for li in kl:
    L = links[li]
    key = (L['from'], L['to'], tuple(draw[k][2] for k in L['raws']))
    rkey = (L['to'], L['from'], tuple(draw[k][2] for k in reversed(L['raws'])))
    if rkey in geo_ix:
        gi = ~geo_ix[rkey]
    else:
        gi = geo_ix.setdefault(key, len(geoms))
        if gi == len(geoms):
            flat, px, py = [], 0, 0
            for q in L['pts']:
                x, y = enc(q)
                flat += [x - px, y - py]
                px, py = x, y
            geoms.append(flat)
    link_out.append([jre[L['from']], jre[L['to']], L['name'], gi, round(L['b0']), round(L['b1'])])
data = {
    'version': 2,
    'source': f"NYC street centerline (CSCL), NYC Open Data, last edited {latest[:10]}",
    'origin': list(O), 'scale': 1e5, 'gridAngle': 29,
    'names': names,
    'junctions': [v for c in jl for v in enc(centroid[c])],
    'jdeg': [len(ext[c]) for c in jl],
    'geoms': geoms,
    'links': link_out,
    'turns': turn_out,
    'feeders': sorted(lre[li] for li in feed_l),
    'entries': entries_out,
    'places': places,
    'areas': areas,
}
json.dump(data, open(out, 'w'), separators=(',', ':'))
rep = [data['source'],
       f'raw: nodes {N}, kept {len(keep)} (dead ends dropped {pruned}); pieces {len(edges)}',
       f'corners {len(jl)} (widest {max(spans):.0f} m, {sum(1 for s in spans if s > 0)} merged from pieces); links {len(kl)} (core {len(core_l & keep_l)}, way-in {len(feed_l)}); links under 15 m: {short_links}',
       f'decisions: simple (Left/Straight/Right) {stats["simple"]}, named buttons {stats["named"]}, no choice {stats["only"]}',
       'check: every link has a way on; every way out has a button; no U-turns; every corner reachable from every other',
       f'area lines (grid y, m): {areas}', '', 'ENTRIES:'] + [f"  {e['from']} via {e['via']}" for e in entries_out]
rep += ['', 'UNNAMED SOURCES (left out):'] + [f'  {u}: {sorted(set(r))[:3]}' for u, r in unnamed]
rep += ['', 'PLACES:'] + ['  ' + r for r in place_report]
open(report, 'w').write('\n'.join(rep) + '\n')
print('\n'.join(rep[:5]))
