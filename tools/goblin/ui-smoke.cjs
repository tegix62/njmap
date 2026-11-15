// Drives goblin mode in headless Chromium: home page, start a war, attack, digest, back to normal mode. Needs: python3 -m http.server 8077 (repo root) and playwright.
//   NODE_PATH=$(npm root -g) node tools/goblin/ui-smoke.cjs   (writes scratch-*.png in the current directory)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/tiles|openfreemap|Failed to load resource|net::/.test(m.text())) errs.push('console ' + m.text()); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');
  await page.waitForSelector('#welcome:not([hidden]) [data-entry]');
  console.log('home shown:', await page.locator('#welcome [data-entry]').allInnerTexts());
  await page.screenshot({ path: 'scratch-home.png' });
  await page.click('[data-entry=goblin]');
  await page.waitForFunction(() => window.njtf && window.njtf.mode === 'goblin', null, { timeout: 15000 });
  await page.waitForSelector('#sheet .gob', { timeout: 15000 });
  console.log('start panel:', (await page.locator('#sheet').innerText()).slice(0, 80));
  // tap Paterson by projecting its label point
  const px = await page.evaluate(() => { const m = window.njtf.byKey.get('Paterson City|Passaic'); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; });
  await page.mouse.click(px[0], px[1]);
  await page.waitForSelector('[data-g=begin]');
  console.log('confirm:', (await page.locator('#sheet h3').innerText()));
  await page.click('[data-g=begin]');
  await page.waitForTimeout(1500);
  console.log('hud:', (await page.locator('#hud').innerText()).replace(/\n/g, ' | '));
  await page.screenshot({ path: 'scratch-board.png' });
  // pick own township with force >= 2 that borders an enemy
  const info = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('njtf.goblin.save')); const w = s.world;
    for (const [id, t] of Object.entries(w.towns)) if (t.owner === 'goblins' && t.force >= 3) { const nb = Object.keys(w.towns).find((x) => w.towns[x].owner && w.towns[x].owner !== 'goblins' && window.njtf.byKey.get(id)); return { id }; }
  });
  
  // find a my-township/enemy-neighbour pair using the board file
  const pair = await page.evaluate(async () => {
    const bj = await fetch('data/goblin-board.json').then((r) => r.json());
    const s = JSON.parse(localStorage.getItem('njtf.goblin.save')); const w = s.world;
    for (const id of Object.keys(w.towns)) if (w.towns[id].owner === 'goblins' && w.towns[id].force >= 3) for (const n of bj.towns[id].nb) if (w.towns[n] && w.towns[n].owner && w.towns[n].owner !== 'goblins') return [id, n];
  });
  console.log('pair', pair);
  const proj = (id) => page.evaluate((i) => { const m = window.njtf.byKey.get(i); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }, id);
  await page.evaluate((id) => window.njtf.map.easeTo({ center: window.njtf.byKey.get(id).pt, zoom: 10, duration: 0 }), pair[0]);
  await page.waitForTimeout(500);
  let p0 = await proj(pair[0]); await page.mouse.click(p0[0], p0[1]);
  await page.waitForSelector('[data-g=pick]'); await page.click('[data-g=pick]');
  let p1 = await proj(pair[1]); await page.mouse.click(p1[0], p1[1]);
  await page.waitForSelector('[data-g=send]');
  console.log('order panel:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await page.screenshot({ path: 'scratch-order.png' });
  await page.click('[data-g=send]');
  await page.waitForSelector('.gobdice, #sheet h3');
  console.log('result:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 400));
  await page.screenshot({ path: 'scratch-result.png' });
  await page.click('[data-gbar=digest]'); await page.waitForTimeout(300);
  console.log('digest:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await page.click('[data-gbar=home]');
  await page.waitForSelector('#welcome:not([hidden])');
  await page.click('[data-entry=normal]');
  await page.waitForFunction(() => window.njtf.mode !== 'goblin');
  console.log('back to normal mode:', await page.evaluate(() => window.njtf.mode), 'tabs visible:', await page.locator('#tabs').isVisible());
  console.log('errors:', errs);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
