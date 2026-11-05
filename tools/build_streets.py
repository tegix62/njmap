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
"""
import json, math, re, sys
from collections import defaultdict, Counter

src, out, report = sys.argv[1:4]
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
        edges.append([a, b, name_id(pretty(rawname)), d, pts, length, rawname])

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
feeders = reach(core, in_adj) - core  # can drive into the core, but not back: inbound tunnel/bridge lanes and the like
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
for a, b, nid, d, pts, L, rawname in edges:
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
deg = Counter()
nbrs = defaultdict(set)
for a, b, *_r in edges:
    if a in core and b in core:
        nbrs[a].add(b); nbrs[b].add(a)
def snap(pt):
    best = None
    for u in core:
        if len(nbrs[u]) < 3:
            continue
        d = metres(nodes[u], pt)
        if best is None or d < best[0]:
            best = (d, u)
    return best
places, place_report = [], []
for nm, pt, ramp in PLACES:
    if ramp:
        # the intersection where this entrance ramp starts
        cand = [e for e in edges if e[6] == ramp]
        if not cand:
            place_report.append(f'MISSING ramp {ramp}')
            continue
        e = cand[0]
        start = e[0] if e[3] >= 0 else e[1]
        hit = snap(nodes[start])
    else:
        hit = snap(pt)
    if hit and hit[0] < 150:
        places.append({'name': nm, 'node': hit[1]})
        place_report.append(f'{nm}: {hit[0]:.0f} m from the point')
    else:
        place_report.append(f'SKIPPED {nm}: nearest intersection {hit[0]:.0f} m away' if hit else f'SKIPPED {nm}')

# ---- write ---------------------------------------------------------------------------
kept_nodes = sorted(keep)
renum = {u: i for i, u in enumerate(kept_nodes)}
O = (-74.03, 40.68)
enc = lambda c: [round((c[0] - O[0]) * 1e5), round((c[1] - O[1]) * 1e5)]
node_out = [v for u in kept_nodes for v in enc(nodes[u])]
edge_out = []
for a, b, nid, d, pts, L, rawname in edges:
    if a in keep and b in keep:
        mid = [v for c in pts[1:-1] for v in enc(c)]
        edge_out.append([renum[a], renum[b], nid, d] + ([mid] if mid else []))
data = {
    'source': f"NYC street centerline (CSCL), NYC Open Data, last edited {latest[:10]}",
    'origin': list(O), 'scale': 1e5, 'gridAngle': 29,
    'names': names, 'nodes': node_out, 'edges': edge_out,
    'core': len(core), 'feeders': sorted(renum[u] for u in feeders),
    'entries': [{**e, 'node': renum[e['node']]} for e in entries],
    'places': [{**p, 'node': renum[p['node']]} for p in places],
    'areas': areas,
}
json.dump(data, open(out, 'w'), separators=(',', ':'))
rep = [data['source'], f'nodes {N}, kept {len(keep)} (core {len(core)}, feeders {len(feeders)}); edges {len(edges)}, kept {len(edge_out)}',
       f'area lines (grid y, m): {areas}', '', 'ENTRIES:'] + [f"  {e['from']} via {e['via']}" for e in entries]
rep += ['', 'UNNAMED SOURCES (left out):'] + [f'  {u}: {sorted(set(r))[:3]}' for u, r in unnamed]
rep += ['', 'PLACES:'] + ['  ' + r for r in place_report]
open(report, 'w').write('\n'.join(rep) + '\n')
print('\n'.join(rep[:3]))
