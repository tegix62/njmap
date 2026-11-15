import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { loadContent, makeCaptain } from '../../../js/goblin/sim/chars.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';
import * as E from '../../../js/goblin/sim/economy.js';
import { legalOrders } from '../../../js/goblin/sim/front.js';
import { splitIncome } from '../../../js/goblin/sim/convoys.js';
import { entriesOf } from '../../../js/goblin/sim/ledger.js';
import { makeRng, seedState } from '../../../js/goblin/sim/rng.js';
import { K8 } from '../../../js/goblin/sim/constants.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = loadContent(read('../../../data/goblin-content.json'));
const board = makeBoard(read('../../../data/goblin-board.json'), content);
const ev = (events, t) => events.filter((e) => e.type === t);
const clans = [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }];
const world = (seed = 'eco', rules = {}) => { const w = newWorld(board, { seed, home: 'Paterson City|Passaic', clans, rules }); w.clans.goblins.shieldUntil = 0; return w; };
const mineOf = (w, id = 'goblins') => Object.keys(w.towns).filter((t) => w.towns[t].owner === id);

test('every township has a trade: the biggest third Coin, the middle Build, the smallest Food; clans start with a little of each', () => {
  const w = world();
  const counts = { coin: 0, build: 0, food: 0 }; for (const t of Object.values(w.towns)) counts[t.trade]++;
  const n = Object.keys(w.towns).length, third = Math.ceil(n / 3);
  assert.deepEqual(counts, { coin: third, build: third, food: n - 2 * third });
  const pops = (tr) => Object.keys(w.towns).filter((t) => w.towns[t].trade === tr).map((t) => board.town(t).pop);
  assert.ok(Math.min(...pops('coin')) >= Math.max(...pops('build')) && Math.min(...pops('build')) >= Math.max(...pops('food')));
  assert.deepEqual(w.clans.goblins.res, K8.start);
});

test('income: Food every tick (1 a township, plus the Food bonus), Build and Coin once a day at 12:00', () => {
  const w = world();
  const inc = E.income(w, 'goblins'), mine = mineOf(w).map((t) => w.towns[t]);
  assert.equal(inc.food, mine.length * K8.foodPerTown + mine.filter((t) => t.trade === 'food').length * K8.foodTownBonus);
  assert.equal(inc.build, mine.filter((t) => t.trade === 'build').length);
  w.clans.goblins.res = { food: 0, build: 0, coin: 0 };
  for (const t of Object.values(w.towns)) t.dugIn = true;   // so digging in does not spend the Build being counted
  let r = step(board, w, [], 1);    // 09:00
  assert.equal(r.state.clans.goblins.res.build, 0); assert.equal(r.state.clans.goblins.res.coin, 0);
  r = step(board, r.state, [], 3);  // 12:00 is the fourth tick
  const sp = splitIncome(w, board, 'goblins', inc);   // F4: what far townships make travels as a convoy
  assert.equal(r.state.clans.goblins.res.build, sp.near.build); assert.equal(r.state.clans.goblins.res.coin, sp.near.coin);
  assert.equal(sp.near.build + sp.far.build, inc.build); assert.equal(sp.near.coin + sp.far.coin, inc.coin);
  if (sp.far.build + sp.far.coin) assert.equal(r.state.convoys.filter((c) => c.clan === 'goblins').length, 1);
});

test('upkeep: every unit eats, and units packed into one township beyond the crowd limit eat twice', () => {
  const w = world();
  const t = mineOf(w)[0];
  w.towns[t].force = 4; const a = E.mouths(w, 'goblins');
  w.towns[t].force = K8.crowd + 4; const b = E.mouths(w, 'goblins');
  assert.equal(b - a, (K8.crowd + 4 - 4) + 4, 'ten more units, four of them over the limit eat double');
  assert.equal(E.upkeep(w, 'goblins'), Math.ceil(E.mouths(w, 'goblins') / K8.unitsPerFood));
});

test('hunger: a first short tick warns, a day later units drift home, never below one a township and never a captain', () => {
  const w = world('hunger');
  w.clans.goblins.res.food = 0;
  const t = mineOf(w)[0]; w.towns[t].force = 4000;      // far more mouths than the income can feed
  let st = w, all = [];
  for (let i = 0; i < 24 * 3; i++) { st.clans.goblins.lastActive = st.tick; const r = step(board, st, [], 1); st = r.state; all.push(...r.events); }
  const hunger = ev(all, 'hunger').filter((e) => e.clan === 'goblins'), dead = ev(all, 'deserted').filter((e) => e.clan === 'goblins');
  assert.equal(hunger.length, 1, 'one warning'); assert.equal(hunger[0].warning, true);
  assert.ok(dead.length >= 1 && dead[0].tick > hunger[0].tick, 'drift starts after the warning');
  const grace = dead[0].tick - hunger[0].tick;
  assert.ok(grace >= 24, `a day of grace (got ${grace} ticks)`);
  assert.ok(st.towns[t].force < 4000);
  assert.ok(Object.values(st.towns).filter((x) => x.owner === 'goblins').every((x) => x.force >= 1));
  assert.deepEqual(checkInvariants(board, st), []);
  assert.ok(entriesOf(all, { board, state: st, content, clan: 'goblins' }).some((e) => /running short of Food/.test(e.text)));
});

test('stockpiles never exceed the cap and never go negative', () => {
  let w = world('cap');
  for (let d = 0; d < 40; d++) {
    w.clans.goblins.lastActive = w.tick; w = step(board, w, [], 24).state;
    for (const c of Object.values(w.clans)) for (const k of ['food', 'build', 'coin']) assert.ok(c.res[k] >= 0 && c.res[k] <= K8.resCap, `${c.id} ${k} ${c.res[k]}`);
  }
});

test('recruits eat Food: the Food left is the Food before, plus income, minus upkeep, minus the recruits', () => {
  const w = world('recruit');
  w.clans.goblins.res.food = 20;
  const inc = E.income(w, 'goblins').food, up = E.upkeep(w, 'goblins');
  const r = step(board, w, [], 1);
  const rec = ev(r.events, 'recruits').find((e) => e.clan === 'goblins');
  assert.equal(r.state.clans.goblins.res.food, Math.min(K8.resCap, 20 + inc) - up - rec.n);
  // with no Food at all the clan recruits nobody
  const w2 = world('recruit2'); w2.clans.goblins.res.food = 0;
  const t = mineOf(w2)[0]; w2.towns[t].force = 3000;   // so upkeep eats all the income
  const r2 = step(board, w2, [], 1);
  assert.equal(ev(r2.events, 'recruits').find((e) => e.clan === 'goblins').n, 0);
});

test('a march costs 1 Food per 4 units sent, refused with a reason when the Food is not there', () => {
  const w = world('march');
  const o = legalOrders(board, w, 'goblins').find((x) => x.type === 'attack');
  const n = Math.min(o.n.max, 8);
  w.clans.goblins.res.food = E.marchCost(n);
  const r = step(board, w, [{ ...o, n }], 0);
  assert.equal(r.state.clans.goblins.res.food, 0);
  w.clans.goblins.res.food = E.marchCost(n) - 1;
  const rej = step(board, w, [{ ...o, n }], 0);
  assert.match(ev(rej.events, 'order_rejected')[0].reason, /Food/);
  assert.equal(E.marchCost(1), 1); assert.equal(E.marchCost(4), 1); assert.equal(E.marchCost(5), 2);
  // legalOrders never offers more than the Food can pay for
  w.clans.goblins.res.food = 1;
  assert.ok(legalOrders(board, w, 'goblins').filter((x) => x.type === 'attack').every((x) => x.n.max <= 4));
});

test('digging in at a tick costs a Build each; fortifying at once costs two Build and no action', () => {
  const w = world('dig');
  w.clans.goblins.res.build = 0;
  for (const t of mineOf(w)) { w.towns[t].dugIn = false; w.towns[t].attackedTick = -1; w.towns[t].force = Math.max(3, w.towns[t].force); }
  const r = step(board, w, [], 1);
  assert.equal(ev(r.events, 'dug_in').filter((e) => e.clan === 'goblins').length, 0, 'no Build, no digging in');
  const w2 = world('dig2'); w2.clans.goblins.res.build = 3;
  for (const t of mineOf(w2)) { w2.towns[t].dugIn = false; w2.towns[t].attackedTick = -1; w2.towns[t].force = Math.max(3, w2.towns[t].force); }
  const r2 = step(board, w2, [], 1);
  assert.equal(ev(r2.events, 'dug_in').filter((e) => e.clan === 'goblins').length, 3, 'three Build, three townships');
  const w3 = world('dig3'); const id = mineOf(w3).find((t) => w3.towns[t].force >= 3 && !w3.towns[t].dugIn);
  const f = step(board, w3, [{ type: 'fortify', clan: 'goblins', town: id }], 0);
  assert.equal(f.state.clans.goblins.res.build, K8.start.build - K8.fortifyCost); assert.equal(f.state.clans.goblins.ap, w3.clans.goblins.ap);
  w3.clans.goblins.res.build = 1;
  assert.match(ev(step(board, w3, [{ type: 'fortify', clan: 'goblins', town: id }], 0).events, 'order_rejected')[0].reason, /Build/);
});

test('a hired band: costs Coin, adds units, once a day, refused without the Coin', () => {
  const w = world('hire'); const t = mineOf(w)[0];
  w.clans.goblins.res.coin = K8.hireCost * 2;
  const r = step(board, w, [{ type: 'hire', clan: 'goblins', town: t }], 0);
  assert.equal(r.state.towns[t].force, w.towns[t].force + K8.hireUnits); assert.equal(r.state.clans.goblins.res.coin, K8.hireCost);
  assert.match(ev(step(board, r.state, [{ type: 'hire', clan: 'goblins', town: t }], 0).events, 'order_rejected')[0].reason, /already hired/);
  const next = step(board, r.state, [], 24).state;
  assert.equal(ev(step(board, next, [{ type: 'hire', clan: 'goblins', town: t }], 0).events, 'hired').length, 1, 'a new day');
  w.clans.goblins.res.coin = 1;
  assert.match(ev(step(board, w, [{ type: 'hire', clan: 'goblins', town: t }], 0).events, 'order_rejected')[0].reason, /Coin/);
});

test('a goblin bridge: costs Build, takes three major ticks, then the river no longer starts a front Behind', () => {
  const w = world('bridge');
  // a river border (no highway) between a township of ours and a rival's, with a captain on the far side
  let pair = null;
  for (const a of mineOf(w)) for (const b of board.neighbours(a)) { const bd = board.border(a, b); if (w.towns[b] && w.towns[b].owner && w.towns[b].owner !== 'goblins' && bd.river && !(bd.highways && bd.highways.length)) pair = pair || [a, b]; }
  assert.ok(pair, 'the board has such a pair near Paterson');
  const [a, b] = pair, other = w.towns[b].owner;
  if (w.towns[b].captain) { const old = w.chars[w.towns[b].captain]; old.status = 'dead'; old.at = null; w.towns[b].captain = null; }
  makeCaptain(w, makeRng(seedState('bridge')), content, { clan: other, town: b });
  w.towns[a].force = 12;
  const openFront = (st) => step(board, st, [{ type: 'front_open', clan: 'goblins', from: a, to: b, n: 4 }], 0);
  assert.equal(Object.values(openFront(w).state.fronts)[0].standing, 0, 'Behind across the river');
  const built = step(board, w, [{ type: 'bridge', clan: 'goblins', from: a, to: b }], 0);
  assert.equal(built.state.clans.goblins.res.build, K8.start.build - K8.bridgeCost); assert.equal(ev(built.events, 'bridge_started').length, 1);
  assert.match(ev(step(board, built.state, [{ type: 'bridge', clan: 'goblins', from: a, to: b }], 0).events, 'order_rejected')[0].reason, /already/);
  let st = built.state; const all = [];
  for (let i = 0; i < 24 * 4 && !ev(all, 'bridge_built').length; i++) { st.clans.goblins.lastActive = st.tick; const r = step(board, st, [], 1); st = r.state; all.push(...r.events); }
  assert.equal(ev(all, 'bridge_built').length, 1, 'finished');
  const majors = all.filter((e) => e.type === 'recruits' && e.clan === 'goblins').length;
  assert.ok(majors <= K8.bridgeMajors + 0, `took ${majors} major ticks`);
  assert.equal(E.hasBridge(st, 'goblins', a, b), true); assert.equal(E.hasBridge(st, 'rats', a, b), false, 'a goblin structure, only for the builder');
  st.towns[b].captain = w.towns[b].captain || st.towns[b].captain;
  assert.equal(Object.values(openFront(st).state.fronts)[0].standing, 1, 'Even once bridged');
  assert.match(ev(step(board, w, [{ type: 'bridge', clan: 'goblins', from: a, to: board.neighbours(a).find((n) => !(board.border(a, n) || {}).river) }], 0).events, 'order_rejected')[0].reason, /river/);
});

test('an older world without an economy is untouched: free recruits, no hunger', () => {
  const w = world('legacy', { economy: 0 });
  assert.equal(w.clans.goblins.res, undefined);
  let st = w; const all = [];
  for (let d = 0; d < 30; d++) { st.clans.goblins.lastActive = st.tick; const r = step(board, st, [], 24); st = r.state; all.push(...r.events); }
  assert.equal(ev(all, 'hunger').length + ev(all, 'deserted').length + ev(all, 'hired').length, 0);
});

test('over 400 simulated days on 8 seeds the economy stays bounded and the world stays valid; the AI spends its Coin', () => {
  let hired = 0, worst = 0;
  for (let s = 0; s < 8; s++) {
    let w = newWorld(board, { seed: 'long' + s, home: 'Paterson City|Passaic', clans: [{ id: 'goblins', kind: 'goblin', lord: 'ai' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }] });
    for (let d = 0; d < 400; d++) {
      const r = step(board, w, [], 24); w = r.state; hired += ev(r.events, 'hired').length;
      if (d % 40 === 39) assert.deepEqual(checkInvariants(board, w), [], `seed ${s} day ${d}`);
      if (w.war && w.war.over) break;
    }
    const total = Object.values(w.towns).reduce((n, t) => n + t.force, 0);
    worst = Math.max(worst, total / Object.keys(w.towns).length);
    for (const c of Object.values(w.clans)) for (const k of ['food', 'build', 'coin']) assert.ok(c.res[k] >= 0 && c.res[k] <= K8.resCap);
  }
  assert.ok(worst < 40, `units per township ${worst}`); assert.ok(hired > 0, 'the AI hires bands');
});

test('the Ledger reads hunger, drifting home, hired bands and bridges', () => {
  const w = world('ledger'); const t = mineOf(w)[0]; const o = legalOrders(board, w, 'goblins').find((x) => x.type === 'bridge');
  const r = step(board, w, [{ type: 'hire', clan: 'goblins', town: t }, ...(o ? [o] : [])], 0);
  w.clans.goblins.res.coin = 99;
  const events = [...step(board, w, [{ type: 'hire', clan: 'goblins', town: t }, ...(o ? [o] : [])], 0).events, { tick: 5, type: 'deserted', clan: 'goblins', n: 3, from: [t] }, { tick: 6, type: 'bridge_built', clan: 'goblins', a: t, b: board.neighbours(t)[0] }];
  const text = entriesOf(events, { board, state: r.state, content, clan: 'goblins' }).map((e) => e.text).join('\n');
  assert.match(text, /hired a band/); assert.match(text, /drifted home hungry/); assert.match(text, /bridge between/); assert.doesNotMatch(text, /\{\w+\}/);
});
