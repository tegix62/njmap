// The six multiple-choice kinds added in the normal-mode round: each asks, takes an answer and shows feedback, in a focus area.
//   python3 -m http.server 8077 ; NODE_PATH=$(npm root -g) node tools/checks/ui-newkinds.cjs   (frames in $OUT)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const out = process.env.OUT || 'frames'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry]:not([data-entry=goblin])'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.njtf.modes.practice.setArea('focus:ne'));
  for (const k of ['county', 'nearest', 'howfar', 'hwytown', 'lmwhich', 'countynb']) {
    for (let i = 0; i < 3; i++) {
      await page.evaluate((k) => window.njtf.modes.practice.choose(k), k); await page.waitForTimeout(i ? 500 : 1700);
      const ask = (await page.locator('#hud .q').innerText()).replace(/\n/g, ' ');
      const kind = await page.locator('#hud .qkind').innerText();
      const n = await page.locator('#qbody .choice').count();
      if (i === 0) await page.screenshot({ path: `${out}/${k}-ask.png` });
      await page.locator('#qbody .choice').nth(i % n).click(); await page.waitForTimeout(i ? 300 : 1500);
      const fb = (await page.locator('#qbody .fb').innerText()).replace(/\n/g, ' ').slice(0, 170);
      if (i === 0) await page.screenshot({ path: `${out}/${k}-answer.png` });
      console.log(`${k} [${kind}] ${ask} (${n} choices) -> ${fb}`);
    }
  }
  const areas = await page.evaluate(() => { window.njtf.modes.practice.choose('find'); return [...document.querySelectorAll('#qArea optgroup[label="Focus areas"] option')].map((o) => o.textContent); });
  console.log('focus areas:', areas.join(' | ')); console.log('errors', errs.length); await b.close(); })();
