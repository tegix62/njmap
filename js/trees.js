// Trees of New Jersey: the app's way of teaching places, pointed at trees. A few minutes a day; a tree is met once (its photos and its tell),
// then comes back spaced out over days, each time from a different side: its leaf, its bark, its shape, its fruit; named from a photo, picked
// out of four photos, matched across two photos, and one fact about its leaves. Where it has been seen in New Jersey is shown on the map.
// Data: data/trees.json (tools/build_trees.py: iNaturalist photos and sightings; the tells were checked against Wikipedia in November 2026, see the README).
import { GROUPS, GROUP_OF, KEY, ICON, pathTo, treesUnder } from './treekey.js';
import { leafSvg } from './treeleaf.js';
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
  let D = null, by = null, root = null, q = null, run = null, layer = false;

  async function load() {
    if (D) return;
    D = await fetch('data/trees.json').then((r) => r.json());
    by = new Map(D.trees.map((t) => [t.id, t]));
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
  /** The key's path to a tree, as a row of small drawings with their answers. */
  const pathHtml = (id, upTo) => `<div class="tk-path">${pathTo(id).slice(0, upTo).map(([n, i]) => { const [label, ic] = KEY[n].a[i]; return `<span>${ICON[ic]}<small>${esc(label)}</small></span>`; }).join('<i>›</i>')}</div>`;
  /** A group side by side: what puts a tree in it, how the key gets there, and each member's leaf and bark with the one thing that tells it apart. */
  function groupCard(g, opts = {}) {
    const ms = Object.keys(g.tell).map((id) => by.get(id)).filter(Boolean);
    frame(opts.meet ? `<span class="tr-kick">New group</span>` : back(opts.from === 'guide' ? 'Field guide' : 'Trees'),
      `<h2>${esc(g.name)}</h2><p class="tr-why">${esc(g.why)}</p>${pathHtml(ms[0].id, ms.every((t) => pathTo(t.id).length === pathTo(ms[0].id).length) ? undefined : -1)}
      <h4>How to tell them apart</h4>
      <div class="tk-cmp">${ms.map((t) => `<button class="tk-col" data-t="card" data-id="${t.id}"><div class="tk-sil">${leafSvg(t.id)}</div><div class="tk-pics"><img src="${esc(photoOf(t, ['leaf']).f)}" alt=""><img src="${esc(photoOf(t, ['bark']).f)}" alt=""></div><b>${esc(t.name)}</b><small>${esc(g.tell[t.id])}</small></button>`).join('')}</div>
      ${opts.meet ? '<button class="tr-go" data-t="next">Meet them one by one</button>' : ''}`);
    q = { kind: 'group', g };
  }
  /** Identify: the key, one question at a time, with the trees it still leaves; at a group, its side-by-side card. */
  function identify(node = 'start', trail = []) {
    const n = KEY[node];
    const left = trail.length ? treesUnder(...trail[trail.length - 1]) : Object.keys(GROUP_OF);
    frame(back(), `<span class="tr-kick">Identify a tree</span><p class="tr-ask">${esc(n.q)}</p>
      <div class="tk-opts">${n.a.map(([label, ic], i) => `<button data-t="keypick" data-node="${node}" data-i="${i}" data-trail='${esc(JSON.stringify(trail))}'>${ICON[ic]}<b>${esc(label)}</b><small>${treesUnder(node, i).length} tree${treesUnder(node, i).length === 1 ? '' : 's'}</small></button>`).join('')}</div>
      ${trail.length ? `<div class="tk-trail">${trail.map(([tn, ti]) => `<span>${esc(KEY[tn].a[ti][0])}</span>`).join(' › ')}</div>` : ''}
      <h4>Still possible: ${left.length}</h4><div class="tk-left">${left.map((id) => `<span title="${esc(by.get(id).name)}">${leafSvg(id)}</span>`).join('')}</div>`);
  }
  function keyPick(b) {
    const node = b.dataset.node, i = +b.dataset.i, trail = [...JSON.parse(b.dataset.trail), [node, i]];
    const t = KEY[node].a[i][2];
    if (t.to) return identify(t.to, trail);
    groupCard(GROUPS.find((g) => g.id === t.group));
  }

  function hub() {
    q = null; run = null;
    const m = met(), t = store.get('trees.today', {}), doneToday = t.d === today() && t.done;
    const due = m.filter((id) => isDue(id)).length, left = D.trees.length - m.length;
    const C = 2 * Math.PI * 21, frac = doneToday ? 1 : t.d === today() && t.n ? t.i / t.n : 0;
    const plan = doneToday ? `Done today ✓${streak() ? ` · ${streak()}-day streak` : ''}` : m.length ? `${due} to review${left ? ` · a new group` : ''}` : `Meet your first group: the ${esc(GROUPS[0].name.toLowerCase())}`;
    frame(`<button class="tr-back" data-t="home"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Home</button><h1>Trees of New Jersey</h1>`,
      `<button class="tr-today${doneToday ? ' done' : ''}" data-t="today"><span><b>${doneToday ? 'Today is done' : t.d === today() && t.i ? 'Carry on today' : 'Start today'}</b><small>${esc(plan)}</small></span>
        <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="21" class="bg"/><circle cx="26" cy="26" r="21" class="fg" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/></svg></button>
      <div class="tr-stats"><span><b>${m.length}</b> of ${D.trees.length} met</span><span><b>${learned()}</b> learned</span><span><b>${streak()}</b> day streak</span></div>
      <div class="tr-row"><button class="tr-card" data-t="identify"><b>Identify a tree</b><small>a few yes/no questions, with pictures</small></button>
        <button class="tr-card" data-t="practise"${m.length < 2 ? ' disabled' : ''}><b>Practise</b><small>${m.length < 2 ? 'after you meet two trees' : 'endless, the trees you know'}</small></button></div>
      <h4>The groups</h4>
      <div class="tk-groups">${GROUPS.map((g) => { const ids = Object.keys(g.tell), k = ids.filter((id) => m.includes(id)).length; return `<button class="tk-grp${k ? '' : ' new'}" data-t="groupcard" data-g="${g.id}"><span class="tk-thumbs">${ids.map((id) => `<img src="${esc(photoOf(by.get(id), ['leaf']).f)}" alt="" loading="lazy">`).join('')}</span><span class="tk-gt"><b>${esc(g.name)}</b><small>${k ? `${k} of ${ids.length} met` : 'not met yet'}</small></span></button>`; }).join('')}</div>
      <button class="tr-card wide" data-t="guide"><b>Field guide</b><small>every tree, its photos and where it grows</small></button>
      <p class="tr-note">Photos and sightings: iNaturalist, each under its own licence. The identifying tips were checked against each tree’s Wikipedia article (November 2026); if your field guide disagrees, trust the book.</p>`);
  }

  /** A tree's page: all its photos, its tell, and where it has been seen. */
  function card(t, opts = {}) {
    const top3 = Object.keys(t.counties).slice(0, 3);
    frame(opts.meet ? `<span class="tr-kick">New tree · ${opts.k} of ${opts.n}</span>` : back(opts.from === 'guide' ? 'Field guide' : 'Trees'),
      `<h2>${esc(t.name)}</h2><p class="tr-sci">${esc(t.sci)}</p>
      <div class="tr-strip">${t.photos.map((p) => img(p)).join('')}</div>
      <div class="tk-tellrow"><div class="tk-sil">${leafSvg(t.id)}</div><p class="tr-tell">${esc(t.tell)}</p></div>
      <button class="tk-ingroup" data-t="groupcard" data-g="${groupOf(t.id).id}"><small>One of the <b>${esc(groupOf(t.id).name.toLowerCase())}</b>: ${esc(groupOf(t.id).tell[t.id])}</small></button>
      ${pathHtml(t.id)}
      <div class="tr-facts">${t.arr === 'opposite' || t.arr === 'alternate' ? `<span>Leaves <b>${t.arr}</b> on the twig</span><span><b>${t.leaf === 'compound' ? 'Compound' : 'Simple'}</b> leaf</span>` : `<span>An evergreen with <b>${t.arr}</b></span>`}</div>
      ${t.checked ? `<p class="tr-src">Checked against <a href="${esc(t.checked.src)}" target="_blank" rel="noopener">Wikipedia</a>${t.checked.note ? `. ${esc(t.checked.note)}` : ''}</p>` : ''}
      <button class="tr-where" data-t="where" data-id="${t.id}"><b>Where it has been seen</b><small>${top3.length ? `Most in ${esc(top3.join(', '))}` : ''} · show on the map</small></button>
      ${opts.meet ? '<button class="tr-go" data-t="next">Got it</button>' : ''}`);
    q = { kind: 'card', t, opts };
  }
  function guide() {
    frame(back(), `<h2>Field guide</h2>${GROUPS.map((g) => `<button class="tk-gh" data-t="groupcard" data-g="${g.id}" data-from="guide">${esc(g.name)} <span>compare ›</span></button><div class="tr-list">${Object.keys(g.tell).map((id) => by.get(id)).map((t) => `<button class="tr-li" data-t="card" data-id="${t.id}" data-from="guide"><span class="tk-li-sil">${leafSvg(t.id)}</span><span><b>${esc(t.name)}</b><small>${esc(g.tell[t.id])}</small></span></button>`).join('')}</div>`).join('')}`);
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
      frame(head, `<p class="tr-ask">${esc(n.q)}</p><p class="tr-sub">${esc(t.name)}</p>${img(photoOf(t, ['leaf', 'twig']), 'big')}<div class="tk-opts sm">${n.a.map(([label, ic], i) => `<button data-t="ans" data-id="${i}">${ICON[ic]}<b>${esc(label)}</b></button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: String(ans), node };
      return;
    }
    if (kind === 'shape') {
      const ch = choicesFor(t, pool);
      frame(head, `<p class="tr-ask">Which tree has this leaf?</p><div class="tk-bigsil">${leafSvg(t.id)}</div><div class="tr-choices">${ch.map((c) => `<button data-t="ans" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind, t, right: t.id };
      return;
    }
    if (kind === 'shapepick') {
      const ch = choicesFor(t, pool);
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
      const ps = t.photos.filter((p) => p.ctx !== last), p = rand(ps.length ? ps : t.photos);
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
      const opts = which === 'arr' ? [['opposite', 'Opposite: in pairs'], ['alternate', 'Alternate: one at a time']] : [['simple', 'Simple: one blade'], ['compound', 'Compound: many leaflets']];
      frame(head, `<p class="tr-ask">${which === 'arr' ? `How do the leaves of <b>${esc(t.name)}</b> sit on the twig?` : `Is the leaf of <b>${esc(t.name)}</b> simple or compound?`}</p>${img(photoOf(t, ['leaf', 'twig']), 'big')}<div class="tr-choices two">${opts.map(([v, l]) => `<button data-t="ans" data-id="${v}">${l}</button>`).join('')}</div><div class="tr-fb"></div>`);
      q = { kind: 'trait', t, right: t[which] };
    }
  }
  function answer(btn) {
    if (!q || q.done || !q.right) return;
    q.done = true;
    const ok = btn.dataset.id === q.right, t = q.t;
    record(t.id, ok);
    if (run) { run.right += ok ? 1 : 0; }
    for (const b of root.querySelectorAll('[data-t=ans]')) { b.disabled = true; if (b.dataset.id === q.right) b.classList.add('right'); }
    if (!ok) btn.classList.add('wrong');
    let line = '';
    if (q.kind === 'key') line = `${esc(KEY[q.node].a[+q.right][0])}. The key for it: ${pathTo(t.id).map(([n, i]) => esc(KEY[n].a[i][0])).join(' › ')}.`;
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
    // the next group not yet met (and the one after it when a group is a single tree), each tree of it met in turn, after the group's side-by-side card
    const fresh = [], gsNew = [];
    for (const g of GROUPS) {
      const ids = Object.keys(g.tell).filter((id) => by.has(id) && !m.includes(id));
      if (!ids.length) continue;
      gsNew.push(g.id); fresh.push(...ids);
      if (fresh.length >= 2) break;
    }
    const due = shuffle(m.filter((id) => isDue(id, s))).slice(0, Math.max(4, SET - fresh.length * 2));
    const steps = [];
    for (const gid of gsNew) { const ids = fresh.filter((id) => GROUP_OF[id] === gid); steps.push({ group: gid }); ids.forEach((id, k) => steps.push({ meet: id, k: k + 1, n: ids.length })); }
    const qs = [];
    for (const id of fresh) qs.push({ id, kind: rand(['shape', 'shapepick']) }, { id, kind: 'photo' }, { id, kind: rand(['pick', 'key']) });
    for (const id of due) qs.push({ id, kind: rand(['photo', 'photo', 'pick', 'same', 'key', 'groupq', 'shape', 'shapepick']) });
    const extra = shuffle(m.filter((id) => !due.includes(id)));
    while (qs.length < Math.min(SET + 2, (m.length + fresh.length) * 2) && extra.length) qs.push({ id: extra.pop(), kind: rand(['photo', 'pick', 'same', 'groupq']) });
    const mixed = shuffle(qs); for (let i = 1; i < mixed.length; i++) if (mixed[i].id === mixed[i - 1].id) { const j = mixed.findIndex((x, k) => k > i && x.id !== mixed[i].id); if (j > 0) [mixed[i], mixed[j]] = [mixed[j], mixed[i]]; }
    return [...steps, ...mixed];
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
    const n = run.steps.filter((s) => !s.meet).length, r = run.right;
    if (run.today) { saveRun(true); const days = store.get('trees.days', []); if (!days.includes(today())) { days.push(today()); store.set('trees.days', days.slice(-400)); } }
    run = null;
    frame(back(), `<div class="tr-done"><h2>Done for today</h2><p><b>${r}</b> of ${n} right · ${met().length} of ${D.trees.length} trees met${streak() ? ` · ${streak()}-day streak` : ''}</p>
      <p class="tr-sci">They come back tomorrow, in three days, in a week: each time from a different side.</p><button class="tr-go" data-t="hub">Back to the trees</button><button class="tr-card wide" data-t="practise">Keep practising</button></div>`);
  }
  function practise() {
    run = null;
    const m = met(); if (m.length < 2) return hub();
    const s = srs(), due = m.filter((id) => isDue(id, s));
    const id = rand(due.length ? due : m);
    ask(by.get(id), rand(['photo', 'photo', 'pick', 'same', 'key', 'groupq', 'shape', 'shapepick']), m);
  }

  const actions = {
    // (the home page is drawn under this screen: step aside for it, and come back if Trees is chosen again)
    identify: () => identify(), keypick: keyPick, groupcard: (b) => groupCard(GROUPS.find((g) => g.id === b.dataset.g), { from: b.dataset.from }),
    home: async () => { root.hidden = true; if (ctx.showHome) await ctx.showHome(); if (ctx.mode === 'trees') { root.hidden = false; hub(); } }, hub, today: startToday, practise, guide, next, ans: answer,
    card: (b) => card(by.get(b.dataset.id), { from: b.dataset.from }),
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
