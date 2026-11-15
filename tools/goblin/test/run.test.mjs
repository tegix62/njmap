import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { loadContent } from '../../../js/goblin/sim/chars.js';
import { renderLedger, placePhrase } from '../../../js/goblin/sim/ledger.js';
import { runWar, metricsOf } from '../run.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = loadContent(read('../../../data/goblin-content.json'));
const board = makeBoard(read('../../../data/goblin-board.json'), content);

test('place phrases come from the map: distance, direction, river, highway', () => {
  assert.match(placePhrase(board, 'Paterson City|Passaic', 'Hawthorne Borough|Passaic'), /mi (north|northwest|northeast) of Paterson/);
  assert.match(placePhrase(board, 'Newark City|Essex', 'Harrison Town|Hudson'), /over the .*Passaic/);
  assert.doesNotMatch(placePhrase(board, 'Paterson City|Passaic', 'Totowa Borough|Passaic'), /over the/, 'a land border (H42)');
});

test('bots play 21 days on 3 seeds each: deterministic, no rejected orders, no stray template tokens', () => {
  for (const bot of ['careful', 'bold', 'passive']) {
    for (const seed of [1, 2, 3]) {
      const a = runWar({ seed, days: 21, bot }), b = runWar({ seed, days: 21, bot });
      assert.deepEqual(a.state, b.state, `${bot} ${seed} deterministic`);
      assert.equal(a.rejected.length, 0, `${bot} ${seed} rejected: ${JSON.stringify(a.rejected[0])}`);
      const text = renderLedger(a.events, { board, state: a.state, content, clan: 'goblins' });
      assert.doesNotMatch(text, /\{\w+\}/, 'unfilled token');
      assert.ok(text.split('\n').length > 5);
      const m = metricsOf(a, 21);
      assert.equal(m.days, 21); assert.ok(m.distinctShapesPerDay.mean > 0);
    }
  }
});

test('a passive lord loses ground; an active one gains it', () => {
  const end = (bot) => metricsOf(runWar({ seed: 4, days: 21, bot }), 21).endTowns;
  assert.ok(end('passive') < end('careful'));
});
