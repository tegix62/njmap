// Deep Jersey home and map index: hooks to start from, threads to pick up once something is read, and the stories on the map.
// Shorter than ui-deep.cjs (which walks everything). Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/deep-home'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 390, height: 664 } })).newPage();
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to (load resource|fetch)|AJAXError|net::/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 200)); } });
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry=deep]');
  await page.click('[data-entry=deep]'); await page.waitForSelector('#deep .dp-start'); await page.waitForTimeout(2500);
  console.log('hooks:', await page.locator('#deep .dp-hook').count(), '| pick up shown on a fresh start:', await page.locator('#deep .dp-pickup').count());
  await shot('home-fresh');
  // read one story from a hook to its last beat
  await page.locator('#deep .dp-hook').first().click(); await page.waitForTimeout(2200);
  if (await page.locator('#deepex').isVisible()) await page.click('#deepex');
  await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(1500); await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(2000);
  const readTitle = await page.locator('#deepbar .dp-title').innerText();
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(1500);
  console.log('read:', readTitle, '| pick up threads now:', await page.locator('#deep .dp-pickup button').count()); await shot('home-after');
  // the map index
  await page.click('#deep [data-d=mapidx]'); await page.waitForTimeout(4000);
  const vis = await page.evaluate(() => window.njtf.map.getLayoutProperty('deep-stories', 'visibility'));
  const n = await page.evaluate(() => window.njtf.map.getSource('deep-stories')._data.features.length);
  console.log('map index layer:', vis, '| stories on it:', n); await shot('map-index');
  const pt = await page.evaluate(() => { const p = window.njtf.map.project([-74.28, 40.92]); return [p.x, p.y]; });
  await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(800);
  console.log('tapped the Watchungs point:', await page.locator('#deep .dp-maphook').innerText().catch(() => 'nothing')); await shot('map-pick');
  await page.click('#deep .dp-maphook [data-d=story]'); await page.waitForTimeout(2000);
  console.log('opened from the map:', await page.locator('#deepbar .dp-title').innerText(), '| story layer hidden:', await page.evaluate(() => window.njtf.map.getLayoutProperty('deep-stories', 'visibility')));
  // Lake Passaic drains: the water leaves through Moggy Hollow, then Great Notch, then the Passaic finds the Great Falls
  await page.evaluate(() => { const x = document.createElement('button'); x.dataset.d = 'story'; x.dataset.id = 's-lake'; document.getElementById('deep').appendChild(x); x.click(); }); await page.waitForTimeout(2000);
  if (await page.locator('#deepex').isVisible()) await page.click('#deepex');
  await page.click('#deepbar [data-b=next]');
  const caps = []; let drainSeen = false;
  for (let k = 0; k < 24; k++) { await page.waitForTimeout(1000);
    const c = await page.evaluate(() => { const e = document.getElementById('deepcap'); return e && !e.hidden ? e.textContent : ''; });
    if (c && !caps.includes(c)) { caps.push(c); await page.screenshot({ path: `${out}/drain-${caps.length}.png` }); }
    if (await page.evaluate(() => window.njtf.map.getLayer('deep-drain') && window.njtf.map.getLayoutProperty('deep-drain', 'visibility') !== 'none' && window.njtf.map.getPaintProperty('deep-drain', 'line-opacity') > 0)) drainSeen = true;
    if (caps.length >= 2 && caps[caps.length - 1].includes('Great Notch')) break; }
  console.log('drain captions:', caps.map((c) => c.slice(0, 40)).join(' | '), '| flow line shown:', drainSeen);
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(800);
  console.log('caption after leaving mid-drain:', await page.evaluate(() => { const e = document.getElementById('deepcap'); return !!e && !e.hidden; }), '| flow line after leaving:', await page.evaluate(() => window.njtf.map.getPaintProperty('deep-drain', 'line-opacity')));
  // and it plays to the end: all three stages
  await page.evaluate(() => { const x = document.createElement('button'); x.dataset.d = 'story'; x.dataset.id = 's-lake'; document.getElementById('deep').appendChild(x); x.click(); }); await page.waitForTimeout(2000);
  if (await page.locator('#deepex').isVisible()) await page.click('#deepex');
  await page.evaluate(() => { window.__caps = []; const e = document.getElementById('deepcap'); new MutationObserver(() => { if (!e.hidden && e.textContent && !window.__caps.includes(e.textContent)) window.__caps.push(e.textContent); }).observe(e, { childList: true, characterData: true, subtree: true, attributes: true }); });
  await page.click('#deepbar [data-b=next]'); let all = [];
  for (let k = 0; k < 60; k++) { await page.waitForTimeout(1000); const now = await page.evaluate(() => window.__caps); if (now.length > all.length) await page.screenshot({ path: `${out}/drainfull-${now.length}.png` }); all = now; if (all.some((x) => x.includes('Great Falls'))) break; }
  console.log('drain stages seen:', all.length, '| last:', (all[all.length - 1] || '').slice(0, 60));
  // leaving Deep Jersey from the map index: the story dots go with it
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(600); await page.click('#deep [data-d=mapidx]'); await page.waitForTimeout(2500);
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(600); await page.click('#deep [data-d=home]'); await page.waitForTimeout(800);
  await page.click('#welcome [data-entry=nj]'); await page.waitForTimeout(2500);
  console.log('story dots after leaving Deep Jersey:', await page.evaluate(() => window.njtf.map.getLayer('deep-stories') ? window.njtf.map.getLayoutProperty('deep-stories', 'visibility') : 'no layer'));
  // blocked storage: still opens
  await page.close();   // the first page keeps rendering; free the CPU for this one
  const p2 = await (await b.newContext({ viewport: { width: 390, height: 664 } })).newPage();
  await p2.addInitScript(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (String(k).startsWith('njtf.deep')) throw new Error('blocked'); return g.call(this, k); }; Storage.prototype.setItem = function () { throw new Error('blocked'); }; });
  p2.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR2', e.message); });
  await p2.goto('http://localhost:8077/index.html?debug=1&region=nj'); await p2.waitForSelector('#welcome [data-entry=deep]', { timeout: 20000 }).catch(() => {});
  const ok2 = await p2.locator('#welcome [data-entry=deep]').count();
  if (ok2) { await p2.waitForTimeout(3000); await p2.click('[data-entry=deep]'); await p2.waitForSelector('#deep .dp-hook', { timeout: 45000 }).catch(() => {}); }
  console.log('storage blocked, hooks:', ok2 ? await p2.locator('#deep .dp-hook').count() : 'app did not start');
  console.log('errors', errs.length); await b.close(); })();
