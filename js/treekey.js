// How people learn trees: by narrowing (a few yes/no questions that every field guide's key is built on) and by group (all the maples together,
// then all the oaks), not one tree at a time. This file is that structure for the 24 trees of data/trees.json: the groups, the key that leads
// to each group, the one thing that tells each member from the others in its group, and small drawings for every question.
// Checked in November 2026 against each species' English Wikipedia article (and the Marcescence article for beech); a field guide is still the authority.

/** The learning groups, in the order they are met (see PATH). `why` is what puts a tree in the group; `tell` tells each member from the others in it. */
export const GROUPS = [
  { id: 'needles', name: 'Needles', why: 'Green all year, with needles thin as pins. Count how many grow out together from one spot on the twig.',
    tell: { 'white-pine': 'Soft needles, five growing together.', 'pitch-pine': 'Stiff needles, three growing together; some sprout straight from the trunk.', 'hemlock': 'Short flat needles, one by one, with two white lines underneath.' } },
  { id: 'scales', name: 'Scales and evergreen leaves', why: 'Green all winter, but not needles: tiny scales pressed flat along the twig, or (holly) a thick, spiny leaf that never drops.',
    tell: { 'red-cedar': 'Tight scales, prickly on young shoots; blue berry-like cones; old fields.', 'white-cedar': 'Flat sprays of scales, tiny round cones; wet cedar swamps.', 'holly': 'A thick, spiny leaf that stays green; red berries on female trees.' } },
  { id: 'maples', name: 'Maples', why: 'Leaves grow in pairs, and each leaf is shaped like a hand with pointed lobes. The seeds hang in winged pairs ("helicopters").',
    tell: { 'red-maple': 'Three main lobes, toothed edges, narrow V-shaped notches; red twigs and leaf stalks.', 'sugar-maple': 'Five lobes, a few big teeth, rounded U-shaped notches.', 'norway-maple': 'A snapped leaf stalk bleeds milky sap (a sugar maple’s is clear); planted along streets.' } },
  { id: 'opp-plain', name: 'In pairs, no lobes', why: 'Leaves in pairs like a maple, but each one is a plain oval with no lobes.',
    tell: { 'dogwood': 'Veins curve to follow the leaf’s edge; four white petal-like leaves around the flowers in spring.' } },
  { id: 'compound', name: 'Leaves made of leaflets', why: 'What looks like a row of small leaves on one stalk is a single leaf, made of leaflets. One of these big leaves at a time on the twig.',
    tell: { 'black-locust': 'Small oval leaflets with smooth edges; thorns in pairs on young trees.', 'tree-of-heaven': 'Very long leaf; two to four small teeth at each leaflet’s base; a rank smell.', 'shagbark-hickory': 'Five leaflets, the end three biggest; grown trees peel in long shaggy strips.', 'black-walnut': '15 to 23 narrow leaflets, biggest in the middle; round green husks.' } },
  { id: 'oaks', name: 'Oaks', why: 'A row of lobes down both sides of the leaf, one leaf at a time on the twig, and acorns. Rounded lobes: the white oak side of the family. Pointed lobes with a tiny bristle at each tip: the red oak side.',
    tell: { 'white-oak': 'Rounded lobes, no bristles; pale, flaky grey bark.', 'red-oak': 'Pointed lobes with bristle tips, cut about halfway in; bark with long shiny stripes.', 'pin-oak': 'Pointed lobes cut almost to the middle; lower branches droop down.' } },
  { id: 'lobed', name: 'Lobed, but not oaks', why: 'One leaf at a time, with a few big lobes: a star, a tulip, a mitten, a hand. Not an oak’s long row of lobes.',
    tell: { 'tulip-tree': 'Four lobes and a flat, cut-off tip: the outline of a tulip.', 'sweetgum': 'A five-pointed star; spiky gumballs.', 'sycamore': 'Big hand-shaped leaf like a maple, but one at a time; bark peeling in camouflage patches.', 'sassafras': 'Mittens, three-lobed leaves and plain ovals, all on one tree.' } },
  { id: 'plain', name: 'Plain leaves', why: 'One leaf at a time, no lobes: just an outline with small teeth or none. The leaves look alike, so the bark is often the quickest clue.',
    tell: { 'beech': 'Smooth grey bark; long cigar-shaped buds; young trees keep dry leaves in winter.', 'black-cherry': 'Dark bark in flakes like burnt potato chips; narrow, finely toothed leaves.', 'gray-birch': 'Chalky white bark with dark chevrons; triangular leaves.' } },
];
// Wave 2 (roadsides and town edges): each joins the group a field guide would put it in, with the one thing that tells it from the others there.
const WAVE2_TELL = {
  maples: { 'silver-maple': 'Five lobes cut almost to the middle, silvery white underneath; shaggy bark on old trees.', 'box-elder': 'The maple made of leaflets: three to seven, in pairs, with maple seeds; green twigs.' },
  compound: { 'honey-locust': 'Fine, feathery leaflets, often divided twice; big branched thorns on wild trees; long twisted pods.' },
  lobed: { 'white-mulberry': 'Glossy, toothed mittens and hearts on one tree, the lobes uneven; berries like small blackberries.' },
  plain: { 'callery-pear': 'Glossy, rounded, wavy-edged leaves; white with smelly flowers in early spring.', hackberry: 'Corky, warty bark; lopsided leaves with a long tip.', redbud: 'Heart-shaped leaves with smooth edges; pink flowers on bare twigs in spring.', cottonwood: 'Big triangular leaves with curved teeth, fluttering on flat stalks; by rivers.' },
};
// Wave 3 (into the woods)
const WAVE3_TELL = {
  oaks: { 'black-oak': 'Like red oak but glossier, often more deeply and unevenly cut; very dark, blocky bark, orange inside.', 'chestnut-oak': 'No real lobes: big rounded teeth like a chestnut leaf; very thick, deeply ridged bark; rocky ridges.' },
  plain: { 'black-gum': 'Glossy, smooth-edged ovals crowded at the twig tips; brilliant scarlet early in fall; alligator bark.', 'black-birch': 'Scratched twig smells of wintergreen; dark, shiny cherry-like bark with long lenticels.', hornbeam: 'Smooth, blue-grey, muscly fluted trunk; double-toothed leaves; shady stream banks.', persimmon: 'Very dark bark in small square blocks; plain smooth-edged ovals; orange fruit.', sweetbay: 'Leathery leaves, silvery white underneath; lemon-scented creamy flowers; swamps.', basswood: 'Big, toothed, lopsided hearts; seed clusters hang from a pale strap-like wing.' },
};
for (const g of GROUPS) Object.assign(g.tell, WAVE2_TELL[g.id] || {}, WAVE3_TELL[g.id] || {});
export const GROUP_OF = Object.fromEntries(GROUPS.flatMap((g) => Object.keys(g.tell).map((id) => [id, g.id])));

/** The way through: each skill of looking is learned just before the first group that needs it. */
export const PATH = [{ skill: 'look' }, { group: 'needles' }, { skill: 'winter' }, { group: 'scales' }, { skill: 'pairs' }, { group: 'maples' }, { group: 'opp-plain' },
  { skill: 'leaflets' }, { group: 'compound' }, { skill: 'lobes' }, { group: 'oaks' }, { group: 'lobed' }, { group: 'plain' }];

/** The key: a question, how to check it on a real tree, the skill lesson that teaches it, its answers (each with a drawing) and where each leads. */
export const KEY = {
  start: { q: 'Needles, scales or leaves?', skill: 'look', how: 'Needles are thin as pins. Scales are tiny and pressed flat along the twig, like a braided cord. Leaves are flat and wide.',
    a: [['Needles', 'needles', { to: 'bundle' }], ['Tiny scales', 'scales', { group: 'scales' }], ['Flat leaves', 'broad', { to: 'winter' }]] },
  bundle: { q: 'How many needles grow from one spot?', how: 'Pull a few needles off where they join the twig: pine needles come away together in a little bundle. Count them.',
    a: [['Five together', 'n5', { group: 'needles' }], ['Three together', 'n3', { group: 'needles' }], ['One by one, short and flat', 'n1', { group: 'needles' }]] },
  winter: { q: 'Does it stay green all winter?', skill: 'winter', how: 'In summer, a thick, shiny, stiff leaf is the clue. Dry brown leaves hanging on in winter (young beech) do not count: they are dead.',
    a: [['Yes, green all winter', 'ever', { group: 'scales' }], ['No, the leaves drop in fall', 'drop', { to: 'arr' }]] },
  arr: { q: 'Where leaves join the twig: in pairs, or one at a time?', skill: 'pairs', how: 'Pick a twig away from the very tip. Find where each leaf stalk starts. Two from the same spot, facing each other, means pairs.',
    a: [['In pairs', 'opp', { to: 'opplobe' }], ['One at a time', 'alt', { to: 'cmpd' }]] },
  opplobe: { q: 'Does the leaf have lobes?', skill: 'lobes', how: 'Lobes are big bulges with deep notches between, like fingers. Small saw-teeth along the edge are not lobes.',
    a: [['Lobes, like a hand', 'lobed', { group: 'maples' }], ['No lobes', 'plainleaf', { group: 'opp-plain' }]] },
  cmpd: { q: 'One leaf, or a leaf made of leaflets?', skill: 'leaflets', how: 'Follow the stalk back to the twig. A whole leaf has a small bud where its stalk meets the twig; a leaflet does not.',
    a: [['One leaf', 'simple', { to: 'lobe' }], ['Leaflets on one stalk', 'compound', { group: 'compound' }]] },
  lobe: { q: 'Does the leaf have lobes?', skill: 'lobes', how: 'Lobes are big bulges with deep notches between, like fingers. Small saw-teeth along the edge are not lobes.',
    a: [['Lobes', 'lobed', { to: 'oak' }], ['No lobes', 'plainleaf', { group: 'plain' }]] },
  oak: { q: 'What kind of lobes?', skill: 'lobes', how: 'An oak leaf has lobes all along a middle vein, like a feather. The others have a few big lobes, like a hand or a star.',
    a: [['A row down both sides', 'oakleaf', { group: 'oaks' }], ['A few big ones: a star, a tulip, a mitten', 'star', { group: 'lobed' }]] },
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
  if (id === 'chestnut-oak') return [...[['start', 2], ['winter', 1], ['arr', 1]], ['cmpd', 0], ['lobe', 1]];      // an oak without lobes: the key finds it with the plain leaves
  if (id === 'box-elder') return [['start', 2], ['winter', 1], ['arr', 0]];      // in pairs, but leaflets: the key's lobe question does not fit it
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
  bark: S(`<path d="M16 6 V58 M48 6 V58" ${line}/><path d="M24 10 q4 8 0 16 q-4 8 0 16 q4 8 0 14 M32 8 q-3 9 0 18 q3 9 0 18 q-3 7 0 12 M40 10 q4 8 0 16 q-4 8 0 16 q4 8 0 14" ${line}/>`),
};
