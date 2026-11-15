import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { newWorld, step, checkInvariants, isMajor, hourOf } from '../../../js/goblin/sim/world.js';
import { K } from '../../../js/goblin/sim/constants.js';

const real = makeBoard(JSON.parse(fs.readFileSync(new URL('../../../data/goblin-board.json', import.meta.url), 'utf8')));
const PAT = 'Paterson City|Passaic';

// ---- a tiny board where every number is under control: A - B - C - D in a line ----
const tinyJson = { towns: {}, borders: {} };
const line = ['A', 'B', 'C', 'D'];
line.forEach((t, i) => { tinyJson.towns[t] = { name: t, pop: 1000 - i, nb: [line[i - 1], line[i + 1]].filter(Boolean) }; });
for (let i = 0; i < 3; i++) tinyJson.borders[`${line[i]}~${line[i + 1]}`] = { mi: 1, river: null, ridge: null, highways: [] };
const tiny = makeBoard(tinyJson);
const clanOf = (id, lord, extra = {}) => ({ id, kind: 'goblin', lord, home: null, shieldUntil: 0, lastActive: 0, absentSince: null, out: false, ...extra });
const mk = (towns, clans) => ({ v: 1, seed: 1, rng: 12345, tick: 0, startHour: 8, lastMajor: 0, theatre: Object.keys(towns), chars: {}, fronts: {}, raids: [], director: {}, nextId: 1,
  towns: Object.fromEntries(Object.entries(towns).map(([id, [owner, force]]) => [id, { owner, force, dugIn: false, captain: null, attackedTick: -1 }])),
  clans: Object.fromEntries(clans.map((c) => [c.id, { ...c, home: c.home || Object.keys(towns).find((t) => towns[t][0] === c.id) }])) });
const types = (events, t) => events.filter((e) => e.type === t);
const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };

test('clock: tick 1 is the 09:00 major tick; majors at 9, 12 and 18', () => {
  const w = mk({ A: ['x', 5] }, [clanOf('x', 'ai')]);
  assert.equal(hourOf({ ...w, tick: 1 }), 9);
  assert.deepEqual([1, 4, 10].map((t) => isMajor({ ...w, tick: t })), [true, true, true]);
  assert.deepEqual([2, 3, 5, 11].map((t) => isMajor({ ...w, tick: t })), [false, false, false, false]);
});

test('theatre: Paterson at 3 steps is 58 townships; a tiny start widens to 12; never over 60', () => {
  assert.equal(real.theatre(PAT, 3).length, 58);
  assert.ok(real.theatre(PAT, 3).includes('Haledon Borough|Passaic') && real.theatre(PAT, 3).includes('Totowa Borough|Passaic'));
  assert.equal(real.theatre('Totowa Borough|Passaic', 1).length, 21);
  assert.ok(real.theatre(PAT, 6).length <= 60);
  assert.equal(new Set(real.theatre(PAT, 3)).size, 58);
});

test('newWorld: clans placed apart, every township owned, forces from rank, deterministic', () => {
  const cfg = { seed: 'paterson', home: PAT, clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }] };
  const w = newWorld(real, cfg);
  assert.equal(Object.keys(w.towns).length, 58);
  assert.equal(w.clans.goblins.home, PAT);
  assert.deepEqual(checkInvariants(real, w), []);
  const homes = Object.values(w.clans).map((c) => c.home);
  const inT = new Set(w.theatre);
  for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) assert.ok(real.distances(homes[i], inT).get(homes[j]) >= 3, 'homes at least 3 steps apart');
  for (const c of Object.keys(w.clans)) assert.ok(Object.values(w.towns).some((t) => t.owner === c), c + ' owns something');
  for (const t of Object.values(w.towns)) assert.ok(t.owner !== null && t.force >= 3 && t.force <= 10);
  const shares = Object.keys(w.clans).map((c) => Object.values(w.towns).filter((t) => t.owner === c).length);
  assert.ok(Math.max(...shares) - Math.min(...shares) <= 2, 'even shares: ' + shares);
  assert.deepEqual(newWorld(real, cfg), newWorld(real, cfg));
  assert.notDeepEqual(newWorld(real, { ...cfg, seed: 'other' }).rng, w.rng);
});

test('step is pure: a frozen state is not changed, and the same call gives the same result', () => {
  const w = deepFreeze(newWorld(real, { seed: 7, home: PAT, clans: [{ id: 'g', kind: 'goblin', lord: 'ai' }, { id: 'r', kind: 'rat', lord: 'ai' }] }));
  const before = JSON.stringify(w);
  const a = step(real, w, [], 48), b = step(real, w, [], 48);
  assert.equal(JSON.stringify(w), before);
  assert.deepEqual(a, b);
  assert.notEqual(JSON.stringify(a.state), before);
});

test('recruits: one per three townships (rounded up), onto the weakest border township', () => {
  // x owns A; y owns B, C, D. y's only township next to an enemy is B.
  const w = mk({ A: ['x', 4], B: ['y', 4], C: ['y', 4], D: ['y', 4] }, [clanOf('x', 'ai'), clanOf('y', 'ai')]);
  const { state, events } = step(tiny, w, [], 1);
  const ev = Object.fromEntries(types(events, 'recruits').map((e) => [e.clan, e]));
  assert.equal(ev.x.n, 1); assert.equal(ev.y.n, 1); assert.equal(ev.y.town, 'B');
  assert.equal(state.towns.A.force, 5);
});

test('recruit placement: an AI masses them at its best attack position, a human clan reinforces its weakest border', () => {
  const j3 = { towns: {}, borders: {} };
  ['A', 'B', 'C'].forEach((t, i, l) => { j3.towns[t] = { name: t, pop: 1, nb: [l[i - 1], l[i + 1]].filter(Boolean) }; });
  j3.borders['A~B'] = { mi: 1, river: null, ridge: null, highways: [] }; j3.borders['B~C'] = { mi: 1, river: null, ridge: null, highways: [] };
  const b3 = makeBoard(j3);
  // x owns A (8) and C (4); y owns B. Both of x's townships border B; A is the stronger attack position.
  const ai = step(b3, mk({ A: ['x', 8], B: ['y', 6], C: ['x', 4] }, [clanOf('x', 'ai'), clanOf('y', 'ai')]), [], 1);
  assert.equal(types(ai.events, 'recruits').find((e) => e.clan === 'x').town, 'A');
  const hu = step(b3, mk({ A: ['x', 8], B: ['y', 6], C: ['x', 4] }, [clanOf('x', 'human', { lastActive: 1e9 }), clanOf('y', 'ai')]), [], 1);
  assert.equal(types(hu.events, 'recruits').find((e) => e.clan === 'x').town, 'C');
});

test('dig in: 3 or more units that did not attack become fortified at a major tick; 2 does not', () => {
  // the recruit lands on the weakest township, B, taking it from 1 to 2: still under 3
  const w = mk({ A: ['x', 3], B: ['x', 1] }, [clanOf('x', 'ai')]);
  const { state } = step(tiny, w, [], 1);
  assert.equal(state.towns.A.dugIn, true); assert.equal(state.towns.B.dugIn, false);
});

test('an AI attacks another AI at once, but only at 2 to 1 or better', () => {
  let w = mk({ A: ['x', 20], B: ['y', 3] }, [clanOf('x', 'ai'), clanOf('y', 'ai')]);
  let r = step(tiny, w, [], 1);
  assert.equal(types(r.events, 'skirmish_result').length >= 1, true);
  assert.equal(types(r.events, 'skirmish_result')[0].by, 'x');
  w = mk({ A: ['x', 6], B: ['y', 5] }, [clanOf('x', 'ai'), clanOf('y', 'ai')]);
  r = step(tiny, w, [], 1);
  assert.equal(types(r.events, 'skirmish_result').length, 0);
});

test('against a human an AI declares a raid that lands exactly six hours later', () => {
  const w = mk({ A: ['x', 20], B: ['z', 3] }, [clanOf('x', 'ai'), clanOf('z', 'human')]);
  const r1 = step(tiny, w, [], 1);
  const d = types(r1.events, 'raid_declared')[0];
  assert.ok(d, 'a raid is declared');
  assert.equal(d.landsAt, 1 + K.raidWarningTicks);
  assert.equal(r1.state.raids.length, 1);
  assert.ok(r1.state.towns.A.force < 20 + 7, 'the raiding units left');
  const r2 = step(tiny, r1.state, [], K.raidWarningTicks - 1);
  assert.equal(types(r2.events, 'raid_landed').length, 0, 'not before its time');
  const r3 = step(tiny, r2.state, [], 1);
  const landed = types(r3.events, 'raid_landed')[0];
  assert.ok(landed && landed.tick === 1 + K.raidWarningTicks);
  assert.equal(r3.state.raids.length, 0);
});

test('a new player is shielded for 72 ticks: no raid is declared against them before then', () => {
  const w = mk({ A: ['x', 30], B: ['z', 3] }, [clanOf('x', 'ai'), clanOf('z', 'human', { shieldUntil: K.newPlayerShieldTicks, lastActive: 1e9 })]);   // lastActive far ahead: this player is never "absent"
  const r = step(tiny, w, [], 70);
  assert.equal(types(r.events, 'raid_declared').length, 0);
  const later = step(tiny, r.state, [], 12);
  assert.ok(types(later.events, 'raid_declared').length >= 1, 'then the shield is gone');
});

test("an absent player's home is never attacked; their other townships are", () => {
  const w = mk({ A: ['x', 40], B: ['z', 3], C: ['z', 3] }, [clanOf('x', 'ai'), clanOf('z', 'human', { home: 'B', absentSince: 0 })]);
  const r = step(tiny, w, [], 1);
  assert.equal(types(r.events, 'raid_declared').length, 0, 'B is the home of an absent player');
  const w2 = mk({ A: ['x', 40], B: ['z', 3], C: ['z', 3] }, [clanOf('x', 'ai'), clanOf('z', 'human', { home: 'C', absentSince: 0 })]);
  assert.equal(types(step(tiny, w2, [], 1).events, 'raid_declared').length, 1, 'B is not the home, so it can be raided');
});

test('human orders: attack and move obey the rules (neighbours, own origin, leave one behind)', () => {
  const w = mk({ A: ['z', 10], B: ['y', 3], C: ['z', 4], D: ['z', 2] }, [clanOf('z', 'human'), clanOf('y', 'ai')]);
  const rejected = (o) => types(step(tiny, w, [o], 0).events, 'order_rejected').length === 1;
  assert.ok(rejected({ type: 'attack', clan: 'z', from: 'A', to: 'B', n: 10 }), 'cannot send all');
  assert.ok(rejected({ type: 'attack', clan: 'z', from: 'A', to: 'C', n: 3 }), 'not neighbours');
  assert.ok(rejected({ type: 'attack', clan: 'z', from: 'B', to: 'A', n: 1 }), 'not your origin');
  assert.ok(rejected({ type: 'attack', clan: 'z', from: 'C', to: 'D', n: 1 }), 'your own township');
  const ok = step(tiny, w, [{ type: 'attack', clan: 'z', from: 'A', to: 'B', n: 9 }], 0);
  assert.equal(types(ok.events, 'order_rejected').length, 0);
  assert.equal(types(ok.events, 'skirmish_result').length, 1);
  assert.equal(ok.state.towns.A.force >= 1, true);
  assert.ok(types(ok.events, 'skirmish_result')[0].rounds, 'a human fight keeps its dice');
  const mv = step(tiny, w, [{ type: 'move', clan: 'z', from: 'C', to: 'D', n: 3 }], 0);
  assert.equal(mv.state.towns.C.force, 1); assert.equal(mv.state.towns.D.force, 5);
});

test('a win takes the township and ends its fortification; a loss leaves the attacker with one unit home', () => {
  const w = mk({ A: ['z', 30], B: ['y', 2] }, [clanOf('z', 'human'), clanOf('y', 'ai')]);
  const won = step(tiny, w, [{ type: 'attack', clan: 'z', from: 'A', to: 'B', n: 29 }], 0);
  assert.equal(won.state.towns.B.owner, 'z'); assert.equal(won.state.towns.B.dugIn, false);
  const w2 = mk({ A: ['z', 3], B: ['y', 40] }, [clanOf('z', 'human'), clanOf('y', 'ai', { shieldUntil: 0 })]);
  const lost = step(tiny, w2, [{ type: 'attack', clan: 'z', from: 'A', to: 'B', n: 2 }], 0);
  assert.equal(lost.state.towns.B.owner, 'y');
  assert.equal(lost.state.towns.A.force, 2, '1 stayed + 1 survivor returned');
});

test('catch-up cap: only 72 ticks are simulated, the rest settle', () => {
  const w = mk({ A: ['x', 4], B: ['y', 4] }, [clanOf('x', 'ai'), clanOf('y', 'ai')]);
  const r = step(tiny, w, [], 200);
  assert.equal(r.state.tick, 200);
  assert.equal(types(r.events, 'settled')[0].skipped, 128);
  const recruitsPerClan = types(r.events, 'recruits').filter((e) => e.clan === 'x').length;
  assert.equal(recruitsPerClan, 9, 'nine major ticks in the first 72 hours');
});

// ---- the long run on the real board ----
test('invariants hold for 1,000 simulated days on each of 20 seeds, and the shield and warning rules are never broken', () => {
  let raids = 0, aiFights = 0;
  for (let s = 0; s < 20; s++) {
    let w = newWorld(real, { seed: 'long' + s, home: PAT, clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }] });
    for (let day = 0; day < 1000; day++) {
      const r = step(real, w, [], 24);
      for (const e of r.events) {
        if (e.type === 'raid_declared') { raids++; assert.ok(e.landsAt - e.tick >= K.raidWarningTicks); assert.ok(e.tick >= K.newPlayerShieldTicks, 'raid inside the shield window'); }
        if (e.type === 'skirmish_result' && e.by !== 'goblins' && e.against !== 'goblins') aiFights++;
        if ((e.type === 'skirmish_result' || e.type === 'raid_landed') && e.against === 'goblins') assert.ok(e.tick > K.newPlayerShieldTicks - 1, 'attack inside the shield window');
      }
      w = r.state;
      const bad = checkInvariants(real, w);
      assert.deepEqual(bad, [], `seed ${s}, day ${day}: ${bad.join('; ')}`);
    }
  }
  assert.ok(raids > 0, 'the AI does attack a passive human after the shield');
  assert.ok(aiFights > 0, 'the AI clans fight each other');
});
