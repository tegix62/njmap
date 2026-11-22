// Watch it grow: a tree page's "Watch it grow", playing, jumping to milestones, the slider, the speeds, and leaving. Software WebGL. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/grow'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to (load resource|fetch)|AJAXError/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 300)); } });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(500);
  await page.click('[data-t=guide]'); await page.click('.tr-li[data-id=red-maple]'); await page.waitForTimeout(2500);
  await page.locator('.gr-card').scrollIntoViewIfNeeded(); await page.click('.gr-card'); await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/0-start.png` }); console.log('after 4 s:', await page.locator('.gr-hud').innerText());
  await page.click('.gr-fi >> nth=1'); await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/1-milestone.png` });
  console.log('milestone:', (await page.locator('.gr-hud').innerText()).replace(/\n/g, ' | '), '|', await page.locator('.gr-fact').innerText().catch(() => ''));
  await page.click('[data-t=grplay]');
  for (const a of [30.5, 60.78, 100.1, 115, 121]) { await page.locator('.gr-slider').evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, a); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/2-y${Math.round(a)}.png` }); console.log('year', a, ':', (await page.locator('.gr-hud').innerText()).replace(/\n/g, ' | ')); }
  await page.click('.gr-speed >> nth=2'); await page.click('[data-t=grplay]'); await page.waitForTimeout(1500);
  await page.click('.tr-back'); await page.waitForTimeout(800); console.log('back on tree page:', await page.locator('.tr-body h2').innerText());
  console.log('errors', errs.length); await b.close(); })();
