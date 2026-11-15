import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { portrait, dice, expressionFor, PORTRAIT_PARTS } from '../../../js/goblin/ui/portrait.js';
import { messengerFace } from '../../../js/goblin/ui/messenger.js';
import { reasonsText, entriesOf } from '../../../js/goblin/sim/ledger.js';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { loadContent } from '../../../js/goblin/sim/chars.js';
import { runWar } from '../run.mjs';
import { tickTimes, downloadSizes } from '../perf.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = loadContent(read('../../../data/goblin-content.json'));

test('portraits: the same captain always looks the same, different captains differ, and they are well-formed SVG', () => {
  const c = { id: 'c7', name: 'Tarn Fenn', injuries: [], state: null };
  assert.equal(portrait(c, 'rat'), portrait(c, 'rat'));
  const looks = new Set(); for (let i = 0; i < 40; i++) looks.add(portrait({ id: 'c' + i, name: 'x', injuries: [] }, 'goblin'));
  assert.ok(looks.size >= 9, `${looks.size} distinct looks from 3 heads, 3 hats, 3 weapons`);
  const svg = portrait(c, 'toad'); assert.match(svg, /^<svg[^>]*viewBox="0 0 60 60"/); assert.equal((svg.match(/<svg/g) || []).length, 1); assert.match(svg, /<\/svg>$/);
  assert.notEqual(portrait(c, 'goblin'), portrait(c, 'rat'), 'a colour by clan kind');
});

test('portraits: each injury in the content file draws a layer, and the three expressions differ', () => {
  const base = { id: 'c9', name: 'x', injuries: [] };
  const ids = [...content.injuries.keys()];
  for (const id of ids) assert.ok(PORTRAIT_PARTS.injuries.includes(id), `a layer for ${id}`);
  const plain = portrait(base);
  for (const id of ids) assert.notEqual(portrait({ ...base, injuries: [id] }), plain, id);
  const ex = PORTRAIT_PARTS.expressions.map((e) => portrait(base, 'goblin', e)); assert.equal(new Set(ex).size, 3);
  assert.equal(expressionFor({ injuries: [], state: null }), 'steady'); assert.equal(expressionFor({ injuries: ['scar'], state: null }), 'grim'); assert.equal(expressionFor({ injuries: [], state: 'humiliated' }), 'shaken');
  assert.deepEqual([PORTRAIT_PARTS.heads, PORTRAIT_PARTS.hats, PORTRAIT_PARTS.weapons], [3, 3, 3]);
});

test('dice are shown as glyphs with the real numbers behind them; the messenger has four faces', () => {
  const d = dice([6, 1, 3], 'them'); assert.equal((d.match(/<i /g) || []).length, 3); assert.ok(d.includes('⚅') && d.includes('⚀') && d.includes('⚂')); assert.match(d, /class="dice them"/);
  const faces = ['cheerful', 'steady', 'nervous', 'frantic'].map(messengerFace); assert.equal(new Set(faces).size, 4);
});

test('reasons are a few words, never arithmetic (H45): no plus or minus numbers anywhere in a Ledger line about a roll', () => {
  assert.equal(reasonsText([]), 'nothing for or against');
  assert.equal(reasonsText([{ why: 'known weakness', v: 2 }, { why: 'captain suits it', v: 2 }, { why: 'hidden', v: -1 }]), "helped by a weakness you found and your captain's skill; hurt by something you had not seen");
  assert.doesNotMatch(reasonsText([{ why: 'night', v: 2 }, { why: 'hidden', v: -1 }]), /[+\-]\d|\d/);
  const r = runWar({ seed: 2, days: 14, bot: 'careful' });
  const text = entriesOf(r.events, { board: makeBoard(read('../../../data/goblin-board.json'), content, read('../../../data/goblin-regions.json')), state: r.state, content, clan: 'goblins' }).map((e) => e.text).join('\n');
  assert.match(text, /helped by|nothing for or against|hurt by/);
  assert.doesNotMatch(text, /\([+-]\d/, 'no (+2 ...) lists');
});

test('the budget (D197): an hourly tick on a 60-township theatre is far under 50 ms, and goblin mode adds under 300 KB gzipped before art', () => {
  const t = tickTimes(['Paterson City|Passaic', 'Newark City|Essex'], 14);
  assert.ok(t.towns >= 55 && t.p95 < 10, `p95 ${t.p95} ms on ${t.towns} townships (a desktop figure: a phone is about five times slower, so under 10 here is under 50 there)`);
  const d = downloadSizes(); assert.ok(d.gz < 300 * 1024, `${(d.gz / 1024).toFixed(0)} KB gzipped`);
});
