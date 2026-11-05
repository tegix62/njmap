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
const S_MIN = GRID_DATA.sMin;
const S_MAX = GRID_DATA.sMax;
const TWO_WAY_STREETS = new Set(GRID_DATA.twoWay);

// Avenue columns west to east, from the data: {key, x (feet from 5th Ave), from,
// to, ranges: [[first street, name, short label, rule-of-thumb direction]]}
const AVES = GRID_DATA.columns;
const col = (k) => AVES.findIndex((a) => a.key === k);
const rangeAt = (ai, s) => {
  const rs = AVES[ai].ranges;
  let r = rs[0];
  for (const x of rs) if (x[0] <= s) r = x;
  return r;
};
const aveName = (ai, s) => rangeAt(ai, s)[1];
const aveShort = (ai, s) => rangeAt(ai, s)[2];
const PARK = col('park');
const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const streetName = (s) => (s === 59 ? '59th St (Central Park South)' : s === 110 ? '110th St' : `${ord(s)} St`);

// Why a street block doesn't go through, where it's worth saying: [street, west col, east col, why]
const BLOCKED = [
  [41, col('6'), col('5'), 'Bryant Park and the Library'],
  [32, col('8'), col('7'), 'Madison Square Garden and Penn Station'],
  [24, col('5'), col('madison'), 'Madison Square Park'],
  [25, col('5'), col('madison'), 'Madison Square Park'],
  [15, col('5'), PARK, 'Union Square'],
  [16, col('5'), PARK, 'Union Square'],
  [43, col('madison'), PARK, 'Grand Central'],
  [44, col('madison'), PARK, 'Grand Central'],
  [45, col('madison'), PARK, 'Grand Central'],
  [43, PARK, col('lex'), 'Grand Central'],
  [44, PARK, col('lex'), 'Grand Central'],
  [45, PARK, col('lex'), 'Grand Central'],
];
// Park Ave rides the viaduct around Grand Central: no turns on or off here
const NO_TURN = new Set([41, 42, 43, 44, 45].map((s) => `${PARK}:${s}`));
const TRANSVERSES = { 65: '65th St transverse', 79: '79th St transverse', 86: '86th St transverse', 97: '97th St transverse' };
const PARKS = [
  { name: 'Central Park', s0: 59, s1: 110, a0: col('8'), a1: col('5'), green: true, big: true },
  { name: 'Bryant Park', s0: 40, s1: 42, a0: col('6'), a1: col('5'), green: true },
  { name: 'Madison Sq Park', s0: 23, s1: 26, a0: col('5'), a1: col('madison'), green: true },
  { name: 'Union Square', s0: 14, s1: 17, a0: col('5'), a1: PARK, green: true, inset: 0.35 },
  { name: 'MSG', s0: 31, s1: 33, a0: col('8'), a1: col('7') },
  { name: 'Grand Central', s0: 42, s1: 46, a0: col('madison'), a1: col('lex'), inset: 0.18 },
];

const PLACES = [
  // Midtown and below
  { name: 'Grand Central', ai: PARK, s: 42 },
  { name: 'Empire State Building', ai: col('5'), s: 34 },
  { name: 'Madison Square Garden', ai: col('7'), s: 33 },
  { name: 'Port Authority', ai: col('8'), s: 42 },
  { name: 'Times Square', ai: col('7'), s: 46 },
  { name: 'Radio City', ai: col('6'), s: 50 },
  { name: 'the Library (Bryant Park)', ai: col('5'), s: 42 },
  { name: 'MoMA', ai: col('5'), s: 53 },
  { name: 'Carnegie Hall', ai: col('7'), s: 57 },
  { name: 'the Flatiron Building', ai: col('5'), s: 23 },
  { name: 'Chelsea Market', ai: col('9'), s: 15 },
  { name: 'the Javits Center', ai: col('11'), s: 36 },
  { name: 'the UN', ai: col('1'), s: 45 },
  { name: 'Bellevue', ai: col('1'), s: 27 },
  { name: 'Hudson Yards', ai: col('10'), s: 33 },
  { name: "Macy's (Herald Square)", ai: col('6'), s: 34 },
  { name: 'the Chrysler Building', ai: col('lex'), s: 42 },
  // Uptown
  { name: 'Columbus Circle', ai: col('8'), s: 59 },
  { name: 'Lincoln Center', ai: col('9'), s: 65 },
  { name: 'the Natural History Museum', ai: col('8'), s: 79 },
  { name: 'the Met', ai: col('5'), s: 82 },
  { name: 'the Guggenheim', ai: col('5'), s: 88 },
  { name: 'Bloomingdale\'s', ai: col('lex'), s: 59 },
  { name: 'Hunter College', ai: col('lex'), s: 68 },
  { name: 'the Beacon Theatre', ai: col('bway'), s: 74 },
  { name: "Zabar's", ai: col('bway'), s: 80 },
  { name: 'Mount Sinai Hospital', ai: col('madison'), s: 100 },
  { name: 'the Museum of the City of New York', ai: col('5'), s: 103 },
  { name: 'NewYork-Presbyterian / Weill Cornell', ai: col('york'), s: 68 },
  { name: 'Columbia (south end, Cathedral Pkwy)', ai: col('bway'), s: 110 },
];
const AREAS = { all: [S_MIN, S_MAX], midtown: [S_MIN, 59], uptown: [57, S_MAX] };

// Coming in from outside: where a tunnel, bridge or highway exit really puts
// you, and which way you're facing. Each one is checked against the city's
// ramp data (tools/entries.py); 'where' says what you'd see.
const ENTRIES = [
  { from: 'the Lincoln Tunnel', where: 'Dyer Ave brings you up to 42nd St; you turn east (between 10th and 9th Ave)', ai: col('10'), s: 42, d: 'E' },
  { from: 'the Lincoln Tunnel (30th St exit)', where: 'the ramp puts you on 30th St heading east at 10th Ave', ai: col('10'), s: 30, d: 'E' },
  { from: 'the Queens-Midtown Tunnel', where: 'you come out onto 2nd Ave heading downtown in the upper 30s', ai: col('2'), s: 37, d: 'D' },
  { from: 'the Queensboro Bridge', where: 'you come off onto 1st Ave heading uptown, around 60th St', ai: col('1'), s: 60, d: 'U' },
  { from: 'the Queensboro Bridge', where: 'you come off onto 2nd Ave heading downtown, around 60th St', ai: col('2'), s: 60, d: 'D' },
  { from: 'the FDR Drive (exit 9, northbound)', where: 'the exit puts you on 1st Ave heading uptown at 42nd St, by the UN', ai: col('1'), s: 42, d: 'U' },
  { from: 'the FDR Drive (exit 11, southbound)', where: 'the exit puts you on 53rd St heading west', ai: col('1'), s: 53, d: 'W' },
  { from: 'the FDR Drive (exit 12, northbound)', where: 'the exit puts you on 61st St heading west at York Ave', ai: col('york'), s: 61, d: 'W' },
  { from: 'the FDR Drive (exit 14, northbound)', where: 'the exit puts you on 96th St heading west', ai: col('1'), s: 96, d: 'W' },
  { from: 'the Henry Hudson Parkway (from the GWB)', where: 'the 96th St exit puts you at Riverside Dr; head east on 96th', ai: col('west'), s: 96, d: 'E' },
];

// grid directions: U uptown, D downtown, E east, W west
const LEFT = { U: 'W', W: 'D', D: 'E', E: 'U' };
const RIGHT = { U: 'E', E: 'D', D: 'W', W: 'U' };
const DIR_WORD = { U: 'uptown', D: 'downtown', E: 'east', W: 'west' };
const ROT = { U: 0, E: 90, D: 180, W: 270 };
const PACE = { easy: 1, normal: 0.72, fast: 0.5 };

const exists = (ai, s) => s >= S_MIN && s <= S_MAX && s >= AVES[ai].from && s <= AVES[ai].to;
const key = (ai, s) => `${ai}:${s}`;
/** The next avenue east/west of ai that exists on street s. */
function nextAve(ai, s, step) {
  for (let j = ai + step; j >= 0 && j < AVES.length; j += step) if (exists(j, s)) return j;
  return -1;
}
const blockedWhy = (s, a, b) => {
  const [w, e] = a < b ? [a, b] : [b, a];
  if (w === col('8') && e === col('5') && s > 59 && s < 110) return 'Central Park (only the transverse roads at 65th, 79th, 86th and 97th cross it)';
  const hit = BLOCKED.find(([bs, bw, be]) => bs === s && bw === w && be === e);
  return hit ? hit[3] : null;
};
/** The rule of thumb for a street: odd west, even east, the big crosstown ones both ways. */
const ruleStreet = (s) => (TWO_WAY_STREETS.has(s) ? 'two' : s % 2 ? 'W' : 'E');
const ruleAve = (ai, s) => rangeAt(ai, s)[3];
/** Real direction of the street block between avenue ai and the next one east: 'E' | 'W' | 'two' | null. */
const streetBlock = (s, westAi) => GRID_DATA.streets[s]?.[westAi] ?? null;
/** Real direction of avenue ai between street s and s + 1: 'U' | 'D' | 'two' | null. */
function aveBlock(ai, s) {
  // Park Ave rides the viaduct around Grand Central (41st-46th): both ways, no turns
  if (ai === PARK && s >= 41 && s <= 45) return 'two';
  return GRID_DATA.aves[AVES[ai].key]?.[s - S_MIN] ?? null;
}
const WORD = { E: 'east', W: 'west', U: 'uptown', D: 'downtown' };
const streetRuleText = (s) => (s % 2 ? 'odd streets usually go west' : 'even streets usually go east');

/**
 * Where driving from (ai, s) toward d leads: {ai, s, len} or {why} when you
 * can't (wrong way, dead end, blocked).
 */
function step(ai, s, d, turning) {
  const r = rawStep(ai, s, d, turning);
  if (r.why || !TRAPS.has(`${r.ai}:${r.s}:${d}`)) return r;
  return { why: `${d === 'U' || d === 'D' ? aveName(ai, s) : streetName(s)} leads into a dead end that way: there's no legal way on from ${aveName(r.ai, r.s)} & ${ord(r.s)}${r.s === S_MAX || r.s === S_MIN || r.ai === 0 || r.ai === AVES.length - 1 ? ' inside the practice area' : ''}.`, edge: true };
}

function rawStep(ai, s, d, turning) {
  if (turning && NO_TURN.has(key(ai, s))) return { why: 'No turns here: Park Ave runs on the viaduct around Grand Central.' };
  if (d === 'U' || d === 'D') {
    const s2 = s + (d === 'U' ? 1 : -1);
    if (s2 > S_MAX || s2 < S_MIN) return { why: 'That leaves the practice area.', edge: true };
    const real = aveBlock(ai, Math.min(s, s2));
    const name = aveName(ai, s);
    if (!real || !exists(ai, s2)) return { why: `${name} doesn't continue past ${streetName(s)}.`, edge: true };
    if (real !== 'two' && real !== d) {
      const rule = ruleAve(ai, s);
      return {
        why:
          rule === real
            ? `${name} runs ${WORD[real]} only.`
            : `${name} runs ${WORD[real]} only on this stretch (an exception: ${rule === 'two' ? 'it runs both ways elsewhere' : `it runs ${WORD[rule]} elsewhere`}).`,
        wrong: true,
      };
    }
    const r = { ai, s: s2, len: FT_PER_STREET };
    const rule = ruleAve(ai, s);
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
  if (TRANSVERSES[s] && west === col('8') && east === col('5')) {
    // through Central Park on a transverse road (both ways)
    const r = { ai: aj, s, len: Math.abs(AVES[aj].x - AVES[ai].x) };
    r.note = `Through Central Park on the ${TRANSVERSES[s]}.`;
    return r;
  }
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

/**
 * Corners you could arrive at (heading a given way) with no legal way on:
 * straight, left and right all refused. Found once, repeatedly until nothing
 * changes (blocking one can trap another); step() refuses moves into them.
 */
const TRAPS = new Set();
(function findTraps() {
  const L = { U: 'W', W: 'D', D: 'E', E: 'U' }, R = { U: 'E', E: 'D', D: 'W', W: 'U' };
  const ok = (ai, s, d, t) => {
    const r = rawStep(ai, s, d, t);
    return !r.why && !TRAPS.has(`${r.ai}:${r.s}:${d}`);
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (let ai = 0; ai < AVES.length; ai++)
      for (let s = S_MIN; s <= S_MAX; s++) {
        if (!exists(ai, s)) continue;
        for (const d of ['U', 'D', 'E', 'W']) {
          const k = `${ai}:${s}:${d}`;
          if (TRAPS.has(k)) continue;
          if (!ok(ai, s, d, false) && !ok(ai, s, L[d], true) && !ok(ai, s, R[d], true)) {
            TRAPS.add(k);
            changed = true;
          }
        }
      }
  }
})();

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

/** Shortest legal route from a moving car (no U-turns). Returns [{ai,s,d}] states. */
function shortest(start, target) {
  const sk = (st) => `${st.ai}:${st.s}:${st.d}`;
  const dist = new Map([[sk(start), 0]]);
  const prev = new Map();
  const open = new Heap();
  open.push({ ...start, c: 0 });
  while (open.size) {
    const cur = open.pop();
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
  // mapFirst: show the whole grid before driving. Off by default: working out
  // where the address is from the street and avenue alone is the harder,
  // more useful skill (it's all you have in a real car).
  // from: 'both' (half the rounds start at a tunnel or bridge), 'entries', or 'anywhere'
  const prefs = { pace: 'easy', arrows: false, mapFirst: false, area: 'all', from: 'both', ...ctx.store.get('gridPrefs', {}) };
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
  let wrap, svg, world, labelsG, arrowsG, pathEl, bestEl, car, flag, flagLabel, flagG, northEl, offscreen, gotoEl;

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
      if (p.big) {
        // a big park: repeat the name down its length so it's visible at any zoom
        for (let s0 = p.s0 + 4; s0 < p.s1; s0 += 12) parksG.append(el('text', { x: (x0 + x1) / 2, y: Y(s0 + 2), class: 'gg-parkname big' }, p.name));
      } else parksG.append(el('text', { x: (x0 + x1) / 2, y: (y0 + y1) / 2, class: 'gg-parkname' }, p.name));
    }
    for (const [ts, tname] of Object.entries(TRANSVERSES))
      parksG.append(el('text', { x: (X(col('8')) + X(col('5'))) / 2, y: Y(+ts) - 50, class: 'gg-parkname tv' }, tname));
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
      for (let s = AVES[ai].from; s < AVES[ai].to; s++) {
        const v = aveBlock(ai, s);
        if (!v) continue;
        roads.append(el('line', { x1: X(ai), y1: Y(s) + 12, x2: X(ai), y2: Y(s + 1) - 12, class: `av${v === 'two' ? ' two' : ''}` }));
      }
    }
    arrowsG = el('g', { class: 'gg-arrows' });
    bestEl = el('polyline', { class: 'gg-best', points: '' });
    pathEl = el('polyline', { class: 'gg-path', points: '' });
    flagG = el('g');
    flag = el('circle', { r: 70, class: 'gg-flag' });
    flagLabel = el('text', { class: 'gg-flaglabel', x: 110, y: 30 });
    flagG.append(flag, flagLabel);
    car = el('g', { class: 'gg-car' });
    car.append(el('path', { d: 'M0 -95 L62 70 L0 38 L-62 70 Z' }));
    car.append(el('circle', { class: 'blink L', cx: -70, cy: -40, r: 26 }));
    car.append(el('circle', { class: 'blink R', cx: 70, cy: -40, r: 26 }));
    gotoEl = el('circle', { r: 85, class: 'gg-goto' });
    gotoEl.style.display = 'none';
    world.append(parksG, roads, arrowsG, bestEl, pathEl, flagG, gotoEl, car);
    bindPointer();
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
        for (let s = AVES[ai].from; s < AVES[ai].to; s++) {
          const v = aveBlock(ai, s);
          if (!v) continue;
          const exc = v !== ruleAve(ai, s) && !(ai === PARK && s >= 41 && s <= 45);
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
  // Camera. 'intro': the whole grid with you and the destination, then a quick
  // zoom into your car; 'follow': chase the car; 'end': zoom out to fit your
  // route and the shortest one.
  const INTRO_HOLD_MS = 550;
  const INTRO_ZOOM_MS = 700;
  const END_ZOOM_MS = 900;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function viewGoal(pad, W, H) {
    const areaH = H - pad.top - pad.bottom;
    if (g.view === 'follow') return { wx: g.pos.x, wy: g.pos.y, k: SCALE_PX_PER_FT(), fy: 0.55 };
    // fit a box of the grid into the open area, leaving room for the labels
    let x0, x1, y0, y1;
    if (g.view === 'intro') {
      x0 = X(0); x1 = X(AVES.length - 1); y0 = Y(S_MAX); y1 = Y(S_MIN);
    } else {
      const pts = [...g.trail, ...g.best.path.map((p) => [X(p.ai), Y(p.s)])];
      x0 = Math.min(...pts.map((p) => p[0])); x1 = Math.max(...pts.map((p) => p[0]));
      y0 = Math.min(...pts.map((p) => p[1])); y1 = Math.max(...pts.map((p) => p[1]));
    }
    const k = Math.min((W - 70) / Math.max(800, x1 - x0 + 500), (areaH - 50) / Math.max(800, y1 - y0 + 500));
    return { wx: (x0 + x1) / 2, wy: (y0 + y1) / 2, k: Math.min(k, SCALE_PX_PER_FT()), fy: 0.53 };
  }
  function startFollow() {
    if (!g || g.view !== 'intro') return;
    g.view = 'follow';
    g.trans = g.camNow ? { from: g.camNow, t0: performance.now(), dur: ctx.dur(INTRO_ZOOM_MS) } : null;
    g.last = performance.now();
  }
  function camera() {
    const pad = ctx.padding();
    const W = window.innerWidth, H = window.innerHeight;
    const goal = viewGoal(pad, W, H);
    let cam = goal;
    if (g.trans) {
      const p = g.trans.dur ? Math.min(1, (performance.now() - g.trans.t0) / g.trans.dur) : 1;
      const e = ease(p);
      const f = g.trans.from;
      cam = {
        wx: f.wx + (goal.wx - f.wx) * e,
        wy: f.wy + (goal.wy - f.wy) * e,
        k: f.k * Math.pow(goal.k / f.k, e), // zoom evenly
        fy: f.fy + (goal.fy - f.fy) * e,
      };
      if (p >= 1) g.trans = null;
    }
    g.camNow = cam;
    const k = cam.k;
    const cx = W / 2;
    const cy = pad.top + (H - pad.top - pad.bottom) * cam.fy;
    const tx = cx - cam.wx * k, ty = cy - cam.wy * k;
    world.setAttribute('transform', `translate(${tx} ${ty}) scale(${k})`);
    g.cam = { tx, ty, k };
    // markers keep a readable size when zoomed out
    g.mScale = Math.max(1, 0.13 / k);
    flagG.setAttribute('transform', `translate(${g.flagAt[0]} ${g.flagAt[1]}) scale(${g.mScale})`);
    // sticky labels: avenue names along the top of the open area, street numbers on the left
    const top = pad.top + 4, left = 4, bottom = H - pad.bottom;
    const lab = [];
    let lastRight = -1e9;
    for (let ai = 0; ai < AVES.length; ai++) {
      const x = tx + X(ai) * k;
      if (x < 16 || x > W - 16) continue;
      const s = Math.round(-((top + 40 - ty) / k) / FT_PER_STREET);
      const sv = Math.min(AVES[ai].to, Math.max(AVES[ai].from, s));
      if (Math.abs(sv - s) > 6) continue; // this avenue isn't on screen up here
      const text = aveShort(ai, sv);
      const half = text.length * 3.4;
      if (x - half < lastRight + 4) continue; // would overlap the one before
      lastRight = x + half;
      lab.push(el('text', { x, y: top + 12, class: 'gg-ave' }, text));
    }
    const every = FT_PER_STREET * k >= 13 ? 1 : FT_PER_STREET * k * 5 >= 13 ? 5 : 10;
    for (let s = S_MIN; s <= S_MAX; s++) {
      const y = ty + Y(s) * k;
      if (y < top + 26 || y > bottom - 6) continue;
      if (every > 1 && s % every && !(s === S_MIN || s === S_MAX)) continue;
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
    const [a0, a1] = AREAS[prefs.area] || AREAS.all;
    const places = PLACES.filter((p) => p.s >= a0 && p.s <= a1 && exists(p.ai, p.s));
    const corner = () => ({ ai: Math.floor(Math.random() * AVES.length), s: a0 + Math.floor(Math.random() * (a1 - a0 + 1)) });
    // entries that are legal (heading straight on is allowed) and in the chosen area
    const entries = ENTRIES.filter((e) => e.s >= a0 - 2 && e.s <= a1 + 2 && exists(e.ai, e.s) && !step(e.ai, e.s, e.d, false).why);
    const useEntry = entries.length && (prefs.from === 'entries' || (prefs.from === 'both' && Math.random() < 0.5));
    for (let tries = 0; tries < 400; tries++) {
      const target = places.length && Math.random() < 0.7 ? rand(places) : { name: null, ...corner() };
      if (!exists(target.ai, target.s)) continue;
      let start, entry = null;
      if (useEntry) {
        entry = rand(entries);
        start = { ai: entry.ai, s: entry.s, d: entry.d };
      } else {
        const { ai, s } = corner();
        if (!exists(ai, s) || s <= a0 || s >= a1) continue;
        const ds = ['U', 'D', 'E', 'W'].filter((d) => !step(ai, s, d, false).why);
        if (!ds.length) continue;
        start = { ai, s, d: rand(ds) };
      }
      const blocks = Math.abs(target.s - start.s) + Math.abs(X(target.ai) - X(start.ai)) / 700;
      if (blocks < 8 || blocks > (entry ? 45 : 30)) continue;
      if (straightTo(start, start.d, target)) continue; // already on the right road: no decision to make
      const best = shortest(start, target);
      if (!best || best.path.length < 6) continue;
      return { start, target, best, entry };
    }
    return null;
  }

  function start(opts) {
    stop();
    if (!wrap) buildPicture();
    const r = pickRoute();
    const { start: st0, target, best, entry } = r;
    g = {
      opts,
      target,
      best,
      start: st0,
      entry,
      home: false,
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
    g.flagAt = [X(target.ai), Y(target.s)];
    flagLabel.textContent = target.name || `${aveName(target.ai, target.s).replace(' Ave', '')} & ${ord(target.s)}`;
    bestEl.setAttribute('points', '');
    pathEl.setAttribute('points', '');
    gotoEl.style.display = 'none';
    if (prefs.arrows) drawArrows();
    else arrowsG.replaceChildren();
    beginBlock();
    if (entry) {
      g.msg = `Coming in from ${entry.from}: ${entry.where}.`;
      g.msgAt = performance.now() + 6000; // keep it up a while
    }
    // a quick look at the whole grid first, then zoom in (skipped with reduced motion)
    g.view = prefs.mapFirst && ctx.dur(1) ? 'intro' : 'follow';
    g.introUntil = null; // set on the first frame drawn, so a slow page load doesn't eat the intro
    g.camNow = null;
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
    // On the destination's road, heading toward it, nothing in the way: that's
    // the decision made. Zip the rest of the way so you still see where it is.
    if (g.next && !g.home && straightTo(g.cur, g.cur.d, g.target)) {
      g.home = true;
      g.goTo = null;
      g.queued = null;
      gotoEl.style.display = 'none';
      const road = g.cur.d === 'U' || g.cur.d === 'D' ? aveName(g.cur.ai, g.cur.s) : streetName(g.cur.s);
      g.msg = `✓ Right road: ${road} takes you straight there.`;
      g.msgAt = performance.now();
    }
  }
  /** Can you drive straight from corner c heading d to corner t, legally, without turning? */
  function straightTo(c, d, t) {
    let at = { ai: c.ai, s: c.s };
    for (let i = 0; i < 140; i++) {
      if (at.ai === t.ai && at.s === t.s) return true;
      const r = step(at.ai, at.s, d, false);
      if (r.why) return false;
      at = { ai: r.ai, s: r.s };
    }
    return false;
  }

  const blockSeconds = (len) => (0.55 + len / 550) * PACE[prefs.pace];
  const GOTO_SPEED = 0.18; // fraction of the normal block time when heading to a tapped corner
  const HOLD_SPEED = 0.25; // … and while the map is held down
  const HOME_SPEED = 0.07; // … and on the home stretch

  // ---- tap a corner ahead to drive straight there; hold the map to speed up ----
  function bindPointer() {
    let down = null;
    let holdTimer = 0;
    // no text selection, magnifier or context menu on a long press
    for (const ev of ['contextmenu', 'selectstart']) wrap.addEventListener(ev, (e) => e.preventDefault());
    wrap.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    wrap.addEventListener('pointerdown', (e) => {
      if (!g || g.done) return;
      if (g.view === 'intro') {
        startFollow();
        return;
      }
      down = { x: e.clientX, y: e.clientY, moved: false };
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (down && g && !g.done) {
          g.boost = true;
          wrap.classList.add('boost');
        }
      }, 260);
    });
    wrap.addEventListener('pointermove', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) down.moved = true;
    });
    const up = (e, cancel) => {
      clearTimeout(holdTimer);
      const wasBoost = g && g.boost;
      if (g) g.boost = false;
      wrap.classList.remove('boost');
      if (!cancel && down && !down.moved && !wasBoost && g && !g.done && !g.paused) tapAt(e.clientX, e.clientY);
      down = null;
    };
    wrap.addEventListener('pointerup', (e) => up(e, false));
    wrap.addEventListener('pointercancel', (e) => up(e, true));
  }

  /** The corner on your road nearest a tap, if it's ahead of you: drive straight there and stop. */
  function tapAt(sx, sy) {
    if (!g.cam) return;
    const { tx, ty, k } = g.cam;
    const wx = (sx - tx) / k, wy = (sy - ty) / k;
    const d = g.cur.d;
    // the first corner you could still stop at: the one you're driving to, or the one you're at
    const base = g.next && !g.waiting ? { ai: g.next.ai, s: g.next.s } : { ai: g.cur.ai, s: g.cur.s };
    let want;
    if (d === 'U' || d === 'D') {
      const sw = Math.round(-wy / FT_PER_STREET);
      if (d === 'U' ? sw < base.s : sw > base.s) return note('Tap a corner ahead of you on this road.');
      want = { ai: base.ai, s: Math.max(S_MIN, Math.min(S_MAX, sw)) };
    } else {
      let best = -1;
      for (let ai = 0; ai < AVES.length; ai++) if (exists(ai, base.s) && (best < 0 || Math.abs(X(ai) - wx) < Math.abs(X(best) - wx))) best = ai;
      if (d === 'E' ? best < base.ai : best > base.ai) return note('Tap a corner ahead of you on this road.');
      want = { ai: best, s: base.s };
    }
    // follow the road straight from base; stop early if it doesn't go through
    let at = { ...base };
    let why = null;
    while (at.ai !== want.ai || at.s !== want.s) {
      const r = step(at.ai, at.s, d, false);
      if (r.why) {
        why = r.why;
        break;
      }
      at = { ai: r.ai, s: r.s };
    }
    g.goTo = at;
    g.queued = null;
    g.msg = why ? `The road stops before there: ${why}` : '';
    g.msgAt = performance.now();
    gotoEl.setAttribute('cx', X(at.ai));
    gotoEl.setAttribute('cy', Y(at.s));
    gotoEl.style.display = '';
    if (g.waiting && (at.ai !== g.cur.ai || at.s !== g.cur.s)) beginBlock();
    else if (g.waiting) stopAtGoTo();
    render();
  }
  function note(text) {
    g.msg = text;
    g.msgAt = performance.now();
    render();
  }
  function stopAtGoTo() {
    g.goTo = null;
    gotoEl.style.display = 'none';
    g.waiting = true;
    g.next = null;
    const corner = `${aveName(g.cur.ai, g.cur.s)} & ${ord(g.cur.s)}`;
    g.msg = g.msg || `At ${corner}. Turn left or right, or tap a corner further ahead.`;
    g.msgAt = performance.now();
  }

  function tick(now) {
    if (!g) return;
    const dt = Math.min(0.1, (now - g.last) / 1000);
    g.last = now;
    // the overview stays up for a moment of real screen time: a busy page (still
    // loading) can stall frames, so count frames drawn as well as time
    if (g.view === 'intro') {
      if (g.introUntil == null) g.introUntil = now + INTRO_HOLD_MS;
      g.introFrames = (g.introFrames || 0) + 1;
      if (now >= g.introUntil && g.introFrames >= 24) startFollow();
    }
    if (g.view !== 'intro' && !g.paused && !g.done && !g.waiting && g.next) {
      g.t += dt / (blockSeconds(g.next.len) * (g.home ? HOME_SPEED : g.goTo ? GOTO_SPEED : g.boost ? HOLD_SPEED : 1));
      if (g.t >= 1) arrive();
    }
    if (g && g.next && !g.waiting) {
      const t = Math.min(1, g.t);
      g.pos = { x: X(g.cur.ai) + (X(g.next.ai) - X(g.cur.ai)) * t, y: Y(g.cur.s) + (Y(g.next.s) - Y(g.cur.s)) * t };
    } else if (g) g.pos = { x: X(g.cur.ai), y: Y(g.cur.s) };
    if (!g) return;
    car.setAttribute('transform', `translate(${g.pos.x} ${g.pos.y}) rotate(${ROT[g.cur.d]}) scale(${g.mScale || 1})`);
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
    if (g.goTo && n.ai === g.goTo.ai && n.s === g.goTo.s) {
      stopAtGoTo();
      render();
      return;
    }
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
    g.home = false;
    if (g.goTo) {
      g.goTo = null;
      gotoEl.style.display = 'none';
    }
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
    // zoom out to show the whole drive: yours and the shortest
    g.view = 'end';
    g.trans = g.camNow ? { from: g.camNow, t0: performance.now(), dur: ctx.dur(END_ZOOM_MS) } : null;
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
      <div class="hint"><span class="gg-key you"></span> your route · <span class="gg-key best"></span> shortest: ${esc(describe(g.best.path))}</div>
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
      `<div class="qkind">🚕 Drive the grid${g.entry ? ` · from ${esc(g.entry.from.replace(/ \(.*\)$/, ''))}` : ''}</div><div class="q">Get to ${g.target.name ? `<b>${esc(g.target.name)}</b> (${tgt})` : `<b>${tgt}</b>`}</div>
       ${g.done ? '' : `<div class="hint">${where()}${g.queued ? ` · turning <b>${g.queued === 'L' ? 'left' : 'right'}</b> at the next corner` : ''} · ${esc(toGo())} to go</div>`}`
    );
    const btn = (side, label) =>
      `<button class="ggturn${g.queued === side ? ' on' : ''}" data-side="${side}" ${g.done ? 'disabled' : ''}>${label}</button>`;
    ctx.sheet(
      `${g.opts.header()}<div id="qbody">
        ${g.done ? g.result : `<div class="ggctl">${btn('L', '◀ Left')}${btn('R', 'Right ▶')}</div>
        <div class="ggmsg${g.msg ? '' : ' muted'}">${g.msg ? esc(g.msg) : g.waiting ? 'Stopped at the corner: pick a way.' : 'Left/Right turn at the next corner. Tap a corner ahead to zip straight there; hold the map to speed up.'}</div>`}
        <div class="ggbar">
          ${g.done ? '' : `<button id="ggPause">${g.paused ? '▶ Go' : '⏸ Pause'}</button>`}
          <button id="ggOptsBtn" aria-expanded="${!!prefs.optsOpen}">Options ${prefs.optsOpen ? '▴' : '▾'}</button>
        </div>
        <div class="ggopts"${prefs.optsOpen ? '' : ' hidden'}>
          <select id="ggArea" aria-label="Area">${[['all', '14th–110th'], ['midtown', 'Midtown (14th–59th)'], ['uptown', 'Uptown (57th–110th)']].map(([k, v]) => `<option value="${k}"${prefs.area === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select id="ggFrom" aria-label="Start">${[['both', 'Start: mixed'], ['entries', 'Start: tunnels & bridges'], ['anywhere', 'Start: anywhere']].map(([k, v]) => `<option value="${k}"${prefs.from === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select id="ggPace" aria-label="Speed">${Object.keys(PACE).map((p) => `<option value="${p}"${prefs.pace === p ? ' selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select>
          <label><input type="checkbox" id="ggArrows"${prefs.arrows ? ' checked' : ''}/> One-way arrows</label>
          <label><input type="checkbox" id="ggMapFirst"${prefs.mapFirst ? ' checked' : ''}/> Map first</label>
        </div>
      </div>`
    );
    g.opts.bindHeader();
    for (const b of document.querySelectorAll('.ggturn')) b.addEventListener('click', () => press(b.dataset.side));
    document.getElementById('ggPause')?.addEventListener('click', togglePause);
    document.getElementById('ggOptsBtn').addEventListener('click', () => {
      prefs.optsOpen = !prefs.optsOpen;
      savePrefs();
      render();
    });
    document.getElementById('ggAgain')?.addEventListener('click', () => start(g.opts));
    document.getElementById('ggPace').addEventListener('change', (e) => {
      prefs.pace = e.target.value;
      savePrefs();
    });
    document.getElementById('ggFrom').addEventListener('change', (e) => {
      prefs.from = e.target.value;
      savePrefs();
      start(g.opts);
    });
    document.getElementById('ggArea').addEventListener('change', (e) => {
      prefs.area = e.target.value;
      savePrefs();
      start(g.opts); // a new route in the chosen area
    });
    document.getElementById('ggMapFirst').addEventListener('change', (e) => {
      prefs.mapFirst = e.target.checked;
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
    _model: { step, shortest, describe, AVES, PLACES, ENTRIES },
    _state: () => g,
    _screen(ai, s) {
      const { tx, ty, k } = g.cam;
      return [tx + AVES[ai].x * k, ty + -s * FT_PER_STREET * k];
    },
    _autopilot() {
      if (g) g.auto = true;
    },
  };
}
