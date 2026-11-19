// Trees, learning to look (optional lessons): each lesson and its practice from the trees home screen, the key's "How to check" and
// "Show me", and a tree page's fact links to the lessons. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/learn'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(600);
  for (const sk of ['look', 'winter', 'pairs', 'leaflets', 'lobes']) {
    await page.locator(`.tn-skill[data-sk=${sk}]`).scrollIntoViewIfNeeded(); await page.click(`.tn-skill[data-sk=${sk}]`); await page.waitForTimeout(250); let k = 0;
    while (await page.locator('[data-t=lstep]:not(.sk-prev)').count()) { await page.screenshot({ path: `${out}/4-${sk}-${k++}.png` }); await page.locator('[data-t=lstep]:not(.sk-prev)').click(); await page.waitForTimeout(150); }
    await page.screenshot({ path: `${out}/4-${sk}-${k}.png` });
    await page.click('[data-t=drillrun]'); await page.waitForTimeout(250); const asks = [];
    for (let i = 0; i < 6; i++) { asks.push((await page.locator('.tr-ask').innerText()).slice(0, 50)); await page.screenshot({ path: `${out}/5-${sk}-q${i}.png` }); await page.locator('[data-t=ans]').nth(i % 2).click(); await page.waitForTimeout(150); await page.click('[data-t=next]'); await page.waitForTimeout(150); }
    console.log(sk, 'asks:', [...new Set(asks)].join(' / '), '| result:', (await page.locator('.tr-done .tr-res b').innerText().catch(() => '?')));
    await page.click('.tr-done [data-t=hub]'); await page.waitForTimeout(250);
  }
  await page.click('[data-t=identify]'); await page.waitForTimeout(250); await page.screenshot({ path: `${out}/7-key.png` });
  await page.locator('[data-t=keypick]').nth(2).click(); await page.locator('[data-t=keypick]').nth(1).click(); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/7-key-arr.png` });
  await page.click('.sk-link'); await page.waitForTimeout(250); console.log('show me opens:', await page.locator('.tr-body h2').innerText());
  await page.click('[data-t=hub]'); await page.click('[data-t=guide]'); await page.waitForTimeout(250); await page.locator('.tr-li').nth(7).click(); await page.waitForTimeout(400);
  await page.locator('.tr-facts').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/8-card-facts.png` });
  await page.locator('.tn-fact').first().click(); await page.waitForTimeout(250); console.log('fact link opens:', await page.locator('.tr-body h2').innerText());
  console.log('errors', errs.length); await b.close(); })();
