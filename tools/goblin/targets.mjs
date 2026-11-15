// The tuning targets (docs/goblins/13-finish-plan.md section 5, docs/goblins/11-tuning-plan.md) as a pass/fail table.
//   node tools/goblin/targets.mjs [--set aiRecruitSplit=1,aiCounterRatio=1.5] [--seeds 20] [--strict]
// Runs the Careful and Bold bots for up to 35 days and a Passive lord for 60, then judges the numbers. --strict exits 1 if any target fails.
import { makeBoard } from '../../js/goblin/sim/board.js';
import { legalOrders } from '../../js/goblin/sim/front.js';
import { runWar, metricsOf } from './run.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const SEEDS = +arg('seeds', 20);
const rules = Object.fromEntries((arg('set', '') || '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k, +v]; }));
// The real map is uneven, so a war's difficulty depends on where it starts: seeds rotate through four homes (docs/goblins/11-tuning-plan.md)
const HOMES = ['Paterson City|Passaic', 'Newark City|Essex', 'Edison Township|Middlesex', 'Hackensack City|Bergen'];
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function batch(bot, days, seeds) {
  const out = { wins: 0, winDays: [], endShare: [], stackRatio: [], decided: 0, closed: 0, lost: 0, resolved: 0, shapes: [], rivalWinDays: [], emptyDays: 0, days: 0 };
  for (let s = 1; s <= seeds; s++) {
    const r = runWar({ seed: s, days, bot, rules, home: HOMES[s % HOMES.length], rivals: 'pool' });
    const m = metricsOf(r, days), w = r.state;
    const over = w.war && w.war.over;
    if (over && over.winner === 'goblins') { out.wins++; out.winDays.push(over.tick / 24); }
    if (over && over.winner !== 'goblins') out.rivalWinDays.push(over.tick / 24);
    out.endShare.push(m.endTowns / m.startTowns);
    const forces = Object.values(w.towns).filter((t) => t.owner).map((t) => t.force);
    out.stackRatio.push(Math.max(...forces) / Math.max(1, median(forces)));
    const v = m.fronts.closedByVerdict;
    const done = (v.Won || 0) + (v.Lost || 0) + (v.Yielded || 0), dec = (v.Won || 0) + (v.Lost || 0);
    out.closed += done; out.decided += dec; out.lost += v.Lost || 0; out.resolved += done;
    out.shapes.push(m.distinctShapesPerDay.mean);
  }
  return out;
}

const careful = batch('careful', 35, SEEDS), bold = batch('bold', 35, SEEDS), passive = batch('passive', 60, Math.max(8, SEEDS >> 1));
const pct = (a, b) => (b ? (100 * a) / b : 0);
const rows = [
  ['Careful wins a chapter (35 days)', `${pct(careful.wins, SEEDS).toFixed(0)} percent`, pct(careful.wins, SEEDS) >= 50 && pct(careful.wins, SEEDS) <= 70, '50 to 70 percent'],
  ['Bold wins a chapter (35 days)', `${pct(bold.wins, SEEDS).toFixed(0)} percent`, pct(bold.wins, SEEDS) >= 40 && pct(bold.wins, SEEDS) <= 60, '40 to 60 percent'],
  ['Length of a won chapter (Careful, mean days)', careful.winDays.length ? mean(careful.winDays).toFixed(1) : 'none won', careful.winDays.length > 0 && mean(careful.winDays) >= 14 && mean(careful.winDays) <= 28, '14 to 28 days'],
  ['Passive keeps townships after 21 days (mean share of start)', null, null, 'at least 80 percent'],
  ['A rival wins against a passive player', passive.rivalWinDays.length ? `earliest day ${Math.min(...passive.rivalWinDays).toFixed(0)}` : 'none within 60 days', !passive.rivalWinDays.length || Math.min(...passive.rivalWinDays) >= 40, 'not before day 40'],
  ['Biggest stack against the median garrison (mean)', `${mean([...careful.stackRatio, ...bold.stackRatio, ...passive.stackRatio]).toFixed(1)} times`, mean([...careful.stackRatio, ...bold.stackRatio, ...passive.stackRatio]) < 5, 'under 5 times'],
  ['Fronts that reach a decision beat (Careful)', `${pct(careful.decided, careful.closed).toFixed(0)} percent`, pct(careful.decided, careful.closed) >= 60, 'at least 60 percent'],
  ['Fronts lost by Careful', `${pct(careful.lost, careful.closed).toFixed(0)} percent`, pct(careful.lost, careful.closed) >= 15 && pct(careful.lost, careful.closed) <= 30, '15 to 30 percent'],
  ['Distinct kinds of event on an active day (mean)', mean([...careful.shapes, ...bold.shapes]).toFixed(1), mean([...careful.shapes, ...bold.shapes]) >= 6, 'at least 6'],
];
// passive keeps at least 80 percent after 21 days: measured on its own 21-day runs
{
  const shares = [];
  for (let s = 1; s <= Math.max(8, SEEDS >> 1); s++) { const r = runWar({ seed: s, days: 21, bot: 'passive', rules, home: HOMES[s % HOMES.length], rivals: 'pool' }); const m = metricsOf(r, 21); shares.push(m.endTowns / m.startTowns); }
  const v = mean(shares);
  rows[3][1] = `${(100 * v).toFixed(0)} percent`; rows[3][2] = v >= 0.8;
}
let failed = 0;
console.log(`Targets (${SEEDS} seeds${Object.keys(rules).length ? ', rules ' + JSON.stringify(rules) : ''})`);
for (const [name, value, ok, want] of rows) { if (!ok) failed++; console.log(`${ok ? 'pass' : 'FAIL'}  ${name.padEnd(62)} ${String(value).padEnd(22)} want ${want}`); }
console.log(`${rows.length - failed} of ${rows.length} pass`);
if (process.argv.includes('--strict') && failed) process.exit(1);
