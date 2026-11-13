// EVERY KNOB OF THE LOOKS, IN ONE PLACE.
//
// The app has three looks (see js/looks.js): Default (the app's own Ink/Classic theme), Paper (a printed road map)
// and PS1 (a projection-table map drawn at PlayStation-1 resolution). Their colours and strengths are all here; the code
// that applies them is js/paper.js, js/holo.js (PS1 colours), js/retro.js (PS1 resolution/dither/fog) and js/world.js
// (texture in map space). Change a number here and every game mode picks it up on the next load.

// ---- PS1: colours of the projection table --------------------------------------------------------------
export const HOLO = {
  void: '#02101a',
  land: '#04202c',
  water: '#0a5a72',
  line: '#2aa8c4',
  glow: '#7ffcff',
  target: '#3df5d0',      // what a question is about
  wrong: '#ff8a4a',       // what you picked, when wrong
  text: '#bff7ff',
  halo: '#021017',
};

// ---- Paper: palette after a Gulf road map of Washington, D.C. ----------------------------------------------
export const PAPER = {
  // Strict ink separation (after the street map, the western-US map and the sheet-music cover): a cream-yellow stock and a few flat spot inks.
  // No greys and no translucent tints; tone comes from dot screens.
  stock: '#f2ea9c',
  land: '#f2ea9c',
  water: '#f2ea9c',        // water is a blue dot screen over the stock
  waterInk: '#2438a8',
  blue: '#2438a8',         // linework ink
  red: '#e8452a',          // arterials, towns, what is asked about
  green: '#1f6b3a',
  ink: '#14235e',          // navy: borders, text
  line: '#2438a8',
  road: '#e8452a',
  hwy: '#e8452a',
  target: '#e8452a',
  wrong: '#2438a8',
  fringeA: '#f2d63c',      // the two off-register plates behind a coloured mass
  fringeB: '#3d78c9',
  text: '#14235e',
  halo: '#f2ea9c',
  band: ['match', ['get', 'band'], 0, 0.45, 1, 0.6, 2, 0.82, 0.5],   // a mountain's three bands, as flat ink strengths
};

// ---- PS1: resolution, colour levels, dither, fog ------------------------------------------------------------
//   ratio   render scale (0.5 = each rendered pixel is 2 screen pixels); levels  colour steps per channel
//   wobble  null = off (the default: the first version, a displacement filter over the whole map canvas, froze the map on a phone).
//           To try again: { scale: pixels the picture is displaced by, fps: how often the noise is re-rolled } (switches itself off on a slow device)
//   crisp   true: map text is hidden in favour of crisp DOM labels (games that supply them); false: map text stays as drawn
export const RETRO = {
  crisp:   { name: 'PS1', ratio: 0.5, smooth: false, levels: 10, dither: 0.12, fog: 0.75, tone: 'contrast(1.12) saturate(1.05)', wobble: null },
  generic: { name: 'PS1', ratio: 0.75, smooth: false, levels: 14, dither: 0.08, fog: 0.5, tone: 'contrast(1.08) saturate(1.05)', wobble: null },
};

// ---- Numbers ---------------------------------------------------------------------------------------------------
export const TUNE = {
  paper: {
    grain: 0.4,              // fibre over the whole sheet
    blots: 0.022,            // soft ink/stock blotches (each of 6 stacked rings)
    inkTexture: 0.9,         // pinholes and flecks over coloured masses
    glow: 0.26,              // dark ink bleed under the main lines
    registration: 0.4,       // blue off-register copy of the main lines
    registrationOffset: [1.6, 1.2],
    plateOpacity: 0.55,      // yellow and blue plates behind coloured masses
    plateOffsetA: [4, 3],
    plateOffsetB: [-3, -3],
    roughenMetres: 55,       // how far hand-pulled edges wander (answer outlines)
    boil: { metres: 16, fps: 4.5, frames: 4 },   // the outline re-drawn by hand a few times a second (animated line boil): how far each drawing differs, how often, how many drawings
    creaseOpacity: 0.3,
    // two-line roads: a blue casing under a core in stock colour (red for the main roads), so blocks read as outlined shapes. Widths in px at three zooms [z, width].
    roads: {
      'road-minor': { core: [[12, 0.4], [15, 3], [17, 9]],  case: [[12, 1], [15, 5.2], [17, 11.2]], fill: 'stock' },
      'road-mid':   { core: [[10, 0.5], [13, 2.6], [17, 11]], case: [[10, 1.2], [13, 4.8], [17, 13.2]], fill: 'stock' },
      'road-major': { core: [[8, 0.6], [12, 2], [16, 8]],    case: [[8, 1.6], [12, 4.2], [16, 10.2]], fill: 'red' },
      'hwy-color':  { core: [[6, 1], [9, 1.8], [12, 3], [16, 10]], case: [[6, 2], [9, 3.2], [12, 5.2], [16, 12.2]], fill: 'red' },
    },
    border: { width: [[8, 2.2], [12, 4.2]], shadow: [2.2, 2.2], shadowOpacity: 0.35 },   // county borders: heavy navy with a hard offset shadow
    swim: { grain: 0.16, blots: 0.07, ink: 0.24 },   // texture swim: how far each texture layer slides against the map as the camera moves (fraction of the camera's screen movement; 0 = locked to the map)
    pinholes: 60,            // pinholes visible on a typical screen (the count over the region is scaled to the region's size)
    blotSize: [0.004, 0.034],// blotch radius as a fraction of the region's diagonal: [smallest, largest]
  },
  ps1: {
    gridStep: 0.05,          // degrees between graticule lines (every fifth is major)
    gridMinor: 0.13,         // graticule opacity
    gridMajor: 0.34,
    bandMetres: 40,          // elevation step of the terrain shading
    outlineWidth: [4, 7],    // answer outline width at zoom 8 and 12
    // base-map lines under PS1: [width px, opacity]. Wide enough to survive the low resolution, soft enough not to shout at state scale
    lines: {
      river: [2.2, 0.95], 'road-minor': [1.1, 0.6], 'road-mid': [1.5, 0.75], 'road-major': [2, 0.85], 'hwy-color': [2.8, 0.95],
      'muni-line': [1.1, 0.45], 'county-line': [1.7, 0.75],
    },
  },
};

// ---- Highlight states of the shared base map (what a quiz is about / right / wrong / the neighbours / you are here) ----
// These are the colours of `muni-hl`, `muni-hl-line` and the focused-road layers, which every game uses through feature-state.
export const HL = {
  ps1:   { cur: '#ffd54a', sel: '#3df5d0', q: '#3df5d0', good: '#4dffb0', bad: '#ff7a5e', near: '#2a7f94' },
  paper: { cur: '#e8603a', sel: '#e8603a', q: '#e8603a', good: '#2e7d46', bad: '#b8321c', near: '#9a9a7a' },
};

// ---- Type -----------------------------------------------------------------------------------------------------
// Paper is set in Gill Sans (the face of mid-century road maps). iOS and macOS ship it, so the first name resolves to the real thing there
// with nothing served from this site; elsewhere the bundled Cabin (SIL OFL, fonts/) stands in. PS1 uses the system monospace.
export const FONT = {
  paper: "'Gill Sans', 'Gill Sans MT', 'Gill Sans Nova', Cabin, 'Trebuchet MS', system-ui, sans-serif",
  ps1: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace",
};
