// The film (redesign R1b): a day's fights played as a camera sequence on the real map instead of a list of lines.
// Banners carry the unit counts and march along the borders; the camera follows, then drops onto the clash; captains' faces slam in, the dice
// are shown and the banners' numbers fall round by round; the township changes colour at the end. The input is the simulation's own event list
// (nothing here decides anything), so any past fight in the Ledger can be replayed. Tap anywhere to skip.
import { portrait } from './portrait.js';

const COLOUR = { goblins: '#3f9b5a', rats: '#b9712f', toads: '#3a86a8', gnomes: '#8b5cf6', dwarves: '#a16207' };
const NO = { goblins: 1, rats: 2, toads: 3, gnomes: 4, dwarves: 5 };
const KIND = { goblins: 'goblin', rats: 'rat', toads: 'toad', gnomes: 'gnome', dwarves: 'dwarf' };
const FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const bearingOf = (a, b) => { const r = Math.PI / 180, dl = (b[0] - a[0]) * r, y = Math.sin(dl) * Math.cos(b[1] * r), x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos(dl); return (Math.atan2(y, x) / r + 360) % 360; };
const shortest = (from, to) => from + ((((to - from) % 360) + 540) % 360) - 180;

/** The fights worth filming: those your clan was in, newest last, at most `max`. Pure, so it can be tested without a screen. */
export function battlesOf(events, me, max = 3, world = null) {
  const out = [];
  events.forEach((e, i) => {
    if (e.type === 'front_beat' && e.maneuver === 'decision' && e.rounds && e.rounds.length) {
      // the decision of a front is a skirmish too: rebuild the same shape from its dice
      const closed = events.slice(i + 1, i + 6).find((x) => x.type === 'front_closed' && x.front === e.front);
      const r0 = e.rounds[0], rl = e.rounds[e.rounds.length - 1];
      const dc = world && e.captain && world.chars[e.captain];
      const against = dc ? dc.clan : (e.clan === me ? 'rats' : me);
      if (e.clan !== me && against !== me) return;
      const n = r0.attackers + r0.aLost, dB = r0.defenders + r0.dLost;
      out.push({ e: { type: 'skirmish_result', by: e.clan, against, from: closed ? closed.from : null, to: e.to, n, won: e.won, lost: { attackers: n - rl.attackers, defenders: dB - rl.defenders }, left: { a: rl.attackers, d: rl.defenders }, lead: e.lead, rounds: e.rounds }, capturedChar: null });
      return;
    }
    if ((e.type !== 'skirmish_result' && e.type !== 'raid_landed') || (e.by !== me && e.against !== me)) return;
    const cap = events.slice(i + 1, i + 4).find((x) => x.type === 'captured' && x.town === e.to);
    out.push({ e, capturedChar: cap ? cap.char : null });
  });
  return out.slice(-max);
}

export function createFilm({ map, byKey, board, hooks }) {
  let el = null, skip = false, busy = false, banners = [];

  const frame = () => new Promise((r) => requestAnimationFrame(r));
  async function tween(ms, fn) {
    const t0 = performance.now();
    for (;;) {
      if (skip) { fn(1); return; }
      const t = Math.min(1, (performance.now() - t0) / ms);
      fn(t);
      if (t >= 1) return;
      await frame();
    }
  }
  const wait = (ms) => (skip ? Promise.resolve() : tween(ms, () => {}));

  // ---- camera: one state object, tweened and applied every frame
  let cam = null;
  const apply = () => map.jumpTo({ center: [cam.lng, cam.lat], zoom: cam.zoom, bearing: cam.bearing, pitch: cam.pitch });
  async function camTo(t, ms) {
    const a = { ...cam }, bt = shortest(a.bearing, t.bearing ?? a.bearing);
    await tween(ms, (p) => { const k = ease(p); cam = { lng: lerp(a.lng, t.lng ?? a.lng, k), lat: lerp(a.lat, t.lat ?? a.lat, k), zoom: lerp(a.zoom, t.zoom ?? a.zoom, k), bearing: lerp(a.bearing, bt, k), pitch: lerp(a.pitch, t.pitch ?? a.pitch, k) }; apply(); });
  }

  // ---- banners: a flag with the count on it and a crowd of tiny soldiers beneath
  function banner(clan, n, pt) {
    const d = document.createElement('div'); d.className = 'fb';
    d.style.setProperty('--c', COLOUR[clan] || '#666');
    const b = { el: d, n, pt: [...pt], clan, set(v) { if (v === b.n) return; b.n = v; draw(); d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop'); }, at(p) { b.pt = p; b.mk.setLngLat(p); } };
    const draw = () => { d.innerHTML = `<div class="fb-flag"><b>${b.n}</b></div><div class="fb-crowd">${'<i></i>'.repeat(Math.min(b.n, 18))}</div>`; };
    draw();
    b.mk = new maplibregl.Marker({ element: d, anchor: 'bottom' }).setLngLat(pt).addTo(map);
    banners.push(b); return b;
  }
  const clearBanners = () => { for (const b of banners) b.mk.remove(); banners = []; };

  // ---- the clash card: two sides and the dice between them
  const side = (clan, n, cptn, cls) => `<div class="fc-side ${cls}" style="--c:${COLOUR[clan] || '#666'}">${cptn ? `<div class="fc-face">${portrait(cptn, KIND[clan] || 'goblin', null, 74)}</div><div class="fc-name">${esc(cptn.name)}</div>` : '<div class="fc-shield"></div>'}<div class="fc-n" data-n="${cls}">${n}</div></div>`;
  function pairs(r) {
    // which dice lost: pair the sorted effective dice; attacker wins a pair only with a strictly higher die
    const a = [], d = [];
    const n = Math.min(r.aEff.length, r.dEff.length);
    for (let i = 0; i < r.aEff.length; i++) a.push(i < n ? r.aEff[i] > r.dEff[i] : null);
    for (let i = 0; i < r.dEff.length; i++) d.push(i < n ? !(r.aEff[i] > r.dEff[i]) : null);
    return { a, d };
  }
  const diceHTML = (vals, wins, cls) => `<div class="fc-dice ${cls}">${vals.map((v, i) => `<i class="${wins[i] === null ? '' : wins[i] ? 'w' : 'l'}" style="animation-delay:${i * 90}ms">${FACE[v] || v}</i>`).join('')}</div>`;

  function mount() {
    el = document.createElement('div'); el.id = 'film';
    el.innerHTML = '<div class="film-bar top"></div><div class="film-bar bottom"><div class="film-place"></div></div><div class="film-card" hidden></div><div class="film-stamp" hidden></div><div class="film-skip">tap to skip</div>';
    el.addEventListener('click', () => { skip = true; });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
  }
  const $ = (s) => el.querySelector(s);

  async function battle({ e, capturedChar }, world) {
    const A = byKey.get(e.from), D = byKey.get(e.to); if (!A || !D) return;   // (a front whose start is unknown is skipped)
    const ap = A.pt, dp = D.pt, brg = bearingOf(ap, dp);
    const defBefore = e.lost.defenders + e.left.d;
    const leadC = e.lead && world.chars[e.lead], defC = capturedChar ? world.chars[capturedChar] : (!e.won && world.towns[e.to] && world.towns[e.to].captain ? world.chars[world.towns[e.to].captain] : null);
    $('.film-place').textContent = '';
    $('.film-card').hidden = true; $('.film-stamp').hidden = true;
    // 1. the establishing shot: behind the army, looking toward the target
    cam = cam || { lng: ap[0], lat: ap[1], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
    const back = [ap[0] - (dp[0] - ap[0]) * 0.35, ap[1] - (dp[1] - ap[1]) * 0.35];
    await camTo({ lng: back[0], lat: back[1], zoom: 12.0, bearing: brg, pitch: 58 }, 1100);
    const atk = banner(e.by, e.n, ap), def = banner(e.against || 'dwarves', defBefore, dp);
    $('.film-place').textContent = D.n;
    await wait(500);
    // 2. the march: the banner walks the border while the camera rides along behind it
    const lead = [ap[0] - (dp[0] - ap[0]) * 0.18, ap[1] - (dp[1] - ap[1]) * 0.18];
    await tween(2200, (p) => {
      const k = ease(p), pos = [lerp(ap[0], dp[0] - (dp[0] - ap[0]) * 0.12, k), lerp(ap[1], dp[1] - (dp[1] - ap[1]) * 0.12, k)];
      atk.at(pos);
      cam = { ...cam, lng: lerp(back[0], lead[0] + (dp[0] - ap[0]) * 0.55, k), lat: lerp(back[1], lead[1] + (dp[1] - ap[1]) * 0.55, k), zoom: lerp(12.0, 12.7, k) };
      apply();
    });
    // 3. the clash: the camera drops onto the township, the faces slam in
    await camTo({ lng: dp[0] - (dp[0] - ap[0]) * 0.06, lat: dp[1] - (dp[1] - ap[1]) * 0.06, zoom: 13.1, pitch: 52 }, 600);
    const card = $('.film-card');
    card.innerHTML = `${side(e.by, e.n, leadC, 'a')}<div class="fc-mid"><div class="fc-vs">⚔</div><div class="fc-rows"></div></div>${side(e.against || 'dwarves', defBefore, defC, 'd')}`;
    card.hidden = false; card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    await wait(750);
    const rows = card.querySelector('.fc-rows');
    const R = e.rounds || [];
    for (let i = 0; i < R.length; i++) {
      const r = R[i], pr = pairs(r), fast = R.length > 6 && i >= 3 && i < R.length - 2;
      rows.innerHTML = diceHTML(r.a, pr.a, 'atk') + diceHTML(r.d, pr.d, 'def');
      await wait(fast ? 160 : 520);
      atk.set(r.attackers); def.set(r.defenders);
      card.querySelector('[data-n=a]').textContent = r.attackers; card.querySelector('[data-n=d]').textContent = r.defenders;
      if (r.aLost) { atk.el.classList.remove('hit'); void atk.el.offsetWidth; atk.el.classList.add('hit'); }
      if (r.dLost) { def.el.classList.remove('hit'); void def.el.offsetWidth; def.el.classList.add('hit'); }
      await wait(fast ? 120 : 380);
    }
    if (!R.length) { atk.set(e.left.a); def.set(e.left.d); card.querySelector('[data-n=a]').textContent = e.left.a; card.querySelector('[data-n=d]').textContent = e.left.d; await wait(500); }
    // 4. the verdict: stamp, the colour change, the loser's flag falls
    const stamp = $('.film-stamp');
    stamp.textContent = e.won ? 'TAKEN' : 'THROWN BACK'; stamp.className = 'film-stamp ' + (e.won ? 'won' : 'lost'); stamp.hidden = false;
    card.classList.add('out');
    if (e.won) { def.el.classList.add('fall'); hooks.setOwner(e.to, NO[e.by]); await camTo({ zoom: 13.4 }, 500); atk.set(e.left.a); await wait(1000); }
    else { atk.el.classList.add('fall'); await wait(1000); }
    stamp.hidden = true; card.hidden = true; card.classList.remove('out');
    clearBanners();
  }

  /** Play a list of simulation events. Resolves when the film ends or is skipped. `world` is the state after them (for captains). */
  async function play(events, world, me) {
    const list = battlesOf(events, me, 3, world);
    if (!list.length || busy || !map || !byKey.size) return false;
    busy = true; skip = false;
    const prePadding = map.getPadding ? map.getPadding() : null, preCam = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
    const was = new Map();   // towns that flip are shown as they were before the film, then flip on screen
    for (const b of list) if (b.e.won && !was.has(b.e.to)) was.set(b.e.to, b.e.against || null);
    hooks.begin([...was].map(([town, owner]) => ({ town, no: NO[owner] || 0 })));
    mount(); cam = null;
    try {
      for (const b of list) { skip = false; await battle(b, world); }
    } finally {
      clearBanners(); if (el) { el.remove(); el = null; }
      cam = null; busy = false; skip = false;
      map.easeTo({ center: preCam.center, zoom: preCam.zoom, bearing: 0, pitch: 0, duration: 700, essential: true });
      if (prePadding && map.setPadding) map.setPadding(prePadding);
      hooks.end();
    }
    return true;
  }
  return { play, get busy() { return busy; } };
}
