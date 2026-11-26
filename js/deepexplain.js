// Deep Jersey: "How it works". Short illustrated explainers for the ideas the story leans on (an ice sheet, a moraine, a glacial lake,
// a rift valley, why hard rock makes ridges ...). Each is a side-on slice through the ground in two to four steps, one or two plain
// sentences each; what is new in a step slides in. Words checked against the sources listed (opened November 2026). Comparisons marked
// "like" are illustrations, not geology.

const W = (t) => `https://en.wikipedia.org/wiki/${t}`;
export const EX_SRC = {
  icesheet: ['Wikipedia: Ice sheet', W('Ice_sheet')], iceshelf: ['Wikipedia: Ice shelf', W('Ice_shelf')], glacier: ['Wikipedia: Glacier', W('Glacier')],
  laurentide: ['Wikipedia: Laurentide ice sheet', W('Laurentide_ice_sheet')], moraine: ['Wikipedia: Moraine', W('Moraine')],
  i2540: ['USGS I-2540-C, Surficial Geologic Map of Northern New Jersey', 'https://pubs.usgs.gov/publication/i2540C'],
  proglacial: ['Wikipedia: Proglacial lake', W('Proglacial_lake')], passaic: ['Wikipedia: Lake Passaic', W('Lake_Passaic')],
  erratic: ['Wikipedia: Glacial erratic', W('Glacial_erratic')], tripod: ['Wikipedia: Tripod Rock', W('Tripod_Rock')],
  rift: ['Wikipedia: Rift valley', W('Rift_valley')], newark: ['Wikipedia: Newark Basin', W('Newark_Basin')], sill: ['Wikipedia: Sill (geology)', W('Sill_(geology)')],
  palisades: ['Wikipedia: Palisades Sill', W('Palisades_Sill')], ridge: ['Wikipedia: Ridge-and-Valley Appalachians', W('Ridge-and-Valley_Appalachians')],
  collision: ['Wikipedia: Continental collision', W('Continental_collision')], allegh: ['Wikipedia: Alleghanian orogeny', W('Alleghanian_orogeny')],
  atl: ['Wikipedia: Atlantic Plain', W('Atlantic_Plain')], pines: ['Wikipedia: New Jersey Pine Barrens', W('New_Jersey_Pine_Barrens')],
  aquifer: ['Wikipedia: Aquifer', W('Aquifer')], kc: ['Wikipedia: Kirkwood–Cohansey aquifer', W('Kirkwood%E2%80%93Cohansey_aquifer')],
  bog: ['Wikipedia: Bog iron', W('Bog_iron')],
  camp: ['Wikipedia: Central Atlantic magmatic province', W('Central_Atlantic_magmatic_province')], watchung: ['Wikipedia: Watchung Mountains', W('Watchung_Mountains')],
  diabase: ['Wikipedia: Diabase', W('Diabase')], columns: ['Wikipedia: Columnar jointing', W('Columnar_jointing')], flood: ['Wikipedia: Flood basalt', W('Flood_basalt')],
};

// ---- drawing ---------------------------------------------------------------------------------------------------------------------
const C = { sky: '#eef4f7', soil: '#b88a5c', rock: '#8a6c55', rock2: '#a07e62', red: '#b5634a', red2: '#c97b5f', ice: '#eaf5fc', iceLine: '#93bfdc',
  water: '#4b8fc8', lava: '#c8462c', sand: '#e3c56c', clay: '#8f8273', snow: '#ffffff', text: '#2a241b', arrow: '#2a241b', iron: '#b5541e' };
const svg = (body, label) => `<svg class="ex-svg" viewBox="0 0 360 190" role="img" aria-label="${label}"><rect width="360" height="190" fill="${C.sky}"/>${body}</svg>`;
const p = (d, fill, cls = '', extra = '') => `<path class="${cls}" d="${d}" fill="${fill}" ${extra}/>`;
const t = (x, y, s, cls = '', anchor = 'middle') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}" font-size="12" font-weight="600" fill="${C.text}">${s}</text>`;
const arrow = (x1, y1, x2, y2, cls = '', col = C.arrow) => { const a = Math.atan2(y2 - y1, x2 - x1), h = 7;
  return `<g class="${cls}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.2" stroke-linecap="round"/><path d="M${x2} ${y2} L${x2 - h * Math.cos(a - 0.45)} ${y2 - h * Math.sin(a - 0.45)} L${x2 - h * Math.cos(a + 0.45)} ${y2 - h * Math.sin(a + 0.45)}Z" fill="${col}"/></g>`; };
const rocks = (pts, cls = '') => pts.map(([x, y, r = 4]) => `<circle class="${cls}" cx="${x}" cy="${y}" r="${r}" fill="#6d5544"/>`).join('');
/** A folded layer k: the band between two matching sine curves. */
const FOLD_COL = ['#a9b27a', '#c9b48c', '#6f7d3a', '#d8c79c'];
const foldBand = (k, A, cls = '') => { const yT = (x) => 190 - (k + 1) * 18 - A * Math.sin((x / 180) * 2 * Math.PI), yB = (x) => 190 - k * 18 - A * Math.sin((x / 180) * 2 * Math.PI);
  const xs = Array.from({ length: 61 }, (_, i) => i * 6), top = xs.map((x) => `${x} ${yT(x).toFixed(1)}`), bot = xs.reverse().map((x) => `${x} ${yB(x).toFixed(1)}`);
  return p(`M${top.join(' L')} L${bot.join(' L')}Z`, FOLD_COL[k], cls); };
/** Coastal Plain wedges: layer k lies on the slope from the shore out to sea, thickening seaward. */
const slope = (x) => 118 + ((x - 100) * 52) / 260;
const TH = 0.026, thk = (j, x) => Math.max(0, (x - (100 + j * 22)) * TH), surf = (n, x) => slope(x) - [0, 1, 2, 3].slice(0, n).reduce((a, j) => a + thk(j, x), 0);
const wedge = (k, cls = '') => { const x0 = 100 + k * 22, th = (x) => thk(k, x);
  const xs = Array.from({ length: 41 }, (_, i) => x0 + (i * (360 - x0)) / 40), below = (x) => surf(k, x);
  const top = xs.map((x) => `${x.toFixed(1)} ${(below(x) - th(x)).toFixed(1)}`), bot = [...xs].reverse().map((x) => `${x.toFixed(1)} ${below(x).toFixed(1)}`);
  return p(`M${top.join(' L')} L${bot.join(' L')}Z`, k % 2 ? C.clay : C.sand, cls, `stroke="#a8946a" stroke-width="0.6"`); };
/** The sea over the top of n coastal layers, from x0 out, its surface at y0. */
const sea = (n, x0, y0, cls = '') => { const xs = Array.from({ length: 31 }, (_, i) => x0 + (i * (360 - x0)) / 30).filter((x) => surf(n, x) > y0);
  return xs.length ? p(`M${xs[0].toFixed(1)} ${y0} L360 ${y0} L${[...xs].reverse().map((x) => `${x.toFixed(1)} ${surf(n, x).toFixed(1)}`).join(' L')}Z`, C.water, cls, 'opacity="0.75"') : ''; };
/** The worn-down surface over the folds: low (122) over soft rock, up to 22 higher where the hard layer (band 2) comes to the surface.
 * Band 2 meets y = 122 where sin(2 pi x / 180) >= 0.64: x from about 20 to 70, and 200 to 250. Everything above is sky. */
const worn = (cls = '') => { const xs = Array.from({ length: 61 }, (_, i) => i * 6), bump = (x) => { const m = ((x % 180) + 180) % 180; return m > 14 && m < 76 ? Math.sin(((m - 14) / 62) * Math.PI) : 0; };
  return p(`M0 0 L360 0 L${[...xs].reverse().map((x) => `${x} ${(122 - 22 * bump(x)).toFixed(1)}`).join(' L')}Z`, C.sky, cls); };
const ground = (d = 'M0 150 L360 150 L360 190 L0 190Z') => p(d, C.rock);


// ---- the lava: the Newark Basin, side on (west on the left, the Ramapo Fault at its edge; not to scale) -------------------------------
const L = { hot: '#ff8a1f', core: '#ffd23f', cold: '#2f2a2b', mud: '#c97b5f' };
const redBeds = (top = 100) => p(`M30 ${top} L360 ${top} L360 190 L42 190Z`, C.red) + [0, 1, 2, 3, 4].map((k) => p(`M${30 + (top + 18 * k + 9 - top) * 0.13} ${top + 18 * k + 9} L360 ${top + 18 * k + 9} L360 ${top + 18 * k + 18} L${30 + (18 * k + 18) * 0.13} ${top + 18 * k + 18}Z`, C.red2)).join('');
const border = () => p('M0 40 L30 40 L44 190 L0 190Z', C.rock) + `<line x1="30" y1="40" x2="44" y2="190" stroke="#3d2f25" stroke-width="2"/>`;
const hot = (d, cls = '') => p(d, L.hot, `ex-glow ${cls}`);
const sheet = (y0, y1, x0 = 38, cls = '', fill = L.cold) => p(`M${x0} ${y0} L360 ${y0} L360 ${y1} L${x0 + 1} ${y1}Z`, fill, cls);
const fountains = (y, cls = '') => [90, 150, 205, 265, 320].map((x, i) => `<path class="ex-fount ${cls}" style="animation-delay:${(i * 0.17).toFixed(2)}s" d="M${x - 9} ${y} Q${x} ${y - 46 - (i % 2) * 14} ${x + 9} ${y}Z" fill="${L.hot}"/><path class="ex-fount" style="animation-delay:${(i * 0.17 + 0.1).toFixed(2)}s" d="M${x - 4} ${y} Q${x} ${y - 28 - (i % 2) * 8} ${x + 4} ${y}Z" fill="${L.core}"/>`).join('');
const cracks = (y0, y1, cls = '') => `<g class="${cls}" stroke="#151213" stroke-width="0.9">${Array.from({ length: 40 }, (_, i) => 44 + i * 8).map((x) => `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>`).join('')}</g>`;
const dikes = (yTop, cls = '') => `<g class="ex-glow ${cls}" stroke="${L.hot}" stroke-width="3.2" stroke-linecap="round" fill="none"><path d="M120 190 L124 ${yTop}"/><path d="M215 190 L210 ${yTop}"/><path d="M300 190 L304 ${yTop}"/></g>`;
const deep = (cls = '') => hot('M40 190 Q200 168 360 182 L360 190Z', cls);
const side = (y, s) => `<text x="5" y="${y}" font-size="11" font-weight="700" fill="#fff">${s}</text>`;
const lavaSvg = (body, label) => svg(border() + body, label);
// the end: tilted layers worn down (each layer's top rises to the east at 0.35 per unit; the hard ones stand up as ridges, cliffs facing east)
const TILT = 0.35, ERODE = 118;
const tBand = (c, th, fill, cls = '') => p(`M0 ${c - th} L360 ${c - th - TILT * 360} L360 ${c - TILT * 360} L0 ${c}Z`, fill, cls);
const HARD = [[150, 9, 'Third'], [171, 9, 'Second'], [192, 9, 'First'], [227, 16, 'Palisades']];
const ridgeSurface = () => { let d = `M0 0 L360 0 L360 ${ERODE}`; const pts = [];
  for (const [c, th, , h = 14] of [...HARD].reverse().map((r) => [...r, r[2] === 'Palisades' ? 22 : 14])) { const xa = (c - th - ERODE) / TILT, xb = xa + h / TILT; pts.push(`L${xb.toFixed(1)} ${ERODE} L${xb.toFixed(1)} ${(ERODE - h).toFixed(1)} L${xa.toFixed(1)} ${ERODE}`); }
  return p(d + ' ' + pts.join(' ') + ` L0 ${ERODE} Z`, C.sky); };
const ridgeX = (c, th, h) => (c - th - ERODE) / TILT + h / TILT / 2;

// each explainer: title, steps [{ draw: svg string, text }], src keys. 'ex-in' marks what is new in that step (it slides in).
export const EXPLAIN = {
  icesheet: { title: 'What is an ice sheet?', src: ['icesheet', 'glacier', 'laurentide', 'iceshelf'], steps: [
    { text: 'Where more snow falls each winter than melts each summer, it piles up, year after year, for centuries.',
      draw: svg(ground('M0 150 Q90 138 180 146 T360 142 L360 190 L0 190Z') + [0, 1, 2, 3].map((k) => p(`M60 ${146 - k * 7} Q180 ${130 - k * 9} 300 ${144 - k * 7} L300 ${148 - k * 7} Q180 ${136 - k * 9} 60 ${150 - k * 7}Z`, C.snow, k === 3 ? 'ex-in' : '', `stroke="${C.iceLine}" stroke-width="0.8"`)).join('') + t(180, 40, 'snow piles up, layer on layer'), 'Snow piling up in layers') },
    { text: 'The weight presses the old snow into ice. Once it is thick enough, the ice slowly flows outward under its own weight, like very thick batter spreading in a pan.',
      draw: svg(ground('M0 150 Q90 138 180 146 T360 142 L360 190 L0 190Z') + p('M40 150 Q180 40 320 148 Z', C.ice, 'ex-in', `stroke="${C.iceLine}" stroke-width="1.5"`) + arrow(170, 100, 90, 130, 'ex-in') + arrow(190, 100, 270, 130, 'ex-in') + t(180, 30, 'ice flows outward from the middle'), 'An ice dome flowing outward') },
    { text: 'The last one, the Laurentide ice sheet, covered most of Canada. It was up to about 3 km (2 miles) thick in Quebec, and much thinner at its edges, where it reached New Jersey.',
      draw: svg(ground('M0 158 L360 158 L360 190 L0 190Z') + p('M0 158 L0 60 Q80 40 200 70 Q290 100 330 158 Z', C.ice, 'ex-in', `stroke="${C.iceLine}" stroke-width="1.5"`) + `<line x1="40" y1="60" x2="40" y2="158" stroke="${C.arrow}" stroke-dasharray="3 3"/>` + t(46, 110, 'up to 3 km', '', 'start') + t(40, 52, 'Quebec') + t(318, 176, 'New Jersey', 'ex-in') + arrow(318, 150, 318, 162, 'ex-in'), 'The Laurentide ice sheet from Quebec to New Jersey') },
    { text: 'An ice sheet sits on land. An ice shelf is something else: the floating edge of one, where it pushes out over the sea. New Jersey’s ice was the land kind.',
      draw: svg(ground('M0 150 L200 150 L200 190 L0 190Z') + p('M200 160 L360 160 L360 190 L200 190Z', C.water) + p('M0 150 L0 70 Q120 70 200 140 L330 150 L330 162 L200 162 Z', C.ice, '', `stroke="${C.iceLine}" stroke-width="1.5"`) + p('M200 140 L330 150 L330 162 L200 162 Z', '#f6fbfe', 'ex-in', `stroke="${C.iceLine}" stroke-width="1.5"`) + t(80, 120, 'ice sheet: on land') + t(272, 135, 'ice shelf: floating', 'ex-in'), 'An ice sheet on land and an ice shelf floating on the sea') },
  ] },
  moraine: { title: 'How the ice leaves a ridge (a moraine)', src: ['moraine', 'i2540'], steps: [
    { text: 'As the ice flows it scrapes up soil and rock, from sand to boulders, and carries them along inside it.',
      draw: svg(ground() + p('M0 150 L0 70 Q160 70 260 150 Z', C.ice, '', `stroke="${C.iceLine}" stroke-width="1.5"`) + rocks([[40, 135], [80, 128, 5], [120, 140], [160, 132, 3], [200, 142, 5]], 'ex-in') + arrow(60, 110, 150, 110, 'ex-in') + t(120, 50, 'rock and soil carried in the ice'), 'Ice carrying rock') },
    { text: 'At its edge the ice melts as fast as it arrives. While the edge stays in one place, the ice keeps dropping its load there, like a conveyor belt tipping onto one pile.',
      draw: svg(ground() + p('M0 150 L0 70 Q160 70 250 150 Z', C.ice, '', `stroke="${C.iceLine}" stroke-width="1.5"`) + p('M235 150 Q262 112 292 150 Z', C.soil, 'ex-in') + rocks([[255, 140, 4], [270, 132, 3], [262, 145, 3]], 'ex-in') + arrow(150, 120, 225, 135) + t(262, 100, 'a pile at the edge', 'ex-in'), 'Rock piling up at the ice edge') },
    { text: 'When the ice melts away, the pile is left as a long ridge across the land: a terminal moraine, marking the farthest the ice reached. In New Jersey it is up to 225 ft thick.',
      draw: svg(ground() + p('M215 150 Q262 104 305 150 Z', C.soil) + rocks([[255, 140, 4], [270, 130, 3], [262, 145, 3], [285, 142, 3]]) + p('M0 150 L0 130 Q60 128 110 150 Z', C.ice, 'ex-in', `stroke="${C.iceLine}" stroke-width="1.5"`) + t(262, 90, 'terminal moraine') + t(60, 115, 'ice melting back', 'ex-in'), 'A moraine left behind') },
  ] },
  glaciallake: { title: 'How the ice made a lake', src: ['proglacial', 'passaic', 'i2540'], steps: [
    { text: 'Before the ice, the ancestral Passaic River left its valley through a gap in the Watchung ridges at Short Hills.',
      draw: svg(p('M0 190 L0 80 L50 70 L70 150 L200 152 L250 120 L265 150 L300 150 L310 60 L360 50 L360 190Z', C.rock) + p('M70 150 L265 150 L265 156 L70 156Z', C.water, 'ex-in') + arrow(220, 146, 300, 146, 'ex-in', C.water) + t(160, 140, 'river valley') + t(282, 110, 'gap'), 'A river leaving a valley through a gap') },
    { text: 'The ice sheet arrived and, with the moraine it dumped, plugged the gap like a cork.',
      draw: svg(p('M0 190 L0 80 L50 70 L70 150 L200 152 L250 120 L265 150 L300 150 L310 60 L360 50 L360 190Z', C.rock) + p('M262 150 Q282 112 302 150Z', C.soil, 'ex-in') + p('M280 150 L280 40 L360 30 L360 190 L300 190Z', C.ice, 'ex-in', `stroke="${C.iceLine}" stroke-width="1.5"`) + t(282, 100, 'moraine', 'ex-in') + t(330, 60, 'ice', 'ex-in'), 'Ice and moraine plugging the gap') },
    { text: 'Meltwater filled the valley like a bathtub, until it reached the lowest point on the rim and spilled out there. At its deepest the lake spilled over Moggy Hollow, 103 m (339 ft) up, about 300 ft deep.',
      draw: svg(p('M0 190 L0 80 L50 70 L70 150 L200 152 L250 120 L265 150 L300 150 L310 60 L360 50 L360 190Z', C.rock) + p('M262 150 Q282 112 302 150Z', C.soil) + p('M280 150 L280 40 L360 30 L360 190 L300 190Z', C.ice, '', `stroke="${C.iceLine}" stroke-width="1.5"`) + p('M44 92 L254 92 L268 150 L70 150Z', C.water, 'ex-grow') + arrow(46, 92, 20, 112, 'ex-in', C.water) + t(150, 84, 'Glacial Lake Passaic', 'ex-in') + t(36, 72, 'spillway', 'ex-in'), 'The lake filling to its spillway') },
    { text: 'As the ice melted back it opened lower gaps (first Great Notch, 93 m), so the lake dropped, and then drained. Its flat, wet floor is the Great Swamp and the meadows today.',
      draw: svg(p('M0 190 L0 80 L50 70 L70 150 L200 152 L250 120 L265 150 L300 150 L310 60 L360 50 L360 190Z', C.rock) + p('M262 150 Q282 112 302 150Z', C.soil) + p('M70 146 L265 146 L266 150 L70 150Z', '#6b9d6a', 'ex-in') + t(160, 138, 'swamps and meadows', 'ex-in') + t(160, 70, 'the water drains away'), 'The lake drained, leaving swamps') },
  ] },
  erratic: { title: 'How a boulder ends up on a hilltop', src: ['erratic', 'tripod'], steps: [
    { text: 'Flowing ice can pluck big blocks of rock from the ground and carry them, often hundreds of kilometres.',
      draw: svg(ground('M0 150 L360 150 L360 190 L0 190Z') + p('M0 150 L0 60 L360 60 L360 150Z', C.ice, '', `stroke="${C.iceLine}" stroke-width="1.5"`) + `<rect class="ex-slide" x="60" y="112" width="34" height="26" rx="6" fill="#7b6a5c"/>` + arrow(110, 125, 220, 125, 'ex-in') + t(180, 85, 'a boulder riding in the ice'), 'A boulder carried by ice') },
    { text: 'When the ice melts, the boulder is set down wherever it is, often on quite different rock. That is a glacial erratic, from the Latin for “to wander”. Tripod Rock, on Pyramid Mountain, is one.',
      draw: svg(p('M0 190 L0 150 L120 150 Q200 110 280 150 L360 150 L360 190Z', C.rock2) + `<rect x="178" y="98" width="40" height="22" rx="7" fill="#7b6a5c" class="ex-in"/><rect x="182" y="120" width="7" height="8" fill="#6d5544"/><rect x="206" y="120" width="7" height="8" fill="#6d5544"/>` + t(198, 82, 'set down, far from home', 'ex-in'), 'A glacial erratic on a hill') },
  ] },
  rift: { title: 'How a rift valley opens', src: ['rift', 'newark', 'sill', 'palisades'], steps: [
    { text: 'About 200 million years ago Pangaea began to pull apart, stretching the ground.',
      draw: svg(p('M0 190 L0 110 L360 110 L360 190Z', C.rock) + arrow(150, 90, 60, 90, 'ex-in') + arrow(210, 90, 300, 90, 'ex-in') + t(180, 60, 'the continent is pulled apart'), 'A continent being pulled apart') },
    { text: 'The crust cracks along faults and a long block drops down between them, making a valley: a rift.',
      draw: svg(p('M0 190 L0 110 L130 110 L150 190Z', C.rock) + p('M360 190 L360 110 L230 110 L210 190Z', C.rock) + p('M150 190 L130 110 L230 110 L210 190Z', C.rock2, 'ex-drop') + `<line x1="130" y1="110" x2="150" y2="190" stroke="#3d2f25" stroke-width="2"/><line x1="230" y1="110" x2="210" y2="190" stroke="#3d2f25" stroke-width="2"/>` + t(180, 70, 'a block drops: the rift valley'), 'A block dropping between faults') },
    { text: 'Rivers wash mud and sand in from the sides, filling the valley layer by layer: the red sandstone and shale of the Newark Basin.',
      draw: svg(p('M0 190 L0 110 L130 110 L150 190Z', C.rock) + p('M360 190 L360 110 L230 110 L210 190Z', C.rock) + [0, 1, 2, 3].map((k) => p(`M${150 - k * 5} ${178 - k * 16} L${210 + k * 5} ${178 - k * 16} L${213 + k * 5} ${164 - k * 16} L${147 - k * 5} ${164 - k * 16}Z`, k % 2 ? C.red2 : C.red, k === 3 ? 'ex-in' : '')).join('') + t(180, 70, 'mud and sand fill it up'), 'The rift filling with red layers') },
    { text: 'Molten rock rises through the cracks. Some pours out over the surface as lava (the Watchung ridges); some squeezes between the layers and cools underground as a sill (the Palisades).',
      draw: svg(p('M0 190 L0 110 L130 110 L150 190Z', C.rock) + p('M360 190 L360 110 L230 110 L210 190Z', C.rock) + [0, 1, 2, 3].map((k) => p(`M${150 - k * 5} ${178 - k * 16} L${210 + k * 5} ${178 - k * 16} L${213 + k * 5} ${164 - k * 16} L${147 - k * 5} ${164 - k * 16}Z`, k % 2 ? C.red2 : C.red)).join('') + p('M132 114 L228 114 L230 108 L130 108Z', C.lava, 'ex-in') + p('M142 150 L218 150 L219 145 L141 145Z', '#7c4a52', 'ex-in') + `<line x1="180" y1="190" x2="180" y2="110" stroke="${C.lava}" stroke-width="3" class="ex-in"/>` + t(180, 98, 'lava flow on top', 'ex-in') + t(352, 138, 'sill, between layers', 'ex-in', 'end'), 'A lava flow and a sill') },
  ] },
  ridges: { title: 'Why hard rock becomes a ridge', src: ['passaic', 'ridge', 'palisades'], steps: [
    { text: 'Over millions of years the layers were tilted. Some are hard (basalt, diabase, quartzite), some soft (shale, limestone, red mudstone).',
      draw: svg([0, 1, 2, 3, 4, 5].map((k) => p(`M${k * 70 - 40} 190 L${k * 70 + 20} 190 L${k * 70 + 80} 100 L${k * 70 + 20} 100Z`, k === 2 ? '#4a3b3b' : k % 2 ? C.red : C.red2)).join('') + t(185, 90, 'one hard layer among soft ones'), 'Tilted layers of hard and soft rock') },
    { text: 'Rain, frost and rivers wear the soft rock away faster. The hard layer is left standing up as a ridge: the Watchungs, the Palisades cliffs, the ridges of the Valley and Ridge.',
      draw: svg([0, 1, 3, 4, 5].map((k) => p(`M${k * 70 - 40} 190 L${k * 70 + 20} 190 L${k * 70 + 50} 145 L${k * 70 - 10} 145Z`, k % 2 ? C.red : C.red2)).join('') + p('M100 190 L160 190 L220 100 L190 95 L160 145 L130 145Z', '#4a3b3b', 'ex-in') + t(190, 80, 'the hard layer stands up', 'ex-in') + t(60, 135, 'soft rock worn down', 'ex-in'), 'A hard layer left as a ridge') },
  ] },
  fold: { title: 'How colliding continents fold rock', src: ['collision', 'allegh', 'ridge'], steps: [
    { text: 'Layers of sand, mud and lime settle flat on the floor of a shallow sea and harden into rock.',
      draw: svg([0, 1, 2, 3].map((k) => foldBand(k, 0, k === 3 ? 'ex-in' : '')).join('') + t(180, 80, 'flat layers on the sea floor'), 'Flat layers of rock') },
    { text: 'Continents collide (Africa into North America, from about 325 million years ago), squeezing the layers from the side. They buckle into folds, like a rug pushed against a wall.',
      draw: svg([0, 1, 2, 3].map((k) => foldBand(k, 22, 'ex-in')).join('') + arrow(354, 50, 300, 50) + arrow(6, 50, 60, 50) + t(180, 30, 'squeezed into folds'), 'Layers squeezed into folds') },
    { text: 'Over millions of years the tops wear down. The hard layers (quartzite) are left as long ridges; the soft shale and limestone wear into valleys. That is the Valley and Ridge.',
      draw: svg([0, 1, 2, 3].map((k) => foldBand(k, 22)).join('') + worn('ex-in') + t(45, 92, 'ridge', 'ex-in') + t(225, 92, 'ridge', 'ex-in') + t(135, 116, 'valley', 'ex-in') + t(320, 116, 'valley', 'ex-in'), 'Folds worn down to ridges and valleys') },
  ] },
  coastal: { title: 'How a coastal plain builds', src: ['atl', 'pines'], steps: [
    { text: 'Rivers carry sand, clay and gravel down from the hills to the sea.',
      draw: svg(p(`M0 190 L0 60 L100 118 L360 ${slope(360)} L360 190Z`, C.rock) + sea(0, 200, 136) + arrow(40, 82, 200, 128, 'ex-in', C.water) + t(120, 60, 'rivers bring sand to the coast'), 'Rivers carrying sand to the sea') },
    { text: 'At the coast it settles, layer on layer, over millions of years, as the sea rises and falls.',
      draw: svg(p(`M0 190 L0 60 L100 118 L360 ${slope(360)} L360 190Z`, C.rock) + wedge(0) + wedge(1) + wedge(2, 'ex-in') + sea(3, 200, 136) + t(190, 96, 'layer on layer'), 'Layers of sand building at the coast') },
    { text: 'The layers tilt gently out to sea and carry on under it. Their land part is the Coastal Plain; the Pine Barrens stand on one of the youngest layers, the Cohansey sand.',
      draw: svg(p(`M0 190 L0 60 L100 118 L360 ${slope(360)} L360 190Z`, C.rock) + wedge(0) + wedge(1) + wedge(2) + wedge(3) + sea(4, 200, 136, 'ex-in') + t(170, 104, 'Coastal Plain', 'ex-in') + t(330, 130, 'sea', 'ex-in') + t(90, 165, 'older rock below'), 'Layers tilting gently out under the sea') },
  ] },
  aquifer: { title: 'How sand holds water (an aquifer)', src: ['aquifer', 'kc'], steps: [
    { text: 'Rain soaks into the sand and fills the tiny gaps between the grains.',
      draw: svg(p('M0 190 L0 80 L360 80 L360 190Z', C.sand) + Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 47) % 350 + 5}" cy="${90 + ((i * 29) % 90)}" r="3" fill="#cfae52"/>`).join('') + [60, 140, 220, 300].map((x) => arrow(x, 30, x, 70, 'ex-in', C.water)).join('') + t(180, 20, 'rain soaks in'), 'Rain soaking into sand') },
    { text: 'It sinks until it meets a layer of clay, which it cannot pass, and is stored above it. In the Pine Barrens the Cohansey sand holds the water and the clayey Kirkwood lies below.',
      draw: svg(p('M0 190 L0 80 L360 80 L360 190Z', C.sand) + p('M0 160 L360 160 L360 190 L0 190Z', C.clay) + p('M0 115 L360 115 L360 160 L0 160Z', C.water, 'ex-grow', 'opacity="0.55"') + t(180, 142, 'water stored in the sand', 'ex-in') + t(180, 178, 'clay below') + `<rect x="250" y="40" width="10" height="100" fill="#7a7a7a" class="ex-in"/>` + t(255, 34, 'a well', 'ex-in'), 'Water stored above a clay layer') },
  ] },
  lava: { title: 'How lava made the Watchungs and the Palisades', src: ['newark', 'camp', 'palisades', 'diabase', 'watchung', 'columns', 'flood'], steps: [
    { text: 'From about 220 million years ago the Newark Basin is a sinking rift valley with lakes in it, filling with red mud and sand. Its west side, along the Ramapo Fault, sinks deepest. (The slice is not to scale.)',
      draw: lavaSvg(redBeds() + p('M60 100 L330 100 L322 95 L68 95Z', C.water, 'ex-in', 'opacity="0.8"') + t(196, 80, 'a rift lake on red mud and sand', 'ex-in') + t(8, 30, 'Ramapo Fault', '', 'start') + t(352, 180, 'west ← → east', '', 'end'), 'The Newark Basin as a rift valley with a lake') },
    { text: 'As the crust is stretched thin, rock far below begins to melt, because less weight is pressing on it, and the molten rock (magma) rises up through cracks.',
      draw: lavaSvg(redBeds() + deep('ex-grow') + dikes(150, 'ex-grow') + t(196, 80, 'magma rising up cracks', 'ex-in'), 'Magma rising through cracks') },
    { text: 'About 201 million years ago some of it stops 3 to 5 km (2 to 3 miles) down and spreads sideways between the layers: a sheet about 300 m (1,000 ft) thick. It cools there, slowly, into diabase, the same stuff as basalt but cooled underground. That sheet is the Palisades Sill.',
      draw: lavaSvg(redBeds() + deep() + dikes(150) + hot('M110 150 L360 146 L360 158 L112 162Z', 'ex-slide') + t(196, 80, 'a sheet spreads between the layers', 'ex-in') + t(236, 140, 'the Palisades Sill', 'ex-in'), 'Magma spreading between layers as a sill') },
    { text: 'Some breaks right through to the surface along long cracks: a fissure eruption, a curtain of lava fountains rather than a cone-shaped volcano. Each burst probably lasted less than a century.',
      draw: lavaSvg(redBeds() + deep() + dikes(100) + sheet(146, 160, 112, '', '#4a3436') + fountains(100, 'ex-in') + t(196, 30, 'lava fountains along a crack', 'ex-in'), 'A fissure eruption') },
    { text: 'Runny basalt lava pours out and floods the valley floor, perhaps nearly the whole basin. This is the first of three floods, the Orange Mountain basalt: today’s First Watchung ridge.',
      draw: lavaSvg(redBeds() + sheet(146, 160, 112, '', '#4a3436') + hot('M36 93 L360 93 L360 100 L37 100Z', 'ex-slide') + fountains(93) + t(196, 30, 'a flood of lava', 'ex-in'), 'Lava flooding the basin') },
    { text: 'It cools into hard, dark basalt, shrinking and cracking into columns as it does. Then all is quiet: for thousands of years lakes and rivers lay more mud and sand on top.',
      draw: lavaSvg(redBeds() + sheet(146, 160, 112, '', '#4a3436') + p('M36 93 L360 93 L360 100 L37 100Z', L.hot, 'ex-cool') + cracks(93, 100, 'ex-in') + sheet(84, 93, 35, 'ex-grow', L.mud) + t(196, 70, 'cooled; mud on top', 'ex-in'), 'The lava cools into columns and is buried') },
    { text: 'Twice more lava floods the basin, with mud between: the Preakness basalt (Second Watchung) and the Hook Mountain basalt (Third Watchung). Their chemistry matches layers inside the Palisades Sill, so they were probably the same magma.',
      draw: lavaSvg(redBeds() + sheet(146, 160, 112, '', '#4a3436') + sheet(93, 100, 37) + sheet(84, 93, 35, '', L.mud) + sheet(77, 84, 34) + sheet(68, 77, 33, '', L.mud) + p('M32 62 L360 62 L360 68 L33 68Z', L.hot, 'ex-cool') + side(66, '3rd') + side(82, '2nd') + side(99, '1st') + t(160, 40, 'three lava floods, mud between', 'ex-in'), 'Three lava layers with mud between') },
    { text: 'Then the basin tilts, west side down, and over some 200 million years the soft red rock is worn away. The hard basalt and diabase are left standing: the three Watchung ridges, each with a cliff facing east, and on the east side the Palisades, about 100 m (300 ft) above the Hudson.',
      draw: svg(p('M0 0 L360 0 L360 190 L0 190Z', C.red) + HARD.map(([c, th, n]) => tBand(c, th, n === 'Palisades' ? '#4a3436' : L.cold, 'ex-in')).join('') + ridgeSurface() + p(`M${((227 - 16 - ERODE) / TILT + 22 / TILT).toFixed(1)} ${ERODE} L360 ${ERODE} L360 ${ERODE + 6} L${((227 - 16 - ERODE) / TILT + 22 / TILT).toFixed(1)} ${ERODE + 6}Z`, C.water) +
        HARD.map(([c, th, n]) => t(ridgeX(c, th, n === 'Palisades' ? 22 : 14).toFixed(0), n === 'Palisades' ? 84 : 94, n, 'ex-in')).join('') + t(6, 18, '← west', '', 'start') + t(354, 18, 'east →', '', 'end') + t(354, 140, 'Hudson', '', 'end'), 'Tilted, worn-down layers: the Watchung ridges and the Palisades cliffs') },
  ] },
  bogiron: { title: 'How iron grows in a bog', src: ['bog'], steps: [
    { text: 'Groundwater carrying dissolved iron seeps out at springs and into streams and bogs.',
      draw: svg(p('M0 190 L0 110 L360 110 L360 190Z', C.sand) + p('M120 110 Q180 120 240 110 L240 116 Q180 126 120 116Z', C.water) + arrow(60, 170, 150, 118, 'ex-in', C.water) + t(180, 90, 'iron-bearing water seeps out'), 'Iron-bearing groundwater seeping out') },
    { text: 'Meeting the air, the iron turns to rust-coloured compounds, helped along by iron bacteria, and settles. Over time it builds up as lumps of bog iron ore, which furnaces like Batsto smelted.',
      draw: svg(p('M0 190 L0 110 L360 110 L360 190Z', C.sand) + p('M120 110 Q180 120 240 110 L240 116 Q180 126 120 116Z', C.water) + rocks([[150, 122, 5], [170, 126, 4], [195, 124, 6], [218, 121, 4]], 'ex-in').replaceAll('#6d5544', C.iron) + t(180, 90, 'rusty lumps: bog iron ore', 'ex-in'), 'Bog iron ore forming') },
  ] },
};

/** See the real thing: photos for the lava explainer. The first two are NOT New Jersey: lava erupting today, to show what the
 * Newark Basin's eruptions were like. The rest are the rock that lava left in New Jersey. Files from Wikimedia Commons, resized. */
const CM = (f) => `https://commons.wikimedia.org/wiki/File:${f}`;
export const LAVA_PHOTOS = {
  intro: 'About 201 million years ago, lava flooded the Newark Basin three times. Nobody saw it, but eruptions of the same kind happen today. The first two photos are of those, far from New Jersey; the rest are the rock the lava left here.',
  extinction: 'In the Newark Basin, the change in fossil pollen that marks the end-Triassic mass extinction lies just below the oldest lava flow. These eruptions, across the whole Central Atlantic province, are linked to that extinction, which cleared the way for the dinosaurs.',
  src: ['camp', 'watchung', 'flood'],
  list: [
    { img: 'img/deep/fissure.jpg', tag: 'Not New Jersey · today', title: 'A fissure eruption, Iceland, 2014', text: 'Lava fountaining from a long crack in the ground, in the 2014 eruption from the Bárðarbunga volcano system. The Newark Basin’s eruptions were fissure eruptions like this, on a far bigger scale.', credit: 'Photo: Peter Hartree, CC BY-SA 2.0', page: CM('B%C3%A1r%C3%B0arbunga_Volcano,_September_4_2014_-_15145866372.jpg') },
    { img: 'img/deep/pahoehoe.jpg', tag: 'Not New Jersey · today', title: 'Runny lava in a channel, Hawaiʻi, 2007', text: 'Pāhoehoe, the smooth, ropey kind of basalt lava, running in an open channel. The Watchungs have this kind and the blocky kind (ʻaʻā).', credit: 'Photo: Brocken Inaglory, CC BY-SA 3.0', page: CM('Lava_channel_with_overflows_edit_4.jpg') },
    { img: 'img/deep/watchung-columns.jpg', tag: 'New Jersey', title: 'First Watchung Mountain, Hawthorne', text: 'Stacked, jointed basalt near the top of the ridge: lava that shrank and cracked into columns as it cooled.', credit: 'Photo: Wikipedia contributor, public domain', page: CM('WatchungStackedBasalt.jpg') },
    { img: 'img/deep/lava-front.jpg', tag: 'New Jersey', title: 'An old lava front, Preakness Range', text: 'The edge of an ancient lava flow on the western flank of Beech Mountain, in the Watchungs.', credit: 'Photo: Wikipedia contributor, public domain', page: CM('LavaFront.jpg') },
    { img: 'img/deep/great-falls.jpg', tag: 'New Jersey', title: 'The Great Falls, Paterson', text: 'The Passaic River pours over the basalt of First Watchung Mountain, 77 ft (23 m) high. A National Natural Landmark, for the jointed basalt lava flow it shows.', credit: 'Photo: TMcKNJDover, CC BY-SA 4.0', page: CM('PAGR_GREAT_FALLS_RAINBOW.jpg') },
    { img: 'img/deep/palisades.jpg', tag: 'New Jersey', title: 'The Palisades, from Manhattan', text: 'Looking across the Hudson from 187th Street to Fort Lee: the edge of the Palisades Sill, the magma that cooled underground, worn into cliffs and columns.', credit: 'Photo: Beyond My Ken, CC BY-SA', page: CM('Hudson_River_Palisades_seen_from_187th_Street_crop.jpg') },
  ],
};
EX_SRC.gf = ['Wikipedia: Great Falls (Passaic River)', W('Great_Falls_(Passaic_River)')];
LAVA_PHOTOS.src.push('gf');

