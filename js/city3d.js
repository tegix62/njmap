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
    // a modern glass tower: a low podium, then a shaft that tapers all the way up and ends in a faceted point
    'One Vanderbilt': { color: '#c5ccd1', tiers: [{ h: 0.1, s: 1, color: '#b3bcc3' }, { h: 0.18, s: 0.8 }, { h: 0.27, s: 0.75 }, { h: 0.36, s: 0.7 }, { h: 0.45, s: 0.66 }, { h: 0.54, s: 0.62 }, { h: 0.63, s: 0.58 }, { h: 0.71, s: 0.54 }, { h: 0.78, s: 0.49 }, { h: 0.84, s: 0.43 }, { h: 0.89, s: 0.36 }, { h: 0.93, s: 0.28 }, { h: 0.965, s: 0.19 }, { h: 1, s: 0.09 }], mast: { m: 22, s: 0.025, color: '#dfe5e9' } },
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

let towersPromise = null;
/** The surveyed towers (data/towers.json, built by tools/build_towers.py from NYC Planning's 2014 3D model), once. */
export function loadSurveyTowers() {
  if (!towersPromise) towersPromise = fetch('data/towers.json').then((r) => r.json()).catch(() => ({ t: [] }));
  return towersPromise;
}
const ringCentre = (ring) => {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
};
const mDist = (a, b) => Math.hypot((a[0] - b[0]) * 84200, (a[1] - b[1]) * 111000);
/**
 * Swap a building for its surveyed shape. For each surveyed tower, the building (in `feats`, from buildingFeatures) that
 * stands in the same place (centre within 45 m) with about the same height (survey within 0.75 to 1.3 times it) is
 * replaced by the survey's stack of slabs; a tower with no such building is left out (it was demolished, or built since
 * and still a block here), and a stylized model standing there is replaced too, keeping its colour.
 */
export function applySurveyTowers(feats, towers) {
  if (!towers || !towers.t || !towers.t.length) return feats;
  const info = feats.map((f) => ({ c: ringCentre(f.geometry.coordinates[0]), h: f.properties.h, model: f.properties.c !== undefined, color: f.properties.c }));
  const drop = new Set(), add = [];
  for (const [lon, lat, H, slabs] of towers.t) {
    let best = -1, bd = 45;
    info.forEach((o, i) => {
      if (drop.has(i)) return;
      const d = mDist(o.c, [lon, lat]);
      if (d < bd && !o.model && H >= o.h * 0.75 && H <= o.h * 1.55) { bd = d; best = i; }
    });
    // (a model's pieces: any piece of one within 45 m, tallest piece at about the height)
    const pieces = [];
    info.forEach((o, i) => { if (o.model && !drop.has(i) && mDist(o.c, [lon, lat]) < 45) pieces.push(i); });
    if (best < 0 && !pieces.length) {
      // nothing like it in the footprint data: add the surveyed tower only where the data has no tall building at all
      // (the MetLife Building is missing from it; a block of 40 m would be)
      let nearMax = 0, covered = false;
      info.forEach((o) => {
        const d = mDist(o.c, [lon, lat]);
        if (d < 150) covered = true; // (this file covers the spot at all: each file only adds towers that stand in it)
        if (d < 45) nearMax = Math.max(nearMax, o.h);
      });
      if (!covered || nearMax >= H * 0.5) continue;
    }
    if (pieces.length) {
      const top = Math.max(...pieces.map((i) => info[i].h));
      if (!(H >= top * 0.75 && H <= top * 1.55)) continue;
    }
    const color = pieces.length ? info[pieces[0]].color : null;
    if (best >= 0) drop.add(best);
    pieces.forEach((i) => drop.add(i));
    const kx = 1 / 84200, ky = 1 / 111000;
    for (const [b, t, flat] of slabs) {
      const ring = [];
      for (let k = 0; k < flat.length; k += 2) ring.push([lon + (flat[k] / 10) * kx, lat + (flat[k + 1] / 10) * ky]);
      ring.push(ring[0]);
      const shade = Math.min(1, t / H);
      add.push({ type: 'Feature', properties: { h: t, b, c: color || (shade > 0.8 ? '#e6dfce' : '#d8d0be') }, geometry: { type: 'Polygon', coordinates: [ring] } });
    }
  }
  return feats.filter((_, i) => !drop.has(i)).concat(add);
}

/** The street surfaces, sidewalks and parks of a data/ground-*.json (tools/extract_ground.py) as polygon features with k = road | walk | park. */
export function groundFeatures(d) {
  const feats = [];
  for (const k of ['walk', 'road', 'park']) {
    for (const flat of d[k] || []) {
      let x = d.o[0], y = d.o[1];
      const ring = [];
      for (let i = 0; i < flat.length; i += 2) {
        x += flat[i];
        y += flat[i + 1];
        ring.push([x / 1e6, y / 1e6]);
      }
      ring.push(ring[0]);
      feats.push({ type: 'Feature', properties: { k }, geometry: { type: 'Polygon', coordinates: [ring] } });
    }
  }
  return feats;
}
export const GROUND_PAINT = {
  walk: { 'fill-color': '#ffffff', 'fill-opacity': 0.38 },
  road: { 'fill-color': '#5a4e3a', 'fill-opacity': 0.17 },
  park: { 'fill-color': '#6fa65a', 'fill-opacity': 0.34 },
};
