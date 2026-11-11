#!/usr/bin/env python3
"""Rank a Manhattan map's streets by how much routes use them, and write the top ones into its data file as `tiers`.

Tier 1 = the spine: the streets that together carry the first half of all route use.
Tier 2 = the connectors: the next streets, up to 80%.
Everything else is tier 3 (local streets: not written, the game treats a missing street as tier 3).

How: take thousands of random trips between corners of the driving network (the data's own legal turns and one-ways,
no U-turns), find the shortest route for each, and count, per street, in how many of those routes it appears. A street
that appears in many routes is one you'll actually be on; a street named after someone that serves four blocks is not.
The keys are the street names as the game shows them (E 4th St and W 4th St are both "4th St").

Usage: python3 -I tools/build_tiers.py data/downtown-streets.json [--report docs/street-tiers-downtown.md] [--focus-below 14]
--focus-below N: only trips that start and end below the grid line of N-th St are sampled (the map reaches past it so routes can
wander out, but the tiers are about the streets you train on); routes may still use anything in the map.
It rewrites the data file (adding/replacing the "tiers" key) and writes the report.
"""
import collections, heapq, json, random, re, sys

NUMBERED = re.compile(r'^[EW] (\d+\w\w) St$')
RAMP = re.compile(r'entrance|exit|\bramp|\bRp\b|Bridge|Tunnel|Expwy|\bEp\b|\bEn\b|\bEt\b', re.I)
TIER1_SHARE, TIER2_SHARE = 0.50, 0.80
# Route use alone gets a few things wrong, so three plain rules on top of it:
# - the big streets everyone needs (the bridge and tunnel approaches, the main crosstown streets) are at least tier 1;
# - every numbered avenue and lettered avenue is at least tier 2;
# - a street with under 250 m of road in the whole map can't be one worth learning, however handy a shortcut it is in
#   the model (Theater Alley, Wanamaker Pl), unless it's listed as a landmark junction.
FLOOR1 = {'Canal St', 'E Houston St', 'W Houston St', 'Delancey St', 'Chambers St', 'Centre St', 'Bowery', 'Broadway', 'Park Row',
          'West St (West Side Hwy)', '6th Ave', 'Church St', 'Lafayette St', 'Varick St', 'Hudson St', 'Greenwich St', 'Water St', 'South St'}
FLOOR2_RE = re.compile(r'^(\d+(st|nd|rd|th) Ave( S)?|Ave [A-D])$')
CAP_M, KEEP_SHORT = 250, {'Chatham Sq', 'Washington Sq S', 'Park Row', 'Trinity Pl'}
SOURCES, TARGETS, MIN_M = 400, 120, 400

def short(name):
    return NUMBERED.sub(r'\1 St', name)

def main():
    path = sys.argv[1]
    report = sys.argv[sys.argv.index('--report') + 1] if '--report' in sys.argv else None
    d = json.load(open(path))
    names, links, geoms, sc = d['names'], d['links'], d['geoms'], d['scale']
    feeders = set(d.get('feeders', []))

    def glen(gi):
        flat = geoms[gi if gi >= 0 else ~gi]  # (delta-encoded x, y pairs in 1/scale degrees; a negative id is the same road reversed)
        x = y = 0
        pts = []
        for i in range(0, len(flat), 2):
            x += flat[i]
            y += flat[i + 1]
            pts.append((x, y))
        return sum((((b[0] - a[0]) * 0.7585) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 for a, b in zip(pts, pts[1:])) / sc * 111000

    length = [glen(l[3]) for l in links]
    succ = [[t[j] for j in range(0, len(t), 2)] for t in d['turns']]
    core = [i for i in range(len(links)) if i not in feeders and not RAMP.search(names[links[i][2]])]
    coreset = set(core)
    key = [short(names[l[2]]) for l in links]
    if '--focus-below' in sys.argv:
        import math
        line = d['areas'][sys.argv[sys.argv.index('--focus-below') + 1]]
        ox, oy = d['origin']
        ang = math.radians(d['gridAngle'])
        J = d['junctions']
        def gy(j):
            x, y = (ox + J[2 * j] / sc + 73.97) * 111320 * math.cos(math.radians(40.78)), (oy + J[2 * j + 1] / sc - 40.78) * 110540
            return x * math.sin(ang) + y * math.cos(ang)
        focus = [i for i in core if gy(links[i][0]) <= line]
        print(f'{len(focus)} of {len(core)} street links are in the focus part')
    else:
        focus = core
    random.seed(7)
    uses = collections.Counter()
    trips = 0
    for s in random.sample(focus, min(SOURCES, len(focus))):
        dist = {s: length[s]}
        prev = {}
        h = [(length[s], s)]
        while h:
            c, u = heapq.heappop(h)
            if c > dist[u]:
                continue
            for v in succ[u]:
                if v not in coreset:
                    continue
                nc = c + length[v]
                if nc < dist.get(v, 1e18):
                    dist[v] = nc
                    prev[v] = u
                    heapq.heappush(h, (nc, v))
        for t in random.sample(focus, min(TARGETS, len(focus))):
            if t == s or t not in dist or dist[t] < MIN_M:
                continue
            trips += 1
            seen, u = set(), t
            while True:
                seen.add(key[u])
                if u == s:
                    break
                u = prev[u]
            for k in seen:
                uses[k] += 1
    total = sum(uses.values())
    street_m = collections.Counter()
    for i in range(len(links)):
        street_m[key[i]] += length[i]
    tiers, cum, rows = {}, 0, []
    for k, c in uses.most_common():
        share_before = cum / total
        cum += c
        tier = 1 if share_before < TIER1_SHARE else 2 if share_before < TIER2_SHARE else 3
        if tier > 1 and k in FLOOR1:
            tier = 1
        elif tier > 2 and FLOOR2_RE.match(k):
            tier = 2
        if tier < 3 and street_m[k] < CAP_M and k not in KEEP_SHORT and k not in FLOOR1:
            tier = 3
        if tier < 3:
            tiers[k] = tier
        rows.append((k, c, tier))
    for k in FLOOR1:  # (a floor street no trip used at all)
        if k not in uses and k in street_m:
            tiers[k] = 1
    for k in street_m:
        if FLOOR2_RE.match(k) and k not in tiers:
            tiers[k] = 2
    cover = {}
    run = 0
    for n, (k, c) in enumerate(uses.most_common(), 1):
        run += c
        for q in (0.5, 0.8, 0.9):
            if run / total >= q and q not in cover:
                cover[q] = n
    print('by route use alone, streets covering 50% / 80% / 90% of route-street uses:', cover[0.5], cover[0.8], cover[0.9])
    d['tiers'] = tiers
    json.dump(d, open(path, 'w'), separators=(',', ':'))
    n1, n2 = sum(1 for v in tiers.values() if v == 1), sum(1 for v in tiers.values() if v == 2)
    print(f'{trips} trips, {len(uses)} streets used: tier 1 = {n1}, tier 2 = {n2}, the other {len(uses) - n1 - n2} are tier 3 (plus streets no trip used)')
    if report:
        with open(report, 'w') as f:
            f.write(f'# Street tiers ({path})\n\nFrom {trips} random shortest routes between corners. Tier 1 carries the first {int(TIER1_SHARE * 100)}% of route-street uses, tier 2 up to {int(TIER2_SHARE * 100)}%. Number = routes using the street.\n\n')
            for t, label in ((1, 'Tier 1: the spine'), (2, 'Tier 2: connectors')):
                f.write(f'## {label}\n\n' + ', '.join(f'{k} ({c})' for k, c, tr in rows if tr == t) + '\n\n')
            f.write('## Tier 3 (most-used first, first 60)\n\n' + ', '.join(f'{k} ({c})' for k, c, tr in rows if tr == 3)[:3000] + '\n')

if __name__ == '__main__':
    main()
