// A front's decision plays as a film too: inject one into the save, reload, press Replay.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  const keys = Object.keys(JSON.parse(fs.readFileSync('data/goblin-board.json', 'utf8')).towns);
  await page.addInitScript((ks) => { localStorage.setItem('njtf.srs', JSON.stringify(Object.fromEntries(ks.map((k) => [k, { b: 2, due: 0 }])))); }, keys);
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]'); await page.waitForSelector('#sheet .gob');
  const px = await page.evaluate(() => { const m = window.njtf.byKey.get('Paterson City|Passaic'); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }); await page.mouse.click(px[0], px[1]);
  await page.waitForSelector('[data-g=begin]'); await page.click('[data-g=begin]'); await page.waitForSelector('[data-g=first]'); await page.click('[data-g=close]');
  await page.evaluate(async () => {
    const s = JSON.parse(localStorage.getItem('njtf.goblin.save')), w = s.world;
    const bj = await fetch('data/goblin-board.json').then((r) => r.json());
    let pair; for (const id of Object.keys(w.towns)) if (w.towns[id].owner === 'goblins') for (const n of bj.towns[id].nb) if (w.towns[n] && w.towns[n].owner && w.towns[n].owner !== 'goblins') pair = pair || [id, n];
    const R = (a, d, aL, dL) => ({ a: [5, 3], d: [4, 2], aEff: [5, 3], dEff: [4, 2], aLost: aL, dLost: dL, attackers: a, defenders: d });
    s.events = [{ tick: w.tick, type: 'front_beat', front: 'f9', clan: 'goblins', captain: null, to: pair[1], maneuver: 'decision', won: true, lead: null, rounds: [R(8, 3, 0, 2), R(8, 1, 0, 2), R(7, 0, 1, 1)] },
      { tick: w.tick, type: 'front_closed', front: 'f9', clan: 'goblins', verdict: 'Won', town: pair[1], from: pair[0] }];
    localStorage.setItem('njtf.goblin.save', JSON.stringify(s));
  });
  await page.reload(); await page.waitForTimeout(2500); if (await page.locator('#welcome [data-entry]').isVisible()) await page.click('[data-entry=goblin]'); await page.waitForTimeout(1500);
  await page.click('[data-g=close]').catch(() => {}); await page.click('[data-gbar=film]'); await page.waitForSelector('#film', { timeout: 4000 });
  const t = Date.now(); await page.waitForSelector('#film', { state: 'detached', timeout: 40000 });
  console.log('front film ran', ((Date.now() - t) / 1000).toFixed(1) + 's; errors', errs); await b.close(); })();
