// Cross-mode smoke test: both regions, every tab, the hub, one question answered, Settings opened; reports page errors.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); let bad = 0;
  for (const region of ['nj', 'manhattan']) {
    const page = await b.newPage({ viewport: { width: 390, height: 780 } });
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://localhost:8077/index.html?debug=1&region=${region}`); await page.waitForSelector('#welcome [data-entry]');
    await page.click('[data-entry=nj]'); await page.waitForTimeout(2500);
    const hub = await page.locator('.hub-today').count();
    await page.evaluate(() => window.njtf.modes.practice.choose('name')); await page.waitForTimeout(1600);
    const choices = await page.locator('#qbody .choice').count();
    if (choices) await page.locator('#qbody .choice').first().click(); await page.waitForTimeout(700);
    const fb = await page.locator('#qbody .fb').count(), back = await page.locator('#qType .gb-back').count();
    await page.click('#qType'); await page.waitForTimeout(700); const hub2 = await page.locator('.hub-today').count();
    for (const m of ['drive', 'explore', 'progress', 'practice']) { await page.click(`#tabs [data-mode=${m}]`); await page.waitForTimeout(900); }
    await page.click('#settingsBtn'); await page.waitForTimeout(400); const set = await page.locator('#settings[open]').count();
    console.log(region, { hub, choices, fb, back, hub2, settings: set, errors: errs });
    if (!hub || !choices || !fb || !back || !hub2 || !set || errs.length) bad++;
    await page.close();
  }
  console.log(bad ? 'FAILED' : 'ok'); await b.close(); })();
