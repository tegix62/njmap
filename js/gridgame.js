/* global maplibregl */
// Drive Manhattan: the real street network, every street from the Battery to
// Inwood with its legal direction (NYC's street centerline, built into
// data/manhattan-streets.json by tools/build_streets.py). The map is turned
// so Midtown's grid stands upright (uptown at the top); downtown streets run
// at their real angles.
//
// The data is a graph of real intersections (the two roadbeds of a divided
// road, median crossings and kinks merged into one corner at build time) and
// the links between them. Your car drives on its own. At an ordinary corner,
// Left / Straight / Right; where the ways out don't fit those (five-way
// junctions, forks, angled streets), each way out is its own button, with its
// street name and an arrow at its real angle. Speed changes smoothly: it eases
// up the longer you keep going straight, and brakes along a steady curve before
// a corner where you turn; long stretches (bridges, tunnels, highways) take at
// most LEG_MAX_S. Tap a corner ahead to zip to it; hold the map to speed up.
// Links follow the road itself; the car crosses each corner in a straight line
// from where one road ends to where the next begins.
// Wrong-way turns are refused with the reason: the rule of thumb when the
// street follows it ("odd streets go west"), the exception by name when it
// doesn't. Rounds can start inside a tunnel or on a bridge coming in, and
// end once you're on the destination's road heading toward it. At the end the
// map shows your route next to the shortest legal one.

import { framesStats } from './frames.js';

const DATA_URL = 'data/manhattan-streets.json';
const CHECK_EVERY_MS = 35000; // a check-in at most this often
const START_HOLD_MS = 2600; // the car waits this long on the start card (a tap or a turn starts it sooner)
const GRID = 29; // the grid is turned ~29° clockwise from north
const ZOOM = 15.7; // driving zoom
const PACE = { easy: 1, normal: 1.35, fast: 1.9 }; // speed multipliers
const SPEED = 105; // metres per second of game time at Easy (a long crosstown block in ~2 s)
const GOTO_SPEED = 5.5; // multipliers: heading to a tapped corner,
const HOLD_SPEED = 3; // holding the map,
const HOME_SPEED = 14; // and on the home stretch
const CRUISE_STEP = 0.12; // each corner passed straight on without input adds this to the speed multiplier,
const CRUISE_MAX = 1.8; // up to this
const LONG_M = 250; // a stretch longer than this with no corner (bridge, tunnel, highway)...
const LEG_MAX_S = 2.5; // ...takes at most this long
const TURN_V = 0.6; // speed through a corner where you turn, or have to choose (x the base speed)
const BRAKE = 8; // braking, in base speeds per second: a steady slowdown, not a jolt
const EASE_UP_S = 0.8; // speeding up eases in over about this long
const AVENUE_RULE = {
  '1st Ave': 'U', '2nd Ave': 'D', '3rd Ave': 'U', 'Lexington Ave': 'D', 'Madison Ave': 'U', '5th Ave': 'D',
  '6th Ave': 'U', '7th Ave': 'D', '8th Ave': 'U', '9th Ave': 'D', '10th Ave': 'U', 'Amsterdam Ave': 'U', 'Columbus Ave': 'D',
};
const TWO_WAY_STREETS = new Set([14, 23, 34, 42, 57, 72, 79, 86, 96, 106, 110, 116, 125, 135, 145, 155]);
const WORD = { U: 'uptown', D: 'downtown', E: 'east', W: 'west' };
const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
// avenues that follow the grid (uptown / downtown means something on them)
const GRID_AVES = new Set([...Object.keys(AVENUE_RULE), 'Park Ave', 'Park Ave S', '11th Ave', '12th Ave (West Side Hwy)', 'York Ave', 'East End Ave',
  'West End Ave', 'Central Park West', 'Adam Clayton Powell Jr Blvd', 'Frederick Douglass Blvd', 'Malcolm X Blvd (Lenox Ave)', 'Avenue A', 'Avenue B', 'Avenue C', 'Avenue D']);
const AREAS = { all: 'All of Manhattan', downtown: 'Downtown (below 14th)', midtown: 'Midtown (14th–59th)', uptown: 'Uptown (59th–110th)', upper: 'Upper Manhattan (above 110th)' };

// ---- geometry helpers ------------------------------------------------------------
const rad = (d) => (d * Math.PI) / 180;
function metres(a, b) {
  const kx = 111320 * Math.cos(rad((a[1] + b[1]) / 2));
  return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 110540);
}
function bearing(a, b) {
  const kx = Math.cos(rad((a[1] + b[1]) / 2));
  return ((Math.atan2((b[0] - a[0]) * kx, b[1] - a[1]) * 180) / Math.PI + 360) % 360;
}
const angleDiff = (to, from) => ((to - from + 540) % 360) - 180; // + = clockwise (right)
/** Grid direction of a compass bearing: U(ptown), E(ast), D(owntown), W(est). */
function gridDir(b) {
  const r = (b - GRID + 360) % 360;
  return r < 45 || r >= 315 ? 'U' : r < 135 ? 'E' : r < 225 ? 'D' : 'W';
}
/** How far a bearing is from the grid's axes (0 = along an avenue or a street). */
function offGrid(b) {
  const r = ((((b - GRID) % 90) + 90) % 90);
  return Math.min(r, 90 - r);
}
const compassWord = (b) => COMPASS[Math.round((((b % 360) + 360) % 360) / 45) % 8];
// an arrow pointing up, rotated to point the way
const DIR_SVG = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 1.5 L16.5 17 L10 13 L3.5 17 Z" fill="currentColor"/></svg>';
/** Position across / up the grid, metres (for areas). */
function gridXY(p) {
  const x = (p[0] + 73.97) * 111320 * Math.cos(rad(40.78)), y = (p[1] - 40.78) * 110540;
  const a = rad(GRID);
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

export function initGridGame(ctx) {
  const { map } = ctx;
  let G = null; // the street graph, once loaded
  let g = null; // the running round
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  // mapFirst: a look at the start and destination before driving (off by default:
  // working out where the address is is the useful part).
  // from: 'both' (half the rounds start at a tunnel or bridge), 'entries', 'anywhere'
  // checkins: now and then the car pauses and asks which side the Hudson (or uptown) is
  const prefs = { pace: 'easy', arrows: false, mapFirst: false, area: 'all', from: 'both', optsOpen: false, checkins: true, ...ctx.store.get('gridPrefs', {}) };
  const fstats = framesStats(ctx.store);
  if (!AREAS[prefs.area]) prefs.area = 'all';
  const savePrefs = () => ctx.store.set('gridPrefs', prefs);
  const rounds = () => ctx.store.get('gridRuns', { n: 0 }).n; // finished rounds, for first-time help

  // ---- the graph -------------------------------------------------------------------
  async function load() {
    if (G) return G;
    const d = await fetch(DATA_URL).then((r) => r.json());
    const [ox, oy] = d.origin;
    const nodes = []; // junctions (real intersections)
    for (let i = 0; i < d.junctions.length; i += 2) nodes.push([ox + d.junctions[i] / d.scale, oy + d.junctions[i + 1] / d.scale]);
    const geo = d.geoms.map((flat) => {
      const pts = [];
      let x = 0, y = 0;
      for (let i = 0; i < flat.length; i += 2) {
        x += flat[i];
        y += flat[i + 1];
        pts.push([ox + x / d.scale, oy + y / d.scale]);
      }
      return pts;
    });
    const feeders = new Set(d.feeders);
    const out = nodes.map(() => []);
    const inn = nodes.map(() => []);
    // links between corners, directed; a two-way block is two links sharing a shape
    const ways = new Map();
    const edges = d.links.map(([from, to, nid, gi, b0, b1], id) => {
      const p = gi >= 0 ? geo[gi] : [...geo[~gi]].reverse();
      const cum = [0];
      for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + metres(p[i - 1], p[i]));
      const len = cum[cum.length - 1] || 1;
      const shape = gi >= 0 ? gi : ~gi;
      ways.set(shape, (ways.get(shape) || 0) + 1);
      const e = {
        id, from, to, pts: p, cum, len, shape, name: d.names[nid], core: !feeders.has(id),
        // the road's direction leaving / reaching its corners, over ~30 m of the road
        // itself (from the build: the same numbers its button layout used)
        b0,
        b1,
      };
      out[from].push(e);
      inn[to].push(e);
      return e;
    });
    for (const e of edges) e.oneway = ways.get(e.shape) === 1;
    // the ways on from the end of each link, with the button each gets (from the build)
    d.turns.forEach((t, i) => {
      const opts = [];
      for (let j = 0; j < t.length; j += 2) opts.push({ o: edges[t[j]], slot: ' LSRnN'[t[j + 1]] });
      edges[i].opts = opts;
    });
    const coreJ = new Set(edges.filter((e) => e.core).map((e) => e.from));
    const RAMP = /entrance|exit|\bramp|\bRp\b|Bridge|Tunnel|Expwy|\bEp\b|\bEn\b|\bEt\b/i;
    const HWY = /Drive|\bDr\b|\bDrv\b|Hwy|Pkwy|Expwy|FDR/i;
    const label = (n) => {
      const names = [];
      for (const e of [...out[n], ...inn[n]]) if (!names.includes(e.name)) names.push(e.name);
      const streets = names.filter((x) => !RAMP.test(x));
      return (streets.length >= 2 ? streets : names).slice(0, 2).join(' & ');
    };
    // an ordinary street corner: no highway or ramp meets here (for random starts and destinations)
    const plain = (n) => [...out[n], ...inn[n]].every((e) => !RAMP.test(e.name) && !HWY.test(e.name));
    const real = (n) => d.jdeg[n] >= 3; // three or more roads meet: a corner you could turn at
    const gy = nodes.map((p) => gridXY(p)[1]);
    G = { d, nodes, edges, out, inn, coreJ, real, label, plain, gy, RAMP, places: d.places, entries: d.entries, areas: d.areas };
    buildArrows();
    return G;
  }

  /**
   * The ways on from the end of link e. Simple corner: {left, straight, right}.
   * Named corner (the ways out don't fit those): every option is its own button;
   * dflt is the way that carries on along the same road, if any.
   */
  const choiceCache = new Map();
  function choices(e) {
    if (choiceCache.has(e.id)) return choiceCache.get(e.id);
    const c = { options: e.opts.map((x) => x.o), decision: e.opts.length >= 2, named: e.opts.some((x) => x.slot === 'n' || x.slot === 'N') };
    c.left = c.straight = c.right = c.dflt = null;
    for (const { o, slot } of e.opts) {
      if (slot === 'L') c.left = o;
      else if (slot === 'S') c.straight = o;
      else if (slot === 'R') c.right = o;
      else if (slot === 'N') c.dflt = o;
    }
    if (!c.named) c.dflt = c.straight;
    c.only = e.opts.length === 1 ? e.opts[0].o : null;
    choiceCache.set(e.id, c);
    return c;
  }
  /** The moves you can make from the end of link e (every way on has a button). */
  const moves = (e) => choices(e).options;
  /** At a named corner, the way out nearest a left (or right) turn, for the arrow keys. */
  function sideOption(e, side) {
    const sgn = side === 'L' ? -1 : 1;
    return choices(e).options
      .map((o) => ({ o, d: angleDiff(o.b0, e.b1) }))
      .filter((x) => x.d * sgn > 20)
      .sort((a, b) => Math.abs(a.d - sgn * 90) - Math.abs(b.d - sgn * 90))[0]?.o || null;
  }
  /** Turn angle from link e onto link o (+ = right). */
  const turnOf = (e, o) => angleDiff(o.b0, e.b1);

  // ---- rules of thumb ------------------------------------------------------------------
  const streetNum = (name) => {
    const m = /^[EW] (\d+)(st|nd|rd|th) St$/.exec(name);
    return m ? +m[1] : null;
  };
  /** The rule of thumb for this road, as a grid direction ('E'|'W'|'U'|'D'|'two') or null. */
  function rule(name) {
    const n = streetNum(name);
    if (n != null) return TWO_WAY_STREETS.has(n) ? 'two' : n % 2 ? 'W' : 'E';
    return AVENUE_RULE[name] || null;
  }
  const ruleText = (name) => {
    const n = streetNum(name);
    if (n != null) return n % 2 ? 'odd streets go west' : 'even streets go east';
    return 'avenues alternate';
  };
  const short = (name) => name.replace(/^[EW] (\d+\w\w) St$/, '$1 St');
  /** On a grid street or avenue running along the grid (or any road lined up with it):
   *  uptown / downtown / east / west mean something. */
  const gridRoad = (name) => streetNum(name) != null || GRID_AVES.has(name);
  const onGrid = (name, b) => (gridRoad(name) && offGrid(b) <= 25) || offGrid(b) <= 10;
  /** The way you're heading, in words that are true here: grid words on the grid, the compass elsewhere. */
  const headWord = (name, b) => (onGrid(name, b) ? WORD[gridDir(b)] : compassWord(b));
  /** Refusal text for a one-way road d (an edge that runs toward the corner we're at). */
  function wrongWay(d) {
    const dir = gridDir(d.b1); // the way traffic flows on it
    const r = rule(d.name);
    const nm = short(d.name);
    if (r && r === dir) return `${nm} runs ${WORD[dir]} (${ruleText(d.name)})`;
    if (r) return `${nm} runs ${WORD[dir]} here (exception)`;
    return `${nm} is one-way ${WORD[dir]}`;
  }
  /** A heads-up when driving onto a block that breaks the rule. */
  function exceptionNote(e) {
    const r = rule(e.name);
    if (!r || r === 'two') return null;
    const dir = gridDir(e.b0);
    const isAve = !!AVENUE_RULE[e.name];
    if (!e.oneway) return `Exception: ${short(e.name)} is two-way here`;
    if (dir !== r && (isAve ? dir === 'U' || dir === 'D' : dir === 'E' || dir === 'W'))
      return `Exception: ${short(e.name)} runs ${WORD[dir]} here`;
    return null;
  }

  // ---- map layers -------------------------------------------------------------------------
  let arrowsFC = null;
  function buildArrows() {
    // one-way blocks as lines drawn the way traffic flows; exceptions flagged
    const feats = [];
    for (const e of G.edges) {
      if (!e.oneway) continue;
      feats.push({ type: 'Feature', properties: { name: e.name, exc: exceptionNote(e) ? 1 : 0 }, geometry: { type: 'LineString', coordinates: e.pts } });
    }
    arrowsFC = { type: 'FeatureCollection', features: feats };
  }
  const EMPTY = { type: 'FeatureCollection', features: [] };
  /** A chevron pointing along the line (+x), as a map image: the font the map ships
   *  has only basic Latin, so a '›' text arrow drew nothing. */
  function chevron(color) {
    const r = 2, w = 20, h = 20;
    const c = document.createElement('canvas');
    c.width = w * r;
    c.height = h * r;
    const x = c.getContext('2d');
    x.scale(r, r);
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(6, 4);
    x.lineTo(14, 10);
    x.lineTo(6, 16);
    x.strokeStyle = '#ffffff';
    x.lineWidth = 6;
    x.stroke();
    x.strokeStyle = color;
    x.lineWidth = 3;
    x.stroke();
    return { img: x.getImageData(0, 0, w * r, h * r), opts: { pixelRatio: r } };
  }
  function ensureLayers() {
    for (const [id, col] of [['gg-chev', '#1f1b16'], ['gg-chev-exc', '#c47a00']]) {
      if (!map.hasImage(id)) {
        const { img, opts } = chevron(col);
        map.addImage(id, img, opts);
      }
    }
    if (map.getSource('gg-trail')) return;
    map.addSource('gg-trail', { type: 'geojson', data: EMPTY });
    map.addSource('gg-best', { type: 'geojson', data: EMPTY });
    map.addSource('gg-arrows', { type: 'geojson', data: arrowsFC || EMPTY });
    map.addSource('gg-target', { type: 'geojson', data: EMPTY });
    map.addSource('gg-goto', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'gg-best', type: 'line', source: 'gg-best', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#15803d', 'line-width': 4.5, 'line-dasharray': [2, 1.5] } });
    map.addLayer({ id: 'gg-trail', type: 'line', source: 'gg-trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2b4fb3', 'line-width': 6, 'line-opacity': 0.55 } });
    map.addLayer({
      id: 'gg-arrows', type: 'symbol', source: 'gg-arrows',
      layout: {
        'symbol-placement': 'line', 'symbol-spacing': 60,
        'icon-image': ['case', ['==', ['get', 'exc'], 1], 'gg-chev-exc', 'gg-chev'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.7, 16, 1],
        'icon-rotation-alignment': 'map', 'icon-keep-upright': false,
        'icon-allow-overlap': true, 'icon-ignore-placement': true, visibility: 'none',
      },
    });
    map.addLayer({ id: 'gg-goto', type: 'circle', source: 'gg-goto', paint: { 'circle-radius': 13, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#2b4fb3', 'circle-stroke-width': 3 } });
    map.addLayer({ id: 'gg-target', type: 'circle', source: 'gg-target', paint: { 'circle-radius': 9, 'circle-color': '#b91c1c', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
    map.addLayer({
      id: 'gg-target-label', type: 'symbol', source: 'gg-target',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 15, 'text-anchor': 'left', 'text-offset': [1, 0], 'text-allow-overlap': true },
      paint: { 'text-color': '#b91c1c', 'text-halo-color': '#ffffff', 'text-halo-width': 2.2 },
    });
  }
  const setData = (id, fc) => map.getSource(id)?.setData(fc);
  const line = (coords) => ({ type: 'FeatureCollection', features: coords.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [] });
  const point = (p, props = {}) => ({ type: 'FeatureCollection', features: p ? [{ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: p } }] : [] });
  let flashTimer = 0;
  function showArrows(name = null) {
    if (!map.getLayer('gg-arrows')) return;
    clearTimeout(flashTimer);
    if (!name) {
      map.setFilter('gg-arrows', null);
      map.setLayoutProperty('gg-arrows', 'visibility', prefs.arrows ? 'visible' : 'none');
      return;
    }
    // flash the arrows of one street after a wrong-way try
    map.setFilter('gg-arrows', ['==', ['get', 'name'], name]);
    map.setLayoutProperty('gg-arrows', 'visibility', 'visible');
    flashTimer = setTimeout(() => showArrows(), 2600);
  }

  // ---- the car --------------------------------------------------------------------------
  const carEl = document.createElement('div');
  carEl.className = 'gg-carmk';
  carEl.innerHTML =
    '<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><path d="M20 3 L31 33 L20 26 L9 33 Z" fill="#2b4fb3" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<circle class="blink L" cx="7" cy="14" r="4"/><circle class="blink R" cx="33" cy="14" r="4"/></svg>';
  const carMk = new maplibregl.Marker({ element: carEl, rotationAlignment: 'map', pitchAlignment: 'map' });
  // off-screen pointer to the destination
  const offEl = document.createElement('div');
  offEl.className = 'gg-off';
  offEl.innerHTML = DIR_SVG;
  offEl.hidden = true;
  document.body.appendChild(offEl);

  /** Screen direction (degrees, 0 = up) and straight-line metres from the car to the destination. */
  function aim() {
    const c = map.project(g.pos), t = map.project(G.nodes[g.target.node]);
    return { c, t, ang: (Math.atan2(t.x - c.x, -(t.y - c.y)) * 180) / Math.PI, m: metres(g.pos, G.nodes[g.target.node]) };
  }
  /** The arrow and distance in the top card, kept current every frame. */
  function updateDir(a) {
    const el = document.querySelector('#hud .gg-dir');
    if (!el) return;
    el.firstChild.style.transform = `rotate(${a.ang}deg)`;
    const mi = a.m / 1609.34;
    const txt = mi < 0.1 ? '<0.1 mi' : `${mi.toFixed(1)} mi`;
    const d = el.nextElementSibling;
    if (d && d.textContent !== txt) d.textContent = txt;
  }

  function posOnEdge(e, s) {
    s = Math.max(0, Math.min(e.len, s));
    let i = 1;
    while (i < e.cum.length - 1 && e.cum[i] < s) i++;
    const a = e.pts[i - 1], b = e.pts[i];
    const t = (s - e.cum[i - 1]) / (e.cum[i] - e.cum[i - 1] || 1);
    return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], b: bearing(a, b) };
  }

  // While driving, only streets: neighborhood outlines read as roads that go
  // nowhere, so they (and other overlays) are hidden for the round.
  const CLUTTER = ['muni-fill', 'muni-hl', 'muni-line', 'county-line', 'muni-hl-line', 'county-label', 'region-label',
    'landmark-dot', 'landmark-label', 'nature-dot', 'nature-label', 'anchor-dot', 'anchor-label', 'section-label', 'section-label-local', 'trip-line', 'qline'];
  let hidden = null;
  function declutter(on) {
    if (on && !hidden) {
      hidden = {};
      for (const id of CLUTTER) {
        if (!map.getLayer(id)) continue;
        hidden[id] = map.getLayoutProperty(id, 'visibility') || 'visible';
        map.setLayoutProperty(id, 'visibility', 'none');
      }
    } else if (!on && hidden) {
      for (const [id, v] of Object.entries(hidden)) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
      hidden = null;
    }
  }

  function lockMap(lock) {
    for (const h of ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate']) {
      if (lock) map[h].disable();
      else map[h].enable();
    }
  }

  // ---- picking a round -----------------------------------------------------------------------
  function inArea(n) {
    const a = prefs.area;
    if (a === 'all') return true;
    const y = G.gy[n], A = G.areas;
    if (a === 'downtown') return y < A['14'];
    if (a === 'midtown') return y >= A['14'] - 150 && y <= A['59'] + 150;
    if (a === 'uptown') return y >= A['59'] - 150 && y <= A['110'] + 150;
    return y > A['110'];
  }
  const isCore = (n) => G.coreJ.has(n);
  /** Shortest legal route (moves the buttons can make, no U-turns) from edge e0, s metres along it, to node t. */
  function shortest(e0, t, s = 0) {
    const c0 = e0.len - s;
    const dist = new Map([[e0.id, c0]]);
    const prev = new Map();
    const heap = new Heap();
    heap.push({ e: e0, c: c0 });
    while (heap.size) {
      const { e, c } = heap.pop();
      if (c > dist.get(e.id)) continue;
      if (e.to === t) {
        const path = [e];
        let k = e.id;
        while (prev.has(k)) {
          const p = prev.get(k);
          path.unshift(p);
          k = p.id;
        }
        return { cost: c, path };
      }
      for (const o of moves(e)) {
        const nc = c + o.len;
        if (nc < (dist.get(o.id) ?? Infinity)) {
          dist.set(o.id, nc);
          prev.set(o.id, e);
          heap.push({ e: o, c: nc });
        }
      }
    }
    return null;
  }
  /** Following the road on (straight, or where it carries on at a named corner) from the end of link e: the corners ahead. */
  function aheadChain(e, maxNodes = 80, maxM = 6000) {
    const outN = [];
    let cur = e, m = 0;
    const seen = new Set();
    for (let i = 0; i < maxNodes && m < maxM; i++) {
      outN.push({ node: cur.to, via: cur });
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      const c = choices(cur);
      const nx = c.decision ? c.dflt : c.only;
      if (!nx) break;
      m += nx.len;
      cur = nx;
    }
    return outN;
  }
  /** Is node t straight ahead on this road from link e (no turns)? */
  function straightTo(e, t) {
    return aheadChain(e, 120, 8000).some((x) => x.node === t);
  }
  /**
   * Where a round from a tunnel or bridge starts: on the way in, ~300 m before
   * it reaches the city's streets (not out in the middle of the river).
   */
  const ENTRY_LEAD_M = 300;
  function entryStart(entry) {
    // the lane in, up to the first corner where there's a choice to make
    const chain = [];
    let e = G.edges[entry.link];
    for (let i = 0; i < 100 && e; i++) {
      chain.push(e);
      const c = choices(e);
      if (c.decision || !c.only) break;
      e = c.only;
    }
    let left = 0;
    for (let i = chain.length - 1; i >= 0; i--) {
      if (left + chain[i].len >= ENTRY_LEAD_M) return { e: chain[i], s: chain[i].len - (ENTRY_LEAD_M - left) };
      left += chain[i].len;
    }
    return { e: chain[0], s: 0 };
  }
  function pickRound() {
    const coreNodes = [];
    for (let n = 0; n < G.nodes.length; n++) if (isCore(n) && G.real(n) && G.plain(n) && inArea(n)) coreNodes.push(n);
    const places = G.places.filter((p) => inArea(p.node));
    const entries = G.entries.filter((en) => inArea(en.landsAt));
    const useEntry = entries.length && (prefs.from === 'entries' || (prefs.from === 'both' && Math.random() < 0.5));
    for (let tries = 0; tries < 300; tries++) {
      const target = places.length && Math.random() < 0.7 ? { ...rand(places) } : { name: null, node: rand(coreNodes) };
      target.label = G.label(target.node);
      let e0, s0 = 0, entry = null;
      if (useEntry) {
        entry = rand(entries);
        ({ e: e0, s: s0 } = entryStart(entry));
      } else {
        const n = rand(coreNodes);
        const outs = G.out[n].filter((o) => o.core);
        if (!outs.length) continue;
        e0 = rand(outs);
      }
      const dm = metres(G.nodes[e0.from], G.nodes[target.node]);
      if (dm < 500 || dm > (entry ? 7000 : 3500)) continue;
      if (straightTo(e0, target.node)) continue; // already on the right road
      const best = shortest(e0, target.node, s0);
      if (!best || best.path.length < 4) continue;
      return { e0, s0, target, best, entry };
    }
    return null;
  }

  // ---- a round ---------------------------------------------------------------------------
  async function start(opts) {
    stop();
    g = { opts, loading: true };
    const token = g;
    render();
    try {
      await load();
    } catch {
      if (g === token) ctx.hud('<div class="qkind">🚕 Drive Manhattan</div><div class="q">Couldn’t load the street map.</div>');
      return;
    }
    if (g !== token) return;
    const r = pickRound();
    if (!r) {
      ctx.hud('<div class="qkind">🚕 Drive Manhattan</div><div class="q">No route found here; try another area.</div>');
      return;
    }
    ensureLayers();
    lockMap(true);
    declutter(true);
    document.body.classList.add('gridding');
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    map.setGlobalStateProperty('quiet', false);
    g = {
      opts, target: r.target, best: r.best, entry: r.entry,
      e: r.e0, s: r.s0, // on link e, s metres along
      waiting: false, queued: null, pick: null, goTo: null, gotoV: 0, home: false, boost: false, paused: false, done: false,
      cruise: 0, zoom: ZOOM,
      driven: -r.s0, wrong: 0, trail: [posOnEdge(r.e0, r.s0).p], msg: '', msgAt: 0, lastNote: null,
      last: performance.now(), raf: 0, view: prefs.mapFirst && ctx.dur(1) ? 'intro' : 'follow',
      check: null, lastCheck: performance.now() - CHECK_EVERY_MS / 2, checks: 0, checksRight: 0, resumeAt: 0,
      startCard: true,
    };
    g.resumeAt = Infinity; // set on the first frame drawn, so a slow page load doesn't eat the card
    g.targetHood = hood(G.nodes[r.target.node]);
    const tp = G.nodes[r.target.node];
    setData('gg-target', point(tp, { name: r.target.name || r.target.label }));
    setData('gg-trail', EMPTY);
    setData('gg-best', EMPTY);
    setData('gg-goto', EMPTY);
    showArrows();
    carMk.setLngLat(g.trail[0]).addTo(map);
    enterEdge(g.e);
    g.msg = '';
    render();
    if (g.view === 'intro') {
      ctx.fit([g.trail[0], tp], 15, { bearing: GRID, duration: 700 });
      setTimeout(() => {
        if (g && g.view === 'intro') g.view = 'follow';
      }, 1700);
    } else map.jumpTo({ center: g.trail[0], zoom: ZOOM, bearing: GRID });
    g.raf = requestAnimationFrame(tick);
    window.addEventListener('keydown', onKey);
  }

  function stop() {
    if (!g) return;
    cancelAnimationFrame(g.raf);
    window.removeEventListener('keydown', onKey);
    g = null;
    carMk.remove();
    offEl.hidden = true;
    lockMap(false);
    declutter(false);
    document.body.classList.remove('gridding');
    for (const id of ['gg-trail', 'gg-best', 'gg-target', 'gg-goto']) setData(id, EMPTY);
    if (map.getLayer('gg-arrows')) map.setLayoutProperty('gg-arrows', 'visibility', 'none');
    map.setGlobalStateProperty('quiet', ctx.mode === 'practice');
  }

  const onKey = (e) => {
    if (!g || g.done || g.loading) return;
    if (e.key === 'ArrowLeft') press('L');
    else if (e.key === 'ArrowRight') press('R');
    else if (e.key === 'ArrowUp') press('S');
    else if (e.key === ' ') togglePause();
  };

  /** Starting along edge e: a note if it breaks the rule, and the home-stretch check. */
  function enterEdge(e) {
    const note = exceptionNote(e);
    if (note && note !== g.lastNote) {
      g.msg = `ℹ ${note}`;
      g.msgAt = performance.now();
    }
    g.lastNote = note;
    if (!g.home && e.core && homeStretch(e)) {
      g.home = true;
      g.goTo = null;
      g.queued = null;
      setData('gg-goto', EMPTY);
      g.msg = `✓ Right road: straight there`;
      g.msgAt = performance.now();
    }
  }

  /** On the destination's road, heading to it, and that's also the shortest way: the rest drives itself. */
  function homeStretch(e) {
    let m = 0;
    for (const { node, via } of aheadChain(e, 120, 8000)) {
      if (via !== e) m += via.len;
      if (node === g.target.node) {
        const r = shortest(e, g.target.node, 0);
        return !!r && e.len + m <= r.cost + 1;
      }
    }
    return false;
  }

  // ---- where you are, in words ------------------------------------------------------------
  /** "Chelsea (Midtown)" for a point, from the neighborhood map. */
  function hood(p) {
    const m = ctx.locate(p);
    return m ? `${m.n}${m.c && m.c !== m.n ? ` (${m.c})` : ''}` : null;
  }
  /** The cross street at the end of edge e (the next corner), if it's a real intersection. */
  function crossAt(e) {
    const names = [];
    for (const o of [...G.out[e.to], ...G.inn[e.to]]) if (o.name !== e.name && !names.includes(o.name)) names.push(o.name);
    const nm = names.find((x) => !G.RAMP.test(x)) || names[0]; // a street, not a ramp, if there is one
    return nm ? short(nm) : null;
  }
  /** The next real intersection ahead on this road, and its cross street. */
  function nextCross(e) {
    for (const { node, via } of aheadChain(e, 12, 2500)) if (G.real(node)) return crossAt(via);
    return null;
  }
  /** Which way the Hudson (west) is, relative to heading h. */
  function hudsonSide(h) {
    const order = ['U', 'E', 'D', 'W'];
    return ['ahead of you', 'on your right', 'behind you', 'on your left'][(order.indexOf('W') - order.indexOf(h) + 4) % 4];
  }
  /** The start card: where you are, which way you face, what's next. */
  function startCard() {
    const h = gridDir(g.e.b0);
    if (g.entry) {
      const out = hood(G.nodes[g.entry.landsAt]);
      return `From <b>${esc(g.entry.from.replace(/^the /, 'the '))}</b>${out ? ` → out in <b>${esc(out.replace(/ \(.*\)$/, ''))}</b>` : ''}`;
    }
    const here = hood(G.nodes[g.e.from]);
    const nx = nextCross(g.e);
    return `<b>${esc((here || 'Manhattan').replace(/ \(.*\)$/, ''))}</b> · ${esc(short(g.e.name))} ${headWord(g.e.name, g.e.b0)}${nx ? ` → ${esc(nx)}` : ''}<br><span class="muted">Hudson: ${{ 'ahead of you': 'ahead', 'on your right': 'right', 'behind you': 'behind', 'on your left': 'left' }[hudsonSide(h)]} · tap to go</span>`;
  }

  // ---- check-ins: "You're heading downtown. Which side is the Hudson?" ----------------------
  function maybeCheckIn(now) {
    if (!prefs.checkins || g.auto || g.check || g.done || g.waiting || g.home || g.goTo != null || g.queued || g.paused || g.view !== 'follow') return;
    if (now - g.lastCheck < CHECK_EVERY_MS || !g.e.core || g.e.len < 60 || g.s < g.e.len * 0.25 || g.s > g.e.len * 0.6) return;
    if (!onGrid(g.e.name, g.bnow)) return; // "heading downtown" only means something on the grid
    const h = gridDir(g.bnow);
    let thing, dir;
    if (h === 'U' || h === 'D') {
      const harlem = G.gy[g.e.from] > G.areas['110'] + 800;
      [thing, dir] = Math.random() < 0.5 ? ['the Hudson', 'W'] : [harlem ? 'the Harlem River' : 'the East River', 'E'];
    } else [thing, dir] = Math.random() < 0.5 ? ['uptown', 'U'] : ['downtown', 'D'];
    // which hand that direction is on, facing h
    const order = ['U', 'E', 'D', 'W'];
    const steps = (order.indexOf(dir) - order.indexOf(h) + 4) % 4;
    g.check = { h, thing, dir, answer: steps === 1 ? 'R' : 'L', t0: now };
    g.msg = '';
    render();
  }
  function answerCheck(side) {
    const c = g.check;
    const ok = side === c.answer;
    fstats.record(c.h, ok);
    g.checks++;
    if (ok) g.checksRight++;
    g.check = null;
    g.cruise = 0;
    g.lastCheck = performance.now();
    g.resumeAt = performance.now() + 900;
    const where = `${c.thing}${c.thing.startsWith('the') ? ` (${WORD[c.dir]})` : ''}`;
    void where;
    g.msg = `${ok ? '✓' : '✗'} ${c.thing[0].toUpperCase() + c.thing.slice(1)}: ${c.answer === 'L' ? 'left' : 'right'}`;
    g.msgAt = performance.now();
    render();
  }

  const cruiseMult = () => Math.min(CRUISE_MAX, 1 + CRUISE_STEP * g.cruise);
  const baseSpeed = () => SPEED * PACE[prefs.pace];
  /** The speed the car eases toward, before the corner ahead is considered. */
  function cruiseTarget() {
    const base = baseSpeed();
    if (g.home) return base * HOME_SPEED;
    if (g.goTo != null) return Math.max(base * GOTO_SPEED, g.gotoV);
    let v = base * (g.boost ? Math.max(HOLD_SPEED, cruiseMult()) : cruiseMult());
    if (g.e.len > LONG_M) v = Math.max(v, (g.e.len / LEG_MAX_S) * PACE[prefs.pace]);
    return v;
  }
  /** The fastest the car may be going here and still slow steadily for the corner ahead. */
  function cornerCap() {
    if (g.home) return Infinity;
    const base = baseSpeed();
    const c = choices(g.e);
    let vc; // speed at the corner
    if (g.goTo === g.e.to) vc = base * 0.3; // stopping there
    else if (!c.decision) vc = c.only && Math.abs(turnOf(g.e, c.only)) > 50 ? base * TURN_V : Infinity;
    else if (g.queued || (g.pick && g.pick !== c.dflt)) vc = base * TURN_V; // turning
    else if (!c.dflt) vc = base * TURN_V * 0.7; // no way carries on: you'll have to choose
    else vc = base * cruiseMult(); // carrying on
    if (vc === Infinity) return Infinity;
    const left = g.e.len - g.s;
    return Math.sqrt(vc * vc + 2 * BRAKE * base * Math.max(0, left - 8));
  }
  /** Ease the speed toward its target; never over the braking curve. */
  function updateSpeed(dt) {
    const tgt = Math.min(cruiseTarget(), cornerCap());
    if (g.v == null) g.v = Math.min(tgt, baseSpeed());
    const tau = tgt > g.v ? (g.home || g.goTo != null ? 0.25 : EASE_UP_S) : 0.2;
    g.v += (tgt - g.v) * Math.min(1, dt / tau);
    g.v = Math.min(g.v, cornerCap());
    return g.v;
  }
  const speedNow = () => g.v || 0;

  function tick(now) {
    if (!g || g.loading) return;
    const dt = Math.min(0.1, (now - g.last) / 1000);
    g.last = now;
    if (g.check && now - g.check.t0 > 8000) {
      // unanswered: move on (not counted)
      g.check = null;
      g.lastCheck = now;
      g.msg = 'Check-in skipped';
      g.msgAt = now;
      render();
    }
    if (g.startCard && g.resumeAt === Infinity && g.view !== 'intro') g.resumeAt = now + START_HOLD_MS;
    // the card stays up for real screen time: count frames drawn too (a busy page stalls them)
    if (g.startCard) g.cardFrames = (g.cardFrames || 0) + 1;
    if (g.startCard && now >= g.resumeAt && g.cardFrames >= 40 && g.view !== 'intro') {
      g.startCard = false;
      render();
    }
    if (!g.paused && !g.done && !g.waiting && g.view !== 'intro' && !g.check && !g.startCard && now >= g.resumeAt) {
      g.s += dt * updateSpeed(dt);
      let guard = 0;
      while (g && !g.done && !g.waiting && g.s >= g.e.len && guard++ < 50) {
        const over = g.s - g.e.len;
        arrive();
        if (g && !g.waiting && !g.done) g.s = Math.min(over, g.e.len);
      }
    }
    if (!g) return;
    if (g.waiting) g.v = 0;
    const { p, b } = g.waiting || g.done ? { p: g.e.pts[g.e.pts.length - 1], b: g.e.b1 } : posOnEdge(g.e, g.s);
    g.pos = p;
    g.bnow = b;
    const hc = `${gridDir(b)}${onGrid(g.e.name, b) ? '' : compassWord(b)}${choices(g.e).named ? 'n' : ''}`;
    if (hc !== g.lastHC) {
      g.lastHC = hc;
      render(); // the compass words on Left / Right follow your heading
    }
    maybeCheckIn(now);
    carMk.setLngLat(p);
    carMk.setRotation(b);
    carEl.classList.toggle('sigL', g.queued === 'L');
    carEl.classList.toggle('sigR', g.queued === 'R');
    if (g.view === 'follow' && !g.done) {
      const pad = ctx.padding();
      const H = window.innerHeight;
      // the car a little below the middle of the open area: more road ahead
      const oy = pad.top + (H - pad.top - pad.bottom) * 0.62 - H / 2;
      // zoom out as you cruise, so the corners coming up stay in view
      const want = ZOOM - Math.min(1.2, 0.5 * Math.max(0, (g.v || 0) / baseSpeed() - 1));
      g.zoom += (want - g.zoom) * Math.min(1, dt * 1.5);
      map.easeTo({ center: p, zoom: g.zoom, bearing: GRID, offset: [0, oy], duration: 0 });
    }
    pointToTarget();
    g.raf = requestAnimationFrame(tick);
  }

  /** At the end of g.e: finish, stop at a tapped corner, take the chosen way, carry on, or wait. */
  function arrive() {
    const e = g.e;
    const n = e.to;
    g.driven += e.len - (e.chord || 0);
    g.trail.push(...e.pts.slice(1));
    setData('gg-trail', line(g.trail));
    if (g.msg && performance.now() - g.msgAt > 3500) g.msg = '';
    if (n === g.target.node) return finish();
    const c = choices(e);
    if (g.goTo === n) {
      if (!c.decision && c.only) {
        // nothing to decide at this corner: say so and keep going
        g.goTo = null;
        setData('gg-goto', EMPTY);
        say(`Only way on: ${short(c.only.name)}`);
        go(c.only, true);
        return;
      }
      g.msg = ''; // the tapped corner: say where you are, not an older note
      return stopHere();
    }
    if (g.auto) autopilot(e);
    if (!c.decision) {
      if (!c.only) return stopHere('Dead end.');
      const d = turnOf(e, c.only);
      if (Math.abs(d) > 50) say(`Only way on: ${d < 0 ? 'left' : 'right'} onto ${short(c.only.name)}`);
      go(c.only, Math.abs(d) <= 50);
      return;
    }
    if (g.pick) {
      const p = g.pick;
      g.pick = null;
      if (c.options.includes(p)) return go(p, p === c.dflt);
    }
    if (g.queued) {
      const side = g.queued;
      g.queued = null;
      const nx = c.named ? sideOption(e, side) : side === 'L' ? c.left : c.right;
      if (nx) return go(nx);
      refuse(e, side);
    }
    if (c.dflt) return go(c.dflt, true);
    stopHere();
  }
  /** Onto link nx. carryOn: straight on with no input (the cruise builds); otherwise it resets. */
  function go(nx, carryOn = false) {
    g.cruise = carryOn ? g.cruise + 1 : 0;
    g.e = legOf(g.e.pts[g.e.pts.length - 1], nx);
    g.s = 0;
    g.waiting = false;
    enterEdge(nx);
    render(); // the street, neighborhood and next cross street follow you
  }
  /**
   * Link nx as driven from point a (where the last road ended): a straight cross
   * through the corner, then the road. The rest (name, choices, id) is nx's own.
   */
  function legOf(a, nx) {
    const ch = metres(a, nx.pts[0]);
    if (ch < 0.5) return nx;
    const leg = Object.create(nx);
    leg.pts = [a, ...nx.pts];
    leg.cum = [0, ...nx.cum.map((c) => c + ch)];
    leg.len = nx.len + ch;
    leg.chord = ch;
    return leg;
  }
  function say(msg) {
    g.msg = msg;
    g.msgAt = performance.now();
  }
  function stopHere(msg) {
    g.waiting = true;
    g.cruise = 0;
    g.goTo = null;
    setData('gg-goto', EMPTY);
    g.s = g.e.len;
    if (msg && !g.msg) say(msg);
    if (!g.msg) {
      const c0 = choices(g.e);
      if (c0.named) say(`${G.label(g.e.to)}: which way?`);
      else {
        const ways = [c0.left && 'left', c0.straight && 'straight', c0.right && 'right'].filter(Boolean);
        say(`${G.label(g.e.to)}: ${ways.join(' · ')}`);
      }
    }
    render();
  }
  /** Why there's no turn that way: a one-way street against you, or no road at all. */
  function refuse(e, side) {
    let why = null;
    for (const d of G.inn[e.to]) {
      if (!d.oneway || d.shape === e.shape) continue;
      const outward = (d.b1 + 180) % 360;
      const dd = angleDiff(outward, e.b1);
      if (side === 'L' ? dd < -30 && dd > -150 : dd > 30 && dd < 150) {
        why = wrongWay(d);
        g.wrong++;
        showArrows(d.name);
        break;
      }
    }
    say(`⛔ ${why || `No road to the ${side === 'L' ? 'left' : 'right'}`}`);
  }
  function go0() {
    // leave the start card now
    if (g.startCard) {
      g.startCard = false;
      g.resumeAt = 0;
      render();
    }
  }
  function press(side) {
    if (!g || g.done || g.loading) return;
    if (g.check) return side === 'S' ? undefined : answerCheck(side);
    go0();
    g.cruise = 0;
    const c = choices(g.e);
    if (side === 'S') {
      if (!g.waiting) return;
      const nx = c.straight || c.dflt || c.only;
      if (!nx) return;
      g.msg = '';
      go(nx);
      return;
    }
    if (g.waiting) {
      const nx = c.named ? sideOption(g.e, side) : side === 'L' ? c.left : c.right;
      if (!nx) {
        refuse(g.e, side);
        render();
        return;
      }
      g.msg = '';
      go(nx);
      return;
    }
    g.queued = g.queued === side ? null : side;
    g.pick = null;
    g.home = false;
    if (g.goTo != null) {
      g.goTo = null;
      setData('gg-goto', EMPTY);
    }
    render();
  }
  /** A named way out, tapped: take it now if stopped, else at the coming corner. */
  function pickLink(id) {
    if (!g || g.done || g.loading || g.check) return;
    go0();
    const o = G.edges[id];
    if (!choices(g.e).options.includes(o)) return;
    g.cruise = 0;
    g.queued = null;
    g.home = false;
    if (g.goTo != null) {
      g.goTo = null;
      setData('gg-goto', EMPTY);
    }
    if (g.waiting) {
      g.msg = '';
      go(o);
      return;
    }
    g.pick = g.pick === o ? null : o;
    render();
  }
  function togglePause() {
    if (!g || g.done) return;
    g.paused = !g.paused;
    render();
  }
  function autopilot(e) {
    // test helper: follow the shortest route from here
    const r = shortest(e, g.target.node, e.len);
    g.pick = (r && r.path[1]) || null;
    g.queued = null;
  }

  // ---- tap a corner ahead; hold to speed up -------------------------------------------------------
  const cont = map.getCanvasContainer();
  let down = null, holdTimer = 0;
  const active = () => g && !g.loading && !g.done;
  for (const ev of ['contextmenu', 'selectstart']) cont.addEventListener(ev, (e) => active() && e.preventDefault());
  cont.addEventListener('pointerdown', (e) => {
    if (!active()) return;
    if (g.view === 'intro') {
      g.view = 'follow';
      return;
    }
    if (g.startCard) {
      go0();
      return;
    }
    down = { x: e.clientX, y: e.clientY, moved: false };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      if (down && active()) {
        g.boost = true;
        carEl.classList.add('boost');
      }
    }, 260);
  });
  cont.addEventListener('pointermove', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) down.moved = true;
  });
  const up = (e, cancel) => {
    clearTimeout(holdTimer);
    const wasBoost = g && g.boost;
    if (g) g.boost = false;
    carEl.classList.remove('boost');
    if (!cancel && down && !down.moved && !wasBoost && active() && !g.paused && !g.check) tapAt(e.clientX, e.clientY);
    down = null;
  };
  cont.addEventListener('pointerup', (e) => up(e, false));
  cont.addEventListener('pointercancel', (e) => up(e, true));

  function tapAt(sx, sy) {
    if (g.home) return; // the round is decided: on the right road, straight there
    const rect = map.getContainer().getBoundingClientRect();
    const st = g.waiting ? choices(g.e).dflt : null;
    const chain = g.waiting ? (st ? aheadChain(st) : []) : aheadChain(g.e);
    let best = null;
    for (const { node } of chain) {
      if (!G.real(node)) continue;
      const p = map.project(G.nodes[node]);
      const d = Math.hypot(p.x + rect.left - sx, p.y + rect.top - sy);
      if (d < 70 && (!best || d < best.d)) best = { node, d };
    }
    if (!best) {
      g.msg = chain.length ? 'Tap a corner ahead of you on this road.' : 'No road straight ahead: turn left or right.';
      g.msgAt = performance.now();
      render();
      return;
    }
    g.goTo = best.node;
    g.queued = null;
    g.pick = null;
    g.cruise = 0;
    // get there in about a second, however far
    let m = g.waiting ? 0 : g.e.len - g.s;
    for (const { node, via } of chain) {
      if (via !== g.e) m += via.len;
      if (node === best.node) break;
    }
    g.gotoV = m / 1.2;
    setData('gg-goto', point(G.nodes[best.node]));
    if (g.waiting) {
      g.msg = '';
      go(st);
    }
    render();
  }

  function pointToTarget() {
    if (!g || g.done || !g.target || !g.pos) return;
    const a = aim();
    updateDir(a);
    const pad = ctx.padding();
    const rect = map.getContainer().getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const cx = a.c.x + rect.left, cy = a.c.y + rect.top;
    const x = a.t.x + rect.left, y = a.t.y + rect.top;
    const L = 26, R = W - 26, T = pad.top + 26, B = H - pad.bottom - 26;
    const inView = x > L - 12 && x < R + 12 && y > T - 12 && y < B + 12;
    offEl.hidden = inView;
    if (inView) return;
    // on the screen's edge where the line from the car to the destination leaves it
    const dx = x - cx, dy = y - cy;
    let k = 1;
    if (dx) k = Math.min(k, ((dx > 0 ? R : L) - cx) / dx);
    if (dy) k = Math.min(k, ((dy > 0 ? B : T) - cy) / dy);
    k = Math.max(0, k);
    const px = Math.min(R, Math.max(L, cx + dx * k)), py = Math.min(B, Math.max(T, cy + dy * k));
    offEl.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
    offEl.firstChild.style.transform = `rotate(${a.ang}deg)`;
  }

  function finish() {
    g.done = true;
    g.waiting = true;
    offEl.hidden = true;
    const bestCoords = [];
    g.best.path.forEach((e) => bestCoords.push(...e.pts));
    setData('gg-best', line(bestCoords));
    // zoom out to show the whole drive, yours and the shortest (after the result
    // is on screen, so the framing allows for its height)
    const all = [...g.trail, ...bestCoords];
    requestAnimationFrame(() => g && g.done && ctx.fit(all, 16, { bearing: GRID, duration: 900 }));
    const mi = (m) => (m / 1609.34).toFixed(2).replace(/0$/, '');
    const ratio = g.driven / g.best.cost;
    const ok = ratio <= 1.15 && !g.wrong;
    const runs = ctx.store.get('gridRuns', { n: 0, clean: 0 });
    runs.n++;
    if (ok) runs.clean++;
    ctx.store.set('gridRuns', runs);
    g.result = `<div class="fb ${ok ? 'ok' : 'no'}">${ok ? '✓' : '•'} ${mi(g.driven)} mi${ratio <= 1.03 ? ' · the shortest' : ` · shortest ${mi(g.best.cost)}`}${
      g.wrong ? ` · ${g.wrong} wrong-way` : ''
    }${g.checks ? ` · check-ins ${g.checksRight}/${g.checks}` : ''}</div>
      <div class="hint"><span class="gg-key you"></span> you <span class="gg-key best"></span> best: ${esc(describe(g.best.path))}</div>
      <button class="primary" id="ggAgain">Another route</button>`;
    render();
  }

  /** "Up 8th Ave → right on W 42nd St → …" */
  function describe(path) {
    const legs = [];
    for (let i = 0; i < path.length; i++) {
      const e = path[i];
      const last = legs[legs.length - 1];
      if (last && short(last.name) === short(e.name)) continue;
      if (!isCore(e.from) && !last) continue; // still on the way in from outside
      if (/entrance|exit|\bramp/i.test(e.name)) continue; // ramps aren't worth naming
      const dir = gridDir(e.b0);
      let turn;
      if (!last) turn = dir === 'U' ? 'Up' : dir === 'D' ? 'Down' : dir === 'E' ? 'East on' : 'West on';
      else {
        const d = angleDiff(e.b0, path[i - 1].b1);
        turn = d < -20 ? 'left on' : d > 20 ? 'right on' : 'onto';
      }
      void turn;
      legs.push({ name: e.name, text: short(e.name) });
    }
    return legs.map((l) => l.text).join(' → ');
  }

  // ---- words on screen -------------------------------------------------------------------
  function render() {
    if (!g) return;
    if (g.loading) {
      ctx.hud('<div class="qkind">🚕 Drive Manhattan</div><div class="q">Loading the street map…</div>');
      ctx.sheet(`${g.opts.header()}`);
      g.opts.bindHeader();
      return;
    }
    const t = g.target;
    const corner = t.label.replace(/ St\b/g, '').replace(/\b[EW] (\d)/g, '$1');
    const tgt = t.name ? `<b>${esc(t.name)}</b> <span class="muted">· ${esc(corner)}</span>` : `<b>${esc(t.label)}</b>`;
    const nx = !g.done && g.e.core ? nextCross(g.e) : null;
    const hb = g.bnow ?? g.e.b0;
    const plan = g.queued ? ` · <b>${g.queued === 'L' ? '◀ left' : 'right ▶'}</b>` : g.pick ? ` · <b>→ ${esc(short(g.pick.name))}</b>` : '';
    const where = `<b>${esc(short(g.e.name))}</b> · ${headWord(g.e.name, hb)}${nx ? ` · next ${esc(nx)}` : ''}${plan}`;
    ctx.hud(
      g.check
        ? `<div class="q gg-checkq">Heading ${WORD[g.check.h]}. ${esc(g.check.thing[0].toUpperCase() + g.check.thing.slice(1))}: <b>left or right?</b></div>
           <div class="hint">Answer with ◀ Left or Right ▶ · skips in a few seconds</div>`
        : `<div class="q">🏁 ${tgt}</div>
       ${g.done ? '' : `<div class="hint gg-go"><span class="gg-dir" title="Which way the destination is">${DIR_SVG}</span><b class="gg-dist"></b> · ${where}</div>`}`
    );
    if (!g.done && g.pos) updateDir(aim());
    // the direction each hand points, fading as this heading becomes solid (none during a check-in: it'd give it away);
    // grid words on the grid, the compass elsewhere
    const lvl = g.check ? 'hide' : fstats.hint(gridDir(hb));
    const grid = onGrid(g.e.name, hb);
    const handWord = (b) => (grid ? WORD[gridDir(b)] : compassWord(b));
    const hint = (b) => (lvl === 'hide' ? '' : `<span class="dirhint${lvl === 'faint' ? ' faint' : ''}">${handWord(b)}</span>`);
    const btn = (side, label) =>
      `<button class="ggturn${g.queued === side ? ' on' : ''}${g.check ? ' check' : ''}" data-side="${side}" ${g.done ? 'disabled' : ''}>${label}${side === 'S' ? '' : hint(hb + (side === 'L' ? -90 : 90))}</button>`;
    const cc = !g.done ? choices(g.e) : null;
    // stopped at a corner where straight on is possible: offer it
    const cw = g.waiting && !g.check ? cc : null;
    const canStraight = !!(cw && (cw.straight || cw.only));
    // a corner whose ways out don't fit Left / Straight / Right: a button for each, with its
    // real angle on screen (the map is turned so the grid is upright)
    const named = cc && cc.named && !g.check;
    const pickBtns = () =>
      cc.options
        .map((o) => ({ o, d: turnOf(g.e, o) }))
        .sort((a, b) => a.d - b.d)
        .map(
          ({ o }) =>
            `<button class="ggpick${g.pick === o ? ' on' : ''}" data-link="${o.id}"><span class="gg-arr" style="transform:rotate(${(o.b0 - GRID).toFixed(0)}deg)">${DIR_SVG}</span><span class="nm">${esc(short(o.name))}${o === cc.dflt ? ' <small>default</small>' : ''}</span></button>`
        )
        .join('');
    ctx.sheet(
      `${g.opts.header()}<div id="qbody">
        ${g.done ? g.result : `${named ? `<div class="ggctl named">${pickBtns()}</div>` : `<div class="ggctl${canStraight ? ' three' : ''}">${btn('L', '◀ Left')}${canStraight ? btn('S', '▲ Straight') : ''}${btn('R', 'Right ▶')}</div>`}
        <div class="ggmsg${g.msg || g.check || g.startCard ? '' : ' muted'}${g.startCard ? ' startcard' : ''}">${
          g.startCard
            ? startCard()
            : g.check
            ? `<b>Heading ${WORD[g.check.h]}.</b> ${esc(g.check.thing[0].toUpperCase() + g.check.thing.slice(1))}: left or right?`
            : g.msg
              ? esc(g.msg)
              : rounds() <= 3
                ? named
                  ? 'Tap the way you want at the next corner'
                  : 'Left/Right: turn at the next corner · tap a corner: go there · hold: faster'
                : ''
        }</div>`}
        <div class="ggbar">
          ${g.done ? '' : `<button id="ggPause">${g.paused ? '▶ Go' : '⏸ Pause'}</button>`}
          <button id="ggOptsBtn" aria-expanded="${!!prefs.optsOpen}">Options ${prefs.optsOpen ? '▴' : '▾'}</button>
        </div>
        <div class="ggopts"${prefs.optsOpen ? '' : ' hidden'}>
          <select id="ggArea" aria-label="Area">${Object.entries(AREAS).map(([k, v]) => `<option value="${k}"${prefs.area === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select id="ggFrom" aria-label="Start">${[['both', 'Start: mixed'], ['entries', 'Start: tunnels & bridges'], ['anywhere', 'Start: anywhere']].map(([k, v]) => `<option value="${k}"${prefs.from === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select id="ggPace" aria-label="Speed">${Object.keys(PACE).map((p) => `<option value="${p}"${prefs.pace === p ? ' selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select>
          <label><input type="checkbox" id="ggArrows"${prefs.arrows ? ' checked' : ''}/> One-way arrows</label>
          <label><input type="checkbox" id="ggMapFirst"${prefs.mapFirst ? ' checked' : ''}/> Map first</label>
          <label><input type="checkbox" id="ggChecks"${prefs.checkins ? ' checked' : ''}/> Check-ins</label>
        </div>
      </div>`
    );
    g.opts.bindHeader();
    for (const b of document.querySelectorAll('.ggturn')) b.addEventListener('click', () => press(b.dataset.side));
    for (const b of document.querySelectorAll('.ggpick')) b.addEventListener('click', () => pickLink(+b.dataset.link));
    document.getElementById('ggPause')?.addEventListener('click', togglePause);
    document.getElementById('ggAgain')?.addEventListener('click', () => start(g.opts));
    document.getElementById('ggOptsBtn').addEventListener('click', () => {
      prefs.optsOpen = !prefs.optsOpen;
      savePrefs();
      render();
    });
    const restartOn = (id, key) =>
      document.getElementById(id).addEventListener('change', (e) => {
        prefs[key] = e.target.value;
        savePrefs();
        start(g.opts);
      });
    restartOn('ggArea', 'area');
    restartOn('ggFrom', 'from');
    document.getElementById('ggPace').addEventListener('change', (e) => {
      prefs.pace = e.target.value;
      savePrefs();
    });
    document.getElementById('ggMapFirst').addEventListener('change', (e) => {
      prefs.mapFirst = e.target.checked;
      savePrefs();
    });
    document.getElementById('ggChecks').addEventListener('change', (e) => {
      prefs.checkins = e.target.checked;
      savePrefs();
    });
    document.getElementById('ggArrows').addEventListener('change', (e) => {
      prefs.arrows = e.target.checked;
      savePrefs();
      showArrows();
    });
  }

  return {
    start,
    stop,
    get running() {
      return !!g;
    },
    // for tests
    _state: () => g,
    _graph: () => G,
    _model: { choices, moves, shortest, straightTo, aheadChain, load, rule, describe },
    _speed: () => (g && !g.loading && g.e ? speedNow() : 0),
    _autopilot() {
      if (g) g.auto = true;
    },
    _screen(node) {
      const p = map.project(G.nodes[node]);
      const r = map.getContainer().getBoundingClientRect();
      return [p.x + r.left, p.y + r.top];
    },
  };
}

/** Min-heap on .c */
class Heap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(x) {
    const a = this.a;
    a.push(x);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p].c <= a[i].c) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].c < a[m].c) m = l;
        if (r < a.length && a[r].c < a[m].c) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}
