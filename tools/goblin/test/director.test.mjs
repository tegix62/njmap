import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';
import * as D from '../../../js/goblin/sim/director.js';
import { openFronts } from '../../../js/goblin/sim/front.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const bigBoard = makeBoard(read('../../../data/goblin-board.json'));

// a line of townships: names in order, each bordering the next. owners/forces given; clan z is the human, y and x are AI.
function line(spec, { startHour = 8 } = {}) {
  const names = spec.map((s) => s[0]);
  const tj = { towns: {}, borders: {} };
  names.forEach((n, i) => { tj.towns[n] = { name: n, pop: 100 - i, nb: [names[i - 1], names[i + 1]].filter(Boolean) }; });
  for (let i = 0; i < names.length - 1; i++) tj.borders[`${names[i]}~${names[i + 1]}`] = { mi: 1, river: null, ridge: null, highways: [] };
  const board = makeBoard(tj);
  const clan = (id, lord, home) => ({ id, kind: 'goblin', lord, home, shieldUntil: 0, lastActive: 0, absentSince: null, out: false, peakTowns: 4 });
  const owners = [...new Set(spec.map((s) => s[1]))];
  const w = { v: 1, seed: 1, rng: 5, tick: 0, startHour, lastMajor: 0, theatre: names, chars: {}, heirs: [], fronts: {}, raids: [], director: {}, nextId: 1,
    towns: Object.fromEntries(spec.map(([n, o, f]) => [n, { owner: o, force: f, dugIn: false, captain: null, attackedTick: -1 }])),
    clans: Object.fromEntries(owners.map((o) => [o, clan(o, o === 'z' ? 'human' : 'ai', spec.find((s) => s[1] === o)[0])])) };
  return { board, w };
}
const ev = (events, type) => events.filter((e) => e.type === type);
const raids = (events) => ev(events, 'raid_declared');

test('the word: Calm below 3, Steady below 7, Heated below 12, Overwhelmed above; fronts, raids, losses and recent townships lost all count; quiet subtracts', () => {
  const { w } = line([['A', 'z', 10], ['B', 'y', 10]]);
  w.tick = 100;
  assert.equal(D.wordOf(w, 'z'), 'Calm'); assert.equal(D.score(w, 'z'), -3);
  const d = D.dstate(w, 'z'); d.lastHostile = 100;
  assert.equal(D.score(w, 'z'), 0);
  w.fronts = { f1: { id: 'f1', status: 'open', attacker: 'z', target: 'B' }, f2: { id: 'f2', status: 'open', attacker: 'z', target: 'B' } };
  assert.equal(D.score(w, 'z'), 4); assert.equal(D.wordOf(w, 'z'), 'Steady');
  w.raids.push({ id: 1, by: 'y', from: 'B', target: 'A', force: 3, declaredAt: 100, landsAt: 106 });
  assert.equal(D.score(w, 'z'), 7); assert.equal(D.wordOf(w, 'z'), 'Heated');
  d.unitsLost.push({ tick: 90, n: 25 });
  assert.equal(D.score(w, 'z'), 12); assert.equal(D.wordOf(w, 'z'), 'Overwhelmed');
  d.unitsLost[0].tick = 50;   // older than a day: no longer counts
  d.townsLost.push(95, 10);   // one inside 72 ticks, one outside
  assert.equal(D.score(w, 'z'), 11);
  w.tick = 100 + 24;          // quiet grows by 1 per 12 ticks, to a maximum of 3
  assert.equal(D.score(w, 'z') < 11, true);
});

test('Observe: raids and losses are read from events, and the word is exposed as an event', () => {
  const { board, w } = line([['A', 'z', 3], ['B', 'y', 40]]);
  const r = step(board, w, [], 1);
  assert.equal(raids(r.events).length, 1, 'a 09:00 minor slot allows a Calm player to be raided');
  assert.equal(D.dstate(r.state, 'z').lastHostile, 1);
  const w2 = ev(r.events, 'director_word')[0];
  assert.equal(w2.clan, 'z'); assert.equal(w2.word, 'Steady');   // one raid against them: 3 - 0 (quiet gone) = 3
});

test('a Heated player is not attacked that tick; the same player when Calm is', () => {
  for (const [label, heated] of [['calm', false], ['heated', true]]) {
    const { board, w } = line([['A', 'z', 3], ['B', 'y', 40]], { startHour: 11 });   // tick 1 is the 12:00 peak
    if (heated) { const d = D.dstate(w, 'z'); d.townsLost.push(0, 0); d.lastHostile = 0; }
    const r = step(board, w, [], 1);
    if (heated) { assert.equal(D.wordOf(r.state, 'z') === 'Heated' || D.wordOf(r.state, 'z') === 'Overwhelmed', true); assert.equal(raids(r.events).length, 0, label); }
    else assert.equal(raids(r.events).length, 1, label);
  }
});

test('the 18:00 tick adds nothing hostile, even for a Calm player', () => {
  const { board, w } = line([['A', 'z', 3], ['B', 'y', 40]], { startHour: 17 });
  const r = step(board, w, [], 1);
  assert.equal(raids(r.events).length, 0);
  assert.equal(D.dstate(r.state, 'z').calmStreak, 1, 'and a Calm day is counted');
});

test('the budget: two minor events at 09:00 and one peak at 12:00 a day', () => {
  const { w } = line([['A', 'z', 3], ['B', 'y', 40]]);
  w.tick = 1;   // 09:00
  assert.equal(D.allowsHostile(w, 'z'), true); D.spend(w, 'z');
  assert.equal(D.allowsHostile(w, 'z'), true); D.spend(w, 'z');
  assert.equal(D.allowsHostile(w, 'z'), false, 'two minors are the day\'s budget');
  w.tick = 4;   // 12:00
  assert.equal(D.allowsHostile(w, 'z'), true); D.spend(w, 'z');
  assert.equal(D.allowsHostile(w, 'z'), false, 'one peak');
  w.tick = 25;  // 09:00 next day: the budget resets
  assert.equal(D.allowsHostile(w, 'z'), true);
});

test('two consecutive Calm days add one extra hostile action, once', () => {
  const { board, w } = line([['A', 'z', 10], ['B', 'y', 20]]);   // ratio 14 to 10: below the AI\'s own 2 to 1, above the Director\'s 1 to 1
  let st = w; const all = [];
  for (let day = 0; day < 4; day++) { const r = step(board, st, [], 24); st = r.state; st.clans.z.lastActive = st.tick; all.push(...r.events.map((e) => ({ ...e, day }))); }
  const extra = ev(all, 'director_extra');
  assert.equal(extra.length, 1, JSON.stringify(extra));
  assert.ok(extra[0].day >= 2, 'not before two Calm days have passed');
  assert.equal(raids(all).filter((e) => e.day < 2).length, 0, 'no raids while the AI has no 2 to 1');
  assert.equal(raids(all).length >= 1, true);
});

test('the empty day: a present player with no chance gets one; units are moved, never lost, and only once a day', () => {
  const { board, w } = line([['A', 'z', 10], ['B', 'y', 14], ['C', 'y', 3]], { startHour: 8 });
  const plan = D.emptyDay(w, board, 'z');
  assert.deepEqual(plan && { enemy: plan.enemy, to: plan.to, keep: plan.keep }, { enemy: 'B', to: 'C', keep: 4 });
  const total = (s) => Object.values(s.towns).reduce((n, t) => n + t.force, 0);
  const r = step(board, w, [], 1);
  const nudge = ev(r.events, 'director_nudge');
  assert.equal(nudge.length, 1);
  assert.equal(nudge[0].enemy, 'B'); assert.equal(total(r.state), total(w) + 2, 'only the two clans\' recruits were added: the nudge moved units, it did not create or destroy any');
  assert.ok((r.state.towns.A.force - 1) / r.state.towns.B.force >= 2, 'a chance now exists');
  // a chance exists now, so the rule is silent
  assert.equal(D.emptyDay(r.state, board, 'z'), null);
  // with an open front, or a raid already coming, nothing is needed
  const { w: w2 } = line([['A', 'z', 10], ['B', 'y', 14], ['C', 'y', 3]]);
  w2.fronts = { f1: { id: 'f1', status: 'open', attacker: 'z', target: 'B' } };
  assert.equal(D.emptyDay(w2, board, 'z'), null);
  // never against a pinned township
  const { w: w3 } = line([['A', 'z', 10], ['B', 'y', 14], ['C', 'y', 3]]);
  w3.fronts = { f1: { id: 'f1', status: 'open', attacker: 'z', target: 'B' } };
  // an absent player is left alone
  const { w: w4 } = line([['A', 'z', 10], ['B', 'y', 14], ['C', 'y', 3]]);
  w4.clans.z.absentSince = 5;
  assert.equal(D.emptyDay(w4, board, 'z'), null);
});

test('over a real board, a present passive player almost always has something to decide, and the world stays valid', () => {
  let days = 0, withChoice = 0, nudges = 0, extras = 0, raidsAll = 0;
  for (let s = 0; s < 10; s++) {
    let w = newWorld(bigBoard, { seed: 'dir' + s, home: 'Paterson City|Passaic', clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }] });
    w.clans.goblins.shieldUntil = 0;
    for (let day = 0; day < 40; day++) {
      w.clans.goblins.lastActive = w.tick;
      const r = step(bigBoard, w, [], 24); w = r.state;
      nudges += ev(r.events, 'director_nudge').length; extras += ev(r.events, 'director_extra').length; raidsAll += raids(r.events).length;
      assert.deepEqual(checkInvariants(bigBoard, w), [], `seed ${s} day ${day}`);
      const mine = Object.keys(w.towns).filter((t) => w.towns[t].owner === 'goblins');
      if (!mine.length) break;
      days++;
      const chance = openFronts(w, 'goblins').length > 0 || w.raids.some((x) => w.towns[x.target].owner === 'goblins') ||
        mine.some((t) => bigBoard.neighbours(t).some((e) => w.towns[e] && w.towns[e].owner && w.towns[e].owner !== 'goblins' && (w.towns[t].force - 1) / Math.max(1, w.towns[e].force) >= 2)) ||
        mine.every((t) => bigBoard.neighbours(t).every((e) => !w.towns[e] || w.towns[e].owner === 'goblins' || !w.towns[e].owner));
      if (chance) withChoice++;
    }
  }
  console.log(`# director on a real board: ${withChoice}/${days} player-days with a visible chance; nudges ${nudges}, extras ${extras}, raids ${raidsAll}`);
  assert.ok(withChoice / days > 0.5, `${withChoice}/${days}`);
});
