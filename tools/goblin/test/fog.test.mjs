import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { fogMap, forceWord, rank } from '../../../js/goblin/ui/fog.js';

const board = makeBoard(JSON.parse(fs.readFileSync(new URL('../../../data/goblin-board.json', import.meta.url), 'utf8')));
const PAT = 'Paterson City|Passaic', TOT = 'Totowa Borough|Passaic';
const far = Object.keys(board.towns).find((t) => board.distances(PAT).get(t) >= 6);
const lv = (m, id) => m.get(id);

test('Known is box 1 or better; box 0 is Familiar; nothing asked is Unknown far from anything known', () => {
  const srs = { [far]: { b: 1, due: 0 }, [TOT]: { b: 0, due: 0 } };
  const m = fogMap(board, { srs });
  assert.equal(lv(m, far), 'known'); assert.equal(lv(m, TOT), 'familiar');
  assert.equal(lv(m, 'Newark City|Essex'), 'unknown');
});

test('your own townships are always Known; home and its neighbours start Familiar (the floor)', () => {
  const m = fogMap(board, { srs: {}, own: [PAT], home: PAT });
  assert.equal(lv(m, PAT), 'known');
  for (const n of board.neighbours(PAT)) assert.equal(lv(m, n), 'familiar', n);
  // the floor does not make anything Known
  assert.ok(![...m.values()].some((l, i) => l === 'known' && [...m.keys()][i] !== PAT));
});

test('play raises a township to Familiar and never to Known', () => {
  const m = fogMap(board, { srs: {}, played: [far] });
  assert.equal(lv(m, far), 'familiar');
  const m2 = fogMap(board, { srs: { [far]: { b: 3, due: 0 } }, played: [far] });
  assert.equal(lv(m2, far), 'known', 'playing never lowers what you have learned');
});

test('rumours reach the neighbours of what you know, by border and along a highway, and stop there', () => {
  const m = fogMap(board, { srs: { [PAT]: { b: 2, due: 0 } } });
  for (const n of board.neighbours(PAT)) assert.equal(lv(m, n), 'rumoured', n);
  // a highway carries news one step past a border: Paterson's Route 4 neighbour in a lane but not a border neighbour
  const lanes = board.json.lanes.flatMap((l) => l.segments);
  const viaLane = new Set(); for (const seg of lanes) for (let i = 0; i + 1 < seg.length; i++) { if (seg[i] === PAT) viaLane.add(seg[i + 1]); if (seg[i + 1] === PAT) viaLane.add(seg[i]); }
  for (const t of viaLane) assert.ok(rank(lv(m, t)) >= rank('rumoured'), t);
  // two steps away on land is still Unknown
  const two = [...board.distances(PAT)].find(([t, d]) => d === 3 && !viaLane.has(t));
  assert.equal(lv(m, two[0]), 'unknown');
});

test('the function writes nothing: the review data is untouched', () => {
  const srs = { [PAT]: { b: 2, due: 5 }, [TOT]: { b: 0, due: 7 } };
  const copy = JSON.stringify(srs);
  fogMap(board, { srs, played: [far], own: [PAT], home: PAT });
  assert.equal(JSON.stringify(srs), copy);
});

test('a new player with no data still sees a readable map (D180): the floor and its rumours', () => {
  const m = fogMap(board, { srs: {}, own: [PAT], home: PAT });
  const counts = {}; for (const l of m.values()) counts[l] = (counts[l] || 0) + 1;
  assert.ok(counts.familiar >= 5 && counts.rumoured >= 5, JSON.stringify(counts));
});

test('force words: a handful, a band, a host', () => {
  assert.deepEqual([1, 3, 4, 8, 9, 40].map((n) => forceWord(n)), ['a handful', 'a handful', 'a band', 'a band', 'a host', 'a host']);
});
