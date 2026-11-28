// Miniature landmarks: turn a city's extruded buildings into a readable board, the way strategy games draw famous buildings
// small but unmistakable. One fixed formula, the same everywhere it is used, so the look is predictable:
//
//   • A landmark is gathered from its pieces (features with a colour `c`: tiers, crown, mast) and scaled as one unit.
//     Its new roof is a·√H (never above its true height), so the tallest stays tallest but a 440 m tower comes down to about
//     190 m; every tier keeps its share of the roof, so setbacks, crowns and spires keep their proportions.
//   • As it shrinks, its footprint widens by 1/√k (at most 1.6×, about the landmark's middle), so it reads as a stout miniature
//     rather than a squashed one. Thin pieces (spires, masts) widen twice as much again, so they stay visible.
//   • Ordinary buildings (no colour) above `cap` metres keep only a fifth of the height above it, so the landmarks stand clear.
//   • Each landmark stands on a low ground tile a little wider than itself.
//
// Pure: features in, new features out (the input is not changed). Used by the Manhattan drive games; anything else that draws
// the city3d features (Explore, orbit) can use it the same way.

export const MINI_DEFAULTS = { a: 9, maxWiden: 1.6, spire: 8, spireBoost: 2, cap: 45, keep: 0.2, link: 60, tileH: 2, tilePad: 12, tileColor: '#eadcb2' };

const KX = 84200, KY = 111000; // metres per degree (lon, lat) around New York
const ringOf = (f) => f.geometry.coordinates[0];
const centre = (ring) => { let x = 0, y = 0; const n = ring.length - 1 || 1; for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; } return [x / n, y / n]; };
const halfSize = (ring) => { const xs = ring.map((p) => p[0] * KX), ys = ring.map((p) => p[1] * KY); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2; };
const metres = (a, b) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY);
const scaled = (ring, c, w) => ring.map(([x, y]) => [c[0] + (x - c[0]) * w, c[1] + (y - c[1]) * w]);

/** The miniature version of `features` (GeoJSON Polygon features with h, optional b, optional c). See the notes above. */
export function miniaturize(features, opts = {}) {
  const o = { ...MINI_DEFAULTS, ...opts };
  const lm = [], out = [];
  for (const f of features) (f.properties && f.properties.c !== undefined && f.properties.mini !== 'tile' ? lm : out).push(f);
  // ordinary buildings: held low above the cap
  const low = (h) => (h == null || h <= o.cap ? h : o.cap + (h - o.cap) * o.keep);
  const result = out.map((f) => ({ ...f, properties: { ...f.properties, h: low(f.properties.h), ...(f.properties.b != null ? { b: low(f.properties.b) } : {}) } }));
  // landmarks: group pieces standing within `link` metres of each other (single linkage)
  const cs = lm.map((f) => centre(ringOf(f))), parent = lm.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < lm.length; i++) for (let j = i + 1; j < lm.length; j++) if (metres(cs[i], cs[j]) < o.link) parent[find(i)] = find(j);
  const groups = new Map();
  lm.forEach((f, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  let g = 0;
  for (const idx of groups.values()) {
    const H = Math.max(...idx.map((i) => lm[i].properties.h || 0));
    const k = H > 0 ? Math.min(1, (o.a * Math.sqrt(H)) / H) : 1;
    const w = Math.max(1, Math.min(o.maxWiden, 1 / Math.sqrt(k)));
    const mid = centre([...idx.map((i) => cs[i]), cs[idx[0]]]);
    let reach = 0;
    for (const i of idx) {
      const f = lm[i], ring = ringOf(f), hs = halfSize(ring);
      let r = scaled(ring, mid, w);
      if (hs * 2 < o.spire) { const c2 = centre(r); r = scaled(r, c2, o.spireBoost); }
      reach = Math.max(reach, metres(mid, centre(r)) + halfSize(r));
      result.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [r] }, properties: { ...f.properties, h: f.properties.h * k, b: (f.properties.b || 0) * k, mini: 'piece', g } });
    }
    // the ground tile: a hexagon a little wider than the landmark
    const R = reach + o.tilePad, hex = Array.from({ length: 7 }, (_, n) => { const t = (Math.PI / 3) * (n % 6) + Math.PI / 6; return [mid[0] + (R * Math.cos(t)) / KX, mid[1] + (R * Math.sin(t)) / KY]; });
    result.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [hex] }, properties: { h: o.tileH, b: 0, c: o.tileColor, mini: 'tile', g } });
    g++;
  }
  return result;
}
