import test from 'node:test';
import assert from 'node:assert/strict';
import { nextUint, makeRng, hashSeed, seedState } from '../../../js/goblin/sim/rng.js';

test('nextUint is pure: same state, same output', () => {
  assert.deepEqual(nextUint(12345), nextUint(12345));
  assert.notDeepEqual(nextUint(12345), nextUint(12346));
});

test('same seed gives the same stream; different seeds differ', () => {
  const run = (seed) => { const r = makeRng(seedState(seed)); return Array.from({ length: 20 }, () => r.d6()).join(''); };
  assert.equal(run('paterson'), run('paterson'));
  assert.notEqual(run('paterson'), run('totowa'));
});

test('state can be saved and resumed mid-stream', () => {
  const r = makeRng(seedState(42));
  for (let i = 0; i < 17; i++) r.d6();
  const resumed = makeRng(r.state);
  assert.deepEqual(Array.from({ length: 30 }, () => r.d6()), Array.from({ length: 30 }, () => resumed.d6()));
});

test('hashSeed is stable for a known string', () => {
  assert.equal(hashSeed('goblin'), hashSeed('goblin'));
  assert.equal(seedState(7), 7);
  assert.equal(seedState('goblin'), hashSeed('goblin'));
});

test('d6 is uniform over 120,000 rolls (each face within 1% of one sixth)', () => {
  const r = makeRng(seedState('uniform')); const c = [0, 0, 0, 0, 0, 0, 0];
  const n = 120000; for (let i = 0; i < n; i++) c[r.d6()]++;
  for (let f = 1; f <= 6; f++) assert.ok(Math.abs(c[f] / n - 1 / 6) < 0.01, `face ${f}: ${c[f] / n}`);
  assert.equal(c[0], 0);
});

test('int(n) stays in range', () => {
  const r = makeRng(seedState(1)); for (let i = 0; i < 5000; i++) { const v = r.int(7); assert.ok(v >= 0 && v < 7 && Number.isInteger(v)); }
});
