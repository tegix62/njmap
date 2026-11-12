import { bearing, distanceMi, compass8, compass16, angleDiff, dirWord, destination as destinationPt } from './geo.js';
import { gridY } from './grid.js';
import { choicesHtml } from './ui.js';
import { sampleRoads, roadsThrough } from './roads.js';

let L; // label colors of the active theme (set in initPractice)

const TYPES = {
  mix: 'Mixed',
  find: 'Find it on the map',
  name: 'Name the highlighted town',
  dir: 'Which direction?',
  confuse: 'Sound-alikes',
  section: 'Which town is this village in?',
  borders: 'Which of these borders…?',
  landmark: 'Where is this landmark?',
  north: 'Which is farther north/east?',
  point: 'Point to it',
  avedir: 'Which way does the avenue run?',
  addr: 'Addresses: which avenues, which side?',
  crossing: 'Which crossing lands closest?',
  uptown: 'Point uptown',
  roadto: 'Which road gets you there?',
  leftright: 'Left or right?',
  bigpoint: 'Point to the big places',
  hwydir: 'Which way does the highway run?',
  hwyfact: 'Highway ends & crossings',
  naturept: 'Point to the lake or mountain',
  findpt: 'Find the lake or mountain',
  today: '☀ Today (2 min)',
  rapid: '⚡ Rapid round',
  gridmid: '🚕 Drive Midtown (new)',
  gridup: '🚕 Drive Uptown (new)',
  orbit: '🏙 Name that tower (new)',
  gridgame: '🚕 Drive Downtown (new)',
  gridclassic: '🚕 Drive Midtown (classic grid)',
  frames: '🧭 Left, right & compass',
  trip: 'My last drive',
};
// What each kind is, in a line, for the picker (the ones worth explaining)
const DESC = {
  today: 'A short set picked for you today. The best place to start.',
  mix: 'A bit of everything.',
  rapid: 'Timed one-tap rounds, three lives.',
  gridmid: 'Drive Midtown: plan the route avenue by avenue and street by street, then ride it.',
  gridup: 'Drive Uptown: 60th to 110th St, the Upper East and West Sides round Central Park, then ride it.',
  gridgame: 'Drive Downtown: plan the route through the tangle below 14th St, then ride it. Tunnels and bridges in.',
  gridclassic: 'The original: a straightened grid, 14th to 110th St.',
  frames: 'Left, right and compass: face every direction.',
  orbit: 'The camera circles a skyscraper, alone in a ghost of the city: which one is it? Ten a round, hints cost a point.',
  trip: 'Quiz yourself on your last drive.',
};
// How the kinds group in the picker (anything not listed lands in Quizzes)
const GROUPS = [
  ['Timed', ['rapid']],
  ['Driving practice', ['gridup', 'gridgame', 'gridclassic', 'frames']],
  ['Landmarks', ['orbit']],
];
// The modes that get a tile at the top of Practice (the rest are under "More")
const TILE_LABEL = {
  today: ['☀ Today', '2 min'],
  mix: ['∞ Mixed', 'endless'],
  gridmid: ['🚕 Drive', 'Midtown'],
  gridup: ['🚕 Uptown', 'change'],
};
// How long the map takes to turn and move to the next question
const QUESTION_MOVE_MS = 1200;
// One-tap kinds that work against a clock
const RAPID_TYPES = ['leftright', 'borders', 'north', 'find', 'name', 'avedir', 'addr', 'crossing', 'hwyfact', 'dir', 'findpt'];
const WEIGHT = { addr: 2, find: 2, dir: 2, borders: 2, north: 2, point: 2, roadto: 3, leftright: 3, bigpoint: 2 };
const DIR8 = ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'];
const DIR_DEG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export function initPractice(ctx) {
  const { map, store, munis } = ctx;
  const R = ctx.region;
  L = ctx.theme.label;
  const CFG_KEY = R.id === 'nj' ? 'practice' : `practice.${R.id}`;
  const cfg = { type: R.gridAngle ? 'gridmid' : 'today', area: R.wellKnown ? 'known' : 'all', ...store.get(CFG_KEY, {}) };
  const SC = R.gridAngle ? 0.12 : 1; // Manhattan distances are short
  if (R.orbit) {   // a region with its own "Name that ..." game (New Jersey's landmarks)
    TYPES.orbit = `${R.orbit.icon || '🏙'} ${R.orbit.title} (new)`;
    DESC.orbit = R.orbit.desc;
  }
  const allowed = ['today', 'mix', 'rapid', ...(R.gridAngle ? ['gridmid', 'gridup', 'gridgame', 'gridclassic', 'orbit'] : R.orbit ? ['orbit'] : []), 'frames', ...R.quizTypes, 'trip'];
  if (cfg.type === 'dropin') cfg.type = 'today'; // (the county puzzle is gone)
  if (!allowed.includes(cfg.type)) cfg.type = 'mix';
  // the whole-island game isn't reliable yet: anyone on it moves to the classic once
  if (cfg.type === 'gridgame' && !store.get('classicBack', false)) {
    cfg.type = 'gridclassic';
    store.set('classicBack', true);
    store.set(CFG_KEY, cfg);
  }
  const score = { right: 0, total: 0, streak: 0 };
  let q = null;
  const recent = [];
  let forced = null;
  const recentGroups = [];
  let lastType = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const countyBox = {};
  for (const m of munis) {
    const b = countyBox[m.c] || [Infinity, Infinity, -Infinity, -Infinity];
    countyBox[m.c] = [Math.min(b[0], m.bbox[0]), Math.min(b[1], m.bbox[1]), Math.max(b[2], m.bbox[2]), Math.max(b[3], m.bbox[3])];
  }

  // Average position of each county's towns: the "county intuition" that
  // north/east questions try to catch out.
  const countyCenter = {};
  for (const m of munis) {
    const c = (countyCenter[m.c] = countyCenter[m.c] || [0, 0, 0]);
    c[0] += m.pt[0];
    c[1] += m.pt[1];
    c[2]++;
  }
  for (const k in countyCenter) countyCenter[k] = [countyCenter[k][0] / countyCenter[k][2], countyCenter[k][1] / countyCenter[k][2]];

  // ---- area / pool ----------------------------------------------------------
  function pool() {
    const a = cfg.area;
    let p = munis;
    if (a.startsWith('county:')) p = munis.filter((m) => m.c === a.slice(7));
    else if (a.startsWith('region:')) {
      const cs = (R.superGroups || {})[a.slice(7)] || [];
      p = munis.filter((m) => cs.includes(m.c));
    } else if (a === 'known') p = munis.filter((m) => m.wellKnown);
    else if (a === 'mylist') {
      const keys = new Set(ctx.myList.keys());
      p = munis.filter((m) => keys.has(m.key));
    } else if (a === 'visited') {
      const v = ctx.modes.drive.visited;
      p = munis.filter((m) => v[m.key]);
    } else if (a === 'near' && ctx.pos) p = munis.filter((m) => distanceMi(ctx.pos.pt, m.pt) <= R.nearMi);
    // My list drives the questions even if it's short; wrong answers come from nearby.
    if (a === 'mylist' && p.length) return p;
    return p.length >= 4 ? p : munis;
  }

  // ---- spaced review ----------------------------------------------------------
  // Each town moves through boxes: a right answer pushes its next review out
  // (1, 3, 7, 16, 35 days); a miss sends it back to box 0, due again in 10
  // minutes. Spacing reviews over days beats massed practice (Cepeda et al.,
  // 2006); being quizzed beats re-reading (Roediger & Karpicke, 2006).
  const DAYS = [0, 1, 3, 7, 16, 35];
  const DAY = 864e5;
  const srs = () => store.get('srs', {});
  function record(m, ok) {
    const st = store.get('stats', {});
    const [seen = 0, right = 0] = st[m.key] || [];
    st[m.key] = [seen + 1, right + (ok ? 1 : 0)];
    store.set('stats', st);
    const s = srs();
    const cur = s[m.key] || { b: 0, due: 0 };
    const now = Date.now();
    if (ok) {
      const b = Math.min(cur.b + 1, DAYS.length - 1);
      s[m.key] = { b, due: now + DAYS[b] * DAY, f: q && q.fmt };
    } else s[m.key] = { b: 0, due: now + 10 * 60e3, f: q && q.fmt };
    store.set('srs', s);
    ctx.setKnow(m);
  }
  function dueCount(p) {
    const s = srs();
    const now = Date.now();
    return p.filter((m) => s[m.key] && s[m.key].due <= now).length;
  }
  function pick(p) {
    if (forced) return remember(forced); // Today: the place this question is about
    const s = srs();
    const now = Date.now();
    const ws = p.map((m) => {
      if (recent.includes(m.id)) return 0;
      const r = s[m.key];
      if (!r) return 1; // new
      if (r.due <= now) return 4 + Math.min(3, (now - r.due) / DAY); // due (more overdue = sooner)
      return 0.08; // learned and not due: rare
    });
    // Manhattan: balance the areas. Midtown alone has a third of the
    // neighborhoods, and they're small, so picking by neighborhood keeps you in
    // Midtown. Pick an area first (weighted by its members' average need, so an
    // area with places due still comes up sooner), then a place in it.
    if (R.groupOrder) {
      const byG = new Map();
      p.forEach((m, i) => {
        const g = byG.get(m.c) || { sum: 0, n: 0, idx: [] };
        g.sum += ws[i];
        g.n++;
        g.idx.push(i);
        byG.set(m.c, g);
      });
      const gs = [...byG.values()].filter((g) => g.sum > 0);
      if (gs.length > 1) {
        let y = Math.random() * gs.reduce((a, g) => a + g.sum / g.n, 0);
        const g = gs.find((q) => (y -= q.sum / q.n) <= 0) || gs[gs.length - 1];
        let z = Math.random() * g.sum;
        for (const i of g.idx) if ((z -= ws[i]) <= 0) return remember(p[i]);
      }
    }
    const tot = ws.reduce((a, b) => a + b, 0);
    let x = Math.random() * tot;
    for (let i = 0; i < p.length; i++) if ((x -= ws[i]) <= 0) return remember(p[i]);
    return remember(rand(p));
  }
  function remember(m) {
    recent.push(m.id);
    if (recent.length > 8) recent.shift();
    return m;
  }

  // ---- question builders ----------------------------------------------------
  function distractors(m, p, n) {
    const out = [];
    const seen = new Set([m.id]);
    const add = (o) => {
      if (out.length < n && !seen.has(o.id) && o.n !== m.n) {
        seen.add(o.id);
        out.push(o);
      }
    };
    const twins = (ctx.confusables.byId.get(m.id) || []).filter((g) => g.curated).flatMap((g) => g.members);
    shuffle([...twins]).forEach(add);
    shuffle([...m.neighbors]).forEach(add);
    shuffle(p.filter((o) => o.c === m.c)).slice(0, 20).forEach(add);
    shuffle([...p]).slice(0, 20).forEach(add);
    return out;
  }

  function makeFind(p) {
    return { kind: 'find', m: pick(p) };
  }
  function makeName(p) {
    const m = pick(p);
    return { kind: 'name', m, choices: shuffle([m, ...distractors(m, p, 3)]) };
  }
  function makeDir(p) {
    const a = pick(p);
    const twins = (ctx.confusables.byId.get(a.id) || [])
      .filter((g) => g.curated)
      .flatMap((g) => g.members)
      .filter((o) => o.n !== a.n && distanceMi(a.pt, o.pt) > 3 * SC);
    const okD = (o) => o !== a && distanceMi(a.pt, o.pt) > 2.5 * SC && distanceMi(a.pt, o.pt) < 35 * SC;
    let cands = p.filter(okD);
    if (!cands.length) cands = munis.filter(okD);
    const b = twins.length && Math.random() < 0.35 ? rand(twins) : rand(cands);
    return { kind: 'dir', m: a, b };
  }
  function makeSection(p) {
    const hasKnown = (m) => m.sections.some((x) => x.known);
    let cands = p.filter(hasKnown);
    if (cands.length < 2) cands = munis.filter(hasKnown);
    const m = pick(cands);
    const section = rand(m.sections.filter((x) => x.known));
    // Wrong answers: nearby towns, which never also have a section by that name.
    const ok = (o) => o !== m && !o.sections.some((x) => x.name === section.name);
    const seen = new Set();
    const others = [...shuffle([...m.neighbors]), ...shuffle(munis.filter((o) => o.c === m.c))]
      .filter((o) => ok(o) && !seen.has(o.id) && seen.add(o.id))
      .slice(0, 3);
    return { kind: 'sec', m, section, choices: shuffle([m, ...others]) };
  }

  /** "Which of these borders Wayne?": wrong answers are nearby towns that don't touch it. */
  function makeBorders(p) {
    const cands = p.filter((m) => m.neighbors.length >= 3);
    const m = pick(cands.length ? cands : munis.filter((x) => x.neighbors.length >= 3));
    if (!m.neighbors.length) return makeName(p); // an island (Randalls Island) touches nothing here: "what borders it?" has no answer
    const right = rand(m.neighbors);
    const touching = new Set([m.id, ...m.neighbors.map((o) => o.id)]);
    const ring2 = [...new Set(m.neighbors.flatMap((o) => o.neighbors))].filter((o) => !touching.has(o.id));
    const wrong = ring2.sort((a, b) => distanceMi(m.pt, a.pt) - distanceMi(m.pt, b.pt)).slice(0, 6);
    if (wrong.length < 1) return makeName(p);
    return { kind: 'borders', m, right, choices: shuffle([right, ...shuffle(wrong).slice(0, 3)]) };
  }

  /** "Willowbrook Mall is in which town?" */
  function makeLandmark(p) {
    const ids = new Set(p.map((m) => m.id));
    // Skip debatable ones, and giveaways (Times Square is in… Times Square)
    const quizzable = ctx.landmarks.filter((l) => l.quiz !== false && !l.name.toLowerCase().includes(l.m.n.toLowerCase()));
    const local = quizzable.filter((l) => ids.has(l.m.id));
    const l = rand(local.length ? local : quizzable);
    const m = l.m;
    const others = [...shuffle([...m.neighbors]), ...shuffle(munis.filter((o) => o.c === m.c))].filter((o, i, a) => o !== m && a.indexOf(o) === i);
    return { kind: 'landmark', m, landmark: l, choices: shuffle([m, ...others.slice(0, 3)]) };
  }

  /**
   * "Which is farther north?" People judge places by the region they're in:
   * many think Reno is east of San Diego because Nevada is east of California
   * (Stevens & Coupe, 1978). Prefer pairs where the county says one thing and
   * the towns say the other.
   */
  function makeNorth(p) {
    if (R.gridAngle) return makeUptownPair(p);
    const axis = Math.random() < 0.6 ? 'N' : 'E';
    const i = axis === 'N' ? 1 : 0;
    const k = axis === 'N' ? 69.05 : 69.17 * Math.cos(0.7115); // mi per degree at NJ's latitude
    let best = null;
    for (let tries = 0; tries < 500; tries++) {
      const a = rand(p);
      const b = rand(p);
      if (a === b || a.c === b.c || distanceMi(a.pt, b.pt) > 30) continue;
      const d = (a.pt[i] - b.pt[i]) * k; // + = a farther north/east
      if (Math.abs(d) < 1.5) continue;
      const cd = (countyCenter[a.c][i] - countyCenter[b.c][i]) * k;
      const tricky = Math.sign(cd) !== Math.sign(d) && Math.abs(cd) > 2;
      if (tricky) {
        best = { a, b, d, tricky };
        break;
      }
      if (!best) best = { a, b, d, tricky };
    }
    if (!best) return makeDir(p);
    const win = best.d > 0 ? best.a : best.b;
    const lose = win === best.a ? best.b : best.a;
    remember(win);
    return { kind: 'north', axis, m: win, other: lose, diff: Math.abs(best.d), tricky: best.tricky, choices: shuffle([best.a, best.b]) };
  }

  /** Manhattan: "Which is farther uptown?" measured along the grid. */
  function makeUptownPair(p) {
    for (let tries = 0; tries < 300; tries++) {
      const a = rand(p);
      const b = rand(p);
      if (a === b || distanceMi(a.pt, b.pt) > 3.5) continue;
      const d = gridY(a.pt, R.gridAngle) - gridY(b.pt, R.gridAngle);
      if (Math.abs(d) < 0.25) continue;
      const win = d > 0 ? a : b;
      remember(win);
      return { kind: 'north', axis: 'U', m: win, other: win === a ? b : a, diff: Math.abs(d), tricky: false, choices: shuffle([a, b]) };
    }
    return makeDir(p);
  }

  /** Manhattan: "Which way does 7th Ave run?" */
  function makeAveDir() {
    const [name, dir] = rand(R.avenues);
    return { kind: 'avedir', m: { key: `ave:${name}` }, name, dir };
  }

  const ordn = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  /**
   * Manhattan addresses on the west side of Fifth Avenue (the zero point): the hundreds digit + 5 is the nearer avenue
   * (225 W 37th is between 7th and 8th), and on a crosstown street odd numbers are on the north side, even on the south.
   * (Checked against Macy's 151 W 34th, MoMA 11 W 53rd and the Javits Center, 655 W 34th.)
   */
  function makeAddr() {
    const st = 14 + Math.floor(Math.random() * 46); // 14th to 59th
    const hundreds = Math.floor(Math.random() * 7); // 0..6 -> 5th&6th ... 11th&12th
    const n = hundreds * 100 + 1 + Math.floor(Math.random() * 98);
    const addr = `${n} W ${ordn(st)} St`;
    if (Math.random() < 0.7) {
      const pairs = [5, 6, 7, 8, 9, 10, 11].map((a) => a);
      const right = hundreds + 5;
      const others = shuffle(pairs.filter((a) => a !== right && Math.abs(a - right) <= 2)).slice(0, 3);
      const choices = shuffle([right, ...others]).map((a) => ({ a, label: `${ordn(a)} & ${ordn(a + 1)} Ave` }));
      return { kind: 'addr', mode: 'ave', m: { key: 'addr:ave' }, addr, n, st, hundreds, right, choices };
    }
    return { kind: 'addr', mode: 'side', m: { key: 'addr:side' }, addr, n, st, hundreds, right: n % 2 ? 'north' : 'south' };
  }

  /** Manhattan: "Which crossing lands closest to SoHo?" (only when one clearly does) */
  function makeCrossing(p) {
    for (let tries = 0; tries < 200; tries++) {
      const m = pick(p);
      const ds = R.crossings.map((c, i) => ({ c, i, d: distanceMi(c.pt, m.pt) })).sort((a, b) => a.d - b.d);
      if (ds[1].d / ds[0].d >= 1.6) return { kind: 'crossing', m, ds, right: ds[0].i };
    }
    return makeFind(p);
  }

  /**
   * "From Wayne, which road gets you to Boonton?" Route knowledge: the bridge
   * between knowing landmarks and having a mental map. Roads come from the
   * map tiles, so the question is built after the map has loaded the area.
   */
  function makeRoadTo(p) {
    if (ctx.settings.basemap === 'none') return makeBorders(p);
    return { kind: 'roadto', m: pick(p), pending: true, tries: 0 };
  }
  /** A road question for town A, or null if A doesn't make a good one. */
  function roadQuestionFor(samples, A) {
    const roads = roadsThrough(samples, A, 12 * SC).slice(0, 5);
    if (roads.length < 2) return null;
    // A target only one of the roads reaches, and not right next door
    const counts = new Map();
    for (const r of roads) for (const t of r.towns) counts.set(t.m.id, (counts.get(t.m.id) || 0) + 1);
    const opts = [];
    for (const r of roads)
      for (const t of r.towns)
        if (counts.get(t.m.id) === 1 && t.d >= 2.5 * SC && !A.neighbors.includes(t.m)) opts.push({ r, t, w: t.m.wellKnown ? 3 : 1 });
    if (!opts.length) return null;
    let x = Math.random() * opts.reduce((a, o) => a + o.w, 0);
    const o = opts.find((y) => (x -= y.w) <= 0) || opts[0];
    const choices = shuffle(roads.slice(0, 4));
    if (!choices.includes(o.r)) choices[0] = o.r;
    return { roads, right: o.r, target: o.t.m, tgt: o.t, choices };
  }
  function buildRoadTo(token) {
    if (q !== token) return;
    // Sample the roads once, then try the picked town and the others in view:
    // many small towns have no numbered highway through them.
    const samples = sampleRoads(map, ctx.locate);
    const b = map.getBounds();
    const inView = shuffle(q.p.filter((o) => o !== q.m && b.contains(o.pt)));
    const order = [q.m, ...inView.filter((o) => o.wellKnown), ...inView.filter((o) => !o.wellKnown)].slice(0, 40);
    for (const A of order) {
      const rq = roadQuestionFor(samples, A);
      if (rq) {
        Object.assign(q, { m: A, pending: false }, rq);
        return show();
      }
    }
    if (++q.tries < 3) {
      q.m = pick(q.p);
      return show();
    }
    q = makeBorders(q.p);
    q.p = token.p;
    q.answered = false;
    q.fallback = true;
    return show();
  }

  /** Manhattan: "Point uptown." The grid is turned ~29° from true north. */
  function makeUptown() {
    return { kind: 'uptown', m: { key: 'uptown' }, angle: null };
  }

  /**
   * "Point to Paterson" from you, one of your places, or a town. Practice with
   * feedback measurably improves spatial skills (Uttal et al., 2013).
   */
  function makePoint(p) {
    const origins = [];
    if (ctx.pos && Date.now() - ctx.pos.t < 5 * 60e3) origins.push({ name: 'you', pt: ctx.pos.pt, you: true });
    for (const a of ctx.anchors.list()) origins.push({ name: a.name, pt: a.pt });
    let from = origins.length && Math.random() < 0.7 ? rand(origins) : null;
    if (!from) {
      const others = forced ? p.filter((o) => o !== forced && distanceMi(o.pt, forced.pt) > 3 * SC && distanceMi(o.pt, forced.pt) < 30 * SC) : [];
      const m = forced ? rand(others.length ? others : munis.filter((o) => o !== forced)) : pick(p);
      from = { name: m.n, pt: m.pt, m };
    }
    const near = (list) => list.filter((o) => o !== from.m && distanceMi(from.pt, o.pt) > 3 * SC && distanceMi(from.pt, o.pt) < 30 * SC);
    const cands = near(p).length ? near(p) : near(munis);
    const m = cands.length ? pick(cands) : rand(munis);
    return { kind: 'point', m, from, angle: null };
  }

  /**
   * "You're in Clifton heading north. Is Paterson ahead, left, right or
   * behind?" The map turns to your heading: turning a compass direction into
   * a left or right turn.
   */
  function makeLeftRight(p) {
    const SIDES = { ahead: [0, 35], right: [55, 125], behind: [145, 180], left: [-125, -55] };
    for (let tries = 0; tries < 200; tries++) {
      const heading = 45 * Math.floor(Math.random() * 8);
      const inRange = (x, o) => o !== x && distanceMi(x.pt, o.pt) > 2 * SC && distanceMi(x.pt, o.pt) < 14 * SC;
      let a, b;
      if (forced) {
        // Today: the question is about the fixed place (b); start from somewhere near it
        b = forced;
        const from = munis.filter((o) => inRange(b, o));
        if (!from.length) continue;
        a = rand(from.filter((o) => o.wellKnown).length ? from.filter((o) => o.wellKnown) : from);
      } else {
        a = pick(p);
        const pool2 = munis.filter((o) => inRange(a, o));
        if (!pool2.length) continue;
        b = R.groupOrder ? pick(pool2) : rand(pool2.filter((o) => o.wellKnown).length ? pool2.filter((o) => o.wellKnown) : pool2);
      }
      if (a === b) continue;
      const rel = angleDiff(bearing(a.pt, b.pt), heading);
      const side = Object.keys(SIDES).find((k) => {
        const [lo, hi] = SIDES[k];
        return k === 'behind' ? Math.abs(rel) >= lo : k === 'ahead' ? Math.abs(rel) <= hi : rel >= lo && rel <= hi;
      });
      if (!side) continue; // too close to a diagonal to be fair
      return { kind: 'leftright', m: b, from: a, heading, side, rel };
    }
    return makeDir(p);
  }

  /** Point from a town (or you) to Manhattan, Philadelphia, Atlantic City… */
  function makeBigPoint(p) {
    const origins = [];
    if (ctx.pos && Date.now() - ctx.pos.t < 5 * 60e3) origins.push({ name: 'you', pt: ctx.pos.pt, you: true });
    let from = origins.length && Math.random() < 0.4 ? origins[0] : null;
    if (!from) {
      const m = pick(p);
      from = { name: m.n, pt: m.pt, m };
    }
    const far = R.bigPlaces.filter((b) => distanceMi(from.pt, b.pt) > 6);
    if (!far.length) return makePoint(p);
    const b = rand(far);
    return { kind: 'point', big: true, m: { key: `big:${b.name}`, n: b.name, pt: b.pt }, from, angle: null };
  }

  /** "the Turnpike", "the Parkway", "the AC Expressway", but just "I-80" */
  const theHwy = (label) => (/^I-|^Route /.test(label) ? label : `the ${label}`);
  const TheHwy = (label) => theHwy(label).replace(/^the /, 'The ');

  /** "From Wayne, point to Lake Hopatcong" (compass dial). */
  function makeNaturePoint(p) {
    const from = pick(p);
    const far = R.nature.filter((n) => distanceMi(from.pt, n.pt) > 3 && distanceMi(from.pt, n.pt) < 45);
    if (!far.length) return makePoint(p);
    const n = rand(far);
    return { kind: 'point', big: true, m: { key: `nat:${n.name}`, n: n.name, pt: n.pt }, from: { name: from.n, pt: from.pt, m: from }, angle: null, nat: n };
  }
  /** "Tap Lake Hopatcong": scored by how close the tap is. */
  function makeFindPt() {
    const n = rand(R.nature);
    return { kind: 'findpt', n, m: { key: `nat:${n.name}` } };
  }

  /** "Which way does the Turnpike run?": point along it (either end counts). */
  function makeHwyDir() {
    const h = rand(R.highways);
    return { kind: 'hwydir', h, m: { key: `hwy:${h.label}` }, angle: null };
  }

  /** "Where does the Parkway end in the north?" / "Where do the Parkway and Turnpike cross?" */
  function makeHwyFact() {
    const town = (key) => ctx.byKey.get(key);
    if (Math.random() < 0.4 && R.junctions.length >= 4) {
      const j = rand(R.junctions);
      const right = town(j.town);
      const wrong = shuffle(R.junctions.filter((x) => x.town !== j.town).map((x) => town(x.town))).slice(0, 3);
      return { kind: 'hwyfact', sub: 'cross', j, m: right, key: `cross:${j.a}|${j.b}`, choices: shuffle([right, ...wrong]) };
    }
    const h = rand(R.highways);
    const e = rand(h.ends);
    const right = e;
    const others = shuffle(R.highways.flatMap((o) => o.ends).filter((x) => x.name !== e.name)).slice(0, 3);
    return { kind: 'hwyfact', sub: 'end', h, e, m: { key: `end:${h.label}:${e.side}` }, choices: shuffle([right, ...others]) };
  }

  /** Recap of your most recent drive, then questions about it. */
  function makeTrip() {
    const trip = ctx.modes.drive.trips().filter((t) => t.towns.length >= 2 && t.towns.every((x) => ctx.byKey.has(x.key))).pop();
    if (!trip) return { kind: 'tripnone', m: null };
    const towns = trip.towns.map((x) => ({ ...x, m: ctx.byKey.get(x.key) })).filter((x) => x.m);
    if (tripSeen !== trip.start) {
      tripSeen = trip.start;
      return { kind: 'tripview', trip, towns, m: null };
    }
    const qs = [];
    for (let i = 0; i < towns.length - 1; i++) qs.push(['next', i]);
    for (let i = 1; i < towns.length; i++) if (towns[i].h != null) qs.push(['head', i]);
    const [type, i] = rand(qs);
    const t = towns[i];
    if (type === 'next') {
      const right = towns[i + 1].m;
      const wrong = shuffle(t.m.neighbors.filter((o) => o !== right)).slice(0, 3);
      return { kind: 'tripnext', trip, towns, i, m: right, from: t.m, choices: shuffle([right, ...wrong]) };
    }
    return { kind: 'triphead', trip, towns, i, m: t.m, heading: t.h };
  }
  let tripSeen = null;

  function makeConfuse(p) {
    const ids = new Set(p.map((m) => m.id));
    const curated = ctx.confusables.groups.filter((g) => g.curated);
    const local = curated.filter((g) => g.members.some((m) => ids.has(m.id)));
    const choose = local.length ? local : curated;
    const fresh = choose.filter((x) => !recentGroups.includes(x));
    const g = rand(fresh.length ? fresh : choose);
    recentGroups.push(g);
    if (recentGroups.length > 4) recentGroups.shift();
    const m = rand(g.members);
    let choices = g.members.length > 4 ? [m, ...shuffle(g.members.filter((o) => o !== m)).slice(0, 3)] : [...g.members];
    return { kind: 'name', m, choices: shuffle(choices), group: g };
  }
  function next() {
    stopRapidTimer();
    if (cfg.type !== 'orbit') ctx.orbit?.stop();
    if (cfg.type === 'today') return nextToday();
    if (cfg.type === 'rapid') return nextRapid();
    if (cfg.type !== 'gridgame') ctx.gridgame.stop();
    if (cfg.type !== 'gridmid') ctx.gridmid.stop();
    if (cfg.type !== 'gridup') ctx.gridup.stop();
    if (cfg.type !== 'gridclassic') ctx.gridclassic.stop();
    if (cfg.type === 'gridgame') return startGridGame(ctx.gridgame);
    if (cfg.type === 'gridmid') return startGridGame(ctx.gridmid);
    if (cfg.type === 'gridup') return startGridGame(ctx.gridup);
    if (cfg.type === 'orbit') return startOrbit();
    if (cfg.type === 'gridclassic') return startGridClassic();
    if (cfg.type === 'frames') {
      q = { kind: 'frames', m: null, answered: false };
      return ctx.frames.start({ header: () => header(), bindHeader: () => bindHeader() });
    }
    ctx.frames.stop();
    const p = pool();
    // Mixed mode interleaves question types and never repeats one back to back
    // (interleaving helps tell similar things apart; Kornell & Bjork, 2008).
    let t = cfg.type;
    if (t === 'mix') {
      const bag = R.quizTypes.flatMap((k) => Array(WEIGHT[k] || 1).fill(k));
      do t = rand(bag);
      while (t === lastType);
    }
    lastType = t;
    q = MAKERS[t](p);
    q.p = p;
    q.fmt = t;
    q.answered = false;
    show();
  }

  const MAKERS = {
    find: makeFind,
    name: makeName,
    dir: makeDir,
    confuse: makeConfuse,
    section: makeSection,
    borders: makeBorders,
    landmark: makeLandmark,
    north: makeNorth,
    point: makePoint,
    trip: makeTrip,
    avedir: makeAveDir,
    addr: makeAddr,
    crossing: makeCrossing,
    uptown: makeUptown,
    roadto: makeRoadTo,
    leftright: makeLeftRight,
    bigpoint: makeBigPoint,
    hwydir: makeHwyDir,
    hwyfact: makeHwyFact,
    naturept: makeNaturePoint,
    findpt: makeFindPt,
  };

  // ---- Today ----------------------------------------------------------------------
  // A short daily set (~2 minutes) you can always come back to: places due for
  // review first, then a few new ones. Each new place comes back three times,
  // spread through the set, from different angles (find it, its borders, left or
  // right of somewhere), so it's learned as part of a web rather than one fact.
  // A place you're reviewing gets a different question than last time.
  const TODAY_KEY = `today.${R.id}`;
  const SET_SIZE = 10;
  const ANGLES = ['find', 'borders', 'leftright', 'name', 'dir', 'point'];
  const dayStr = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');
  function buildToday() {
    const p = pool();
    const s = srs();
    const now = Date.now();
    const angles = ANGLES.filter((a) => R.quizTypes.includes(a));
    const due = p.filter((m) => s[m.key] && s[m.key].due <= now).sort((a, b) => s[a.key].due - s[b.key].due).slice(0, 6);
    const listed = new Set(ctx.myList.keys());
    const fresh = shuffle(p.filter((m) => !s[m.key])).sort((a, b) => (listed.has(b.key) ? 2 : b.wellKnown ? 1 : 0) - (listed.has(a.key) ? 2 : a.wellKnown ? 1 : 0));
    const nNew = Math.max(2, Math.min(3, Math.ceil((SET_SIZE - due.length) / 3)));
    const news = fresh.slice(0, nNew);
    const reviewItems = due.map((m) => ({ key: m.key, fmt: rand(angles.filter((a) => a !== (s[m.key] && s[m.key].f))) }));
    // three angles per new place, in rounds so the repeats are spread out
    const rounds = [0, 1, 2].map((r) => news.map((m) => ({ key: m.key, fmt: shuffle([...angles]).find((a, i) => i === r) || rand(angles), isNew: r === 0 })));
    const fixAngles = news.map(() => shuffle(['find', 'borders', 'leftright'].filter((a) => angles.includes(a))));
    rounds.forEach((round, r) => round.forEach((it, i) => (it.fmt = fixAngles[i][r] || rand(angles))));
    const items = [];
    const queue = [...reviewItems];
    for (const round of rounds) {
      for (const it of round) {
        items.push(it);
        if (queue.length) items.push(queue.shift());
      }
    }
    items.push(...queue);
    // top up with well-known places in a format they haven't had lately
    while (items.length < SET_SIZE) {
      const m = rand(p.filter((x) => x.wellKnown).length ? p.filter((x) => x.wellKnown) : p);
      items.push({ key: m.key, fmt: rand(angles) });
    }
    return { date: dayStr(), items: items.slice(0, Math.max(SET_SIZE, items.length)).slice(0, 12), i: 0, right: 0, done: false };
  }
  function todayState() {
    let t = store.get(TODAY_KEY, null);
    if (!t || t.date !== dayStr()) {
      t = buildToday();
      store.set(TODAY_KEY, t);
    }
    return t;
  }
  function streak() {
    const log = store.get('todayLog', {});
    let n = 0;
    for (let d = new Date(); log[dayStr(d)]; d.setDate(d.getDate() - 1)) n++;
    return n;
  }
  function nextToday() {
    const t = todayState();
    // the Next button after an answered Today question advances the set
    if (q && q.today && q.answered) {
      t.i++;
      store.set(TODAY_KEY, t);
    }
    if (t.i >= t.items.length) {
      if (!t.done) {
        t.done = true;
        store.set(TODAY_KEY, t);
        const log = store.get('todayLog', {});
        log[dayStr()] = true;
        store.set('todayLog', log);
      }
      q = { kind: 'todaydone', m: null, answered: false, t };
      return show();
    }
    const it = t.items[t.i];
    const m = ctx.byKey.get(it.key);
    const p = pool();
    if (!m || !MAKERS[it.fmt]) {
      t.i++;
      return nextToday();
    }
    forced = m;
    try {
      q = MAKERS[it.fmt](p);
    } finally {
      forced = null;
    }
    q.p = p;
    q.fmt = it.fmt;
    q.today = true;
    q.isNew = it.isNew;
    q.answered = false;
    show();
  }

  // ---- Rapid round ------------------------------------------------------------
  // One-tap questions against a shrinking clock, 3 lives, faster as you go.
  // The point is speed: recall that's automatic, not worked out.
  const rapid = { on: false, lives: 3, score: 0, round: 0, misses: [], timer: 0, advance: 0 };
  const BEST_KEY = `rapidBest.${R.id}`;
  function stopRapidTimer() {
    clearTimeout(rapid.timer);
    clearTimeout(rapid.advance);
  }
  function nextRapid() {
    if (!rapid.on) {
      q = { kind: 'rapidstart', m: null, answered: false };
      return show();
    }
    if (rapid.lives <= 0) {
      rapid.on = false;
      const best = Math.max(store.get(BEST_KEY, 0), rapid.score);
      q = { kind: 'rapidend', m: null, answered: false, best, newBest: rapid.score >= best && rapid.score > 0 };
      store.set(BEST_KEY, best);
      return show();
    }
    const types = RAPID_TYPES.filter((t) => R.quizTypes.includes(t));
    let t;
    do t = rand(types);
    while (t === lastType && types.length > 1);
    lastType = t;
    const p = pool();
    q = MAKERS[t](p);
    q.p = p;
    q.answered = false;
    q.rapid = true;
    rapid.round++;
    show();
    // shorter and shorter: 8.5 s down to 3.5 s
    const secs = Math.max(3.5, 8.5 - 0.3 * (rapid.round - 1));
    document.getElementById('hud').insertAdjacentHTML('beforeend', `<div class="tbar"><span style="animation-duration:${secs}s"></span></div>`);
    const token = q;
    rapid.timer = setTimeout(() => q === token && !q.answered && rapidTimeout(), secs * 1000);
  }
  function rapidTimeout() {
    q.answered = true;
    for (const b of document.querySelectorAll('#qbody .choice')) b.disabled = true;
    if (q.m && q.m.key) record(q.m, false);
    if (q.m && q.m.id != null) {
      ctx.highlight(q.m.id, 'good');
      ctx.reveal([{ m: q.m, color: L.good }]);
    }
    rapidResult(false, '⏱');
  }
  function rapidResult(ok, mark) {
    clearTimeout(rapid.timer);
    q.answered = true;
    if (ok) rapid.score++;
    else {
      rapid.lives--;
      const what = (q.m && q.m.n) || q.name || (q.h && q.h.label) || (q.j && `${q.j.a} × ${q.j.b}`) || '';
      if (what) rapid.misses.push(what);
    }
    const qb = document.getElementById('qbody');
    for (const g of qb.querySelectorAll('.choices, .rose8, .lrpad')) g.classList.add('answered');
    qb.insertAdjacentHTML('beforeend', `<div class="flash ${ok ? 'ok' : 'no'}">${mark || (ok ? '✓' : '✗')}</div>`);
    document.querySelector('#sheet .score').outerHTML = header().match(/<div class="score[^"]*">.*<\/div>$/s)[0];
    // a quick beat on a hit, a longer look at the answer on a miss
    rapid.advance = setTimeout(nextRapid, ok ? 450 : 1300);
  }

  // ---- Drive the grid (Manhattan) ---------------------------------------------------
  function startGridGame(game) {
    q = { kind: 'gridgame', m: null, answered: false };
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    game.start({ header: () => header(), bindHeader: () => bindHeader() });
  }

  function startOrbit() {
    q = { kind: 'gridgame', m: null, answered: false };
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    ctx.orbit.start({ header: () => header(), bindHeader: () => bindHeader() });
  }

  function startGridClassic() {
    q = { kind: 'gridgame', m: null, answered: false };
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    ctx.gridclassic.start({ header: () => header(), bindHeader: () => bindHeader() });
  }

  // ---- rendering ------------------------------------------------------------
  function header() {
    const opts = (o) =>
      Object.entries(o)
        .map(([k, v]) => `<option value="${k}"${cfg.type === k ? ' selected' : ''}>${v}</option>`)
        .join('');
    // only this map's places: the list is shared between New Jersey and Manhattan
    const nVisited = munis.filter((m) => ctx.modes.drive.visited[m.key]).length;
    const areaOpt = (v, label) => `<option value="${v}"${cfg.area === v ? ' selected' : ''}>${esc(label)}</option>`;
    const area =
      (R.wellKnown ? areaOpt('known', `Well-known ${R.units} (${munis.filter((m) => m.wellKnown).length})`) : '') +
      areaOpt('mylist', `My list (${ctx.myList.keys().filter((k) => ctx.byKey.has(k)).length})`) +
      areaOpt('all', `All of ${R.name}`) +
      (ctx.pos ? areaOpt('near', `Within ${R.nearMi} mi of me`) : '') +
      areaOpt('visited', `${R.units[0].toUpperCase() + R.units.slice(1)} I've been through (${nVisited})`) +
      (R.superGroups ? `<optgroup label="Regions">${Object.keys(R.superGroups).map((r) => areaOpt('region:' + r, r)).join('')}</optgroup>` : '') +
      `<optgroup label="${R.groupPlural}">${ctx.counties.map((c) => areaOpt('county:' + c, ctx.groupName(c))).join('')}</optgroup>`;
    const pct = score.total ? Math.round((100 * score.right) / score.total) : 0;
    const due = dueCount(pool());
    if (cfg.type === 'today') {
      const t = todayState();
      const dots = t.items.map((_, k) => `<span class="${k < t.i ? 'd done' : k === t.i && !t.done ? 'd now' : 'd'}"></span>`).join('');
      return `${typeBtn()}<div class="prow">
        <select id="qArea" aria-label="Area">${area}</select>
      </div><div class="score todaybar"><span class="dots">${dots}</span>${streak() ? `<span>🔥 ${streak()} day${streak() === 1 ? '' : 's'}</span>` : ''}</div>`;
    }
    if (cfg.type === 'gridgame' || cfg.type === 'gridmid' || cfg.type === 'gridup' || cfg.type === 'gridclassic' || cfg.type === 'orbit' || cfg.type === 'frames')
      // these have no use for the neighborhood/town list
      return `${typeBtn()}<div class="score"></div>`;
    if (cfg.type === 'rapid' && !rapid.on)
      return `${typeBtn()}<div class="prow">
        <select id="qArea" aria-label="Area">${area}</select>
      </div><div class="score"></div>`;
    if (cfg.type === 'rapid' && rapid.on)
      return `${typeBtn()}<div class="prow">
        <select id="qArea" aria-label="Area">${area}</select>
      </div><div class="score"><span class="lives">${'♥'.repeat(Math.max(0, rapid.lives))}${'♡'.repeat(Math.max(0, 3 - rapid.lives))}</span> · ${rapid.score} right · round ${rapid.round}</div>`;
    return `${typeBtn()}<div class="prow">
        <select id="qArea" aria-label="Area">${area}</select>
      </div>
      <div class="score">${due ? `<span class="due">${due} due for review</span> · ` : ''}${score.right}/${score.total}${score.total ? ` · ${pct}%` : ''}${score.streak > 1 ? ` · streak ${score.streak}` : ''}</div>`;
  }

  /** The main modes as tiles (New York: Drive Midtown first), and a "More" button for everything else. */
  function typeBtn() {
    const tiles = (R.gridAngle ? ['gridmid', 'today', 'mix'] : ['today', 'mix']).filter((k) => allowed.includes(k));
    const other = !tiles.includes(cfg.type);
    return `<div class="ptiles">${tiles
      .map((k) => `<button class="ptile${cfg.type === k ? ' on' : ''}" data-type="${k}" aria-pressed="${cfg.type === k}"><b>${esc(TILE_LABEL[k][0])}</b><small>${esc(TILE_LABEL[k][1])}</small></button>`)
      .join('')}<button id="qType" class="ptile more${other ? ' on' : ''}" aria-haspopup="dialog" aria-label="More ways to practice"><b>${other ? esc(TILE_LABEL[cfg.type] ? TILE_LABEL[cfg.type][0] : TYPES[cfg.type] || cfg.type) : 'More'}</b><small>${other ? 'change ▾' : 'quizzes ▾'}</small></button></div>`;
  }
  function chooseType(t) {
    if (!allowed.includes(t)) return;
    const recent = [cfg.type, ...store.get('practice.recent', [])].filter((x, i, a) => x && a.indexOf(x) === i && x !== t);
    store.set('practice.recent', recent.slice(0, 4));
    cfg.type = t;
    store.set(CFG_KEY, cfg);
    next();
  }
  /** A grouped list of everything there is to practice, with a line on each. */
  function openPicker() {
    let dlg = document.getElementById('pickDlg');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'pickDlg';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
    }
    const card = (k) =>
      `<button class="pcard${k === cfg.type ? ' on' : ''}" data-type="${k}"><span class="pt">${esc(TYPES[k])}</span>${DESC[k] ? `<span class="pd">${esc(DESC[k])}</span>` : ''}</button>`;
    const used = new Set([...GROUPS.flatMap(([, ks]) => ks), 'today', 'mix', 'gridmid']);
    const groups = GROUPS.map(([name, ks]) => [name, ks.filter((k) => allowed.includes(k))]);
    groups.push(['Quizzes', allowed.filter((k) => !used.has(k))]);
    const quizChip = (k) => `<button class="pchip${k === cfg.type ? ' on' : ''}" data-type="${k}">${esc(TYPES[k])}</button>`;
    const recent = store.get('practice.recent', []).filter((k) => allowed.includes(k) && k !== cfg.type).slice(0, 3);
    dlg.innerHTML = `<h2>More ways to practice</h2>
      ${recent.length ? `<div class="pgroup"><div class="pname">Recently</div><div class="precent">${recent.map((k) => `<button class="pchip" data-type="${k}">${esc(TYPES[k])}</button>`).join('')}</div></div>` : ''}
      ${groups
        .filter(([, ks]) => ks.length)
        .map(
          ([name, ks]) =>
            name === 'Quizzes'
              ? `<div class="pgroup"><div class="pname">${name}</div><div class="precent quizzes">${ks.map(quizChip).join('')}</div></div>`
              : `<div class="pgroup"><div class="pname">${name}</div><div class="pcards">${ks.map(card).join('')}</div></div>`
        )
        .join('')}
      <button class="primary" id="pickClose">Close</button>`;
    for (const b of dlg.querySelectorAll('[data-type]'))
      b.addEventListener('click', () => {
        dlg.close();
        chooseType(b.dataset.type);
      });
    dlg.querySelector('#pickClose').addEventListener('click', () => dlg.close());
    dlg.showModal();
    dlg.querySelector('.pcard.on')?.scrollIntoView({ block: 'center' });
  }
  function bindHeader() {
    document.getElementById('qType').addEventListener('click', openPicker);
    for (const b of document.querySelectorAll('.ptile[data-type]')) b.addEventListener('click', () => b.dataset.type !== cfg.type && chooseType(b.dataset.type));
    document.getElementById('qArea')?.addEventListener('change', (e) => {
      cfg.area = e.target.value;
      store.set(CFG_KEY, cfg);
      if (cfg.type === 'today') {
        store.set(TODAY_KEY, buildToday());
        q = null;
      }
      if (cfg.area === 'visited' && munis.filter((m) => ctx.modes.drive.visited[m.key]).length < 4)
        alert(
          ctx.settings.rememberPlaces
            ? `Fewer than 4 ${R.units} visited so far. Use Drive mode with location on, and the ${R.units} you pass through will collect here. Using all of ${R.name} for now.`
            : `This uses places you've been, which the app only keeps if you turn on Settings → "Remember where I've been". It's off, so this uses all of ${R.name} for now.`
        );
      next();
    });
  }

  function areaBox(p) {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const m of p) b = [Math.min(b[0], m.bbox[0]), Math.min(b[1], m.bbox[1]), Math.max(b[2], m.bbox[2]), Math.max(b[3], m.bbox[3])];
    return { bbox: b };
  }

  /** A town's name in a question. Same-name towns say which one, plainly. */
  function prompt(m) {
    if (!m.dup) return `<b>${esc(m.n)}</b>`;
    const others = munis.filter((o) => o !== m && o.n === m.n);
    const which =
      others.length > 2
        ? `${esc(m.c)} County; there are ${others.length + 1} ${esc(m.n)}s`
        : others.every((o) => o.c !== m.c)
          ? `${esc(m.c)} County, not the one in ${esc([...new Set(others.map((o) => o.c))].join(' or '))}`
          : `not the ${esc(others.map((o) => o.t).join(' or '))}`;
    return `<b>${esc(m.n)} ${esc(m.t)}</b> <span class="which">(${which})</span>`;
  }


  function show() {
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    ctx.trip(null);
    ctx.focusRoad(null);
    ctx.showLabels(false);
    ctx.showRoadRefs(false); // fewer labels while answering; shown after a road question
    const m = q.m;
    let body = '';
    if (q.kind === 'find') {
      ctx.hud(`<div class="qkind">Find it</div><div class="q">Tap ${prompt(m)}</div>`);
      body = `<div class="hint muted">Tap the map. Pinch to zoom if you need to.</div>`;
    } else if (q.kind === 'name') {
      ctx.highlight(m.id, 'q');
      ctx.hud(`<div class="qkind">${q.group ? 'Sound-alikes' : 'Name it'}</div><div class="q">Which town is highlighted?</div>`);
      body = choicesHtml(q.choices, { data: (o) => o.id, label: (o) => ctx.name(o) });
    } else if (q.kind === 'borders') {
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: L.q }]);
      ctx.hud(`<div class="qkind">Borders${q.fallback ? ' <span class="muted">(no road question nearby)</span>' : ''}</div><div class="q">Which of these borders ${prompt(m)}?</div>`);
      body = choicesHtml(q.choices, { data: (o) => o.id, label: (o) => ctx.name(o) });
    } else if (q.kind === 'landmark') {
      ctx.hud(`<div class="qkind">Landmarks</div><div class="q"><b>${esc(q.landmark.name)}</b> is in which ${R.unit}?</div>`);
      body = choicesHtml(q.choices, { data: (o) => o.id, label: (o) => ctx.name(o) });
    } else if (q.kind === 'findpt') {
      ctx.hud(`<div class="qkind">${esc(q.n.kind)}</div><div class="q">Tap <b>${esc(q.n.name)}</b> on the map</div>`);
      body = `<div class="hint muted">Close counts: within about ${q.n.r} mi.</div>`;
    } else if (q.kind === 'todaydone') {
      const t = q.t;
      const places = [...new Set(t.items.map((it) => it.key))].map((k) => ctx.byKey.get(k)).filter(Boolean);
      ctx.hud(`<div class="qkind">☀ Today</div><div class="q">Done: ${t.right} of ${t.items.length} right</div>`);
      body = `<div class="hint">${streak() > 1 ? `🔥 ${streak()} days in a row. ` : ''}These are now darker on the map:</div>
        <div class="chips">${places.map((m) => `<span class="chip">${esc(m.n)}</span>`).join('')}</div>
        <div class="btnrow2"><button class="primary" id="todayMore">10 more</button><button class="primary ghost" id="todayFree">Free practice</button></div>`;
    } else if (q.kind === 'rapidstart') {
      ctx.hud(`<div class="qkind">⚡ Rapid round</div><div class="q">Quick questions, back to back</div>`);
      body = `<div class="hint">One tap each, against the clock. Three lives, and it speeds up as you go. Misses go to your review pile.</div>
        ${store.get(BEST_KEY, 0) ? `<div class="hint muted">Best: ${store.get(BEST_KEY, 0)}</div>` : ''}
        <button class="primary" id="rapidGo">Start</button>`;
    } else if (q.kind === 'rapidend') {
      ctx.hud(`<div class="qkind">⚡ Rapid round</div><div class="q">${rapid.score} right${q.newBest ? ' · new best!' : ''}</div>`);
      body = `<div class="hint muted">Best: ${q.best}</div>
        ${rapid.misses.length ? `<div class="label-sm">Missed: back for review soon</div><div class="chips">${[...new Set(rapid.misses)].map((n) => `<span class="chip">${esc(n)}</span>`).join('')}</div>` : ''}
        <button class="primary" id="rapidGo">Play again</button>`;
    } else if (q.kind === 'leftright') {
      const a = q.from;
      ctx.highlight(a.id, 'q');
      ctx.reveal([{ m: a, color: L.q }]);
      ctx.hud(
        `<div class="qkind">Left or right?</div><div class="q">You're in ${prompt(a)}, heading <b>${dirWord(compass8(q.heading))}</b>. Which way is ${prompt(m)}?</div>`
      );
      body = `<div class="lrpad">${['ahead', 'left', 'right', 'behind']
        .map((v) => `<button class="choice lr-${v}" data-v="${v}">${{ ahead: '▲ Ahead', left: '◀ Left', right: 'Right ▶', behind: '▼ Behind' }[v]}</button>`)
        .join('')}</div>`;
    } else if (q.kind === 'hwydir') {
      ctx.hud(`<div class="qkind">Highways</div><div class="q">Which way does ${ctx.swatch(q.h.label)}<b>${esc(theHwy(q.h.label))}</b> run? Point along it.</div>`);
      body = `${dialSVG()}<button class="primary" id="lockIn" disabled>Lock in</button>`;
    } else if (q.kind === 'hwyfact' && q.sub === 'cross') {
      ctx.hud(
        `<div class="qkind">Highways</div><div class="q">Where do ${ctx.swatch(q.j.a)}<b>${esc(theHwy(q.j.a))}</b> and ${ctx.swatch(q.j.b)}<b>${esc(theHwy(q.j.b))}</b> meet?</div>`
      );
      body = choicesHtml(q.choices, { data: (o) => o.id, label: (o) => ctx.name(o) });
    } else if (q.kind === 'hwyfact') {
      ctx.hud(`<div class="qkind">Highways</div><div class="q">Where does ${ctx.swatch(q.h.label)}<b>${esc(theHwy(q.h.label))}</b> end in the <b>${q.e.side}</b>?</div>`);
      body = `<div class="choices">${q.choices.map((e, i) => `<button class="choice" data-v="${i}">${esc(e.name.replace(/^the /, ''))}</button>`).join('')}</div>`;
    } else if (q.kind === 'roadto' && q.pending) {
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: L.q }]);
      ctx.hud(`<div class="qkind">Roads</div><div class="q">Finding the roads around ${prompt(m)}…</div>`);
      body = `<div class="hint muted">Reading the road map for this area.</div>`;
      const token = q;
      requestAnimationFrame(() => {
        ctx.fit([aroundBox(m.pt, 9 * SC)], 11.5, { bearing: 0, duration: QUESTION_MOVE_MS });
        let done = false;
        const go = () => {
          if (done) return;
          done = true;
          buildRoadTo(token);
        };
        map.once('idle', go);
        setTimeout(go, 5000);
      });
    } else if (q.kind === 'roadto') {
      ctx.highlight(m.id, 'q');
      ctx.highlight(q.target.id, 'near');
      ctx.reveal([
        { m, color: L.q },
        { m: q.target, color: L.neutral },
      ]);
      ctx.hud(`<div class="qkind">Roads</div><div class="q">From ${prompt(m)}, which road gets you to ${prompt(q.target)}?</div>`);
      body = `<div class="choices">${q.choices.map((r, i) => `<button class="choice" data-v="${i}">${ctx.swatch(r.label)}${esc(r.label)}</button>`).join('')}</div>`;
    } else if (q.kind === 'avedir') {
      ctx.hud(`<div class="qkind">Avenues</div><div class="q">Which way does <b>${esc(q.name)}</b> run?</div>`);
      body = `<div class="choices three">${['uptown', 'downtown', 'two-way']
        .map((v) => `<button class="choice" data-v="${v}">${v === 'two-way' ? 'Both ways' : v[0].toUpperCase() + v.slice(1)}</button>`)
        .join('')}</div>`;
    } else if (q.kind === 'addr') {
      ctx.hud(`<div class="qkind">Addresses</div><div class="q">${q.mode === 'ave' ? `<b>${esc(q.addr)}</b>: between which avenues?` : `Which side of the street is <b>${esc(q.addr)}</b> on?`}</div>`);
      body = q.mode === 'ave'
        ? `<div class="choices">${q.choices.map((c) => `<button class="choice" data-v="${c.a}">${esc(c.label)}</button>`).join('')}</div>`
        : `<div class="choices"><button class="choice" data-v="north">North side</button><button class="choice" data-v="south">South side</button></div>`;
    } else if (q.kind === 'crossing') {
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: L.q }]);
      ctx.hud(`<div class="qkind">Crossings</div><div class="q">Coming from Jersey, which crossing lands closest to <b>${esc(m.n)}</b>?</div>`);
      body = `<div class="choices three">${R.crossings.map((c, i) => `<button class="choice" data-v="${i}">${esc(c.short)}</button>`).join('')}</div>`;
    } else if (q.kind === 'uptown') {
      ctx.hud(`<div class="qkind">The grid</div><div class="q">Point <b>uptown</b>: the way the avenues run</div>`);
      body = `${dialSVG()}<button class="primary" id="lockIn" disabled>Lock in</button>`;
    } else if (q.kind === 'north') {
      const word = q.axis === 'N' ? 'north' : q.axis === 'U' ? 'uptown' : 'east';
      ctx.hud(`<div class="qkind">Farther ${word}?</div><div class="q">Which is farther <b>${word}</b>?</div>`);
      body = choicesHtml(q.choices, { data: (o) => o.id, label: (o) => ctx.name(o) });
    } else if (q.kind === 'point') {
      const from = q.from.you ? 'where you are' : `<b>${esc(q.from.name)}</b>`;
      if (!q.from.you) ctx.reveal([{ m: q.m, pt: q.from.pt, label: q.from.name, color: L.q }]);
      ctx.hud(`<div class="qkind">Point to it</div><div class="q">From ${from}, point to ${q.big ? `<b>${esc(q.m.n)}</b>` : prompt(q.m)}</div>`);
      body = `${dialSVG()}<button class="primary" id="lockIn" disabled>Lock in</button>`;
    } else if (q.kind === 'tripnone') {
      ctx.hud(`<div class="qkind">My last drive</div><div class="q">No drives saved</div>`);
      body = `<div class="hint muted">${
        ctx.settings.rememberPlaces
          ? 'Drive with location on, and each drive is saved on this phone for a recap here.'
          : 'Drives are only saved if you turn on Settings → "Remember where I\'ve been". It\'s off, so nothing about your location is kept.'
      }</div>`;
    } else if (q.kind === 'tripview') {
      showTripLine(q.trip);
      ctx.reveal(q.towns.map((x, k) => ({ m: x.m, label: `${k + 1}. ${x.m.n}`, color: L.neutral })));
      const when = new Date(q.trip.start).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
      ctx.hud(`<div class="qkind">My last drive · ${esc(when)}</div><div class="q">${q.towns.length} ${R.units}, in order</div>`);
      body = `<ol class="triplist">${q.towns
        .map((x, k) => `<li><b>${esc(ctx.name(x.m))}</b> <span class="muted">${esc(x.m.c)}${k && x.h != null ? ` · heading ${compass8(x.h)}` : ''}</span></li>`)
        .join('')}</ol><button class="primary" id="tripQuiz">Quiz me on this drive</button>`;
    } else if (q.kind === 'tripnext') {
      showTripLine(q.trip);
      ctx.highlight(q.from.id, 'q');
      ctx.reveal([{ m: q.from, color: L.q }]);
      ctx.hud(`<div class="qkind">My last drive</div><div class="q">After ${prompt(q.from)}, which town did you enter next?</div>`);
      body = choicesHtml(q.choices, { data: (o) => o.id, label: (o) => ctx.name(o) });
    } else if (q.kind === 'triphead') {
      showTripLine(q.trip);
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: L.q }]);
      ctx.hud(`<div class="qkind">My last drive</div><div class="q">Which way were you heading when you entered ${prompt(m)}?</div>`);
      body = `<div class="rose8">${DIR8.map((d) => (d ? `<button class="choice dir" data-dir="${d}">${d}</button>` : '<span></span>')).join('')}</div>`;
    } else if (q.kind === 'sec') {
      ctx.hud(`<div class="qkind">Villages &amp; sections</div><div class="q"><b>${esc(q.section.name)}</b> is part of which town?</div>`);
      body = choicesHtml(q.choices, { data: (o) => o.id, label: (o) => ctx.name(o) });
    } else if (q.kind === 'dir') {
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: L.q }]);
      ctx.hud(`<div class="qkind">Which way?</div><div class="q">From ${prompt(m)}, which way is ${prompt(q.b)}?</div>`);
      body = `<div class="rose8">${DIR8.map((d) => (d ? `<button class="choice dir" data-dir="${d}">${d}</button>` : '<span></span>')).join('')}</div>`;
    }
    ctx.sheet(`${header()}<div id="qbody">${body}</div>`);
    bindHeader();
    for (const b of document.querySelectorAll('#qbody .choice')) b.addEventListener('click', () => answer(b));
    if (q.kind === 'point' || q.kind === 'uptown' || q.kind === 'hwydir') bindDial();
    const tm = document.getElementById('todayMore');
    if (tm)
      tm.addEventListener('click', () => {
        const t = buildToday();
        store.set(TODAY_KEY, t);
        q = null;
        nextToday();
      });
    const tf = document.getElementById('todayFree');
    if (tf)
      tf.addEventListener('click', () => {
        cfg.type = 'mix';
        store.set(CFG_KEY, cfg);
        next();
      });
    if (q.today) {
      const k = document.querySelector('#hud .qkind');
      if (k && q.isNew) k.insertAdjacentHTML('beforeend', ' <span class="newtag">new place</span>');
    }
    const rg = document.getElementById('rapidGo');
    if (rg)
      rg.addEventListener('click', () => {
        Object.assign(rapid, { on: true, lives: 3, score: 0, round: 0, misses: [] });
        nextRapid();
      });
    const tq = document.getElementById('tripQuiz');
    if (tq) tq.addEventListener('click', next);

    // Frame the question without giving it away.
    // Each question has its own orientation: north-up for most, your heading
    // for "Left or right?". The map turns and moves there in one smooth move.
    requestAnimationFrame(() => {
      const camBearing = q.kind === 'leftright' ? q.heading : 0;
      let framed = false;
      const frame = (items, z) => {
        framed = true;
        ctx.fit(items, z, { bearing: camBearing, duration: q.rapid ? 700 : QUESTION_MOVE_MS });
      };
      if (q.kind === 'findpt') frame([{ bbox: [R.bounds[0][0], R.bounds[0][1], R.bounds[1][0], R.bounds[1][1]] }], 9);
      else if (q.kind === 'find')
        // A short list would frame the answer itself; show the surroundings instead.
        frame([q.p.length < 8 ? aroundBox(destinationPt(m.pt, Math.random() * 360, Math.random() * 8 * SC), 15 * SC) : areaBox(q.p)], 12);
      else if (q.kind === 'sec' || q.kind === 'landmark') frame([{ bbox: countyBox[m.c] }], 12);
      else if (q.kind === 'borders') frame([m, ...q.choices], 12.5);
      else if (q.kind === 'north') frame(q.choices, 15);
      else if (q.kind === 'roadto' && !q.pending) frame([m, q.target], 12.5);
      else if (q.kind === 'crossing') frame([m, ...R.crossings.map((c) => c.pt)], 14);
      else if (q.kind === 'avedir' || q.kind === 'uptown' || q.kind === 'addr') frame([{ bbox: [R.bounds[0][0], R.bounds[0][1], R.bounds[1][0], R.bounds[1][1]] }], 13);
      else if (q.kind === 'point' && q.big) frame([aroundBox(q.from.pt, 8 * SC)], 12);
      else if (q.kind === 'point') frame([aroundBox(q.from.pt, distanceMi(q.from.pt, m.pt) * 1.3)], 13);
      else if (q.kind === 'leftright') frame([aroundBox(q.from.pt, distanceMi(q.from.pt, m.pt) * 1.2)], 13);
      else if (q.kind === 'hwydir' || q.kind === 'hwyfact') frame([{ bbox: [R.bounds[0][0], R.bounds[0][1], R.bounds[1][0], R.bounds[1][1]] }], 9);
      else if (q.kind.startsWith('trip') && q.trip) frame([{ bbox: tripBox(q.trip) }], 13);
      else if (q.kind === 'name') frame(q.group ? q.group.members : [{ bbox: countyBox[m.c] }, m], 12.5);
      else if (q.kind === 'dir') {
        const r = distanceMi(m.pt, q.b.pt) * 1.25;
        const dLat = r / 69;
        const dLon = r / (69 * Math.cos((m.pt[1] * Math.PI) / 180));
        frame([{ bbox: [m.pt[0] - dLon, m.pt[1] - dLat, m.pt[0] + dLon, m.pt[1] + dLat] }], 13);
      }
      if (!framed && Math.abs(map.getBearing() - camBearing) > 0.5) map.easeTo({ bearing: camBearing, duration: ctx.dur(QUESTION_MOVE_MS) });
    });
  }

  function feedback(ok, html) {
    if (q.rapid) return rapidResult(ok);
    if (q.today && ok) {
      const t = todayState();
      t.right++;
      store.set(TODAY_KEY, t);
    }
    score.total++;
    if (ok) {
      score.right++;
      score.streak++;
    } else score.streak = 0;
    q.answered = true;
    const qb = document.getElementById('qbody');
    // Once answered, the choices shrink so the map gets the room back
    for (const g of qb.querySelectorAll('.choices, .rose8, .lrpad')) g.classList.add('answered');
    // a dial question: shrink the dial so the answer and Next fit
    for (const d of qb.querySelectorAll('.dialwrap')) d.classList.add('answered');
    qb.insertAdjacentHTML('beforeend', `<div class="fb ${ok ? 'ok' : 'no'}">${html}</div><button class="primary" id="nextQ">Next</button>`);
    // make sure Next is in view, however long the feedback is
    requestAnimationFrame(() => {
      const sh = document.getElementById('sheet');
      sh.scrollTop = sh.scrollHeight;
    });
    document.querySelector('#sheet .score').outerHTML = header().match(/<div class="score[^"]*">.*<\/div>$/s)[0];
    document.getElementById('nextQ').addEventListener('click', next);
    ctx.updateEdges();
  }

  function answer(btn) {
    if (q.answered) return;
    const m = q.m;
    for (const b of document.querySelectorAll('#qbody .choice')) b.disabled = true;
    if (q.kind === 'name') {
      const pickd = munis[+btn.dataset.id];
      const ok = pickd === m;
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-id="${m.id}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      const items = [{ m, color: L.good, label: m.mapLabel }];
      let html = ok ? `✓ <b>${esc(m.n)}</b> — ${esc(ctx.sub(m))}.` : `✗ It's <b>${esc(ctx.name(m))}</b> — ${esc(ctx.sub(m))}.`;
      if (!ok) {
        ctx.highlight(pickd.id, 'bad');
        items.push({ m: pickd, color: L.bad });
        html += ` ${esc(pickd.n)} is ${ctx.relative(m.pt, pickd.pt).text} of here, in ${esc(ctx.groupName(pickd.c))}.`;
        ctx.line([m.pt, pickd.pt]);
      }
      if (q.group) {
        html += contrast(q.group, m);
        q.group.members.forEach((o) => o !== m && o !== pickd && items.push({ m: o, color: L.neutral }));
      }
      ctx.reveal(items);
      feedback(ok, html);
      ctx.fit(q.group ? q.group.members : ok ? [{ bbox: countyBox[m.c] }] : [m, pickd], 12);
    } else if (q.kind === 'borders') {
      const pickd = munis[+btn.dataset.id];
      const ok = pickd === q.right;
      record(q.right, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-id="${q.right.id}"]`).classList.add('right');
      // Show the whole ring of neighbors so the answer sits in context.
      for (const o of m.neighbors) ctx.highlight(o.id, 'near');
      ctx.highlight(q.right.id, 'good');
      const items = [{ m, color: L.q }, ...m.neighbors.map((o) => ({ m: o, color: o === q.right ? L.good : L.neutral, key: o !== q.right && m.neighbors.length <= 4 }))];
      // (with only a few neighbors, each gets a dot and a full-size name, so
      // a real neighbor never looks smaller than the wrong pick)
      const side = compass8(bearing(m.pt, q.right.pt));
      let html = `${ok ? '✓' : '✗'} <b>${esc(q.right.n)}</b> borders ${esc(m.n)} (${side}).`;
      if (!ok) {
        ctx.highlight(pickd.id, 'bad');
        items.push({ m: pickd, color: L.bad });
        // A town entirely inside another (Sussex inside Wantage) looks, at this
        // zoom, like the bigger town around it: say so.
        const host = pickd.enclosedBy;
        if (host)
          html += ` ${esc(pickd.n)} doesn't: it's a small ${esc(pickd.t.toLowerCase())} entirely surrounded by <b>${esc(host.n)}</b>${
            host === m ? '' : m.neighbors.includes(host) ? `, and it's ${esc(host.n)} that borders ${esc(m.n)}` : `, ${ctx.relative(m.pt, pickd.pt).text} of ${esc(m.n)}`
          }.`;
        else html += ` ${esc(pickd.n)} doesn't; it's ${ctx.relative(m.pt, pickd.pt).text} of ${esc(m.n)}.`;
      }
      const ring = m.neighbors.map((o) => ctx.name(o));
      html +=
        ring.length <= 8
          ? ` <span class="muted">${esc(m.n)}'s neighbors: ${esc(ring.join(', '))}.</span>`
          : ` <span class="muted">All ${ring.length} neighbors are shaded on the map.</span>`;
      ctx.reveal(items);
      feedback(ok, html);
      ctx.fit([m, ...m.neighbors, pickd], 13);
    } else if (q.kind === 'landmark') {
      const pickd = munis[+btn.dataset.id];
      const ok = pickd === m;
      const l = q.landmark;
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-id="${m.id}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      const items = [{ m, color: L.good }, { m, pt: l.pt, label: l.name, color: L.place, key: true }];
      let html = `${ok ? '✓' : '✗'} <b>${esc(l.name)}</b> (${esc(l.kind.toLowerCase())}) is in <b>${esc(m.full)}</b>, ${esc(ctx.groupName(m.c))}.`;
      if (!ok) {
        ctx.highlight(pickd.id, 'bad');
        items.push({ m: pickd, color: L.bad });
        html += ` ${esc(pickd.n)} is ${ctx.relative(l.pt, pickd.pt).text} of it.`;
      }
      ctx.reveal(items);
      feedback(ok, html);
      ctx.fit(ok ? [m] : [m, pickd], 13);
    } else if (q.kind === 'leftright') {
      const ok = btn.dataset.v === q.side;
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-v="${q.side}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      ctx.reveal([{ m: q.from, color: L.q }, { m, color: L.good }]);
      ctx.line([q.from.pt, m.pt]);
      const rel = ctx.relative(q.from.pt, m.pt);
      const sideWord = { ahead: 'ahead of you', behind: 'behind you', left: 'on your left', right: 'on your right' }[q.side];
      const lr = `facing ${dirWord(compass8(q.heading))}, your left is ${dirWord(compass8(q.heading - 90))} and your right is ${dirWord(compass8(q.heading + 90))}`;
      feedback(ok, `${ok ? '✓' : '✗'} <b>${esc(ctx.name(m))}</b> is ${sideWord}: it's ${rel.text} of ${esc(q.from.n)}, and ${lr}.`);
      ctx.fit([q.from, m], 13);
    } else if (q.kind === 'hwyfact' && q.sub === 'cross') {
      const pickd = munis[+btn.dataset.id];
      const ok = pickd === m;
      record({ key: q.key }, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-id="${m.id}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      if (!ok) ctx.highlight(pickd.id, 'bad');
      ctx.reveal([{ m, color: L.good }, ...(ok ? [] : [{ m: pickd, color: L.bad }])]);
      const ha = ctx.hwy(q.j.a);
      feedback(ok, `${ok ? '✓' : '✗'} They meet in <b>${esc(m.full)}</b>, ${esc(ctx.groupName(m.c))}.${ha && q.j.b === 'Turnpike' && q.j.a === 'Parkway' ? `<div class="note">${esc(ha.note)}</div>` : ''}`);
      ctx.fit(ok ? [m] : [m, pickd], 11);
    } else if (q.kind === 'hwyfact') {
      const chosen = q.choices[+btn.dataset.v];
      const ok = chosen === q.e;
      record(q.m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-v="${q.choices.indexOf(q.e)}"]`).classList.add('right');
      ctx.focusHighway(q.h);
      ctx.reveal(q.h.ends.map((e) => ({ m: null, pt: e.pt, label: e.name.replace(/^the /, ''), color: e === q.e ? L.good : L.neutral, key: e === q.e })));
      const other = q.h.ends.find((e) => e !== q.e);
      feedback(ok, `${ok ? '✓' : '✗'} ${esc(TheHwy(q.h.label))} ends in the ${q.e.side} at <b>${esc(q.e.name)}</b>; its ${other.side} end is ${esc(other.name)}. It runs ${esc(q.h.runs)}.`);
      ctx.fit(q.h.ends.map((e) => e.pt), 11);
    } else if (q.kind === 'roadto') {
      const chosen = q.choices[+btn.dataset.v];
      const ok = chosen === q.right;
      record(q.target, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-v="${q.choices.indexOf(q.right)}"]`).classList.add('right');
      ctx.showRoadRefs(true);
      ctx.focusRoad(q.right.label, ctx.theme.hl.good);
      if (!ok) ctx.focusRoadBad(chosen.label);
      ctx.highlight(q.target.id, 'good');
      // the towns along the right road, on the target's side
      const toward = q.right.towns.filter((t) => Math.abs(angleDiff(bearing(m.pt, t.m.pt), bearing(m.pt, q.target.pt))) <= 60 && t.d <= q.tgt.d + 0.05 * SC);
      let html = `${ok ? '✓' : '✗'} <b>${esc(q.right.label)}</b> runs from ${esc(m.n)} ${dirWord(compass8(bearing(m.pt, q.target.pt)))}: ${esc(
        toward.map((t) => t.m.n).join(' → ')
      )}.`;
      if (!ok) {
        const other = chosen.towns.slice(0, 5).map((t) => `${t.m.n} (${t.dir})`).join(', ');
        html += ` ${esc(chosen.label)} goes to ${esc(other)}.`;
      }
      ctx.reveal([{ m, color: L.q }, ...toward.map((t) => ({ m: t.m, color: t.m === q.target ? L.good : L.neutral }))]);
      feedback(ok, html);
      ctx.fit([m, q.target], 12.5);
    } else if (q.kind === 'addr') {
      const ok = btn.dataset.v === String(q.right);
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-v="${q.right}"]`).classList.add('right');
      const how = q.mode === 'ave'
        ? `<b>${esc(q.addr)}</b> is between <b>${ordn(q.right)} and ${ordn(q.right + 1)} Ave</b>. The trick: Fifth Ave is the zero point on the west side, so the hundreds digit (${q.hundreds}${q.hundreds === 0 ? ', as it has only two digits' : ''}) + 5 = ${q.right}: the nearer avenue is ${ordn(q.right)}.`
        : `<b>${esc(q.addr)}</b> is on the <b>${q.right} side</b>: odd numbers are on the north side of a crosstown street, even numbers on the south.`;
      feedback(ok, `${ok ? '✓' : '✗'} ${how}`);
    } else if (q.kind === 'avedir') {
      const ok = btn.dataset.v === q.dir;
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-v="${q.dir}"]`).classList.add('right');
      const said = q.dir === 'two-way' ? 'both ways' : q.dir;
      feedback(ok, `${ok ? '✓' : '✗'} <b>${esc(q.name)}</b> runs <b>${said}</b>.<details class="more"><summary>The pattern</summary><div class="note">${esc(R.avenueNote)}</div></details>`);
    } else if (q.kind === 'crossing') {
      const ok = +btn.dataset.v === q.right;
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-v="${q.right}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      const best = R.crossings[q.right];
      ctx.reveal([{ m, color: L.good }, ...R.crossings.map((c, i) => ({ m, pt: c.pt, label: c.short, color: i === q.right ? L.good : L.neutral }))]);
      ctx.line([best.pt, m.pt]);
      const list = q.ds.map((x) => `${x.c.short} ${x.d.toFixed(1)} mi`).join(' · ');
      feedback(ok, `${ok ? '✓' : '✗'} The <b>${esc(best.name)}</b>. Distances to ${esc(m.n)}: ${list}.<div class="note">${esc(best.note)}</div>`);
      ctx.fit([m, ...R.crossings.map((c) => c.pt)], 14);
    } else if (q.kind === 'north') {
      const pickd = munis[+btn.dataset.id];
      const ok = pickd === m;
      const word = q.axis === 'N' ? 'north' : q.axis === 'U' ? 'uptown' : 'east';
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-id="${m.id}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      ctx.highlight(q.other.id, 'near');
      ctx.reveal([
        { m, color: L.good },
        { m: q.other, color: L.neutral },
      ]);
      // Draw the line of latitude (or longitude) through the farther one.
      const o = q.other.pt;
      if (q.axis !== 'U') ctx.line(q.axis === 'N' ? [[o[0] - 0.08, m.pt[1]], [o[0] + 0.08, m.pt[1]]] : [[m.pt[0], o[1] - 0.06], [m.pt[0], o[1] + 0.06]]);
      let html = `${ok ? '✓' : '✗'} <b>${esc(m.n)}</b> is ${q.diff.toFixed(1)} mi farther ${word} than ${esc(q.other.n)}.`;
      if (q.tricky)
        html += `<div class="note">The trap: ${esc(ctx.groupName(q.other.c))} as a whole sits farther ${word} than ${esc(ctx.groupName(m.c))}, but these two don't follow their ${esc(ctx.region.groupPlural.toLowerCase())}.</div>`;
      feedback(ok, html);
      ctx.fit(q.choices, 15);
    } else if (q.kind === 'triphead') {
      const brg = q.heading;
      const diff = Math.abs(angleDiff(DIR_DEG[btn.dataset.dir], brg));
      const ok = diff <= 22.5;
      record(m, ok);
      btn.classList.add(ok ? 'right' : diff <= 67.5 ? 'close' : 'wrong');
      document.querySelector(`#qbody .dir[data-dir="${compass8(brg)}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      feedback(ok, `${ok ? '✓' : '✗'} You entered <b>${esc(m.n)}</b> heading <b>${dirWord(compass16(brg))}</b>.`);
    } else if (q.kind === 'tripnext') {
      const pickd = munis[+btn.dataset.id];
      const ok = pickd === m;
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-id="${m.id}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      if (!ok) ctx.highlight(pickd.id, 'bad');
      ctx.reveal([
        { m: q.from, color: L.q },
        { m, color: L.good },
        ...(ok ? [] : [{ m: pickd, color: L.bad }]),
      ]);
      const dir = compass8(bearing(q.from.pt, m.pt));
      feedback(ok, `${ok ? '✓' : '✗'} After ${esc(q.from.n)} you went into <b>${esc(m.n)}</b>, to its ${dir}.`);
    } else if (q.kind === 'sec') {
      const pickd = munis[+btn.dataset.id];
      const ok = pickd === m;
      const name = q.section.name;
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-id="${m.id}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      const items = [{ m, color: L.good }];
      const placed = ctx.placedSections(m).get(name.toLowerCase());
      if (placed) items.push({ m, pt: placed.pt, label: name, color: L.place, key: true });
      let html = `${ok ? '✓' : '✗'} <b>${esc(name)}</b> is part of <b>${esc(m.full)}</b>, ${esc(ctx.groupName(m.c))}.`;
      if (!ok) {
        ctx.highlight(pickd.id, 'bad');
        items.push({ m: pickd, color: L.bad });
        html += ` ${esc(m.n)} is ${ctx.relative(pickd.pt, m.pt).text} of ${esc(pickd.n)}.`;
      }
      const siblings = m.sections.filter((x) => x.known && x.name !== name).map((x) => x.name);
      if (siblings.length) html += `<div class="note">Also in ${esc(m.n)}: ${esc(siblings.slice(0, 6).join(', '))}</div>`;
      ctx.reveal(items);
      feedback(ok, html);
      ctx.fit(ok ? [m] : [m, pickd], 13);
    } else if (q.kind === 'dir') {
      const b = q.b;
      const brg = bearing(m.pt, b.pt);
      const diff = Math.abs(angleDiff(DIR_DEG[btn.dataset.dir], brg));
      const ok = diff <= 22.5;
      const close = !ok && diff <= 67.5;
      record(b, ok);
      btn.classList.add(ok ? 'right' : close ? 'close' : 'wrong');
      document.querySelector(`#qbody .dir[data-dir="${compass8(brg)}"]`).classList.add('right');
      ctx.highlight(b.id, 'good');
      ctx.reveal([
        { m, color: L.q },
        { m: b, color: L.good },
      ]);
      ctx.line([m.pt, b.pt]);
      const rel = ctx.relative(m.pt, b.pt);
      feedback(
        ok,
        `${ok ? '✓' : close ? '≈ Close.' : '✗'} <b>${esc(b.n)}</b> is <b>${rel.d < 10 ? rel.d.toFixed(1) : Math.round(rel.d)} mi ${dirWord(compass16(brg))}</b> (${Math.round(brg)}°) of ${esc(m.n)}. ${esc(b.n)}: ${esc(ctx.sub(b))}.`
      );
      ctx.fit([m, b], 12);
    }
  }

  function aroundBox(pt, r) {
    const dLat = r / 69;
    const dLon = r / (69 * Math.cos((pt[1] * Math.PI) / 180));
    return { bbox: [pt[0] - dLon, pt[1] - dLat, pt[0] + dLon, pt[1] + dLat] };
  }
  function tripBox(trip) {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of trip.pts) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
    return b;
  }
  function showTripLine(trip) {
    ctx.trip(trip.pts.length > 1 ? trip.pts : null);
  }

  // ---- pointing dial ------------------------------------------------------------
  function dialSVG() {
    const ticks = Array.from({ length: 16 }, (_, i) => {
      const a = (i * 22.5 * Math.PI) / 180;
      const r1 = i % 4 === 0 ? 74 : 80;
      return `<line x1="${Math.sin(a) * r1}" y1="${-Math.cos(a) * r1}" x2="${Math.sin(a) * 88}" y2="${-Math.cos(a) * 88}" />`;
    }).join('');
    return `<div class="dialwrap"><svg id="dial" viewBox="-100 -100 200 200" role="slider" aria-label="Direction" aria-valuemin="0" aria-valuemax="359" tabindex="0">
      <circle r="92" class="dial-face" />
      <g class="dial-ticks">${ticks}</g>
      <text y="-56" class="dial-n">N</text><text x="60" y="5" class="dial-l">E</text><text y="66" class="dial-l">S</text><text x="-60" y="5" class="dial-l">W</text>
      <g id="needle" style="display:none"><line y1="0" y2="-82" class="dial-needle" /><circle r="5" class="dial-hub" /></g>
      <g id="truth" style="display:none"><line y1="0" y2="-82" class="dial-truth" /></g>
    </svg><div class="dial-read" id="dialRead">Drag toward the town</div></div>`;
  }
  function bindDial() {
    const svg = document.getElementById('dial');
    const set = (e) => {
      if (q.answered) return;
      const r = svg.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(x, y) < 8) return;
      q.angle = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
      const n = document.getElementById('needle');
      n.style.display = '';
      n.setAttribute('transform', `rotate(${q.angle})`);
      document.getElementById('dialRead').textContent = `${Math.round(q.angle)}° · ${compass16(q.angle)}`;
      document.getElementById('lockIn').disabled = false;
    };
    let down = false;
    svg.addEventListener('pointerdown', (e) => {
      down = true;
      svg.setPointerCapture(e.pointerId);
      set(e);
    });
    svg.addEventListener('pointermove', (e) => down && set(e));
    svg.addEventListener('pointerup', () => (down = false));
    svg.addEventListener('keydown', (e) => {
      if (q.answered || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const r = svg.getBoundingClientRect();
      const a = (((q.angle ?? 0) + (e.key === 'ArrowRight' ? 5 : -5)) * Math.PI) / 180;
      set({ clientX: r.left + r.width / 2 + Math.sin(a) * 50, clientY: r.top + r.height / 2 - Math.cos(a) * 50 });
    });
    document.getElementById('lockIn').addEventListener('click', answerPoint);
  }
  function answerPoint() {
    if (q.answered || q.angle == null) return;
    if (q.kind === 'uptown') return answerUptown();
    if (q.kind === 'hwydir') return answerHwyDir();
    const m = q.m;
    const truth = bearing(q.from.pt, m.pt);
    const err = Math.abs(angleDiff(q.angle, truth));
    const ok = err <= 22.5;
    record(m, ok);
    const t = document.getElementById('truth');
    t.style.display = '';
    t.setAttribute('transform', `rotate(${truth})`);
    document.getElementById('lockIn').remove();
    if (!q.big) ctx.highlight(m.id, 'good');
    ctx.reveal([
      ...(q.from.you ? [] : [{ m, pt: q.from.pt, label: q.from.name, color: L.q }]),
      q.big ? { m: null, pt: m.pt, label: m.n, color: L.good } : { m, color: L.good },
    ]);
    const d = distanceMi(q.from.pt, m.pt);
    ctx.lines([
      { coords: [q.from.pt, m.pt] },
      { coords: [q.from.pt, destinationPt(q.from.pt, q.angle, d)], color: ctx.theme.ink4 },
    ]);
    const from = q.from.you ? 'you' : q.from.name;
    feedback(
      ok,
      `${ok ? '✓' : err <= 45 ? '≈' : '✗'} You were <b>${Math.round(err)}°</b> off. <b>${esc(m.n)}</b> is ${d < 10 ? d.toFixed(1) : Math.round(d)} mi <b>${dirWord(compass16(truth))}</b> (${Math.round(truth)}°) of ${esc(from)}.${q.nat ? `<details class="more"><summary>About it</summary><div class="note">${esc(q.nat.note)}</div></details>` : ''}`
    );
    ctx.fit([q.big ? m.pt : m, q.from.pt], 12);
  }

  function answerHwyDir() {
    const h = q.h;
    const [a, b] = h.ends.map((e) => e.pt);
    const axis = bearing(a, b);
    // pointing toward either end counts
    const err = Math.min(Math.abs(angleDiff(q.angle, axis)), Math.abs(angleDiff(q.angle, axis + 180)));
    const ok = err <= 20;
    record(q.m, ok);
    const t = document.getElementById('truth');
    t.style.display = '';
    t.setAttribute('transform', `rotate(${Math.abs(angleDiff(q.angle, axis)) <= 90 ? axis : axis + 180})`);
    document.getElementById('lockIn').remove();
    ctx.focusHighway(h);
    ctx.reveal(h.ends.map((e) => ({ m: null, pt: e.pt, label: e.name.replace(/^the /, ''), color: L.neutral, key: true })));
    feedback(
      ok,
      `${ok ? '✓' : '✗'} You were <b>${Math.round(err)}°</b> off. ${ctx.swatch(h.label)}${esc(TheHwy(h.label))} runs ${esc(h.runs)}, from ${esc(h.ends[0].name)} to ${esc(h.ends[1].name)}.`
    );
    ctx.fit([a, b], 11);
  }

  function answerFindPt(tap) {
    const n = q.n;
    const d = distanceMi(tap, n.pt);
    const ok = d <= n.r;
    record(q.m, ok);
    ctx.reveal([
      { m: null, pt: n.pt, label: n.name, color: L.good, key: true },
      ...(ok ? [] : [{ m: null, pt: tap, label: 'your tap', color: L.bad }]),
    ]);
    if (!ok) ctx.line([tap, n.pt]);
    const rel = ctx.relative(tap, n.pt);
    feedback(
      ok,
      `${ok ? '✓' : '✗'} ${ok ? `Within ${d.toFixed(1)} mi.` : `${esc(n.name)} is <b>${rel.text}</b> of your tap.`}<details class="more"${ok ? '' : ' open'}><summary>About it</summary><div class="note">${esc(n.note)}</div></details>`
    );
    ctx.fit(ok ? [{ bbox: [n.pt[0] - 0.15, n.pt[1] - 0.1, n.pt[0] + 0.15, n.pt[1] + 0.1] }] : [tap, n.pt], 11);
  }

  function answerUptown() {
    const truth = R.gridAngle;
    const err = Math.abs(angleDiff(q.angle, truth));
    const ok = err <= 12;
    record(q.m, ok);
    const t = document.getElementById('truth');
    t.style.display = '';
    t.setAttribute('transform', `rotate(${truth})`);
    document.getElementById('lockIn').remove();
    feedback(
      ok,
      `${ok ? '✓' : '✗'} You were <b>${Math.round(err)}°</b> off. Uptown is about <b>${truth}° east of true north</b> (roughly NNE): the whole street grid is turned that much. So "north" on your phone's compass is not quite "uptown".`
    );
  }

  function contrast(g, m) {
    const rows = g.members
      .map((o) => `<li><b>${esc(ctx.name(o))}</b> — ${esc(o.c)} Co.${o !== m ? `, ${ctx.relative(m.pt, o.pt).text} of ${esc(m.n)}` : ''}</li>`)
      .join('');
    return `<ul class="contrast">${rows}</ul>${g.note ? `<div class="note">${esc(g.note)}</div>` : ''}`;
  }

  // Map taps answer "find it" questions.
  map.on('click', (e) => {
    if (ctx.mode !== 'practice' || e.handledByAnchor || !q || q.answered) return;
    if (q.kind === 'findpt') return answerFindPt([e.lngLat.lng, e.lngLat.lat]);
    if (q.kind !== 'find') return;
    const m = q.m;
    const t = ctx.locate([e.lngLat.lng, e.lngLat.lat]);
    const ok = t === m;
    record(m, ok);
    ctx.highlight(m.id, 'good');
    const items = [{ m, color: L.good }];
    let html;
    let frame;
    if (ok) {
      html = `✓ <b>${esc(m.n)}</b> — ${esc(ctx.sub(m))}.`;
      frame = [{ bbox: countyBox[m.c] }];
    } else {
      const tapped = [e.lngLat.lng, e.lngLat.lat];
      const rel = ctx.relative(t ? t.pt : tapped, m.pt);
      if (t) {
        ctx.highlight(t.id, 'bad');
        items.push({ m: t, color: L.bad });
      }
      html = `✗ ${t ? `That's <b>${esc(ctx.name(t))}</b>${t.dup ? '' : ` (${esc(t.c)} Co.)`}` : "That's outside NJ"}. <b>${esc(m.n)}</b> is <b>${rel.text}</b> of there — ${esc(ctx.sub(m))}.`;
      ctx.line([t ? t.pt : tapped, m.pt]);
      frame = t ? [t, m] : [tapped, m];
    }
    ctx.reveal(items);
    feedback(ok, html);
    ctx.fit(frame, 12);
  });

  return {
    enter() {
      ctx.clearHighlights();
      // Easy to come back to: once a day, Practice opens on Today until it's done
      const offered = store.get('todayOffered', '');
      if (offered !== dayStr() && !todayState().done && cfg.type !== 'today') {
        store.set('todayOffered', dayStr());
        cfg.type = 'today';
        store.set(CFG_KEY, cfg);
        q = null;
        return next();
      }
      if (q && !q.answered && !q.rapid && q.kind !== 'gridgame' && q.kind !== 'frames' && q.kind !== 'rapidend') show();
      else next();
    },
    leave() {
      stopRapidTimer();
      rapid.on = false;
      ctx.gridgame.stop();
      ctx.gridmid.stop();
      ctx.gridup.stop();
      ctx.gridclassic.stop();
      ctx.orbit?.stop();
      ctx.frames.stop();
      ctx.clearHighlights();
      ctx.reveal([]);
      ctx.line(null);
      ctx.trip(null);
      ctx.showRoadRefs(true);
      ctx.focusRoad(null);
      ctx.showLabels(true);
    },
  };
}
