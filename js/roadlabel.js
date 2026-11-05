// What people call a road, worked out from the map tiles' road attributes.
// One set of rules in two forms: labelOf() for the app's own code and
// LABEL_EXPR for the map style, so the map, Drive, Explore and the quiz always
// agree ("I-287", "Route 202", "Route 1&9", "Turnpike", "Columbia Turnpike").
//
// The tiles (OpenMapTiles schema) give a road that belongs to a numbered route
// its route number alone plus a network: ref "287" + network "us-interstate",
// ref "202" + network "us-highway", ref "24" + network "us-state". Concurrent
// routes are listed as route_1_network/route_1_ref, route_2_… Roads in no
// such network keep the way's own ref ("CR 510", "GSP", "NJTP;I 95", "I 80").

const NAMED = [
  // [label, text in the road's name, its own ref]
  ['Turnpike', 'New Jersey Turnpike', 'NJTP'],
  ['Parkway', 'Garden State Parkway', 'GSP'],
  ['AC Expressway', 'Atlantic City Expressway', 'ACE'],
  ['Palisades Pkwy', 'Palisades Interstate Parkway', 'PIP'],
];
const ROUTE_NETWORKS = ['us-highway', 'us-state'];
const ROUTE_PREFIX = ['US', 'NJ', 'NY', 'PA'];

/** A way's own ref ("I 80", "US 1;US 9", "NJ 23", "I 95;NJTP") -> label, or null. */
export function normRef(raw) {
  if (!raw) return null;
  const parts = [];
  for (const p of String(raw).split(/\s*;\s*/)) {
    let m;
    const named = NAMED.find(([, , ref]) => ref === p);
    if (named) parts.push(named[0]);
    else if ((m = p.match(/^I[ -]?(\d+)$/))) parts.push(`I-${m[1]}`);
    // People say "Route 46" for US 46 and "Route 23" for NJ 23, so both read that way
    else if ((m = p.match(/^(US|NJ|NY|PA)[ -]?(\d+\w?)$/))) parts.push(`Route ${m[2]}`);
  }
  if (!parts.length) return null;
  // The Turnpike is also I-95 in places: call it the Turnpike.
  if (parts.includes('Turnpike')) return 'Turnpike';
  // "Route 1&9" for roads carrying two routes
  const uniq = [...new Set(parts)];
  const rt = uniq.filter((p) => p.startsWith('Route '));
  if (rt.length > 1 && rt.length === uniq.length) return 'Route ' + rt.map((p) => p.slice(6)).join('&');
  return uniq.join(' / ');
}

/** The county route number in a way's ref ("CR 510" -> "510"), or null. */
export function countyNum(raw) {
  for (const p of String(raw || '').split(/\s*;\s*/)) {
    const m = p.match(/^CR[ -]?(\d+\w?)$/);
    if (m) return m[1];
  }
  return null;
}

/** Tile road properties -> the label people use, or null. Mirrors LABEL_EXPR. */
export function labelOf(p) {
  const name = p.name || '';
  const ref = p.ref || '';
  for (const [label, inName, ownRef] of NAMED) if (name.includes(inName) || ref.split(/\s*;\s*/).includes(ownRef)) return label;
  if (ref && p.network === 'us-interstate') return `I-${ref}`;
  if (p.route_1_network === 'US:US' && p.route_2_network === 'US:US' && p.route_2_ref && p.route_1_ref !== p.route_2_ref)
    return `Route ${p.route_1_ref}&${p.route_2_ref}`;
  if (ref && ROUTE_NETWORKS.includes(p.network)) return `Route ${ref}`;
  // county routes go by their street name: "Columbia Turnpike", not "CR 510"
  return normRef(ref) || (countyNum(ref) && name) || (p.class === 'motorway' && name) || null;
}

// ---- the same rules as a map style expression -------------------------------
const g = (k) => ['coalesce', ['get', k], ''];
const refHas = (s) => ['>=', ['index-of', s, g('ref')], 0];
const isRoutePrefix = (v) => ['in', ['slice', v, 0, 3], ['literal', ROUTE_PREFIX.map((x) => x + ' ')]];
// one way-ref part: "I 80" -> "I-80", "US 46" -> "Route 46", "CR 510" -> its name
const refWord = (v) => [
  'case',
  ['==', ['slice', v, 0, 2], 'I '], ['concat', 'I-', ['slice', v, 2]],
  isRoutePrefix(v), ['concat', 'Route ', ['slice', v, 3]],
  ['all', ['==', ['slice', v, 0, 3], 'CR '], ['has', 'name']], ['get', 'name'],
  v,
];
// a way's own ref, possibly two routes: "US 1;US 9" -> "Route 1&9"
const OWN_REF = [
  'let', 'r', g('ref'),
  ['let', 'i', ['index-of', ';', ['var', 'r']],
    ['case',
      ['<', ['var', 'i'], 0], refWord(['var', 'r']),
      ['let', 'a', ['slice', ['var', 'r'], 0, ['var', 'i']], 'b', ['slice', ['var', 'r'], ['+', ['var', 'i'], 1]],
        ['case',
          ['all', isRoutePrefix(['var', 'a']), isRoutePrefix(['var', 'b']), ['<', ['index-of', ';', ['var', 'b']], 0]],
          ['concat', 'Route ', ['slice', ['var', 'a'], 3], '&', ['slice', ['var', 'b'], 3]],
          refWord(['var', 'a'])]]]],
];
export const LABEL_EXPR = [
  'case',
  ...NAMED.flatMap(([label, inName, ownRef]) => [['any', ['in', inName, g('name')], refHas(ownRef)], label]),
  ['all', ['==', g('network'), 'us-interstate'], ['!=', g('ref'), '']], ['concat', 'I-', g('ref')],
  ['all', ['==', g('route_1_network'), 'US:US'], ['==', g('route_2_network'), 'US:US'], ['!=', g('route_2_ref'), ''], ['!=', g('route_1_ref'), g('route_2_ref')]],
  ['concat', 'Route ', g('route_1_ref'), '&', g('route_2_ref')],
  ['all', ['in', g('network'), ['literal', ROUTE_NETWORKS]], ['!=', g('ref'), '']], ['concat', 'Route ', g('ref')],
  ['!=', g('ref'), ''], OWN_REF,
  ['==', g('class'), 'motorway'], g('name'),
  '',
];
