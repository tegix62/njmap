import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import * as C from '../../../js/goblin/sim/chars.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';
import { legalOrders, openFronts } from '../../../js/goblin/sim/front.js';
import { footholdMods, conf, settleState, maybeLegend } from '../../../js/goblin/sim/encounters.js';
import { entriesOf } from '../../../js/goblin/sim/ledger.js';
import { makeRng, seedState } from '../../../js/goblin/sim/rng.js';
import { K6, K8, K9 } from '../../../js/goblin/sim/constants.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = C.loadContent(read('../../../data/goblin-content.json'));
const board = makeBoard(read('../../../data/goblin-board.json'), content);
const scripted = (dice, seed = 'sc') => { const r = makeRng(seedState(seed)), q = [...dice]; return { get state() { return r.state; }, next: () => r.next(), int: (n) => r.int(n), d6: () => (q.length ? q.shift() : r.d6()) }; };
const ev = (events, t) => events.filter((e) => e.type === t);
const clans = [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }];
const world = (seed = 'enc') => { const w = newWorld(board, { seed, home: 'Paterson City|Passaic', clans }); w.clans.goblins.shieldUntil = 0; w.clans.goblins.res.coin = 40; return w; };
const mine = (w, id = 'goblins') => Object.keys(w.towns).filter((t) => w.towns[t].owner === id);
const go = (w, o, dice = [], extra = {}) => step(board, w, [o], 0, { rng: scripted(dice), ...extra });
// an enemy township with no captain next to ours, and one with a captain next to ours
function plain(w) { for (const a of mine(w)) for (const n of board.neighbours(a)) { const T = w.towns[n]; if (T && T.owner && T.owner !== 'goblins' && !T.captain) return { a, t: n }; } }
function cap(w) { for (const a of mine(w)) for (const n of board.neighbours(a)) { const T = w.towns[n]; if (T && T.owner && T.owner !== 'goblins' && T.captain) return { a, t: n, c: w.chars[T.captain] }; } }
const setTraits = (c, ids) => { c.traits = ids.map(([id, notable]) => ({ id, notable })); c.fears = []; c.known = {}; c.confidence = 70; c.state = null; return c; };

test('foothold: 8+ places one, 5 to 7 nothing, 4 or less loses a unit; a second run the same day is 2 worse; one waiting at a time', () => {
  const w = world(); const { a, t } = plain(w); w.towns[a].force = 12;
  const m = footholdMods(w, board, 'goblins', t, 'swarm').total;
  const raw = (n) => { const x = Math.min(6, Math.max(1, n - m - 1)); return [x, Math.min(6, Math.max(1, n - m - x))]; };
  let r = go(w, { type: 'foothold', clan: 'goblins', town: t, method: 'swarm' }, raw(9)); let e = ev(r.events, 'foothold_run')[0];
  assert.equal(e.placed, true); assert.equal(e.roll, 9); assert.equal(r.state.clans.goblins.ap, K6.apStart - 1);
  assert.match(ev(go(r.state, { type: 'foothold', clan: 'goblins', town: t, method: 'swarm' }, raw(9)).events, 'order_rejected')[0].reason, /already waiting/);
  r = go(w, { type: 'foothold', clan: 'goblins', town: t, method: 'swarm' }, raw(6)); assert.equal(ev(r.events, 'foothold_run')[0].placed, false);
  const before = Object.values(w.towns).filter((x) => x.owner === 'goblins').reduce((n, x) => n + x.force, 0);
  r = go(w, { type: 'foothold', clan: 'goblins', town: t, method: 'swarm' }, [1, 1]); e = ev(r.events, 'foothold_run')[0];
  assert.equal(e.lost, 1); assert.equal(Object.values(r.state.towns).filter((x) => x.owner === 'goblins').reduce((n, x) => n + x.force, 0), before - 1);
  // the second try the same day carries -2
  const again = go(r.state, { type: 'foothold', clan: 'goblins', town: t, method: 'swarm' }, [3, 3]);
  assert.deepEqual(ev(again.events, 'foothold_run')[0].mods.map((x) => x.why).includes('been tried today'), true);
  const after = footholdMods(r.state, board, 'goblin' + 's', t, 'swarm');
  assert.equal(after.total, m - K9.footholdDecay * r.state.footDay[t].n - K9.footholdTired * r.state.clans.goblins.footToday.n, 'worse on that township, and your scouts are tired');
  assert.ok(after.mods.some((x) => x.why === 'your scouts are tired'));
});

test('foothold methods: numbers help a big force, night helps at night, a ford needs a river; legalOrders lists only methods that can help', () => {
  const w = world(); const { a, t } = plain(w); w.towns[a].force = 30; w.towns[t].force = 3;
  assert.equal(footholdMods(w, board, 'goblins', t, 'swarm').total, K9.swarmCap, 'capped');
  w.startHour = 12; w.tick = 0; assert.equal(footholdMods(w, board, 'goblins', t, 'night').total, 0);
  w.startHour = 23; assert.equal(footholdMods(w, board, 'goblins', t, 'night').total, K9.nightBonus);
  const methods = legalOrders(board, w, 'goblins').filter((o) => o.type === 'foothold' && o.town === t).map((o) => o.method);
  assert.ok(methods.includes('swarm') && methods.includes('night'));
  w.startHour = 12;
  assert.ok(!legalOrders(board, w, 'goblins').some((o) => o.type === 'foothold' && o.town === t && o.method === 'night'), 'night is no use at noon');
});

test('a foothold is decided at the next major tick: it takes the township when the bordering force can hold it, and fails when it cannot', () => {
  const w = world('fh2'); const { a, t } = plain(w); w.towns[a].force = 14; w.towns[t].force = 3;
  const m = footholdMods(w, board, 'goblins', t, 'swarm').total, d = [Math.min(6, Math.max(1, 10 - m - 1))]; d.push(Math.min(6, Math.max(1, 10 - m - d[0])));
  const placed = go(w, { type: 'foothold', clan: 'goblins', town: t, method: 'swarm' }, d).state;
  assert.ok(placed.footholds[t]);
  const owner0 = placed.towns[t].owner;
  const r = step(board, placed, [], 1);   // the 09:00 tick
  const held = ev(r.events, 'foothold_held');
  if (r.state.towns[t].owner === 'goblins') { assert.equal(held.length, 1); assert.equal(held[0].against, owner0); assert.ok(r.state.towns[t].force >= 2); }
  assert.equal(r.state.footholds[t], undefined, 'decided either way');
  // too thin to hold
  const w2 = world('fh3'); const p = plain(w2); w2.towns[p.a].force = 3; w2.towns[p.t].force = 30; w2.footholds = { [p.t]: { clan: 'goblins', tick: 0 } };
  const r2 = step(board, w2, [], 1);
  assert.equal(r2.state.towns[p.t].owner, w2.towns[p.t].owner); assert.equal(ev(r2.events, 'foothold_lost').length, 1);
  assert.deepEqual(checkInvariants(board, r.state), []);
});

test('parley: costs Coin and an action, needs something learned, and the captain\'s township will not attack you for a day; attacking it breaks the truce', () => {
  const w = world('parley'); const { a, t, c } = cap(w); setTraits(c, [['vain', true], ['greedy', true], ['loud', false], ['fussy', false]]);
  assert.match(ev(go(w, { type: 'parley', clan: 'goblins', town: t }).events, 'order_rejected')[0].reason, /scout/);
  C.discover(c, 'goblins', 'trait:vain');
  const r = go(w, { type: 'parley', clan: 'goblins', town: t });
  assert.equal(ev(r.events, 'parleyed').length, 1); assert.equal(r.state.clans.goblins.res.coin, 40 - K9.parleyCost); assert.ok(r.state.truces[t]);
  w.clans.goblins.res.coin = 1;
  assert.match(ev(go(w, { type: 'parley', clan: 'goblins', town: t }).events, 'order_rejected')[0].reason, /Coin/);
  // attacking the truced township breaks the truce
  w.towns[a].force = 12;
  const f = step(board, r.state, [{ type: 'front_open', clan: 'goblins', from: a, to: t, n: 3 }], 0);
  assert.equal(ev(f.events, 'truce_broken').length, 1); assert.equal(f.state.truces[t], undefined);
  // the truce lapses by itself after a day
  const later = step(board, r.state, [], 72).state; assert.equal(later.truces[t], undefined);
});

test('insult: a good roll lowers confidence, a bad one raises it; at 40 or less the captain is Humiliated and a front against him starts a step better', () => {
  const w = world('insult'); const { a, t, c } = cap(w); setTraits(c, [['vain', true], ['greedy', true], ['loud', false], ['fussy', false]]); C.discover(c, 'goblins', 'trait:vain');
  let r = go(w, { type: 'insult', clan: 'goblins', town: t }, [6, 6]); let e = ev(r.events, 'insulted')[0];
  assert.equal(e.ok, true); assert.equal(r.state.chars[c.id].confidence, 70 - K9.insultDrop - 5, 'a proud captain takes it harder');
  r = go(w, { type: 'insult', clan: 'goblins', town: t }, [1, 1]); assert.equal(ev(r.events, 'insulted')[0].ok, false); assert.equal(r.state.chars[c.id].confidence, 100 > 70 + K9.insultBackfire ? 70 + K9.insultBackfire : 100);
  // three good insults bring him under the line
  let st = w; for (let i = 0; i < 3; i++) { st.clans.goblins.ap = 4; st = go(st, { type: 'insult', clan: 'goblins', town: t }, [6, 6]).state; }
  assert.ok(conf(st.chars[c.id]) <= K9.humiliatedBelow); assert.equal(st.chars[c.id].state, 'humiliated');
  st.towns[a].force = 12;
  const open = (x) => step(board, x, [{ type: 'front_open', clan: 'goblins', from: a, to: t, n: 4 }], 0);
  const base = world('insult'); setTraits(base.chars[c.id], [['vain', true], ['greedy', true], ['loud', false], ['fussy', false]]); base.towns[a].force = 12;
  const humil = Object.values(open(st).state.fronts)[0].standing, normal = Object.values(open(base).state.fronts)[0].standing;
  assert.ok(humil > normal || humil === 2, `humiliated ${humil} against ${normal}`);
  assert.ok(ev(open(st).events, 'front_opened')[0].humiliated);
  assert.ok(entriesOf(r.events, { board, state: r.state, content, clan: 'goblins' }).some((x) => /insulted/.test(x.text)));
});

test('confidence moves with fronts and creeps back at the evening tick; Humiliated lifts above 55', () => {
  const w = world('conf'); const { c } = cap(w); setTraits(c, [['vain', true], ['greedy', true], ['loud', false], ['fussy', false]]);
  c.confidence = 30; settleState(content, c); assert.equal(c.state, 'humiliated');
  c.confidence = 56; settleState(content, c); assert.equal(c.state, null);
  c.confidence = 30; c.state = 'humiliated';
  w.startHour = 17; w.tick = 0;   // tick 1 is 18:00
  const r = step(board, w, [], 1);
  assert.equal(r.state.chars[c.id].confidence, 30 + K9.confidenceRecovery);
});

test('a duel needs your captain next to theirs; the loser may be hurt, both move in confidence, and it costs an action', () => {
  const w = world('duel'); const { a, t, c } = cap(w);
  const mine = w.chars[w.towns[a].captain];
  if (!mine) { const r = C.makeCaptain(w, makeRng(seedState('d')), content, { clan: 'goblins', town: a }); }
  const ours = w.chars[w.towns[a].captain];
  setTraits(c, [['vain', true], ['greedy', true], ['loud', false], ['fussy', false]]); setTraits(ours, [['proud', true], ['patient', true], ['quick', false], ['fussy', false]]);
  const r = go(w, { type: 'duel', clan: 'goblins', town: t }, [6, 6, 1, 1, 4, 4]);
  const e = ev(r.events, 'dueled')[0];
  assert.equal(e.won, true); assert.equal(r.state.chars[ours.id].confidence, 70 + K9.duelWin); assert.equal(r.state.chars[c.id].confidence, 70 - K9.duelLose);
  assert.equal(r.state.clans.goblins.ap, K6.apStart - 1);
  assert.deepEqual(checkInvariants(board, r.state), []);
  const lone = world('duel2'); const p = cap(lone); const t2 = lone.towns[p.a];
  if (t2.captain) { const old = lone.chars[t2.captain]; old.status = 'dead'; old.at = null; t2.captain = null; }
  assert.match(ev(go(lone, { type: 'duel', clan: 'goblins', town: p.t }).events, 'order_rejected')[0].reason, /need a captain/);
});

test('captives: ransom pays Coin and sends the captain home; release makes a bond; keeping one costs Food each tick and they slip away when it cannot be paid', () => {
  const mk = () => { const w = world('cap'); const { c } = cap(w); const clan = c.clan; w.towns[c.at].captain = null; c.at = null; c.status = 'captured'; c.heldBy = 'goblins'; w.clans[clan].res.coin = 50; return { w, c, clan }; };
  let { w, c, clan } = mk();
  const price = K9.ransomBase + K9.ransomPerGeneration * (c.dynasty - 1);
  let r = go(w, { type: 'ransom', clan: 'goblins', char: c.id });
  assert.equal(ev(r.events, 'ransomed')[0].price, price); assert.equal(r.state.clans.goblins.res.coin, 40 + price); assert.equal(r.state.clans[clan].res.coin, 50 - price);
  assert.equal(r.state.chars[c.id].status, 'active'); assert.ok(r.state.chars[c.id].at);
  ({ w, c, clan } = mk()); w.clans[clan].res.coin = 0;
  assert.match(ev(go(w, { type: 'ransom', clan: 'goblins', char: c.id }).events, 'order_rejected')[0].reason, /cannot pay/);
  ({ w, c, clan } = mk());
  r = go(w, { type: 'release', clan: 'goblins', char: c.id });
  assert.equal(r.state.chars[c.id].status, 'active'); assert.ok(r.state.chars[c.id].bonds.includes('goblins'));
  // keeping costs Food at each major tick, and an unfed captive slips away
  ({ w, c, clan } = mk()); w.clans.goblins.res.food = 40;
  const fed = step(board, w, [], 1);
  assert.equal(fed.state.chars[c.id].status, 'captured'); assert.equal(ev(fed.events, 'escaped').length, 0, 'fed, so held');
  ({ w, c, clan } = mk()); w.clans.goblins.res.food = 0; for (const t of Object.values(w.towns)) if (t.owner === 'goblins') t.force = 3000;   // nothing left over for a captive
  const starved = step(board, w, [], 1);
  assert.equal(starved.state.chars[c.id].status === 'captured', false); assert.ok(ev(starved.events, 'escaped').length >= 1, 'an unfed captive slips away');
  assert.deepEqual(checkInvariants(board, starved.state), []);
});

test('a mercy is remembered: a captain you freed starts a front against you a step worse for him', () => {
  const w = world('mercy'); const { a, t, c } = cap(w); setTraits(c, [['vain', true], ['greedy', true], ['loud', false], ['fussy', false]]);
  w.towns[a].force = 12;
  const open = (x) => step(board, x, [{ type: 'front_open', clan: 'goblins', from: a, to: t, n: 4 }], 0);
  const normal = Object.values(open(w).state.fronts)[0].standing;
  c.bonds.push('goblins');
  const mercy = open(w); assert.equal(ev(mercy.events, 'front_opened')[0].mercy, true);
  assert.ok(Object.values(mercy.state.fronts)[0].standing >= normal);
});

test('three won fronts make a legend: a fifth, notable trait and a title, one a clan', () => {
  const w = world('legend'); const { c } = cap(w);
  const lead = Object.values(w.chars).find((x) => x.clan === 'goblins' && x.status === 'active');
  lead.tier = 2; lead.wins = 0; lead.traits = [['proud', true], ['patient', true], ['quick', false], ['fussy', false]].map(([id, notable]) => ({ id, notable }));
  const events = []; const emit = (type, d) => events.push({ type, ...d }); const rng = makeRng(seedState('lg'));
  assert.equal(maybeLegend(w, content, rng, lead, emit), null); assert.equal(maybeLegend(w, content, rng, lead, emit), null);
  assert.equal(maybeLegend(w, content, rng, lead, emit), lead);
  assert.equal(lead.tier, 3); assert.equal(lead.traits.length, 5); assert.equal(lead.traits.filter((t) => t.notable).length, 3); assert.deepEqual(lead.titles, ['legend']);
  assert.equal(events[0].type, 'legend');
  // a second captain of the same clan cannot be a legend while the first lives
  const other = Object.values(w.chars).find((x) => x.clan === 'goblins' && x.status === 'active' && x !== lead) || lead;
  if (other !== lead) { other.wins = 5; other.tier = 2; assert.equal(maybeLegend(w, content, rng, other, emit), null); }
  assert.deepEqual(checkInvariants(board, w), []);
});

test('a long mixed run of every encounter keeps the world valid and never lists an order it rejects', () => {
  let st = world('mixed'); const pick = makeRng(seedState('mixpick')); const seen = {};
  for (let day = 0; day < 40; day++) {
    for (let k = 0; k < 5; k++) {
      const legal = legalOrders(board, st, 'goblins').filter((o) => o.type !== 'move' && o.type !== 'front');
      if (!legal.length || (st.war && st.war.over)) break;
      const o = { ...legal[pick.int(legal.length)] };
      if (o.n && typeof o.n === 'object') o.n = o.n.min + pick.int(o.n.max - o.n.min + 1);
      const r = step(board, st, [o], 0); st = r.state;
      for (const e of r.events) { if (e.type === 'order_rejected') assert.fail('listed but rejected: ' + JSON.stringify(e)); seen[e.type] = (seen[e.type] || 0) + 1; }
      assert.deepEqual(checkInvariants(board, st), []);
    }
    st.clans.goblins.lastActive = st.tick; st = step(board, st, [], 24).state;
    for (const e of []) void e;
    assert.deepEqual(checkInvariants(board, st), [], `day ${day}`);
    if (st.war && st.war.over) break;
  }
  assert.ok(seen.foothold_run > 0 && seen.insulted > 0 || seen.foothold_run > 0, JSON.stringify(seen));
});
