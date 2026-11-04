// Major roads, read from the OpenFreeMap tiles already loaded for the
// background map (OpenStreetMap data, OpenMapTiles schema).
import { bearing, compass8, angleDiff } from './geo.js';
import { ROAD_NOTES } from './knowledge.js';

const MAJOR = ['motorway', 'trunk', 'primary'];
const NAMED_REFS = {
  NJTP: 'Turnpike',
  GSP: 'Parkway',
  ACE: 'AC Expressway',
  PIP: 'Palisades Pkwy',
};

/**
 * OSM route refs ("I 80", "US 1;US 9", "NJ 23", "I 95;NJTP") -> a short label
 * ("I-80", "US 1/9", "Rt 23", "Turnpike"). County routes and unknown refs -> null.
 */
export function normRef(raw) {
  if (!raw) return null;
  const parts = [];
  for (const p of String(raw).split(/\s*;\s*/)) {
    let m;
    if (NAMED_REFS[p]) parts.push(NAMED_REFS[p]);
    else if ((m = p.match(/^I[ -]?(\d+)$/))) parts.push(`I-${m[1]}`);
    else if ((m = p.match(/^US[ -]?(\d+\w?)$/))) parts.push(`US ${m[1]}`);
    else if ((m = p.match(/^NJ[ -]?(\d+\w?)$/))) parts.push(`Rt ${m[1]}`);
  }
  if (!parts.length) return null;
  // The Turnpike is also I-95 in places: call it the Turnpike.
  if (parts.includes('Turnpike')) return 'Turnpike';
  const us = parts.filter((p) => p.startsWith('US '));
  if (us.length > 1 && us.length === parts.length) return 'US ' + us.map((p) => p.slice(3)).join('/');
  return [...new Set(parts)].join(' / ');
}

/** Draft note for a road, by name first ("Pulaski Skyway"), then each part of its label. */
export function draftNote(label, name) {
  if (name && ROAD_NOTES[name]) return ROAD_NOTES[name];
  if (!label) return null;
  if (ROAD_NOTES[label]) return ROAD_NOTES[label];
  for (const part of label.split(' / ')) if (ROAD_NOTES[part]) return ROAD_NOTES[part];
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
    const label = normRef(props.ref) || (props.class === 'motorway' && props.name) || null;
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
    const label = normRef(props.ref) || (props.class === 'motorway' && props.name) || null;
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
