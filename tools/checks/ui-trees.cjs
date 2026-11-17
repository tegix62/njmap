// Trees of New Jersey: home page, hub, a whole Today set (meet cards, then every kind of question, a wrong answer on purpose), the map of
// sightings, the field guide, and a second visit the same day. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  const bad = []; page.on('response', (r) => { if (r.status() >= 400 && /img\/trees|trees\.json/.test(r.url())) bad.push(r.url()); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.screenshot({ path: `${out}/0-home.png` });
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/1-hub.png` });
  await page.click('[data-t=today]'); await page.waitForTimeout(500);
  const kinds = {}; let shots = 0, steps = 0, meets = 0;
  for (; steps < 40; steps++) {
    if (await page.locator('.tr-done').count()) break;
    if (await page.locator('.tr-kick', { hasText: 'New group' }).count()) { await page.waitForTimeout(500); await page.screenshot({ path: `${out}/2-group.png` }); await page.click('[data-t=next]'); await page.waitForTimeout(250); continue; }
    if (await page.locator('.tr-kick', { hasText: 'New tree' }).count()) { meets++; if (meets === 1) { await page.waitForTimeout(600); await page.screenshot({ path: `${out}/2-meet.png` }); } await page.click('[data-t=next]'); await page.waitForTimeout(250); continue; }
    const ask = await page.locator('.tr-ask').innerText();
    const kind = /has this leaf/.test(ask) ? 'shape' : /leaf of the/.test(ask) ? 'shapepick' : /Which tree/.test(ask) ? 'photo' : /^Tap/.test(ask) ? 'pick' : /same kind/.test(ask) ? 'same' : /Which group/.test(ask) ? 'group' : /has this leaf/.test(ask) ? 'shape' : /leaf of the/.test(ask) ? 'shapepick' : 'key';
    kinds[kind] = (kinds[kind] || 0) + 1;
    if (kinds[kind] === 1) { await page.waitForTimeout(500); await page.screenshot({ path: `${out}/3-${kind}.png` }); }
    await page.locator('[data-t=ans]').nth(steps % 2).click(); await page.waitForTimeout(250);
    if (kinds[kind] === 1) { await page.waitForTimeout(300); await page.screenshot({ path: `${out}/4-${kind}-answered.png` }); }
    await page.click('[data-t=next]'); await page.waitForTimeout(250);
  }
  await page.screenshot({ path: `${out}/5-done.png` });
  console.log('today:', (await page.locator('.tr-done').innerText()).replace(/\n/g, ' | ').slice(0, 160), '| kinds', JSON.stringify(kinds), 'meets', meets);
  await page.click('.tr-done [data-t=hub]'); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/6-hub-after.png` });
  console.log('hub after:', (await page.locator('.tr-today').innerText()).replace(/\n/g, ' | '), '|', (await page.locator('.tr-stats').innerText()).replace(/\n/g, ' '));
  await page.click('[data-t=identify]'); await page.waitForTimeout(300); await page.screenshot({ path: `${out}/9-key1.png` });
  for (const pickI of [2, 1, 1, 0, 0, 0]) { if (!(await page.locator('[data-t=keypick]').count())) break; await page.locator('[data-t=keypick]').nth(pickI).click(); await page.waitForTimeout(250); }
  await page.waitForTimeout(300); await page.screenshot({ path: `${out}/9-key-end.png` }); console.log('key ended at:', (await page.locator('.tr-body h2').innerText().catch(() => '?')));
  await page.click('[data-t=hub]'); await page.waitForTimeout(300);
  await page.click('[data-t=guide]'); await page.waitForTimeout(300); await page.locator('.tr-li').nth(6).click(); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/7-card.png` });
  await page.click('[data-t=where]'); await page.waitForTimeout(1600); await page.screenshot({ path: `${out}/8-where.png` });
  console.log('where:', (await page.locator('#hud').innerText()).replace(/\n/g, ' | ').slice(0, 200));
  await page.click('.tr-peekback'); await page.waitForTimeout(500);
  console.log('back on card:', await page.locator('#trees:not(.peek) .tr-tell').count(), '| practise works:', await (async () => { await page.click('[data-t=hub]'); await page.click('[data-t=practise]'); await page.waitForTimeout(300); return page.locator('.tr-ask').count(); })());
  await page.click('[data-t=hub]'); await page.click('[data-t=home]'); await page.waitForSelector('#welcome [data-entry]'); await page.click('[data-entry=normal]'); await page.waitForTimeout(1500);
  console.log('back in normal mode:', await page.locator('.hub-today').count(), 'trees hidden:', await page.locator('#trees[hidden]').count(), '| missing files', bad.length, '| errors', errs.length); await b.close(); })();
