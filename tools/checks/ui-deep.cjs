// Deep Jersey: the way in (explanation and three choices), the story chapter by chapter with the arrows (each region drawn whole past
// the state line), the land today (every region, shown whole), a close-up (stops with the arrows, a card, the chain, both games), the
// Pine Barrens close-up, and Home on top of it all. Frames in $OUT.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames/deep'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 390, height: 664 } })).newPage();
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to (load resource|fetch)|AJAXError|net::/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 200)); } });
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const slug = (t) => t.replace(/\W+/g, '-').toLowerCase();
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry=deep]');
  await page.click('[data-entry=deep]'); await page.waitForSelector('#deep .dp-start'); await page.waitForTimeout(3000);
  console.log('intro:', (await page.locator('#deep .dp-lead').innerText()), '| bar hidden:', await page.locator('#deepbar').isHidden(), '| labels:', await page.locator('#deeppins .dp-rl').count());
  await shot('0-intro');
  // open any story directly (as a thread link would)
  const openStory = async (id) => { await page.evaluate((x) => { const b = document.createElement('button'); b.dataset.d = 'story'; b.dataset.id = x; document.getElementById('deep').appendChild(b); b.click(); }, id); await page.waitForTimeout(2600); };
  const skipEx = async () => { if (await page.locator('#deepex').isVisible()) { await page.click('#deepex'); await page.waitForTimeout(500); } };
  // the story: the first of the sequence, three beats with the arrows, then the threads
  await page.click('#deep [data-d=story]'); await page.waitForTimeout(2600); await skipEx();
  for (let b = 0; b < 3; b++) {
    if (b) { await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(2600); }
    console.log(`beat: ${await page.locator('#deepbar .dp-when').innerText()} · ${await page.locator('#deepbar .dp-title').innerText()} · ${await page.locator('#deeppins button').count()} pins`);
    await shot(`story-beat-${b + 1}`);
  }
  console.log('next disabled after beat 3:', await page.locator('#deepbar [data-b=next]').isDisabled());
  const ph = await page.evaluate(() => document.getElementById('deep').getBoundingClientRect().height);
  console.log('panel at most 40%:', ph <= 0.4 * 664, Math.round(ph));
  console.log('threads:', await page.locator('#deep .dp-next button').count(), '| read:', await page.evaluate(() => localStorage.getItem('njtf.deep.read')));
  const t0 = await page.locator('#deepbar .dp-title').innerText();
  await page.locator('#deep .dp-next button').first().click(); await page.waitForTimeout(2600); await skipEx();
  console.log('thread opened another story:', (await page.locator('#deepbar .dp-title').innerText()) !== t0, '·', await page.locator('#deepbar .dp-title').innerText());
  // the illustration plays over the map on the first beat; tap skips it, Watch brings it back
  await openStory('s-mountains');
  const exBox = await page.evaluate(() => { const e = document.getElementById('deepex'), d = document.getElementById('deep'); const r = e && !e.hidden ? e.getBoundingClientRect() : null; return { shown: !!r, h: r && Math.round(r.height), sheet: Math.round(d.getBoundingClientRect().height), vh: innerHeight }; });
  console.log('illustration over the map:', JSON.stringify(exBox)); await shot('ex-overlay');
  await page.click('#deepex'); await page.waitForTimeout(600); console.log('after tap, hidden:', await page.evaluate(() => document.getElementById('deepex').hidden));
  await page.click('#deep [data-d=watch]'); await page.waitForTimeout(500); console.log('watch again shows it:', await page.evaluate(() => !document.getElementById('deepex').hidden));
  await page.waitForTimeout(30000); console.log('ends by itself:', await page.evaluate(() => document.getElementById('deepex').hidden)); await shot('ex-after');
  await page.click('#deep .dp-region'); await page.waitForTimeout(2600);
  console.log('from the story to its region:', await page.locator('#deep h1').innerText()); await shot('story-region');
  // a close-up card from the last beat, and back
  await openStory('s-rift'); await skipEx(); await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(1500); await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(2200);
  await page.locator('#deep .dp-chips button').first().click(); await page.waitForTimeout(1800);
  console.log('close-up card from the story:', await page.locator('#deep h2').innerText());
  await page.click('#deep [data-d=back]'); await page.waitForTimeout(1200); console.log('back to:', await page.locator('#deep h2').innerText(), '·', await page.locator('#deepbar .dp-when').innerText());
  // leaving during the lava: no stray caption
  await openStory('s-rift'); await skipEx(); await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(5000);
  const capMid = await page.evaluate(() => { const c = document.getElementById('deepcap'); return !!c && !c.hidden; });
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(800);
  console.log('caption during lava:', capMid, '| caption after leaving:', await page.evaluate(() => { const c = document.getElementById('deepcap'); return !!c && !c.hidden; }));
  // how it works: from the ice story, every step, then back
  await openStory('s-ice'); await skipEx();
  const hows = await page.locator('#deep .dp-how button').allInnerTexts(); console.log('how it works in the ice story:', hows.join(' | '));
  await page.locator('#deep .dp-how button').first().click(); await page.waitForTimeout(900);
  for (let k = 0; k < 6; k++) { const t = await page.locator('#deep .dp-extext').innerText(); console.log(`  step ${k + 1}: ${t.slice(0, 70)}…`); await shot(`how-icesheet-${k + 1}`);
    if (await page.locator('#deep .dp-exnav [data-d=howstep].go').count()) { await page.click('#deep .dp-exnav [data-d=howstep].go'); await page.waitForTimeout(900); } else break; }
  await page.click('#deep .dp-exnav [data-d=howback]'); await page.waitForTimeout(400); console.log('after Got it:', await page.locator('#deep h2').innerText());
  // See the real thing and the lava explainer, from the rift story
  await openStory('s-rift'); await skipEx();
  await page.click('#deep [data-d=photos]'); await page.waitForTimeout(1500);
  console.log('photos:', await page.locator('#deep .dp-photo').count(), '| loaded:', await page.evaluate(() => [...document.querySelectorAll('#deep .dp-photo img')].filter((i) => i.complete && i.naturalWidth > 0).length), '| not-NJ tags:', await page.locator('#deep .dp-phtag.far').count());
  await shot('photos'); await page.locator('#deep .dp-photo').nth(4).scrollIntoViewIfNeeded(); await shot('photos-2');
  await page.click('#deep [data-d=how][data-id=lava]'); await page.waitForTimeout(900);
  for (let k = 0; k < 8; k++) { await shot(`how-lava-${k + 1}`); if (await page.locator('#deep .dp-exnav [data-d=howstep].go').count()) { await page.click('#deep .dp-exnav [data-d=howstep].go'); await page.waitForTimeout(700); } else { console.log('lava steps:', k + 1); break; } }
  await page.click('#deep .dp-exnav [data-d=howback]'); await page.waitForTimeout(400); console.log('back from lava to:', await page.locator('#deep h1').innerText());
  await page.click('#deep [data-d=howback]'); await page.waitForTimeout(400); console.log('back from photos to:', await page.locator('#deep h2').innerText());
  // the land today
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(800); await page.click('#deep [data-d=land]'); await page.waitForTimeout(2000);
  console.log('regions:', await page.locator('#deep .dp-region').count()); await shot('land');
  for (const id of ['valleyridge', 'highlands', 'piedmont', 'coastal', 'plateau']) {
    await page.click(`#deep .dp-region[data-id=${id}]`); await page.waitForTimeout(2400);
    console.log(`region ${id}: ${await page.locator('#deep h1').innerText()} · zoom ${(await page.evaluate(() => window.__deepZoom || 0))}`); await shot(`land-${id}`);
    await page.click('#deep [data-d=land]'); await page.waitForTimeout(600);
  }
  // a close-up
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(600); await page.click('#deep [data-d=close][data-id=boonton]'); await page.waitForTimeout(2600);
  const sn = await page.locator('#deepbar .dp-dots button').count(); console.log('boonton stops:', sn);
  for (let i = 1; i < 4; i++) { await page.click('#deepbar [data-b=next]'); await page.waitForTimeout(1800); console.log(`  stop ${i + 1}: ${await page.locator('#deepbar .dp-title').innerText()}`); }
  await shot('close-boonton');
  await page.click('#deep .dp-card'); await page.waitForTimeout(1800); console.log('card:', await page.locator('#deep h2').innerText());
  await page.click('#deep [data-d=back]'); await page.waitForTimeout(800);
  await page.click('#deep [data-d=chain]'); console.log('chain steps:', await page.locator('.dp-chain li').count()); await page.click('#deep [data-d=back]');
  await page.click('#deep [data-d=order]');
  const yr = Object.fromEntries(await page.evaluate(async () => { const m = await import('./js/deepcards.js'); return Object.values(m.CARD).map((c) => [c.title, c.year]); }));
  for (let k = 0; k < 5; k++) { const opts = await page.locator('.dp-pick button').allInnerTexts(); if (!opts.length) break; const oldest = opts.sort((a, c) => yr[a] - yr[c])[0]; await page.locator('.dp-pick button', { hasText: oldest }).first().click(); await page.waitForTimeout(200); }
  console.log('order:', (await page.locator('#deep .tr-res').innerText().catch(() => 'no result')).split('\n')[0]);
  await page.click('#deep [data-d=back]'); await page.click('#deep [data-d=why]'); await page.locator('[data-d=whypick]').first().click(); await page.waitForTimeout(200);
  console.log('why:', await page.locator('#deep .tr-res b').innerText());
  // the Pine Barrens close-up
  await page.click('#deep [data-d=back]'); await page.click('#deep [data-d=intro]'); await page.waitForTimeout(500); await page.click('#deep [data-d=close][data-id=pine]'); await page.waitForTimeout(2200);
  console.log('pine:', await page.locator('#deepbar .dp-title').innerText(), '·', await page.locator('#deepbar .dp-dots button').count(), 'stops'); await shot('close-pine');
  // Home on top, and back
  await page.click('#deep [data-d=intro]'); await page.waitForTimeout(400); await page.click('#deep [data-d=home]'); await page.waitForTimeout(500);
  console.log('home over deep:', await page.evaluate(() => !document.getElementById('welcome').hidden && document.getElementById('deep').hidden && document.getElementById('deepbar').hidden));
  await page.click('#welcome [data-entry=deep]'); await page.waitForTimeout(800); console.log('back in deep:', await page.evaluate(() => !document.getElementById('deep').hidden));
  console.log('errors', errs.length); await b.close(); })();
