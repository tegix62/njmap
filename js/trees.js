// Trees of New Jersey: the app's way of teaching places, pointed at trees. A few minutes a day; a tree is met once (its photos and its tell),
// then comes back spaced out over days, each time from a different side: its leaf, its bark, its shape, its fruit; named from a photo, picked
// out of four photos, matched across two photos, and one fact about its leaves. Where it has been seen in New Jersey is shown on the map.
// Data: data/trees.json (tools/build_trees.py: iNaturalist photos and sightings; the tells were checked against Wikipedia in November 2026, see the README).
import { GROUPS, GROUP_OF, KEY, ICON, pathTo, treesUnder } from './treekey.js';
import { leafSvg, twigSvg, HAS_LEAF, HAS_OUTLINE, outlineSource } from './treeleaf.js';
import { SKILLS, DRILL_N, PASS } from './treeskills.js';
const DAYS = [0, 1, 3, 7, 16, 35];
const DAY = 864e5;
const NEW_PER_DAY = 3, SET = 10;
const CTX = { leaf: 'leaf', bark: 'bark', form: 'whole tree', fruit: 'fruit', flower: 'flower', fall: 'autumn', twig: 'twig and buds' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
const today = () => new Date().toLocaleDateString('en-CA');

export function initTrees(ctx) {
  const { map, store } = ctx;
  let D = null, by = null, root = null, q = null, run = null, layer = false, H = null, G = null, POOL = null, quick = null, picking = false;

  async function load() {
    if (D) return;
    [D, G, POOL] = await Promise.all(['data/trees.json', 'data/treegrid.json', 'data/treepool.json'].map((f) => fetch(f).then((r) => r.json())));
    by = new Map(D.trees.map((t) => [t.id, t]));
    H = { trees: D.trees, by, photoOf, img, esc };
  }
  // ---- the skills of looking: learned once (a lesson, then a short practice that must go well), and asked again now and then
  const skills = () => store.get('trees.skills', {});
  const skillDone = (sk) => !!(skills()[sk] && skills()[sk].done);
  function skillResult(sk, right, n) {
    const all = skills(), cur = all[sk] || {};
    all[sk] = { done: cur.done || right >= PASS, best: Math.max(cur.best || 0, right), tries: (cur.tries || 0) + 1, n };
    store.set('trees.skills', all);
    return all[sk].done;
  }
  // ---- what you know: the same boxes as the town quiz, one per tree
  const srs = () => store.get('trees.srs', {});
  const met = () => store.get('trees.met', []).filter((id) => by.has(id));
  const isDue = (id, s = srs()) => !s[id] || s[id].due <= Date.now();
  function record(id, ok) {
    const s = srs(), cur = s[id] || { b: 0, due: 0 };
    if (ok) { const b = Math.min(cur.b + 1, DAYS.length - 1); s[id] = { b, due: Date.now() + DAYS[b] * DAY }; }
    else s[id] = { b: 0, due: Date.now() + 10 * 60e3 };
    store.set('trees.srs', s);
    const st = store.get('trees.stats', {}); const [n = 0, r = 0] = st[id] || []; st[id] = [n + 1, r + (ok ? 1 : 0)]; store.set('trees.stats', st);
  }
  const learned = () => { const s = srs(); return met().filter((id) => s[id] && s[id].b >= 3).length; };
  function streak() {
    const days = store.get('trees.days', []); let n = 0; const d = new Date();
    if (!days.includes(today())) d.setDate(d.getDate() - 1);
    while (days.includes(d.toLocaleDateString('en-CA'))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---- trees near you: the sightings grid around your spot, ranked on this device (the spot never leaves it)
  const spot = () => store.get('trees.spot', null);
  function nearCounts(pt) {
    const { cell, lon0, lat0 } = G, cx = (pt[0] - lon0) / cell, cy = (pt[1] - lat0) / cell, R = 4, sig = 1.6;
    const out = {};
    for (const [id, cells] of Object.entries(G.trees)) {
      let w = 0, n = 0;
      for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
        const k = `${Math.floor(cx) + dx},${Math.floor(cy) + dy}`, c = cells[k]; if (!c) continue;
        const d2 = (Math.floor(cx) + dx + 0.5 - cx) ** 2 + (Math.floor(cy) + dy + 0.5 - cy) ** 2;
        w += c * Math.exp(-d2 / (2 * sig * sig)); if (d2 <= 4) n += c;
      }
      out[id] = { w, n };
    }
    return out;
  }
  /** Every tree, most-seen near your spot first (statewide sightings when no spot is set or few are nearby). */
  function ranked() {
    const sp = spot(), nc = sp ? nearCounts(sp.pt) : null;
    const local = nc && Object.values(nc).reduce((a, b) => a + b.n, 0) >= 40;
    const score = (t) => (local ? nc[t.id].n + nc[t.id].w / 1e4 : 0) * 1000 + t.count / 1000;
    return { list: [...D.trees].sort((a, b) => score(b) - score(a)), nc: local ? nc : null };
  }
  const LOCAL_N = 10;
  // the season, from today's date: what you can see on the trees this week
  const season = () => ({ 12: 'winter', 1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer', 9: 'fall', 10: 'fall', 11: 'fall' })[new Date().getMonth() + 1];
  const SEASON_LINE = {
    spring: 'Spring: flowers and new leaves. Red maples flower red before their leaves; dogwoods bloom white.',
    summer: 'Summer: full leaves. A good time for leaf shapes, and for pairs or one at a time.',
    fall: 'Fall: leaves turning and dropping. Look at the colour, and at the leaves on the ground under each tree.',
    winter: 'Winter: bare branches. Look at bark, buds and the shape of the tree; evergreens stand out.',
  };
  const SEASON_CTX = { spring: ['flower', 'leaf'], summer: ['leaf', 'fruit'], fall: ['fall', 'leaf', 'fruit'], winter: ['bark', 'form', 'twig'] };
  const hidden = () => store.get('trees.hidden', []);
  /** A photo from a tree's big pool, preferring this season, never one you hid: [url, credit, file]. */
  function poolPhoto(id, avoid) {
    const ps = (POOL.trees[id] || []).filter((p) => !hidden().includes(p[0]) && p[0] !== avoid);
    if (!ps.length) { const p = photoOf(by.get(id)); return [p.f, p.credit, null]; }
    const now = ps.filter((p) => p[1] === season()), p = rand(now.length && Math.random() < 0.7 ? now : ps);
    const [pid, ext] = p[0].split('.');
    return [`${POOL.base}${pid}/${POOL.size}.${ext}`, p[2], p[0]];
  }

  // ---- the screen
  function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'trees';
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (!b || b.disabled) return;
      const f = actions[b.dataset.t]; if (f) f(b);
    });
  }
  const photoOf = (t, ctxs) => { const ps = t.photos.filter((p) => !ctxs || ctxs.includes(p.ctx)); return rand(ps.length ? ps : t.photos); };
  const img = (p, cls = '') => `<figure class="tr-ph ${cls}"><img src="${esc(p.f)}" alt="" loading="lazy"><figcaption><b>${esc(CTX[p.ctx] || p.ctx)}</b><span>${esc(p.credit.replace(/^\(c\)/, '©').replace(/,? some rights reserved/, ''))} · iNaturalist</span></figcaption></figure>`;
  const frame = (top, body) => { root.innerHTML = `<div class="tr-top">${top}</div><div class="tr-body">${body}</div>`; root.scrollTop = 0; root.classList.remove('peek'); ctx.hud(''); };
  const back = (label = 'Trees') => `<button class="tr-back" data-t="hub"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(label)}</button>`;

  const groupOf = (id) => GROUPS.find((g) => g.id === GROUP_OF[id]);
  /** A tree's leaf: the traced outline (or needle diagram) when there is one, else a photo of the leaf. */
  const leafArt = (id) => leafSvg(id) || `<img class="tk-leafph" src="${esc(photoOf(by.get(id), ['leaf']).f)}" alt="">`;
  /** The key's path to a tree, as a row of small drawings with their answers. */
  const pathHtml = (id, upTo) => `<div class="tk-path">${pathTo(id).slice(0, upTo).map(([n, i]) => { const [label, ic] = KEY[n].a[i]; return `<span>${ICON[ic]}<small>${esc(label)}</small></span>`; }).join('<i>›</i>')}</div>`;
  /** A group side by side: what puts a tree in it, how the key gets there, and each member's leaf and bark with the one thing that tells it apart. */
  function groupCard(g, opts = {}) {
    const ms = Object.keys(g.tell).map((id) => by.get(id)).filter(Boolean);
    frame(opts.meet ? `<span class="tr-kick">New group</span>` : back(opts.from === 'guide' ? 'Field guide' : 'Trees'),
      `<h2>${esc(g.name)}</h2><p class="tr-why">${esc(g.why)}</p>${pathHtml(ms[0].id, ms.every((t) => pathTo(t.id).length === pathTo(ms[0].id).length) ? undefined : -1)}
      <h4>How to tell them apart</h4>
      <div class="tk-cmp">${ms.map((t) => `<button class="tk-col" data-t="card" data-id="${t.id}"><div class="tk-sil">${leafArt(t.id)}</div><div class="tk-pics"><img src="${esc(photoOf(t, ['leaf']).f)}" alt=""><img src="${esc(photoOf(t, ['bark']).f)}" alt=""></div><b>${esc(t.name)}</b><small>${esc(g.tell[t.id])}</small></button>`).join('')}</div>
      ${opts.meet ? '<button class="tr-go" data-t="next">Meet them one by one</button>' : ''}`);
    q = { kind: 'group', g };
  }
  /** Identify: the key, one question at a time, with the trees it still leaves; at a group, its side-by-side card. */
  function identify(node = 'start', trail = []) {
    const n = KEY[node];
    const left = trail.length ? treesUnder(...trail[trail.length - 1]) : Object.keys(GROUP_OF);
    frame(back(), `<span class="tr-kick">Name a tree in front of you</span><p class="tr-ask">${esc(n.q)}</p>
      <p class="sk-how"><b>How to check:</b> ${esc(n.how)}${n.skill ? ` <button class="sk-link" data-t="lesson" data-sk="${n.skill}">Show me</button>` : ''}</p>
      <div class="tk-opts">${n.a.map(([label, ic], i) => `<button data-t="keypick" data-node="${node}" data-i="${i}" data-trail='${esc(JSON.stringify(trail))}'>${ICON[ic]}<b>${esc(label)}</b><small>${treesUnder(node, i).length} tree${treesUnder(node, i).length === 1 ? '' : 's'}</small></button>`).join('')}</div>
      ${trail.length ? `<div class="tk-trail">${trail.map(([tn, ti]) => `<span>${esc(KEY[tn].a[ti][0])}</span>`).join(' › ')}</div>` : ''}
      <h4>Trees it could still be: ${left.length}</h4><div class="tk-left">${left.map((id) => `<span title="${esc(by.get(id).name)}">${leafArt(id)}</span>`).join('')}</div>`);
  }
  function keyPick(b) {
    const node = b.dataset.node, i = +b.dataset.i, trail = [...JSON.parse(b.dataset.trail), [node, i]];
    const t = KEY[node].a[i][2];
    if (t.to) return identify(t.to, trail);
    groupCard(GROUPS.find((g) => g.id === t.group));
  }

  function hub() {
    q = null; run = null; quick = null;
    const m = met(), t = store.get('trees.today', {}), doneToday = t.d === today() && t.done;
    const due = m.filter((id) => isDue(id)).length;
    const C = 2 * Math.PI * 21, frac = doneToday ? 1 : t.d === today() && t.n ? t.i / t.n : 0;
    const { list, nc } = ranked(), local = list.slice(0, LOCAL_N), sp = spot();
    const fresh = list.filter((x) => !m.includes(x.id)).slice(0, 2);
    const plan = doneToday ? `Done today ✓${streak() ? ` · ${streak()}-day streak` : ''}` : `${fresh.length ? `Meet: ${fresh.map((x) => esc(x.name)).join(' and ')}` : 'Review what you know'}${due ? ` · ${due} to review` : ''}`;
    const learnt = Object.keys(SKILLS).filter(skillDone);
    frame(`<button class="tr-back" data-t="home"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Home</button><h1>Trees of New Jersey</h1>`,
      `<button class="tr-today${doneToday ? ' done' : ''}" data-t="today"><span><b>${doneToday ? 'Today is done' : t.d === today() && t.i ? 'Carry on today' : 'Start today'}</b><small>${plan}</small></span>
        <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="21" class="bg"/><circle cx="26" cy="26" r="21" class="fg" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/></svg></button>
      <p class="tn-season">${esc(SEASON_LINE[season()])}</p>
      <div class="tr-stats"><span><b>${m.length}</b> of ${D.trees.length} met</span><span><b>${learned()}</b> learned</span><span><b>${streak()}</b> day streak</span></div>
      <div class="tn-head"><h4>${sp ? `Trees near ${esc(sp.name)}` : 'The most-seen trees in New Jersey'}</h4><button class="sk-link" data-t="spot">${sp ? 'Change' : 'Set your spot'}</button></div>
      ${sp ? '' : '<p class="tn-hint">Set the place you are outdoors most (home, work, a park) and these become the trees most often seen around it.</p>'}
      <div class="tn-list">${local.map((x, i) => `<button class="tn-row${m.includes(x.id) ? ' met' : ''}" data-t="card" data-id="${x.id}"><span class="tn-n">${m.includes(x.id) ? '✓' : i + 1}</span><span class="tn-leaf">${leafArt(x.id)}</span><span class="tk-gt"><b>${esc(x.name)}</b><small>${nc ? `seen ${nc[x.id].n.toLocaleString()} times within about 10 km` : `${x.count.toLocaleString()} sightings in New Jersey`}${!m.includes(x.id) && fresh.some((f) => f.id === x.id) ? ' · next to meet' : ''}</small></span></button>`).join('')}</div>
      <div class="tr-row"><button class="tr-card" data-t="quick"${m.length < 2 ? ' disabled' : ''}><b>Quick look</b><small>${m.length < 2 ? 'after you meet two trees' : '20 photos, fast: which tree?'}</small></button>
        <button class="tr-card" data-t="identify"><b>Name a tree</b><small>in front of you: a few questions</small></button></div>
      <button class="tr-card wide" data-t="practise"${m.length < 2 && !learnt.length ? ' disabled' : ''}><b>Practise</b><small>${m.length < 2 && !learnt.length ? 'after you meet two trees' : 'endless, every kind of question'}</small></button>
      <h4>Learn to look</h4><p class="tn-hint">Optional short lessons: what field guides ask about any tree. Each tree's page links to the one it needs.</p>
      <div class="tn-skills">${Object.entries(SKILLS).map(([k, S]) => `<button class="tn-skill${skillDone(k) ? ' done' : ''}" data-t="lesson" data-sk="${k}">${ICON[KEY[Object.keys(KEY).find((n) => KEY[n].skill === k)].a[0][1]]}<b>${esc(S.name)}</b>${skillDone(k) ? '<small>✓ learned</small>' : ''}</button>`).join('')}</div>
      <button class="tr-card wide" data-t="guide"><b>Field guide</b><small>every tree, by group, with side-by-side comparisons</small></button>
      <p class="tr-note">Photos and sightings: iNaturalist, each under its own licence; your spot stays on this device. The identifying tips were checked against each tree’s Wikipedia article (November 2026); if your field guide disagrees, trust the book.</p>`);
  }

  // ---- your spot: one of your places from the town side, or a tap on the map
  function spotPicker() {
    const anchors = store.get('anchors', []);
    frame(back(), `<h2>Your spot</h2><p class="sk-p">Where are you outdoors most? The trees most often seen within about 10 km of it come first. It stays on this device.</p>
      ${anchors.length ? `<h4>Your places</h4><div class="tn-list">${anchors.map((a, i) => `<button class="tn-row" data-t="spotset" data-i="${i}"><span class="tn-n">📍</span><span class="tk-gt"><b>${esc(a.name)}</b><small>from your places on the town side</small></span></button>`).join('')}</div>` : ''}
      <button class="tr-go" data-t="spotmap">Tap a spot on the map</button>
      ${spot() ? '<button class="tr-card wide" data-t="spotclear"><b>Clear my spot</b><small>use the most-seen trees in all of New Jersey</small></button>' : ''}`);
  }
  function spotFromMap() {
    picking = true; root.classList.add('peek');
    const b = ctx.region.bounds; map.fitBounds(b, { padding: { top: 120, bottom: 110, left: 20, right: 20 }, bearing: 0, pitch: 0, duration: 700 });
    ctx.hud('<div class="qkind">Your spot</div><div class="q"><b>Tap where you are outdoors most</b></div><div class="meta">Zoom in if you like. It stays on this device.</div>');
    const pb = document.createElement('button'); pb.className = 'tr-peekback'; pb.textContent = 'Cancel'; pb.addEventListener('click', () => { picking = false; actions.unpeek(); spotPicker(); }); document.body.appendChild(pb);
    map.once('click', (e) => {
      if (!picking) return; picking = false;
      store.set('trees.spot', { name: 'your spot', pt: [+e.lngLat.lng.toFixed(4), +e.lngLat.lat.toFixed(4)] });
      actions.unpeek(); hub();
    });
  }

  // ---- quick look: 20 photos from the big pools, two names each, fast
  function quickStart() {
    const m = met(); if (m.length < 2) return hub();
    quick = { i: 0, n: 20, right: 0, mix: {}, ids: m };
    quickAsk();
  }
  function quickAsk() {
    if (quick.i >= quick.n) return quickEnd();
    const id = rand(quick.ids), t = by.get(id);
    const near = [...t.like, ...Object.keys(groupOf(id).tell)].filter((x) => x !== id && quick.ids.includes(x));
    const other = rand(near.length && Math.random() < 0.7 ? near : quick.ids.filter((x) => x !== id));
    const [u, credit, file] = poolPhoto(id);
    frame(`${back()}<span class="tr-prog">${Array.from({ length: quick.n }, (_, i) => `<i class="${i < quick.i ? 'd' : i === quick.i ? 'c' : ''}"></i>`).join('')}</span>`,
      `<span class="tr-kick">Quick look</span><figure class="tr-ph big tn-quick"><img src="${esc(u)}" alt=""><figcaption><span>${esc(credit)} · iNaturalist</span></figcaption></figure>
      <div class="tr-choices two">${shuffle([id, other]).map((x) => `<button data-t="qans" data-id="${x}">${esc(by.get(x).name)}</button>`).join('')}</div>
      ${file ? `<button class="sk-link tn-hide" data-t="hidephoto" data-f="${esc(file)}">Bad photo? Hide it</button>` : ''}`);
    q = { kind: 'quick', id, other };
  }
  function quickAnswer(b) {
    if (!q || q.done) return; q.done = true;
    const ok = b.dataset.id === q.id;
    if (ok) quick.right++; else { const k = [q.id, q.other].sort().join('|'); quick.mix[k] = (quick.mix[k] || 0) + 1; }
    for (const x of root.querySelectorAll('[data-t=qans]')) { x.disabled = true; if (x.dataset.id === q.id) x.classList.add('right'); }
    if (!ok) b.classList.add('wrong');
    setTimeout(() => { if (quick) { quick.i++; quickAsk(); } }, ok ? 550 : 1300);
  }
  function quickEnd() {
    const mix = Object.entries(quick.mix).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const r = quick.right, n = quick.n; quick = null;
    frame(back(), `<div class="tr-done"><h2>${r} of ${n}</h2><p>${r >= 18 ? 'Sharp eyes.' : r >= 14 ? 'Getting there.' : 'These take many looks: that is how everyone learns them.'}</p>
      ${mix.map(([k]) => { const [a, c] = k.split('|').map((x) => by.get(x)); return `<div class="tr-res no"><b>You mixed up ${esc(a.name)} and ${esc(c.name)}</b><p>${esc(a.name)}: ${esc(groupOf(a.id).tell[a.id])}</p><p>${esc(c.name)}: ${esc(groupOf(c.id).tell[c.id])}</p></div>`; }).join('')}
      <button class="tr-go" data-t="quick">Another 20</button><button class="tr-card wide" data-t="hub"><b>Back to the trees</b></button></div>`);
  }

  /** A tree's page: all its photos, its tell, and where it has been seen. */
  function card(t, opts = {}) {
    const top3 = Object.keys(t.counties).slice(0, 3);
    frame(opts.meet ? `<span class="tr-kick">New tree · ${opts.k} of ${opts.n}</span>` : back(opts.from === 'guide' ? 'Field guide' : 'Trees'),
      `<h2>${esc(t.name)}</h2><p class="tr-sci">${esc(t.sci)}</p>
      <div class="tr-strip">${t.photos.map((p) => img(p)).join('')}</div>
      <div class="tk-tellrow"><div class="tk-sil">${leafArt(t.id)}</div><p class="tr-tell">${esc(t.tell)}</p></div>
      <button class="tk-ingroup" data-t="groupcard" data-g="${groupOf(t.id).id}"><small>One of the <b>${esc(groupOf(t.id).name.toLowerCase())}</b>: ${esc(groupOf(t.id).tell[t.id])}</small></button>
      ${pathHtml(t.id)}
      <div class="tr-facts">${t.arr === 'opposite' || t.arr === 'alternate' ? `${HAS_OUTLINE(t.id) ? `<span class="sk-twigchip">${twigSvg(t.id, { arr: t.arr, n: t.arr === 'opposite' ? 2 : 3 })}</span>` : ''}<button class="tn-fact" data-t="lesson" data-sk="pairs">Leaves <b>${t.arr === 'opposite' ? 'in pairs' : 'one at a time'}</b> on the twig <i>what's that?</i></button><button class="tn-fact" data-t="lesson" data-sk="leaflets"><b>${t.leaf === 'compound' ? 'A leaf made of leaflets' : 'One leaf'}</b> on each stalk <i>what's that?</i></button>` : `<button class="tn-fact" data-t="lesson" data-sk="look">Green all year, with <b>${t.arr}</b> <i>what's that?</i></button>`}</div>
      ${HAS_OUTLINE(t.id) ? `<p class="tr-src">Leaf outline traced from a photo: ${esc(outlineSource(t.id).credit.replace(/^\(c\)/, '©').replace(/,? some rights reserved/, ''))} · iNaturalist</p>` : ''}
      ${t.checked ? `<p class="tr-src">Checked against <a href="${esc(t.checked.src)}" target="_blank" rel="noopener">Wikipedia</a>${t.checked.note ? `. ${esc(t.checked.note)}` : ''}</p>` : ''}
      <button class="tr-where" data-t="where" data-id="${t.id}"><b>Where it has been seen</b><small>${top3.length ? `Most in ${esc(top3.join(', '))}` : ''} · show on the map</small></button>
      ${opts.meet ? '<button class="tr-go" data-t="next">Got it</button>' : ''}`);
    q = { kind: 'card', t, opts };
  }
  function guide() {
    frame(back(), `<h2>Field guide</h2>${GROUPS.map((g) => `<button class="tk-gh" data-t="groupcard" data-g="${g.id}" data-from="guide">${esc(g.name)} <span>compare ›</span></button><div class="tr-list">${Object.keys(g.tell).map((id) => by.get(id)).map((t) => `<button class="tr-li" data-t="card" data-id="${t.id}" data-from="guide"><span class="tk-li-sil">${leafArt(t.id)}</span><span><b>${esc(t.name)}</b><small>${esc(g.tell[t.id])}</small></span></button>`).join('')}</div>`).join('')}`);
  }
  /** The map, with every sighting of one tree; the screen steps aside. */
  function where(t) {
    if (!layer) {
      layer = true;
      map.addSource('trees-pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'trees-pts', type: 'circle', source: 'trees-pts', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3.5, 11, 6], 'circle-color': '#2f8f5b', 'circle-opacity': 0.75, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.2 } });
    }
    map.getSource('trees-pts').setData({ type: 'FeatureCollection', features: t.pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })) });
    map.setLayoutProperty('trees-pts', 'visibility', 'visible');
    root.classList.add('peek');
    const b = ctx.region.bounds;
    map.fitBounds(b, { padding: { top: 120, bottom: 110, left: 20, right: 20 }, bearing: 0, pitch: 0, duration: 900 });
    const top = Object.entries(t.counties).slice(0, 4).map(([c, n]) => `${esc(c)} ${n}`).join(' · ');
    ctx.hud(`<div class="qkind">Where it has been seen</div><div class="q"><b>${esc(t.name)}</b></div><div class="meta">${t.pts.length} of the best-documented sightings (of ${t.count.toLocaleString()} in New Jersey). ${top}</div>`);
    const pb = document.createElement('button'); pb.className = 'tr-peekback'; pb.textContent = 'Back to the tree'; pb.addEventListener('click', actions.unpeek); document.body.appendChild(pb);
  }

  // ---- learning to look: a lesson, a panel at a time, then practice on just that one thing
  const runHead = () => (run ? `${back()}<span class="tr-prog">${run.steps.map((s, i) => `<i class="${i < run.i ? 'd' : i === run.i ? 'c' : ''}"></i>`).join('')}</span>` : back());
  function lesson(sk, i = 0) {
    const S = SKILLS[sk], ps = S.panels(H), P = ps[i], last = i === ps.length - 1;
    frame(runHead(), `<span class="tr-kick">Learn to look · ${i + 1} of ${ps.length}</span><h2>${i ? esc(P.h) : esc(S.name)}</h2>${i ? '' : `<p class="tr-sci">${esc(S.short)}</p><h4 class="sk-h">${esc(P.h)}</h4>`}
      <p class="sk-p">${P.p}</p>${P.art ? `<div class="sk-panelart">${P.art}</div>` : ''}
      <div class="sk-nav">${i ? `<button class="tr-card sk-prev" data-t="lstep" data-sk="${sk}" data-i="${i - 1}"><b>Back</b></button>` : ''}
      ${last ? (run ? '<button class="tr-go" data-t="next">Try it</button>' : `<button class="tr-go" data-t="drillrun" data-sk="${sk}">Practise this</button>`) : `<button class="tr-go" data-t="lstep" data-sk="${sk}" data-i="${i + 1}">Next</button>`}</div>`);
    q = { kind: 'lesson', sk, i };
  }
  function drillAsk(sk) {
    const d = SKILLS[sk].drill(H), [lay, tall] = d.layout.split(' ');
    const head = run ? runHead() : `${back()}<span class="tr-kick">Practise</span>`;
    const opts = lay === 'icons' ? `<div class="tk-opts sm">${d.opts.map(([v, l, ic]) => `<button data-t="ans" data-id="${v}">${ICON[ic || v]}<b>${esc(l)}</b></button>`).join('')}</div>`
      : lay === 'tiles' ? `<div class="tk-silpick sk-tiles${tall ? ' tall' : ''}">${d.opts.map(([v, h]) => `<button data-t="ans" data-id="${v}">${h}</button>`).join('')}</div>`
      : `<div class="tr-choices">${d.opts.map(([v, l]) => `<button data-t="ans" data-id="${v}">${esc(l)}</button>`).join('')}</div>`;
    frame(head, `<span class="tr-kick">Learn to look · ${esc(SKILLS[sk].name)}</span><p class="tr-ask">${d.ask}</p>${d.sub ? `<p class="tr-sub">${esc(d.sub)}</p>` : ''}${d.body || ''}${opts}<div class="tr-fb"></div>`);
    q = { kind: 'drill', skill: sk, right: d.right, why: d.why, about: d.about };
  }

  // ---- questions
  function choicesFor(t, pool) {
    const sameG = Object.keys(groupOf(t.id).tell).filter((x) => x !== t.id && pool.includes(x));
    const ids = [...new Set([...sameG, ...t.like.filter((x) => pool.includes(x)), ...shuffle(pool.filter((x) => x !== t.id)), ...shuffle(D.trees.map((x) => x.id).filter((x) => x !== t.id))])].filter((x) => x !== t.id).slice(0, 3);
    return shuffle([t.id, ...ids]).map((id) => by.get(id));
  }
  function ask(t, kind, pool) {
    const head = run ? `${back()}<span class="tr-prog">${run.steps.map((s, i) => `<i class="${i < run.i ? 'd' : i === run.i ? 'c' : ''}"></i>`).join('')}</span>` : `${back()}<span class="tr-kick">Practise</span>`;
    if (kind === 'trait' && !(t.arr === 'opposite' || t.arr === 'alternate')) kind = 'key';
    if (kind === 'key') {
      const steps = pathTo(t.id), [node, ans] = rand(steps.length > 1 ? steps.slice(1) : steps), n = KEY[node];
      const pic = node === 'arr' && HAS_OUTLINE(t.id) ? `<div class="sk-big">${twigSvg(t.id, { arr: t.arr })}</div><p class="sk-cap">A sketch of a ${esc(t.name.toLowerCase())} twig, with its traced leaf</p>` : (node === 'oak' || node === 'lobe' || node === 'opplobe') && HAS_OUTLINE(t.id) ? `<div class="sk-big">${leafSvg(t.id)}</div><p class="sk-cap">The ${esc(t.name.toLowerCase())} leaf, traced from a photo</p>` : img(photoOf(t, node === 'arr' ? ['twig', 'leaf'] : ['leaf', 'twig']), 'big');
      frame(head, `<p class="tr-ask">${esc(n.q)}</p><p class="tr-sub">${esc(t.name)}</p>${pic}<details class="sk-hint"><summary>How do I check?</summary>${esc(n.how)}</details><div class="tk-opts sm">${n.a.map(([label, ic], i) => `<button data-t="ans" data-id="${i}">${ICON[ic]}<b>${esc(label)}</b></button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: String(ans), node };
      return;
    }
    if (kind === 'flash') {
      const ch = choicesFor(t, pool), [u, credit, file] = poolPhoto(t.id);
      frame(head, `<p class="tr-ask">Which tree is this?</p><figure class="tr-ph big"><img src="${esc(u)}" alt=""><figcaption><span>${esc(credit)} · iNaturalist</span></figcaption></figure><div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div>${file ? `<button class="sk-link tn-hide" data-t="hidephoto" data-f="${esc(file)}">Bad photo? Hide it</button>` : ''}<div class="tr-fb"></div>`);
      q = { kind: 'photo', t, right: t.id };
      return;
    }
    if ((kind === 'shape' || kind === 'shapepick') && !HAS_LEAF(t.id)) kind = 'photo';
    if (kind === 'shapepick' && pool.filter(HAS_LEAF).length < 3) kind = 'shape';
    if (kind === 'shape') {
      const ch = choicesFor(t, pool);
      frame(head, `<p class="tr-ask">Which tree has this leaf?</p><div class="tk-bigsil">${leafSvg(t.id)}</div><div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: t.id };
      return;
    }
    if (kind === 'shapepick') {
      const ch = choicesFor(t, pool.filter(HAS_LEAF)).filter((c) => HAS_LEAF(c.id));
      frame(head, `<p class="tr-ask">Tap the leaf of the <b>${esc(t.name)}</b></p><div class="tk-silpick">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${leafSvg(c.id)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: t.id };
      return;
    }
    if (kind === 'groupq') {
      const others = shuffle(GROUPS.filter((g) => g.id !== GROUP_OF[t.id])).slice(0, 3);
      const gs = shuffle([groupOf(t.id), ...others]);
      frame(head, `<p class="tr-ask">Which group is this tree in?</p>${img(photoOf(t, ['leaf', 'fall', 'fruit']), 'big')}<div class="tr-choices">${gs.map((g) => `<button data-t="ans" data-id="${g.id}">${esc(g.name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: GROUP_OF[t.id] };
      return;
    }
    if (kind === 'photo') {
      const last = (store.get('trees.lastctx', {}))[t.id];
      const ps = t.photos.filter((p) => p.ctx !== last), sp = ps.filter((p) => SEASON_CTX[season()].includes(p.ctx)), p = rand(sp.length && Math.random() < 0.6 ? sp : ps.length ? ps : t.photos);
      const lc = store.get('trees.lastctx', {}); lc[t.id] = p.ctx; store.set('trees.lastctx', lc);
      const ch = choicesFor(t, pool);
      frame(head, `<p class="tr-ask">Which tree is this?</p>${img(p, 'big')}<div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: t.id };
    } else if (kind === 'pick') {
      const ch = choicesFor(t, pool);
      const cx = rand(['leaf', 'bark', 'leaf', 'form']);
      frame(head, `<p class="tr-ask">Tap the <b>${esc(t.name)}</b></p><div class="tr-pick">${ch.map((c) => { const p = photoOf(c, [cx]); return `<button data-t="ans" data-id="${c.id}"><img src="${esc(p.f)}" alt=""><small>${esc(CTX[p.ctx])}</small></button>`; }).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: t.id };
    } else if (kind === 'same') {
      const other = Math.random() < 0.5 ? t : by.get(rand(t.like.filter((x) => pool.includes(x)).length ? t.like.filter((x) => pool.includes(x)) : pool.filter((x) => x !== t.id)) || t.id);
      const a = photoOf(t, ['leaf', 'fall']), b = photoOf(other, ['bark', 'form', 'fruit', 'flower', 'twig']);
      frame(head, `<p class="tr-ask">Are these the same kind of tree?</p><div class="tr-two">${img(a)}${img(b)}</div><div class="tr-choices two"><button data-t="ans" data-id="yes">Same tree</button><button data-t="ans" data-id="no">Different trees</button></div><div class="tr-fb"></div>`);
      q = { kind, t, other, right: other === t ? 'yes' : 'no' };
    } else {
      const which = t.leaf === 'compound' || Math.random() < 0.35 ? 'leaf' : 'arr';
      const opts = which === 'arr' ? [['opposite', 'In pairs'], ['alternate', 'One at a time']] : [['simple', 'One leaf'], ['compound', 'Leaflets on one stalk']];
      frame(head, `<p class="tr-ask">${which === 'arr' ? `Do the leaves of the <b>${esc(t.name)}</b> grow in pairs, or one at a time?` : `Does the <b>${esc(t.name)}</b> have one leaf on each stalk, or leaflets?`}</p>${which === 'arr' && HAS_OUTLINE(t.id) ? `<div class="sk-big">${twigSvg(t.id, { arr: t.arr })}</div>` : which === 'leaf' && HAS_OUTLINE(t.id) ? `<div class="sk-big">${leafSvg(t.id)}</div>` : img(photoOf(t, ['leaf', 'twig']), 'big')}<div class="tr-choices two">${opts.map(([v, l]) => `<button data-t="ans" data-id="${v}">${l}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind: 'trait', t, right: t[which] };
    }
  }
  function answer(btn) {
    if (!q || q.done || !q.right) return;
    q.done = true;
    if (q.skill) {
      const ok = btn.dataset.id === q.right;
      if (run) { run.right += ok ? 1 : 0; const st = run.steps[run.i]; if (!st.review) { run.skr = run.skr || {}; const [r = 0, n = 0] = run.skr[q.skill] || []; run.skr[q.skill] = [r + (ok ? 1 : 0), n + 1]; } }
      for (const b of root.querySelectorAll('[data-t=ans]')) { b.disabled = true; if (b.dataset.id === q.right) b.classList.add('right'); }
      if (!ok) btn.classList.add('wrong');
      root.querySelector('.tr-fb').innerHTML = `<div class="tr-res ${ok ? 'ok' : 'no'}"><b>${ok ? '✓ Yes' : '✗ Not quite'}</b><p>${esc(q.why)}</p>${q.about ? `<p class="sk-about">That was ${/^[aeiou]/i.test(q.about.name) ? 'an' : 'a'} ${esc(q.about.name.toLowerCase())}.</p>` : ''}</div><button class="tr-go" data-t="next">Next</button>`;
      root.querySelector('.tr-go').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    const ok = btn.dataset.id === q.right, t = q.t;
    record(t.id, ok);
    if (run) { run.right += ok ? 1 : 0; }
    for (const b of root.querySelectorAll('[data-t=ans]')) { b.disabled = true; if (b.dataset.id === q.right) b.classList.add('right'); }
    if (!ok) btn.classList.add('wrong');
    let line = '';
    if (q.kind === 'key') line = `${esc(KEY[q.node].a[+q.right][0])}. The questions that lead to it: ${pathTo(t.id).map(([n, i]) => esc(KEY[n].a[i][0])).join(' › ')}.`;
    else if (q.kind === 'groupq') line = `One of the <b>${esc(groupOf(t.id).name.toLowerCase())}</b>: ${esc(groupOf(t.id).why)}`;
    else if (q.kind === 'same') line = q.right === 'yes' ? `Both are <b>${esc(t.name)}</b>.` : `The first is <b>${esc(t.name)}</b>; the second is <b>${esc(q.other.name)}</b>.`;
    else if (q.kind === 'pick' && !ok) line = `You tapped <b>${esc(by.get(btn.dataset.id).name)}</b>.`;
    else if (q.kind === 'photo' && !ok) { const w = by.get(btn.dataset.id); line = `That was ${esc(w.name)}: ${esc(groupOf(w.id).tell[w.id])}`; }
    if (q.kind === 'shapepick') for (const b of root.querySelectorAll('.tk-silpick button')) b.insertAdjacentHTML('beforeend', `<em>${esc(by.get(b.dataset.id).name)}</em>`);
    if ((q.kind === 'shape' || q.kind === 'shapepick') && !ok) { const w = by.get(btn.dataset.id); line = `${q.kind === 'shape' ? 'That' : 'You tapped the'} ${esc(w.name)}: ${esc(groupOf(w.id).tell[w.id])}`; }
    if (q.kind === 'pick') for (const b of root.querySelectorAll('.tr-pick button')) b.insertAdjacentHTML('beforeend', `<em>${esc(by.get(b.dataset.id).name)}</em>`);
    root.querySelector('.tr-fb').innerHTML = `<div class="tr-res ${ok ? 'ok' : 'no'}"><b>${ok ? '✓' : '✗'} ${esc(t.name)}</b>${line ? `<p>${line}</p>` : ''}<p>${esc(groupOf(t.id).tell[t.id])}</p></div><button class="tr-go" data-t="next">Next</button>`;
    root.querySelector('.tr-go').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---- today: meet a few new trees, then questions on them and on what is due
  function buildToday() {
    const m = met(), s = srs();
    const learnt = Object.keys(SKILLS).filter(skillDone);
    const revSkill = learnt.length && Math.random() < 0.5 ? [{ drill: rand(learnt), review: true }] : [];
    const mix = (qs) => { const x = shuffle(qs); for (let i = 1; i < x.length; i++) if (x[i].id && x[i].id === x[i - 1].id) { const j = x.findIndex((y, k) => k > i && y.id !== x[i].id); if (j > 0) [x[i], x[j]] = [x[j], x[i]]; } return x; };
    const kinds = ['flash', 'flash', 'photo', 'pick', 'same', 'key', 'groupq', 'shape', 'shapepick'];
    // the next trees on your local list (two a day; three on the very first day)
    const fresh = ranked().list.filter((t) => !m.includes(t.id)).slice(0, m.length ? 2 : 3).map((t) => t.id);
    const due = shuffle(m.filter((id) => isDue(id, s))).slice(0, Math.max(4, SET - fresh.length * 2));
    const steps = fresh.map((id, k) => ({ meet: id, k: k + 1, n: fresh.length }));
    const qs = [];
    for (const id of fresh) qs.push({ id, kind: 'flash' }, { id, kind: rand(['shape', 'photo']) }, { id, kind: rand(['pick', 'flash', 'key']) });
    for (const id of due) qs.push({ id, kind: rand(kinds) });
    const extra = shuffle(m.filter((id) => !due.includes(id)));
    while (qs.length < Math.min(SET + 2, (m.length + fresh.length) * 2) && extra.length) qs.push({ id: extra.pop(), kind: rand(['flash', 'photo', 'pick', 'same']) });
    return [...steps, ...mix([...qs, ...revSkill])];
  }
  function startToday() {
    const t = store.get('trees.today', {});
    if (t.d === today() && t.done) return practise();
    run = { steps: t.d === today() && t.steps && t.i < t.steps.length ? t.steps : buildToday(), i: t.d === today() && t.steps ? t.i : 0, right: (t.d === today() && t.right) || 0, today: true };
    step();
  }
  function saveRun(done = false) { if (run && run.today) store.set('trees.today', { d: today(), steps: run.steps, i: run.i, n: run.steps.length, right: run.right, done }); }
  function step() {
    if (!run) return hub();
    if (run.i >= run.steps.length) return finish();
    saveRun();
    const s = run.steps[run.i];
    if (s.group) return groupCard(GROUPS.find((g) => g.id === s.group), { meet: true });
    if (s.meet) return card(by.get(s.meet), { meet: true, k: s.k, n: s.n });
    if (s.lesson) return lesson(s.lesson);
    if (s.drill) return drillAsk(s.drill);
    const pool = [...new Set([...met(), s.id])];
    ask(by.get(s.id), pool.length < 2 ? 'trait' : s.kind, pool);
  }
  function next() {
    if (run) {
      const s = run.steps[run.i];
      if (s && s.meet) { const m = store.get('trees.met', []); if (!m.includes(s.meet)) { m.push(s.meet); store.set('trees.met', m); } }
      run.i++; return step();
    }
    practise();
  }
  function finish() {
    const n = run.steps.filter((s) => !s.meet && !s.group && !s.lesson).length, r = run.right, wasToday = run.today;
    const skl = Object.entries(run.skr || {}).map(([sk, [sr, sn]]) => {
      const was = skillDone(sk), ok = skillResult(sk, sr, sn);
      return `<div class="tr-res ${ok ? 'ok' : 'no'}"><b>${ok ? '✓' : '·'} ${esc(SKILLS[sk].name)}: ${sr} of ${sn}</b><p>${ok ? (was ? 'Still easy for you.' : 'Learned. It will come up now and then so it stays easy.') : `You need ${PASS} of ${sn}. It comes back next time, with the lesson first.`}</p></div>`;
    }).join('');
    if (wasToday) { saveRun(true); const days = store.get('trees.days', []); if (!days.includes(today())) { days.push(today()); store.set('trees.days', days.slice(-400)); } }
    run = null;
    const nx = ranked().list.find((x) => !met().includes(x.id));
    frame(back(), `<div class="tr-done"><h2>${wasToday ? 'Done for today' : 'Practice done'}</h2><p><b>${r}</b> of ${n} right · ${met().length} of ${D.trees.length} trees met${streak() ? ` · ${streak()}-day streak` : ''}</p>${skl}
      ${nx ? `<p class="tr-sci">Next on your list: <b>${esc(nx.name)}</b>.</p>` : ''}
      ${wasToday ? '<p class="tr-sci">The trees you have met come back tomorrow, in three days, in a week: each time from a different side.</p>' : ''}
      <button class="tr-go" data-t="hub">Back to the trees</button>${nx && wasToday ? `<button class="tr-card wide" data-t="more"><b>Keep going</b><small>meet the ${esc(nx.name.toLowerCase())}</small></button>` : '<button class="tr-card wide" data-t="practise">Keep practising</button>'}</div>`);
  }
  function practise() {
    run = null;
    const m = met(), learnt = Object.keys(SKILLS).filter(skillDone);
    if (m.length < 2 && !learnt.length) return hub();
    const s = srs(), due = m.filter((id) => isDue(id, s));
    if (learnt.length && (m.length < 2 || Math.random() < 0.25)) return drillAsk(rand(learnt));
    const id = rand(due.length ? due : m);
    ask(by.get(id), rand(['flash', 'flash', 'photo', 'pick', 'same', 'key', 'groupq', 'shape', 'shapepick']), m);
  }

  const actions = {
    // (the home page is drawn under this screen: step aside for it, and come back if Trees is chosen again)
    identify: () => identify(), keypick: keyPick, groupcard: (b) => groupCard(GROUPS.find((g) => g.id === b.dataset.g), { from: b.dataset.from }),
    home: async () => { root.hidden = true; if (ctx.showHome) await ctx.showHome(); if (ctx.mode === 'trees') { root.hidden = false; hub(); } }, hub, today: startToday, practise, guide, next, ans: answer,
    card: (b) => card(by.get(b.dataset.id), { from: b.dataset.from }),
    lesson: (b) => { run = null; lesson(b.dataset.sk); },
    spot: spotPicker, spotmap: spotFromMap, spotclear: () => { store.set('trees.spot', null); hub(); },
    spotset: (b) => { const a = store.get('anchors', [])[+b.dataset.i]; if (a) store.set('trees.spot', { name: a.name, pt: a.pt }); hub(); },
    quick: quickStart, qans: quickAnswer,
    hidephoto: (b) => { const h = hidden(); if (!h.includes(b.dataset.f)) { h.push(b.dataset.f); store.set('trees.hidden', h.slice(-500)); } b.textContent = 'Hidden: you won’t see it again'; b.disabled = true; }, lstep: (b) => lesson(b.dataset.sk, +b.dataset.i),
    drillrun: (b) => { run = { steps: Array.from({ length: DRILL_N }, () => ({ drill: b.dataset.sk })), i: 0, right: 0, today: false }; step(); },
    more: () => { run = { steps: buildToday(), i: 0, right: 0, today: true }; step(); },
    where: (b) => where(by.get(b.dataset.id)),
    unpeek: () => { root.classList.remove('peek'); document.querySelector('.tr-peekback')?.remove(); ctx.hud(''); if (layer) map.setLayoutProperty('trees-pts', 'visibility', 'none'); },
  };

  return {
    async enter() {
      document.body.classList.add('trees-on');
      await load(); mount(); root.hidden = false;
      ctx.clearHighlights && ctx.clearHighlights(); ctx.sheet(''); ctx.hud('');
      hub();
    },
    leave() {
      document.body.classList.remove('trees-on');
      if (root) root.hidden = true;
      if (layer) map.setLayoutProperty('trees-pts', 'visibility', 'none');
      document.querySelector('.tr-peekback')?.remove();
      ctx.hud('');
    },
  };
}
