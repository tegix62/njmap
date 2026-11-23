// Bark and seasons: a tree page's Bark and Through the year sections (Norway maple), the bark lesson and its practice, a Bark only round,
// and "the same kind of tree in winter" questions in Practise. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/bark'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.evaluate(() => localStorage.setItem('njtf.trees.met', JSON.stringify(['norway-maple', 'sugar-maple', 'red-maple', 'white-oak', 'red-oak', 'black-cherry', 'beech', 'sweetgum'])));
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(500);
  await page.click('[data-t=guide]'); await page.click('.tr-li[data-id=norway-maple]'); await page.waitForTimeout(800);
  await page.locator('.tn-bark').scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/0-norway.png` });
  console.log('norway page:', (await page.locator('.tn-line').innerText()).slice(0, 90), '|', (await page.locator('.tn-year').innerText()).replace(/\n/g, ' / ').slice(0, 160));
  await page.click('[data-t=hub]'); await page.locator('.tn-skill[data-sk=bark]').scrollIntoViewIfNeeded(); await page.click('.tn-skill[data-sk=bark]'); await page.waitForTimeout(300);
  let k = 0; while (await page.locator('[data-t=lstep]:not(.sk-prev)').count()) { if (k < 3) await page.screenshot({ path: `${out}/1-lesson-${k}.png` }); k++; await page.locator('[data-t=lstep]:not(.sk-prev)').click(); await page.waitForTimeout(150); }
  console.log('bark lesson panels:', k + 1);
  await page.click('[data-t=drillrun]'); await page.waitForTimeout(300);
  for (let i = 0; i < 6; i++) { if (i < 2) await page.screenshot({ path: `${out}/2-drill-${i}.png` }); await page.locator('[data-t=ans]').first().click(); await page.waitForTimeout(150); await page.click('[data-t=next]'); await page.waitForTimeout(150); }
  console.log('drill:', (await page.locator('.tr-done .tr-res b').innerText().catch(() => '?')));
  await page.click('.tr-done [data-t=hub]'); await page.click('[data-t=barkonly]'); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/3-barkonly.png` });
  for (let i = 0; i < 15; i++) { await page.locator('[data-t=qans]').first().click(); await page.waitForTimeout(1400); if (await page.locator('.tr-done').count()) break; }
  console.log('bark only:', (await page.locator('.tr-done').innerText()).replace(/\n/g, ' | ').slice(0, 220)); await page.screenshot({ path: `${out}/4-barkonly-end.png` });
  await page.click('.tr-done [data-t=hub]'); let seen = { bark: 0, season2: 0 };
  await page.click('[data-t=practise]'); await page.waitForTimeout(300);
  for (let i = 0; i < 40 && (seen.bark < 1 || seen.season2 < 1); i++) {
    const ask = await page.locator('.tr-ask').innerText().catch(() => '');
    const kind = /Whose bark/.test(ask) ? 'bark' : /in winter\?/.test(ask) ? 'season2' : '';
    if (kind && !seen[kind]) { await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/5-${kind}.png` }); }
    if (kind) seen[kind]++;
    await page.locator('[data-t=ans]').first().click(); await page.waitForTimeout(200);
    if (kind === 'season2' && seen.season2 === 1) await page.screenshot({ path: `${out}/5-season2-answered.png` });
    await page.click('[data-t=next]'); await page.waitForTimeout(200);
  }
  console.log('practise saw:', JSON.stringify(seen));
  console.log('errors', errs.length); await b.close(); })();
