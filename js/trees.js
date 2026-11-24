// Trees of New Jersey: the app's way of teaching places, pointed at trees. A few minutes a day; a tree is met once (its photos and its tell),
// then comes back spaced out over days, each time from a different side: its leaf, its bark, its shape, its fruit; named from a photo, picked
// out of four photos, matched across two photos, and one fact about its leaves. Where it has been seen in New Jersey is shown on the map.
// Data: data/trees.json (tools/build_trees.py: iNaturalist photos and sightings; the tells were checked against Wikipedia in November 2026, see the README).
import { GROUPS, GROUP_OF, KEY, ICON, pathTo, treesUnder } from './treekey.js';
import { leafSvg, twigSvg, HAS_LEAF, HAS_OUTLINE, outlineSource, leafVariants } from './treeleaf.js';
import { SKILLS, DRILL_N, PASS } from './treeskills.js';
import { PROFILE, barkKindOf } from './treeprofile.js';
import { juice } from './juice.js';
import { ASPECT_WORD, idLine, aspectOf } from './treeid.js';
import { distanceMi, bearing, compass8 } from './geo.js';
const DAYS = [0, 1, 3, 7, 16, 35];
const DAY = 864e5;
const NEW_PER_DAY = 3, SET = 10;
const CTX = { leaf: 'leaf', bark: 'bark', form: 'whole tree', fruit: 'fruit', flower: 'flower', fall: 'autumn', twig: 'twig and buds', winter: 'winter' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
const today = () => new Date().toLocaleDateString('en-CA');

export function initTrees(ctx) {
  const { map, store } = ctx;
  let walk = null, PTS = null, mine = {}, combo = 0;
  const leafSrc = (id) => (outlineSource(id) || {}).img || null;
  /** One of a tree's traced leaves for a question: any of them, a fall one more often in fall. */
  const leafAny = (id) => { const vs = leafVariants(id); if (vs.length < 2) return vs[0] || null; const fl = vs.filter((v) => v.season === 'fall'); return season() === 'fall' && fl.length && Math.random() < 0.6 ? rand(fl) : rand(vs); };
  const leafAnySrc = (id) => (leafAny(id) || {}).img || leafSrc(id);
  const fallTag = (v) => (v && v.season === 'fall' ? '<small class="tr-lfseason">a fall leaf</small>' : '');
  /** The feel of an answer: a climbing chime, a burst of the tree's own leaves from the right button and a pop; or a thud and a shake. */
  function feel(ok, picked, id) {
    const right = root.querySelector('.right');
    if (ok) { combo++; juice.right(combo); juice.burst(right || picked, leafSrc(id)); juice.pop(right || picked); }
    else { combo = 0; juice.wrong(); juice.shake(picked); if (right) juice.pop(right); }
  }
  const comboChip = () => (combo >= 3 ? `<span class="jc-combo">${combo} in a row</span>` : '');
  // ---- waves: trees come a few at a time. The first wave is open from the start; the next opens once every tree of the one before is
  // met and answered right at least twice. Until then its trees are left out everywhere (questions, choices, guide, games).
  const WAVE_NAME = { 1: 'The first trees', 2: 'Roadsides and town edges', 3: 'Into the woods', 4: 'Wet ground and the south' };
  let ALL = null;
  const waveOf = (t) => t.wave || 1;
  const openWaves = () => { const w = store.get('trees.waves', [1]); return w.includes(1) ? w : [1, ...w]; };
  function applyWaves() {
    const w = openWaves(); D.trees = ALL.filter((t) => w.includes(waveOf(t))); by = new Map(D.trees.map((t) => [t.id, t]));
    if (H) { H.trees = D.trees; H.by = by; }
  }
  function waveState() {
    const w = Math.max(...openWaves()), inW = ALL.filter((t) => waveOf(t) === w), m = store.get('trees.met', []), st = store.get('trees.stats', {});
    const sure = inW.filter((t) => m.includes(t.id) && (st[t.id] || [0, 0])[1] >= 2).length;
    const next = ALL.filter((t) => waveOf(t) === w + 1);
    return { w, n: inW.length, metN: inW.filter((t) => m.includes(t.id)).length, sure, next: next.length ? w + 1 : 0, nextTrees: next };
  }
  /** Opens the next wave if the current one is known; returns its number (or 0). */
  function waveCheck() {
    const s = waveState(); if (!s.next || s.sure < s.n) return 0;
    store.set('trees.waves', [...openWaves(), s.next]); applyWaves(); return s.next;
  }
  function waveOpened(w) {
    const ts = ALL.filter((t) => waveOf(t) === w);
    setTimeout(() => { juice.done(true); const src = (x) => leafSrc(x.id), mine = ts.map(src).filter(Boolean); juice.fall(mine.length ? mine : D.trees.map(src).filter(Boolean)); }, 150);
    frame(back(), `<div class="tr-done tn-wavenew"><span class="tr-kick">Wave ${w} is open</span><h2>${esc(WAVE_NAME[w] || `Wave ${w}`)}</h2><p>You know every tree of the last wave. ${ts.length} new trees join today’s lessons, a couple a day, mixed in with the ones you know.</p>
      <div class="tn-wavelist">${ts.map((t) => `<button class="tr-li" data-t="card" data-id="${t.id}"><span class="tk-li-sil">${leafArt(t.id)}</span><span><b>${esc(t.name)}</b><small>${esc(t.sci)}</small></span></button>`).join('')}</div>
      <button class="tr-go" data-t="today">Start today</button><button class="tr-card wide" data-t="hub"><b>Back to the trees</b></button></div>`);
  }
  function waveCardHtml() {
    const s = waveState();
    if (!s.next) return s.w > 1 ? `<div class="tn-wave"><b>All ${s.w} waves open</b><small>${ALL.length} trees</small></div>` : '';
    const pct = Math.round((100 * s.sure) / Math.max(1, s.n));
    return `<div class="tn-wave"><div><b>Wave ${s.w} · ${esc(WAVE_NAME[s.w] || '')}</b><small>${s.metN} of ${s.n} met · ${s.sure} answered right twice</small></div>
      <div class="tn-wavebar"><i style="width:${pct}%"></i></div><small>Wave ${s.next}, <b>${esc(WAVE_NAME[s.next] || '')}</b> (${s.nextTrees.length} trees), opens when all ${s.n} are met and answered right twice.</small></div>`;
  }
  let D = null, by = null, root = null, q = null, run = null, layer = false, H = null, G = null, POOL = null, quick = null, picking = false;

  async function load() {
    if (D) return;
    let X;
    [D, G, POOL, X] = await Promise.all(['data/trees.json', 'data/treegrid.json', 'data/treepool.json', 'data/treeextra.json'].map((f) => fetch(f).then((r) => r.json())));
    ALL = D.trees; by = new Map(ALL.map((t) => [t.id, t]));      // every tree, for the merges below; narrowed to the open waves after
    // pictures added by hand from Wikimedia Commons (tools/build_incoming.py): more photos, and botanists' drawings
    for (const [id, x] of Object.entries(X)) { const t = by.get(id); if (!t) continue; t.photos.push(...x.photos.map((p) => ({ ...p, via: 'Wikimedia Commons' }))); t.drawings = x.drawings; }
    // bark photos picked by eye from each tree's photo pool (iNaturalist, New Jersey first): many trunks per tree for bark practice
    for (const [id, fs] of Object.entries(POOL.bark || {})) {
      const t = by.get(id), cr = new Map((POOL.trees[id] || []).map((pp) => [pp[0], pp[2]])); if (!t) continue;
      t.photos.push(...fs.map((f) => { const [pid, ext] = f.split('.'); return { f: `${POOL.base}${pid}/${POOL.size}.${ext}`, ctx: 'bark', credit: cr.get(f) || '', pool: f }; }));
    }
    H = { trees: D.trees, by, photoOf, img, esc };
    applyWaves();
    mine = await myPhotos();
  }
  // ---- the skills of looking: learned once (a lesson, then a short practice that must go well), and asked again now and then
  const skills = () => store.get('trees.skills', {});
  const skillDone = (sk) => !!(skills()[sk] && skills()[sk].done);
  function skillResult(sk, right, n) {
    const all = skills(), cur = all[sk] || {};
    all[sk] = { done: cur.done || right >= PASS, best: Math.max(cur.best || 0, right), tries: (cur.tries || 0) + 1, n };
    store.set('trees.skills', all);
    return all[sk].done;
  }
  // ---- what you know: the same boxes as the town quiz, one per tree
  const srs = () => store.get('trees.srs', {});
  const met = () => store.get('trees.met', []).filter((id) => by.has(id));
  const isDue = (id, s = srs()) => !s[id] || s[id].due <= Date.now();
  function record(id, ok) {
    const s = srs(), cur = s[id] || { b: 0, due: 0 };
    if (ok) { const b = Math.min(cur.b + 1, DAYS.length - 1); s[id] = { b, due: Date.now() + DAYS[b] * DAY }; }
    else s[id] = { b: 0, due: Date.now() + 10 * 60e3 };
    store.set('trees.srs', s);
    const st = store.get('trees.stats', {}); const [n = 0, r = 0] = st[id] || []; st[id] = [n + 1, r + (ok ? 1 : 0)]; store.set('trees.stats', st);
  }
  const learned = () => { const s = srs(); return met().filter((id) => s[id] && s[id].b >= 3).length; };
  function streak() {
    const days = store.get('trees.days', []); let n = 0; const d = new Date();
    if (!days.includes(today())) d.setDate(d.getDate() - 1);
    while (days.includes(d.toLocaleDateString('en-CA'))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---- trees near you: the sightings grid around your spot, ranked on this device (the spot never leaves it)
  const spot = () => store.get('trees.spot', null);
  function nearCounts(pt) {
    const { cell, lon0, lat0 } = G, cx = (pt[0] - lon0) / cell, cy = (pt[1] - lat0) / cell, R = 4, sig = 1.6;
    const out = {};
    for (const [id, cells] of Object.entries(G.trees)) {
      let w = 0, n = 0;
      for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
        const k = `${Math.floor(cx) + dx},${Math.floor(cy) + dy}`, c = cells[k]; if (!c) continue;
        const d2 = (Math.floor(cx) + dx + 0.5 - cx) ** 2 + (Math.floor(cy) + dy + 0.5 - cy) ** 2;
        w += c * Math.exp(-d2 / (2 * sig * sig)); if (d2 <= 4) n += c;
      }
      out[id] = { w, n };
    }
    return out;
  }
  /** Every tree, most-seen near your spot first (statewide sightings when no spot is set or few are nearby). */
  function ranked() {
    const sp = spot(), nc = sp ? nearCounts(sp.pt) : null;
    const local = nc && Object.values(nc).reduce((a, b) => a + b.n, 0) >= 40;
    const score = (t) => (local ? nc[t.id].n + nc[t.id].w / 1e4 : 0) * 1000 + t.count / 1000;
    return { list: [...D.trees].sort((a, b) => score(b) - score(a)), nc: local ? nc : null };
  }
  const LOCAL_N = 10;
  // the season, from today's date: what you can see on the trees this week
  const season = () => ({ 12: 'winter', 1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer', 9: 'fall', 10: 'fall', 11: 'fall' })[new Date().getMonth() + 1];
  const SEASON_LINE = {
    spring: 'Spring: flowers and new leaves. Red maples flower red before their leaves; dogwoods bloom white.',
    summer: 'Summer: full leaves. A good time for leaf shapes, and for pairs or one at a time.',
    fall: 'Fall: leaves turning and dropping. Look at the colour, and at the leaves on the ground under each tree.',
    winter: 'Winter: bare branches. Look at bark, buds and the shape of the tree; evergreens stand out.',
  };
  const SEASON_CTX = { spring: ['flower', 'leaf'], summer: ['leaf', 'fruit'], fall: ['fall', 'leaf', 'fruit'], winter: ['bark', 'form', 'twig'] };
  const hidden = () => store.get('trees.hidden', []);
  /** A photo from a tree's big pool, preferring this season, never one you hid: [url, credit, file]. */
  function poolPhoto(id, avoid) {
    const ps = (POOL.trees[id] || []).filter((p) => !hidden().includes(p[0]) && p[0] !== avoid);
    if (!ps.length) { const p = photoOf(by.get(id)); return [p.f, p.credit, null]; }
    const now = ps.filter((p) => p[1] === season()), p = rand(now.length && Math.random() < 0.7 ? now : ps);
    const [pid, ext] = p[0].split('.');
    return [`${POOL.base}${pid}/${POOL.size}.${ext}`, p[2], p[0]];
  }

  // ---- trees in 3D (js/tree3d.js, loaded only when first needed: three.js is large)
  let T3 = null, st3 = null;
  const has3d = (id) => ['white-pine', 'pin-oak', 'sweetgum', 'red-maple'].includes(id);
  async function stage3d(el) { T3 = T3 || await import('./tree3d.js'); if (st3) st3.dispose(); st3 = T3.stage(el); return st3; }
  function drop3d() { if (st3) { st3.dispose(); st3 = null; } grow = null; }
  const SEASON_WORD = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };
  async function show3d(id, season) {
    const el = root.querySelector('.t3-stage'); if (!el) return;
    for (const b of root.querySelectorAll('[data-t=t3season]')) b.classList.toggle('on', b.dataset.s === season);
    const s3 = st3 && el.contains(st3.el) ? st3 : await stage3d(el); s3.el = el.querySelector('canvas'); s3.set(id, season);
  }
  // Watch it grow: one tree from seed to old age and death, seasons turning each year (js/tree3d.js lifeStage)
  let grow = null;
  const STAGE = (L, a, h) => a >= L.life + 4 ? 'Fallen: a log, feeding the soil' : a >= L.life ? 'Dead, still standing (a snag)' : a < 2 ? 'Seedling' : h < 4 ? 'Sapling' : a < L.decline * 0.35 ? 'Young tree' : a < L.decline ? 'Mature tree' : 'Old tree';
  // the story, beat by beat: each beat maps its own progress p (0..1) to an age, a season (held, or turning), the seed or sprout, a camera, a line
  function beatsFor(st, story) {
    const L = st.L, Hm = L.Hmax, hAt = (a) => st.height(a);
    let prime = 1; while (prime < L.decline * 0.6 && hAt(prime) < 0.92 * Hm) prime++;
    const sap = L.evergreen ? 6 : 4, cr = st.crown();
    const fit = (a) => { const h = Math.max(0.5, hAt(a)), c = Math.max(0.5, cr * Math.min(1, h / Hm)); return { look: h * 0.45, dist: Math.max(2.4, h * 1.6 + c * 0.6), up: Math.max(1, h * 0.5), lx: 0 }; };
    const Ln = story.lines;
    return [
      { id: 'seed', name: 'Seed', dur: 6.5, line: Ln.seed, at: (p) => ({ age: 0, sf: story.seedSeason, seed: p, view: { look: 0.45, dist: 1.5, up: 0.9, lx: 0, man: false } }) },
      { id: 'sprout', name: 'Sprout', dur: 6, line: Ln.sprout, at: (p) => ({ age: 0, sf: 0.5, sprout: { x: 0, z: 0, s: 0.35 + 0.65 * Math.min(1, p * 1.6) }, view: { look: 0.16, dist: 1.25, up: 0.55, lx: 0, man: false } }) },
      { id: 'sapling', name: 'Sapling', dur: 10, line: Ln.sapling, at: (p) => ({ age: sap + 0.15 + p * 0.85, view: { ...fit(sap + 1), man: true } }) },
      { id: 'growing', name: 'Growing up', dur: 7, line: Ln.growing, at: (p) => { const a = sap + 1 + p * (prime - sap - 1); return { age: a, sf: 0.55, view: fit(a) }; } },
      { id: 'prime', name: 'A year in its prime', dur: 14, line: Ln.prime, at: (p) => ({ age: prime + 0.12 + p * 0.86, view: fit(prime) }) },
      { id: 'old', name: 'Old age', dur: 8, line: `${Ln.old} Next to a long human life of about 80 years, this tree's life here is ${L.life / 80 < 1.15 ? 'about the same length' : `about ${(L.life / 80).toFixed(1).replace('.0', '')} human lifetimes`}.`, at: (p) => { const a = L.decline + p * (L.life - L.decline); return { age: a, sf: 0.1, view: fit(a) }; } },
      { id: 'death', name: 'Death and after', dur: 11, line: 'Dead, it stands for a few years as a snag, then falls. The log slowly goes back into the soil, and new seedlings start beside it. (This part is modelled, not timed from a source.)',
        at: (p) => p < 0.3 ? { age: L.life + 0.5 + (p / 0.3) * 3, sf: 0.1, view: fit(L.life) } : p < 0.62 ? { age: L.life + 4 + ((p - 0.3) / 0.32) * 1.3, sf: 0.1, view: fit(L.life) }
          : { age: L.life + 8, sf: 0.5, view: null, sprout: { x: Hm * 0.25, z: 1.2, s: 0.8 + 14 * (p - 0.62) } } },
    ];
  }
  async function growScreen(id) {
    const t = by.get(id);
    frame(`<button class="tr-back" data-t="card" data-id="${id}"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(t.name)}</button>`,
      `<span class="tr-kick">Watch it grow</span><h2>The life of a ${esc(t.name.toLowerCase())}</h2>
      <div class="gr-beats"></div>
      <div class="t3-stage big gr-stage"><div class="gr-hud"><b class="gr-year">Year 0</b><span class="gr-sub"></span></div><div class="gr-fact"></div></div>
      <div class="gr-ctl"><button class="gr-step" data-t="grprev" aria-label="Previous">‹</button><button class="tr-go gr-play" data-t="grplay">Pause</button><button class="gr-step" data-t="grnext" aria-label="Next">›</button></div>
      <details class="gr-any"><summary>Any year</summary><input class="gr-slider" type="range" min="0" step="0.01" value="0" aria-label="Age in years"><p class="tn-hint">Drag to any year; the seasons follow the date in the year.</p></details>
      <p class="tn-hint">The lines are from the tree's Wikipedia article, and its height at each age follows the growth figures there, for a typical tree in the open. The shape at each age is a model of how this species grows, not a portrait of one tree. Drag the tree to turn it.</p>`);
    T3 = T3 || await import('./tree3d.js');
    if (!root.querySelector('.gr-stage')) return;
    drop3d();
    st3 = T3.lifeStage(root.querySelector('.gr-stage'), id);
    const story = T3.storyOf(id), beats = beatsFor(st3, story), sl = root.querySelector('.gr-slider');
    sl.max = String(st3.L.life + 12);
    root.querySelector('.gr-beats').innerHTML = beats.map((bt, i) => `<button class="gr-beat" data-t="grbeat" data-i="${i}">${esc(bt.name)}</button>`).join('');
    grow = { id, beats, bi: 0, p: 0, playing: true, last: performance.now(), free: false, st: st3, age: 0 };
    sl.addEventListener('input', () => { grow.free = true; grow.age = +sl.value; grow.playing = false; root.querySelector('.gr-play').textContent = 'Play'; });
    const tick = (now) => {
      if (!grow || grow.st !== st3 || !st3) return;
      const dt = Math.min(0.1, (now - grow.last) / 1000); grow.last = now;
      const L = st3.L; let st, line;
      if (grow.free) {
        st3.setView(null); st3.seed(-1); st3.sprout(null); st3.setAge(grow.age); line = '';
      } else {
        const bt = beats[grow.bi];
        if (grow.playing) { grow.p += dt / bt.dur; if (grow.p >= 1) { if (grow.bi < beats.length - 1) { grow.bi++; grow.p = 0; } else { grow.p = 1; grow.playing = false; root.querySelector('.gr-play').textContent = 'Watch again'; } } }
        st = beats[grow.bi].at(Math.min(1, grow.p));
        st3.setAge(st.age, st.sf ?? null); st3.seed(st.seed ?? -1); st3.sprout(st.sprout || null); st3.setView(st.view === undefined ? null : st.view);
        grow.age = st.age; line = beats[grow.bi].line;
        if (document.activeElement !== sl) sl.value = String(st.age);
      }
      const i = st3.info(), bt = beats[grow.bi];
      root.querySelector('.gr-year').textContent = grow.free ? `Year ${Math.floor(grow.age)}` : bt.id === 'seed' ? 'A seed' : bt.id === 'sprout' ? 'Year 0' : `Year ${Math.floor(grow.age)}`;
      root.querySelector('.gr-sub').textContent = bt.id === 'seed' && !grow.free ? SEASON_WORD[i.season] : `${STAGE(L, grow.age, i.height)} · ${SEASON_WORD[i.season]}${i.height && bt.id !== 'sprout' ? ` · ${i.height.toFixed(i.height < 3 ? 1 : 0)} m tall` : ''}`;
      const fb = root.querySelector('.gr-fact'); if (fb.dataset.l !== line) { fb.dataset.l = line; fb.textContent = line; fb.hidden = !line; fb.style.animation = 'none'; void fb.offsetWidth; fb.style.animation = ''; }
      for (const [k, b] of [...root.querySelectorAll('.gr-beat')].entries()) b.classList.toggle('on', !grow.free && k === grow.bi);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---- Leaf rain: traced leaves falling; tap only the target tree's; three lives; the target changes every 15 seconds and the rain speeds up
  let rain = null;
  function rainStart() {
    const traced = D.trees.filter((t) => HAS_OUTLINE(t.id)).map((t) => t.id), m = met().filter((id) => traced.includes(id));
    if (traced.length < 3) return hub();
    const targets = shuffle(m.length >= 3 ? m : traced).slice(0, 4);
    frame(`${back()}<span class="tr-kick">Leaf rain</span>`,
      `<div class="lr-head"><div class="lr-target"><img alt=""><span><small>Catch only</small><b></b></span></div><div class="lr-stats"><span class="lr-score">0</span><small class="lr-lives">♥♥♥</small></div></div>
      <div class="lr-field"><div class="lr-ground"></div></div><div class="lr-bar"><i></i></div>
      <p class="tn-hint">Tap every leaf of the tree named above before it lands; leave the others. A wrong tap, or a target leaf that lands, costs a life.</p>`);
    rain = { traced, targets, ti: 0, t: 0, score: 0, lives: 3, leaves: [], next: 0.4, last: performance.now(), dur: 45, mix: {}, alive: true, round: { right: 0, wrong: 0 } };
    setTarget(0);
    const field = root.querySelector('.lr-field');
    field.addEventListener('pointerdown', (e) => { const el = e.target.closest('.lr-leaf'); if (el) hitLeaf(el); });
    requestAnimationFrame(rainTick);
  }
  function setTarget(i) {
    const id = rain.targets[i % rain.targets.length]; rain.target = id;
    const box = root.querySelector('.lr-target'); if (!box) return;
    box.querySelector('img').src = leafSrc(id); box.dataset.id = id; box.querySelector('b').textContent = by.get(id).name;
    box.classList.remove('flip'); void box.offsetWidth; box.classList.add('flip');
    if (i) juice.right(1);
  }
  function rainTick(now) {
    if (!rain || !rain.alive) return;
    const field = root.querySelector('.lr-field'); if (!field) { rain = null; return; }
    const dt = Math.min(0.05, (now - rain.last) / 1000); rain.last = now; rain.t += dt;
    const W = field.clientWidth, Hh = field.clientHeight, k = rain.t / rain.dur;
    if (Math.floor(rain.t / 15) !== rain.ti && rain.t < rain.dur) { rain.ti = Math.floor(rain.t / 15); setTarget(rain.ti); }
    rain.next -= dt;
    if (rain.next <= 0 && rain.t < rain.dur - 1) {      // a new leaf: the target about two times in five, else its look-alikes first
      const near = rain.traced.filter((x) => x !== rain.target && (by.get(rain.target).like.includes(x) || GROUP_OF[x] === GROUP_OF[rain.target]));
      const id = Math.random() < 0.42 ? rain.target : rand(near.length && Math.random() < 0.6 ? near : rain.traced.filter((x) => x !== rain.target));
      const el = document.createElement('img'); el.className = 'lr-leaf'; el.src = leafAnySrc(id); el.alt = ''; el.dataset.id = id; el.draggable = false;
      field.appendChild(el);
      rain.leaves.push({ el, id, x: 20 + Math.random() * (W - 80), y: -70, vy: 55 + 70 * k + Math.random() * 30, sway: 20 + Math.random() * 30, ph: Math.random() * 6, rot: (Math.random() - 0.5) * 80 });
      rain.next = Math.max(0.42, 1.05 - 0.6 * k) * (0.7 + Math.random() * 0.6);
    }
    for (const L of rain.leaves) {
      L.y += L.vy * dt; L.ph += dt * 1.6;
      L.el.style.transform = `translate(${L.x + Math.sin(L.ph) * L.sway}px, ${L.y}px) rotate(${L.rot + Math.sin(L.ph * 0.8) * 25}deg)`;
      if (L.y > Hh - 60 && !L.done) {
        L.done = true; L.el.remove();
        if (L.id === rain.target) { loseLife(L, 'missed'); }
      }
    }
    rain.leaves = rain.leaves.filter((L) => !L.done);
    root.querySelector('.lr-bar i').style.width = `${Math.max(0, 100 - k * 100)}%`;
    if (rain.t >= rain.dur || rain.lives <= 0) return rainEnd();
    requestAnimationFrame(rainTick);
  }
  function hitLeaf(el) {
    const L = rain.leaves.find((x) => x.el === el); if (!L || L.done) return;
    L.done = true;
    if (L.id === rain.target) {
      rain.score++; combo++; rain.round.right++; juice.right(combo); juice.burst(el, leafSrc(L.id), 7);
      root.querySelector('.lr-score').textContent = String(rain.score); el.remove();
    } else { const k = [L.id, rain.target].sort().join('|'); rain.mix[k] = (rain.mix[k] || 0) + 1; rain.round.wrong++; loseLife(L, by.get(L.id).name); el.remove(); }
  }
  function loseLife(L, label) {
    rain.lives--; combo = 0; juice.wrong(); juice.shake(root.querySelector('.lr-field'));
    root.querySelector('.lr-lives').textContent = '♥'.repeat(Math.max(0, rain.lives)) + '♡'.repeat(Math.max(0, 3 - rain.lives));
    const f = root.querySelector('.lr-field'), m = document.createElement('span'); m.className = 'lr-miss'; m.textContent = label;
    m.style.left = `${Math.min(f.clientWidth - 120, Math.max(4, L.x))}px`; m.style.top = `${Math.min(f.clientHeight - 30, Math.max(4, L.y))}px`; f.appendChild(m); setTimeout(() => m.remove(), 900);
  }
  function rainEnd() {
    const r = rain; r.alive = false; rain = null;
    const best = Math.max(store.get('trees.rainbest', 0), r.score); store.set('trees.rainbest', best);
    const mix = Object.entries(r.mix).sort((a, b) => b[1] - a[1]).slice(0, 2);
    setTimeout(() => { juice.done(r.score >= 15); juice.countUp(root.querySelector('.jc-count'), r.score); if (r.score >= 15) juice.fall(r.targets.map(leafSrc)); }, 120);
    frame(back(), `<div class="tr-done"><h2><span class="jc-count">${r.score}</span> leaves caught</h2><p>${r.lives <= 0 ? 'Out of lives.' : 'Time!'} Best: ${best}</p>
      ${mix.map(([k]) => { const [a, c] = k.split('|').map((x) => by.get(x)); return `<div class="tr-res no"><b>You took ${esc(a.name)} for ${esc(c.name)}</b><div class="lr-pair"><span>${leafSvg(a.id)}<small>${esc(a.name)}</small></span><span>${leafSvg(c.id)}<small>${esc(c.name)}</small></span></div></div>`; }).join('')}
      <button class="tr-go" data-t="rain">Again</button><button class="tr-card wide" data-t="hub"><b>Back to the trees</b></button></div>`);
  }

  // Name that tree: a 3D tree turning on the stage, in a season; four names
  let n3 = null;
  function nameStart() { n3 = { i: 0, n: 8, right: 0 }; nameAsk(); }
  async function nameAsk() {
    if (n3.i >= n3.n) { const r = n3.right; n3 = null; drop3d(); frame(back(), `<div class="tr-done"><h2>${r} of 8</h2><p>${r >= 7 ? 'You know them by their shape.' : 'Shape takes time: watch how the branches sit, and the outline of the crown.'}</p><button class="tr-go" data-t="name3d">Again</button><button class="tr-card wide" data-t="hub"><b>Back to the trees</b></button></div>`); return; }
    const ids = ['white-pine', 'pin-oak', 'sweetgum', 'red-maple'], id = rand(ids), season = rand(['winter', 'winter', 'summer', 'fall']);
    frame(`${back()}<span class="tr-prog">${Array.from({ length: n3.n }, (_, i) => `<i class="${i < n3.i ? 'd' : i === n3.i ? 'c' : ''}"></i>`).join('')}</span>`,
      `<span class="tr-kick">Name that tree · ${esc(SEASON_WORD[season])}</span><p class="tr-ask">Which tree has this shape?</p><div class="t3-stage big"></div><p class="sk-cap">Drag to turn it. A model of the tree's habit, not a portrait of one tree.</p>
      <div class="tr-choices">${shuffle(ids).map((x) => `<button data-t="n3ans" data-id="${x}">${esc(by.get(x).name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
    q = { kind: 'name3d', id };
    const s3 = await stage3d(root.querySelector('.t3-stage')); s3.set(id, season);
  }
  const SHAPE_TELL = { 'white-pine': 'Level tiers of branches, ring above ring, with soft tufts of needles.', 'pin-oak': 'One straight trunk; upper branches rise, middle ones stand out level, the lowest droop.', sweetgum: 'One central trunk and a cone-shaped crown, widest low down.', 'red-maple': 'A rounded crown; branches in pairs, so twigs fork in Ys.' };
  function nameAnswer(b) {
    if (!q || q.done) return; q.done = true;
    const ok = b.dataset.id === q.id; if (ok) n3.right++;
    for (const x of root.querySelectorAll('[data-t=n3ans]')) { x.disabled = true; if (x.dataset.id === q.id) x.classList.add('right'); }
    if (!ok) b.classList.add('wrong');
    feel(ok, b, q.id);
    root.querySelector('.tr-fb').innerHTML = `${idPair(q.id, b.dataset.id, 'form', ok)}${ok ? '' : compareHtml(b.dataset.id, 'form')}<button class="tr-go" data-t="n3next">Next</button>`;
  }

  // ---- your own photos: kept in this browser only (IndexedDB), never uploaded
  const idb = () => new Promise((ok, no) => { const r = indexedDB.open('njtf-trees', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'k', autoIncrement: true }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  async function myPhotos() {
    try {
      const db = await idb();
      const all = await new Promise((ok) => { const r = db.transaction('photos').objectStore('photos').getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => ok([]); });
      const out = {}; for (const p of all) (out[p.id] = out[p.id] || []).push(p); return out;
    } catch { return {}; }
  }
  async function addPhoto(id, file) {
    const url = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(file); });
    const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const sc = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const rec = { id, t: Date.now(), src: c.toDataURL('image/jpeg', 0.8), pt: walk && walk.pos ? walk.pos : null };
    const db = await idb();
    await new Promise((ok, no) => { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').add(rec); tx.oncomplete = ok; tx.onerror = () => no(tx.error); });
    mine = await myPhotos();
  }
  async function removePhoto(k) {
    const db = await idb();
    await new Promise((ok) => { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').delete(k); tx.oncomplete = ok; tx.onerror = ok; });
    mine = await myPhotos();
  }
  /** Ask for a photo of a tree (the camera on a phone), then come back to `then`. */
  function snap(id, then) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
    inp.addEventListener('change', async () => { if (inp.files[0]) { try { await addPhoto(id, inp.files[0]); } catch { /* unreadable image */ } } then(); });
    inp.click();
  }
  const myImg = (p, cls = '') => `<figure class="tr-ph ${cls} mine"><img src="${p.src}" alt=""><figcaption><b>Your photo</b><span>${new Date(p.t).toLocaleDateString()}</span></figcaption></figure>`;

  // ---- tree walk: the trees recorded around where you are (or any place you pick), found in person
  async function loadPoints() {
    if (PTS) return;
    const raw = await fetch('data/treepoints.json').then((r) => r.json());
    PTS = {};
    for (const [id, flat] of Object.entries(raw.trees)) {
      const a = []; let x = 0, y = 0;
      for (let i = 0; i < flat.length; i += 2) { x += flat[i]; y += flat[i + 1]; a.push([x / raw.scale, y / raw.scale]); }
      PTS[id] = a;
    }
  }
  const WALK_R = 600;   // metres
  function nearby(pt) {
    const out = [], dLat = WALK_R / 111000, dLon = dLat / Math.cos((pt[1] * Math.PI) / 180);
    for (const [id, a] of Object.entries(PTS)) for (const p of a) {
      if (Math.abs(p[1] - pt[1]) > dLat || Math.abs(p[0] - pt[0]) > dLon) continue;
      const m = distanceMi(pt, p) * 1609.34; if (m <= WALK_R) out.push({ id, p, m });
    }
    return out.sort((a, b) => a.m - b.m);
  }
  function walkIntro() {
    const sp = spot();
    frame(back(), `<h2>Tree walk</h2><p class="sk-p">The trees people have recorded around you, on the map, nearest first. Walk to one, look for it, and tap <b>Found it</b>: finding a tree in person is the best way to know it.</p>
      <p class="tn-hint">Your location is used only on this device while the walk is on; nothing is sent anywhere. Records are iNaturalist sightings, so a tree may have been cut down, or be one of several nearby.</p>
      ${navigator.geolocation ? '<button class="tr-go" data-t="walkgps">Use my location</button>' : ''}
      ${sp ? `<button class="tr-card wide" data-t="walkspot"><b>Around ${esc(sp.name)}</b><small>plan a walk from your spot</small></button>` : ''}
      <button class="tr-card wide" data-t="walkmap"><b>Pick a place on the map</b><small>a park, a street you know</small></button>`);
  }
  async function walkBegin(src, pt) {
    await loadPoints();
    walkEnd(true);
    walk = { src, pos: pt || null, center: null, sel: null, watch: null, last: 0 };
    root.classList.add('peek');
    if (!map.getSource('trees-walk')) {
      map.addSource('trees-walk', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'trees-walk', type: 'circle', source: 'trees-walk', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, ['case', ['get', 'sel'], 8, 4], 18, ['case', ['get', 'sel'], 14, 9]], 'circle-color': ['case', ['get', 'met'], '#2f8f5b', '#c9822b'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': ['case', ['get', 'sel'], 1, 0.8] } });
      map.addSource('trees-me', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'trees-me', type: 'circle', source: 'trees-me', paint: { 'circle-radius': 8, 'circle-color': '#2b6fd6', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      map.on('click', 'trees-walk', (e) => { if (walk && e.features[0]) { walk.sel = e.features[0].properties.id; walkDraw(); } });
    }
    for (const l of ['trees-walk', 'trees-me']) map.setLayoutProperty(l, 'visibility', 'visible');
    const pb = document.createElement('button'); pb.className = 'tr-peekback'; pb.textContent = 'End walk'; pb.addEventListener('click', () => { walkEnd(); hub(); }); document.body.appendChild(pb);
    if (src === 'gps') {
      ctx.hud('<div class="qkind">Tree walk</div><div class="q"><b>Finding where you are…</b></div>');
      walk.watch = navigator.geolocation.watchPosition((g) => {
        if (!walk) return;
        walk.pos = [g.coords.longitude, g.coords.latitude];
        if (Date.now() - walk.last > 4000) walkDraw();
      }, () => { if (walk) ctx.hud('<div class="qkind">Tree walk</div><div class="q"><b>Location is off or not allowed</b></div><div class="meta">Use your spot or pick a place on the map instead.</div>'); }, { enableHighAccuracy: true, maximumAge: 5000 });
    } else walkDraw();
  }
  function walkDraw() {
    if (!walk || !walk.pos) return;
    walk.last = Date.now();
    const pos = walk.pos, near = nearby(pos), m = met();
    map.getSource('trees-walk').setData({ type: 'FeatureCollection', features: near.slice(0, 400).map((n) => ({ type: 'Feature', properties: { id: n.id, met: m.includes(n.id), sel: n.id === walk.sel }, geometry: { type: 'Point', coordinates: n.p } })) });
    map.getSource('trees-me').setData({ type: 'FeatureCollection', features: walk.src === 'gps' ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pos } }] : [] });
    const first = new Map(); for (const n of near) if (!first.has(n.id)) first.set(n.id, n);
    const list = [...first.values()].slice(0, 6);
    if (!walk.center || distanceMi(walk.center, pos) * 1609 > 120) {
      // fit the view to you and the nearest trees on the list
      walk.center = pos;
      const xs = [pos[0], ...list.map((n) => n.p[0])], ys = [pos[1], ...list.map((n) => n.p[1])];
      if (list.length) map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: { top: 290, bottom: 170, left: 40, right: 40 }, maxZoom: 17.5, bearing: 0, pitch: 0, duration: 900 });
      else map.flyTo({ center: pos, zoom: 15.5, bearing: 0, pitch: 0, duration: 900 });
    }
    const dir = (n) => `${Math.round(n.m / 10) * 10} m ${compass8(bearing(pos, n.p))}`;
    if (walk.sel && first.has(walk.sel)) {
      const n = first.get(walk.sel), t = by.get(n.id);
      ctx.hud(`<div class="qkind">Tree walk · ${esc(dir(n))}</div><div class="tw-sel"><img src="${esc(photoOf(t, ['leaf', 'bark']).f)}" alt=""><div><div class="q"><b>${esc(t.name)}</b></div><div class="meta">${esc(groupOf(t.id).tell[t.id])}</div></div></div>
        <div class="tw-btns"><button data-walk="found" data-id="${t.id}">Found it</button><button data-walk="list">Back</button></div>`);
    } else {
      walk.sel = null;
      ctx.hud(`<div class="qkind">Tree walk · recorded within ${WALK_R} m</div>${list.length ? `<div class="tw-list">${list.map((n) => `<button data-walk="sel" data-id="${n.id}"><b>${esc(by.get(n.id).name)}</b><span>${esc(dir(n))}${m.includes(n.id) ? '' : ' · new'}</span></button>`).join('')}</div>` : '<div class="meta">No trees from this app recorded here yet. Try a park nearby.</div>'}`);
    }
  }
  function walkClick(e) {
    const b = e.target.closest('[data-walk]'); if (!b || !walk) return;
    const k = b.dataset.walk;
    if (k === 'sel') { walk.sel = b.dataset.id; walkDraw(); }
    else if (k === 'list') { walk.sel = null; walkDraw(); }
    else if (k === 'found') {
      const id = b.dataset.id, t = by.get(id), was = met().includes(id);
      record(id, true);
      if (!was) { const mm = store.get('trees.met', []); mm.push(id); store.set('trees.met', mm); }
      const f = store.get('trees.found', []); f.push({ id, t: Date.now() }); store.set('trees.found', f.slice(-500));
      ctx.hud(`<div class="qkind">Tree walk</div><div class="q"><b>${was ? 'Found' : 'Met in person'}: ${esc(t.name)} ✓</b></div><div class="meta">${was ? 'It counts as a review.' : 'It joins your trees and comes back in reviews.'}</div>
        <div class="tw-btns"><button data-walk="snap" data-id="${id}">Add your photo</button><button data-walk="list">Next tree</button></div>`);
    } else if (k === 'snap') snap(b.dataset.id, () => { walk && (walk.sel = null); walkDraw(); });
  }
  function walkEnd(quiet) {
    if (!walk) return;
    if (walk.watch != null) navigator.geolocation.clearWatch(walk.watch);
    walk = null;
    for (const l of ['trees-walk', 'trees-me']) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', 'none');
    document.querySelector('.tr-peekback')?.remove(); root.classList.remove('peek');
    if (!quiet) ctx.hud('');
  }
  document.addEventListener('click', walkClick);

  // ---- the screen
  function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'trees';
    document.body.appendChild(root);
    // opening a comparison brings it into view
    root.addEventListener('toggle', (e) => { const d = e.target; if (d.classList && d.classList.contains('tr-cmp') && d.open) setTimeout(() => d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30); }, true);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (!b || b.disabled) return;
      const f = actions[b.dataset.t]; if (f) f(b);
    });
  }
  const photoOf = (t, ctxs) => { const ps = t.photos.filter((p) => !ctxs || ctxs.includes(p.ctx)); return rand(ps.length ? ps : t.photos); };
  const img = (p, cls = '') => `<figure class="tr-ph ${cls}"><img src="${esc(p.f)}" alt="" loading="lazy"><figcaption><b>${esc(p.cap || CTX[p.ctx] || p.ctx)}</b><span>${esc(p.credit.replace(/^\(c\)/, '©').replace(/,? some rights reserved/, ''))}${p.lic && p.via ? ` · ${esc(p.lic)}` : ''} · ${esc(p.via || 'iNaturalist')}</span></figcaption></figure>`;
  const drawingHtml = (dr, cls = '') => `<figure class="tn-plate ${cls}"><img src="${esc(dr.f)}" alt="" loading="lazy"><figcaption>${/Britton/.test(dr.credit) ? 'Britton &amp; Brown, <i>Illustrated Flora</i> (1913)' : /Michaux/.test(dr.credit) ? 'Michaux, <i>The North American Sylva</i>' : esc(dr.credit)} · public domain</figcaption></figure>`;
  /** What tells the trees apart for the thing the question showed (its leaf, bark, fruit, winter look ...): after a right answer one line
   * for the tree; after a wrong one the right tree and the one you picked, each marked, one short line each. */
  function idPair(rightId, pickedId, how, ok, head = '') {
    const a = aspectOf(how), r = by.get(rightId), w = by.get(pickedId), word = ASPECT_WORD[a];
    // fall colour alone rarely settles it; with it, the leaf's shape (which a fall photo shows too)
    const idLineX = (id) => a === 'fall' ? `${idLine(id, 'fall')} ${idLine(id, 'leaf')}` : idLine(id, a);
    if (ok || !w || pickedId === rightId) return `<div class="tr-res ok"><b>✓ ${esc(r.name)}</b>${head}<p class="tr-idl"><i>${word}</i>${esc(idLineX(r.id))}</p></div>`;
    return `<div class="tr-res no"><b>✗ Not quite</b>${head}<span class="tr-aspect">${word}</span>
      <div class="tr-pair"><div class="ok"><span>✓ ${esc(r.name)}</span><p>${esc(idLineX(r.id))}</p></div><div class="no"><span>✗ ${esc(w.name)} <small>your pick</small></span><p>${esc(idLineX(w.id))}</p></div></div></div>`;
  }
  /** After a wrong answer: the tree you picked, to compare with the right one (which stays the big picture). A small picture of the same
   * kind as the question's (its bark, its traced leaf, its drawing, a photo from the same season), opened for a bigger one and its tell. */
  function compareHtml(wid, how) {
    const w = by.get(wid); if (!w) return '';
    let pic = null;
    const ph = (pp) => pp && { src: pp.f, html: img(pp) };
    if (how === 'leaf' && HAS_LEAF(w.id)) { const lv = leafAny(w.id); pic = { src: (lv || {}).img || null, html: `<div class="tk-bigsil tr-cmp-sil">${leafSvg(w.id, '', lv)}</div>`, sil: leafSvg(w.id, '', lv) }; }
    else if (how === 'drawing' && (w.drawings || []).length) { const d = rand(w.drawings); pic = { src: d.f, html: drawingHtml(d) }; }
    else if (how === 'bark') { const bp = w.photos.filter((pp) => pp.ctx === 'bark' && !hidden().includes(pp.pool)); if (bp.length) pic = ph(rand(bp)); }
    else if (how && how.season) {
      const ps = (POOL.trees[w.id] || []).filter((pp) => pp[1] === how.season && !hidden().includes(pp[0]));
      if (ps.length) { const pp = rand(ps), [pid, ext] = pp[0].split('.'), u = `${POOL.base}${pid}/${POOL.size}.${ext}`; pic = { src: u, html: `<figure class="tr-ph"><img src="${esc(u)}" alt="" loading="lazy"><figcaption><b>${esc(SEASON_WORD[how.season] || how.season)}</b><span>${esc(pp[2])} · iNaturalist</span></figcaption></figure>` }; }
    } else if (how && how.ctx) pic = ph(photoOf(w, [how.ctx]));
    else if (how === 'form') pic = ph(photoOf(w, ['form']));
    if (!pic) pic = ph(photoOf(w, how === 'bark' ? ['bark'] : ['leaf', 'form']));
    const th = pic.sil ? `<span class="tr-cmp-th sil">${pic.sil}</span>` : pic.src ? `<span class="tr-cmp-th"><img src="${esc(pic.src)}" alt="" loading="lazy"></span>` : '';
    // opened: the right one (the question's own picture) beside the one you picked, the same size, the right one first and marked
    const big = root.querySelector('.tr-body .big img, .tr-body .tk-bigsil svg, .tr-body .t3-stage canvas');
    const rid = (q && (q.t ? q.t.id : q.id)) || '', rname = by.get(rid) ? by.get(rid).name : '';
    const rightPic = !big ? '' : big.tagName === 'CANVAS' ? (() => { try { return `<img src="${big.toDataURL('image/jpeg', 0.8)}" alt="">`; } catch { return ''; } })() : big.tagName === 'IMG' ? `<img src="${esc(big.src)}" alt="">` : big.outerHTML;
    const wrongPic = pic.sil || (pic.src ? `<img src="${esc(pic.src)}" alt="" loading="lazy">` : pic.html);
    const credit = (pic.html.match(/<span>([^<]*(?:iNaturalist|Wikimedia Commons)[^<]*)<\/span>/) || [])[1] || (/tn-plate/.test(pic.html) ? 'Botanist\u2019s drawing · public domain' : '');
    const body = rightPic && rname
      ? `<div class="tr-cmp-two"><figure class="ok${pic.sil ? ' sil' : ''}">${rightPic}<figcaption>✓ ${esc(rname)}</figcaption></figure><figure class="no${pic.sil ? ' sil' : ''}">${wrongPic}<figcaption>Your pick: ${esc(w.name)}</figcaption></figure></div>${credit ? `<small class="tr-cmp-cr">Your pick’s photo: ${esc(credit)}</small>` : ''}`
      : pic.html;
    return `<details class="tr-cmp"><summary>${th}<span>Compare with the <b>${esc(w.name)}</b> you picked</span><i>›</i></summary><div class="tr-cmp-body">${body}</div></details>`;
  }
  const frame = (top, body) => { drop3d(); root.classList.remove('jc-in'); void root.offsetWidth; root.classList.add('jc-in'); root.innerHTML = `<div class="tr-top">${top}</div><div class="tr-body">${body}</div>`; root.scrollTop = 0; root.classList.remove('peek'); ctx.hud(''); };
  const back = (label = 'Trees') => `<button class="tr-back" data-t="hub"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(label)}</button>`;

  const groupOf = (id) => GROUPS.find((g) => g.id === GROUP_OF[id]);
  /** A tree's leaf: the traced outline (or needle diagram) when there is one, else a photo of the leaf. */
  const leafArt = (id) => leafSvg(id) || `<img class="tk-leafph" src="${esc(photoOf(by.get(id), ['leaf']).f)}" alt="">`;
  /** The key's path to a tree, as a row of small drawings with their answers. */
  const pathHtml = (id, upTo) => `<div class="tk-path">${pathTo(id).slice(0, upTo).map(([n, i]) => { const [label, ic] = KEY[n].a[i]; return `<span>${ICON[ic]}<small>${esc(label)}</small></span>`; }).join('<i>›</i>')}</div>`;
  /** A group side by side: what puts a tree in it, how the key gets there, and each member's leaf and bark with the one thing that tells it apart. */
  function groupCard(g, opts = {}) {
    const ms = Object.keys(g.tell).map((id) => by.get(id)).filter(Boolean);
    frame(opts.meet ? `<span class="tr-kick">New group</span>` : back(opts.from === 'guide' ? 'Field guide' : 'Trees'),
      `<h2>${esc(g.name)}</h2><p class="tr-why">${esc(g.why)}</p>${pathHtml(ms[0].id, ms.every((t) => pathTo(t.id).length === pathTo(ms[0].id).length) ? undefined : -1)}
      <h4>How to tell them apart</h4>
      <div class="tk-cmp">${ms.map((t) => `<button class="tk-col" data-t="card" data-id="${t.id}"><div class="tk-sil">${leafArt(t.id)}</div><div class="tk-pics"><img src="${esc(photoOf(t, ['leaf']).f)}" alt=""><img src="${esc(photoOf(t, ['bark']).f)}" alt=""></div><b>${esc(t.name)}</b><small>${esc(g.tell[t.id])}</small></button>`).join('')}</div>
      ${opts.meet ? '<button class="tr-go" data-t="next">Meet them one by one</button>' : ''}`);
    q = { kind: 'group', g };
  }
  /** Identify: the key, one question at a time, with the trees it still leaves; at a group, its side-by-side card. */
  function identify(node = 'start', trail = []) {
    const n = KEY[node];
    const left = (trail.length ? treesUnder(...trail[trail.length - 1]) : Object.keys(GROUP_OF)).filter((id) => by.has(id));
    frame(back(), `<span class="tr-kick">Name a tree in front of you</span><p class="tr-ask">${esc(n.q)}</p>
      <p class="sk-how"><b>How to check:</b> ${esc(n.how)}${n.skill ? ` <button class="sk-link" data-t="lesson" data-sk="${n.skill}">Show me</button>` : ''}</p>
      <div class="tk-opts">${n.a.map(([label, ic], i) => `<button data-t="keypick" data-node="${node}" data-i="${i}" data-trail='${esc(JSON.stringify(trail))}'>${ICON[ic]}<b>${esc(label)}</b><small>${treesUnder(node, i).filter((id) => by.has(id)).length} tree${treesUnder(node, i).filter((id) => by.has(id)).length === 1 ? '' : 's'}</small></button>`).join('')}</div>
      ${trail.length ? `<div class="tk-trail">${trail.map(([tn, ti]) => `<span>${esc(KEY[tn].a[ti][0])}</span>`).join(' › ')}</div>` : ''}
      <h4>Trees it could still be: ${left.length}</h4><div class="tk-left">${left.map((id) => `<span title="${esc(by.get(id).name)}">${leafArt(id)}</span>`).join('')}</div>`);
  }
  function keyPick(b) {
    const node = b.dataset.node, i = +b.dataset.i, trail = [...JSON.parse(b.dataset.trail), [node, i]];
    const t = KEY[node].a[i][2];
    if (t.to) return identify(t.to, trail);
    groupCard(GROUPS.find((g) => g.id === t.group));
  }

  function hub() {
    q = null; run = null; quick = null; n3 = null; if (rain) rain.alive = false; rain = null; drop3d(); if (walk) walkEnd();
    const nw = waveCheck(); if (nw) return waveOpened(nw);
    const m = met(), t = store.get('trees.today', {}), doneToday = t.d === today() && t.done;
    const due = m.filter((id) => isDue(id)).length;
    const C = 2 * Math.PI * 21, frac = doneToday ? 1 : t.d === today() && t.n ? t.i / t.n : 0;
    const { list, nc } = ranked(), local = list.slice(0, LOCAL_N), sp = spot();
    const fresh = list.filter((x) => !m.includes(x.id)).slice(0, 2);
    const plan = doneToday ? `Done today ✓${streak() ? ` · ${streak()}-day streak` : ''}` : `${fresh.length ? `Meet: ${fresh.map((x) => esc(x.name)).join(' and ')}` : 'Review what you know'}${due ? ` · ${due} to review` : ''}`;
    const learnt = Object.keys(SKILLS).filter(skillDone);
    frame(`<button class="tr-back" data-t="home"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Home</button><h1>Trees of New Jersey</h1><button class="jc-mute" data-t="mute" aria-label="${juice.muted ? 'Sound off' : 'Sound on'}">${juice.muted ? '🔇' : '🔊'}</button>`,
      `<button class="tr-today${doneToday ? ' done' : ''}" data-t="today"><span><b>${doneToday ? 'Today is done' : t.d === today() && t.i ? 'Carry on today' : 'Start today'}</b><small>${plan}</small></span>
        <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="21" class="bg"/><circle cx="26" cy="26" r="21" class="fg" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/></svg></button>
      <p class="tn-season">${esc(SEASON_LINE[season()])}</p>
      <div class="tr-stats"><span><b>${m.length}</b> of ${D.trees.length} met</span><span><b>${learned()}</b> learned</span><span><b>${streak()}</b> day streak</span></div>
      ${waveCardHtml()}
      <div class="tn-head"><h4>${sp ? `Trees near ${esc(sp.name)}` : 'The most-seen trees in New Jersey'}</h4><button class="sk-link" data-t="spot">${sp ? 'Change' : 'Set your spot'}</button></div>
      ${sp ? '' : '<p class="tn-hint">Set the place you are outdoors most (home, work, a park) and these become the trees most often seen around it.</p>'}
      <div class="tn-list">${local.map((x, i) => `<button class="tn-row${m.includes(x.id) ? ' met' : ''}" data-t="card" data-id="${x.id}"><span class="tn-n">${m.includes(x.id) ? '✓' : i + 1}</span><span class="tn-leaf">${leafArt(x.id)}</span><span class="tk-gt"><b>${esc(x.name)}</b><small>${nc ? `seen ${nc[x.id].n.toLocaleString()} times within about 10 km` : `${x.count.toLocaleString()} sightings in New Jersey`}${!m.includes(x.id) && fresh.some((f) => f.id === x.id) ? ' · next to meet' : ''}</small></span></button>`).join('')}</div>
      <div class="tr-row"><button class="tr-card" data-t="quick"${m.length < 2 ? ' disabled' : ''}><b>Quick look</b><small>${m.length < 2 ? 'after you meet two trees' : '20 photos, fast: which tree?'}</small></button>
        <button class="tr-card" data-t="barkonly"${m.length < 2 ? ' disabled' : ''}><b>Bark only</b><small>${m.length < 2 ? 'after you meet two trees' : '15 bark photos: whose is it?'}</small></button></div>
      <button class="tr-card wide" data-t="identify"><b>Name a tree</b><small>in front of you: a few questions, with pictures</small></button>
      <button class="tr-card wide lr-card" data-t="rain"><b>Leaf rain</b><small>leaves falling: tap only the right tree’s${store.get('trees.rainbest', 0) ? ` · best ${store.get('trees.rainbest', 0)}` : ''}</small></button>
      <button class="tr-card wide t3-card" data-t="name3d"><b>Name that tree</b><small>a tree in 3D, turning, in any season: which is it? (4 trees so far)</small></button>
      <div class="tr-row">${['red-maple', 'pin-oak', 'sweetgum', 'white-pine'].map((x) => `<button class="tr-card gr-mini" data-t="grow" data-id="${x}"><b>Watch it grow</b><small>${esc(by.get(x).name)}</small></button>`).join('')}</div>
      <button class="tr-card wide tw-card" data-t="walk"><b>Tree walk</b><small>the trees recorded around you, on the map: go and find them${store.get('trees.found', []).length ? ` · ${store.get('trees.found', []).length} found so far` : ''}</small></button>
      <button class="tr-card wide" data-t="practise"${m.length < 2 && !learnt.length ? ' disabled' : ''}><b>Practise</b><small>${m.length < 2 && !learnt.length ? 'after you meet two trees' : 'endless, every kind of question'}</small></button>
      <h4>Learn to look</h4><p class="tn-hint">Optional short lessons: what field guides ask about any tree. Each tree's page links to the one it needs.</p>
      <div class="tn-skills">${Object.entries(SKILLS).map(([k, S]) => `<button class="tn-skill${skillDone(k) ? ' done' : ''}" data-t="lesson" data-sk="${k}">${k === 'bark' ? ICON.bark : ICON[KEY[Object.keys(KEY).find((n) => KEY[n].skill === k)].a[0][1]]}<b>${esc(S.name)}</b>${skillDone(k) ? '<small>✓ learned</small>' : ''}</button>`).join('')}</div>
      <button class="tr-card wide" data-t="guide"><b>Field guide</b><small>every tree, by group, with side-by-side comparisons</small></button>
      <p class="tr-note">Photos and sightings: iNaturalist, each under its own licence; your spot stays on this device. The identifying tips were checked against each tree’s Wikipedia article (November 2026); if your field guide disagrees, trust the book.</p>`);
  }

  // ---- your spot: one of your places from the town side, or a tap on the map
  function spotPicker() {
    const anchors = store.get('anchors', []);
    frame(back(), `<h2>Your spot</h2><p class="sk-p">Where are you outdoors most? The trees most often seen within about 10 km of it come first. It stays on this device.</p>
      ${anchors.length ? `<h4>Your places</h4><div class="tn-list">${anchors.map((a, i) => `<button class="tn-row" data-t="spotset" data-i="${i}"><span class="tn-n">📍</span><span class="tk-gt"><b>${esc(a.name)}</b><small>from your places on the town side</small></span></button>`).join('')}</div>` : ''}
      <button class="tr-go" data-t="spotmap">Tap a spot on the map</button>
      ${spot() ? '<button class="tr-card wide" data-t="spotclear"><b>Clear my spot</b><small>use the most-seen trees in all of New Jersey</small></button>' : ''}`);
  }
  function walkFromMap() {
    root.classList.add('peek');
    map.fitBounds(ctx.region.bounds, { padding: { top: 120, bottom: 110, left: 20, right: 20 }, bearing: 0, pitch: 0, duration: 700 });
    ctx.hud('<div class="qkind">Tree walk</div><div class="q"><b>Tap where you want to walk</b></div><div class="meta">Zoom in to a park or a street first.</div>');
    const pb = document.createElement('button'); pb.className = 'tr-peekback'; pb.textContent = 'Cancel'; pb.addEventListener('click', () => { picking = false; actions.unpeek(); walkIntro(); }); document.body.appendChild(pb);
    picking = true;
    map.once('click', (e) => { if (!picking) return; picking = false; document.querySelector('.tr-peekback')?.remove(); walkBegin('map', [e.lngLat.lng, e.lngLat.lat]); });
  }
  function spotFromMap() {
    picking = true; root.classList.add('peek');
    const b = ctx.region.bounds; map.fitBounds(b, { padding: { top: 120, bottom: 110, left: 20, right: 20 }, bearing: 0, pitch: 0, duration: 700 });
    ctx.hud('<div class="qkind">Your spot</div><div class="q"><b>Tap where you are outdoors most</b></div><div class="meta">Zoom in if you like. It stays on this device.</div>');
    const pb = document.createElement('button'); pb.className = 'tr-peekback'; pb.textContent = 'Cancel'; pb.addEventListener('click', () => { picking = false; actions.unpeek(); spotPicker(); }); document.body.appendChild(pb);
    map.once('click', (e) => {
      if (!picking) return; picking = false;
      store.set('trees.spot', { name: 'your spot', pt: [+e.lngLat.lng.toFixed(4), +e.lngLat.lat.toFixed(4)] });
      actions.unpeek(); hub();
    });
  }

  // ---- quick look: 20 photos from the big pools, two names each, fast
  function quickStart(mode) {
    const m = met(); if (m.length < 2) return hub();
    const bark = mode === 'bark', ids = bark ? D.trees.filter((t) => t.photos.some((p) => p.ctx === 'bark')).map((t) => t.id) : m;
    quick = { i: 0, n: bark ? 15 : 20, right: 0, mix: {}, ids, bark };
    quickAsk();
  }
  function quickAsk() {
    if (quick.i >= quick.n) return quickEnd();
    const id = rand(quick.ids), t = by.get(id);
    const near = quick.bark ? quick.ids.filter((x) => x !== id && barkKindOf(x) === barkKindOf(id)) : [...t.like, ...Object.keys(groupOf(id).tell)].filter((x) => x !== id && quick.ids.includes(x));
    const other = rand(near.length && Math.random() < 0.7 ? near : quick.ids.filter((x) => x !== id));
    const [u, credit, file] = quick.bark ? (() => { const p = rand(t.photos.filter((pp) => pp.ctx === 'bark' && !hidden().includes(pp.pool))); return [p.f, p.credit, p.pool || null]; })() : poolPhoto(id);
    frame(`${back()}<span class="tr-prog">${Array.from({ length: quick.n }, (_, i) => `<i class="${i < quick.i ? 'd' : i === quick.i ? 'c' : ''}"></i>`).join('')}</span>`,
      `<span class="tr-kick">${quick.bark ? 'Bark only' : 'Quick look'}</span><figure class="tr-ph big tn-quick"><img src="${esc(u)}" alt=""><figcaption><span>${esc(credit)} · iNaturalist</span></figcaption></figure>
      <div class="tr-choices two">${shuffle([id, other]).map((x) => `<button data-t="qans" data-id="${x}">${esc(by.get(x).name)}</button>`).join('')}</div>
      ${file ? `<button class="sk-link tn-hide" data-t="hidephoto" data-f="${esc(file)}">Bad photo? Hide it</button>` : ''}`);
    q = { kind: 'quick', id, other, how: quick.bark ? 'bark' : { pool: file, season: ((POOL.trees[id] || []).find((pp) => pp[0] === file) || [])[1] } };
  }
  function quickAnswer(b) {
    if (!q || q.done) return; q.done = true;
    const ok = b.dataset.id === q.id;
    if (ok) quick.right++; else { const k = [q.id, q.other].sort().join('|'); quick.mix[k] = (quick.mix[k] || 0) + 1; }
    for (const x of root.querySelectorAll('[data-t=qans]')) { x.disabled = true; if (x.dataset.id === q.id) x.classList.add('right'); }
    if (!ok) b.classList.add('wrong');
    feel(ok, b, q.id);
    if (ok) { setTimeout(() => { if (quick) { quick.i++; quickAsk(); } }, 550); return; }
    root.querySelector('.tr-body').insertAdjacentHTML('beforeend', `<div class="tr-fb">${idPair(q.id, b.dataset.id, quick.bark ? 'bark' : q.how, false)}${compareHtml(b.dataset.id, quick.bark ? 'bark' : q.how)}<button class="tr-go" data-t="qnext">Next</button></div>`);
    root.querySelector('.tr-go').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function quickEnd() {
    const mix = Object.entries(quick.mix).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const r = quick.right, n = quick.n, wasBark = quick.bark, quickIds = quick.ids; quick = null;
    const tellOf = (x) => idLine(x.id, wasBark ? 'bark' : 'leaf');
    setTimeout(() => { juice.done(r >= n * 0.7); juice.countUp(root.querySelector('.jc-count'), r); if (r >= n * 0.8) juice.fall(quickIds.map(leafSrc).filter(Boolean)); }, 120);
    frame(back(), `<div class="tr-done"><h2><span class="jc-count">${r}</span> of ${n}</h2><p>${r >= n * 0.9 ? 'Sharp eyes.' : r >= n * 0.7 ? 'Getting there.' : 'These take many looks: that is how everyone learns them.'}</p>
      ${mix.map(([k]) => { const [a, c] = k.split('|').map((x) => by.get(x)); return `<div class="tr-res no"><b>You mixed up ${esc(a.name)} and ${esc(c.name)}</b><p>${esc(a.name)}: ${esc(tellOf(a))}</p><p>${esc(c.name)}: ${esc(tellOf(c))}</p></div>`; }).join('')}
      <button class="tr-go" data-t="${wasBark ? 'barkonly' : 'quick'}">Another round</button><button class="tr-card wide" data-t="hub"><b>Back to the trees</b></button></div>`);
  }

  /** A tree's page: all its photos, its tell, and where it has been seen. */
  function card(t, opts = {}) {
    const top3 = Object.keys(t.counties).slice(0, 3);
    frame(opts.meet ? `<span class="tr-kick">New tree · ${opts.k} of ${opts.n}</span>` : back(opts.from === 'guide' ? 'Field guide' : 'Trees'),
      `<h2>${esc(t.name)}</h2><p class="tr-sci">${esc(t.sci)}</p>
      <div class="tr-strip">${(mine[t.id] || []).map((p) => myImg(p)).join('')}${t.photos.map((p) => img(p)).join('')}</div>
      <div class="tw-mine"><button class="sk-link" data-t="snap" data-id="${t.id}">${(mine[t.id] || []).length ? 'Add another photo of yours' : 'Add your own photo of this tree'}</button>${(mine[t.id] || []).length ? ` · <button class="sk-link" data-t="unsnap" data-k="${mine[t.id][mine[t.id].length - 1].k}" data-id="${t.id}">remove your latest</button>` : ''}<small>Your photos stay on this device and come back in your reviews.</small></div>
      <div class="tk-tellrow"><div class="tk-sil">${leafArt(t.id)}</div><p class="tr-tell">${esc(t.tell)}</p></div>
      ${leafVariants(t.id).length > 1 ? `<h4>Its leaf through the year</h4><div class="tn-leafyr">${leafVariants(t.id).map((v) => `<figure>${leafSvg(t.id, '', v)}<figcaption>${v.season === 'fall' ? 'Fall' : 'Summer'}</figcaption></figure>`).join('')}</div>` : ''}
      ${(() => { const P = PROFILE[t.id] || {}; const yr = [P.fall, ...(P.more || [])].filter(Boolean); return (P.bark || P.young ? `<h4>Bark</h4><div class="tn-bark">${t.photos.filter((p) => p.ctx === 'bark').slice(0, 3).map((p) => `<figure class="tn-barkph"><img src="${esc(p.f)}" alt="" loading="lazy">${p.cap ? `<figcaption>${esc(p.cap)}</figcaption>` : ''}</figure>`).join('')}</div><p class="tn-line">${P.young ? `<b>Young:</b> ${esc(P.young)} ` : ''}${P.bark ? `${P.young ? '<b>Older:</b> ' : ''}${esc(P.bark)}` : ''}</p>` : '') + (yr.length ? `<h4>Through the year</h4><ul class="tn-year">${yr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''); })()}
      ${has3d(t.id) ? `<h4>In 3D</h4><div class="t3-wrap"><div class="t3-stage"></div><div class="t3-seasons">${['spring', 'summer', 'fall', 'winter'].map((x) => `<button data-t="t3season" data-id="${t.id}" data-s="${x}">${SEASON_WORD[x]}</button>`).join('')}</div><p class="sk-cap">Drag to turn. A model of how this tree grows, from its branching and outline, with its own traced leaf.</p><button class="tr-card wide gr-card" data-t="grow" data-id="${t.id}"><b>Watch it grow</b><small>from a seed to old age, the seasons turning every year</small></button></div>` : ''}
      ${(t.drawings || []).length ? `<h4>${t.drawings.length > 1 ? 'Botanists’ drawings' : 'A botanist’s drawing'}</h4>${t.drawings.map((d) => drawingHtml(d)).join('')}` : ''}
      <button class="tk-ingroup" data-t="groupcard" data-g="${groupOf(t.id).id}"><small>One of the <b>${esc(groupOf(t.id).name.toLowerCase())}</b>: ${esc(groupOf(t.id).tell[t.id])}</small></button>
      ${pathHtml(t.id)}
      <div class="tr-facts">${t.arr === 'opposite' || t.arr === 'alternate' ? `${HAS_OUTLINE(t.id) ? `<span class="sk-twigchip">${twigSvg(t.id, { arr: t.arr, n: t.arr === 'opposite' ? 2 : 3 })}</span>` : ''}<button class="tn-fact" data-t="lesson" data-sk="pairs">Leaves <b>${t.arr === 'opposite' ? 'in pairs' : 'one at a time'}</b> on the twig <i>what's that?</i></button><button class="tn-fact" data-t="lesson" data-sk="leaflets"><b>${t.leaf === 'compound' ? 'A leaf made of leaflets' : 'One leaf'}</b> on each stalk <i>what's that?</i></button>` : `<button class="tn-fact" data-t="lesson" data-sk="look">Green all year, with <b>${t.arr}</b> <i>what's that?</i></button>`}</div>
      ${HAS_OUTLINE(t.id) ? `<p class="tr-src">${leafVariants(t.id).length > 1 ? 'Leaf pictures' : 'Leaf picture'} traced from photos: ${leafVariants(t.id).map((v) => esc(v.credit.replace(/^\(c\)/, '©').replace(/,? some rights reserved/, ''))).filter((c, i, a) => a.indexOf(c) === i).join('; ')} · iNaturalist</p>` : ''}
      ${t.checked ? `<p class="tr-src">Checked against <a href="${esc(t.checked.src)}" target="_blank" rel="noopener">Wikipedia</a>${t.checked.note ? `. ${esc(t.checked.note)}` : ''}</p>` : ''}
      <button class="tr-where" data-t="where" data-id="${t.id}"><b>Where it has been seen</b><small>${top3.length ? `Most in ${esc(top3.join(', '))}` : ''} · show on the map</small></button>
      ${opts.meet ? '<button class="tr-go" data-t="next">Got it</button>' : ''}`);
    q = { kind: 'card', t, opts };
    drop3d(); if (has3d(t.id)) show3d(t.id, season());
  }
  function guide() {
    frame(back(), `<h2>Field guide</h2>${GROUPS.map((g) => `<button class="tk-gh" data-t="groupcard" data-g="${g.id}" data-from="guide">${esc(g.name)} <span>compare ›</span></button><div class="tr-list">${Object.keys(g.tell).map((id) => by.get(id)).filter(Boolean).map((t) => `<button class="tr-li" data-t="card" data-id="${t.id}" data-from="guide"><span class="tk-li-sil">${leafArt(t.id)}</span><span><b>${esc(t.name)}</b><small>${esc(g.tell[t.id])}</small></span></button>`).join('')}</div>`).join('')}`);
  }
  /** The map, with every sighting of one tree; the screen steps aside. */
  function where(t) {
    if (!layer) {
      layer = true;
      map.addSource('trees-pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'trees-pts', type: 'circle', source: 'trees-pts', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3.5, 11, 6], 'circle-color': '#2f8f5b', 'circle-opacity': 0.75, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.2 } });
    }
    map.getSource('trees-pts').setData({ type: 'FeatureCollection', features: t.pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })) });
    map.setLayoutProperty('trees-pts', 'visibility', 'visible');
    root.classList.add('peek');
    const b = ctx.region.bounds;
    map.fitBounds(b, { padding: { top: 120, bottom: 110, left: 20, right: 20 }, bearing: 0, pitch: 0, duration: 900 });
    const top = Object.entries(t.counties).slice(0, 4).map(([c, n]) => `${esc(c)} ${n}`).join(' · ');
    ctx.hud(`<div class="qkind">Where it has been seen</div><div class="q"><b>${esc(t.name)}</b></div><div class="meta">${t.pts.length} of the best-documented sightings (of ${t.count.toLocaleString()} in New Jersey). ${top}</div>`);
    const pb = document.createElement('button'); pb.className = 'tr-peekback'; pb.textContent = 'Back to the tree'; pb.addEventListener('click', actions.unpeek); document.body.appendChild(pb);
  }

  // ---- learning to look: a lesson, a panel at a time, then practice on just that one thing
  const runHead = () => (run ? `${back()}<span class="tr-prog">${run.steps.map((s, i) => `<i class="${i < run.i ? 'd' : i === run.i ? 'c' : ''}"></i>`).join('')}</span>` : back());
  function lesson(sk, i = 0) {
    const S = SKILLS[sk], ps = S.panels(H), P = ps[i], last = i === ps.length - 1;
    frame(runHead(), `<span class="tr-kick">Learn to look · ${i + 1} of ${ps.length}</span><h2>${i ? esc(P.h) : esc(S.name)}</h2>${i ? '' : `<p class="tr-sci">${esc(S.short)}</p><h4 class="sk-h">${esc(P.h)}</h4>`}
      <p class="sk-p">${P.p}</p>${P.art ? `<div class="sk-panelart">${P.art}</div>` : ''}
      <div class="sk-nav">${i ? `<button class="tr-card sk-prev" data-t="lstep" data-sk="${sk}" data-i="${i - 1}"><b>Back</b></button>` : ''}
      ${last ? (run ? '<button class="tr-go" data-t="next">Try it</button>' : `<button class="tr-go" data-t="drillrun" data-sk="${sk}">Practise this</button>`) : `<button class="tr-go" data-t="lstep" data-sk="${sk}" data-i="${i + 1}">Next</button>`}</div>`);
    q = { kind: 'lesson', sk, i };
  }
  function drillAsk(sk) {
    const d = SKILLS[sk].drill(H), [lay, tall] = d.layout.split(' ');
    const head = run ? runHead() : `${back()}<span class="tr-kick">Practise</span>`;
    const opts = lay === 'icons' ? `<div class="tk-opts sm">${d.opts.map(([v, l, ic]) => `<button data-t="ans" data-id="${v}">${ICON[ic || v]}<b>${esc(l)}</b></button>`).join('')}</div>`
      : lay === 'tiles' ? `<div class="tk-silpick sk-tiles${tall ? ' tall' : ''}">${d.opts.map(([v, h]) => `<button data-t="ans" data-id="${v}">${h}</button>`).join('')}</div>`
      : `<div class="tr-choices">${d.opts.map(([v, l]) => `<button data-t="ans" data-id="${v}">${esc(l)}</button>`).join('')}</div>`;
    frame(head, `<span class="tr-kick">Learn to look · ${esc(SKILLS[sk].name)}</span><p class="tr-ask">${d.ask}</p>${d.sub ? `<p class="tr-sub">${esc(d.sub)}</p>` : ''}${d.body || ''}${opts}<div class="tr-fb"></div>`);
    q = { kind: 'drill', skill: sk, right: d.right, why: d.why, about: d.about };
  }

  // ---- questions
  function choicesFor(t, pool) {
    const sameG = Object.keys(groupOf(t.id).tell).filter((x) => x !== t.id && pool.includes(x));
    const ids = [...new Set([...sameG, ...t.like.filter((x) => pool.includes(x)), ...shuffle(pool.filter((x) => x !== t.id)), ...shuffle(D.trees.map((x) => x.id).filter((x) => x !== t.id))])].filter((x) => x !== t.id).slice(0, 3);
    return shuffle([t.id, ...ids]).map((id) => by.get(id));
  }
  function ask(t, kind, pool) {
    const head = run ? `${back()}<span class="tr-prog">${run.steps.map((s, i) => `<i class="${i < run.i ? 'd' : i === run.i ? 'c' : ''}"></i>`).join('')}</span>` : `${back()}<span class="tr-kick">Practise</span>`;
    if (kind === 'trait' && !(t.arr === 'opposite' || t.arr === 'alternate')) kind = 'key';
    if (kind === 'key') {
      const steps = pathTo(t.id), [node, ans] = rand(steps.length > 1 ? steps.slice(1) : steps), n = KEY[node];
      const pic = node === 'arr' && HAS_OUTLINE(t.id) ? `<div class="sk-big">${twigSvg(t.id, { arr: t.arr })}</div><p class="sk-cap">A sketch of a ${esc(t.name.toLowerCase())} twig, with its traced leaf</p>` : (node === 'oak' || node === 'lobe' || node === 'opplobe') && HAS_OUTLINE(t.id) ? `<div class="sk-big">${leafSvg(t.id)}</div><p class="sk-cap">The ${esc(t.name.toLowerCase())} leaf, traced from a photo</p>` : img(photoOf(t, node === 'arr' ? ['twig', 'leaf'] : ['leaf', 'twig']), 'big');
      frame(head, `<p class="tr-ask">${esc(n.q)}</p><p class="tr-sub">${esc(t.name)}</p>${pic}<details class="sk-hint"><summary>How do I check?</summary>${esc(n.how)}</details><div class="tk-opts sm">${n.a.map(([label, ic], i) => `<button data-t="ans" data-id="${i}">${ICON[ic]}<b>${esc(label)}</b></button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: String(ans), node };
      return;
    }
    if (kind === 'bark') {
      const bp = t.photos.filter((p) => p.ctx === 'bark' && !hidden().includes(p.pool));
      if (bp.length) {
        const k = barkKindOf(t.id), others = D.trees.filter((x) => x.id !== t.id && x.photos.some((p) => p.ctx === 'bark'));
        const pref = shuffle(others.filter((x) => pool.includes(x.id) && barkKindOf(x.id) === k)).concat(shuffle(others.filter((x) => pool.includes(x.id))), shuffle(others.filter((x) => barkKindOf(x.id) === k)), shuffle(others));
        const ch = shuffle([t, ...pref.filter((x, i, a) => a.indexOf(x) === i).slice(0, 3)]), bph = rand(bp);
        frame(head, `<p class="tr-ask">Whose bark is this?</p>${img(bph, 'big')}<div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div>${bph.pool ? `<button class="sk-link tn-hide" data-t="hidephoto" data-f="${esc(bph.pool)}">Bad photo? Hide it</button>` : ''}<div class="tr-fb"></div>`);
        q = { kind: 'bark', t, right: t.id, how: 'bark' };
        return;
      }
      kind = 'flash';
    }
    if (kind === 'season2') {
      // the same tree in another season: this tree in leaf (or flower or fall), and three winter photos to choose from
      const win = (id) => (POOL.trees[id] || []).filter((p) => p[1] === 'winter' && !hidden().includes(p[0]));
      const others = shuffle(pool.filter((x) => x !== t.id && win(x).length));
      if (win(t.id).length && others.length >= 2) {
        const sum = photoOf(t, ['leaf', 'fall', 'flower', 'fruit']);
        const asUrl = (pp) => { const [pid, ext] = pp[0].split('.'); return [`${POOL.base}${pid}/${POOL.size}.${ext}`, pp[2]]; };
        const opts = shuffle([[t.id, asUrl(rand(win(t.id)))], ...others.slice(0, 2).map((id) => [id, asUrl(rand(win(id)))])]);
        frame(head, `<p class="tr-ask">Here is a <b>${esc(t.name.toLowerCase())}</b>: ${esc({ leaf: 'its leaves', fall: 'its fall colour', flower: 'its flowers', fruit: 'its fruit' }[sum.ctx] || 'in season')}. Which photo is the same kind of tree in winter?</p>${img(sum)}<div class="tk-silpick sk-tiles tn-wintiles">${opts.map(([id, [u]]) => `<button data-t="ans" data-id="${id}"><img src="${esc(u)}" alt=""></button>`).join('')}</div><div class="tr-fb"></div>`);
        q = { kind: 'season2', t, right: t.id, names: true, how: { ctx: 'winter' } };
        return;
      }
      kind = 'flash';
    }
    if (kind === 'plate' && (t.drawings || []).length) {
      const ch = choicesFor(t, pool);
      frame(head, `<p class="tr-ask">Which tree is this botanist's drawing of?</p>${drawingHtml(rand(t.drawings), 'big')}<div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind: 'photo', t, right: t.id, how: 'drawing' };
      return;
    }
    if (kind === 'plate') kind = 'flash';
    if (kind === 'mine' && (mine[t.id] || []).length) {
      const ch = choicesFor(t, pool), p = rand(mine[t.id]);
      frame(head, `<p class="tr-ask">Your photo: which tree is this?</p>${myImg(p, 'big')}<div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind: 'photo', t, right: t.id, how: { ctx: 'leaf' } };
      return;
    }
    if (kind === 'mine') kind = 'flash';
    if (kind === 'flash') {
      const ch = choicesFor(t, pool), [u, credit, file] = poolPhoto(t.id);
      frame(head, `<p class="tr-ask">Which tree is this?</p><figure class="tr-ph big"><img src="${esc(u)}" alt=""><figcaption><span>${esc(credit)} · iNaturalist</span></figcaption></figure><div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div>${file ? `<button class="sk-link tn-hide" data-t="hidephoto" data-f="${esc(file)}">Bad photo? Hide it</button>` : ''}<div class="tr-fb"></div>`);
      q = { kind: 'photo', t, right: t.id, how: { pool: file, season: ((POOL.trees[t.id] || []).find((pp) => pp[0] === file) || [])[1] } };
      return;
    }
    if ((kind === 'shape' || kind === 'shapepick') && !HAS_LEAF(t.id)) kind = 'photo';
    if (kind === 'shapepick' && pool.filter(HAS_LEAF).length < 3) kind = 'shape';
    if (kind === 'shape') {
      const ch = choicesFor(t, pool);
      frame(head, `<p class="tr-ask">Which tree has this leaf?</p><div class="tk-bigsil">${(() => { const lv = leafAny(t.id); return leafSvg(t.id, '', lv) + fallTag(lv); })()}</div><div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: t.id, how: 'leaf' };
      return;
    }
    if (kind === 'shapepick') {
      const ch = choicesFor(t, pool.filter(HAS_LEAF)).filter((c) => HAS_LEAF(c.id));
      frame(head, `<p class="tr-ask">Tap the leaf of the <b>${esc(t.name)}</b></p><div class="tk-silpick">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${leafSvg(c.id, '', leafAny(c.id))}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: t.id, how: 'leaf' };
      return;
    }
    if (kind === 'groupq') {
      const others = shuffle(GROUPS.filter((g) => g.id !== GROUP_OF[t.id])).slice(0, 3);
      const gs = shuffle([groupOf(t.id), ...others]);
      frame(head, `<p class="tr-ask">Which group is this tree in?</p>${img(photoOf(t, ['leaf', 'fall', 'fruit']), 'big')}<div class="tr-choices">${gs.map((g) => `<button data-t="ans" data-id="${g.id}">${esc(g.name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: GROUP_OF[t.id] };
      return;
    }
    if (kind === 'photo') {
      const last = (store.get('trees.lastctx', {}))[t.id];
      const ps = t.photos.filter((p) => p.ctx !== last), sp = ps.filter((p) => SEASON_CTX[season()].includes(p.ctx)), p = rand(sp.length && Math.random() < 0.6 ? sp : ps.length ? ps : t.photos);
      const lc = store.get('trees.lastctx', {}); lc[t.id] = p.ctx; store.set('trees.lastctx', lc);
      const ch = choicesFor(t, pool);
      frame(head, `<p class="tr-ask">Which tree is this?</p>${img(p, 'big')}<div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: t.id, how: { ctx: p.ctx } };
    } else if (kind === 'pick') {
      const ch = choicesFor(t, pool);
      const cx = rand(['leaf', 'bark', 'leaf', 'form']);
      frame(head, `<p class="tr-ask">Tap the <b>${esc(t.name)}</b></p><div class="tr-pick">${ch.map((c) => { const p = photoOf(c, [cx]); return `<button data-t="ans" data-id="${c.id}"><img src="${esc(p.f)}" alt=""><small>${esc(CTX[p.ctx])}</small></button>`; }).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: t.id, how: { ctx: cx } };
    } else if (kind === 'same') {
      const other = Math.random() < 0.5 ? t : by.get(rand(t.like.filter((x) => pool.includes(x)).length ? t.like.filter((x) => pool.includes(x)) : pool.filter((x) => x !== t.id)) || t.id);
      const a = photoOf(t, ['leaf', 'fall']), b = photoOf(other, ['bark', 'form', 'fruit', 'flower', 'twig']);
      frame(head, `<p class="tr-ask">Are these the same kind of tree?</p><div class="tr-two">${img(a)}${img(b)}</div><div class="tr-choices two"><button data-t="ans" data-id="yes">Same tree</button><button data-t="ans" data-id="no">Different trees</button></div><div class="tr-fb"></div>`);
      q = { kind, t, other, right: other === t ? 'yes' : 'no' };
    } else {
      const which = t.leaf === 'compound' || Math.random() < 0.35 ? 'leaf' : 'arr';
      const opts = which === 'arr' ? [['opposite', 'In pairs'], ['alternate', 'One at a time']] : [['simple', 'One leaf'], ['compound', 'Leaflets on one stalk']];
      frame(head, `<p class="tr-ask">${which === 'arr' ? `Do the leaves of the <b>${esc(t.name)}</b> grow in pairs, or one at a time?` : `Does the <b>${esc(t.name)}</b> have one leaf on each stalk, or leaflets?`}</p>${which === 'arr' && HAS_OUTLINE(t.id) ? `<div class="sk-big">${twigSvg(t.id, { arr: t.arr })}</div>` : which === 'leaf' && HAS_OUTLINE(t.id) ? `<div class="sk-big">${leafSvg(t.id)}</div>` : img(photoOf(t, ['leaf', 'twig']), 'big')}<div class="tr-choices two">${opts.map(([v, l]) => `<button data-t="ans" data-id="${v}">${l}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind: 'trait', t, right: t[which] };
    }
  }
  function answer(btn) {
    if (!q || q.done || !q.right) return;
    q.done = true;
    if (q.skill) {
      const ok = btn.dataset.id === q.right;
      if (run) { run.right += ok ? 1 : 0; const st = run.steps[run.i]; if (!st.review) { run.skr = run.skr || {}; const [r = 0, n = 0] = run.skr[q.skill] || []; run.skr[q.skill] = [r + (ok ? 1 : 0), n + 1]; } }
      for (const b of root.querySelectorAll('[data-t=ans]')) { b.disabled = true; if (b.dataset.id === q.right) b.classList.add('right'); }
      if (!ok) btn.classList.add('wrong');
      feel(ok, btn, q.about ? q.about.id : null);
      root.querySelector('.tr-fb').innerHTML = `<div class="tr-res ${ok ? 'ok' : 'no'}"><b>${ok ? '✓ Yes' : '✗ Not quite'}</b>${comboChip()}<p>${esc(q.why)}</p>${q.about ? `<p class="sk-about">That was ${/^[aeiou]/i.test(q.about.name) ? 'an' : 'a'} ${esc(q.about.name.toLowerCase())}.</p>` : ''}</div><button class="tr-go" data-t="next">Next</button>`;
      root.querySelector('.tr-go').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    const ok = btn.dataset.id === q.right, t = q.t;
    record(t.id, ok);
    if (run) { run.right += ok ? 1 : 0; }
    for (const b of root.querySelectorAll('[data-t=ans]')) { b.disabled = true; if (b.dataset.id === q.right) b.classList.add('right'); }
    if (!ok) btn.classList.add('wrong');
    feel(ok, btn, t.id);
    let line = '';
    if (q.kind === 'key') line = `${esc(KEY[q.node].a[+q.right][0])}. The questions that lead to it: ${pathTo(t.id).map(([n, i]) => esc(KEY[n].a[i][0])).join(' › ')}.`;
    else if (q.kind === 'groupq') line = `One of the <b>${esc(groupOf(t.id).name.toLowerCase())}</b>: ${esc(groupOf(t.id).why)}`;
    else if (q.kind === 'same') line = q.right === 'yes' ? `Both are <b>${esc(t.name)}</b>.` : `The first is <b>${esc(t.name)}</b>; the second is <b>${esc(q.other.name)}</b>.`;
    else if (q.kind === 'pick' && !ok) line = `You tapped <b>${esc(by.get(btn.dataset.id).name)}</b>.`;
    else if (q.kind === 'photo' && !ok) { const w = by.get(btn.dataset.id); line = `That was ${esc(w.name)}: ${esc(groupOf(w.id).tell[w.id])}`; }
    if (q.kind === 'shapepick') for (const b of root.querySelectorAll('.tk-silpick button')) b.insertAdjacentHTML('beforeend', `<em>${esc(by.get(b.dataset.id).name)}</em>`);
    if ((q.kind === 'shape' || q.kind === 'shapepick') && !ok) { const w = by.get(btn.dataset.id); line = `${q.kind === 'shape' ? 'That' : 'You tapped the'} ${esc(w.name)}: ${esc(groupOf(w.id).tell[w.id])}`; }
    if (q.kind === 'pick') for (const b of root.querySelectorAll('.tr-pick button')) b.insertAdjacentHTML('beforeend', `<em>${esc(by.get(b.dataset.id).name)}</em>`);
    if (q.kind === 'season2') for (const b of root.querySelectorAll('.tn-wintiles button')) b.insertAdjacentHTML('beforeend', `<em>${esc(by.get(b.dataset.id).name)}</em>`);
    if (q.kind === 'bark' && PROFILE[t.id] && PROFILE[t.id].bark) line = `${esc(t.name)} bark: ${esc(PROFILE[t.id].bark)}`;
    const cmp = !ok && by.has(btn.dataset.id) && !['pick', 'shapepick', 'season2', 'same'].includes(q.kind) ? compareHtml(btn.dataset.id, q.how) : '';
    if (cmp && (q.kind === 'photo' || q.kind === 'shape')) line = '';      // the comparison says what the one you picked is
    const treeQ = by.has(q.right) && by.has(btn.dataset.id) && q.kind !== 'same';
    const res = treeQ ? idPair(q.right, btn.dataset.id, q.how, ok, comboChip())
      : `<div class="tr-res ${ok ? 'ok' : 'no'}"><b>${ok ? '✓' : '✗ It was'} ${esc(t.name)}</b>${comboChip()}${line ? `<p>${line}</p>` : ''}<p>${esc(groupOf(t.id).tell[t.id])}</p></div>`;
    root.querySelector('.tr-fb').innerHTML = `${res}${cmp}<button class="tr-go" data-t="next">Next</button>`;
    root.querySelector('.tr-go').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---- today: meet a few new trees, then questions on them and on what is due
  function buildToday() {
    const m = met(), s = srs();
    const learnt = Object.keys(SKILLS).filter(skillDone);
    const revSkill = learnt.length && Math.random() < 0.5 ? [{ drill: rand(learnt), review: true }] : [];
    const mix = (qs) => { const x = shuffle(qs); for (let i = 1; i < x.length; i++) if (x[i].id && x[i].id === x[i - 1].id) { const j = x.findIndex((y, k) => k > i && y.id !== x[i].id); if (j > 0) [x[i], x[j]] = [x[j], x[i]]; } return x; };
    const kinds = ['flash', 'flash', 'photo', 'pick', 'same', 'key', 'groupq', 'shape', 'shapepick', 'plate', 'bark', 'bark', 'season2'];
    // the next trees on your local list (two a day; three on the very first day)
    const fresh = ranked().list.filter((t) => !m.includes(t.id)).slice(0, m.length ? 2 : 3).map((t) => t.id);
    const due = shuffle(m.filter((id) => isDue(id, s))).slice(0, Math.max(4, SET - fresh.length * 2));
    const steps = fresh.map((id, k) => ({ meet: id, k: k + 1, n: fresh.length }));
    const qs = [];
    for (const id of fresh) qs.push({ id, kind: 'flash' }, { id, kind: rand(['shape', 'photo']) }, { id, kind: rand(['pick', 'flash', 'key']) });
    for (const id of due) qs.push({ id, kind: rand(kinds) });
    const extra = shuffle(m.filter((id) => !due.includes(id)));
    while (qs.length < Math.min(SET + 2, (m.length + fresh.length) * 2) && extra.length) qs.push({ id: extra.pop(), kind: rand(['flash', 'photo', 'pick', 'same']) });
    const withMine = m.filter((id) => (mine[id] || []).length);
    if (withMine.length) qs.push({ id: rand(withMine), kind: 'mine' });
    return [...steps, ...mix([...qs, ...revSkill])];
  }
  function startToday() {
    const t = store.get('trees.today', {});
    if (t.d === today() && t.done) return practise();
    run = { steps: t.d === today() && t.steps && t.i < t.steps.length ? t.steps : buildToday(), i: t.d === today() && t.steps ? t.i : 0, right: (t.d === today() && t.right) || 0, today: true };
    step();
  }
  function saveRun(done = false) { if (run && run.today) store.set('trees.today', { d: today(), steps: run.steps, i: run.i, n: run.steps.length, right: run.right, done }); }
  function step() {
    if (!run) return hub();
    if (run.i >= run.steps.length) return finish();
    saveRun();
    const s = run.steps[run.i];
    if (s.group) return groupCard(GROUPS.find((g) => g.id === s.group), { meet: true });
    if (s.meet) return card(by.get(s.meet), { meet: true, k: s.k, n: s.n });
    if (s.lesson) return lesson(s.lesson);
    if (s.drill) return drillAsk(s.drill);
    const pool = [...new Set([...met(), s.id])];
    ask(by.get(s.id), pool.length < 2 ? 'trait' : s.kind, pool);
  }
  function next() {
    if (run) {
      const s = run.steps[run.i];
      if (s && s.meet) { const m = store.get('trees.met', []); if (!m.includes(s.meet)) { m.push(s.meet); store.set('trees.met', m); } }
      run.i++; return step();
    }
    practise();
  }
  function finish() {
    const n = run.steps.filter((s) => !s.meet && !s.group && !s.lesson).length, r = run.right, wasToday = run.today;
    const skl = Object.entries(run.skr || {}).map(([sk, [sr, sn]]) => {
      const was = skillDone(sk), ok = skillResult(sk, sr, sn);
      return `<div class="tr-res ${ok ? 'ok' : 'no'}"><b>${ok ? '✓' : '·'} ${esc(SKILLS[sk].name)}: ${sr} of ${sn}</b><p>${ok ? (was ? 'Still easy for you.' : 'Learned. It will come up now and then so it stays easy.') : `You need ${PASS} of ${sn}. It comes back next time, with the lesson first.`}</p></div>`;
    }).join('');
    if (wasToday) { saveRun(true); const days = store.get('trees.days', []); if (!days.includes(today())) { days.push(today()); store.set('trees.days', days.slice(-400)); } }
    run = null;
    const nx = ranked().list.find((x) => !met().includes(x.id));
    setTimeout(() => { juice.done(r >= n * 0.7); juice.countUp(root.querySelector('.jc-count'), r); if (r >= n * 0.7) juice.fall(met().map(leafSrc).filter(Boolean)); }, 120);
    frame(back(), `<div class="tr-done"><h2>${wasToday ? 'Done for today' : 'Practice done'}</h2><p><b class="jc-count">${r}</b> of ${n} right · ${met().length} of ${D.trees.length} trees met${streak() ? ` · ${streak()}-day streak` : ''}</p>${skl}
      ${nx ? `<p class="tr-sci">Next on your list: <b>${esc(nx.name)}</b>.</p>` : ''}
      ${wasToday ? '<p class="tr-sci">The trees you have met come back tomorrow, in three days, in a week: each time from a different side.</p>' : ''}
      <button class="tr-go" data-t="hub">Back to the trees</button>${nx && wasToday ? `<button class="tr-card wide" data-t="more"><b>Keep going</b><small>meet the ${esc(nx.name.toLowerCase())}</small></button>` : '<button class="tr-card wide" data-t="practise">Keep practising</button>'}</div>`);
  }
  function practise() {
    run = null;
    const m = met(), learnt = Object.keys(SKILLS).filter(skillDone);
    if (m.length < 2 && !learnt.length) return hub();
    const s = srs(), due = m.filter((id) => isDue(id, s));
    if (learnt.length && (m.length < 2 || Math.random() < 0.25)) return drillAsk(rand(learnt));
    const id = rand(due.length ? due : m);
    ask(by.get(id), rand(['flash', 'flash', 'photo', 'pick', 'same', 'key', 'groupq', 'shape', 'shapepick', 'plate', 'bark', 'bark', 'season2']), m);
  }

  const actions = {
    // (the home page is drawn under this screen: step aside for it, and come back if Trees is chosen again)
    identify: () => identify(), keypick: keyPick, groupcard: (b) => groupCard(GROUPS.find((g) => g.id === b.dataset.g), { from: b.dataset.from }),
    home: async () => { root.hidden = true; if (ctx.showHome) await ctx.showHome(); if (ctx.mode === 'trees') { root.hidden = false; hub(); } }, hub, today: startToday, practise, guide, next, ans: answer,
    card: (b) => card(by.get(b.dataset.id), { from: b.dataset.from }),
    lesson: (b) => { run = null; lesson(b.dataset.sk); },
    spot: spotPicker, spotmap: spotFromMap, spotclear: () => { store.set('trees.spot', null); hub(); },
    spotset: (b) => { const a = store.get('anchors', [])[+b.dataset.i]; if (a) store.set('trees.spot', { name: a.name, pt: a.pt }); hub(); },
    mute: (b) => { juice.setMuted(!juice.muted); b.textContent = juice.muted ? '🔇' : '🔊'; if (!juice.muted) juice.tap(); },
    rain: rainStart,
    quick: () => quickStart(), barkonly: () => quickStart('bark'), qans: quickAnswer, qnext: () => { if (quick) { quick.i++; quickAsk(); } },
    t3season: (b) => show3d(b.dataset.id, b.dataset.s),
    grow: (b) => growScreen(b.dataset.id),
    grplay: (b) => { if (!grow) return; if (b.textContent === 'Watch again') { grow.bi = 0; grow.p = 0; } if (grow.free) { grow.free = false; grow.p = 0; } grow.playing = !grow.playing || b.textContent === 'Watch again'; grow.last = performance.now(); b.textContent = grow.playing ? 'Pause' : 'Play'; },
    grbeat: (b) => { if (!grow) return; grow.free = false; grow.bi = +b.dataset.i; grow.p = 0; grow.playing = true; grow.last = performance.now(); const pl = root.querySelector('.gr-play'); if (pl) pl.textContent = 'Pause'; },
    grprev: () => { if (!grow) return; grow.free = false; grow.bi = Math.max(0, grow.p > 0.15 ? grow.bi : grow.bi - 1); grow.p = 0; },
    grnext: () => { if (!grow) return; grow.free = false; grow.bi = Math.min(grow.beats.length - 1, grow.bi + 1); grow.p = 0; grow.playing = true; const pl = root.querySelector('.gr-play'); if (pl) pl.textContent = 'Pause'; }, name3d: nameStart, n3ans: nameAnswer, n3next: () => { if (n3) { n3.i++; nameAsk(); } },
    walk: walkIntro, walkgps: () => walkBegin('gps'), walkspot: () => walkBegin('spot', spot().pt), walkmap: walkFromMap,
    snap: (b) => snap(b.dataset.id, () => card(by.get(b.dataset.id))),
    unsnap: async (b) => { await removePhoto(+b.dataset.k); card(by.get(b.dataset.id)); },
    hidephoto: (b) => { const h = hidden(); if (!h.includes(b.dataset.f)) { h.push(b.dataset.f); store.set('trees.hidden', h.slice(-500)); } b.textContent = 'Hidden: you won’t see it again'; b.disabled = true; }, lstep: (b) => lesson(b.dataset.sk, +b.dataset.i),
    drillrun: (b) => { run = { steps: Array.from({ length: DRILL_N }, () => ({ drill: b.dataset.sk })), i: 0, right: 0, today: false }; step(); },
    more: () => { run = { steps: buildToday(), i: 0, right: 0, today: true }; step(); },
    where: (b) => where(by.get(b.dataset.id)),
    unpeek: () => { root.classList.remove('peek'); document.querySelector('.tr-peekback')?.remove(); ctx.hud(''); if (layer) map.setLayoutProperty('trees-pts', 'visibility', 'none'); },
  };

  return {
    async enter() {
      document.body.classList.add('trees-on');
      await load(); mount(); root.hidden = false;
      ctx.clearHighlights && ctx.clearHighlights(); ctx.sheet(''); ctx.hud('');
      hub();
    },
    leave() {
      walkEnd(true); drop3d();
      document.body.classList.remove('trees-on');
      if (root) root.hidden = true;
      if (layer) map.setLayoutProperty('trees-pts', 'visibility', 'none');
      document.querySelector('.tr-peekback')?.remove();
      ctx.hud('');
    },
  };
}
