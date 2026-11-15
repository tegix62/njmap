// Runs a war with a bot as the human lord and writes a Ledger and a metrics file.
//   node tools/goblin/run.mjs --seed 1 --days 21 --bot careful --home "Paterson City|Passaic" [--out out]
//   node tools/goblin/run.mjs --seeds 10 --days 21 --bot bold                       (a batch: seeds 1..10, writes a summary)
import fs from 'node:fs';
import path from 'node:path';
import { makeBoard } from '../../js/goblin/sim/board.js';
import { loadContent } from '../../js/goblin/sim/chars.js';
import { newWorld, step, checkInvariants } from '../../js/goblin/sim/world.js';
import { nextChapterCfg, rivalsFor } from '../../js/goblin/sim/chapters.js';
import { renderLedger } from '../../js/goblin/sim/ledger.js';
import { makeBot } from './bots.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const content = loadContent(read('data/goblin-content.json'));
const regions = read('data/goblin-regions.json');
export const board = makeBoard(read('data/goblin-board.json'), content, regions);
export const START_MS = Date.UTC(2026, 8, 15);   // a fixed real date, so runs are reproducible and begin in autumn

const SITTING_LIMIT = 10;
const RULES = Object.fromEntries((arg('set', '') || '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k, +v]; }));   // --set frontMaxGain=1,aiAttackRatio=1.5

export function runWar({ seed, days = 21, bot = 'careful', home = 'Paterson City|Passaic', rules = {}, world = null, rivals = 'fixed' }) {
  const lord = makeBot(bot);
  const rivalCfg = rivals === 'pool' ? rivalsFor('war' + seed) : [{ id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }];
  let w = world || newWorld(board, { seed: 'war' + seed, home, clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, ...rivalCfg], rules, startMs: START_MS });
  const startTowns = Object.values(w.towns).filter((t) => t.owner === 'goblins').length;
  const events = [], perDay = [];
  const rejected = [];
  let ranDays = 0;
  for (let day = 0; day < days; day++) {
    if (w.war && w.war.over) break;   // the war has ended
    ranDays++;
    const dayEvents = [];
    const apply = (orders, ticks) => { const r = step(board, w, orders, ticks); w = r.state; dayEvents.push(...r.events); return r.events; };
    apply([{ type: 'present', clan: 'goblins' }], 0);
    const ctx = lord.newCtx();
    for (let i = 0; i < SITTING_LIMIT; i++) {
      const o = lord.next(board, w, 'goblins', ctx);
      if (!o) break;
      const ev = apply([o], 0);
      for (const e of ev) if (e.type === 'order_rejected') rejected.push(e);
    }
    apply([], 24);
    const bad = checkInvariants(board, w);
    if (bad.length) throw new Error(`seed ${seed} day ${day}: ${bad.join('; ')}`);
    events.push(...dayEvents); perDay.push(dayEvents);
  }
  return { state: w, events, perDay, startTowns, rejected, bot: lord.name, ranDays };
}

const shapeKey = (e) => {
  switch (e.type) {
    case 'skirmish_result': case 'raid_landed': return `${e.type}:${e.won ? 'won' : 'lost'}:${e.by === 'goblins' ? 'you' : e.against === 'goblins' ? 'against-you' : 'ai'}`;
    case 'front_beat': return `beat:${e.maneuver}:${e.change ?? ''}`;
    case 'front_closed': return `front_closed:${e.verdict}`;
    case 'closeup': return `closeup:${e.what}`;
    case 'promoted': return `promoted:${e.tag}`;
    default: return e.type;
  }
};
const QUIET = new Set(['recruits', 'dug_in', 'director_word', 'order_rejected']);

/** Play chapters one after another: win and the next region opens with your clan; lose (or run out of days) and the region is played again with new rivals (D175). */
export function runCampaign({ seed, bot = 'careful', chapters = 3, days = 40, home = 'Paterson City|Passaic', maxTries = 3 }) {
  const log = [];
  let cfg = { seed: `${seed}.1`, home, clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, ...rivalsFor(`${seed}.1`)], startMs: START_MS, campaign: { chapter: 1, kits: [] } };
  let chapter = 1, tries = 0;
  while (chapter <= chapters && tries < chapters * maxTries) {
    tries++;
    const world = newWorld(board, cfg);
    const r = runWar({ seed, days, bot, world });
    const over = r.state.war.over, won = !!over && over.winner === 'goblins';
    log.push({ chapter, kit: board.regions.townKit[cfg.home], won, day: over ? Math.floor(over.tick / 24) : null, captains: Object.values(r.state.chars).filter((c) => c.clan === 'goblins' && c.status === 'active').length, res: r.state.clans.goblins.res, state: r.state });
    if (won) { cfg = nextChapterCfg(board, r.state); chapter++; }
    else cfg = { ...cfg, seed: `${cfg.seed}r`, clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, ...rivalsFor(`${cfg.seed}r`)] };   // the same region again, no hard reset
  }
  return log;
}

export function metricsOf(run, days) {
  const { events, perDay, state } = run;
  days = run.ranDays || days;   // a war that ended early is measured over the days it ran
  const count = {}; for (const e of events) count[e.type] = (count[e.type] || 0) + 1;
  const shapesPerDay = perDay.map((d) => new Set(d.filter((e) => !QUIET.has(e.type)).map(shapeKey)).size);
  const taken = {}, lost = {};
  for (const e of events) {
    if ((e.type === 'skirmish_result' || e.type === 'raid_landed')) { lost[e.by] = (lost[e.by] || 0) + e.lost.attackers; if (e.against) lost[e.against] = (lost[e.against] || 0) + e.lost.defenders; if (e.won) taken[e.by] = (taken[e.by] || 0) + 1; }
    if (e.type === 'front_closed') { lost[e.clan] = (lost[e.clan] || 0) + e.lost.a; if (e.verdict === 'Won' || e.verdict === 'Yielded') taken[e.clan] = (taken[e.clan] || 0) + 1; }
  }
  const lossPerTown = {}; for (const c of Object.keys(taken)) lossPerTown[c] = +(lost[c] / taken[c]).toFixed(2);
  const beats = {}; for (const e of events) if (e.type === 'front_closed') beats[e.beats] = (beats[e.beats] || 0) + 1;
  const verdicts = {}; for (const e of events) if (e.type === 'front_closed') verdicts[e.verdict] = (verdicts[e.verdict] || 0) + 1;
  const words = {}; for (const e of events) if (e.type === 'director_word' && e.clan === 'goblins') words[e.word] = (words[e.word] || 0) + 1;
  const owners = {}; for (const t of Object.values(state.towns)) owners[t.owner] = (owners[t.owner] || 0) + 1;
  const d = state.director.goblins || {};
  const over = state.war && state.war.over;
  return { days, war: over ? { winner: over.winner, how: over.how, day: Math.floor((state.startHour + over.tick) / 24) + 1 } : null, bot: run.bot, startTowns: run.startTowns, endTowns: owners.goblins || 0, finalTownsByClan: owners,
    eventCounts: count, distinctShapesPerDay: { mean: +(shapesPerDay.reduce((a, b) => a + b, 0) / days).toFixed(2), min: Math.min(...shapesPerDay), perDay: shapesPerDay },
    unitsLost: lost, townshipsTaken: taken, unitsLostPerTownshipTaken: lossPerTown,
    fronts: { opened: count.front_opened || 0, closedByVerdict: verdicts, beatsDistribution: beats, stillOpenAtEnd: Object.keys(state.fronts).length },
    director: { goblinsWordChanges: words, extras: count.director_extra || 0, nudges: count.director_nudge || 0, heldBack: d.held || 0, raidsDeclared: count.raid_declared || 0 },
    orderRejected: run.rejected.length };
}

function one(seed, days, bot, home, out) {
  const run = runWar({ seed, days, bot, home, rules: RULES });
  const m = metricsOf(run, days);
  fs.mkdirSync(out, { recursive: true });
  const header = `# Ledger: seed ${seed}, ${run.bot} lord of the goblins, ${days} days\n\nAll wording is placeholder (D68). Every place phrase is computed from the map data. Start: ${run.startTowns} townships; end: ${m.endTowns}.\n`;
  fs.writeFileSync(path.join(out, `ledger-${bot}-${seed}.md`), header + renderLedger(run.events, { board, state: run.state, content, clan: 'goblins' }));
  fs.writeFileSync(path.join(out, `metrics-${bot}-${seed}.json`), JSON.stringify(m, null, 1));
  return m;
}

if (process.argv[1] && process.argv[1].endsWith('run.mjs')) {
  const days = +arg('days', 21), bot = arg('bot', 'careful'), home = arg('home', 'Paterson City|Passaic'), out = arg('out', 'out');
  if (arg('seeds', null)) {
    const n = +arg('seeds'); const rows = [];
    const t0 = process.hrtime.bigint();
    for (let s = 1; s <= n; s++) rows.push({ seed: s, ...one(s, days, bot, home, out) });
    const sec = Number(process.hrtime.bigint() - t0) / 1e9;
    const avg = (f) => +(rows.reduce((a, r) => a + f(r), 0) / n).toFixed(2);
    const summary = { bot, seeds: n, days, seconds: +sec.toFixed(1), meanStart: avg((r) => r.startTowns), meanEnd: avg((r) => r.endTowns), meanShapesPerDay: avg((r) => r.distinctShapesPerDay.mean), meanFronts: avg((r) => r.fronts.opened),
      meanLossPerTownTaken: avg((r) => r.unitsLostPerTownshipTaken.goblins ?? 0), meanExtras: avg((r) => r.director.extras), meanHeldBack: avg((r) => r.director.heldBack), rejectedOrders: rows.reduce((a, r) => a + r.orderRejected, 0),
      perSeed: rows.map((r) => ({ seed: r.seed, start: r.startTowns, end: r.endTowns, fronts: r.fronts.opened, verdicts: r.fronts.closedByVerdict })) };
    fs.writeFileSync(path.join(out, `summary-${bot}.json`), JSON.stringify(summary, null, 1));
    console.log(JSON.stringify({ ...summary, perSeed: undefined }, null, 1));
  } else {
    const m = one(+arg('seed', 1), days, bot, home, out);
    console.log(JSON.stringify({ ...m, distinctShapesPerDay: { mean: m.distinctShapesPerDay.mean, min: m.distinctShapesPerDay.min } }, null, 1));
  }
}
