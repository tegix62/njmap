// Game feel: answers in Practise (a leaf burst and a climbing streak on right answers, a shake on wrong ones), the mute switch, and a round
// of Leaf rain (tapping target leaves, then three wrong ones to end it). Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/juice'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.evaluate(() => localStorage.setItem('njtf.trees.met', JSON.stringify(['red-oak', 'white-oak', 'pin-oak', 'sugar-maple', 'red-maple', 'sweetgum', 'sycamore', 'tulip-tree'])));
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(500);
  await page.click('[data-t=mute]'); console.log('mute:', await page.locator('.jc-mute').innerText()); await page.click('[data-t=mute]');
  await page.click('[data-t=practise]'); await page.waitForTimeout(300);
  let rights = 0, bursts = 0;
  for (let i = 0; i < 14; i++) {
    const btns = page.locator('[data-t=ans]'); const n = await btns.count(); let hit = false;
    for (let k = 0; k < n && !hit; k++) { await btns.nth(k).click(); await page.waitForTimeout(60); hit = await btns.nth(k).evaluate((e) => e.classList.contains('right')); if (!hit) break; }
    if (hit) { rights++; bursts = Math.max(bursts, await page.locator('.jc-leaf').count()); if (rights === 1) await page.screenshot({ path: `${out}/0-burst.png` }); }
    await page.waitForTimeout(300); await page.click('[data-t=next]'); await page.waitForTimeout(200);
  }
  console.log('practise: right', rights, '| most leaves in a burst', bursts, '| combo chip seen:', await page.locator('.jc-combo').count() >= 0);
  await page.click('[data-t=hub]'); await page.click('[data-t=rain]'); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/1-rain.png` });
  const t0 = Date.now(); let tapped = 0;
  while (Date.now() - t0 < 12000) {
    tapped += await page.evaluate(() => { const src = document.querySelector('.lr-target img').src; let n = 0; for (const el of document.querySelectorAll('.lr-leaf')) if (el.src === src) { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); n++; } return n; });
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `${out}/2-rain-later.png` });
  console.log('rain: tapped', tapped, '| score', await page.locator('.lr-score').innerText(), '| target', await page.locator('.lr-target b').innerText());
  for (let i = 0; i < 40 && !(await page.locator('.tr-done').count()); i++) {
    await page.evaluate(() => { const src = document.querySelector('.lr-target img')?.src; const el = [...document.querySelectorAll('.lr-leaf')].find((x) => x.src !== src); if (el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(800); await page.screenshot({ path: `${out}/3-rain-end.png` });
  console.log('end:', (await page.locator('.tr-done').innerText()).replace(/\n/g, ' | ').slice(0, 200));
  console.log('errors', errs.length); await b.close(); })();
