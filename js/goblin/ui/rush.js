// Rush (redesign R2, a prototype): the quiz IS the war. A name appears; you find that township on the real map and tap it. Right: your army walks
// the border path from your nearest township and takes it. Wrong: the map shows you where it was. Now and then a rival army sets out for one of your
// towns and you have to find the threatened place before it arrives. No dice, no menus, no numbers: knowing the map is the only verb.
// It runs on a throwaway copy of who owns what; nothing is written to the war save (the reviews it writes are real, like a quiz charge).
const COLOUR = { goblins: '#3f9b5a', rats: '#b9712f', toads: '#3a86a8', gnomes: '#8b5cf6', dwarves: '#a16207' };
const NO = { goblins: 1, rats: 2, toads: 3, gnomes: 4, dwarves: 5 };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const bearingOf = (a, b) => { const r = Math.PI / 180, dl = (b[0] - a[0]) * r, y = Math.sin(dl) * Math.cos(b[1] * r), x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos(dl); return (Math.atan2(y, x) / r + 360) % 360; };
const shortest = (from, to) => from + ((((to - from) % 360) + 540) % 360) - 180;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const ROUNDS = 10, ATTACK_SECONDS = 14, DEFEND_SECONDS = 11;

/** The shortest border path from `target` to the nearest township `isMine` accepts, returned from that township to the target. Pure. */
export function marchPath(board, target, isMine) {
  const prev = new Map([[target, null]]); const q = [target];
  for (let i = 0; i < q.length; i++) {
    const t = q[i];
    if (t !== target && isMine(t)) { const out = []; for (let c = t; c; c = prev.get(c)) out.push(c); return out; }
    for (const n of board.neighbours(t)) if (!prev.has(n)) { prev.set(n, t); q.push(n); }
  }
  return null;
}

export function createRush({ map, byKey, board, locate, hooks, me = 'goblins' }) {
  let el = null, banners = [], markers = [], off = null, run = 0;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pt = (id) => byKey.get(id).pt;
  const name = (id) => byKey.get(id).n;

  // ---- camera and banners (the banner look is the film's: a flag over a crowd of tiny soldiers)
  const eased = (ms, fn, alive) => new Promise((res) => { const t0 = performance.now(); (async function loop() { for (;;) { if (!alive()) return res(); const t = Math.min(1, (performance.now() - t0) / ms); fn(t); if (t >= 1) return res(); await frame(); } })(); });
  /** An army: a flag leading a column of little soldiers, each a step behind the one in front. place(path, t) puts it t (0..1) of the way along a list of points. */
  const FIGS = 13;
  const segs = (ps) => { const seg = []; let tot = 0; for (let i = 0; i < ps.length - 1; i++) { const d = Math.hypot((ps[i + 1][0] - ps[i][0]) * 0.75, ps[i + 1][1] - ps[i][1]); seg.push(d); tot += d; } return { seg, tot }; };
  function along(ps, t) {
    const { seg, tot } = segs(ps);
    let at = Math.max(0, Math.min(1, t)) * tot, i = 0;
    while (i < seg.length - 1 && at > seg[i]) { at -= seg[i]; i++; }
    const f = seg[i] ? Math.min(1, at / seg[i]) : 0, a = ps[i], z = ps[i + 1];
    return { pos: [lerp(a[0], z[0], f), lerp(a[1], z[1], f)], leg: i, brg: bearingOf(a, z) };
  }
  /** The polyline from its start to t (0..1) of the way: the trail an army has left. */
  function cut(ps, t) {
    const { seg, tot } = segs(ps); let rem = Math.max(0, Math.min(1, t)) * tot; const out = [ps[0]];
    for (let i = 0; i < seg.length; i++) { if (rem >= seg[i]) { out.push(ps[i + 1]); rem -= seg[i]; } else { const f = seg[i] ? rem / seg[i] : 0; out.push([lerp(ps[i][0], ps[i + 1][0], f), lerp(ps[i][1], ps[i + 1][1], f)]); break; } }
    return out;
  }
  function banner(clan) {
    const mk = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.style.setProperty('--c', COLOUR[clan]); d.innerHTML = html; return new maplibregl.Marker({ element: d, anchor: 'bottom' }).setLngLat([0, 0]).addTo(map); };
    const flag = mk('gfb', '<div class="fb-flag"><b>⚑</b></div>');
    const figs = Array.from({ length: FIGS }, (_, i) => mk('gfig' + (i % 3 ? '' : ' big'), '<i></i>'));
    const b = { clan, flag, figs, el: flag.getElement(), path: null, place(path, t) {
      b.path = path; const ps = path.map(pt);
      flag.setLngLat(along(ps, t).pos);
      const tot = segs(ps).tot || 1; figs.forEach((m, i) => { const lag = (i + 1) * 0.0024 / tot, o = along(ps, Math.max(0, t - lag)); const side = ((i * 7919) % 13 - 6) * 0.00022; m.setLngLat([o.pos[0] + side, o.pos[1] + ((i * 31) % 7 - 3) * 0.00012]); m.getElement().style.opacity = t - lag < -0.001 ? 0 : 1; });
    } };
    banners.push(b); return b;
  }
  const drop = (b) => { b.flag.remove(); b.figs.forEach((m) => m.remove()); banners = banners.filter((x) => x !== b); };
  // the trail an army leaves: a glowing line along the border path, drawn as it walks
  const TRAIL = 'rushtrail';
  function trail(coords, colour) {
    if (!map.getSource(TRAIL)) {
      map.addSource(TRAIL, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: TRAIL + '-halo', type: 'line', source: TRAIL, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-width': 11, 'line-opacity': 0.55, 'line-blur': 2 } });
      map.addLayer({ id: TRAIL, type: 'line', source: TRAIL, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 6 } });
    }
    map.getSource(TRAIL).setData({ type: 'FeatureCollection', features: coords && coords.length > 1 ? [{ type: 'Feature', properties: { c: colour }, geometry: { type: 'LineString', coordinates: coords } }] : [] });
  }
  const trailOff = () => { if (map.getSource(TRAIL)) trail(null); };
  const trailUpTo = (ps, t) => cut(ps, t);
  function burst(p, cls) { const d = document.createElement('div'); d.className = 'rb ' + cls; const m = new maplibregl.Marker({ element: d }).setLngLat(p).addTo(map); markers.push(m); setTimeout(() => { m.remove(); markers = markers.filter((x) => x !== m); }, 1400); }
  const clearAll = () => { for (const b of [...banners]) drop(b); for (const m of markers) m.remove(); markers = []; trailOff(); };

  function overview(ids, ms = 900) { const ps = ids.map(pt), b = ps.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [180, 90, -180, -90]); map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 150, bottom: 70, left: 24, right: 24 }, bearing: 0, pitch: 0, duration: ms, essential: true }); return sleep(ms + 80); }
  /** March an army along township ids with a lit trail and the camera swooping in behind it, tilted and turning at each bend. */
  async function walk(b, ids, ms, alive) {
    const ps = ids.map(pt); if (ps.length < 2) return;
    const colour = COLOUR[b.clan];
    b.place(ids, 0);
    const start = along(ps, 0);
    // swoop in behind the army before it moves
    const from = { c: map.getCenter(), z: map.getZoom(), br: map.getBearing(), p: map.getPitch() };
    await eased(650, (t) => { const k = ease(t); map.jumpTo({ center: [lerp(from.c.lng, start.pos[0], k), lerp(from.c.lat, start.pos[1], k)], zoom: lerp(from.z, 11.4, k), bearing: lerp(from.br, shortest(from.br, start.brg), k), pitch: lerp(from.p, 52, k) }); }, alive);
    let br = start.brg, z = 11.4, p = 52;
    await eased(ms, (t) => {
      const k = ease(t), cur = along(ps, k);
      b.place(ids, k); trail(trailUpTo(ps, k), colour);
      br = lerp(br, shortest(br, cur.brg), 0.08); z = lerp(z, 11.8, 0.04); p = lerp(p, 56, 0.04);
      const bob = Math.sin(t * ms / 90) * 0.0004;
      map.jumpTo({ center: [cur.pos[0], cur.pos[1] + bob], zoom: z, bearing: br, pitch: p });
    }, alive);
  }
  /** A short shake of the whole map and a buzz, for an impact. */
  async function shake(alive, amp = 0.0016) { const c0 = map.getCenter(); await eased(380, (t) => { const d = (1 - t) * amp; map.jumpTo({ center: [c0.lng + Math.sin(t * 60) * d, c0.lat + Math.cos(t * 47) * d] }); }, alive); if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) { /* not available */ } }

  const $ = (s) => el.querySelector(s);
  function mount() {
    el = document.createElement('div'); el.id = 'rush';
    el.innerHTML = `<div class="rs-top"><div class="rs-kind"></div><div class="rs-name"></div><div class="rs-bar"><i></i></div></div><div class="rs-score"></div><div class="rs-msg" hidden></div><button class="rs-quit" type="button">Leave</button>`;
    document.body.appendChild(el);
    $('.rs-quit').addEventListener('click', () => { run++; });
  }
  const setPrompt = (kind, text) => { $('.rs-kind').textContent = kind; $('.rs-name').textContent = text; };
  const msg = (t, tone = '') => { const m = $('.rs-msg'); if (!t) { m.hidden = true; return; } m.textContent = t; m.className = 'rs-msg ' + tone; m.hidden = false; };
  const bar = (f) => { if (!el) return; $('.rs-bar i').style.width = Math.max(0, f * 100) + '%'; };

  /** Wait for a tap on the map. Resolves { key } (the township under it, or null) or { timeout: true }. Wrong taps are reported through `onTap`; return true from it to keep waiting. */
  function waitTap(seconds, alive, onTick, onTap) {
    return new Promise((res) => {
      const t0 = performance.now(); let done = false;
      const finish = (v) => { if (done) return; done = true; map.off('click', h); res(v); };
      const h = (e) => { const m = locate([e.lngLat.lng, e.lngLat.lat]); const out = onTap(m ? m.key : null, e.lngLat); if (out !== true) finish({ key: m ? m.key : null, lngLat: e.lngLat }); };
      map.on('click', h);
      (async () => { for (;;) { if (done) return; if (!alive()) return finish({ quit: true }); const f = 1 - (performance.now() - t0) / (seconds * 1000); bar(f); if (onTick) onTick(f); if (f <= 0) return finish({ timeout: true }); await frame(); } })();
    });
  }

  async function play(world) {
    const my = ++run, alive = () => run === my;
    const owner = {}; for (const id of Object.keys(world.towns)) owner[id] = world.towns[id].owner;
    const start = Object.values(owner).filter((o) => o === me).length;
    const ids = Object.keys(owner).filter((id) => byKey.has(id));
    const mine = (id) => owner[id] === me;
    const stats = { found: 0, asked: 0, held: 0, lost: 0, taken: 0 };
    hooks.begin(owner); mount(); requestAnimationFrame(() => el.classList.add('on'));
    const score = () => { const n = Object.values(owner).filter((o) => o === me).length; $('.rs-score').innerHTML = `<b>${n}</b> held`; };
    score();
    await overview(ids, 700);
    // a seeded-free mix (this is a prototype): attack, attack, defend, ...
    for (let r = 0; r < ROUNDS && alive(); r++) {
      const border = ids.filter((id) => mine(id) && board.neighbours(id).some((n) => owner[n] && owner[n] !== me && owner[n] !== 'dwarves' && byKey.has(n)));
      const targets = ids.filter((id) => !mine(id) && owner[id] !== 'dwarves' && board.neighbours(id).some((n) => mine(n)));
      const defend = (r % 3 === 2) && border.length;
      if (!defend && !targets.length) break;
      msg(''); bar(1); await overview(ids, 600);
      if (defend) {
        const B = border[Math.floor(Math.random() * border.length)];
        const E = board.neighbours(B).filter((n) => owner[n] && owner[n] !== me && owner[n] !== 'dwarves' && byKey.has(n)).sort(() => Math.random() - 0.5)[0];
        const clan = owner[E];
        setPrompt('A RIVAL ARMY IS COMING FOR', name(B)); stats.asked++;
        const eb = banner(clan), route = [E, B], eps = route.map(pt); let prog = 0; const t0 = performance.now(), ms = DEFEND_SECONDS * 1000; eb.place(route, 0);
        let stop = false;
        (async () => { for (;;) { if (stop || !alive()) return; const f = Math.min(1, (performance.now() - t0) / ms); prog = f * 0.9; eb.place(route, prog); trail(trailUpTo(eps, prog), '#ef4444'); if (f >= 1) return; await frame(); } })();
        const res = await waitTap(DEFEND_SECONDS, alive, null, (key, ll) => { if (key === B) return false; if (key) { msg(`Not ${name(key)}. Find ${name(B)}.`, 'bad'); const m = new maplibregl.Marker({ color: '#b91c1c' }).setLngLat(ll).addTo(map); markers.push(m); setTimeout(() => m.remove(), 1200); return true; } return true; });
        stop = true;
        if (res.quit) break;
        if (res.key === B) {
          stats.held++; stats.found++; hooks.review(B, true);
          burst(pt(B), 'shield'); msg(`${name(B)} is ready. They turn back.`, 'good');
          const p0 = prog; await eased(1100, (t) => { eb.place(route, p0 * (1 - ease(t))); trail(trailUpTo(eps, p0 * (1 - ease(t)) + 0.0001), '#60a5fa'); }, alive); trailOff(); await sleep(300); drop(eb);
        } else {
          hooks.review(B, false); stats.lost++; owner[B] = clan; hooks.setOwner(B, NO[clan]);
          await overview([B, E], 500); await eased(700, (t) => { eb.place(route, lerp(prog, 1, ease(t))); trail(trailUpTo(eps, lerp(prog, 1, ease(t))), '#ef4444'); }, alive); burst(pt(B), 'loss'); await shake(alive, 0.0022); msg(`${name(B)} fell. It was here.`, 'bad'); await sleep(1500); trailOff(); drop(eb);
        }
      } else {
        const T = targets[Math.floor(Math.random() * targets.length)];
        setPrompt('FIND', name(T)); stats.asked++;
        const res = await waitTap(ATTACK_SECONDS, alive, null, () => false);
        if (res.quit) break;
        if (res.key === T) {
          stats.found++; stats.taken++; hooks.review(T, true);
          const path = marchPath(board, T, mine); msg(''); setPrompt('MARCH', name(T));
          const ab = banner(me); await walk(ab, path, 1800 + 1300 * (path.length - 1), alive);
          owner[T] = me; hooks.setOwner(T, NO[me]); hooks.flash(T, true); burst(pt(T), 'win'); ab.el.classList.add('plant'); msg(`${name(T)} is yours.`, 'good'); score(); await shake(alive); hooks.flash(T, false); await sleep(1100); trailOff(); drop(ab);
        } else {
          hooks.review(T, false);
          setPrompt('IT WAS HERE', name(T)); msg(res.timeout ? 'Too slow.' : res.key ? `That was ${name(res.key)}.` : 'Not on the war map.', 'bad');
          hooks.flash(T, true); map.flyTo({ center: pt(T), zoom: 10.8, duration: 1000, essential: true }); burst(pt(T), 'loss'); await sleep(2200); hooks.flash(T, false);
        }
      }
      score();
    }
    const end = Object.values(owner).filter((o) => o === me).length;
    if (alive()) {
      await overview(ids, 600);
      msg(''); el.insertAdjacentHTML('beforeend', `<div class="rs-end"><h3>${end > start ? 'You pushed the border out' : end === start ? 'You held the line' : 'The border moved against you'}</h3><p>${start} → <b>${end}</b> townships · found <b>${stats.found}</b> of ${stats.asked}</p><div class="rs-row"><button class="primary" data-r="again">Again</button><button data-r="done">Done</button></div></div>`);
      const choice = await new Promise((res) => { el.querySelector('.rs-end').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) res(b.dataset.r); }); const iv = setInterval(() => { if (!alive()) { clearInterval(iv); res('done'); } }, 200); });
      clearAll(); el.remove(); el = null; hooks.end();
      return choice === 'again' ? play(world) : stats;
    }
    clearAll(); if (el) { el.remove(); el = null; } hooks.end(); return stats;
  }
  return { play, stop() { run++; } };
}
