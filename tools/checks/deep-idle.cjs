// Deep Jersey at rest: open a story step, let it arrive and play, then count how many frames the map draws in 20 s of just
// reading, and how many elevation tiles were processed. Lower is better for battery. Run: node tools/checks/deep-idle.cjs
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry=deep]');
  await page.click('[data-entry=deep]'); await page.waitForSelector('#deep .dp-hook'); await page.waitForTimeout(2000);
  await page.evaluate(() => { const x = document.createElement('button'); x.dataset.d = 'story'; x.dataset.id = 's-mountains'; document.getElementById('deep').appendChild(x); x.click(); });
  await page.waitForTimeout(1500); if (await page.locator('#deepex').isVisible()) await page.click('#deepex');
  await page.waitForTimeout(15000);   // arrive, rise, settle
  const r = await page.evaluate(() => new Promise((res) => { const m = window.njtf.map; let n = 0; const f = () => n++; m.on('render', f); setTimeout(() => { m.off('render', f); res({ frames: n, ratio: m.getPixelRatio(), dem: window.__deepDemProcessed || 0, asked: window.__deepDemAsked || 0 }); }, 20000); }));
  console.log(`idle frames in 20 s: ${r.frames} | pixel ratio: ${r.ratio} | elevation tiles processed: ${r.dem} (asked for ${r.asked}) | errors ${errs.length}`);
  await b.close(); })();
