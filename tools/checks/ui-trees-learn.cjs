// Trees, learning to look: a first visit (the path on the hub, Today opens with the first lesson, every panel, its practice, the result),
// then each lesson and practice from the hub, then the gate (a group only after its skill), the key's "How to check" and a card's twig. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/learn'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/0-hub.png`, fullPage: false });
  console.log('path:', (await page.locator('.sk-step').allInnerTexts()).map((t) => t.replace(/\n/g, ' ')).join(' / '));
  console.log('today says:', (await page.locator('.tr-today').innerText()).replace(/\n/g, ' | '));
  await page.click('[data-t=today]'); await page.waitForTimeout(400);
  let n = 0; while (await page.locator('[data-t=lstep]:not(.sk-prev)').count()) { await page.screenshot({ path: `${out}/1-look-${n++}.png` }); await page.locator('[data-t=lstep]:not(.sk-prev)').click(); await page.waitForTimeout(200); }
  await page.screenshot({ path: `${out}/1-look-${n}.png` }); await page.click('[data-t=next]'); await page.waitForTimeout(300);
  for (let i = 0; i < 30; i++) {
    if (await page.locator('.tr-done').count()) break;
    const ask = await page.locator('.tr-ask').innerText(); if (i < 6) await page.screenshot({ path: `${out}/2-drill-${i}.png` });
    await page.locator('[data-t=ans]').first().click(); await page.waitForTimeout(200);
    if (i < 3) await page.screenshot({ path: `${out}/2-drill-${i}-ans.png` });
    await page.click('[data-t=next]'); await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `${out}/3-done.png` }); console.log('done:', (await page.locator('.tr-done').innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await page.click('.tr-done [data-t=hub]'); await page.waitForTimeout(300);
  // every lesson and practice, from the hub
  for (const sk of ['winter', 'pairs', 'leaflets', 'lobes']) {
    await page.click(`.sk-step[data-sk=${sk}]`); await page.waitForTimeout(250); let k = 0;
    while (await page.locator('[data-t=lstep]:not(.sk-prev)').count()) { await page.screenshot({ path: `${out}/4-${sk}-${k++}.png` }); await page.locator('[data-t=lstep]:not(.sk-prev)').click(); await page.waitForTimeout(150); }
    await page.screenshot({ path: `${out}/4-${sk}-${k}.png` });
    await page.click('[data-t=drillrun]'); await page.waitForTimeout(250); const asks = [];
    for (let i = 0; i < 6; i++) { asks.push((await page.locator('.tr-ask').innerText()).slice(0, 50)); await page.screenshot({ path: `${out}/5-${sk}-q${i}.png` }); await page.locator('[data-t=ans]').nth(i % 2).click(); await page.waitForTimeout(150); await page.click('[data-t=next]'); await page.waitForTimeout(150); }
    console.log(sk, 'asks:', [...new Set(asks)].join(' / '), '| result:', (await page.locator('.tr-done .tr-res b').innerText().catch(() => '?')));
    await page.click('.tr-done [data-t=hub]'); await page.waitForTimeout(250);
  }
  // pass every skill: the groups open in order
  await page.evaluate(() => { const v = {}; for (const s of ['look', 'winter', 'pairs', 'leaflets', 'lobes']) v[s] = { done: true, best: 6 }; localStorage.setItem(Object.keys(localStorage).find((k) => k.endsWith('trees.met'))?.replace('trees.met', 'trees.skills') || 'njtf.trees.skills', JSON.stringify(v)); });
  await page.click('[data-t=home]'); await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=trees]'); await page.waitForTimeout(600);
  console.log('today after skills:', (await page.locator('.tr-today').innerText()).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${out}/6-hub-skills.png` });
  await page.click('[data-t=identify]'); await page.waitForTimeout(250); await page.screenshot({ path: `${out}/7-key.png` });
  await page.locator('[data-t=keypick]').nth(2).click(); await page.locator('[data-t=keypick]').nth(1).click(); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/7-key-arr.png` });
  await page.click('.sk-link'); await page.waitForTimeout(250); await page.screenshot({ path: `${out}/7-key-showme.png` });
  await page.click('[data-t=hub]'); await page.click('[data-t=guide]'); await page.waitForTimeout(250); await page.locator('.tr-li').nth(7).click(); await page.waitForTimeout(400);
  await page.locator('.tr-facts').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/8-card-twig.png` });
  console.log('errors', errs.length); await b.close(); })();
