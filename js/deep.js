// Deep Jersey: how New Jersey got here, told on the map. First slice: the Boonton and Rockaway valley corridor.
// A time slider runs from today back past a billion years; each stop changes the map's layers (rock eras, lava flows, the ice sheet,
// glacial Lake Passaic, the Morris Canal) and pulls the camera out as time goes back (the deep-time zoom). Story cards for each stop,
// the iron chain from rock to ruin, and two light games: put events in order, and why is this town here.
// Data: data/deep/*.json (tools/build_deep.py, USGS and OpenStreetMap), the cards in js/deepcards.js (each with its sources).
import { CORRIDORS, CARD, SRC, WHY } from './deepcards.js';
import { juice } from './juice.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const KIND_COLOR = { rock: '#9a5b3c', ice: '#3d7fbf', lenape: '#a2652a', iron: '#5b5f66', canal: '#2f7d6d', water: '#2f6fb0', legend: '#7a4a8c' };
const ERA_FILL = { grenville: '#c98f6a', paleozoic: '#a9b27a', newark: '#c4614b', basalt: '#4a3b3b', diabase: '#6b5b73', coastal: '#e3d29a' };
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const LAYERS = ['deep-hs', 'deep-rocks', 'deep-flows', 'deep-lake', 'deep-ice-sheet', 'deep-ice-older', 'deep-ice-limit', 'deep-canal', 'deep-sand'];

export function initDeep(ctx) {
  const { map, store } = ctx;
  let root = null, bar = null, data = null, era = 0, timers = [], game = null;
  // the corridor on show: its stops, cards and chain
  let cor, ERAS, CARDS, CHAIN, ERA_INDEX;
  function setCorridor(id) {
    cor = CORRIDORS.find((c) => c.id === id) || CORRIDORS[0]; store.set('deep.corridor', cor.id);
    ({ eras: ERAS, cards: CARDS, chain: CHAIN } = cor); ERA_INDEX = Object.fromEntries(ERAS.map((e, i) => [e.id, i]));
  }
  setCorridor(store.get('deep.corridor', 'boonton'));
  const seen = () => store.get('deep.seen', []);
  const markSeen = (id) => { const s = seen(); if (!s.includes(id)) store.set('deep.seen', [...s, id]); };

  async function load() {
    if (data) return;
    const get = (f) => fetch(`data/deep/${f}.json`).then((r) => r.json());
    const [rocks, flows, ice, lakes, canal, sand] = await Promise.all(['rocks', 'flows', 'ice', 'lakes', 'canal', 'sand'].map(get));
    data = { rocks, flows, ice, lakes, canal, sand };
  }

  // ---- map layers -----------------------------------------------------------------------------------------------------------
  function addLayers() {
    if (map.getSource('deep-rocks')) { for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); return; }
    map.addSource('deep-dem', { type: 'raster-dem', tiles: [DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 11, attribution: 'Terrain: AWS Terrain Tiles (USGS 3DEP and others)' });
    map.addSource('deep-dem-hs', { type: 'raster-dem', tiles: [DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 11 });
    map.addSource('deep-rocks', { type: 'geojson', data: data.rocks, attribution: 'Geology: USGS State Geologic Map Compilation; USGS I-1420, I-2540-C' });
    map.addSource('deep-flows', { type: 'geojson', data: data.flows });
    map.addSource('deep-ice', { type: 'geojson', data: data.ice });
    map.addSource('deep-lakes', { type: 'geojson', data: data.lakes });
    map.addSource('deep-sand', { type: 'geojson', data: data.sand });
    map.addSource('deep-canal', { type: 'geojson', data: data.canal, attribution: 'Canal: © OpenStreetMap contributors' });
    const T = { duration: ctx.dur(900), delay: 0 };
    map.addLayer({ id: 'deep-hs', type: 'hillshade', source: 'deep-dem-hs', paint: { 'hillshade-exaggeration': 0.6, 'hillshade-shadow-color': '#3f4a44', 'hillshade-highlight-color': '#ffffff' } });
    map.addLayer({ id: 'deep-rocks', type: 'fill', source: 'deep-rocks', paint: { 'fill-color': ['match', ['get', 'era'], ...Object.entries(ERA_FILL).flat(), '#999'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-flows', type: 'fill', source: 'deep-flows', paint: { 'fill-color': ['match', ['get', 'flow'], 1, '#b0412e', 2, '#c96a2b', '#d99a2b'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-lake', type: 'fill', source: 'deep-lakes', paint: { 'fill-color': '#3f86c9', 'fill-opacity': 0, 'fill-opacity-transition': T }, filter: ['==', ['get', 'stage'], 'moggy'] });
    map.addLayer({ id: 'deep-ice-sheet', type: 'fill', source: 'deep-ice', filter: ['==', ['get', 'kind'], 'sheet'], paint: { 'fill-color': '#eef6fb', 'fill-opacity': 0, 'fill-opacity-transition': { duration: ctx.dur(1600), delay: 0 } } });
    map.addLayer({ id: 'deep-ice-older', type: 'line', source: 'deep-ice', filter: ['==', ['get', 'kind'], 'older'], paint: { 'line-color': '#7aa6c8', 'line-width': 1.2, 'line-dasharray': [2, 2], 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-ice-limit', type: 'line', source: 'deep-ice', filter: ['==', ['get', 'kind'], 'limit'], paint: { 'line-color': '#2b6aa3', 'line-width': 3, 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-sand', type: 'fill', source: 'deep-sand', paint: { 'fill-color': ['match', ['get', 'unit'], 'cohansey', '#e6c86e', '#c9b48c'], 'fill-opacity': 0, 'fill-opacity-transition': T } }, 'deep-flows');
    map.addLayer({ id: 'deep-canal', type: 'line', source: 'deep-canal', paint: { 'line-color': '#1f7a68', 'line-width': 3, 'line-opacity': 0, 'line-opacity-transition': T } });
  }
  // story pins: drawn as an overlay placed with map.project (map layers drop points over terrain that has not loaded yet)
  let pinEl = null;
  function drawPins() {
    if (!pinEl) {
      pinEl = document.createElement('div'); pinEl.id = 'deeppins'; document.body.appendChild(pinEl);
      pinEl.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) openCard(b.dataset.id); });
      map.on('move', placePins);
    }
    const id = ERAS[era].id;
    pinEl.innerHTML = CARDS.filter((c) => c.p && c.era === id).map((c) => `<button data-id="${c.id}" style="--k:${KIND_COLOR[c.kind]}"><i></i><span>${esc(c.title)}</span></button>`).join('');
    pinEl.hidden = false; placePins();
  }
  function placePins() {
    if (!pinEl || pinEl.hidden || ctx.mode !== 'deep') return;
    const P = pad(), H = innerHeight;
    for (const b of pinEl.children) {
      const c = CARD[b.dataset.id], q = map.project(c.p);
      const vis = q.x > 8 && q.x < innerWidth - 8 && q.y > P.top && q.y < H - P.bottom + 4;
      b.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)`; b.style.visibility = vis ? 'visible' : 'hidden';
    }
  }
  function hideLayers() { if (pinEl) pinEl.hidden = true; for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); }
  /** The strip of map between the time bar and the sheet: the camera centres there. */
  const pad = () => { const t = bar && !bar.hidden ? bar.getBoundingClientRect().bottom + 8 : 12, b = root && !root.hidden ? Math.max(12, innerHeight - root.getBoundingClientRect().top + 8) : 12; return { top: t, bottom: b, left: 20, right: 20 }; };
  const op = (id, prop, v) => { if (map.getLayer(id)) map.setPaintProperty(id, prop, v); };

  /** Show stop i: which layers, how strongly, and the camera (the deep-time zoom). */
  function showEra(i, fly = true) {
    for (const t of timers) clearTimeout(t); timers = [];
    era = i; const E = ERAS[i], id = E.id;
    const rockOp = { highlands: ['match', ['get', 'era'], 'grenville', 0.75, 0.12], paleo: ['match', ['get', 'era'], 'paleozoic', 0.75, 'grenville', 0.3, 0.1],
      rift: ['match', ['get', 'era'], 'newark', 0.6, 'diabase', 0.7, 'grenville', 0.25, 'paleozoic', 0.25, 0], ice: 0.18, moggy: 0.14, notch: 0.14 }[id] ?? 0;
    op('deep-rocks', 'fill-opacity', rockOp);
    // the lava: three floods, one after another, at the rift stop; faint walls round the lake after
    if (id === 'rift') {
      op('deep-flows', 'fill-opacity', 0);
      [1, 2, 3].forEach((n, k) => timers.push(setTimeout(() => op('deep-flows', 'fill-opacity', ['case', ['<=', ['get', 'flow'], n], 0.85, 0]), ctx.dur(500 + k * 1100))));
    } else op('deep-flows', 'fill-opacity', ['ice', 'moggy', 'notch'].includes(id) ? 0.45 : id === 'paleo' || id === 'highlands' ? 0 : 0.12);
    op('deep-ice-sheet', 'fill-opacity', id === 'ice' ? 0.88 : 0);
    op('deep-ice-limit', 'line-opacity', ['ice', 'moggy', 'notch'].includes(id) ? 0.95 : id === 'today' ? 0.35 : 0);
    op('deep-ice-older', 'line-opacity', id === 'ice' ? 0.7 : 0);
    if (id === 'moggy' || id === 'notch') { map.setFilter('deep-lake', ['==', ['get', 'stage'], id]); op('deep-lake', 'fill-opacity', 0.7); }
    else op('deep-lake', 'fill-opacity', 0);
    op('deep-canal', 'line-opacity', id === 'canal' ? 0.95 : id === 'today' ? 0.8 : 0);
    op('deep-sand', 'fill-opacity', id === 'p-sand' ? ['match', ['get', 'unit'], 'cohansey', 0.75, 0.45] : id.startsWith('p-') ? ['match', ['get', 'unit'], 'cohansey', 0.22, 0] : 0);
    drawPins();
    if (fly) map.flyTo({ center: E.center, zoom: E.zoom, pitch: E.pitch, bearing: -12, padding: pad(), duration: ctx.dur(1800), essential: true });
    if (bar) {
      bar.querySelector('.dp-when').textContent = E.when; bar.querySelector('.dp-title').textContent = E.title;
      bar.querySelector('[data-b=newer]').disabled = i === 0; bar.querySelector('[data-b=older]').disabled = i === ERAS.length - 1;
      bar.querySelector('.dp-dots').innerHTML = ERAS.map((e, k) => `<button data-b="go" data-i="${k}" aria-label="${esc(e.when)}: ${esc(e.title)}"${k === i ? ' class="on" aria-current="step"' : ''}></button>`).join('');
    }
  }

  // ---- panel ----------------------------------------------------------------------------------------------------------------
  function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'deep'; document.body.appendChild(root);
    bar = document.createElement('div'); bar.id = 'deepbar';
    // arrows, not a slider (a slider is hard to drag on a phone): newer on the left, older on the right, and a dot per stop to jump to
    bar.innerHTML = `<button class="dp-arrow" data-b="newer" aria-label="Newer"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="dp-head"><span class="dp-when"></span><b class="dp-title"></b><div class="dp-dots"></div></div>
      <button class="dp-arrow" data-b="older" aria-label="Older"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    document.body.appendChild(bar);
    const go = (i) => { i = Math.max(0, Math.min(ERAS.length - 1, i)); if (i !== era) { showEra(i); if (!game) eraSheet(); } };
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-b]'); if (!b || b.disabled) return;
      if (b.dataset.b === 'newer') go(era - 1); else if (b.dataset.b === 'older') go(era + 1); else go(+b.dataset.i);
    });
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (!b || b.disabled) return; const f = actions[b.dataset.d]; if (f) f(b); });
  }
  const frame = (html) => { root.innerHTML = html; root.scrollTop = 0; };
  const top = (title, backTo = 'era') => `<div class="dp-top"><button class="tr-back" data-d="${backTo}"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${backTo === 'home' ? 'Home' : 'Back'}</button><h1>${esc(title)}</h1></div>`;

  /** The sheet for the current stop: its line, its cards, and the ways in. */
  function eraSheet() {
    game = null;
    const E = ERAS[era], cards = CARDS.filter((c) => c.era === E.id), s = seen();
    frame(`${top('Deep Jersey', 'home')}
      <div class="dp-cors">${CORRIDORS.map((c) => `<button data-d="cor" data-id="${c.id}"${c.id === cor.id ? ' class="on" aria-pressed="true"' : ''}>${esc(c.name)}</button>`).join('')}</div>
      <p class="dp-kick">${esc(E.when)} · stop ${era + 1} of ${ERAS.length}</p><h2>${esc(E.title)}</h2><p class="dp-line">${esc(E.line)}</p>
      <div class="dp-cards">${cards.map((c) => `<button class="dp-card${s.includes(c.id) ? ' seen' : ''}" data-d="card" data-id="${c.id}"><i style="background:${KIND_COLOR[c.kind]}"></i><span><b>${esc(c.title)}</b><small>${esc(c.when)}</small></span></button>`).join('')}</div>
      <h4>Follow a thread</h4>
      <button class="tr-card wide" data-d="chain"><b>${esc(cor.chainName)}</b><small>rock → resource → industry → town → decline → what is left</small></button>
      <div class="tr-row"><button class="tr-card" data-d="order"><b>Put it in order</b><small>oldest first${store.get('deep.orderbest', 0) ? ` · best ${store.get('deep.orderbest', 0)}` : ''}</small></button>
        <button class="tr-card" data-d="why"><b>Why is it here?</b><small>pick the reason a place grew</small></button></div>
      <p class="tr-note">${CARDS.filter((c) => s.includes(c.id)).length} of ${CARDS.length} stories read here. Every card lists its sources; lake outlines are approximate.</p>`);
  }

  function openCard(id) {
    const c = CARD[id]; if (!c) return;
    game = null; markSeen(id);
    if (ERA_INDEX[c.era] !== era) showEra(ERA_INDEX[c.era], false);
    if (c.p) map.flyTo({ center: c.p, zoom: Math.max(ERAS[ERA_INDEX[c.era]].zoom, 11.2), pitch: 55, bearing: -12, padding: pad(), duration: ctx.dur(1400), essential: true });
    const links = CHAIN.filter((x) => x.card === id).map((x) => x.step);
    frame(`${top(ERAS[ERA_INDEX[c.era]].title)}
      <p class="dp-kick" style="color:${KIND_COLOR[c.kind]}">${esc(c.when)}</p><h2>${esc(c.title)}</h2>
      ${c.text.map((p) => `<p class="dp-p">${esc(p)}</p>`).join('')}
      ${c.why ? `<p class="dp-tags">${c.why.map((w) => `<span>${esc(WHY[w])}</span>`).join('')}</p>` : ''}
      ${links.length ? `<button class="tr-card wide" data-d="chain"><b>Part of ${esc(cor.chainName.replace(/^The /, 'the '))}</b><small>${esc(links.join(' and '))}</small></button>` : ''}
      <h4>Sources</h4><ul class="dp-src">${c.src.map((k) => `<li><a href="${esc(SRC[k][1])}" target="_blank" rel="noopener">${esc(SRC[k][0])}</a></li>`).join('')}</ul>`);
  }

  function chain() {
    game = null;
    frame(`${top(cor.chainName)}
      <p class="dp-line">How the ground became an industry, a town, and then a ruin. Tap a step for its story.</p>
      <ol class="dp-chain">${CHAIN.map((x, i) => `<li><button data-d="card" data-id="${x.card}"><span class="dp-step">${i + 1}</span><span><b>${esc(x.step)}</b><small>${esc(x.line)}</small></span></button></li>`).join('')}</ol>
      <p class="tr-note">Every corridor has a chain like this: the same six steps from the ground to what is left.</p>`);
  }

  // ---- games ----------------------------------------------------------------------------------------------------------------
  function order() {
    const pool = shuffle(CARDS.filter((c) => c.year != null)); const pick = [];
    for (const c of pool) { if (!pick.some((p) => Math.abs(p.year - c.year) < Math.max(5, Math.abs(c.year) * 0.15))) pick.push(c); if (pick.length === 5) break; }
    game = { kind: 'order', cards: pick, want: [...pick].sort((a, b) => a.year - b.year).map((c) => c.id), got: [], wrong: 0 };
    orderDraw();
  }
  function orderDraw(msg = '') {
    const g = game;
    frame(`${top('Put it in order')}
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
    game = { kind: 'why', c, right };
    frame(`${top('Why is it here?')}
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
      // the home page opens under this sheet and the time bar: hide them while it is up, and come back if Deep Jersey is picked again
      root.hidden = true; bar.hidden = true; if (pinEl) pinEl.hidden = true;
      await ctx.showHome();
      if (ctx.mode === 'deep') { root.hidden = false; bar.hidden = false; drawPins(); eraSheet(); }
    },
    era: () => eraSheet(),
    newer: () => { showEra(Math.max(0, era - 1)); eraSheet(); },
    older: () => { showEra(Math.min(ERAS.length - 1, era + 1)); eraSheet(); },
    card: (b) => openCard(b.dataset.id),
    cor: (b) => { if (b.dataset.id === cor.id) return; setCorridor(b.dataset.id); showEra(0); eraSheet(); },
    chain, order, why,
    orderpick: orderPick, whypick: whyPick,
  };

  return {
    async enter() {
      document.body.classList.add('deep-on');
      await load(); mount(); root.hidden = false; bar.hidden = false;
      ctx.clearHighlights && ctx.clearHighlights(); ctx.sheet(''); ctx.hud('');
      eraSheet();
      const go = () => {
        if (ctx.mode !== 'deep') return;
        try { addLayers(); } catch (e) { map.once('styledata', go); return; }   // the style is still loading: try again when it is
        map.setTerrain({ source: 'deep-dem', exaggeration: 1.8 }); showEra(era);
      };
      go();
    },
    leave() {
      for (const t of timers) clearTimeout(t); timers = [];
      document.body.classList.remove('deep-on');
      if (root) root.hidden = true; if (bar) bar.hidden = true;
      map.stop(); map.setTerrain(null); hideLayers();
      map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: ctx.dur(600) });
    },
  };
}
