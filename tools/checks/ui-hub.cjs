// The Play hub: screenshot in the default look, change the area, start a map game from a card. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry]:not([data-entry=goblin])'); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/hub.png` });
  await page.selectOption('#hubArea', 'focus:ne'); await page.waitForTimeout(500);
  console.log('area now:', await page.locator('#hubArea').inputValue(), '| stats:', (await page.locator('.hub-stats').innerText()).replace(/\n/g, ' '));
  await page.locator('#sheet').evaluate((e) => (e.scrollTop = e.scrollHeight)); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/hub-scrolled.png` });
  await page.click('.hub-card[data-go=mountains]'); await page.waitForTimeout(5000);
  console.log('after card:', (await page.locator('#hud').innerText()).replace(/\n/g, ' ').slice(0, 120), '| hubsheet class left:', await page.locator('#sheet.hubsheet').count());
  await page.click('#tabs [data-mode=practice]').catch(() => {}); await page.click('#tabs [data-mode=explore]'); await page.waitForTimeout(800); await page.click('#tabs [data-mode=practice]'); await page.waitForTimeout(1200);
  console.log('back on hub:', await page.locator('.hub-today').count(), 'errors', errs.length); await b.close(); })();
