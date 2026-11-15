// F1 check: with no review data a new player sees a readable map; far townships are fog; playing never writes the review data.
//   python3 -m http.server 8077 (repo root), then: NODE_PATH=$(npm root -g) node tools/goblin/ui-fog.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj');
  await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]');
  await page.waitForSelector('#sheet .gob');
  const proj = (id) => page.evaluate((i) => { const m = window.njtf.byKey.get(i); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }, id);
  let px = await proj('Paterson City|Passaic'); await page.mouse.click(px[0], px[1]);
  await page.waitForSelector('[data-g=begin]'); await page.click('[data-g=begin]'); await page.waitForSelector('[data-g=first]');
  const levels = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('njtf.goblin.save')).world; return Object.keys(w.towns); });
  // the review data before play
  const srsBefore = await page.evaluate(() => localStorage.getItem('njtf.srs'));
  // find an enemy township that is not next to the home (so not on the floor) and one that is
  const info = await page.evaluate(async () => {
    const bj = await fetch('data/goblin-board.json').then((r) => r.json());
    const w = JSON.parse(localStorage.getItem('njtf.goblin.save')).world;
    const home = w.clans.goblins.home, nb = new Set(bj.towns[home].nb);
    const enemy = Object.keys(w.towns).filter((t) => w.towns[t].owner && w.towns[t].owner !== 'goblins');
    const dist = new Map([[home, 0]]), q = [home];
    for (let i = 0; i < q.length; i++) for (const n of bj.towns[q[i]].nb) if (!dist.has(n)) { dist.set(n, dist.get(q[i]) + 1); q.push(n); }
    return { near: enemy.slice().sort((a, b) => dist.get(a) - dist.get(b))[0], far: enemy.filter((t) => dist.get(t) >= 3).sort((a, b) => dist.get(b) - dist.get(a))[0] };
  });
  async function card(id) {
    await page.evaluate((i) => window.njtf.map.easeTo({ center: window.njtf.byKey.get(i).pt, zoom: 10, duration: 0 }), id);
    await page.waitForTimeout(300);
    const p = await proj(id); await page.mouse.click(p[0], p[1]);
    await page.waitForSelector('#sheet .gob');
    return (await page.locator('#sheet').innerText()).replace(/\n/g, ' | ');
  }
  await page.click('[data-g=close]');
  console.log('near (floor):', info.near, '->', (await card(info.near)).slice(0, 170));
  await page.click('[data-g=close]');
  console.log('far:', info.far, '->', (await card(info.far)).slice(0, 170));
  const ok = /know nothing|said to hold/.test(await page.locator('#sheet').innerText());
  await page.screenshot({ path: 'scratch-fog.png' });
  // play a skirmish then check the review data is untouched
  await page.click('[data-g=close]');
  await page.evaluate(() => window.njtf.map.easeTo({ zoom: 8.6, duration: 0 }));
  await page.waitForTimeout(300);
  const srsAfter = await page.evaluate(() => localStorage.getItem('njtf.srs'));
  console.log('review data unchanged by looking:', srsBefore === srsAfter, '| fog on far township:', ok, '| errors:', errs);
  if (!ok || srsBefore !== srsAfter || errs.length) process.exit(1);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
