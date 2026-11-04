import { bearing, distanceMi, compass8, compass16, angleDiff, dirWord, destination as destinationPt } from './geo.js';
import { gridY } from './grid.js';
import { roadsFrom } from './roads.js';

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
  crossing: 'Which crossing lands closest?',
  uptown: 'Point uptown',
  roadto: 'Which road gets you there?',
  trip: 'My last drive',
};
const WEIGHT = { find: 2, dir: 2, borders: 2, north: 2, point: 2, roadto: 3 };
const DIR8 = ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'];
const DIR_DEG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export function initPractice(ctx) {
  const { map, store, munis } = ctx;
  const R = ctx.region;
  L = ctx.theme.label;
  const CFG_KEY = R.id === 'nj' ? 'practice' : `practice.${R.id}`;
  const cfg = { type: 'mix', area: R.wellKnown ? 'known' : 'all', ...store.get(CFG_KEY, {}) };
  const SC = R.gridAngle ? 0.12 : 1; // Manhattan distances are short
  const allowed = ['mix', ...R.quizTypes, 'trip'];
  if (!allowed.includes(cfg.type)) cfg.type = 'mix';
  const score = { right: 0, total: 0, streak: 0 };
  let q = null;
  const recent = [];
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
      s[m.key] = { b, due: now + DAYS[b] * DAY };
    } else s[m.key] = { b: 0, due: now + 10 * 60e3 };
    store.set('srs', s);
    ctx.setKnow(m);
  }
  function dueCount(p) {
    const s = srs();
    const now = Date.now();
    return p.filter((m) => s[m.key] && s[m.key].due <= now).length;
  }
  function pick(p) {
    const s = srs();
    const now = Date.now();
    const ws = p.map((m) => {
      if (recent.includes(m.id)) return 0;
      const r = s[m.key];
      if (!r) return 1; // new
      if (r.due <= now) return 4 + Math.min(3, (now - r.due) / DAY); // due (more overdue = sooner)
      return 0.08; // learned and not due: rare
    });
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
    const right = rand(m.neighbors);
    const touching = new Set([m.id, ...m.neighbors.map((o) => o.id)]);
    const ring2 = [...new Set(m.neighbors.flatMap((o) => o.neighbors))].filter((o) => !touching.has(o.id));
    const wrong = ring2.sort((a, b) => distanceMi(m.pt, a.pt) - distanceMi(m.pt, b.pt)).slice(0, 6);
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
  function buildRoadTo(token) {
    if (q !== token) return;
    const A = q.m;
    const roads = roadsFrom(map, A, ctx.locate, 12 * SC).slice(0, 5);
    // A target only one of the roads reaches, not right next door
    const counts = new Map();
    for (const r of roads) for (const t of r.towns) counts.set(t.m.id, (counts.get(t.m.id) || 0) + 1);
    const opts = [];
    for (const r of roads)
      for (const t of r.towns)
        if (counts.get(t.m.id) === 1 && t.d >= 2.5 * SC && !A.neighbors.includes(t.m)) opts.push({ r, t, w: t.m.wellKnown ? 3 : 1 });
    if (roads.length < 2 || !opts.length) {
      if (++q.tries < 4) {
        q.m = pick(q.p);
        return show();
      }
      q = makeBorders(q.p);
      q.p = token.p;
      q.answered = false;
      ctx.toast('No road question here. Asking another kind.');
      return show();
    }
    const tot = opts.reduce((a, o) => a + o.w, 0);
    let x = Math.random() * tot;
    const o = opts.find((y) => (x -= y.w) <= 0) || opts[0];
    Object.assign(q, { pending: false, roads, right: o.r, target: o.t.m, tgt: o.t, choices: shuffle(roads.slice(0, 4)) });
    if (!q.choices.includes(o.r)) q.choices[0] = o.r;
    show();
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
      const m = pick(p);
      from = { name: m.n, pt: m.pt, m };
    }
    const near = (list) => list.filter((o) => o !== from.m && distanceMi(from.pt, o.pt) > 3 * SC && distanceMi(from.pt, o.pt) < 30 * SC);
    const cands = near(p).length ? near(p) : near(munis);
    const m = cands.length ? pick(cands) : rand(munis);
    return { kind: 'point', m, from, angle: null };
  }

  /** Recap of your most recent drive, then questions about it. */
  function makeTrip() {
    const trip = ctx.modes.drive.trips().filter((t) => t.towns.length >= 2).pop();
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
    q = {
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
      crossing: makeCrossing,
      uptown: makeUptown,
      roadto: makeRoadTo,
    }[t](p);
    q.p = p;
    q.answered = false;
    show();
  }

  // ---- rendering ------------------------------------------------------------
  function header() {
    const opts = (o) =>
      Object.entries(o)
        .map(([k, v]) => `<option value="${k}"${cfg.type === k ? ' selected' : ''}>${v}</option>`)
        .join('');
    const nVisited = Object.keys(ctx.modes.drive.visited).length;
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
    return `<div class="prow">
        <select id="qType" aria-label="Question type">${opts(Object.fromEntries(allowed.map((k) => [k, TYPES[k]])))}</select>
        <select id="qArea" aria-label="Area">${area}</select>
      </div>
      <div class="score">${due ? `<span class="due">${due} due for review</span> · ` : ''}${score.right}/${score.total}${score.total ? ` · ${pct}%` : ''}${score.streak > 1 ? ` · streak ${score.streak}` : ''}</div>`;
  }

  function bindHeader() {
    document.getElementById('qType').addEventListener('change', (e) => {
      cfg.type = e.target.value;
      store.set(CFG_KEY, cfg);
      next();
    });
    document.getElementById('qArea').addEventListener('change', (e) => {
      cfg.area = e.target.value;
      store.set(CFG_KEY, cfg);
      if (cfg.area === 'visited' && Object.keys(ctx.modes.drive.visited).length < 4)
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

  function prompt(m) {
    return `<b>${esc(m.n)}</b>${m.dup ? ` <span class="muted">${esc(m.t)}, ${esc(m.c)} Co.</span>` : ''}`;
  }

  function show() {
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    ctx.trip(null);
    ctx.focusRoad(null);
    ctx.showLabels(false);
    ctx.showRoadRefs(q.kind !== 'roadto');
    const m = q.m;
    let body = '';
    if (q.kind === 'find') {
      ctx.hud(`<div class="qkind">Find it</div><div class="q">Tap ${prompt(m)}</div>`);
      body = `<div class="hint muted">Tap the map. Pinch to zoom if you need to.</div>`;
    } else if (q.kind === 'name') {
      ctx.highlight(m.id, 'q');
      ctx.hud(`<div class="qkind">${q.group ? 'Sound-alikes' : 'Name it'}</div><div class="q">Which town is highlighted?</div>`);
      body = `<div class="choices">${q.choices.map((o) => `<button class="choice" data-id="${o.id}">${esc(ctx.name(o))}</button>`).join('')}</div>`;
    } else if (q.kind === 'borders') {
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: L.q }]);
      ctx.hud(`<div class="qkind">Borders</div><div class="q">Which of these borders ${prompt(m)}?</div>`);
      body = `<div class="choices">${q.choices.map((o) => `<button class="choice" data-id="${o.id}">${esc(ctx.name(o))}</button>`).join('')}</div>`;
    } else if (q.kind === 'landmark') {
      ctx.hud(`<div class="qkind">Landmarks</div><div class="q"><b>${esc(q.landmark.name)}</b> is in which ${R.unit}?</div>`);
      body = `<div class="choices">${q.choices.map((o) => `<button class="choice" data-id="${o.id}">${esc(ctx.name(o))}</button>`).join('')}</div>`;
    } else if (q.kind === 'roadto' && q.pending) {
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: L.q }]);
      ctx.hud(`<div class="qkind">Roads</div><div class="q">Finding the roads around ${prompt(m)}…</div>`);
      body = `<div class="hint muted">Reading the road map for this area.</div>`;
      const token = q;
      requestAnimationFrame(() => {
        ctx.fit([aroundBox(m.pt, 9 * SC)], 11.5);
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
      body = `<div class="choices">${q.choices.map((r, i) => `<button class="choice" data-v="${i}">${esc(r.label)}</button>`).join('')}</div>`;
    } else if (q.kind === 'avedir') {
      ctx.hud(`<div class="qkind">Avenues</div><div class="q">Which way does <b>${esc(q.name)}</b> run?</div>`);
      body = `<div class="choices three">${['uptown', 'downtown', 'two-way']
        .map((v) => `<button class="choice" data-v="${v}">${v === 'two-way' ? 'Both ways' : v[0].toUpperCase() + v.slice(1)}</button>`)
        .join('')}</div>`;
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
      body = `<div class="choices">${q.choices.map((o) => `<button class="choice" data-id="${o.id}">${esc(ctx.name(o))}</button>`).join('')}</div>`;
    } else if (q.kind === 'point') {
      const from = q.from.you ? 'where you are' : `<b>${esc(q.from.name)}</b>`;
      if (!q.from.you) ctx.reveal([{ m: q.m, pt: q.from.pt, label: q.from.name, color: L.q }]);
      ctx.hud(`<div class="qkind">Point to it</div><div class="q">From ${from}, point to ${prompt(q.m)}</div>`);
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
      body = `<div class="choices">${q.choices.map((o) => `<button class="choice" data-id="${o.id}">${esc(ctx.name(o))}</button>`).join('')}</div>`;
    } else if (q.kind === 'triphead') {
      showTripLine(q.trip);
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: L.q }]);
      ctx.hud(`<div class="qkind">My last drive</div><div class="q">Which way were you heading when you entered ${prompt(m)}?</div>`);
      body = `<div class="rose8">${DIR8.map((d) => (d ? `<button class="choice dir" data-dir="${d}">${d}</button>` : '<span></span>')).join('')}</div>`;
    } else if (q.kind === 'sec') {
      ctx.hud(`<div class="qkind">Villages &amp; sections</div><div class="q"><b>${esc(q.section.name)}</b> is part of which town?</div>`);
      body = `<div class="choices">${q.choices.map((o) => `<button class="choice" data-id="${o.id}">${esc(ctx.name(o))}</button>`).join('')}</div>`;
    } else if (q.kind === 'dir') {
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: L.q }]);
      ctx.hud(`<div class="qkind">Which way?</div><div class="q">From ${prompt(m)}, which way is ${prompt(q.b)}?</div>`);
      body = `<div class="rose8">${DIR8.map((d) => (d ? `<button class="choice dir" data-dir="${d}">${d}</button>` : '<span></span>')).join('')}</div>`;
    }
    ctx.sheet(`${header()}<div id="qbody">${body}</div>`);
    bindHeader();
    for (const b of document.querySelectorAll('#qbody .choice')) b.addEventListener('click', () => answer(b));
    if (q.kind === 'point' || q.kind === 'uptown') bindDial();
    const tq = document.getElementById('tripQuiz');
    if (tq) tq.addEventListener('click', next);

    // Frame the question without giving it away.
    requestAnimationFrame(() => {
      if (q.kind === 'find')
        // A short list would frame the answer itself; show the surroundings instead.
        ctx.fit([q.p.length < 8 ? aroundBox(destinationPt(m.pt, Math.random() * 360, Math.random() * 8 * SC), 15 * SC) : areaBox(q.p)], 12);
      else if (q.kind === 'sec' || q.kind === 'landmark') ctx.fit([{ bbox: countyBox[m.c] }], 12);
      else if (q.kind === 'borders') ctx.fit([m, ...q.choices], 12.5);
      else if (q.kind === 'north') ctx.fit(q.choices, 15);
      else if (q.kind === 'roadto' && !q.pending) ctx.fit([m, q.target], 12.5);
      else if (q.kind === 'crossing') ctx.fit([m, ...R.crossings.map((c) => c.pt)], 14);
      else if (q.kind === 'avedir' || q.kind === 'uptown') ctx.fit([{ bbox: [R.bounds[0][0], R.bounds[0][1], R.bounds[1][0], R.bounds[1][1]] }], 13);
      else if (q.kind === 'point') ctx.fit([aroundBox(q.from.pt, distanceMi(q.from.pt, m.pt) * 1.3)], 13);
      else if (q.kind.startsWith('trip') && q.trip) ctx.fit([{ bbox: tripBox(q.trip) }], 13);
      else if (q.kind === 'name') ctx.fit(q.group ? q.group.members : [{ bbox: countyBox[m.c] }, m], 12.5);
      else if (q.kind === 'dir') {
        const r = distanceMi(m.pt, q.b.pt) * 1.25;
        const dLat = r / 69;
        const dLon = r / (69 * Math.cos((m.pt[1] * Math.PI) / 180));
        ctx.fit([{ bbox: [m.pt[0] - dLon, m.pt[1] - dLat, m.pt[0] + dLon, m.pt[1] + dLat] }], 13);
      }
    });
  }

  function feedback(ok, html) {
    score.total++;
    if (ok) {
      score.right++;
      score.streak++;
    } else score.streak = 0;
    q.answered = true;
    const qb = document.getElementById('qbody');
    qb.insertAdjacentHTML('beforeend', `<div class="fb ${ok ? 'ok' : 'no'}">${html}</div><button class="primary" id="nextQ">Next</button>`);
    document.querySelector('#sheet .score').outerHTML = header().match(/<div class="score">.*<\/div>$/s)[0];
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
      const items = [{ m, color: L.q }, ...m.neighbors.map((o) => ({ m: o, color: o === q.right ? L.good : L.neutral }))];
      const side = compass8(bearing(m.pt, q.right.pt));
      let html = `${ok ? '✓' : '✗'} <b>${esc(q.right.n)}</b> borders ${esc(m.n)} on the ${side}.`;
      if (!ok) {
        ctx.highlight(pickd.id, 'bad');
        items.push({ m: pickd, color: L.bad });
        html += ` ${esc(pickd.n)} doesn't touch it. It's ${ctx.relative(m.pt, pickd.pt).text} of ${esc(m.n)}.`;
      }
      html += `<div class="note">All ${m.neighbors.length} neighbors of ${esc(m.n)}: ${esc(
        [...m.neighbors].sort((a, b) => bearing(m.pt, a.pt) - bearing(m.pt, b.pt)).map((o) => `${o.n} (${compass8(bearing(m.pt, o.pt))})`).join(', ')
      )}</div>`;
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
      const items = [{ m, color: L.good }, { m, pt: l.pt, label: l.name, color: L.place }];
      let html = `${ok ? '✓' : '✗'} <b>${esc(l.name)}</b> (${esc(l.kind.toLowerCase())}) is in <b>${esc(m.full)}</b>, ${esc(ctx.groupName(m.c))}.`;
      if (!ok) {
        ctx.highlight(pickd.id, 'bad');
        items.push({ m: pickd, color: L.bad });
        html += ` ${esc(pickd.n)} is ${ctx.relative(l.pt, pickd.pt).text} of it.`;
      }
      ctx.reveal(items);
      feedback(ok, html);
      ctx.fit(ok ? [m] : [m, pickd], 13);
    } else if (q.kind === 'roadto') {
      const chosen = q.choices[+btn.dataset.v];
      const ok = chosen === q.right;
      record(q.target, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-v="${q.choices.indexOf(q.right)}"]`).classList.add('right');
      ctx.showRoadRefs(true);
      ctx.focusRoad(q.right.raw, ctx.theme.hl.good);
      if (!ok) ctx.focusRoadBad(chosen.raw);
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
    } else if (q.kind === 'avedir') {
      const ok = btn.dataset.v === q.dir;
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-v="${q.dir}"]`).classList.add('right');
      const said = q.dir === 'two-way' ? 'both ways' : q.dir;
      feedback(ok, `${ok ? '✓' : '✗'} <b>${esc(q.name)}</b> runs <b>${said}</b>.<div class="note">${esc(R.avenueNote)}</div>`);
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
      if (placed) items.push({ m, pt: placed.pt, label: name, color: L.place });
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
    const m = q.m;
    const truth = bearing(q.from.pt, m.pt);
    const err = Math.abs(angleDiff(q.angle, truth));
    const ok = err <= 22.5;
    record(m, ok);
    const t = document.getElementById('truth');
    t.style.display = '';
    t.setAttribute('transform', `rotate(${truth})`);
    document.getElementById('lockIn').remove();
    ctx.highlight(m.id, 'good');
    ctx.reveal([
      ...(q.from.you ? [] : [{ m, pt: q.from.pt, label: q.from.name, color: L.q }]),
      { m, color: L.good },
    ]);
    const d = distanceMi(q.from.pt, m.pt);
    ctx.lines([
      { coords: [q.from.pt, m.pt] },
      { coords: [q.from.pt, destinationPt(q.from.pt, q.angle, d)], color: ctx.theme.ink4 },
    ]);
    const from = q.from.you ? 'you' : q.from.name;
    feedback(
      ok,
      `${ok ? '✓' : err <= 45 ? '≈' : '✗'} You were <b>${Math.round(err)}°</b> off. <b>${esc(m.n)}</b> is ${d < 10 ? d.toFixed(1) : Math.round(d)} mi <b>${dirWord(compass16(truth))}</b> (${Math.round(truth)}°) of ${esc(from)}.`
    );
    ctx.fit([m, q.from.pt], 12);
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
    if (ctx.mode !== 'practice' || e.handledByAnchor || !q || q.kind !== 'find' || q.answered) return;
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
      if (q && !q.answered) show();
      else next();
    },
    leave() {
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
