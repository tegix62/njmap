// The new ranges in "Name that mountain": each named place comes up, shows its mass, takes hints and an answer. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry]:not([data-entry=goblin])'); await page.waitForTimeout(2500);
  const hub = await page.locator('#sheet .hub-chips').innerText(); console.log('hub chips:', hub.replace(/\n/g, ' | '));
  for (const name of (process.env.NAMES || 'Watchung Mountains,Catskill Mountains,Bear Mountain,Snake Hill,Blue Mountain').split(',')) {
    await page.evaluate((n) => window.njtf.orbit.start({ header: () => '<div class="score"></div>', bindHeader: () => {}, only: ['landmark'], names: [n], title: 'Name that landmark', icon: '🏛', rounds: 1 }), name);
    await page.waitForSelector('#sheet .choice, #qbody .choice', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(+process.env.WAIT || 6000); console.log('asked', name);
    const slug = name.replace(/\W+/g, '-').toLowerCase();
    await page.screenshot({ path: `${out}/${slug}-ask.png` }); console.log('   on screen at', JSON.stringify(await page.evaluate((n) => { const m = window.njtf.map; const ls = window.__lmPts || {}; return { zoom: m.getZoom().toFixed(2) }; }, name)));
    for (let i = 0; i < 3; i++) { const h = page.locator('button', { hasText: /hint/i }).first(); if (await h.count()) await h.click().catch(() => {}); await page.waitForTimeout(150); }
    const hints = (await page.locator('#hud').innerText()).replace(/\n/g, ' | ').slice(0, 330);
    const choices = await page.locator('.choice').allInnerTexts();
    const right = page.locator('.choice', { hasText: name }).first();
    if (await right.count()) await right.click(); await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/${slug}-answer.png` });
    console.log(`${name}: choices [${choices.join(', ')}] | ${hints}`);
    console.log('   after:', (await page.locator('#hud').innerText()).replace(/\n/g, ' | ').slice(0, 200));
  }
  console.log('errors', errs.length); await b.close(); })();
