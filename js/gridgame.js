/* global maplibregl */
// Drive Manhattan: the real street network, every street from the Battery to
// Inwood with its legal direction (NYC's street centerline, built into
// data/manhattan-streets.json by tools/build_streets.py). The map is turned
// so Midtown's grid stands upright (uptown at the top); downtown streets run
// at their real angles.
//
// Your car drives on its own. Tap Left or Right before an intersection to
// turn there; tap a corner ahead to zip to it; hold the map to speed up.
// Wrong-way turns are refused with the reason: the rule of thumb when the
// street follows it ("odd streets go west"), the exception by name when it
// doesn't. Rounds can start inside a tunnel or on a bridge coming in, and
// end once you're on the destination's road heading toward it. At the end the
// map shows your route next to the shortest legal one.

import { framesStats } from './frames.js';

const DATA_URL = 'data/manhattan-streets.json';
const CHECK_EVERY_MS = 35000; // a check-in at most this often
const GRID = 29; // the grid is turned ~29° clockwise from north
const ZOOM = 15.7; // driving zoom
const PACE = { easy: 1, normal: 1.35, fast: 1.9 }; // speed multipliers
const SPEED = 105; // metres per second of game time at Easy (a long crosstown block in ~2 s)
const CORNER_SLOW = 0.5; // half speed over the last stretch before an intersection: time to decide
const GOTO_SPEED = 5.5; // multipliers: heading to a tapped corner,
const HOLD_SPEED = 4; // holding the map,
const HOME_SPEED = 14; // and on the home stretch
const AVENUE_RULE = {
  '1st Ave': 'U', '2nd Ave': 'D', '3rd Ave': 'U', 'Lexington Ave': 'D', 'Madison Ave': 'U', '5th Ave': 'D',
  '6th Ave': 'U', '7th Ave': 'D', '8th Ave': 'U', '9th Ave': 'D', '10th Ave': 'U', 'Amsterdam Ave': 'U', 'Columbus Ave': 'D',
};
const TWO_WAY_STREETS = new Set([14, 23, 34, 42, 57, 72, 79, 86, 96, 106, 110, 116, 125, 135, 145, 155]);
const WORD = { U: 'uptown', D: 'downtown', E: 'east', W: 'west' };
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
/** Position across / up the grid, metres (for areas and "to go" words). */
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

  // ---- the graph -------------------------------------------------------------------
  async function load() {
    if (G) return G;
    const d = await fetch(DATA_URL).then((r) => r.json());
    const [ox, oy] = d.origin;
    const nodes = [];
    for (let i = 0; i < d.nodes.length; i += 2) nodes.push([ox + d.nodes[i] / d.scale, oy + d.nodes[i + 1] / d.scale]);
    const feeders = new Set(d.feeders);
    const out = nodes.map(() => []);
    const inn = nodes.map(() => []);
    const edges = []; // directed
    d.edges.forEach(([a, b, nid, dir, mid], seg) => {
      const pts = [nodes[a]];
      if (mid) for (let i = 0; i < mid.length; i += 2) pts.push([ox + mid[i] / d.scale, oy + mid[i + 1] / d.scale]);
      pts.push(nodes[b]);
      const mk = (from, to, p) => {
        const cum = [0];
        for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + metres(p[i - 1], p[i]));
        const e = {
          id: edges.length, from, to, seg, pts: p, cum, len: cum[cum.length - 1] || 1,
          name: d.names[nid], oneway: dir !== 0,
          b0: bearing(p[0], p[1]), b1: bearing(p[p.length - 2], p[p.length - 1]),
        };
        edges.push(e);
        out[from].push(e);
        inn[to].push(e);
      };
      if (dir >= 0) mk(a, b, pts);
      if (dir <= 0) mk(b, a, [...pts].reverse());
    });
    // distinct neighbours: 3+ means a real intersection
    const nb = nodes.map(() => new Set());
    for (const e of edges) {
      nb[e.from].add(e.to);
      nb[e.to].add(e.from);
    }
    const label = (n) => {
      const names = [];
      for (const e of [...out[n], ...inn[n]]) if (!names.includes(e.name)) names.push(e.name);
      return names.slice(0, 2).join(' & ');
    };
    const gy = nodes.map((p) => gridXY(p)[1]);
    G = { d, nodes, edges, out, inn, nb, feeders, label, gy, places: d.places, entries: d.entries, areas: d.areas };
    // where each entry first reaches a real intersection (for area filtering)
    for (const en of G.entries) {
      let n = en.node;
      for (let i = 0; i < 200 && (G.feeders.has(n) || G.nb[n].size < 3); i++) {
        const o = G.out[n][0];
        if (!o) break;
        n = o.to;
      }
      en.landsAt = n;
    }
    buildArrows();
    return G;
  }

  /** The choices at the end of edge e: {straight, left, right} or {only} (no real choice). */
  const choiceCache = new Map();
  function choices(e) {
    if (choiceCache.has(e.id)) return choiceCache.get(e.id);
    const opts = G.out[e.to].filter((o) => o.seg !== e.seg); // no U-turns
    let c;
    if (!opts.length) {
      const back = G.out[e.to].find((o) => o.seg === e.seg);
      c = { only: back || null, uturn: true, options: back ? [back] : [] };
    } else if (opts.length === 1) c = { only: opts[0], options: opts };
    else {
      const withD = opts.map((o) => ({ o, d: angleDiff(o.b0, e.b1) }));
      let straight = withD.filter((x) => x.o.name === e.name && Math.abs(x.d) <= 50).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0];
      if (!straight) straight = withD.filter((x) => Math.abs(x.d) <= 32).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0];
      const rest = withD.filter((x) => x !== straight);
      const left = rest.filter((x) => x.d < -20).sort((a, b) => Math.abs(a.d + 90) - Math.abs(b.d + 90))[0];
      const right = rest.filter((x) => x.d > 20).sort((a, b) => Math.abs(a.d - 90) - Math.abs(b.d - 90))[0];
      c = { straight: straight?.o || null, left: left?.o || null, right: right?.o || null, options: opts };
    }
    c.decision = !('only' in c);
    choiceCache.set(e.id, c);
    return c;
  }
  /** The moves the buttons can make from the end of edge e. */
  function moves(e) {
    const c = choices(e);
    return !c.decision ? (c.only ? [c.only] : []) : [c.straight, c.left, c.right].filter(Boolean);
  }

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
  /** Refusal text for a one-way road d (an edge that runs toward the corner we're at). */
  function wrongWay(d) {
    const dir = gridDir(d.b1); // the way traffic flows on it
    const r = rule(d.name);
    const nm = short(d.name);
    if (r && r === dir) return `${nm} runs ${WORD[dir]} only (${ruleText(d.name)}).`;
    if (r === 'two') return `${nm} runs ${WORD[dir]} only on this block: an exception (it's usually two-way).`;
    if (r) return `${nm} runs ${WORD[dir]} here: an exception (${ruleText(d.name)}).`;
    return `${nm} is one-way here: traffic runs ${WORD[dir]}.`;
  }
  /** A heads-up when driving onto a block that breaks the rule. */
  function exceptionNote(e) {
    const r = rule(e.name);
    if (!r || r === 'two') return null;
    const dir = gridDir(e.b0);
    const isAve = !!AVENUE_RULE[e.name];
    if (!e.oneway) return `Heads up: ${short(e.name)} runs both ways here, an exception (${isAve ? `${WORD[r]} elsewhere` : ruleText(e.name)}).`;
    if (dir !== r && (isAve ? dir === 'U' || dir === 'D' : dir === 'E' || dir === 'W'))
      return `Heads up: ${short(e.name)} runs ${WORD[dir]} here, an exception (${ruleText(e.name)}).`;
    return null;
  }

  // ---- map layers -------------------------------------------------------------------------
  let arrowsFC = null;
  function buildArrows() {
    // one-way blocks as lines drawn the way traffic flows; exceptions flagged
    const seen = new Set();
    const feats = [];
    for (const e of G.edges) {
      if (!e.oneway || seen.has(e.seg)) continue;
      seen.add(e.seg);
      feats.push({ type: 'Feature', properties: { name: e.name, exc: exceptionNote(e) ? 1 : 0 }, geometry: { type: 'LineString', coordinates: e.pts } });
    }
    arrowsFC = { type: 'FeatureCollection', features: feats };
  }
  const EMPTY = { type: 'FeatureCollection', features: [] };
  function ensureLayers() {
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
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 70, 'text-field': '›', 'text-font': ['Noto Sans Medium'], 'text-size': 22, 'text-keep-upright': false, 'text-allow-overlap': true, 'text-ignore-placement': true, visibility: 'none' },
      paint: { 'text-color': ['case', ['==', ['get', 'exc'], 1], '#c47a00', '#1f1b16'], 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
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
  offEl.innerHTML = '<span></span>';
  offEl.hidden = true;
  document.body.appendChild(offEl);

  function posOnEdge(e, s) {
    s = Math.max(0, Math.min(e.len, s));
    let i = 1;
    while (i < e.cum.length - 1 && e.cum[i] < s) i++;
    const a = e.pts[i - 1], b = e.pts[i];
    const t = (s - e.cum[i - 1]) / (e.cum[i] - e.cum[i - 1] || 1);
    return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], b: bearing(a, b) };
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
  const isCore = (n) => !G.feeders.has(n);
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
  /** Following straight on (and through bends with no choice) from the end of edge e: the corners ahead. */
  function aheadChain(e, maxNodes = 80, maxM = 6000) {
    const outN = [];
    let cur = e, m = 0;
    const seen = new Set();
    for (let i = 0; i < maxNodes && m < maxM; i++) {
      outN.push({ node: cur.to, via: cur });
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      const c = choices(cur);
      const nx = !c.decision ? (c.uturn ? null : c.only) : c.straight;
      if (!nx) break;
      m += nx.len;
      cur = nx;
    }
    return outN;
  }
  /** Is node t straight ahead on this road from edge e (no turns)? */
  function straightTo(e, t) {
    return aheadChain(e, 120, 8000).some((x) => x.node === t);
  }
  function pickRound() {
    const coreNodes = [];
    for (let n = 0; n < G.nodes.length; n++) if (isCore(n) && G.nb[n].size >= 3 && inArea(n)) coreNodes.push(n);
    const places = G.places.filter((p) => inArea(p.node));
    const entries = G.entries.filter((en) => inArea(en.landsAt));
    const useEntry = entries.length && (prefs.from === 'entries' || (prefs.from === 'both' && Math.random() < 0.5));
    for (let tries = 0; tries < 300; tries++) {
      const target = places.length && Math.random() < 0.7 ? { ...rand(places) } : { name: null, node: rand(coreNodes) };
      target.label = G.label(target.node);
      let e0, entry = null;
      if (useEntry) {
        entry = rand(entries);
        e0 = G.out[entry.node][0];
        if (!e0) continue;
      } else {
        const n = rand(coreNodes);
        const outs = G.out[n].filter((o) => isCore(o.to));
        if (!outs.length) continue;
        e0 = rand(outs);
      }
      const dm = metres(G.nodes[e0.from], G.nodes[target.node]);
      if (dm < 500 || dm > (entry ? 7000 : 3000)) continue;
      if (straightTo(e0, target.node)) continue; // already on the right road
      const best = shortest(e0, target.node);
      if (!best || best.path.length < 4) continue;
      return { e0, target, best, entry };
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
    document.body.classList.add('gridding');
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    map.setGlobalStateProperty('quiet', false);
    g = {
      opts, target: r.target, best: r.best, entry: r.entry,
      e: r.e0, s: 0, // on edge e, s metres along
      waiting: false, queued: null, goTo: null, home: false, boost: false, paused: false, done: false,
      driven: 0, wrong: 0, trail: [G.nodes[r.e0.from]], msg: '', msgAt: 0, lastNote: null,
      last: performance.now(), raf: 0, view: prefs.mapFirst && ctx.dur(1) ? 'intro' : 'follow',
      check: null, lastCheck: performance.now() - CHECK_EVERY_MS / 2, checks: 0, checksRight: 0, resumeAt: 0,
    };
    const tp = G.nodes[r.target.node];
    setData('gg-target', point(tp, { name: r.target.name || r.target.label }));
    setData('gg-trail', EMPTY);
    setData('gg-best', EMPTY);
    setData('gg-goto', EMPTY);
    showArrows();
    carMk.setLngLat(G.nodes[r.e0.from]).addTo(map);
    if (r.entry) {
      g.msg = `Coming in from ${r.entry.from}. Follow the road out, then find your way.`;
      g.msgAt = performance.now() + 6000;
    }
    enterEdge(g.e);
    render();
    if (g.view === 'intro') {
      ctx.fit([G.nodes[r.e0.from], tp], 15, { bearing: GRID, duration: 700 });
      setTimeout(() => {
        if (g && g.view === 'intro') g.view = 'follow';
      }, 1700);
    } else map.jumpTo({ center: G.nodes[r.e0.from], zoom: ZOOM, bearing: GRID });
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
    document.body.classList.remove('gridding');
    for (const id of ['gg-trail', 'gg-best', 'gg-target', 'gg-goto']) setData(id, EMPTY);
    if (map.getLayer('gg-arrows')) map.setLayoutProperty('gg-arrows', 'visibility', 'none');
    map.setGlobalStateProperty('quiet', ctx.mode === 'practice');
  }

  const onKey = (e) => {
    if (!g || g.done || g.loading) return;
    if (e.key === 'ArrowLeft') press('L');
    else if (e.key === 'ArrowRight') press('R');
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
    if (!g.home && isCore(e.from) && straightTo(e, g.target.node)) {
      g.home = true;
      g.goTo = null;
      g.queued = null;
      setData('gg-goto', EMPTY);
      g.msg = `✓ Right road: ${short(e.name)} takes you straight there.`;
      g.msgAt = performance.now();
    }
  }

  // ---- check-ins: "You're heading downtown. Which side is the Hudson?" ----------------------
  function maybeCheckIn(now) {
    if (!prefs.checkins || g.auto || g.check || g.done || g.waiting || g.home || g.goTo != null || g.queued || g.paused || g.view !== 'follow') return;
    if (now - g.lastCheck < CHECK_EVERY_MS || !isCore(g.e.from) || g.e.len < 60 || g.s < g.e.len * 0.25 || g.s > g.e.len * 0.6) return;
    const h = gridDir(g.bnow);
    let thing, dir;
    if (h === 'U' || h === 'D') {
      const harlem = G.gy[g.e.from] > G.areas['110'] + 800;
      [thing, dir] = Math.random() < 0.5 ? ['the Hudson', 'W'] : [harlem ? 'the Harlem River' : 'the East River', 'E'];
    } else [thing, dir] = Math.random() < 0.5 ? ['uptown', 'U'] : ['downtown', 'D'];
    // which hand that direction is on, facing h
    const order = ['U', 'E', 'D', 'W'];
    const steps = (order.indexOf(dir) - order.indexOf(h) + 4) % 4;
    g.check = { h, thing, dir, answer: steps === 1 ? 'R' : 'L' };
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
    g.lastCheck = performance.now();
    g.resumeAt = performance.now() + 900;
    const where = `${c.thing}${c.thing.startsWith('the') ? ` (${WORD[c.dir]})` : ''}`;
    g.msg = `${ok ? '✓' : '✗'} Heading ${WORD[c.h]}, ${where} is on your ${c.answer === 'L' ? 'left' : 'right'}.`;
    g.msgAt = performance.now();
    render();
  }

  function speedNow() {
    const base = SPEED * PACE[prefs.pace];
    if (g.home) return base * HOME_SPEED;
    if (g.goTo != null) return base * GOTO_SPEED;
    if (g.boost) return base * HOLD_SPEED;
    // slow down before a real intersection, so there's a moment to decide
    if (choices(g.e).decision && g.e.len - g.s < 30) return base * CORNER_SLOW;
    return base;
  }

  function tick(now) {
    if (!g || g.loading) return;
    const dt = Math.min(0.1, (now - g.last) / 1000);
    g.last = now;
    if (!g.paused && !g.done && !g.waiting && g.view !== 'intro' && !g.check && now >= g.resumeAt) {
      g.s += dt * speedNow();
      let guard = 0;
      while (g && !g.done && !g.waiting && g.s >= g.e.len && guard++ < 50) {
        const over = g.s - g.e.len;
        arrive();
        if (g && !g.waiting && !g.done) g.s = Math.min(over, g.e.len);
      }
    }
    if (!g) return;
    const { p, b } = g.waiting || g.done ? { p: G.nodes[g.e.to], b: g.e.b1 } : posOnEdge(g.e, g.s);
    g.pos = p;
    g.bnow = b;
    const hc = gridDir(b);
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
      map.easeTo({ center: p, zoom: ZOOM, bearing: GRID, offset: [0, oy], duration: 0 });
    }
    pointToTarget();
    g.raf = requestAnimationFrame(tick);
  }

  /** At the end of g.e: finish, stop at a tapped corner, turn, go straight, or wait. */
  function arrive() {
    const e = g.e;
    const n = e.to;
    g.driven += e.len;
    g.trail.push(...e.pts.slice(1));
    setData('gg-trail', line(g.trail));
    if (g.msg && performance.now() - g.msgAt > 3500) g.msg = '';
    if (n === g.target.node) return finish();
    if (g.goTo === n) {
      g.msg = ''; // the tapped corner: say where you are, not an older note
      return stopHere();
    }
    if (g.auto) autopilot(e);
    const c = choices(e);
    if (!c.decision) {
      if (!c.only) return stopHere('Dead end.');
      if (c.uturn) {
        g.msg = `Dead end: turning around on ${short(e.name)}.`;
        g.msgAt = performance.now();
      }
      go(c.only);
      return;
    }
    if (g.queued) {
      const side = g.queued;
      g.queued = null;
      const nx = side === 'L' ? c.left : c.right;
      if (nx) {
        go(nx);
        render();
        return;
      }
      refuse(e, side);
    }
    if (c.straight) {
      go(c.straight);
      render();
      return;
    }
    stopHere('End of the road this way: turn left or right.');
  }
  function go(nx) {
    g.e = nx;
    g.s = 0;
    g.waiting = false;
    enterEdge(nx);
  }
  function stopHere(msg) {
    g.waiting = true;
    g.goTo = null;
    setData('gg-goto', EMPTY);
    g.s = g.e.len;
    if (msg && !g.msg) {
      g.msg = msg;
      g.msgAt = performance.now();
    }
    if (!g.msg) {
      g.msg = `At ${G.label(g.e.to)}. Turn left or right, or tap a corner further ahead.`;
      g.msgAt = performance.now();
    }
    render();
  }
  /** Why there's no turn that way: a one-way street against you, or no road at all. */
  function refuse(e, side) {
    let why = null;
    for (const d of G.inn[e.to]) {
      if (!d.oneway || d.seg === e.seg) continue;
      const outward = (d.b1 + 180) % 360;
      const dd = angleDiff(outward, e.b1);
      if (side === 'L' ? dd < -20 && dd > -160 : dd > 20 && dd < 160) {
        why = wrongWay(d);
        g.wrong++;
        showArrows(d.name);
        break;
      }
    }
    g.msg = `⛔ ${why || `No ${side === 'L' ? 'left' : 'right'} turn here: there's no road that way.`}`;
    g.msgAt = performance.now();
  }
  function press(side) {
    if (!g || g.done || g.loading) return;
    if (g.check) return answerCheck(side);
    if (g.waiting) {
      const c = choices(g.e);
      const nx = side === 'L' ? c.left : c.right;
      if (!nx) {
        refuse(g.e, side);
        render();
        return;
      }
      g.msg = '';
      go(nx);
      render();
      return;
    }
    g.queued = g.queued === side ? null : side;
    g.home = false;
    if (g.goTo != null) {
      g.goTo = null;
      setData('gg-goto', EMPTY);
    }
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
    const nx = r && r.path[1];
    const c = choices(e);
    g.queued = !nx || !c.decision || nx === c.straight ? null : nx === c.left ? 'L' : nx === c.right ? 'R' : null;
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
    const rect = map.getContainer().getBoundingClientRect();
    const st = g.waiting ? choices(g.e).straight : null;
    const chain = g.waiting ? (st ? aheadChain(st) : []) : aheadChain(g.e);
    let best = null;
    for (const { node } of chain) {
      if (G.nb[node].size < 3) continue;
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
    setData('gg-goto', point(G.nodes[best.node]));
    if (g.waiting) {
      g.msg = '';
      go(st);
    }
    render();
  }

  function pointToTarget() {
    if (!g || g.done || !g.target) return;
    const pad = ctx.padding();
    const tp = map.project(G.nodes[g.target.node]);
    const rect = map.getContainer().getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const x = tp.x + rect.left, y = tp.y + rect.top;
    const top = pad.top + 8, bottom = H - pad.bottom - 8;
    const inView = x > 14 && x < W - 14 && y > top && y < bottom;
    offEl.hidden = inView;
    if (inView) return;
    const cx = W / 2, cy = (top + bottom) / 2;
    const ang = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
    offEl.style.transform = `translate(${Math.min(W - 26, Math.max(26, x))}px, ${Math.min(bottom - 18, Math.max(top + 18, y))}px) translate(-50%, -50%)`;
    offEl.firstChild.style.transform = `rotate(${ang}deg)`;
  }

  function finish() {
    g.done = true;
    g.waiting = true;
    offEl.hidden = true;
    const bestCoords = [];
    g.best.path.forEach((e, i) => bestCoords.push(...(i ? e.pts.slice(1) : e.pts)));
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
    g.result = `<div class="fb ${ok ? 'ok' : 'no'}">${ok ? '✓' : '•'} You made it: ${mi(g.driven)} mi${
      g.wrong ? `, ${g.wrong} wrong-way ${g.wrong === 1 ? 'try' : 'tries'}` : ''
    }. Shortest legal route: ${mi(g.best.cost)} mi${ratio <= 1.03 ? ' (that was it)' : ''}.${g.checks ? ` Check-ins: ${g.checksRight} of ${g.checks}.` : ''}</div>
      <div class="hint"><span class="gg-key you"></span> your route · <span class="gg-key best"></span> shortest: ${esc(describe(g.best.path))}</div>
      <button class="primary" id="ggAgain">Another route</button>`;
    render();
  }

  /** "Up 8th Ave → right on W 42nd St → …" */
  function describe(path) {
    const legs = [];
    for (let i = 0; i < path.length; i++) {
      const e = path[i];
      const last = legs[legs.length - 1];
      if (last && last.name === e.name) continue;
      if (!isCore(e.from) && !last) continue; // still on the way in from outside
      const dir = gridDir(e.b0);
      let turn;
      if (!last) turn = dir === 'U' ? 'Up' : dir === 'D' ? 'Down' : dir === 'E' ? 'East on' : 'West on';
      else {
        const d = angleDiff(e.b0, path[i - 1].b1);
        turn = d < -20 ? 'left on' : d > 20 ? 'right on' : 'onto';
      }
      legs.push({ name: e.name, text: `${turn} ${short(e.name)}` });
    }
    return legs.map((l) => l.text).join(' → ');
  }

  // ---- words on screen -------------------------------------------------------------------
  function toGo() {
    const a = gridXY(g.pos || G.nodes[g.e.from]), b = gridXY(G.nodes[g.target.node]);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const mi = Math.hypot(dx, dy) / 1609.34;
    const ud = Math.abs(dy) > 60 ? (dy > 0 ? 'uptown' : 'downtown') : '';
    const ew = Math.abs(dx) > 60 ? (dx > 0 ? 'east' : 'west') : '';
    return `${mi < 0.1 ? 'under 0.1' : mi.toFixed(1)} mi to go${ud || ew ? `, ${[ud, ew].filter(Boolean).join(' and ')}` : ''}`;
  }
  function render() {
    if (!g) return;
    if (g.loading) {
      ctx.hud('<div class="qkind">🚕 Drive Manhattan</div><div class="q">Loading the street map…</div>');
      ctx.sheet(`${g.opts.header()}`);
      g.opts.bindHeader();
      return;
    }
    const t = g.target;
    const tgt = t.name ? `<b>${esc(t.name)}</b> <span class="muted">(${esc(t.label)})</span>` : `<b>${esc(t.label)}</b>`;
    const where = `On <b>${esc(short(g.e.name))}</b> heading <b>${WORD[gridDir(g.e.b0)]}</b>`;
    ctx.hud(
      `<div class="qkind">🚕 Drive Manhattan${g.entry ? ` · from ${esc(g.entry.from)}` : ''}</div><div class="q">Get to ${tgt}</div>
       ${g.done ? '' : `<div class="hint">${where}${g.queued ? ` · turning <b>${g.queued === 'L' ? 'left' : 'right'}</b> at the next corner` : ''} · ${esc(toGo())}</div>`}`
    );
    // the compass word for each hand, fading as this heading becomes solid (none during a check-in: it'd give it away)
    const hb = g.bnow ?? g.e.b0;
    const lvl = g.check ? 'hide' : fstats.hint(gridDir(hb));
    const hint = (dir) => (lvl === 'hide' ? '' : `<span class="dirhint${lvl === 'faint' ? ' faint' : ''}">${WORD[dir]}</span>`);
    const btn = (side, label) =>
      `<button class="ggturn${g.queued === side ? ' on' : ''}${g.check ? ' check' : ''}" data-side="${side}" ${g.done ? 'disabled' : ''}>${label}${hint(gridDir(hb + (side === 'L' ? -90 : 90)))}</button>`;
    ctx.sheet(
      `${g.opts.header()}<div id="qbody">
        ${g.done ? g.result : `<div class="ggctl">${btn('L', '◀ Left')}${btn('R', 'Right ▶')}</div>
        <div class="ggmsg${g.msg || g.check ? '' : ' muted'}">${
          g.check
            ? `<b>Check-in:</b> you're heading <b>${WORD[g.check.h]}</b>. Which side is <b>${esc(g.check.thing)}</b>?`
            : g.msg
              ? esc(g.msg)
              : 'Left/Right turn at the next intersection. Tap a corner ahead to zip there; hold the map to speed up.'
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
