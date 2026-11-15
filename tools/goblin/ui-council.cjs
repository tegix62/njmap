// Council check: start a war, give every captain an order (march where possible), end turns; frames to $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'council-frames'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); }); page.on('console', (m) => { if (m.type() === 'error' && !/tiles|Failed to load|AJAXError/.test(m.text())) console.log('CERR', m.text().slice(0, 200)); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=goblin]');
  await page.waitForSelector('#council .cn-say p'); await page.waitForTimeout(1200);
  let n = 0; const shot = async (name) => { await page.screenshot({ path: `${out}/${String(n++).padStart(2, '0')}-${name}.png` }); };
  await shot('start');
  const px = await page.evaluate(() => { const m = window.njtf.byKey.get('Paterson City|Passaic'); const p = window.njtf.map.project(m.pt); return [p.x, p.y]; }); await page.mouse.click(px[0], px[1]);
  await page.waitForTimeout(1200); await shot('confirm');
  const press = async (label) => { const b = page.locator('.cn-cmd button', { hasText: label }).first(); if (await b.count() && !(await b.getAttribute('class') || '').includes('dim')) { await b.click(); return true; } return false; };
  await press('BEGIN'); await page.waitForTimeout(2600); await shot('begun');
  await press('CONTINUE'); await page.waitForTimeout(1400); await shot('order');
  const said = () => page.locator('.cn-say p').getAttribute('data-full');
  let battles = 0, turns = 0, shotBattle = 0;
  for (let step = 0; step < 60 && turns < 4; step++) {
    if (await page.locator('.cn-battle').count()) { battles++; if (shotBattle < 3) { await page.waitForTimeout(1500); await shot('battle'); shotBattle++; } await page.locator('.cn-battle').click().catch(() => {}); await page.waitForTimeout(400); await page.locator('.cn-battle').click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(300); continue; }
    if (await page.locator('.cn-card').count()) { if (n < 14) await shot('card'); await page.locator('.cn-card').click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(200); continue; }
    const t = await said();
    if (await press('END TURN')) { turns++; console.log('turn ended', turns); await page.waitForTimeout(600); continue; }
    if (await press('NEXT') || await press('CONTINUE')) { await page.waitForTimeout(900); continue; }
    if (/March on which/.test(t)) { await shot('targets'); await page.locator('.cn-cmd button').first().click(); await page.waitForTimeout(700); continue; }
    if (await press('MARCH')) { await page.waitForTimeout(500); continue; }
    if (await press('MUSTER')) { await page.waitForTimeout(600); continue; }
    if (await press('REST')) { await page.waitForTimeout(600); continue; }
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500); await shot('later');
  const px2 = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('njtf.goblin.council')); const ids = Object.keys(s.world.towns).filter((t) => s.world.towns[t].captain); for (const id of ids) { const p = window.njtf.map.project(window.njtf.byKey.get(id).pt); if (p.x > 30 && p.x < 360 && p.y > 90 && p.y < 460) return [p.x, p.y]; } return [195, 300]; });
  await page.mouse.click(px2[0], px2[1]); await page.waitForTimeout(500); await shot('info');
  const st = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('njtf.goblin.council')); const w = s.world; return { tick: w.tick, mine: Object.values(w.towns).filter((t) => t.owner === 'goblins').length, ap: w.clans.goblins.ap }; });
  console.log('battles', battles, 'turns', turns, JSON.stringify(st), 'said:', await said(), 'errors', errs.length); await b.close(); })();
