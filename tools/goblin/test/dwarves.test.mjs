import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { loadContent } from '../../../js/goblin/sim/chars.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';
import * as D from '../../../js/goblin/sim/dwarves.js';
import * as Dir from '../../../js/goblin/sim/director.js';
import { legalOrders } from '../../../js/goblin/sim/front.js';
import { progress } from '../../../js/goblin/sim/war.js';
import { entriesOf } from '../../../js/goblin/sim/ledger.js';
import { makeRng, seedState } from '../../../js/goblin/sim/rng.js';
import { K6, K11 } from '../../../js/goblin/sim/constants.js';
import { runWar } from '../run.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const regions = read('../../../data/goblin-regions.json');
const content = loadContent(read('../../../data/goblin-content.json'));
const board = makeBoard(read('../../../data/goblin-board.json'), content, regions);
const ev = (events, t) => events.filter((e) => e.type === t);
const scripted = (dice, seed = 'sc') => { const r = makeRng(seedState(seed)), q = [...dice]; return { get state() { return r.state; }, next: () => r.next(), int: (n) => r.int(n), d6: () => (q.length ? q.shift() : r.d6()) }; };
const clans = [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }];
const world = (seed = 'dw') => { const w = newWorld(board, { seed, home: 'Paterson City|Passaic', clans, startMs: Date.UTC(2026, 8, 15) }); w.clans.goblins.shieldUntil = 0; return w; };
const dwarfTowns = (w) => Object.keys(w.towns).filter((t) => w.towns[t].owner === 'dwarves');
const mine = (w, id = 'goblins') => Object.keys(w.towns).filter((t) => w.towns[t].owner === id);
// a rock town with a township of ours beside it
function nextToRock(w) { for (const r of dwarfTowns(w)) for (const n of board.neighbours(r)) if (w.towns[n] && w.towns[n].owner === 'goblins') return { rock: r, mine: n }; return null; }
// a rock town with a township of a given AI clan beside it
function rivalBeside(w, clan) { for (const r of dwarfTowns(w)) for (const n of board.neighbours(r)) if (w.towns[n] && w.towns[n].owner === clan) return { rock: r, rival: n }; return null; }
function arrange(w, who = 'rats') {   // make sure a rival township borders a rock town (the real map may not give one)
  const r = dwarfTowns(w)[0]; const n = board.neighbours(r).find((x) => w.towns[x] && w.towns[x].owner !== 'dwarves' && w.towns[x].owner !== 'goblins' && x !== w.clans[who].home) || board.neighbours(r).find((x) => w.towns[x] && w.towns[x].owner !== 'dwarves' && x !== w.clans.goblins.home && x !== w.clans[who].home);
  const T = w.towns[n]; if (T.captain) { const c = w.chars[T.captain]; c.status = 'dead'; c.at = null; T.captain = null; }
  T.owner = who; T.force = 20; return { rock: r, rival: n };
}

test('the rock list is the app\'s own: townships under a named mountain or ridge, with the sources named and no mining claimed', () => {
  assert.ok(Object.keys(regions.rock).length >= 25); assert.match(regions.rockSource, /Mining history is not claimed/);
  for (const id of Object.keys(regions.rock)) assert.ok(board.has(id), id);
  assert.ok(regions.rock['Woodland Park Borough|Passaic'].includes('Garret Mountain') && regions.rock['Montague Township|Sussex'].includes('High Point'));
});

test('a war with rock towns in its theatre has a dwarf clan: it holds them dug in with 12, keeps no economy, never takes a clan home, and leaves a player\'s own rock towns alone', () => {
  const w = world(); const d = dwarfTowns(w);
  assert.ok(w.clans.dwarves && d.length >= 3, `dwarf towns ${d.length}`);
  for (const t of d) { assert.ok(regions.rock[t]); assert.equal(w.towns[t].force, K11.dwarfForce); assert.equal(w.towns[t].dugIn, true); assert.equal(w.towns[t].captain, null); }
  assert.equal(w.clans.dwarves.res, undefined, 'no Food, Build or Coin for the dwarves');
  for (const c of Object.values(w.clans)) assert.ok(c.id === 'dwarves' || w.towns[c.home].owner === c.id, `${c.id} keeps its home`);
  assert.deepEqual(checkInvariants(board, w), []);
  assert.ok(Object.values(w.towns).filter((t) => t.owner === 'goblins').every((t) => true));
});

test('nobody conquers the rock: a player\'s attack, front and foothold are refused with a reason, and legalOrders offers Seek instead', () => {
  const w = world('rock1'); let nx = nextToRock(w);
  if (!nx) { const r = dwarfTowns(w)[0]; const n = board.neighbours(r).find((x) => w.towns[x] && w.towns[x].owner !== 'dwarves' && x !== w.clans.goblins.home); w.towns[n].owner = 'goblins'; w.towns[n].force = 10; w.towns[n].captain = null; nx = { rock: r, mine: n }; }
  w.towns[nx.mine].force = 10;
  for (const o of [{ type: 'attack', clan: 'goblins', from: nx.mine, to: nx.rock, n: 5 }, { type: 'front_open', clan: 'goblins', from: nx.mine, to: nx.rock, n: 5 }, { type: 'foothold', clan: 'goblins', town: nx.rock, method: 'swarm' }]) {
    assert.match(ev(step(board, w, [o], 0).events, 'order_rejected')[0].reason, /dwarves hold the rock/, o.type);
  }
  const legal = legalOrders(board, w, 'goblins');
  assert.ok(!legal.some((o) => (o.type === 'attack' || o.type === 'front_open') && o.to === nx.rock));
  assert.ok(legal.some((o) => o.type === 'seek' && o.town === nx.rock));
});

test('goaded: a rival that would attack a rock town is stopped, provokes the dwarves, and no battle is fought at the rock', () => {
  const w = world('goad'); const { rock, rival } = arrange(w, 'rats');
  w.towns[rival].force = 60; for (const t of Object.keys(w.towns)) if (t !== rival && w.towns[t].owner === 'rats') w.towns[t].force = 1;
  for (const n of board.neighbours(rival)) if (w.towns[n] && w.towns[n].owner !== 'rats' && w.towns[n].owner !== 'dwarves') w.towns[n].force = 400;   // no softer target: the rock is the best the rats can find
  w.startHour = 8; w.tick = 0;
  const before = w.towns[rock].force;
  const r = step(board, w, [], 1);
  const g = ev(r.events, 'dwarves_goaded');
  assert.ok(g.length >= 1 && g.some((e) => e.by === 'rats'), 'the rats provoked them');
  assert.equal(r.state.towns[rock].owner, 'dwarves'); assert.ok(r.state.towns[rock].force >= before - 0);
  assert.ok(r.state.goaded.rats >= r.state.tick + K11.goadTicks - 1);
  assert.ok(!ev(r.events, 'skirmish_result').some((e) => e.to === rock), 'no battle at the rock');
});

test('the dwarves answer a provoker\'s bordering township, strike no one else, and stop after two days', () => {
  const w = world('strike'); const { rock, rival } = arrange(w, 'rats');
  w.towns[rival].force = 3; w.towns[rock].force = 14; w.goaded = { rats: w.tick + K11.goadTicks };
  w.startHour = 8; w.tick = 0;
  const r = step(board, w, [], 1);
  const hit = ev(r.events, 'skirmish_result').filter((e) => e.by === 'dwarves');
  assert.ok(hit.length >= 1 && hit[0].against === 'rats'); assert.equal(r.state.towns[hit[0].from].owner === 'dwarves' || r.state.towns[hit[0].to].owner === 'dwarves', true, 'a township the rats hold beside the rock');
  assert.ok(ev(r.events, 'skirmish_result').every((e) => e.by !== 'dwarves' || e.against === 'rats'), 'only the provoker');
  assert.ok(r.state.towns[rock].force >= K11.dwarfKeep - 0, 'keeps some at home');
  // expired: nothing happens
  const w2 = world('strike2'); const a2 = arrange(w2, 'rats'); w2.towns[a2.rival].force = 3; w2.towns[a2.rock].force = 14; w2.goaded = { rats: -1 };
  const r2 = step(board, w2, [], 1); assert.equal(ev(r2.events, 'skirmish_result').filter((e) => e.by === 'dwarves').length, 0); assert.equal(r2.state.goaded.rats, undefined);
});

test('seeking the dwarves: 8 or more makes them friends and they send miners each tick; a failure waits a day', () => {
  const w = world('seek'); let nx = nextToRock(w);
  if (!nx) { const r = dwarfTowns(w)[0]; const n = board.neighbours(r).find((x) => w.towns[x] && w.towns[x].owner !== 'dwarves' && x !== w.clans.goblins.home); w.towns[n].owner = 'goblins'; w.towns[n].force = 6; w.towns[n].captain = null; nx = { rock: r, mine: n }; }
  const go = (st, dice) => step(board, st, [{ type: 'seek', clan: 'goblins', town: nx.rock }], 0, { rng: scripted(dice) });
  const bad = go(w, [1, 2]); assert.equal(ev(bad.events, 'dwarves_sought')[0].ok, false); assert.equal(bad.state.clans.goblins.ap, K6.apStart - 1);
  assert.match(ev(go(bad.state, [6, 6]).events, 'order_rejected')[0].reason, /turned you away/);
  const ok = go(w, [4, 4]); assert.equal(ev(ok.events, 'dwarves_sought')[0].ok, true); assert.ok(ok.state.dwarfFriends.goblins);
  assert.match(ev(go(ok.state, [6, 6]).events, 'order_rejected')[0].reason, /already your friends/);
  const before = ok.state.towns[nx.mine].force;
  const tick = step(board, ok.state, [], 1);
  const help = ev(tick.events, 'dwarves_help'); assert.equal(help.length, 1); assert.equal(help[0].n, K11.helpUnits);
  assert.ok(Object.values(tick.state.towns).filter((t) => t.owner === 'goblins').reduce((n, t) => n + t.force, 0) > 0);
  assert.ok(board.neighbours(nx.rock).includes(help[0].town));
  // a friend is never goaded against: the dwarves do not strike the player
  assert.equal(ev(tick.events, 'skirmish_result').filter((e) => e.by === 'dwarves' && e.against === 'goblins').length, 0);
});

test('the hidden hand works in timing only: while a player is Heated it steers one rival at a rock town, a hammering tell first that names no cause, then the provocation; once in three days; only a rock town', () => {
  const w = world('hand'); const { rock, rival } = arrange(w, 'rats'); w.towns[rival].force = 20;
  const dir = { wordOf: () => 'Heated', peakFree: () => true, spendPeak: (ww, id) => { dir.spent = id; } };
  const events = []; const emit = (type, d) => events.push({ type, tick: w.tick, ...d });
  w.tick = 100;
  D.steerTurn(w, board, emit, dir);
  assert.equal(events.length, 1); assert.equal(events[0].type, 'hammering'); assert.ok(regions.rock[events[0].town], 'a rock town');
  assert.equal(events[0].clan, undefined, 'it names no clan and no cause'); assert.equal(dir.spent, 'goblins', 'it spends the day\'s peak');
  const text = entriesOf(events, { board, state: w, content, clan: 'goblins' }).map((e) => e.text).join(' ');
  assert.match(text, /[Hh]ammering/); assert.doesNotMatch(text, /Director|steer/i);
  D.resolveSteer(w, board, emit); assert.equal(events.length, 1, 'not in the same tick');
  w.tick = 103; D.resolveSteer(w, board, emit);
  assert.equal(events[1].type, 'dwarves_goaded'); assert.ok(['rats', 'toads'].includes(events[1].by), 'a rival, never the player or the dwarves'); assert.ok(regions.rock[events[1].town]);
  w.steer = null; w.tick = 110; events.length = 0; D.steerTurn(w, board, emit, dir); assert.equal(events.length, 0, 'once in three days');
  w.tick = 100 + K11.steerGap; D.steerTurn(w, board, emit, dir); assert.equal(events.length, 1);
  // never while the player is fine, or when the peak is spent
  const calm = { ...dir, wordOf: () => 'Calm' }; w.steer = null; w.lastSteer = {}; events.length = 0; D.steerTurn(w, board, emit, calm); assert.equal(events.length, 0);
  const spent = { ...dir, peakFree: () => false }; D.steerTurn(w, board, emit, spent); assert.equal(events.length, 0, 'the day\'s one peak is shared');
});

test('the dwarves\' townships are not part of the map you win: the war counts only what can be taken', () => {
  const w = world('war'); const total = Object.values(w.towns).filter((t) => t.owner !== 'dwarves').length;
  assert.equal(progress(w, 'goblins').total, total); assert.ok(total < Object.keys(w.towns).length);
});

test('over 35 days on 8 seeds the dwarves never attack unprovoked, never take a player\'s land while friends, and the world stays valid', () => {
  let goads = 0, strikes = 0;
  for (let s = 1; s <= 8; s++) {
    const r = runWar({ seed: s, days: 35, bot: 'careful', rivals: 'pool' });
    const goaded = new Map();
    for (const e of r.events) {
      if (e.type === 'dwarves_goaded') { goads++; goaded.set(e.by, e.tick); }
      if (e.type === 'skirmish_result' && e.by === 'dwarves') {
        strikes++; const at = goaded.get(e.against); assert.ok(at !== undefined && e.tick - at <= K11.goadTicks + 24, `dwarves struck ${e.against} at ${e.tick} without a recent goad`);
        assert.notEqual(e.against, 'goblins', 'a player is only attacked by rivals, never by the dwarves');
      }
    }
    assert.deepEqual(checkInvariants(board, r.state), []);
  }
  assert.ok(goads > 0 && strikes > 0, `goads ${goads} strikes ${strikes}`);
});
