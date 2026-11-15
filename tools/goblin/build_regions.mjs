// Builds data/goblin-regions.json: the region kits (D171). Townships are grouped by county (a county-level approximation: township-level corrections come later),
// each kit gets numbers computed from the board (river, ridge and highway borders, population) and one rule chosen from the numbers, never from memory (H42).
// Names, hazards and trade flavour are working words (placeholder, the user's to change). Facts are rows with a source and a verified flag; unverified rows are
// kept for checking but never shipped (D195).   node tools/goblin/build_regions.mjs
import fs from 'node:fs';

const board = JSON.parse(fs.readFileSync(new URL('../../data/goblin-board.json', import.meta.url), 'utf8'));
const KITS = [
  { id: 'skylands', name: 'The Skylands', counties: ['Sussex', 'Warren'] },
  { id: 'highlands', name: 'The Highlands', counties: ['Morris', 'Passaic'] },
  { id: 'palisades', name: 'The Palisades', counties: ['Bergen'] },
  { id: 'waterfront', name: 'The Waterfront', counties: ['Hudson', 'Essex'] },
  { id: 'raritan', name: 'The Raritan', counties: ['Union', 'Somerset', 'Middlesex'] },
  { id: 'delaware', name: 'The Delaware Valley', counties: ['Hunterdon', 'Mercer'] },
  { id: 'shore', name: 'The Shore', counties: ['Monmouth', 'Ocean'] },
  { id: 'pines', name: 'The Pines', counties: ['Burlington', 'Camden'] },
  { id: 'bayshore', name: 'The Bayshore', counties: ['Gloucester', 'Salem', 'Cumberland'] },
  { id: 'atlantic', name: 'The Atlantic Coast', counties: ['Atlantic', 'Cape May'] },
];
const RULES = {
  roads: 'Highways are thick here: convoys through this region move twice as fast.',
  rivers: 'Rivers everywhere: a goblin bridge over a river border here costs 2 less Build.',
  hills: 'Rough ground: townships here dig in without paying Build.',
  farm: 'Open farmland: Food towns here yield 1 more Food.',
  coast: 'A busy coast: a hired band here brings 2 more units.',
};
const kitOf = {};
for (const k of KITS) for (const c of k.counties) kitOf[c] = k.id;
const townKit = {};
for (const [id, t] of Object.entries(board.towns)) { if (!kitOf[t.county]) throw new Error('county without a kit: ' + t.county); townKit[id] = kitOf[t.county]; }

const stats = Object.fromEntries(KITS.map((k) => [k.id, { towns: 0, pop: 0, borders: 0, river: 0, ridge: 0, highway: 0 }]));
for (const [id, t] of Object.entries(board.towns)) { const s = stats[townKit[id]]; s.towns++; s.pop += t.pop; }
for (const [key, b] of Object.entries(board.borders)) {
  const [a, c] = key.split('~'); if (townKit[a] !== townKit[c]) continue;
  const s = stats[townKit[a]]; s.borders++; if (b.river) s.river++; if (b.ridge) s.ridge++; if (b.highways && b.highways.length) s.highway++;
}
for (const s of Object.values(stats)) { s.avgPop = Math.round(s.pop / s.towns); s.riverShare = +(s.river / Math.max(1, s.borders)).toFixed(3); s.highwayShare = +(s.highway / Math.max(1, s.borders)).toFixed(3); s.ridgeShare = +(s.ridge / Math.max(1, s.borders)).toFixed(3); }
const z = (vals) => { const m = vals.reduce((a, b) => a + b, 0) / vals.length, sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length) || 1; return (v) => (v - m) / sd; };
const zr = z(KITS.map((k) => stats[k.id].highwayShare)), zv = z(KITS.map((k) => stats[k.id].riverShare)), zh = z(KITS.map((k) => stats[k.id].ridgeShare)), zf = z(KITS.map((k) => -stats[k.id].avgPop));
const COAST = new Set(['shore', 'atlantic']);
for (const k of KITS) {
  const s = stats[k.id];
  const score = { roads: zr(s.highwayShare), rivers: zv(s.riverShare), hills: zh(s.ridgeShare), farm: zf(-s.avgPop) };
  k.rule = COAST.has(k.id) ? 'coast' : Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
  k.ruleText = RULES[k.rule]; k.stats = s;
  k.hazard = { text: 'working word: a hazard for this region goes here', placeholder: true };
  k.tradeFlavour = { text: 'working word: what this region is known for goes here', placeholder: true };
  k.placeholder = true;   // the name is a working name (D68)
  // Facts: a row has text, a source to check and a verified flag. Nothing here is verified yet; unverified rows are kept for checking and never shipped (D195).
  k.facts = [];
}
fs.writeFileSync(new URL('../../data/goblin-regions.json', import.meta.url), JSON.stringify({ v: 1, kits: KITS, townKit }, null, 1));
for (const k of KITS) console.log(`${k.id.padEnd(10)} ${String(k.stats.towns).padStart(3)} townships  avgPop ${String(k.stats.avgPop).padStart(6)}  river ${k.stats.riverShare}  highway ${k.stats.highwayShare}  ridge ${k.stats.ridgeShare}  -> ${k.rule}`);
console.log(Object.keys(townKit).length, 'townships in', KITS.length, 'kits');
