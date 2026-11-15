import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';
import * as C from '../../../js/goblin/sim/chars.js';
import { bandOf, frontActions, legalOrders, openFronts, pinnedTowns } from '../../../js/goblin/sim/front.js';
import { makeRng, seedState } from '../../../js/goblin/sim/rng.js';
import { K4 } from '../../../js/goblin/sim/constants.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = C.loadContent(read('../../../data/goblin-content.json'));
const bigBoard = makeBoard(read('../../../data/goblin-board.json'), content);

// dice a test controls: the queue is used first (maneuver rolls, closeup rolls), then a real seeded generator
const scripted = (dice, seed = 'sc') => { const r = makeRng(seedState(seed)), q = [...dice]; return { get state() { return r.state; }, next: () => r.next(), int: (n) => r.int(n), d6: () => (q.length ? q.shift() : r.d6()) }; };

// A--B--C, A--E, B--D, A--F.  z owns A, E, F; y owns B, C, D.  A~B is a river border (no highway) when river is true.
function setup({ river = false, bForce = 9, aForce = 20, refuge = true, lead = true } = {}) {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];
  const edges = [['A', 'B'], ['B', 'C'], ['B', 'D'], ['A', 'E'], ['A', 'F']];
  const nb = Object.fromEntries(names.map((n) => [n, []]));
  for (const [a, b] of edges) { nb[a].push(b); nb[b].push(a); }
  const tj = { towns: Object.fromEntries(names.map((n, i) => [n, { name: n, pop: 100 - i, nb: nb[n] }])), borders: {} };
  for (const [a, b] of edges) tj.borders[`${a}~${b}`] = { mi: 1, river: a === 'A' && b === 'B' && river ? 'R' : null, ridge: null, highways: [] };
  const board = makeBoard(tj, content);
  const clan = (id, lord) => ({ id, kind: 'goblin', lord, home: null, shieldUntil: 0, lastActive: 0, absentSince: null, out: false, peakTowns: 6 });
  const t = { A: ['z', aForce], B: ['y', bForce], C: ['y', 4], D: ['y', 4], E: ['z', 5], F: ['z', 5] };
  const w = { v: 1, seed: 1, rng: 99, tick: 0, startHour: 8, lastMajor: 0, theatre: names, chars: {}, heirs: [], fronts: {}, raids: [], director: {}, nextId: 1,
    towns: Object.fromEntries(Object.entries(t).map(([id, [owner, force]]) => [id, { owner, force, dugIn: false, captain: null, attackedTick: -1 }])),
    clans: { z: { ...clan('z', 'human'), home: 'A' }, y: { ...clan('y', 'ai'), home: 'B' } } };
  if (!refuge) { w.towns.C.owner = 'z'; w.towns.D.owner = 'z'; }
  const r = makeRng(seedState('setup'));
  const def = C.makeCaptain(w, r, content, { clan: 'y', town: 'B' });
  def.traits = [['greedy', true], ['vain', true], ['night-owl', false], ['clumsy', false]].map(([id, notable]) => ({ id, notable })); def.fears = [];
  let ld = null;
  if (lead) { ld = C.makeCaptain(w, r, content, { clan: 'z', town: 'A' }); ld.traits = [['sharp-eyed', true], ['ruthless', true], ['loud', false], ['fussy', false]].map(([id, notable]) => ({ id, notable })); }
  return { board, w, def, ld };
}
const ev = (events, type) => events.filter((e) => e.type === type);
const open = (board, w, n = 10, rng) => step(board, w, [{ type: 'front_open', clan: 'z', from: 'A', to: 'B', n }], 0, rng ? { rng } : {});
const act = (board, w, front, action, dice, extra = {}) => step(board, w, [{ type: 'front', clan: 'z', front, action, ...extra }], 0, { rng: scripted(dice) });
const fid = (w) => Object.keys(w.fronts)[0];

test('bands: Probe and Pressure 11+ up two, 8-10 up one, 5-7 none, 4- down one; Lever 8+ up two, 5-7 none, 4- down one', () => {
  for (const [r, p, l] of [[2, -1, -1], [4, -1, -1], [5, 0, 0], [7, 0, 0], [8, 1, 2], [10, 1, 2], [11, 2, 2], [12, 2, 2]]) { assert.equal(bandOf('probe', r), p); assert.equal(bandOf('pressure', r), p); assert.equal(bandOf('lever', r), l); }
});

test('opening: units leave the township and are held; Even on land, Behind across a river with no highway; limits and refusals', () => {
  let { board, w } = setup();
  let r = open(board, w); const f = Object.values(r.state.fronts)[0];
  assert.equal(f.units, 10); assert.equal(r.state.towns.A.force, 10); assert.equal(f.standing, 1); assert.equal(f.beat, 0);
  assert.deepEqual(pinnedTowns(r.state), new Set(['B']));
  assert.equal(ev(r.events, 'front_opened')[0].standing, 'Even');
  assert.deepEqual(checkInvariants(board, r.state), []);
  ({ board, w } = setup({ river: true }));
  assert.equal(Object.values(open(board, w).state.fronts)[0].standing, 0, 'Behind');
  // refusals
  ({ board, w } = setup());
  const rej = (orders, st = w) => ev(step(board, st, orders, 0).events, 'order_rejected').length;
  assert.equal(rej([{ type: 'front_open', clan: 'z', from: 'A', to: 'B', n: 20 }]), 1, 'must keep one at home');
  assert.equal(rej([{ type: 'front_open', clan: 'z', from: 'A', to: 'E', n: 2 }]), 1, 'own township');
  assert.equal(rej([{ type: 'front_open', clan: 'z', from: 'A', to: 'C', n: 2 }]), 1, 'not neighbours');
  assert.equal(rej([{ type: 'attack', clan: 'z', from: 'A', to: 'B', n: 5 }]), 1, 'a captain defends: needs a front');
  assert.equal(rej([{ type: 'front_open', clan: 'z', from: 'A', to: 'C', n: 2 }]), 1);
  const st = open(board, w).state;
  assert.equal(rej([{ type: 'front_open', clan: 'z', from: 'A', to: 'B', n: 2 }], st), 1, 'a front is already open there');
  assert.equal(rej([{ type: 'front', clan: 'z', front: 'nope', action: 'probe' }], st), 1);
  assert.equal(rej([{ type: 'front', clan: 'z', front: fid(st), action: 'decision' }], st), 1, 'not before one maneuver');
  assert.equal(rej([{ type: 'front', clan: 'y', front: fid(st), action: 'probe' }], st), 1, 'not yours');
  // a township with no captain is attacked directly
  w.towns.C.captain = null;
  assert.equal(ev(step(board, w, [{ type: 'front_open', clan: 'z', from: 'A', to: 'C', n: 2 }], 0).events, 'order_rejected').length, 1);
});

test('at most three fronts per player', () => {
  const { board, w } = setup();
  // give y captains in C and D, and z a third and fourth target through E and F bordering them
  const r = makeRng(seedState('three'));
  C.makeCaptain(w, r, content, { clan: 'y', town: 'C' }); C.makeCaptain(w, r, content, { clan: 'y', town: 'D' });
  w.towns.E.owner = 'z';
  const b2 = (() => { const tj = read('../../../data/goblin-board.json'); return board; })();
  // use A as the origin against B only: three fronts need three targets, so link A to C and D for this test
  board.json.towns.A.nb.push('C', 'D'); board.json.towns.C.nb.push('A'); board.json.towns.D.nb.push('A');
  board.json.borders['A~C'] = { mi: 1, river: null, ridge: null, highways: [] }; board.json.borders['A~D'] = { mi: 1, river: null, ridge: null, highways: [] };
  const board2 = makeBoard(board.json, content);
  let st = w;
  for (const to of ['B', 'C', 'D']) st = step(board2, st, [{ type: 'front_open', clan: 'z', from: 'A', to, n: 3 }], 0).state;
  assert.equal(openFronts(st, 'z').length, 3);
  const rr = step(board2, st, [{ type: 'front_open', clan: 'z', from: 'A', to: 'B', n: 1 }], 0);
  assert.equal(ev(rr.events, 'order_rejected').length, 1);
  assert.equal(legalOrders(board2, st, 'z').filter((o) => o.type === 'front_open').length, 0);
});

test('actions: Probe and Pressure need a captain or 3+ units, Lever a known fact, Bridge only Behind across a river; Decision only after a maneuver; at most four maneuvers', () => {
  let { board, w } = setup({ lead: false });
  let st = open(board, w, 2).state; let f = st.fronts[fid(st)];
  assert.deepEqual(frontActions(st, f), ['disengage'], 'two units and no captain can do nothing but leave');
  ({ board, w } = setup({ lead: false }));
  st = open(board, w, 3).state; f = st.fronts[fid(st)];
  assert.deepEqual(frontActions(st, f), ['probe', 'pressure', 'disengage']);
  ({ board, w } = setup({ river: true }));
  st = open(board, w).state; f = st.fronts[fid(st)];
  assert.deepEqual(frontActions(st, f), ['probe', 'pressure', 'bridge', 'disengage']);
  st = act(board, st, f.id, 'bridge', []).state; f = st.fronts[f.id];
  assert.equal(f.standing, 1); assert.ok(!frontActions(st, f).includes('bridge'));
  assert.ok(frontActions(st, f).includes('decision'));
  // legalOrders agrees with frontActions
  const legal = legalOrders(board, st, 'z').filter((o) => o.type === 'front').map((o) => o.action);
  assert.deepEqual(legal, frontActions(st, f));
  // four maneuvers, then only the decision (or leaving)
  ({ board, w } = setup());
  st = open(board, w).state; f = st.fronts[fid(st)];
  for (let i = 0; i < 4; i++) { st = act(board, st, f.id, 'probe', [1, 1]).state; f = st.fronts[f.id]; }
  assert.equal(f.maneuvers, 4);
  assert.deepEqual(frontActions(st, f).filter((a) => a !== 'lever'), ['decision', 'disengage']);
  assert.ok(ev(act(board, st, f.id, 'probe', [6, 6]).events, 'order_rejected').length === 1, 'a fifth maneuver is refused');
});

test('a maneuver adds the leader\'s suited traits and the defender\'s hidden counters, clamped; what changed the band is discovered', () => {
  const { board, w } = setup();
  let st = open(board, w).state; const id = fid(st);
  // Probe: sharp-eyed (notable, suits probe) +2; defender night-owl -1 => +1. Dice 4+1 -> 6: a 5-7 band: nothing moves, the first fact (Greedy) is found.
  let r = act(board, st, id, 'probe', [4, 1]); st = r.state;
  const b = ev(r.events, 'front_beat')[0];
  assert.equal(b.total, 1); assert.equal(b.roll, 6); assert.equal(b.change, 0); assert.deepEqual(b.learned, ['trait:greedy']);
  assert.equal(st.fronts[id].standing, 1);
  assert.deepEqual(st.chars[st.towns.B.captain].known.z, ['trait:greedy']);
  // a hidden trait that pushes the roll across a band is discovered: dice 3+4 = 7, +1 = 8 would be up one; night-owl is why it is only... check by contrast
  const { board: b2, w: w2 } = setup(); let s2 = open(b2, w2).state;
  r = act(b2, s2, fid(s2), 'probe', [3, 4]);   // 7 + 2 - 1 = 8: up one. Without night-owl it would be 9: also up one, so nothing is discovered through the change
  assert.equal(ev(r.events, 'front_beat')[0].change, 1); assert.deepEqual(ev(r.events, 'front_beat')[0].learned, []);
  const { board: b3, w: w3 } = setup(); let s3 = open(b3, w3).state;
  r = act(b3, s3, fid(s3), 'probe', [3, 3]);   // 6 + 2 - 1 = 7: no move. Without night-owl: 8, up one. So Night owl changed the result and is discovered, plus the 5-7 discovery
  assert.equal(ev(r.events, 'front_beat')[0].change, 0);
  assert.deepEqual(ev(r.events, 'front_beat')[0].learned.sort(), ['trait:greedy', 'trait:night-owl']);
});

test('Lever: needs a known fact, adds +2, and the defender\'s Greedy, Vain and Clumsy each add +1; total clamps at +4', () => {
  const { board, w } = setup();
  let st = open(board, w).state; const id = fid(st);
  assert.ok(!frontActions(st, st.fronts[id]).includes('lever'));
  st = act(board, st, id, 'probe', [4, 1]).state;       // finds Greedy
  assert.ok(frontActions(st, st.fronts[id]).includes('lever'));
  const r = act(board, st, id, 'lever', [2, 4]);
  const b = ev(r.events, 'front_beat')[0];
  assert.equal(b.total, 4, '+2 and +3 clamped to +4'); assert.equal(b.roll, 10); assert.equal(b.change, 2);
  assert.equal(b.standing, 'Commanding', 'Even up two is Commanding');
  assert.equal(ev(r.events, 'front_closed')[0].verdict, 'Yielded');
});

test('Commanding: the defender yields, the attacker takes the township with no losses, and the closeup decides the captain', () => {
  const { board, w } = setup({ refuge: true });
  let st = open(board, w).state; const id = fid(st);
  st = act(board, st, id, 'probe', [4, 1]).state;
  const r = act(board, st, id, 'lever', [2, 4]);
  const c = ev(r.events, 'front_closed')[0];
  assert.equal(c.lost.a, 0); assert.equal(c.lost.d, 0);
  assert.equal(r.state.towns.B.owner, 'z'); assert.equal(r.state.towns.B.force, 10, 'the units arrive intact');
  assert.equal(r.state.towns.B.captain, st.fronts[id].lead, 'the leading captain moves in');
  assert.equal(Object.keys(r.state.fronts).length, 0);
  assert.deepEqual(c.learned, ['trait:greedy']); assert.ok(c.exposed.includes('A') === (r.state.towns.A.force <= 1));
  // Greedy (grab) and Vain (stand) do not pull both ways with a flee, so no roll: the captain retreats to a friendly neighbour with their units
  const cu = ev(r.events, 'closeup')[0];
  assert.equal(cu.roll, null); assert.equal(cu.what, 'fled'); assert.ok(['C', 'D'].includes(cu.to));
  assert.equal(r.state.towns[cu.to].captain, st.fronts[id].captain);
  assert.equal(r.state.towns[cu.to].force, 4 + 9, 'the defenders go with the captain');
  assert.deepEqual(checkInvariants(board, r.state), []);
});

test('closeup with a conflict: 6 or less he breaks and flees with a fear and a state, 7-10 he is captured, 11+ he persists with a new notable trait', () => {
  const cases = [[3, 3, 'fled'], [3, 4, 'captured'], [5, 5, 'captured'], [6, 5, 'persisted']];
  for (const [d1, d2, want] of cases) {
    const { board, w, def } = setup();
    def.traits = [['proud', true], ['timid', true], ['night-owl', false], ['clumsy', false]].map(([id, notable]) => ({ id, notable }));   // stand against flee
    let st = open(board, w).state; const id = fid(st);
    // rig a Yield: standing to 3 with two good rolls (Pressure +1 proud... counters are small, so use a standing nudge)
    st.fronts[id].standing = 2; st.fronts[id].maneuvers = 1; st.fronts[id].beat = 1;
    const r = step(board, st, [{ type: 'front', clan: 'z', front: id, action: 'probe' }], 0, { rng: scripted([6, 6, d1, d2]) });
    const cu = ev(r.events, 'closeup')[0];
    assert.equal(cu.roll, d1 + d2); assert.equal(cu.what, want);
    const c = r.state.chars[def.id];
    if (want === 'fled') { assert.deepEqual(c.fears.at(-1), { kind: 'town', ref: 'B' }); assert.equal(c.state, 'shaken'); assert.equal(c.status, 'active'); }
    if (want === 'captured') { assert.equal(c.status, 'captured'); assert.equal(c.heldBy, 'z'); }
    if (want === 'persisted') { assert.equal(c.traits.length, 4); assert.equal(c.traits.filter((t) => t.notable).length, 3); assert.equal(c.status, 'active'); }
    assert.deepEqual(checkInvariants(board, r.state), []);
  }
});

test('with nowhere to retreat the captain is captured', () => {
  const { board, w, def } = setup({ refuge: false });
  let st = open(board, w).state; const id = fid(st);
  st.fronts[id].standing = 2; st.fronts[id].maneuvers = 1; st.fronts[id].beat = 1;
  const r = step(board, st, [{ type: 'front', clan: 'z', front: id, action: 'probe' }], 0, { rng: scripted([6, 6]) });
  assert.equal(ev(r.events, 'closeup')[0].what, 'captured'); assert.equal(r.state.chars[def.id].status, 'captured');
});

test('the decision: Behind gives the defender a die and +1, Even +1, Ahead nothing; a leading captain adds an attacker die', () => {
  for (const [standing, defDice] of [[0, 3], [1, 2], [2, 2]]) {
    const { board, w } = setup({ bForce: 9 });
    let st = open(board, w, 17).state; const id = fid(st);
    st.fronts[id].standing = standing; st.fronts[id].maneuvers = 1; st.fronts[id].beat = 1;
    const r = step(board, st, [{ type: 'front', clan: 'z', front: id, action: 'decision' }], 0, { rng: scripted([], 'dec' + standing) });
    const b = ev(r.events, 'front_beat')[0];
    assert.equal(b.rounds[0].a.length, 4, 'a captain adds a die'); assert.equal(b.rounds[0].d.length, defDice);
    assert.ok(['Won', 'Lost'].includes(ev(r.events, 'front_closed')[0].verdict));
    assert.deepEqual(checkInvariants(board, r.state), [], `standing ${standing}`);
  }
});

test('a lost decision returns the survivors, leaves the defender with what is left, and always teaches a fact', () => {
  let saw = 0;
  for (let i = 0; i < 40 && saw < 3; i++) {
    const { board, w, ld } = setup({ bForce: 12, aForce: 8 });
    let st = open(board, w, 4).state; const id = fid(st);
    st.fronts[id].standing = 0; st.fronts[id].maneuvers = 1; st.fronts[id].beat = 1;
    const r = step(board, st, [{ type: 'front', clan: 'z', front: id, action: 'decision' }], 0, { rng: scripted([], 'lost' + i) });
    const c = ev(r.events, 'front_closed')[0];
    if (c.verdict !== 'Lost') continue;
    saw++;
    assert.equal(r.state.towns.B.owner, 'y'); assert.ok(c.learned.length >= 1, 'a lost front teaches');
    assert.equal(r.state.towns.A.force, 8 - 4 + (4 - c.lost.a), 'survivors go home');
    assert.equal(r.state.towns.B.force, 12 - c.lost.d);
    assert.deepEqual(checkInvariants(board, r.state), []);
  }
  assert.ok(saw >= 3);
});

test('disengaging returns the units and closes as Withdrew', () => {
  const { board, w } = setup();
  let st = open(board, w, 10).state; const id = fid(st);
  const r = step(board, st, [{ type: 'front', clan: 'z', front: id, action: 'disengage' }], 0);
  const c = ev(r.events, 'front_closed')[0];
  assert.equal(c.verdict, 'Withdrew'); assert.equal(r.state.towns.A.force, 20); assert.equal(Object.keys(r.state.fronts).length, 0);
  assert.equal(pinnedTowns(r.state).size, 0);
});

test('paper test 02, replayed with the same choices and forced maneuver dice: same standings, same tally, same result every time', () => {
  const play = (seed) => {
    const { board, w, ld, def } = setup({ river: true, bForce: 9, aForce: 20, refuge: false });
    const log = [];
    let st = step(board, w, [{ type: 'front_open', clan: 'z', from: 'A', to: 'B', n: 17 }], 0, { rng: scripted([], seed) }).state;
    const id = fid(st);
    let r = step(board, st, [{ type: 'front', clan: 'z', front: id, action: 'probe' }], 0, { rng: scripted([4, 1], seed) }); st = r.state; log.push(ev(r.events, 'front_beat')[0].standing);
    r = step(board, st, [{ type: 'front', clan: 'z', front: id, action: 'lever' }], 0, { rng: scripted([2, 4], seed) }); st = r.state; log.push(ev(r.events, 'front_beat')[0].standing);
    r = step(board, st, [{ type: 'front', clan: 'z', front: id, action: 'decision' }], 0, { rng: scripted([], seed) });
    return { log, tally: ev(r.events, 'front_closed')[0], state: r.state, events: r.events, def, ld };
  };
  // Behind by the river, a probe finds Greedy and does not move, a Lever on Greedy moves up two to Ahead
  const a = play('paper');
  assert.deepEqual(a.log, ['Behind', 'Ahead']);
  assert.deepEqual(play('paper').tally, a.tally, 'deterministic');
  const verdicts = new Set();
  for (let i = 0; i < 30; i++) {
    const p = play('paper' + i); verdicts.add(p.tally.verdict);
    assert.deepEqual(p.log, ['Behind', 'Ahead']);
    assert.equal(p.tally.beats, 3); assert.ok(p.tally.learned.includes('trait:greedy'));
    assert.equal(ev(p.events, 'front_beat')[0].rounds[0].d.length, 2, 'Ahead: the defender has no extra die');
    if (p.tally.verdict === 'Won') {
      assert.equal(p.state.towns.B.owner, 'z'); assert.ok(['captured', 'dead'].includes(p.state.chars[p.def.id].status), 'no refuge: captured, as in the paper test (or killed by the enemy injury roll)');
      assert.equal(p.tally.lost.a + p.state.towns.B.force, 17); assert.equal(p.tally.lost.d, 9);
      assert.ok(p.tally.exposed.every((t) => p.state.towns[t].owner === 'z' && p.state.towns[t].force <= 1));
    }
  }
  assert.ok(verdicts.has('Won'));
});

test('a pinned captain is never moved by the AI: neither his township nor the townships around it are attacked or attack', () => {
  const { board, w } = setup({ bForce: 60 });
  w.towns.E.force = 1; w.towns.F.force = 1; w.towns.A.force = 3;
  let st = open(board, w, 1).state;
  assert.equal(pinnedTowns(st).has('B'), true);
  let events = [];
  for (let d = 0; d < 30; d++) { const r = step(board, st, [], 24); st = r.state; events.push(...r.events); }
  assert.ok(!events.some((e) => (e.type === 'skirmish_result' || e.type === 'raid_declared') && e.from === 'B'), 'a pinned township never attacks');
  assert.ok(st.towns.B.captain === w.towns.B.captain && st.towns.B.owner === 'y');
  // once it is closed, the AI is free to attack
  st = step(board, st, [{ type: 'front', clan: 'z', front: fid(st), action: 'disengage' }], 0).state;
  assert.equal(pinnedTowns(st).size, 0);
});

test('an absent player\'s fronts are withdrawn at the next major tick', () => {
  const { board, w } = setup();
  let st = open(board, w, 10).state;
  let r = step(board, st, [], 72); r = step(board, r.state, [], 72);
  assert.ok(ev(r.events, 'front_closed').some((e) => e.verdict === 'Withdrew'));
  assert.equal(Object.keys(r.state.fronts).length, 0);
  assert.ok(r.state.towns.A.force >= 20, 'the units came home');
});

test('a front closes as Withdrew when the defending captain is gone or the township changed hands', () => {
  const { board, w, def } = setup();
  let st = open(board, w, 10).state; const id = fid(st);
  st.towns.B.owner = 'z';
  const r = step(board, st, [], 24);
  assert.ok(ev(r.events, 'front_closed').some((e) => e.verdict === 'Withdrew'));
});

test('play at random over a real board: 20 seeds x 60 days, invariants every sitting, no front over five beats, every verdict seen', () => {
  const seen = {}; let fronts = 0;
  for (let s = 0; s < 20; s++) {
    let w = newWorld(bigBoard, { seed: 'play' + s, home: 'Paterson City|Passaic', clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }] });
    const pick = makeRng(seedState('pick' + s));
    for (let day = 0; day < 60; day++) {
      let orders = [];
      for (let k = 0; k < 3; k++) {
        const legal = legalOrders(bigBoard, w, 'goblins').filter((o) => o.type !== 'move');
        if (!legal.length) break;
        const fr = legal.filter((o) => o.type === 'front'), pool = fr.length && pick.next() < 0.8 ? fr : legal;
        const o = { ...pool[pick.int(pool.length)] };
        if (o.n && typeof o.n === 'object') o.n = o.n.min + pick.int(o.n.max - o.n.min + 1);
        const r = step(bigBoard, w, [o], 0); w = r.state; orders.push(o);
        for (const e of r.events) { if (e.type === 'order_rejected') assert.fail('legalOrders listed a rejected order: ' + JSON.stringify(e)); if (e.type === 'front_closed') { seen[e.verdict] = (seen[e.verdict] || 0) + 1; assert.ok(e.beats <= K4.frontMaxManeuvers + 1 && e.beats >= (e.verdict === 'Won' || e.verdict === 'Lost' ? 2 : 0), `beats ${e.beats} ${e.verdict}`); } if (e.type === 'front_opened') fronts++; }
        assert.deepEqual(checkInvariants(bigBoard, w), [], `seed ${s} day ${day}`);
      }
      const r = step(bigBoard, w, [], 24); w = r.state;
      for (const e of r.events) if (e.type === 'front_closed') seen[e.verdict] = (seen[e.verdict] || 0) + 1;
      const bad = checkInvariants(bigBoard, w); assert.deepEqual(bad, [], `seed ${s} day ${day}: ${bad.join('; ')}`);
    }
  }
  assert.ok(fronts > 20, `fronts opened: ${fronts}`);
  for (const v of ['Won', 'Lost', 'Withdrew', 'Yielded']) assert.ok(seen[v] > 0, `no front closed as ${v}: ${JSON.stringify(seen)}`);
});
