// Manhattan's street grid: directions the way New Yorkers say them, and the
// nearest intersection from the street names in the map tiles.
import { angleDiff } from './geo.js';

/**
 * Heading -> grid direction. The avenues run ~29° east of true north, so
 * "uptown" is roughly NNE; crosstown streets run WNW–ESE.
 */
export function gridDir(heading, angle) {
  const r = (((heading - angle) % 360) + 360) % 360;
  return ['uptown', 'crosstown east', 'downtown', 'crosstown west'][Math.round(r / 90) % 4];
}

/** What lies off to a side, in grid terms: "uptown", "the East Side"… */
export function gridSide(heading, angle) {
  const d = gridDir(heading, angle);
  return { uptown: 'uptown', downtown: 'downtown', 'crosstown east': 'East Side', 'crosstown west': 'West Side' }[d];
}

/** Distance along the grid, in miles from 59th St & 5th Ave (bigger = farther uptown). */
export function gridY(pt, angle) {
  const kx = 69.17 * Math.cos((40.77 * Math.PI) / 180);
  const x = (pt[0] + 73.973) * kx;
  const y = (pt[1] - 40.7644) * 69.05;
  const a = (angle * Math.PI) / 180;
  return x * Math.sin(a) + y * Math.cos(a);
}

/** True when the heading is within `tol` degrees of the uptown/downtown axis. */
export const alongAvenues = (heading, angle, tol = 25) => {
  const d = Math.abs(angleDiff(heading, angle));
  return d <= tol || d >= 180 - tol;
};

// ---- nearest intersection ------------------------------------------------------

const AVENUE_RE =
  /\b(Avenue|Broadway|Bowery|Park Row|Central Park (West|South)|West End|Riverside Drive|Frederick Douglass|Adam Clayton Powell|Malcolm X|Saint Nicholas|St\.? Nicholas|Fort Washington|Edgecombe|Lenox|Amsterdam|Columbus|Lexington|Madison|Avenue of the Americas)\b/i;
const STREET_RE = /\b(Street|Place)\b/i;

const ABBR = [
  [/\bAvenue of the Americas\b/i, '6th Ave'],
  [/\bAvenue\b/g, 'Ave'],
  [/\bStreet\b/g, 'St'],
  [/\bPlace\b/g, 'Pl'],
  [/^West /, 'W '],
  [/^East /, 'E '],
  [/^North /, 'N '],
  [/^South /, 'S '],
];
export function shortStreet(name) {
  let n = name;
  for (const [re, to] of ABBR) n = n.replace(re, to);
  return n;
}

/** Shortest distance (mi) from pt to a polyline, in a local flat projection. */
function nearestOn(coords, pt) {
  const ky = 69.05;
  const kx = 69.17 * Math.cos((pt[1] * Math.PI) / 180);
  let best = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const ax = (coords[i - 1][0] - pt[0]) * kx, ay = (coords[i - 1][1] - pt[1]) * ky;
    const bx = (coords[i][0] - pt[0]) * kx, by = (coords[i][1] - pt[1]) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) best = d;
  }
  return best;
}

/** "9th Ave & W 40th St" (or one of the two, or null) from loaded tiles. */
export function intersection(map, pt) {
  if (!map.getSource('omt')) return null;
  let feats = [];
  try {
    feats = map.querySourceFeatures('omt', { sourceLayer: 'transportation_name' });
  } catch {
    return null;
  }
  let ave = null;
  let st = null;
  for (const f of feats) {
    const name = f.properties && f.properties.name;
    if (!name) continue;
    const isAve = AVENUE_RE.test(name);
    const isSt = !isAve && STREET_RE.test(name);
    if (!isAve && !isSt) continue;
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
    for (const line of lines) {
      const d = nearestOn(line, pt);
      if (d > 0.12) continue;
      if (isAve && (!ave || d < ave.d)) ave = { name, d };
      if (isSt && (!st || d < st.d)) st = { name, d };
    }
  }
  if (!ave && !st) return null;
  return [ave, st].filter(Boolean).map((x) => shortStreet(x.name)).join(' & ');
}
