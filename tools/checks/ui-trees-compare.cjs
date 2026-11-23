// After a wrong answer: the right tree stays the big picture, and the one you picked can be opened to compare (Bark only waits for Next
// instead of moving on; Practise shows it under the result). Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/compare'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.evaluate(() => localStorage.setItem('njtf.trees.met', JSON.stringify(['red-oak', 'white-oak', 'pin-oak', 'sugar-maple', 'red-maple', 'norway-maple', 'sweetgum', 'sycamore', 'tulip-tree', 'black-cherry'])));
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(500);
  // Bark only: answer until one is wrong
  await page.click('[data-t=barkonly]'); await page.waitForTimeout(400);
  for (let i = 0; i < 15 && !(await page.locator('.tr-cmp').count()); i++) {
    const bt = page.locator('[data-t=qans]').first(); await bt.click(); await page.waitForTimeout(300);
    if (await bt.evaluate((e) => e.classList.contains('right'))) await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600); await page.screenshot({ path: `${out}/0-bark-wrong.png`, fullPage: true });
  console.log('bark only:', (await page.locator('.tr-fb').innerText()).replace(/\n/g, ' | ').slice(0, 220));
  await page.click('.tr-cmp summary'); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/1-bark-open.png`, fullPage: true });
  const before = await page.locator('.tr-prog i.d').count(); await page.click('[data-t=qnext]'); await page.waitForTimeout(400);
  console.log('next moved on:', (await page.locator('.tr-prog i.d').count()) === before + 1, '| fb gone:', !(await page.locator('.tr-cmp').count()));
  // Practise: answer wrong until a comparison shows, a few times
  await page.click('[data-t=hub]'); await page.click('[data-t=practise]'); await page.waitForTimeout(300);
  let shots = 0; const kinds = {};
  for (let i = 0; i < 30 && shots < 3; i++) {
    const btns = page.locator('[data-t=ans]'); const n = await btns.count(); if (!n) { await page.click('[data-t=next]').catch(() => {}); continue; }
    await btns.nth(n - 1).click(); await page.waitForTimeout(250);
    if (await page.locator('.tr-cmp').count()) {
      const ask = await page.locator('.tr-ask').innerText(); kinds[ask.slice(0, 30)] = 1;
      await page.click('.tr-cmp summary'); await page.waitForTimeout(700);
      await page.screenshot({ path: `${out}/2-practise-${shots}.png`, fullPage: true }); shots++;
      console.log('practise:', ask.slice(0, 40), '||', (await page.locator('.tr-pair').innerText()).replace(/\n/g, ' | ').slice(0, 160));
    }
    await page.click('[data-t=next]'); await page.waitForTimeout(200);
  }
  console.log('errors', errs.length); await b.close(); })();
