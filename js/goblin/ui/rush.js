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
  function banner(clan, p) {
    const d = document.createElement('div'); d.className = 'fb'; d.style.setProperty('--c', COLOUR[clan]);
    d.innerHTML = `<div class="fb-flag"><b>⚑</b></div><div class="fb-crowd">${'<i></i>'.repeat(9)}</div>`;
    const b = { el: d, mk: new maplibregl.Marker({ element: d, anchor: 'bottom' }).setLngLat(p).addTo(map), at(q) { b.mk.setLngLat(q); } };
    banners.push(b); return b;
  }
  const drop = (b) => { b.mk.remove(); banners = banners.filter((x) => x !== b); };
  function burst(p, cls) { const d = document.createElement('div'); d.className = 'rb ' + cls; const m = new maplibregl.Marker({ element: d }).setLngLat(p).addTo(map); markers.push(m); setTimeout(() => { m.remove(); markers = markers.filter((x) => x !== m); }, 1400); }
  const clearAll = () => { for (const b of banners) b.mk.remove(); for (const m of markers) m.remove(); banners = []; markers = []; };

  function overview(ids, ms = 900) { const ps = ids.map(pt), b = ps.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [180, 90, -180, -90]); map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 150, bottom: 70, left: 24, right: 24 }, bearing: 0, pitch: 0, duration: ms, essential: true }); return sleep(ms + 80); }
  /** Walk a banner along a list of township ids with the camera behind it, tilted, turning at each bend. */
  async function walk(b, ids, ms, alive, follow = true) {
    const ps = ids.map(pt), legs = ps.length - 1; if (legs < 1) return;
    let cam = { c: map.getCenter(), z: map.getZoom(), br: map.getBearing(), p: map.getPitch() };
    await eased(ms, (t) => {
      const k = t * legs, i = Math.min(legs - 1, Math.floor(k)), f = ease(k - i), a = ps[i], z = ps[i + 1];
      const pos = [lerp(a[0], z[0], f), lerp(a[1], z[1], f)]; b.at(pos);
      if (follow) { const target = bearingOf(a, z); cam.br = lerp(cam.br, shortest(cam.br, target), 0.06); cam.z = lerp(cam.z, 11.6, 0.05); cam.p = lerp(cam.p, 50, 0.05); map.jumpTo({ center: pos, zoom: cam.z, bearing: cam.br, pitch: cam.p }); }
    }, alive);
  }

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
        const eb = banner(clan, pt(E)); const t0 = performance.now(), ms = DEFEND_SECONDS * 1000;
        let stop = false;
        (async () => { for (;;) { if (stop || !alive()) return; const f = Math.min(1, (performance.now() - t0) / ms); const a = pt(E), z = pt(B); eb.at([lerp(a[0], z[0], f * 0.92), lerp(a[1], z[1], f * 0.92)]); if (f >= 1) return; await frame(); } })();
        const res = await waitTap(DEFEND_SECONDS, alive, null, (key, ll) => { if (key === B) return false; if (key) { msg(`Not ${name(key)}. Find ${name(B)}.`, 'bad'); const m = new maplibregl.Marker({ color: '#b91c1c' }).setLngLat(ll).addTo(map); markers.push(m); setTimeout(() => m.remove(), 1200); return true; } return true; });
        stop = true;
        if (res.quit) break;
        if (res.key === B) {
          stats.held++; stats.found++; hooks.review(B, true);
          burst(pt(B), 'shield'); msg(`${name(B)} is ready. They turn back.`, 'good');
          const from = eb.mk.getLngLat(), to = pt(E); await eased(1100, (t) => eb.at([lerp(from.lng, to[0], ease(t)), lerp(from.lat, to[1], ease(t))]), alive); await sleep(500); drop(eb);
        } else {
          hooks.review(B, false); stats.lost++; owner[B] = clan; hooks.setOwner(B, NO[clan]);
          await overview([B, E], 600); eb.at(pt(B)); burst(pt(B), 'loss'); msg(`${name(B)} fell. It was here.`, 'bad'); await sleep(1700); drop(eb);
        }
      } else {
        const T = targets[Math.floor(Math.random() * targets.length)];
        setPrompt('FIND', name(T)); stats.asked++;
        const res = await waitTap(ATTACK_SECONDS, alive, null, () => false);
        if (res.quit) break;
        if (res.key === T) {
          stats.found++; stats.taken++; hooks.review(T, true);
          const path = marchPath(board, T, mine); msg(''); setPrompt('MARCH', name(T));
          const ab = banner(me, pt(path[0])); await walk(ab, path, 900 + 900 * (path.length - 1), alive);
          owner[T] = me; hooks.setOwner(T, NO[me]); burst(pt(T), 'win'); msg(`${name(T)} is yours.`, 'good'); score(); await sleep(1300); drop(ab);
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
