import { bearing, distanceMi, compass8, compass16, angleDiff, dirWord } from './geo.js';

const REGIONS = {
  'North Jersey': ['Bergen', 'Essex', 'Hudson', 'Morris', 'Passaic', 'Sussex', 'Union', 'Warren'],
  'Central Jersey': ['Hunterdon', 'Mercer', 'Middlesex', 'Monmouth', 'Somerset'],
  'South Jersey': ['Atlantic', 'Burlington', 'Camden', 'Cape May', 'Cumberland', 'Gloucester', 'Ocean', 'Salem'],
};
const TYPES = {
  mix: 'Mixed',
  find: 'Find it on the map',
  name: 'Name the highlighted town',
  dir: 'Which direction?',
  confuse: 'Sound-alikes',
  section: 'Which town is this village in?',
};
const DIR8 = ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'];
const DIR_DEG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export function initPractice(ctx) {
  const { map, store, munis } = ctx;
  const cfg = { type: 'mix', area: 'all', ...store.get('practice', {}) };
  const score = { right: 0, total: 0, streak: 0 };
  let q = null;
  const recent = [];
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

  // ---- area / pool ----------------------------------------------------------
  function pool() {
    const a = cfg.area;
    let p = munis;
    if (a.startsWith('county:')) p = munis.filter((m) => m.c === a.slice(7));
    else if (a.startsWith('region:')) {
      const cs = REGIONS[a.slice(7)];
      p = munis.filter((m) => cs.includes(m.c));
    } else if (a === 'visited') {
      const v = ctx.modes.drive.visited;
      p = munis.filter((m) => v[m.key]);
    } else if (a === 'near' && ctx.pos) p = munis.filter((m) => distanceMi(ctx.pos.pt, m.pt) <= 15);
    return p.length >= 4 ? p : munis;
  }

  // ---- spaced-repetition-ish weighting --------------------------------------
  const stats = () => store.get('stats', {});
  function record(m, ok) {
    const s = stats();
    const [seen = 0, right = 0] = s[m.key] || [];
    s[m.key] = [seen + 1, right + (ok ? 1 : 0)];
    store.set('stats', s);
  }
  function pick(p) {
    const s = stats();
    const ws = p.map((m) => {
      if (recent.includes(m.id)) return 0;
      const [seen = 0, right = 0] = s[m.key] || [];
      const miss = seen - right;
      return seen === 0 ? 2 : 1 + 3 * miss / seen + (right >= 3 && miss === 0 ? -0.7 : 0);
    });
    const tot = ws.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot;
    for (let i = 0; i < p.length; i++) if ((r -= ws[i]) <= 0) return remember(p[i]);
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
      .filter((o) => o.n !== a.n && distanceMi(a.pt, o.pt) > 3);
    let cands = p.filter((o) => o !== a && distanceMi(a.pt, o.pt) > 2.5 && distanceMi(a.pt, o.pt) < 35);
    if (!cands.length) cands = munis.filter((o) => o !== a && distanceMi(a.pt, o.pt) > 2.5 && distanceMi(a.pt, o.pt) < 35);
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

  function makeConfuse(p) {
    const ids = new Set(p.map((m) => m.id));
    const curated = ctx.confusables.groups.filter((g) => g.curated);
    const local = curated.filter((g) => g.members.some((m) => ids.has(m.id)));
    const g = rand(local.length ? local : curated);
    const m = rand(g.members);
    let choices = g.members.length > 4 ? [m, ...shuffle(g.members.filter((o) => o !== m)).slice(0, 3)] : [...g.members];
    return { kind: 'name', m, choices: shuffle(choices), group: g };
  }
  function next() {
    const p = pool();
    const t = cfg.type === 'mix' ? rand(['find', 'find', 'name', 'name', 'dir', 'dir', 'confuse', 'section']) : cfg.type;
    q = { find: makeFind, name: makeName, dir: makeDir, confuse: makeConfuse, section: makeSection }[t](p);
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
      areaOpt('all', 'All of New Jersey') +
      (ctx.pos ? areaOpt('near', 'Within 15 mi of me') : '') +
      areaOpt('visited', `Towns I've driven through (${nVisited})`) +
      `<optgroup label="Regions">${Object.keys(REGIONS).map((r) => areaOpt('region:' + r, r)).join('')}</optgroup>` +
      `<optgroup label="Counties">${ctx.counties.map((c) => areaOpt('county:' + c, c + ' County')).join('')}</optgroup>`;
    const pct = score.total ? Math.round((100 * score.right) / score.total) : 0;
    return `<div class="prow">
        <select id="qType" aria-label="Question type">${opts(TYPES)}</select>
        <select id="qArea" aria-label="Area">${area}</select>
      </div>
      <div class="score">${score.right}/${score.total}${score.total ? ` · ${pct}%` : ''}${score.streak > 1 ? ` · streak ${score.streak}` : ''}</div>`;
  }

  function bindHeader() {
    document.getElementById('qType').addEventListener('change', (e) => {
      cfg.type = e.target.value;
      store.set('practice', cfg);
      next();
    });
    document.getElementById('qArea').addEventListener('change', (e) => {
      cfg.area = e.target.value;
      store.set('practice', cfg);
      if (cfg.area === 'visited' && Object.keys(ctx.modes.drive.visited).length < 4)
        alert('Fewer than 4 towns visited so far. Use Drive mode with location on, and towns you pass through will collect here. Using all of NJ for now.');
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
    ctx.showLabels(false);
    const m = q.m;
    let body = '';
    if (q.kind === 'find') {
      ctx.hud(`<div class="qkind">Find it</div><div class="q">Tap ${prompt(m)}</div>`);
      body = `<div class="hint muted">Tap the map. Pinch to zoom if you need to.</div>`;
    } else if (q.kind === 'name') {
      ctx.highlight(m.id, 'q');
      ctx.hud(`<div class="qkind">${q.group ? 'Sound-alikes' : 'Name it'}</div><div class="q">Which town is highlighted?</div>`);
      body = `<div class="choices">${q.choices.map((o) => `<button class="choice" data-id="${o.id}">${esc(ctx.name(o))}</button>`).join('')}</div>`;
    } else if (q.kind === 'sec') {
      ctx.hud(`<div class="qkind">Villages &amp; sections</div><div class="q"><b>${esc(q.section.name)}</b> is part of which town?</div>`);
      body = `<div class="choices">${q.choices.map((o) => `<button class="choice" data-id="${o.id}">${esc(ctx.name(o))}</button>`).join('')}</div>`;
    } else if (q.kind === 'dir') {
      ctx.highlight(m.id, 'q');
      ctx.reveal([{ m, color: '#5b21b6' }]);
      ctx.hud(`<div class="qkind">Which way?</div><div class="q">From ${prompt(m)}, which way is ${prompt(q.b)}?</div>`);
      body = `<div class="rose8">${DIR8.map((d) => (d ? `<button class="choice dir" data-dir="${d}">${d}</button>` : '<span></span>')).join('')}</div>`;
    }
    ctx.sheet(`${header()}<div id="qbody">${body}</div>`);
    bindHeader();
    for (const b of document.querySelectorAll('#qbody .choice')) b.addEventListener('click', () => answer(b));

    // Frame the question without giving it away.
    requestAnimationFrame(() => {
      if (q.kind === 'find') ctx.fit([areaBox(q.p)], 12);
      else if (q.kind === 'sec') ctx.fit([{ bbox: countyBox[m.c] }], 12);
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
      const items = [{ m, color: '#166534', label: m.mapLabel }];
      let html = ok ? `✓ <b>${esc(m.n)}</b> — ${esc(ctx.sub(m))}.` : `✗ It's <b>${esc(ctx.name(m))}</b> — ${esc(ctx.sub(m))}.`;
      if (!ok) {
        ctx.highlight(pickd.id, 'bad');
        items.push({ m: pickd, color: '#991b1b' });
        html += ` ${esc(pickd.n)} is ${ctx.relative(m.pt, pickd.pt).text} of here, in ${esc(pickd.c)} County.`;
        ctx.line([m.pt, pickd.pt]);
      }
      if (q.group) {
        html += contrast(q.group, m);
        q.group.members.forEach((o) => o !== m && o !== pickd && items.push({ m: o, color: '#475467' }));
      }
      ctx.reveal(items);
      feedback(ok, html);
      ctx.fit(q.group ? q.group.members : ok ? [{ bbox: countyBox[m.c] }] : [m, pickd], 12);
    } else if (q.kind === 'sec') {
      const pickd = munis[+btn.dataset.id];
      const ok = pickd === m;
      const name = q.section.name;
      record(m, ok);
      btn.classList.add(ok ? 'right' : 'wrong');
      document.querySelector(`#qbody .choice[data-id="${m.id}"]`).classList.add('right');
      ctx.highlight(m.id, 'good');
      const items = [{ m, color: '#166534' }];
      const placed = ctx.placedSections(m).get(name.toLowerCase());
      if (placed) items.push({ m, pt: placed.pt, label: name, color: '#3730a3' });
      let html = `${ok ? '✓' : '✗'} <b>${esc(name)}</b> is part of <b>${esc(m.full)}</b>, ${esc(m.c)} County.`;
      if (!ok) {
        ctx.highlight(pickd.id, 'bad');
        items.push({ m: pickd, color: '#991b1b' });
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
        { m, color: '#5b21b6' },
        { m: b, color: '#166534' },
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

  function contrast(g, m) {
    const rows = g.members
      .map((o) => `<li><b>${esc(ctx.name(o))}</b> — ${esc(o.c)} Co.${o !== m ? `, ${ctx.relative(m.pt, o.pt).text} of ${esc(m.n)}` : ''}</li>`)
      .join('');
    return `<ul class="contrast">${rows}</ul>${g.note ? `<div class="note">${esc(g.note)}</div>` : ''}`;
  }

  // Map taps answer "find it" questions.
  map.on('click', (e) => {
    if (ctx.mode !== 'practice' || !q || q.kind !== 'find' || q.answered) return;
    const m = q.m;
    const t = ctx.locate([e.lngLat.lng, e.lngLat.lat]);
    const ok = t === m;
    record(m, ok);
    ctx.highlight(m.id, 'good');
    const items = [{ m, color: '#166534' }];
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
        items.push({ m: t, color: '#991b1b' });
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
      ctx.showLabels(true);
    },
  };
}
