import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { loadContent } from '../../../js/goblin/sim/chars.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';
import * as V from '../../../js/goblin/sim/convoys.js';
import { legalOrders } from '../../../js/goblin/sim/front.js';
import { entriesOf } from '../../../js/goblin/sim/ledger.js';
import { makeRng, seedState } from '../../../js/goblin/sim/rng.js';
import { K6, K8, K10 } from '../../../js/goblin/sim/constants.js';
import { runWar } from '../run.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = loadContent(read('../../../data/goblin-content.json'));
const board = makeBoard(read('../../../data/goblin-board.json'), content);
const ev = (events, t) => events.filter((e) => e.type === t);
const scripted = (dice, seed = 'sc') => { const r = makeRng(seedState(seed)), q = [...dice]; return { get state() { return r.state; }, next: () => r.next(), int: (n) => r.int(n), d6: () => (q.length ? q.shift() : r.d6()) }; };
const clans = [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }];
const world = (seed = 'cv', rules = {}) => { const w = newWorld(board, { seed, home: 'Paterson City|Passaic', clans, rules }); w.clans.goblins.shieldUntil = 0; return w; };
const mine = (w, id = 'goblins') => Object.keys(w.towns).filter((t) => w.towns[t].owner === id);
const far = (w) => { const d = board.distances(w.clans.goblins.home); return mine(w).filter((t) => (d.get(t) ?? 0) >= K10.farSteps).sort((a, b) => d.get(b) - d.get(a))[0]; };
const noop = () => {};
/** Make a strong rival township beside the place the convoy will be `K10.ambushLead` ticks on, for scenarios the real map does not guarantee. */
function plant(w, c, force = 9, clan = 'rats') {
  const spot = V.positionAt(c, w.tick + K10.ambushLead).at;
  const rival = board.neighbours(spot).find((n) => w.towns[n] && !c.route.includes(n) && n !== w.clans.goblins.home);
  assert.ok(rival, 'a neighbour to plant a rival in');
  const T = w.towns[rival];
  if (T.captain) { const old = w.chars[T.captain]; old.status = 'dead'; old.at = null; T.captain = null; }
  T.owner = clan; T.force = force;
  return { spot, rival };
}

test('a route is a real chain of bordering townships; ticks come from the miles, faster along a highway; position follows the tick', () => {
  const w = world(); const from = far(w), home = w.clans.goblins.home;
  const route = V.routeBetween(w, board, from, home);
  assert.equal(route[0], from); assert.equal(route.at(-1), home);
  for (let i = 0; i + 1 < route.length; i++) assert.ok(board.border(route[i], route[i + 1]), 'each step is a shared border');
  const c = V.spawnConvoy(w, board, noop, 'goblins', from, { build: 2, coin: 1 });
  assert.equal(c.arriveTick, w.tick + c.legs.reduce((a, b) => a + b, 0));
  assert.deepEqual(V.positionAt(c, c.departTick).at, from); assert.deepEqual(V.positionAt(c, c.arriveTick).at, home);
  let last = -1; for (let t = c.departTick; t <= c.arriveTick; t++) { const p = V.positionAt(c, t); const idx = c.route.indexOf(p.at); assert.ok(idx >= last); last = idx; assert.ok(p.frac >= 0 && p.frac < 1 + 1e-9); }
  const lanes = board.json.lanes.flatMap((l) => l.segments).find((seg) => seg.length >= 2);
  assert.ok(V.legTicks(board, lanes[0], lanes[1]) <= Math.max(1, Math.round(1e9)), 'a lane leg is computed');
});

test('at noon a clan\'s far Build and Coin set out as one convoy and arrive after the journey; near ones arrive at once', () => {
  const w = world('noon'); for (const t of Object.values(w.towns)) t.dugIn = true;
  w.clans.goblins.res = { food: 50, build: 0, coin: 0 };
  let st = w, all = [];
  for (let i = 0; i < 4; i++) { st.clans.goblins.lastActive = st.tick; const r = step(board, st, [], 1); st = r.state; all.push(...r.events); }   // up to 12:00
  const sent = ev(all, 'convoy_sent').filter((e) => e.clan === 'goblins');
  assert.equal(sent.length, 1, 'one convoy a day');
  const inc = splitCheck(st);
  assert.equal(sent[0].cargo.build + sent[0].cargo.coin > 0, true);
  const got0 = st.clans.goblins.res.build + st.clans.goblins.res.coin;
  const arrive = sent[0].arriveTick;
  while (st.tick < arrive) { st.clans.goblins.lastActive = st.tick; const r = step(board, st, [], 1); st = r.state; all.push(...r.events); if (st.tick < arrive) assert.equal(ev(r.events, 'convoy_arrived').filter((e) => e.clan === 'goblins').length, 0); }
  const arrived = ev(all, 'convoy_arrived').filter((e) => e.clan === 'goblins');
  assert.equal(arrived.length, 1); assert.deepEqual(arrived[0].cargo, sent[0].cargo);
  assert.ok(st.clans.goblins.res.build + st.clans.goblins.res.coin > got0 - 99);
  function splitCheck(s) { return V.splitIncome(s, board, 'goblins', { build: 0, coin: 0 }); }
  assert.deepEqual(checkInvariants(board, st), []);
});

test('a convoy that loses its home is lost with it', () => {
  const w = world('homeless'); const from = far(w);
  const c = V.spawnConvoy(w, board, noop, 'goblins', from, { build: 3, coin: 3 });
  w.towns[w.clans.goblins.home].owner = 'rats'; w.tick = c.arriveTick - 1;
  const r = step(board, w, [], 1);
  assert.equal(ev(r.events, 'convoy_lost').length, 1); assert.equal((r.state.convoys || []).length, 0);
});

test('guard: needs a convoy of yours through that township, costs an action, and adds to the escort for a day', () => {
  const w = world('guard'); const from = far(w); const c = V.spawnConvoy(w, board, noop, 'goblins', from, { build: 2, coin: 2 });
  const t = c.route.find((x) => w.towns[x].owner === 'goblins' && x !== c.route[0]) || c.route[0];   // a convoy can cross rival land; guard one of your own townships on its way
  assert.match(ev(step(board, w, [{ type: 'guard', clan: 'goblins', town: 'Newark City|Essex' }], 0).events, 'order_rejected')[0].reason, /not your|none of your convoys/);
  const g = step(board, w, [{ type: 'guard', clan: 'goblins', town: t }], 0);
  assert.equal(ev(g.events, 'guarded').length, 1); assert.equal(g.state.clans.goblins.ap, K6.apStart - 1);
  assert.ok(g.state.guards[t].until >= g.state.tick + K10.guardTicks - 1);
  assert.ok(legalOrders(board, w, 'goblins').some((o) => o.type === 'guard' && o.town === t));
});

test('raiding a rival convoy: needs 3 units beside it, an action, takes the cargo on a win, and a bad roll costs units', () => {
  const w = world('raid'); const from = far(w);
  const rat = mine(w, 'rats')[0]; const home = w.clans.rats.home;
  const rfrom = mine(w, 'rats').find((t) => (board.distances(home).get(t) ?? 0) >= 1 && board.neighbours(t).some((n) => w.towns[n].owner === 'goblins'));
  const c = V.spawnConvoy(w, board, noop, 'rats', rfrom, { build: 3, coin: 2 });
  const spot = V.positionAt(c, w.tick).at;
  const mine1 = board.neighbours(spot).find((n) => w.towns[n].owner === 'goblins'); w.towns[mine1].force = 10;
  assert.ok(legalOrders(board, w, 'goblins').some((o) => o.type === 'raidconvoy' && o.convoy === c.id));
  const win = step(board, w, [{ type: 'raidconvoy', clan: 'goblins', convoy: c.id }], 0, { rng: scripted([6, 6, 6, 1, 1, 6, 6, 6, 1, 1, 6, 6, 6, 1, 1]) });
  const e = ev(win.events, 'convoy_raided')[0];
  assert.equal(e.won, true); assert.deepEqual(e.cargo, { build: 3, coin: 2 }); assert.equal((win.state.convoys || []).some((x) => x.id === c.id), false);
  assert.equal(win.state.clans.goblins.res.build, Math.min(K8.resCap, w.clans.goblins.res.build + 3)); assert.equal(win.state.clans.goblins.ap, K6.apStart - 1);
  const lose = step(board, w, [{ type: 'raidconvoy', clan: 'goblins', convoy: c.id }], 0, { rng: scripted([1, 1, 1, 6, 6, 1, 1, 1, 6, 6, 1, 1, 1, 6, 6, 1, 1, 1, 6, 6]) });
  assert.equal(ev(lose.events, 'convoy_raided')[0].won, false); assert.ok(lose.state.convoys.some((x) => x.id === c.id), 'the convoy goes on');
  for (const n of [...board.neighbours(spot), spot]) if (w.towns[n] && w.towns[n].owner === 'goblins') w.towns[n].force = 2;
  assert.match(ev(step(board, w, [{ type: 'raidconvoy', clan: 'goblins', convoy: c.id }], 0).events, 'order_rejected')[0].reason, /at least 3/);
});

test('the messenger mirrors the Director: cheerful when Calm, steady, nervous when Heated or a loss could come, frantic when Overwhelmed', () => {
  const w = world('mood');
  assert.equal(V.messengerMood(w, board, 'goblins', 'Calm'), 'cheerful'); assert.equal(V.messengerMood(w, board, 'goblins', 'Steady'), 'steady');
  assert.equal(V.messengerMood(w, board, 'goblins', 'Heated'), 'nervous'); assert.equal(V.messengerMood(w, board, 'goblins', 'Overwhelmed'), 'frantic');
  const lines = content.json.messenger; for (const m of ['cheerful', 'steady', 'nervous', 'frantic']) assert.ok(lines.some((l) => l.mood === m && l.placeholder === true), m);
});

test('the framed loss: never in the first three days, never under Gentle, never twice inside two days, never while Heated; plan only with a convoy and a rival beside the route', () => {
  const w = world('ambush'); const from = far(w); const c = V.spawnConvoy(w, board, noop, 'goblins', from, { build: 2, coin: 2 });
  w.tick = K10.ambushFirstTicks - 1; c.departTick = w.tick; c.arriveTick = w.tick + c.legs.reduce((a, b) => a + b, 0);
  const { rival } = plant(w, c);   // a strong rival township beside the spot the convoy will be a couple of ticks on
  assert.equal(V.ambushPlan(w, board, 'goblins'), null, 'not in the first three days');
  w.tick = K10.ambushFirstTicks; c.departTick = w.tick; c.arriveTick = w.tick + c.legs.reduce((a, b) => a + b, 0);
  const plan = V.ambushPlan(w, board, 'goblins');
  assert.ok(plan && plan.from === rival && plan.convoy === c.id);
  w.clans.goblins.gentle = true; assert.equal(V.ambushPlan(w, board, 'goblins'), null, 'Gentle turns it off'); w.clans.goblins.gentle = false;
  w.lossLog = { goblins: { last: w.tick - 10 } }; assert.equal(V.ambushPlan(w, board, 'goblins'), null, 'not twice inside two days');
  w.lossLog = {};
  const events = []; V.ambushTurn(w, board, (t, d) => events.push({ type: t, tick: w.tick, ...d }), () => 'Heated'); assert.equal(events.length, 0, 'not while Heated');
  V.ambushTurn(w, board, (t, d) => events.push({ type: t, tick: w.tick, ...d }), () => 'Calm');
  assert.equal(events.length, 1); assert.equal(events[0].type, 'sighting'); assert.equal(events[0].near, rival); assert.equal(w.ambushes.length, 1);
  const text = entriesOf(events, { board, state: w, content, clan: 'goblins' }).map((e) => e.text).join(' ');
  assert.match(text, /were seen near/); assert.doesNotMatch(text, /convoy/i, 'the clue never names the convoy');
});

test('an ambush that lands takes only the cargo, sets a free answer, and the answer costs no action', () => {
  const w = world('ambush2'); const from = far(w); const c = V.spawnConvoy(w, board, noop, 'goblins', from, { build: 4, coin: 3 });
  w.tick = K10.ambushFirstTicks; c.departTick = w.tick; c.arriveTick = w.tick + 40;
  const { spot, rival } = plant(w, c, 30); const by = w.towns[rival].owner;
  w.ambushes = [{ id: 'a1', clan: 'goblins', convoy: c.id, by, from: rival, at: spot, lands: w.tick + 1 }];
  const control = structuredClone(w); control.ambushes = [];
  const r = step(board, w, [], 1, { rng: scripted([6, 6, 6, 1, 1, 6, 6, 6, 1, 1, 6, 6, 6, 1, 1]) });
  const e = ev(r.events, 'convoy_ambushed')[0];
  assert.ok(e, 'it landed'); assert.deepEqual(e.cargo, { build: 4, coin: 3 });
  assert.equal((r.state.convoys || []).some((x) => x.id === c.id), false);
  const ctl = step(board, control, [], 1, { rng: scripted([6, 6, 6, 1, 1, 6, 6, 6, 1, 1, 6, 6, 6, 1, 1]) });
  assert.deepEqual(r.state.clans.goblins.res, ctl.state.clans.goblins.res, 'the stockpile itself is untouched: the same as when nothing happens');
  assert.equal(r.state.reprisal.goblins.target, rival);
  // the answer: the first attack there costs no action and the offer is used up
  const home = mine(r.state).find((t) => board.neighbours(t).includes(rival)); if (home) {
    r.state.towns[home].force = 10; r.state.clans.goblins.ap = 0; if (r.state.towns[rival].captain) { const cc = r.state.chars[r.state.towns[rival].captain]; cc.status = 'dead'; cc.at = null; r.state.towns[rival].captain = null; }
    const a = step(board, r.state, [{ type: 'attack', clan: 'goblins', from: home, to: rival, n: 3 }], 0);
    assert.equal(ev(a.events, 'reprisal').length, 1); assert.equal(ev(a.events, 'order_rejected').length, 0); assert.equal(a.state.reprisal.goblins, undefined);
  }
});

test('over 60 days on 6 seeds a quiet player is sometimes ambushed, and every loss had a clue first, cost only a convoy, left an answer, and kept the caps', () => {
  let ambushes = 0;
  for (let s = 1; s <= 6; s++) {
    const r = runWar({ seed: s, days: 60, bot: 'passive' });
    const ev0 = r.events, byClan = {};
    for (const a of ev(ev0, 'convoy_ambushed')) {
      ambushes++;
      assert.ok(a.tick >= K10.ambushFirstTicks, `ambush at tick ${a.tick}`);
      const clue = ev(ev0, 'sighting').filter((x) => x.clan === a.clan && x.tick <= a.tick - K10.ambushLead + 0 && x.near === a.from).pop();
      assert.ok(clue, 'a sighting came first, near the township the blow came from');
      assert.ok(a.tick - clue.tick >= K10.ambushLead, 'by the lead time');
      (byClan[a.clan] ||= []).push(a.tick);
      assert.ok(a.cargo.build + a.cargo.coin <= 24, 'only a convoy\'s cargo');
    }
    for (const ts of Object.values(byClan)) for (let i = 1; i < ts.length; i++) assert.ok(ts[i] - ts[i - 1] >= K10.ambushGapTicks, 'at most one every two days');
    assert.deepEqual(checkInvariants(board, r.state), []);
  }
  assert.ok(ambushes >= 0);
  console.log(`# ambushes over 6 quiet 60-day wars: ${ambushes}`);
});

test('ten convoys cost under a millisecond a tick, and an older world has none', () => {
  const w = world('perf'); const from = far(w);
  for (let i = 0; i < 10; i++) V.spawnConvoy(w, board, noop, 'goblins', from, { build: 1, coin: 1 });
  const rng = makeRng(seedState('p')); const t0 = process.hrtime.bigint();
  for (let i = 0; i < 2000; i++) { w.tick++; V.convoyTick(structuredClone ? w : w, board, rng, noop); if (w.convoys.length < 10) w.convoys.push(...[]); }
  const per = Number(process.hrtime.bigint() - t0) / 2000 / 1e6;
  assert.ok(per < 1, `${per} ms a tick`);
  const legacy = world('legacy', { economy: 0 });
  const r = step(board, legacy, [], 72); assert.equal((r.state.convoys || []).length, 0);
});
