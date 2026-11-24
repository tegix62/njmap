// Waves: a fresh start shows only the first wave (and a card saying what opens next); once every first-wave tree is met and answered right
// twice, the next wave opens with a celebration screen, and its trees join the hub, the guide, questions and Leaf rain. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/waves'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(400);
  console.log('fresh:', await page.locator('.tr-stats').innerText(), '|', (await page.locator('.tn-wave').innerText()).replace(/\n/g, ' | '));
  await page.locator('.tn-wave').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/0-fresh.png` });
  await page.click('[data-t=guide]'); console.log('guide trees:', await page.locator('.tr-li').count(), '| box elder in guide:', await page.locator('.tr-li[data-id=box-elder]').count());
  // nearly done: all 24 met, all but one answered right twice
  const w1 = await page.evaluate(async () => (await (await fetch('data/trees.json')).json()).trees.filter((t) => !t.wave || t.wave === 1).map((t) => t.id));
  await page.evaluate((ids) => { localStorage.setItem('njtf.trees.met', JSON.stringify(ids)); localStorage.setItem('njtf.trees.stats', JSON.stringify(Object.fromEntries(ids.map((id, i) => [id, i === 0 ? [3, 1] : [3, 2]])))); }, w1);
  await page.click('[data-t=hub]'); await page.waitForTimeout(300);
  console.log('nearly:', (await page.locator('.tn-wave').innerText()).replace(/\n/g, ' | '));
  await page.evaluate((id) => { const s = JSON.parse(localStorage.getItem('njtf.trees.stats')); s[id] = [4, 2]; localStorage.setItem('njtf.trees.stats', JSON.stringify(s)); }, w1[0]);
  await page.click('[data-t=guide]'); await page.click('[data-t=hub]'); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/1-opened.png` });
  console.log('opened:', (await page.locator('.tn-wavenew').innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await page.click('.tn-wavenew [data-t=hub]'); await page.waitForTimeout(300);
  console.log('after:', await page.locator('.tr-stats').innerText(), '|', await page.locator('.tr-today small').innerText());
  await page.click('[data-t=guide]'); console.log('guide trees:', await page.locator('.tr-li').count());
  await page.click('.tr-li[data-id=hackberry]'); await page.waitForTimeout(600); await page.screenshot({ path: `${out}/2-hackberry.png`, fullPage: true });
  console.log('hackberry page bark photos:', await page.locator('.tn-barkph').count());
  while (!(await page.locator('[data-t=today]').count())) { await page.locator('.tr-back').first().click(); await page.waitForTimeout(250); } await page.click('[data-t=today]'); await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/3-today.png` }); console.log('today first screen:', (await page.locator('.tr-body h2').innerText().catch(() => '')));
  console.log('errors', errs.length); await b.close(); })();
