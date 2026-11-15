import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { loadContent } from '../../../js/goblin/sim/chars.js';
import { step, checkInvariants } from '../../../js/goblin/sim/world.js';
import { initWar, progress } from '../../../js/goblin/sim/war.js';
import { legalOrders } from '../../../js/goblin/sim/front.js';
import { entriesOf } from '../../../js/goblin/sim/ledger.js';
import { digestOf } from '../../../js/goblin/sim/digest.js';
import { K7 } from '../../../js/goblin/sim/constants.js';

const content = loadContent(JSON.parse(fs.readFileSync(new URL('../../../data/goblin-content.json', import.meta.url), 'utf8')));
const ev = (events, t) => events.filter((e) => e.type === t);

// Ten townships in a line, three counties (A-D, E-H, I-J). spec: owner string per township.
function line(owners, { counties = ['X', 'X', 'X', 'X', 'Y', 'Y', 'Y', 'Y', 'Z', 'Z'] } = {}) {
  const names = owners.map((_, i) => 'T' + i);
  const tj = { towns: {}, borders: {} };
  names.forEach((n, i) => { tj.towns[n] = { name: n, county: counties[i], pop: 1000 - i, nb: [names[i - 1], names[i + 1]].filter(Boolean) }; });
  for (let i = 0; i < names.length - 1; i++) tj.borders[`${names[i]}~${names[i + 1]}`] = { mi: 1, river: null, ridge: null, highways: [] };
  const board = makeBoard(tj);
  const clan = (id, lord, home) => ({ id, kind: 'goblin', lord, home, shieldUntil: 0, lastActive: 0, absentSince: null, out: false, peakTowns: 4, ...(lord === 'human' ? { ap: 3 } : {}) });
  const ids = [...new Set(owners)];
  const w = { v: 1, seed: 1, rng: 5, tick: 0, startHour: 8, lastMajor: 0, theatre: names, chars: {}, heirs: [], fronts: {}, raids: [], director: {}, nextId: 1,
    towns: Object.fromEntries(owners.map((o, i) => [names[i], { owner: o, force: 6, dugIn: false, captain: null, attackedTick: -1 }])),
    clans: Object.fromEntries(ids.map((o) => [o, clan(o, o === 'z' ? 'human' : 'ai', names[owners.indexOf(o)])])),
    rules: { aiCaptureCooldownTicks: 99999 } };   // keep the AI quiet so only the war's own clock is under test
  initWar(w, board);
  return { board, w };
}
const run = (board, w, ticks) => { let st = w; const all = []; for (let i = 0; i < ticks; i++) { st.clans.z.lastActive = st.tick; const r = step(board, st, [], 1); st = r.state; all.push(...r.events); } return { st, all }; };

test('progress counts townships (never percentages): more than half of ten is six', () => {
  const { w } = line(['z', 'z', 'z', 'z', 'z', 'y', 'y', 'y', 'x', 'x']);
  assert.deepEqual(progress(w, 'z'), { held: 5, need: 6, total: 10, hoursLeft: null });
});

test('holding more than half for 72 ticks wins; slipping under resets the clock', () => {
  const { board, w } = line(['z', 'z', 'z', 'z', 'z', 'z', 'y', 'y', 'x', 'x']);
  let { st, all } = run(board, w, 3);
  assert.equal(ev(all, 'war_hold').length, 1); assert.equal(ev(all, 'war_hold')[0].started, true);
  assert.ok(progress(st, 'z').hoursLeft <= K7.warHoldTicks);
  // lose one township: under half, the clock stops
  st.towns.T5.owner = 'y';
  let r = run(board, st, 12); assert.ok(ev(r.all, 'war_hold').some((e) => !e.started)); assert.equal(progress(r.st, 'z').hoursLeft, null);
  // regain it and hold for three days
  r.st.towns.T5.owner = 'z';
  r = run(board, r.st, 24 * 4);
  const over = ev(r.all, 'war_over')[0];
  assert.ok(over, 'the war ends'); assert.equal(over.winner, 'z'); assert.equal(over.human, true);
  assert.equal(r.st.war.over.how, 'held');
  assert.ok(r.st.war.over.tick - r.st.war.hold.z >= K7.warHoldTicks);
});

test('a rival holding more than half for three days loses the war for the player', () => {
  const { board, w } = line(['z', 'y', 'y', 'y', 'y', 'y', 'y', 'x', 'x', 'x']);
  const r = run(board, w, 24 * 5);
  const over = ev(r.all, 'war_over')[0];
  assert.equal(over.winner, 'y'); assert.equal(over.human, false);
  const text = entriesOf(r.all, { board, state: r.st, content, clan: 'z' }).map((e) => e.text).join('\n');
  assert.match(text, /war is lost/i);
});

test('a finished war takes no orders and no time, and lists no orders', () => {
  const { board, w } = line(['z', 'z', 'z', 'z', 'z', 'z', 'z', 'y', 'x', 'x']);
  const { st } = run(board, w, 24 * 5);
  assert.ok(st.war.over);
  const tick = st.tick;
  const r = step(board, st, [{ type: 'attack', clan: 'z', from: 'T6', to: 'T7', n: 2 }], 48);
  assert.equal(ev(r.events, 'order_rejected')[0].reason, 'the war is over');
  assert.equal(r.state.tick, tick);
  assert.deepEqual(legalOrders(board, st, 'z'), []);
});

test('milestones fire once each: first ground, a third of the map, a county, a rival home', () => {
  const { board, w } = line(['z', 'z', 'y', 'y', 'y', 'y', 'y', 'x', 'x', 'x']);
  const { st, all } = run(board, w, 3);
  assert.equal(ev(all, 'milestone').length, 0, 'nothing before anything is taken');
  st.towns.T2.owner = 'z';   // first ground, and it is y's home
  st.towns.T3.owner = 'z';   // four of ten: past a third, and all of county X (T0 to T3)
  const r = run(board, st, 3);
  const ms = ev(r.all, 'milestone');
  assert.deepEqual(ms.map((e) => e.key).sort(), ['county', 'first_township', 'rival_home', 'third']);
  assert.equal(ms.find((e) => e.key === 'rival_home').of, 'y');
  assert.equal(ms.find((e) => e.key === 'county').county, 'X');
  const again = run(board, r.st, 6);
  assert.equal(ev(again.all, 'milestone').length, 0, 'nothing fires twice');
  const d = digestOf(r.all, { board, state: r.st, content, clan: 'z' });
  assert.ok(d.lines.some((l) => /took the home/i.test(l.text)), 'milestones reach the digest');
  const text = entriesOf(r.all, { board, state: r.st, content, clan: 'z' }).map((e) => e.text).join('\n');
  assert.match(text, /holds all of X County/); assert.doesNotMatch(text, /\{\w+\}/);
});

test('every human clan out of the war ends it as a loss', () => {
  const { board, w } = line(['y', 'y', 'y', 'y', 'y', 'y', 'x', 'x', 'x', 'x']);
  w.clans.z = { id: 'z', kind: 'goblin', lord: 'human', home: 'T0', shieldUntil: 0, lastActive: 0, absentSince: null, out: true, peakTowns: 1, ap: 3 };
  const r = run(board, w, 3);
  assert.equal(ev(r.all, 'war_over')[0].how, 'wiped out');
  assert.deepEqual(checkInvariants(board, r.st), []);
});
