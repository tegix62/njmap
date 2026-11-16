// Screens of the normal mode for a look-over: hub, Progress, Map, Drive, Settings. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  // some review history, so Progress has something to show
  await page.addInitScript(() => { if (localStorage.getItem('njtf.srs')) return; const now = Date.now(); const s = {}, st = {};
    const names = ['Newark City|Essex', 'Jersey City|Hudson', 'Paterson City|Passaic', 'Hackensack City|Bergen', 'Hoboken City|Hudson', 'Fort Lee Borough|Bergen', 'Paramus Borough|Bergen', 'Wayne Township|Passaic', 'Montclair Township|Essex', 'Elizabeth City|Union', 'Clifton City|Passaic', 'Teaneck Township|Bergen'];
    names.forEach((k, i) => { s[k] = { b: i % 5, due: now + (i % 3 ? 1 : -1) * 864e5 }; st[k] = [4 + i, 2 + (i % 4)]; });
    localStorage.setItem('njtf.srs', JSON.stringify(s)); localStorage.setItem('njtf.stats', JSON.stringify(st)); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.screenshot({ path: `${out}/home.png` });
  await page.click('[data-entry]:not([data-entry=goblin])'); await page.waitForTimeout(2200);
  for (const m of ['progress', 'explore', 'drive']) { await page.click(`#tabs [data-mode=${m}]`); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/${m}.png` }); }
  await page.click('#settingsBtn'); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/settings.png` });
  console.log('errors', errs.length); await b.close(); })();
