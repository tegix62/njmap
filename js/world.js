import { TUNE } from './looks.config.js';

// Texture that belongs to the map, not the screen.
//
// A grain, crease or grid laid over the screen stays put while the map moves under it, which reads as a filter. Everything
// here is generated as geographic features over a region's bounds (seeded, so it is the same every time), so it pans,
// turns, tilts and drapes over the terrain together with the land it sits on.

/** Small seeded random generator (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fc = (features) => ({ type: 'FeatureCollection', features });
const km = (lat) => ({ lat: 1 / 111.2, lng: 1 / (111.2 * Math.cos((lat * Math.PI) / 180)) });

/** Soft ink and stock blotches: each a few stacked, uneven rings, so the edge is a gradient. [[w,s],[e,n]] bounds. */
export function blots([[w, s], [e, n]], count = 120, seed = 7) {
  const r = rng(seed), out = [];
  const k = km((s + n) / 2);
  const diag = Math.hypot((e - w) / k.lng, (n - s) / k.lat);               // km: sizes are fractions of the region, so a small region is not swamped
  const [rmin, rmax] = TUNE.paper.blotSize;
  for (let i = 0; i < count; i++) {
    const cx = w + r() * (e - w), cy = s + r() * (n - s);
    const R = diag * (rmin + Math.pow(r(), 2) * (rmax - rmin));               // km: mostly small, a few large
    const warm = r() < 0.86;
    const phase = r() * 6.28, wob = 0.18 + r() * 0.2, squash = 0.6 + r() * 0.6;
    for (let ring = 0; ring < 9; ring++) {
      const rr = R * (1 - ring * 0.1);
      const pts = [];
      for (let a = 0; a <= 16; a++) {
        const t = (a % 16) / 16 * 6.283;
        const rad = rr * (1 + wob * Math.sin(t * 3 + phase) + 0.08 * Math.sin(t * 7 + phase * 2));
        pts.push([cx + Math.cos(t) * rad * k.lng * squash, cy + Math.sin(t) * rad * k.lat]);
      }
      out.push({ type: 'Feature', properties: { w: warm ? 1 : 0 }, geometry: { type: 'Polygon', coordinates: [pts] } });
    }
  }
  return fc(out);
}

/** Pinholes: scattered points over the region. */
export function specks([[w, s], [e, n]], perScreen = TUNE.paper.pinholes, seed = 3) {
  const r = rng(seed), out = [];
  // `perScreen` specks on a typical screen, where a screen is about an eighth of the region across
  const k = km((s + n) / 2), wk = (e - w) / k.lng, hk = (n - s) / k.lat, diag = Math.hypot(wk, hk);
  const screenKm2 = Math.pow(diag / 8, 2) * 1.5;
  const count = Math.min(9000, Math.round((perScreen * wk * hk) / screenKm2));
  for (let i = 0; i < count; i++)
    out.push({ type: 'Feature', properties: { s: r() }, geometry: { type: 'Point', coordinates: [w + r() * (e - w), s + r() * (n - s)] } });
  return fc(out);
}

/** Fold creases of a road map: two across and one down, drawn as a pair (a dark line, a pale one beside it). */
export function creases([[w, s], [e, n]]) {
  const sub = (a, b, steps = 120) => Array.from({ length: steps + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps]);   // (many vertices: a line drapes on terrain only at its vertices)
  const pad = 0.15, out = [];
  for (const f of [1 / 3, 2 / 3]) out.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: sub([w + (e - w) * f, s - pad], [w + (e - w) * f, n + pad]) } });
  out.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: sub([w - pad, s + (n - s) / 2], [e + pad, s + (n - s) / 2]) } });
  return fc(out);
}

/** A graticule: a line every `step` degrees, every fifth one major. Segments are short so the lines follow the terrain. */
export function graticule([[w, s], [e, n]], step = 0.05) {
  const out = [], seg = 0.008;
  const i0 = Math.floor(w / step), i1 = Math.ceil(e / step), j0 = Math.floor(s / step), j1 = Math.ceil(n / step);
  const major = (i) => (i % 5 === 0 ? 1 : 0);
  for (let i = i0; i <= i1; i++) {
    const x = i * step, c = [];
    for (let y = j0 * step; y <= j1 * step + 1e-9; y += seg) c.push([x, y]);
    out.push({ type: 'Feature', properties: { m: major(i) }, geometry: { type: 'LineString', coordinates: c } });
  }
  for (let j = j0; j <= j1; j++) {
    const y = j * step, c = [];
    for (let x = i0 * step; x <= i1 * step + 1e-9; x += seg) c.push([x, y]);
    out.push({ type: 'Feature', properties: { m: major(j) }, geometry: { type: 'LineString', coordinates: c } });
  }
  return fc(out);
}

/** A tile of fine paper fibre (short strokes and flecks, mostly transparent), for a fill-pattern. */
export function grainImage(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rng(11);
  g.lineCap = 'round';
  for (let i = 0; i < size * 1.6; i++) {
    const x = r() * size, y = r() * size, a = r() * 6.283, L = 2 + r() * 6;
    g.strokeStyle = `rgba(${96 + (r() * 30) | 0},${74 + (r() * 24) | 0},${34 + (r() * 20) | 0},${(0.06 + r() * 0.1).toFixed(2)})`;
    g.lineWidth = 0.5 + r() * 0.7;
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {   // (wrapped, so the tile repeats without a seam)
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.lineTo(x + dx + Math.cos(a) * L, y + dy + Math.sin(a) * L);
      g.stroke();
    }
  }
  return g.getImageData(0, 0, size, size);
}

// value noise in geographic space (smooth, the same everywhere for the same place)
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Hand-pulled edges: every line and ring is cut into short pieces and each point pushed sideways by noise that depends only on where it is
 * on the Earth (so the wobble is part of the land and does not swim as the map moves). amp in metres.
 */
export function roughen(geom, amp = TUNE.paper.roughenMetres, phase = -1, step = 140) {
  const rough = (coords) => {
    const out = [];
    for (let i = 0; i < coords.length; i++) {
      const p = coords[i];
      if (i > 0) {
        const q = coords[i - 1], k = km(p[1]);
        const dm = Math.hypot((p[0] - q[0]) / k.lng, (p[1] - q[1]) / k.lat) * 1000;
        const n = Math.min(60, Math.floor(dm / step));
        for (let s = 1; s <= n; s++) out.push(shift([q[0] + ((p[0] - q[0]) * s) / (n + 1), q[1] + ((p[1] - q[1]) * s) / (n + 1)]));
      }
      out.push(shift(p));
    }
    return out;
  };
  const shift = (p) => {
    const k = km(p[1]);
    const fx = p[0] * 900, fy = p[1] * 900;                              // ~120 m features
    const a = (vnoise(fx, fy) - 0.5) + 0.5 * (vnoise(fx * 3.1 + 9, fy * 3.1 + 4) - 0.5);
    const b = (vnoise(fx + 31, fy - 17) - 0.5) + 0.5 * (vnoise(fx * 3.1 - 5, fy * 3.1 + 12) - 0.5);
    let dx = a * amp, dy = b * amp;
    if (phase >= 0) {                                                    // 'boil': each phase is a slightly different hand-drawing of the same line
      const bm = TUNE.paper.boil.metres;
      dx += (vnoise(fx * 2.3 + phase * 7.7, fy * 2.3 - phase * 3.1) - 0.5) * 2 * bm;
      dy += (vnoise(fx * 2.3 - phase * 5.3, fy * 2.3 + phase * 9.1) - 0.5) * 2 * bm;
    }
    return [p[0] + (dx * k.lng) / 1000, p[1] + (dy * k.lat) / 1000];
  };
  const walk = (c, depth) => (depth === 0 ? rough(c) : c.map((x) => walk(x, depth - 1)));
  const depth = { Point: -1, LineString: 0, MultiPoint: -1, Polygon: 1, MultiLineString: 1, MultiPolygon: 2 }[geom.type];
  if (depth === undefined || depth < 0) return geom;
  const out = { ...geom, coordinates: walk(geom.coordinates, depth) };
  if (geom.bands) out.bands = geom.bands.map((r) => rough(r));
  return out;
}

/** A tile of ink texture for the coloured masses: bare-stock pinholes and darker flecks, so the flat colour looks printed. */
export function inkImage(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rng(29);
  const dot = (x, y, rad, col) => {
    g.fillStyle = col;
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) { g.beginPath(); g.arc(x + dx, y + dy, rad, 0, 6.283); g.fill(); }
  };
  for (let i = 0; i < 170; i++) dot(r() * size, r() * size, 0.5 + r() * 1.2, `rgba(246,241,201,${(0.35 + r() * 0.4).toFixed(2)})`);
  for (let i = 0; i < 70; i++) dot(r() * size, r() * size, 0.6 + r() * 1.4, `rgba(29,42,91,${(0.1 + r() * 0.16).toFixed(2)})`);
  return g.getImageData(0, 0, size, size);
}

/** A small tilt (degrees) for a piece of lettering, the same every time for the same text: hand-set type is never quite square. */
export function tilt(text, max = 1.3) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (((h >>> 0) % 2001) / 1000 - 1) * max;
}

/** PS1 vertex snapping: every vertex of a shape pulled to a coarse grid (a faceted, low-polygon outline); with a seed, some vertices flip
 *  to a neighbouring grid point, which when the seed advances makes the outline shimmer the way PS1 polygons did. */
export function snapGeom(geom, step = 0.0012, seed = -1) {
  const snap = (p) => {
    let x = Math.round(p[0] / step), y = Math.round(p[1] / step);
    if (seed >= 0) {
      const h = hash2(x * 0.37 + seed * 1.3, y * 0.61 - seed * 0.7);
      if (h > 0.72) x += h > 0.86 ? 1 : -1;
      else if (h < 0.18) y += h < 0.09 ? 1 : -1;
    }
    return [x * step, y * step];
  };
  const dedupe = (c) => c.filter((p, i) => i === 0 || p[0] !== c[i - 1][0] || p[1] !== c[i - 1][1]);
  const walk = (c, d) => (d === 0 ? dedupe(c.map(snap)) : c.map((x) => walk(x, d - 1)));
  const depth = { Point: -1, LineString: 0, Polygon: 1, MultiLineString: 1, MultiPolygon: 2 }[geom.type];
  if (depth === undefined || depth < 0) return geom;
  const out = { ...geom, coordinates: walk(geom.coordinates, depth) };
  if (geom.bands) out.bands = geom.bands.map((r) => dedupe(r.map(snap)));
  return out;
}

/**
 * An ink stroke as a texture for a map line's `line-pattern`: the image is stretched across the line's width, so the roughness scales with
 * the line. Ragged edges (the ink spread unevenly into the stock), uneven density along the stroke, pinholes where the ink missed, and a few
 * specks of spatter beside it. `gaps` makes a dashed stroke; `holes` 0 gives a clean one (for the stock-coloured core of a two-line road, whose
 * ragged edge lets the blue casing show through unevenly). Periodic along its length, so repeats do not show a seam.
 */
export function inkStroke(color, { gaps = false, holes = 1, seed = 5, W = 154, H = 20, edge = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(seed);
  const periodic = (k, ph) => Math.sin((k / W) * 6.283 * 3 + ph) + 0.6 * Math.sin((k / W) * 6.283 * 7 + ph * 2.3) + 0.3 * Math.sin((k / W) * 6.283 * 14 + ph * 0.7);
  const p1 = r() * 6, p2 = r() * 6, p3 = r() * 6;
  g.fillStyle = color;
  for (let x = 0; x < W; x++) {
    if (gaps && x % 22 >= 14) continue;                                           // dashes: 14 on, 8 off
    const top = (1.2 + 1.3 * (periodic(x, p1) + 1.9) / 3.8 * 2.2) * edge;          // ragged edges
    const bot = (1.2 + 1.3 * (periodic(x, p2) + 1.9) / 3.8 * 2.2) * edge;
    const a = 0.86 + 0.14 * (periodic(x, p3) + 1.9) / 3.8;                       // density along the stroke
    g.globalAlpha = a;
    g.fillRect(x, top, 1, H - top - bot);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-out';                                 // pinholes
  for (let i = 0; i < 26 * holes; i++) {
    const x = r() * W, y = 3 + r() * (H - 6), rad = 0.5 + r() * 1.1;
    g.globalAlpha = 0.5 + r() * 0.5;
    g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
  }
  g.globalCompositeOperation = 'source-over';                                     // spatter
  g.fillStyle = color;
  if (holes) for (let i = 0; i < 14; i++) {
    const x = r() * W, y = r() < 0.5 ? r() * 2 : H - r() * 2;
    g.globalAlpha = 0.35 + r() * 0.4;
    g.beginPath(); g.arc(x, y, 0.4 + r() * 0.6, 0, 6.283); g.fill();
  }
  return g.getImageData(0, 0, W, H);
}
