// Learning to look: the handful of things you check on any tree before you can name it, each taught on its own, in plain words, with a
// drawing, then practised on its own until it is easy. They come in the order a field guide's key asks them, each one just before the first
// group of trees that needs it (PATH in treekey.js). Practice here never touches a tree's review box: it is about the looking, not the names.
// Facts used: arrangement, leaf type and evergreen-ness of the 24 trees in data/trees.json (checked against Wikipedia, November 2026).
// "MAD Horse" (maples, ashes, dogwoods, horse-chestnut: most trees with leaves in pairs) is the usual field-guide memory aid.
import { ICON } from './treekey.js';
import { PROFILE, BARK_KINDS, barkKindOf } from './treeprofile.js';
import { leafSvg, twigSvg, HAS_OUTLINE } from './treeleaf.js';

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);

const COMPOUND = { 'black-locust': 11, 'tree-of-heaven': 13, 'shagbark-hickory': 5, 'black-walnut': 17 };   // leaflets in the drawing
const LOBED = ['red-maple', 'sugar-maple', 'norway-maple', 'white-oak', 'red-oak', 'pin-oak', 'tulip-tree', 'sweetgum', 'sycamore', 'sassafras'];
const PLAIN = ['beech', 'black-cherry', 'gray-birch', 'dogwood', 'holly'];
const OAKS = ['white-oak', 'red-oak', 'pin-oak'];
const leafPic = (H, id, cls = 'big') => (HAS_OUTLINE(id) ? `<div class="sk-big">${leafSvg(id)}</div>` : H.img(H.photoOf(H.by.get(id), ['leaf']), cls));
const kindOf = (t) => (t.arr === 'needles' ? 'needles' : t.arr === 'scales' ? 'scales' : 'broad');
const green = (t) => t.arr === 'needles' || t.arr === 'scales' || t.id === 'holly';

const art = (svg, cap) => `<figure class="sk-art">${svg}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
const pair = (a, b) => `<div class="sk-pair">${a}${b}</div>`;

/** The skills, in order. `panels(H)` is the short lesson; `drill(H)` makes one practice question. */
export const SKILLS = {
  look: {
    name: 'Needles, scales or leaves?', short: 'The first look',
    panels: (H) => [
      { h: 'Start with the green', p: 'Before anything else, look at what the tree is covered in. Every tree in this app has one of three kinds of green.', art: `<div class="sk-three">${['needles', 'scales', 'broad'].map((k, i) => `<div>${ICON[k]}<b>${['Needles', 'Scales', 'Leaves'][i]}</b></div>`).join('')}</div>` },
      { h: 'Needles', p: 'Thin as pins and green all year, like a Christmas tree. Pines and hemlocks have them.', art: H.img(H.photoOf(H.by.get('white-pine'), ['leaf'])) },
      { h: 'Scales', p: 'Tiny pieces pressed flat along the twig, so a sprig looks like a braided cord. Cedars have them.', art: H.img(H.photoOf(H.by.get('red-cedar'), ['leaf'])) },
      { h: 'Leaves', p: 'Flat and wide: what most people picture as a leaf. Most trees here have them, so the questions that follow are about leaves.', art: H.img(H.photoOf(H.by.get('red-maple'), ['leaf'])) },
      { h: 'Why it comes first', p: 'One look splits the 24 trees: <b>3</b> with needles, <b>2</b> with scales, <b>19</b> with leaves. Every field guide starts here.' },
    ],
    drill(H) {
      if (Math.random() < 0.6) {
        const k = rand(['needles', 'scales', 'broad', 'broad']), t = rand(H.trees.filter((x) => kindOf(x) === k));
        return { ask: 'Needles, scales or leaves?', body: H.img(H.photoOf(t, ['leaf']), 'big'), layout: 'icons',
          opts: [['needles', 'Needles'], ['scales', 'Scales'], ['broad', 'Leaves']], right: kindOf(t), about: t,
          why: { needles: 'Thin as pins, growing out from the twig.', scales: 'Tiny scales pressed flat along the twig.', broad: 'Flat, wide leaves.' }[kindOf(t)] };
      }
      const want = rand(['needles', 'scales', 'broad']);
      const pick = ['needles', 'scales', 'broad'].map((k) => rand(H.trees.filter((x) => kindOf(x) === k)));
      return { ask: `Tap the one with <b>${{ needles: 'needles', scales: 'scales', broad: 'flat leaves' }[want]}</b>`, layout: 'tiles',
        opts: shuffle(pick).map((t) => [kindOf(t), `<img src="${H.esc(H.photoOf(t, ['leaf']).f)}" alt="">`]), right: want,
        why: { needles: 'Needles: thin as pins.', scales: 'Scales: pressed flat along the twig like a braided cord.', broad: 'Leaves: flat and wide.' }[want] };
    },
  },
  winter: {
    name: 'Green all winter?', short: 'Evergreen or not',
    panels: (H) => [
      { h: 'Most trees drop their leaves', p: 'In New Jersey almost every tree with flat leaves drops them in fall and stands bare all winter.', art: H.img(H.photoOf(H.by.get('sugar-maple'), ['fall'])) },
      { h: 'Some stay green', p: 'Needles and scales stay green all year: that is what <b>evergreen</b> means. So does one tree with flat leaves you will meet: American holly.', art: H.img(H.photoOf(H.by.get('holly'), ['leaf'])) },
      { h: 'How to tell in summer', p: 'A leaf built to last the winter is thick, stiff and shiny, often with spines. Leaves that drop are thinner and softer.' },
      { h: 'One trick', p: 'Young beech trees hold on to dry, papery, brown leaves all winter. They are dead leaves, not green ones: beech is not an evergreen.', art: H.img(H.photoOf(H.by.get('beech'), ['fall', 'leaf'])) },
    ],
    drill(H) {
      if (Math.random() < 0.5) {
        const ever = rand(H.trees.filter(green)), drop = shuffle(H.trees.filter((x) => !green(x))).slice(0, 2);
        return { ask: 'Tap the one that stays <b>green all winter</b>', layout: 'tiles', opts: shuffle([ever, ...drop]).map((t) => [green(t) ? 'yes' : t.id, `<img src="${H.esc(H.photoOf(t, ['leaf']).f)}" alt="">`]), right: 'yes',
          why: 'Needles, scales, or a thick, shiny, spiny leaf: built to last the winter.' };
      }
      const t = rand(Math.random() < 0.5 ? H.trees.filter(green) : H.trees.filter((x) => !green(x)));
      return { ask: 'Does this tree stay green all winter?', body: H.img(H.photoOf(t, ['leaf']), 'big'), layout: 'icons',
        opts: [['yes', 'Yes, green all winter', 'ever'], ['no', 'No, the leaves drop', 'drop']], right: green(t) ? 'yes' : 'no', about: t,
        why: green(t) ? (t.id === 'holly' ? 'A thick, stiff, spiny leaf: holly keeps it all winter.' : `${t.arr === 'needles' ? 'Needles' : 'Scales'} stay green all year.`) : 'Thin, soft, flat leaves: they drop in fall.' };
    },
  },
  pairs: {
    name: 'Pairs or one at a time?', short: 'How leaves sit on the twig',
    panels: (H) => [
      { h: 'Look where the leaves join', p: 'Follow a leaf’s stalk back to the twig. On some trees two leaves leave the twig from the same spot, facing each other: <b>in pairs</b>. On most, one leaf leaves, then a gap, then the next on the other side, zig-zagging up: <b>one at a time</b>.',
        art: pair(art(twigSvg('sugar-maple', { arr: 'opposite' }), 'In pairs'), art(twigSvg('black-cherry', { arr: 'alternate' }), 'One at a time')) },
      { h: 'How to check on a real tree', p: 'Pick a twig a little way back from the end of a branch: at the very tip, leaves bunch up and are hard to read. Find two or three places where a leaf stalk starts. Are there two at the same spot?' },
      { h: 'The bud is the marker', p: 'Where each leaf stalk meets the twig sits a small bud (drawn brown here). In winter, with the leaves gone, the buds still sit in pairs or one at a time, so this works all year.',
        art: pair(art(twigSvg('sugar-maple', { arr: 'opposite', n: 2 }), 'Buds in pairs'), art(twigSvg('gray-birch', { arr: 'alternate', n: 3 }), 'Buds one at a time')) },
      { h: 'Why it matters so much', p: 'Pairs are rare. Most trees with leaves in pairs are <b>M</b>aples, <b>A</b>shes, <b>D</b>ogwoods or <b>Horse</b>-chestnut: field guides remember them as <b>MAD Horse</b>. Of the 19 trees here with flat leaves, only 4 have them in pairs: the three maples and the dogwood. Find pairs and you are nearly there.' },
      { h: 'The book words', p: 'Field guides call pairs <b>opposite</b> and one at a time <b>alternate</b>. This app says pairs and one at a time.' },
    ],
    drill(H) {
      const broad = H.trees.filter((x) => kindOf(x) === 'broad' && HAS_OUTLINE(x.id));   // twig sketches only with traced leaves
      const r = Math.random();
      if (r < 0.55) {
        const t = rand(Math.random() < 0.45 ? broad.filter((x) => x.arr === 'opposite') : broad.filter((x) => x.arr === 'alternate'));
        return { ask: 'In pairs, or one at a time?', sub: 'A sketch of a twig: look where each leaf stalk starts.', body: `<div class="sk-big">${twigSvg(t.id, { arr: t.arr })}</div>`, layout: 'icons',
          opts: [['opposite', 'In pairs', 'opp'], ['alternate', 'One at a time', 'alt']], right: t.arr, about: t,
          why: t.arr === 'opposite' ? 'Two leaves leave the twig from the same spot, facing each other.' : 'One leaf at each spot, zig-zagging up the twig.' };
      }
      if (r < 0.85) {
        const o = rand(broad.filter((x) => x.arr === 'opposite')), a = shuffle(broad.filter((x) => x.arr === 'alternate' && !(x.id in COMPOUND))).slice(0, 2);
        return { ask: 'Tap the twig with leaves <b>in pairs</b>', layout: 'tiles tall', opts: shuffle([o, ...a]).map((t) => [t.arr, twigSvg(t.id, { arr: t.arr })]), right: 'opposite',
          why: 'Two leaves from the same spot on the twig.' };
      }
      return { ask: 'You find leaves in pairs. Which tree is it most likely to be?', layout: 'choices', opts: shuffle([['maple', 'A maple'], ['oak', 'An oak'], ['birch', 'A birch'], ['cherry', 'A cherry']]), right: 'maple',
        why: 'MAD Horse: maples, ashes, dogwoods and horse-chestnut are most of the trees with leaves in pairs.' };
    },
  },
  leaflets: {
    name: 'One leaf, or leaflets?', short: 'Simple and compound leaves',
    panels: (H) => [
      { h: 'Some leaves are split up', p: 'On some trees, what looks like a row of small leaves on one stalk is really a single leaf, cut into <b>leaflets</b>.',
        art: pair(art(leafSvg('black-cherry'), 'One leaf'), art(H.img(H.photoOf(H.by.get('black-locust'), ['leaf'])), 'One leaf, of leaflets')) },
      { h: 'The test: find the bud', p: 'A whole leaf always has a small bud where its stalk meets the twig. A leaflet never does. Follow the stalk back: if you pass many leaflets before you reach a bud, they are all one leaf.',
        art: art(twigSvg('gray-birch', { n: 3 }), 'A bud at the base of every leaf') },
      { h: 'Another clue', p: 'In fall a leaf made of leaflets drops in one piece, stalk and all; you find bare stalks on the ground under the tree.' },
      { h: 'The book words', p: 'Field guides call one leaf <b>simple</b> and a leaf of leaflets <b>compound</b>. Four trees here have compound leaves: black locust, tree of heaven, shagbark hickory and black walnut.' },
    ],
    drill(H) {
      // photos of the leaves: none of the four compound-leaved trees has a traced outline yet
      const broad = H.trees.filter((x) => kindOf(x) === 'broad');
      if (Math.random() < 0.6) {
        const t = rand(Math.random() < 0.5 ? broad.filter((x) => x.id in COMPOUND) : broad.filter((x) => !(x.id in COMPOUND)));
        return { ask: 'One leaf, or a leaf made of leaflets?', body: H.img(H.photoOf(t, ['leaf']), 'big'), layout: 'icons',
          opts: [['simple', 'One leaf', 'simple'], ['compound', 'Leaflets on one stalk', 'compound']], right: t.leaf, about: t,
          why: t.leaf === 'compound' ? `Many leaflets along one stalk: one leaf (${COMPOUND[t.id] === 5 ? 'usually five leaflets' : 'many leaflets'}).` : 'A single blade on its stalk.' };
      }
      const c = rand(broad.filter((x) => x.id in COMPOUND)), s = shuffle(broad.filter((x) => !(x.id in COMPOUND))).slice(0, 2);
      return { ask: 'Tap the leaf that is <b>made of leaflets</b>', layout: 'tiles', opts: shuffle([c, ...s]).map((t) => [t.leaf, `<img src="${H.esc(H.photoOf(t, ['leaf']).f)}" alt="">`]), right: 'compound',
        why: 'A row of leaflets along one stalk, all one leaf.' };
    },
  },
  lobes: {
    name: 'Lobes, and what kind?', short: 'The outline of the leaf',
    panels: (H) => [
      { h: 'Lobes are not teeth', p: '<b>Lobes</b> are big bulges with deep notches between them, like fingers or a mitten’s thumb. <b>Teeth</b> are the small saw-points along an edge. A leaf can have teeth and no lobes.',
        art: pair(art(leafSvg('sugar-maple'), 'Lobes'), art(leafSvg('black-cherry'), 'Teeth, no lobes')) },
      { h: 'Two kinds of lobed leaf', p: 'A row of lobes down both sides of a middle vein, like a feather: an <b>oak</b>. Or a few big lobes spreading from one point, like a hand, a star or a mitten: maples, sweetgum, sycamore, tulip tree, sassafras.',
        art: pair(art(leafSvg('red-oak'), 'A row: oak'), art(leafSvg('sweetgum'), 'A few big ones')) },
      { h: 'Oaks split in two', p: 'Rounded lobes: the white oak side of the family. Pointed lobes with a tiny bristle at each tip: the red oak side.',
        art: pair(art(leafSvg('white-oak'), 'Rounded'), art(leafSvg('red-oak'), 'Bristle tips')) },
    ],
    drill(H) {
      const r = Math.random();
      if (r < 0.45) {
        const id = rand(Math.random() < 0.5 ? LOBED.filter((x) => x !== 'sassafras') : PLAIN), useP = Math.random() < 0.35 || !HAS_OUTLINE(id);
        return { ask: 'Does the leaf have lobes?', body: useP ? H.img(H.photoOf(H.by.get(id), ['leaf']), 'big') : leafPic(H, id), layout: 'icons',
          opts: [['yes', 'Lobes', 'lobed'], ['no', 'No lobes', 'plainleaf']], right: LOBED.includes(id) ? 'yes' : 'no', about: H.by.get(id),
          why: LOBED.includes(id) ? 'Big bulges with deep notches between.' : id === 'holly' ? 'Spines on the edge, but no deep notches: no lobes.' : 'An outline with small teeth or none: no lobes.' };
      }
      if (r < 0.8) {
        const id = rand(Math.random() < 0.5 ? OAKS : LOBED.filter((x) => !OAKS.includes(x) && HAS_OUTLINE(x)));
        return { ask: 'What kind of lobes?', body: leafPic(H, id), layout: 'icons',
          opts: [['row', 'A row down both sides', 'oakleaf'], ['few', 'A few big ones', 'star']], right: OAKS.includes(id) ? 'row' : 'few', about: H.by.get(id),
          why: OAKS.includes(id) ? 'Lobes all along the middle vein: an oak.' : 'A few big lobes from one point: not an oak.' };
      }
      const id = rand(OAKS);
      return { ask: 'Rounded lobes, or bristle tips?', body: leafPic(H, id), layout: 'choices',
        opts: [['round', 'Rounded'], ['bristle', 'Pointed, bristle tips']], right: id === 'white-oak' ? 'round' : 'bristle', about: H.by.get(id),
        why: id === 'white-oak' ? 'Rounded lobes: the white oak side.' : 'Pointed lobes with a bristle at each tip: the red oak side.' };
    },
  },
};

// Bark: added for the trees' winter half. Its lines are the bark sentences of each species' Wikipedia article (js/treeprofile.js).
SKILLS.bark = {
  name: 'Reading bark', short: 'The year-round clue',
  panels: (H) => {
    const ph = (id) => H.img(H.photoOf(H.by.get(id), ['bark']));
    return [
      { h: 'Bark is there all year', p: 'Leaves come and go; bark stays. In winter it is often the best clue you have. Start by sorting it into one of five kinds.' },
      { h: 'Smooth', p: 'No cracks to speak of: beech (silver-grey, smooth all its life), young red maples, holly (grey with small warty lumps).', art: ph('beech') },
      { h: 'Plates and scales', p: 'Broken into flat pieces: pitch pine’s thick irregular plates, old black cherry’s dark “burnt potato chips”, white oak’s pale scales.', art: ph('pitch-pine') },
      { h: 'Ridges and furrows', p: 'Long ridges with grooves between, often crossing into diamonds: black walnut, black locust, tulip tree. Northern red oak’s ridges have shiny stripes down their middles.', art: ph('black-walnut') },
      { h: 'Peeling, shaggy or stringy', p: 'Coming away: shagbark hickory in long shaggy strips, sycamore in patches like camouflage, eastern red cedar in narrow stringy strips.', art: ph('shagbark-hickory') },
      { h: 'Chalky white', p: 'Gray birch: chalky white, with a dark triangle under each branch.', art: ph('gray-birch') },
      { h: 'Bark changes with age', p: 'Young bark is usually smoother. Red maple: smooth pale grey, then long plates. Black cherry: banded like a birch for ten years, then dark chips. Shagbark hickory turns shaggy only when mature; pin oak is smooth until about 40.' },
    ];
  },
  drill(H) {
    const withBark = H.trees.filter((t) => barkKindOf(t.id) && t.photos.some((p) => p.ctx === 'bark'));
    const t = rand(withBark), kind = barkKindOf(t.id);
    if (Math.random() < 0.55) {
      return { ask: 'What kind of bark is this?', body: H.img(H.photoOf(t, ['bark']), 'big'), layout: 'choices',
        opts: shuffle(Object.entries(BARK_KINDS)).slice(0, 5).map(([k, l]) => [k, l]), right: kind, about: t, why: (PROFILE[t.id] || {}).bark || BARK_KINDS[kind] };
    }
    const same = withBark.filter((x) => x.id !== t.id && barkKindOf(x.id) === kind), other = withBark.filter((x) => x.id !== t.id);
    const ch = shuffle([t, ...shuffle(same).slice(0, 2), ...shuffle(other)].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 4));
    if (!ch.includes(t)) ch[0] = t;
    return { ask: 'Whose bark is this?', body: H.img(H.photoOf(t, ['bark']), 'big'), layout: 'choices', opts: shuffle(ch).map((x) => [x.id, x.name]), right: t.id, about: t,
      why: (PROFILE[t.id] || {}).bark || '' };
  },
};
export const SKILL_IDS = Object.keys(SKILLS);
export const DRILL_N = 6, PASS = 5;
