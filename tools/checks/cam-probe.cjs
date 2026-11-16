// Orbit camera probe: start "Name that place" on one place, then on another, and log the camera every frame through the swing over and the
// first seconds of the orbit. Prints the motion's stops and jolts (speed falling to near zero mid-flight, or jumping between frames) and saves frames.
//   NODE_PATH=$(npm root -g) node tools/checks/cam-probe.cjs "From name" "To name" [kind]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const [A, B, kind = ''] = process.argv.slice(2); const out = process.env.OUT || 'cam'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8077/index.html?debug=1&region=nj'); await page.waitForSelector('#welcome [data-entry]');
  await page.click('[data-entry=normal]'); await page.waitForTimeout(2500);
  const start = (n) => page.evaluate((n) => window.njtf.orbit.start({ header: () => '<div class="score"></div>', bindHeader: () => {}, names: [n], only: undefined, rounds: 1, title: 'probe' }), n);
  await start(A); await page.waitForTimeout(9000);
  await page.evaluate(() => { const m = window.njtf.map; window.__cam = []; const t0 = performance.now(); m.on('render', () => { const c = m.getCenter(); window.__cam.push([performance.now() - t0, c.lng, c.lat, m.getZoom(), m.getBearing(), m.getPitch()]); }); });
  await start(B);
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/f${i}.png` }); }
  await page.waitForTimeout(3000);
  const cam = await page.evaluate(() => window.__cam);
  // speed per frame: ground metres/s at the current zoom expressed in screen px/s, plus zoom and bearing rates
  const rows = [];
  for (let i = 1; i < cam.length; i++) {
    const [t0, x0, y0, z0, b0, p0] = cam[i - 1], [t1, x1, y1, z1, b1, p1] = cam[i]; const dt = (t1 - t0) / 1000; if (dt <= 0) continue;
    const mpp = 78271.5 * Math.cos(y1 * Math.PI / 180) / Math.pow(2, z1);
    const px = Math.hypot((x1 - x0) * 84200, (y1 - y0) * 111000) / mpp / dt;
    let db = b1 - b0; db = ((db + 540) % 360) - 180;
    rows.push({ t: t1, px, z: (z1 - z0) / dt, b: db / dt, p: (p1 - p0) / dt, zoom: z1 });
  }
  const mag = (r) => Math.hypot(r.px / 300, r.z / 1.2, r.b / 40, r.p / 30);   // one motion measure: screen pan, zoom, turn and tilt on similar scales
  const m = rows.map(mag); const peak = Math.max(...m);
  const moving = m.map((v) => v > peak * 0.06);
  const firstMove = moving.indexOf(true), endMove = moving.lastIndexOf(true);
  let stops = 0; for (let i = firstMove + 1; i < endMove; i++) if (moving[i - 1] && !moving[i]) stops++;
  let jolts = 0; for (let i = 1; i < m.length; i++) if (Math.abs(m[i] - m[i - 1]) > peak * 0.35) jolts++;
  console.log(`${A} -> ${B}: frames ${rows.length}, ${(rows.at(-1).t / 1000).toFixed(1)} s logged, peak motion ${peak.toFixed(2)}, stops mid-flight ${stops}, frame-to-frame jolts ${jolts}`);
  // a coarse timeline (every ~250 ms): t, motion, zoom
  const line = []; let next = 0; for (const r of rows) if (r.t >= next) { line.push(`${(r.t / 1000).toFixed(2)}:${mag(r).toFixed(2)}/z${r.zoom.toFixed(1)}`); next = r.t + 250; }
  console.log(line.join('  '));
  console.log('errors', errs.length); await b.close(); })();
