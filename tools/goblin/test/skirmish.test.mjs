import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, seedState } from '../../../js/goblin/sim/rng.js';
import { skirmish, modsFor } from '../../../js/goblin/sim/skirmish.js';

// A scripted die source: hands out the listed faces in order. Attacker dice are rolled before defender dice, each round.
const scripted = (faces) => { let i = 0; return { d6() { if (i >= faces.length) throw new Error('script ran out'); return faces[i++]; } }; };

test('a tie goes to the defender', () => {
  // 3 attackers roll 2 dice [5,3], 1 defender rolls [5]: tie, attacker loses one. Then 2 attackers roll 1 die [6] against [1]: defender dies.
  const r = skirmish({ attackers: 3, defenders: 1 }, scripted([5, 3, 5, 6, 1]));
  assert.equal(r.rounds[0].aLost, 1); assert.equal(r.rounds[0].dLost, 0);
  assert.equal(r.won, true); assert.equal(r.attackersLeft, 2); assert.equal(r.defendersLeft, 0);
});

test('one unit never rolls: dice are capped at attackers - 1, and at 3 / 2', () => {
  let r = skirmish({ attackers: 10, defenders: 10 }, makeRng(seedState('dice')));
  assert.equal(r.rounds[0].a.length, 3); assert.equal(r.rounds[0].d.length, 2);
  r = skirmish({ attackers: 3, defenders: 10 }, makeRng(seedState('dice')));
  assert.equal(r.rounds[0].a.length, 2);
  r = skirmish({ attackers: 10, defenders: 1 }, makeRng(seedState('dice')));
  assert.equal(r.rounds[0].d.length, 1);
});

test('a captain leading adds an attacker die (4 instead of 3)', () => {
  const r = skirmish({ attackers: 10, defenders: 10, ...modsFor({ captainLeads: true }) }, makeRng(seedState('cap')));
  assert.equal(r.rounds[0].a.length, 4);
});

test('dug in: the defender best die +1 turns a tie into a defender win... and a 5 vs 5 into 5 vs 6', () => {
  // 2 attackers roll 1 die [5]; 1 defender rolls [5]; dug-in makes it 6: the attacker loses and, left with 1, stops.
  const r = skirmish({ attackers: 2, defenders: 1, ...modsFor({ dugIn: true }) }, scripted([5, 5]));
  assert.equal(r.won, false); assert.equal(r.attackersLeft, 1); assert.deepEqual(r.rounds[0].dEff, [6]);
});

test('without dug in the same dice are a defender win only by the tie rule, with a 6 v 5 the attacker wins', () => {
  assert.equal(skirmish({ attackers: 2, defenders: 1 }, scripted([6, 5])).won, true);
});

test('river border: the attacker best die -1; a highway cancels it', () => {
  // attacker rolls [6] vs defender [5]; with the river penalty 6 becomes 5, a tie, defender wins.
  assert.equal(skirmish({ attackers: 2, defenders: 1, ...modsFor({ riverBorder: true }) }, scripted([6, 5])).won, false);
  assert.equal(skirmish({ attackers: 2, defenders: 1, ...modsFor({ riverBorder: true, highway: true }) }, scripted([6, 5])).won, true);
});

test('the best die is penalised, then dice are re-sorted before pairing', () => {
  // 4 attackers roll 3 dice [6,5,4]; the penalty makes the 6 a 5, so [5,5,4]. 2 defenders roll [5,4]: pairs 5v5 (defender wins), 5v4 (attacker wins).
  // Round 2: 3 attackers roll 2 dice [6,6] against the 1 remaining defender's [1].
  const r = skirmish({ attackers: 4, defenders: 2, atkBestPenalty: 1 }, scripted([6, 5, 4, 5, 4, 6, 6, 1]));
  assert.deepEqual(r.rounds[0].a, [6, 5, 4]);
  assert.deepEqual(r.rounds[0].aEff, [5, 5, 4]);
  assert.equal(r.rounds[0].aLost, 1); assert.equal(r.rounds[0].dLost, 1);
  assert.equal(r.won, true);
});

test('bookkeeping: forces add up, an attacker is never left below 1, and a loss leaves exactly 1', () => {
  for (let n = 0; n < 300; n++) {
    const a = 2 + (n % 15), d = 1 + ((n * 7) % 14);
    const r = skirmish({ attackers: a, defenders: d }, makeRng(seedState('book' + n)));
    assert.equal(r.attackersLeft + r.lost.attackers, a);
    assert.equal(r.defendersLeft + r.lost.defenders, d);
    assert.ok(r.attackersLeft >= 1);
    if (!r.won) assert.equal(r.attackersLeft, 1);
    if (r.won) assert.equal(r.defendersLeft, 0);
    assert.ok(r.rounds.length >= 1);
    let aa = a, dd = d;
    for (const x of r.rounds) { aa -= x.aLost; dd -= x.dLost; assert.equal(x.attackers, aa); assert.equal(x.defenders, dd); }
  }
});

test('an empty township is walked into; one lone unit cannot take a defended one', () => {
  assert.deepEqual(skirmish({ attackers: 1, defenders: 0 }, scripted([])).won, true);
  assert.equal(skirmish({ attackers: 1, defenders: 3 }, scripted([])).won, false);
  assert.equal(skirmish({ attackers: 0, defenders: 0 }, scripted([])).won, false);
  assert.throws(() => skirmish({ attackers: 2.5, defenders: 1 }, scripted([])));
});

test('determinism: same seed and forces give identical rounds', () => {
  const run = () => skirmish({ attackers: 16, defenders: 5 }, makeRng(seedState('haledon')));
  assert.deepEqual(run(), run());
});

// The win rates published in docs/goblins/sims/skirmish-01.md (20,000 trials in Python). The JavaScript rule must reproduce them within 2 points.
const rate = (a, d, mods, seed) => {
  const rng = makeRng(seedState(seed)); let w = 0; const n = 20000;
  for (let i = 0; i < n; i++) if (skirmish({ attackers: a, defenders: d, ...mods }, rng).won) w++;
  return w / n;
};
for (const [name, a, d, mods, target] of [
  ['5 v 5 plain', 5, 5, {}, 0.36],
  ['8 v 8 plain', 8, 8, {}, 0.45],
  ['10 v 4 plain', 10, 4, {}, 0.93],
  ['6 v 10 plain', 6, 10, {}, 0.12],
  ['8 v 8 dug in', 8, 8, modsFor({ dugIn: true }), 0.20],
  ['12 v 8 dug in', 12, 8, modsFor({ dugIn: true }), 0.53],
  ['12 v 6 dug in', 12, 6, modsFor({ dugIn: true }), 0.74],
  ['8 v 8, a captain leads', 8, 8, modsFor({ captainLeads: true }), 0.61],
]) {
  test(`win rate matches the published simulation: ${name} (about ${Math.round(target * 100)}%)`, () => {
    const got = rate(a, d, mods, 'rate ' + name);
    assert.ok(Math.abs(got - target) <= 0.02, `${name}: got ${(got * 100).toFixed(1)}%, published ${(target * 100).toFixed(0)}%`);
  });
}
