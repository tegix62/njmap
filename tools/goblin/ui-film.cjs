// R1b check: attack from the home page and capture frames of the film. Needs: python3 -m http.server 8077, then
//   NODE_PATH=$(npm root -g) node tools/goblin/ui-film.cjs   (frames land in $OUT or ./film-frames)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = process.env.OUT || 'film-frames'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const keys = Object.keys(JSON.parse(fs.readFileSync('data/goblin-board.json', 'utf8')).towns);
  await page.addInitScript((ks) => { if (!localStorage.getItem('njtf.srs')) localStorage.setItem('njtf.srs', JSON.stringify(Object.fromEntries(ks.map((k) => [k, { b: 2, due: 0 }])))); }, keys);
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');
  await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]');
  await page.waitForSelector('#sheet .gob');
  const proj = (id) => page.evaluate((i) => { const m = window.njtf.byKey.get(i); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }, id);
  let px = await proj('Paterson City|Passaic'); await page.mouse.click(px[0], px[1]);
  await page.waitForSelector('[data-g=begin]'); await page.click('[data-g=begin]'); await page.waitForSelector('[data-g=first]');
  await page.click('[data-g=first]');
  await page.waitForSelector('#film', { timeout: 5000 });
  const t0 = Date.now(); let i = 0;
  while (await page.locator('#film').count()) { await page.screenshot({ path: `${out}/f${String(i++).padStart(2, '0')}.png` }); await page.waitForTimeout(900); if (Date.now() - t0 > 40000) break; }
  console.log('frames', i, 'seconds', ((Date.now() - t0) / 1000).toFixed(1), 'errors', errs);
  await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/after.png` });
  await b.close();
})();
