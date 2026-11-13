// A performance test you run on your own phone: Settings → "Run performance test".
//
// It turns the map in the current region for 6 s in each look and effects setting, timing every frame as the phone really draws it, and shows a table
// (average frame time, the slowest 5%, frames that took over 50 ms, the render ratio). Nothing here reads the battery or temperature (a web page on
// an iPhone cannot), so frame time is the measure: a slower frame means the GPU was busy longer, and busy time is heat and battery.
//   ctx.perfTest.run()
export function createPerfTest(ctx) {
  const { map } = ctx;
  const CONFIGS = [['plain', 'saver'], ['plain', 'full'], ['paper', 'saver'], ['paper', 'full'], ['ps1', 'saver'], ['ps1', 'full']];

  const frames = (ms) => new Promise((resolve) => {
    const dts = [];
    let last = performance.now(), t0 = last, bearing = map.getBearing();
    const step = (now) => {
      dts.push(now - last);
      last = now;
      bearing = (bearing + 0.35) % 360;
      map.setBearing(bearing);
      if (now - t0 < ms) requestAnimationFrame(step); else resolve(dts.slice(2));
    };
    requestAnimationFrame(step);
  });

  const stats = (d) => {
    const s = [...d].sort((a, b) => a - b), n = s.length;
    const avg = d.reduce((a, b) => a + b, 0) / n;
    return { fps: +(1000 / avg).toFixed(0), avg: +avg.toFixed(1), p95: +s[Math.floor(n * 0.95)].toFixed(1), slow: d.filter((x) => x > 50).length, n };
  };

  async function run() {
    let dlg = document.getElementById('perfDlg');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'perfDlg'; document.body.appendChild(dlg); dlg.addEventListener('click', (e) => e.target === dlg && dlg.close()); }
    const keep = { look: ctx.looks.look, effects: ctx.settings.effects };
    const rows = [];
    dlg.innerHTML = '<h2>Performance test</h2><p id="perfMsg">Starting…</p>';
    dlg.showModal();
    const msg = (t) => { const e = document.getElementById('perfMsg'); if (e) e.textContent = t; };
    document.querySelector('#settings')?.close?.();
    map.stop();
    const c = map.getCenter();
    map.jumpTo({ center: c, zoom: Math.max(8.5, Math.min(map.getZoom(), 10.5)), pitch: 45 });
    for (let i = 0; i < CONFIGS.length; i++) {
      const [look, eff] = CONFIGS[i];
      msg(`Test ${i + 1} of ${CONFIGS.length}: ${look}, ${eff}…`);
      ctx.settings.effects = eff;
      ctx.looks.set(look);
      ctx.looks.refresh();
      await new Promise((r) => setTimeout(r, 1500));            // let tiles and layers settle
      dlg.close();                                              // (the dialog itself must not be in the way of the frames)
      const d = await frames(6000);
      dlg.showModal();
      rows.push({ look, eff, ratio: +map.getPixelRatio().toFixed(2), ...stats(d) });
    }
    ctx.settings.effects = keep.effects;
    ctx.looks.set(keep.look);
    ctx.looks.refresh();
    map.setPitch(0);
    const head = 'look      effects  ratio  fps  avg ms  slowest5% ms  frames>50ms';
    const text = [head, ...rows.map((r) => `${r.look.padEnd(9)} ${r.eff.padEnd(8)} ${String(r.ratio).padEnd(6)} ${String(r.fps).padEnd(4)} ${String(r.avg).padEnd(7)} ${String(r.p95).padEnd(13)} ${r.slow}`)].join('\n');
    dlg.innerHTML = `<h2>Performance test</h2><pre id="perfOut">${text}</pre><p class="muted">Lower ms and higher fps are better. Send me a screenshot of this.</p><button class="primary" id="perfClose">Close</button>`;
    document.getElementById('perfClose').addEventListener('click', () => dlg.close());
    return rows;
  }
  return { run };
}
