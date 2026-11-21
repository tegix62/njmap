// The home page: New Jersey, New York City and Trees of New Jersey each open the right map, and Home inside the app switches between them.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/home'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1'); await page.waitForSelector('#welcome [data-entry]'); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/0-home.png` });
  console.log('entries:', (await page.locator('#welcome .wt').allInnerTexts()).join(' / '));
  await page.click('[data-entry=nyc]'); await page.waitForFunction(() => window.njtf && document.body.classList.contains('ready'), null, { timeout: 30000 });
  await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/1-nyc.png` });
  console.log('after New York City:', await page.evaluate(() => window.njtf.region.id), '|', await page.title());
  await page.evaluate(() => { window.njtf.showHome(); }); await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=nj]');
  await page.waitForFunction(() => window.njtf && window.njtf.region && window.njtf.region.id === 'nj' && document.body.classList.contains('ready'), null, { timeout: 30000 }).catch(() => {});
  console.log('after New Jersey:', await page.evaluate(() => window.njtf && window.njtf.region.id), '|', await page.title());
  await page.evaluate(() => { window.njtf.showHome(); }); await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=trees]'); await page.waitForTimeout(1500);
  console.log('after Trees:', await page.locator('#trees:not([hidden]) .tr-today').count(), await page.evaluate(() => window.njtf.region.id));
  console.log('errors', errs.length); await b.close(); })();
