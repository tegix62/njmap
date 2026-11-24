// Wave 3: with waves 1 and 2 open and every tree in them known, Trees opens "Into the woods" with its trees, and they join the guide. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/waves'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  const ids = await page.evaluate(async () => (await (await fetch('data/trees.json')).json()).trees.filter((t) => (t.wave || 1) <= 2).map((t) => t.id));
  await page.evaluate((ids) => { localStorage.setItem('njtf.trees.met', JSON.stringify(ids)); localStorage.setItem('njtf.trees.stats', JSON.stringify(Object.fromEntries(ids.map((id) => [id, [3, 2]])))); localStorage.setItem('njtf.trees.waves', '[1,2]'); }, ids);
  await page.click('[data-entry=trees]'); await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/4-wave3.png` });
  console.log('known before:', ids.length, '| screen:', (await page.locator('.tn-wavenew').innerText().catch(() => 'not shown')).replace(/\n/g, ' | ').slice(0, 300));
  await page.click('.tn-wavenew [data-t=hub]'); await page.waitForTimeout(300);
  console.log('hub:', (await page.locator('.tr-stats').innerText()).replace(/\n/g, ' '), '|', (await page.locator('.tn-wave').innerText()).replace(/\n/g, ' | '), '|', await page.locator('.tr-today small').innerText());
  await page.click('[data-t=guide]'); console.log('guide trees:', await page.locator('.tr-li').count());
  await page.click('.tr-li[data-id=black-birch]'); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/5-black-birch.png`, fullPage: true });
  console.log('black birch page:', (await page.locator('.tr-body h2').innerText()), '| bark photos:', await page.locator('.tn-barkph').count());
  console.log('errors', errs.length); await b.close(); })();
