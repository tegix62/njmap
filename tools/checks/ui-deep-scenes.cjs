// Deep Jersey directed scenes: play "Three rivers make the Pompton" step by step; record captions (in-page), the pop-out lifting and
// dropping back, the river traces, the marks; then leave and check everything is cleared. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/deep-scenes'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 390, height: 664 } })).newPage();
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry=deep]');
  await page.click('[data-entry=deep]'); await page.waitForSelector('#deep .dp-hook'); await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__caps = []; window.__pop = []; const m = window.njtf.map;
    setInterval(() => { const c = document.getElementById('deepcap'); if (c && !c.hidden && c.textContent && window.__caps[window.__caps.length - 1] !== c.textContent) window.__caps.push(c.textContent);
      if (m.getLayer('deep-pop-mask')) window.__pop.push(m.getPaintProperty('deep-pop-mask', 'fill-opacity')); }, 150); });
  const open = async (id) => { await page.evaluate((x) => { const e = document.createElement('button'); e.dataset.d = 'story'; e.dataset.id = x; document.getElementById('deep').appendChild(e); e.click(); }, id); };
  await open('pompton-rivers'); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/rivers-1a.png` });
  await page.waitForTimeout(5000); await page.screenshot({ path: `${out}/rivers-1b.png` }); await page.waitForTimeout(6000); await page.screenshot({ path: `${out}/rivers-1c.png` });
  const s1 = await page.evaluate(() => ({ traces: window.njtf.map.getStyle().layers.filter((l) => l.id.startsWith('deep-trace-')).length, popUp: window.__pop.some((v) => v > 0.5), popDown: window.__pop[window.__pop.length - 1] === 0 }));
  console.log('step 1:', JSON.stringify(s1), '| step label:', await page.locator('#deepbar .dp-when').innerText());
  await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(9000); await page.screenshot({ path: `${out}/rivers-2.png` });
  console.log('step 2: marks', await page.locator('#deeppins .dp-mark').count(), '| traces', await page.evaluate(() => window.njtf.map.getStyle().layers.filter((l) => l.id.startsWith('deep-trace-')).length));
  await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(5000); await page.screenshot({ path: `${out}/rivers-3.png` });
  console.log('read next:', (await page.locator('#deep .dp-next button').allInnerTexts()).map((t) => t.split('\n')[0]).join(' | '));
  console.log('captions:', (await page.evaluate(() => window.__caps)).map((c) => c.slice(0, 45)).join(' / '));
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(800);
  console.log('after leaving: traces', await page.evaluate(() => window.njtf.map.getStyle().layers.filter((l) => l.id.startsWith('deep-trace-')).length), '| mask', await page.evaluate(() => window.njtf.map.getPaintProperty('deep-pop-mask', 'fill-opacity')), '| caption shown', await page.evaluate(() => { const c = document.getElementById('deepcap'); return !!c && !c.hidden; }));
  // the lakes story: lakes appear one by one
  await open('still-a-lake'); await page.waitForTimeout(1500); await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(10000); await page.screenshot({ path: `${out}/lakes-2.png` });
  console.log('lakes shown:', JSON.stringify(await page.evaluate(() => window.njtf.map.getFilter('deep-water-lake'))));
  console.log('errors', errs.length); await b.close(); })();
