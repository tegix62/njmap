// Small geometry helpers. Everything works in [lon, lat] degrees.

const R_MI = 3958.8;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

export function distanceMi([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(a));
}

/** Initial compass bearing (0 = north, 90 = east) from a to b. */
export function bearing([lon1, lat1], [lon2, lat2]) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point reached by travelling `mi` miles from p on compass bearing `deg`. */
export function destination([lon, lat], deg, mi) {
  const d = mi / R_MI;
  const b = toRad(deg);
  const la1 = toRad(lat);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 =
    toRad(lon) +
    Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [toDeg(lo2), toDeg(la2)];
}

const POINTS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const POINTS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const WORDS = {
  N: 'north', NE: 'northeast', E: 'east', SE: 'southeast',
  S: 'south', SW: 'southwest', W: 'west', NW: 'northwest',
  NNE: 'north-northeast', ENE: 'east-northeast', ESE: 'east-southeast', SSE: 'south-southeast',
  SSW: 'south-southwest', WSW: 'west-southwest', WNW: 'west-northwest', NNW: 'north-northwest',
};

export const compass8 = (deg) => POINTS8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
export const compass16 = (deg) => POINTS16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
export const dirWord = (abbr) => WORDS[abbr] || abbr;
export const ARROWS = { N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖' };

/** Smallest signed difference a - b in degrees, in (-180, 180]. */
export function angleDiff(a, b) {
  let d = (((a - b) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

// ---- point in polygon -------------------------------------------------------

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(pt, rings) {
  if (!inRing(pt, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (inRing(pt, rings[k])) return false;
  return true;
}

export function inGeometry(pt, geom) {
  if (geom.type === 'Polygon') return inPolygon(pt, geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some((p) => inPolygon(pt, p));
  return false;
}

export function bbox(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys)
    for (const [x, y] of poly[0]) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return [minX, minY, maxX, maxY];
}

/** Returns a lookup(pt) -> item function over items with {geom, bbox}. */
export function makeLocator(items) {
  let last = null; // most lookups hit the same town as the previous one
  return function locate(pt) {
    if (last && hit(last, pt)) return last;
    for (const it of items) {
      if (hit(it, pt)) return (last = it);
    }
    return null;
  };
  function hit(it, [x, y]) {
    const b = it.bbox;
    return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && inGeometry([x, y], it.geom);
  }
}
