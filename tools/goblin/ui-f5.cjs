// F5 check: HUD shows chapter, region and season; a won chapter offers the next region and carries the clan; no page errors.
//   python3 -m http.server 8077 (repo root), then: NODE_PATH=$(npm root -g) node tools/goblin/ui-f5.cjs
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
  console.log('hud 1:', (await page.locator('#hud').innerText()).replace(/\n/g, ' | ').slice(0, 230));
  await page.click('[data-gbar=do]'); await page.waitForSelector('.messenger');
  console.log('do panel rule line:', (await page.locator('#sheet .fine').first().innerText()).slice(0, 160)); await page.click('[data-g=close]');
  // pretend the chapter was won, with a recognisable stockpile
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('njtf.goblin.save')); s.world.war.over = { winner: 'goblins', tick: s.world.tick, how: 'held' }; s.overShown = false; s.world.clans.goblins.res = { food: 41, build: 17, coin: 9 }; localStorage.setItem('njtf.goblin.save', JSON.stringify(s)); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');
  await page.waitForFunction(() => window.njtf && window.njtf.mode === 'goblin', null, { timeout: 15000 }); await page.waitForSelector('[data-g=nextchapter]', { timeout: 10000 });
  console.log('war over panel:', (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await page.click('[data-g=nextchapter]'); await page.waitForSelector('[data-g=first], #sheet .gob'); await page.waitForTimeout(1200);
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('njtf.goblin.save')));
  console.log('hud 2:', (await page.locator('#hud').innerText()).replace(/\n/g, ' | ').slice(0, 230));
  console.log('chapter', save.world.campaign.chapter, '| kits played', save.world.campaign.kits.join(','), '| rivals', Object.keys(save.world.clans).join(','), '| stock', JSON.stringify(save.world.clans.goblins.res).slice(0, 60));
  console.log('errors:', errs);
  if (errs.length || save.world.campaign.chapter !== 2) process.exit(1);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
