// Major roads, read from the OpenFreeMap tiles already loaded for the
// background map (OpenStreetMap data, OpenMapTiles schema).
import { bearing, compass8, angleDiff } from './geo.js';
import { labelOf } from './roadlabel.js';

const MAJOR = ['motorway', 'trunk', 'primary'];
export { normRef, countyNum, labelOf } from './roadlabel.js';

/** Draft note for a road, by name first ("Pulaski Skyway"), then each part of its label. */
export function draftNote(label, name, notes) {
  if (name && notes[name]) return notes[name];
  if (!label) return null;
  if (notes[label]) return notes[label];
  for (const part of label.split(' / ')) {
    if (notes[part]) return notes[part];
    // "Route 1&9" -> try "Route 1", then "Route 9"
    const m = part.match(/^Route (.+)$/);
    if (m) for (const n of m[1].split('&')) if (notes[`Route ${n}`]) return notes[`Route ${n}`];
  }
  return null;
}

function majorFeatures(map) {
  if (!map.getSource('omt')) return [];
  try {
    return map.querySourceFeatures('omt', {
      sourceLayer: 'transportation_name',
      filter: ['match', ['get', 'class'], MAJOR, true, false],
    });
  } catch {
    return [];
  }
}

function lines(geom) {
  if (geom.type === 'LineString') return [geom.coordinates];
  if (geom.type === 'MultiLineString') return geom.coordinates;
  return [];
}

/** Nearest point on segment a-b to p, in a local flat projection (miles). */
function nearestOnSegment(p, a, b, kx, ky) {
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, y = ay + t * dy;
  return { d: Math.hypot(x, y), pt: [p[0] + x / kx, p[1] + y / ky] };
}

/**
 * Major roads near `pt`, nearest first:
 * [{label, name, raw:[refs], d (mi), dir (compass8 from you), pt, segBearing}]
 */
export function nearbyRoads(map, pt, maxMi = 3, limit = 3) {
  const ky = 69.05;
  const kx = 69.17 * Math.cos((pt[1] * Math.PI) / 180);
  const best = new Map();
  for (const f of majorFeatures(map)) {
    const props = f.properties || {};
    const label = labelOf(props);
    if (!label) continue;
    for (const line of lines(f.geometry)) {
      for (let i = 1; i < line.length; i++) {
        const r = nearestOnSegment(pt, line[i - 1], line[i], kx, ky);
        const cur = best.get(label);
        if (!cur || r.d < cur.d) {
          best.set(label, {
            label,
            name: props.name || '',
            raw: new Set(cur ? cur.raw : []).add(props.ref),
            d: r.d,
            pt: r.pt,
            segBearing: bearing(line[i - 1], line[i]),
          });
        } else cur.raw.add(props.ref);
      }
    }
  }
  return [...best.values()]
    .filter((r) => r.d <= maxMi)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((r) => ({ ...r, raw: [...r.raw].filter(Boolean), dir: compass8(bearing(pt, r.pt)) }));
}

/**
 * Every named road near you, for Drive's "which road am I on": local streets too, not only the main roads. Reading all the loaded tiles every second
 * would be slow, so the nearby road segments (within ~2 km) are copied into a small list that is rebuilt when you have moved a quarter of a mile or
 * every 20 s (and when the map has loaded more tiles); the per-second question then scans only that list.
 */
const SKIP_CLASS = new Set(['service', 'track', 'path', 'pedestrian', 'footway', 'cycleway', 'steps', 'bridleway', 'raceway']);
export function createRoadIndex() {
  let center = null, built = 0, segs = [], tiles = 0;
  return {
    update(map, pt) {
      const now = performance.now();
      if (center && now - built < 20000 && Math.hypot(pt[0] - center[0], pt[1] - center[1]) < 0.004 && segs.length) return;
      if (!map.getSource('omt')) return;
      let fs = [];
      try { fs = map.querySourceFeatures('omt', { sourceLayer: 'transportation_name' }); } catch { return; }
      const near = (p) => Math.abs(p[0] - pt[0]) < 0.03 && Math.abs(p[1] - pt[1]) < 0.025;
      const out = [];
      for (const f of fs) {
        const p = f.properties || {};
        if (SKIP_CLASS.has(p.class)) continue;
        const label = labelOf(p) || p.name || null;
        if (!label) continue;
        for (const line of lines(f.geometry)) for (let i = 1; i < line.length; i++) if (near(line[i - 1]) || near(line[i])) out.push({ a: line[i - 1], b: line[i], label, name: p.name || '', cls: p.class });
      }
      segs = out;
      center = pt;
      built = now;
    },
    get size() { return segs.length; },
    /** The nearest named road within maxMi: { label, name, cls, d (mi), segBearing } or null. */
    nearest(pt, maxMi = 0.03) {
      const ky = 69.05, kx = 69.17 * Math.cos((pt[1] * Math.PI) / 180);
      let best = null;
      for (const s of segs) {
        const q = nearestOnSegment(pt, s.a, s.b, kx, ky);
        if (q.d <= maxMi && (!best || q.d < best.d)) best = { label: s.label, name: s.name, cls: s.cls, d: q.d, segBearing: bearing(s.a, s.b) };
      }
      return best;
    },
  };
}

/** Direction of travel the way highway signs say it: "I-80 W". */
export function travelDir(heading) {
  return ['N', 'E', 'S', 'W'][Math.round((((heading % 360) + 360) % 360) / 90) % 4];
}

/** True when `heading` runs along the road segment (either way). */
export function alongRoad(heading, segBearing, tol = 30) {
  const d = Math.abs(angleDiff(heading, segBearing));
  return d <= tol || d >= 180 - tol;
}

/** Major roads with any vertex inside municipality `m`, longest stretch first. */
export function roadsInTown(map, m, locate) {
  const hits = new Map();
  for (const f of majorFeatures(map)) {
    const props = f.properties || {};
    const label = labelOf(props);
    if (!label) continue;
    // Sample along each segment (~150 m apart): a straight highway can cross a
    // whole town without a single vertex inside it.
    let n = 0;
    const [x0, y0, x1, y1] = m.bbox;
    for (const line of lines(f.geometry))
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        if (Math.max(a[0], b[0]) < x0 || Math.min(a[0], b[0]) > x1 || Math.max(a[1], b[1]) < y0 || Math.min(a[1], b[1]) > y1) continue;
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.0015));
        for (let k = 0; k <= steps; k++) {
          const c = [a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps];
          if (c[0] >= x0 && c[0] <= x1 && c[1] >= y0 && c[1] <= y1 && locate(c) === m) n++;
        }
      }
    if (!n) continue;
    const h = hits.get(label) || { label, name: props.name || '', raw: new Set(), n: 0 };
    h.n += n;
    h.raw.add(props.ref);
    if (!h.name && props.name) h.name = props.name;
    hits.set(label, h);
  }
  return [...hits.values()].sort((a, b) => b.n - a.n).map((h) => ({ ...h, raw: [...h.raw].filter(Boolean) }));
}

/**
 * Samples every major road in the loaded tiles every ~150 m and records which
 * town each sample falls in. Done once, then any town can be asked about
 * cheaply (roadsThrough).
 */
export function sampleRoads(map, locate) {
  const roads = new Map();
  for (const f of majorFeatures(map)) {
    const props = f.properties || {};
    const label = labelOf(props);
    if (!label) continue;
    const r = roads.get(label) || { label, name: props.name || '', raw: new Set(), towns: new Set() };
    r.raw.add(props.ref);
    if (!r.name && props.name) r.name = props.name;
    for (const line of lines(f.geometry))
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.0015));
        for (let k = 0; k <= steps; k++) {
          const t = locate([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]);
          if (t) r.towns.add(t);
        }
      }
    roads.set(label, r);
  }
  return [...roads.values()];
}

/**
 * Roads as connectors: the sampled roads that pass through town `m`, and the
 * towns each leads to within `maxMi`: [{label, name, raw, towns:[{m, d, dir}]}]
 */
export function roadsThrough(samples, m, maxMi = 12) {
  const kx = 69.17 * Math.cos((m.pt[1] * Math.PI) / 180);
  const ky = 69.05;
  return samples
    .filter((r) => r.towns.has(m))
    .map((r) => ({
      label: r.label,
      name: r.name,
      raw: [...r.raw].filter(Boolean),
      towns: [...r.towns]
        .filter((t) => t !== m)
        .map((t) => ({ m: t, d: Math.hypot((t.pt[0] - m.pt[0]) * kx, (t.pt[1] - m.pt[1]) * ky), dir: compass8(bearing(m.pt, t.pt)) }))
        .filter((t) => t.d <= maxMi)
        .sort((x, y) => x.d - y.d),
    }))
    .filter((r) => r.towns.length)
    .sort((x, y) => y.towns.length - x.towns.length);
}

/** Convenience: roads through `m` from the tiles loaded right now. */
export function roadsFrom(map, m, locate, maxMi = 12) {
  return roadsThrough(sampleRoads(map, locate), m, maxMi);
}
