// Each tree through the year and through its life: its bark (young and old) and its colours, from each species' English Wikipedia article
// (November 2026); a line is left out where the article says nothing. `barkKind` sorts bark into the five kinds the bark lesson teaches, for
// choosing look-alikes in bark questions.
export const BARK_KINDS = {
  smooth: 'Smooth', plates: 'Plates and scales', ridges: 'Ridges and furrows', peeling: 'Peeling, shaggy or stringy', white: 'Chalky white',
};
export const PROFILE = {
  'red-maple': { barkKind: 'smooth', young: 'Pale grey and smooth.', bark: 'With age, darker, cracking into slightly raised long plates.', fall: 'Red in fall; trees from the north are the reddest.' },
  'sugar-maple': { barkKind: 'plates', bark: 'On mature trees, shaggier than a Norway maple’s.', fall: 'Often spectacular: bright yellow on some trees, through orange, to fluorescent red-orange on others.' },
  'norway-maple': { barkKind: 'ridges', bark: 'Grey-brown with small, shallow, often criss-crossing grooves; unlike many maples it does not turn shaggy with age.',
    fall: 'Usually yellow, occasionally orange-red; the leaves drop when days shorten to about 10 hours.',
    more: ['Purple-leaved kinds are common on lawns and streets (‘Crimson King’, ‘Schwedleri’); they turn orange to red in fall.', 'Yellow-green flowers in early spring, before the leaves; shiny red-brown winter buds.', 'Grass often will not grow well under it.'] },
  'white-oak': { barkKind: 'plates', bark: 'Light ash-grey (rarely white), shallowly fissured and scaly, peeling a little; higher up the trunk the scales overlap.', fall: 'Usually red or brown; some trees are nearly always red, or even purple.' },
  'red-oak': { barkKind: 'ridges', bark: 'Ridges with what look like shiny stripes down their middles; the only oak striped all the way down the trunk. Darker brown on old trees.', fall: 'A rich red, sometimes brown.' },
  'pin-oak': { barkKind: 'smooth', young: 'A straight trunk with smooth bark.', bark: 'Rougher by about 40 years old.', fall: 'Mostly bronze; single leaves red for a while.' },
  'tulip-tree': { barkKind: 'ridges', bark: 'Brown and furrowed.', fall: 'A clear, bright yellow.' },
  sweetgum: { barkKind: 'ridges', bark: 'Light brown tinged with red, sometimes grey with dark streaks (it is also called redgum).', fall: 'Brilliant yellow, orange, red and purple, often all on one tree; the gumballs stay on through winter.' },
  sycamore: { barkKind: 'peeling', bark: 'Flakes off in large, irregular patches, leaving it mottled grey, greenish-white and brown; low on old trunks, dark reddish-brown plates.', fall: 'The leaves turn brown and wither before they fall.' },
  beech: { barkKind: 'smooth', bark: 'Smooth and silver-grey, all its life.', fall: 'Young beeches keep their dry, tan leaves through winter.' },
  sassafras: { barkKind: 'ridges', young: 'Young shoots bright yellow-green.', bark: 'On mature trunks, thick, dark red-brown and deeply furrowed.' },
  'black-cherry': { barkKind: 'plates', young: 'For its first ten years or so, thin, smooth and banded, like a birch.', bark: 'Mature trees: very broken, dark grey to black (the “burnt potato chips”).' },
  'pitch-pine': { barkKind: 'plates', bark: 'Large, thick, irregular plates; thick bark is one of its ways of surviving fire.' },
  'red-cedar': { barkKind: 'peeling', bark: 'Reddish-brown and fibrous, peeling off in narrow strips.' },
  'gray-birch': { barkKind: 'white', bark: 'Smooth, greyish-white or chalky, with black triangular patches at the base of each branch; it does not peel as readily as paper birch.', fall: 'Yellow.' },
  'black-locust': { barkKind: 'ridges', bark: 'Reddish-black and grey, red or orange in the grooves; deep ridges run up the trunk and cross into diamonds.', fall: 'A clear pale yellow; its leaves come out late in spring.' },
  'tree-of-heaven': { barkKind: 'smooth', bark: 'Smooth and light grey, a little rougher with light tan cracks as it ages.' },
  holly: { barkKind: 'smooth', bark: 'Light grey, roughened by small warty lumps.' },
  'white-cedar': { barkKind: 'peeling', young: 'Smooth on young trees.', bark: 'Ash-grey to reddish-brown; mature trees have deep ridges, bark up to 5 cm thick, and no branches on the lower three quarters of the trunk.' },
  hemlock: { barkKind: 'ridges', bark: 'Brownish, scaly and deeply fissured, especially with age.' },
  'shagbark-hickory': { barkKind: 'peeling', young: 'Young trees have smooth bark.', bark: 'Mature trees peel in long shaggy strips.' },
  'black-walnut': { barkKind: 'ridges', bark: 'Grey-black, deeply furrowed into thin ridges in a diamond pattern.' },
  'white-pine': { barkKind: 'ridges' },
  dogwood: { barkKind: 'plates' },
  // wave 2
  'box-elder': { barkKind: 'ridges', young: 'Thin and light grey-brown, often warty.', bark: 'Older trunks with shallow, narrow ridges.', fall: 'Yellow, often dull.' },
  'callery-pear': { barkKind: 'ridges', young: 'Smooth, with pale dots.', bark: 'Grey-brown, in shallow, scaly ridges.', fall: 'Late: glossy red, purple and orange, often into November.' },
  'silver-maple': { barkKind: 'peeling', young: 'Smooth and silvery grey.', bark: 'Old trunks break into long, loose, shaggy strips.', fall: 'Pale yellow, and early.' },
  'honey-locust': { barkKind: 'plates', bark: 'Grey-brown, in long, scaly plates; clusters of branched thorns on wild trees.', fall: 'Bright yellow; the tiny leaflets drop early.' },
  'white-mulberry': { barkKind: 'ridges', bark: 'Orange-brown when young; later grey-brown with long, narrow, irregular ridges.', fall: 'Yellow.' },
  hackberry: { barkKind: 'ridges', bark: 'Grey, with corky, warty ridges.', fall: 'Light yellow, not showy.' },
  redbud: { barkKind: 'plates', young: 'Smooth and brown.', bark: 'Later dark grey, scaly and furrowed, often with orange in the cracks.', fall: 'Bright yellow.' },
  cottonwood: { barkKind: 'ridges', young: 'Smooth, pale grey to yellowish green.', bark: 'Old trunks thick, with deep, dark grey furrows.', fall: 'Yellow.' },
  // wave 3
  'black-gum': { barkKind: 'plates', young: 'Dark grey and flaky.', bark: 'Old trunks in thick, squarish blocks, like alligator skin.', fall: 'Among the first to turn: purple, then brilliant scarlet, sometimes with yellow.' },
  'chestnut-oak': { barkKind: 'ridges', bark: 'Very thick and dark, in deep, wide, V-shaped ridges.', fall: 'Dull yellow, soon yellow-brown.' },
  'black-birch': { barkKind: 'smooth', young: 'Dark, shiny red-brown to near black, with long horizontal lenticels, like a cherry; it does not peel in curls like paper birch.', bark: 'Old trunks crack into irregular, dark, scaly plates.', fall: 'Bright golden yellow.' },
  hornbeam: { barkKind: 'smooth', bark: 'Smooth, thin, blue-grey, the trunk fluted with long ridges like flexed muscle; it stays smooth as it ages.', fall: 'Orange, red and deep scarlet.' },
  persimmon: { barkKind: 'plates', bark: 'Very dark, in thick, square, scaly blocks like charcoal briquettes; orange in the cracks on younger trees.', fall: 'Sometimes orange or scarlet, often dropping without turning; the fruit stays after the leaves drop.' },
  sweetbay: { barkKind: 'smooth', bark: 'Smooth, grey to reddish brown, often mottled; the inner bark smells faintly of bay leaf.', fall: 'In New Jersey most leaves drop in winter; some stay green.' },
  basswood: { barkKind: 'ridges', young: 'Smooth and grey.', bark: 'Older trunks with long, flat-topped, narrow ridges.', fall: 'Yellow-green to yellow.' },
  'black-oak': { barkKind: 'plates', bark: 'Very dark, almost black, deeply furrowed into rough blocks; the inner bark yellow to orange, and bitter.', fall: 'Dull red to brown.' },
};
export const barkKindOf = (id) => (PROFILE[id] || {}).barkKind;
