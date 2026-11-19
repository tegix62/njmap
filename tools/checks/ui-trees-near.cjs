// Trees near you: the home screen with no spot (statewide list), setting a spot from your places on the town side, the local list,
// Today meeting the top local trees, a quick look of 20, hiding a photo, and setting the spot by tapping the map. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/near'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  // a place on the town side: Montclair
  await page.evaluate(() => localStorage.setItem('njtf.anchors', JSON.stringify([{ name: 'Home', pt: [-74.209, 40.826] }])));
  await page.click('[data-entry=trees]'); await page.waitForSelector('#trees .tr-today'); await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/0-hub-nospot.png` });
  console.log('statewide:', (await page.locator('.tn-row b').allInnerTexts()).slice(0, 10).join(', '));
  await page.click('[data-t=spot]'); await page.waitForTimeout(250); await page.screenshot({ path: `${out}/1-spot.png` });
  await page.click('[data-t=spotset]'); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/2-hub-home.png` });
  console.log('near Home:', (await page.locator('.tn-row .tk-gt').allInnerTexts()).slice(0, 10).map((t) => t.replace(/\n/g, ' (') + ')').join(', '));
  console.log('today:', (await page.locator('.tr-today').innerText()).replace(/\n/g, ' | '));
  await page.click('[data-t=today]'); await page.waitForTimeout(400);
  let meets = [], kinds = {};
  for (let i = 0; i < 30; i++) {
    if (await page.locator('.tr-done').count()) break;
    if (await page.locator('.tr-kick', { hasText: 'New tree' }).count()) { meets.push(await page.locator('.tr-body h2').innerText()); if (meets.length === 1) await page.screenshot({ path: `${out}/3-meet.png` }); await page.click('[data-t=next]'); await page.waitForTimeout(250); continue; }
    const ask = await page.locator('.tr-ask').innerText(); const hide = await page.locator('.tn-hide').count();
    const k = hide ? 'flash' : ask.slice(0, 24); kinds[k] = (kinds[k] || 0) + 1;
    if (kinds[k] === 1) await page.screenshot({ path: `${out}/4-${Object.keys(kinds).length}.png` });
    await page.locator('[data-t=ans]').first().click(); await page.waitForTimeout(200); await page.click('[data-t=next]'); await page.waitForTimeout(200);
  }
  console.log('met:', meets.join(', '), '| kinds', JSON.stringify(kinds));
  await page.screenshot({ path: `${out}/5-done.png` }); await page.click('.tr-done [data-t=hub]'); await page.waitForTimeout(300);
  await page.click('[data-t=quick]'); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/6-quick.png` });
  await page.click('.tn-hide'); console.log('hide:', await page.locator('.tn-hide').innerText());
  for (let i = 0; i < 20; i++) { await page.locator('[data-t=qans]').first().click(); await page.waitForTimeout(1400); if (await page.locator('.tr-done').count()) break; }
  await page.screenshot({ path: `${out}/7-quick-end.png` }); console.log('quick end:', (await page.locator('.tr-done').innerText()).replace(/\n/g, ' | ').slice(0, 200));
  await page.click('.tr-done [data-t=hub]'); await page.waitForTimeout(300);
  await page.click('[data-t=spot]'); await page.click('[data-t=spotmap]'); await page.waitForTimeout(1200);
  const box = await page.locator('#map').boundingBox(); await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.75); await page.waitForTimeout(600);
  console.log('after map tap:', await page.locator('.tn-head h4').innerText(), '|', (await page.locator('.tn-row b').allInnerTexts()).slice(0, 5).join(', '));
  await page.screenshot({ path: `${out}/8-hub-mapspot.png` });
  console.log('errors', errs.length); await b.close(); })();
