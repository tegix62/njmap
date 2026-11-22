// Watch it grow, beat by beat: a tree page's "Watch it grow", each beat (seed, sprout, sapling, growing up, a year in its prime, old age,
// death), next and back, the "Any year" slider, and leaving. Software WebGL. Frames in $OUT. Run with a tree id (default red-maple).
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/grow'; fs.mkdirSync(out, { recursive: true }); const id = process.argv[2] || 'red-maple';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to (load resource|fetch)|AJAXError/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 300)); } });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(500);
  await page.click('[data-t=guide]'); await page.click(`.tr-li[data-id=${id}]`); await page.waitForTimeout(2000);
  await page.locator('.gr-card').scrollIntoViewIfNeeded(); await page.click('.gr-card'); await page.waitForTimeout(3500);
  const n = await page.locator('.gr-beat').count(); console.log('beats:', (await page.locator('.gr-beat').allInnerTexts()).join(' / '));
  for (let i = 0; i < n; i++) {
    await page.click(`.gr-beat >> nth=${i}`); await page.waitForTimeout(i === 0 ? 3000 : 3500);
    await page.screenshot({ path: `${out}/${id}-${i}.png` });
    console.log(i, (await page.locator('.gr-hud').innerText()).replace(/\n/g, ' | '), '||', (await page.locator('.gr-fact').innerText()).slice(0, 70));
  }
  await page.click('[data-t=grnext]'); await page.click('[data-t=grprev]'); await page.waitForTimeout(500);
  await page.click('.gr-any summary'); await page.locator('.gr-slider').evaluate((el) => { el.value = 45.6; el.dispatchEvent(new Event('input')); }); await page.waitForTimeout(1200);
  console.log('any year:', (await page.locator('.gr-hud').innerText()).replace(/\n/g, ' | '));
  await page.click('.tr-back'); await page.waitForTimeout(600); console.log('back on tree page:', await page.locator('.tr-body h2').innerText());
  console.log('errors', errs.length); await b.close(); })();
