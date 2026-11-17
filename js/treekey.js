// How people learn trees: by narrowing (a few yes/no questions that every field guide's key is built on) and by group (all the maples together,
// then all the oaks), not one tree at a time. This file is that structure for the 24 trees of data/trees.json: the groups, the key that leads
// to each group, the one thing that tells each member from the others in its group, and small drawings for every question.
// Checked in November 2026 against each species' English Wikipedia article (and the Marcescence article for beech); a field guide is still the authority.

/** The learning groups, in the order they are met. `why` is what puts a tree in the group; `tell` tells each member from the others in it. */
export const GROUPS = [
  { id: 'maples', name: 'Maples', why: 'Leaves in pairs on the twig, each a lobed hand of a leaf; seeds in winged pairs ("helicopters").',
    tell: { 'red-maple': 'Three main lobes, toothed edges, narrow V-shaped notches; red twigs and stalks.', 'sugar-maple': 'Five lobes, a few big teeth, rounded U-shaped notches.', 'norway-maple': 'A snapped stalk bleeds milky sap (a sugar maple’s is clear); planted along streets.' } },
  { id: 'oaks', name: 'Oaks', why: 'Many lobes down both sides of the leaf, one at a time on the twig; acorns. Two kinds: the white oaks with rounded lobes, the red oaks with bristle-tipped points.',
    tell: { 'white-oak': 'Rounded lobes, no bristles; pale, flaky grey bark.', 'red-oak': 'Pointed lobes with bristle tips, cut about halfway in; bark with long shiny stripes.', 'pin-oak': 'Pointed lobes cut almost to the middle; lower branches droop down.' } },
  { id: 'lobed', name: 'Lobed, but not oaks', why: 'Leaves one at a time and lobed, but in a few big shapes instead of an oak’s row of lobes.',
    tell: { 'tulip-tree': 'Four lobes and a flat, notched tip: a tulip.', 'sweetgum': 'A five-pointed star; spiky gumballs.', 'sycamore': 'Big maple-like leaf, but one at a time; bark peeling in camouflage patches.', 'sassafras': 'Mittens, three-lobed ghosts and plain ovals on one tree.' } },
  { id: 'plain', name: 'Plain leaves', why: 'One unlobed leaf at a time: here the bark is often the quickest tell.',
    tell: { 'beech': 'Smooth grey bark; long cigar-shaped buds; young trees keep dry leaves in winter.', 'black-cherry': 'Dark bark in flakes like burnt potato chips; narrow, finely toothed leaves.', 'gray-birch': 'Chalky white bark with dark chevrons; triangular leaves.' } },
  { id: 'compound', name: 'Compound leaves', why: 'Each “leaf” is really a stalk of many leaflets, one stalk at a time on the twig.',
    tell: { 'black-locust': 'Small oval leaflets with smooth edges; thorns in pairs on young trees.', 'tree-of-heaven': 'Very long leaf; two to four small teeth at each leaflet’s base; rank smell.', 'shagbark-hickory': 'Five leaflets, the end three biggest; grown trees peel in long shaggy strips.', 'black-walnut': '15 to 23 narrow leaflets, biggest in the middle; round green husks.' } },
  { id: 'opp-plain', name: 'Pairs, not lobed', why: 'Leaves in pairs like a maple, but whole and unlobed.',
    tell: { 'dogwood': 'Veins curve to follow the leaf’s edge; four white bracts in spring.' } },
  { id: 'needles', name: 'Needles', why: 'Evergreen needles: count how many come out together.',
    tell: { 'white-pine': 'Soft needles in bundles of five.', 'pitch-pine': 'Stiff needles in bundles of three, some from the trunk itself.', 'hemlock': 'Single short flat needles with two white lines underneath.' } },
  { id: 'scales', name: 'Scales and evergreen leaves', why: 'Evergreen, but not needles: tiny overlapping scales, or a broad leaf that stays green all winter.',
    tell: { 'red-cedar': 'Tight scales, prickly on young shoots; blue berry-like cones; old fields.', 'white-cedar': 'Flat scaly sprays, tiny round cones; wet cedar swamps.', 'holly': 'A broad, spiny, evergreen leaf; red berries on female trees.' } },
];
export const GROUP_OF = Object.fromEntries(GROUPS.flatMap((g) => Object.keys(g.tell).map((id) => [id, g.id])));

/** The key: a question, its answers (each with a drawing), and where each answer leads (another question, or a group). */
export const KEY = {
  start: { q: 'What does it have?', a: [['Needles', 'needles', { to: 'bundle' }], ['Tiny scales', 'scales', { group: 'scales' }], ['Broad leaves', 'broad', { to: 'winter' }]] },
  bundle: { q: 'How do the needles come?', a: [['Bundles of 5', 'n5', { group: 'needles' }], ['Bundles of 3', 'n3', { group: 'needles' }], ['One by one, flat', 'n1', { group: 'needles' }]] },
  winter: { q: 'Green all winter?', a: [['Yes, evergreen', 'ever', { group: 'scales' }], ['No, they drop', 'drop', { to: 'arr' }]] },
  arr: { q: 'On the twig, leaves (or buds) come…', a: [['In pairs', 'opp', { to: 'opplobe' }], ['One at a time', 'alt', { to: 'cmpd' }]] },
  opplobe: { q: 'Is the leaf lobed?', a: [['Lobed, like a hand', 'lobed', { group: 'maples' }], ['Not lobed', 'plainleaf', { group: 'opp-plain' }]] },
  cmpd: { q: 'One blade, or many leaflets?', a: [['One blade', 'simple', { to: 'lobe' }], ['Many leaflets', 'compound', { group: 'compound' }]] },
  lobe: { q: 'Is the leaf lobed?', a: [['Lobed', 'lobed', { to: 'oak' }], ['Not lobed', 'plainleaf', { group: 'plain' }]] },
  oak: { q: 'What kind of lobes?', a: [['A row of lobes down both sides', 'oakleaf', { group: 'oaks' }], ['A few big ones: a star, a tulip, a mitten', 'star', { group: 'lobed' }]] },
};

/** The path the key takes to a tree's group: [[question node, answer index], ...]. */
const BROAD_ALT = [['start', 2], ['winter', 1], ['arr', 1]];
const PATHS = {
  maples: [['start', 2], ['winter', 1], ['arr', 0], ['opplobe', 0]],
  'opp-plain': [['start', 2], ['winter', 1], ['arr', 0], ['opplobe', 1]],
  compound: [...BROAD_ALT, ['cmpd', 1]],
  plain: [...BROAD_ALT, ['cmpd', 0], ['lobe', 1]],
  oaks: [...BROAD_ALT, ['cmpd', 0], ['lobe', 0], ['oak', 0]],
  lobed: [...BROAD_ALT, ['cmpd', 0], ['lobe', 0], ['oak', 1]],
};
export function pathTo(id) {
  if (id === 'white-pine') return [['start', 0], ['bundle', 0]];
  if (id === 'pitch-pine') return [['start', 0], ['bundle', 1]];
  if (id === 'hemlock') return [['start', 0], ['bundle', 2]];
  if (id === 'holly') return [['start', 2], ['winter', 0]];
  if (id === 'red-cedar' || id === 'white-cedar') return [['start', 1]];
  return PATHS[GROUP_OF[id]];
}
/** The trees an answer in the key can still lead to. */
export function treesUnder(node, i) {
  return Object.keys(GROUP_OF).filter((id) => { const p = pathTo(id); return p.some(([n, k]) => n === node && k === i); });
}

// ---- drawings (simple line art, 64 x 64, currentColor)
const S = (body) => `<svg viewBox="0 0 64 64" class="tk-ico" aria-hidden="true">${body}</svg>`;
const line = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
const leaf = (x, y, s = 1, rot = 0) => `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0 C-7 -6 -7 -18 0 -26 C7 -18 7 -6 0 0 Z M0 0 V-24" ${line}/>`;
const needle = (x, y, len, ang) => `<path d="M${x} ${y} l${(len * Math.sin(ang * Math.PI / 180)).toFixed(1)} ${(-len * Math.cos(ang * Math.PI / 180)).toFixed(1)}" ${line}/>`;
const bundle = (n) => `<path d="M32 58 V44" ${line}/>` + Array.from({ length: n }, (_, i) => needle(32, 44, 34, n === 1 ? 0 : -28 + (56 * i) / (n - 1))).join('');
export const ICON = {
  needles: S(bundle(5)),
  scales: S(`<path d="M32 60 V8" ${line}/>` + [14, 24, 34, 44].map((y) => `<path d="M32 ${y} q-9 3 -12 10 M32 ${y} q9 3 12 10" ${line}/>`).join('')),
  broad: S(leaf(32, 58, 1.9)),
  n5: S(bundle(5)), n3: S(bundle(3)),
  n1: S(`<path d="M10 52 L54 12" ${line}/>` + [0.2, 0.35, 0.5, 0.65, 0.8].map((t) => { const x = 10 + 44 * t, y = 52 - 40 * t; return `<path d="M${x} ${y} l-8 -8 M${x} ${y} l8 8" ${line}/>`; }).join('')),
  ever: S(leaf(32, 52, 1.5) + `<path d="M50 8 v14 M43 15 h14 M45 10 l10 10 M55 10 l-10 10" ${line}/>`),
  drop: S(`<path d="M14 10 Q30 18 48 12" ${line}/>` + leaf(40, 58, 1.1, 40) + `<path d="M20 30 q4 6 0 12" ${line} stroke-dasharray="3 4"/>`),
  opp: S(`<path d="M32 60 V6" ${line}/>` + [44, 22].map((y) => leaf(32, y, 0.7, -60) + leaf(32, y, 0.7, 60)).join('')),
  alt: S(`<path d="M32 60 V6" ${line}/>` + leaf(32, 50, 0.7, -60) + leaf(32, 36, 0.7, 60) + leaf(32, 22, 0.7, -60)),
  simple: S(leaf(32, 60, 2)),
  compound: S(`<path d="M32 62 V4" ${line}/>` + [50, 38, 26].map((y) => leaf(32, y, 0.55, -70) + leaf(32, y, 0.55, 70)).join('') + leaf(32, 14, 0.55, 0)),
  lobed: S(`<path d="M32 60 V36 M32 36 L14 30 L18 20 L26 24 L24 8 L32 16 L40 8 L38 24 L46 20 L50 30 Z" ${line}/>`),
  plainleaf: S(leaf(32, 60, 2)),
  oakleaf: S(`<path d="M32 62 V54 M32 54 C26 54 22 50 25 46 C18 46 18 40 24 38 C17 37 18 30 25 29 C19 27 21 20 27 20 C24 14 28 8 32 6 C36 8 40 14 37 20 C43 20 45 27 39 29 C46 30 47 37 40 38 C46 40 46 46 39 46 C42 50 38 54 32 54 Z" ${line}/>`),
  star: S(`<path d="M32 62 V42 M32 42 L16 46 L22 34 L8 26 L24 24 L32 8 L40 24 L56 26 L42 34 L48 46 Z" ${line}/>`),
};
