// F6 check: a rock town's card says the dwarves hold it and offers Seek; tapping it from one of your townships never opens an attack; no page errors.
//   python3 -m http.server 8077 (repo root), then: NODE_PATH=$(npm root -g) node tools/goblin/ui-f6.cjs
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const keys = Object.keys(JSON.parse(fs.readFileSync('data/goblin-board.json', 'utf8')).towns);
  await page.addInitScript((ks) => { if (!localStorage.getItem('njtf.srs')) localStorage.setItem('njtf.srs', JSON.stringify(Object.fromEntries(ks.map((k) => [k, { b: 2, due: 0 }])))); }, keys);
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');
  await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]'); await page.waitForSelector('#sheet .gob');
  const proj = (id) => page.evaluate((i) => { const m = window.njtf.byKey.get(i); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }, id);
  let px = await proj('Paterson City|Passaic'); await page.mouse.click(px[0], px[1]);
  await page.waitForSelector('[data-g=begin]'); await page.click('[data-g=begin]'); await page.waitForSelector('[data-g=first]'); await page.click('[data-g=close]');
  const pair = await page.evaluate(async () => {
    const bj = await fetch('data/goblin-board.json').then((r) => r.json());
    const w = JSON.parse(localStorage.getItem('njtf.goblin.save')).world;
    for (const id of Object.keys(w.towns)) if (w.towns[id].owner === 'goblins' && w.towns[id].force >= 3) for (const n of bj.towns[id].nb) if (w.towns[n] && w.towns[n].owner === 'dwarves') return [id, n];
  });
  console.log('own township beside a rock town:', pair);
  async function card(id) { await page.evaluate((i) => window.njtf.map.easeTo({ center: window.njtf.byKey.get(i).pt, zoom: 10, duration: 0 }), id); await page.waitForTimeout(300); const p = await proj(id); await page.mouse.click(p[0], p[1]); await page.waitForSelector('#sheet .gob'); }
  // select ours, then tap the rock town: must be a card, not an order
  await card(pair[0]); await page.click('[data-g=pick]');
  const p1 = await proj(pair[1]); await page.mouse.click(p1[0], p1[1]); await page.waitForSelector('#sheet .gob');
  const t = (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ');
  console.log('rock card:', t.slice(0, 330));
  console.log('no attack offered:', !(await page.locator('[data-g=send]').count()), '| seek offered:', await page.locator('[data-g=seek]').count());
  await page.click('[data-g=seek]'); await page.waitForTimeout(200);
  console.log('seek result:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 220));
  console.log('errors:', errs);
  if (errs.length || (await page.locator('[data-g=send]').count())) process.exit(1);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
