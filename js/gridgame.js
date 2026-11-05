// Drive the grid: Midtown's street grid, straightened, with uptown at the top.
// Your car drives on its own; tap Left or Right to turn at the next corner.
// One-way streets are enforced the way the signs are: odd streets run west,
// even streets run east, the big crosstown streets run both ways, and the
// avenues alternate. Wrong-way turns are refused and explained. At the end
// your route is drawn next to the shortest legal one.
//
// Every block's direction is the real one, from NYC's street centerline
// (js/midtowngrid.js, built by tools/build_grid.py). Refusals explain the
// rule when the block follows it, and name the exception when it doesn't, so
// you learn the rule and the blocks that break it. Construction and bus lanes
// change week to week and aren't modeled.

import { GRID_DATA } from './midtowngrid.js';

const FT_PER_STREET = 264; // ~20 streets to the mile
const S_MIN = 14;
const S_MAX = 57;
const TWO_WAY_STREETS = new Set([14, 23, 34, 42, 57]);

// West to east; x in feet from 5th Ave (long blocks on the West Side, short on the East)
const AVES = [
  { name: '11th Ave', x: -4960, dir: 'two' },
  { name: '10th Ave', x: -4160, dir: 'up' },
  { name: '9th Ave', x: -3360, dir: 'down' },
  { name: '8th Ave', x: -2560, dir: 'up' },
  { name: '7th Ave', x: -1760, dir: 'down' },
  { name: '6th Ave', x: -920, dir: 'up' },
  { name: '5th Ave', x: 0, dir: 'down' },
  { name: 'Madison Ave', x: 420, dir: 'up', from: 23 },
  { name: 'Park Ave', x: 840, dir: 'two' },
  { name: 'Lexington Ave', x: 1260, dir: 'down', from: 21 },
  { name: '3rd Ave', x: 1660, dir: 'up' },
  { name: '2nd Ave', x: 2310, dir: 'down' },
  { name: '1st Ave', x: 2960, dir: 'up' },
];
const PARK = AVES.findIndex((a) => a.name === 'Park Ave');
const aveName = (ai, s) => (ai === PARK ? (s >= 32 ? 'Park Ave' : 'Park Ave S') : AVES[ai].name);
const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const streetName = (s) => `${ord(s)} St`;

// Street blocks that don't go through: [street, west avenue, east avenue, why]
const ave = (n) => AVES.findIndex((a) => a.name === n);
const BLOCKED = [
  [41, ave('6th Ave'), ave('5th Ave'), 'Bryant Park and the Library'],
  [32, ave('8th Ave'), ave('7th Ave'), 'Madison Square Garden and Penn Station'],
  [24, ave('5th Ave'), ave('Madison Ave'), 'Madison Square Park'],
  [25, ave('5th Ave'), ave('Madison Ave'), 'Madison Square Park'],
  [15, ave('5th Ave'), PARK, 'Union Square'],
  [16, ave('5th Ave'), PARK, 'Union Square'],
  [43, ave('Madison Ave'), PARK, 'Grand Central'],
  [44, ave('Madison Ave'), PARK, 'Grand Central'],
  [45, ave('Madison Ave'), PARK, 'Grand Central'],
  [43, PARK, ave('Lexington Ave'), 'Grand Central'],
  [44, PARK, ave('Lexington Ave'), 'Grand Central'],
  [45, PARK, ave('Lexington Ave'), 'Grand Central'],
];
// Park Ave rides the viaduct around Grand Central: no turns on or off here
const NO_TURN = new Set([41, 42, 43, 44, 45].map((s) => `${PARK}:${s}`));
const PARKS = [
  { name: 'Bryant Park', s0: 40, s1: 42, a0: ave('6th Ave'), a1: ave('5th Ave'), green: true },
  { name: 'Madison Sq Park', s0: 23, s1: 26, a0: ave('5th Ave'), a1: ave('Madison Ave'), green: true },
  { name: 'Union Square', s0: 14, s1: 17, a0: ave('5th Ave'), a1: PARK, green: true, inset: 0.35 },
  { name: 'MSG', s0: 31, s1: 33, a0: ave('8th Ave'), a1: ave('7th Ave') },
  { name: 'Grand Central', s0: 42, s1: 46, a0: ave('Madison Ave'), a1: ave('Lexington Ave'), inset: 0.18 },
];

const PLACES = [
  { name: 'Grand Central', ai: PARK, s: 42 },
  { name: 'Empire State Building', ai: ave('5th Ave'), s: 34 },
  { name: 'Madison Square Garden', ai: ave('7th Ave'), s: 33 },
  { name: 'Port Authority', ai: ave('8th Ave'), s: 42 },
  { name: 'Times Square', ai: ave('7th Ave'), s: 46 },
  { name: 'Radio City', ai: ave('6th Ave'), s: 50 },
  { name: 'the Library (Bryant Park)', ai: ave('5th Ave'), s: 42 },
  { name: 'MoMA', ai: ave('5th Ave'), s: 53 },
  { name: 'Carnegie Hall', ai: ave('7th Ave'), s: 57 },
  { name: 'the Flatiron Building', ai: ave('5th Ave'), s: 23 },
  { name: 'Chelsea Market', ai: ave('9th Ave'), s: 15 },
  { name: 'the Javits Center', ai: ave('11th Ave'), s: 36 },
  { name: 'the UN', ai: ave('1st Ave'), s: 45 },
  { name: 'Bellevue', ai: ave('1st Ave'), s: 27 },
  { name: 'Hudson Yards', ai: ave('10th Ave'), s: 33 },
  { name: "Macy's (Herald Square)", ai: ave('6th Ave'), s: 34 },
  { name: 'the Chrysler Building', ai: ave('Lexington Ave'), s: 42 },
];

// grid directions: U uptown, D downtown, E east, W west
const LEFT = { U: 'W', W: 'D', D: 'E', E: 'U' };
const RIGHT = { U: 'E', E: 'D', D: 'W', W: 'U' };
const DIR_WORD = { U: 'uptown', D: 'downtown', E: 'east', W: 'west' };
const ROT = { U: 0, E: 90, D: 180, W: 270 };
const PACE = { easy: 1, normal: 0.72, fast: 0.5 };

const exists = (ai, s) => s >= S_MIN && s <= S_MAX && s >= (AVES[ai].from || S_MIN);
const key = (ai, s) => `${ai}:${s}`;
/** The next avenue east/west of ai that exists on street s. */
function nextAve(ai, s, step) {
  for (let j = ai + step; j >= 0 && j < AVES.length; j += step) if (exists(j, s)) return j;
  return -1;
}
const blockedWhy = (s, a, b) => {
  const [w, e] = a < b ? [a, b] : [b, a];
  const hit = BLOCKED.find(([bs, bw, be]) => bs === s && bw === w && be === e);
  return hit ? hit[3] : null;
};
/** The rule of thumb for a street: odd west, even east, the big crosstown ones both ways. */
const ruleStreet = (s) => (TWO_WAY_STREETS.has(s) ? 'two' : s % 2 ? 'W' : 'E');
const ruleAve = (ai) => (AVES[ai].dir === 'two' ? 'two' : AVES[ai].dir === 'up' ? 'U' : 'D');
/** Real direction of the street block between avenue ai and the next one east: 'E' | 'W' | 'two' | null. */
const streetBlock = (s, westAi) => GRID_DATA.streets[s]?.[westAi] ?? null;
/** Real direction of avenue ai between street s and s + 1: 'U' | 'D' | 'two' | null. */
function aveBlock(ai, s) {
  // Park Ave rides the viaduct around Grand Central (41st-46th): both ways, no turns
  if (ai === PARK && s >= 41 && s <= 45) return 'two';
  return GRID_DATA.aves[AVES[ai].name]?.[s - S_MIN] ?? null;
}
const WORD = { E: 'east', W: 'west', U: 'uptown', D: 'downtown' };
const streetRuleText = (s) => (s % 2 ? 'odd streets usually go west' : 'even streets usually go east');

/**
 * Where driving from (ai, s) toward d leads: {ai, s, len} or {why} when you
 * can't (wrong way, dead end, blocked).
 */
function step(ai, s, d, turning) {
  if (turning && NO_TURN.has(key(ai, s))) return { why: 'No turns here: Park Ave runs on the viaduct around Grand Central.' };
  if (d === 'U' || d === 'D') {
    const s2 = s + (d === 'U' ? 1 : -1);
    if (s2 > S_MAX || s2 < S_MIN) return { why: 'That leaves the practice area.', edge: true };
    const real = aveBlock(ai, Math.min(s, s2));
    const name = aveName(ai, s);
    if (!real || !exists(ai, s2)) return { why: `${name} doesn't continue past ${streetName(s)}.`, edge: true };
    if (real !== 'two' && real !== d) {
      const rule = ruleAve(ai);
      return {
        why:
          rule === real
            ? `${name} runs ${WORD[real]} only.`
            : `${name} runs ${WORD[real]} only on this stretch (an exception: ${rule === 'two' ? 'it runs both ways elsewhere' : `it runs ${WORD[rule]} elsewhere`}).`,
        wrong: true,
      };
    }
    const r = { ai, s: s2, len: FT_PER_STREET };
    const rule = ruleAve(ai);
    if (real !== rule && !(ai === PARK && s >= 41 && s <= 45))
      r.note = `${name} runs ${real === 'two' ? 'both ways' : `${WORD[real]} only`} here: an exception (${rule === 'two' ? 'both ways' : `${WORD[rule]}`} elsewhere).`;
    return r;
  }
  const aj = nextAve(ai, s, d === 'E' ? 1 : -1);
  if (aj < 0) return { why: 'That leaves the practice area.', edge: true };
  const west = Math.min(ai, aj), east = Math.max(ai, aj);
  const real = streetBlock(s, west);
  const where = `between ${aveName(west, s)} and ${aveName(east, s)}`;
  if (!real) {
    const why = blockedWhy(s, ai, aj);
    return { why: `${streetName(s)} doesn't go through ${where}${why ? `: ${why}` : ''}.` };
  }
  const rule = ruleStreet(s);
  if (real !== 'two' && real !== d)
    return {
      why:
        real === rule
          ? `${streetName(s)} runs ${WORD[real]} only (${s % 2 ? 'odd streets go west' : 'even streets go east'}).`
          : `${streetName(s)} runs ${WORD[real]} ${where}: an exception (${streetRuleText(s)}).`,
      wrong: true,
    };
  const r = { ai: aj, s, len: Math.abs(AVES[aj].x - AVES[ai].x) };
  if (real !== rule) r.note = `Heads up: ${streetName(s)} runs ${real === 'two' ? 'both ways' : WORD[real]} ${where}, an exception (${rule === 'two' ? 'it runs both ways elsewhere' : streetRuleText(s)}).`;
  return r;
}

/** Shortest legal route from a moving car (no U-turns). Returns [{ai,s,d}] states. */
function shortest(start, target) {
  const sk = (st) => `${st.ai}:${st.s}:${st.d}`;
  const dist = new Map([[sk(start), 0]]);
  const prev = new Map();
  const open = [{ ...start, c: 0 }];
  while (open.length) {
    open.sort((a, b) => a.c - b.c);
    const cur = open.shift();
    if (cur.c > dist.get(sk(cur))) continue;
    if (cur.ai === target.ai && cur.s === target.s) {
      const path = [cur];
      let k = sk(cur);
      while (prev.has(k)) {
        const p = prev.get(k);
        path.unshift(p);
        k = sk(p);
      }
      return { cost: cur.c, path };
    }
    // the first block is already under way: straight ahead only
    const first = !start.free && cur.ai === start.ai && cur.s === start.s && cur.d === start.d && cur.c === 0;
    for (const [d, turning] of first ? [[cur.d, false]] : [[cur.d, false], [LEFT[cur.d], true], [RIGHT[cur.d], true]]) {
      const r = step(cur.ai, cur.s, d, turning);
      if (r.why) continue;
      const nx = { ai: r.ai, s: r.s, d };
      const c = cur.c + r.len;
      if (c < (dist.get(sk(nx)) ?? Infinity)) {
        dist.set(sk(nx), c);
        prev.set(sk(nx), { ai: cur.ai, s: cur.s, d: cur.d });
        open.push({ ...nx, c });
      }
    }
  }
  return null;
}

/** "Up 8th Ave → right on 40th St → …" from a list of states. */
function describe(path) {
  const legs = [];
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const prevD = path[i - 1].d;
    const last = legs[legs.length - 1];
    if (last && last.d === p.d) continue;
    const from = path[i - 1];
    const road = p.d === 'U' || p.d === 'D' ? aveName(from.ai, from.s) : streetName(from.s);
    const turn = !last ? (p.d === 'U' ? 'Up' : p.d === 'D' ? 'Down' : p.d === 'E' ? 'East on' : 'West on') : LEFT[prevD] === p.d ? 'left on' : 'right on';
    legs.push({ d: p.d, text: `${turn} ${road}` });
  }
  return legs.map((l) => l.text).join(' → ');
}

export function initGridGame(ctx) {
  let g = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  const prefs = { pace: 'easy', arrows: false, ...ctx.store.get('gridPrefs', {}) };
  const savePrefs = () => ctx.store.set('gridPrefs', prefs);

  // ---- picture ------------------------------------------------------------
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, text) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  // world coordinates: x feet east of 5th Ave, y feet *down* (uptown is up)
  const X = (ai) => AVES[ai].x;
  const Y = (s) => -s * FT_PER_STREET;
  let wrap, svg, world, labelsG, arrowsG, pathEl, bestEl, car, flag, flagLabel, northEl, offscreen;

  function buildPicture() {
    wrap = document.createElement('div');
    wrap.id = 'gridgame';
    svg = el('svg', { width: '100%', height: '100%' });
    world = el('g');
    const parksG = el('g', { class: 'gg-parks' });
    for (const p of PARKS) {
      const i = (p.inset || 0) * FT_PER_STREET;
      const x0 = X(p.a0) + 40 + i, x1 = X(p.a1) - 40 - i, y0 = Y(p.s1) + 40, y1 = Y(p.s0) - 40;
      parksG.append(el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 30, class: p.green ? 'park' : 'bldg' }));
      parksG.append(el('text', { x: (x0 + x1) / 2, y: (y0 + y1) / 2, class: 'gg-parkname' }, p.name));
    }
    const roads = el('g', { class: 'gg-roads' });
    // streets
    for (let s = S_MIN; s <= S_MAX; s++) {
      for (let ai = 0; ai < AVES.length; ai++) {
        if (!exists(ai, s)) continue;
        const aj = nextAve(ai, s, 1);
        if (aj < 0 || !streetBlock(s, ai)) continue;
        roads.append(el('line', { x1: X(ai), y1: Y(s), x2: X(aj), y2: Y(s), class: TWO_WAY_STREETS.has(s) ? 'st two' : 'st' }));
      }
    }
    // avenues, block by block (some have gaps)
    for (let ai = 0; ai < AVES.length; ai++) {
      for (let s = Math.max(S_MIN, AVES[ai].from || S_MIN); s < S_MAX; s++) {
        const v = aveBlock(ai, s);
        if (!v) continue;
        roads.append(el('line', { x1: X(ai), y1: Y(s) + 12, x2: X(ai), y2: Y(s + 1) - 12, class: `av${v === 'two' ? ' two' : ''}` }));
      }
    }
    arrowsG = el('g', { class: 'gg-arrows' });
    bestEl = el('polyline', { class: 'gg-best', points: '' });
    pathEl = el('polyline', { class: 'gg-path', points: '' });
    flag = el('circle', { r: 70, class: 'gg-flag' });
    flagLabel = el('text', { class: 'gg-flaglabel' });
    car = el('g', { class: 'gg-car' });
    car.append(el('path', { d: 'M0 -95 L62 70 L0 38 L-62 70 Z' }));
    car.append(el('circle', { class: 'blink L', cx: -70, cy: -40, r: 26 }));
    car.append(el('circle', { class: 'blink R', cx: 70, cy: -40, r: 26 }));
    world.append(parksG, roads, arrowsG, bestEl, pathEl, flag, flagLabel, car);
    labelsG = el('g', { class: 'gg-labels' });
    northEl = el('g', { class: 'gg-north' });
    northEl.append(el('circle', { r: 19 }), el('path', { d: 'M0 -14 L6 6 L0 2 L-6 6 Z' }), el('text', { y: 17 }, 'N'));
    offscreen = el('g', { class: 'gg-offscreen' });
    offscreen.append(el('circle', { r: 13 }), el('polygon'));
    svg.append(world, labelsG, northEl, offscreen);
    wrap.append(svg);
    document.body.append(wrap);
  }

  /**
   * One-way chevrons on every block (shown when Arrows is on, or briefly after
   * a wrong turn). Blocks that break the rule are drawn in amber.
   */
  function drawArrows(onlyStreet = null, onlyAve = null) {
    arrowsG.replaceChildren();
    const chev = (x, y, rot, exc) =>
      arrowsG.append(el('path', { d: 'M-34 22 L0 -18 L34 22', transform: `translate(${x} ${y}) rotate(${rot})`, class: exc ? 'exc' : '' }));
    if (onlyAve == null)
      for (let s = S_MIN; s <= S_MAX; s++) {
        if (onlyStreet != null && s !== onlyStreet) continue;
        for (let ai = 0; ai < AVES.length; ai++) {
          if (!exists(ai, s)) continue;
          const aj = nextAve(ai, s, 1);
          const v = aj < 0 ? null : streetBlock(s, ai);
          if (!v) continue;
          const exc = v !== ruleStreet(s);
          const mx = (X(ai) + X(aj)) / 2;
          if (v === 'two') {
            chev(mx - 60, Y(s), 90, exc);
            chev(mx + 60, Y(s), 270, exc);
          } else chev(mx, Y(s), v === 'E' ? 90 : 270, exc);
        }
      }
    if (onlyStreet == null)
      for (let ai = 0; ai < AVES.length; ai++) {
        if (onlyAve != null && ai !== onlyAve) continue;
        for (let s = Math.max(S_MIN, AVES[ai].from || S_MIN); s < S_MAX; s++) {
          const v = aveBlock(ai, s);
          if (!v) continue;
          const exc = v !== ruleAve(ai) && !(ai === PARK && s >= 41 && s <= 45);
          if (s % 2 && !exc) continue; // every other block is enough, unless it's an exception
          const my = (Y(s) + Y(s + 1)) / 2;
          if (v === 'two') {
            chev(X(ai) - 40, my, 0, exc);
            chev(X(ai) + 40, my, 180, exc);
          } else chev(X(ai), my, v === 'U' ? 0 : 180, exc);
        }
      }
  }
  let flashTimer = 0;
  function flashArrows(st) {
    if (prefs.arrows) return;
    clearTimeout(flashTimer);
    if (st.street != null) drawArrows(st.street, null);
    else drawArrows(null, st.ave);
    arrowsG.classList.add('flash');
    flashTimer = setTimeout(() => {
      arrowsG.classList.remove('flash');
      arrowsG.replaceChildren();
    }, 2600);
  }

  // ---- camera ---------------------------------------------------------------
  const SCALE_PX_PER_FT = () => Math.min(0.2, Math.max(0.12, window.innerWidth / 2600));
  function camera() {
    const pad = ctx.padding();
    const W = window.innerWidth, H = window.innerHeight;
    const k = SCALE_PX_PER_FT();
    const cx = W / 2;
    const cy = pad.top + (H - pad.top - pad.bottom) * 0.55;
    const tx = cx - g.pos.x * k, ty = cy - g.pos.y * k;
    world.setAttribute('transform', `translate(${tx} ${ty}) scale(${k})`);
    // sticky labels: avenue names along the top of the open area, street numbers on the left
    const top = pad.top + 4, left = 4, bottom = H - pad.bottom;
    const lab = [];
    for (let ai = 0; ai < AVES.length; ai++) {
      const x = tx + X(ai) * k;
      if (x < 16 || x > W - 16) continue;
      const s = Math.round(-((top + 40 - ty) / k) / FT_PER_STREET);
      lab.push(el('text', { x, y: top + 12, class: `gg-ave ${AVES[ai].dir}` }, aveName(ai, Math.min(S_MAX, Math.max(S_MIN, s))).replace(' Ave', '')));
    }
    for (let s = S_MIN; s <= S_MAX; s++) {
      const y = ty + Y(s) * k;
      if (y < top + 26 || y > bottom - 6) continue;
      lab.push(el('text', { x: left, y: y + 4, class: `gg-st${TWO_WAY_STREETS.has(s) ? ' two' : ''}` }, String(s)));
    }
    labelsG.replaceChildren(...lab);
    // true north: the grid is turned ~29° clockwise, so with uptown up, north points up-left
    northEl.setAttribute('transform', `translate(${W - 30} ${bottom - 30}) rotate(-29)`);
    // the target, pinned to the edge when it's off screen
    const fx = tx + X(g.target.ai) * k, fy = ty + Y(g.target.s) * k;
    const inView = fx > 12 && fx < W - 12 && fy > top + 20 && fy < bottom - 12;
    flagLabel.style.display = inView ? '' : 'none';
    offscreen.style.display = inView ? 'none' : '';
    if (!inView) {
      const ex = Math.min(W - 22, Math.max(22, fx));
      const ey = Math.min(bottom - 22, Math.max(top + 30, fy));
      // arrow inside the marker, pointing from you toward the destination
      const len = Math.hypot(fx - cx, fy - cy) || 1;
      const ux = (fx - cx) / len, uy = (fy - cy) / len;
      const pts = [
        [ex + ux * 9, ey + uy * 9],
        [ex - ux * 5 - uy * 6, ey - uy * 5 + ux * 6],
        [ex - ux * 5 + uy * 6, ey - uy * 5 - ux * 6],
      ];
      offscreen.firstChild.setAttribute('cx', ex);
      offscreen.firstChild.setAttribute('cy', ey);
      offscreen.lastChild.setAttribute('points', pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '));
    }
  }

  // ---- game -----------------------------------------------------------------
  function pickRoute() {
    for (let tries = 0; tries < 400; tries++) {
      const named = Math.random() < 0.7;
      const target = named ? rand(PLACES) : { name: null, ai: Math.floor(Math.random() * AVES.length), s: S_MIN + Math.floor(Math.random() * (S_MAX - S_MIN + 1)) };
      if (!exists(target.ai, target.s)) continue;
      const ai = Math.floor(Math.random() * AVES.length);
      const s = S_MIN + 2 + Math.floor(Math.random() * (S_MAX - S_MIN - 3));
      if (!exists(ai, s)) continue;
      const ds = ['U', 'D', 'E', 'W'].filter((d) => !step(ai, s, d, false).why);
      if (!ds.length) continue;
      const start = { ai, s, d: rand(ds) };
      const blocks = Math.abs(target.s - s) + Math.abs(X(target.ai) - X(ai)) / 700;
      if (blocks < 8 || blocks > 26) continue;
      const best = shortest(start, target);
      if (!best || best.path.length < 6) continue;
      return { start, target, best };
    }
    return null;
  }

  function start(opts) {
    stop();
    if (!wrap) buildPicture();
    const r = pickRoute();
    const { start: st0, target, best } = r;
    g = {
      opts,
      target,
      best,
      start: st0,
      cur: { ...st0 }, // the corner you're driving away from, and direction
      next: null, // the corner you're driving to
      t: 0, // 0..1 along the current block
      pos: { x: X(st0.ai), y: Y(st0.s) },
      queued: null, // 'L' | 'R'
      waiting: false,
      paused: false,
      done: false,
      driven: 0,
      wrong: 0,
      trail: [[X(st0.ai), Y(st0.s)]],
      msg: '',
      last: performance.now(),
      raf: 0,
    };
    document.body.classList.add('gridding');
    wrap.hidden = false;
    flag.setAttribute('cx', X(target.ai));
    flag.setAttribute('cy', Y(target.s));
    flagLabel.setAttribute('x', X(target.ai) + 110);
    flagLabel.setAttribute('y', Y(target.s) + 30);
    flagLabel.textContent = target.name || `${aveName(target.ai, target.s).replace(' Ave', '')} & ${ord(target.s)}`;
    bestEl.setAttribute('points', '');
    pathEl.setAttribute('points', '');
    if (prefs.arrows) drawArrows();
    else arrowsG.replaceChildren();
    beginBlock();
    render();
    g.raf = requestAnimationFrame(tick);
    window.addEventListener('keydown', onKey);
  }

  function stop() {
    if (!g) return;
    cancelAnimationFrame(g.raf);
    window.removeEventListener('keydown', onKey);
    g = null;
    if (wrap) wrap.hidden = true;
    document.body.classList.remove('gridding');
  }

  const onKey = (e) => {
    if (!g || g.done) return;
    if (e.key === 'ArrowLeft') press('L');
    else if (e.key === 'ArrowRight') press('R');
    else if (e.key === ' ') togglePause();
  };

  /** Start driving the next block from g.cur in direction g.cur.d (already checked legal). */
  function beginBlock() {
    const r = step(g.cur.ai, g.cur.s, g.cur.d, false);
    g.next = r.why ? null : { ai: r.ai, s: r.s, len: r.len };
    g.t = 0;
    g.waiting = !g.next;
    // driving onto a block that breaks the rule: say so (once per stretch)
    if (r.note && r.note !== g.lastNote) {
      g.msg = `ℹ ${r.note}`;
      g.msgAt = performance.now();
    }
    g.lastNote = r.note || null;
  }

  const blockSeconds = (len) => (0.55 + len / 550) * PACE[prefs.pace];

  function tick(now) {
    if (!g) return;
    const dt = Math.min(0.1, (now - g.last) / 1000);
    g.last = now;
    if (!g.paused && !g.done && !g.waiting && g.next) {
      g.t += dt / blockSeconds(g.next.len);
      if (g.t >= 1) arrive();
    }
    if (g && g.next && !g.waiting) {
      const t = Math.min(1, g.t);
      g.pos = { x: X(g.cur.ai) + (X(g.next.ai) - X(g.cur.ai)) * t, y: Y(g.cur.s) + (Y(g.next.s) - Y(g.cur.s)) * t };
    } else if (g) g.pos = { x: X(g.cur.ai), y: Y(g.cur.s) };
    if (!g) return;
    car.setAttribute('transform', `translate(${g.pos.x} ${g.pos.y}) rotate(${ROT[g.cur.d]})`);
    car.classList.toggle('sigL', g.queued === 'L');
    car.classList.toggle('sigR', g.queued === 'R');
    camera();
    g.raf = requestAnimationFrame(tick);
  }

  /** Reached the corner g.next. Turn if a turn is queued and legal; else go straight; else wait. */
  function arrive() {
    const n = g.next;
    if (g.msg && performance.now() - g.msgAt > 3500) g.msg = '';
    g.driven += n.len;
    g.trail.push([X(n.ai), Y(n.s)]);
    pathEl.setAttribute('points', g.trail.map((p) => p.join(',')).join(' '));
    g.cur = { ai: n.ai, s: n.s, d: g.cur.d };
    if (n.ai === g.target.ai && n.s === g.target.s) return finish();
    if (g.auto) {
      // test autopilot: follow the shortest legal route from this corner
      const r = shortest({ ai: n.ai, s: n.s, d: g.cur.d, free: true }, g.target);
      const d2 = r && r.path[1] ? r.path[1].d : g.cur.d;
      g.queued = d2 === g.cur.d ? null : LEFT[g.cur.d] === d2 ? 'L' : 'R';
    }
    if (g.queued) {
      const d2 = (g.queued === 'L' ? LEFT : RIGHT)[g.cur.d];
      const r = step(g.cur.ai, g.cur.s, d2, true);
      g.queued = null;
      if (!r.why) {
        g.cur.d = d2;
        g.msg = '';
        beginBlock();
        render();
        return;
      }
      refused(r, d2);
    }
    const straight = step(g.cur.ai, g.cur.s, g.cur.d, false);
    if (straight.why) {
      g.waiting = true;
      g.next = null;
      g.msg = g.msg || `End of the block that way: ${straight.why} Turn left or right.`;
      render();
      return;
    }
    beginBlock();
    render();
  }

  function refused(r, d2) {
    if (r.wrong) {
      g.wrong++;
      const onStreet = d2 === 'E' || d2 === 'W';
      flashArrows(onStreet ? { street: g.cur.s } : { ave: g.cur.ai });
    }
    g.msg = `⛔ ${r.why}`;
    g.msgAt = performance.now();
  }

  function press(side) {
    if (!g || g.done) return;
    if (g.waiting) {
      // stopped at a corner: turn now
      const d2 = (side === 'L' ? LEFT : RIGHT)[g.cur.d];
      const r = step(g.cur.ai, g.cur.s, d2, true);
      if (r.why) {
        refused(r, d2);
        render();
        return;
      }
      g.cur.d = d2;
      g.msg = '';
      beginBlock();
      render();
      return;
    }
    g.queued = g.queued === side ? null : side;
    render();
  }
  function togglePause() {
    if (!g || g.done) return;
    g.paused = !g.paused;
    render();
  }

  function finish() {
    g.done = true;
    g.next = null;
    const mi = (ft) => (ft / 5280).toFixed(2).replace(/0$/, '');
    bestEl.setAttribute('points', g.best.path.map((p) => `${X(p.ai)},${Y(p.s)}`).join(' '));
    const ratio = g.driven / g.best.cost;
    const ok = ratio <= 1.15 && !g.wrong;
    const runs = ctx.store.get('gridRuns', { n: 0, clean: 0 });
    runs.n++;
    if (ok) runs.clean++;
    ctx.store.set('gridRuns', runs);
    g.result = `<div class="fb ${ok ? 'ok' : 'no'}">${ok ? '✓' : '•'} You made it: ${mi(g.driven)} mi${
      g.wrong ? `, ${g.wrong} wrong-way ${g.wrong === 1 ? 'try' : 'tries'}` : ''
    }. Shortest legal route: ${mi(g.best.cost)} mi${ratio <= 1.02 ? ' (that was it)' : ''}.</div>
      <div class="hint">Shortest (green dashes): ${esc(describe(g.best.path))}</div>
      <button class="primary" id="ggAgain">Another route</button>`;
    render();
  }

  // ---- words on screen ----------------------------------------------------------
  function where() {
    const c = g.cur;
    const on = c.d === 'U' || c.d === 'D' ? aveName(c.ai, c.s) : streetName(c.s);
    return `On <b>${esc(on)}</b> heading <b>${DIR_WORD[c.d]}</b>`;
  }
  function toGo() {
    const ds = g.target.s - g.cur.s;
    const da = g.target.ai - g.cur.ai;
    const parts = [];
    if (ds) parts.push(`${Math.abs(ds)} street${Math.abs(ds) === 1 ? '' : 's'} ${ds > 0 ? 'up' : 'down'}`);
    if (da) parts.push(`${Math.abs(da)} avenue${Math.abs(da) === 1 ? '' : 's'} ${da > 0 ? 'east' : 'west'}`);
    return parts.join(', ');
  }
  function render() {
    if (!g) return;
    const tgt = `${esc(aveName(g.target.ai, g.target.s))} & ${ord(g.target.s)} St`;
    ctx.hud(
      `<div class="qkind">🚕 Drive the grid</div><div class="q">Get to ${g.target.name ? `<b>${esc(g.target.name)}</b> (${tgt})` : `<b>${tgt}</b>`}</div>
       ${g.done ? '' : `<div class="hint">${where()}${g.queued ? ` · turning <b>${g.queued === 'L' ? 'left' : 'right'}</b> at the next corner` : ''} · ${esc(toGo())} to go</div>`}`
    );
    const btn = (side, label) =>
      `<button class="ggturn${g.queued === side ? ' on' : ''}" data-side="${side}" ${g.done ? 'disabled' : ''}>${label}</button>`;
    ctx.sheet(
      `${g.opts.header()}<div id="qbody">
        ${g.done ? g.result : `<div class="ggctl">${btn('L', '◀ Left')}${btn('R', 'Right ▶')}</div>
        <div class="ggmsg${g.msg ? '' : ' muted'}">${g.msg ? esc(g.msg) : g.waiting ? 'Stopped at the corner: pick a way.' : 'Tap before the corner to turn there. The car keeps going straight otherwise.'}</div>`}
        <div class="ggopts">
          <select id="ggPace" aria-label="Speed">${Object.keys(PACE).map((p) => `<option value="${p}"${prefs.pace === p ? ' selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select>
          <label><input type="checkbox" id="ggArrows"${prefs.arrows ? ' checked' : ''}/> One-way arrows</label>
          ${g.done ? '' : `<button id="ggPause">${g.paused ? '▶ Go' : '⏸ Pause'}</button>`}
        </div>
      </div>`
    );
    g.opts.bindHeader();
    for (const b of document.querySelectorAll('.ggturn')) b.addEventListener('click', () => press(b.dataset.side));
    document.getElementById('ggPause')?.addEventListener('click', togglePause);
    document.getElementById('ggAgain')?.addEventListener('click', () => start(g.opts));
    document.getElementById('ggPace').addEventListener('change', (e) => {
      prefs.pace = e.target.value;
      savePrefs();
    });
    document.getElementById('ggArrows').addEventListener('change', (e) => {
      prefs.arrows = e.target.checked;
      savePrefs();
      if (prefs.arrows) drawArrows();
      else arrowsG.replaceChildren();
    });
  }

  return {
    start,
    stop,
    get running() {
      return !!g;
    },
    // for tests
    _model: { step, shortest, describe, AVES, PLACES },
    _autopilot() {
      if (g) g.auto = true;
    },
  };
}
