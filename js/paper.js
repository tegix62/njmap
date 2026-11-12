import { blots, specks, creases, grainImage, inkImage } from './world.js';

// "Paper" look for a map: a printed road map from the 1960s–70s (cream stock, a few flat spot inks, halftone water,
// plates that don't quite line up, fold creases). Same shape as js/holo.js:
//
//   const paper = createPaper(map);
//   paper.apply(true);    // recolour the base map, add the misregistered plates, turn on the paper overlay (body.paper)
//   paper.apply(false);   // put everything back as it was
//
// Palette after a Gulf road map of Washington, D.C.: pale yellow ground, orange for what is asked about, green for
// parks, pale blue water, thin dark linework, orange arterials.
// Only paint properties are changed, each remembered before it is; the overlay and panels are CSS under `body.paper`.

export const PAPER = {
  stock: '#f4efc4',
  land: '#f6f1c9',
  water: '#c3dcee',
  waterInk: '#3f78ad',
  ink: '#1d2a5b',
  line: '#6a6a58',
  road: '#e4893e',
  hwy: '#d4552b',
  target: '#e8603a',
  wrong: '#2f6fb5',
  fringeA: '#f2d63c',      // the two off-register plates behind a coloured mass
  fringeB: '#3d78c9',
  text: '#1d2a5b',
  halo: '#f6f1c9',
  band: ['match', ['get', 'band'], 0, 0.45, 1, 0.6, 2, 0.82, 0.5],   // a mountain's three bands, as flat ink strengths
};

const BASE = {
  bg: { 'background-color': PAPER.stock },
  'muni-fill': { 'fill-color': PAPER.land, 'fill-opacity': 1 },
  water: { 'fill-color': PAPER.water, 'fill-opacity': 1 },
  river: { 'line-color': PAPER.waterInk, 'line-opacity': 0.9 },
  'road-minor': { 'line-color': PAPER.line, 'line-opacity': 0.75 },
  'road-mid': { 'line-color': '#4a4a3c', 'line-opacity': 0.85 },
  'road-major': { 'line-color': PAPER.road, 'line-opacity': 1 },
  'hwy-color': { 'line-color': PAPER.hwy, 'line-opacity': 1 },
  'muni-line': { 'line-color': '#9a9a7a', 'line-opacity': 0.55 },
  'county-line': { 'line-color': PAPER.ink, 'line-opacity': 0.6 },
};
// ink spreads a little into the stock: a hair of blur on printed lines
const BLEED = { river: 0.5, 'road-minor': 0.45, 'road-mid': 0.45, 'road-major': 0.55, 'hwy-color': 0.6, 'muni-line': 0.5, 'county-line': 0.6 };

/** A tile of blue halftone dots (transparent between), for the water. */
function dotsImage(rgb = [63, 120, 173]) {
  const S = 8, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`;
  for (const [x, y] of [[2, 2], [6, 6]]) { g.beginPath(); g.arc(x, y, 1.35, 0, Math.PI * 2); g.fill(); }
  return g.getImageData(0, 0, S, S);
}

export function createPaper(map, bounds) {
  const saved = new Map();
  let on = false;

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

  /**
   * The texture of the sheet, as part of the map: paper fibre, ink blotches, fold creases and pinholes are geographic features over the
   * region, so they pan, turn and tilt with the land. (An overlay on the screen stays still while the map moves under it, and looks like a filter.)
   */
  function world() {
    if (!bounds || map.getSource('orb-paper-blots')) return;
    const under = map.getLayer('orb-paper-a') ? 'orb-paper-a' : undefined;           // below the coloured masses: it is the stock they were printed on
    const over = map.getLayer('orb-town-name') ? 'orb-town-name' : undefined;        // above them: pinholes in the ink
    const hide = { visibility: 'none' };
    map.addImage('paper-grain', grainImage(), { pixelRatio: 2 });
    const [[w, s], [e, n]] = bounds;
    map.addSource('orb-paper-sheet', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[w - 1, s - 1], [e + 1, s - 1], [e + 1, n + 1], [w - 1, n + 1], [w - 1, s - 1]]] } } });
    map.addSource('orb-paper-blots', { type: 'geojson', data: blots(bounds) });
    map.addSource('orb-paper-creases', { type: 'geojson', data: creases(bounds) });
    map.addSource('orb-paper-specks', { type: 'geojson', data: specks(bounds) });
    map.addLayer({ id: 'orb-paper-grain', type: 'fill', source: 'orb-paper-sheet', layout: hide, paint: { 'fill-pattern': 'paper-grain', 'fill-opacity': 0.4 } }, under);
    map.addLayer({ id: 'orb-paper-blots', type: 'fill', source: 'orb-paper-blots', layout: hide, paint: { 'fill-color': ['case', ['==', ['get', 'w'], 1], '#8a6a2c', '#1d2a5b'], 'fill-opacity': 0.04 } }, under);
    map.addLayer({ id: 'orb-paper-crease-dark', type: 'line', source: 'orb-paper-creases', layout: hide, paint: { 'line-color': '#6e5a28', 'line-opacity': 0.3, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 12, 1.6], 'line-blur': 0.6 } }, under);
    map.addLayer({ id: 'orb-paper-crease-pale', type: 'line', source: 'orb-paper-creases', layout: hide, paint: { 'line-color': '#fffff0', 'line-opacity': 0.6, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 12, 1.5], 'line-translate': [1.6, 1], 'line-blur': 0.5 } }, under);
    map.addLayer({ id: 'orb-paper-specks', type: 'circle', source: 'orb-paper-specks', layout: hide, paint: { 'circle-color': PAPER.halo, 'circle-opacity': 0.9, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, ['*', 0.7, ['+', 0.6, ['get', 's']]], 13, ['*', 1.8, ['+', 0.6, ['get', 's']]]], 'circle-pitch-alignment': 'map' } }, over);
  }
  const WORLD = ['orb-paper-inktex', 'orb-paper-grain', 'orb-paper-blots', 'orb-paper-crease-dark', 'orb-paper-crease-pale', 'orb-paper-specks'];

  /**
   * Ink bleed and missed registration for the printed linework: under each main line a soft dark glow (the ink spreading into the stock), and
   * a blue copy a pixel or two off (a plate that did not line up). Cloned from the base style's own layers.
   */
  const GLOW = [];
  function linework() {
    if (GLOW.length) return;
    const specs = map.getStyle().layers;
    for (const id of ['river', 'road-major', 'hwy-color', 'county-line', 'muni-line']) {
      const s = specs.find((l) => l.id === id);
      if (!s || s.type !== 'line') continue;
      const w = ['interpolate', ['linear'], ['zoom'], 8, id === 'county-line' ? 3.2 : 2.4, 12, id === 'county-line' ? 6 : 4.5];
      const base = { ...s, layout: { ...(s.layout || {}), visibility: 'none' } };
      map.addLayer({ ...base, id: id + '-pglow', paint: { 'line-color': PAPER.ink, 'line-opacity': 0.26, 'line-blur': 3, 'line-width': w } }, id);
      if (id !== 'muni-line') map.addLayer({ ...base, id: id + '-preg', paint: { 'line-color': PAPER.fringeB, 'line-opacity': 0.4, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2], 'line-translate': [1.6, 1.2], 'line-translate-anchor': 'viewport' } }, id);
      GLOW.push(id + '-pglow');
      if (id !== 'muni-line') GLOW.push(id + '-preg');
    }
  }

  /** The two plates that print slightly off behind each coloured mass (mountain bands, lake and park fills). */
  function plates() {
    if (!map.getSource('orb-geom') || map.getLayer('orb-paper-a')) return;
    const before = 'orb-geom-band';
    const f = ['any', ['has', 'band'], ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']];
    if (!map.hasImage('paper-ink')) map.addImage('paper-ink', inkImage(), { pixelRatio: 2 });
    map.addLayer({ id: 'orb-paper-inktex', type: 'fill', source: 'orb-geom', filter: f, layout: { visibility: 'none' }, paint: { 'fill-pattern': 'paper-ink', 'fill-opacity': 0.9 } }, map.getLayer('orb-geom-fill') ? 'orb-geom-fill' : undefined);
    for (const [id, col, tr] of [['orb-paper-a', PAPER.fringeA, [4, 3]], ['orb-paper-b', PAPER.fringeB, [-3, -3]]])
      map.addLayer({ id, type: 'fill', source: 'orb-geom', filter: f, layout: { visibility: 'none' }, paint: { 'fill-color': col, 'fill-opacity': 0.55, 'fill-translate': tr, 'fill-translate-anchor': 'viewport' } }, before);
  }

  /** What the game draws on top, in this look. */
  function game() {
    const col = ['match', ['get', 'role'], 'wrong', PAPER.wrong, PAPER.target];
    for (const id of ['orb-geom-band', 'orb-geom-fill', 'orb-geom-fill2']) set(id, 'fill-color', col);
    set('orb-geom-band', 'fill-opacity', PAPER.band);
    set('orb-geom-line', 'line-color', col);
    set('orb-geom-casing', 'line-color', PAPER.ink);               // a hard offset ink shadow, like the state borders
    set('orb-geom-casing', 'line-opacity', 0.85);
    set('orb-geom-casing', 'line-translate', [2, 2]);
    set('orb-geom-casing', 'line-blur', 0.8);
    set('orb-geom-line', 'line-blur', 0.6);
    set('orb-geom-casing', 'line-width', ['interpolate', ['linear'], ['zoom'], 8, 4.5, 12, 8]);
    set('orb-flash-glow', 'line-color', '#f2d63c');
    set('orb-town-name', 'text-color', PAPER.text);
    set('orb-town-name', 'text-halo-color', 'rgba(29,42,91,0.5)');
    set('orb-town-name', 'text-halo-width', 1.6);
    set('orb-town-name', 'text-halo-blur', 1.4);
    set('orb-relief', 'hillshade-shadow-color', '#7a6a3a');       // relief only as a faint warm tone: printed maps of this kind had none
    set('orb-relief', 'hillshade-highlight-color', '#fffbe0');
    set('orb-relief', 'hillshade-accent-color', '#a89a60');
    set('orb-relief', 'hillshade-exaggeration', 0.2);
    // water as a halftone screen over the stock
    if (!map.hasImage('paper-dots')) map.addImage('paper-dots', dotsImage());
    set('water', 'fill-pattern', 'paper-dots');
    try { if (map.setSky) map.setSky({ 'sky-color': PAPER.stock, 'horizon-color': PAPER.stock, 'fog-color': PAPER.stock, 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.35, 'atmosphere-blend': 0 }); } catch { /* no sky support */ }   // (the strip above the horizon is stock too)
  }

  return {
    get on() { return on; },
    apply(want) {
      want = !!want;
      if (want === on) { if (want) { plates(); world(); game(); } return; }
      on = want;
      document.body.classList.toggle('paper', on);
      if (on) {
        plates();
        world();
        linework();
        for (const [id, props] of Object.entries(BASE)) for (const [p, v] of Object.entries(props)) set(id, p, v);
        for (const [id, b] of Object.entries(BLEED)) set(id, 'line-blur', b);
        game();
        for (const id of ['orb-paper-a', 'orb-paper-b', ...WORLD, ...GLOW]) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      } else {
        for (const id of ['orb-paper-a', 'orb-paper-b', ...WORLD, ...GLOW]) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        restore();
      }
    },
    color: (role) => (role === 'wrong' ? PAPER.wrong : PAPER.target),
  };
}
