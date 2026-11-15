// F0 check: from the home page to a first result card in at most five taps, and no more than three buttons on a fresh township card.
//   python3 -m http.server 8077 (repo root), then: NODE_PATH=$(npm root -g) node tools/goblin/ui-first.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  let taps = 0;
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');
  await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry=goblin]'); taps++;
  await page.waitForSelector('#sheet .gob');
  const px = await page.evaluate(() => { const m = window.njtf.byKey.get('Paterson City|Passaic'); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; });
  await page.mouse.click(px[0], px[1]); taps++;
  await page.waitForSelector('[data-g=begin]'); await page.click('[data-g=begin]'); taps++;
  await page.waitForSelector('[data-g=first]');
  console.log('first move panel:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 220));
  await page.click('[data-g=first]'); taps++;
  await page.waitForSelector('#sheet h3');
  console.log('result:', (await page.locator('#sheet h3').innerText()), '| taps from the home page:', taps);
  await page.click('[data-g=close]');
  // a fresh township card: count its buttons
  const own = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('njtf.goblin.save')).world; return Object.keys(w.towns).find((t) => w.towns[t].owner === 'goblins' && w.towns[t].force >= 3); });
  const p = await page.evaluate((id) => { window.njtf.map.easeTo({ center: window.njtf.byKey.get(id).pt, zoom: 10, duration: 0 }); return id; }, own);
  await page.waitForTimeout(400);
  const pt = await page.evaluate((id) => { const m = window.njtf.byKey.get(id); const q = window.njtf.map.project(m.pt); return [q.x, q.y]; }, own);
  await page.mouse.click(pt[0], pt[1]);
  await page.waitForSelector('#sheet button');
  const n = await page.locator('#sheet button').count();
  console.log('buttons on a fresh own-township card:', n, '| errors:', errs);
  if (taps > 5 || n > 3 || errs.length) process.exit(1);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
