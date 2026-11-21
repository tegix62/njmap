// Trees in 3D: a tree page with its 3D model and season buttons, and a round of Name that tree. Uses software WebGL. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/t3d'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to (load resource|fetch)|AJAXError/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 200)); } });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(500);
  await page.click('[data-t=guide]'); await page.click('.tr-li[data-id=pin-oak]'); await page.waitForTimeout(3500);
  await page.locator('.t3-stage').scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/0-card.png` });
  for (const sname of ['winter', 'fall']) { await page.click(`[data-t=t3season][data-s=${sname}]`); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/1-${sname}.png` }); }
  console.log('canvases on page:', await page.locator('.t3-stage canvas').count());
  await page.click('[data-t=hub]'); await page.click('[data-t=name3d]'); await page.waitForTimeout(3500); await page.screenshot({ path: `${out}/2-name.png` });
  let right = 0;
  for (let i = 0; i < 8; i++) { await page.locator('[data-t=n3ans]').first().click(); await page.waitForTimeout(300); if (i === 0) await page.screenshot({ path: `${out}/3-answered.png` }); await page.click('[data-t=n3next]'); await page.waitForTimeout(2500); }
  console.log('end:', (await page.locator('.tr-done').innerText()).replace(/\n/g, ' | ').slice(0, 120));
  await page.click('.tr-done [data-t=hub]'); await page.waitForTimeout(300); console.log('canvases left after leaving:', await page.locator('canvas').count() - 1);
  console.log('errors', errs.length); await b.close(); })();
