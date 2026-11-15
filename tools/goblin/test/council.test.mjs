import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { loadContent } from '../../../js/goblin/sim/chars.js';
import { newWorld, step } from '../../../js/goblin/sim/world.js';
import { legalOrders } from '../../../js/goblin/sim/front.js';
import { rivalsFor } from '../../../js/goblin/sim/chapters.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = loadContent(read('../../../data/goblin-content.json'));
const board = makeBoard(read('../../../data/goblin-board.json'), content, read('../../../data/goblin-regions.json'));
const ME = 'goblins';
const fresh = (rules) => { const w = newWorld(board, { seed: 'c-test', home: 'Paterson City|Passaic', clans: [{ id: ME, kind: 'goblin', lord: 'human' }, ...rivalsFor('c-test')], startHour: 9, startMs: 0, guidedStart: true, rules }); delete w.clans[ME].ap; return w; };

test('with the Council rule a front goes straight to its decision and closes, so the next march is not blocked', () => {
  let w = fresh({ frontMinManeuvers: 0 });
  const open = legalOrders(board, w, ME).find((o) => o.type === 'front_open');
  assert.ok(open, 'a captained neighbour exists');
  let r = step(board, w, [{ ...open, n: Math.min(open.n.max, w.towns[open.from].force - 1) }], 0); w = r.state;
  const fid = r.events.find((e) => e.type === 'front_opened').front;
  const dec = legalOrders(board, w, ME).find((o) => o.type === 'front' && o.front === fid && o.action === 'decision');
  assert.ok(dec, 'the decision is legal at once');
  r = step(board, w, [dec], 0); w = r.state;
  assert.ok(r.events.some((e) => e.type === 'front_closed'));
  assert.equal(Object.values(w.fronts).filter((f) => f.status === 'open').length, 0);
});

test('without the rule the decision still needs a maneuver first (the first front end is unchanged)', () => {
  let w = fresh();
  const open = legalOrders(board, w, ME).find((o) => o.type === 'front_open');
  const r = step(board, w, [{ ...open, n: Math.min(open.n.max, w.towns[open.from].force - 1) }], 0); w = r.state;
  assert.ok(!legalOrders(board, w, ME).some((o) => o.type === 'front' && o.action === 'decision'));
});

test('a move can take the captain along when the township moved to has none; otherwise the captain stays', () => {
  let w = fresh();
  const c = Object.values(w.chars).find((x) => x.clan === ME && x.at);
  const to = board.neighbours(c.at).find((n) => w.towns[n] && w.towns[n].owner === ME && !w.towns[n].captain);
  assert.ok(to, 'a captainless neighbour of your own');
  const from = c.at;
  let r = step(board, w, [{ type: 'move', clan: ME, from, to, n: 2, captain: true }], 0); w = r.state;
  assert.equal(w.towns[to].captain, c.id); assert.equal(w.towns[from].captain, null); assert.equal(w.chars[c.id].at, to);
  assert.equal(r.events.find((e) => e.type === 'units_moved').captain, c.id);
  r = step(board, w, [{ type: 'move', clan: ME, from: to, to: from, n: 1 }], 0); w = r.state;
  assert.equal(w.towns[to].captain, c.id, 'a plain move leaves the captain');
});
