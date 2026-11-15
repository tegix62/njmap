import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { loadContent } from '../../../js/goblin/sim/chars.js';
import { digestOf } from '../../../js/goblin/sim/digest.js';
import { renderLedger, entriesOf } from '../../../js/goblin/sim/ledger.js';
import { runWar } from '../run.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = loadContent(read('../../../data/goblin-content.json'));
const board = makeBoard(read('../../../data/goblin-board.json'), content);

test('the digest is a headline and at most five lines taken from the same events as the full Ledger', () => {
  for (const bot of ['careful', 'bold', 'passive']) {
    const r = runWar({ seed: 2, days: 10, bot });
    const d = digestOf(r.events, { board, state: r.state, content, clan: 'goblins' });
    assert.ok(d.headline.startsWith('Since you were last here'));
    assert.ok(d.lines.length <= 5);
    const full = new Set(entriesOf(r.events, { board, state: r.state, content, clan: 'goblins' }).map((e) => e.text));
    for (const l of d.lines) assert.ok(full.has(l.text), 'every digest line is a Ledger line');
    const whens = d.lines.map((l) => l.when);
    assert.deepEqual(whens, [...whens].sort((a, b) => (+a.match(/\d+/)[0] - +b.match(/\d+/)[0]) || (a < b ? -1 : 1)), 'chronological');
    assert.equal(d.lines.length + d.hidden, entriesOf(r.events, { board, state: r.state, content, clan: 'goblins' }).length);
  }
});

test('losses and warnings outrank everything; incoming raids come from the state', () => {
  const r = runWar({ seed: 1, days: 21, bot: 'passive' });
  const d = digestOf(r.events, { board, state: r.state, content, clan: 'goblins' });
  assert.match(d.headline, /lost|raid/);
  assert.ok(d.lines.some((l) => /raid|took it|Took/i.test(l.text)));
  const w = structuredClone(r.state);
  const target = Object.keys(w.towns).find((t) => w.towns[t].owner === 'goblins');
  w.raids.push({ id: 99, by: 'rats', from: board.neighbours(target)[0], target, force: 7, declaredAt: w.tick, landsAt: w.tick + 6 });
  const d2 = digestOf([], { board, state: w, content, clan: 'goblins' });
  assert.equal(d2.headline, 'Since you were last here: quiet.');
  assert.equal(d2.incoming.length, 1); assert.match(d2.incoming[0].text, /are coming for/);
});

test('the full Ledger still renders the same text after the refactor', () => {
  const r = runWar({ seed: 3, days: 5, bot: 'careful' });
  const text = renderLedger(r.events, { board, state: r.state, content, clan: 'goblins' });
  assert.match(text, /^### Day \d+/m); assert.doesNotMatch(text, /\{\w+\}/);
});
