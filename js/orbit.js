// "Name that tower": the camera circles one skyscraper, slowly, alone in a faint ghost of the city; which is it?
//
// Ten towers a round, four names to choose from. Hints cost a point (neighborhood, then height and year, then the corner it
// stands on). The towers you miss come round more often. The shapes are the same ones Explore and the drive games stand up
// (NYC's footprints and the surveyed towers); the base map's labels are hidden so nothing gives the name away.
import { buildingFeatures, applySurveyTowers, loadSurveyTowers, groundFeatures, GROUND_PAINT } from './city3d.js';

const KEY = 'orbit';
const ROUND = 10;
const SPIN = 7; // degrees a second: a full turn in under a minute
const PITCH = 64;
const AREAS = ['downtown', 'midtown', 'uptown'];
const ALIAS = { '30 Rockefeller Plaza': 'Rockefeller Center', 'Time Warner Center': 'Columbus Circle' }; // (the landmark photos)

export function initOrbit(ctx) {
  const { map } = ctx;
  let run = null; // the session
  let q = null; // the question
  let raf = 0;
  let city = null; // loaded once: { feats, cx, cy, list, pics }
  let loading = null;
  let hiddenSymbols = [];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
  const stats = () => ctx.store.get(KEY, {});
  const ft = (m) => Math.round((m * 3.28084) / 10) * 10;
  const mDist = (a, b) => Math.hypot((a[0] - b[0]) * 84200, (a[1] - b[1]) * 111000);

  async function load() {
    if (city) return city;
    if (loading) return loading;
    loading = (async () => {
      const [list, pics, towers, ...rest] = await Promise.all([
        fetch('data/skyscrapers.json').then((r) => r.json()),
        fetch('data/landmark-credits.json').then((r) => r.json()).catch(() => ({})),
        loadSurveyTowers(),
        ...AREAS.map((a) => fetch(`data/buildings-${a}.json`).then((r) => r.json())),
        ...AREAS.map((a) => fetch(`data/ground-${a}.json`).then((r) => r.json()).catch(() => null)),
      ]);
      const files = rest.slice(0, 3), grounds = rest.slice(3);
      const feats = applySurveyTowers(files.flatMap((d) => buildingFeatures(d)), towers);
      const cx = feats.map((f) => {
        const r = f.geometry.coordinates[0];
        let x = 0, y = 0;
        for (const p of r) { x += p[0]; y += p[1]; }
        return [x / r.length, y / r.length];
      });
      city = { feats, cx, list, pics, grounds: grounds.filter(Boolean).flatMap(groundFeatures) };
      return city;
    })();
    return loading;
  }

  function layers() {
    if (map.getSource('orb-city')) return;
    const first = map.getStyle().layers.find((l) => l.type === 'symbol');
    const before = first && first.id;
    map.addSource('orb-ground', { type: 'geojson', data: { type: 'FeatureCollection', features: city.grounds } });
    for (const k of ['walk', 'road', 'park'])
      map.addLayer({ id: 'orb-' + k, type: 'fill', source: 'orb-ground', filter: ['==', ['get', 'k'], k], layout: { visibility: 'none' }, paint: GROUND_PAINT[k] }, before);
    map.addSource('orb-city', { type: 'geojson', generateId: true, data: { type: 'FeatureCollection', features: city.feats } });
    map.addSource('orb-target', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const col = ['case', ['has', 'c'], ['get', 'c'], ['interpolate', ['linear'], ['get', 'h'], 6, '#e9e3d6', 60, '#d6cdbb', 200, '#bdb29d', 300, '#a99d88']];
    map.addLayer(
      {
        id: 'orb-ghost', type: 'fill-extrusion', source: 'orb-city', layout: { visibility: 'none' },
        paint: { 'fill-extrusion-color': '#9fb0c0', 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': ['coalesce', ['get', 'b'], 0], 'fill-extrusion-opacity': 0.24, 'fill-extrusion-vertical-gradient': false },
      },
      before
    );
    map.addLayer(
      {
        id: 'orb-target', type: 'fill-extrusion', source: 'orb-target', layout: { visibility: 'none' },
        paint: { 'fill-extrusion-color': col, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': ['coalesce', ['get', 'b'], 0], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true },
      },
      before
    );
  }
  const show = (on) => {
    for (const id of ['orb-walk', 'orb-road', 'orb-park', 'orb-ghost', 'orb-target']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    if (on) {
      // no names on the map while this runs
      hiddenSymbols = map.getStyle().layers.filter((l) => (l.type === 'symbol' || l.type === 'circle') && map.getLayoutProperty(l.id, 'visibility') !== 'none').map((l) => l.id);
      for (const id of hiddenSymbols) map.setLayoutProperty(id, 'visibility', 'none');
    } else {
      for (const id of hiddenSymbols) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      hiddenSymbols = [];
    }
  };

  /** The tower to ask about next: the ones missed before come round more often, never the same twice running. */
  function pick() {
    const st = stats();
    const w = city.list.map((t) => {
      if (run.seen.includes(t.n)) return 0;
      const s = st[t.n] || { r: 0, w: 0 };
      const n = s.r + s.w;
      return n === 0 ? 3 : 1 + 4 * (s.w / n);
    });
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) if ((x -= w[i]) <= 0) return city.list[i];
    return city.list.find((t) => !run.seen.includes(t.n)) || rand(city.list);
  }
  function choicesFor(t) {
    const others = city.list.filter((o) => o.n !== t.n);
    const near = shuffle(others.filter((o) => Math.abs(o.h - t.h) / t.h < 0.3));
    const far = shuffle(others);
    const out = [];
    for (const o of [...near.slice(0, 2), ...far]) if (out.length < 3 && !out.includes(o)) out.push(o);
    return shuffle([t, ...out]);
  }

  /** Make this tower the solid one: everything standing within 60 m that is part of it, the rest left as the ghost. */
  function focus(t) {
    const p = t.p;
    const ids = [], mine = [];
    city.feats.forEach((f, i) => {
      if (mDist(city.cx[i], p) > 60) return;
      const tall = f.properties.h >= 0.45 * t.h || f.properties.c !== undefined;
      if (tall) {
        ids.push(i);
        mine.push(f);
      }
    });
    map.getSource('orb-target').setData({ type: 'FeatureCollection', features: mine });
    map.setFilter('orb-ghost', ['!', ['in', ['id'], ['literal', ids.length ? ids : [-1]]]]);
  }

  function camera(t, spin0) {
    cancelAnimationFrame(raf);
    // zoomed out far enough to see the whole tower; its foot sits in the lower part of the free area, so it rises into the rest
    const zoom = Math.max(14.6, Math.min(16.6, 16.95 - t.h * 0.0043));
    const pad = ctx.padding();
    const free = Math.max(120, window.innerHeight - pad.top - pad.bottom);
    const top = pad.top + free * 0.34;
    let bearing = spin0;
    let last = performance.now();
    map.jumpTo({ center: t.p, zoom, pitch: PITCH, bearing, padding: { top, bottom: pad.bottom, left: 0, right: 0 } });
    const tick = (now) => {
      if (!run || q.t !== t) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        bearing = (bearing + SPIN * dt * (ctx.reduceMotion ? 0.3 : 1)) % 360;
        map.setBearing(bearing);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  async function start(opts) {
    stop();
    run = { opts, n: 0, pts: 0, right: 0, seen: [], misses: [], streak: 0, done: false, loading: true };
    document.body.classList.add('framing');
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    ctx.hud('<div class="qkind">🏙 Name that tower</div><div class="q">Loading the skyline…</div>');
    try {
      await load();
    } catch {
      if (run) ctx.hud('<div class="qkind">🏙 Name that tower</div><div class="q">Couldn’t load the buildings.</div>');
      return;
    }
    if (!run) return;
    run.loading = false;
    layers();
    map.setMaxPitch(70);
    show(true);
    next();
  }
  function stop() {
    cancelAnimationFrame(raf);
    if (!run) return;
    run = null;
    q = null;
    document.body.classList.remove('framing');
    show(false);
    map.easeTo({ pitch: 0, duration: ctx.dur ? ctx.dur(400) : 400 });
  }
  function next() {
    if (!run) return;
    if (run.n >= ROUND) {
      run.done = true;
      q = null;
      cancelAnimationFrame(raf);
      return render();
    }
    const t = (run.n === 0 && run.opts.first && city.list.find((x) => x.n === run.opts.first)) || pick();
    run.seen.push(t.n);
    q = { t, choices: choicesFor(t), hints: 0, picked: null, done: false };
    focus(t);
    camera(t, Math.random() * 360);
    render();
  }
  const HINTS = [
    (t) => `It stands in <b>${esc(t.hood)}</b>.`,
    (t) => `<b>${t.h} m</b> (${ft(t.h)} ft), finished in <b>${t.y}</b>.`,
    (t) => `You'd find it at <b>${esc(t.at)}</b>.`,
  ];
  function hint() {
    if (!q || q.done || q.hints >= HINTS.length) return;
    q.hints++;
    render();
  }
  function answer(name) {
    if (!q || q.done) return;
    const t = q.t;
    q.done = true;
    q.picked = name;
    q.ok = name === t.n;
    const pts = q.ok ? Math.max(1, 3 - q.hints) : 0;
    run.n++;
    run.pts += pts;
    q.pts = pts;
    if (q.ok) {
      run.right++;
      run.streak++;
    } else {
      run.streak = 0;
      run.misses.push(t.n);
    }
    const st = stats();
    const s = st[t.n] || { r: 0, w: 0 };
    q.ok ? s.r++ : s.w++;
    st[t.n] = s;
    ctx.store.set(KEY, st);
    render();
  }

  function reveal() {
    const t = q.t;
    const pic = city.pics[t.n] || city.pics[ALIAS[t.n]];
    return `<div class="fb ${q.ok ? 'ok' : 'no'} orb-reveal">
      ${pic ? `<img src="${esc(pic.img)}" alt="" />` : ''}
      <div><b>${q.ok ? '✓' : '✗'} ${esc(t.n)}</b> <span class="muted">${q.ok ? `+${q.pts}` : ''}</span><br>
      ${esc(t.line)}.<br><span class="muted">${t.h} m (${ft(t.h)} ft) · ${t.y} · ${esc(t.at)}</span></div>
    </div>`;
  }
  function render() {
    if (!run || run.loading) return;
    if (run.done) {
      const best = run.pts + '/' + ROUND * 3;
      ctx.hud(`<div class="qkind">🏙 Name that tower</div><div class="q">Round done: <b>${best}</b></div>`);
      ctx.sheet(`${run.opts.header()}<div id="qbody">
        <div class="score">${run.right}/${ROUND} named · ${run.pts} points</div>
        ${run.misses.length ? `<div class="fb no">To look at again: ${run.misses.map(esc).join(', ')}</div>` : '<div class="fb ok">Every one named.</div>'}
        <button class="primary" id="orbAgain">Another ten</button></div>`);
      run.opts.bindHeader();
      document.getElementById('orbAgain')?.addEventListener('click', () => start(run.opts));
      return;
    }
    const hints = HINTS.slice(0, q.hints).map((h) => `<div class="orb-hint">${h(q.t)}</div>`).join('');
    ctx.hud(`<div class="qkind">🏙 Name that tower · ${run.n + (q.done ? 0 : 1)}/${ROUND}</div><div class="q">${q.done ? (q.ok ? 'Yes.' : 'Not quite.') : 'Which tower is this?'}</div>${hints}`);
    const btn = (c) => {
      const cls = q.done ? (c.n === q.t.n ? ' right' : c.n === q.picked ? ' wrong' : '') : '';
      return `<button class="orb-choice${cls}" data-n="${esc(c.n)}"${q.done ? ' disabled' : ''}>${esc(c.n)}</button>`;
    };
    ctx.sheet(`${run.opts.header()}<div id="qbody">
      <div class="score">${run.pts} points${run.streak >= 3 ? ` · 🔥 ${run.streak}` : ''}</div>
      <div class="orb-choices">${q.choices.map(btn).join('')}</div>
      ${q.done ? `${reveal()}<button class="primary" id="orbNext">${run.n >= ROUND ? 'Finish' : 'Next tower'}</button>` : `<button id="orbHint"${q.hints >= HINTS.length ? ' disabled' : ''}>💡 Hint (−1 point)</button>`}
    </div>`);
    run.opts.bindHeader();
    for (const b of document.querySelectorAll('.orb-choice')) b.addEventListener('click', () => answer(b.dataset.n));
    document.getElementById('orbNext')?.addEventListener('click', next);
    document.getElementById('orbHint')?.addEventListener('click', hint);
  }

  return {
    start,
    stop,
    get running() {
      return !!run;
    },
    _state: () => ({ run, q }),
  };
}
