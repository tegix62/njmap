// Replay with no fights of your own: a staged fight plays. python3 -m http.server 8077; NODE_PATH=$(npm root -g) node tools/goblin/ui-film2.cjs
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  const keys = Object.keys(JSON.parse(fs.readFileSync('data/goblin-board.json', 'utf8')).towns);
  await page.addInitScript((ks) => { localStorage.setItem('njtf.srs', JSON.stringify(Object.fromEntries(ks.map((k) => [k, { b: 2, due: 0 }])))); }, keys);
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]'); await page.waitForSelector('#sheet .gob');
  const px = await page.evaluate(() => { const m = window.njtf.byKey.get('Paterson City|Passaic'); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }); await page.mouse.click(px[0], px[1]);
  await page.waitForSelector('[data-g=begin]'); await page.click('[data-g=begin]'); await page.waitForSelector('[data-g=first]'); await page.click('[data-g=close]');
  page.on('console', (m) => console.log('c:', m.text().slice(0, 200))); await page.click('[data-gbar=film]'); await page.waitForTimeout(1500); console.log(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('njtf.goblin.save')); const w = s.world; const mine = Object.entries(w.towns).filter(([k, t]) => t.owner === 'goblins').map(([k, t]) => k + ':' + t.force); return mine.join(' ') + ' | film el: ' + !!document.querySelector('#film') + ' mode ' + document.body.dataset.mode; })); await page.waitForSelector('#film', { timeout: 4000 });
  await page.waitForSelector('#film', { state: 'detached', timeout: 40000 });
  console.log('film played and closed; errors:', errs); await b.close(); })();
