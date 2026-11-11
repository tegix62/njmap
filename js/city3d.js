// Shared by the drive games and Explore: the stepped models of the famous towers, and the building footprints (NYC's
// building data, packed in data/buildings-midtown.json) turned into extrusion features.
export const STONE = '#e4ddcc', STEEL = '#cdd6dd';
const slant = (from, to, n, color) => Array.from({ length: n }, (_, k) => {
    const sy = Math.max(0.08, 1 - (k + 1) / (n + 0.6));
    return { h: from + ((k + 1) * (to - from)) / n, s: [1, sy], c: [0.5, 1 - sy / 2], color };
  });
export const TOWERS = {
    'Empire State Building': { color: STONE, tiers: [{ h: 0.065, s: 1 }, { h: 0.22, s: 0.74 }, { h: 0.57, s: 0.58 }, { h: 0.76, s: 0.47 }, { h: 0.85, s: 0.36 }, { h: 1, s: 0.2, color: '#f0eadc' }], mast: { m: 62, s: 0.035, color: '#b9c0c6' } },
    'Chrysler Building': { color: '#e7e1d4', tiers: [{ h: 0.2, s: 1 }, { h: 0.4, s: 0.82 }, { h: 0.58, s: 0.68 }, { h: 0.7, s: 0.58 }, { h: 0.76, s: 0.5, color: STEEL }, { h: 0.81, s: 0.43, color: STEEL }, { h: 0.86, s: 0.36, color: STEEL }, { h: 0.91, s: 0.28, color: STEEL }, { h: 0.96, s: 0.2, color: STEEL }, { h: 1, s: 0.12, color: STEEL }], mast: { m: 30, s: 0.035, color: STEEL } },
    'GE Building (30 Rock)': { color: '#d9d2c2', tiers: [{ h: 0.22, s: 0.92 }, { h: 0.46, s: 0.8 }, { h: 0.7, s: 0.68 }, { h: 0.88, s: 0.58 }, { h: 1, s: 0.5 }] },
    'Bank of America Tower': { color: '#c4ced4', tiers: [{ h: 0.18, s: 1 }, { h: 0.42, s: 0.88 }, { h: 0.66, s: 0.76 }, { h: 0.84, s: 0.62 }, { h: 1, s: 0.5 }], mast: { m: 95, s: 0.03, color: '#dfe5e9' } },
    'Citigroup Center': { color: '#c9ced1', tiers: [{ h: 0.84, s: 1 }, ...slant(0.84, 1, 8, '#b9bfc3')] },
    'Trump Tower': { color: '#7b8791', tiers: [{ h: 0.3, s: 1 }, { h: 0.45, s: [0.9, 0.8], c: [0.5, 0.45] }, { h: 0.6, s: [0.8, 0.7], c: [0.5, 0.42] }, { h: 0.75, s: [0.7, 0.62], c: [0.5, 0.4] }, { h: 0.9, s: [0.62, 0.52], c: [0.5, 0.38] }, { h: 1, s: [0.5, 0.42], c: [0.5, 0.36] }] },
    '432 Park Avenue': { color: '#f0eee8', tiers: [{ h: 1, s: 1 }] },
    'Hearst Tower': { color: '#7a8a98', tiers: [{ h: 0.2, s: 1, color: '#cdbfa5' }, { h: 1, s: 0.7 }] },
    'New York Times Building': { color: '#cfd4d8', tiers: [{ h: 0.93, s: 1 }, { h: 1, s: 0.78 }], mast: { m: 89, s: 0.03, color: '#dfe5e9' } },
    'One Vanderbilt': { color: '#c7ccd0', tiers: [{ h: 0.16, s: 1 }, { h: 0.38, s: 0.9 }, { h: 0.58, s: 0.78 }, { h: 0.76, s: 0.64 }, { h: 0.9, s: 0.5 }, { h: 1, s: 0.32 }], mast: { m: 20, s: 0.03, color: '#dfe5e9' } },
    'Central Park Tower': { color: '#d3d6d9', tiers: [{ h: 0.46, s: 1 }, { h: 0.62, s: 0.85 }, { h: 0.78, s: 0.78 }, { h: 1, s: 0.72 }] },
    'Waldorf Astoria': { color: '#d8cdb6', tiers: [{ h: 0.45, s: 1 }, { b: 0.45, h: 0.72, s: [0.36, 0.5], c: [0.28, 0.5] }, { b: 0.45, h: 0.72, s: [0.36, 0.5], c: [0.72, 0.5] }, { b: 0.72, h: 1, s: [0.2, 0.3], c: [0.28, 0.5] }, { b: 0.72, h: 1, s: [0.2, 0.3], c: [0.72, 0.5] }] },
    'Time Warner Center': { color: '#aeb9c2', tiers: [{ h: 0.25, s: 1 }, { b: 0.25, h: 1, s: [0.42, 1], c: [0.24, 0.5] }, { b: 0.25, h: 1, s: [0.42, 1], c: [0.76, 0.5] }] },
    'Metropolitan Life Tower': { color: '#e6dfcf', tiers: [{ h: 0.4, s: 1 }, { h: 0.72, s: 0.7 }, { h: 0.9, s: 0.5 }, { h: 1, s: 0.3, color: '#bfd3c6' }] },
    'Seagram Building': { color: '#6e5d4b', tiers: [{ h: 1, s: 1 }] },
    'One World Trade Center': { color: '#b9c7d1', tiers: [{ h: 0.12, s: 1, color: '#9fb0bb' }, { h: 0.45, s: 0.92 }, { h: 0.75, s: 0.82 }, { h: 1, s: 0.7 }], mast: { m: 124, s: 0.03, color: '#dfe5e9' } },
    'Woolworth Building': { color: '#e2dccb', tiers: [{ h: 0.42, s: 1 }, { h: 0.74, s: 0.58 }, { h: 0.88, s: 0.44 }, { h: 0.95, s: 0.34, color: '#8fb3a0' }, { h: 1, s: 0.14, color: '#8fb3a0' }] },
    '8 Spruce Street': { color: '#aab6bf', tiers: [{ h: 0.3, s: 1 }, { h: 0.55, s: 0.92 }, { h: 0.78, s: 0.85 }, { h: 1, s: 0.78 }] },
    'Municipal Building': { color: '#d9ceb8', tiers: [{ h: 0.5, s: 1 }, { h: 0.72, s: 0.6 }, { h: 0.9, s: 0.38 }, { h: 1, s: 0.14, color: '#c9a24a' }] },
  };
  /** A building's outline as the stacked pieces of its model (Polygon features with a height and a base). */
export function towerFeatures(ring, H, model) {
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const bw = x1 - x0, bh = y1 - y0, cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2;
    const poly = (r) => ({ type: 'Polygon', coordinates: [[...r, r[0]]] });
    const piece = (sx, sy, c, base, top, color) => ({
      type: 'Feature',
      properties: { h: top, b: base, c: color },
      geometry: poly(ring.map(([x, y]) => [x0 + c[0] * bw + (x - cx0) * sx, y0 + c[1] * bh + (y - cy0) * sy])),
    });
    const out = [];
    let prev = 0;
    for (const t of model.tiers) {
      const [sx, sy] = Array.isArray(t.s) ? t.s : [t.s, t.s];
      const base = (t.b != null ? t.b : prev) * H;
      out.push(piece(sx, sy, t.c || [0.5, 0.5], base, t.h * H, t.color || model.color));
      if (t.b == null) prev = t.h;
    }
    if (model.mast) out.push(piece(model.mast.s, model.mast.s, [0.5, 0.5], H, H + model.mast.m, model.mast.color));
    return out;
  }

/** Decode data/buildings-midtown.json into GeoJSON features ({h: roof metres, lm: 1 where a landmark stands, or a model's pieces}). */
export function buildingFeatures(d) {
  const feats = [];
  for (const b of d.b) {
    const ring = [];
    let x = 0, y = 0;
    for (let i = 2; i < b.length; i += 2) {
      x += b[i];
      y += b[i + 1];
      ring.push([d.o[0] + x / d.s, d.o[1] + y / d.s]);
    }
    const model = b[1] >= 2 && d.m ? TOWERS[d.m[b[1] - 2]] : null;
    if (model) {
      feats.push(...towerFeatures(ring, b[0], model));
      continue;
    }
    ring.push(ring[0]);
    feats.push({ type: 'Feature', properties: { h: b[0], lm: b[1] ? 1 : 0 }, geometry: { type: 'Polygon', coordinates: [ring] } });
  }
  return feats;
}
