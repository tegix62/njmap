// Fall leaves: a tree page shows its leaf through the year (summer and fall traces), leaf questions sometimes show a fall leaf (with its
// caption), and Leaf rain mixes fall leaves in. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/fallleaf'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.evaluate(() => localStorage.setItem('njtf.trees.met', JSON.stringify(['red-oak', 'white-oak', 'pin-oak', 'sugar-maple', 'red-maple', 'norway-maple', 'sassafras', 'gray-birch', 'sweetgum', 'tulip-tree'])));
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(400);
  await page.click('[data-t=guide]'); await page.click('.tr-li[data-id=red-oak]'); await page.waitForTimeout(800);
  await page.locator('.tn-leafyr').scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/0-page.png` });
  console.log('page leaves:', await page.locator('.tn-leafyr figure').count(), '|', (await page.locator('.tr-src').first().innerText()).slice(0, 140));
  await page.click('[data-t=hub]'); await page.click('[data-t=practise]'); await page.waitForTimeout(300);
  let fallSeen = 0, leafQ = 0;
  for (let i = 0; i < 60 && fallSeen < 2; i++) {
    const imgs = await page.locator('.tr-body svg.leafsvg image').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    if (imgs.length) leafQ++;
    if (imgs.some((h) => /-fall/.test(h))) { fallSeen++; await page.screenshot({ path: `${out}/1-q-${fallSeen}.png` }); }
    await page.locator('[data-t=ans]').first().click(); await page.waitForTimeout(150); await page.click('[data-t=next]'); await page.waitForTimeout(120);
  }
  console.log('leaf questions:', leafQ, '| with a fall leaf:', fallSeen);
  await page.click('[data-t=hub]'); await page.click('[data-t=rain]'); await page.waitForTimeout(6000);
  const srcs = await page.locator('.lr-leaf').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
  await page.screenshot({ path: `${out}/2-rain.png` });
  console.log('rain leaves:', srcs.length, '| fall:', srcs.filter((s) => /-fall/.test(s)).length);
  console.log('errors', errs.length); await b.close(); })();
