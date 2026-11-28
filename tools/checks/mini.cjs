// The miniature-landmark formula (js/mini.js): pure, no browser. Run: node tools/checks/mini.cjs → "mini ok" or the failures.
const assert = require('assert');
const fails = []; const check = (n, f) => { try { f(); } catch (e) { fails.push(`${n}: ${e.message}`); } };
(async () => {
  const M = await import('../../js/mini.js');
  const KX = 1 / 84200, KY = 1 / 111000;
  // a square footprint of half-size r metres at (x, y) metres from an origin, as lon/lat
  const sq = (x, y, r) => { const o = [-73.98, 40.75]; const p = (dx, dy) => [o[0] + (x + dx) * KX, o[1] + (y + dy) * KY]; return [[p(-r, -r), p(r, -r), p(r, r), p(-r, r), p(-r, -r)]]; };
  const piece = (x, y, r, b, h, c = '#e4ddcc') => ({ type: 'Feature', properties: { b, h, c }, geometry: { type: 'Polygon', coordinates: sq(x, y, r) } });
  const plain = (x, y, r, h) => ({ type: 'Feature', properties: { h }, geometry: { type: 'Polygon', coordinates: sq(x, y, r) } });
  // a 380 m stepped tower (three tiers and a mast), a 120 m one 500 m away, and ordinary blocks
  const tall = [piece(0, 0, 30, 0, 100), piece(0, 0, 20, 100, 300), piece(0, 0, 10, 300, 380), piece(0, 0, 1.2, 380, 440, '#dfe5e9')];
  const short = [piece(500, 0, 25, 0, 120)];
  const blocks = [plain(200, 200, 20, 30), plain(260, 200, 20, 150)];
  const out = M.miniaturize([...tall, ...short, ...blocks]);
  const lm = out.filter((f) => f.properties.mini === 'piece'), tiles = out.filter((f) => f.properties.mini === 'tile');
  const ext = (f) => { const xs = f.geometry.coordinates[0].map((p) => p[0]); return (Math.max(...xs) - Math.min(...xs)) / KX; };

  check('landmark pieces are grouped into two landmarks, each with a tile', () => { assert.strictEqual(tiles.length, 2); assert.deepStrictEqual([...new Set(lm.map((f) => f.properties.g))].length, 2); });
  check('the tallest stays tallest', () => { const top = (g) => Math.max(...lm.filter((f) => f.properties.g === g).map((f) => f.properties.h)); const gs = [...new Set(lm.map((f) => f.properties.g))]; const [a, b] = gs.map(top).sort((x, y) => y - x); assert.ok(a > b); });
  check('a tall landmark comes out far lower than true', () => { const t = Math.max(...lm.map((f) => f.properties.h)); assert.ok(t < 300 && t > 120, String(t)); });
  check('proportions inside a landmark are kept (each tier top as a share of the roof)', () => {
    const g = lm.find((f) => f.properties.h === Math.max(...lm.map((x) => x.properties.h))).properties.g, mine = lm.filter((f) => f.properties.g === g).sort((a, b) => a.properties.h - b.properties.h);
    const k = mine[0].properties.h / 100; [100, 300, 380, 440].forEach((h, i) => assert.ok(Math.abs(mine[i].properties.h - h * k) < 0.01, `tier ${i}`)); });
  check('footprints widen as a landmark shrinks, within 1 to 1.6', () => { const base = lm.find((f) => f.properties.b === 0 && ext(f) > 50); const w = ext(base) / 60; assert.ok(w >= 1 && w <= 1.6 + 1e-9, String(w)); });
  check('a thin spire widens more than its tower', () => { const mast = lm.find((f) => ext(f) < 10); const w = ext(mast) / 2.4; assert.ok(w > 1.6, String(w)); });
  check('a short landmark barely changes', () => { const s = lm.find((f) => Math.abs(ext(f) - 50) < 30 && f.properties.g !== lm[0].properties.g) || lm.find((f) => f.properties.h < 120 && f.properties.b === 0 && ext(f) < 70); assert.ok(s.properties.h > 95, String(s.properties.h)); });
  check('ordinary buildings are held low; short ones untouched', () => { const o = out.filter((f) => !f.properties.mini); const hs = o.map((f) => f.properties.h).sort((a, b) => a - b); assert.strictEqual(hs[0], 30); assert.ok(hs[1] < 70, String(hs[1])); });
  check('a tile sits on the ground under its landmark and is wider than it', () => { for (const t of tiles) { assert.strictEqual(t.properties.b, 0); assert.ok(t.properties.h > 0 && t.properties.h <= 4); } assert.ok(ext(tiles.find((t) => ext(t) > 80)) > 60 * 1.0); });
  check('input features are not changed', () => { assert.strictEqual(tall[0].properties.h, 100); assert.strictEqual(blocks[1].properties.h, 150); });
  check('no landmarks: only the ordinary-building rule applies', () => { const o = M.miniaturize(blocks); assert.strictEqual(o.length, 2); assert.ok(!o.some((f) => f.properties.mini)); });
  check('options override the defaults', () => { const o = M.miniaturize(blocks, { cap: 200 }); assert.strictEqual(o[1].properties.h, 150); });

  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  console.log('mini ok');
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
