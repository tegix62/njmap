// Deep Jersey stories. Each one moves from something far bigger than us, down a thread, to a place in New Jersey you can name,
// see or visit (or one that is gone): three beats, `big`, `thread`, `here`. Each ends with two or three threads to other stories.
// Every claim comes from the sources listed (keys into SRC in deepcards.js); the first nine are the old chapters, rewritten from
// their own sourced text and the close-up cards they point to. A beat's scene is what applyScene takes; `fit` frames a region,
// `cam` is [lon, lat, zoom]; `play` names an animation (rise, lava, ice, sand, drain).

const story = (s) => s;

export const STORIES = [
  story({ id: 's-oldest', domain: 'earth', when: 'More than a billion years ago', title: 'The oldest rock',
    hook: 'The hills north of Boonton were part of a mountain belt that ran from Labrador to Mexico.',
    beats: {
      big: { text: ['The story starts deep underground, with rock more than a billion years old, from the era of the Grenville mountain-building. While an earlier supercontinent came together, it built a belt of mountains from Labrador to Mexico.'],
        scene: { prov: { highlands: 0.8 }, provFaint: 0.06 }, cam: [-76.5, 40.6, 5.2] },
      thread: { text: ['Its rock shows through today as a belt of hills: from near Reading, Pennsylvania, where it is called South Mountain, across New Jersey and New York as the Highlands, into Connecticut as the Housatonic Highlands.', 'It holds iron ore, which built the iron towns, and also uranium, whose decay gives off radon, a known indoor hazard on the prong.'],
        scene: { prov: { highlands: 0.8 }, provFaint: 0.06, labels: ['highlands'] }, fit: 'highlands' },
      here: { text: ['The hills from Boonton north and west are Highlands gneiss and granite, the oldest rock in New Jersey. Under Boonton itself it is the Losee Metamorphic Suite.', 'The Highlands hold iron ore, magnetite. Furnaces like Split Rock, in Rockaway Township, turned it into iron.'],
        scene: { prov: { highlands: 0.45 }, rocks: 0.5 }, cam: [-74.4, 40.95, 10] },
    },
    places: ['highlands', 'tripod'], threads: [{ to: 's-mountains', why: 'next, younger rock is squeezed up against it' }, { to: 's-iron', why: 'this rock holds the ore the forges ran on' }],
    src: ['grenville', 'reading', 'sgmc', 'physio', 'rocktwp'] }),

  story({ id: 's-mountains', domain: 'earth', when: 'About 450 to 260 million years ago', title: 'Mountains rise, twice',
    hook: 'Africa crashed into North America, and the folds are still there in north-west New Jersey.',
    beats: {
      big: { text: ['Sand, mud and lime settle in shallow seas. Then continents collide. The Taconic mountain-building, which ended about 440 million years ago, raised a great chain from eastern Canada down the East Coast; as it wore away, its sediment spread across the Appalachians.', 'From about 325 to 260 million years ago Africa crashed into North America, forming the supercontinent Pangaea and folding the Appalachians into long ridges and valleys, from Alabama to New Jersey and on into New York.'],
        scene: { prov: { valleyridge: 0.8, plateau: 0.35 }, provFaint: 0.05, labels: ['valleyridge'] }, fit: 'valleyridge', play: 'rise' },
      thread: { text: ['In New Jersey that belt is the far north-west: Kittatinny Mountain and the valleys either side. Its first big ridge is one ridge with three names: the Shawangunk Ridge in New York, Kittatinny Mountain in New Jersey, and Blue Mountain in Pennsylvania.', 'High Point, on Kittatinny Mountain, is New Jersey’s highest place at 1,803 ft. For walkers and horses heading west, these ridges were a barrier that was almost impossible to cross.'],
        scene: { prov: { valleyridge: 0.7 }, provFaint: 0.05 }, cam: [-74.85, 41.1, 8.6] },
      here: { text: ['A narrow belt of younger rock runs north-east through the Highlands past Hibernia: the Green Pond Mountain region. Its ridge-maker is the Green Pond Conglomerate, from the Silurian period.', 'It is a rock of quartz pebbles and cobbles set in sandstone, with reddish-brown siltstone: old gravel and sand turned to stone, much younger than the gneiss on either side.'],
        scene: { rocks: 0.5 }, cam: [-74.571, 40.947, 10.5] },
    },
    places: ['green-pond'], explain: ['fold', 'ridges'],
    threads: [{ to: 's-rift', why: 'then the supercontinent the collision made begins to split' }, { to: 's-oldest', why: 'the far older rock the folds were pushed against' }],
    src: ['taconic', 'allegh', 'ridge', 'physio', 'kitt', 'gunks', 'bluemtn', 'sgmc'] }),

  story({ id: 's-rift', domain: 'earth', when: 'About 200 million years ago', title: 'Pangaea tears apart',
    hook: 'Lava flooded the middle of New Jersey three times. The Watchung ridges are what is left.',
    beats: {
      big: { text: ['The supercontinent starts to split and the Atlantic begins to open. Long valleys crack open down the East Coast: rift basins, the red patches on the map.', 'New Jersey’s, the Newark Basin, runs into Pennsylvania and New York. It is one of a chain of rift basins down the East Coast.'],
        scene: { prov: { piedmont: 0.75 }, provFaint: 0.05, labels: ['piedmont'] }, fit: 'piedmont' },
      thread: { text: ['Lava floods the Newark Basin three times, making the three Watchung ridges; molten rock squeezes between the layers and cools underground as the Palisades Sill, which runs through New Jersey and New York along the Hudson.'],
        scene: { rocks: 0.35, flows: 0.9 }, cam: [-74.42, 40.72, 8.4], play: 'lava' },
      here: { text: ['Those lava sheets are the three Watchung ridges: First (Orange Mountain Basalt), Second (Preakness Basalt) and Third (Hook Mountain Basalt).', 'The basalt is hard; the red rock around it wore away, leaving the ridges standing.'],
        scene: { flows: 0.9 }, cam: [-74.28, 40.92, 10.2] },
    },
    places: ['watchungs'], explain: ['lava', 'rift', 'ridges'], photos: 'lava',
    threads: [{ to: 's-lake', why: 'the lava ridges became the walls that held a lake' }, { to: 's-coast', why: 'as the Atlantic widens, the sea starts laying down the south' }],
    src: ['newark', 'watchung', 'palisades', 'physio', 'sgmc'] }),

  story({ id: 's-coast', domain: 'earth', when: 'The last 100 million years', title: 'The coastal plain builds',
    hook: 'South Jersey is part of the flattest land in the country, from Cape Cod to Mexico.',
    beats: {
      big: { text: ['As the Atlantic widens, rivers and the sea lay down sand, clay and gravel along its edge, layer on layer, tilting gently out under the sea.', 'They make the Coastal Plain, part of the flattest region in the country, the Atlantic Plain, which runs over 2,200 miles from Cape Cod to the Mexican border.'],
        scene: { prov: { coastal: 0.6 }, provFaint: 0.05, labels: ['coastal'] }, fit: 'coastal', play: 'sand' },
      thread: { text: ['In New Jersey it is everything south-east of a line from about Trenton to Perth Amboy. One of its youngest layers, the Cohansey sand of about 12 to 14 million years ago (yellow on the map), is the ground the Pine Barrens stand on.'],
        scene: { prov: { coastal: 0.4 }, sand: 0.75 }, cam: [-74.6, 39.75, 8] },
      here: { text: ['The Pine Barrens stand on the Cohansey Formation: white to yellow quartz sand with some gravel and clay. Locals call it sugar sand. In places it is stained red or orange-brown by iron oxides, or cemented into blocks of ironstone.', 'A clay bed in the Cohansey near Millville holds fossil leaves, mostly of Alangium, a tree that no longer grows in eastern North America.'],
        scene: { sand: 0.8 }, cam: [-74.62, 39.72, 9.6] },
    },
    places: ['cohansey', 'aquifer'], explain: ['coastal', 'aquifer'],
    threads: [{ to: 's-iron', why: 'the sand and its bogs made iron and glass' }, { to: 's-ice', why: 'then, far to the north, the ice comes' }],
    src: ['atl', 'sgmc', 'physio', 'pines'] }),

  story({ id: 's-ice', domain: 'ice', when: 'About 20,000 years ago', title: 'The ice sheet',
    hook: 'An ice sheet that covered most of Canada stopped on a line through Morristown.',
    beats: {
      big: { text: ['The Laurentide ice sheet covered most of Canada and much of the northern United States. About 20,000 years ago it reaches its last farthest point. Its edge reaches New York City and Long Island, where the ridges of the moraines it dumped still run along the island.'],
        scene: { iceSheet: 0.85, iceLimit: 1, iceLines: 0.8 }, cam: [-75.0, 41.1, 6.3], play: 'ice' },
      thread: { text: ['In New Jersey it stops on a line from Perth Amboy past Morristown to Belvidere (the dark blue line). The thinner blue lines are the edges of this and older advances across New York and Pennsylvania.'],
        scene: { iceLimit: 1, iceLines: 0.6 }, cam: [-74.6, 40.85, 8.3] },
      here: { text: ['Where it stood, it dumped a ridge of rubble, the terminal moraine, as much as 225 ft thick. North of it the ice scraped the land to bare rock; south of it the old weathered soils are still there.', 'On Pyramid Mountain in Kinnelon, the ice set down a 127-tonne boulder of gneiss balanced on three smaller stones: Tripod Rock.'],
        scene: { iceLimit: 1, pins: ['moraine', 'tripod'] }, cam: [-74.48, 40.8, 10] },
    },
    places: ['moraine', 'tripod'], explain: ['icesheet', 'moraine', 'erratic'],
    threads: [{ to: 's-lake', why: 'the moraine plugged a river, and the meltwater had nowhere to go' }, { to: 's-people', why: 'people followed the ice north' }],
    src: ['laurentide', 'harbor', 'i1420', 'i2540', 'tripod'] }),

  story({ id: 's-lake', domain: 'ice', when: 'About 19,000 to 14,000 years ago', title: 'Glacial Lake Passaic',
    hook: 'A lake 300 ft deep once filled the valley from Wayne to Liberty Corner, then drained away.',
    beats: {
      big: { text: ['The ancestral Passaic River used to leave through a gap in the Watchungs at Short Hills. The ice and its moraine plugged the gap, and as the ice melted back, its meltwater filled the valley behind the ridges.', 'At its deepest the lake was about 300 ft deep, from the foot of Preakness Mountain in Wayne to Liberty Corner. The Third Watchung ridges stood up out of it as a chain of islands. (The outline is drawn from today’s ground below the spillway height, so it is approximate.)'],
        scene: { lake: 'moggy', flows: 0.45, iceLimit: 0.9 }, cam: [-74.45, 40.82, 9.1] },
      thread: { text: ['It spilled out south-west over a gap near Pluckemin, Moggy Hollow, 103 m (339 ft) above sea level. As the ice melted back it uncovered Great Notch, a lower gap in First Watchung Mountain at Clifton, and the lake fell to a new spillway 34 ft lower. (Wikipedia says about 80 ft; the USGS spillway heights give 34.)', 'When the ice withdrew from the gap at Paterson, the last ice dam went. The river kept its new way out: north round the ridges and over the Great Falls at Paterson.'],
        scene: { lake: 'moggy', flows: 0.45 }, cam: [-74.42, 40.8, 8.9], play: 'drain' },
      here: { text: ['The old lake floor is still there as the Passaic Meadows: the Great Swamp, Black Meadows, Troy Meadows, Hatfield Swamp and the Great and Little Piece Meadows.', 'Flat, wet and often flooded, they are wide wetlands in the middle of the suburbs because the lake left them almost level.'],
        scene: { pins: ['swamp'] }, cam: [-74.459, 40.715, 10.5] },
    },
    places: ['lake-passaic', 'great-notch', 'swamp'], explain: ['glaciallake'],
    threads: [{ to: 's-rift', why: 'the ridges that walled it in were lava' }, { to: 's-people', why: 'the first people arrived as the ice and water went' }],
    src: ['passaic', 'i2540', 'swamp'] }),

  story({ id: 's-people', domain: 'people', when: 'From at least 10,000 years ago', title: 'The Lenape',
    hook: 'Parsippany, Hopatcong, Pompton, the Poconos: names from a homeland that stretched from Connecticut to Delaware.',
    beats: {
      big: { text: ['People follow the ice. The ancestors of the Lenape live here from at least 10,000 years ago, in a homeland called Lenapehoking, which stretched from western Connecticut to Delaware: the Delaware and lower Hudson valleys and all the land between them, New Jersey included.'],
        scene: { pins: ['lenape', 'names', 'brotherton'] }, cam: [-74.6, 40.3, 7.2] },
      thread: { text: ['Their history goes on: from a reservation at Brotherton in 1758 to forced removals in 1801 and 1822, and Lenape communities today. The Ramapough Lenape are honoured each October at Lenape Day at the Great Swamp.'],
        scene: { pins: ['brotherton', 'lenape'] }, cam: [-74.5, 40.3, 7.6] },
      here: { text: ['Their names are still on the map. Parsippany: from parsipanong, which the township gives as “the place where the river winds through the valley”. Pompton: named for the Pompton people, a Lenape group who lived there.', 'Some are less certain. Rockaway is a Native American word whose meaning is unknown: “place of sands”, “creek between two hills” and “bushy” have all been offered. Hopatcong is most often said to mean “stone water”; “honey waters of many coves” was probably made up around 1900 to bring in tourists.'],
        scene: { pins: ['names', 'lenape'] }, cam: [-74.42, 40.88, 10] },
    },
    places: ['lenape', 'names', 'brotherton'],
    threads: [{ to: 's-iron', why: 'settlers came for what the rock and the bogs held' }, { to: 's-ice', why: 'the land they found had just come out from under the ice' }],
    src: ['lenapehoking', 'pines', 'montville', 'indianmills', 'poconos', 'parsip', 'rockaway', 'hopat', 'pompton', 'boonton'] }),

  story({ id: 's-iron', domain: 'industry', when: '1700s and 1800s', title: 'Iron, canals and glass',
    hook: 'Boats rode cradles on rails over the hills of north Jersey: the first inclined planes in the country.',
    beats: {
      big: { text: ['The rocks decide the industry. In the Highlands, iron ore from the billion-year-old rock, charcoal from the woods and water power make forges and iron towns. In the Pine Barrens, iron comes from the bogs, where iron-rich groundwater seeps out, and the sand itself makes glass.'],
        scene: { canal: 0.95, pins: ['old-boonton', 'hibernia', 'canal', 'batsto', 'atsion', 'glass', 'allaire'] }, cam: [-74.55, 40.25, 7.3] },
      thread: { text: ['The Morris Canal carries Pennsylvania coal 107 miles across the hills, from Phillipsburg to Newark. It climbs and falls more than 900 ft in all, too much for locks alone, so boats ride cradles on rails up and over the hills: 23 inclined planes, the first in the United States, powered by water.'],
        scene: { canal: 1 }, cam: [-74.6, 40.88, 8.6] },
      here: { text: ['At the falls of the Rockaway River, in 1830, New York businessmen set up the New Jersey Iron Company, with machines and ironworkers brought from England, and a new town grew on the hillside above the river: Boonton.', 'It was a one-industry town. The ironworks flourished for nearly 50 years and closed in 1876; only foundations remain in the Hollow between Plane Street and the river.'],
        scene: { canal: 0.9, pins: ['boonton'] }, cam: [-74.4064, 40.9038, 11] },
    },
    places: ['boonton', 'canal', 'bog-iron', 'batsto'], explain: ['bogiron'],
    threads: [{ to: 's-today', why: 'then the furnaces went cold' }, { to: 's-oldest', why: 'where the Highlands ore came from' }],
    src: ['boonton', 'canal', 'batsto', 'bog'] }),

  story({ id: 's-today', domain: 'gone', when: 'Today', title: 'What is left', gone: true,
    hook: 'A colonial iron village lies under the Boonton Reservoir.',
    beats: {
      big: { text: ['When iron from elsewhere became easier to get, the furnaces went cold. What is left: foundations in the woods, ghost towns, a village drowned under a reservoir, canal stretches, and a protected forest over an aquifer of very pure water.'],
        scene: { canal: 0.8, pins: ['reservoir', 'swamp', 'harrisville', 'wharton-water'] }, cam: [-74.55, 40.25, 7.3] },
      thread: { text: ['Jersey City dammed the Rockaway River in 1904 for its water supply. In 1908 it became the first city water supply in the United States to be chlorinated continuously, a system devised by John L. Leal.'],
        scene: { pins: ['reservoir'] }, cam: [-74.41, 40.885, 10] },
      here: { text: ['Under the water is Old Boonton. Obadiah Baldwin ran an iron forge there from about 1747; by 1761 the village was called Boone-Towne, after the colonial governor Thomas Boone. Its iron works made goods for the army in the Revolution.', 'When the Morris Canal passed it by, the village emptied, and in 1904 the new dam drowned it.'],
        scene: { pins: ['old-boonton'] }, cam: [-74.4077, 40.8832, 11.2] },
    },
    places: ['reservoir', 'old-boonton', 'harrisville', 'aquifer'],
    threads: [{ to: 's-iron', why: 'the industry that built these places' }, { to: 's-people', why: 'whose land it was before any of it' }],
    src: ['res', 'harris', 'pact', 'wsf', 'boonton', 'boone'] }),
];

export const STORY_BY = Object.fromEntries(STORIES.map((s) => [s.id, s]));
/** "How the ground was made": the old chapters, in order. */
export const SEQUENCE = ['s-oldest', 's-mountains', 's-rift', 's-coast', 's-ice', 's-lake', 's-people', 's-iron', 's-today'];
