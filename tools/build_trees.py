#!/usr/bin/env python3
"""Trees of New Jersey: data/trees.json and img/trees/*.jpg, from iNaturalist (research-grade observations in New Jersey, place 51).

Stage 1 (fetch):   python3 tools/build_trees.py fetch     observations with openly licensed photos, into /tmp/trees/<slug>.json, and small
                                                          candidate thumbnails into /tmp/trees/cand/, for the contact sheets
Stage 2 (sheets):  python3 tools/build_trees.py sheets    one numbered contact sheet per tree (/tmp/trees/sheet-<slug>.jpg) to pick photos from by eye
Stage 3 (build):   python3 tools/build_trees.py build     the photos chosen in PICKS (tools/tree_picks.json: slug -> [[candidate number, context], ...]),
                                                          downloaded at medium size, with credits; where each tree was seen (points and by county)

The list of trees and the one-line "tell" for each are mine, checked in November 2026 against each species' English Wikipedia article
(CHECKED below notes what the article does not state); names, photos, credits,
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
    # wave 2: roadsides and town edges (the most-reported wild trees in New Jersey after the first wave, on iNaturalist, November 2026)
    ('Acer negundo', 'box-elder'), ('Pyrus calleryana', 'callery-pear'), ('Acer saccharinum', 'silver-maple'), ('Gleditsia triacanthos', 'honey-locust'),
    ('Morus alba', 'white-mulberry'), ('Celtis occidentalis', 'hackberry'), ('Cercis canadensis', 'redbud'), ('Populus deltoides', 'cottonwood'),
    # wave 3: into the woods (the next most-reported, November 2026)
    ('Nyssa sylvatica', 'black-gum'), ('Quercus montana', 'chestnut-oak'), ('Betula lenta', 'black-birch'), ('Carpinus caroliniana', 'hornbeam'),
    ('Diospyros virginiana', 'persimmon'), ('Magnolia virginiana', 'sweetbay'), ('Tilia americana', 'basswood'), ('Quercus velutina', 'black-oak'),
]
# Trees come in waves: the first is open from the start; each later one opens in the app once the one before it is known (js/trees.js).
WAVE = {**{slug: 2 for slug in ['box-elder', 'callery-pear', 'silver-maple', 'honey-locust', 'white-mulberry', 'hackberry', 'redbud', 'cottonwood']},
        **{slug: 3 for slug in ['black-gum', 'chestnut-oak', 'black-birch', 'hornbeam', 'persimmon', 'sweetbay', 'basswood', 'black-oak']}}


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


# What I say about each tree, checked against its English Wikipedia article (November 2026; see CHECKED). `arr` and `leaf`
# feed two-choice questions; `tell` is the line shown after every answer; `like` are the trees it is confused with (the wrong answers).
FACTS = {
    'red-maple': ('opposite', 'simple', 'Three main lobes (often two small ones at the base) with toothed edges and narrow V-shaped notches; leaf stalks, twigs and flowers are red.', ['sugar-maple', 'norway-maple', 'sweetgum']),
    'sugar-maple': ('opposite', 'simple', 'Five lobes with a few big teeth and smooth edges between them, and rounded U-shaped notches; clear sap in the leaf stalk. A stylised sugar maple leaf is on Canada’s flag.', ['norway-maple', 'red-maple', 'sycamore']),
    'norway-maple': ('opposite', 'simple', 'Like sugar maple, but a snapped leaf stalk bleeds milky white sap (sugar maple’s is clear). A planted street tree that spreads into woods; New Jersey has banned its sale.', ['sugar-maple', 'red-maple', 'sycamore']),
    'white-oak': ('alternate', 'simple', 'Rounded, finger-like lobes with no bristle tips; pale grey bark in loose plates.', ['red-oak', 'pin-oak', 'sassafras']),
    'red-oak': ('alternate', 'simple', 'Pointed lobes ending in bristle tips; bark with long, flat, shiny stripes like ski tracks.', ['pin-oak', 'white-oak', 'black-cherry']),
    'pin-oak': ('alternate', 'simple', 'Deep U-shaped cuts nearly to the midrib, bristle-tipped; the lowest branches droop toward the ground.', ['red-oak', 'white-oak', 'sweetgum']),
    'tulip-tree': ('alternate', 'simple', 'A four-lobed leaf with a notched, cut-off tip, shaped like a tulip; a very tall, straight trunk.', ['sycamore', 'sweetgum', 'sassafras']),
    'sweetgum': ('alternate', 'simple', 'A five-pointed star of a leaf; spiky gumball seed pods on the tree and under it.', ['red-maple', 'sycamore', 'tulip-tree']),
    'sycamore': ('alternate', 'simple', 'Bark that flakes off in patches to cream and olive, like camouflage; big maple-like leaves; likes water.', ['tulip-tree', 'sweetgum', 'norway-maple']),
    'beech': ('alternate', 'simple', 'Smooth silver-grey bark like elephant skin; long, thin, cigar-shaped buds; dry tan leaves often hang on through winter, mostly on young trees.', ['gray-birch', 'black-cherry', 'dogwood']),
    'sassafras': ('alternate', 'simple', 'Three leaf shapes on one tree, even one branch: a plain oval, a two-lobed mitten and a three-lobed ghost; every part smells spicy.', ['tulip-tree', 'white-oak', 'dogwood']),
    'black-cherry': ('alternate', 'simple', 'Old bark dark and broken into flakes like burnt potato chips (young bark is smooth and banded, like a birch); narrow, finely toothed, shiny leaves.', ['beech', 'gray-birch', 'red-oak']),
    'white-pine': ('needles', 'needles', 'Soft needles in bundles of five; branches in whorls, like the spokes of a wheel.', ['pitch-pine', 'hemlock', 'red-cedar']),
    'pitch-pine': ('needles', 'needles', 'Stiff needles in bundles of three, some sprouting straight from the trunk: the pine of the Pine Barrens.', ['white-pine', 'red-cedar', 'white-cedar']),
    'red-cedar': ('scales', 'scales', 'Tight scaly foliage, prickly needles on young shoots; blue berry-like cones on female trees; bark peeling in narrow red-brown strips; one of the first trees in old fields.', ['white-cedar', 'hemlock', 'pitch-pine']),
    'dogwood': ('opposite', 'simple', 'Leaf veins curve to follow the leaf edge; four white bracts like petals in spring; bark in small square blocks.', ['black-cherry', 'sassafras', 'beech']),
    'gray-birch': ('alternate', 'simple', 'Chalky white bark that barely peels, with a dark chevron under each branch; triangular, long-pointed leaves.', ['beech', 'black-cherry', 'sycamore']),
    'black-locust': ('alternate', 'compound', 'Compound leaves of 9 to 19 small oval leaflets; thorns in pairs at the leaf bases, mostly on young trees and sprouts; deeply furrowed, ropy bark.', ['tree-of-heaven', 'black-walnut', 'shagbark-hickory']),
    'tree-of-heaven': ('alternate', 'compound', 'Very long compound leaves; each leaflet has two to four small teeth at its base, each with a gland; a rank smell, like rotting peanuts, when crushed. Invasive.', ['black-walnut', 'black-locust', 'shagbark-hickory']),
    'holly': ('alternate', 'simple', 'Evergreen leaves with spines; red berries in winter, on female trees only; light grey bark, rough with small warty bumps.', ['red-cedar', 'beech', 'dogwood']),
    'white-cedar': ('scales', 'scales', 'Flat, scaly sprays and tiny round cones; straight trunks crowded in the dark cedar swamps of the Pine Barrens.', ['red-cedar', 'hemlock', 'pitch-pine']),
    'hemlock': ('needles', 'needles', 'Short, flat needles with two white lines underneath; tiny cones; shady ravines in the north.', ['white-pine', 'red-cedar', 'white-cedar']),
    'shagbark-hickory': ('alternate', 'compound', 'Bark peeling in long shaggy strips, on grown trees (young ones are smooth); a compound leaf of five leaflets, the end three much the largest.', ['black-walnut', 'black-locust', 'tree-of-heaven']),
    'black-walnut': ('alternate', 'compound', 'Long compound leaves of 15 to 23 narrow, toothed leaflets, the biggest in the middle; round green husks with a spicy smell; dark bark in diamond furrows.', ['tree-of-heaven', 'shagbark-hickory', 'black-locust']),
    # wave 2
    'box-elder': ('opposite', 'compound', 'A maple with leaflets: three to seven (usually three or five) coarsely toothed leaflets, in pairs on the twig; green twigs, often with a pale bloom; winged maple seeds in hanging clusters.', ['silver-maple', 'red-maple', 'tree-of-heaven']),
    'callery-pear': ('alternate', 'simple', 'Glossy, rounded leaves with wavy, finely toothed edges; the whole tree white with bad-smelling flowers in early spring; thorny thickets along roads and fields. Invasive.', ['black-cherry', 'redbud', 'gray-birch']),
    'silver-maple': ('opposite', 'simple', 'Five deep lobes cut almost to the middle, silvery white underneath; old bark in long, loose, shaggy plates; along rivers and streets.', ['red-maple', 'sugar-maple', 'norway-maple']),
    'honey-locust': ('alternate', 'compound', 'Fine, feathery leaves of many small leaflets, often divided twice; big branched thorns on the trunks of wild trees; long, flat, twisted brown pods.', ['black-locust', 'tree-of-heaven', 'black-walnut']),
    'white-mulberry': ('alternate', 'simple', 'Glossy, toothed leaves in many shapes on one tree, from plain hearts to mittens with uneven lobes; berries like small blackberries, white to purple, in early summer.', ['sassafras', 'hackberry', 'redbud']),
    'hackberry': ('alternate', 'simple', 'Grey bark with corky, warty ridges; lopsided, toothed leaves with a long pointed tip and an uneven base; small purple-brown berries.', ['white-mulberry', 'black-cherry', 'beech']),
    'redbud': ('alternate', 'simple', 'Heart-shaped leaves with smooth edges; rosy-pink pea flowers straight from bare twigs and even the trunk in early spring; flat brown pods.', ['callery-pear', 'white-mulberry', 'dogwood']),
    'cottonwood': ('alternate', 'simple', 'Big triangular leaves with coarse, curved teeth on flattened stalks, so they flutter; deeply furrowed grey bark; cottony seeds drifting in late spring; by rivers.', ['gray-birch', 'sycamore', 'silver-maple']),
    # wave 3
    'black-gum': ('alternate', 'simple', 'Glossy, smooth-edged oval leaves crowded at the twig tips; among the first trees to turn, a brilliant scarlet; old bark in blocks like alligator skin; branches stick out level.', ['dogwood', 'persimmon', 'sassafras']),
    'chestnut-oak': ('alternate', 'simple', 'Leaves with wavy, rounded teeth instead of lobes, like a chestnut’s; very thick bark in deep, dark ridges; dry, rocky ridgetops.', ['white-oak', 'black-birch', 'beech']),
    'black-birch': ('alternate', 'simple', 'A scratched twig smells of wintergreen; young bark dark and shiny like a cherry’s, with long horizontal lenticels; old bark in dark, scaly plates; neat, double-toothed oval leaves.', ['black-cherry', 'gray-birch', 'hornbeam']),
    'hornbeam': ('alternate', 'simple', 'A small tree of shady stream banks with smooth, blue-grey, fluted trunks like flexed muscle (musclewood); double-toothed oval leaves; papery three-lobed wings on the seeds.', ['beech', 'black-birch', 'black-cherry']),
    'persimmon': ('alternate', 'simple', 'Bark in small, thick, square blocks, very dark; plain, smooth-edged oval leaves; orange plum-like fruit that is sweet only when soft and ripe.', ['black-gum', 'dogwood', 'sassafras']),
    'sweetbay': ('alternate', 'simple', 'Leathery, smooth-edged leaves, bright silvery white underneath, flashing in the wind; creamy, lemon-scented flowers in early summer; swamps and wet woods in the south.', ['holly', 'black-gum', 'persimmon']),
    'basswood': ('alternate', 'simple', 'Big, heart-shaped, toothed leaves with a lopsided base; flower and nut clusters hang from a long, pale, strap-like leafy wing; red twigs and buds.', ['white-mulberry', 'redbud', 'cottonwood']),
    'black-oak': ('alternate', 'simple', 'Like red oak, with bristle-tipped lobes, but leaves glossier and often with deeper, uneven cuts; very dark, blocky bark with a bright yellow-orange inner bark.', ['red-oak', 'pin-oak', 'white-oak']),
}
# Claims kept although the Wikipedia article does not state them (field-guide staples); shown on the tree's page.
CHECKED = {
    'dogwood': 'Veins curving to follow the edge, and bark in small square blocks, are field-guide staples not stated in the article.',
    'black-cherry': '“Burnt potato chips” is the usual field-guide picture; the article says only “very broken, dark grey to black”.',
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
        name = {'Eastern Cottonwood': 'eastern cottonwood', 'Black Tupelo': 'black gum', 'sweet birch': 'black birch'}.get(name, name)
        out.append({'id': slug, 'wave': WAVE.get(slug, 1), 'name': name[0].upper() + name[1:], 'sci': sci, 'count': rec['count'], 'arr': arr, 'leaf': leaf, 'tell': tell, 'like': [x for x in like if x in picks],
                    'photos': photos, 'checked': {'src': 'https://en.wikipedia.org/wiki/' + sci.replace(' ', '_'), 'on': '2026-11', **({'note': CHECKED[slug]} if slug in CHECKED else {})}, 'pts': pts, 'counties': dict(sorted(counties.items(), key=lambda kv: -kv[1]))})
        print(f"{slug:18s} {len(photos)} photos, {len(pts)} points, top counties {list(out[-1]['counties'])[:3]}")
    json.dump({'v': 1, 'source': 'iNaturalist research-grade observations in New Jersey (photos under their own CC licences, credited); tells and leaf facts checked against each species’ English Wikipedia article in November 2026 (see checked.src)', 'trees': out},
              open(os.path.join(ROOT, 'data/trees.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(out), 'trees;', sum(len(t['photos']) for t in out), 'photos')


if __name__ == '__main__':
    {'fetch': fetch, 'sheets': sheets, 'build': build}[sys.argv[1]]()
