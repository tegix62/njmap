/* global maplibregl */
// Drive Downtown / Drive Midtown: every street in the area with its legal
// direction, from NYC's street centerline (built into data/downtown-streets.json
// and data/midtown-streets.json by tools/build_streets.py --downtown / --midtown;
// one instance of this game per area, see DRIVE_AREAS). Streets only: no FDR, ramps, tunnels or
// bridges; a round from the Holland Tunnel or a bridge starts where it comes
// out onto a street. The map is turned so the grid stands upright (uptown at
// the top); downtown streets run at their real angles.
//
// The data is a graph of real intersections (a divided road's two roadbeds,
// median crossings and kinks merged into one corner at build time) and the
// links between them. Your car drives on its own at the classic game's steady
// rhythm: each block takes 0.55 s plus its length, never under a second at
// Easy. At an ordinary corner, tap Left or Right before you get there (Straight
// when stopped). Where the ways out don't fit Left / Straight / Right (five-way
// junctions, forks, angled streets) the car stops and waits: each way out is a
// button with its street name, an arrow at its real angle and where it heads.
// Tap a corner ahead to zip to it; hold the map to speed up.
// Links follow the road itself; the car crosses each corner in a straight line
// from where one road ends to where the next begins.
// Wrong-way turns are refused with the reason: the rule of thumb when the
// street follows it ("odd streets go west"), the exception by name when it
// doesn't. The round ends once you're on the destination's road heading toward
// it (when that's the shortest way); the map then shows your route next to the
// shortest legal one.

import { framesStats } from './frames.js';
import { GUIDES, PEEK_MS, okSides, sideWords, guessRecord, briefingHTML, bindBriefing } from './briefing.js';

const CHECK_EVERY_MS = 35000; // a check-in at most this often
const GRID = 29; // the grid is turned ~29° clockwise from north
const ZOOM = 15.3; // driving zoom (wide enough to see a few corners ahead and around)
// the classic game's rhythm: a block takes (0.55 s + its length / 168 m per s) x pace,
// and never less than BLOCK_MIN_S x pace (short downtown blocks don't rush you)
const PACE = { relaxed: 2, easy: 1, normal: 0.72, fast: 0.5 }; // relaxed: at least 2 s a block, time to decide every corner
const BLOCK_MIN_S = 1;
const GOTO_SPEED = 0.18; // fraction of the block time: heading to a tapped corner,
const HOLD_SPEED = 0.25; // holding the map,
const RIDE_F = { quick: 0.07, steady: 0.14, slow: 0.26 }; // the plan's ride, as a fraction of the block time
const HOME_SPEED = 0.07; // and on the home stretch
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

// The areas there's a game for (data built by tools/build_streets.py --downtown / --midtown)
export const DRIVE_AREAS = {
  downtown: { data: 'data/downtown-streets.json', title: 'Drive Downtown', span: 'below 14th St', of: "downtown's" },
  midtown: { data: 'data/midtown-streets.json', title: 'Drive Midtown', span: '14th–60th St', of: "Midtown's" },
};

export function initGridGame(ctx, areaId = 'downtown') {
  const AREA = DRIVE_AREAS[areaId];
  const DATA_URL = AREA.data;
  const AREAS = { all: `All of ${areaId === 'downtown' ? 'downtown' : 'Midtown'} (${AREA.span})` };
  const { map } = ctx;
  let G = null; // the street graph, once loaded
  let g = null; // the running round
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  // mapFirst: a look at the start and destination before driving (off by default:
  // working out where the address is is the useful part).
  // from: 'both' (half the rounds start at a tunnel or bridge), 'entries', 'anywhere'
  // checkins: now and then the car pauses and asks which side the Hudson (or uptown) is
  const prefs = { style: areaId === 'midtown' ? 'plan' : 'drive', pace: 'relaxed', guide: 'words', labels: true, cover: false, trips: true, arrows: false, mapFirst: false, area: 'all', from: 'both', optsOpen: false, checkins: true, ...ctx.store.get(`${areaId}Prefs`, {}) };
  const fstats = framesStats(ctx.store);
  const guesses = guessRecord(ctx.store);
  // what's remembered between rounds: tied to this build of the street data (link ids change when it's rebuilt)
  const mem = {
    get(k, dflt) {
      const v = ctx.store.get(`${areaId}.${k}`, null);
      return v && v.data === G.dataKey ? v.v : dflt;
    },
    set(k, v) {
      ctx.store.set(`${areaId}.${k}`, { data: G.dataKey, v });
    },
  };
  if (!GUIDES[prefs.guide]) prefs.guide = 'words';
  if (prefs.style !== 'plan' && prefs.style !== 'drive') prefs.style = 'drive';
  if (!AREAS[prefs.area]) prefs.area = 'all';
  const savePrefs = () => ctx.store.set(`${areaId}Prefs`, prefs);
  // Downtown used to default to the free, real-time drive (the car moves, you tap each turn). It now plays like Midtown: plan the
  // route corner by corner, then ride it. Anyone who had the old default moves over once; the Options menu still has the free drive.
  if (areaId === 'downtown' && !prefs.planDefault) {
    prefs.style = 'plan';
    prefs.planDefault = true;
    savePrefs();
  }
  const rounds = () => ctx.store.get(`${areaId}Runs`, { n: 0 }).n; // finished rounds, for first-time help

  // ---- the graph -------------------------------------------------------------------
  async function load() {
    if (G) return G;
    const [d, lmAll, lmIcons, lmPics, adv] = await Promise.all([fetch(DATA_URL).then((r) => r.json()), fetch('data/landmarks.json').then((r) => r.json()).catch(() => []), fetch('data/landmark-icons.json').then((r) => r.json()).catch(() => ({})), fetch('data/landmark-credits.json').then((r) => r.json()).catch(() => ({})), fetch('data/lincoln-scenarios.json').then((r) => r.json()).catch(() => null)]);
    SCN_DATA = adv;
    LM_ALL = lmAll;
    LM_ICONS = lmIcons;
    LM_PICS = lmPics;
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
    const xingGeo = new Map(); // "fromLink>toLink" -> the road pieces joining them inside the corner
    for (const [key, gi] of Object.entries(d.xings || {})) xingGeo.set(key, geo[gi]);
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
    const cuts = d.cuts || {}; // link id -> what the road carries on as that the game leaves out ('' = past the edge of the area)
    const RAMP = /entrance|exit|\bramp|\bRp\b|Bridge|Tunnel|Expwy|\bEp\b|\bEn\b|\bEt\b/i;
    const HWY = /Drive|\bDr\b|\bDrv\b|Hwy|Pkwy|Expwy|FDR/i;
    const label = (n) => {
      const names = [];
      for (const e of [...out[n], ...inn[n]]) if (!names.includes(e.name)) names.push(e.name);
      // E 37th St and W 37th St meet at 5th Ave: one street, not two
      const base = (x) => x.replace(/^[EW] (\d+\w\w) St$/, '$1 St');
      const uniq = (a) => a.filter((x, i) => a.findIndex((y) => base(y) === base(x)) === i);
      const streets = uniq(names.filter((x) => !RAMP.test(x)));
      return (streets.length >= 2 ? streets : uniq(names)).slice(0, 2).join(' & ');
    };
    // an ordinary street corner: no highway or ramp meets here (for random starts and destinations)
    const plain = (n) => [...out[n], ...inn[n]].every((e) => !RAMP.test(e.name) && !HWY.test(e.name));
    const real = (n) => d.jdeg[n] >= 3; // three or more roads meet: a corner you could turn at
    const streetsAt = (n) => new Set([...out[n], ...inn[n]].map((e) => e.name.replace(/^[EW] (\d+\w\w) St$/, '$1 St'))).size;
    const gy = nodes.map((p) => gridXY(p)[1]);
    G = { d, nodes, edges, out, inn, coreJ, cuts, real, streetsAt, xingGeo, label, plain, gy, RAMP, places: d.places, entries: d.entries, areas: d.areas };
    G.dataKey = `${d.source}|${edges.length}|${nodes.length}`;
    // famous buildings and places worth knowing, for the "right next to you" callouts: the ones near this map's streets
    G.landmarks = lmAll.filter((l) => nodes.some((nd) => Math.hypot((nd[0] - l.p[0]) * 84400, (nd[1] - l.p[1]) * 111000) < 170));
    // A tunnel isn't a curb: you get in by driving onto one of its entrance ramps. The street data names
    // them (the Lincoln Tunnel's: gateDefs, from the Port Authority and city data; the Holland's: the street
    // that carries straight on into the ramp, from the city's data), so a round ends when you drive onto one.
    G.gateSets = new Map();
    const GATE_RULE = { 'the holland tunnel entrance (to nj)': /^Holland Tunnel entrance/i };
    for (const pl of G.places) {
      if (pl.gateDefs) {
        pl.gateList = pl.gateDefs.flatMap((gd) =>
          G.inn[gd.node].filter((e) => e.core && gd.streets.some((st) => short(st) === short(e.name))).map((e) => ({ id: e.id, node: gd.node, night: gd.night, label: gd.label }))
        );
        continue;
      }
      const rule = GATE_RULE[pl.name.toLowerCase()];
      if (!rule) continue;
      const gates = Object.entries(G.cuts).filter(([, txt]) => rule.test(txt || '')).map(([id]) => edges[+id]).filter(Boolean);
      if (gates.length) pl.gateList = gates.map((e) => ({ id: e.id, node: e.to, night: false, label: short(e.name) }));
    }
    applyGates();
    // The George Washington Bridge is far uptown, off this map: a trip from it comes down the West
    // Side Highway, so it starts on the northernmost southbound stretch of 12th Ave.
    if (areaId === 'midtown' && !G.entries.some((en) => /George Washington/.test(en.from))) {
      const south = edges.filter((e) => e.core && /^12th Ave/.test(e.name) && Math.abs(((e.b0 - (GRID + 180) + 540) % 360) - 180) < 45);
      south.sort((a, b) => nodes[b.from][1] - nodes[a.from][1]);
      if (south[0]) G.entries = [...G.entries, { from: 'the GWB (down the West Side Highway)', via: south[0].name, link: south[0].id, landsAt: south[0].to }];
    }
    // The grid's own coordinates: across (x) of each avenue, up (y) of each numbered street, so a
    // point can be put into "streets and avenues". Avenues keep one column north of 59th under
    // their uptown names (9th Ave is Columbus Ave, 10th is Amsterdam, 11th is West End).
    const ALIAS = { 'Columbus Ave': '9th Ave', 'Amsterdam Ave': '10th Ave', 'West End Ave': '11th Ave', 'Park Ave S': 'Park Ave' };
    const AVES = new Set(['1st Ave', '2nd Ave', '3rd Ave', 'Lexington Ave', 'Park Ave', 'Madison Ave', '5th Ave', '6th Ave', '7th Ave', '8th Ave', '9th Ave', '10th Ave', '11th Ave']);
    const ax = new Map(), sy = new Map();
    for (const e of edges) {
      const nm = ALIAS[e.name] || e.name;
      const sn = /^[EW] (\d+)(st|nd|rd|th) St$/.exec(e.name);
      if (!AVES.has(nm) && !sn) continue;
      for (const q of e.pts) {
        const [gx, gyv] = gridXY(q);
        if (sn) (sy.get(+sn[1]) || sy.set(+sn[1], []).get(+sn[1])).push(gyv);
        else (ax.get(nm) || ax.set(nm, []).get(nm)).push(gx);
      }
    }
    const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
    G.aveCols = [...ax].map(([name, v]) => ({ name, x: med(v) })).sort((p, q) => p.x - q.x);
    G.streetLines = [...sy].map(([n, v]) => ({ n, y: med(v) })).sort((p, q) => p.y - q.y);
    // each block once (a two-way block's two links share a shape), for coverage
    G.shapeLen = new Map();
    for (const e of edges) if (e.core) G.shapeLen.set(e.shape, e.len);
    G.totalLen = [...G.shapeLen.values()].reduce((a, b) => a + b, 0);
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
  /** The road carries on from e into o: a gentle bend, or the same road changing level (Park Ave's ramp up onto its viaduct bends sharply but is no corner). */
  const baseRoad = (n) => n.replace(/ Viaduct$/, '');
  const carries = (e, o) => Math.abs(turnOf(e, o)) <= 50 || baseRoad(e.name) === baseRoad(o.name);

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
    // every street the game drives on, drawn from its own data with its own names: the
    // background map's tiles can fail to load (a blank square in Hudson Square), and
    // then the streets you're driving would be missing
    const seen = new Set();
    const streets = [];
    elevFC.features.length = 0;
    for (const e of G.edges) {
      if (seen.has(e.shape)) continue;
      seen.add(e.shape);
      // the Park Ave Viaduct and the ramp up to it: raised roadway, tinted so it reads as passing over the cross streets
      const raised = /Viaduct/.test(e.name) || (e.name === 'Park Ave' && (/Viaduct/.test(G.label(e.to)) || /Viaduct/.test(G.label(e.from))));
      streets.push({ type: 'Feature', properties: { name: short(e.name), el: raised ? 1 : 0, tier: tierOf(e.name) }, geometry: { type: 'LineString', coordinates: e.pts } });
      if (raised) elevFC.features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: e.pts } });
    }
    for (const pts of G.xingGeo.values()) streets.push({ type: 'Feature', properties: { name: '' }, geometry: { type: 'LineString', coordinates: pts } });
    streetsFC = { type: 'FeatureCollection', features: streets };
  }
  let streetsFC = null;
  const elevFC = { type: 'FeatureCollection', features: [] };
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
  let hoodsAllFC = null;
  /** Every neighborhood's outline, once, as lines (the dashed borders you cross). */
  function hoodBordersFC() {
    if (hoodsAllFC) return hoodsAllFC;
    const feats = [];
    for (const m of ctx.munis || []) {
      if (!m.geom) continue;
      const polys = m.geom.type === 'Polygon' ? [m.geom.coordinates] : m.geom.coordinates;
      for (const poly of polys) for (const ring of poly) feats.push({ type: 'Feature', properties: { n: m.n }, geometry: { type: 'LineString', coordinates: ring } });
    }
    return (hoodsAllFC = { type: 'FeatureCollection', features: feats });
  }
  function ensureLayers() {
    for (const [id, col] of [['gg-chev', '#1f1b16'], ['gg-chev-exc', '#c47a00'], ['gg-chev-hl', '#9a5b00']]) {
      if (!map.hasImage(id)) {
        const { img, opts } = chevron(col);
        map.addImage(id, img, opts);
      }
    }
    if (map.getSource('gg-trail')) return;
    map.addSource('gg-bldg', { type: 'geojson', data: EMPTY });
    map.addSource('gg-streets', { type: 'geojson', data: streetsFC || EMPTY });
    const roadCol = map.getLayer('road-mid') && map.getPaintProperty('road-mid', 'line-color');
    map.addLayer(
      {
        id: 'gg-streets', type: 'line', source: 'gg-streets', layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
        // only at driving zoom: zoomed out, the background map leaves small streets out on
        // purpose, and drawing all of ours there (offset a little from its own) is a fuzzy mesh
        paint: {
          'line-color': typeof roadCol === 'string' ? roadCol : '#d8d1c3',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, 0.8, 14.5, 2, 15.3, 5, 16, 8, 17, 12],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 12.3, 0, 13.3, 1],
        },
      },
      map.getLayer('road-minor') ? 'road-minor' : undefined // under the background map's roads: where its tiles load, they draw on top
    );
    map.addLayer(
      {
        id: 'gg-bldg', type: 'fill-extrusion', source: 'gg-bldg', layout: { visibility: 'none' },
        paint: {
          // a plain stand-in for the city: stone gray, darker the taller it is; the building a landmark sits in is amber
          'fill-extrusion-color': ['case', ['has', 'c'], ['get', 'c'], ['==', ['get', 'lm'], 1], '#d9962b', ['interpolate', ['linear'], ['get', 'h'], 6, '#e9e3d6', 60, '#d6cdbb', 200, '#bdb29d', 300, '#a99d88']],
          'fill-extrusion-height': ['get', 'h'],
          'fill-extrusion-base': ['coalesce', ['get', 'b'], 0],
          'fill-extrusion-opacity': 0.94,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      'gg-streets'
    );
    map.addSource('gg-trail', { type: 'geojson', data: EMPTY });
    map.addSource('gg-best', { type: 'geojson', data: EMPTY });
    map.addSource('gg-arrows', { type: 'geojson', data: arrowsFC || EMPTY });
    map.addSource('gg-target', { type: 'geojson', data: EMPTY });
    map.addSource('gg-goto', { type: 'geojson', data: EMPTY });
    map.addSource('gg-cover', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'gg-cover', type: 'line', source: 'gg-cover', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#16a34a', 'line-width': 3, 'line-opacity': 0.35 } });
    // the border you just crossed: the new neighborhood tinted, its edge near you dashed; both fade in a moment
    map.addSource('gg-elev', { type: 'geojson', data: elevFC });
    const elevW = ['interpolate', ['linear'], ['zoom'], 14.5, 3, 16, 9, 17, 14];
    map.addLayer({ id: 'gg-elev-case', type: 'line', source: 'gg-elev', layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#7c4a14', 'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 4.5, 16, 12, 17, 18], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 14.4, 0, 15, 0.9] } });
    map.addLayer({ id: 'gg-elev', type: 'line', source: 'gg-elev', layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#f2d9a8', 'line-width': elevW, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 14.4, 0, 15, 1] } });
    map.addSource('gg-hoods-all', { type: 'geojson', data: hoodBordersFC() });
    map.addLayer({ id: 'gg-hoods-border', type: 'line', source: 'gg-hoods-all', minzoom: 12, layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#0b7a68', 'line-opacity': 0.42, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.7, 14, 1.2, 16, 2], 'line-dasharray': [3, 2] } });
    map.addSource('gg-hood', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'gg-hood-fill', type: 'fill', source: 'gg-hood', filter: ['==', ['get', 'k'], 'f'], paint: { 'fill-color': '#0b7a68', 'fill-opacity': 0, 'fill-opacity-transition': { duration: 500 } } });
    map.addLayer({ id: 'gg-hood-line', type: 'line', source: 'gg-hood', filter: ['==', ['get', 'k'], 'l'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0b7a68', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 1.4, 16, 2.4, 17.5, 3.4], 'line-opacity': 0, 'line-opacity-transition': { duration: 500 } } });
    // the streets that lead into the tunnel entrance for this round's conditions: a soft highlight, slow arrows flowing the way to go
    map.addSource('gg-corridor', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'gg-corridor-glow', type: 'line', source: 'gg-corridor', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f5a524', 'line-opacity': 0.3, 'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, 4, 15, 14, 17, 26], 'line-blur': 1.5 } });
    map.addLayer({ id: 'gg-corridor-flow', type: 'line', source: 'gg-corridor', layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': '#b45309', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, 1.5, 15, 3.5, 17, 6], 'line-dasharray': [0, 4, 3] } });
    map.addLayer({
      id: 'gg-corridor-chev', type: 'symbol', source: 'gg-corridor', minzoom: 14,
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 70, 'icon-image': 'gg-chev-hl', 'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 17, 1], 'icon-rotation-alignment': 'map', 'icon-keep-upright': false, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
    });
    map.addLayer({ id: 'gg-best', type: 'line', source: 'gg-best', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#15803d', 'line-width': 4.5, 'line-dasharray': [2, 1.5] } });
    map.addLayer({ id: 'gg-trail', type: 'line', source: 'gg-trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2b4fb3', 'line-width': 6, 'line-opacity': 0.55 } });
    map.addLayer({
      id: 'gg-street-names', type: 'symbol', source: 'gg-streets', minzoom: 14.6,
      layout: {
        visibility: 'none', 'symbol-placement': 'line', 'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'map', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'],
        // (minzoom below: names only at driving zoom too)
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10.5, 16, 13.5], 'symbol-spacing': 280, 'text-max-angle': 30,
      },
      paint: { 'text-color': ['match', ['get', 'tier'], 3, '#9a9182', '#4f483e'], 'text-halo-color': '#ffffff', 'text-halo-width': 1.8 }, // (local named streets in a lighter gray: not the ones to learn first)
    });
    // famous and need-to-know spots, in passing: a small dot and an italic name that gives way to street names
    map.addSource('gg-poi', { type: 'geojson', data: EMPTY });
    const lmInk = (map.getLayer('landmark-label') && map.getPaintProperty('landmark-label', 'text-color')) || '#4f483e';
    map.addLayer({
      id: 'gg-poi-dot', type: 'circle', source: 'gg-poi', minzoom: 14.6,
      layout: { visibility: 'none' },
      paint: { 'circle-radius': 4, 'circle-color': typeof lmInk === 'string' ? lmInk : '#4f483e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 },
    });
    map.addLayer({
      id: 'gg-poi-label', type: 'symbol', source: 'gg-poi', minzoom: 14.6,
      layout: {
        visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 12,
        'text-anchor': 'top', 'text-offset': [0, 0.7], 'text-max-width': 7, 'text-optional': true,
      },
      paint: { 'text-color': typeof lmInk === 'string' ? lmInk : '#4f483e', 'text-halo-color': '#ffffff', 'text-halo-width': 1.8 },
    });
    // the famous places you've passed this round: stay on the map (and the wide and end views) so you can see where they were
    map.addSource('gg-lmseen', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'gg-lmseen-dot', type: 'circle', source: 'gg-lmseen', minzoom: 11.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 15, 7], 'circle-color': '#3b2f1e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
    map.addLayer({
      id: 'gg-lmseen-label', type: 'symbol', source: 'gg-lmseen', minzoom: 11.5,
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 12.5, 'text-anchor': 'top', 'text-offset': [0, 0.8], 'text-max-width': 8, 'text-optional': true },
      paint: { 'text-color': '#3b2f1e', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    });
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
  /** Hard mode: street names off the map for the round. */
  /** The area's famous and need-to-know spots: the app's landmark list plus the game's named places, within reach of its streets. */
  function poiFeatures() {
    const near = (pt) => G.nodes.some((n) => metres(n, pt) < 260);
    const pts = [];
    const add = (name, pt, tier) => {
      const clean = name.replace(/ \(.*\)$/, '').replace(/^the /i, '');
      if (!near(pt) || pts.some((q) => metres(q.pt, pt) < 110 || q.name.toLowerCase() === clean.toLowerCase())) return;
      pts.push({ name: clean, pt, tier });
    };
    for (const l of ctx.region.landmarks || []) add(l.name, l.pt, 0);
    for (const pl of G.places) add(pl.name, G.nodes[pl.node], 1);
    return { type: 'FeatureCollection', features: pts.map((q) => ({ type: 'Feature', properties: { name: q.name }, geometry: { type: 'Point', coordinates: q.pt } })) };
  }
  /** Show them once the round is under way (not during the briefing, where they'd give the answer away). */
  function showPoi(on) {
    for (const id of ['gg-poi-dot', 'gg-poi-label']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  }
  function showLabels(on) {
    const vis = (id, v) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
    // driving: the game's own streets and names; the end-of-round overview and the rest of
    // the app: the background map's own
    const inGame = !!(g && !g.loading && !g.done);
    vis('gg-streets', !!(g && !g.loading)); // (the end map keeps them too: the base map's own are faint there)
    applyTilt();
    vis('gg-hoods-border', !!(g && !g.loading));
    vis('gg-elev-case', inGame);
    vis('gg-elev', inGame);
    vis('gg-street-names', inGame && on);
    vis('road-name', !inGame); // in the game, the names come from its own street data (same names as everywhere else in it)
  }
  /** The blocks you've driven, faintly green (Options: Show streets I've driven). */
  function showCover() {
    if (!G || !map.getSource('gg-cover')) return;
    if (!prefs.cover) return setData('gg-cover', EMPTY);
    const driven = new Set(mem.get('driven', []));
    const seen = new Set();
    const feats = [];
    for (const e of G.edges) {
      if (!driven.has(e.shape) || seen.has(e.shape)) continue;
      seen.add(e.shape);
      feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: e.pts } });
    }
    setData('gg-cover', { type: 'FeatureCollection', features: feats });
  }
  /** Share of downtown's blocks you've driven, by length. */
  function coverage() {
    const driven = mem.get('driven', []);
    let m = 0;
    for (const sh of driven) m += G.shapeLen.get(sh) || 0;
    return m / G.totalLen;
  }
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
  // the shortest way's car, for the end-of-round race, and the spot where the two ways part
  const bestEl = document.createElement('div');
  bestEl.className = 'gg-carmk gg-bestcar';
  bestEl.innerHTML = '<svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><path d="M20 3 L31 33 L20 26 L9 33 Z" fill="#15803d" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  const bestMk = new maplibregl.Marker({ element: bestEl, rotationAlignment: 'map', pitchAlignment: 'map' });
  const splitEl = document.createElement('div');
  splitEl.className = 'gg-split';
  const splitMk = new maplibregl.Marker({ element: splitEl, anchor: 'bottom', offset: [0, -6] });
  // street-name tags that appear for a moment where a car turns onto another street, in the end ride
  function makeTag(cls, offset) {
    const el = document.createElement('div');
    el.className = `gg-tag ${cls}`;
    el.hidden = true;
    const mk = new maplibregl.Marker({ element: el, anchor: 'left', offset });
    return { el, mk, t: 0 };
  }
  const youTag = makeTag('you', [16, -18]);
  const bestTag = makeTag('best', [16, 16]);
  function showTag(tag, text, at) {
    tag.el.textContent = text;
    tag.el.hidden = false;
    tag.el.classList.remove('fade');
    tag.mk.setLngLat(at).addTo(map);
    clearTimeout(tag.t);
    tag.t = setTimeout(() => tag.el.classList.add('fade'), 1300);
  }
  function hideTags() {
    for (const t of [youTag, bestTag]) {
      clearTimeout(t.t);
      t.el.hidden = true;
      t.mk.remove();
    }
  }
  // off-screen pointer to the destination
  const offEl = document.createElement('div');
  offEl.className = 'gg-off';
  offEl.innerHTML = DIR_SVG;
  offEl.hidden = true;
  document.body.appendChild(offEl);
  // neighborhoods in passing: the one you're in is outlined softly on the map and the outline
  // pulses when you cross into another. The name is in the top card.
  // (no standing tint: it wore on you. The borders of every neighborhood are dashed hairlines, the one you're in is outlined solid,
  // and when you cross a border the new one flashes and the tag shows "from › to"; it warns you of the next one as you near it)
  const HOOD_REST = { fill: 0, line: 0.8 };
  const HOOD_PULSE = { fill: 0.16, line: 1 };
  let hoodTimer = 0;
  // "Where am I?": a magnifier button in the bottom tray that pulls the map back to the neighborhood-sized view and back again
  const OV_BTN = () => `<button id="ggOv" class="${g.view === 'overview' ? 'on' : ''}" aria-pressed="${g.view === 'overview'}" aria-label="Where am I?"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15 15l5.5 5.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>`;
  // ---- 3D: the camera tilts to a driver's angle and the buildings stand up (Midtown; heights from NYC's building footprints) ----
  const TILT_DEG = 55;
  const tiltOn = () => !!prefs.tilt && areaId === 'midtown';
  /** The camera's tilt now: tilted only in the close-up follow view (the wide "where am I" view and the end screens stay flat). */
  const camPitch = () => (tiltOn() && g && !g.done && (g.view === 'follow' || g.view === 'peek') ? TILT_DEG : 0);
  const driveZoom = () => (ZOOM + (camPitch() ? 0.5 : 0));
  const TILT_BTN = () => (areaId === 'midtown' ? `<button id="ggTilt" class="${tiltOn() ? 'on' : ''}" aria-pressed="${tiltOn()}" aria-label="3D view"><b>3D</b></button>` : '');
  /**
   * The famous towers get their own stepped shapes (stacked, scaled copies of the building's own outline). A tier is
   * { h: top as a fraction of the roof height, s: scale (or [sx, sy]), c: [x, y] where its centre sits in the outline's
   * box (default the middle), b: base as a fraction (default the tier below), color }. `mast` is a thin spire on top, in metres.
   * Stylized from what the buildings look like, not surveyed.
   */
  const STONE = '#e4ddcc', STEEL = '#cdd6dd';
  const slant = (from, to, n, color) => Array.from({ length: n }, (_, k) => {
    const sy = Math.max(0.08, 1 - (k + 1) / (n + 0.6));
    return { h: from + ((k + 1) * (to - from)) / n, s: [1, sy], c: [0.5, 1 - sy / 2], color };
  });
  const TOWERS = {
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
  };
  /** A building's outline as the stacked pieces of its model (Polygon features with a height and a base). */
  function towerFeatures(ring, H, model) {
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
  let bldgState = 0; // 0 not loaded, 1 loading, 2 loaded
  async function loadBuildings() {
    if (bldgState || areaId !== 'midtown') return;
    bldgState = 1;
    try {
      const d = await fetch('data/buildings-midtown.json').then((r) => r.json());
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
      setData('gg-bldg', { type: 'FeatureCollection', features: feats });
      bldgState = 2;
    } catch {
      bldgState = 0;
    }
  }
  function applyTilt() {
    if (!map.getLayer('gg-bldg')) return;
    map.setLayoutProperty('gg-bldg', 'visibility', tiltOn() && g && !g.done ? 'visible' : 'none');
    if (tiltOn()) loadBuildings();
  }
  function toggleTilt() {
    if (!g || g.loading || g.done) return;
    prefs.tilt = !prefs.tilt;
    savePrefs();
    applyTilt();
    const p = g.pos || g.trail[g.trail.length - 1];
    const pad = ctx.padding();
    const H = window.innerHeight;
    map.easeTo({ center: p, zoom: g.view === 'overview' ? OV_ZOOM : driveZoom(), bearing: GRID, pitch: camPitch(), offset: [0, pad.top + (H - pad.top - pad.bottom) * 0.62 - H / 2], duration: ctx.dur(600) });
    render();
  }
  const OV_ZOOM = 13.1; // ~3 km across: Midtown and the neighborhoods round it, named
  function toggleOverview() {
    if (!g || g.loading || g.done || g.peek) return;
    g.view = g.view === 'overview' ? 'follow' : 'overview';
    g.camKey = null;
    carEl.classList.toggle('gg-ovcar', g.view === 'overview');
    const p = g.pos || g.trail[g.trail.length - 1];
    const pad = ctx.padding();
    const H = window.innerHeight;
    // instant: no animation, then the frame loop keeps it centred on the car
    map.jumpTo({ center: p, zoom: g.view === 'overview' ? OV_ZOOM : driveZoom(), bearing: GRID, pitch: camPitch(), offset: [0, pad.top + (H - pad.top - pad.bottom) * 0.62 - H / 2] });
    render();
  }
  // the name of the outlined neighborhood stays in view, just under the top card, for as long as it's outlined
  const hoodTag = document.createElement('div');
  hoodTag.className = 'gg-hoodtag';
  hoodTag.hidden = true;
  document.body.appendChild(hoodTag);
  function placeHoodTag() {
    if (hoodTag.hidden) return;
    hoodTag.style.top = `${Math.round(ctx.padding().top - 6)}px`;
  }
  function setHoodTag(name, pulse, from, next) {
    hoodTag.innerHTML = name
      ? `${from ? `<span class="hf">${esc(from)} ›</span> ` : ''}${esc(name)}${next && !from ? ` <span class="hn">→ ${esc(next)}</span>` : ''}`
      : '';
    hoodTag.hidden = !name;
    placeHoodTag();
    if (pulse) {
      hoodTag.classList.remove('pulse');
      void hoodTag.offsetWidth;
      hoodTag.classList.add('pulse');
    }
  }
  let LM_ALL = [], LM_ICONS = {}, LM_PICS = {};
  const lmNorm = (x) => x.toLowerCase().replace(/^the /, '').replace(/ \(.*\)$/, '').replace(/[^a-z0-9 ]/g, '');
  /** The landmark a dot or destination is, by name. */
  function lmFind(name) {
    const a = lmNorm(name || '');
    if (!a) return null;
    return LM_ALL.find((l) => lmNorm(l.n) === a) || LM_ALL.find((l) => a.length > 4 && (lmNorm(l.n).includes(a) || a.includes(lmNorm(l.n)))) || null;
  }
  /** A landmark's picture: our silhouette if we drew one, else a small photo from Wikimedia Commons (credited in Settings), else nothing. */
  const lmPic = (n) => (LM_ICONS[n] ? `<svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">${LM_ICONS[n]}</svg>` : LM_PICS[n] ? `<img src="${esc(LM_PICS[n].img)}" alt="" />` : '');
  /** Tap a landmark's name (the callout, or on the result screen) for its photo, name, note and credit; the drive waits meanwhile. */
  const lmCard = document.createElement('div');
  lmCard.className = 'gg-lmcard';
  lmCard.hidden = true;
  document.body.appendChild(lmCard);
  let lmCardPaused = null;
  function closeLmCard() {
    if (lmCard.hidden) return;
    lmCard.hidden = true;
    if (g && lmCardPaused === false && !g.done) {
      g.paused = false;
      render();
    }
    lmCardPaused = null;
    endPeek(); // after the photo, back to the drive
  }
  function openLmCard(name) {
    const l = lmFind(name);
    if (l) name = l.n;
    const pic = LM_PICS[name];
    if (!l && !pic) return false;
    if (g && !g.done && lmCardPaused === null) {
      lmCardPaused = g.paused;
      g.paused = true; // the car waits while you look
      render();
    }
    const by = pic && pic.author ? `${esc(pic.author)}, ` : '';
    const visual = pic ? `<img src="${esc(pic.img)}" alt="${esc(name)}" />` : LM_ICONS[name] ? `<i class="gg-lmcard-ico"><svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">${LM_ICONS[name]}</svg></i>` : '';
    lmCard.innerHTML = `<div class="gg-lmcard-in">${visual}<b>${esc(name)}</b><span>${esc(l ? l.note : '')}</span>${pic ? `<small>Photo: ${by}${esc(pic.license)} · <a href="${esc(pic.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></small>` : ''}<button type="button" class="gg-lmcard-x">Back to the drive</button></div>`;
    lmCard.hidden = false;
    return true;
  }
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-lm]');
    // (Drive Midtown and Drive Downtown each have their own callout and result lines: act only on this game's)
    if (el && el.dataset.lm && !lmCard.contains(el)) {
      if (lmTag.contains(el)) return g && g.peek === el.dataset.lm ? openLmCard(el.dataset.lm) : startPeek(el.dataset.lm); // first tap: where it was; second: its photo
      if (el.dataset.gg === areaId) return openLmCard(el.dataset.lm);
    }
    const pk = ev.target.closest && ev.target.closest('[data-lmpeek]');
    if (pk && lmCard.contains(pk)) {
      const name = pk.dataset.lmpeek;
      const o = lmOver.find((x) => x.l.n === name);
      lmCard.hidden = true; // close the list and slide to the one picked (the drive stays paused while you look)
      if (g && lmCardPaused !== null) g.paused = lmCardPaused;
      lmCardPaused = null;
      if (o) {
        lmOver.splice(lmOver.indexOf(o), 1);
        syncMore();
        addLmItem(o.l, o.side, o.l.p, true);
      }
      return startPeek(name);
    }
    if (ev.target.closest && ev.target.closest('.gg-lmmore') === lmMore && !lmMore.hidden) return openLmList();
    if (!lmCard.hidden && lmCard.contains(ev.target) && !ev.target.closest('a')) closeLmCard(); // a tap anywhere on the card (or round it) closes it; the photo-credit link still opens
  });
  // "By the way": famous places within a block of you, as small chips in a stack at a quiet edge spot (a few at once when you
  // drive past several quickly). Tap a chip: the map slides back to where it is and the drive waits; tap it again for the
  // photo; tap the map (or the photo) to carry on.
  const lmTag = document.createElement('div');
  lmTag.className = 'gg-lmtag';
  lmTag.hidden = true;
  document.body.appendChild(lmTag);
  const lmItems = []; // the chips on screen: { l, el, timer }
  const lmOver = []; // landmarks that came up while two chips were already showing: { l, side }
  const LM_MAX = 2;
  const LM_SHOW_MS = 4200;
  const lmMore = document.createElement('div'); // "+3 more": tap for the list
  lmMore.className = 'gg-lmmore';
  lmMore.hidden = true;
  lmTag.appendChild(lmMore);
  let lmMoreTimer = 0;
  let lmSpot = null; // where the stack rests: { x, y }
  /**
   * Where the stack goes: one of a few resting spots near the top of the free map area (under the top card and the
   * neighborhood tag, never the middle and never near the bottom panel), whichever is least busy right now (few streets
   * and dots, clear of the car and the destination), leaning to the side the landmark is on. Chosen when the stack
   * appears; it just fades in and stays put (nudged only if the panel below grows into it).
   */
  function freeBand() {
    const pad = ctx.padding();
    return { T: pad.top + 30, B: window.innerHeight - pad.bottom - 6, R: Math.max(12, pad.right - 8) };
  }
  function placeLmTag(lp) {
    const cr = map.getContainer().getBoundingClientRect();
    const { T, B, R } = freeBand();
    const W = window.innerWidth, w = 190, h = 100;
    const spots = [{ x: 12, y: T }, { x: W - R - w, y: T }, { x: 12, y: T + 110 }, { x: W - R - w, y: T + 110 }].filter((q) => q.y + h <= B);
    const avoid = [carEl].filter(Boolean).map((el) => el.getBoundingClientRect());
    const tp = map.project(lp);
    const layers = ['gg-streets', 'gg-poi-dot', 'gg-trail', 'gg-best', 'gg-target', 'gg-goto'].filter((id) => map.getLayer(id));
    let best = null;
    for (const q of spots) {
      const box = [[q.x - cr.left, q.y - cr.top], [q.x + w - cr.left, q.y + h - cr.top]];
      let sc = layers.length ? map.queryRenderedFeatures(box, { layers }).length : 0;
      if (map.getLayer('gg-target')) sc += 100 * map.queryRenderedFeatures(box, { layers: ['gg-target'] }).length; // the destination dot stays clear
      for (const a of avoid) if (a.right > q.x - 10 && a.left < q.x + w + 10 && a.bottom > q.y - 10 && a.top < q.y + h + 10) sc += 200;
      sc += Math.hypot(tp.x + cr.left - (q.x + w / 2), tp.y + cr.top - (q.y + h / 2)) / 90; // near its landmark, a little
      if (!best || sc < best.sc) best = { q, sc };
    }
    lmSpot = best ? { x: best.q.x, y: best.q.y } : { x: 12, y: T };
    layoutLmTag();
  }
  /** Keep the stack inside the free band (the panel below changes height as you drive); with no room, it waits. */
  function layoutLmTag() {
    if (!lmSpot) return;
    const { T, B } = freeBand();
    const h = lmTag.offsetHeight;
    const y = Math.max(T, Math.min(lmSpot.y, B - h));
    lmTag.style.left = `${Math.round(lmSpot.x)}px`;
    lmTag.style.top = `${Math.round(y)}px`;
    lmTag.style.visibility = B - T < h ? 'hidden' : 'visible';
    updateLead();
  }
  function syncMore() {
    clearTimeout(lmMoreTimer);
    lmMore.hidden = !lmOver.length;
    lmMore.textContent = `+${lmOver.length} more`;
    if (lmOver.length) lmMoreTimer = setTimeout(() => { lmOver.length = 0; syncMore(); updateTagVisible(); }, LM_SHOW_MS + 2500);
  }
  function updateTagVisible() {
    lmTag.hidden = !lmItems.length && !lmOver.length;
    layoutLmTag();
  }
  function dropLmItem(it) {
    clearTimeout(it.timer);
    it.el.remove();
    const i = lmItems.indexOf(it);
    if (i >= 0) lmItems.splice(i, 1);
    updateTagVisible();
  }
  function hideLmTag() {
    for (const it of [...lmItems]) dropLmItem(it);
    lmOver.length = 0;
    syncMore();
    updateTagVisible();
  }
  /** The passed landmarks as dots on the map (and, on the end screen, the ones by the destination too). */
  function syncLmSeen() {
    if (!g || !map.getSource('gg-lmseen')) return;
    const list = [...new Map((g.lmSeen || []).map((l) => [l.n, l])).values()];
    if (g.done && G.landmarks) {
      const tp = targetPoint();
      const norm = (x) => x.toLowerCase().replace(/^the /, '').replace(/ \(.*\)$/, '');
      const isTarget = (l) => !!g.target.name && (norm(g.target.name).includes(norm(l.n)) || norm(l.n).includes(norm(g.target.name)));
      for (const l of G.landmarks) if (!list.some((x) => x.n === l.n) && metres(tp, l.p) < 170 && !isTarget(l)) list.push(l);
    }
    setData('gg-lmseen', { type: 'FeatureCollection', features: list.map((l) => ({ type: 'Feature', properties: { name: l.n }, geometry: { type: 'Point', coordinates: l.p } })) });
  }
  // a line from each chip to where its landmark is, kept on it as the map moves, so you can tell where it was
  const lmLead = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lmLead.setAttribute('class', 'gg-lmlead');
  lmLead.style.display = 'none';
  document.body.appendChild(lmLead);
  function updateLead() {
    if (!lmItems.length || lmTag.hidden || lmTag.style.visibility === 'hidden') {
      lmLead.style.display = 'none';
      return;
    }
    const cr = map.getContainer().getBoundingClientRect();
    const pad = ctx.padding();
    const W = window.innerWidth;
    let svg = '';
    for (const it of lmItems) {
      const tp = map.project(it.l.p);
      let x = tp.x + cr.left, y = tp.y + cr.top;
      const clamped = x < 14 || x > W - 14 || y < pad.top || y > window.innerHeight - pad.bottom;
      x = Math.max(14, Math.min(W - 14, x));
      y = Math.max(pad.top, Math.min(window.innerHeight - pad.bottom, y));
      const r = it.el.getBoundingClientRect();
      const sx = Math.max(r.left, Math.min(r.right, x)), sy = Math.max(r.top, Math.min(r.bottom, y));
      if (Math.hypot(x - sx, y - sy) < 6) continue; // right under the chip
      const cls = `${clamped ? ' far' : ''}${g && g.peek === it.l.n ? ' on' : ''}`;
      svg += `<g class="${cls.trim()}"><line class="u" x1="${sx}" y1="${sy}" x2="${x}" y2="${y}"/><line class="l" x1="${sx}" y1="${sy}" x2="${x}" y2="${y}"/><circle class="u" cx="${x}" cy="${y}" r="7"/><circle class="d" cx="${x}" cy="${y}" r="5"/></g>`;
    }
    lmLead.innerHTML = svg;
    lmLead.style.display = 'block';
  }
  map.on('move', updateLead);
  function addLmItem(l, side, p, force) {
    if (lmItems.some((it) => it.l.n === l.n)) return;
    if (lmItems.length >= LM_MAX) {
      if (!force) {
        // two are already up: this one waits behind a "+N more" chip (the dots on the map still show it)
        if (!lmOver.some((o) => o.l.n === l.n)) lmOver.push({ l, side });
        syncMore();
        updateTagVisible();
        return;
      }
      dropLmItem(lmItems[0]);
    }
    const pic = lmPic(l.n);
    const el = document.createElement('div');
    el.className = `gg-lmitem${pic ? '' : ' nopic'}`;
    el.dataset.lm = l.n;
    el.innerHTML = `${pic ? `<i>${pic}</i>` : ''}<div><b>${esc(l.n)}</b><span>${side}</span></div>`; // a picture and a name, nothing to read: the note is on the card
    const fresh = !lmItems.length && !lmOver.length;
    lmTag.insertBefore(el, lmMore);
    lmTag.hidden = false;
    const it = { l, el, timer: 0 };
    lmItems.push(it);
    if (fresh || !lmSpot) placeLmTag(l.p);
    else layoutLmTag();
    if (!(g && g.peek)) it.timer = setTimeout(() => dropLmItem(it), LM_SHOW_MS);
  }
  // "+N more": a short list of the landmarks that came up in a cluster; tap one to see where it was
  function openLmList() {
    if (!lmOver.length) return;
    const rows = [...lmItems.map((it) => ({ l: it.l })), ...lmOver].map((o) => `<button type="button" class="gg-lmrow" data-lmpeek="${esc(o.l.n)}">${lmPic(o.l.n) ? `<i>${lmPic(o.l.n)}</i>` : ''}<b>${esc(o.l.n)}</b></button>`).join('');
    lmCard.innerHTML = `<div class="gg-lmcard-in"><b>Just passed</b>${rows}<button type="button" class="gg-lmcard-x">Back to the drive</button></div>`;
    lmCard.hidden = false;
    if (g && !g.done && lmCardPaused === null) {
      lmCardPaused = g.paused;
      g.paused = true;
      render();
    }
  }
  /** Name the close landmarks that are still ahead of you or beside you, and which side they're on. */
  function noteLandmarks(p, heading, now) {
    if (!g || prefs.landmarks === false || !G.landmarks || (g.peek)) return;
    // the plan's ghost car and the real drive each get a landmark once (a corner you planned past is still new on the ride)
    const shown = planning() ? g.lmPlan || (g.lmPlan = new Set()) : g.lmShown || (g.lmShown = new Set());
    for (const [i, l] of G.landmarks.entries()) {
      if (shown.has(i)) continue;
      const d = metres(p, l.p);
      if (d >= 115) continue;
      const bearing = ((Math.atan2((l.p[0] - p[0]) * 84400, (l.p[1] - p[1]) * 111000) * 180) / Math.PI + 360) % 360;
      const rel = ((bearing - heading + 540) % 360) - 180;
      if (d >= 35 && Math.abs(rel) > 145) continue; // already behind you: not worth a chip
      shown.add(i);
      const side = d < 35 ? 'right here' : Math.abs(rel) < 35 ? 'ahead' : rel > 0 ? 'on your right' : 'on your left';
      addLmItem(l, side, p);
      if (!planning()) (g.lmSeen || (g.lmSeen = [])).push(l); // only real driving counts for the result
      logEv('lm', l.n, side);
    }
    if (!planning()) syncLmSeen();
  }
  // ---- peek: slide back to where a landmark was ---------------------------------------
  const lmRing = document.createElement('div');
  lmRing.className = 'gg-lmring';
  const lmRingMk = new maplibregl.Marker({ element: lmRing });
  const camOffsetY = () => {
    const pad = ctx.padding();
    const H = window.innerHeight;
    return pad.top + (H - pad.top - pad.bottom) * 0.62 - H / 2;
  };
  function startPeek(name) {
    const it = lmItems.find((x) => x.l.n === name);
    if (!g || !it || g.loading) return;
    if (!g.peek) {
      g.peekView = g.view;
      g.peekPaused = g.paused;
      g.paused = true; // the car waits while you look
    }
    g.peek = name;
    g.view = 'peek';
    for (const x of lmItems) {
      clearTimeout(x.timer);
      x.el.classList.toggle('on', x === it);
    }
    lmRingMk.setLngLat(it.l.p).addTo(map);
    const pad = ctx.padding();
    const H = window.innerHeight;
    // a gentle slide (not a snap), landmark centred in the open map
    map.easeTo({ center: it.l.p, offset: [0, pad.top + (H - pad.top - pad.bottom) * 0.5 - H / 2], duration: ctx.dur(520), easing: (t) => 1 - Math.pow(1 - t, 3) });
    render();
    updateLead();
  }
  function endPeek() {
    if (!g || !g.peek) return;
    g.peek = null;
    g.view = g.peekView || 'follow';
    g.paused = !!g.peekPaused;
    lmRingMk.remove();
    for (const x of lmItems) {
      x.el.classList.remove('on');
      x.timer = setTimeout(() => dropLmItem(x), 2500);
    }
    // slide back to the car, then the frame loop carries on following it
    const p = g.pos || g.trail[g.trail.length - 1];
    g.camHold = performance.now() + 560;
    map.easeTo({ center: p, zoom: g.view === 'overview' ? OV_ZOOM : driveZoom(), bearing: GRID, pitch: camPitch(), offset: [0, camOffsetY()], duration: ctx.dur(520), easing: (t) => 1 - Math.pow(1 - t, 3) });
    render();
  }
  function highlightHood(m, pulse, from) {
    if (!m || !m.geom || !map.getSource('gg-hood')) return;
    const polys = m.geom.type === 'Polygon' ? [m.geom.coordinates] : m.geom.coordinates;
    const feats = [{ type: 'Feature', properties: { k: 'f' }, geometry: m.geom }];
    for (const poly of polys) for (const ring of poly) feats.push({ type: 'Feature', properties: { k: 'l' }, geometry: { type: 'LineString', coordinates: ring } });
    setData('gg-hood', { type: 'FeatureCollection', features: feats });
    const lvl = (v) => {
      map.setPaintProperty('gg-hood-fill', 'fill-opacity', v.fill);
      map.setPaintProperty('gg-hood-line', 'line-opacity', v.line);
    };
    setHoodTag(m.n, pulse, from, g && g.hoodAhead);
    clearTimeout(hoodTimer);
    lvl(pulse ? HOOD_PULSE : HOOD_REST);
    if (pulse) hoodTimer = setTimeout(() => { if (map.getLayer('gg-hood-fill')) lvl(HOOD_REST); if (g && g.hoodNow === m.n) setHoodTag(m.n, false, null, g.hoodAhead); }, 2600);
  }
  function clearHood() {
    clearTimeout(hoodTimer);
    setHoodTag('');
    if (!map.getSource('gg-hood')) return;
    setData('gg-hood', EMPTY);
    map.setPaintProperty('gg-hood-fill', 'fill-opacity', 0);
    map.setPaintProperty('gg-hood-line', 'line-opacity', 0);
  }
  /** In the end ride: outline whichever neighborhood your car is in. */
  function watchHood(p) {
    const m = ctx.locate(p);
    if (!m || m.n === g.raceHood) return;
    const first = g.raceHood == null;
    g.raceHood = m.n;
    highlightHood(m, !first);
  }
  /** Note where we are: keep the neighborhoods driven through, and outline the current one. */
  function noteHood(p, quiet = false, heading = null) {
    if (!g || !p) return;
    const m = ctx.locate(p);
    const name = m ? m.n : null;
    // the next neighborhood, when a border is under 170 m ahead
    if (heading != null && name) {
      const r = (heading * Math.PI) / 180;
      const am = ctx.locate([p[0] + (Math.sin(r) * 170) / 84400, p[1] + (Math.cos(r) * 170) / 111000]);
      const an = am && am.n !== name ? am.n : null;
      if (an !== (g.hoodAhead || null)) {
        g.hoodAhead = an;
        if (name === g.hoodNow && !g.done && !planning()) setHoodTag(name, false, null, an);
      }
    }
    if (!name || name === g.hoodNow) return;
    const first = g.hoodNow == null;
    const from = g.hoodNow;
    g.hoodNow = name;
    if (!planning() && !g.done && g.passed[g.passed.length - 1] !== name) g.passed.push(name); // the plan's ghost jumps around: only real driving counts
    highlightHood(m, !first && !quiet, !first && !quiet ? from : null);
    if (first || quiet) return;
    logEv('hood', name);
    if (!planning() && !g.report && !g.startCard && !g.check && !g.done) render(); // the top card names it
  }

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
  // ---- the Lincoln Tunnel's overnight detour (Port Authority advisory, "Phase 1A (Dyer Deck Overs)") ----
  // The Expressway is closed 11 pm to 5 am on Tuesday, Wednesday and Thursday nights, and 9th Ave's entrance
  // ramps are closed with it: New Jersey-bound traffic goes north on 10th or 11th Ave to Galvin Plaza.
  // The advisory gave about 120 days from April 22, 2026, and closures were still announced in late
  // September; the real end date (thought to be around January or February 2027) isn't confirmed, so this
  // date is an assumption. Options: Auto (follows the clock in New York), Always on, Off.
  const DETOUR_THROUGH = '2027-02-28'; // (only used when the alert history can't be read)
  let SCN_DATA = null; // data/lincoln-scenarios.json: how often the Lincoln Tunnel was in each state, by weekday and hour, from the Port Authority's alerts
  let scn = null; // this round's practice time and Lincoln Tunnel conditions: { day, hour, min, kind: 'usual' | 'expressway' | 'northtube', label, say }
  const DAYNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const SCN_SAY = {
    usual: 'all tubes open',
    expressway: 'Expressway closed overnight: north on 10th or 11th Ave to Galvin Plaza',
    northtube: 'North Tube to NJ closed (Center Tube open): on 10th Ave turn right on 40th St to Galvin Plaza',
  };
  const mkScn = (day, hour, min, kind) => ({
    day, hour, min, kind, say: SCN_SAY[kind],
    label: `${DAYNAMES[day]} ${hour % 12 || 12}:${String(min).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`,
  });
  const nyNow = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { day: DAYNAMES.indexOf(parts.weekday), hour: +parts.hour, min: +parts.minute, date: `${parts.year}-${parts.month}-${parts.day}` };
  };
  /** Is the overnight detour still running at all? The alert history says when the Expressway was last closed; without it, a guessed end date. */
  const detourRunning = (date) => (SCN_DATA && SCN_DATA.lastExpresswayClosure ? Date.now() - Date.parse(SCN_DATA.lastExpresswayClosure) <= 21 * 864e5 : date <= DETOUR_THROUGH);
  /** The real clock: the Tue-Thu 11 pm to 5 am Expressway closure, if it's still running. */
  function realKind() {
    const t = nyNow();
    if (!detourRunning(t.date)) return 'usual';
    return (t.hour >= 23 && t.day >= 2 && t.day <= 4) || (t.hour < 5 && t.day >= 3 && t.day <= 5) ? 'expressway' : 'usual';
  }
  const wpick = (w) => {
    let r = Math.random() * w.reduce((x, y) => x + y, 0);
    for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return i;
    return w.length - 1;
  };
  /**
   * A practice time and the Lincoln Tunnel's state at that time. Varied (the default): a random weekday and hour, mornings,
   * days and evenings most often, then the state from how often the real alert history had the Expressway closed, or the
   * North Tube closed to New Jersey, in that weekday-hour (so the odd ones are rarer, and come in the hours they really happen).
   */
  function pickScenario(saved) {
    if (saved && saved.kind) return mkScn(saved.day, saved.hour, saved.min, saved.kind);
    const mode = prefs.lteDetour || 'auto';
    const t = nyNow();
    if (mode === 'now' || (mode === 'auto' && !SCN_DATA)) return mkScn(t.day, t.hour, t.min, realKind());
    if (mode === 'on') return mkScn(3, 0 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 60), 'expressway');
    const hw = SCN_DATA ? SCN_DATA.hourWeight : Array(24).fill(1);
    const dw = SCN_DATA ? SCN_DATA.dayWeight : Array(7).fill(1);
    const day = wpick(dw), hour = wpick(hw), min = Math.floor(Math.random() * 60);
    if (mode === 'off' || !SCN_DATA) return mkScn(day, hour, min, 'usual');
    const i = day * 24 + hour;
    const pe = detourRunning(t.date) ? SCN_DATA.pExpressway[i] : 0;
    const pn = SCN_DATA.pNorthTube[i];
    const r = Math.random();
    return mkScn(day, hour, min, r < pe ? 'expressway' : r < pe + (1 - pe) * pn ? 'northtube' : 'usual');
  }
  /** Point each tunnel destination at the entrances open right now (the detour's, or the usual ones). */
  function applyGates() {
    const night = (scn ? scn.kind : realKind()) !== 'usual';
    for (const pl of G.places) {
      if (!pl.gateList) continue;
      const hasNight = pl.gateList.some((x) => x.night);
      const act = pl.gateList.filter((x) => !hasNight || x.night === night);
      if (!act.length) continue;
      for (const n of pl.gateNodes || []) G.gateSets.delete(n);
      pl.gates = act.map((x) => x.id);
      pl.gateNodes = [...new Set(act.map((x) => x.node))];
      pl.node = act[0].node;
      pl.detour = hasNight && night;
      const when = scn && hasNight ? `${scn.label} · ` : '';
      pl.how = pl.detour
        ? `${when}${scn ? scn.say : SCN_SAY.expressway}`
        : hasNight
          ? `${when}${scn ? 'tubes open: ' : ''}in via the 30th St, 33rd St, Dyer Ave or 9th Ave ramps`
          : `in via ${[...new Set(act.map((x) => x.label))].join(' or ')}`;
      const set = new Set(pl.gates);
      for (const n of pl.gateNodes) G.gateSets.set(n, set);
    }
  }
  // ---- the entrance streets: highlighted, with slow arrows, for the conditions this round ----
  /** The links that lead you into this tunnel entrance now: the detour's 10th and 11th Ave northbound, or the ramps' own approach streets. */
  function corridorEdges(pl) {
    const out = new Set(pl.gates || []);
    if (!pl.gates || !pl.gates.length) return out;
    if (pl.detour) {
      const gn = G.nodes[pl.node];
      for (const e of G.edges) {
        if (e.name !== '10th Ave' && e.name !== '11th Ave') continue;
        if (angd(e.b0, GRID) > 40) continue; // northbound only
        const to = G.nodes[e.to];
        const south = (gn[1] - to[1]) * 111000; // metres south of the plaza
        if (south > -40 && south < 1100) out.add(e.id);
      }
    } else {
      for (const id of pl.gates) {
        let e = G.edges[id], run = 0;
        while (run < 300) {
          const p = G.inn[e.from].find((x) => short(x.name) === short(e.name) && angd(x.b1, e.b0) < 50 && !out.has(x.id));
          if (!p) break;
          out.add(p.id);
          run += p.len;
          e = p;
        }
      }
    }
    return out;
  }
  const DASH_FRAMES = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
  let flowTimer = 0;
  function stopFlow() {
    clearInterval(flowTimer);
    flowTimer = 0;
  }
  /** Show (or with null, clear) the entrance streets; the dashes move along them in the direction of travel, slowly. */
  function setCorridor(pl) {
    stopFlow();
    if (!map.getSource('gg-corridor')) return;
    if (!pl || !pl.gates) return setData('gg-corridor', EMPTY);
    const feats = [...corridorEdges(pl)].map((id) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: G.edges[id].pts } }));
    setData('gg-corridor', { type: 'FeatureCollection', features: feats });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    flowTimer = setInterval(() => {
      if (!map.getLayer('gg-corridor-flow')) return stopFlow();
      i = (i + 1) % DASH_FRAMES.length;
      map.setPaintProperty('gg-corridor-flow', 'line-dasharray', DASH_FRAMES[i]);
    }, 170);
  }
  // ---- the curb: every destination is one corner of an intersection (NE, SE, SW or NW on the grid) ----
  // You finish by arriving with that corner on your right, as a driver would pull up to the curb.
  // On a one-way street the left curb counts too (you can stop on either side there).
  const QB = { NE: 45, SE: 135, SW: 225, NW: 315 }; // bearing of each corner, clockwise from uptown
  const QNAME = { NE: 'northeast', SE: 'southeast', SW: 'southwest', NW: 'northwest' };
  const angd = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  /**
   * 'right' / 'left' when edge e arrives along a street that borders corner `quad` (the corner is just
   * behind the intersection, beside you, or just ahead of it); null when the street doesn't touch it.
   */
  function arrivalSide(e, quad) {
    const qb = GRID + QB[quad];
    if (angd(e.b1 + 180, qb) > 62 && angd(e.b1, qb) > 62) return null;
    return ((qb - e.b1 + 540) % 360) - 180 > 0 ? 'right' : 'left';
  }
  const twoWay = (e) => G.out[e.to].some((o) => short(o.name) === short(e.name) && angd(o.b0, e.b1 + 180) < 30);
  function arrivalOK(e, quad) {
    if (!quad) return true;
    const side = arrivalSide(e, quad);
    return side === 'right' || (side === 'left' && !twoWay(e));
  }
  const atTarget = (e, node) => (g.target.gates ? g.target.gates.includes(e.id) : node === g.target.node && arrivalOK(e, g.target.quad));
  /** A corner of `node` you can pull up to: the landmark's own corner when known, else any from the right. */
  function chooseQuad(node, name) {
    const side = (q, e) => arrivalSide(e, q);
    const right = Object.keys(QB).filter((q) => G.inn[node].some((e) => e.core && side(q, e) === 'right'));
    // the corner(s) a landmark really occupies come with the street data (CORNERS in tools/build_streets.py)
    const pl = G.places.find((p) => p.node === node && p.name === name);
    const known = ((pl && pl.quads) || []).filter((q) => G.inn[node].some((e) => e.core && arrivalOK(e, q)));
    if (known.length) return rand(known);
    return right.length ? rand(right) : null;
  }
  /** The destination's pin, on its corner rather than the middle of the intersection. */
  function targetPoint() {
    const n = G.nodes[g.target.node], q = g.target.quad;
    if (!q) return n;
    const b = ((GRID + QB[q]) * Math.PI) / 180;
    return [n[0] + (Math.sin(b) * 22) / 84400, n[1] + (Math.cos(b) * 22) / 111000];
  }
  const wrongSide = (e) => {
    const t = g.target, side = arrivalSide(e, t.quad);
    const where = `the ${QNAME[t.quad]} corner`;
    return side === 'left' ? `🏁 ${where} is on your left here. Go around and come in with it on your right.` : `🏁 Not this way in. Arrive with ${where} on your right: go around the block.`;
  };
  function shortest(e0, t, s = 0, quad) {
    const qd = quad !== undefined ? quad : g && g.target && g.target.node === t ? g.target.quad : null;
    const c0 = e0.len - s;
    const dist = new Map([[e0.id, c0]]);
    const prev = new Map();
    const heap = new Heap();
    heap.push({ e: e0, c: c0 });
    while (heap.size) {
      const { e, c } = heap.pop();
      if (c > dist.get(e.id)) continue;
      const gs = G.gateSets.get(t);
      if (gs ? gs.has(e.id) : e.to === t && arrivalOK(e, qd)) {
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
      // the car stops at a named corner, and where the road ends in a turn
      const nx = c.decision ? (c.named ? null : c.straight) : c.only && carries(cur, c.only) ? c.only : null;
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
  /** A round from a saved description {e0, s0, target, entry} (same route again, a saved trip). */
  function roundFrom(rt) {
    const e0 = G.edges[rt.e0];
    if (!e0 || !G.nodes[rt.target.node]) return null;
    const pl = G.places.find((p) => p.name === rt.target.name && p.gates);
    if (pl) rt = { ...rt, target: { ...rt.target, node: pl.node, gates: pl.gates, how: pl.how, detour: pl.detour, quad: null } };
    const quad = pl ? null : rt.target.quad || chooseQuad(rt.target.node, rt.target.name);
    if (!pl && !quad) return null;
    const best = shortest(e0, rt.target.node, rt.s0 || 0, quad);
    if (!best) return null;
    const entry = rt.entry != null ? G.entries.find((en) => en.link === rt.entry && en.from === rt.entryFrom) || null : null;
    return { e0, s0: rt.s0 || 0, target: { ...rt.target, quad, label: G.label(rt.target.node) }, best, entry };
  }
  const routeOf = (r) => ({ e0: r.e0.id, s0: r.s0, target: { name: r.target.name, node: r.target.node, quad: r.target.quad }, entry: r.entry ? r.entry.link : null, entryFrom: r.entry ? r.entry.from : null, scn });
  const routeKey = (rt) => `${rt.e0}:${Math.round(rt.s0 || 0)}>${rt.target.node}${rt.target.quad || ''}`;
  let lastTargetNode = null; // a new round never goes to the same place as the one before
  // ---- street tiers (Downtown: from tools/build_tiers.py): 1 = the spine, 2 = connectors, 3 = local named streets; 0 = no tier data ----
  const tierOf = (name) => (G.d.tiers ? G.d.tiers[short(name)] || 3 : 0);
  /** A random corner, leaning to the ones on the streets worth knowing (two spine streets ~4x, two local streets ~1/8th). */
  function pickCorner(list) {
    if (!G.d.tiers || prefs.backbone === 'all') return rand(list);
    const W = G.cornerW || (G.cornerW = new Map());
    const w = (n) => {
      if (!W.has(n)) {
        // by the two best streets that meet there: spine + spine ~4, spine + local ~0.7, local + local ~0.12
        const ts = [...new Set([...G.out[n], ...G.inn[n]].filter((e) => !G.RAMP.test(e.name)).map((e) => short(e.name)))].map(tierOf).sort((a, b) => a - b).slice(0, 2);
        const f = (t) => (t === 1 ? 2 : t === 2 ? 1.2 : 0.35);
        W.set(n, ts.reduce((a, t) => a * f(t), 1));
      }
      return W.get(n);
    };
    let r = Math.random() * list.reduce((a, n) => a + w(n), 0);
    for (const n of list) if ((r -= w(n)) < 0) return n;
    return list[list.length - 1];
  }
  function pickRound(forced) {
    if (forced) return roundFrom(forced);
    // now and then, a trip you saved, or back to a corner you got wrong
    const trips = mem.get('trips', []);
    if (prefs.trips && trips.length && Math.random() < 0.3) {
      const r = roundFrom(rand(trips));
      if (r) return { ...r, kind: 'trip' };
    }
    const mistakes = mem.get('mistakes', []);
    if (mistakes.length && Math.random() < 0.35) {
      const m = rand(mistakes);
      const e0 = G.edges[m.link];
      if (e0 && e0.core) {
        const r = pickTarget(e0, 0, null);
        if (r) return { ...r, kind: 'revisit', mistake: m };
      }
    }
    return pickRandom();
  }
  /** A destination for a round that starts on link e0. */
  function pickTarget(e0, s0, entry) {
    const coreNodes = [];
    for (let n = 0; n < G.nodes.length; n++) if (isCore(n) && G.real(n) && G.plain(n) && G.streetsAt(n) >= 2 && inArea(n)) coreNodes.push(n);
    const places = G.places.filter((p) => inArea(p.node));
    for (let tries = 0; tries < 200; tries++) {
      const target = places.length && Math.random() < 0.7 ? { ...rand(places) } : { name: null, node: pickCorner(coreNodes) };
      target.label = G.label(target.node);
      if (target.node === lastTargetNode) continue;
      target.quad = target.gates ? null : chooseQuad(target.node, target.name);
      if (!target.gates && !target.quad) continue;
      const dm = metres(G.nodes[e0.from], G.nodes[target.node]);
      if (dm < 400 || dm > 2800) continue;
      if (straightTo(e0, target.node)) continue;
      const best = shortest(e0, target.node, s0, target.quad);
      if (!best || best.path.length < 4) continue;
      return { e0, s0, target, best, entry };
    }
    return null;
  }
  // Starts at the ways you actually come in (the GWB, the Lincoln and Holland Tunnels) come up far more often.
  const MAIN_ENTRY = /George Washington|GWB|Lincoln Tunnel|Holland Tunnel/;
  function pickEntry(list) {
    // the GWB by the east side (Google's own route to the UN: I-87, I-278, then the FDR to exit 8) is the less usual way down
    const w = list.map((en) => (/exit 8/.test(en.from) ? 2 : /FDR/.test(en.from) ? 1 : /GWB.*West Side/.test(en.from) ? 4 : MAIN_ENTRY.test(en.from) ? 5 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((r -= w[i]) < 0) return list[i];
    return list[list.length - 1];
  }
  function pickRandom() {
    const coreNodes = [];
    for (let n = 0; n < G.nodes.length; n++) if (isCore(n) && G.real(n) && G.plain(n) && G.streetsAt(n) >= 2 && inArea(n)) coreNodes.push(n);
    const places = G.places.filter((p) => inArea(p.node));
    const entries = G.entries.filter((en) => inArea(en.landsAt));
    const useEntry = entries.length && (prefs.from === 'entries' || (prefs.from === 'both' && Math.random() < 0.5));
    const wantBack = Math.random() < 0.05;
    for (let tries = 0; tries < 300; tries++) {
      const target = places.length && Math.random() < 0.7 ? { ...rand(places) } : { name: null, node: pickCorner(coreNodes) };
      target.label = G.label(target.node);
      if (target.node === lastTargetNode) continue;
      target.quad = target.gates ? null : chooseQuad(target.node, target.name);
      if (!target.gates && !target.quad) continue;
      let e0, s0 = 0, entry = null;
      if (useEntry) {
        entry = pickEntry(entries);
        // A trip that ends where it began (out of the Lincoln Tunnel, back to it) is rare on purpose:
        // about 1 in 20 of the rounds that start at a crossing the map has a destination for.
        const crossing = (t) => ((t || '').toLowerCase().match(/lincoln|holland|queensboro|queens-midtown|brooklyn bridge|brooklyn-battery|manhattan bridge|williamsburg/) || [])[0];
        const same = crossing(entry.from);
        const back = same && places.find((p) => crossing(p.name) === same);
        if (back && wantBack) {
          Object.assign(target, back, { label: G.label(back.node), quad: back.gates ? null : chooseQuad(back.node, back.name) });
          if (!target.gates && !target.quad) continue;
        } else if (target.name && same && same === crossing(target.name)) continue;
        ({ e: e0, s: s0 } = entryStart(entry));
      } else {
        const n = rand(coreNodes);
        const outs = G.out[n].filter((o) => o.core);
        if (!outs.length) continue;
        e0 = rand(outs);
      }
      const dm = metres(G.nodes[e0.from], G.nodes[target.node]);
      if (dm < 400 || dm > (entry ? 4000 : 2800)) continue;
      if (straightTo(e0, target.node)) continue; // already on the right road
      const best = shortest(e0, target.node, s0, target.quad);
      if (!best || best.path.length < 4) continue;
      return { e0, s0, target, best, entry };
    }
    return null;
  }

  // ---- a round ---------------------------------------------------------------------------
  async function start(opts, forced = null) {
    stop();
    g = { opts, loading: true };
    const token = g;
    render();
    try {
      await load();
    } catch {
      if (g === token) ctx.hud(`<div class="qkind">🚕 ${AREA.title}</div><div class="q">Couldn’t load the street map.</div>`);
      return;
    }
    if (g !== token) return;
    scn = pickScenario(forced && forced.scn);
    applyGates();
    const r = pickRound(forced);
    if (r) lastTargetNode = r.target.node;
    if (!r) {
      ctx.hud(`<div class="qkind">🚕 ${AREA.title}</div><div class="q">No route found here; try another area.</div>`);
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
      cruise: 0,
      driven: -r.s0, wrong: 0, trail: [posOnEdge(r.e0, r.s0).p], msg: '', msgAt: 0, lastNote: null,
      last: performance.now(), raf: 0, view: 'follow',
      check: null, lastCheck: performance.now() - CHECK_EVERY_MS / 2, checks: 0, checksRight: 0, resumeAt: 0,
      startCard: true, // the briefing: up until you tap Go
      guess: null, peeks: 0, peekUntil: 0,
      route: routeOf(r), kind: forced ? 'replay' : r.kind || 'random', mistake: r.mistake || null,
      path: [], newBlocks: 0, hints: 0, goAt: 0,
    };
    g.targetHood = hood(G.nodes[r.target.node]);
    const tp = G.nodes[r.target.node];
    setData('gg-target', EMPTY); // shown once you've driven off (it would give the briefing's guess away)
    setData('gg-trail', EMPTY);
    setData('gg-best', EMPTY);
    setCorridor(null);
    setData('gg-lmseen', EMPTY);
    setData('gg-goto', EMPTY);
    setData('gg-streets', streetsFC || EMPTY);
    setData('gg-elev', elevFC);
    setData('gg-arrows', arrowsFC || EMPTY);
    setData('gg-poi', G.poi || (G.poi = poiFeatures()));
    showPoi(false);
    showArrows();
    showLabels(prefs.labels);
    showCover();
    carMk.setLngLat(g.trail[0]).addTo(map);
    g.log = {
      t0: performance.now(), at: new Date().toISOString(), area: areaId, data: G.dataKey, scn: scn ? `${scn.label} ${scn.kind}` : null, pace: prefs.pace, guide: prefs.guide,
      labels: prefs.labels, kind: g.kind, route: g.route, target: g.target.name || g.target.label, best: Math.round(g.best.cost), ev: [],
    };
    logEv('start', g.e.id, Math.round(g.s));
    g.passed = [];
    g.hoodNow = null;
    noteHood(g.trail[0] || g.e.pts[0], true);
    enterEdge(g.e);
    g.msg = '';
    render();
    map.jumpTo({ center: g.trail[0], zoom: ZOOM, bearing: GRID, pitch: 0 });
    // plan, then ride: the plan screen is the start (where you are, where you're going, then the plan)
    if (prefs.style === 'plan') go0();
    g.raf = requestAnimationFrame(tick);
    window.addEventListener('keydown', onKey);
  }

  function stop() {
    clearHood();
    hideLmTag();
    document.body.classList.remove('gg-end');
    stopFlow();
    setData('gg-corridor', EMPTY);
    lmRingMk.remove();
    carEl.classList.remove('gg-ovcar');
    if (!g) return;
    keepLog();
    cancelAnimationFrame(g.raf);
    window.removeEventListener('keydown', onKey);
    g = null;
    carMk.remove();
    bestMk.remove();
    splitMk.remove();
    hideTags();
    offEl.hidden = true;
    lockMap(false);
    declutter(false);
    document.body.classList.remove('gridding');
    for (const id of ['gg-trail', 'gg-best', 'gg-target', 'gg-goto', 'gg-cover', 'gg-hood']) setData(id, EMPTY);
    showLabels(true);
    showPoi(false);
    if (map.getLayer('gg-arrows')) map.setLayoutProperty('gg-arrows', 'visibility', 'none');
    map.setGlobalStateProperty('quiet', ctx.mode === 'practice');
  }

  const onKey = (e) => {
    if (e.target && e.target.closest && e.target.closest('textarea, input, select, [contenteditable]')) return; // typing a note is not driving
    if (!g || g.done || g.loading) return;
    if (g.startCard) {
      if (e.key === 'Enter') go0();
      return;
    }
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
      if (atTarget(via, node)) {
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
  /** What a way out is called on its button: the ramp up to the Park Ave Viaduct is "Park Ave" in the city's data, but it's the viaduct. */
  /** A small gold star after a spine street's name (the ones worth learning first). */
  const spineMark = (name) => (tierOf(name) === 1 ? ' <span class="spine" title="a street worth knowing">★</span>' : '');
  const optName = (o) => (o.name === 'Park Ave' && /Viaduct/.test(G.label(o.to)) ? 'Park Ave Viaduct' : short(o.name));
  /** The cross street at the end of edge e (the next corner), if it's a real intersection. */
  function crossAt(e) {
    const names = [];
    for (const o of [...G.out[e.to], ...G.inn[e.to]]) if (short(o.name) !== short(e.name) && !names.includes(o.name)) names.push(o.name);
    // streets, not ramps; where two cross at one corner (5th Ave and Broadway at 23rd St) name both,
    // so a chip never says "5th Ave" for a corner you'd reach by Broadway
    const streets = [...new Set(names.filter((x) => !G.RAMP.test(x)).map(short))];
    if (streets.length) return streets.slice(0, 2).join(' / ');
    return names[0] ? short(names[0]) : null;
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
  /** The briefing: where you are, which way you face, what's next. */
  /** A famous place within a block of a point, if there is one ("Grand Central"). */
  function placeNear(p, within = 130) {
    let best = null;
    for (const pl of G.places) {
      const d = metres(G.nodes[pl.node], p);
      if (d < within && (!best || d < best.d)) best = { d, name: pl.name };
    }
    return best ? best.name.replace(/^the /, '').replace(/ \(.*\)$/, '') : null;
  }
  /** "Name · Street & Street", or just the streets when it has no name (or the streets already say it). */
  /** The logged landmark a place is: by name, else the closest one within 75 m of the point. */
  function lmHit(name, pt) {
    let l = name ? lmFind(name) : null;
    if (!l && pt) {
      let d = 75;
      for (const x of LM_ALL) {
        const m = metres(pt, x.p);
        if (m < d) {
          d = m;
          l = x;
        }
      }
    }
    return l;
  }
  /** A place in the top card or the start line. If it's a famous spot we have logged, tapping it opens the photo card (quietly: no button). */
  function placeText(name, label, pt) {
    const l = lmHit(name, pt);
    const wrap = (h) => (l ? `<span class="lmsoft" data-lm="${esc(l.n)}" data-gg="${areaId}">${h}</span>` : h);
    if (!name) return wrap(`<b>${esc(label)}</b>`);
    const bare = name.replace(/^the /i, '').toLowerCase();
    return wrap(label.toLowerCase().includes(bare) ? `<b>${esc(label)}</b>` : `<b>${esc(name)}</b> <span class="muted">· ${esc(label)}</span>`);
  }
  /** Where you are: a famous spot if there is one, then the street you're on and the next one. */
  function briefYou() {
    const p = g.pos || g.trail[0];
    const nx = nextCross(g.e);
    const name = g.entry ? g.entry.from.replace(/^the /, '') : placeNear(p);
    const streets = nx ? `${short(g.e.name)} & ${nx}` : short(g.e.name);
    return `${placeText(name, streets, p)} <span class="muted">· facing ${headWord(g.e.name, g.e.b0)}</span>`;
  }
  /** Act on touch-down (and on a keyboard "click", which has no pointer). */
  function onTap(el, fn) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      fn();
    });
    el.addEventListener('click', (e) => {
      if (e.detail === 0) fn();
    });
  }
  /** "Go to: Spring · Prince · Houston…": the corners ahead on this road, to zip to. */
  function chipsRow() {
    const cs = cornersAhead(8);
    if (cs.length < 2 || g.check) return '';
    return `<div class="ggchips"><span class="lbl">Go to</span>${cs
      .map((c, i) => `<button class="ggchip${c.node === g.goTo ? ' on' : ''}" data-node="${c.node}">${atTarget(c.via, c.node) ? '🏁 ' : ''}${esc(prefs.labels ? short(c.name) : `+${i + 1}`)}</button>`)
      .join('')}</div>`;
  }
  /** Hard mode check-in: "What street are you on?" */
  function answerName(name) {
    const c = g.check;
    if (!c || c.kind !== 'name') return;
    const ok = name === c.answer;
    g.checks++;
    if (ok) g.checksRight++;
    g.check = null;
    g.lastCheck = performance.now();
    g.resumeAt = performance.now() + 900;
    say(`${ok ? '✓' : '✗'} You're on ${short(c.answer)}`);
    render();
  }
  /** The next corner where something happens (a choice, or the road ending in a turn): {via, c, name}. */
  function nextTurnCorner() {
    const chain = g.waiting ? [{ node: g.e.to, via: g.e }] : aheadChain(g.e, 40, 3000);
    for (const { via } of chain) {
      const c = choices(via);
      if (c.decision || (c.only && !carries(via, c.only))) return { via, c, name: short(crossAt(via) || G.label(via.to)) };
    }
    return null;
  }
  /** The briefing: where you're going. */
  const cornerTag = (t) =>
    t.gates
      ? `<span class="gg-how">${esc(t.how || `in via ${[...new Set(t.gates.map((id) => short(G.edges[id].name)))].join(' or ')}`)}</span>`
      : t.quad
        ? ` <span class="muted">· ${t.quad} corner</span>`
        : '';
  function briefTo() {
    const t = g.target;
    const why =
      g.kind === 'revisit' && g.mistake
        ? `<br><span class="muted">↺ Practice: ${esc(g.mistake.corner)}</span>`
        : g.kind === 'trip'
          ? '<br><span class="muted">★ Saved trip</span>'
          : g.kind === 'replay'
            ? '<br><span class="muted">↻ Same route</span>'
            : '';
    return `${placeText(t.name, t.label, targetPoint())}${cornerTag(t)}${why}`;
  }

  // ---- check-ins: "You're heading downtown. Which side is the Hudson?" ----------------------
  function maybeCheckIn(now) {
    if (true || !prefs.checkins || g.startCard || g.auto || g.check || g.done || g.waiting || g.home || g.goTo != null || g.queued || g.paused || g.view !== 'follow') return;
    if (now - g.lastCheck < CHECK_EVERY_MS || !g.e.core || g.e.len < 60 || g.s < g.e.len * 0.25 || g.s > g.e.len * 0.6) return;
    if (!prefs.labels && Math.random() < 0.6) {
      // hard mode: which street is this? (the real one and two nearby)
      const near = new Set();
      for (let n = 0; n < G.nodes.length; n++) {
        if (metres(G.nodes[n], g.pos) > 350) continue;
        for (const o of G.out[n]) if (o.name !== g.e.name && !G.RAMP.test(o.name) && short(o.name) !== short(g.e.name)) near.add(o.name);
      }
      const others = [...near].sort(() => Math.random() - 0.5).slice(0, 2);
      if (others.length === 2) {
        g.check = { kind: 'name', answer: g.e.name, options: [g.e.name, ...others].sort(() => Math.random() - 0.5), t0: now };
        g.msg = '';
        render();
        return;
      }
    }
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

  /** Seconds this block takes (the classic rhythm). */
  const blockSeconds = (len) => Math.max(BLOCK_MIN_S, 0.55 + len / 168) * PACE[prefs.pace];
  function updateSpeed() {
    const f = g.home ? (g.plan && g.plan.riding ? RIDE_F[prefs.rideSpeed] || RIDE_F.steady : HOME_SPEED) : g.goTo != null ? GOTO_SPEED : g.boost ? HOLD_SPEED : 1;
    g.v = g.e.len / (blockSeconds(g.e.len) * f);
    if (g.goTo != null) g.v = Math.max(g.v, g.gotoV || 0);
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
    if (g.peekUntil && now >= g.peekUntil) {
      g.peekUntil = 0;
      render();
    }
    if (!g.hintShown && hintReady()) {
      g.hintShown = true;
      render();
    }
    if (!g.paused && !g.done && !g.waiting && g.view !== 'intro' && !g.check && !g.startCard && now >= g.resumeAt) {
      g.s += dt * updateSpeed();
      let guard = 0;
      while (g && !g.done && !g.waiting && g.s >= g.e.len && guard++ < 50) {
        const over = g.s - g.e.len;
        arrive();
        if (g && !g.waiting && !g.done) g.s = Math.min(over, g.e.len);
      }
    }
    if (!g) return;
    if (g.waiting) g.v = 0;
    const { p, b } = planning()
      ? { p: g.plan.pos, b: g.plan.phase === 'corner' ? g.plan.cur.b0 : g.plan.cur.b1 }
      : g.waiting || g.done
        ? { p: g.e.pts[g.e.pts.length - 1], b: g.e.b1 }
        : posOnEdge(g.e, g.s);
    g.pos = p;
    g.bnow = b;
    if (!g.startCard && !g.done && now - (g.hoodAt || 0) > 250) {
      g.hoodAt = now;
      noteHood(p, false, planning() ? null : b);
      noteLandmarks(p, b, now);
    }
    const hc = `${gridDir(b)}${onGrid(g.e.name, b) ? '' : compassWord(b)}${choices(g.e).named ? 'n' : ''}`;
    if (hc !== g.lastHC) {
      g.lastHC = hc;
      render(); // the compass words on Left / Right follow your heading
    }
    // (no spontaneous check-ins: nothing interrupts the round)
    if (g.bestRide && g.plan && g.plan.riding && !g.done) {
      const ab = atLine(g.bestRide, Math.max(0, g.driven + g.s));
      g.bestPos = ab.p;
      tagFor(bestTag, g.bestRide.marks, Math.max(0, g.driven + g.s), ab.p, g, 'bestMarkI');
      bestMk.setLngLat(ab.p);
      if (ab.brg != null) bestMk.setRotation(ab.brg);
      setData('gg-best', line([...g.bestRide.pts.slice(0, ab.k), ab.p]));
    }
    if (!g.replay) {
      carMk.setLngLat(p);
      carMk.setRotation(b);
    }
    carEl.classList.toggle('sigL', g.queued === 'L');
    carEl.classList.toggle('sigR', g.queued === 'R');
    if ((g.view === 'follow' || g.view === 'overview') && !g.done && !(g.camHold > performance.now())) {
      const ZM = g.view === 'overview' ? OV_ZOOM : driveZoom();
      const PT = camPitch(); // (the wide, neighborhood-sized view follows the car too)
      const pad = ctx.padding();
      const H = window.innerHeight;
      // the car a little below the middle of the open area: more road ahead
      const oy = pad.top + (H - pad.top - pad.bottom) * 0.62 - H / 2;
      if (planning()) {
        // the ghost car jumps from corner to corner: one eased move per jump that really arrives
        // (restarting an ease every frame leaves the camera forever a little behind)
        const key = `${p[0]},${p[1]},${oy | 0}`;
        if (g.camKey !== key) {
          g.camKey = key;
          const far = g.camP ? Math.hypot((p[0] - g.camP[0]) * 84400, (p[1] - g.camP[1]) * 111000) : 0;
          g.camP = p;
          map.easeTo({ center: p, zoom: ZM, bearing: GRID, pitch: PT, offset: [0, oy], duration: Math.min(650, 260 + far * 0.25), easing: (t) => 1 - Math.pow(1 - t, 3) });
        }
      } else if (g.plan && g.plan.riding && g.bestRide) {
        // both cars in view: centre between them, zoom out as far as they're apart
        g.camKey = null;
        const bp = g.bestPos || p;
        const sep = meters(p, bp);
        const c = [(p[0] + bp[0]) / 2, (p[1] + bp[1]) / 2];
        // keep both cars well inside the open map: their gap may use half of the short side
        const mpp = (78271.5 * Math.cos((p[1] * Math.PI) / 180)) / Math.pow(2, ZOOM);
        const openH = H - pad.top - pad.bottom;
        const allowed = 0.5 * Math.min(window.innerWidth, openH);
        const z = Math.max(12.5, ZOOM - Math.log2(Math.max(1, sep / (mpp * allowed))));
        map.easeTo({ center: c, zoom: z, bearing: GRID, pitch: 0, offset: [0, pad.top + openH * 0.5 - H / 2], duration: 0 });
      } else {
        g.camKey = null;
        map.easeTo({ center: p, zoom: ZM, bearing: GRID, pitch: PT, offset: [0, oy], duration: 0 });
      }
    }
    pointToTarget();
    g.raf = requestAnimationFrame(tick);
  }

  /** At the end of g.e: finish, stop at a tapped corner, take the chosen way, carry on, or wait. */
  function arrive() {
    const e = g.e;
    const n = e.to;
    g.driven += e.len - (e.chord || 0);
    g.path.push(e.id);
    if (e.core) {
      if (!g.drivenSet) g.drivenSet = new Set(mem.get('driven', []));
      if (!g.drivenSet.has(e.shape)) {
        g.drivenSet.add(e.shape);
        g.newBlocks++;
      }
    }
    (g.marks || (g.marks = [])).push({ idx: g.trail.length - 1, name: e.name });
    g.trail.push(...e.pts.slice(1));
    noteHood(e.pts[e.pts.length - 1], true); // (a fast ride can cross a small one between frames)
    setData('gg-trail', line(g.trail));
    if (g.msg && performance.now() - g.msgAt > 3500) g.msg = '';
    if (atTarget(e, n)) return finish();
    if (n === g.target.node && !g.target.gates) say(wrongSide(e)); // the right corner, the wrong way in: carry on round the block
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
    if (g.plan && g.plan.riding) {
      g.plan.i++;
      g.pick = g.plan.route[g.plan.i] || null;
      if (g.pick && short(g.pick.name) !== short(e.name) && !G.RAMP.test(g.pick.name)) showTag(youTag, short(g.pick.name), G.nodes[n]);
    }
    if (g.auto) autopilot(e);
    if (!c.decision) {
      if (!c.only) return stopHere('Dead end.');
      const d = turnOf(e, c.only);
      if (carries(e, c.only)) return go(c.only, true); // the road carries on
      // the road ends and the only way on is a turn: the car doesn't turn by itself
      const side = d < 0 ? 'L' : 'R';
      if (g.queued === side || g.pick === c.only || g.home) {
        g.queued = null;
        g.pick = null;
        return go(c.only);
      }
      g.queued = null;
      g.pick = null;
      const cut = G.cuts[e.id];
      const why = cut ? `${short(e.name)} goes on as ${cut.replace(/\bEn\b/i, 'Entrance')} (not in this game)` : cut === '' ? `${short(e.name)} goes on past this area` : 'Road ends';
      return stopHere(`${why}: only ${side === 'L' ? '◀ left' : 'right ▶'} onto ${short(c.only.name)}`);
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
    // an ordinary corner: carry straight on; a named one: stop and wait for a pick
    if (!c.named && c.straight) return go(c.straight, true);
    stopHere();
  }
  /** Onto link nx. carryOn: straight on with no input (the cruise builds); otherwise it resets. */
  function go(nx, carryOn = false) {
    logEv('go', nx.id, carryOn ? 'on' : 'turn');
    g.cruise = carryOn ? g.cruise + 1 : 0;
    g.e = legOf(g.e.pts[g.e.pts.length - 1], nx, g.e.id);
    g.s = 0;
    g.waiting = false;
    enterEdge(nx);
    render(); // the street, neighborhood and next cross street follow you
  }
  /**
   * Link nx as driven from point a (where the last road ended): a straight cross
   * through the corner, then the road. The rest (name, choices, id) is nx's own.
   */
  function legOf(a, nx, fromId) {
    // the road pieces joining the two inside the corner, if the city's data has them; else straight across
    const via = fromId != null ? G.xingGeo.get(`${fromId}>${nx.id}`) : null;
    const lead = [a];
    if (via) for (const q of via) if (metres(lead[lead.length - 1], q) > 0.3) lead.push(q);
    if (metres(lead[lead.length - 1], nx.pts[0]) > 0.3) lead.push(nx.pts[0]);
    if (lead.length < 2) return nx; // already there
    let ch = 0;
    const cum = [0];
    for (let i = 1; i < lead.length; i++) {
      ch += metres(lead[i - 1], lead[i]);
      cum.push(ch);
    }
    const leg = Object.create(nx);
    leg.pts = [...lead, ...nx.pts.slice(1)];
    leg.cum = [...cum, ...nx.cum.slice(1).map((c) => c + ch)];
    leg.len = nx.len + ch;
    leg.chord = ch;
    return leg;
  }
  function say(msg) {
    g.msg = msg;
    g.msgAt = performance.now();
    logEv('msg', msg);
  }
  // ---- reports: something's off / the round's log, to GitHub or the clipboard ------------------
  const REPO = 'tegix62/njmap';
  /** Where you are and what the corner ahead allows, right now. */
  /** What was on screen, in words (the top card and the panel), so a report shows what you saw. */
  function screenText() {
    const t = (id) => ((document.getElementById(id) || {}).innerText || '').replace(/\s+/g, ' ').trim();
    return `${t('hud')} || ${t('sheet')}`.slice(0, 520);
  }
  /** The state of play: where the car is, or in the plan where the ghost car is, and what it offers. */
  function snapshot() {
    const P = planning() ? g.plan : null;
    const e = P ? P.cur : g.e;
    const c = choices(e);
    const nm = (o) => (o ? `${short(o.name)} #${o.id}` : '-');
    const nt = P ? null : nextTurnCorner();
    const btns = (sel) => [...document.querySelectorAll(sel)].map((x) => x.textContent.replace(/\s+/g, ' ').trim());
    return {
      link: e.id, on: e.name, s: Math.round(P ? P.curS : g.s), len: Math.round(e.len), corner: G.label(e.to), waiting: P ? true : g.waiting,
      plan: P ? P.phase : null,
      left: nm(c.left), straight: nm(c.straight), right: nm(c.right), named: c.named ? c.options.map(nm) : null, only: nm(c.only),
      queued: g.queued, pick: g.pick ? nm(g.pick) : null, next: nt ? `${nt.name} (${G.label(nt.via.to)})` : null, msg: g.msg || null,
      where: (hood(g.pos || g.trail[0]) || '').replace(/ \(.*\)$/, ''),
      target: `${g.target.name || g.target.label}${g.target.quad ? ` (${g.target.quad} corner)` : g.target.gates ? ' (tunnel ramp)' : ''}`,
      shown: { chips: btns('.ggchip'), turns: btns('.ggturn'), picks: btns('.ggpick') },
      screen: screenText(),
    };
  }
  /** The log in words, a line per event (needs this area's street data). */
  function readable(log) {
    if (log.area !== areaId || log.data !== G.dataKey) return [];
    const L = (id) => (G.edges[id] ? short(G.edges[id].name) : `#${id}`);
    return log.ev.map(([t, what, a, b, c, d]) => {
      const tt = `${t.toFixed(1)}s`;
      if (what === 'start') return `${tt} start on ${L(a)}`;
      if (what === 'drive') return `${tt} Go`;
      if (what === 'go') return `${tt} → ${L(a)}${b === 'turn' ? ' (turn)' : ''}`;
      if (what === 'press') return `${tt} pressed ${{ L: '◀ Left', R: 'Right ▶', S: '▲ Straight' }[a] || a} (${d}, on ${L(b)} ${c} m in)`;
      if (what === 'pick') return `${tt} tapped ${L(a)}`;
      if (what === 'zip') return `${tt} Go-to ${G.label(a)}`;
      if (what === 'stop') return `${tt} stopped at ${G.edges[a] ? G.label(G.edges[a].to) : a}`;
      if (what === 'msg') return `${tt} “${a}”`;
      if (what === 'flag') return `${tt} ⚑ MARKED on ${L(a)} (${b} m in, ${c}) → ${d && d.corner ? d.corner : G.edges[a] ? G.label(G.edges[a].to) : ''}`;
      if (what === 'plan') return `${tt} plan: ${a === 'turn' ? `turn onto ${L(b)}` : a === 'corner' ? `go to ${G.label(b)}` : a === 'refused' ? `tried ${b === 'L' ? 'left' : b === 'R' ? 'right' : 'straight'} (refused)` : a}`;
      if (what === 'ride') return `${tt} ride`;
      if (what === 'hint') return `${tt} hint`;
      if (what === 'done') return `${tt} done: ${a} m (shortest ${b})${c ? `, ${c} wrong-way` : ''}`;
      return `${tt} ${[what, a, b, c, d].filter((x) => x != null).join(' ')}`;
    });
  }
  /** The report: a short summary, the timeline in words, and the raw log to replay. */
  function reportText(kind, log, snap, note) {
    const head = `**${AREA.title} · ${kind === 'off' ? "something's off" : 'round log'}**`;
    const lines = readable(log);
    const raw = JSON.stringify({ ...log, kept: undefined, t0: undefined, snap });
    let body = (tl, rw) =>
      [
        head,
        note ? `> ${note.replace(/\n/g, '\n> ')}` : '',
        snap ? `At **${snap.corner}** (${snap.where}), on ${snap.on}${snap.plan ? `, planning (${snap.plan})` : snap.waiting ? ', stopped' : ''}. Ahead: ◀ ${snap.left} · ▲ ${snap.straight} · ▶ ${snap.right}${snap.named ? ` · named: ${snap.named.join(', ')}` : ''}${snap.only !== '-' ? ` · only: ${snap.only}` : ''}${snap.next ? ` · next corner: ${snap.next}` : ''}${snap.queued ? ` · queued ${snap.queued}` : ''}${snap.msg ? ` · message: “${snap.msg}”` : ''}` : '',
        ...log.ev.filter((x) => x[1] === 'flag' && x[5]).slice(-4).map((x) => `⚑ ${x[0].toFixed(1)}s at **${x[5].corner}** (${x[5].where}, ${x[4]}): chips [${(x[5].shown.chips || []).join(', ')}] turns [${(x[5].shown.turns || []).join(', ')}] picks [${(x[5].shown.picks || []).join(', ')}]; screen: “${x[5].screen}”`),
        `To ${log.target} · ${log.kind} round · pace ${log.pace} · guide ${log.guide}${log.labels ? '' : ' · hard mode'} · ${log.at}`,
        tl.length ? '```\n' + tl.join('\n') + '\n```' : '',
        '<details><summary>log (for replay)</summary>\n\n```json\n' + rw + '\n```\n</details>',
      ]
        .filter(Boolean)
        .join('\n\n');
    // keep it short enough for a GitHub link: the most recent part if it's long
    let text = body(lines, raw);
    for (let keep = 120; encodeURIComponent(text).length > 7000 && keep >= 10; keep = Math.floor(keep * 0.6)) {
      const lg = { ...log, ev: log.ev.slice(-keep), kept: undefined, t0: undefined, snap, trimmed: true };
      text = body(lines.slice(-Math.min(keep, 40)), JSON.stringify(lg));
    }
    return text;
  }
  function openReport(kind, log = g.log) {
    if (!g || !log) return;
    g.report = { kind, log, snap: kind === 'off' && !g.done ? snapshot() : null, note: '', wasPaused: g.paused };
    if (!g.done) g.paused = true;
    logEv('report', kind);
    render();
  }
  function closeReport() {
    if (!g || !g.report) return;
    g.paused = g.report.wasPaused;
    g.report = null;
    render();
  }
  function reportHTML() {
    const r = g.report;
    return `<div class="ggreport">
      <b>${r.kind === 'off' ? '⚑ Something’s off' : '📋 Round log'}</b>
      <textarea id="ggNote" rows="3" placeholder="What happened? (optional)">${esc(r.note)}</textarea>
      <div class="ggend">
        <button class="primary" id="ggSend">Send to GitHub ↗</button>
        <button id="ggCopy">📋 Copy</button>
        <button id="ggBack">Back</button>
      </div>
      <div class="hint">Send opens a new issue on the app’s GitHub page with this round’s moves filled in (game moves only, no GPS): tap Submit there. Copy puts the same text on your clipboard.</div>
    </div>`;
  }
  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied ✓';
    } catch {
      // no clipboard access: show the text to copy by hand
      const ta = document.getElementById('ggNote');
      if (ta) {
        ta.value = text;
        ta.select();
      }
      btn.textContent = 'Select all, copy';
    }
  }
  function sendIssue(text, title) {
    const url = `https://github.com/${REPO}/issues/new?labels=drive-log&title=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  }
  function bindReport() {
    const r = g.report;
    const ta = document.getElementById('ggNote');
    ta?.addEventListener('input', () => (r.note = ta.value));
    const marks = r.log.ev.filter((x) => x[1] === 'flag');
    const title = () =>
      `${AREA.title}: ${
        r.kind === 'off'
          ? marks.length
            ? `${marks.length} marked spot${marks.length === 1 ? '' : 's'}, round to ${r.log.target}`
            : `something's off${r.snap ? ` at ${r.snap.corner}` : ''}`
          : `round to ${r.log.target}`
      }`;
    document.getElementById('ggSend')?.addEventListener('click', () => sendIssue(reportText(r.kind, r.log, r.snap, r.note), title()));
    document.getElementById('ggCopy')?.addEventListener('click', (e) => copyText(reportText(r.kind, r.log, r.snap, r.note), e.target));
    document.getElementById('ggBack')?.addEventListener('click', closeReport);
  }
  /** Options: an earlier round's log (the last 10, both games), to send or copy. */
  function earlierLogs() {
    const logs = ctx.store.get('driveLogs', []);
    if (!logs.length) return '';
    const opts = logs
      .map((l, i) => ({ l, i }))
      .reverse()
      .map(({ l, i }) => `<option value="${i}">${esc(new Date(l.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} · ${esc(l.area)} · to ${esc(l.target)}</option>`)
      .join('');
    return `<div class="ggoldlog"><select id="ggOldSel" aria-label="An earlier round">${opts}</select><button id="ggOldLog">Report it</button></div>`;
  }
  /** The last 10 rounds' logs stay on the phone (Options: copy or send an earlier one). */
  function keepLog() {
    if (!g || !g.log || g.log.kept || !g.log.ev.length) return;
    g.log.kept = true;
    const all = ctx.store.get('driveLogs', []).filter((l) => l.at !== g.log.at);
    all.push({ ...g.log, kept: undefined, t0: undefined });
    ctx.store.set('driveLogs', all.slice(-10));
  }
  /** One line of the round's log: [seconds since start, what, ...details]. */
  function logEv(...a) {
    if (!g || !g.log) return;
    g.log.ev.push([Math.round((performance.now() - g.log.t0) / 100) / 10, ...a]);
    if (g.log.ev.length > 400) g.log.ev.shift();
  }
  function stopHere(msg) {
    logEv('stop', g.e.id);
    g.waiting = true;
    g.cruise = 0;
    g.goTo = null;
    setData('gg-goto', EMPTY);
    g.s = g.e.len;
    // why the car stopped always shows; only a fresh wrong-way refusal (just said) stays up over the default
    if (msg) say(msg);
    else if (!g.msg || !g.msg.startsWith('⛔') || performance.now() - g.msgAt > 4000) {
      const c0 = choices(g.e);
      if (c0.named) say(`${G.label(g.e.to)}: which way?`);
      else {
        const ways = [c0.left && 'left', c0.straight && 'straight', c0.right && 'right'].filter(Boolean);
        say(`${G.label(g.e.to)}: ${ways.join(' · ')}`);
      }
    }
    render();
  }
  /** A corner to come back to: approaching it on link `link`; `note` says what went wrong. */
  function remember(m) {
    const list = mem.get('mistakes', []).filter((x) => x.link !== m.link);
    list.push({ ...m, corner: G.label(G.edges[m.link].to), at: Date.now() });
    mem.set('mistakes', list.slice(-30));
  }
  function forget(link) {
    mem.set('mistakes', mem.get('mistakes', []).filter((x) => x.link !== link));
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
        remember({ link: e.id, note: why });
        break;
      }
    }
    say(`⛔ ${why || `No road to the ${side === 'L' ? 'left' : 'right'}`}${tryInstead(e)}`);
  }
  /** After a refusal: the first move of the shortest way from the end of link e ("Try ◀ left onto 1st Ave"). */
  function tryInstead(e) {
    const r = shortest(e, g.target.node, e.len);
    const nx = r && r.path[1];
    if (!nx) return '';
    const c = choices(e);
    const how = nx === c.left ? '◀ left' : nx === c.right ? 'right ▶' : nx === c.straight ? '▲ straight' : nx === c.only ? (turnOf(e, nx) < 0 ? '◀ left' : 'right ▶') : '';
    return how ? `. Try ${how} onto ${short(nx.name)}` : '';
  }
  /** Leave the briefing and drive: the destination appears (with Map first, a look at both first). */
  function go0() {
    if (!g.startCard) return;
    logEv('drive');
    g.startCard = false;
    g.resumeAt = 0;
    g.goAt = performance.now();
    const tp = G.nodes[g.target.node];
    setData('gg-target', point(targetPoint(), { name: g.target.name || g.target.label }));
    setCorridor(g.target.gates ? G.places.find((x) => x.name === g.target.name && x.gates) : null);
    if (prefs.mapFirst && ctx.dur(1)) {
      g.view = 'intro';
      ctx.fit([g.pos || g.trail[0], tp], 15, { bearing: GRID, duration: 700 });
      setTimeout(() => {
        if (g && g.view === 'intro') g.view = 'follow';
      }, 1700);
    }
    if (prefs.style === 'plan') startPlan();
    showPoi(true);
    render();
  }
  /** The briefing's guess: which way is the destination, before any arrow says so. */
  function guessSide(side) {
    if (!g || !g.startCard || g.guess) return;
    const p = g.pos || g.trail[0], tp = G.nodes[g.target.node];
    const h = g.e.b0, toward = bearing(p, tp);
    const ok = okSides(h, toward).includes(side);
    guesses.add(ok);
    g.guess = { pick: side, ok, said: `${sideWords(h, toward)}: ${relWords(p, tp)}` };
    render();
  }
  /** "0.8 mi uptown · 0.3 mi east": the way to a point in the grid's terms. */
  /** Which street number a point is at (between lines, the nearest). */
  function streetAt(y) {
    const L = G.streetLines;
    if (L.length < 2) return 0;
    let i = 0;
    while (i < L.length - 2 && L[i + 1].y < y) i++;
    const a = L[i], b = L[i + 1];
    return Math.round(a.n + ((y - a.y) * (b.n - a.n)) / (b.y - a.y || 1));
  }
  /** "14 streets uptown · 3 avenues east": the way to a point, counted in the grid's own units. */
  function countWords(p, tp) {
    const a = gridXY(p), b = gridXY(tp);
    const ds = streetAt(b[1]) - streetAt(a[1]);
    const tol = 18; // a point on an avenue counts as at it
    const cols = G.aveCols;
    const da = b[0] > a[0] ? cols.filter((c) => c.x > a[0] + tol && c.x <= b[0] + tol).length : -cols.filter((c) => c.x < a[0] - tol && c.x >= b[0] - tol).length;
    const part = (v, one, pos, neg) => (v ? `${Math.abs(v)} ${one}${Math.abs(v) === 1 ? '' : 's'} ${v > 0 ? pos : neg}` : null);
    return [part(ds, 'street', 'uptown', 'downtown'), part(da, 'avenue', 'east', 'west')].filter(Boolean).join(' · ') || 'right here';
  }
  function relWords(p, tp) {
    if (areaId === 'midtown') return countWords(p, tp); // a regular grid: count in streets and avenues
    const a = gridXY(p), b = gridXY(tp);
    const up = (b[1] - a[1]) / 1609.34, east = (b[0] - a[0]) / 1609.34;
    const part = (v, pos, neg) => (Math.abs(v) < 0.05 ? null : `${Math.abs(v) < 0.1 ? '<0.1' : Math.abs(v).toFixed(1)} mi ${v > 0 ? pos : neg}`);
    return [part(up, 'uptown', 'downtown'), part(east, 'east', 'west')].filter(Boolean).join(' · ') || 'right here';
  }
  const showGuide = () => prefs.guide === 'arrow' || performance.now() < g.peekUntil;
  const showWords = () => prefs.guide !== 'off' || performance.now() < g.peekUntil;
  /** Stuck? The next roads on the shortest way from here, in words ("Ave A downtown → E Houston St west → 🏁"). */
  function showHint() {
    if (!g || g.done || g.startCard) return;
    const pl = planning() ? g.plan : null;
    const r = pl ? shortest(pl.cur, g.target.node, pl.phase === 'corner' ? pl.curS : pl.cur.len) : shortest(g.e, g.target.node, g.waiting ? g.e.len : g.s);
    if (!r) return;
    g.hints++;
    logEv('hint', g.e.id);
    const legs = [];
    for (const e of r.path) {
      const nm = short(e.name);
      if (legs.length && legs[legs.length - 1].nm === nm) continue;
      if (G.RAMP.test(e.name)) continue;
      legs.push({ nm, dir: headWord(e.name, e.b0) });
    }
    const steps = legs.slice(0, 3).map((l) => `${l.nm} ${l.dir}`);
    say(`💡 ${steps.join(' → ')}${legs.length <= 3 ? ' → 🏁' : ' → …'}`);
    g.msgAt = performance.now() + 6000; // keep it up a while
    render();
  }
  /** Show the Hint button once you've been at it a while, or gone well past the shortest way. */
  const hintReady = () => g && !g.done && !g.startCard && (performance.now() - g.goAt > 45000 || g.driven > g.best.cost * 1.3 + 200);
  function peek() {
    if (!g || g.done || g.startCard) return;
    g.peeks++;
    g.peekUntil = performance.now() + PEEK_MS;
    render();
  }
  function press(side) {
    if (!g || g.done || g.loading) return;
    if (planning()) return planTurn(side);
    if (g.check) return side === 'S' || g.check.kind === 'name' ? undefined : answerCheck(side);
    if (g.startCard) return; // the briefing: Go starts the drive
    logEv('press', side, g.e.id, Math.round(g.s), g.waiting ? 'stopped' : 'moving');
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
    if (!g || g.done || g.loading || g.check || g.startCard) return;
    if (planning()) return planPick(id);
    const o = G.edges[id];
    logEv('pick', id, g.e.id, Math.round(g.s));
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
    if (g.startCard) return; // the briefing: Go starts the drive
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
  /** A tap on a landmark's dot, or on the red destination dot when it's a landmark: its photo, name and note. */
  function tapLandmark(sx, sy) {
    const r = cont.getBoundingClientRect();
    const x = sx - r.left, y = sy - r.top;
    const layers = ['gg-target', 'gg-lmseen-dot', 'gg-poi-dot'].filter((id) => map.getLayer(id));
    if (!layers.length) return false;
    const hits = map.queryRenderedFeatures([[x - 20, y - 20], [x + 20, y + 20]], { layers });
    for (const f of hits) {
      const name = f.layer.id === 'gg-target' ? g.target && g.target.name : f.properties && f.properties.name;
      if (name && openLmCard(name)) return true;
    }
    return false;
  }
  const up = (e, cancel) => {
    clearTimeout(holdTimer);
    const wasBoost = g && g.boost;
    if (g) g.boost = false;
    carEl.classList.remove('boost');
    if (!cancel && down && !down.moved && !wasBoost && g && !g.loading && tapLandmark(e.clientX, e.clientY)) {
      down = null;
      return;
    }
    if (!cancel && down && !down.moved && g && g.peek) {
      endPeek(); // a tap on the map: back to the drive
      down = null;
      return;
    }
    if (!cancel && down && !down.moved && !wasBoost && active() && !g.paused && !g.check && g.view !== 'overview') tapAt(e.clientX, e.clientY);
    down = null;
  };
  cont.addEventListener('pointerup', (e) => up(e, false));
  cont.addEventListener('pointercancel', (e) => up(e, true));

  function tapAt(sx, sy) {
    if (g.home || planning()) return; // the round is decided / the plan is built with the buttons
    const rect = map.getContainer().getBoundingClientRect();
    const cw = choices(g.e);
    const st = g.waiting && !cw.named ? cw.straight : null;
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
    goToNode(best.node);
  }
  // ---- Plan & ride: plan the route corner by corner (no clock, a ghost car), then ride it ----------
  const planning = () => !!(g && g.plan && !g.plan.riding && !g.done);
  /** Corners where something happens: a choice, a road that ends in a turn, or the destination. */
  function planCorners(cur, max = 40) {
    const out = [];
    for (const { node, via } of aheadChain(cur, 70, 7000)) {
      const c = choices(via);
      const eventful = c.decision || (c.only && !carries(via, c.only)) || atTarget(via, node);
      if (G.real(node) && eventful) out.push({ node, via, name: crossAt(via) || G.label(node) });
      if (atTarget(via, node) || out.length >= max) break;
    }
    return out;
  }
  /**
   * The corners offered as chips: a handful (6), not all of them. Always the corner the shortest way
   * needs, a couple before it and a few past it (one of them close), so there's something to get wrong
   * and a different mix on another try. Fixed for as long as the plan stands at this spot.
   */
  function planChips() {
    const p = g.plan;
    const key = `${p.cur.id}:${p.curS | 0}:${p.route.length}`;
    if (p.chipKey === key && p.chipNodes) return p.chipNodes.map((n) => p.chipAll.find((c) => c.node === n));
    const all = planCorners(p.cur).map((c, i) => ({ ...c, idx: i }));
    const chain = aheadChain(p.cur, 70, 7000);
    const r = shortest(p.cur, g.target.node, p.curS);
    let k = 0;
    while (r && k + 1 < r.path.length && chain[k + 1] && r.path[k + 1] === chain[k + 1].via) k++;
    const needNode = chain[k] ? chain[k].node : g.target.node;
    let n = all.findIndex((c) => c.node === needNode);
    if (n < 0) n = Math.max(0, all.findIndex((c) => chain.findIndex((x) => x.node === c.node) >= k));
    const pickRand = (arr, m) => {
      const a = arr.slice(), out = [];
      while (a.length && out.length < m) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
      return out;
    };
    const before = all.slice(0, n), after = all.slice(n + 1), MAX = 6;
    let nb = Math.min(before.length, 2);
    let na = Math.min(after.length, MAX - 1 - nb);
    nb = Math.min(before.length, MAX - 1 - na);
    const near = after.slice(0, 3);
    const chosen = [all[n]].filter(Boolean);
    if (na) {
      const first = pickRand(near, 1);
      chosen.push(...first, ...pickRand(after.filter((c) => !first.includes(c)), na - first.length));
    }
    chosen.push(...pickRand(before, nb));
    chosen.sort((a, b) => a.idx - b.idx);
    p.chipKey = key;
    p.chipAll = all;
    p.chipNodes = chosen.map((c) => c.node);
    return chosen;
  }
  function startPlan() {
    g.plan = { route: [g.e], cur: g.e, phase: 'corner', pos: g.trail[0], curS: g.s, s0: g.s, hist: [], riding: false };
    g.waiting = true;
    g.paused = false;
    drawPlan();
  }
  /** The planned route on the map, and the ghost car where it has got to. */
  function drawPlan() {
    const p = g.plan;
    const pts = [g.trail[0]];
    p.route.forEach((e, i) => pts.push(...(i ? e.pts : e.pts.slice(1))));
    if (p.phase === 'corner' && p.route.length > 1) pts.length = Math.max(1, pts.length - (p.cur.pts.length - 1));
    setData('gg-trail', line(pts));
    g.pos = p.pos;
  }
  const planSnap = () => ({ n: g.plan.route.length, phase: g.plan.phase, pos: g.plan.pos, curS: g.plan.curS });
  function planStep(nx) {
    const p = g.plan;
    p.hist.push(planSnap());
    p.route.push(nx);
    p.cur = nx;
    p.pos = nx.pts[0];
    p.curS = 0;
    p.phase = 'corner';
    g.msg = '';
    logEv('plan', 'turn', nx.id);
    drawPlan();
    render();
  }
  function planCorner(node) {
    const p = g.plan;
    if (!p || p.phase !== 'corner') return;
    const chain = aheadChain(p.cur, 70, 7000);
    const k = chain.findIndex((x) => x.node === node);
    if (k < 0) return;
    p.hist.push(planSnap());
    for (let i = 1; i <= k; i++) p.route.push(chain[i].via);
    p.cur = chain[k].via;
    p.pos = p.cur.pts[p.cur.pts.length - 1];
    p.curS = p.cur.len;
    p.phase = atTarget(p.cur, node) ? 'done' : 'turn';
    g.msg = '';
    if (node === g.target.node && p.phase === 'turn') say(wrongSide(p.cur));
    logEv('plan', 'corner', node);
    drawPlan();
    render();
  }
  /** At a corner in the plan: a side was chosen. */
  function planTurn(side) {
    const p = g.plan;
    if (!p || p.phase !== 'turn') return;
    const c = choices(p.cur);
    let nx = null;
    if (side === 'S') nx = c.straight || null;
    else if (c.named) nx = sideOption(p.cur, side);
    else if (c.decision) nx = side === 'L' ? c.left : c.right;
    else if (c.only && (turnOf(p.cur, c.only) < 0 ? 'L' : 'R') === side) nx = c.only;
    if (!nx) {
      logEv('plan', 'refused', side, p.cur.id);
      if (side === 'S') say('No road straight on here.');
      else refuse(p.cur, side);
      render();
      return;
    }
    planStep(nx);
  }
  function planPick(id) {
    const p = g.plan;
    const o = G.edges[id];
    if (!p || p.phase !== 'turn' || !choices(p.cur).options.includes(o)) return;
    planStep(o);
  }
  function planUndo() {
    const p = g.plan;
    const h = p && p.hist.pop();
    if (!h) return;
    logEv('plan', 'undo');
    p.route.length = h.n;
    p.cur = p.route[h.n - 1];
    p.phase = h.phase;
    p.pos = h.pos;
    p.curS = h.curS;
    g.msg = '';
    drawPlan();
    render();
  }
  /** The route as roads: "8th Ave uptown → 42nd St east → …" */
  function planCrumbs() {
    const runs = [];
    for (const e of g.plan.route) {
      const last = runs[runs.length - 1];
      if (last && short(last.name) === short(e.name)) continue;
      if (G.RAMP.test(e.name)) continue;
      runs.push({ name: e.name, dir: headWord(e.name, e.b0) });
    }
    return runs;
  }
  function planHTML() {
    const p = g.plan;
    const runs = planCrumbs();
    const crumbs = runs.length ? runs.slice(-2).map((r) => `<b>${esc(short(r.name))}</b> <span class="muted">${r.dir}</span>`).join(' <span class="muted">→</span> ') : '';
    const first = p.route.length === 1;
    const ctl = (html) => `<div class="ggplan">
        ${first && p.phase === 'corner' ? `<div class="gp-here"><span class="bic">📍</span> ${briefYou()}</div>` : ''}
        <div class="gp-route">${!first && crumbs ? `🧭 ${runs.length > 2 ? '… → ' : ''}${crumbs}` : ''}</div>
        ${html}
        <div class="ggmsg${g.msg ? '' : ' muted'}">${g.msg ? esc(g.msg) : ''}</div>
        <div class="gp-bar">
          <button id="ggUndo"${p.hist.length ? '' : ' disabled'}>↶ Undo</button>
          <button id="ggHint">💡 Hint</button>
          <button id="ggMark" aria-label="Mark this spot">⚑</button>
          ${OV_BTN()}${TILT_BTN()}
          <button id="ggMore" aria-expanded="${!!g.more}" aria-label="More">${g.more ? '✕' : '⋯'}</button>
        </div>
      </div>`;
    if (p.phase === 'done') return ctl(`<div class="bq">🏁 That gets you there.</div><button class="primary" id="ggRide">🚕 Ride it ▶</button>`);
    if (p.phase === 'corner') {
      const cs = planChips();
      const lab = (c) => (prefs.labels ? short(c.name) : `+${c.idx + 1}`);
      return ctl(`<div class="bq">${p.route.length === 1 ? 'Where do you turn?' : 'Next, where do you turn?'}</div>
        <div class="ggchips plan">${cs.map((c, i) => `<button class="ggchip" data-node="${c.node}">${atTarget(c.via, c.node) ? '🏁 ' : ''}${esc(lab(c))}</button>`).join('') || '<span class="muted">No turns ahead on this road.</span>'}</div>`);
    }
    const c = choices(p.cur);
    const at = prefs.labels ? G.label(p.cur.to) : 'this corner';
    if (c.named) {
      const picks = c.options
        .map((o) => ({ o, d: turnOf(p.cur, o) }))
        .sort((a, b) => a.d - b.d)
        .map(({ o }) => `<button class="ggpick" data-link="${o.id}"><span class="gg-arr" style="transform:rotate(${(o.b0 - GRID).toFixed(0)}deg)">${DIR_SVG}</span><span class="nm">${esc(optName(o))}${spineMark(o.name)} <small>${esc(leadsTo(o))}</small></span></button>`)
        .join('');
      return ctl(`<div class="bq">At <b>${esc(at)}</b>: which way?</div><div class="ggctl named">${picks}</div>`);
    }
    const side = (k, label, wd) => `<button class="ggturn" data-side="${k}">${label}<span class="dirhint">${wd}</span></button>`;
    const hb = p.cur.b1;
    const grid = onGrid(p.cur.name, hb);
    const wd = (b) => (grid ? WORD[gridDir(b)] : compassWord(b));
    return ctl(`<div class="bq">At <b>${esc(at)}</b>: which way?</div>
      <div class="ggctl${c.straight ? ' three' : ''}">${side('L', '◀ Left', wd(hb - 90))}${c.straight ? side('S', '▲ Straight', wd(hb)) : ''}${side('R', 'Right ▶', wd(hb + 90))}</div>`);
  }
  /** The plan is done: ride it, corner to corner, at speed. */
  function startRide() {
    const p = g.plan;
    if (!p || p.phase !== 'done') return;
    logEv('ride');
    g.passed = [];
    g.hoodNow = null; // the ride starts from the start again: its first neighborhood isn't announced
    p.riding = true;
    p.i = 0;
    g.e = p.route[0];
    g.s = p.s0;
    g.waiting = false;
    g.home = true;
    g.queued = null;
    g.pick = null;
    g.trail = [posOnEdge(g.e, g.s).p];
    g.driven = -g.s;
    g.path = [];
    setData('gg-trail', EMPTY);
    // one sequence: the shortest way's car rides out alongside yours, by the same distance
    const bc = [], bm = [];
    g.best.path.forEach((e) => {
      bm.push({ idx: bc.length, name: e.name });
      bc.push(...e.pts);
    });
    g.bestCoords = bc;
    g.bestRide = prepLine(bc);
    g.bestRide.marks = bm.map((m) => ({ d: g.bestRide.cum[m.idx], name: m.name }));
    g.bestMarkI = 0;
    g.marks = [];
    g.bestPos = bc[0];
    setData('gg-best', EMPTY);
    bestMk.setLngLat(bc[0]).addTo(map);
    render();
  }
  /** The corners you could zip to, straight on along this road: [{node, via, name}]. */
  function cornersAhead(max = 8) {
    if (!g || g.done || g.startCard) return [];
    const cw = choices(g.e);
    const st = g.waiting ? (cw.named ? null : cw.straight) : null;
    if (g.waiting && !st) return [];
    const chain = g.waiting ? aheadChain(st, 40, 3000) : aheadChain(g.e, 40, 3000);
    const out = [];
    for (const { node, via } of chain) {
      // only corners where you could turn (some meet only one-way streets coming in)
      if (!G.real(node) || (!choices(via).decision && !atTarget(via, node))) continue;
      out.push({ node, via, name: crossAt(via) || G.label(node) });
      if (out.length >= max) break;
    }
    return out;
  }
  /** Drive straight on to corner `node` (about a second, however far) and stop there. */
  function goToNode(node) {
    if (planning()) return planCorner(node);
    if (!g || g.done || g.startCard || g.home) return;
    logEv('zip', node, g.e.id, Math.round(g.s));
    const cw = choices(g.e);
    const st = g.waiting && !cw.named ? cw.straight : null;
    const chain = g.waiting ? (st ? aheadChain(st) : []) : aheadChain(g.e);
    if (!chain.some((x) => x.node === node)) return;
    const best = { node };
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
    const w = document.querySelector('#hud .gg-words');
    if (w) {
      const t = relWords(g.pos, G.nodes[g.target.node]);
      if (w.textContent !== t) w.textContent = t;
    }
    if (g.startCard || !showGuide()) {
      offEl.hidden = true;
      return;
    }
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
    logEv('done', Math.round(g.driven), Math.round(g.best.cost), g.wrong);
    hideLmTag();
    g.done = true;
    g.waiting = true;
    stopFlow(); // (the highlighted streets stay on the end map, still)
    offEl.hidden = true;
    showLabels(prefs.labels);
    syncLmSeen();
    keepLog();
    const bestCoords = [];
    g.best.path.forEach((e) => bestCoords.push(...e.pts));
    g.bestCoords = bestCoords;
    g.split = null;
    {
      const bp = g.best.path.map((e) => e.id);
      let i = 0;
      while (i < g.path.length && i < bp.length && g.path[i] === bp[i]) i++;
      if (i < bp.length && i < g.path.length + 1 && g.best.cost < g.driven * 0.97) {
        g.split = { at: i === 0 ? G.edges[bp[0]].pts[0] : G.nodes[G.edges[bp[i - 1]].to], first: short(G.edges[bp[i]].name) };
      }
    }
    g.rodeBoth = !!g.bestRide;
    if (g.rodeBoth) {
      setData('gg-best', line(bestCoords));
      bestMk.setLngLat(bestCoords[bestCoords.length - 1]).addTo(map);
      if (g.split) splitMk.setLngLat(g.split.at).addTo(map);
      splitEl.textContent = g.split ? `the shortest way went ${g.split.first}` : '';
    } else setData('gg-best', EMPTY);
    // zoom out to show the whole drive, yours and the shortest (after the result
    // is on screen, so the framing allows for its height)
    const all = [...g.trail, ...bestCoords];
    const round = g;
    setTimeout(() => g === round && g.done && ctx.fit(all, 16, { bearing: GRID, duration: 900, margin: 56 }), 900); // a beat at the pin first
    if (!g.rodeBoth) setTimeout(() => g === round && g.done && startRace(), 1900); // (a planned ride already was the race)
    const mi = (m) => (m / 1609.34).toFixed(2).replace(/0$/, '');
    const ratio = g.driven / g.best.cost;
    const ok = ratio <= 1.15 && !g.wrong;
    const runs = ctx.store.get(`${areaId}Runs`, { n: 0, clean: 0 });
    runs.n++;
    if (ok) runs.clean++;
    ctx.store.set(`${areaId}Runs`, runs);
    // stars: there; the shortest way with no wrong-way tries; and that, without peeking or an
    // arrow, having guessed the way at the start
    const shortestWay = ratio <= 1.03 && !g.wrong;
    const stars = 1 + (shortestWay ? 1 : 0) + (shortestWay && !g.peeks && !g.hints && prefs.guide !== 'arrow' && (prefs.style === 'plan' || (g.guess && g.guess.ok)) ? 1 : 0);
    const key = routeKey(g.route);
    const bests = mem.get('best', {});
    const before = bests[key] || 0;
    if (stars > before) {
      bests[key] = stars;
      mem.set('best', bests);
    }
    // the corner where you left the shortest way, when it cost a lot: comes back in a later round
    let missed = null;
    if (ratio > 1.15) {
      const bp = g.best.path.map((e) => e.id);
      let i = 0;
      while (i < g.path.length && i < bp.length && g.path[i] === bp[i]) i++;
      if (i > 0 && i < bp.length) {
        missed = `${G.label(G.edges[bp[i - 1]].to)}: the shortest way took ${short(G.edges[bp[i]].name)}`;
        remember({ link: bp[i - 1], note: `the shortest way took ${short(G.edges[bp[i]].name)}` });
      }
    }
    // a corner you'd got wrong, driven right this time: off the list
    let fixed = false;
    if (g.mistake && shortestWay) {
      forget(g.mistake.link);
      fixed = true;
    }
    // blocks driven
    const prevCover = coverage();
    if (g.drivenSet) mem.set('driven', [...g.drivenSet]);
    const cover = coverage();
    const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
    const saved = mem.get('trips', []).some((t) => routeKey(t) === key);
    // a short result: one summary row, the famous places you passed, then buttons; the rest is folded into Details
    const through = g.passed && g.passed.length > 1 ? g.passed.map(esc).join(' → ') : '';
    g.result = `<div class="ggsum"><span class="ggstars" title="★ there · ★★ the shortest way · ★★★ and no hints${prefs.style === 'plan' ? '' : ' or peeks, start guess right'}">${starStr(stars)}</span>
      <span class="fb ${ok ? 'ok' : 'no'}">${mi(g.driven)} mi${ratio <= 1.03 ? ' · the shortest' : ` · shortest ${mi(g.best.cost)}`}${
      g.wrong ? ` · ${g.wrong} wrong-way` : ''
    }${g.checks ? ` · check-ins ${g.checksRight}/${g.checks}` : ''}${
      g.guess ? ` · guess ${g.guess.ok ? '✓' : '✗'}` : ''
    }${g.peeks ? ` · ${g.peeks} peek${g.peeks === 1 ? '' : 's'}` : ''}${g.hints ? ` · ${g.hints} hint${g.hints === 1 ? '' : 's'}` : ''}</span>
      <span class="ggkeys"><i class="gg-key you"></i>you <i class="gg-key best"></i>best</span></div>
      ${fixed ? `<div class="hint">✓ ${esc(g.mistake.corner)}: got it this time</div>` : ''}
      ${missed ? `<div class="hint">↺ ${esc(missed)} (it'll come back)</div>` : ''}
      ${lmResultLines()}
      <details class="ggdet"><summary>Details</summary>
        ${before ? `<div class="hint">Best so far: ${starStr(Math.max(before, stars))}</div>` : ''}
        ${through ? `<div class="hint">🏘 Through: ${through}</div>` : ''}
        ${g.target.gates && scn ? `<div class="hint">🕒 ${esc(scn.label)}: ${esc(scn.say)}${scn.kind !== 'usual' && SCN_DATA && SCN_DATA.quotes ? `. A real alert: “${esc(SCN_DATA.quotes[scn.kind === 'expressway' ? 'expressway' : 'northTube'] || '')}”` : ''}</div>` : ''}
        ${streetTierLine()}
        <div class="hint">Shortest: ${esc(describe(g.best.path))}</div>
        <div class="hint">Driven: ${Math.round(cover * 100)}% of ${AREA.of} blocks${g.newBlocks ? ` (+${g.newBlocks} new${cover - prevCover >= 0.005 ? `, +${Math.round((cover - prevCover) * 100)}%` : ''})` : ''}</div>
      </details>
      <div class="ggend">
        <button class="primary" id="ggAgain">Another route</button>
        <button id="ggRace" aria-label="Replay">▶<small>Replay</small></button>
        <button id="ggSame" aria-label="Same route again">↻<small>Same</small></button>
        <button id="ggSave" aria-label="Save"${saved ? ' disabled' : ''}>${saved ? '★' : '☆'}<small>${saved ? 'Saved' : 'Save'}</small></button>
        <button id="ggLog" aria-label="Round log">📋<small>Log</small></button>
        ${g.flags ? `<button id="ggFlagSend" class="flagged">⚑ Send the ${g.flags} spot${g.flags === 1 ? '' : 's'} you marked</button>` : ''}
      </div>`;
    render();
  }

  const meters = (a, b) => Math.hypot((b[0] - a[0]) * 84400, (b[1] - a[1]) * 111000);
  /** Show the street name when a car passes the start of a street with a different name from the one before. */
  function tagFor(tag, marks, d, p, holder, key) {
    let i = holder[key] || 0;
    while (i + 1 < marks.length && marks[i + 1].d <= d) i++;
    if (i !== (holder[key] || 0)) {
      const prev = marks[i - 1] || marks[0], cur = marks[i];
      if (short(cur.name) !== short(prev.name) && !G.RAMP.test(cur.name)) showTag(tag, short(cur.name), p);
    }
    holder[key] = i;
  }
  function prepLine(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + meters(pts[i - 1], pts[i]));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  /** Where `d` metres along a prepared line is: position, heading, and the index it has reached. */
  function atLine(r, d) {
    d = Math.min(d, r.len);
    let k = 1;
    while (k < r.cum.length - 1 && r.cum[k] < d) k++;
    const a = r.pts[k - 1], b = r.pts[k] || a, seg = r.cum[k] - r.cum[k - 1] || 1;
    const t = Math.max(0, Math.min(1, (d - r.cum[k - 1]) / seg));
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const brg = (Math.atan2((b[0] - a[0]) * 84400, (b[1] - a[1]) * 111000) * 180) / Math.PI;
    return { p, brg: a === b ? null : brg, k };
  }
  const lmLink = (l) => `<a href="#" class="lmlink" data-lm="${esc(l.n)}" data-gg="${areaId}" onclick="return false">${esc(l.n)}${LM_PICS[l.n] ? ' 📷' : ''}</a>`;
  /** On the end screen: which streets of the route are the spine (worth knowing) and how many were local ones. */
  function streetTierLine() {
    if (!G.d.tiers || !g.path || !g.path.length) return '';
    const seen = new Map();
    for (const id of g.path) {
      const e = G.edges[id];
      if (!e || G.RAMP.test(e.name)) continue;
      seen.set(short(e.name), tierOf(e.name));
    }
    const spine = [...seen].filter(([, t]) => t === 1).map(([n]) => n);
    const mid = [...seen].filter(([, t]) => t === 2).length;
    const local = [...seen].filter(([, t]) => t === 3).length;
    return `<div class="hint">★ Spine streets on your route: ${spine.length ? spine.map(esc).join(', ') : 'none'}${mid || local ? ` · ${mid} connector${mid === 1 ? '' : 's'}, ${local} local` : ''}</div>`;
  }
  /** The end screen: the famous places you passed, and what's by your destination. */
  function lmResultLines() {
    if (prefs.landmarks === false || !G.landmarks) return '';
    const seen = [...new Map((g.lmSeen || []).map((l) => [l.n, l])).values()].slice(0, 5);
    const tp = targetPoint();
    const names = new Set(seen.map((l) => l.n));
    const norm = (x) => x.toLowerCase().replace(/^the /, '').replace(/ \(.*\)$/, '');
    const isTarget = (l) => !!g.target.name && (norm(g.target.name).includes(norm(l.n)) || norm(l.n).includes(norm(g.target.name)));
    const by = G.landmarks.filter((l) => !names.has(l.n) && metres(tp, l.p) < 170 && !isTarget(l)).slice(0, 3);
    return `${seen.length ? `<div class="hint gg-lm1">🏛 ${seen.map(lmLink).join(' · ')}</div>` : ''}${by.length ? `<div class="hint gg-lm1">📍 Near the end: ${by.map(lmLink).join(' · ')}</div>` : ''}`;
  }
  /** The end of a round, after a drive you made in real time: both ways ride out together, fast. */
  function startRace() {
    if (!g || !g.done || !g.bestCoords || !g.trail.length) return;
    const round = g;
    const id = (g.raceId = (g.raceId || 0) + 1);
    const prep = prepLine, at = atLine;
    const you = prep(g.trail), best = prep(g.bestCoords);
    const youMarks = (g.marks || []).map((m) => ({ d: you.cum[Math.max(0, Math.min(m.idx, you.cum.length - 1))], name: m.name }));
    const bestMarks = [], seen = [];
    g.best.path.forEach((e) => {
      seen.push(e);
    });
    {
      let idx = 0;
      for (const e of seen) {
        bestMarks.push({ d: best.cum[Math.min(idx, best.cum.length - 1)], name: e.name });
        idx += e.pts.length;
      }
    }
    const rs = { y: 0, b: 0 };
    const total = Math.max(you.len, best.len);
    const ms = { quick: [2200, 4500, 1.4], steady: [4500, 9000, 3], slow: [7000, 14000, 5] }[prefs.rideSpeed] || [4500, 9000, 3];
    const dur = Math.max(ms[0], Math.min(ms[1], total * ms[2]));
    const speed = total / dur;
    g.replay = true;
    g.raceHood = null;
    hideTags();
    carMk.setLngLat(you.pts[0]);
    bestMk.setLngLat(best.pts[0]).addTo(map);
    if (g.split) splitMk.setLngLat(g.split.at).addTo(map);
    splitEl.textContent = g.split ? `the shortest way went ${g.split.first}` : '';
    setData('gg-trail', EMPTY);
    setData('gg-best', EMPTY);
    const t0 = performance.now() + 500;
    let lastB = 0, lastY = 0;
    (function step(now) {
      if (g !== round || g.raceId !== id || !g.done) return;
      const d = Math.max(0, (now - t0) * speed);
      const ay = at(you, d), ab = at(best, d);
      tagFor(youTag, youMarks, d, ay.p, rs, 'y');
      tagFor(bestTag, bestMarks, d, ab.p, rs, 'b');
      watchHood(ay.p);
      carMk.setLngLat(ay.p);
      if (ay.brg != null) lastY = ay.brg;
      carMk.setRotation(lastY);
      bestMk.setLngLat(ab.p);
      if (ab.brg != null) lastB = ab.brg;
      bestMk.setRotation(lastB);
      setData('gg-trail', line([...you.pts.slice(0, ay.k), ay.p]));
      setData('gg-best', line([...best.pts.slice(0, ab.k), ab.p]));
      if (d < total) requestAnimationFrame(step);
    })(performance.now());
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

  /** Where a way out heads: the neighborhood a few hundred metres on, if it's a different one, else its compass direction. */
  function leadsTo(o) {
    let last = o;
    for (const { via } of aheadChain(o, 10, 400)) last = via;
    const there = ctx.locate(last.pts[last.pts.length - 1]);
    const here = ctx.locate(G.nodes[o.from]);
    return there && (!here || there.n !== here.n) ? `→ ${there.n}` : compassWord(o.b0);
  }

  // ---- words on screen -------------------------------------------------------------------
  /** The game picker chip takes a row of the panel: only on the briefing, the end screen and under "⋯", not while you drive. */
  const showHeader = () => !!(g.done || g.startCard || g.more || g.report);
  function render() {
    if (!g) return;
    requestAnimationFrame(placeHoodTag);
    requestAnimationFrame(layoutLmTag);
    if (g.done && g.view === 'overview') g.view = 'follow';
    document.body.classList.toggle('gg-end', !!g.done);
    if (g.loading) {
      ctx.hud(`<div class="qkind">🚕 ${AREA.title}</div><div class="q">Loading the street map…</div>`);
      ctx.sheet(`${g.opts.header()}`);
      g.opts.bindHeader();
      return;
    }
    const t = g.target;
    const tgt = placeText(t.name, t.label, targetPoint()) + cornerTag(t);
    const nx = !g.done && g.e.core ? nextCross(g.e) : null;
    const hb = g.bnow ?? g.e.b0;
    void nx;
    const here = !g.done && g.pos ? (hood(g.pos) || '').replace(/ \(.*\)$/, '') : '';
    const pl = planning() ? g.plan : null;
    const curE = pl ? pl.cur : g.e;
    const hbw = pl ? (pl.phase === 'corner' ? pl.cur.b0 : pl.cur.b1) : hb;
    const nt = !g.done && !g.plan ? nextTurnCorner() : null;
    // the next corner where something happens, and which ways it allows
    const ways = nt
      ? nt.c.named
        ? 'pick a way'
        : !nt.c.decision
          ? `only ${turnOf(nt.via, nt.c.only) < 0 ? '◀' : '▶'}`
          : `${nt.c.left ? '◀' : ''}${nt.c.straight ? '▲' : ''}${nt.c.right ? '▶' : ''}`
      : '';
    const plan = g.queued ? ` <b class="gg-plan">${g.queued === 'L' ? '◀ left there' : 'right ▶ there'}</b>` : g.pick ? ` <b class="gg-plan">→ ${esc(short(g.pick.name))}</b>` : '';
    const nextTxt = nt ? ` · next ${prefs.labels ? `<b>${esc(nt.name)}</b> ` : 'corner '}<span class="gg-ways">${ways}</span>${plan}` : plan;
    const where = prefs.labels
      ? `${pl && pl.route.length > 1 ? '🧭 Planned to' : '📍'} ${here ? `${esc(here)} · ` : ''}<b>${esc(short(curE.name))}</b> ${headWord(curE.name, hbw)}${nextTxt}`
      : `${pl && pl.route.length > 1 ? '🧭 Planned to' : '📍'} ${here ? `${esc(here)} · ` : ''}heading <b>${headWord(curE.name, hbw)}</b>${nextTxt}`; // hard mode: no street names
    ctx.hud(
      g.startCard
        ? '' // the briefing says it all: the top card would only repeat it
        : g.check && g.check.kind === 'name'
        ? `<div class="q gg-checkq">What street are you on?</div><div class="hint">Pick one below · skips in a few seconds</div>`
        : g.check
        ? `<div class="q gg-checkq">Heading ${WORD[g.check.h]}. ${esc(g.check.thing[0].toUpperCase() + g.check.thing.slice(1))}: <b>left or right?</b></div>
           <div class="hint">Answer with ◀ Left or Right ▶ · skips in a few seconds</div>`
        : `<div class="q">🏁 ${tgt}</div>
       ${
         g.done || g.startCard
           ? ''
           : `${showGuide() || showWords() ? `<div class="hint gg-go">${showGuide() ? `<span class="gg-dir" title="Which way the destination is">${DIR_SVG}</span><b class="gg-dist"></b>` : ''}${
               showWords() && !showGuide() ? `<span class="gg-words"></span>` : ''
             }</div>` : ''}${pl ? '' : `<div class="hint gg-where">${where}</div>`}`
       }`
    );
    if (!g.done && g.pos && showGuide()) updateDir(aim());
    pointToTarget();
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
    const canStraight = !!(cw && (cw.straight || (cw.only && cw.only === cw.straight)));
    // a corner whose ways out don't fit Left / Straight / Right: a button for each, with its
    // real angle on screen (the map is turned so the grid is upright)
    const named = cc && cc.named && !g.check;
    const pickBtns = () =>
      cc.options
        .map((o) => ({ o, d: turnOf(g.e, o) }))
        .sort((a, b) => a.d - b.d)
        .map(
          ({ o }) =>
            `<button class="ggpick${g.pick === o ? ' on' : ''}" data-link="${o.id}"><span class="gg-arr" style="transform:rotate(${(o.b0 - GRID).toFixed(0)}deg)">${DIR_SVG}</span><span class="nm">${esc(optName(o))}${spineMark(o.name)} <small>${esc(leadsTo(o))}</small></span></button>`
        )
        .join('');
    ctx.sheet(
      `${showHeader() ? g.opts.header() : ''}<div id="qbody">
        ${g.report ? reportHTML() : g.done ? g.result : g.startCard ? briefingHTML({ you: briefYou(), to: briefTo(), guess: g.guess }) : g.plan ? (g.plan.riding ? '<div class="ggmsg"><b>🚕 Riding your route…</b></div>' : planHTML()) : g.check && g.check.kind === 'name' ? `<div class="ggctl named">${g.check.options.map((n) => `<button class="ggpick ggname" data-name="${esc(n)}"><span class="nm">${esc(short(n))}</span></button>`).join('')}</div>` : `${chipsRow()}${named ? `<div class="ggctl named">${pickBtns()}</div>` : `<div class="ggctl${canStraight ? ' three' : ''}">${btn('L', '◀ Left')}${canStraight ? btn('S', '▲ Straight') : ''}${btn('R', 'Right ▶')}</div>`}
        <div class="ggmsg${g.msg || g.check ? '' : ' muted'}">${
          g.check
            ? `<b>Heading ${WORD[g.check.h]}.</b> ${esc(g.check.thing[0].toUpperCase() + g.check.thing.slice(1))}: left or right?`
            : g.msg
              ? esc(g.msg)
              : rounds() <= 3
                ? named
                  ? 'Tap the way you want at the next corner'
                  : 'Left/Right: turn at the next corner · tap a corner: go there · hold: faster'
                : ''
        }</div>`}
        <div class="ggbar"${g.plan && !g.plan.riding && !g.done ? ' hidden' : ''}>
          ${g.done || g.startCard || g.plan ? '' : `<button id="ggPause" aria-label="${g.paused ? 'Resume' : 'Pause'}">${g.paused ? '▶ Go' : '⏸ Pause'}</button>`}
          ${!g.done && !g.startCard && !g.report && !g.plan ? `<button id="ggFast" aria-label="Hold to go faster">⏩ Hold</button>` : ''}
          ${!g.done && !g.startCard && !g.report && !(g.plan && !g.plan.riding) ? `<button id="ggMark" aria-label="Mark this spot">⚑</button>` : ''}
          ${!g.done && !g.startCard && !g.report ? OV_BTN() + TILT_BTN() : ''}
          ${!g.done && !g.startCard && prefs.guide === 'off' ? `<button id="ggPeek">👁 Peek</button>` : ''}
          ${hintReady() && !g.plan ? `<button id="ggHint">💡 Hint</button>` : ''}
          ${g.plan && !g.plan.riding && !g.done ? '' : `<button id="ggMore" aria-expanded="${!!g.more}" aria-label="More">${g.more ? '✕' : '⋯'}</button>`}
        </div>
        ${
          g.more
            ? `<div class="ggmore">
                ${!g.done && !g.startCard && !g.report ? `<button id="ggOff">⚑ Something’s off</button>` : ''}
                <button id="ggOptsBtn" aria-expanded="${!!prefs.optsOpen}">⚙ Options</button>
              </div>`
            : ''
        }
        <div class="ggopts"${g.more && prefs.optsOpen ? '' : ' hidden'}>
          <select id="ggArea" aria-label="Area"${Object.keys(AREAS).length < 2 ? ' hidden' : ''}>${Object.entries(AREAS).map(([k, v]) => `<option value="${k}"${prefs.area === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          ${G.d && G.d.tiers ? `<select id="ggBackbone" aria-label="Which corners">${[['first', 'Corners: spine streets first'], ['all', 'Corners: every street equally']].map(([k, v]) => `<option value="${k}"${(prefs.backbone || 'first') === k ? ' selected' : ''}>${v}</option>`).join('')}</select>` : ''}
          <select id="ggFrom" aria-label="Start">${[['both', 'Start: mixed'], ['entries', 'Start: tunnels & bridges'], ['anywhere', 'Start: anywhere']].map(([k, v]) => `<option value="${k}"${prefs.from === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select id="ggStyle" aria-label="Play style">${[['plan', 'Play: plan, then ride'], ['drive', 'Play: free drive']].map(([k, v]) => `<option value="${k}"${prefs.style === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select id="ggGuide" aria-label="Guide">${Object.entries(GUIDES).map(([k, v]) => `<option value="${k}"${prefs.guide === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select id="ggRideSpeed" aria-label="Ride and replay speed">${[['quick', 'Replay: quick'], ['steady', 'Replay: steady'], ['slow', 'Replay: slow']].map(([k, v]) => `<option value="${k}"${(prefs.rideSpeed || 'steady') === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select id="ggDetour" aria-label="Lincoln Tunnel overnight detour">${[['auto', 'Lincoln Tunnel: varied times, real patterns'], ['now', 'Lincoln Tunnel: the real time now'], ['on', 'Lincoln Tunnel: always the overnight detour'], ['off', 'Lincoln Tunnel: always the usual entrances']].map(([k, v]) => `<option value="${k}"${(prefs.lteDetour || 'auto') === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select id="ggPace" aria-label="Speed">${Object.keys(PACE).map((p) => `<option value="${p}"${prefs.pace === p ? ' selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select>
          <details class="ggmoreopts">
            <summary>More options</summary>
            <label><input type="checkbox" id="ggArrows"${prefs.arrows ? ' checked' : ''}/> One-way arrows</label>
            <label><input type="checkbox" id="ggLabels"${prefs.labels ? ' checked' : ''}/> Street names (off: hard mode)</label>
            <label><input type="checkbox" id="ggLandmarks"${prefs.landmarks === false ? '' : ' checked'}/> Landmark callouts ("by the way, that's the Chrysler Building") · <a href="credits.html" target="_blank" rel="noopener">photo credits</a></label>
            <label><input type="checkbox" id="ggCover"${prefs.cover ? ' checked' : ''}/> Show streets I've driven</label>
            <label><input type="checkbox" id="ggTrips"${prefs.trips ? ' checked' : ''}/> Mix in my saved trips</label>
            <label><input type="checkbox" id="ggMapFirst"${prefs.mapFirst ? ' checked' : ''}/> Map first</label>
            ${earlierLogs()}
          </details>
        </div>
      </div>`
    );
    if (showHeader()) g.opts.bindHeader();
    // driving controls act on touch-down: the panel redraws at every corner, and a tap whose
    // button is replaced between finger-down and finger-up would otherwise be lost
    for (const b of document.querySelectorAll('.ggturn')) onTap(b, () => press(b.dataset.side));
    for (const b of document.querySelectorAll('.ggpick:not(.ggname)')) onTap(b, () => pickLink(+b.dataset.link));
    document.getElementById('ggPause')?.addEventListener('click', togglePause);
    { const ov = document.getElementById('ggOv'); if (ov) onTap(ov, toggleOverview); }
    { const tb = document.getElementById('ggTilt'); if (tb) onTap(tb, toggleTilt); }
    document.getElementById('ggPeek')?.addEventListener('click', peek);
    document.getElementById('ggHint')?.addEventListener('click', showHint);
    document.getElementById('ggUndo')?.addEventListener('click', planUndo);
    document.getElementById('ggRide')?.addEventListener('click', startRide);
    // one tap, no pause: mark where something went wrong; send it from the end screen
    document.getElementById('ggMark')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!g || g.done || g.startCard) return;
      g.flags = (g.flags || 0) + 1;
      const snap = snapshot();
      logEv('flag', snap.link, snap.s, snap.plan ? `plan:${snap.plan}` : g.waiting ? 'stopped' : 'moving', { corner: snap.corner, where: snap.where, shown: snap.shown, screen: snap.screen });
      const b = document.getElementById('ggMark');
      if (b) b.textContent = `⚑ ${g.flags}`;
    });
    document.getElementById('ggFlagSend')?.addEventListener('click', () => openReport('off'));
    document.getElementById('ggOff')?.addEventListener('click', () => {
      g.more = false;
      openReport('off');
    });
    document.getElementById('ggLog')?.addEventListener('click', () => openReport('log'));
    document.getElementById('ggOldLog')?.addEventListener('click', () => {
      const sel = document.getElementById('ggOldSel');
      const log = ctx.store.get('driveLogs', [])[+sel.value];
      if (log) openReport('log', log);
    });
    if (g.report) bindReport();
    for (const b of document.querySelectorAll('.ggchip')) onTap(b, () => goToNode(+b.dataset.node));
    for (const b of document.querySelectorAll('.ggname')) onTap(b, () => answerName(b.dataset.name));
    const fast = document.getElementById('ggFast');
    if (fast) {
      const on = (v) => (e) => {
        e.preventDefault();
        if (!g) return;
        g.boost = v;
        carEl.classList.toggle('boost', v);
        fast.classList.toggle('on', v);
      };
      fast.addEventListener('pointerdown', on(true));
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) fast.addEventListener(ev, on(false));
      fast.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    document.getElementById('ggSame')?.addEventListener('click', () => start(g.opts, g.route));
    document.getElementById('ggRace')?.addEventListener('click', () => startRace());
    document.getElementById('ggSave')?.addEventListener('click', (e) => {
      const trips = mem.get('trips', []);
      if (!trips.some((t) => routeKey(t) === routeKey(g.route))) trips.push(g.route);
      mem.set('trips', trips.slice(-40));
      e.target.textContent = '★ Saved';
      e.target.disabled = true;
    });
    const toggle = (id, key, after) =>
      document.getElementById(id).addEventListener('change', (e) => {
        prefs[key] = e.target.checked;
        savePrefs();
        after?.();
      });
    toggle('ggLabels', 'labels', () => g && !g.done && showLabels(prefs.labels));
    toggle('ggCover', 'cover', showCover);
    document.getElementById('ggLandmarks').addEventListener('change', (e) => {
      prefs.landmarks = e.target.checked;
      savePrefs();
      if (!e.target.checked) hideLmTag();
    });
    toggle('ggTrips', 'trips');
    if (g.startCard) bindBriefing(guessSide, go0);
    document.getElementById('ggGuide').addEventListener('change', (e) => {
      prefs.guide = e.target.value;
      savePrefs();
      render();
    });
    document.getElementById('ggAgain')?.addEventListener('click', () => start(g.opts));
    document.getElementById('ggMore')?.addEventListener('click', () => {
      g.more = !g.more;
      render();
    });
    document.getElementById('ggOptsBtn')?.addEventListener('click', () => {
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
    if (document.getElementById('ggBackbone')) restartOn('ggBackbone', 'backbone');
    restartOn('ggStyle', 'style');
    document.getElementById('ggDetour').addEventListener('change', (e) => {
      prefs.lteDetour = e.target.value;
      savePrefs();
    });
    document.getElementById('ggRideSpeed').addEventListener('change', (e) => {
      prefs.rideSpeed = e.target.value;
      savePrefs();
    });
    document.getElementById('ggPace').addEventListener('change', (e) => {
      prefs.pace = e.target.value;
      savePrefs();
    });
    document.getElementById('ggMapFirst').addEventListener('change', (e) => {
      prefs.mapFirst = e.target.checked;
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
    _reportText: () => (g && g.report ? reportText(g.report.kind, g.report.log, g.report.snap, g.report.note) : null),
    _plan: { planCorner: (n) => planCorner(n), planTurn: (sd) => planTurn(sd), planPick: (id) => planPick(id), planStep: (id) => planStep(G.edges[id]), planUndo: () => planUndo(), startRide: () => startRide(), render: () => render() },
    _hood: (p, h) => noteHood(p, false, h),
    _lm: { note: (p, h) => { g.lmShown = new Set(); g.lmPlan = new Set(); noteLandmarks(p, h, performance.now()); }, open: (n) => openLmCard(n), tap: (x, y) => tapLandmark(x, y), peek: (n) => startPeek(n), end: () => endPeek(), items: () => lmItems.map((i) => i.l.n) },
    _model: { pickEntry, entryStart, choices, moves, shortest, straightTo, aheadChain, load, rule, describe, atTarget, arrivalSide, arrivalOK, chooseQuad, twoWay },
    _speed: () => (g && !g.loading && g.e ? speedNow() : 0),
    _mem: () => mem,
    _countWords: (a, b) => countWords(a, b),
    _prefs: () => prefs,
    _corners: () => cornersAhead(8),
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
