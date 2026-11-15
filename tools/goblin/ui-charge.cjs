// F1 check: a quiz charge writes one real review, charges the next maneuver (+1), is optional, capped, and can be switched off.
//   python3 -m http.server 8077 (repo root), then: NODE_PATH=$(npm root -g) node tools/goblin/ui-charge.cjs
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const keys = Object.keys(JSON.parse(fs.readFileSync('data/goblin-board.json', 'utf8')).towns);
  await page.addInitScript((ks) => { if (!localStorage.getItem('njtf.srs')) localStorage.setItem('njtf.srs', JSON.stringify(Object.fromEntries(ks.map((k) => [k, { b: 2, due: 0 }])))); }, keys);
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');
  await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]');
  await page.waitForSelector('#sheet .gob');
  const proj = (id) => page.evaluate((i) => { const m = window.njtf.byKey.get(i); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }, id);
  let px = await proj('Paterson City|Passaic'); await page.mouse.click(px[0], px[1]);
  await page.waitForSelector('[data-g=begin]'); await page.click('[data-g=begin]'); await page.waitForSelector('[data-g=first]'); await page.click('[data-g=close]');
  const pair = await page.evaluate(async () => {
    const bj = await fetch('data/goblin-board.json').then((r) => r.json());
    const w = JSON.parse(localStorage.getItem('njtf.goblin.save')).world;
    for (const id of Object.keys(w.towns)) if (w.towns[id].owner === 'goblins' && w.towns[id].force >= 4) for (const n of bj.towns[id].nb) if (w.towns[n] && w.towns[n].owner && w.towns[n].owner !== 'goblins' && w.towns[n].captain) return [id, n];
  });
  await page.evaluate((id) => window.njtf.map.easeTo({ center: window.njtf.byKey.get(id).pt, zoom: 10, duration: 0 }), pair[0]);
  await page.waitForTimeout(400);
  let p0 = await proj(pair[0]); await page.mouse.click(p0[0], p0[1]); await page.waitForSelector('[data-g=pick]'); await page.click('[data-g=pick]');
  let p1 = await proj(pair[1]); await page.mouse.click(p1[0], p1[1]); await page.waitForSelector('[data-g=send]'); await page.click('[data-g=send]');
  await page.waitForSelector('[data-g=chargeq]');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('njtf.srs')));
  await page.click('[data-g=chargeq]'); await page.waitForSelector('[data-g=chargea]');
  const q = (await page.locator('#sheet h3').innerText());
  const right = await page.locator('[data-g=chargea]').first().getAttribute('data-right');
  await page.click(`[data-g=chargea][data-ans="${right}"]`);
  await page.waitForSelector('[data-g=front]');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('njtf.srs')));
  const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
  console.log('question:', q, '| review keys changed:', changed.length, changed[0], '| box', before[changed[0]].b, '->', after[changed[0]].b);
  await page.click('[data-g=front]');
  console.log('charged line shown:', /Charged: \+1/.test(await page.locator('#sheet').innerText()));
  await page.click('[data-g=fact][data-a=probe]'); await page.waitForTimeout(200);
  const ledger = await page.evaluate(() => JSON.parse(localStorage.getItem('njtf.goblin.save')).events.filter((e) => e.type === 'front_beat').pop());
  console.log('beat charged:', ledger.charged, '| mods:', JSON.stringify(ledger.mods));
  // wrong answer: no charge, review recorded as a miss, never blocks
  await page.click('[data-g=chargeq]'); await page.waitForSelector('[data-g=chargea]');
  const wrong = await page.locator('[data-g=chargea]').evaluateAll((els) => els.find((e) => e.dataset.ans !== e.dataset.right).dataset.ans);
  await page.click(`[data-g=chargea][data-ans="${wrong}"]`); await page.waitForSelector('[data-g=front]');
  console.log('wrong answer:', (await page.locator('#sheet h3').innerText()));
  // switch off: the button disappears
  await page.click('[data-g=front]'); await page.click('[data-g=close]'); await page.click('[data-gbar=do]'); await page.click('[data-g=chargetoggle]');
  console.log('toggle label:', (await page.locator('[data-g=chargetoggle]').innerText()).replace(/\n/g, ' '));
  await page.click('[data-g=close]');
  console.log('errors:', errs);
  if (changed.length !== 1 || !ledger.charged || errs.length) process.exit(1);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
