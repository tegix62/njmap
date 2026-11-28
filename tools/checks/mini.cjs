// Miniature landmarks (js/mini.js): a tower's hand-shaped model scaled evenly as one piece. Pure, no browser.
// Run: node tools/checks/mini.cjs → "mini ok" or the failures.
const assert = require('assert');
const fails = []; const check = (n, f) => { try { f(); } catch (e) { fails.push(`${n}: ${e.message}`); } };
(async () => {
  const M = await import('../../js/mini.js');
  const KX = 1 / 84200, KY = 1 / 111000, O = [-73.98, 40.75];
  const sq = (x, y, r) => { const p = (dx, dy) => [O[0] + (x + dx) * KX, O[1] + (y + dy) * KY]; return [[p(-r, -r), p(r, -r), p(r, r), p(-r, r), p(-r, -r)]]; };
  const piece = (m, x, y, r, b, h) => ({ type: 'Feature', properties: { b, h, c: '#e4ddcc', m }, geometry: { type: 'Polygon', coordinates: sq(x, y, r) } });
  const esb = [piece('Empire State Building', 0, 0, 30, 0, 100), piece('Empire State Building', 0, 0, 20, 100, 300), piece('Empire State Building', 0, 0, 1.5, 381, 443)];
  const small = [piece('Seagram Building', 500, 0, 25, 0, 157)];
  const other = [{ type: 'Feature', properties: { h: 250, c: '#ddd' }, geometry: { type: 'Polygon', coordinates: sq(900, 0, 20) } }, { type: 'Feature', properties: { h: 30 }, geometry: { type: 'Polygon', coordinates: sq(950, 0, 20) } }];
  const out = M.miniModels([...esb, ...small, ...other]);
  const ext = (f) => { const xs = f.geometry.coordinates[0].map((p) => p[0]); return (Math.max(...xs) - Math.min(...xs)) / KX; };
  const mid = (f) => { const r = f.geometry.coordinates[0].slice(0, -1); return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]; };
  const mine = (m) => out.filter((f) => f.properties.m === m);

  check('only model pieces are marked mini; everything else passes through unchanged', () => {
    assert.strictEqual(out.filter((f) => f.properties.mini).length, 4);
    const o = out.filter((f) => !f.properties.m); assert.strictEqual(o.length, 2); assert.strictEqual(o[0].properties.h, 250); assert.strictEqual(o[1].properties.h, 30); });
  check('a tall model comes down to a·√H (about 189 m for 443 m)', () => { const top = Math.max(...mine('Empire State Building').map((f) => f.properties.h)); assert.ok(Math.abs(top - 9 * Math.sqrt(443)) < 0.01, String(top)); });
  check('the tallest stays tallest', () => { assert.ok(Math.max(...mine('Empire State Building').map((f) => f.properties.h)) > Math.max(...mine('Seagram Building').map((f) => f.properties.h))); });
  check('every height in a model scales by the same factor', () => { const k = (9 * Math.sqrt(443)) / 443, p = mine('Empire State Building'); [[0, 100], [100, 300], [381, 443]].forEach(([b, h], i) => { assert.ok(Math.abs(p[i].properties.b - b * k) < 0.01); assert.ok(Math.abs(p[i].properties.h - h * k) < 0.01); }); });
  check('footprints shrink by that same factor: true proportions', () => { const k = (9 * Math.sqrt(443)) / 443, p = mine('Empire State Building'); assert.ok(Math.abs(ext(p[0]) - 60 * k) < 0.05, String(ext(p[0]))); assert.ok(Math.abs(ext(p[2]) - 3 * k) < 0.05); });
  check('it shrinks about its own middle (stays on its block)', () => { const p = mine('Empire State Building')[0]; const c = mid(p); assert.ok(Math.abs((c[0] - O[0]) / KX) < 0.5 && Math.abs((c[1] - O[1]) / KY) < 0.5); });
  check('a model under a·√H keeps its true size', () => { const h = Math.max(...mine('Seagram Building').map((f) => f.properties.h)); assert.ok(Math.abs(h - 9 * Math.sqrt(157)) < 0.01 || h === 157); });
  check('input features are not changed', () => { assert.strictEqual(esb[2].properties.h, 443); });
  check('options override the defaults', () => { const o = M.miniModels(esb, { a: 30 }); assert.strictEqual(Math.max(...o.map((f) => f.properties.h)), 443); });

  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  console.log('mini ok');
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
