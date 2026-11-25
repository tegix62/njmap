// Deep Jersey, first slice: open it from the home page, step the time slider through every stop (frames of each), open a card, the iron
// chain, a full round of Put it in order (answered right), and Why is it here. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/deep'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to (load resource|fetch)|AJAXError|net::/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 200)); } });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry=deep]');
  await page.click('[data-entry=deep]'); await page.waitForSelector('#deep .dp-cards'); await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/0-today.png` });
  const n = await page.locator('#deepbar input').evaluate((e) => +e.max);
  for (let i = 1; i <= n; i++) {
    await page.locator('#deepbar input').evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, i);
    await page.waitForTimeout(i === 7 ? 4200 : 2600);
    const t = await page.locator('#deepbar .dp-title').innerText(), cards = await page.locator('#deep .dp-card').count();
    console.log(`stop ${i}: ${t} · ${cards} cards · zoom ${(await page.evaluate(() => window.__map ? window.__map.getZoom() : null)) ?? '?'}`);
    await page.screenshot({ path: `${out}/${i}-${t.replace(/\W+/g, '-').toLowerCase()}.png` });
  }
  // back to the lake, open its card
  await page.locator('#deepbar input').evaluate((e) => { e.value = 5; e.dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(1500);
  await page.click('#deep .dp-card'); await page.waitForTimeout(2200);
  console.log('card:', (await page.locator('#deep h2').innerText()), '| sources', await page.locator('#deep .dp-src li').count());
  await page.screenshot({ path: `${out}/card.png` });
  await page.click('#deep [data-d=era]'); await page.click('#deep [data-d=chain]'); await page.waitForTimeout(300);
  console.log('chain steps:', await page.locator('.dp-chain li').count()); await page.screenshot({ path: `${out}/chain.png` });
  await page.click('#deep [data-d=era]'); await page.click('#deep [data-d=order]');
  const want = await page.evaluate(async () => { const m = await import('./js/deepcards.js'); return m.CARDS.map((c) => [c.title, c.year]); });
  const yr = Object.fromEntries(want);
  for (let k = 0; k < 5; k++) {
    const opts = await page.locator('.dp-pick button').allInnerTexts(); if (!opts.length) break;
    const oldest = opts.sort((a, c) => yr[a] - yr[c])[0]; await page.locator('.dp-pick button', { hasText: oldest }).first().click(); await page.waitForTimeout(250);
  }
  console.log('order:', (await page.locator('#deep .tr-res').innerText().catch(() => 'no result')).split('\n')[0]); await page.screenshot({ path: `${out}/order.png` });
  await page.click('#deep [data-d=era]'); await page.click('#deep [data-d=why]'); await page.locator('[data-d=whypick]').first().click(); await page.waitForTimeout(300);
  console.log('why:', (await page.locator('#deep .tr-res b').innerText())); await page.screenshot({ path: `${out}/why.png` });
  // the second corridor: the Pine Barrens
  await page.click('#deep [data-d=era]'); await page.click('#deep [data-d=cor][data-id=pine]'); await page.waitForTimeout(2600);
  const pn = await page.locator('#deepbar input').evaluate((e) => +e.max);
  console.log('pine stops:', pn + 1, '| end label:', await page.locator('#deepbar .dp-ends span').last().innerText());
  for (let i = 0; i <= pn; i++) {
    await page.locator('#deepbar input').evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, i); await page.waitForTimeout(2400);
    const t = await page.locator('#deepbar .dp-title').innerText();
    console.log(`pine ${i}: ${t} · ${await page.locator('#deep .dp-card').count()} cards · ${await page.locator('#deeppins button').count()} pins`);
    await page.screenshot({ path: `${out}/pine-${i}-${t.replace(/\W+/g, '-').toLowerCase()}.png` });
  }
  await page.locator('#deepbar input').evaluate((e) => { e.value = 2; e.dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(1200);
  await page.locator('#deep .dp-card', { hasText: 'Batsto' }).click(); await page.waitForTimeout(1800);
  console.log('pine card:', await page.locator('#deep h2').innerText()); await page.screenshot({ path: `${out}/pine-card.png` });
  await page.click('#deep [data-d=era]'); await page.click('#deep [data-d=chain]'); console.log('pine chain:', await page.locator('#deep .dp-top h1').innerText(), await page.locator('.dp-chain li').count());
  await page.click('#deep [data-d=era]'); await page.click('#deep [data-d=why]'); await page.locator('[data-d=whypick]').first().click(); await page.waitForTimeout(200);
  console.log('pine why:', await page.locator('#deep h2').innerText(), '->', await page.locator('#deep .tr-res b').innerText());
  // Home from Deep Jersey: the home page must be on top and usable; picking New Jersey leaves Deep Jersey
  await page.click('#deep [data-d=era]'); await page.click('#deep [data-d=home]'); await page.waitForTimeout(500);
  const homeOk = await page.evaluate(() => { const w = document.getElementById('welcome'); return !w.hidden && document.getElementById('deep').hidden && document.getElementById('deepbar').hidden; });
  console.log('home over deep:', homeOk); await page.screenshot({ path: `${out}/home.png` });
  await page.click('#welcome [data-entry=deep]'); await page.waitForTimeout(800);
  console.log('back in deep:', await page.evaluate(() => !document.getElementById('deep').hidden && !document.getElementById('deepbar').hidden));
  console.log('errors', errs.length); await b.close(); })();
