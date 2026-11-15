// Council (redesign R3): goblin mode as an old strategy game. The map is flat colour with numbered townships; your captains report one at a
// time ("what is your order for 12. Totowa?"); each gives one order a turn; ending the turn moves the world to the next part of the day and the
// news comes as terminal cards and battle screens. The rules are the same simulation (../sim): this file only asks for orders and shows results.
// Differences from the first front end, all on purpose: no action points (one order per captain instead), no waiting on a real clock (you end
// the turn), an attack on a captain is settled in one battle (the front opens and goes straight to its decision), and no fog.
import { makeBoard } from '../sim/board.js';
import { loadContent } from '../sim/chars.js';
import { newWorld, step } from '../sim/world.js';
import { legalOrders } from '../sim/front.js';
import { progress } from '../sim/war.js';
import { rivalsFor } from '../sim/chapters.js';
import { portrait } from './portrait.js';

const ME = 'goblins';
const NO = { goblins: 1, rats: 2, toads: 3, gnomes: 4, dwarves: 5 };
const COL = { goblins: '#2fa84f', rats: '#e2551d', toads: '#2a62d8', gnomes: '#c93fd0', dwarves: '#d9d9d9' };
const KIND = { goblins: 'goblin', rats: 'rat', toads: 'toad', gnomes: 'gnome', dwarves: 'dwarf' };
const SKIN = { goblin: '#8fd06a', rat: '#c9ad8a', toad: '#7fc79a', gnome: '#f0b48a', dwarf: '#e0a070' };
const SAVE = 'goblin.council', SAVE_V = 1, MAJORS = [9, 12, 18], PART = { 9: 'MORNING', 12: 'NOON', 18: 'DUSK' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- pixel art, drawn from small bitmaps (no image files)
function pixels(rows, pal, px = 3, cls = '') {
  let out = '';
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = pal[row[x]]; if (c) out += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`; } });
  return `<svg class="${cls}" viewBox="0 0 ${rows[0].length} ${rows.length}" width="${rows[0].length * px}" height="${rows.length * px}" shape-rendering="crispEdges">${out}</svg>`;
}
const SOLDIER = ['..hhh....s', '.hhhhh...s', '.fffff...s', '.fefef..ss', '.fffff...s', 'bbbbbbb..s', 'bbbbbbbbbs', 'bbbbbbb..s', '.bbbbb...s', '.l...l....', '.l...l....'];
const soldier = (clan, px = 3) => pixels(SOLDIER, { h: '#9aa0a8', f: SKIN[KIND[clan]] || '#8fd06a', e: '#111', b: COL[clan] || '#888', s: '#c8c8c8', l: '#3a2a1a' }, px, 'cn-sol');
const CASTLE = ['...rr...', '..rrrr..', '.rrrrrr.', 'yyyyyyyy', '.w.ww.w.', '.wwwwww.', '.ww..ww.'];
const castle = (px = 2) => pixels(CASTLE, { r: '#e23b1d', y: '#f2c21a', w: '#f4f0e0' }, px, 'cn-cas');

export function initCouncil(ctx) {
  const { map, store } = ctx;
  let G = null, save = null, root = null, layers = false, bound = false, markers = new Map(), faces = new Map();
  let phase = 'idle', pick = null, btns = [], pendingHome = null, busy = false, typer = 0;

  const w = () => save.world;
  const persist = () => store.set(SAVE, save);
  const muni = (id) => ctx.byKey.get(id);
  const num = (id) => save.num[id];
  const tname = (id) => `${num(id)}. ${muni(id) ? muni(id).n : G.board.town(id).name}`;
  const run = (orders, ticks = 0) => { const r = step(G.board, save.world, orders, ticks); save.world = r.state; persist(); return r.events; };

  async function load() {
    if (G) return;
    const [bj, cj, rj, tj] = await Promise.all(['board', 'content', 'regions', 'terrain'].map((n) => fetch(`data/goblin-${n}.json`).then((r) => r.json()).catch(() => null)));
    const content = loadContent(cj);
    G = { board: makeBoard(bj, content, rj), content, terrain: tj };
  }

  // ---- portraits: the code-drawn face, shrunk to a few pixels and dithered to a small palette, the way an old machine would show it
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function face(c, clan) {
    const key = c.id + ':' + (c.injuries || []).join(',') + ':' + (c.state || '');
    if (faces.has(key)) return Promise.resolve(faces.get(key));
    return new Promise((res) => {
      const svg = portrait(c, KIND[clan] || 'goblin', null, 120).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      const img = new Image();
      img.onload = () => {
        const N = 40, cv = document.createElement('canvas'); cv.width = cv.height = N;
        const x = cv.getContext('2d');
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { x.fillStyle = (i + j) % 2 ? '#2a2f8f' : '#6a3fb0'; x.fillRect(i, j, 1, 1); }
        x.drawImage(img, 2, 2, N - 4, N - 4);
        const d = x.getImageData(0, 0, N, N), p = d.data;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const o = (j * N + i) * 4, t = (BAYER[j % 4][i % 4] / 16 - 0.5) * 70; for (let k = 0; k < 3; k++) p[o + k] = Math.max(0, Math.min(255, Math.round((p[o + k] + t) / 85) * 85)); }
        x.putImageData(d, 0, 0);
        const url = cv.toDataURL(); faces.set(key, url); res(url);
      };
      img.onerror = () => res('');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  /** The same face as a black-and-white ink plate: two tones, shaded with a diagonal line screen. */
  const inks = new Map();
  function ink(c, clan) {
    if (inks.has(c.id)) return Promise.resolve(inks.get(c.id));
    return new Promise((res) => {
      const svg = portrait(c, KIND[clan] || 'goblin', 'grim', 160).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      const img = new Image();
      img.onload = () => {
        const N = 112, cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d');
        x.fillStyle = '#000'; x.fillRect(0, 0, N, N); x.drawImage(img, 6, 6, N - 12, N - 12);
        const d = x.getImageData(0, 0, N, N), p = d.data;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const o = (j * N + i) * 4, a = p[o + 3] / 255, lum = (0.3 * p[o] + 0.59 * p[o + 1] + 0.11 * p[o + 2]) * a; const screen = 70 + 150 * (((i + j) % 5) / 4) * (((i * 3 + j * 7) % 11) > 1 ? 1 : 0.6); const v = lum > screen ? 255 : 0; p[o] = p[o + 1] = p[o + 2] = v; p[o + 3] = 255; }
        x.putImageData(d, 0, 0); const url = cv.toDataURL(); inks.set(c.id, url); res(url);
      };
      img.onerror = () => res(''); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  const ADVISOR = { id: 'advisor-0', name: 'The Advisor', injuries: [] };
  const faceNow = (c) => faces.get(c.id + ':' + (c.injuries || []).join(',') + ':' + (c.state || '')) || '';

  // ---- the map: sea, flat land, owners in solid colour, hard borders
  /** A small repeating image for a fill pattern, from rows of characters and a palette of [r, g, b, a]. `k` is the size of one cell in pixels. */
  function pattern(name, rows, pal, k = 2) {
    if (map.hasImage(name)) return;
    const h = rows.length, wd = rows[0].length, data = new Uint8Array(wd * k * h * k * 4);
    for (let y = 0; y < h * k; y++) for (let x = 0; x < wd * k; x++) { const c = pal[rows[Math.floor(y / k)][Math.floor(x / k)]] || [0, 0, 0, 0]; data.set(c, (y * wd * k + x) * 4); }
    map.addImage(name, { width: wd * k, height: h * k, data });
  }
  const LAYERS = ['cn-sea', 'cn-terrain', 'cn-land', 'cn-water', 'cn-river', 'cn-road-case', 'cn-road', 'cn-line', 'cn-hi'];
  function ensureLayers() {
    if (layers) return; layers = true;
    const cc = ['coalesce', ['feature-state', 'cc'], 0];
    // dithered sea; the real terrain as a dithered picture (tools/goblin/build_terrain.py); ownership as a tint over it
    pattern('cn-p-sea', ['ab', 'ba'], { a: [27, 42, 122, 255], b: [36, 60, 160, 255] }, 2);
    map.addLayer({ id: 'cn-sea', type: 'background', layout: { visibility: 'none' }, paint: { 'background-pattern': 'cn-p-sea' } });
    if (G.terrain) {
      map.addSource('cn-terrain', { type: 'image', url: 'data/goblin-terrain.png', coordinates: G.terrain.coordinates });
      map.addLayer({ id: 'cn-terrain', type: 'raster', source: 'cn-terrain', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
    }
    map.addLayer({ id: 'cn-land', type: 'fill', source: 'munis', layout: { visibility: 'none' }, paint: { 'fill-antialias': false,
      'fill-color': ['match', cc, 1, COL.goblins, 2, COL.rats, 3, COL.toads, 4, COL.gnomes, 5, '#ffffff', 9, '#fff3c4', G.terrain ? '#000000' : '#7c8a4e'],
      'fill-opacity': G.terrain ? ['match', cc, 0, 0.42, 9, 0.16, 5, 0.26, 0.4] : 1 } });
    // the real water and the real highways, from the street map's own tiles (they need a connection; without one the map is still playable)
    if (map.getSource('omt')) {
      try {
        map.addLayer({ id: 'cn-water', type: 'fill', source: 'omt', 'source-layer': 'water', layout: { visibility: 'none' }, paint: { 'fill-pattern': 'cn-p-sea' } });
        map.addLayer({ id: 'cn-river', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'river'], layout: { visibility: 'none' }, paint: { 'line-color': '#2a4fd0', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 12, 3] } });
        const road = ['all', ['match', ['get', 'class'], ['motorway', 'trunk'], true, false], ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'ramp'], 1]];
        map.addLayer({ id: 'cn-road-case', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 7, filter: road, layout: { visibility: 'none', 'line-join': 'miter' }, paint: { 'line-color': '#3a2408', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.6, 12, 5.5] } });
        map.addLayer({ id: 'cn-road', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 7, filter: road, layout: { visibility: 'none', 'line-join': 'miter' }, paint: { 'line-color': '#f3e3ae', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 12, 3], 'line-dasharray': [3, 1] } });
      } catch (err) { console.warn('council: no water or roads', err); }
    }
    map.addLayer({ id: 'cn-line', type: 'line', source: 'munis', layout: { visibility: 'none' }, paint: { 'line-color': '#120c04', 'line-width': ['case', ['>', cc, 0], 2, 0.4] } });
    map.addLayer({ id: 'cn-hi', type: 'line', source: 'munis', layout: { visibility: 'none' }, paint: { 'line-color': ['match', ['coalesce', ['feature-state', 'ch'], 0], 1, '#ffe11a', 2, '#ffffff', 'rgba(0,0,0,0)'], 'line-width': ['match', ['coalesce', ['feature-state', 'ch'], 0], 1, 5, 2, 3.5, 0] } });
  }
  const showLayers = (on) => { for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
  const setFS = (id, st) => { const m = muni(id); if (m) map.setFeatureState({ source: 'munis', id: m.id }, st); };
  function clearMap() { for (const m of ctx.byKey.values()) map.setFeatureState({ source: 'munis', id: m.id }, { cc: 0, ch: 0 }); for (const mk of markers.values()) mk.remove(); markers.clear(); }
  function paint() {
    if (!save) return;
    const world = w(), cur = currentCaptain();
    const targets = new Set(phase === 'pick' && pick ? pick.options.map((o) => o.to) : []);
    for (const id of Object.keys(world.towns)) {
      const T = world.towns[id], m = muni(id); if (!m) continue;
      setFS(id, { cc: NO[T.owner] || 9, ch: cur && cur.at === id ? 1 : targets.has(id) ? 2 : 0 });
      let mk = markers.get(id);
      if (!mk) { const d = document.createElement('div'); d.className = 'cn-mk'; mk = new maplibregl.Marker({ element: d, anchor: 'center' }).setLngLat(m.pt).addTo(map); markers.set(id, mk); }
      const c = T.captain && world.chars[T.captain], f = c ? faceNow(c) : '';
      const el = mk.getElement();
      el.className = 'cn-mk maplibregl-marker maplibregl-marker-anchor-center' + (T.owner === ME ? ' mine' : '') + (targets.has(id) ? ' tgt' : '') + (cur && cur.at === id ? ' cur' : '');
      el.innerHTML = `<b>${num(id)}</b>${c ? (f ? `<img class="cn-face" src="${f}" alt="">` : '<i class="cn-star">★</i>') : castle(2)}<u>${T.force}${T.dugIn ? '▮' : ''}</u>`;
    }
    status();
  }
  function fit(ids, ms = 700, maxZoom = 11.2) {
    const ps = ids.map((id) => muni(id)).filter(Boolean).map((m) => m.pt); if (!ps.length) return;
    const b = ps.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [180, 90, -180, -90]);
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 70, bottom: 250, left: 34, right: 34 }, maxZoom, bearing: 0, pitch: 0, duration: ms, essential: true });
  }

  // ---- the frame: status line, town box, portrait, dialogue, commands
  function mount() {
    if (root) return;
    root = document.createElement('div'); root.id = 'council';
    root.innerHTML = `<div class="cn-top"><span class="cn-date"></span><span class="cn-res"></span><button class="cn-menu" data-c="menu">≡</button></div>
      <div class="cn-info" hidden></div>
      <div class="cn-bottom"><div class="cn-port"><img alt=""><span></span></div><div class="cn-say"><p></p></div><div class="cn-cmd"></div></div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]'); if (b && !busy) { const f = btns[+b.dataset.i]; if (f && !b.classList.contains('dim')) f(); return; }
      if (e.target.closest('[data-c=menu]') && !busy) return menu();
      if (e.target.closest('.cn-say')) { clearInterval(typer); const p = root.querySelector('.cn-say p'); if (p.dataset.full) p.textContent = p.dataset.full; }
      if (e.target.closest('.cn-info')) root.querySelector('.cn-info').hidden = true;
    });
  }
  const $ = (s) => root.querySelector(s);
  function status() {
    if (!save) { $('.cn-date').textContent = 'GOBLIN COUNCIL'; $('.cn-res').textContent = ''; return; }
    const world = w(), abs = world.startHour + world.tick, h = abs % 24, me = world.clans[ME], p = progress(world, ME);
    $('.cn-date').textContent = `DAY ${Math.floor(abs / 24) + 1} ${PART[h] || h + ':00'}`;
    $('.cn-res').innerHTML = `<i>FOOD</i>${me.res ? me.res.food : '-'} <i>GOLD</i>${me.res ? me.res.coin : '-'} <i>LAND</i>${p.held}/${p.need}`;
  }
  /** The advisor (or a captain) speaks; `options` become the command buttons. */
  async function say(text, options = [], who = null, clan = ME) {
    const c = who || ADVISOR;
    const url = await face(c, clan);
    $('.cn-port img').src = url; $('.cn-port span').textContent = c.name.toUpperCase();
    const p = $('.cn-say p'); clearInterval(typer); p.dataset.full = text; p.textContent = ''; let i = 0;
    typer = setInterval(() => { i += 6; p.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typer); }, 16);
    btns = options.map((o) => o.go);
    $('.cn-cmd').innerHTML = options.map((o, k) => `<button data-i="${k}" class="${o.dim ? 'dim' : ''}${o.wide ? ' wide' : ''}">${esc(o.label)}</button>`).join('');
  }
  function info(id) {
    const T = w().towns[id]; if (!T) return;
    const c = T.captain && w().chars[T.captain], b = G.board.town(id);
    const bar = (v, max, col) => `<span class="cn-bar"><i style="width:${Math.min(100, (v / max) * 100)}%;background:${col}"></i></span>`;
    const el = $('.cn-info');
    el.innerHTML = `<h4><span style="background:${COL[T.owner] || '#e6d9a8'}"></span>${esc(tname(id))}</h4>
      <div>RULER <b>${T.owner ? cap(T.owner).toUpperCase() : 'NONE'}</b></div>
      <div>MEN ${bar(T.force, 20, '#58d0ff')}<b>${T.force}</b></div>
      <div>PEOPLE ${bar(Math.log10(Math.max(10, b.pop)) - 1, 5, '#f2c21a')}<b>${b.pop >= 1000 ? Math.round(b.pop / 1000) + 'K' : b.pop}</b></div>
      <div>WALLS <b>${T.dugIn ? 'YES' : 'NO'}</b></div>
      ${c ? `<div class="cn-cap"><img src="${faceNow(c)}" alt=""><b>${esc(c.name.toUpperCase())}</b></div>` : '<div>NO CAPTAIN</div>'}`;
    el.hidden = false;
  }

  // ---- interstitials: a terminal card, and the battle screen
  function card(lines, ms = 1700, tone = '', plate = '') {
    return new Promise((res) => {
      const d = document.createElement('div'); d.className = 'cn-card ' + tone + (plate ? ' plate' : '');
      d.innerHTML = `<div>${plate ? `<img class="cn-plate" src="${plate}" alt="">` : ''}${[].concat(lines).map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;
      document.body.appendChild(d);
      let done = false; const end = () => { if (done) return; done = true; d.remove(); res(); };
      d.addEventListener('click', end); setTimeout(end, ms);
    });
  }
  /** Fights your clan was in, from a list of simulation events, in one shape whether they were plain skirmishes or a front's decision. */
  function fightsOf(events) {
    const out = [], world = w();
    events.forEach((e, i) => {
      if (e.type === 'front_beat' && e.maneuver === 'decision' && e.rounds) {
        const dc = world.chars[e.captain], closed = events.slice(i + 1, i + 8).find((x) => x.type === 'front_closed' && x.front === e.front);
        const against = dc ? dc.clan : null; if (e.clan !== ME && against !== ME) return;
        const r0 = e.rounds[0], rl = e.rounds[e.rounds.length - 1];
        const n = r0 ? r0.attackers + r0.aLost : 0, dB = r0 ? r0.defenders + r0.dLost : 0;
        out.push({ by: e.clan, against, from: closed && closed.from, to: e.to, n, defBefore: dB, won: e.won, left: { a: rl ? rl.attackers : n, d: rl ? rl.defenders : dB }, rounds: e.rounds, lead: e.lead, defCap: e.captain });
      } else if ((e.type === 'skirmish_result' || e.type === 'raid_landed') && (e.by === ME || e.against === ME)) {
        const capd = events.slice(i + 1, i + 4).find((x) => x.type === 'captured' && x.town === e.to);
        out.push({ by: e.by, against: e.against, from: e.from, to: e.to, n: e.n, defBefore: e.lost.defenders + e.left.d, won: e.won, left: e.left, rounds: e.rounds || [], lead: e.lead, defCap: capd ? capd.char : (!e.won && world.towns[e.to].captain) || null });
      }
    });
    return out;
  }
  async function battle(f) {
    const world = w(), L = f.lead && world.chars[f.lead], D = f.defCap && world.chars[f.defCap];
    const [lf, df] = await Promise.all([L ? face(L, f.by) : '', D ? face(D, f.against) : '']);
    const d = document.createElement('div'); d.className = 'cn-battle';
    const total = Math.max(1, f.n + f.defBefore);
    const crowd = (clan, n) => Array.from({ length: Math.min(n, 30) }, () => `<span>${soldier(clan, 4)}</span>`).join('');
    const side = (cls, clan, c, url, n) => `<div class="cb-who ${cls}">${url ? `<img src="${url}" alt="">` : `<div class="cb-noface">${soldier(clan, 5)}</div>`}<b>${esc((c ? c.name : cap(clan || 'nobody')).toUpperCase())}</b><em data-n="${cls}">${n}</em></div>`;
    d.innerHTML = `<div class="cb-head">${side('a', f.by, L, lf, f.n)}<div class="cb-place">${esc(tname(f.to).toUpperCase())}</div>${side('d', f.against, D, df, f.defBefore)}</div>
      <div class="cb-bar"><i class="a" style="width:${(f.n / total) * 100}%;background:${COL[f.by]}"></i><i class="d" style="background:${COL[f.against] || '#888'}"></i></div>
      <div class="cb-dice"></div>
      <div class="cb-field"><div class="cb-crowd a">${crowd(f.by, f.n)}</div><div class="cb-crowd d">${crowd(f.against, f.defBefore)}</div></div>
      <div class="cb-verdict"></div><div class="cb-skip">TAP TO HURRY</div>`;
    document.body.appendChild(d);
    let fast = false; d.addEventListener('click', () => { fast = true; });
    const wait = (ms) => sleep(fast ? 40 : ms);
    const set = (a, dn) => {
      d.querySelector('[data-n=a]').textContent = a; d.querySelector('[data-n=d]').textContent = dn;
      d.querySelector('.cb-bar .a').style.width = (a / Math.max(1, a + dn)) * 100 + '%';
      for (const [cls, n] of [['a', a], ['d', dn]]) { const sp = [...d.querySelectorAll(`.cb-crowd.${cls} span:not(.dead)`)]; for (let k = sp.length - 1; k >= Math.min(n, 30); k--) sp[k].classList.add('dead'); }
    };
    await wait(900);
    const die = (v, lost) => `<i class="${lost ? 'l' : ''}">${v}</i>`;
    for (let i = 0; i < f.rounds.length; i++) {
      const r = f.rounds[i], n = Math.min(r.aEff.length, r.dEff.length), slow = f.rounds.length <= 6 || i < 2 || i >= f.rounds.length - 2;
      d.querySelector('.cb-dice').innerHTML = `<div class="a">${r.a.map((v, k) => die(v, k < n && !(r.aEff[k] > r.dEff[k]))).join('')}</div><div class="vs">VS</div><div class="d">${r.d.map((v, k) => die(v, k < n && r.aEff[k] > r.dEff[k])).join('')}</div>`;
      await wait(slow ? 520 : 150); set(r.attackers, r.defenders);
      d.classList.remove('hit'); void d.offsetWidth; d.classList.add('hit');
      await wait(slow ? 380 : 110);
    }
    set(f.left.a, f.left.d);
    const mineWon = (f.by === ME) === f.won;
    d.querySelector('.cb-verdict').innerHTML = `<p class="${mineWon ? 'good' : 'bad'}">${f.won ? (f.by === ME ? 'THE TOWN IS OURS' : 'THE TOWN HAS FALLEN') : (f.by === ME ? 'WE ARE THROWN BACK' : 'THEY ARE THROWN BACK')}</p>`;
    fast = false; await new Promise((res) => { const end = () => res(); d.addEventListener('click', end, { once: true }); setTimeout(end, 2200); });
    d.remove();
  }

  // ---- the turn
  const myCaptains = () => Object.values(w().chars).filter((c) => c.clan === ME && c.status === 'active' && c.at && w().towns[c.at] && w().towns[c.at].owner === ME).sort((a, b) => num(a.at) - num(b.at));
  function queue() {
    const caps = myCaptains().map((c) => ({ id: c.id, at: c.at, c }));
    if (caps.length) return caps;
    // no captain left: the strongest garrisons on the border act for themselves
    return Object.keys(w().towns).filter((t) => w().towns[t].owner === ME && G.board.neighbours(t).some((n) => w().towns[n] && w().towns[n].owner && w().towns[n].owner !== ME))
      .sort((a, b) => w().towns[b].force - w().towns[a].force).slice(0, 2).map((t) => ({ id: 'g:' + t, at: t, c: null }));
  }
  function currentCaptain() { if (!save || phase === 'start' || (w().war && w().war.over)) return null; return queue().find((q) => !save.acted.includes(q.id)) || null; }

  async function next() {
    phase = 'orders'; pick = null;
    if (w().war && w().war.over) return ending();
    const q = currentCaptain();
    paint();
    if (!q) {
      fit(Object.keys(w().towns).filter((t) => w().towns[t].owner === ME), 600, 10.6);
      return say('All your captains have their orders, Master. Shall the day move on?', [{ label: 'END TURN', wide: true, go: endTurn }]);
    }
    const T = w().towns[q.at];
    fit([q.at, ...G.board.neighbours(q.at).filter((n) => w().towns[n])], 650, 11.4);
    const legal = legalOrders(G.board, w(), ME);
    const marches = legal.filter((o) => (o.type === 'attack' || o.type === 'front_open') && o.from === q.at);
    const musters = legal.filter((o) => o.type === 'move' && o.to === q.at && w().towns[o.from].force > 1);
    const dig = legal.find((o) => o.type === 'fortify' && o.town === q.at);
    const seek = legal.filter((o) => o.type === 'seek' && G.board.neighbours(q.at).includes(o.town));
    const done = (id) => { save.acted.push(id); persist(); };
    const who = q.c ? `${q.c.name} holds ${tname(q.at)} with ${T.force}.` : `The garrison of ${tname(q.at)} stands ready with ${T.force}.`;
    const foes = G.board.neighbours(q.at).filter((n) => w().towns[n] && w().towns[n].owner && w().towns[n].owner !== ME);
    const why = marches.length ? '' : !foes.length ? ' No enemy borders this town: move toward the front.' : foes.every((n) => w().towns[n].owner === 'dwarves') ? ' Only the dwarves border this town, and their rock cannot be taken.' : T.force < 2 ? ' Too few men here to march: muster first.' : ' We cannot feed a march from here.';
    const moves = q.c ? legal.filter((o) => o.type === 'move' && o.from === q.at && !w().towns[o.to].captain) : [];
    say(`${who}${why} What is your order, Master?`, [
      { label: 'MARCH', dim: !marches.length, go: () => chooseTarget(q, marches, 'march') },
      { label: 'MOVE', dim: !moves.length, go: () => chooseTarget(q, moves, 'move') },
      { label: 'GATHER', dim: !musters.length, go: () => {
        const amount = (o, part) => Math.max(0, Math.min(o.n.max, Math.floor((w().towns[o.from].force - 1) * part)));
        const total = (part) => musters.reduce((t, o) => t + amount(o, part), 0);
        const gather = async (part) => {
          const ev = []; for (const o of musters) { const n = amount(o, part); if (n > 0) ev.push(...run([{ type: 'move', clan: ME, from: o.from, to: q.at, n }])); }
          const got = ev.filter((e) => e.type === 'units_moved').reduce((t, e) => t + e.n, 0);
          done(q.id); paint(); await say(got ? `${got} men come in. ${tname(q.at)} now holds ${w().towns[q.at].force}.` : 'No one could be spared, Master.', [{ label: 'NEXT', wide: true, go: next }], q.c);
        };
        for (const o of musters) setFS(o.from, { ch: 2 });
        say(`Call men in from the ${musters.length} marked township${musters.length === 1 ? '' : 's'} beside us? Half brings ${total(0.5)}. All brings ${total(1)} and leaves one man in each.`, [
          { label: `HALF ${total(0.5)}`, dim: !total(0.5), go: () => gather(0.5) }, { label: `ALL ${total(1)}`, go: () => gather(1) }, { label: 'BACK', go: next }], q.c);
      } },
      { label: 'WALLS', dim: !dig, go: async () => {
        const ev = run([{ type: 'present', clan: ME }, dig]); const rej = ev.find((e) => e.type === 'order_rejected');
        if (!rej) done(q.id); paint(); await say(rej ? `It cannot be done: ${rej.reason}.` : `${tname(q.at)} digs in. Its walls will hold harder.`, [{ label: 'NEXT', wide: true, go: next }], q.c);
      } },
      ...(seek.length ? [{ label: 'DWARVES', go: async () => {
        const ev = run([{ type: 'present', clan: ME }, seek[0]]); const s = ev.find((e) => e.type === 'dwarves_sought'), rej = ev.find((e) => e.type === 'order_rejected');
        if (!rej) done(q.id); paint();
        if (s && s.ok) await card(['THE DWARVES', 'OPEN THEIR GATE'], 1800, 'good');
        await say(rej ? `It cannot be done: ${rej.reason}.` : s && s.ok ? 'The dwarves will send miners to stand with us.' : 'The dwarves would not hear us. Their gate stays shut.', [{ label: 'NEXT', wide: true, go: next }], q.c);
      } }] : []),
      { label: 'REST', go: () => { done(q.id); next(); } },
    ], q.c);
  }
  function chooseTarget(q, options, kind) {
    phase = 'pick'; pick = { q, options, kind }; paint();
    const go = (o) => (kind === 'move' ? relocate(q, o) : march(q, o));
    const going = Math.max(1, w().towns[q.at].force - 1);
    say(kind === 'move' ? `Move to which of our townships? The captain goes with ${going} men; one stays. Tap it, or choose.` : `March on which township? ${going} will march; one stays behind. Tap it on the map, or choose.`, [
      ...options.slice(0, 5).map((o) => ({ label: kind === 'move' ? `${num(o.to)} OURS ${w().towns[o.to].force}` : `${num(o.to)} ${cap(w().towns[o.to].owner || '').slice(0, 4).toUpperCase()} ${w().towns[o.to].force}`, go: () => go(o) })),
      { label: 'BACK', go: next },
    ], q.c);
  }
  function relocate(q, o) {
    phase = 'orders'; pick = null;
    const n = Math.max(1, Math.min(o.n.max, w().towns[o.from].force - 1));
    const ev = run([{ type: 'present', clan: ME }, { type: 'move', clan: ME, from: o.from, to: o.to, n, captain: true }]);
    const rej = ev.find((e) => e.type === 'order_rejected');
    if (!rej) { save.acted.push(q.id); persist(); }
    paint();
    say(rej ? `It cannot be done: ${rej.reason}.` : `${q.c ? q.c.name : 'The garrison'} moves to ${tname(o.to)} with ${n}.`, [{ label: 'NEXT', wide: true, go: next }], q.c);
  }
  async function march(q, o) {
    busy = true; phase = 'orders'; pick = null;
    try {
      const n = Math.max(1, Math.min(o.n.max, w().towns[o.from].force - 1));
      let ev = run([{ type: 'present', clan: ME }, { type: o.type, clan: ME, from: o.from, to: o.to, n }]);
      const rej = ev.find((e) => e.type === 'order_rejected');
      if (rej) { busy = false; return say(`It cannot be done: ${rej.reason}.`, [{ label: 'BACK', wide: true, go: next }], q.c); }
      const opened = ev.find((e) => e.type === 'front_opened');
      if (opened) { const dec = legalOrders(G.board, w(), ME).find((x) => x.type === 'front' && x.front === opened.front && x.action === 'decision'); if (dec) ev = ev.concat(run([dec])); }
      save.acted.push(q.id); persist();
      for (const f of fightsOf(ev)) await battle(f);
      for (const e of ev) if (e.type === 'closeup' || e.type === 'captured') { const c = w().chars[e.char]; if (c && c.clan !== ME) await card([c.name, ({ captured: 'is our prisoner', died: 'is dead', fled: 'has fled', injured: 'is wounded' })[e.what || 'captured'] || 'escapes'], 2200, '', await ink(c, c.clan)); }
      await Promise.all(Object.values(w().chars).map((c) => face(c, c.clan)));
      paint();
      const won = w().towns[o.to].owner === ME;
      busy = false;
      say(won ? `${tname(o.to)} is ours, Master!` : `We could not take ${tname(o.to)}. ${w().towns[o.from].force} came home.`, [{ label: 'NEXT', wide: true, go: next }], q.c);
    } catch (err) { busy = false; console.error(err); say(`Something broke: ${err.message}`, [{ label: 'NEXT', wide: true, go: next }]); }
  }
  async function endTurn() {
    busy = true;
    try {
      const h = (w().startHour + w().tick) % 24, nx = MAJORS.find((m) => m > h), ticks = nx ? nx - h : 24 - h + MAJORS[0];
      const before = Object.fromEntries(Object.keys(w().towns).map((t) => [t, w().towns[t].owner]));
      const ev = run([{ type: 'present', clan: ME }], 0).concat(run([], ticks));
      save.acted = []; persist();
      const abs = w().startHour + w().tick;
      await card([`DAY ${Math.floor(abs / 24) + 1}`, PART[abs % 24] || ''], 1100);
      for (const f of fightsOf(ev).slice(-3)) await battle(f);
      await Promise.all(Object.values(w().chars).map((c) => face(c, c.clan)));
      paint();
      const coming = w().raids.filter((r) => w().towns[r.target] && w().towns[r.target].owner === ME);
      for (const r of coming.slice(0, 2)) { fit([r.target, r.from], 500, 11); setFS(r.target, { ch: 2 }); await card([`THE ${r.by.toUpperCase()} MARCH ON`, tname(r.target).toUpperCase(), `WITH ${r.force}`], 1900, 'bad'); }
      for (const e of ev) {
        if (e.type === 'dwarves_help' && e.clan === ME) await card(['DWARF MINERS', 'JOIN ' + tname(e.town).toUpperCase()], 1500, 'good');
        if (e.type === 'clan_out') await card([`THE ${e.clan.toUpperCase()}`, 'ARE NO MORE'], 1700);
        if (e.type === 'promoted' && e.clan === ME) { const c = w().chars[e.char]; if (c) await card([c.name, 'rises to captain'], 2200, 'good', await ink(c, c.clan)); }
        if ((e.type === 'captured') && w().chars[e.char] && w().chars[e.char].clan === ME) await card([w().chars[e.char].name, 'is taken prisoner'], 2400, 'bad', await ink(w().chars[e.char], ME));
      }
      const lost = Object.keys(before).filter((t) => before[t] === ME && w().towns[t].owner !== ME), gained = Object.keys(before).filter((t) => before[t] !== ME && w().towns[t].owner === ME);
      const others = Object.keys(before).filter((t) => before[t] !== w().towns[t].owner && before[t] !== ME && w().towns[t].owner !== ME).length;
      const hungry = ev.find((e) => e.type === 'hunger' && e.clan === ME);
      busy = false;
      if (w().war && w().war.over) return ending();
      const news = [lost.length ? `We lost ${lost.map(tname).join(', ')}.` : '', gained.length ? `We gained ${gained.map(tname).join(', ')}.` : '', others ? `Elsewhere ${others} township${others === 1 ? '' : 's'} changed hands.` : '', coming.length ? `Enemies are marching on ${coming.map((r) => tname(r.target)).join(' and ')}.` : '', hungry ? 'Food runs short, and unfed men drift home. Every 14 men eat 1 Food a turn, and men beyond 10 in one township eat double: spread them out.' : ''].filter(Boolean).join(' ');
      phase = 'orders'; paint();
      say(news || 'A quiet watch, Master. Nothing stirred.', [{ label: 'CONTINUE', wide: true, go: next }]);
    } catch (err) { busy = false; console.error(err); say(`Something broke: ${err.message}`, [{ label: 'CONTINUE', wide: true, go: next }]); }
  }
  async function ending() {
    const won = w().war.over.winner === ME; paint();
    if (!save.overShown) { save.overShown = true; persist(); await card(won ? ['THE LAND', 'IS YOURS'] : ['YOUR CLAN', 'IS BROKEN'], 2600, won ? 'good' : 'bad'); }
    say(won ? 'The war is won, Master. The clans kneel.' : `The war is lost, Master. The ${cap(w().war.over.winner || 'enemy')} rule here now.`, [{ label: 'NEW WAR', wide: true, go: startChoose }]);
  }
  function menu() {
    say('What do you wish, Master?', [
      { label: 'RESUME', go: () => (save ? next() : startChoose()) },
      ...(save ? [{ label: 'END TURN', go: endTurn }, { label: 'NEW WAR', go: () => say('Abandon this war and begin another?', [{ label: 'YES', go: startChoose }, { label: 'NO', go: next }]) }] : []),
      { label: 'HOME', go: () => ctx.showHome && ctx.showHome() },
    ]);
  }

  // ---- starting a war
  function startChoose() {
    phase = 'start'; pendingHome = null; save = null; store.set(SAVE, null); clearMap(); status();
    map.fitBounds(ctx.region.bounds, { padding: { top: 60, bottom: 240, left: 10, right: 10 }, duration: 600 });
    say('Master, where shall our clan raise its banner? Tap a township on the map.', []);
  }
  function confirmHome(id) {
    pendingHome = id; for (const m of ctx.byKey.values()) map.setFeatureState({ source: 'munis', id: m.id }, { cc: 0, ch: 0 });
    const th = G.board.theatre(id, 3, { min: 12, max: 60 });
    for (const t of th) setFS(t, { cc: 9 }); setFS(id, { cc: 1, ch: 1 });
    const ps = th.map((t) => muni(t)).filter(Boolean).map((m) => m.pt), b = ps.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [180, 90, -180, -90]);
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 70, bottom: 250, left: 30, right: 30 }, duration: 600 });
    say(`${G.board.town(id).name}. ${th.length} townships would be the field of war. Begin here?`, [{ label: 'BEGIN', go: () => begin(id) }, { label: 'ANOTHER', go: startChoose }]);
  }
  async function begin(home) {
    const now = Date.now(), seed = 'c1-' + now;
    const world = newWorld(G.board, { seed, home, clans: [{ id: ME, kind: 'goblin', lord: 'human' }, ...rivalsFor(seed)], startHour: 9, startMs: now - (now % 3600000), guidedStart: true, rules: { frontMinManeuvers: 0 } });
    delete world.clans[ME].ap;   // no action points here: one order per captain a turn
    world.clans[ME].freeMarch = true;   // and a march costs no Food: the whole garrison but one goes
    const dist = G.board.distances(home);
    const order = Object.keys(world.towns).sort((a, b) => (dist.get(a) - dist.get(b)) || (a < b ? -1 : 1));
    save = { v: SAVE_V, world, num: Object.fromEntries(order.map((t, i) => [t, i + 1])), acted: [], overShown: false };
    persist(); clearMap();
    await Promise.all(Object.values(world.chars).map((c) => face(c, c.clan)));
    await card(['DAY 1', 'MORNING'], 1200);
    const rivals = Object.keys(world.clans).filter((c) => c !== ME && c !== 'dwarves').map((c) => cap(c)).join(' and the ');
    phase = 'orders'; paint(); fit(Object.keys(world.towns), 600, 10.4);
    const p = progress(world, ME);
    say(`The ${rivals} hold the lands around us. Hold ${p.need} townships and the war is ours. Your captains await.`, [{ label: 'CONTINUE', wide: true, go: next }]);
  }

  function onMapClick(e) {
    if (ctx.mode !== 'goblin' || !G || busy) return;
    const m = ctx.locate([e.lngLat.lng, e.lngLat.lat]); if (!m) return;
    const id = m.key;
    if (phase === 'start') { if (!G.board.has(id)) return; return confirmHome(id); }
    if (!save || !w().towns[id]) return;
    if (phase === 'pick' && pick) { const o = pick.options.find((x) => x.to === id); if (o) return pick.kind === 'move' ? relocate(pick.q, o) : march(pick.q, o); }
    info(id);
  }
  const onZoom = () => { if (root) root.classList.toggle('far', map.getZoom() < 10); document.body.classList.toggle('cn-far', map.getZoom() < 9.9); };

  return {
    async enter() {
      document.body.classList.add('council-on');
      await load(); ensureLayers(); showLayers(true); mount(); root.hidden = false;
      if (!bound) { bound = true; map.on('click', onMapClick); map.on('zoom', onZoom); }
      onZoom();
      save = store.get(SAVE, null);
      if (!save || save.v !== SAVE_V || !save.world) { save = null; return startChoose(); }
      // saves from the first Council build: fronts could not reach their decision and locked the armies in; set the rule and bring those men home
      save.world.rules = { ...(save.world.rules || {}), frontMinManeuvers: 0 }; save.world.clans[ME].freeMarch = true;
      for (const o of legalOrders(G.board, w(), ME).filter((x) => x.type === 'front' && x.action === 'disengage')) run([o]);
      persist();
      await Promise.all(Object.values(w().chars).map((c) => face(c, c.clan)));
      paint(); next();
    },
    /** For the browser check only: show the ink plate card of your first captain. */
    async debugPlate() { const c = Object.values(w().chars).find((x) => x.clan === ME); return card([c.name, 'is taken prisoner'], 4000, 'bad', await ink(c, ME)); },
    leave() {
      document.body.classList.remove('council-on', 'cn-far'); clearInterval(typer);
      clearMap(); showLayers(false); if (root) root.hidden = true; phase = 'idle';
    },
  };
}
