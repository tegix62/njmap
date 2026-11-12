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
  for (let i = 0; i < count; i++) {
    const cx = w + r() * (e - w), cy = s + r() * (n - s);
    const R = 1 + Math.pow(r(), 2) * 8;               // km: mostly small, a few large
    const warm = r() < 0.86;
    const phase = r() * 6.28, wob = 0.18 + r() * 0.2, squash = 0.6 + r() * 0.6;
    for (let ring = 0; ring < 6; ring++) {
      const rr = R * (1 - ring * 0.14);
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
export function specks([[w, s], [e, n]], count = TUNE.paper.pinholes, seed = 3) {
  const r = rng(seed), out = [];
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
export function roughen(geom, amp = TUNE.paper.roughenMetres) {
  const rough = (coords) => {
    const out = [];
    for (let i = 0; i < coords.length; i++) {
      const p = coords[i];
      if (i > 0) {
        const q = coords[i - 1], k = km(p[1]);
        const dm = Math.hypot((p[0] - q[0]) / k.lng, (p[1] - q[1]) / k.lat) * 1000;
        const n = Math.min(60, Math.floor(dm / 140));
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
    return [p[0] + (a * amp * k.lng) / 1000, p[1] + (b * amp * k.lat) / 1000];
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
