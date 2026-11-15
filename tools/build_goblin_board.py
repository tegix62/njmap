#!/usr/bin/env python3
"""The goblin-mode board (docs/goblins/04-systems-spec.md section 3; D184 to D188).

Reads data/nj.topo.json (564 townships), data/nj-geoms.json (rivers, ridge lines, highways) and data/nj-places.json (highway meets) and writes
data/goblin-board.json: the township border graph, what lies on each border (river, ridge, highways that cross it) and the highways as ordered
fast lanes. Every geography fact is computed from the shapes, never written by hand (the lesson of H42). Deterministic: same inputs, same file.

    python3 tools/build_goblin_board.py            build, check the anchors, print the spot-check table
    python3 tools/build_goblin_board.py --no-write check and print only

Rules (D187): a border is a RIVER border when at least RIVER_FRAC of points sampled along the shared boundary lie within RIVER_TOL of a river
line (measured against the boundary itself, not by which towns a river passes through); the same for ridge lines with RIDGE_TOL. A highway is
on a border when its line passes within HWY_TOL of the border line. Exits non-zero if an anchor fact fails.
"""
import json, math, os, sys
import numpy as np
import shapely
from shapely.geometry import LineString, MultiLineString, Point, Polygon
from shapely.ops import linemerge, unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RIVER_FRAC, RIVER_TOL = 0.25, 150.0    # metres (50 m missed the Raritan at New Brunswick: wide rivers sit ~100 m off the boundary)
RIDGE_FRAC, RIDGE_TOL = 0.25, 300.0    # the ridge lines are coarse (6 to 15 points each), so a wider tolerance
HWY_TOL = 40.0
SAMPLE = 25.0                          # metres between samples along a border
HWY_SAMPLE = 100.0                     # metres between samples along a highway
LAT0, LNG0 = 40.1, -74.5
KX, KY = 111320.0 * math.cos(math.radians(LAT0)), 110540.0
MILE = 1609.344

def proj(p):
    return ((p[0] - LNG0) * KX, (p[1] - LAT0) * KY)

def load():
    topo = json.load(open(os.path.join(ROOT, 'data/nj.topo.json'), encoding='utf-8'))
    geoms = json.load(open(os.path.join(ROOT, 'data/nj-geoms.json'), encoding='utf-8'))
    places = json.load(open(os.path.join(ROOT, 'data/nj-places.json'), encoding='utf-8'))
    return topo, geoms, places

def decode_arcs(topo):
    sc, tr = topo['transform']['scale'], topo['transform']['translate']
    arcs = []
    for a in topo['arcs']:
        x = y = 0
        pts = []
        for dx, dy in a:
            x += dx; y += dy
            pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        arcs.append(pts)
    return arcs

def arc_points(arcs, i):
    return arcs[i] if i >= 0 else arcs[~i][::-1]

def ring_points(arcs, ring):
    out = []
    for i in ring:
        pts = arc_points(arcs, i)
        out.extend(pts if not out else pts[1:])
    return out

def arc_ids(g):
    s = set()
    def walk(a):
        for e in a:
            if isinstance(e, list): walk(e)
            else: s.add(e if e >= 0 else ~e)
    walk(g['arcs'])
    return s

def build_towns(topo, arcs):
    towns, polys, owner = {}, {}, {}
    for idx, g in enumerate(topo['objects']['munis']['geometries']):
        p = g['properties']
        tid = f"{p['full']}|{p['c']}"
        if tid in towns:
            raise SystemExit(f'duplicate township id {tid}')
        rings = [[ring_points(arcs, r) for r in poly] for poly in ([g['arcs']] if g['type'] == 'Polygon' else g['arcs'])]
        shapes = []
        for rs in rings:
            ex = [proj(q) for q in rs[0]]
            holes = [[proj(q) for q in h] for h in rs[1:]]
            pg = Polygon(ex, holes)
            if not pg.is_valid: pg = pg.buffer(0)
            shapes.append(pg)
        poly = unary_union(shapes)
        c = poly.representative_point()
        towns[tid] = {'name': p['n'], 'type': p['t'], 'county': p['c'], 'pop': p.get('p', 0)}
        polys[tid] = poly
        owner[idx] = tid
    return towns, polys, owner

def lines_from_geom(gm):
    if gm['type'] == 'LineString': return [LineString([proj(q) for q in gm['coordinates']])]
    if gm['type'] == 'MultiLineString': return [LineString([proj(q) for q in ln]) for ln in gm['coordinates']]
    return []

def sample_line(line, step):
    n = max(2, int(line.length // step) + 1)
    return [line.interpolate(i * line.length / (n - 1)) for i in range(n)]

def main():
    write = '--no-write' not in sys.argv
    topo, geoms, places = load()
    arcs = decode_arcs(topo)
    towns, polys, owner = build_towns(topo, arcs)
    G = topo['objects']['munis']['geometries']
    ids = [owner[i] for i in range(len(G))]

    # --- the border graph, from shared arcs (exact) ---
    by_arc = {}
    for i, g in enumerate(G):
        for a in arc_ids(g): by_arc.setdefault(a, []).append(i)
    pair_arcs = {}
    for a, os_ in by_arc.items():
        os_ = sorted(set(os_))
        for x in range(len(os_)):
            for y in range(x + 1, len(os_)):
                pair_arcs.setdefault((os_[x], os_[y]), []).append(a)
    print(f'townships {len(G)}, shared-border pairs {len(pair_arcs)}')

    # --- rivers, ridges, highways as projected lines ---
    kinds = {}
    for p in places: kinds.setdefault(p['kind'], []).append(p['n'])
    rivers = {n: lines_from_geom(geoms[n]) for n in kinds['river']}
    ridges = {n: lines_from_geom(geoms[n]) for n in kinds['mountain'] if geoms[n]['type'] == 'LineString'}
    skipped = [n for n in kinds['mountain'] if n not in ridges]
    highways = {n: lines_from_geom(geoms[n]) for n in kinds['highway']}
    print(f'rivers {len(rivers)}, ridge lines {len(ridges)} (skipped, not lines: {skipped}), highways {len(highways)}')
    river_buf = {n: prep(unary_union([ln.buffer(RIVER_TOL) for ln in lns])) for n, lns in rivers.items()}
    ridge_buf = {n: prep(unary_union([ln.buffer(RIDGE_TOL) for ln in lns])) for n, lns in ridges.items()}
    hwy_buf = {n: prep(unary_union([ln.buffer(HWY_TOL) for ln in lns])) for n, lns in highways.items()}

    borders = {}
    for (i, j), alist in sorted(pair_arcs.items()):
        lines = [LineString([proj(q) for q in arc_points(arcs, a)]) for a in alist]
        lines = [l for l in lines if l.length > 0]
        if not lines: continue
        merged = linemerge(lines) if len(lines) > 1 else lines[0]
        length = sum(l.length for l in lines)
        pts = []
        for l in lines: pts.extend(sample_line(l, SAMPLE))
        n = len(pts)
        rv = {k: sum(b.contains(pt) for pt in pts) / n for k, b in river_buf.items()}
        rg = {k: sum(b.contains(pt) for pt in pts) / n for k, b in ridge_buf.items()}
        river = max(rv, key=rv.get) if rv and max(rv.values()) >= RIVER_FRAC else None
        ridge = max(rg, key=rg.get) if rg and max(rg.values()) >= RIDGE_FRAC else None
        hw = sorted(k for k, b in hwy_buf.items() if any(b.contains(pt) for pt in pts))
        a, b = ids[i], ids[j]
        key = '~'.join(sorted([a, b]))
        borders[key] = {'mi': round(length / MILE, 2), 'river': river, 'riverFrac': round(rv[river], 2) if river else 0,
                        'ridge': ridge, 'ridgeFrac': round(rg[ridge], 2) if ridge else 0, 'highways': hw}

    # --- towns: neighbours, centroid, and the highways through each (>= 2 samples inside) ---
    nb = {t: [] for t in towns}
    for key in borders:
        a, b = key.split('~')
        nb[a].append(b); nb[b].append(a)
    tree = STRtree([polys[t] for t in ids])
    lanes = []
    through = {t: set() for t in towns}
    meets = {p['n']: p.get('meets', []) for p in places if p['kind'] == 'highway'}
    for name, lns in sorted(highways.items()):
        segments, flat = [], []
        for ln in lns:                      # each stored piece of a highway is its own ordered segment (pieces are not in route order)
            seq, counts = [], {}
            for pt in sample_line(ln, HWY_SAMPLE):
                hit = tree.query(pt, predicate='within')
                if len(hit):
                    t = ids[int(hit[0])]
                    counts[t] = counts.get(t, 0) + 1
                    if not seq or seq[-1] != t: seq.append(t)
            order, seen = [], set()
            for t in seq:
                if counts[t] >= 2 and t not in seen:
                    seen.add(t); order.append(t)
            if len(order) >= 2: segments.append(order)
            for t in order:
                through[t].add(name)
                if t not in flat: flat.append(t)
        covered, kept = set(), []            # the two carriageways of a road are stored as separate pieces: keep a segment only if it adds a link
        for sg in sorted(segments, key=len, reverse=True):
            new = {frozenset(pr) for pr in zip(sg, sg[1:])} - covered
            if new:
                kept.append(sg); covered |= new
        lanes.append({'road': name, 'segments': kept, 'towns': flat, 'meets': meets.get(name, [])})
    out_towns = {}
    for t in sorted(towns):
        c = polys[t].representative_point()
        out_towns[t] = {**towns[t], 'at': [round(c.x / KX + LNG0, 5), round(c.y / KY + LAT0, 5)], 'nb': sorted(nb[t]),
                        'highways': sorted(through[t])}
    board = {'v': 1, 'source': ['data/nj.topo.json', 'data/nj-geoms.json', 'data/nj-places.json'],
             'rules': {'riverFrac': RIVER_FRAC, 'riverTolM': RIVER_TOL, 'ridgeFrac': RIDGE_FRAC, 'ridgeTolM': RIDGE_TOL, 'highwayTolM': HWY_TOL},
             'ridgeLines': sorted(ridges), 'ridgeNotLines': skipped,
             'towns': out_towns, 'borders': dict(sorted(borders.items())), 'lanes': lanes}

    # --- summary ---
    nr = sum(1 for b in borders.values() if b['river']); ng = sum(1 for b in borders.values() if b['ridge']); nh = sum(1 for b in borders.values() if b['highways'])
    short = sum(1 for b in borders.values() if b['mi'] < 0.1)
    print(f'borders with a river {nr}, with a ridge {ng}, crossed by a highway {nh}; shorter than 0.1 mi: {short}')
    print(f'towns with no neighbours: {[t for t in towns if not nb[t]]}')
    print('lanes (towns, segments): ' + ', '.join(f"{l['road']} {len(l['towns'])},{len(l['segments'])}" for l in lanes[:8]) + ' ...')

    # --- anchors (checks that can fail) ---
    def B(a, b):
        return borders.get('~'.join(sorted([a, b])))
    P, T, H, C, HAW = 'Paterson City|Passaic', 'Totowa Borough|Passaic', 'Hawthorne Borough|Passaic', 'Clifton City|Passaic', 'Haledon Borough|Passaic'
    fails = []
    def need(cond, msg):
        if not cond: fails.append(msg)
    need(B(P, T) is not None and B(P, T)['river'] is None, 'Paterson-Totowa is a land border (the Passaic crosses it, it does not run along it; measured 2026-11-15)')
    need(B('New Brunswick City|Middlesex', 'Highland Park Borough|Middlesex') and B('New Brunswick City|Middlesex', 'Highland Park Borough|Middlesex')['river'] == 'Raritan River', 'New Brunswick-Highland Park should be a Raritan border')
    need(B('Newark City|Essex', 'Harrison Town|Hudson') and B('Newark City|Essex', 'Harrison Town|Hudson')['river'] == 'Passaic River', 'Newark-Harrison should be a Passaic border')
    need(B('Garfield City|Bergen', 'Passaic City|Passaic') and B('Garfield City|Bergen', 'Passaic City|Passaic')['river'] == 'Passaic River', 'Garfield-Passaic City should be a Passaic border')
    need(B(P, H) and B(P, H)['river'] == 'Passaic River', 'Paterson-Hawthorne should be a Passaic border')
    need(B(P, HAW) is not None and B(P, HAW)['river'] is None, 'Paterson-Haledon should be a land border')
    need(B(HAW, T) is not None and B(HAW, T)['river'] is None, 'Haledon-Totowa should be a land border')
    need(B(C, T) is None, 'Clifton and Totowa should not be neighbours')
    need(B(P, C) is not None, 'Paterson and Clifton should be neighbours')
    need(len(towns) == 564, f'expected 564 townships, got {len(towns)}')
    need(len(pair_arcs) == 1445, f'expected 1445 border pairs, got {len(pair_arcs)}')

    # --- the table a human checks against a map ---
    spot = [(P, T), (P, H), (P, HAW), (HAW, T), (P, C), ('Newark City|Essex', 'Harrison Town|Hudson'), ('Newark City|Essex', 'East Orange City|Essex'),
            ('New Brunswick City|Middlesex', 'Highland Park Borough|Middlesex'), ('Garfield City|Bergen', 'Passaic City|Passaic'),
            ('Fair Lawn Borough|Bergen', 'Elmwood Park Borough|Bergen'), ('Summit City|Union', 'Millburn Township|Essex'),
            ('Jersey City|Hudson', 'Hoboken City|Hudson')]
    print('\nSPOT-CHECK (compare with a map):')
    print(f"{'border':<62} {'mi':>5}  {'river':<22} {'ridge':<18} highways crossing it")
    for a, b in spot:
        r = B(a, b)
        label = f"{a.split('|')[0]} / {b.split('|')[0]}"
        if r is None:
            print(f'{label:<62} {"-":>5}  (not neighbours)' if a in towns and b in towns else f'{label:<62}  (id not found)')
            continue
        rv = f"{r['river']} {int(r['riverFrac']*100)}%" if r['river'] else '-'
        rg = f"{r['ridge']} {int(r['ridgeFrac']*100)}%" if r['ridge'] else '-'
        print(f"{label:<62} {r['mi']:>5}  {rv:<22} {rg:<18} {', '.join(r['highways']) or '-'}")
    if fails:
        print('\nFAILED ANCHORS:'); [print(' -', f) for f in fails]
        sys.exit(1)
    print('\nridge borders (judge by eye; only 8 ridge lines exist, the Watchungs are not among them):')
    for k, b in borders.items():
        if b['ridge']: print(f"  {k.replace('|', ', ')}  {b['ridge']} {int(b['ridgeFrac']*100)}%")
    print('\nanchors: all hold')
    if write:
        path = os.path.join(ROOT, 'data/goblin-board.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(board, f, ensure_ascii=False, separators=(',', ':'), sort_keys=False)
        print(f'wrote data/goblin-board.json ({os.path.getsize(path) // 1024} KB)')

if __name__ == '__main__':
    main()
