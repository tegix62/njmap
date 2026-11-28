// Miniature landmarks: the famous towers' hand-shaped models (city3d.js TOWERS: setbacks, crowns, masts) shrunk evenly as one piece,
// the way strategy games draw famous buildings small but unmistakable. One fixed formula:
//
//   a model whose top is H metres is scaled by k = min(1, a·√H / H), in height and footprint alike, about its own middle.
//   A 443 m tower comes to about 189 m and a third of its width; a 120 m one barely changes; the tallest stays tallest; and because
//   all three directions scale together, its true proportions (the shape that makes it recognisable) are kept exactly.
//
// Only pieces tagged with a model name (property `m`) change; everything else passes through. Pure: features in, new features out.
// (A first try scaled the survey's slab outlines and widened them; on a phone they were unrecognisable. Shape, not size, is what reads.)

export const MINI_DEFAULTS = { a: 9 };

const centre = (ring) => { let x = 0, y = 0; const n = ring.length - 1 || 1; for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; } return [x / n, y / n]; };

/** The miniature version of `features`: every model (pieces sharing a property `m`) scaled evenly by k = min(1, a·√H/H). */
export function miniModels(features, opts = {}) {
  const o = { ...MINI_DEFAULTS, ...opts };
  const groups = new Map();
  for (const f of features) if (f.properties && f.properties.m) { if (!groups.has(f.properties.m)) groups.set(f.properties.m, []); groups.get(f.properties.m).push(f); }
  const done = new Map();
  for (const [name, pieces] of groups) {
    const H = Math.max(...pieces.map((f) => f.properties.h || 0));
    const k = H > 0 ? Math.min(1, (o.a * Math.sqrt(H)) / H) : 1;
    // the middle of the model: the middle of its widest (lowest) piece
    const base = pieces.reduce((a, f) => ((f.properties.b || 0) < (a.properties.b || 0) ? f : a), pieces[0]), c = centre(base.geometry.coordinates[0]);
    for (const f of pieces) done.set(f, { type: 'Feature', geometry: { type: 'Polygon', coordinates: [f.geometry.coordinates[0].map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k])] },
      properties: { ...f.properties, h: f.properties.h * k, b: (f.properties.b || 0) * k, mini: name } });
  }
  return features.map((f) => done.get(f) || f);
}
