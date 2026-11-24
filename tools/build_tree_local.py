#!/usr/bin/env python3
"""Trees near you: where in New Jersey each tree has been seen (a grid of counts), and a bigger pool of photos per tree, by season.

Stage 1 (grid):  python3 tools/build_tree_local.py grid    every research-grade iNaturalist observation of each tree in New Jersey (place 51),
                                                           counted on a 0.05-degree grid (about 4 x 5.5 km), into data/treegrid.json. The app
                                                           ranks "trees near you" from it on the device: your spot never leaves it.
Stage 4 (winter): python3 tools/build_tree_local.py winter [slug ...] up to 40 more winter photos per tree into data/treepool.json (no live leaves, or December
                                                           to March): bark, buds, shape and what hangs on through winter.
Stage 5 (fall / summer): python3 tools/build_tree_local.py fall|summer   top each tree up to 40 fall photos (annotated 'coloured
                                                           leaves') or 30 summer ones ('green leaves', June to August), New Jersey first.
Stage 3 (points): python3 tools/build_tree_local.py points  each sighting's own place (open, not obscured, located to within 100 m), for tree
                                                           walks, into data/treepoints.json: per tree, coordinates in 1e-4 degree steps (about 10 m),
                                                           sorted and delta-coded. Loaded only when a walk starts.
Stage 2 (pool):  python3 tools/build_tree_local.py pool    up to 80 openly licensed photos per tree from the cached New Jersey observations
                                                           (/tmp/trees/<slug>.json, from build_trees.py fetch, most-faved first), each tagged with a
                                                           season from the observation's annotations (coloured leaves: fall; no live leaves: winter;
                                                           flowering: spring) or else its month, into data/treepool.json. These photos are not
                                                           hand-picked: the app lets you hide a bad one.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_trees as BT

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CELL = 0.05
LON0, LAT0 = -75.6, 38.9          # south-west corner of New Jersey's box


def grid():
    out = {'cell': CELL, 'lon0': LON0, 'lat0': LAT0, 'trees': {}}
    for sci, slug in BT.TREES:
        cache = f'/tmp/trees/grid-{slug}.json'
        if os.path.exists(cache):
            cells = json.load(open(cache))
        else:
            t = BT.get('taxa', q=sci, rank='species', per_page=1)['results'][0]
            cells, last, n = {}, 0, 0
            while True:
                r = BT.get('observations', taxon_id=t['id'], place_id=BT.NJ, quality_grade='research', per_page=200, order_by='id', order='asc', id_above=last)
                res = r['results']
                if not res:
                    break
                for o in res:
                    last = o['id']
                    if o.get('obscured') or not o.get('geojson'):
                        continue
                    lon, lat = o['geojson']['coordinates']
                    k = f'{int((lon - LON0) / CELL)},{int((lat - LAT0) / CELL)}'
                    cells[k] = cells.get(k, 0) + 1; n += 1
            json.dump(cells, open(cache, 'w'))
        out['trees'][slug] = cells
        print(f'{slug:18s} {sum(cells.values()):6d} sightings in {len(cells)} cells', flush=True)
    json.dump(out, open(os.path.join(ROOT, 'data/treegrid.json'), 'w'), separators=(',', ':'))


SEASON_OF_MONTH = {12: 'winter', 1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer', 9: 'fall', 10: 'fall', 11: 'fall'}


def pool():
    # only trees not yet in the file (a new wave); everything already there, with its later top-ups and bark picks, is kept
    path = os.path.join(ROOT, 'data/treepool.json')
    old = json.load(open(path)) if os.path.exists(path) else {'trees': {}}
    out = old['trees']
    for sci, slug in BT.TREES:
        if slug in out:
            continue
        rec = json.load(open(f'/tmp/trees/{slug}.json'))
        ps = []
        for o in rec['obs']:
            ann = {tuple(a) for a in o.get('ann', [])}
            if (36, 39) in ann: season = 'fall'
            elif (36, 40) in ann: season = 'winter'
            elif (12, 13) in ann: season = 'spring'
            elif o.get('date'): season = SEASON_OF_MONTH[int(o['date'][5:7])]
            else: season = ''
            for p in o['photos']:
                # https://inaturalist-open-data.s3.amazonaws.com/photos/<id>/square.<ext> -> "<id>.<ext>"
                u = p['url']
                if 'inaturalist-open-data' not in u:
                    continue
                pid, ext = u.split('/photos/')[1].split('/')[0], u.rsplit('.', 1)[1]
                credit = p['attr'].replace('(c) ', '© ').replace(', some rights reserved', '').replace(' (CC', ' · CC').split(', uploaded')[0].rstrip(')')
                ps.append([f'{pid}.{ext}', season, credit])
                if len(ps) >= 80:
                    break
            if len(ps) >= 80:
                break
        out[slug] = ps
        print(f'{slug:18s} {len(ps)} photos', {s: sum(1 for p in ps if p[1] == s) for s in ('spring', 'summer', 'fall', 'winter')}, flush=True)
    json.dump({**old, 'base': 'https://inaturalist-open-data.s3.amazonaws.com/photos/', 'size': 'medium', 'trees': out}, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))


def points():
    out = {'scale': 1e4, 'trees': {}}
    for sci, slug in BT.TREES:
        cache = f'/tmp/trees/points-{slug}.json'
        if os.path.exists(cache):
            pts = json.load(open(cache))
        else:
            t = BT.get('taxa', q=sci, rank='species', per_page=1)['results'][0]
            pts, last = [], 0
            while True:
                r = BT.get('observations', taxon_id=t['id'], place_id=BT.NJ, quality_grade='research', per_page=200, order_by='id', order='asc', id_above=last)
                res = r['results']
                if not res:
                    break
                for o in res:
                    last = o['id']
                    acc = o.get('positional_accuracy')
                    if o.get('obscured') or not o.get('geojson') or (acc is not None and acc > 100):
                        continue
                    lon, lat = o['geojson']['coordinates']
                    pts.append([round(lon * 1e4), round(lat * 1e4)])
            json.dump(pts, open(cache, 'w'))
        pts = sorted(set(map(tuple, pts)))
        flat, px, py = [], 0, 0
        for x, y in pts:
            flat += [x - px, y - py]; px, py = x, y
        out['trees'][slug] = flat
        print(f'{slug:18s} {len(pts):6d} places', flush=True)
    json.dump(out, open(os.path.join(ROOT, 'data/treepoints.json'), 'w'), separators=(',', ':'))


TOPUP = {      # season: (photos per tree to reach, the searches in order: annotation 36 'Leaves' = 39 coloured, 38 green, 40 none)
    'fall': (40, [{'term_id': 36, 'term_value_id': 39, 'place_id': BT.NJ}, {'term_id': 36, 'term_value_id': 39, 'place_id': 46}, {'term_id': 36, 'term_value_id': 39}]),
    'summer': (30, [{'term_id': 36, 'term_value_id': 38, 'month': '6,7,8', 'place_id': BT.NJ}, {'term_id': 36, 'term_value_id': 38, 'month': '6,7,8'}, {'month': '6,7,8', 'place_id': BT.NJ}]),
}


def topup(season):
    """More photos of one season per tree, until each tree has TOPUP[season][0] of them, added to data/treepool.json. Searches by
    annotation (most-faved first), New Jersey first, then the Northeast (place 46 is the US; evergreens show no 'coloured leaves')."""
    want, qs = TOPUP[season]
    path = os.path.join(ROOT, 'data/treepool.json'); P = json.load(open(path))
    for sci, slug in BT.TREES:
        have = {p[0].split('.')[0] for p in P['trees'][slug]}
        n = sum(1 for p in P['trees'][slug] if p[1] == season)
        if n >= want:
            continue
        t = BT.get('taxa', q=sci, rank='species', per_page=1)['results'][0]
        add = []
        for q in qs:
            if n + len(add) >= want:
                break
            r = BT.get('observations', taxon_id=t['id'], quality_grade='research', photos='true', photo_license=BT.OK_LICENSES, order_by='votes', per_page=100, **q)
            for o in r['results']:
                for ph in o['photos']:
                    u = ph['url']
                    if 'inaturalist-open-data' not in u or not ph.get('license_code'):
                        continue
                    pid, ext = u.split('/photos/')[1].split('/')[0], u.rsplit('.', 1)[1]
                    if pid in have:
                        break
                    have.add(pid)
                    credit = ph['attribution'].replace('(c) ', '© ').replace(', some rights reserved', '').replace(' (CC', ' · CC').split(', uploaded')[0].rstrip(')')
                    add.append([f'{pid}.{ext}', season, credit])
                    break
                if n + len(add) >= want:
                    break
        P['trees'][slug] += add
        print(f'{slug:18s} +{len(add)} {season} photos ({n + len(add)} in all)', flush=True)
    json.dump(P, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))


def winter():
    """Up to 40 more winter photos per tree, added to data/treepool.json: observations annotated 'no live leaves', or (evergreens, and to
    top up) observed December to March; New Jersey first, then anywhere."""
    path = os.path.join(ROOT, 'data/treepool.json'); P = json.load(open(path))
    only = sys.argv[2:]      # only these trees (a new wave): running it again for the others would add 40 more each time
    for sci, slug in BT.TREES:
        if only and slug not in only:
            continue
        have = {p[0].split('.')[0] for p in P['trees'][slug]}
        t = BT.get('taxa', q=sci, rank='species', per_page=1)['results'][0]
        add = []
        for q in ({'term_id': 36, 'term_value_id': 40, 'place_id': BT.NJ}, {'term_id': 36, 'term_value_id': 40}, {'month': '12,1,2,3', 'place_id': BT.NJ}, {'month': '12,1,2,3'}):
            if len(add) >= 40:
                break
            r = BT.get('observations', taxon_id=t['id'], quality_grade='research', photos='true', photo_license=BT.OK_LICENSES, order_by='votes', per_page=100, **q)
            for o in r['results']:
                for p in o['photos']:
                    u = p['url']
                    if 'inaturalist-open-data' not in u or not p.get('license_code'):
                        continue
                    pid, ext = u.split('/photos/')[1].split('/')[0], u.rsplit('.', 1)[1]
                    if pid in have:
                        continue
                    have.add(pid)
                    credit = p['attribution'].replace('(c) ', '© ').replace(', some rights reserved', '').replace(' (CC', ' · CC').split(', uploaded')[0].rstrip(')')
                    add.append([f'{pid}.{ext}', 'winter', credit])
                    break          # one photo per observation: more different trees
                if len(add) >= 40:
                    break
        P['trees'][slug] += add
        print(f'{slug:18s} +{len(add)} winter photos ({sum(1 for p in P["trees"][slug] if p[1] == "winter")} in all)', flush=True)
    json.dump(P, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    a = sys.argv[1]
    if a in TOPUP: topup(a)
    else: {'grid': grid, 'pool': pool, 'points': points, 'winter': winter}[a]()
