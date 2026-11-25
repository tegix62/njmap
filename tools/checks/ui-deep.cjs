// Deep Jersey: the way in (explanation and three choices), the story chapter by chapter with the arrows (each region drawn whole past
// the state line), the land today (every region, shown whole), a close-up (stops with the arrows, a card, the chain, both games), the
// Pine Barrens close-up, and Home on top of it all. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/deep'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to (load resource|fetch)|AJAXError|net::/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 200)); } });
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const slug = (t) => t.replace(/\W+/g, '-').toLowerCase();
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry=deep]');
  await page.click('[data-entry=deep]'); await page.waitForSelector('#deep .dp-start'); await page.waitForTimeout(3000);
  console.log('intro:', (await page.locator('#deep .dp-lead').innerText()), '| bar hidden:', await page.locator('#deepbar').isHidden(), '| labels:', await page.locator('#deeppins .dp-rl').count());
  await shot('0-intro');
  // the story
  await page.click('#deep [data-d=story]'); await page.waitForTimeout(2600);
  const n = await page.locator('#deepbar .dp-dots button').count();
  for (let i = 0; i < n; i++) {
    if (i) { await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(i === 2 ? 4200 : 2600); }
    const t = await page.locator('#deepbar .dp-title').innerText();
    console.log(`chapter ${i + 1}: ${t} · ${await page.locator('#deep .dp-chips button').count()} close-ups · ${await page.locator('#deeppins button').count()} pins · ${await page.locator('#deeppins .dp-rl').count()} labels`);
    await shot(`story-${i + 1}-${slug(t)}`);
  }
  console.log('next disabled at the end:', await page.locator('#deepbar [data-b=next]').isDisabled());
  await page.locator('#deepbar .dp-dots button').nth(0).click(); await page.waitForTimeout(2200);
  await page.click('#deep .dp-region'); await page.waitForTimeout(2600);
  console.log('from the story to its region:', await page.locator('#deep h1').innerText()); await shot('story-region');
  await page.click('#deep [data-d=story]'); await page.waitForTimeout(1500);
  await page.locator('#deep .dp-chips button').first().click(); await page.waitForTimeout(1800);
  console.log('close-up card from the story:', await page.locator('#deep h2').innerText());
  await page.click('#deep [data-d=back]'); await page.waitForTimeout(1200); console.log('back to:', await page.locator('#deep h2').innerText());
  // how it works: from the ice chapter, every step, then back to the chapter
  await page.locator('#deepbar .dp-dots button').nth(4).click(); await page.waitForTimeout(2000);
  const hows = await page.locator('#deep .dp-how button').allInnerTexts(); console.log('how it works in chapter 5:', hows.join(' | '));
  await page.locator('#deep .dp-how button').first().click(); await page.waitForTimeout(900);
  for (let k = 0; k < 6; k++) { const t = await page.locator('#deep .dp-extext').innerText(); console.log(`  step ${k + 1}: ${t.slice(0, 70)}…`); await shot(`how-icesheet-${k + 1}`);
    if (await page.locator('#deep .dp-exnav [data-d=howstep].go').count()) { await page.click('#deep .dp-exnav [data-d=howstep].go'); await page.waitForTimeout(900); } else break; }
  await page.click('#deep .dp-exnav [data-d=howback]'); await page.waitForTimeout(400); console.log('after Got it:', await page.locator('#deep h2').innerText());
  // the land today
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(800); await page.click('#deep [data-d=land]'); await page.waitForTimeout(2000);
  console.log('regions:', await page.locator('#deep .dp-region').count()); await shot('land');
  for (const id of ['valleyridge', 'highlands', 'piedmont', 'coastal', 'plateau']) {
    await page.click(`#deep .dp-region[data-id=${id}]`); await page.waitForTimeout(2400);
    console.log(`region ${id}: ${await page.locator('#deep h1').innerText()} · zoom ${(await page.evaluate(() => window.__deepZoom || 0))}`); await shot(`land-${id}`);
    await page.click('#deep [data-d=land]'); await page.waitForTimeout(600);
  }
  // a close-up
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(600); await page.click('#deep [data-d=close][data-id=boonton]'); await page.waitForTimeout(2600);
  const sn = await page.locator('#deepbar .dp-dots button').count(); console.log('boonton stops:', sn);
  for (let i = 1; i < 4; i++) { await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(1800); console.log(`  stop ${i + 1}: ${await page.locator('#deepbar .dp-title').innerText()}`); }
  await shot('close-boonton');
  await page.click('#deep .dp-card'); await page.waitForTimeout(1800); console.log('card:', await page.locator('#deep h2').innerText());
  await page.click('#deep [data-d=back]'); await page.waitForTimeout(800);
  await page.click('#deep [data-d=chain]'); console.log('chain steps:', await page.locator('.dp-chain li').count()); await page.click('#deep [data-d=back]');
  await page.click('#deep [data-d=order]');
  const yr = Object.fromEntries(await page.evaluate(async () => { const m = await import('./js/deepcards.js'); return Object.values(m.CARD).map((c) => [c.title, c.year]); }));
  for (let k = 0; k < 5; k++) { const opts = await page.locator('.dp-pick button').allInnerTexts(); if (!opts.length) break; const oldest = opts.sort((a, c) => yr[a] - yr[c])[0]; await page.locator('.dp-pick button', { hasText: oldest }).first().click(); await page.waitForTimeout(200); }
  console.log('order:', (await page.locator('#deep .tr-res').innerText().catch(() => 'no result')).split('\n')[0]);
  await page.click('#deep [data-d=back]'); await page.click('#deep [data-d=why]'); await page.locator('[data-d=whypick]').first().click(); await page.waitForTimeout(200);
  console.log('why:', await page.locator('#deep .tr-res b').innerText());
  // the Pine Barrens close-up
  await page.click('#deep [data-d=back]'); await page.click('#deep [data-d=intro]'); await page.waitForTimeout(500); await page.click('#deep [data-d=close][data-id=pine]'); await page.waitForTimeout(2200);
  console.log('pine:', await page.locator('#deepbar .dp-title').innerText(), '·', await page.locator('#deepbar .dp-dots button').count(), 'stops'); await shot('close-pine');
  // Home on top, and back
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(400); await page.click('#deep [data-d=home]'); await page.waitForTimeout(500);
  console.log('home over deep:', await page.evaluate(() => !document.getElementById('welcome').hidden && document.getElementById('deep').hidden && document.getElementById('deepbar').hidden));
  await page.click('#welcome [data-entry=deep]'); await page.waitForTimeout(800); console.log('back in deep:', await page.evaluate(() => !document.getElementById('deep').hidden));
  console.log('errors', errs.length); await b.close(); })();
