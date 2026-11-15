// Rush check: play one run, tapping the right township most times and a wrong one once. Frames to $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'rush-frames'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); }); page.on('console', (m) => { if (m.type() === 'error' && !/tiles|Failed to load/.test(m.text())) console.log('CERR', m.text().slice(0, 160)); });
  const keys = Object.keys(JSON.parse(fs.readFileSync('data/goblin-board.json', 'utf8')).towns);
  await page.addInitScript((ks) => { localStorage.setItem('njtf.srs', JSON.stringify(Object.fromEntries(ks.map((k) => [k, { b: 2, due: 0 }])))); }, keys);
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]'); await page.waitForSelector('#sheet .gob');
  const px = await page.evaluate(() => { const m = window.njtf.byKey.get('Paterson City|Passaic'); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }); await page.mouse.click(px[0], px[1]);
  await page.waitForSelector('[data-g=begin]'); await page.click('[data-g=begin]'); await page.waitForSelector('[data-g=first]'); await page.click('[data-g=close]');
  await page.click('[data-gbar=rush]'); await page.waitForSelector('#rush .rs-name');
  const tap = async (key) => { const p = await page.evaluate((k) => { const m = window.njtf.byKey.get(k); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }, key); await page.mouse.click(p[0], p[1]); };
  const byName = (n) => page.evaluate((n) => { for (const [k, m] of window.njtf.byKey) if (m.n === n) return k; }, n);
  let shot = 0; const t0 = Date.now();
  for (let r = 0; r < 10; r++) {
    await page.waitForFunction(() => { const n = document.querySelector('#rush .rs-name'); const k = document.querySelector('#rush .rs-kind'); return n && n.textContent && (k.textContent === 'FIND' || /COMING/.test(k.textContent)); }, null, { timeout: 15000 }).catch(() => {});
    if (await page.locator('.rs-end').count()) break;
    const kind = await page.locator('.rs-kind').innerText(), name = await page.locator('.rs-name').innerText();
    await page.waitForTimeout(600); await page.screenshot({ path: `${out}/r${r}a.png` });
    const key = await byName(name);
    if (r === 1) { await tap('Paterson City|Passaic'); } else { await page.evaluate((k) => { const m = window.njtf.byKey.get(k); window.njtf.map.easeTo({ center: m.pt, zoom: 10.5, duration: 0 }); }, key); await page.waitForTimeout(150); await tap(key); }
    console.log(r, kind, name, r === 1 ? 'WRONG tap' : 'right tap');
    await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/r${r}b.png` });
    await page.waitForTimeout(2500);
  }
  await page.waitForSelector('.rs-end', { timeout: 20000 }); await page.screenshot({ path: `${out}/end.png` });
  console.log('end:', (await page.locator('.rs-end').innerText()).replace(/\n/g, ' | '), 'secs', ((Date.now() - t0) / 1000).toFixed(0), 'errors', errs.length);
  await page.click('[data-r=done]'); await page.waitForTimeout(1200); console.log('rush closed:', !(await page.locator('#rush').count())); await b.close(); })();
