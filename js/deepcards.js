// Deep Jersey, first slice: the Boonton and Rockaway valley corridor. Every card is checked against the sources it lists (opened
// November 2026). Where sources disagree or a meaning is uncertain, the card says so. Coordinates: the Wikipedia article's own, or the
// app's place data (data/nj-places.json).
//
// era: which stop on the time slider shows the card. why: reason tags for "Why is this town here?". year: for "Put it in order": a calendar year (AD),
// or for deep time a negative number of years ago (-2e4 = 20,000 years ago); always written out in `when`.

const W = (t) => `https://en.wikipedia.org/wiki/${t}`;
export const SRC = {
  sgmc: ['USGS State Geologic Map Compilation, New Jersey (from the NJ Geological Survey bedrock map)', 'https://mrdata.usgs.gov/geology/state/state.php?state=NJ'],
  i2540: ['USGS I-2540-C, Surficial Geologic Map of Northern New Jersey (2002)', 'https://pubs.usgs.gov/publication/i2540C'],
  i1420: ['USGS I-1420 (NK-18), Quaternary Geologic Map of the Hudson River quadrangle', 'https://pubs.usgs.gov/imap/i-1420/nk-18/'],
  boonton: ['Wikipedia: Boonton, New Jersey', W('Boonton,_New_Jersey')],
  canal: ['Wikipedia: Morris Canal', W('Morris_Canal')],
  res: ['Wikipedia: Boonton Reservoir', W('Boonton_Reservoir')],
  boone: ['Wikipedia: Thomas Boone (governor)', W('Thomas_Boone_(governor)')],
  passaic: ['Wikipedia: Lake Passaic', W('Lake_Passaic')],
  watchung: ['Wikipedia: Watchung Mountains', W('Watchung_Mountains')],
  tripod: ['Wikipedia: Tripod Rock', W('Tripod_Rock')],
  hibernia: ['Wikipedia: Hibernia, New Jersey', W('Hibernia,_New_Jersey')],
  rocktwp: ['Wikipedia: Rockaway Township, New Jersey', W('Rockaway_Township,_New_Jersey')],
  rockaway: ['Wikipedia: Rockaway, New Jersey', W('Rockaway,_New_Jersey')],
  river: ['Wikipedia: Rockaway River', W('Rockaway_River')],
  wharton: ['Wikipedia: Wharton, New Jersey', W('Wharton,_New_Jersey')],
  kinnelon: ['Wikipedia: Kinnelon, New Jersey', W('Kinnelon,_New_Jersey')],
  parsip: ['Wikipedia: Parsippany–Troy Hills, New Jersey', W('Parsippany%E2%80%93Troy_Hills,_New_Jersey')],
  pompton: ['Wikipedia: Pompton Lakes, New Jersey', W('Pompton_Lakes,_New_Jersey')],
  hopat: ['Wikipedia: Lake Hopatcong', W('Lake_Hopatcong')],
  montville: ['Wikipedia: Montville, New Jersey', W('Montville,_New_Jersey')],
  swamp: ['Wikipedia: Great Swamp National Wildlife Refuge', W('Great_Swamp_National_Wildlife_Refuge')],
  // for the stories (deepstories.js)
  gf: ['Wikipedia: Great Falls (Passaic River)', W('Great_Falls_(Passaic_River)')], sum: ['Wikipedia: Society for Establishing Useful Manufactures', W('Society_for_Establishing_Useful_Manufactures')],
  strike: ['Wikipedia: 1913 Paterson silk strike', W('1913_Paterson_silk_strike')], lakepassaic: ['Wikipedia: Lake Passaic', W('Lake_Passaic')],
  moggy: ['Wikipedia: Moggy Hollow Natural Area', W('Moggy_Hollow_Natural_Area')],
  sterling: ['Wikipedia: Sterling Hill Mining Museum', W('Sterling_Hill_Mining_Museum')], franklinmm: ['Wikipedia: Franklin Mineral Museum', W('Franklin_Mineral_Museum')],
  willemite: ['Wikipedia: Willemite', W('Willemite')], decl: ['Wikipedia: Magnetic declination', W('Magnetic_declination')],
  wmm: ['NOAA NCEI: World Magnetic Model (declination for Boonton computed with WMM2010 and WMM2025)', 'https://www.ncei.noaa.gov/products/world-magnetic-model'],
  hudsoncanyon: ['Wikipedia: Hudson Canyon', W('Hudson_Canyon')], subcanyon: ['Wikipedia: Submarine canyon', W('Submarine_canyon')], lgm: ['Wikipedia: Last Glacial Maximum', W('Last_Glacial_Maximum')],
  crab: ['Wikipedia: Atlantic horseshoe crab', W('Atlantic_horseshoe_crab')], knot: ['Wikipedia: Red knot', W('Red_knot')],
  hadro: ['Wikipedia: Hadrosaurus', W('Hadrosaurus')], diabase: ['Wikipedia: Diabase', W('Diabase')]
};

/** The stops on the time slider, newest first. zoom/center: the deep-time zoom (the camera pulls out as time goes back). */
export const ERAS = [
  { id: 'today', when: 'Today', title: 'What is left', line: 'Canal stretches, mine sites, a drowned village under a reservoir, and the shape of an ice-age lake in the swamps.', center: [-74.43, 40.86], zoom: 10.6, pitch: 55 },
  { id: 'canal', when: '1830–1924', title: 'The canal years', line: 'Coal boats climb the hills on rails, and iron towns grow along the water.', center: [-74.45, 40.89], zoom: 10.4, pitch: 50 },
  { id: 'iron', when: '1700s', title: 'Forges in the hills', line: 'Iron ore from the Highlands, charcoal from the woods and water power from the river.', center: [-74.46, 40.92], zoom: 10.2, pitch: 50 },
  { id: 'lenape', when: 'Before 1700', title: 'Lenapehoking', line: 'The Lenape homeland: the names of rivers and places still in use.', center: [-74.42, 40.92], zoom: 9.9, pitch: 45 },
  { id: 'notch', when: 'About 15,000 years ago', title: 'The lake drops', line: 'The ice pulls back, a lower gap opens, and Lake Passaic drops about 34 ft.', center: [-74.42, 40.80], zoom: 9.6, pitch: 45 },
  { id: 'moggy', when: 'About 19,000 years ago', title: 'Glacial Lake Passaic', line: 'Meltwater trapped behind the Watchung ridges and the moraine: a lake about 300 ft deep.', center: [-74.42, 40.80], zoom: 9.3, pitch: 40 },
  { id: 'ice', when: 'About 20,000 years ago', title: 'The ice sheet', line: 'The last ice sheet stops on a line from Perth Amboy past Morristown and Denville to Belvidere.', center: [-74.55, 40.95], zoom: 8.3, pitch: 35 },
  { id: 'rift', when: 'About 200 million years ago', title: 'Pangaea tears apart', line: 'A rift valley opens as the Atlantic begins. Lava floods out three times: the three Watchung ridges.', center: [-74.40, 40.72], zoom: 8.0, pitch: 30 },
  { id: 'paleo', when: 'About 540 to 380 million years ago', title: 'Old seas and mountains', line: 'Sand, mud and lime laid down in seas, later folded into the ridges and valleys of the north-west.', center: [-74.80, 41.0], zoom: 7.6, pitch: 25 },
  { id: 'highlands', when: 'More than a billion years ago', title: 'The Highlands rock', line: 'Gneiss and granite formed deep underground: the oldest rock in New Jersey, and the home of its iron ore.', center: [-74.55, 40.95], zoom: 7.3, pitch: 20 },
];
export const ERA_INDEX = Object.fromEntries(ERAS.map((e, i) => [e.id, i]));

export const WHY = { river: 'River power', iron: 'Iron', canal: 'The canal', rail: 'The railroad', water: 'Water supply', lenape: 'A Lenape place', ice: 'The ice age' };

/** The cards. p: [lon, lat] or null (a card about an area, shown with its layer). */
export const CARDS = [
  // ---- rocks
  { id: 'highlands', era: 'highlands', kind: 'rock', p: [-74.40, 40.95], title: 'The Highlands rock', when: 'more than a billion years old', year: -1.1e9,
    text: ['The hills from Boonton north and west are Highlands gneiss and granite, the oldest rock in New Jersey (Middle Proterozoic, more than a billion years old). Under Boonton itself it is the Losee Metamorphic Suite.', 'The Highlands hold iron ore, magnetite. Furnaces like Split Rock, in Rockaway Township, turned it into iron.'],
    src: ['sgmc', 'rocktwp'] },
  { id: 'watchungs', era: 'rift', kind: 'rock', p: [-74.28, 40.92], title: 'The Watchung ridges', when: 'about 200 million years ago', year: -2.0e8,
    text: ['About 200 million years ago North America and Africa pulled apart as Pangaea broke up. The rift valley between them, the Newark Basin, filled with red mud and sand, and three times lava flooded across it.', 'Those lava sheets are the three Watchung ridges: First (Orange Mountain Basalt), Second (Preakness Basalt) and Third (Hook Mountain Basalt). The basalt is hard; the red rock around it wore away, leaving the ridges standing.'],
    src: ['sgmc', 'watchung', 'passaic'] },
  { id: 'green-pond', era: 'paleo', kind: 'rock', p: [-74.571, 40.947], title: 'Green Pond Mountain', when: 'Silurian, about 440 to 420 million years ago', year: -4.3e8,
    text: ['A narrow belt of younger rock runs north-east through the Highlands past Hibernia: the Green Pond Mountain region. Its ridge-maker is the Green Pond Conglomerate, from the Silurian period.', 'It is a rock of quartz pebbles and cobbles set in sandstone, with reddish-brown siltstone: old gravel and sand turned to stone, much younger than the gneiss on either side.'],
    src: ['sgmc'] },
  // ---- ice
  { id: 'moraine', era: 'ice', kind: 'ice', p: [-74.48, 40.80], title: 'The edge of the ice', when: 'about 20,000 years ago', year: -2.0e4,
    text: ['About 20,000 years ago the last ice sheet (the Wisconsin glacier) reached its farthest south and stopped on a line through Perth Amboy, Madison, past Morristown to near Denville, then west through Dover and Hackettstown to Belvidere.', 'Where it stood, it dumped a ridge of rubble, the terminal moraine, as much as 225 ft thick. North of it the ice scraped the land to bare rock; south of it the old weathered soils are still there.'],
    src: ['i1420', 'i2540', 'passaic'] },
  { id: 'lake-passaic', era: 'moggy', kind: 'ice', p: [-74.47, 40.73], title: 'Glacial Lake Passaic', when: 'about 19,000 to 14,000 years ago', year: -1.9e4, why: ['ice'],
    text: ['The ancestral Passaic River used to leave through a gap in the Watchungs at Short Hills. The ice and its moraine plugged the gap, and meltwater filled the valley behind the ridges.', 'At its deepest (the Moggy Hollow stage) the lake was about 300 ft deep, from the foot of Preakness Mountain in Wayne to Liberty Corner. It spilled out south-west over a gap near Pluckemin, 103 m (339 ft) above sea level. The Third Watchung ridges stood up out of it as a chain of islands.', 'The outline on the map is drawn from today’s ground below that spillway height, so it is approximate.'],
    src: ['passaic', 'i2540'] },
  { id: 'great-notch', era: 'notch', kind: 'ice', p: [-74.20, 40.89], title: 'The lake drops', when: 'about 15,000 years ago', year: -1.5e4,
    text: ['As the ice melted back it uncovered Great Notch, a lower gap in First Watchung Mountain at Clifton. The lake fell in a short time to a new spillway 93 m (305 ft) above sea level, 34 ft lower than before. (Wikipedia says about 80 ft; the USGS spillway heights give 34.)', 'When the ice withdrew from the gap at Paterson, the last ice dam went and the lake split into three smaller lakes that lasted another 3,000 to 4,000 years. The river kept its new way out: north round the ridges and over the Great Falls at Paterson.'],
    src: ['passaic', 'i2540'] },
  { id: 'swamp', era: 'today', kind: 'ice', p: [-74.459, 40.715], title: 'The lake’s leftovers', when: 'today', year: 2025, why: ['ice'],
    text: ['The old lake floor is still there as the Passaic Meadows: the Great Swamp, Black Meadows, Troy Meadows, Hatfield Swamp and the Great and Little Piece Meadows.', 'Flat, wet and often flooded, they are wide wetlands in the middle of the suburbs because the lake left them almost level.'],
    src: ['passaic', 'swamp'] },
  { id: 'tripod', era: 'ice', kind: 'ice', p: [-74.385, 40.9613], title: 'Tripod Rock', when: 'left by the ice', year: -1.8e4,
    text: ['A boulder of Highlands gneiss weighing about 127 tonnes, balanced on three smaller stones on Pyramid Mountain in Kinnelon. The ice carried it and set it down there: a glacial erratic.', 'No calendar alignment has been found for it, whatever you may read.'],
    src: ['tripod'] },
  // ---- Lenape
  { id: 'lenape', era: 'lenape', kind: 'lenape', p: [-74.355, 40.913], title: 'Lenapehoking', when: 'for thousands of years', year: -1.0e4,
    text: ['This valley is part of Lenapehoking, the Lenape homeland. Around Montville it was home to Munsee-speaking Lenape for thousands of years before European settlement.', 'Boonton’s Main Street runs along the cliff above the river; it is said to follow an old Native American trail, which grew from a deer path along the hillside.', 'The Lenape are not only history: the Ramapough Lenape are honoured each October at Lenape Day at the Great Swamp.'],
    src: ['montville', 'boonton'] },
  { id: 'names', era: 'lenape', kind: 'lenape', p: [-74.4233, 40.8596], title: 'Names that stayed', when: 'Lenape words', year: -400, why: ['lenape'],
    text: ['Parsippany: from parsipanong, which the township gives as “the place where the river winds through the valley”.', 'Rockaway: a Native American word, but its meaning is uncertain: “place of sands”, “creek between two hills” and “bushy” or “difficult to cross” have all been offered.', 'Hopatcong: origin unknown; most often said to be Lenape for “stone water”. “Honey waters of many coves” was probably made up around 1900 to bring in tourists.', 'Pompton: named for the Pompton people, a Lenape group who lived there.'],
    src: ['parsip', 'rockaway', 'hopat', 'pompton'] },
  // ---- iron
  { id: 'old-boonton', era: 'iron', kind: 'iron', p: [-74.4077, 40.8832], title: 'Old Boonton', when: '1747 to 1904', year: 1747, why: ['iron', 'river'],
    text: ['About 1.5 miles downstream of today’s town, Obadiah Baldwin ran an iron forge from about 1747, using local ore, charcoal and the river’s power. By 1761 the forge village was called Boone-Towne, after the colonial governor Thomas Boone, the 7th royal governor of New Jersey.', 'Samuel Ogden founded the Boonton Iron Works about 1770; it made iron goods for the army in the Revolution. When the Morris Canal passed it by, the village emptied, and in 1904 Jersey City’s new dam drowned it under the Boonton Reservoir.'],
    src: ['boonton', 'boone', 'res'] },
  { id: 'hibernia', era: 'iron', kind: 'iron', p: [-74.4928, 40.9439], title: 'Hibernia', when: 'before the Revolution to 1916', year: 1765, why: ['iron'],
    text: ['A string of iron mines worked from before the Revolution until 1916. The village is named after Hibernia, the classical name for Ireland.', 'Today it is a quiet place of about 200 people.'],
    src: ['hibernia'] },
  { id: 'kinnelon', era: 'iron', kind: 'iron', p: [-74.3859, 40.982], title: 'Charlotteburg to Kinnelon', when: 'late 1600s to 1922', year: 1690, why: ['iron'],
    text: ['Iron forges and furnaces were built here from the late 17th century, in an area called Charlotteburg after Queen Charlotte, wife of George III.', 'In 1922 it became the borough of Kinnelon, a reworking of “Kinney Lawn”, Francis Kinney’s estate. Its Smoke Rise development is named from a translation of the Native American name for the mountains, where mist often rises at sunset.'],
    src: ['kinnelon'] },
  // ---- canal and the iron town
  { id: 'canal', era: 'canal', kind: 'canal', p: [-74.4064, 40.9038], title: 'The Morris Canal', when: '1829 to 1924', year: 1831, why: ['canal'],
    text: ['A 107-mile canal from Phillipsburg on the Delaware to Newark and later Jersey City, built to carry Pennsylvania coal to the iron towns and cities. It climbed and fell more than 900 ft in all, too much for locks alone.', 'So boats rode cradles on rails up and over the hills: 23 inclined planes, the first in the United States, powered by water. Inclined Plane 7 East was in Boonton, where Plane Street is now. Lake Hopatcong fed it water.', 'Railroads took its trade; it was leased to the Lehigh Valley Railroad in 1871, taken over by the state in 1922 and abandoned in 1924. Some stretches survive (on the map).'],
    src: ['canal', 'boonton'] },
  { id: 'boonton', era: 'canal', kind: 'canal', p: [-74.4064, 40.9038], title: 'Boonton: the iron town', when: '1830 to 1876', year: 1830, why: ['iron', 'canal', 'river'],
    text: ['The canal ran right past the falls of the Rockaway River, the 25-foot Boonton Falls at the head of the Boonton Gorge. In 1830 New York businessmen set up the New Jersey Iron Company there, with machines and ironworkers brought from England, and a new town grew on the hillside above the river.', 'It was a one-industry town. The ironworks flourished for nearly 50 years and closed in 1876; only foundations remain in the Hollow between Plane Street and the river.'],
    src: ['boonton', 'river'] },
  { id: 'wharton', era: 'canal', kind: 'canal', p: [-74.5745, 40.8971], title: 'Port Oram becomes Wharton', when: '1895 and 1902', year: 1895, why: ['iron', 'canal'],
    text: ['A town of iron mines, furnaces and the canal, made a borough in 1895 as Port Oram.', 'In 1902 it was renamed Wharton, after Joseph Wharton of the Wharton Steel Company, who had bought mines and furnaces nearby.'],
    src: ['wharton'] },
  // ---- after iron
  { id: 'reservoir', era: 'today', kind: 'water', p: [-74.4077, 40.8832], title: 'The Boonton Reservoir', when: '1904', year: 1904, why: ['water'],
    text: ['Jersey City dammed the Rockaway River in 1904, over the site of Old Boonton, for its water supply.', 'In 1908 it became the first city water supply in the United States to be chlorinated continuously, a system devised by John L. Leal.', 'In April 1904 a diver, William Hoar, was caught by the suction of an intake pipe while closing it, and died after 24 hours under water despite long rescue efforts.'],
    src: ['res'] },
  { id: 'plastics', era: 'today', kind: 'water', p: [-74.4064, 40.9038], title: 'After iron: plastic', when: '1907', year: 1907,
    text: ['After the ironworks closed, Boonton turned to silk, paper, nails and more. In 1907 the Loanda Hard Rubber Company, using Leo Baekeland’s new synthetic resin (later Bakelite), made what is described as the world’s first molding of organic plastic.', 'Boontonware plastic dinnerware followed, and radio companies came for the molded parts.'],
    src: ['boonton'] },
];
export const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** The iron chain, rock to ruin: one card per step. */
export const CHAIN = [
  { step: 'Rock', card: 'highlands', line: 'Highlands gneiss, more than a billion years old' },
  { step: 'Resource', card: 'highlands', line: 'Magnetite iron ore in the hills, charcoal from the woods' },
  { step: 'Industry', card: 'old-boonton', line: 'Forges from about 1747; the Iron Works about 1770' },
  { step: 'Town', card: 'boonton', line: 'The canal and the falls: the New Jersey Iron Company, 1830' },
  { step: 'Decline', card: 'canal', line: 'The ironworks close in 1876; railroads take the canal’s trade' },
  { step: 'Remains', card: 'reservoir', line: 'Foundations in the Hollow; Old Boonton under the reservoir' },
];

// ================================================================================================================================
// Second corridor: the Pine Barrens. Sources opened November 2026.
Object.assign(SRC, {
  pines: ['Wikipedia: New Jersey Pine Barrens', W('New_Jersey_Pine_Barrens')],
  batsto: ['Wikipedia: Batsto Village', W('Batsto_Village,_New_Jersey')],
  atsion: ['Wikipedia: Atsion, New Jersey', W('Atsion,_New_Jersey')],
  bog: ['Wikipedia: Bog iron', W('Bog_iron')],
  harris: ['Wikipedia: Harrisville, New Jersey', W('Harrisville,_New_Jersey')],
  indianmills: ['Wikipedia: Indian Mills, New Jersey', W('Indian_Mills,_New_Jersey')],
  jwharton: ['Wikipedia: Joseph Wharton', W('Joseph_Wharton')],
  wsf: ['Wikipedia: Wharton State Forest', W('Wharton_State_Forest')],
  byrne: ['Wikipedia: Brendan T. Byrne State Forest', W('Brendan_T._Byrne_State_Forest')],
  aquifer: ['Wikipedia: Kirkwood–Cohansey aquifer', W('Kirkwood%E2%80%93Cohansey_aquifer')],
  glassboro: ['Wikipedia: Glassboro, New Jersey', W('Glassboro,_New_Jersey')],
  allaire: ['Wikipedia: Allaire Village', W('Allaire_Village')],
  devil: ['Wikipedia: Jersey Devil', W('Jersey_Devil')],
  ongs: ['Wikipedia: Ong’s Hat, New Jersey', W('Ong%27s_Hat,_New_Jersey')],
  pact: ['Wikipedia: Pinelands Protection Act', W('Pinelands_Protection_Act')],
});
Object.assign(WHY, { bog: 'Bog iron', glass: 'Glass sand', berries: 'Cranberries and blueberries', cedar: 'Wood and charcoal' });

export const PINE_ERAS = [
  { id: 'p-today', when: 'Today', title: 'The quiet forest', line: 'Over a million protected acres, ghost towns in the woods, and an aquifer of very pure water under the sand.', center: [-74.60, 39.75], zoom: 9.3, pitch: 50 },
  { id: 'p-wharton', when: '1876–1954', title: 'Water and berries', line: 'A Philadelphia industrialist buys the forest for its water; cranberry and blueberry farms grow in the bogs.', center: [-74.62, 39.72], zoom: 9.2, pitch: 45 },
  { id: 'p-iron', when: '1740s–1860s', title: 'Bog iron and glass', line: 'Iron dug from the streams, charcoal from the pines, sand for glass: furnace villages deep in the woods.', center: [-74.65, 39.70], zoom: 9.0, pitch: 45 },
  { id: 'p-lenape', when: 'Before 1700 to 1822', title: 'The Lenape in the pines', line: 'Ten thousand years of Lenape life, then a reservation at Brotherton, then removal.', center: [-74.70, 39.75], zoom: 9.1, pitch: 40 },
  { id: 'p-sand', when: 'About 12 to 14 million years ago', title: 'The sugar sand', line: 'Sand laid down by rivers and the sea in the Miocene: the Cohansey Formation, the ground the whole forest stands on.', center: [-74.65, 39.65], zoom: 7.9, pitch: 25 },
];

export const PINE_CARDS = [
  { id: 'cohansey', era: 'p-sand', kind: 'rock', p: null, title: 'The Cohansey sand', when: 'middle Miocene, about 12 to 14 million years ago', year: -1.3e7,
    text: ['The Pine Barrens stand on the Cohansey Formation: white to yellow quartz sand with some gravel and clay, laid down in a mix of river and sea settings. Locals call it sugar sand.', 'In places it is stained red or orange-brown by iron oxides, or cemented into blocks of ironstone. Below it lies the older Kirkwood Formation, with more silt and clay.', 'A clay bed in the Cohansey near Millville holds fossil leaves, mostly of Alangium, a tree that no longer grows in eastern North America.'],
    src: ['sgmc', 'pines'] },
  { id: 'bog-iron', era: 'p-iron', kind: 'iron', p: null, title: 'Iron from the bogs', when: '1765 to the mid-1800s', year: 1765, why: ['bog'],
    text: ['Iron-bearing groundwater seeps out at springs and streams; meeting the air, the iron turns to rusty ferric compounds, helped along by iron bacteria. Over time it builds up as bog iron ore in the stream beds.', 'From 1765 bog ore was dug from the bogs, streams and waterways of the Pine Barrens and smelted with charcoal in about 35 furnaces. Their iron armed the Revolution, the War of 1812 and the Second Barbary War: Stephen Decatur sailed to Algiers with 24-pound cannons cast at Hanover Furnace in 1814.'],
    src: ['bog', 'pines'] },
  { id: 'batsto', era: 'p-iron', kind: 'iron', p: [-74.6478, 39.6417], title: 'Batsto', when: '1766 to 1867', year: 1766, why: ['bog', 'glass'],
    text: ['Charles Read found bog ore in the streams, pine for charcoal and water power from the Batsto River, and by the end of 1766 had built the Batsto Iron Works. It made pots and kettles, and supplies for the Continental Army in the Revolution.', 'The Richards family ran it from 1784 for about 90 years. In the mid-1800s demand for its iron fell; Batsto turned to glass without lasting success, and went bankrupt.', 'Its name is said to come from the Swedish bastu, a bathing place; the first bathers were probably Lenape.'],
    src: ['batsto', 'wsf'] },
  { id: 'atsion', era: 'p-iron', kind: 'iron', p: [-74.7261, 39.7425], title: 'Atsion', when: '1765 to 1774', year: 1774, why: ['bog'],
    text: ['Charles Read set up an iron forge at Atsion in 1765–66, fed with pig iron from his Batsto furnace downstream.', 'Short of money, he sold out in 1773 to three Philadelphia Quakers, who built Atsion its own furnace in 1774.'],
    src: ['atsion'] },
  { id: 'glass', era: 'p-iron', kind: 'iron', p: [-75.1114, 39.7001], title: 'Glass in the woods', when: '1779 onward', year: 1779, why: ['glass'],
    text: ['The Pine Barrens’ sand suited glassmaking. Glassboro was founded in 1779 by Solomon Stanger as “Glass Works in the Woods”, and is named for the industry.', 'A glassworks opened at Port Elizabeth in 1799, and Weymouth and Alloway had small glass factories in the 1800s.'],
    src: ['glassboro', 'pines'] },
  { id: 'allaire', era: 'p-iron', kind: 'iron', p: [-74.1289, 40.1586], title: 'Allaire', when: '1822 to 1846', year: 1822, why: ['bog'],
    text: ['A bog iron furnace on the north-east edge of the pines, renamed the Howell Works and bought in 1822 by James P. Allaire, who tried to make it a self-contained village.', 'The wood-burning furnace business collapsed in 1846 and the village closed. Its buildings survive as a historic village.'],
    src: ['allaire'] },
  { id: 'devil', era: 'p-iron', kind: 'legend', p: [-74.4292, 39.4919], title: 'The Jersey Devil (legend)', when: 'said to be 1735', year: 1735,
    text: ['A legend, not history. The story says that in 1735 Mrs. Leeds of Leeds Point gave birth to her 13th child, cursed for the unlucky number, which turned into a monster and flew up the chimney into the Barrens.', 'It is usually described with hooves, leathery bat-like wings, a horse- or goat-like head and a forked tail, and a blood-curdling scream. The pines have other ghost stories too: the Black Dog, Captain Kidd’s ghost and the Blue Hole.'],
    src: ['devil', 'pines'] },
  { id: 'lenape-pines', era: 'p-lenape', kind: 'lenape', p: null, title: 'Ten thousand years', when: 'from about 10,000 years ago', year: -1.0e4, why: ['lenape'],
    text: ['The ancestors of the Lenape lived in the Pine Barrens from about 10,000 years ago.', 'They burned the woods in spring and fall to clear underbrush and improve plants and hunting. The sandy soil never drew permanent farming, so the forest stayed.'],
    src: ['pines'] },
  { id: 'brotherton', era: 'p-lenape', kind: 'lenape', p: [-74.7444, 39.7939], title: 'Brotherton', when: '1758 to 1822', year: 1758, why: ['lenape'],
    text: ['In 1758 a reservation for the Lenape was set up at Brotherton, now Indian Mills (also called Edgepillock). Colonists led by the Reverend John Brainerd moved about 200 people there by force. It was the only Indian reservation in New Jersey, and is often called the first in America.', 'In 1798 Munsee Lenape leaders, Bartholomew Calvin, Jason Skekit and 18 others, signed a refusal to leave “our fine place in Jersey”. In 1801 many families agreed to move to New Stockbridge, New York, to join the Oneidas; in 1822 the rest were forced out again, to Green Bay, Wisconsin.'],
    src: ['indianmills', 'pines'] },
  { id: 'wharton-water', era: 'p-wharton', kind: 'water', p: [-74.6478, 39.6417], title: 'Wharton’s water', when: '1876 to 1954', year: 1876, why: ['water'],
    text: ['In 1876 the Philadelphia industrialist Joseph Wharton bought Batsto, and over the years about 150 square miles of the pines, for the pure water under them. He planned to send it to Philadelphia.', 'Opposition rose on both sides of the river, and in 1884 the New Jersey legislature passed a law banning the export of water from the state. Wharton farmed cranberries and cut timber instead.', 'In 1954 New Jersey bought the estate: Wharton State Forest, now the largest in the state park system.'],
    src: ['jwharton', 'batsto', 'wsf'] },
  { id: 'whitesbog', era: 'p-wharton', kind: 'water', p: null, title: 'The blueberry', when: 'Whitesbog, from the 1870s', year: 1875, why: ['berries'],
    text: ['Whitesbog, a company town founded in the 1870s by Joseph J. White, became one of the largest cranberry and blueberry farms in the state.', 'The cultivated blueberry, a hybrid of the wild Vaccinium caesariense of the pines, was developed and sold from here by Elizabeth Coleman White and Frank Coville. The village is in Brendan T. Byrne State Forest.'],
    src: ['byrne'] },
  { id: 'harrisville', era: 'p-today', kind: 'iron', p: [-74.5219, 39.6614], title: 'Harrisville, a ghost town', when: '1760 to 1914', year: 1914, why: ['cedar'],
    text: ['A sawmill by 1760 on the Oswego River; in 1795 a slitting mill, cutting iron from Martha Furnace upstream into strips for nails; about 1815 a paper mill. The Harris family bought it in 1855 and ran it as a company town, with a store, a post office and free houses for the mill workers.', 'In 1914 a fire destroyed the whole town. Only decayed ruins remain.'],
    src: ['harris'] },
  { id: 'ongs-hat', era: 'p-today', kind: 'legend', p: [-74.6208, 39.9108], title: 'Ong’s Hat', when: 'a ghost town and its name',
    text: ['A ghost town with a famous name. The folk story: a dandy named Ong had his silk hat stomped at a dance, threw it in the air, and it caught high in a pine.', 'The likelier answer is plainer: it may first have been Ong’s Hut, a farmer’s overnight shelter. Ong was a common name among early settlers.'],
    src: ['ongs'] },
  { id: 'aquifer', era: 'p-today', kind: 'water', p: null, title: 'The water under the sand', when: 'today', year: 2024, why: ['water'],
    text: ['Under the pines lies the Kirkwood–Cohansey aquifer, about 3,000 square miles, estimated at 17 trillion gallons, some of the purest water in the country.', 'The Cohansey sand on top soaks up rain; the siltier, clayey Kirkwood beneath holds it. Of about 44 inches of rain a year, some 17 to 20 inches sinks into the ground. It feeds the cedar swamps, the cranberry bogs and nearly 1,000 big wells.'],
    src: ['aquifer', 'pines'] },
  { id: 'fire', era: 'p-today', kind: 'rock', p: null, title: 'A forest made by fire', when: 'today',
    text: ['The name “barrens” comes from the sandy, acidic, poor soil: settlers’ crops would not grow. Instead it holds orchids, carnivorous plants and the pygmy pitch pines of the Pine Plains.', 'Fire has shaped the forest since before people came, and some plants need frequent fires to reproduce.'],
    src: ['pines'] },
  { id: 'protect', era: 'p-today', kind: 'water', p: null, title: 'Saved from the jetport', when: '1978 and 1979', year: 1978,
    text: ['In 1969 the Pine Barrens had about 15 people per square mile, against 1,000 in the lands around them, and there were plans for a jetport and a new city in the pines.', 'In 1978 Congress made the Pinelands the country’s first National Reserve, about 1.1 million acres. In 1979 Governor Brendan Byrne halted building there and the state passed the Pinelands Protection Act. UNESCO named it a biosphere reserve in 1983.'],
    src: ['pines', 'pact'] },
];

export const PINE_CHAIN = [
  { step: 'Rock', card: 'cohansey', line: 'The Cohansey sand, stained and cemented by iron in places' },
  { step: 'Resource', card: 'bog-iron', line: 'Bog ore in the stream beds; pines for charcoal' },
  { step: 'Industry', card: 'batsto', line: 'Batsto Iron Works, 1766; about 35 furnaces in the pines' },
  { step: 'Town', card: 'batsto', line: 'Furnace villages: Batsto, Atsion, Allaire' },
  { step: 'Decline', card: 'allaire', line: 'Demand falls in the mid-1800s; Allaire closes in 1846, Batsto goes bankrupt' },
  { step: 'Remains', card: 'harrisville', line: 'Ghost towns and restored villages in a protected forest' },
];

/** The corridors: each with its own stops, cards and chain. */
export const CORRIDORS = [
  { id: 'boonton', name: 'Boonton and the Rockaway', eras: ERAS, cards: CARDS, chain: CHAIN, chainName: 'The iron chain', end: 'A billion years ago' },
  { id: 'pine', name: 'The Pine Barrens', eras: PINE_ERAS, cards: PINE_CARDS, chain: PINE_CHAIN, chainName: 'The bog iron chain', end: '13 million years ago' },
];
for (const c of PINE_CARDS) CARD[c.id] = c;

// ================================================================================================================================
// The big picture: the story from the oldest rock forward, at the scale of the whole region, and the land as it is today. Regions from
// the USGS physiographic map (Fenneman and Johnson, 1946), drawn past the state line. Sources opened November 2026.
Object.assign(SRC, {
  physio: ['USGS Physiographic Divisions of the Conterminous U.S. (Fenneman and Johnson, 1946)', 'https://water.usgs.gov/GIS/metadata/usgswrd/XML/physio.xml'],
  reading: ['Wikipedia: Reading Prong', W('Reading_Prong')],
  grenville: ['Wikipedia: Grenville orogeny', W('Grenville_orogeny')],
  taconic: ['Wikipedia: Taconic orogeny', W('Taconic_orogeny')],
  allegh: ['Wikipedia: Alleghanian orogeny', W('Alleghanian_orogeny')],
  ridge: ['Wikipedia: Ridge-and-Valley Appalachians', W('Ridge-and-Valley_Appalachians')],
  kitt: ['Wikipedia: Kittatinny Mountain', W('Kittatinny_Mountain')],
  gunks: ['Wikipedia: Shawangunk Ridge', W('Shawangunk_Ridge')],
  bluemtn: ['Wikipedia: Blue Mountain (Pennsylvania)', W('Blue_Mountain_(Pennsylvania)')],
  newark: ['Wikipedia: Newark Basin', W('Newark_Basin')],
  palisades: ['Wikipedia: Palisades Sill', W('Palisades_Sill')],
  atl: ['Wikipedia: Atlantic Plain', W('Atlantic_Plain')],
  poconos: ['Wikipedia: Pocono Mountains', W('Pocono_Mountains')],
  laurentide: ['Wikipedia: Laurentide ice sheet', W('Laurentide_ice_sheet')],
  harbor: ['Wikipedia: Harbor Hill Moraine', W('Harbor_Hill_Moraine')],
  lenapehoking: ['Wikipedia: Lenapehoking', W('Lenapehoking')],
});

/** The land today: the regions New Jersey shares with its neighbours, each shown whole. close: cards that show it up close. */
export const LAND = [
  { id: 'valleyridge', color: '#8f9a55', name: 'Valley and Ridge', nj: 'The far north-west: Kittatinny Mountain and the valleys either side',
    text: ['Long, parallel ridges and valleys of folded rock, part of the Appalachian Mountains. The province runs from south-eastern New York through north-western New Jersey and Pennsylvania, south into Maryland, Virginia and Tennessee, as far as Georgia and Alabama.', 'Its first big ridge is one ridge with three names: the Shawangunk Ridge in New York, Kittatinny Mountain in New Jersey, and Blue Mountain in Pennsylvania, which runs on 150 miles from the Delaware Water Gap to Big Gap. High Point, on Kittatinny Mountain, is New Jersey’s highest place at 1,803 ft.', 'For walkers and horses heading west, these ridges were a barrier that was almost impossible to cross.'],
    src: ['physio', 'ridge', 'kitt', 'gunks', 'bluemtn'], close: ['green-pond'] },
  { id: 'highlands', color: '#c27a52', name: 'The Highlands (Reading Prong)', nj: 'A belt across the north, from the Delaware to the New York line',
    text: ['Mountains of crystalline metamorphic rock, more than a billion years old: part of the Precambrian basement that shows through here and there in the Appalachians.', 'It runs from near Reading, Pennsylvania, where it is called South Mountain, across New Jersey and New York as the New York–New Jersey Highlands (the Hudson Highlands by the river), into Connecticut as the Housatonic Highlands.', 'Its rock holds iron ore, which built the iron towns, and also uranium, whose decay gives off radon, a known indoor hazard on the prong.'],
    src: ['physio', 'reading', 'sgmc'], close: ['highlands', 'old-boonton', 'hibernia'] },
  { id: 'piedmont', color: '#b9503c', name: 'Piedmont Lowlands: the rift basins', nj: 'The middle: Newark, Paterson, New Brunswick, Trenton',
    text: ['Valleys that opened about 200 million years ago as Pangaea broke apart, filled with red sandstone and shale. New Jersey’s, the Newark Basin, reaches into south-eastern Pennsylvania and southern New York; it is one of a chain of rift basins down the East Coast.', 'Lava flooded the basin three times: the three Watchung ridges. Molten rock that cooled underground became the Palisades Sill, which runs through New Jersey and New York along the Hudson.'],
    src: ['physio', 'newark', 'palisades', 'watchung'], close: ['watchungs', 'lake-passaic'] },
  { id: 'coastal', color: '#d8c27a', name: 'Coastal Plain', nj: 'Everything south-east of a line from about Trenton to Perth Amboy',
    text: ['Sand, clay and gravel laid down over the last hundred million years and more, tilting gently out under the sea. It is part of the flattest region in the country, the Atlantic Plain, which runs over 2,200 miles from Cape Cod to the Mexican border.', 'In New Jersey it holds the Pine Barrens, on the Cohansey sand, and the aquifer of very pure water beneath them.'],
    src: ['physio', 'atl', 'sgmc'], close: ['cohansey', 'aquifer', 'batsto'] },
  { id: 'upland', color: '#c9a37c', name: 'Piedmont Upland', nj: 'Barely in New Jersey: just touches the Delaware by Trenton',
    text: ['Older, harder rock of rolling uplands. On the USGS map it starts at the Delaware by Trenton and runs south-west through Pennsylvania, Maryland and Virginia all the way to Alabama.'],
    src: ['physio'], close: [] },
  { id: 'plateau', color: '#8faa96', name: 'Appalachian Plateaus (Poconos, Catskills)', nj: 'Not in New Jersey: just across the Delaware',
    text: ['High, flat-lying rock cut into hills by rivers. The Poconos, across the Delaware Water Gap, are not really a mountain range but a plateau of about 2,400 square miles, part of the Allegheny Plateau, edged by an escarpment.', 'Their name comes from the Munsee word Pokawachne, “creek between two hills”.'],
    src: ['physio', 'poconos'], close: [] },
];

/** The story, from the oldest rock forward. scene: what the map shows. cam: [lon, lat, zoom]. */
export const STORY = [
  { id: 's-oldest', when: 'More than a billion years ago', title: 'The oldest rock',
    text: ['The story starts deep underground, with the rock of the Highlands: gneiss and granite more than a billion years old, from the same era as the Grenville mountain-building, which built a belt of mountains from Labrador to Mexico while an earlier supercontinent came together.', 'Today that rock runs as a belt of hills from Reading, Pennsylvania, across northern New Jersey into New York and Connecticut. It holds New Jersey’s iron ore.'],
    scene: { prov: { highlands: 0.8 }, provFaint: 0.06 }, cam: [-74.9, 40.95, 6.6], src: ['grenville', 'reading', 'sgmc', 'physio'], close: ['highlands'], land: 'highlands' },
  { id: 's-mountains', when: 'About 450 to 260 million years ago', title: 'Mountains rise, twice',
    text: ['Sand, mud and lime settle in shallow seas. Then continents collide. The Taconic mountain-building, which ended about 440 million years ago, raised a great chain from eastern Canada down the East Coast; as it wore away, its sediment spread across the Appalachians.', 'From about 325 to 260 million years ago Africa crashed into North America, forming the supercontinent Pangaea and folding the Appalachians into the long ridges and valleys you can see on the map, from Alabama to New Jersey and on into New York.'],
    scene: { prov: { valleyridge: 0.8, plateau: 0.35 }, provFaint: 0.05 }, cam: [-77.2, 39.8, 5.4], src: ['taconic', 'allegh', 'ridge', 'physio'], close: ['green-pond'], land: 'valleyridge' },
  { id: 's-rift', when: 'About 200 million years ago', title: 'Pangaea tears apart',
    text: ['The supercontinent starts to split and the Atlantic begins to open. Long valleys crack open down the East Coast: rift basins, the red patches on the map. New Jersey’s, the Newark Basin, runs into Pennsylvania and New York.', 'Lava floods the Newark Basin three times, making the three Watchung ridges; molten rock squeezes between the layers and cools underground as the Palisades.'],
    scene: { prov: { piedmont: 0.75 }, provFaint: 0.05 }, cam: [-75.6, 40.0, 6.1], src: ['newark', 'watchung', 'palisades', 'physio'], close: ['watchungs'], land: 'piedmont' },
  { id: 's-coast', when: 'The last 100 million years', title: 'The coastal plain builds',
    text: ['As the Atlantic widens, rivers and the sea lay down sand, clay and gravel along its edge, layer on layer. They make the Coastal Plain, part of the flattest land in the country, from Cape Cod to Mexico.', 'One of the youngest layers, the Cohansey sand of about 12 to 14 million years ago (yellow on the map), is the ground the Pine Barrens stand on.'],
    scene: { prov: { coastal: 0.6 }, provFaint: 0.05, sand: 0.75 }, cam: [-75.4, 39.2, 5.8], src: ['atl', 'sgmc', 'physio'], close: ['cohansey'], land: 'coastal' },
  { id: 's-ice', when: 'About 20,000 years ago', title: 'The ice sheet',
    text: ['The Laurentide ice sheet, which covered most of Canada and much of the northern United States, reaches its last farthest point about 20,000 years ago. Its edge reaches New York City and Long Island, where the ridges of the moraines it dumped still run along the island.', 'In New Jersey it stops on a line from Perth Amboy past Morristown to Belvidere (the dark blue line). The thinner blue lines are the edges of this and older advances across New York and Pennsylvania.'],
    scene: { iceSheet: 0.85, iceLimit: 1, iceLines: 0.8 }, cam: [-75.0, 41.1, 6.3], src: ['laurentide', 'harbor', 'i1420'], close: ['moraine', 'tripod'] },
  { id: 's-lake', when: 'About 19,000 to 14,000 years ago', title: 'Glacial Lake Passaic',
    text: ['As the ice melts back, its meltwater is trapped behind the Watchung ridges and the moraine: a lake up to about 300 ft deep, from Wayne to Liberty Corner.', 'When lower gaps open the lake drains away, and the Passaic River takes a new, roundabout route over the Great Falls. Its old floor is the Great Swamp and the meadows around it.'],
    scene: { lake: 'moggy', flows: 0.45, iceLimit: 0.9 }, cam: [-74.45, 40.82, 9.1], src: ['passaic', 'i2540'], close: ['lake-passaic', 'great-notch', 'swamp'] },
  { id: 's-people', when: 'From at least 10,000 years ago', title: 'The Lenape',
    text: ['People follow the ice. The ancestors of the Lenape live here from at least 10,000 years ago, in a homeland called Lenapehoking, which stretched from western Connecticut to Delaware: the Delaware and lower Hudson valleys and all the land between them, New Jersey included.', 'Their names are still on the map: Parsippany, Hopatcong, Pompton, the Poconos. And their history goes on: from a reservation at Brotherton in 1758 to forced removals in 1801 and 1822, and Lenape communities today.'],
    scene: { pins: ['lenape', 'names', 'brotherton'] }, cam: [-74.6, 40.3, 7.2], src: ['lenapehoking', 'pines', 'montville', 'indianmills', 'poconos'], close: ['lenape', 'names', 'brotherton', 'lenape-pines'] },
  { id: 's-iron', when: '1700s and 1800s', title: 'Iron, canals and glass',
    text: ['The rocks decide the industry. In the Highlands, iron ore from the billion-year-old rock, charcoal from the woods and water power make forges and iron towns; the Morris Canal carries coal across the hills to them.', 'In the Pine Barrens, iron comes from the bogs, where iron-rich groundwater seeps out, and the sand itself makes glass. Furnace villages grow deep in the woods.'],
    scene: { canal: 0.95, pins: ['old-boonton', 'hibernia', 'canal', 'batsto', 'atsion', 'glass', 'allaire'] }, cam: [-74.55, 40.25, 7.3], src: ['boonton', 'canal', 'batsto', 'bog'], close: ['boonton', 'canal', 'bog-iron', 'batsto'] },
  { id: 's-today', when: 'Today', title: 'What is left',
    text: ['When iron from elsewhere became easier to get, the furnaces went cold. What is left: foundations in the woods, ghost towns, a village drowned under a reservoir, canal stretches, and a protected forest over an aquifer of very pure water.', 'Go closer: the close-ups follow the story step by step in two places, Boonton in the Highlands and the Pine Barrens.'],
    scene: { canal: 0.8, pins: ['reservoir', 'swamp', 'harrisville', 'wharton-water'] }, cam: [-74.55, 40.25, 7.3], src: ['res', 'harris', 'pact', 'wsf'], close: ['reservoir', 'harrisville', 'protect', 'aquifer'] },
];
