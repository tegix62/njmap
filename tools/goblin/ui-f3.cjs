// F3 check: a foothold run on a captainless township, then Talk (insult, parley) with a captain you have learned about; no page errors.
//   python3 -m http.server 8077 (repo root), then: NODE_PATH=$(npm root -g) node tools/goblin/ui-f3.cjs
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const keys = Object.keys(JSON.parse(fs.readFileSync('data/goblin-board.json', 'utf8')).towns);
  await page.addInitScript((ks) => { if (!localStorage.getItem('njtf.srs')) localStorage.setItem('njtf.srs', JSON.stringify(Object.fromEntries(ks.map((k) => [k, { b: 2, due: 0 }])))); }, keys);
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');
  await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]'); await page.waitForSelector('#sheet .gob');
  const proj = (id) => page.evaluate((i) => { const m = window.njtf.byKey.get(i); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }, id);
  let px = await proj('Paterson City|Passaic'); await page.mouse.click(px[0], px[1]);
  await page.waitForSelector('[data-g=begin]'); await page.click('[data-g=begin]'); await page.waitForSelector('[data-g=first]'); await page.click('[data-g=close]');
  // give the player what the talk options need: something learned about a captain next to us, and some Coin
  const targets = await page.evaluate(async () => {
    const bj = await fetch('data/goblin-board.json').then((r) => r.json());
    const s = JSON.parse(localStorage.getItem('njtf.goblin.save')); const w = s.world; let plain = null, capt = null;
    for (const id of Object.keys(w.towns)) if (w.towns[id].owner === 'goblins') for (const n of bj.towns[id].nb) { const T = w.towns[n]; if (!T || !T.owner || T.owner === 'goblins') continue; if (!T.captain && !plain) plain = n; if (T.captain && !capt) capt = n; }
    const c = w.chars[w.towns[capt].captain]; c.known.goblins = ['trait:' + c.traits[0].id]; w.clans.goblins.res.coin = 30; w.clans.goblins.ap = 4;
    localStorage.setItem('njtf.goblin.save', JSON.stringify(s));
    return { plain, capt };
  });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');   // the home-page choice is remembered for the session, so it opens straight into goblin mode
  await page.waitForFunction(() => window.njtf && window.njtf.mode === 'goblin', null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  async function card(id) {
    await page.evaluate((i) => window.njtf.map.easeTo({ center: window.njtf.byKey.get(i).pt, zoom: 10, duration: 0 }), id); await page.waitForTimeout(300);
    const p = await proj(id); await page.mouse.click(p[0], p[1]); await page.waitForSelector('#sheet .gob');
  }
  await page.evaluate(() => document.querySelector('#sheet [data-g=close]') && document.querySelector('#sheet [data-g=close]').click());
  await card(targets.plain);
  console.log('plain card buttons:', await page.locator('#sheet button').allInnerTexts());
  await page.click('[data-g=foothold]'); await page.waitForSelector('[data-g=footdo]');
  console.log('foothold panel:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 200));
  await page.click('[data-g=footdo]'); await page.waitForTimeout(200);
  console.log('foothold result:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 220));
  await page.click('[data-g=close]');
  await card(targets.capt);
  console.log('captain card buttons:', await page.locator('#sheet button').allInnerTexts());
  await page.click('[data-g=talk]'); await page.waitForSelector('[data-g=insult]');
  console.log('talk panel:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 260));
  await page.click('[data-g=parley]'); await page.waitForTimeout(200);
  console.log('parley result:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 160));
  await page.click('[data-g=close]');
  await card(targets.capt); await page.click('[data-g=talk]'); await page.click('[data-g=insult]'); await page.waitForTimeout(200);
  console.log('insult result:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 220));
  console.log('errors:', errs);
  if (errs.length) process.exit(1);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
