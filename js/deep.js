// Deep Jersey: how the ground under New Jersey was made, and what people made of it.
// It opens on a short explanation and three ways in:
//   The story     the land built from the oldest rock forward, chapter by chapter (Next / Back), at the scale of the whole region:
//                 each belt of rock is drawn in full past the state line (the USGS physiographic map), then the ice, the lake, people.
//   The land today the regions New Jersey shares with its neighbours (Valley and Ridge, Highlands, the rift basins, the Coastal Plain,
//                 and the Poconos and Catskills next door), each shown whole.
//   Close-ups     the same story step by step in one place: Boonton and the Rockaway, and the Pine Barrens (stops, story cards, a chain
//                 from rock to ruin, and two light games).
// Data: data/deep/*.json (tools/build_deep.py: USGS and OpenStreetMap); the words in js/deepcards.js, each card with its sources.
import { CORRIDORS, CARD, SRC, WHY, LAND } from './deepcards.js';
import { STORIES, STORY_BY, SEQUENCE } from './deepstories.js';
import { DOMAINS, readIds, markRead, hooks, pickUp } from './deepthreads.js';
import { PLACE_OF } from './deepplaces.js';
import { juice } from './juice.js';
import { EXPLAIN, EX_SRC, LAVA_PHOTOS } from './deepexplain.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const KIND_COLOR = { rock: '#9a5b3c', ice: '#3d7fbf', lenape: '#a2652a', iron: '#5b5f66', canal: '#2f7d6d', water: '#2f6fb0', legend: '#7a4a8c' };
const ERA_FILL = { grenville: '#c98f6a', paleozoic: '#a9b27a', newark: '#c4614b', basalt: '#4a3b3b', diabase: '#6b5b73', coastal: '#e3d29a' };
const REGION_COLOR = Object.fromEntries(LAND.map((r) => [r.id, r.color]));
const DEM_SRC = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
// With heights exaggerated ×40 to ×90, the edge of the continental shelf becomes a wall kilometres high that dominates every wide
// view. The sea floor is not the subject, so as each elevation tile arrives, everything below sea level is flattened to -1 m (the
// relief colours leave -1 m clear, so the base map's water shows through). Terrarium: metres = R*256 + G + B/256 - 32768.
let demProto = false;
function flatSeaDem() {
  if (demProto || !self.maplibregl?.addProtocol || typeof OffscreenCanvas === 'undefined') return demProto ? 'deepdem://' : DEM_SRC;
  // each tile is fetched and flattened once, then shared: the terrain and the hillshade/relief sources both ask for it
  const done = new Map();
  self.maplibregl.addProtocol('deepdem', (params, abort) => {
    const key = params.url; self.__deepDemAsked = (self.__deepDemAsked || 0) + 1;
    if (!done.has(key)) {
      const job = flatten(key).catch((e) => { done.delete(key); throw e; });
      done.set(key, job);
      if (done.size > 400) done.delete(done.keys().next().value);   // keep the most recent 400 tiles
    }
    return done.get(key).then((data) => ({ data: data.slice(0) }));
  });
  async function flatten(url) {
    self.__deepDemProcessed = (self.__deepDemProcessed || 0) + 1;
    const r = await fetch(DEM_SRC + url.slice('deepdem://'.length));
    if (!r.ok) throw new Error(`DEM tile ${r.status}`);
    const bmp = await createImageBitmap(await r.blob()), cv = new OffscreenCanvas(bmp.width, bmp.height), g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0); const img = g.getImageData(0, 0, bmp.width, bmp.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128) { d[i] = 127; d[i + 1] = 255; d[i + 2] = 0; }   // below 0 m -> -1 m
    g.putImageData(img, 0, 0);
    return (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer();
  }
  demProto = true; return 'deepdem://';
}
const LAYERS = ['deep-relief', 'deep-hs', 'deep-iceanim', 'deep-rivers', 'deep-prov', 'deep-prov-line', 'deep-rocks', 'deep-sand', 'deep-flows', 'deep-lake', 'deep-ice-sheet', 'deep-icelines', 'deep-ice-older', 'deep-ice-limit', 'deep-canal', 'deep-drain-glow', 'deep-drain', 'deep-water-lake', 'deep-ridge', 'deep-pop-mask', 'deep-pop-ext', 'deep-pop-edge'];
// "How it works" explainers for each chapter, region, close-up stop and card that leans on an idea
const HOW = {
  's-mountains': ['fold', 'ridges'], 's-rift': ['lava', 'rift', 'ridges'], 's-coast': ['coastal', 'aquifer'], 's-ice': ['icesheet', 'moraine'], 's-lake': ['glaciallake', 'erratic'], 's-iron': ['bogiron'],
  valleyridge: ['fold', 'ridges'], piedmont: ['lava', 'rift', 'ridges'], coastal: ['coastal', 'aquifer'],
  paleo: ['fold'], rift: ['lava', 'rift', 'ridges'], ice: ['icesheet', 'moraine'], moggy: ['glaciallake'], notch: ['glaciallake'], 'p-sand': ['coastal', 'aquifer'], 'p-iron': ['bogiron'],
  tripod: ['erratic'], moraine: ['moraine', 'icesheet'], 'lake-passaic': ['glaciallake'], 'great-notch': ['glaciallake'], swamp: ['glaciallake'], watchungs: ['lava', 'ridges'],
  'green-pond': ['fold', 'ridges'], cohansey: ['coastal'], aquifer: ['aquifer'], 'bog-iron': ['bogiron'], batsto: ['bogiron'],
};          // while Deep Jersey is open the map may pull out past the New Jersey frame
const HIDE_LABELS = ['region-label', 'county-label', 'section-label', 'section-label-local', 'nature-label', 'landmark-label', 'road-ref-major', 'road-ref', 'road-name', 'reveal-minor', 'reveal-label', 'anchor-label'];   // base labels that crowd the wide views
// the illustration that plays inside each process chapter
const STORY_EX = { 's-mountains': 'fold', 's-rift': 'rift', 's-coast': 'coastal', 's-ice': 'icesheet', 's-lake': 'glaciallake', 's-iron': 'bogiron' };
const BACK = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function initDeep(ctx) {
  const { map, store } = ctx;
  let root = null, bar = null, pinEl = null, data = null, timers = [], game = null;
  let labelVis = [], exTimer = null;
  let view = 'intro', cur = null, chap = 0, era = 0, ret = null, landSel = null;   // cur: the story on show; chap: its beat (0, 1, 2)
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
    const names = ['rocks', 'flows', 'ice', 'lakes', 'canal', 'sand', 'provinces', 'icelines', 'iceanim', 'drain', 'water'];
    const got = await Promise.all(names.map((f) => fetch(`data/deep/${f}.json`).then((r) => r.json())));
    data = Object.fromEntries(names.map((n, i) => [n, got[i]]));
  }

  // ---- map layers -----------------------------------------------------------------------------------------------------------
  function addLayers() {
    if (map.getSource('deep-rocks')) { for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); return; }
    const DEM = `${flatSeaDem()}{z}/{x}/{y}.png`;
    map.addSource('deep-dem', { type: 'raster-dem', tiles: [DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 11, attribution: 'Terrain: AWS Terrain Tiles (USGS 3DEP and others)' });
    map.addSource('deep-dem-hs', { type: 'raster-dem', tiles: [DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 11 });
    map.addSource('deep-prov', { type: 'geojson', data: data.provinces, attribution: 'Regions: USGS Physiographic Divisions (Fenneman and Johnson 1946)' });
    map.addSource('deep-rocks', { type: 'geojson', data: data.rocks, attribution: 'Geology: USGS State Geologic Map Compilation; USGS I-1420, I-2540-C' });
    map.addSource('deep-flows', { type: 'geojson', data: data.flows });
    map.addSource('deep-ice', { type: 'geojson', data: data.ice });
    map.addSource('deep-icelines', { type: 'geojson', data: data.icelines });
    map.addSource('deep-lakes', { type: 'geojson', data: data.lakes });
    map.addSource('deep-iceanim', { type: 'geojson', data: data.iceanim });
    map.addSource('deep-sand', { type: 'geojson', data: data.sand });
    map.addSource('deep-canal', { type: 'geojson', data: data.canal, attribution: 'Canal: © OpenStreetMap contributors' });
    const T = { duration: ctx.dur(900), delay: 0 };
    // the land coloured by height (green lowlands, tan hills, brown mountains), shading from several directions on top of the region
    // colours, and rivers drawn stronger: valleys, ridges and rivers read at a glance
    map.addLayer({ id: 'deep-relief', type: 'color-relief', source: 'deep-dem-hs', paint: { 'color-relief-opacity': 0.6,
      'color-relief-color': ['interpolate', ['linear'], ['elevation'], -1, 'rgba(0,0,0,0)', 0, '#cfdcbc', 40, '#d9e0bd', 120, '#e6ddb3', 250, '#dcc597', 450, '#c8a67c', 750, '#a98567', 1100, '#8f7461', 1600, '#a59a91'] } });
    map.addLayer({ id: 'deep-prov', type: 'fill', source: 'deep-prov', paint: { 'fill-color': ['match', ['get', 'region'], ...Object.entries(REGION_COLOR).flat(), '#999'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-prov-line', type: 'line', source: 'deep-prov', paint: { 'line-color': ['match', ['get', 'region'], ...Object.entries(REGION_COLOR).flat(), '#999'], 'line-width': 1.4, 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-hs', type: 'hillshade', source: 'deep-dem-hs', paint: { 'hillshade-method': 'multidirectional',
      'hillshade-illumination-direction': [270, 315, 0, 45], 'hillshade-illumination-altitude': [30, 30, 30, 30],
      'hillshade-highlight-color': ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.35)'],
      'hillshade-shadow-color': ['rgba(40,36,30,0.55)', 'rgba(40,36,30,0.45)', 'rgba(40,36,30,0.35)', 'rgba(40,36,30,0.3)'], 'hillshade-exaggeration': 1 } });
    map.addLayer({ id: 'deep-rivers', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'river'],
      paint: { 'line-color': '#3b7fc0', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 8, 1.8, 11, 3.2] } });
    map.addLayer({ id: 'deep-rocks', type: 'fill', source: 'deep-rocks', paint: { 'fill-color': ['match', ['get', 'era'], ...Object.entries(ERA_FILL).flat(), '#999'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-sand', type: 'fill', source: 'deep-sand', paint: { 'fill-color': ['match', ['get', 'unit'], 'cohansey', '#e6c86e', '#c9b48c'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-flows', type: 'fill', source: 'deep-flows', paint: { 'fill-color': ['match', ['get', 'flow'], 1, '#b0412e', 2, '#c96a2b', '#d99a2b'], 'fill-opacity': 0, 'fill-opacity-transition': T } });
    map.addLayer({ id: 'deep-lake', type: 'fill', source: 'deep-lakes', paint: { 'fill-color': '#3f86c9', 'fill-opacity': 0, 'fill-opacity-transition': T }, filter: ['==', ['get', 'stage'], 'moggy'] });
    map.addLayer({ id: 'deep-ice-sheet', type: 'fill', source: 'deep-ice', filter: ['==', ['get', 'kind'], 'sheet'], paint: { 'fill-color': '#eef6fb', 'fill-opacity': 0, 'fill-opacity-transition': { duration: ctx.dur(1600), delay: 0 } } });
    map.addLayer({ id: 'deep-iceanim', type: 'fill', source: 'deep-iceanim', filter: ['==', ['get', 'f'], -1], paint: { 'fill-color': '#f4f9fd', 'fill-opacity': 0.92, 'fill-outline-color': '#8fb9d9' } });
    map.addLayer({ id: 'deep-icelines', type: 'line', source: 'deep-icelines', paint: { 'line-color': '#4f86b5', 'line-width': 1.3, 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-ice-older', type: 'line', source: 'deep-ice', filter: ['==', ['get', 'kind'], 'older'], paint: { 'line-color': '#7aa6c8', 'line-width': 1.2, 'line-dasharray': [2, 2], 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-ice-limit', type: 'line', source: 'deep-ice', filter: ['==', ['get', 'kind'], 'limit'], paint: { 'line-color': '#2b6aa3', 'line-width': 3, 'line-opacity': 0, 'line-opacity-transition': T } });
    // scenes: rivers, lakes and ridges (data/deep/water.json), and the pop-out (a shape lifted while the rest dims)
    map.addSource('deep-water', { type: 'geojson', data: data.water, lineMetrics: true });
    map.addLayer({ id: 'deep-water-lake', type: 'fill', source: 'deep-water', filter: ['in', ['get', 'name'], ['literal', []]], paint: { 'fill-color': '#3f86c9', 'fill-opacity': 0.8 } });
    map.addLayer({ id: 'deep-ridge', type: 'line', source: 'deep-water', filter: ['in', ['get', 'name'], ['literal', []]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#7a4a24', 'line-width': 5, 'line-opacity': 0.85, 'line-dasharray': [1.5, 1] } });
    map.addSource('deep-pop', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'deep-pop-mask', type: 'fill', source: 'deep-pop', filter: ['==', ['get', 'k'], 'mask'], paint: { 'fill-color': '#f3eee3', 'fill-opacity': 0, 'fill-opacity-transition': { duration: ctx.dur(450), delay: 0 } } });
    map.addLayer({ id: 'deep-pop-ext', type: 'fill-extrusion', source: 'deep-pop', filter: ['==', ['get', 'k'], 'shape'], paint: { 'fill-extrusion-color': ['get', 'col'], 'fill-extrusion-opacity': 0.88, 'fill-extrusion-height': 0, 'fill-extrusion-height-transition': { duration: ctx.dur(550), delay: 0 } } });
    map.addLayer({ id: 'deep-pop-edge', type: 'line', source: 'deep-pop', filter: ['==', ['get', 'k'], 'shape'], paint: { 'line-color': ['get', 'col'], 'line-width': 3, 'line-opacity': 0, 'line-opacity-transition': { duration: ctx.dur(450), delay: 0 } } });
    map.addSource('deep-drain', { type: 'geojson', data: data.drain });
    map.addLayer({ id: 'deep-drain-glow', type: 'line', source: 'deep-drain', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#7fc1f0', 'line-width': 12, 'line-blur': 4, 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-drain', type: 'line', source: 'deep-drain', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1f5fa0', 'line-width': 4.5, 'line-dasharray': [0, 4, 3], 'line-opacity': 0, 'line-opacity-transition': T } });
    map.addLayer({ id: 'deep-canal', type: 'line', source: 'deep-canal', paint: { 'line-color': '#1f7a68', 'line-width': 3, 'line-opacity': 0, 'line-opacity-transition': T } });
  }
  function hideLayers() { if (pinEl) pinEl.hidden = true; for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); }
  const op = (id, prop, v) => { if (map.getLayer(id)) map.setPaintProperty(id, prop, v); };

  /** What the map shows. sc: { prov: {region: opacity}, provFaint, rocks, flows ('anim' or opacity), sand, iceSheet, iceLimit, iceLines,
   * iceOlder, lake ('moggy'|'notch'), canal, pins: [card ids], labels: [region ids] } */
  function applyScene(sc) {
    for (const t of timers) clearTimeout(t); timers = []; caption('');
    if (map.getLayer('deep-iceanim')) map.setFilter('deep-iceanim', ['==', ['get', 'f'], -1]);
    const prov = sc.prov || {}, faint = sc.provFaint ?? 0;
    const pm = ['match', ['get', 'region'], ...Object.entries(prov).flat(), faint];
    op('deep-prov', 'fill-opacity', Object.keys(prov).length || faint ? pm : 0);
    op('deep-prov-line', 'line-opacity', Object.keys(prov).length ? ['match', ['get', 'region'], ...Object.keys(prov).flatMap((k) => [k, 0.9]), 0] : 0);
    op('deep-rocks', 'fill-opacity', sc.rocks ?? 0);
    op('deep-flows', 'fill-color', ['match', ['get', 'flow'], 1, '#b0412e', 2, '#c96a2b', '#d99a2b']);
    if (sc.flows === 'anim') lavaFloods(); else op('deep-flows', 'fill-opacity', sc.flows ?? 0);
    op('deep-sand', 'fill-opacity', typeof sc.sand === 'number' ? ['match', ['get', 'unit'], 'cohansey', sc.sand, sc.sand * 0.55] : sc.sand ?? 0);
    op('deep-ice-sheet', 'fill-opacity', sc.iceSheet ?? 0);
    op('deep-ice-limit', 'line-opacity', sc.iceLimit ?? 0);
    op('deep-icelines', 'line-opacity', sc.iceLines ?? 0);
    op('deep-ice-older', 'line-opacity', sc.iceOlder ?? 0);
    if (sc.lake) { map.setFilter('deep-lake', ['==', ['get', 'stage'], sc.lake]); map.setPaintProperty('deep-lake', 'fill-opacity-transition', { duration: ctx.dur(2600), delay: ctx.dur(900) }); op('deep-lake', 'fill-opacity', 0.75); } else { map.setPaintProperty('deep-lake', 'fill-opacity-transition', { duration: ctx.dur(600), delay: 0 }); op('deep-lake', 'fill-opacity', 0); }
    op('deep-canal', 'line-opacity', sc.canal ?? 0); op('deep-drain', 'line-opacity', 0); op('deep-drain-glow', 'line-opacity', 0); sceneReset();
    drawPins(sc.pins || [], sc.labels || Object.keys(prov).filter((k) => prov[k] >= 0.3), sc.mark || null);
  }
  // ---- the ice age, played on the map -----------------------------------------------------------------------------------------
  let capEl = null;
  function caption(text) {
    if (!capEl) { capEl = document.createElement('div'); capEl.id = 'deepcap'; document.body.appendChild(capEl); }
    capEl.textContent = text; capEl.hidden = !text || ctx.mode !== 'deep';
    if (text) { const t = bar && !bar.hidden ? bar.getBoundingClientRect().bottom + 8 : 12; capEl.style.top = `${t}px`; }
  }
  /** The ice spreads south to the moraine, stands there, then melts back; Glacial Lake Passaic fills behind it, drops, and drains.
   * The ice edge is drawn as a line sweeping south, a simplification of its real, lobed edge. */
  function playIce() {
    applyScene({ flows: 0.4 });
    after(() => fly([-74.62, 40.85], 7.6, 50, 1200));
    const N = 14, frame = (k) => map.setFilter('deep-iceanim', ['==', ['get', 'f'], k]);
    const steps = [];
    steps.push([300, () => caption('About 25,000 years ago: the ice sheet creeps south over New Jersey (its edge drawn straight here; the real one was lobed)')]);
    for (let k = 1; k <= N; k++) steps.push([420, () => frame(k)]);
    steps.push([600, () => { op('deep-ice-limit', 'line-opacity', 1); caption('About 20,000 years ago: it stops here, and dumps the moraine along its edge (dark blue)'); }]);
    steps.push([2600, () => caption('It starts to melt back. Meltwater is trapped behind the Watchung ridges and the moraine...')]);
    for (let k = N - 1; k >= 6; k--) steps.push([450, () => frame(k)]);
    steps.push([300, () => { map.setFilter('deep-lake', ['==', ['get', 'stage'], 'moggy']); op('deep-lake', 'fill-opacity', 0.75); caption('Glacial Lake Passaic, up to about 300 ft deep, held in by the ice to the north'); }]);
    steps.push([3000, () => { frame(4); caption('The ice uncovers a lower gap at Great Notch: the lake drops about 34 ft'); }]);
    steps.push([400, () => map.setFilter('deep-lake', ['==', ['get', 'stage'], 'notch'])]);
    steps.push([2600, () => { frame(2); }]);
    steps.push([500, () => { frame(-1); caption('The ice is gone. The lake drains away through Paterson, and its floor becomes the Great Swamp and the meadows'); }]);
    steps.push([1800, () => op('deep-lake', 'fill-opacity', 0)]);
    steps.push([4200, () => caption('')]);
    let t = 0; for (const [dt, f] of steps) { t += ctx.dur(dt) || dt * 0.05; timers.push(setTimeout(() => { if (ctx.mode === 'deep') f(); }, t)); }
  }

  /** A close-up stop's scene. */
  /** Lake Passaic drains, in three stages (USGS I-2540-C; Wikipedia: Lake Passaic, Moggy Hollow Natural Area). The flow lines are
   * schematic: the way the water went, not surveyed channels. Every timer goes in `timers`, so leaving the beat stops it. */
  function drainLake() {
    const DASH = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
    let k = 0, flowing = true; const flow = () => { if (!flowing || !map.getLayer('deep-drain')) return; map.setPaintProperty('deep-drain', 'line-dasharray', DASH[k = (k + 1) % DASH.length]); timers.push(setTimeout(flow, 90)); };
    const stage = (name) => { map.setFilter('deep-drain', ['==', ['get', 'stage'], name]); map.setFilter('deep-drain-glow', ['==', ['get', 'stage'], name]); op('deep-drain', 'line-opacity', 0.95); op('deep-drain-glow', 'line-opacity', 0.55); };
    const lakeTo = (st) => { op('deep-lake', 'fill-opacity', 0); timers.push(setTimeout(() => { if (st) { map.setFilter('deep-lake', ['==', ['get', 'stage'], st]); op('deep-lake', 'fill-opacity', 0.75); } }, ctx.dur(700) || 1)); };
    const at = (ms, f) => timers.push(setTimeout(f, ctx.dur(ms) || 1));
    const look = (c, z) => { drift++; map.easeTo({ center: c, zoom: z, duration: ctx.dur(2200) }); };   // each stage frames its outlet
    stage('moggy'); flow(); look([-74.53, 40.7], 9.4);
    caption('The lake spills out at Moggy Hollow, its lowest gap, south-west to the Raritan');
    at(5500, () => { lakeTo('notch'); stage('notch'); look([-74.3, 40.83], 9.6); caption('The ice melts back and opens Great Notch, 34 ft lower: the lake drops and spills east, carving the Third River valley'); });
    at(11500, () => { lakeTo(null); stage('passaic'); look([-74.32, 40.82], 9.2); caption('The ice is gone: the Passaic, blocked from its old shortcut by the moraine, takes the long way round and over the Great Falls'); });
    at(19000, () => { caption(''); flowing = false; });   // done: the line stays, the animation (and its timer) stops
  }
  // ---- directed scenes: a beat's `script` is a list of timed moves, run once the camera has arrived (see deepthreads MOVES) --------
  let traces = [], lakesOn = [], ridgesOn = [], marksOn = [];
  function sceneReset() {
    for (const id of traces) if (map.getLayer(id)) map.removeLayer(id); traces = [];
    lakesOn = []; ridgesOn = []; marksOn = [];
    if (map.getLayer('deep-water-lake')) { map.setFilter('deep-water-lake', ['in', ['get', 'name'], ['literal', []]]); map.setFilter('deep-ridge', ['in', ['get', 'name'], ['literal', []]]); }
    if (map.getSource('deep-pop')) { map.getSource('deep-pop').setData({ type: 'FeatureCollection', features: [] }); op('deep-pop-mask', 'fill-opacity', 0); op('deep-pop-edge', 'line-opacity', 0); op('deep-pop-ext', 'fill-extrusion-height', 0); }
  }
  const popShape = (st) => {
    if (st.county) return ctx.countyShapes && ctx.countyShapes.features.find((f) => f.properties.c === st.county);
    if (st.region) return data.provinces.features.find((f) => f.properties.region === st.region);
    return data.water.features.find((f) => f.properties.name === st.water);
  };
  const outerRings = (g) => (g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : []);
  function runScript(script) {
    const at = (ms, f) => timers.push(setTimeout(() => { if (ctx.mode === 'deep') f(); }, ctx.dur(ms) || 1));
    let end = 0;
    for (const st of script) {
      end = Math.max(end, st.at + (st.ms || 0) + (st.hold || 0));
      at(st.at, () => ({
        cap: () => caption(st.text),
        cam: () => fly([st.c[0], st.c[1]], st.c[2], st.c[3] ?? null, st.ms || 1600),
        trace: () => {
          const id = `deep-trace-${traces.length}`, col = st.color || '#2a7bd1', w = st.w || 5, ms = ctx.dur(st.ms || 2600) || 1;
          map.addLayer({ id, type: 'line', source: 'deep-water', filter: ['==', ['get', 'name'], st.name], layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 8, w * 0.6, 12, w * 1.4], 'line-gradient': ['step', ['line-progress'], col, 0.001, 'rgba(0,0,0,0)'] } });
          traces.push(id);
          const t0 = performance.now(), grow = () => { if (!map.getLayer(id)) return; const p = Math.min(0.999, (performance.now() - t0) / ms);
            map.setPaintProperty(id, 'line-gradient', ['step', ['line-progress'], col, Math.max(0.001, p), 'rgba(0,0,0,0)']); if (p < 0.999) timers.push(setTimeout(grow, 50)); };
          grow();
        },
        lake: () => { lakesOn = st.show === false ? lakesOn.filter((n) => n !== st.name) : [...new Set([...lakesOn, st.name])]; map.setFilter('deep-water-lake', ['in', ['get', 'name'], ['literal', lakesOn]]); },
        ridge: () => { ridgesOn = [...new Set([...ridgesOn, st.name])]; map.setFilter('deep-ridge', ['in', ['get', 'name'], ['literal', ridgesOn]]); },
        mark: () => { marksOn = [...marksOn, { p: st.p, label: st.label, color: st.color }]; drawPins(shown.pins, shown.labels, marksOn); },
        pulse: () => { const from = exagNow || 1, to = from * (st.to || 2.5); rise(to, 900); timers.push(setTimeout(() => rise(from, 1100), ctx.dur(900 + (st.hold || 1600)) || 1)); },
        pop: () => {
          const f = popShape(st); if (!f) return;
          const col = st.color || '#f6efe0', rings = outerRings(f.geometry);
          map.getSource('deep-pop').setData({ type: 'FeatureCollection', features: [
            { type: 'Feature', properties: { k: 'mask' }, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...rings.map((r) => [...r].reverse())] } },
            { type: 'Feature', properties: { k: 'shape', col }, geometry: f.geometry }] });
          op('deep-pop-mask', 'fill-opacity', 0.78); op('deep-pop-edge', 'line-opacity', 1); op('deep-pop-ext', 'fill-extrusion-height', st.h || 600);
          timers.push(setTimeout(() => { op('deep-pop-ext', 'fill-extrusion-height', 0); op('deep-pop-mask', 'fill-opacity', 0); op('deep-pop-edge', 'line-opacity', 0); }, ctx.dur(st.hold || 2600) || 1));   // and back onto the board
        },
        clear: () => sceneReset(),
      })[st.do]());
    }
    at(end + 4500, () => caption(''));
  }
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
  function drawPins(pins, labels, mark = null) {
    if (!pinEl) {
      pinEl = document.createElement('div'); pinEl.id = 'deeppins'; document.body.appendChild(pinEl);
      pinEl.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) openCard(b.dataset.id); else { const l = e.target.closest('[data-region]'); if (l) landOne(l.dataset.region); } });
      map.on('move', placePins);
    }
    shown = { pins, labels, mark };
    const LP = { valleyridge: [-75.55, 40.72], plateau: [-75.55, 41.3] };     // names kept apart where the two belts meet by New Jersey
    const lp = (k) => { const p = (data.provinces.features.find((f) => f.properties.region === k) || {}).properties; return p && LP[k] ? { ...p, lp: LP[k] } : p; };
    pinEl.innerHTML = labels.map((k) => { const p = lp(k), r = LAND.find((x) => x.id === k); return p && r ? `<b class="dp-rl" data-region="${k}" data-p="${p.lp}" style="--k:${r.color}">${esc(r.name.replace(/ \(.*\)|:.*$/, ''))}</b>` : ''; }).join('')
      + pins.map((id, n) => { const c = CARD[id]; return c && c.p ? `<button data-id="${id}" data-p="${c.p}" style="--k:${KIND_COLOR[c.kind]};--n:${n}"><i></i><span>${esc(c.title)}</span></button>` : ''; }).join('')
      + (mark ? [].concat(mark).map((m, n) => `<button class="dp-mark" data-p="${m.p}" style="--k:${m.color || '#2a241b'};--n:${n}" tabindex="-1"><i></i><span>${esc(m.label)}</span></button>`).join('') : '');   // a story's place that has no card
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
  // ---- the camera: always 3D, tilted, heights exaggerated more the further out it is (a tag on the map says how much), then a slow
  // drift so the shape of the land reads
  let exagNow = 0, exagEl = null, drift = 0;
  // heights grow with distance: at true scale, mountains a few hundred metres high vanish in a view 1,000 km wide. About ×100 at the
  // widest view, ×40 for a region, ×15 for a valley, ×6 up close (rounded so the tag reads cleanly)
  const exagFor = (z) => { const e = 6 * 1.6 ** (10 - Math.min(10, Math.max(4, z))); return e > 20 ? Math.round(e / 10) * 10 : Math.round(e); };
  function setExag(e) {
    exagNow = e; map.setTerrain(e ? { source: 'deep-dem', exaggeration: e } : null);
    if (!exagEl) { exagEl = document.createElement('div'); exagEl.id = 'deepexag'; document.body.appendChild(exagEl); }
    exagEl.textContent = e > 1.05 ? `heights ×${Math.round(e * 10) / 10}` : ''; exagEl.hidden = !(e > 1.05) || ctx.mode !== 'deep';
    if (root && !root.hidden) exagEl.style.bottom = `${innerHeight - root.getBoundingClientRect().top + 8}px`;
  }
  const terrain = (on) => { if (!on) { map.stop(); setExag(0); } };
  /** Camera moves wait until the sheet has its new text, so the free strip they centre in is measured right. */
  const after = (f) => Promise.resolve().then(f);
  function fly(center, zoom, pitch = null, dur = 1800, then = null) {
    const e = exagFor(zoom); if (Math.abs(e - exagNow) > 0.01) { map.stop(); setExag(e); }
    const tok = ++drift, P = pitch ?? (zoom < 7 ? 52 : zoom < 9 ? 56 : 60), bearing = zoom < 7 ? -8 : -16;
    map.flyTo({ center, zoom, pitch: P, bearing, padding: pad(), duration: ctx.dur(dur), essential: true });
    // wait for this flight to land: a moveend can also come from the move it interrupted, straight away
    const start = Date.now(), onEnd = () => {
      if (tok !== drift || ctx.mode !== 'deep') return;
      if (map.isMoving() || Date.now() - start < (ctx.dur(dur) || 0) * 0.6) { map.once('moveend', onEnd); return; }
      if (then) then();   // once it has landed the map rests: no slow drift, so nothing redraws while you read (battery)
    };
    map.once('moveend', onEnd);
  }
  /** Fit a box in the free strip, then tilt: the zoom comes from fitting it flat, a little further out to allow for the tilt. */
  function fitBox(bb, maxZoom, then = null) {
    const p = pad(); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    const cam = map.cameraForBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: p, maxZoom, bearing: 0, pitch: 0 }) || { center: [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], zoom: 6 };
    fly(cam.center, cam.zoom - 0.5, null, 1800, then);   // a little further out: the tilted view needs room
  }
  /** The land rising: heights grow from flat to `to` over a few seconds (the mountain-building chapter). */
  function rise(to, ms = 3200) {
    const n = 16; for (let k = 1; k <= n; k++) timers.push(setTimeout(() => setExag((to * k) / n), ctx.dur((ms * k) / n) || 1));
  }
  /** The lava floods: each flow appears glowing orange, then cools to dark basalt, one after another. */
  function lavaFloods() {
    if (!map.getLayer('deep-flows')) return;
    map.setPaintProperty('deep-flows', 'fill-color-transition', { duration: ctx.dur(1600), delay: 0 });
    op('deep-flows', 'fill-opacity', 0); op('deep-prov', 'fill-opacity', ['match', ['get', 'region'], 'piedmont', 0.28, 0]);   // the basin pale, so the lava stands out
    const names = ['', 'First Watchung', 'Second Watchung', 'Third Watchung'];
    [1, 2, 3].forEach((n, k) => {
      timers.push(setTimeout(() => {
        op('deep-flows', 'fill-color', ['case', ['==', ['get', 'flow'], n], '#ffb21f', '#3a2f2c']);
        op('deep-flows', 'fill-opacity', ['case', ['<=', ['get', 'flow'], n], 0.92, 0]);
        caption(`Lava floods the rift valley: the ${names[n]} flow, glowing hot`);
      }, ctx.dur(400 + k * 2600) || 1));
      timers.push(setTimeout(() => { op('deep-flows', 'fill-color', '#3a2f2c'); caption(n < 3 ? 'It cools to dark basalt, and red mud buries it...' : 'Three sheets of basalt, buried, later tilted and worn: the three Watchung ridges'); }, ctx.dur(1800 + k * 2600) || 1));
    });
  }

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
    if (view === 'story') { if (i >= 0 && i < 3 && i !== chap) story(cur, i); }
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
      const at = view === 'story' ? chap : era;
      barGo(b.dataset.b === 'prev' ? at - 1 : b.dataset.b === 'next' ? at + 1 : +b.dataset.i);
    });
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (!b || b.disabled) return; const f = actions[b.dataset.d]; if (f) f(b); });
  }
  // the sheet stays short so the map shows; a handle on top makes it tall for reading (remembered), and an explainer is always tall
  const grab = () => `<button class="dp-grab" data-d="grab" aria-label="${root.classList.contains('big') ? 'Make the panel shorter' : 'Make the panel taller'}"><i></i></button>`;
  const frame = (html) => { clearInterval(exTimer); exTimer = null; root.innerHTML = grab() + html; root.scrollTop = 0; root.classList.toggle('tall', view === 'how' || view === 'photos'); if (view !== 'how' && view !== 'photos') backs = []; if (view !== 'mapidx' && map.getLayer('deep-stories')) map.setLayoutProperty('deep-stories', 'visibility', 'none'); if (view !== 'county') for (const id of ['deep-county', 'deep-county-fill']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); hideEx(); };
  /** Long text: the first paragraph, then Read more for the rest. */
  const paras = (list) => `<p class="dp-p">${esc(list[0])}</p>${list.length > 1 ? `<div class="dp-more" hidden>${list.slice(1).map((x) => `<p class="dp-p">${esc(x)}</p>`).join('')}</div><button class="dp-readmore" data-d="more">Read more</button>` : ''}`;
  const top = (title, backTo, backWord = 'Back') => `<div class="dp-top"><button class="tr-back" data-d="${backTo}">${BACK}${backWord}</button><h1>${esc(title)}</h1></div>`;
  const srcList = (keys) => `<details class="dp-srcs"><summary>Sources</summary><ul class="dp-src">${keys.map((k) => `<li><a href="${esc(SRC[k][1])}" target="_blank" rel="noopener">${esc(SRC[k][0])}</a></li>`).join('')}</ul></details>`;
  const howRow = (key) => (HOW[key] || []).length ? `<h4>How it works</h4>${(HOW[key] || []).includes('lava') ? `<button class="dp-photos" data-d="photos"><span class="dp-photostrip">${LAVA_PHOTOS.list.slice(0, 3).map((x) => `<img src="${x.img}" alt="" loading="lazy">`).join('')}</span><span><b>See the real thing</b><small>lava erupting today, and the rock it left in New Jersey</small></span></button>` : ''}<div class="dp-how">${HOW[key].map((k) => `<button data-d="how" data-id="${k}"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor"/></svg>${esc(EXPLAIN[k].title)}</button>`).join('')}</div>` : '';
  const chips = (ids) => ids.length ? `<div class="dp-chips">${ids.map((id) => { const c = CARD[id]; return `<button data-d="card" data-id="${id}"><i style="background:${KIND_COLOR[c.kind]}"></i>${esc(c.title)}</button>`; }).join('')}</div>` : '';

  // ---- the way in ----------------------------------------------------------------------------------------------------------
  const hookCard = (id, cls = 'dp-hook') => { const S = STORY_BY[id], D = DOMAINS[S.domain]; return `<button class="${cls}" data-d="story" data-id="${id}"><i style="background:${D.color}"></i><span><b>${esc(S.hook)}</b><small>${esc(S.title)} · ${esc(PLACE_OF[id] ? PLACE_OF[id].town : D.name)}${S.gone ? ' · gone' : ''}</small></span></button>`; };
  function intro() {
    view = 'intro'; game = null; setBar(null);
    applyScene({ prov: Object.fromEntries(LAND.map((r) => [r.id, 0.5])), labels: ['valleyridge', 'coastal', 'plateau'] });
    after(() => fly([-75.2, 40.2], 6.0, null, 1600));
    const read = readIds(store), up = pickUp(STORIES, read), seq = Math.min(SEQUENCE.length - 1, store.get('deep.chapter', 0));
    frame(`${top('Deep Jersey', 'home', 'Home')}
      <p class="dp-lead">Things far bigger than us, and where they touch New Jersey.</p>
      <h4>Start somewhere</h4><div class="dp-hooks">${hooks(STORIES, read).map((id) => hookCard(id)).join('')}</div>
      <p class="tn-hint">Each story starts with something huge and follows it down to a place you can see, or one that is gone, then offers threads to others.</p>
      ${up.length ? `<h4>Pick up a thread</h4><div class="dp-hooks dp-pickup">${up.map((id) => hookCard(id, 'dp-hook dp-up')).join('')}</div>` : ''}
      <button class="tr-card wide" data-d="mapidx"><b>The map</b><small>Every story where it lands; ${read.length} of ${STORIES.length} read</small></button>
      <h4>By county</h4><div class="dp-counties">${countyNames().map((c) => { const n = countyStories(c), r = n.filter((id) => read.includes(id)).length; return `<button data-d="county" data-id="${esc(c)}"${n.length ? '' : ' class="none"'}><b>${esc(c)}</b><small>${n.length ? `${n.length} ${n.length === 1 ? 'story' : 'stories'}${r ? ` · ${r} read` : ''}` : 'none yet'}</small></button>`; }).join('')}</div>
      <button class="dp-start" data-d="story" data-id="${SEQUENCE[seq]}"><b>How the ground was made</b><small>${seq ? `Carry on: ${seq + 1} of ${SEQUENCE.length}, ${esc(STORY_BY[SEQUENCE[seq]].title)}` : `${SEQUENCE.length} stories in order, from a billion years ago to today`}</small></button>
      <button class="tr-card wide" data-d="land"><b>The land today</b><small>New Jersey’s regions and the ranges they belong to, shown whole, past the state line</small></button>
      <h4>Close-ups</h4><p class="tn-hint">Step by step, in one place.</p>
      <div class="tr-row">${CORRIDORS.map((c) => `<button class="tr-card" data-d="close" data-id="${c.id}"><b>${esc(c.name)}</b><small>${c.eras.length} stops · ${c.cards.length} stories</small></button>`).join('')}</div>
      <p class="tr-note">Every story lists its sources: USGS geology maps and reports, and the Wikipedia articles they point to.</p>`);
  }

  // ---- the map index: every story at the place it lands, coloured by subject; read ones dimmed ---------------------------------
  function storyPoints() {
    const read = new Set(readIds(store));
    return { type: 'FeatureCollection', features: STORIES.map((S) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: S.beats.here.cam.slice(0, 2) },
      properties: { id: S.id, color: DOMAINS[S.domain].color, read: read.has(S.id) ? 1 : 0 } })) };
  }
  function storyLayer(on) {
    if (!map.getSource('deep-stories')) {
      map.addSource('deep-stories', { type: 'geojson', data: storyPoints() });
      map.addLayer({ id: 'deep-stories', type: 'circle', source: 'deep-stories', layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 7, 10, 11],
        'circle-color': ['get', 'color'], 'circle-opacity': ['case', ['==', ['get', 'read'], 1], 0.4, 1], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } });
      map.on('click', 'deep-stories', (e) => { const f = e.features && e.features[0]; if (f && view === 'mapidx') mapPick(f.properties.id); });
    } else map.getSource('deep-stories').setData(storyPoints());
    map.setLayoutProperty('deep-stories', 'visibility', on ? 'visible' : 'none');
  }
  function mapIndex(focus = null) {
    view = 'mapidx'; game = null; setBar(null);
    applyScene({}); storyLayer(true);
    const pts = STORIES.map((S) => S.beats.here.cam), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    after(() => (focus ? fly(STORY_BY[focus].beats.here.cam.slice(0, 2), 10, null, 1400) : fitBox([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], 9.5)));
    const read = new Set(readIds(store));
    frame(`${top('The map', 'intro', 'Deep Jersey')}
      <div class="dp-maphook">${focus ? mapHook(focus) : '<p class="dp-line">Tap a dot to see its story. Faded dots are ones you have read.</p>'}</div>
      <div class="dp-legend">${Object.entries(DOMAINS).filter(([k]) => STORIES.some((S) => S.domain === k)).map(([, d]) => `<span><i style="background:${d.color}"></i>${esc(d.name)}</span>`).join('')}</div>
      <h4>All stories <button class="dp-toggle${onlyUnread ? ' on' : ''}" data-d="unread">${onlyUnread ? 'Showing unread' : 'Only unread'}</button></h4>
      <div class="dp-hooks dp-allstories">${STORIES.filter((S) => !onlyUnread || !read.has(S.id)).map((S) => hookCard(S.id, `dp-hook${read.has(S.id) ? ' read' : ''}`)).join('') || '<p class="tn-hint">You have read them all.</p>'}</div>`);
    if (map.getLayer('deep-stories')) map.setFilter('deep-stories', onlyUnread ? ['==', ['get', 'read'], 0] : null);
  }
  let onlyUnread = false;

  // ---- by county: the stories that land in each county, grouped by town, and those that pass through ----------------------
  const countyNames = () => (ctx.countyShapes ? [...new Set(ctx.countyShapes.features.map((f) => f.properties.c))].sort() : []);
  const countyStories = (c) => STORIES.filter((S) => PLACE_OF[S.id] && (PLACE_OF[S.id].county === c || (PLACE_OF[S.id].touches || []).includes(c))).map((S) => S.id);
  function countyView(c) {
    const f = ctx.countyShapes && ctx.countyShapes.features.find((x) => x.properties.c === c); if (!f) { intro(); return; }
    view = 'county'; game = null; setBar(null); applyScene({});
    if (!map.getSource('deep-county')) {
      map.addSource('deep-county', { type: 'geojson', data: f });
      map.addLayer({ id: 'deep-county-fill', type: 'fill', source: 'deep-county', paint: { 'fill-color': '#c8462c', 'fill-opacity': 0.08 } });
      map.addLayer({ id: 'deep-county', type: 'line', source: 'deep-county', paint: { 'line-color': '#c8462c', 'line-width': 3 } });
    } else map.getSource('deep-county').setData(f);
    for (const id of ['deep-county', 'deep-county-fill']) map.setLayoutProperty(id, 'visibility', 'visible');
    const xs = [], ys = []; const walk = (a) => (typeof a[0] === 'number' ? (xs.push(a[0]), ys.push(a[1])) : a.forEach(walk)); walk(f.geometry.coordinates);
    after(() => fitBox([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], 11));
    const here = STORIES.filter((S) => PLACE_OF[S.id] && PLACE_OF[S.id].county === c), pass = STORIES.filter((S) => PLACE_OF[S.id] && (PLACE_OF[S.id].touches || []).includes(c));
    const read = new Set(readIds(store)), byTown = {};
    for (const S of here) (byTown[PLACE_OF[S.id].town] = byTown[PLACE_OF[S.id].town] || []).push(S);
    const card = (S) => hookCard(S.id, `dp-hook${read.has(S.id) ? ' read' : ''}`);
    const unreadFirst = (a) => [...a].sort((x, y) => read.has(x.id) - read.has(y.id));
    frame(`${top(`${c} County`, 'intro', 'Deep Jersey')}
      <p class="dp-line">${here.length ? `${here.length} ${here.length === 1 ? 'story lands' : 'stories land'} here${pass.length ? `, and ${pass.length} pass${pass.length === 1 ? 'es' : ''} through` : ''}.` : `No stories land in ${esc(c)} County yet.${pass.length ? ' These pass through:' : ''}`}</p>
      <div class="dp-cstories">${Object.keys(byTown).sort().map((t) => `<h4 class="dp-town">${esc(t)}</h4><div class="dp-hooks">${unreadFirst(byTown[t]).map(card).join('')}</div>`).join('')}
      ${pass.length ? `<h4>Passing through</h4><div class="dp-hooks">${unreadFirst(pass).map(card).join('')}</div>` : ''}</div>`);
  }
  const mapHook = (id) => { const S = STORY_BY[id]; return `<p class="dp-kick"><span class="dp-dom" style="background:${DOMAINS[S.domain].color}">${esc(DOMAINS[S.domain].name)}</span> ${esc(S.when)}</p><h2>${esc(S.title)}</h2><p class="dp-p">${esc(S.hook)}</p><button class="dp-start" data-d="story" data-id="${id}"><b>Open the story</b><small>three steps, then where it leads</small></button>`; };
  function mapPick(id) { const el = root.querySelector('.dp-maphook'); if (el) { el.innerHTML = mapHook(id); root.scrollTop = 0; } }

  // ---- a story: three beats, each moving the camera and playing its scene; the last ends in threads ----------------------------
  const BEAT_KEYS = ['big', 'thread', 'here'], BEAT_NAMES = ['The big thing', 'The thread down', 'Where you stand'];
  const PLAYS = {
    rise: () => { const top = exagFor(map.getZoom()); setExag(0.01); rise(top); caption(`Continents collide: the land is pushed up into mountains (heights ×${top})`); timers.push(setTimeout(() => caption(''), ctx.dur(6500) || 1)); },
    lava: () => lavaFloods(),
    ice: () => playIce(),
    sand: () => { op('deep-sand', 'fill-opacity', 0); timers.push(setTimeout(() => { map.setPaintProperty('deep-sand', 'fill-opacity-transition', { duration: ctx.dur(3000), delay: 0 }); op('deep-sand', 'fill-opacity', ['match', ['get', 'unit'], 'cohansey', 0.8, 0.45]); caption('Layer on layer of sand and clay along the coast; the yellow is the Cohansey sand'); }, ctx.dur(300) || 1)); timers.push(setTimeout(() => caption(''), ctx.dur(6000) || 1)); },
    drain: () => drainLake(),
  };
  const howList = (S) => (S.explain || []).length || S.photos ? `<h4>How it works</h4>${S.photos === 'lava' ? `<button class="dp-photos" data-d="photos"><span class="dp-photostrip">${LAVA_PHOTOS.list.slice(0, 3).map((x) => `<img src="${x.img}" alt="" loading="lazy">`).join('')}</span><span><b>See the real thing</b><small>lava erupting today, and the rock it left in New Jersey</small></span></button>` : ''}<div class="dp-how">${(S.explain || []).map((k) => `<button data-d="how" data-id="${k}"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor"/></svg>${esc(EXPLAIN[k].title)}</button>`).join('')}</div>` : '';
  function story(id, b = 0) {
    const S = STORY_BY[id]; if (!S) { intro(); return; }
    view = 'story'; game = null; cur = id; chap = b;
    const seq = SEQUENCE.indexOf(id); if (seq >= 0) store.set('deep.chapter', seq);
    const B = S.beats[BEAT_KEYS[b]], last = b === 2;
    setBar(BEAT_KEYS.map((k, j) => ({ when: `Step ${j + 1} of 3`, title: S.title })), b, ['Back a step', 'Next step']);
    applyScene(B.mark ? { ...B.scene, mark: { ...B.mark, color: DOMAINS[S.domain].color } } : B.scene);
    // the camera goes there (under the illustration, on the first beat); the beat's animation waits until it has arrived
    const play = B.script ? () => runScript(B.script) : B.play && PLAYS[B.play], go = play && (() => afterEx(play));
    const bb = B.fit && data.provinces.features.find((f) => f.properties.region === B.fit)?.properties.bbox;
    after(() => (bb ? fitBox(bb, 7, go) : fly([B.cam[0], B.cam[1]], B.cam[2], null, 1800, go)));
    if (last) markRead(store, id);
    const L = B.fit && LAND.find((r) => r.id === B.fit), D = DOMAINS[S.domain], read = readIds(store);
    frame(`${top(S.title, 'intro', 'Deep Jersey')}
      ${PLACE_OF[id] ? `<button class="dp-where" data-d="county" data-id="${esc(PLACE_OF[id].county)}">${esc(PLACE_OF[id].town)} · ${esc(PLACE_OF[id].county)} County</button>` : ''}
      <p class="dp-kick"><span class="dp-dom" style="background:${D.color}">${esc(D.name)}</span>${S.gone ? '<span class="dp-dom gone">Gone</span>' : ''} ${esc(S.when)}</p>
      ${b === 0 && STORY_EX[id] ? `<button class="dp-play" data-d="watch" data-id="${STORY_EX[id]}"><b>▶ Watch how it happened</b><small>${esc(EXPLAIN[STORY_EX[id]].title)}, drawn as a slice through the ground</small></button>` : ''}
      ${paras(B.text)}
      ${L ? `<button class="dp-region" data-d="landone" data-id="${L.id}"><i style="background:${L.color}"></i><span><b>${esc(L.name)} today</b><small>${esc(L.nj)}</small></span></button>` : ''}
      ${last ? `${chips(S.places)}<h4>Read next</h4><div class="dp-next">${S.threads.map((t) => `<button data-d="story" data-id="${t.to}"${read.includes(t.to) ? '' : ' class="new"'}><b>${esc(STORY_BY[t.to].title)}${PLACE_OF[t.to] ? ` <em>· ${esc(PLACE_OF[t.to].town)}</em>` : ''}</b><small>${esc(t.why)}</small></button>`).join('')}</div><button class="tr-card wide" data-d="mapidx" data-id="${id}"><b>Show on the map</b><small>this story and the others near it</small></button>`
        : `<button class="dp-start" data-d="beat" data-b="${b + 1}"><b>Next ›</b><small>${esc(S.beats[BEAT_KEYS[b + 1]].text[0].slice(0, 70))}…</small></button>`}
      ${howList(S)}
      ${srcList(S.src)}`);
    if (b === 0 && STORY_EX[id]) showEx(STORY_EX[id]);
  }

  // ---- the land today ------------------------------------------------------------------------------------------------------
  function land() {
    view = 'land'; landSel = null; game = null; setBar(null);
    applyScene({ prov: Object.fromEntries(LAND.map((r) => [r.id, 0.55])) });
    after(() => fly([-75.6, 40.0], 5.4, null, 1500));
    frame(`${top('The land today', 'intro', 'Deep Jersey')}
      <p class="dp-line">New Jersey has four of the eastern United States’ natural regions, and borders two more. Tap one to see all of it.</p>
      <div class="dp-regions">${LAND.map((r) => `<button class="dp-region" data-d="landone" data-id="${r.id}"><i style="background:${r.color}"></i><span><b>${esc(r.name)}</b><small>${esc(r.nj)}</small></span></button>`).join('')}</div>`);
  }
  function landOne(id) {
    const R = LAND.find((r) => r.id === id); if (!R) return;
    const from = view; view = 'land'; landSel = id; game = null; setBar(null);
    applyScene({ prov: { [id]: 0.8 }, provFaint: 0.1, labels: [id] });
    const bb = data.provinces.features.find((f) => f.properties.region === id).properties.bbox;
    after(() => fitBox(bb, 7.5));
    frame(`${top(R.name, from === 'story' ? 'story' : 'land', from === 'story' ? 'The story' : 'All regions')}
      <p class="dp-kick">In New Jersey: ${esc(R.nj)}</p>
      ${paras(R.text)}
      ${howRow(R.id)}
      ${R.close.length ? `<h4>See it up close</h4>${chips(R.close)}` : ''}
      ${srcList(R.src)}`);
  }

  // ---- close-ups ----------------------------------------------------------------------------------------------------------
  function showStop(i, flyTo = true) {
    era = i; const E = ERAS[i];
    setBar(ERAS, i, ['Newer', 'Older']);
    applyScene(stopScene(E.id));
    if (flyTo) after(() => fly(E.center, E.zoom, E.pitch));
  }
  function stopSheet() {
    view = 'close'; game = null;
    const E = ERAS[era], cards = CARDS.filter((c) => c.era === E.id), s = seen();
    frame(`${top(cor.name, 'intro', 'Deep Jersey')}
      <p class="dp-kick">${esc(E.when)} · stop ${era + 1} of ${ERAS.length}</p><h2>${esc(E.title)}</h2><p class="dp-line">${esc(E.line)}</p>
      <div class="dp-cards">${cards.map((c) => `<button class="dp-card${s.includes(c.id) ? ' seen' : ''}" data-d="card" data-id="${c.id}"><i style="background:${KIND_COLOR[c.kind]}"></i><span><b>${esc(c.title)}</b><small>${esc(c.when)}</small></span></button>`).join('')}</div>
      ${['ice', 'moggy', 'notch'].includes(E.id) ? '<button class="dp-play" data-d="playice"><b>▶ Play the ice age on the map</b><small>the ice spreads, stops, melts back; the lake fills and drains</small></button>' : ''}
      ${howRow(E.id)}
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
    const from = view, fromCur = cur, fromChap = chap, fromLand = landSel;
    ret = from === 'story' ? () => story(fromCur, fromChap) : from === 'land' && fromLand ? () => landOne(fromLand) : () => { showStop(era, false); stopSheet(); };
    game = null; markSeen(id);
    view = 'card';
    const i = ERA_INDEX[c.era]; era = i; setBar(ERAS, i, ['Newer', 'Older']); applyScene(stopScene(c.era));
    after(() => (c.p ? fly(c.p, Math.max(ERAS[i].zoom, 11.2), 55, 1400) : fly(ERAS[i].center, ERAS[i].zoom, ERAS[i].pitch, 1400)));
    const links = CHAIN.filter((x) => x.card === id).map((x) => x.step);
    frame(`${top(from === 'story' ? 'The story' : from === 'land' ? 'The land today' : cor.name, 'back')}
      <p class="dp-kick" style="color:${KIND_COLOR[c.kind]}">${esc(c.when)} · ${esc(cor.name)}</p><h2>${esc(c.title)}</h2>
      ${paras(c.text)}
      ${howRow(id)}
      ${c.why ? `<p class="dp-tags">${c.why.map((w) => `<span>${esc(WHY[w])}</span>`).join('')}</p>` : ''}
      ${links.length ? `<button class="tr-card wide" data-d="chain"><b>Part of ${esc(cor.chainName.replace(/^The /, 'the '))}</b><small>${esc(links.join(' and '))}</small></button>` : ''}
      <button class="tr-card wide" data-d="closehere"><b>More from ${esc(cor.name)}</b><small>this stop and the ones around it</small></button>
      ${srcList(c.src)}`);
  }

  /** The chapter's illustration, played over the map rather than inside the sheet (the sheet stays short and the map keeps its
   * room): each step a few seconds, then it slides away and the map takes over. Tap to skip; Watch how it happened brings it back. */
  let exEl = null, exRun = 0, exWait = null;
  function showEx(id) {
    const X = EXPLAIN[id]; if (!X) return;
    if (!exEl) { exEl = document.createElement('div'); exEl.id = 'deepex'; document.body.appendChild(exEl);
      exEl.addEventListener('click', (e) => { if (e.target.closest('[data-x=steps]')) { const i = exEl.dataset.id; closeEx(true); how(i); } else closeEx(true); }); }
    const run = ++exRun; exWait = exWait || [];
    const t = bar && !bar.hidden ? bar.getBoundingClientRect().bottom + 8 : 12, b = root && !root.hidden ? innerHeight - root.getBoundingClientRect().top + 8 : 12;
    Object.assign(exEl.style, { top: `${t}px`, bottom: `${Math.max(12, b)}px` });
    exEl.dataset.id = id;
    exEl.innerHTML = `<div class="dp-exhead">${esc(X.title)}</div><div class="dp-exfig">${X.steps[0].draw}</div><p class="dp-excap">${esc(X.steps[0].text)}</p>
      <div class="dp-exfoot"><span class="dp-exdots">${X.steps.map((_, k) => `<i${k ? '' : ' class="on"'}></i>`).join('')}</span><button data-x="steps">Step by step</button><span class="dp-exskip">Tap to skip ›</span></div>`;
    exEl.hidden = false; exEl.classList.remove('out'); void exEl.offsetWidth; exEl.classList.add('in');
    const each = matchMedia('(prefers-reduced-motion: reduce)').matches ? 6500 : 4600;
    let k = 0; clearInterval(exTimer);
    exTimer = setInterval(() => {
      if (run !== exRun || ctx.mode !== 'deep') { clearInterval(exTimer); return; }
      k++; if (k >= X.steps.length) { closeEx(true); return; }
      exEl.querySelector('.dp-exfig').innerHTML = X.steps[k].draw; exEl.querySelector('.dp-excap').textContent = X.steps[k].text;
      exEl.querySelectorAll('.dp-exdots i').forEach((d, j) => d.classList.toggle('on', j === k));
    }, each);
  }
  /** Slide the illustration away; when it ends by itself or is skipped, whatever was waiting for it (the chapter's map animation) runs. */
  function closeEx(finished) {
    clearInterval(exTimer); exTimer = null; exRun++;
    const wait = exWait; exWait = null;
    if (exEl && !exEl.hidden) { exEl.classList.remove('in'); exEl.classList.add('out'); const el = exEl; setTimeout(() => { if (el.classList.contains('out')) el.hidden = true; }, 380); }
    if (finished && wait) for (const f of wait) f();
  }
  const hideEx = () => closeEx(false);
  const afterEx = (f) => { if (exWait) exWait.push(f); else f(); };

  /** An explainer: a slice through the ground, step by step. Back returns to wherever it was opened from. */
  // Back from an explainer or the photos returns to where it was opened from; they can open each other, so the way back is a stack
  let backs = [];
  const pushBack = () => { const v = view, s0 = cur, c0 = chap, l0 = landSel, e0 = era, r0 = ret, html = root.innerHTML, tall = root.classList.contains('tall');
    backs.push(() => { view = v; cur = s0; chap = c0; landSel = l0; era = e0; ret = r0; root.innerHTML = html; root.scrollTop = 0; root.classList.toggle('tall', tall); }); };
  function how(id, step = 0) {
    const X = EXPLAIN[id]; if (!X) return;
    if (step === 0 && view !== 'how') pushBack();
    view = 'how';
    const S = X.steps[step], last = step === X.steps.length - 1;
    frame(`${top('How it works', 'howback')}
      <h2>${esc(X.title)}</h2>
      <figure class="dp-ex">${S.draw}</figure>
      <div class="dp-exdots">${X.steps.map((_, k) => `<i${k === step ? ' class="on"' : ''}></i>`).join('')}</div>
      <p class="dp-p dp-extext">${esc(S.text)}</p>
      <div class="dp-exnav"><button data-d="howstep" data-id="${id}" data-s="${step - 1}"${step ? '' : ' disabled'}>Back</button>
        ${last ? '<button class="go" data-d="howback">Got it</button>' : `<button class="go" data-d="howstep" data-id="${id}" data-s="${step + 1}">Next</button>`}</div>
      <details class="dp-srcs"><summary>Sources</summary><ul class="dp-src">${X.src.map((k) => `<li><a href="${esc(EX_SRC[k][1])}" target="_blank" rel="noopener">${esc(EX_SRC[k][0])}</a></li>`).join('')}</ul></details>`);
  }

  /** Photos: lava erupting today (labelled as not New Jersey), then the rock it left here. Back returns to where it was opened. */
  function photos() {
    if (view !== 'photos') pushBack();
    view = 'photos';
    const P = LAVA_PHOTOS;
    frame(`${top('See the real thing', 'howback')}
      <p class="dp-p">${esc(P.intro)}</p>
      ${P.list.map((x) => `<figure class="dp-photo"><img src="${x.img}" alt="${esc(x.title)}" loading="lazy"><figcaption><span class="dp-phtag${x.tag.startsWith('Not') ? ' far' : ''}">${esc(x.tag)}</span><b>${esc(x.title)}</b>${esc(x.text)}<small>${esc(x.credit)} · <a href="${esc(x.page)}" target="_blank" rel="noopener">source</a></small></figcaption></figure>`).join('')}
      <p class="dp-p">${esc(P.extinction)}</p>
      <button class="dp-play" data-d="how" data-id="lava"><b>▶ How lava made the Watchungs and the Palisades</b><small>eight steps, drawn as a slice through the ground</small></button>
      <details class="dp-srcs"><summary>Sources</summary><ul class="dp-src">${P.src.map((k) => `<li><a href="${esc(EX_SRC[k][1])}" target="_blank" rel="noopener">${esc(EX_SRC[k][0])}</a></li>`).join('')}</ul></details>`);
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

  // when the app is hidden or the screen locks, stop everything that keeps working: the camera, the timed animations, the illustration
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || ctx.mode !== 'deep') return;
    map.stop(); drift++;
    for (const t of timers) clearTimeout(t); timers = []; caption('');
    hideEx();
  });

  const actions = {
    home: async () => {
      // the home page opens under this sheet and the bar: hide them while it is up, and come back if Deep Jersey is picked again
      const barWas = bar.hidden; hideEx(); root.hidden = true; bar.hidden = true; if (pinEl) pinEl.hidden = true;
      await ctx.showHome();
      if (ctx.mode === 'deep') { root.hidden = false; bar.hidden = barWas; drawPins(shown.pins, shown.labels, shown.mark); setExag(exagNow); }
    },
    intro, land, chain, order, why,
    more: (b) => { const m = b.previousElementSibling; if (m) m.hidden = false; b.remove(); },
    grab: () => { const big = !root.classList.contains('big'); root.classList.toggle('big', big); store.set('deep.big', big); const g = root.querySelector('.dp-grab'); if (g) g.setAttribute('aria-label', big ? 'Make the panel shorter' : 'Make the panel taller'); },
    story: (b) => story(b.dataset.id || SEQUENCE[Math.min(SEQUENCE.length - 1, store.get('deep.chapter', 0))]),
    beat: (b) => story(cur, +b.dataset.b),
    mapidx: (b) => mapIndex(b.dataset.id || null),
    county: (b) => countyView(b.dataset.id),
    unread: () => { onlyUnread = !onlyUnread; mapIndex(); },
    landone: (b) => landOne(b.dataset.id),
    close: (b) => openClose(b.dataset.id),
    closehere: () => { showStop(era, false); stopSheet(); },
    era: () => stopSheet(),
    back: () => (ret ? ret() : intro()),
    card: (b) => openCard(b.dataset.id),
    how: (b) => how(b.dataset.id),
    watch: (b) => { showEx(b.dataset.id); },
    photos,
    playice: () => playIce(),
    howstep: (b) => how(b.dataset.id, +b.dataset.s),
    howback: () => { const f = backs.pop(); if (f) f(); else intro(); },
    orderpick: orderPick, whypick: whyPick,
  };

  return {
    async enter() {
      document.body.classList.add('deep-on');
      await load(); mount(); root.hidden = false; root.classList.toggle('big', store.get('deep.big', false));
      ctx.clearHighlights && ctx.clearHighlights(); ctx.sheet(''); ctx.hud('');
      labelVis = HIDE_LABELS.filter((id) => map.getLayer(id)).map((id) => [id, map.getLayoutProperty(id, 'visibility') || 'visible']);
      for (const [id] of labelVis) map.setLayoutProperty(id, 'visibility', 'none');
      map.setMaxBounds(null);   // no fence while Deep Jersey is open: MapLibre will not zoom out past a fence, and whole ranges need room
      const go = () => {
        if (ctx.mode !== 'deep') return;
        try { addLayers(); } catch (e) { map.once('styledata', go); return; }   // the style is still loading: try again when it is
        intro();
      };
      go();
    },
    leave() {
      for (const t of timers) clearTimeout(t); timers = []; caption(''); hideEx();
      document.body.classList.remove('deep-on');
      if (root) root.hidden = true; if (bar) bar.hidden = true;
      map.stop(); map.setTerrain(null); exagNow = 0; if (exagEl) exagEl.hidden = true; drift++; hideLayers();
      for (const [id, v] of labelVis) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v); labelVis = [];
      map.setMaxBounds(ctx.region.maxBounds || null); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      map.fitBounds(ctx.region.bounds, { padding: 20, pitch: 0, bearing: 0, duration: ctx.dur(600) });
    },
  };
}
