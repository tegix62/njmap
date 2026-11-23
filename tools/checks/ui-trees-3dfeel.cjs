// 3D game feel: in Watch it grow, leaves flutter down in fall and lie on the ground into winter; the leaves sway. Software WebGL.
// Frames in $OUT. Run with a tree id (default red-maple).
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/3dfeel'; fs.mkdirSync(out, { recursive: true }); const id = process.argv[2] || 'red-maple';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to (load resource|fetch)|AJAXError/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 300)); } });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(500);
  await page.click('[data-t=guide]'); await page.click(`.tr-li[data-id=${id}]`); await page.waitForTimeout(2000);
  await page.locator('.gr-card').scrollIntoViewIfNeeded(); await page.click('.gr-card'); await page.waitForTimeout(3000);
  await page.click('.gr-any summary');
  const at = async (age, name, wait) => { await page.locator('.gr-slider').evaluate((el, a) => { el.value = a; el.dispatchEvent(new Event('input')); }, age); await page.waitForTimeout(wait);
    await page.locator('.gr-stage').screenshot({ path: `${out}/${id}-${name}.png` }); console.log(name, (await page.locator('.gr-hud').innerText()).replace(/\n/g, ' | ')); };
  await at(40.8, 'fall-early', 2500); await at(40.84, 'fall-late', 5000); await at(40.95, 'winter', 1500);
  console.log('errors', errs.length); await b.close(); })();
