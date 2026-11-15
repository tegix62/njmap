// Council check 2: the Move order takes the captain along, and the ink plate card draws. Frames to $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'council-frames'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]');
  await page.waitForSelector('#council .cn-say p'); await page.waitForTimeout(1000);
  const px = await page.evaluate(() => { const m = window.njtf.byKey.get('Paterson City|Passaic'); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }); await page.mouse.click(px[0], px[1]);
  const press = (label) => page.locator('.cn-cmd button', { hasText: label }).first().click();
  await page.waitForTimeout(900); await press('BEGIN'); await page.waitForTimeout(2600); await press('CONTINUE'); await page.waitForTimeout(1200);
  const capAt = () => page.evaluate(() => { const w = JSON.parse(localStorage.getItem('njtf.goblin.council')).world; const c = Object.values(w.chars).filter((x) => x.clan === 'goblins').sort((a, b) => a.id < b.id ? -1 : 1); return c.map((x) => x.at).join(' ; '); });
  const before = await capAt();
  await press('MOVE'); await page.waitForTimeout(600); await page.screenshot({ path: `${out}/move-pick.png` });
  await page.locator('.cn-cmd button').first().click(); await page.waitForTimeout(900);
  console.log('captains before:', before); console.log('captains after: ', await capAt()); console.log('said:', await page.locator('.cn-say p').getAttribute('data-full'));
  await page.screenshot({ path: `${out}/move-done.png` });
  page.evaluate(() => window.njtf.modes.goblin.debugPlate()); await page.waitForSelector('.cn-card.plate'); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/plate.png` });
  console.log('fab hidden:', await page.evaluate(() => getComputedStyle(document.querySelector('#lookFab')).display), 'errors', errs.length); await b.close(); })();
