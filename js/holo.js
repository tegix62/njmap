// "Hologram" look for a map: a dark projection table with the land drawn as stacked elevation bands,
// everything else reduced to thin glowing lines. One module so any game can switch it on.
//
//   const holo = createHolo(map);
//   holo.apply(true);    // recolour the base map, add the banded relief, turn on the screen overlay (body.holo)
//   holo.apply(false);   // put everything back exactly as it was
//
// Only paint properties are changed, and each one is remembered before it is, so turning it off restores the
// theme (Ink or Classic) whatever it was. The panels, buttons and scan overlay are CSS under `body.holo`.

export const HOLO = {
  void: '#02101a',
  land: '#04202c',
  water: '#0a5a72',
  line: '#2aa8c4',
  glow: '#7ffcff',
  target: '#3df5d0',
  wrong: '#ff8a4a',
  text: '#bff7ff',
  halo: '#021017',
};

// base-map layers (the app's own style, js/style.js) and what the hologram does to them
const BASE = {
  bg: { 'background-color': HOLO.void },
  'muni-fill': { 'fill-color': HOLO.land, 'fill-opacity': 1 },
  water: { 'fill-color': HOLO.water, 'fill-opacity': 0.85 },
  river: { 'line-color': '#3cc3e0', 'line-opacity': 0.9 },
  'road-minor': { 'line-color': '#145a6e', 'line-opacity': 0.55 },
  'road-mid': { 'line-color': '#1a7288', 'line-opacity': 0.65 },
  'road-major': { 'line-color': '#2aa8c4', 'line-opacity': 0.8 },
  'hwy-color': { 'line-color': '#6fe6ff', 'line-opacity': 0.9 },
  'muni-line': { 'line-color': '#1f8ca6', 'line-opacity': 0.4 },
  'county-line': { 'line-color': '#3cc3e0', 'line-opacity': 0.55 },
};

// the elevation bands: every STEP metres a ramp from dark to bright, then a hard edge back to dark,
// so each contour interval reads as one lit slab with a bright rim at its top edge
const STEP = 20;
function reliefColor() {
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const dark = rgb('#04222f'), lit = rgb('#0f7a94'), top = rgb('#4be4ff');
  const out = ['interpolate', ['linear'], ['elevation']];
  const hex = (v) => `rgb(${v[0]},${v[1]},${v[2]})`;
  for (let L = 0, i = 0; L < 560; L += STEP, i++) {
    const k = Math.min(1, L / 420);                       // higher bands are brighter overall
    const lo = mix(dark, lit, 0.15 + 0.35 * k), hi = mix(lit, top, 0.25 + 0.6 * k);
    out.push(L, hex(lo), L + STEP - 1.2, hex(hi));
  }
  return out;
}

const body = () => document.body;

export function createHolo(map) {
  const saved = new Map();   // `${layer}|${prop}` → original value
  let on = false, fx = null;

  const set = (id, prop, val) => {
    if (!map.getLayer(id)) return;
    const key = id + '|' + prop;
    if (!saved.has(key)) saved.set(key, map.getPaintProperty(id, prop));
    map.setPaintProperty(id, prop, val);
  };
  const restore = () => {
    for (const [key, v] of saved) {
      const [id, prop] = key.split('|');
      if (map.getLayer(id)) map.setPaintProperty(id, prop, v === undefined ? null : v);
    }
    saved.clear();
  };

  function ensureRelief() {
    if (map.getLayer('holo-relief') || !map.getSource('orb-dem-hs')) return;
    const before = ['river', 'road-minor'].find((id) => map.getLayer(id));
    map.addLayer({ id: 'holo-relief', type: 'color-relief', source: 'orb-dem-hs', layout: { visibility: 'none' }, paint: { 'color-relief-color': reliefColor(), 'color-relief-opacity': 1 } }, before);
  }

  function ensureFx() {
    if (fx) return;
    fx = document.createElement('div');
    fx.id = 'holoFx';
    fx.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fx);
  }

  /** The look of what the game itself draws on top (outlines, bands, flash, names). */
  function game(onNow) {
    const col = ['match', ['get', 'role'], 'wrong', onNow ? HOLO.wrong : '#d9622b', onNow ? HOLO.target : '#0b9a82'];
    for (const id of ['orb-geom-band', 'orb-geom-fill', 'orb-geom-fill2']) set(id, 'fill-color', col);
    set('orb-geom-line', 'line-color', col);
    set('orb-geom-wall', 'fill-extrusion-color', col);
    set('orb-geom-casing', 'line-color', HOLO.halo);
    set('orb-geom-casing', 'line-opacity', 0.75);
    set('orb-flash-glow', 'line-color', HOLO.glow);
    set('orb-town-name', 'text-color', HOLO.text);
    set('orb-town-name', 'text-halo-color', HOLO.halo);
    set('orb-target', 'fill-extrusion-color', '#5ff3ff');            // buildings: lit glass instead of cream blocks
    set('orb-target', 'fill-extrusion-opacity', 0.8);
    set('orb-others', 'fill-extrusion-color', '#1c8aa4');
    set('orb-ghost', 'fill-extrusion-color', '#1c8aa4');
    set('orb-relief', 'hillshade-shadow-color', '#000b12');
    set('orb-relief', 'hillshade-highlight-color', '#5ff3ff');
    set('orb-relief', 'hillshade-accent-color', '#0a3140');
    set('orb-relief', 'hillshade-exaggeration', 0.35);
  }

  return {
    get on() { return on; },
    apply(want) {
      want = !!want;
      if (want === on) { if (want) { ensureRelief(); game(true); } return; }
      on = want;
      body().classList.toggle('holo', on);
      if (on) {
        ensureFx();
        ensureRelief();
        for (const [id, props] of Object.entries(BASE)) for (const [p, v] of Object.entries(props)) set(id, p, v);
        game(true);
        if (map.getLayer('holo-relief')) map.setLayoutProperty('holo-relief', 'visibility', 'visible');
      } else {
        if (map.getLayer('holo-relief')) map.setLayoutProperty('holo-relief', 'visibility', 'none');
        restore();
      }
      if (fx) fx.hidden = !on;
    },
    /** The colour of the outline for a role, for things drawn outside the map (legend swatches). */
    color: (role) => (on ? (role === 'wrong' ? HOLO.wrong : HOLO.target) : role === 'wrong' ? '#d9622b' : '#0b9a82'),
  };
}

/**
 * Scan points: small + and × marks pinned to the terrain around the place being asked about, like the feature points
 * a camera tracker (or a Death Stranding scan) drops on a landscape. They are picked where the ground is steepest, so
 * they outline the relief; while the question is open a ring sweeps outward from the place and lights them as it passes.
 *
 *   const scan = createScan(map);
 *   scan.build([lng, lat], 14);   // seed the points around a place (km radius), once the terrain tiles are in
 *   scan.pulse(true);             // sweep repeatedly (false: leave them lit and still)
 *   scan.clear();
 */
export function createScan(map) {
  const SRC = 'orb-holo-scan', LAYER = 'orb-holo-scan';
  let raf = 0, t0 = 0, pulsing = false, token = 0, big = 1;

  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

  function ensure() {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    // drawn as short line strokes, not text: the map drops text and icons whose terrain tile is not in yet, lines drape on the ground
    map.addLayer({
      id: LAYER, type: 'line', source: SRC,
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': '#e6ffff', 'line-opacity': 0.6, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.1 * big, 12, 2.2 * big] },
    });
  }
  const opacityAt = (wave) => ['interpolate', ['linear'], ['-', wave, ['get', 'd']], -0.02, 0, 0, 1, 0.6, 0.55];

  function frame(now) {
    if (!pulsing) return;
    const e = ((now - t0) % 7000) / 1000;           // a sweep takes 2 s, then it rests
    const wave = e < 2.2 ? e / 1.8 : 3;             // (3: past everything, so all points sit at their resting glow)
    if (map.getLayer(LAYER)) map.setPaintProperty(LAYER, 'line-opacity', opacityAt(wave));
    raf = requestAnimationFrame(frame);
  }

  function seed(center, radiusKm, tries) {
    const cosLat = Math.cos((center[1] * Math.PI) / 180);
    const kmLat = 1 / 111.2, kmLng = kmLat / cosLat;
    const step = Math.max(0.55, radiusKm / 26);
    const pts = [];
    const n = Math.ceil(radiusKm / step);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const jx = (hash(i, j) - 0.5) * step * 0.9, jy = (hash(j + 7, i - 3) - 0.5) * step * 0.9;
      const dx = i * step + jx, dy = j * step + jy;
      const d = Math.hypot(dx, dy) / radiusKm;
      if (d > 1) continue;
      pts.push({ ll: [center[0] + dx * kmLng, center[1] + dy * kmLat], d, r: hash(i * 3 + 1, j * 5 + 2) });
    }
    // steepness from the terrain model (queryTerrainElevation needs the tiles in; tries again a few times if not)
    const q = (ll) => map.queryTerrainElevation ? map.queryTerrainElevation(ll) : null;
    const h = 0.16 * kmLat;
    let ok = 0;
    for (const p of pts) {
      const e0 = q(p.ll), ex = q([p.ll[0] + h / cosLat, p.ll[1]]), ey = q([p.ll[0], p.ll[1] + h]);
      p.s = e0 == null || ex == null || ey == null ? null : Math.abs(ex - e0) + Math.abs(ey - e0);
      if (p.s != null) ok++;
    }
    if (ok < pts.length * 0.5 && tries > 0) return null;
    const have = pts.filter((p) => p.s != null).sort((a, b) => b.s - a.s);
    const keep = new Set(have.slice(0, Math.min(190, Math.ceil(have.length * 0.3))));
    for (const p of pts) if (!keep.has(p) && p.r < 0.08) keep.add(p);          // a few on flat ground too, so it is not only slopes
    return [...keep];
  }

  return {
    build(center, radiusKm) {
      ensure();
      // cover about what is on screen: half the narrow side of the map, at this zoom
      if (!radiusKm) radiusKm = Math.max(5, Math.min(map.getCanvas().clientWidth, map.getCanvas().clientHeight) * 0.5 * (156.543 * Math.cos((center[1] * Math.PI) / 180)) / 2 ** map.getZoom());
      const my = ++token;
      const mpp = (156.543 * Math.cos((center[1] * Math.PI) / 180)) / 2 ** map.getZoom();   // km per screen pixel at this zoom
      const arm = 5 * mpp * (big > 1 ? 1.4 : 1);                       // a stroke is about 10 px long on screen, whatever the zoom
      const cosL = Math.cos((center[1] * Math.PI) / 180);
      const cross = (ll, diag, a) => {
        const dx = a / 111.2 / cosL, dy = a / 111.2, k = diag ? 0.71 : 1;
        return diag
          ? [[[ll[0] - dx * k, ll[1] - dy * k], [ll[0] + dx * k, ll[1] + dy * k]], [[ll[0] - dx * k, ll[1] + dy * k], [ll[0] + dx * k, ll[1] - dy * k]]]
          : [[[ll[0] - dx, ll[1]], [ll[0] + dx, ll[1]]], [[ll[0], ll[1] - dy], [ll[0], ll[1] + dy]]];
      };
      const attempt = (tries) => {
        if (my !== token) return;
        const pts = seed(center, radiusKm, tries);
        if (!pts) return void setTimeout(() => attempt(tries - 1), 700);
        const src = map.getSource(SRC);
        if (!src || my !== token) return;
        src.setData({ type: 'FeatureCollection', features: pts.map((p) => ({ type: 'Feature', properties: { d: +p.d.toFixed(3) }, geometry: { type: 'MultiLineString', coordinates: cross(p.ll, p.r > 0.62, arm) } })) });
      };
      attempt(4);
    },
    /** Thicker, longer strokes for a low-resolution picture (1 = normal), so they stay marks and not noise. */
    boost(f) {
      big = f;
      if (map.getLayer(LAYER)) map.setPaintProperty(LAYER, 'line-width', ['interpolate', ['linear'], ['zoom'], 8, 1.1 * big, 12, 2.2 * big]);
    },
    pulse(on) {
      cancelAnimationFrame(raf);
      pulsing = !!on;
      if (map.getLayer(LAYER)) map.setPaintProperty(LAYER, 'line-opacity', 0.6);
      if (on) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
    },
    clear() {
      token++;
      cancelAnimationFrame(raf);
      pulsing = false;
      const src = map.getSource(SRC);
      if (src) src.setData({ type: 'FeatureCollection', features: [] });
    },
  };
}
