// Deep Jersey: how the ground under New Jersey was made, and what people made of it.
// It opens on a short explanation and three ways in:
//   The story     the land built from the oldest rock forward, chapter by chapter (Next / Back), at the scale of the whole region:
//                 each belt of rock is drawn in full past the state line (the USGS physiographic map), then the ice, the lake, people.
//   The land today the regions New Jersey shares with its neighbours (Valley and Ridge, Highlands, the rift basins, the Coastal Plain,
//                 and the Poconos and Catskills next door), each shown whole.
//   Close-ups     the same story step by step in one place: Boonton and the Rockaway, and the Pine Barrens (stops, story cards, a chain
//                 from rock to ruin, and two light games).
// Data: data/deep/*.json (tools/build_deep.py: USGS and OpenStreetMap); the words in js/deepcards.js, each card with its sources.
import { CORRIDORS, CARD, SRC, WHY, STORY, LAND } from './deepcards.js';
import { juice } from './juice.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const KIND_COLOR = { rock: '#9a5b3c', ice: '#3d7fbf', lenape: '#a2652a', iron: '#5b5f66', canal: '#2f7d6d', water: '#2f6fb0', legend: '#7a4a8c' };
const ERA_FILL = { grenville: '#c98f6a', paleozoic: '#a9b27a', newark: '#c4614b', basalt: '#4a3b3b', diabase: '#6b5b73', coastal: '#e3d29a' };
const REGION_COLOR = Object.fromEntries(LAND.map((r) => [r.id, r.color]));
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const LAYERS = ['deep-hs', 'deep-prov', 'deep-prov-line', 'deep-rocks', 'deep-sand', 'deep-flows', 'deep-lake', 'deep-ice-sheet', 'deep-icelines', 'deep-ice-older', 'deep-ice-limit', 'deep-canal'];
const WIDE = [[-92, 30], [-58, 50]];          // while Deep Jersey is open the map may pull out past the New Jersey frame
const BACK = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function initDeep(ctx) {
  const { map, store } = ctx;
  let root = null, bar = null, pinEl = null, data = null, timers = [], game = null;
  let view = 'intro', chap = store.get('deep.chapter', 0), era = 0, ret = null, landSel = null;
  // the close-up on show: its stops, cards and chain
  let cor, ERAS, CARDS, CHAIN, ERA_INDEX;
  function setCorridor(id) {
    cor = CORRIDORS.find((c) => c.id === id) || CORRIDORS[0]; store.set('deep.corridor', cor.id);
    ({ eras: ERAS, cards: CARDS, chain: CHAIN } = cor); ERA_INDEX = Object.fromEntries(ERAS.map((e, i) => [e.id, i]));
  }
  setCorridor(store.get('deep.corridor', 'boonton'));
  const corOf = (cardId) => CORRIDORS.find((c) => c.cards.some((x) => x.id === cardId));
  const seen = () => store.get('deep.seen', []);
  const markSeen = (id) => { const s = seen(); if (!s.includes(id)) store.set('deep.seen', [...s, id]); };

  async function load() {
    if (data) return;
    const names = ['rocks', 'flows', 'ice', 'lakes', 'canal', 'sand', 'provinces', 'icelines'];
    const got = await Promise.all(names.map((f) => fetch(`data/deep/${f}.json`).then((r) => r.json())));
    data = Object.fromEntries(names.map((n, i) => [n, got[i]]));
  }

  // ---- map layers -----------------------------------------------------------------------------------------------------------
  function addLayers() {
    if (map.getSource('deep-rocks')) { for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); return; }
    map.addSource('deep-dem', { type: 'raster-dem', tiles: [DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 11, attribution: 'Terrain: AWS Terrain Tiles (USGS 3DEP and others)' });
    map.addSource('deep-dem-hs', { type: 'raster-dem', tiles: [DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 11 });
    map.addSource('deep-prov', { type: 'geojson', data: data.provinces, attribution: 'Regions: USGS Physiographic Divisions (Fenneman and Johnson 1946)' });
    map.addSource('deep-rocks', { type: 'geojson', data: data.rocks, attribution: 'Geology: USGS State Geologic Map Compilation; USGS I-1420, I-2540-C' });
    map.addSource('deep-flows', { type: 'geojson', data: data.flows });
    map.addSource('deep-ice', { type: 'geojson', data: data.ice });
    map.addSource('deep-icelines', { type: 'geojson', data: data.icelines });
    map.addSource('deep-lakes', { type: 'geojson', data: data.lakes });
    map.addSource('deep-sand', { type: 'geojson', data: data.sand });
    map.addSource('deep-canal', { type: 'geojson', data: data.canal, attribution: 'Canal: © OpenStreetMap contributors' });
    const T = { duration: ctx.dur(900), delay: 0 };
    map.addLayer({ id: 'deep-hs', type: 'hillshade', source: 'deep-dem-hs', paint: { 'hillshade-exaggeration': 0.6, 'hillshade-shadow-color': '#3f4a44', 'hillshade-highlight-color': '#ffffff' } });
    map.addLayer({ id: 'deep-prov', type: 'fill', source: 'deep-prov', paint: { 'fill-color': ['match', ['get', 'region'], ...Object.entries(REGION_COLOR).flat(), '#999'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-prov-line', type: 'line', source: 'deep-prov', paint: { 'line-color': ['match', ['get', 'region'], ...Object.entries(REGION_COLOR).flat(), '#999'], 'line-width': 1.4, 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-rocks', type: 'fill', source: 'deep-rocks', paint: { 'fill-color': ['match', ['get', 'era'], ...Object.entries(ERA_FILL).flat(), '#999'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-sand', type: 'fill', source: 'deep-sand', paint: { 'fill-color': ['match', ['get', 'unit'], 'cohansey', '#e6c86e', '#c9b48c'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-flows', type: 'fill', source: 'deep-flows', paint: { 'fill-color': ['match', ['get', 'flow'], 1, '#b0412e', 2, '#c96a2b', '#d99a2b'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-lake', type: 'fill', source: 'deep-lakes', paint: { 'fill-color': '#3f86c9', 'fill-opacity': 0, 'fill-opacity-transition': T }, filter: ['==', ['get', 'stage'], 'moggy'] });
    map.addLayer({ id: 'deep-ice-sheet', type: 'fill', source: 'deep-ice', filter: ['==', ['get', 'kind'], 'sheet'], paint: { 'fill-color': '#eef6fb', 'fill-opacity': 0, 'fill-opacity-transition': { duration: ctx.dur(1600), delay: 0 } } });
    map.addLayer({ id: 'deep-icelines', type: 'line', source: 'deep-icelines', paint: { 'line-color': '#4f86b5', 'line-width': 1.3, 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-ice-older', type: 'line', source: 'deep-ice', filter: ['==', ['get', 'kind'], 'older'], paint: { 'line-color': '#7aa6c8', 'line-width': 1.2, 'line-dasharray': [2, 2], 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-ice-limit', type: 'line', source: 'deep-ice', filter: ['==', ['get', 'kind'], 'limit'], paint: { 'line-color': '#2b6aa3', 'line-width': 3, 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-canal', type: 'line', source: 'deep-canal', paint: { 'line-color': '#1f7a68', 'line-width': 3, 'line-opacity': 0, 'line-opacity-transition': T } });
  }
  function hideLayers() { if (pinEl) pinEl.hidden = true; for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); }
  const op = (id, prop, v) => { if (map.getLayer(id)) map.setPaintProperty(id, prop, v); };

  /** What the map shows. sc: { prov: {region: opacity}, provFaint, rocks, flows ('anim' or opacity), sand, iceSheet, iceLimit, iceLines,
   * iceOlder, lake ('moggy'|'notch'), canal, pins: [card ids], labels: [region ids] } */
  function applyScene(sc) {
    for (const t of timers) clearTimeout(t); timers = [];
    const prov = sc.prov || {}, faint = sc.provFaint ?? 0;
    const pm = ['match', ['get', 'region'], ...Object.entries(prov).flat(), faint];
    op('deep-prov', 'fill-opacity', Object.keys(prov).length || faint ? pm : 0);
    op('deep-prov-line', 'line-opacity', Object.keys(prov).length ? ['match', ['get', 'region'], ...Object.keys(prov).flatMap((k) => [k, 0.9]), 0] : 0);
    op('deep-rocks', 'fill-opacity', sc.rocks ?? 0);
    if (sc.flows === 'anim') {
      op('deep-flows', 'fill-opacity', 0);
      [1, 2, 3].forEach((n, k) => timers.push(setTimeout(() => op('deep-flows', 'fill-opacity', ['case', ['<=', ['get', 'flow'], n], 0.9, 0]), ctx.dur(700 + k * 1100))));
    } else op('deep-flows', 'fill-opacity', sc.flows ?? 0);
    op('deep-sand', 'fill-opacity', typeof sc.sand === 'number' ? ['match', ['get', 'unit'], 'cohansey', sc.sand, sc.sand * 0.55] : sc.sand ?? 0);
    op('deep-ice-sheet', 'fill-opacity', sc.iceSheet ?? 0);
    op('deep-ice-limit', 'line-opacity', sc.iceLimit ?? 0);
    op('deep-icelines', 'line-opacity', sc.iceLines ?? 0);
    op('deep-ice-older', 'line-opacity', sc.iceOlder ?? 0);
    if (sc.lake) { map.setFilter('deep-lake', ['==', ['get', 'stage'], sc.lake]); op('deep-lake', 'fill-opacity', 0.7); } else op('deep-lake', 'fill-opacity', 0);
    op('deep-canal', 'line-opacity', sc.canal ?? 0);
    drawPins(sc.pins || [], sc.labels || Object.keys(prov).filter((k) => prov[k] >= 0.3));
  }
  /** A close-up stop's scene. */
  function stopScene(id) {
    const rocks = { highlands: ['match', ['get', 'era'], 'grenville', 0.75, 0.12], paleo: ['match', ['get', 'era'], 'paleozoic', 0.75, 'grenville', 0.3, 0.1],
      rift: ['match', ['get', 'era'], 'newark', 0.6, 'diabase', 0.7, 'grenville', 0.25, 'paleozoic', 0.25, 0], ice: 0.18, moggy: 0.14, notch: 0.14 }[id] ?? 0;
    return {
      rocks, flows: id === 'rift' ? 'anim' : ['ice', 'moggy', 'notch'].includes(id) ? 0.45 : id === 'paleo' || id === 'highlands' ? 0 : 0.12,
      iceSheet: id === 'ice' ? 0.88 : 0, iceLimit: ['ice', 'moggy', 'notch'].includes(id) ? 0.95 : id === 'today' ? 0.35 : 0, iceOlder: id === 'ice' ? 0.7 : 0,
      lake: id === 'moggy' || id === 'notch' ? id : null, canal: id === 'canal' ? 0.95 : id === 'today' ? 0.8 : 0,
      sand: id === 'p-sand' ? 0.75 : id.startsWith('p-') ? ['match', ['get', 'unit'], 'cohansey', 0.22, 0] : 0,
      pins: CARDS.filter((c) => c.p && c.era === id).map((c) => c.id),
    };
  }

  // story pins and region names: an overlay placed with map.project (map layers drop points over terrain that has not loaded yet)
  let shown = { pins: [], labels: [] };
  function drawPins(pins, labels) {
    if (!pinEl) {
      pinEl = document.createElement('div'); pinEl.id = 'deeppins'; document.body.appendChild(pinEl);
      pinEl.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) openCard(b.dataset.id); else { const l = e.target.closest('[data-region]'); if (l) landOne(l.dataset.region); } });
      map.on('move', placePins);
    }
    shown = { pins, labels };
    const LP = { valleyridge: [-75.55, 40.72], plateau: [-75.55, 41.3] };     // names kept apart where the two belts meet by New Jersey
    const lp = (k) => { const p = (data.provinces.features.find((f) => f.properties.region === k) || {}).properties; return p && LP[k] ? { ...p, lp: LP[k] } : p; };
    pinEl.innerHTML = labels.map((k) => { const p = lp(k), r = LAND.find((x) => x.id === k); return p && r ? `<b class="dp-rl" data-region="${k}" data-p="${p.lp}" style="--k:${r.color}">${esc(r.name.replace(/ \(.*\)|:.*$/, ''))}</b>` : ''; }).join('')
      + pins.map((id) => { const c = CARD[id]; return c && c.p ? `<button data-id="${id}" data-p="${c.p}" style="--k:${KIND_COLOR[c.kind]}"><i></i><span>${esc(c.title)}</span></button>` : ''; }).join('');
    pinEl.hidden = false; placePins();
  }
  function placePins() {
    if (!pinEl || pinEl.hidden || ctx.mode !== 'deep') return;
    const P = pad(), H = innerHeight;
    for (const b of pinEl.children) {
      const q = map.project(b.dataset.p.split(',').map(Number));
      const vis = q.x > 8 && q.x < innerWidth - 8 && q.y > P.top && q.y < H - P.bottom + 4;
      b.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)`; b.style.visibility = vis ? 'visible' : 'hidden';
    }
  }
  /** The strip of map between the bar (when shown) and the sheet: the camera centres there. */
  const pad = () => { const t = bar && !bar.hidden ? bar.getBoundingClientRect().bottom + 8 : 12, b = root && !root.hidden ? Math.max(12, innerHeight - root.getBoundingClientRect().top + 8) : 12; return { top: t, bottom: b, left: 20, right: 20 }; };
  /** Fit a box in the free strip. (fitBounds adds any padding already stored on the map, which every flyTo leaves behind: clear it first.) */
  const fitBox = (bb, maxZoom) => { const p = pad(); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }); map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: p, pitch: 0, bearing: 0, duration: ctx.dur(1800), maxZoom }); };
  const fly = (center, zoom, pitch = 0, dur = 1800) => map.flyTo({ center, zoom, pitch, bearing: zoom > 8 ? -12 : 0, padding: pad(), duration: ctx.dur(dur), essential: true });

  // ---- the bar: Newer / Older (close-ups) or Back / Next (the story), with a dot per step -------------------------------------
  function setBar(items, i, labels) {
    if (!items) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.querySelector('.dp-when').textContent = items[i].when; bar.querySelector('.dp-title').textContent = items[i].title;
    const [l, r] = bar.querySelectorAll('.dp-arrow'); l.disabled = i === 0; r.disabled = i === items.length - 1;
    l.setAttribute('aria-label', labels[0]); r.setAttribute('aria-label', labels[1]);
    bar.querySelector('.dp-dots').innerHTML = items.map((e, k) => `<button data-b="go" data-i="${k}" aria-label="${esc(e.when)}: ${esc(e.title)}"${k === i ? ' class="on" aria-current="step"' : ''}></button>`).join('');
  }
  function barGo(i) {
    if (view === 'story') { if (i >= 0 && i < STORY.length) chapter(i); }
    else if (view === 'close') { if (i >= 0 && i < ERAS.length && i !== era) { showStop(i); stopSheet(); } }
  }

  // ---- panel ----------------------------------------------------------------------------------------------------------------
  function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'deep'; document.body.appendChild(root);
    bar = document.createElement('div'); bar.id = 'deepbar'; bar.hidden = true;
    // arrows, not a slider (a slider is hard to drag on a phone), and a dot per step to jump to
    bar.innerHTML = `<button class="dp-arrow" data-b="prev"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="dp-head"><span class="dp-when"></span><b class="dp-title"></b><div class="dp-dots"></div></div>
      <button class="dp-arrow" data-b="next"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    document.body.appendChild(bar);
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-b]'); if (!b || b.disabled) return;
      const cur = view === 'story' ? chap : era;
      barGo(b.dataset.b === 'prev' ? cur - 1 : b.dataset.b === 'next' ? cur + 1 : +b.dataset.i);
    });
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (!b || b.disabled) return; const f = actions[b.dataset.d]; if (f) f(b); });
  }
  const frame = (html) => { root.innerHTML = html; root.scrollTop = 0; };
  const top = (title, backTo, backWord = 'Back') => `<div class="dp-top"><button class="tr-back" data-d="${backTo}">${BACK}${backWord}</button><h1>${esc(title)}</h1></div>`;
  const srcList = (keys) => `<details class="dp-srcs"><summary>Sources</summary><ul class="dp-src">${keys.map((k) => `<li><a href="${esc(SRC[k][1])}" target="_blank" rel="noopener">${esc(SRC[k][0])}</a></li>`).join('')}</ul></details>`;
  const chips = (ids) => ids.length ? `<div class="dp-chips">${ids.map((id) => { const c = CARD[id]; return `<button data-d="card" data-id="${id}"><i style="background:${KIND_COLOR[c.kind]}"></i>${esc(c.title)}</button>`; }).join('')}</div>` : '';

  // ---- the way in ----------------------------------------------------------------------------------------------------------
  function intro() {
    view = 'intro'; game = null; setBar(null);
    applyScene({ prov: Object.fromEntries(LAND.map((r) => [r.id, 0.5])), labels: ['valleyridge', 'coastal', 'plateau'] });
    fly([-75.2, 40.2], 6.0, 0, 1600);
    const started = store.get('deep.chapter', 0);
    frame(`${top('Deep Jersey', 'home', 'Home')}
      <p class="dp-lead">How the ground under New Jersey was made, and what people made of it.</p>
      <p class="dp-p">New Jersey sits where four great belts of land meet. Each one runs far past the state, and each was made at a different time: ancient rock, folded mountains, a valley torn open as a supercontinent split, and sand laid down by the sea. Then came the ice, and then people, who built their lives on what each belt gave them.</p>
      <button class="dp-start" data-d="story"><b>${started ? `Carry on the story` : 'Start the story'}</b><small>${started ? `Chapter ${started + 1} of ${STORY.length}: ${esc(STORY[started].title)}` : `${STORY.length} short chapters, from a billion years ago to today`}</small></button>
      <button class="tr-card wide" data-d="land"><b>The land today</b><small>New Jersey’s regions and the ranges they belong to, shown whole, past the state line</small></button>
      <h4>Close-ups</h4><p class="tn-hint">The same story, step by step, in one place.</p>
      <div class="tr-row">${CORRIDORS.map((c) => `<button class="tr-card" data-d="close" data-id="${c.id}"><b>${esc(c.name)}</b><small>${c.eras.length} stops · ${c.cards.length} stories</small></button>`).join('')}</div>
      <p class="tr-note">Every story lists its sources: USGS geology maps and reports, and the Wikipedia articles they point to.</p>`);
  }

  // ---- the story ----------------------------------------------------------------------------------------------------------
  function chapter(i) {
    view = 'story'; game = null; chap = i; store.set('deep.chapter', i);
    const S = STORY[i];
    setBar(STORY, i, ['Back a chapter', 'Next chapter']);
    applyScene(S.scene);
    const bb = S.land && data.provinces.features.find((f) => f.properties.region === S.land).properties.bbox;
    if (bb) fitBox(bb, 7);   // the whole belt, past the state line
    else fly([S.cam[0], S.cam[1]], S.cam[2], S.cam[2] > 8 ? 50 : S.cam[2] > 6.8 ? 30 : 0);
    const L = S.land && LAND.find((r) => r.id === S.land);
    frame(`${top('The story', 'intro', 'Deep Jersey')}
      <p class="dp-kick">Chapter ${i + 1} of ${STORY.length} · ${esc(S.when)}</p><h2>${esc(S.title)}</h2>
      ${S.text.map((p) => `<p class="dp-p">${esc(p)}</p>`).join('')}
      ${L ? `<button class="dp-region" data-d="landone" data-id="${L.id}"><i style="background:${L.color}"></i><span><b>${esc(L.name)} today</b><small>${esc(L.nj)}</small></span></button>` : ''}
      ${S.close.length ? `<h4>See it up close</h4>${chips(S.close)}` : ''}
      ${i < STORY.length - 1 ? `<button class="dp-start" data-d="next"><b>Next: ${esc(STORY[i + 1].title)}</b><small>${esc(STORY[i + 1].when)}</small></button>` : `<button class="dp-start" data-d="intro"><b>The end, for now</b><small>back to Deep Jersey: the land today and the close-ups</small></button>`}
      ${srcList(S.src)}`);
  }

  // ---- the land today ------------------------------------------------------------------------------------------------------
  function land() {
    view = 'land'; landSel = null; game = null; setBar(null);
    applyScene({ prov: Object.fromEntries(LAND.map((r) => [r.id, 0.55])) });
    fly([-75.6, 40.0], 5.4, 0, 1500);
    frame(`${top('The land today', 'intro', 'Deep Jersey')}
      <p class="dp-line">New Jersey has four of the eastern United States’ natural regions, and borders two more. Tap one to see all of it.</p>
      <div class="dp-regions">${LAND.map((r) => `<button class="dp-region" data-d="landone" data-id="${r.id}"><i style="background:${r.color}"></i><span><b>${esc(r.name)}</b><small>${esc(r.nj)}</small></span></button>`).join('')}</div>`);
  }
  function landOne(id) {
    const R = LAND.find((r) => r.id === id); if (!R) return;
    const from = view; view = 'land'; landSel = id; game = null; setBar(null);
    applyScene({ prov: { [id]: 0.8 }, provFaint: 0.1, labels: [id] });
    const bb = data.provinces.features.find((f) => f.properties.region === id).properties.bbox;
    fitBox(bb, 7.5);
    frame(`${top(R.name, from === 'story' ? 'story' : 'land', from === 'story' ? 'The story' : 'All regions')}
      <p class="dp-kick">In New Jersey: ${esc(R.nj)}</p>
      ${R.text.map((p) => `<p class="dp-p">${esc(p)}</p>`).join('')}
      ${R.close.length ? `<h4>See it up close</h4>${chips(R.close)}` : ''}
      ${srcList(R.src)}`);
  }

  // ---- close-ups ----------------------------------------------------------------------------------------------------------
  function showStop(i, flyTo = true) {
    era = i; const E = ERAS[i];
    setBar(ERAS, i, ['Newer', 'Older']);
    applyScene(stopScene(E.id));
    if (flyTo) fly(E.center, E.zoom, E.pitch);
  }
  function stopSheet() {
    view = 'close'; game = null;
    const E = ERAS[era], cards = CARDS.filter((c) => c.era === E.id), s = seen();
    frame(`${top(cor.name, 'intro', 'Deep Jersey')}
      <p class="dp-kick">${esc(E.when)} · stop ${era + 1} of ${ERAS.length}</p><h2>${esc(E.title)}</h2><p class="dp-line">${esc(E.line)}</p>
      <div class="dp-cards">${cards.map((c) => `<button class="dp-card${s.includes(c.id) ? ' seen' : ''}" data-d="card" data-id="${c.id}"><i style="background:${KIND_COLOR[c.kind]}"></i><span><b>${esc(c.title)}</b><small>${esc(c.when)}</small></span></button>`).join('')}</div>
      <p class="tn-hint">Step through time with the arrows at the top: newer on the left, older on the right.</p>
      <h4>Follow a thread</h4>
      <button class="tr-card wide" data-d="chain"><b>${esc(cor.chainName)}</b><small>rock → resource → industry → town → decline → what is left</small></button>
      <div class="tr-row"><button class="tr-card" data-d="order"><b>Put it in order</b><small>oldest first${store.get('deep.orderbest', 0) ? ` · best ${store.get('deep.orderbest', 0)}` : ''}</small></button>
        <button class="tr-card" data-d="why"><b>Why is it here?</b><small>pick the reason a place grew</small></button></div>
      <p class="tr-note">${CARDS.filter((c) => s.includes(c.id)).length} of ${CARDS.length} stories read here. Lake outlines are approximate.</p>`);
  }
  function openClose(id) { setCorridor(id); view = 'close'; showStop(0); stopSheet(); }

  function openCard(id) {
    const c = CARD[id]; if (!c) return;
    const k = corOf(id); if (k && k.id !== cor.id) setCorridor(k.id);
    // where Back goes: the story chapter, the region or the stop the card was opened from
    const from = view, fromChap = chap, fromLand = landSel;
    ret = from === 'story' ? () => chapter(fromChap) : from === 'land' && fromLand ? () => landOne(fromLand) : () => { showStop(era, false); stopSheet(); };
    game = null; markSeen(id);
    view = 'card';
    const i = ERA_INDEX[c.era]; era = i; setBar(ERAS, i, ['Newer', 'Older']); applyScene(stopScene(c.era));
    if (c.p) fly(c.p, Math.max(ERAS[i].zoom, 11.2), 55, 1400); else fly(ERAS[i].center, ERAS[i].zoom, ERAS[i].pitch, 1400);
    const links = CHAIN.filter((x) => x.card === id).map((x) => x.step);
    frame(`${top(from === 'story' ? 'The story' : from === 'land' ? 'The land today' : cor.name, 'back')}
      <p class="dp-kick" style="color:${KIND_COLOR[c.kind]}">${esc(c.when)} · ${esc(cor.name)}</p><h2>${esc(c.title)}</h2>
      ${c.text.map((p) => `<p class="dp-p">${esc(p)}</p>`).join('')}
      ${c.why ? `<p class="dp-tags">${c.why.map((w) => `<span>${esc(WHY[w])}</span>`).join('')}</p>` : ''}
      ${links.length ? `<button class="tr-card wide" data-d="chain"><b>Part of ${esc(cor.chainName.replace(/^The /, 'the '))}</b><small>${esc(links.join(' and '))}</small></button>` : ''}
      <button class="tr-card wide" data-d="closehere"><b>More from ${esc(cor.name)}</b><small>this stop and the ones around it</small></button>
      ${srcList(c.src)}`);
  }

  function chain() {
    game = null; ret = () => { showStop(era, false); stopSheet(); };
    frame(`${top(cor.chainName, 'back')}
      <p class="dp-line">How the ground became an industry, a town, and then a ruin. Tap a step for its story.</p>
      <ol class="dp-chain">${CHAIN.map((x, i) => `<li><button data-d="card" data-id="${x.card}"><span class="dp-step">${i + 1}</span><span><b>${esc(x.step)}</b><small>${esc(x.line)}</small></span></button></li>`).join('')}</ol>`);
  }

  // ---- games (in the close-ups) ---------------------------------------------------------------------------------------------
  function order() {
    const pool = shuffle(CARDS.filter((c) => c.year != null)); const pick = [];
    for (const c of pool) { if (!pick.some((p) => Math.abs(p.year - c.year) < Math.max(5, Math.abs(c.year) * 0.15))) pick.push(c); if (pick.length === 5) break; }
    game = { kind: 'order', cards: pick, want: [...pick].sort((a, b) => a.year - b.year).map((c) => c.id), got: [], wrong: 0 };
    ret = () => stopSheet(); orderDraw();
  }
  function orderDraw(msg = '') {
    const g = game;
    frame(`${top('Put it in order', 'back')}
      <p class="dp-line">Tap them from the oldest to the newest.</p>
      <ol class="dp-got">${g.got.map((id) => `<li><b>${esc(CARD[id].title)}</b><small>${esc(CARD[id].when)}</small></li>`).join('')}</ol>
      <div class="dp-pick">${shuffle(g.cards.filter((c) => !g.got.includes(c.id))).map((c) => `<button data-d="orderpick" data-id="${c.id}">${esc(c.title)}</button>`).join('')}</div>
      ${msg}`);
  }
  function orderPick(b) {
    const g = game, id = b.dataset.id, next = g.want[g.got.length];
    if (id === next) {
      g.got.push(id); juice.right(g.got.length);
      if (g.got.length === g.want.length) {
        const score = Math.max(0, 5 - g.wrong); if (score > store.get('deep.orderbest', 0)) store.set('deep.orderbest', score);
        juice.done(g.wrong === 0);
        return orderDraw(`<div class="tr-res ok"><b>${g.wrong ? `Done, with ${g.wrong} slip${g.wrong > 1 ? 's' : ''}` : 'All in order ✓'}</b></div><button class="tr-go" data-d="order">Another five</button>`);
      }
      orderDraw();
    } else {
      g.wrong++; juice.wrong(); juice.shake(b);
      const c = CARD[id], n = CARD[next];
      orderDraw(`<div class="tr-res no"><b>✗ Not yet</b><p>${esc(n.title)} (${esc(n.when)}) comes before ${esc(c.title)} (${esc(c.when)}).</p></div>`);
    }
  }
  function why() {
    const c = rand(CARDS.filter((x) => x.why && x.kind !== 'ice' && x.kind !== 'rock')), right = rand(c.why);
    const others = shuffle(Object.keys(WHY).filter((k) => !c.why.includes(k))).slice(0, 3);
    game = { kind: 'why', c, right }; ret = () => stopSheet();
    frame(`${top('Why is it here?', 'back')}
      <p class="dp-kick">${esc(c.when)}</p><h2>${esc(c.title)}</h2><p class="dp-line">What made this place grow, or gave it its name?</p>
      <div class="tr-choices dp-why">${shuffle([right, ...others]).map((k) => `<button data-d="whypick" data-k="${k}">${esc(WHY[k])}</button>`).join('')}</div>`);
  }
  function whyPick(b) {
    const g = game, k = b.dataset.k, ok = g.c.why.includes(k);
    for (const x of root.querySelectorAll('[data-d=whypick]')) { x.disabled = true; if (g.c.why.includes(x.dataset.k)) x.classList.add('right'); }
    if (ok) { juice.right(1); juice.pop(b); } else { juice.wrong(); juice.shake(b); b.classList.add('wrong'); }
    markSeen(g.c.id);
    root.querySelector('.dp-why').insertAdjacentHTML('afterend', `<div class="tr-res ${ok ? 'ok' : 'no'}"><b>${ok ? '✓' : '✗'} ${esc(g.c.why.map((w) => WHY[w]).join(', '))}</b><p>${esc(g.c.text[0])}</p></div>
      <div class="tr-row"><button class="tr-go" data-d="why">Another</button><button class="tr-card" data-d="card" data-id="${g.c.id}"><b>Read its story</b></button></div>`);
  }

  const actions = {
    home: async () => {
      // the home page opens under this sheet and the bar: hide them while it is up, and come back if Deep Jersey is picked again
      const barWas = bar.hidden; root.hidden = true; bar.hidden = true; if (pinEl) pinEl.hidden = true;
      await ctx.showHome();
      if (ctx.mode === 'deep') { root.hidden = false; bar.hidden = barWas; drawPins(shown.pins, shown.labels); }
    },
    intro, land, chain, order, why,
    story: () => chapter(store.get('deep.chapter', 0)),
    next: () => chapter(Math.min(STORY.length - 1, chap + 1)),
    landone: (b) => landOne(b.dataset.id),
    close: (b) => openClose(b.dataset.id),
    closehere: () => { showStop(era, false); stopSheet(); },
    era: () => stopSheet(),
    back: () => (ret ? ret() : intro()),
    card: (b) => openCard(b.dataset.id),
    orderpick: orderPick, whypick: whyPick,
  };

  return {
    async enter() {
      document.body.classList.add('deep-on');
      await load(); mount(); root.hidden = false;
      ctx.clearHighlights && ctx.clearHighlights(); ctx.sheet(''); ctx.hud('');
      map.setMaxBounds(WIDE);
      const go = () => {
        if (ctx.mode !== 'deep') return;
        try { addLayers(); } catch (e) { map.once('styledata', go); return; }   // the style is still loading: try again when it is
        map.setTerrain({ source: 'deep-dem', exaggeration: 1.8 });
        intro();
      };
      go();
    },
    leave() {
      for (const t of timers) clearTimeout(t); timers = [];
      document.body.classList.remove('deep-on');
      if (root) root.hidden = true; if (bar) bar.hidden = true;
      map.stop(); map.setTerrain(null); hideLayers();
      map.setMaxBounds(ctx.region.maxBounds || null); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      map.fitBounds(ctx.region.bounds, { padding: 20, pitch: 0, bearing: 0, duration: ctx.dur(600) });
    },
  };
}
