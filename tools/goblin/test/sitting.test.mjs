import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';
import * as C from '../../../js/goblin/sim/chars.js';
import { legalOrders, openFronts } from '../../../js/goblin/sim/front.js';
import { scoutMods, isNight, hasAp } from '../../../js/goblin/sim/sitting.js';
import { entriesOf } from '../../../js/goblin/sim/ledger.js';
import { makeRng, seedState } from '../../../js/goblin/sim/rng.js';
import { K6 } from '../../../js/goblin/sim/constants.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = C.loadContent(read('../../../data/goblin-content.json'));
const board = makeBoard(read('../../../data/goblin-board.json'), content);
const scripted = (dice, seed = 'sc') => { const r = makeRng(seedState(seed)), q = [...dice]; return { get state() { return r.state; }, next: () => r.next(), int: (n) => r.int(n), d6: () => (q.length ? q.shift() : r.d6()) }; };
const ev = (events, t) => events.filter((e) => e.type === t);

function world(seed = 's') {
  const w = newWorld(board, { seed, home: 'Paterson City|Passaic', clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }] });
  w.clans.goblins.shieldUntil = 0;
  return w;
}
// a township of the enemy with a captain, next to one of ours
function target(w) {
  for (const id of Object.keys(w.towns)) if (w.towns[id].owner === 'goblins') for (const n of board.neighbours(id)) {
    const T = w.towns[n]; if (T && T.owner && T.owner !== 'goblins' && T.captain) return { mine: id, town: n };
  }
}
const mkCap = (w, town, traits) => { const c = w.chars[w.towns[town].captain]; c.traits = traits.map(([id, notable]) => ({ id, notable })); c.fears = []; c.known = {}; return c; };

test('actions: a human clan starts with 3, gains 2 at each major tick, holds at most 4; attacks and fronts cost one', () => {
  let w = world();
  assert.equal(w.clans.goblins.ap, K6.apStart); assert.equal(w.clans.rats.ap, undefined, 'AI clans have none');
  const r = step(board, w, [], 1);   // tick 1 is 09:00 when the war starts at 08:00
  assert.equal(r.state.clans.goblins.ap, Math.min(K6.apCap, K6.apStart + K6.apPerMajor));
  const r2 = step(board, r.state, [], 24 * 3);
  assert.equal(r2.state.clans.goblins.ap, K6.apCap);
  // an attack costs one
  const legal = legalOrders(board, w, 'goblins').find((o) => o.type === 'attack');
  const a = step(board, w, [{ ...legal, n: 1 }], 0);
  assert.equal(a.state.clans.goblins.ap, K6.apStart - 1);
  // none left: attacks and fronts are refused, and legalOrders stops listing them
  w.clans.goblins.ap = 0;
  const rej = step(board, w, [{ ...legal, n: 1 }], 0);
  assert.match(ev(rej.events, 'order_rejected')[0].reason, /no actions left/);
  assert.equal(legalOrders(board, w, 'goblins').filter((o) => ['attack', 'front_open', 'scout', 'fortify', 'taunt'].includes(o.type)).length, 0);
  assert.ok(legalOrders(board, w, 'goblins').some((o) => o.type === 'move'), 'moves stay free');
  assert.equal(hasAp({}, 5), true, 'a clan with no ap field is unlimited');
});

test('fortify digs in at once, costs one, and is refused when it cannot help', () => {
  const w = world();
  const id = Object.keys(w.towns).find((t) => w.towns[t].owner === 'goblins' && w.towns[t].force >= 3 && !w.towns[t].dugIn);
  const r = step(board, w, [{ type: 'fortify', clan: 'goblins', town: id }], 0);
  assert.equal(r.state.towns[id].dugIn, true); assert.equal(r.state.clans.goblins.ap, K6.apStart - 1); assert.equal(ev(r.events, 'fortified').length, 1);
  assert.match(ev(step(board, r.state, [{ type: 'fortify', clan: 'goblins', town: id }], 0).events, 'order_rejected')[0].reason, /already/);
  const other = Object.keys(w.towns).find((t) => w.towns[t].owner === 'rats');
  assert.match(ev(step(board, w, [{ type: 'fortify', clan: 'goblins', town: other }], 0).events, 'order_rejected')[0].reason, /not your/);
  assert.ok(entriesOf(r.events, { board, state: r.state, content, clan: 'goblins' }).some((e) => /dug in at/i.test(e.text)));
});

test('scout: 7+ learns one fact, 10+ two, 3 or less costs a unit; modifiers by method; a captain must be next to you', () => {
  const w = world('scout'); const { mine, town } = target(w); const c = mkCap(w, town, [['greedy', true], ['vain', true], ['loud', false], ['fussy', false]]);
  const oldPop = board.towns[town].pop; board.towns[town].pop = 100;   // a quiet town: Ask has no bonus (restored below)
  const m = scoutMods(w, board, 'goblins', town, 'ask').total;
  const raw = (n) => { const a = Math.min(6, Math.max(1, n - m - 1)), b = Math.min(6, Math.max(1, n - m - a)); return [a, b]; };   // dice that make the modified roll n
  const go = (dice, method = 'ask', st = w) => step(board, st, [{ type: 'scout', clan: 'goblins', town, method }], 0, { rng: scripted(dice) });
  let r = go(raw(7)); let e = ev(r.events, 'scouted')[0];
  assert.equal(e.roll, 7); assert.deepEqual(e.learned, ['trait:greedy']); assert.equal(r.state.clans.goblins.ap, K6.apStart - 1);
  r = go(raw(10)); e = ev(r.events, 'scouted')[0];
  assert.deepEqual(e.learned, ['trait:greedy', 'trait:vain']);
  r = go(raw(6)); assert.deepEqual(ev(r.events, 'scouted')[0].learned, [], '6 learns nothing');
  const before = Object.values(w.towns).filter((t) => t.owner === 'goblins').reduce((n, t) => n + t.force, 0);
  r = go(raw(3)); e = ev(r.events, 'scouted')[0];
  assert.equal(e.lost, true);
  assert.equal(Object.values(r.state.towns).filter((t) => t.owner === 'goblins').reduce((n, t) => n + t.force, 0), before - 1);
  board.towns[town].pop = oldPop;
  // not a captain's township, and not near
  const far = Object.keys(w.towns).find((t) => w.towns[t].captain && w.towns[t].owner === 'toads' && !board.neighbours(t).some((n) => w.towns[n] && w.towns[n].owner === 'goblins'));
  if (far) assert.match(ev(step(board, w, [{ type: 'scout', clan: 'goblins', town: far, method: 'ask' }], 0).events, 'order_rejected')[0].reason, /next to yours/);
  assert.match(ev(step(board, w, [{ type: 'scout', clan: 'goblins', town: mine, method: 'ask' }], 0).events, 'order_rejected')[0].reason, /next to yours|another clan/);
  assert.match(ev(step(board, w, [{ type: 'scout', clan: 'goblins', town, method: 'fly' }], 0).events, 'order_rejected')[0].reason, /unknown method/);
});

test('scout methods: sneaking is better at night and is hurt by a light sleeper; asking likes a busy town; watching needs water', () => {
  const w = world('mods'); const { town } = target(w); mkCap(w, town, [['light-sleeper', true], ['vain', true], ['loud', false], ['fussy', false]]);
  w.startHour = 12; w.tick = 0;
  assert.deepEqual(scoutMods(w, board, 'goblins', town, 'sneak').mods.map((m) => m.v), [-1], 'noon: only the light sleeper');
  w.startHour = 23;
  assert.deepEqual(scoutMods(w, board, 'goblins', town, 'sneak').mods.map((m) => m.v), [2, -1]);
  assert.equal(isNight(21) && isNight(4) && !isNight(5) && !isNight(12), true);
  const big = Object.keys(w.towns).find((t) => board.town(t).pop >= K6.scoutBigTownPop && w.towns[t].captain && w.towns[t].owner !== 'goblins');
  if (big) assert.equal(scoutMods(w, board, 'goblins', big, 'ask').total, K6.scoutBigTownBonus);
  // legalOrders offers 'watch' only with a river between
  const methods = legalOrders(board, w, 'goblins').filter((o) => o.type === 'scout' && o.town === town).map((o) => o.method);
  assert.ok(methods.includes('sneak') && methods.includes('ask'));
  assert.equal(methods.includes('watch'), scoutMods(w, board, 'goblins', town, 'watch').total > 0);
});

test('taunt: needs something learned; 8+ lets the next front there start a step higher, once and within a day; a failure makes the captain dig in', () => {
  const w = world('taunt'); const { mine, town } = target(w); const c = mkCap(w, town, [['vain', true], ['greedy', true], ['loud', false], ['fussy', false]]);
  assert.match(ev(step(board, w, [{ type: 'taunt', clan: 'goblins', town }], 0).events, 'order_rejected')[0].reason, /scout/);
  C.discover(c, 'goblins', 'trait:greedy');
  let r = step(board, w, [{ type: 'taunt', clan: 'goblins', town }], 0, { rng: scripted([3, 3]) });   // 6 + 2 known - (vain counters pressure +1? it helps the attacker) 
  const t = ev(r.events, 'taunted')[0];
  const ok = t.ok;
  r = step(board, w, [{ type: 'taunt', clan: 'goblins', town }], 0, { rng: scripted([6, 6]) });
  assert.equal(ev(r.events, 'taunted')[0].ok, true);
  assert.ok(r.state.taunts[town]);
  const open = (st) => step(board, st, [{ type: 'front_open', clan: 'goblins', from: mine, to: town, n: Math.min(3, st.towns[mine].force - 1) }], 0);
  const o = open(r.state); assert.equal(ev(o.events, 'front_opened')[0].taunted, true);
  const base = open(w); assert.equal(ev(base.events, 'front_opened')[0].taunted, false);
  assert.ok(Object.values(o.state.fronts)[0].standing > Object.values(base.state.fronts)[0].standing);
  assert.equal(o.state.taunts[town], undefined, 'used up');
  // it lapses
  const late = structuredClone(r.state); late.tick += K6.tauntWindowTicks + 1; late.taunts[town].until = r.state.tick + K6.tauntWindowTicks;
  assert.equal(ev(open(late).events, 'front_opened')[0].taunted, false);
  // a failure digs the captain in
  const f = step(board, w, [{ type: 'taunt', clan: 'goblins', town }], 0, { rng: scripted([1, 1]) });
  assert.equal(ev(f.events, 'taunted')[0].ok, false); assert.equal(f.state.towns[town].dugIn, true);
});

test('the Ledger reads scouts, fortifying and taunts; the world stays valid through a long mixed run', () => {
  const w = world('ledger'); const { town } = target(w);
  const r = step(board, w, [{ type: 'scout', clan: 'goblins', town, method: 'ask' }], 0, { rng: scripted([4, 4]) });
  const t = entriesOf(r.events, { board, state: r.state, content, clan: 'goblins' }).map((e) => e.text).join('\n');
  assert.match(t, /sent a scout/); assert.doesNotMatch(t, /\{\w+\}/);
  let st = world('long'); const pick = makeRng(seedState('mix'));
  let seen = { scouted: 0, fortified: 0, taunted: 0 };
  for (let day = 0; day < 40; day++) {
    for (let k = 0; k < 4; k++) {
      const legal = legalOrders(board, st, 'goblins').filter((o) => o.type !== 'move');
      if (!legal.length) break;
      const o = { ...legal[pick.int(legal.length)] };
      if (o.n && typeof o.n === 'object') o.n = o.n.min + pick.int(o.n.max - o.n.min + 1);
      const rr = step(board, st, [o], 0); st = rr.state;
      for (const e of rr.events) { if (e.type === 'order_rejected') assert.fail('listed but rejected: ' + JSON.stringify(e)); if (e.type in seen) seen[e.type]++; }
      assert.deepEqual(checkInvariants(board, st), []);
    }
    st.clans.goblins.lastActive = st.tick;
    st = step(board, st, [], 24).state;
    assert.deepEqual(checkInvariants(board, st), []);
  }
  assert.ok(seen.scouted > 0 && seen.fortified > 0, JSON.stringify(seen));
});
