import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';
import * as C from '../../../js/goblin/sim/chars.js';
import { makeRng, seedState } from '../../../js/goblin/sim/rng.js';
import { K, K3 } from '../../../js/goblin/sim/constants.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const contentJson = read('../../../data/goblin-content.json');
const content = C.loadContent(contentJson);
const board = makeBoard(read('../../../data/goblin-board.json'), content);
const PAT = 'Paterson City|Passaic';
const clans3 = [{ id: 'goblins', kind: 'goblin', lord: 'ai' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }];
const world = (seed = 'chars') => newWorld(board, { seed, home: PAT, clans: clans3 });
const ofClan = (w, id) => C.captainsOf(w, id);

// a tiny line board with content, for exact rule tests
const tj = { towns: {}, borders: {} };
const L = ['A', 'B', 'C', 'D'];
L.forEach((t, i) => { tj.towns[t] = { name: t, pop: 100 - i, nb: [L[i - 1], L[i + 1]].filter(Boolean) }; });
for (let i = 0; i < 3; i++) tj.borders[`${L[i]}~${L[i + 1]}`] = { mi: 1, river: null, ridge: null, highways: [] };
const tiny = makeBoard(tj, content);
const clanOf = (id, lord, kind = 'goblin', extra = {}) => ({ id, kind, lord, home: null, shieldUntil: 0, lastActive: 0, absentSince: null, out: false, peakTowns: 4, ...extra });
const mk = (towns, clans) => ({ v: 1, seed: 1, rng: 777, tick: 0, startHour: 8, lastMajor: 0, theatre: Object.keys(towns), chars: {}, heirs: [], fronts: {}, raids: [], director: {}, nextId: 1,
  towns: Object.fromEntries(Object.entries(towns).map(([id, [owner, force]]) => [id, { owner, force, dugIn: false, captain: null, attackedTick: -1 }])),
  clans: Object.fromEntries(clans.map((c) => [c.id, { ...c, home: Object.keys(towns).find((t) => towns[t][0] === c.id) }])) });
const types = (ev, t) => ev.filter((e) => e.type === t);

test('content: loads and validates; every entry is a placeholder except the user\'s own word "Humiliated"', () => {
  assert.ok(content.notable.length >= 12 && content.minor.length >= 12);
  assert.ok(content.json.traits.every((t) => t.placeholder === true));
  assert.deepEqual(contentJson.states.filter((s) => !s.placeholder).map((s) => s.id), ['humiliated']);
  assert.equal(new Set(content.json.traits.map((t) => t.word)).size, content.json.traits.length, 'trait words are unique');
  assert.ok(C.placeholdersIn(content).length > 40);
  assert.throws(() => C.loadContent({ ...contentJson, traits: [...contentJson.traits, { ...contentJson.traits[0] }] }), /duplicate/);
  assert.throws(() => C.loadContent({ ...contentJson, traits: [{ ...contentJson.traits[0], suits: ['dance'] }, ...contentJson.traits.slice(1)] }), /unknown maneuver/);
});

test('makeCaptain: tier 2 has four traits (two notable), tier 3 five (three notable), no repeats, put in the township', () => {
  const w = mk({ A: ['x', 5], B: ['x', 5] }, [clanOf('x', 'ai')]);
  const rng = makeRng(seedState('mk'));
  const c2 = C.makeCaptain(w, rng, content, { clan: 'x', town: 'A' });
  const c3 = C.makeCaptain(w, rng, content, { clan: 'x', town: 'B', tier: 3 });
  assert.equal(c2.traits.length, 4); assert.equal(c2.traits.filter((t) => t.notable).length, 2);
  assert.equal(c3.traits.length, 5); assert.equal(c3.traits.filter((t) => t.notable).length, 3);
  for (const c of [c2, c3]) { assert.equal(new Set(c.traits.map((t) => t.id)).size, c.traits.length); assert.ok(c.traits.every((t) => content.traits.has(t.id))); assert.equal(c.status, 'active'); }
  assert.equal(w.towns.A.captain, c2.id); assert.equal(c2.at, 'A');
  assert.throws(() => C.makeCaptain(w, rng, content, { clan: 'x', town: 'A' }), /free/);
  assert.throws(() => C.makeCaptain(mk({ A: ['y', 5] }, [clanOf('y', 'ai')]), rng, content, { clan: 'x', town: 'A' }));
  const w2 = mk({ A: ['x', 5] }, [clanOf('x', 'ai')]);
  assert.deepEqual(C.makeCaptain(w2, makeRng(seedState('same')), content, { clan: 'x', town: 'A' }), C.makeCaptain(mk({ A: ['x', 5] }, [clanOf('x', 'ai')]), makeRng(seedState('same')), content, { clan: 'x', town: 'A' }));
  assert.deepEqual(C.makeCaptain(mk({ A: ['x', 5] }, [clanOf('x', 'ai')]), makeRng(seedState('first')), content, { clan: 'x', town: 'A', firstNotable: 'greedy' }).traits[0], { id: 'greedy', notable: true });
});

test('newWorld with content: every clan starts with max(2, floor(townships/4)) captains in its strongest townships, one to a township, under its cap', () => {
  const w = world();
  assert.deepEqual(checkInvariants(board, w), []);
  for (const clan of Object.keys(w.clans)) {
    const mine = Object.keys(w.towns).filter((t) => w.towns[t].owner === clan);
    const caps = ofClan(w, clan);
    assert.equal(caps.length, Math.min(C.captainCap(w, clan), Math.max(2, Math.floor(mine.length / 4))));
    assert.ok(caps.length >= 2);
    assert.equal(new Set(caps.map((c) => c.at)).size, caps.length);
    const capForces = caps.map((c) => w.towns[c.at].force), others = mine.filter((t) => !w.towns[t].captain).map((t) => w.towns[t].force);
    assert.ok(Math.min(...capForces) >= Math.max(...others), 'captains hold the strongest townships');
    assert.ok(caps.every((c) => c.tier === 2));
  }
  assert.deepEqual(world('same'), world('same'));
});

test('discovery: notable traits first, then fears, then minor traits; each clan learns separately; nothing is learned twice', () => {
  const w = mk({ A: ['x', 5] }, [clanOf('x', 'ai')]);
  const c = C.makeCaptain(w, makeRng(seedState('disc')), content, { clan: 'x', town: 'A' });
  c.fears = [{ kind: 'terrain', ref: 'river' }];
  const all = C.factsOf(c);
  assert.equal(all.length, 5);
  assert.ok(all.slice(0, 2).every((f) => f.startsWith('trait:') && c.traits.find((t) => 'trait:' + t.id === f).notable));
  assert.equal(all[2], 'fear:river');
  assert.ok(all.slice(3).every((f) => !c.traits.find((t) => 'trait:' + t.id === f).notable));
  assert.deepEqual(C.undiscovered(c, 'rats'), all);
  const seen = [];
  for (let f; (f = C.discoverOne(c, 'rats'));) seen.push(f);
  assert.deepEqual(seen, all);
  assert.equal(C.discoverOne(c, 'rats'), null);
  assert.deepEqual(C.undiscovered(c, 'toads'), all, 'another clan still knows nothing');
  assert.throws(() => C.discover(c, 'rats', 'trait:nonexistent'));
});

test('traits: suits add +2 (notable) or +1 (minor); counters add up; a stand against flee is a conflict', () => {
  const mkc = (ids) => ({ traits: ids.map(([id, notable]) => ({ id, notable })) });
  assert.equal(C.suitBonus(content, mkc([['proud', true], ['loud', false]]), 'pressure'), 3);
  assert.equal(C.suitBonus(content, mkc([['cautious', true], ['quick', false]]), 'probe'), 3);
  assert.equal(C.suitBonus(content, mkc([['stubborn', true]]), 'lever'), 0);
  assert.equal(C.counterMod(content, mkc([['cautious', true], ['night-owl', false]]), 'probe'), -2);
  assert.equal(C.counterMod(content, mkc([['proud', true], ['vain', true]]), 'pressure'), 2);
  assert.equal(C.hasConflict(content, mkc([['proud', true], ['cautious', true]])), true);
  assert.equal(C.hasConflict(content, mkc([['proud', true], ['reckless', true]])), false);
  assert.equal(C.hasConflict(content, mkc([['cautious', true], ['greedy', true]])), true);
  assert.equal(C.hasConflict(content, mkc([['cautious', false], ['proud', true]])), false, 'a minor trait does not count');
});

test('injury roll: own side 1 in 6 hurt and 1 in 36 dead; the other side 2 in 6 and 2 in 36', () => {
  const rng = makeRng(seedState('injury')); const n = 180000;
  for (const [side, anyP, deadP] of [['own', 1 / 6, 1 / 36], ['enemy', 2 / 6, 2 / 36]]) {
    let any = 0, dead = 0;
    for (let i = 0; i < n; i++) { const r = C.injuryRoll(rng, side); if (r !== 'none') any++; if (r === 'dead') dead++; }
    assert.ok(Math.abs(any / n - anyP) < 0.006, `${side} hurt ${any / n}`);
    assert.ok(Math.abs(dead / n - deadP) < 0.004, `${side} dead ${dead / n}`);
  }
});

test('applyInjury gives distinct injuries until a captain has them all', () => {
  const c = { injuries: [] }; const rng = makeRng(seedState('inj'));
  const got = []; for (let i = 0; i < content.injuries.size; i++) got.push(C.applyInjury(rng, content, c));
  assert.equal(new Set(got).size, content.injuries.size);
  assert.equal(C.applyInjury(rng, content, c), null);
});

test('death and succession: an heir arrives at the next major tick as the next of the dynasty, with one grudge, and waits when the clan is at its cap', () => {
  const w = world('heir');
  const dead = ofClan(w, 'rats')[0]; dead.grudges = ['c999']; const where = dead.at; const before = ofClan(w, 'rats').length;
  w.tick = 10; C.kill(w, dead);
  assert.equal(dead.status, 'dead'); assert.equal(w.towns[where].captain, null); assert.equal(w.heirs.length, 1);
  assert.deepEqual(C.succeed(w, makeRng(seedState('s')), content), [], 'not in the same tick');
  w.tick = 11;
  const made = C.succeed(w, makeRng(seedState('s')), content);
  assert.equal(made.length, 1);
  const h = made[0].char;
  assert.equal(h.name, dead.name); assert.equal(h.dynasty, dead.dynasty + 1); assert.deepEqual(h.grudges, ['c999']); assert.equal(h.at, where);
  assert.equal(w.heirs.length, 0); assert.equal(ofClan(w, 'rats').length, before);
  assert.deepEqual(checkInvariants(board, w), []);
  // the township was lost meanwhile: the heir goes to the clan's home instead
  const w2 = world('heir2'); const d2 = ofClan(w2, 'toads').find((c) => c.at !== w2.clans.toads.home); const lost = d2.at;
  w2.tick = 10; C.kill(w2, d2); w2.towns[lost].owner = 'rats'; w2.tick = 11;
  const m2 = C.succeed(w2, makeRng(seedState('s')), content);
  assert.equal(m2.length, 1); assert.notEqual(m2[0].char.at, lost); assert.equal(w2.towns[m2[0].char.at].owner, 'toads');
  // at the cap, extra heirs wait
  const w3 = world('heir3');
  for (let i = 0; i < 5; i++) w3.heirs.push({ clan: 'goblins', base: 'X Y', dynasty: 1, grudge: null, town: null, tick: 0 });
  w3.tick = 5;
  C.succeed(w3, makeRng(seedState('cap')), content);
  assert.ok(ofClan(w3, 'goblins').length <= C.captainCap(w3, 'goblins'));
  assert.ok(w3.heirs.length > 0, 'the rest keep waiting');
});

test('capture and place: a captive is held by the captor; place falls back to the clan home, then to any free township, then fails', () => {
  const w = mk({ A: ['x', 5], B: ['x', 5], C: ['x', 5] }, [clanOf('x', 'ai'), clanOf('y', 'ai')]);
  const rng = makeRng(seedState('place'));
  const a = C.makeCaptain(w, rng, content, { clan: 'x', town: 'A' });
  C.capture(w, a, 'y');
  assert.equal(a.status, 'captured'); assert.equal(a.heldBy, 'y'); assert.equal(w.towns.A.captain, null); assert.equal(a.at, null);
  const b = C.makeCaptain(w, rng, content, { clan: 'x', town: 'B' });
  w.towns.B.captain = null; b.at = null;
  assert.equal(C.place(w, b, 'B'), true); assert.equal(b.at, 'B');
  const c = C.makeCaptain(w, rng, content, { clan: 'x', town: 'C' });
  w.towns.C.captain = null; c.at = null; w.towns.A.captain = 'taken'; w.towns.C.captain = 'taken';
  assert.equal(C.place(w, c, 'A'), false, 'every township is taken');
});

test('promotion: a grunt is named in a township with no captain, when under the cap; the first notable trait follows what happened', () => {
  const w = mk({ A: ['x', 9], B: ['x', 9], C: ['y', 9], D: ['y', 9] }, [clanOf('x', 'ai'), clanOf('y', 'ai')]);
  const rng = makeRng(seedState('promo'));
  const c = C.promote(w, rng, content, 'A', 'outnumbered');
  assert.ok(c); assert.equal(w.towns.A.captain, c.id);
  assert.ok(content.traits.get(c.traits[0].id).earnedBy.includes('outnumbered'));
  assert.equal(C.promote(w, rng, content, 'A', 'outnumbered'), null, 'a captain is already there');
  assert.equal(C.promote(w, rng, content, 'B', 'bloody'), null, 'x has two townships, so its cap is 1 and A already holds it');
  const cy = C.promote(w, rng, content, 'C', 'bloody');
  assert.ok(cy && content.traits.get(cy.traits[0].id).earnedBy.includes('bloody'));
  assert.equal(C.promote(w, rng, content, 'D', 'river'), null, 'y is at its cap: 1 + floor(2/4) = 1');
});

test('a captain leads an attack (an extra die), takes the township on a win and goes home on a loss', () => {
  const run = (seed) => {
    const w = mk({ A: ['z', 20], B: ['y', 6] }, [clanOf('z', 'human'), clanOf('y', 'ai')]);
    w.rng = seedState(seed);
    const lead = C.makeCaptain(w, makeRng(seedState('lead')), content, { clan: 'z', town: 'A' });
    return { lead, ...step(tiny, w, [{ type: 'attack', clan: 'z', from: 'A', to: 'B', n: 12 }], 0) };
  };
  let won = false, lost = false;
  for (let i = 0; i < 80 && !(won && lost); i++) {
    const { lead, state, events } = run('lead' + i);
    const r = types(events, 'skirmish_result')[0];
    assert.equal(r.lead, lead.id); assert.equal(r.rounds[0].a.length, 4, 'a captain adds a die');
    if (r.won) { won = true; assert.equal(state.towns.B.captain, lead.id); assert.equal(state.towns.A.captain, null); assert.equal(state.chars[lead.id].at, 'B'); }
    else { lost = true; assert.equal(state.towns.A.captain, lead.id); assert.equal(state.chars[lead.id].at, 'A'); }
    assert.deepEqual(checkInvariants(tiny, state), []);
  }
  assert.ok(won && lost, 'saw both outcomes');
});

test('a human cannot attack a township with a captain yet (that is a front, S5); an AI that takes one captures its captain', () => {
  const w = mk({ A: ['z', 20], B: ['y', 6] }, [clanOf('z', 'human'), clanOf('y', 'ai')]);
  C.makeCaptain(w, makeRng(seedState('def')), content, { clan: 'y', town: 'B' });
  assert.equal(types(step(tiny, w, [{ type: 'attack', clan: 'z', from: 'A', to: 'B', n: 12 }], 0).events, 'order_rejected').length, 1);
  const w2 = mk({ A: ['x', 60], B: ['y', 3] }, [clanOf('x', 'ai'), clanOf('y', 'ai')]);
  const d = C.makeCaptain(w2, makeRng(seedState('def2')), content, { clan: 'y', town: 'B' });
  const r = step(tiny, w2, [], 1);
  assert.equal(types(r.events, 'captured').length, 1);
  assert.equal(r.state.chars[d.id].status, 'captured'); assert.equal(r.state.chars[d.id].heldBy, 'x'); assert.equal(r.state.towns.B.owner, 'x');
  assert.deepEqual(checkInvariants(tiny, r.state), []);
});

test('an AI captain rides with a raid, and ends up placed somewhere valid either way', () => {
  const w = mk({ A: ['x', 60], B: ['z', 3] }, [clanOf('x', 'ai'), clanOf('z', 'human')]);
  const lead = C.makeCaptain(w, makeRng(seedState('raid')), content, { clan: 'x', town: 'A' });
  const r1 = step(tiny, w, [], 1);
  const d = types(r1.events, 'raid_declared')[0];
  assert.ok(d); assert.equal(r1.state.raids[0].lead, lead.id); assert.equal(r1.state.towns.A.captain, null); assert.equal(r1.state.chars[lead.id].at, null);
  assert.deepEqual(checkInvariants(tiny, r1.state), [], 'a captain on a raid is allowed to be nowhere');
  const r2 = step(tiny, r1.state, [], 6);
  assert.equal(types(r2.events, 'raid_landed').length, 1);
  assert.ok(r2.state.chars[lead.id].at !== null);
  assert.deepEqual(checkInvariants(tiny, r2.state), []);
});

test('promotion in play: winning against odds names a captain at the captured township', () => {
  let seen = null;
  for (let i = 0; i < 300 && !seen; i++) {
    const w = mk({ A: ['z', 12], B: ['y', 7], C: ['y', 3] }, [clanOf('z', 'human'), clanOf('y', 'ai')]);
    w.rng = seedState('promo' + i);
    const { state, events } = step(tiny, w, [{ type: 'attack', clan: 'z', from: 'A', to: 'B', n: 6 }], 0);
    if (types(events, 'promoted').length) seen = { state, events };
  }
  assert.ok(seen, 'a win with 6 against 7 happens within 300 tries');
  const p = types(seen.events, 'promoted')[0];
  assert.equal(p.tag, 'outnumbered'); assert.equal(seen.state.towns.B.captain, p.char); assert.deepEqual(checkInvariants(tiny, seen.state), []);
});

test('the long run with captains: 20 seeds, 365 days, invariants every day; captains are captured and promoted, none over a cap', () => {
  let captured = 0, promoted = 0, maxCaps = 0;
  for (let s = 0; s < 20; s++) {
    let w = newWorld(board, { rules: { economy: 0 }, seed: 'cl' + s, home: PAT, clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }] });
    for (let day = 0; day < 365; day++) {
      const r = step(board, w, [], 24); w = r.state;
      captured += types(r.events, 'captured').length; promoted += types(r.events, 'promoted').length;
      const bad = checkInvariants(board, w);
      assert.deepEqual(bad, [], `seed ${s} day ${day}: ${bad.join('; ')}`);
    }
    for (const id of Object.keys(w.clans)) maxCaps = Math.max(maxCaps, ofClan(w, id).length);
  }
  assert.ok(captured > 0, 'captains were captured'); assert.ok(promoted > 0, 'grunts were named');
  assert.ok(maxCaps <= 1 + Math.floor(58 / K.captainCapPerTowns));
});
