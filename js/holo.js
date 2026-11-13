import { graticule, gridStepFor } from './world.js';
import { HOLO, TUNE, HL } from './looks.config.js';
import { recolorOthers } from './inkmap.js';

// "Hologram" look for a map: a dark projection table with the land drawn as stacked elevation bands,
// everything else reduced to thin glowing lines. One module so any game can switch it on.
//
//   const holo = createHolo(map);
//   holo.apply(true);    // recolour the base map, add the banded relief, turn on the screen overlay (body.holo)
//   holo.apply(false);   // put everything back exactly as it was
//
// Only paint properties are changed, and each one is remembered before it is, so turning it off restores the
// theme (Ink or Classic) whatever it was. The panels, buttons and scan overlay are CSS under `body.holo`.

export { HOLO };

// base-map layers (the app's own style, js/style.js) and what the hologram does to them
const BASE = {
  bg: { 'background-color': HOLO.void },
  'muni-fill': { 'fill-color': HOLO.land, 'fill-opacity': 1 },
  water: { 'fill-color': HOLO.water, 'fill-opacity': 0.85 },
  // lines are widened and brightened: at PS1 resolution a one-pixel line is half a rendered pixel and would vanish
  river: { 'line-color': '#4fd0ea', 'line-opacity': TUNE.ps1.lines['river'][1], 'line-width': TUNE.ps1.lines['river'][0] },
  'road-minor': { 'line-color': '#1b7088', 'line-opacity': TUNE.ps1.lines['road-minor'][1], 'line-width': TUNE.ps1.lines['road-minor'][0] },
  'road-mid': { 'line-color': '#2290aa', 'line-opacity': TUNE.ps1.lines['road-mid'][1], 'line-width': TUNE.ps1.lines['road-mid'][0] },
  'road-major': { 'line-color': '#3cc3e0', 'line-opacity': TUNE.ps1.lines['road-major'][1], 'line-width': TUNE.ps1.lines['road-major'][0] },
  'hwy-color': { 'line-color': '#9af0ff', 'line-opacity': TUNE.ps1.lines['hwy-color'][1], 'line-width': TUNE.ps1.lines['hwy-color'][0] },
  'muni-line': { 'line-color': '#2aa8c4', 'line-opacity': TUNE.ps1.lines['muni-line'][1], 'line-width': TUNE.ps1.lines['muni-line'][0] },
  'county-line': { 'line-color': '#7fe6ff', 'line-opacity': TUNE.ps1.lines['county-line'][1], 'line-width': TUNE.ps1.lines['county-line'][0] },
};

// the elevation bands: a quiet ground. Every STEP metres the shade steps up a little, with no bright rim, so the relief
// is felt rather than drawn (the first version had a lit rim on every band and fought the outlines)
const STEP = TUNE.ps1.bandMetres;
function reliefColor() {
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const lo = rgb('#052533'), hi = rgb('#10566b');
  const out = ['interpolate', ['linear'], ['elevation']];
  const hex = (v) => `rgb(${v[0]},${v[1]},${v[2]})`;
  for (let L = 0; L < 560; L += STEP) {
    const t = Math.min(1, L / 460);
    out.push(L, hex(mix(lo, hi, t * 0.85)), L + STEP - 1.5, hex(mix(lo, hi, t * 0.85 + 0.12)));
  }
  return out;
}

const body = () => document.body;

export function createHolo(map, bounds) {
  const saved = new Map();   // `${layer}|${prop}` → original value
  let on = false, fillsOn = false;

  const set = (id, prop, val) => {
    if (!map.getLayer(id)) return;
    const key = id + '|' + prop;
    if (!saved.has(key)) saved.set(key, map.getPaintProperty(id, prop));
    map.setPaintProperty(id, prop, val);
  };
  /** Put back only one layer's saved paint (used when a game stops asking for the county fill to be recoloured). */
  const restoreLayer = (lid) => {
    for (const [key, v] of [...saved]) {
      const [id, prop] = key.split('|');
      if (id !== lid) continue;
      if (map.getLayer(id)) map.setPaintProperty(id, prop, v === undefined ? null : v);
      saved.delete(key);
    }
  };
  // every layer the look does not handle by name (each game adds its own) is recoloured by one rule, see js/inkmap.js
  const doneInk = new Set();
  const recolor = () => recolorOthers(map, 'ps1', set, (id) => (id in BASE && (id !== 'muni-fill' || fillsOn)) || id.startsWith('orb-') || id.startsWith('holo-'), doneInk);
  let styleT = 0;
  const onStyle = () => { clearTimeout(styleT); styleT = setTimeout(() => { if (on) recolor(); }, 120); };
  const restore = () => {
    doneInk.clear();
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

  /** The table's graticule: lines of latitude and longitude on the ground (so it moves with the land, unlike a grid on the screen). */
  function grid() {
    if (!bounds || map.getSource('holo-grid')) return;
    map.addSource('holo-grid', { type: 'geojson', data: graticule(bounds, TUNE.ps1.gridStep || gridStepFor(bounds, 24)) });
    const before = map.getLayer('river') ? 'river' : undefined;
    map.addLayer({ id: 'holo-grid', type: 'line', source: 'holo-grid', layout: { visibility: 'none' }, paint: { 'line-color': '#3cc3e0', 'line-opacity': ['case', ['==', ['get', 'm'], 1], TUNE.ps1.gridMajor, TUNE.ps1.gridMinor], 'line-width': ['case', ['==', ['get', 'm'], 1], 1.1, 0.7] } }, before);
  }

  /** The look of what the game itself draws on top (outlines, bands, flash, names). */
  function game(onNow) {
    const hl = ['match', ['coalesce', ['feature-state', 'hl'], '']];
    for (const [k, v] of Object.entries(HL.ps1)) hl.push(k, v);
    hl.push('rgba(0,0,0,0)');
    set('muni-hl', 'fill-color', hl);
    set('muni-hl', 'fill-opacity', 0.2);
    set('muni-hl-line', 'line-color', hl);
    set('muni-hl-line', 'line-width', ['interpolate', ['linear'], ['zoom'], 7, 2.5, 12, 4, 16, 5.5]);
    set('road-focus', 'line-color', HL.ps1.sel);
    set('road-focus-bad', 'line-color', HL.ps1.bad);
    set('trip-line', 'line-color', '#ffd54a');
    const col = ['match', ['get', 'role'], 'wrong', onNow ? HOLO.wrong : '#d9622b', onNow ? HOLO.target : '#0b9a82'];
    for (const id of ['orb-geom-band', 'orb-geom-fill', 'orb-geom-fill2']) set(id, 'fill-color', col);
    set('orb-geom-line', 'line-color', col);
    set('orb-geom-line', 'line-width', ['interpolate', ['linear'], ['zoom'], 8, TUNE.ps1.outlineWidth[0], 12, TUNE.ps1.outlineWidth[1]]);
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
    set('orb-relief', 'hillshade-exaggeration', 0.18);
  }

  return {
    get on() { return on; },
    /** Whether this look also recolours the town/county fills. Off for games that colour them to mean something (knowledge shading, highlights). */
    fills(want) {
      want = !!want;
      if (want === fillsOn) return;
      fillsOn = want;
      if (!on) return;
      if (want) for (const [p, v] of Object.entries(BASE['muni-fill'])) set('muni-fill', p, v);
      else restoreLayer('muni-fill');
    },
    apply(want) {
      want = !!want;
      if (want === on) { if (want) { ensureRelief(); recolor(); game(true); } return; }
      on = want;
      body().classList.toggle('holo', on);
      if (on) {
        ensureRelief();
        grid();
        recolor();
        map.on('styledata', onStyle);
        for (const [id, props] of Object.entries(BASE)) if (id !== 'muni-fill' || fillsOn) for (const [p, v] of Object.entries(props)) set(id, p, v);
        game(true);
        for (const id of ['holo-relief', 'holo-grid']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      } else {
        map.off('styledata', onStyle);
        for (const id of ['holo-relief', 'holo-grid']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        restore();
      }
    },
    /** The colour of the outline for a role, for things drawn outside the map (legend swatches). */
    color: (role) => (on ? (role === 'wrong' ? HOLO.wrong : HOLO.target) : role === 'wrong' ? '#d9622b' : '#0b9a82'),
  };
}

