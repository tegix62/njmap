// F4 check: a convoy shows as a dot, the Do panel shows the messenger, a guard offer and a reprisal offer, Gentle mode toggles; no page errors.
//   python3 -m http.server 8077 (repo root), then: NODE_PATH=$(npm root -g) node tools/goblin/ui-f4.cjs
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
  // plant a convoy of ours on its way home and an ambush answer on a rival township, then reload from the save
  const info = await page.evaluate(async () => {
    const bj = await fetch('data/goblin-board.json').then((r) => r.json());
    const s = JSON.parse(localStorage.getItem('njtf.goblin.save')); const w = s.world, home = w.clans.goblins.home;
    const prev = new Map([[home, null]]), q = [home];
    for (let i = 0; i < q.length; i++) for (const n of bj.towns[q[i]].nb) if (w.towns[n] && !prev.has(n)) { prev.set(n, q[i]); q.push(n); }
    const far = q.filter((t) => w.towns[t].owner === 'goblins' && t !== home).pop();
    const route = []; for (let t = far; t; t = prev.get(t)) route.push(t);
    w.convoys = [{ id: 'v99', clan: 'goblins', from: far, to: home, route, legs: route.slice(1).map(() => 3), departTick: w.tick, arriveTick: w.tick + 3 * (route.length - 1), cargo: { build: 2, coin: 3 }, escort: 2 }];
    const rival = Object.keys(w.towns).find((t) => w.towns[t].owner === 'rats' && bj.towns[t].nb.some((n) => w.towns[n] && w.towns[n].owner === 'goblins'));
    w.reprisal = { goblins: { target: rival, by: 'rats', until: w.tick + 40 } };
    localStorage.setItem('njtf.goblin.save', JSON.stringify(s));
    return { far, rival, routeLen: route.length };
  });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');
  await page.waitForFunction(() => window.njtf && window.njtf.mode === 'goblin', null, { timeout: 15000 }); await page.waitForTimeout(1500);
  const dots = await page.evaluate(() => window.njtf.map.getSource('gobconvoy')._data.features.length);
  console.log('convoy dots on the map:', dots, '| route length', info.routeLen);
  if (await page.locator('#sheet [data-g=close]').count()) await page.click('#sheet [data-g=close]');
  await page.click('[data-gbar=do]'); await page.waitForSelector('.messenger');
  const text = (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ');
  console.log('do panel:', text.slice(0, 420));
  console.log('has messenger face:', await page.locator('.messenger svg').count(), '| reprisal offer:', /Answer the ambush/.test(text), '| guard offer:', /Guard /.test(text));
  await page.click('[data-g=gentle]'); await page.waitForTimeout(150);
  console.log('gentle toggle:', (await page.locator('[data-g=gentle]').innerText()).replace(/\n/g, ' '));
  if (await page.locator('[data-g=guard]').count()) { await page.click('[data-g=guard]'); await page.waitForTimeout(150); console.log('guard result:', (await page.locator('#sheet h3').innerText())); }
  await page.screenshot({ path: 'scratch-f4.png' });
  console.log('errors:', errs);
  if (errs.length || dots < 1) process.exit(1);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
