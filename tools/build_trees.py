#!/usr/bin/env python3
"""Trees of New Jersey: data/trees.json and img/trees/*.jpg, from iNaturalist (research-grade observations in New Jersey, place 51).

Stage 1 (fetch):   python3 tools/build_trees.py fetch     observations with openly licensed photos, into /tmp/trees/<slug>.json, and small
                                                          candidate thumbnails into /tmp/trees/cand/, for the contact sheets
Stage 2 (sheets):  python3 tools/build_trees.py sheets    one numbered contact sheet per tree (/tmp/trees/sheet-<slug>.jpg) to pick photos from by eye
Stage 3 (build):   python3 tools/build_trees.py build     the photos chosen in PICKS (tools/tree_picks.json: slug -> [[candidate number, context], ...]),
                                                          downloaded at medium size, with credits; where each tree was seen (points and by county)

The list of trees and the one-line "tell" for each are mine (from general knowledge: check them against a field guide); names, photos, credits,
counts and locations are iNaturalist's. Photos keep their licence and credit (shown under each photo in the app).
"""
import json, math, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = '/tmp/trees'
UA = 'nj-townfinder-trees/1.0 (personal study app)'
API = 'https://api.inaturalist.org/v1/'
NJ = 51
OK_LICENSES = 'cc0,cc-by,cc-by-nc,cc-by-sa,cc-by-nc-sa'
# scientific name -> slug. Order: the ones you meet first in north-east New Jersey.
TREES = [
    ('Acer rubrum', 'red-maple'), ('Acer saccharum', 'sugar-maple'), ('Acer platanoides', 'norway-maple'),
    ('Quercus alba', 'white-oak'), ('Quercus rubra', 'red-oak'), ('Quercus palustris', 'pin-oak'),
    ('Liriodendron tulipifera', 'tulip-tree'), ('Liquidambar styraciflua', 'sweetgum'), ('Platanus occidentalis', 'sycamore'),
    ('Fagus grandifolia', 'beech'), ('Sassafras albidum', 'sassafras'), ('Prunus serotina', 'black-cherry'),
    ('Pinus strobus', 'white-pine'), ('Pinus rigida', 'pitch-pine'), ('Juniperus virginiana', 'red-cedar'),
    ('Cornus florida', 'dogwood'), ('Betula populifolia', 'gray-birch'), ('Robinia pseudoacacia', 'black-locust'),
    ('Ailanthus altissima', 'tree-of-heaven'), ('Ilex opaca', 'holly'), ('Chamaecyparis thyoides', 'white-cedar'),
    ('Tsuga canadensis', 'hemlock'), ('Carya ovata', 'shagbark-hickory'), ('Juglans nigra', 'black-walnut'),
]


def get(path, **q):
    url = API + path + '?' + urllib.parse.urlencode(q)
    for k in range(5):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60)
            time.sleep(1.1)
            return json.loads(r.read())
        except Exception as e:
            time.sleep(5 + 5 * k)
    raise SystemExit('failed ' + url)


def fetch():
    os.makedirs(TMP + '/cand', exist_ok=True)
    for sci, slug in TREES:
        out = f'{TMP}/{slug}.json'
        if os.path.exists(out):
            continue
        t = get('taxa', q=sci, rank='species', per_page=1)['results'][0]
        obs = []
        # the most-faved first (the clearest photos tend to be), two pages
        for page in (1, 2):
            r = get('observations', taxon_id=t['id'], place_id=NJ, quality_grade='research', photos='true', photo_license=OK_LICENSES,
                    order_by='votes', per_page=100, page=page)
            obs += r['results']
            total = r['total_results']
            if len(obs) >= total:
                break
        rec = {'sci': sci, 'slug': slug, 'taxon': t['id'], 'common': t.get('preferred_common_name'), 'count': total, 'wiki': t.get('wikipedia_url'), 'obs': []}
        for o in obs:
            if not o.get('geojson') or o.get('obscured'):
                loc = None
            else:
                loc = o['geojson']['coordinates']
            rec['obs'].append({'id': o['id'], 'loc': loc, 'date': o.get('observed_on'), 'place': o.get('place_guess'),
                               'ann': [(a['controlled_attribute_id'], a['controlled_value_id']) for a in o.get('annotations', [])],
                               'photos': [{'id': p['id'], 'url': p['url'], 'lic': p['license_code'], 'attr': p['attribution']} for p in o['photos'] if p.get('license_code')]})
        json.dump(rec, open(out, 'w'))
        print(f"{slug:18s} {rec['common']:28s} {total:6d} research-grade in NJ, {len(rec['obs'])} fetched", flush=True)


def candidates(rec, n=48):
    """The first photo of each of the top observations, then second photos, up to n: (number, photo)."""
    firsts = [o['photos'][0] for o in rec['obs'] if o['photos']]
    seconds = [p for o in rec['obs'] for p in o['photos'][1:3]]
    return (firsts[:n * 2 // 3] + seconds)[:n]


def sheets():
    from PIL import Image, ImageDraw
    for sci, slug in TREES:
        rec = json.load(open(f'{TMP}/{slug}.json'))
        cs = candidates(rec)
        W = Image.new('RGB', (8 * 150, ((len(cs) + 7) // 8) * 150), 'white')
        for i, p in enumerate(cs):
            fp = f"{TMP}/cand/{p['id']}.jpg"
            if not os.path.exists(fp):
                try:
                    data = urllib.request.urlopen(urllib.request.Request(p['url'].replace('square', 'small'), headers={'User-Agent': UA}), timeout=60).read()
                    open(fp, 'wb').write(data); time.sleep(0.25)
                except Exception:
                    continue
            try:
                im = Image.open(fp).convert('RGB'); im.thumbnail((150, 150))
            except Exception:
                continue
            x, y = (i % 8) * 150, (i // 8) * 150
            W.paste(im, (x + (150 - im.width) // 2, y + (150 - im.height) // 2))
            d = ImageDraw.Draw(W); d.rectangle((x, y, x + 26, y + 15), fill='black'); d.text((x + 3, y + 2), str(i), fill='yellow')
        W.save(f'{TMP}/sheet-{slug}.jpg', quality=80)
        print('sheet', slug, len(cs), flush=True)


# What I say about each tree, from general knowledge (NOT from a source read for this build): check against a field guide. `arr` and `leaf`
# feed two-choice questions; `tell` is the line shown after every answer; `like` are the trees it is confused with (the wrong answers).
FACTS = {
    'red-maple': ('opposite', 'simple', 'Three main lobes with toothed edges and sharp V-shaped notches; twigs, buds and leaf stalks are red.', ['sugar-maple', 'norway-maple', 'sweetgum']),
    'sugar-maple': ('opposite', 'simple', 'Five lobes with smooth edges and rounded U-shaped notches: the leaf on Canada’s flag.', ['norway-maple', 'red-maple', 'sycamore']),
    'norway-maple': ('opposite', 'simple', 'Like sugar maple but wider than long; a snapped leaf stalk bleeds milky sap. A planted street tree that spreads into woods.', ['sugar-maple', 'red-maple', 'sycamore']),
    'white-oak': ('alternate', 'simple', 'Rounded, finger-like lobes with no bristle tips; pale grey bark in loose plates.', ['red-oak', 'pin-oak', 'sassafras']),
    'red-oak': ('alternate', 'simple', 'Pointed lobes ending in bristle tips; bark with long, flat, shiny stripes like ski tracks.', ['pin-oak', 'white-oak', 'black-cherry']),
    'pin-oak': ('alternate', 'simple', 'Deep U-shaped cuts nearly to the midrib, bristle-tipped; the lowest branches droop toward the ground.', ['red-oak', 'white-oak', 'sweetgum']),
    'tulip-tree': ('alternate', 'simple', 'A four-lobed leaf with a notched, cut-off tip, shaped like a tulip; a very tall, straight trunk.', ['sycamore', 'sweetgum', 'sassafras']),
    'sweetgum': ('alternate', 'simple', 'A five-pointed star of a leaf; spiky gumball seed pods on the tree and under it.', ['red-maple', 'sycamore', 'tulip-tree']),
    'sycamore': ('alternate', 'simple', 'Bark that flakes off in patches to cream and olive, like camouflage; big maple-like leaves; likes water.', ['tulip-tree', 'sweetgum', 'norway-maple']),
    'beech': ('alternate', 'simple', 'Smooth grey bark like elephant skin; long, pointed, cigar-shaped buds; papery tan leaves hang on through winter.', ['gray-birch', 'black-cherry', 'dogwood']),
    'sassafras': ('alternate', 'simple', 'Three leaf shapes on one tree: an oval, a mitten and a three-lobed ghost; spicy smell when crushed.', ['tulip-tree', 'white-oak', 'dogwood']),
    'black-cherry': ('alternate', 'simple', 'Old bark in dark flakes like burnt potato chips; narrow, finely toothed leaves.', ['beech', 'gray-birch', 'red-oak']),
    'white-pine': ('needles', 'needles', 'Soft needles in bundles of five; branches in whorls, like the spokes of a wheel.', ['pitch-pine', 'hemlock', 'red-cedar']),
    'pitch-pine': ('needles', 'needles', 'Stiff needles in bundles of three, some sprouting straight from the trunk: the pine of the Pine Barrens.', ['white-pine', 'red-cedar', 'white-cedar']),
    'red-cedar': ('scales', 'scales', 'Prickly, scaly evergreen foliage; blue berry-like cones; shreddy red-brown bark; old fields and roadsides.', ['white-cedar', 'hemlock', 'pitch-pine']),
    'dogwood': ('opposite', 'simple', 'Leaf veins curve to follow the leaf edge; four white bracts like petals in spring; bark in small square blocks.', ['black-cherry', 'sassafras', 'beech']),
    'gray-birch': ('alternate', 'simple', 'Chalky white bark that barely peels, with a dark chevron under each branch; triangular, long-pointed leaves.', ['beech', 'black-cherry', 'sycamore']),
    'black-locust': ('alternate', 'compound', 'Compound leaves of small oval leaflets; paired thorns at the leaf bases; deeply furrowed, ropy bark.', ['tree-of-heaven', 'black-walnut', 'shagbark-hickory']),
    'tree-of-heaven': ('alternate', 'compound', 'Very long compound leaves, each leaflet with a notch or two near its base; a rank smell when crushed. Invasive.', ['black-walnut', 'black-locust', 'shagbark-hickory']),
    'holly': ('alternate', 'simple', 'Evergreen leaves with spines; red berries in winter; smooth grey bark.', ['red-cedar', 'beech', 'dogwood']),
    'white-cedar': ('scales', 'scales', 'Flat, scaly sprays and tiny round cones; straight trunks crowded in the dark cedar swamps of the Pine Barrens.', ['red-cedar', 'hemlock', 'pitch-pine']),
    'hemlock': ('needles', 'needles', 'Short, flat needles with two white lines underneath; tiny cones; shady ravines in the north.', ['white-pine', 'red-cedar', 'white-cedar']),
    'shagbark-hickory': ('alternate', 'compound', 'Bark peeling in long shaggy strips; a compound leaf of five leaflets, the end three the largest.', ['black-walnut', 'black-locust', 'tree-of-heaven']),
    'black-walnut': ('alternate', 'compound', 'Long compound leaves of fifteen or so leaflets; green husks the size of tennis balls; dark bark in diamond furrows.', ['tree-of-heaven', 'shagbark-hickory', 'black-locust']),
}
CONTEXTS = ['leaf', 'bark', 'form', 'fruit', 'flower', 'fall', 'twig']


def build():
    from PIL import Image
    from shapely.geometry import Point, shape
    from shapely.strtree import STRtree
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import build_nj_landmark_list as BL
    polys, props = BL.towns()
    tree = STRtree(polys)
    picks = json.load(open(os.path.join(ROOT, 'tools/tree_picks.json')))
    os.makedirs(os.path.join(ROOT, 'img/trees'), exist_ok=True)
    out = []
    for sci, slug in TREES:
        if slug not in picks:
            continue
        rec = json.load(open(f'{TMP}/{slug}.json'))
        cs = candidates(rec)
        photos = []
        for k, (num, ctx) in enumerate(picks[slug]):
            assert ctx in CONTEXTS, ctx
            p = cs[num]
            fn = f'img/trees/{slug}-{k + 1}.jpg'
            fp = os.path.join(ROOT, fn)
            if not os.path.exists(fp):
                data = urllib.request.urlopen(urllib.request.Request(p['url'].replace('square', 'medium'), headers={'User-Agent': UA}), timeout=60).read()
                tmp = fp + '.tmp'; open(tmp, 'wb').write(data)
                im = Image.open(tmp).convert('RGB'); im.thumbnail((520, 520)); im.save(fp, quality=78, optimize=True); os.remove(tmp); time.sleep(0.3)
            photos.append({'f': fn, 'ctx': ctx, 'credit': p['attr'], 'lic': p['lic'], 'id': p['id']})
        # where it was seen: the points (rounded to about 100 m), and counts by county from the app's own boundaries
        pts, counties = [], {}
        for o in rec['obs']:
            if not o['loc']:
                continue
            pt = Point(o['loc'])
            hit = [i for i in tree.query(pt) if polys[i].contains(pt)]
            if not hit:
                continue
            c = props[hit[0]]['c']
            counties[c] = counties.get(c, 0) + 1
            pts.append([round(o['loc'][0], 3), round(o['loc'][1], 3)])
        arr, leaf, tell, like = FACTS[slug]
        name = rec['common'] or sci
        out.append({'id': slug, 'name': name[0].upper() + name[1:], 'sci': sci, 'count': rec['count'], 'arr': arr, 'leaf': leaf, 'tell': tell, 'like': [x for x in like if x in picks],
                    'photos': photos, 'pts': pts, 'counties': dict(sorted(counties.items(), key=lambda kv: -kv[1]))})
        print(f"{slug:18s} {len(photos)} photos, {len(pts)} points, top counties {list(out[-1]['counties'])[:3]}")
    json.dump({'v': 1, 'source': 'iNaturalist research-grade observations in New Jersey (photos under their own CC licences, credited); the tells and leaf facts are unverified general knowledge', 'trees': out},
              open(os.path.join(ROOT, 'data/trees.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(out), 'trees;', sum(len(t['photos']) for t in out), 'photos')


if __name__ == '__main__':
    {'fetch': fetch, 'sheets': sheets, 'build': build}[sys.argv[1]]()
