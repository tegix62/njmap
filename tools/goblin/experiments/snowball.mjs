// Compares world-rule variants over 20 seeds. Usage:  node tools/goblin/experiments/snowball.mjs [--ai-only] [--days 365]
// Written for M0 S3 (docs/goblins/sims/snowball-01.md): does a force cap or tapering recruits stop one clan from taking everything?
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';

const board = makeBoard(JSON.parse(fs.readFileSync(new URL('../../../data/goblin-board.json', import.meta.url), 'utf8')));
const aiOnly = process.argv.includes('--ai-only');
const days = +(process.argv[process.argv.indexOf('--days') + 1] || 365);
const PAT = 'Paterson City|Passaic';
const OFF = 99999;
const VARIANTS = {
  'A  baseline: no cap, no taper':                              { townForceCap: OFF, recruitFullTowns: 999 },
  'B  cap 30 + taper (the simplest)':                           { townForceCap: 30, recruitFullTowns: 20, recruitDivisorBeyond: 6 },
  'C  taper only, no cap':                                      { townForceCap: OFF, recruitFullTowns: 20, recruitDivisorBeyond: 6 },
  'D  cap 30 + taper, AI attacks at 0.7 (use it or lose it)':   { townForceCap: 30, recruitFullTowns: 20, recruitDivisorBeyond: 6, aiAttackRatio: 0.7 },
  'E  cap 30 + taper, AI attacks at 1.0':                       { townForceCap: 30, recruitFullTowns: 20, recruitDivisorBeyond: 6, aiAttackRatio: 1.0 },
};
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`${aiOnly ? 'three AI clans' : 'one idle human and two AI clans'}, ${days} days, 20 seeds`);
for (const [name, rules] of Object.entries(VARIANTS)) {
  const res = [];
  for (let s = 0; s < 20; s++) {
    let w = newWorld(board, { seed: 'long' + s, home: PAT, rules, clans: [{ id: 'goblins', kind: 'goblin', lord: aiOnly ? 'ai' : 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }] });
    let fights = 0, flips = 0, lastFight = 0, dom = null, bad = 0;
    for (let day = 1; day <= days; day++) {
      const r = step(board, w, [], 24); w = r.state;
      for (const e of r.events) if (e.type === 'skirmish_result' || e.type === 'raid_landed') { fights++; lastFight = day; if (e.won) flips++; }
      const own = {}; for (const t of Object.values(w.towns)) own[t.owner] = (own[t.owner] || 0) + 1;
      if (dom === null && Math.max(...Object.values(own)) >= 50) dom = day;
      bad += checkInvariants(board, w).length;
    }
    const own = {}; for (const t of Object.values(w.towns)) own[t.owner] = (own[t.owner] || 0) + 1;
    res.push({ fights, flips, lastFight, dom, bad, force: Object.values(w.towns).reduce((a, t) => a + t.force, 0), top: Math.max(...Object.values(own)) });
  }
  const d = res.filter((r) => r.dom !== null);
  console.log(`${name}\n   median fights ${med(res.map((r) => r.fights))}, townships changing hands ${med(res.map((r) => r.flips))}, last fight on day ${med(res.map((r) => r.lastFight))}, dominated (one clan 50+ of 58) ${d.length}/20${d.length ? ' by day ' + med(d.map((r) => r.dom)) : ''}, final force ${med(res.map((r) => r.force))}, biggest clan ${med(res.map((r) => r.top))}, invariant problems ${res.reduce((a, r) => a + r.bad, 0)}`);
}
