// Goblin mode on the app's own map (M1: the skirmish layer, solo, placeholders). The simulation lives in ../sim and knows nothing of the screen;
// this file paints it onto the township polygons the app already draws and turns taps into orders.
import { makeBoard } from '../sim/board.js';
import { loadContent } from '../sim/chars.js';
import { newWorld, step } from '../sim/world.js';
import { entriesOf, renderLedger, placePhrase } from '../sim/ledger.js';
import { frontActions, openFronts } from '../sim/front.js';
import { captainsOf } from '../sim/chars.js';
import { K6, K7 } from '../sim/constants.js';
import { progress } from '../sim/war.js';
import { scoutMods, isNight, hasAp } from '../sim/sitting.js';
import { digestOf } from '../sim/digest.js';
import { MUNI_LABEL_IDS } from '../../style.js';

const ME = 'goblins';
const CLANS = [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }];
const NO = { goblins: 1, rats: 2, toads: 3 };
const COLOUR = { 1: '#3f9b5a', 2: '#b9712f', 3: '#3a86a8' };
const HOUR = 3600000, KEEP_EVENTS = 600, SAVE = 'goblin.save', SAVE_V = 3;
const MAJORS = [9, 12, 18];
const STAND = ['Behind', 'Even', 'Ahead', 'Commanding'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const easternHour = (t) => +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date(t));

export function initGoblin(ctx) {
  const { map, store } = ctx;
  const $ = (s) => document.querySelector(s);
  let G = null;            // { board, content } once loaded
  let save = null;         // { v, world, lastReal, events, seenTick }
  let sel = null;          // the township you have picked to send units from
  let timer = 0, bound = false, layersReady = false, mode = 'idle', pendingHome = null;

  // ---------------------------------------------------------------- loading and saving
  async function load() {
    if (G) return;
    const [bj, cj] = await Promise.all([fetch('data/goblin-board.json').then((r) => r.json()), fetch('data/goblin-content.json').then((r) => r.json())]);
    const content = loadContent(cj);
    G = { board: makeBoard(bj, content), content };   // content attached: townships can have captains, and so fronts
  }
  const persist = () => store.set(SAVE, save);
  const w = () => save.world;
  const run = (orders, ticks) => {
    const r = step(G.board, save.world, orders, ticks);
    save.world = r.state;
    save.events = [...save.events, ...r.events].slice(-KEEP_EVENTS);
    save.total = (save.total || 0) + r.events.length;
    persist();
    return r.events;
  };
  const ctxFor = (state = w()) => ({ board: G.board, state, content: G.content, clan: ME });
  function catchUp() {
    const n = Math.floor((Date.now() - save.lastReal) / HOUR);
    if (n <= 0) return [];
    save.lastReal += n * HOUR;
    return run([{ type: 'present', clan: ME }], 0).concat(run([], n));
  }

  // ---------------------------------------------------------------- map layers and painting
  function ensureLayers() {
    if (layersReady) return;
    layersReady = true;
    const before = MUNI_LABEL_IDS.find((id) => map.getLayer(id));
    const colour = ['match', ['coalesce', ['feature-state', 'gc'], 0]];
    for (const [k, v] of Object.entries(COLOUR)) colour.push(+k, v);
    colour.push('rgba(0,0,0,0)');
    map.addLayer({ id: 'gob-fill', type: 'fill', source: 'munis', layout: { visibility: 'none' }, paint: { 'fill-color': colour, 'fill-opacity': 0.5 } }, before);
    map.addLayer({ id: 'gob-target', type: 'fill', source: 'munis', layout: { visibility: 'none' },
      paint: { 'fill-color': ['match', ['coalesce', ['feature-state', 'gt'], 0], 1, '#dc2626', 2, '#2563eb', 'rgba(0,0,0,0)'], 'fill-opacity': ['match', ['coalesce', ['feature-state', 'gt'], 0], 0, 0, 0.28] } }, before);
    map.addLayer({ id: 'gob-line', type: 'line', source: 'munis', layout: { visibility: 'none' },
      paint: { 'line-color': ['case', ['==', ['coalesce', ['feature-state', 'gs'], 0], 1], '#111827', ['==', ['coalesce', ['feature-state', 'gr'], 0], 1], '#dc2626', 'rgba(0,0,0,0)'],
               'line-width': ['case', ['==', ['coalesce', ['feature-state', 'gs'], 0], 1], 4, 3] } }, before);
    map.addSource('gobforce', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'gob-force', type: 'symbol', source: 'gobforce', layout: { visibility: 'none', 'text-field': ['format', ['get', 'n'], { 'font-scale': 0.62 }, '\n', {}, ['get', 'f'], { 'font-scale': 1.15 }], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-line-height': 1.0, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
  }
  const hiddenLabels = new Map();
  const showLayers = (on) => {
    for (const id of ['gob-fill', 'gob-target', 'gob-line', 'gob-force']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    // the township names move into the force labels, so the map's own names step aside while the war is on
    for (const id of MUNI_LABEL_IDS) {
      if (!map.getLayer(id)) continue;
      if (on) { hiddenLabels.set(id, map.getLayoutProperty(id, 'visibility') || 'visible'); map.setLayoutProperty(id, 'visibility', 'none'); }
      else if (hiddenLabels.has(id)) { map.setLayoutProperty(id, 'visibility', hiddenLabels.get(id)); hiddenLabels.delete(id); }
    }
  };
  const muniOf = (id) => ctx.byKey.get(id);
  function paint() {
    if (!G || !save) return;
    const world = w();
    const raidTargets = new Set(world.raids.filter((r) => world.towns[r.target] && world.towns[r.target].owner === ME).map((r) => r.target));
    const nbs = sel ? new Set(G.board.neighbours(sel)) : new Set();
    const feats = [];
    for (const id of Object.keys(world.towns)) {
      const m = muniOf(id); if (!m) continue;
      const T = world.towns[id];
      const gt = sel && nbs.has(id) ? (T.owner === ME ? 2 : T.owner ? 1 : 0) : 0;
      map.setFeatureState({ source: 'munis', id: m.id }, { gc: NO[T.owner] || 0, gs: sel === id ? 1 : 0, gt, gr: raidTargets.has(id) ? 1 : 0 });
      feats.push({ type: 'Feature', properties: { f: String(T.force), n: (T.captain ? '★ ' : '') + m.n }, geometry: { type: 'Point', coordinates: m.pt } });
    }
    map.getSource('gobforce').setData({ type: 'FeatureCollection', features: feats });
  }
  function clearPaint() {
    if (!save) return;
    for (const id of Object.keys(w().towns)) { const m = muniOf(id); if (m) map.setFeatureState({ source: 'munis', id: m.id }, { gc: 0, gs: 0, gt: 0, gr: 0 }); }
  }
  function fitTheatre() {
    const pts = Object.keys(w().towns).map((id) => muniOf(id)).filter(Boolean).map((m) => m.pt);
    if (!pts.length) return;
    const b = pts.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [180, 90, -180, -90]);
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 90, bottom: 260, left: 30, right: 30 }, duration: ctx.dur ? ctx.dur(700) : 700 });
  }

  // ---------------------------------------------------------------- HUD and panels
  const clock = () => { const abs = w().startHour + w().tick; return `Day ${Math.floor(abs / 24) + 1}, ${String(abs % 24).padStart(2, '0')}:00`; };
  /** When the world next acts (a recruit-and-move tick at 09:00, 12:00 or 18:00), as a clock time and a countdown. */
  function nextMajor() {
    const world = w();
    for (let k = 1; k <= 24; k++) {
      const hr = (world.startHour + world.tick + k) % 24;
      if (MAJORS.includes(hr)) {
        const ms = Math.max(0, save.lastReal + HOUR - Date.now()) + (k - 1) * HOUR;
        const h = Math.floor(ms / HOUR), m = Math.ceil((ms % HOUR) / 60000);
        return { hour: String(hr).padStart(2, '0') + ':00', left: h ? `${h}h ${m === 60 ? 0 : m}m` : `${m}m` };
      }
    }
    return null;
  }
  function warLine() {
    const world = w();
    if (world.war && world.war.over) return world.war.over.winner === ME ? 'The war is won.' : 'The war is lost.';
    const p = progress(world, ME);
    const rival = Object.values(world.clans).filter((c) => c.id !== ME && !c.out).map((c) => ({ id: c.id, p: progress(world, c.id) })).sort((a, b) => b.p.held - a.p.held)[0];
    const hold = p.hoursLeft != null ? ` · holding it: ${Math.ceil(p.hoursLeft / 24 * 10) / 10 < 1 ? `${p.hoursLeft}h` : `${Math.ceil(p.hoursLeft / 24)}d`} to go` : '';
    return `War: hold ${p.need} of ${p.total} townships for ${K7.warHoldTicks / 24} days to win · you ${p.held}${rival ? ` · ${cap(rival.id)} ${rival.p.held}` : ''}${hold}`;
  }
  function hud() {
    const world = w();
    const mine = Object.values(world.towns).filter((t) => t.owner === ME);
    const units = mine.reduce((n, t) => n + t.force, 0);
    const fr = openFronts(world, ME).length;
    const nx = nextMajor();
    ctx.hud(`<div class="town">${mine.length} townships · ${units} units${fr ? ` · ${fr} front${fr === 1 ? '' : 's'}` : ''}</div>
      <div class="meta">Goblins · ${clock()} · actions ${world.clans[ME].ap} of ${K6.apCap}</div>
      <div class="meta">${warLine()}</div>
      <div class="meta">${nx ? `Next: ${nx.hour} (in ${nx.left}): +${K6.apPerMajor} actions, recruits, the other clans move` : ''}</div>`);
  }
  const panel = (html) => ctx.sheet(html);
  const closeBtn = '<button class="primary" data-g="close">Close</button>';

  function ownerName(o) { return o ? cap(o) : 'Nobody'; }
  const factWord = (f) => { const [kind, ref] = f.split(':'); return kind === 'trait' ? G.content.traits.get(ref).word : kind === 'fear' ? `afraid of ${ref}` : f; };
  function captainBlock(T) {
    const c = T.captain && w().chars[T.captain];
    if (!c) return '';
    const known = (c.known[ME] || []).map(factWord);
    return `<p>★ <b>${esc(c.name)}</b> of ${cap(c.clan)} commands here${c.injuries.length ? ` (hurt: ${c.injuries.map(esc).join(', ')})` : ''}. ${c.clan === ME ? '' : known.length ? `You know: ${known.map(esc).join(', ')}.` : 'You know nothing about them yet.'}</p>`;
  }
  const ap = () => w().clans[ME].ap;
  const touchesMine = (id) => G.board.neighbours(id).some((n) => w().towns[n] && w().towns[n].owner === ME);
  function townCard(id) {
    const T = w().towns[id], b = G.board.town(id);
    const mine = T.owner === ME;
    const cptn = T.captain && w().chars[T.captain];
    const near = cptn && !mine && touchesMine(id);
    const knownSome = cptn && (cptn.known[ME] || []).length;
    const fr = openFronts(w(), ME).find((f) => f.target === id);
    panel(`<div class="gob"><h3>${esc(b.name)} <small>${esc(b.county)} County</small></h3>
      <p>${ownerName(T.owner)} hold it with <b>${T.force}</b>${T.dugIn ? ', dug in' : ''}.</p>${captainBlock(T)}
      ${fr ? `<button class="primary" data-g="front" data-id="${fr.id}">Continue the front here</button>` : ''}
      ${near ? `<button data-g="scout" data-town="${esc(id)}">Scout the captain <span class="fine">1 action</span></button>${knownSome ? `<button data-g="taunt" data-town="${esc(id)}">Taunt the captain <span class="fine">1 action; the next front here starts a step higher</span></button>` : ''}` : ''}
      ${mine && T.force >= 3 && !T.dugIn ? `<button data-g="fortify" data-town="${esc(id)}">Dig in now <span class="fine">1 action; defenders fight better</span></button>` : ''}
      ${mine && T.force >= 2 ? '<p class="fine">Tap a township next to it to send units, or:</p><button class="primary" data-g="pick" data-id="' + esc(id) + '">Send units from here</button>' : mine ? '<p class="fine">One unit alone has to stay home.</p>' : ''}
      ${closeBtn}</div>`);
  }
  function orderPanel(from, to) {
    const F = w().towns[from], T = w().towns[to], bd = G.board.border(from, to) || {};
    const attack = T.owner !== ME;
    const front = attack && !!T.captain;
    const max = F.force - 1;
    const water = bd.river ? `across the ${typeof bd.river === 'string' ? esc(bd.river) : 'river'}` : bd.ridge ? 'over a ridge' : '';
    const hw = bd.highways && bd.highways.length ? `${esc(bd.highways[0])} runs through both` : '';
    const notes = [];
    if (attack && (bd.river || bd.ridge)) notes.push(hw ? `The ${bd.river ? 'river' : 'ridge'} is no obstacle: ${hw}.` : `Crossing ${bd.river ? 'the river' : 'the ridge'} makes the attackers' best roll worse.`);
    if (attack && T.dugIn) notes.push('They are dug in: their best roll is better.');
    if (attack && !hasAp(w().clans[ME], 1)) notes.push('You have no actions left. They refill at the next 09:00, 12:00 or 18:00.');
    if (front) notes.push('A captain defends it, so this is a front: a slow fight where you probe, press and look for a weakness before you decide. Nothing is lost until you decide, and you can pull back.');
    panel(`<div class="gob"><h3>${front ? 'Open a front at' : attack ? 'Attack' : 'Move to'} ${esc(G.board.town(to).name)}</h3>
      <p>${esc(placePhrase(G.board, from, to))}${water && !placePhrase(G.board, from, to).includes('over') ? ', ' + water : ''}. ${attack ? `${ownerName(T.owner)} hold it with <b>${T.force}</b>.` : `You hold it with <b>${T.force}</b>.`} You send from ${esc(G.board.town(from).name)} (<b>${F.force}</b>; one stays).</p>
      ${front ? captainBlock(T) : ''}${notes.map((n) => `<p class="fine">${n}</p>`).join('')}
      <label class="gobn">Send <b id="gobN">${max}</b><input id="gobRange" type="range" min="1" max="${max}" value="${max}"></label>
      <div class="gobrow"><button class="primary" data-g="send" data-from="${esc(from)}" data-to="${esc(to)}">${front ? 'Open the front' : attack ? 'Attack' : 'Move'}${attack ? ' <span class="fine">1 action</span>' : ''}</button><button data-g="close">Cancel</button></div></div>`);
    const r = $('#gobRange'); r.addEventListener('input', () => { $('#gobN').textContent = r.value; });
  }
  function resultPanel(events) {
    const en = entriesOf(events, ctxFor());
    const sk = events.find((e) => e.type === 'skirmish_result' && e.rounds);
    const dice = sk ? `<div class="gobdice">${sk.rounds.map((r, i) => `<div><span class="fine">Round ${i + 1}</span> you <b>${r.a.join(' ')}</b> · them <b>${r.d.join(' ')}</b> → ${r.dLost ? `${r.dLost} of theirs` : ''}${r.dLost && r.aLost ? ', ' : ''}${r.aLost ? `${r.aLost} of yours` : ''}</div>`).join('')}</div>` : '';
    const rej = events.find((e) => e.type === 'order_rejected');
    panel(`<div class="gob"><h3>${rej ? 'That did not work' : sk ? (sk.won ? 'Taken' : 'Thrown back') : 'Done'}</h3>
      ${rej ? `<p>${esc(rej.reason)}</p>` : en.map((e) => `<p>${esc(e.text)}</p>`).join('') || '<p>Done.</p>'}${dice}${closeBtn}</div>`);
  }
  const unseen = () => { const n = Math.max(0, (save.total || 0) - (save.seenTotal || 0)); return n ? save.events.slice(-n) : []; };
  function digestPanel(note) {
    const d = digestOf(unseen(), ctxFor());
    save.seenTotal = save.total || 0; persist();
    panel(`<div class="gob"><h3>${esc(d.headline)}</h3>
      ${d.incoming.map((i) => `<p class="warn">${esc(i.text)}</p>`).join('')}
      ${d.lines.map((l) => `<p><span class="fine">${esc(l.when)}</span> ${esc(l.text)}</p>`).join('')}
      ${d.hidden ? `<p class="fine">${d.hidden} more in the Ledger.</p>` : ''}
      ${note ? `<p class="fine">${esc(note)}</p>` : ''}
      <div class="gobrow"><button data-g="ledger">Everything</button><button class="primary" data-g="close">Close</button></div></div>`);
  }
  function ledgerPanel() {
    const en = entriesOf(save.events, ctxFor()).slice(-80).reverse();
    panel(`<div class="gob"><h3>Ledger</h3>${en.length ? en.map((e) => `<p><span class="fine">Day ${e.day} ${e.hour}</span> ${esc(e.text)}</p>`).join('') : '<p class="fine">Nothing has happened yet.</p>'}
      <div class="gobrow"><button data-g="copy">Copy</button><button class="primary" data-g="close">Close</button></div></div>`);
  }
  function warOverPanel() {
    const o = w().war.over, won = o.winner === ME;
    const days = Math.max(1, Math.round(o.tick / 24));
    const mine = Object.values(w().towns).filter((t) => t.owner === ME).length;
    save.overShown = true; persist();
    panel(`<div class="gob"><h3>${won ? 'The war is won' : 'The war is lost'}</h3>
      <p>${won ? 'Your goblins held more than half the map for three days.' : o.how === 'wiped out' ? 'Your goblins have no townships left.' : `The ${cap(o.winner)} held more than half the map for three days.`}</p>
      <p class="fine">It lasted ${days} day${days === 1 ? '' : 's'}. You finished with ${mine} townships.</p>
      <div class="gobrow"><button data-g="ledger">Ledger</button><button class="primary" data-g="newwar">New war</button></div></div>`);
  }
  function checkOver() { if (w().war && w().war.over && !save.overShown) { warOverPanel(); return true; } return false; }
  function startPanel() {
    mode = 'choose-home'; pendingHome = null; sel = null;
    ctx.hud('<div class="town">Goblin mode</div><div class="meta">Tap the township where your clan begins.</div>');
    panel('<div class="gob"><p>Pick your home township. Two rival clans, the rats and the toads, take the townships around it. The war runs in real hours, even while you are away.</p><button class="primary" data-g="cancelstart">Back</button></div>');
  }
  function confirmStart(id) {
    pendingHome = id; const b = G.board.town(id);
    const th = G.board.theatre(id, 3, { min: 12, max: 60 });
    panel(`<div class="gob"><h3>Start at ${esc(b.name)}?</h3><p>${th.length} townships are in play. You hold ${esc(b.name)} and the clans of rats and toads hold the rest.</p>
      <div class="gobrow"><button class="primary" data-g="begin">Begin the war</button><button data-g="startover">Choose another</button></div></div>`);
  }
  function beginWar(home) {
    const now = Date.now(), lastReal = now - (now % HOUR);
    const world = newWorld(G.board, { seed: 'm1-' + lastReal, home, clans: CLANS, startHour: easternHour(lastReal) });
    save = { v: SAVE_V, world, lastReal, events: [], total: 0, seenTotal: 0, overShown: false };
    persist(); mode = 'play'; sel = null;
    paint(); hud(); fitTheatre();
    doPanel();
  }


  // ---------------------------------------------------------------- sitting actions
  function scoutPanel(town) {
    const hour = (w().startHour + w().tick) % 24;
    const c = w().chars[w().towns[town].captain];
    const hint = {
      sneak: isNight(hour) ? 'Night is on your side.' : 'Easier after dark (from 21:00 to 05:00).',
      ask: G.board.town(town).pop >= K6.scoutBigTownPop ? 'A busy town: plenty of traders to ask.' : 'A quiet town: few traders.',
      watch: 'The water between lets you see in.',
    };
    const methods = ['sneak', 'ask'];
    if (scoutMods(w(), G.board, ME, town, 'watch').total > 0) methods.push('watch');
    const name = { sneak: 'Sneak in', ask: 'Ask around', watch: 'Watch from across the water' };
    panel(`<div class="gob"><h3>Scout ${esc(c.name)} at ${esc(G.board.town(town).name)}</h3>
      <p class="fine">One action. A good roll learns something about the captain; a bad one learns nothing, and a very bad one loses the scout.</p>
      ${methods.map((m) => `<button data-g="scoutdo" data-town="${esc(town)}" data-m="${m}"><b>${name[m]}</b> <span class="fine">${hint[m]}</span></button>`).join('')}
      <button data-g="close">Cancel</button></div>`);
  }
  function sittingResult(events) {
    const en = entriesOf(events, ctxFor());
    const rej = events.find((e) => e.type === 'order_rejected');
    const sc = events.find((e) => e.type === 'scouted' || e.type === 'taunted');
    panel(`<div class="gob"><h3>${rej ? 'That did not work' : sc && sc.type === 'scouted' ? (sc.lost ? 'The scout is gone' : sc.learned.length ? 'Something learned' : 'Nothing new') : sc ? (sc.ok ? 'It worked' : 'It backfired') : 'Done'}</h3>
      ${rej ? `<p>${esc(rej.reason)}</p>` : en.map((e) => `<p>${esc(e.text)}</p>`).join('')}
      ${sc ? `<p class="fine">Dice: ${sc.dice.join(' + ')}</p>` : ''}${closeBtn}</div>`);
  }

  // ---------------------------------------------------------------- fronts
  const LABEL = {
    probe: ['Probe', 'scout them; may reveal a trait'],
    pressure: ['Pressure', 'taunt, feint, show of force'],
    lever: ['Use a weakness', 'play on something you have learned'],
    bridge: ['Certain move', 'cross the water without a roll: Behind to Even'],
    decision: ['Decide', 'fight it out with everything committed'],
    disengage: ['Pull back', 'end the front; the units come home'],
  };
  function frontPanel(fid, events = []) {
    const f = w().fronts[fid];
    if (!f) return panel('');
    const T = w().towns[f.target], c = w().chars[f.captain];
    const acts = frontActions(w(), f);
    const en = events.length ? entriesOf(events, ctxFor()).map((e) => `<p class="fine">${esc(e.text)}</p>`).join('') : '';
    const dec = events.find((e) => e.type === 'front_beat' && e.maneuver === 'decision' && e.rounds);
    const known = c ? (c.known[ME] || []).map(factWord) : [];
    panel(`<div class="gob"><h3>Front at ${esc(G.board.town(f.target).name)}</h3>
      <p>Standing: <b>${STAND[f.standing]}</b> · beat ${f.beat + 1} · ${f.units} committed against <b>${T.force}</b>${f.lead ? ' · your captain leads' : ''}</p>
      <p>★ ${esc(c.name)}: ${known.length ? esc(known.join(', ')) : 'nothing known yet'}</p>${en}${dec ? '' : ''}
      ${acts.map((a) => `<button class="${a === 'decision' ? 'primary' : ''}" data-g="fact" data-front="${esc(fid)}" data-a="${a}"><b>${LABEL[a][0]}</b> <span class="fine">${LABEL[a][1]}</span></button>`).join('')}
      <button data-g="close">Close (the front waits)</button></div>`);
  }
  function afterFrontOrder(events, fid) {
    const closed = events.find((e) => e.type === 'front_closed');
    const rej = events.find((e) => e.type === 'order_rejected');
    sel = null; paint(); hud();
    if (checkOver()) return;
    if (rej) return panel(`<div class="gob"><h3>That did not work</h3><p>${esc(rej.reason)}</p>${closeBtn}</div>`);
    if (closed) {
      const en = entriesOf(events, ctxFor()).map((e) => `<p>${esc(e.text)}</p>`).join('');
      const dec = events.find((e) => e.type === 'front_beat' && e.maneuver === 'decision' && e.rounds);
      const dice = dec ? `<div class="gobdice">${dec.rounds.map((r, i) => `<div><span class="fine">Round ${i + 1}</span> you <b>${r.a.join(' ')}</b> · them <b>${r.d.join(' ')}</b></div>`).join('')}</div>` : '';
      return panel(`<div class="gob"><h3>Front ${closed.verdict === 'Won' || closed.verdict === 'Yielded' ? 'won' : closed.verdict === 'Lost' ? 'lost' : 'closed'}</h3>${en}${dice}${closeBtn}</div>`);
    }
    frontPanel(fid, events.filter((e) => e.type === 'front_beat' || e.type === 'closeup'));
  }

  // ---------------------------------------------------------------- what can I do?
  function suggestions() {
    const world = w(), out = [];
    for (const f of openFronts(world, ME)) out.push({ rank: 0, label: `Continue the front at ${G.board.town(f.target).name}`, sub: `${STAND[f.standing]}, beat ${f.beat + 1}`, data: `data-g="front" data-id="${f.id}"` });
    const cands = [];
    for (const id of Object.keys(world.towns)) {
      const F = world.towns[id];
      if (F.owner !== ME || F.force < 3) continue;
      for (const n of G.board.neighbours(id)) {
        const T = world.towns[n];
        if (!T || !T.owner || T.owner === ME) continue;
        const ratio = (F.force - 1) / Math.max(1, T.force);
        cands.push({ from: id, to: n, ratio, captain: !!T.captain, F, T });
      }
    }
    cands.sort((a, b) => (b.ratio - a.ratio) || (a.to < b.to ? -1 : 1));
    const seen = new Set();
    for (const c of cands) {
      const cp = c.captain && world.chars[c.T.captain];
      if (cp && !seen.has('s' + c.to) && out.length < 4) { seen.add('s' + c.to); out.push({ rank: 1, label: `Scout ${cp.name} at ${G.board.town(c.to).name}`, sub: (cp.known[ME] || []).length ? `You know ${(cp.known[ME] || []).length} thing${(cp.known[ME] || []).length === 1 ? '' : 's'} about them. 1 action` : 'You know nothing about them yet. 1 action', data: `data-g="scout" data-town="${esc(c.to)}"` }); }
    }
    for (const c of cands) {
      if (seen.has(c.to) || out.length >= 5) continue;
      seen.add(c.to);
      const how = c.ratio >= 2 ? 'a good chance' : c.ratio >= 1 ? 'an even fight' : 'risky';
      out.push({ rank: 1, label: `${c.captain ? 'Front' : 'Attack'}: ${G.board.town(c.to).name}`, sub: `${c.T.force} there (${cap(c.T.owner)}${c.captain ? ', a captain' : ''}) against your ${c.F.force - 1} from ${G.board.town(c.from).name}: ${how}`, data: `data-g="go" data-from="${esc(c.from)}" data-to="${esc(c.to)}"` });
    }
    return out;
  }
  function doPanel() {
    const list = suggestions(), nx = nextMajor();
    panel(`<div class="gob"><h3>What can I do?</h3>
      <p class="fine">There is no end-turn button. You have <b>${ap()}</b> action${ap() === 1 ? '' : 's'} (attacks, fronts, scouting, digging in and taunts cost one; moving is free). The world moves by itself on the hour: at 09:00, 12:00 and 18:00 you get ${K6.apPerMajor} more (up to ${K6.apCap}), everyone gets recruits and the other clans act${nx ? `. Next: ${nx.hour}, in ${nx.left}` : ''}.</p>
      ${list.length ? list.map((o) => `<button ${o.data}><b>${esc(o.label)}</b><br><span class="fine">${esc(o.sub)}</span></button>`).join('') : '<p>Nothing worth doing right now. Your townships next to enemies are too thin to attack. Wait for recruits.</p>'}
      ${closeBtn}</div>`);
  }

  // ---------------------------------------------------------------- taps and buttons
  function onMapClick(e) {
    if (ctx.mode !== 'goblin' || !G) return;
    const m = ctx.locate([e.lngLat.lng, e.lngLat.lat]);
    if (!m) return;
    const id = m.key;
    if (mode === 'choose-home') { if (!G.board.has(id)) return ctx.toast('Not on the war map'); return confirmStart(id); }
    if (!save || !w().towns[id]) return ctx.toast('Outside the war');
    if (w().war && w().war.over) return warOverPanel();
    const T = w().towns[id];
    if (sel && sel !== id && G.board.neighbours(sel).includes(id)) { if (T.owner === ME || T.owner) return orderPanel(sel, id); return ctx.toast('Nobody holds that'); }
    if (T.owner === ME && T.force >= 2) { sel = id; paint(); }
    else { sel = null; paint(); }
    townCard(id);
  }
  function onSheetClick(e) {
    if (ctx.mode !== 'goblin') return;
    const b = e.target.closest('[data-g]'); if (!b) return;
    const a = b.dataset.g;
    if (a === 'close') { sel = null; panel(''); paint(); }
    else if (a === 'pick') { sel = b.dataset.id; paint(); panel('<div class="gob"><p>Tap a neighbouring township: red to attack, blue to move units in.</p><button data-g="close">Cancel</button></div>'); }
    else if (a === 'send') {
      const from = b.dataset.from, to = b.dataset.to, n = +$('#gobRange').value;
      const T = w().towns[to];
      const type = T.owner === ME ? 'move' : T.captain ? 'front_open' : 'attack';
      const ev = run([{ type: 'present', clan: ME }, { type, clan: ME, from, to, n }], 0);
      sel = null; paint(); hud();
      if (checkOver()) return;
      if (type === 'front_open') { const o = ev.find((e) => e.type === 'front_opened'); return o ? frontPanel(o.front, ev.filter((e) => e.type === 'front_opened')) : afterFrontOrder(ev, null); }
      resultPanel(ev);
    }
    else if (a === 'front') frontPanel(b.dataset.id);
    else if (a === 'scout') scoutPanel(b.dataset.town);
    else if (a === 'scoutdo' || a === 'taunt' || a === 'fortify') {
      const o = a === 'scoutdo' ? { type: 'scout', clan: ME, town: b.dataset.town, method: b.dataset.m } : { type: a, clan: ME, town: b.dataset.town };
      const ev = run([{ type: 'present', clan: ME }, o], 0);
      paint(); hud(); if (checkOver()) return; sittingResult(ev);
    }
    else if (a === 'fact') { const ev = run([{ type: 'present', clan: ME }, { type: 'front', clan: ME, front: b.dataset.front, action: b.dataset.a, ...(b.dataset.a === 'decision' ? { n: (w().fronts[b.dataset.front] || {}).units } : {}) }], 0); afterFrontOrder(ev, b.dataset.front); }
    else if (a === 'go') { sel = b.dataset.from; paint(); orderPanel(b.dataset.from, b.dataset.to); }
    else if (a === 'ledger') ledgerPanel();
    else if (a === 'copy') { navigator.clipboard && navigator.clipboard.writeText(renderLedger(save.events, ctxFor())).then(() => ctx.toast('Copied'), () => ctx.toast('Could not copy')); }
    else if (a === 'cancelstart') { if (save) { mode = 'play'; panel(''); hud(); } else ctx.setMode(store.get('mode', 'practice') === 'goblin' ? 'practice' : store.get('mode', 'practice')); }
    else if (a === 'startover') startPanel();
    else if (a === 'begin') beginWar(pendingHome);
    else if (a === 'newwar') { startPanel(); }
  }
  function onBar(e) {
    const b = e.target.closest('[data-gbar]'); if (!b) return;
    const a = b.dataset.gbar;
    if (a === 'home') ctx.showHome && ctx.showHome();
    else if (!save) return;
    else if (a === 'do') { catchUp(); paint(); hud(); doPanel(); }
    else if (a === 'digest') { catchUp(); paint(); hud(); digestPanel(); }
    else if (a === 'ledger') ledgerPanel();
    else if (a === 'newwar') panel('<div class="gob"><p>Leave this war and start another? The current one is lost.</p><div class="gobrow"><button class="primary" data-g="newwar">Start another</button><button data-g="close">Keep this one</button></div></div>');
  }

  // ---------------------------------------------------------------- mode interface
  return {
    async enter() {
      document.body.classList.add('goblin-on');
      await load();
      ensureLayers(); showLayers(true);
      if (!bound) { bound = true; map.on('click', onMapClick); $('#sheet').addEventListener('click', onSheetClick); $('#gobbar').addEventListener('click', onBar); }
      save = store.get(SAVE, null);
      if (!save || !save.world || save.v !== SAVE_V) { save = null; return startPanel(); }
      mode = 'play'; sel = null;
      const ev = catchUp();
      paint(); hud(); fitTheatre();
      if (checkOver()) return;
      const d = digestOf(unseen(), ctxFor());
      if (d.lines.length || d.incoming.length) digestPanel(); else panel('');
      clearInterval(timer);
      timer = setInterval(() => { if (ctx.mode !== 'goblin' || !save) return; const ev2 = catchUp(); if (ev2.length) { paint(); hud(); checkOver(); } }, 30000);
    },
    leave() {
      clearInterval(timer); document.body.classList.remove('goblin-on');
      clearPaint(); showLayers(false); ctx.hud(''); panel(''); sel = null;
    },
  };
}
