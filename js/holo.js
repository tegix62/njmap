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
