// The budget (D197, H17) as numbers: the hourly tick on a 60-township theatre, and what goblin mode adds to the download before any art.
//   node tools/goblin/perf.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { makeBoard } from '../../js/goblin/sim/board.js';
import { loadContent } from '../../js/goblin/sim/chars.js';
import { newWorld, step } from '../../js/goblin/sim/world.js';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const content = loadContent(read('data/goblin-content.json'));
const board = makeBoard(read('data/goblin-board.json'), content, read('data/goblin-regions.json'));

export function tickTimes(homes = ['Paterson City|Passaic', 'Newark City|Essex', 'Hackensack City|Bergen'], days = 21) {
  const ms = []; let towns = 0;
  for (const home of homes) {
    let w = newWorld(board, { seed: 'perf-' + home, home, startMs: Date.UTC(2026, 8, 15), clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }] });
    towns = Math.max(towns, Object.keys(w.towns).length);
    for (let i = 0; i < days * 24; i++) { w.clans.goblins.lastActive = w.tick; const t0 = process.hrtime.bigint(); w = step(board, w, [], 1).state; ms.push(Number(process.hrtime.bigint() - t0) / 1e6); }
  }
  ms.sort((a, b) => a - b);
  return { towns, n: ms.length, p50: ms[Math.floor(ms.length * 0.5)], p95: ms[Math.floor(ms.length * 0.95)], max: ms[ms.length - 1] };
}

export function downloadSizes() {
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(path.join(root, d))) { const rel = path.join(d, f); if (fs.statSync(path.join(root, rel)).isDirectory()) walk(rel); else files.push(rel); } };
  walk('js/goblin');
  for (const f of ['data/goblin-board.json', 'data/goblin-content.json', 'data/goblin-regions.json']) files.push(f);
  let raw = 0, gz = 0; const rows = [];
  for (const f of files) { const b = fs.readFileSync(path.join(root, f)); const g = zlib.gzipSync(b, { level: 9 }).length; raw += b.length; gz += g; rows.push([f, b.length, g]); }
  return { raw, gz, rows: rows.sort((a, b) => b[2] - a[2]) };
}

if (process.argv[1] && process.argv[1].endsWith('perf.mjs')) {
  const t = tickTimes(); const d = downloadSizes();
  console.log(`hourly tick on ${t.towns} townships over ${t.n} ticks: median ${t.p50.toFixed(2)} ms, 95th percentile ${t.p95.toFixed(2)} ms, worst ${t.max.toFixed(2)} ms (budget on a phone: 50 ms)`);
  console.log(`added download before art: ${(d.gz / 1024).toFixed(0)} KB gzipped, ${(d.raw / 1024).toFixed(0)} KB raw (budget: 300 KB)`);
  for (const [f, r, g] of d.rows.slice(0, 6)) console.log(`  ${f.padEnd(40)} ${(r / 1024).toFixed(0).padStart(5)} KB raw ${(g / 1024).toFixed(0).padStart(4)} KB gz`);
}
