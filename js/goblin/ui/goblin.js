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
import { skirmish, modsFor } from '../sim/skirmish.js';
import { makeRng, seedState } from '../sim/rng.js';
import { fogMap, forceWord, rank } from './fog.js';
import { recordReview } from './review.js';
import { active as ecoActive, marchCost, maxMarch, income as ecoIncome, hasBridge, bridgeCostFor } from '../sim/economy.js';
import { K8, K9 } from '../sim/constants.js';
import { footholdMods, ransomPrice, roomFor } from '../sim/encounters.js';
import { positionAt, messengerMood, convoysOf } from '../sim/convoys.js';
import { wordOf } from '../sim/director.js';
import { legalOrders } from '../sim/front.js';
import { messengerFace } from './messenger.js';
import { kitOf, kitById, kitName } from '../sim/regions.js';
import { untouchable } from '../sim/dwarves.js';
import { seasonOf, SEASONS } from '../sim/seasons.js';
import { nextChapterCfg, rivalsFor } from '../sim/chapters.js';
import { scoutMods, isNight, hasAp } from '../sim/sitting.js';
import { digestOf } from '../sim/digest.js';
import { MUNI_LABEL_IDS } from '../../style.js';

const ME = 'goblins';
const CLANS = [{ id: 'goblins', kind: 'goblin', lord: 'human' }, { id: 'rats', kind: 'rat', lord: 'ai' }, { id: 'toads', kind: 'toad', lord: 'ai' }];
const NO = { goblins: 1, rats: 2, toads: 3, gnomes: 4, dwarves: 5 };
const COLOUR = { 1: '#3f9b5a', 2: '#b9712f', 3: '#3a86a8', 4: '#8b5cf6', 5: '#a16207' };
const HOUR = 3600000, KEEP_EVENTS = 600, SAVE = 'goblin.save', SAVE_V = 4;
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
  let charge = null;       // a quiz charge earned and not yet used: { front, beat }
  let timer = 0, bound = false, layersReady = false, mode = 'idle', pendingHome = null;

  // ---------------------------------------------------------------- loading and saving
  async function load() {
    if (G) return;
    const [bj, cj, rj] = await Promise.all([fetch('data/goblin-board.json').then((r) => r.json()), fetch('data/goblin-content.json').then((r) => r.json()), fetch('data/goblin-regions.json').then((r) => r.json())]);
    const content = loadContent(cj);
    G = { board: makeBoard(bj, content, rj), content };   // content attached: townships can have captains, and so fronts
  }
  const persist = () => store.set(SAVE, save);
  const fw = () => G.content.json.force_words.map((x) => [x.min, x.max, x.word]);   // placeholder words, the user's to write (D68)
  /** What the player has learned decides what is shown (D173). Computed fresh each time from the review data and this war's play; nothing is written back. */
  const fog = () => fogMap(G.board, { srs: store.get('srs', {}), played: save.played || [], own: Object.keys(w().towns).filter((t) => w().towns[t].owner === ME), home: w().clans[ME].home });
  const levelOf = (id) => fog().get(id) || 'unknown';
  const markPlayed = (...ids) => { save.played = [...new Set([...(save.played || []), ...ids.filter(Boolean)])]; persist(); };
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
    map.addLayer({ id: 'gob-fog', type: 'fill', source: 'munis', layout: { visibility: 'none' }, paint: { 'fill-color': '#4b5563', 'fill-opacity': ['match', ['coalesce', ['feature-state', 'gf'], 0], 1, 0.55, 0] } }, before);
    map.addLayer({ id: 'gob-target', type: 'fill', source: 'munis', layout: { visibility: 'none' },
      paint: { 'fill-color': ['match', ['coalesce', ['feature-state', 'gt'], 0], 1, '#dc2626', 2, '#2563eb', 'rgba(0,0,0,0)'], 'fill-opacity': ['match', ['coalesce', ['feature-state', 'gt'], 0], 0, 0, 0.28] } }, before);
    map.addLayer({ id: 'gob-line', type: 'line', source: 'munis', layout: { visibility: 'none' },
      paint: { 'line-color': ['case', ['==', ['coalesce', ['feature-state', 'gs'], 0], 1], '#111827', ['==', ['coalesce', ['feature-state', 'gr'], 0], 1], '#dc2626', 'rgba(0,0,0,0)'],
               'line-width': ['case', ['==', ['coalesce', ['feature-state', 'gs'], 0], 1], 4, 3] } }, before);
    map.addSource('gobconvoy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'gob-convoy', type: 'circle', source: 'gobconvoy', layout: { visibility: 'none' }, paint: { 'circle-radius': 7, 'circle-color': ['match', ['get', 'clan'], 'goblins', COLOUR[1], 'rats', COLOUR[2], 'toads', COLOUR[3], 'gnomes', COLOUR[4], '#555'], 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' } });
    map.addSource('gobforce', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'gob-force', type: 'symbol', source: 'gobforce', layout: { visibility: 'none', 'text-field': ['format', ['get', 'n'], { 'font-scale': 0.62 }, '\n', {}, ['get', 'f'], { 'font-scale': 1.15 }], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-line-height': 1.0, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
  }
  const hiddenLabels = new Map();
  const showLayers = (on) => {
    for (const id of ['gob-fill', 'gob-fog', 'gob-target', 'gob-line', 'gob-force', 'gob-convoy']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
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
    const lv = fog();
    for (const id of Object.keys(world.towns)) {
      const m = muniOf(id); if (!m) continue;
      const T = world.towns[id];
      const L = lv.get(id) || 'unknown';
      const gt = sel && nbs.has(id) ? (T.owner === ME ? 2 : T.owner ? 1 : 0) : 0;
      map.setFeatureState({ source: 'munis', id: m.id }, { gc: L === 'unknown' ? 0 : NO[T.owner] || 0, gf: L === 'unknown' ? 1 : 0, gs: sel === id ? 1 : 0, gt, gr: raidTargets.has(id) ? 1 : 0 });
      const label = L === 'unknown' ? { n: '', f: '' } : L === 'rumoured' ? { n: m.n, f: '?' } : L === 'familiar' ? { n: (T.captain ? '★ ' : '') + m.n, f: forceWord(T.force, fw()) } : { n: (T.captain ? '★ ' : '') + m.n, f: String(T.force) };
      feats.push({ type: 'Feature', properties: label, geometry: { type: 'Point', coordinates: m.pt } });
    }
    map.getSource('gobforce').setData({ type: 'FeatureCollection', features: feats });
    // convoys: moved only when the tick changes, because their place is worked out from it (D114); a rival's is seen only through a township you know a little
    const dots = [];
    for (const c of (world.convoys || [])) {
      const p = positionAt(c, world.tick), a = muniOf(p.at);
      if (!a || (c.clan !== ME && rank(lv.get(p.at) || 'unknown') < rank('familiar'))) continue;
      const b = p.next && muniOf(p.next);
      const pt = b ? [a.pt[0] + (b.pt[0] - a.pt[0]) * p.frac, a.pt[1] + (b.pt[1] - a.pt[1]) * p.frac] : a.pt;
      dots.push({ type: 'Feature', properties: { clan: c.clan }, geometry: { type: 'Point', coordinates: pt } });
    }
    map.getSource('gobconvoy').setData({ type: 'FeatureCollection', features: dots });
  }
  function clearPaint() {
    if (!save) return;
    for (const id of Object.keys(w().towns)) { const m = muniOf(id); if (m) map.setFeatureState({ source: 'munis', id: m.id }, { gc: 0, gf: 0, gs: 0, gt: 0, gr: 0 }); }
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
  /** Food, Build and Coin (F2), with a plain warning when Food runs short. */
  function resLine() {
    const c = w().clans[ME];
    if (!ecoActive(c)) return '';
    const inc = ecoIncome(w(), ME, G.board);
    const warn = c.short > 0 ? `<div class="meta warnline">Short of Food: units will start drifting home ${c.short > K8.graceMajors ? 'now' : `if it lasts ${K8.graceMajors + 1 - c.short} more tick${K8.graceMajors + 1 - c.short === 1 ? '' : 's'}`}.</div>` : '';
    return `<div class="meta">Food ${c.res.food} (+${inc.food} a tick) · Build ${c.res.build} · Coin ${c.res.coin}</div>${warn}`;
  }
  function regionLine() {
    const world = w(), k = kitById(G.board, kitOf(G.board, world.clans[ME].home)), se = seasonOf(world);
    return `Chapter ${(world.campaign && world.campaign.chapter) || 1}${k ? ` · ${esc(k.name)}` : ''}${se ? ` · ${SEASONS[se].name}` : ''}`;
  }
  function hud() {
    const world = w();
    const mine = Object.values(world.towns).filter((t) => t.owner === ME);
    const units = mine.reduce((n, t) => n + t.force, 0);
    const fr = openFronts(world, ME).length;
    const nx = nextMajor();
    ctx.hud(`<div class="town">${mine.length} townships · ${units} units${fr ? ` · ${fr} front${fr === 1 ? '' : 's'}` : ''}</div>
      <div class="meta">${regionLine()}</div>
      <div class="meta">Goblins · ${clock()} · actions ${world.clans[ME].ap} of ${K6.apCap}</div>
      ${resLine()}
      <div class="meta">${warLine()}</div>
      <div class="meta">${nx ? `Next: ${nx.hour} (in ${nx.left}): +${K6.apPerMajor} actions, recruits, the other clans move` : ''}</div>`);
  }
  const panel = (html) => ctx.sheet(html);
  const closeBtn = '<button class="primary" data-g="close">Close</button>';

  function ownerName(o) { return o ? cap(o) : 'Nobody'; }
  const factWord = (f) => { const [kind, ref] = f.split(':'); return kind === 'trait' ? G.content.traits.get(ref).word : kind === 'fear' ? `afraid of ${ref}` : f; };
  function captainBlock(T, L = 'known') {
    const c = T.captain && w().chars[T.captain];
    if (!c || rank(L) < rank('familiar')) return '';
    if (c.clan !== ME && L === 'familiar') return '<p>★ A captain commands here.</p>';
    const known = (c.known[ME] || []).map(factWord);
    const st = c.state && G.content.states.get(c.state) ? ` <b>${esc(G.content.states.get(c.state).word)}</b>.` : '';
    return `<p>★ <b>${esc(c.name)}</b>${c.tier === 3 ? ' <i>(a legend)</i>' : ''} of ${cap(c.clan)} commands here${c.injuries.length ? ` (hurt: ${c.injuries.map(esc).join(', ')})` : ''}.${st} ${c.clan === ME ? '' : known.length ? `You know: ${known.map(esc).join(', ')}.` : 'You know nothing about them yet.'}</p>`;
  }
  /** What the player may be told about a township's owner and strength, by how well they know the place (D173, F1). */
  function whatYouKnow(id, L) {
    const T = w().towns[id];
    if (T.owner === ME) return `You hold it with <b>${T.force}</b>${T.dugIn ? ', dug in' : ''}.`;
    if (L === 'unknown') return 'You know nothing of this place. Learn it in the quiz and it will show.';
    if (L === 'rumoured') return `${ownerName(T.owner)} are said to hold it. You do not know how strongly.`;
    if (L === 'familiar') return `${ownerName(T.owner)} hold it with ${forceWord(T.force, fw())}${T.dugIn ? ', dug in' : ''}.`;
    return `${ownerName(T.owner)} hold it with <b>${T.force}</b>${T.dugIn ? ', dug in' : ''}.`;
  }
  const ap = () => w().clans[ME].ap;
  const touchesMine = (id) => G.board.neighbours(id).some((n) => w().towns[n] && w().towns[n].owner === ME);
  /** Convoys passing through a township you can see, with a Raid button when you could strike one. */
  function convoyLines(id) {
    const here = (w().convoys || []).filter((c) => positionAt(c, w().tick).at === id);
    if (!here.length) return '';
    const lv = levelOf(id);
    const can = new Set(legalOrders(G.board, w(), ME).filter((o) => o.type === 'raidconvoy').map((o) => o.convoy));
    return here.filter((c) => c.clan === ME || rank(lv) >= rank('familiar')).map((c) => `<p>${c.clan === ME ? 'Your convoy is here' : `A ${cap(c.clan)} convoy is passing`}: ${[c.cargo.build ? `${c.cargo.build} Build` : '', c.cargo.coin ? `${c.cargo.coin} Coin` : ''].filter(Boolean).join(' and ')}.</p>${can.has(c.id) ? `<button data-g="raidconvoy" data-convoy="${esc(c.id)}">Raid it <span class="fine">1 action</span></button>` : ''}`).join('');
  }
  /** What a rock town says: the dwarves cannot be conquered, only befriended (D158 to D161). */
  function rockBlock(id, L) {
    if (!untouchable(w(), G.board, id) || rank(L) < rank('rumoured')) return '';
    const friend = w().dwarfFriends && w().dwarfFriends[ME] && w().dwarfFriends[ME].town === id;
    const can = !friend && touchesMine(id) && rank(L) >= rank('familiar');
    const rock = (G.board.regions.rock[id] || []).join(', ');
    return `<p>The dwarves hold the rock here${rock ? ` (${esc(rock)})` : ''}. Nobody can take it. ${friend ? 'They are your friends: miners come to your township beside it.' : 'Rivals who push at it are answered. You can seek them out as friends.'}</p>${can ? `<button data-g="seek" data-town="${esc(id)}">Seek the dwarves <span class="fine">1 action</span></button>` : ''}`;
  }
  function townCard(id) {
    const T = w().towns[id], b = G.board.town(id);
    const mine = T.owner === ME;
    const cptn = T.captain && w().chars[T.captain];
    const L = levelOf(id);
    const near = cptn && !mine && touchesMine(id) && rank(L) >= rank('familiar');
    const knownSome = cptn && (cptn.known[ME] || []).length;
    const fr = openFronts(w(), ME).find((f) => f.target === id);
    panel(`<div class="gob"><h3>${esc(b.name)} <small>${esc(b.county)} County</small></h3>
      <p>${whatYouKnow(id, L)}</p>${rockBlock(id, L)}${captainBlock(T, L)}
      ${convoyLines(id)}
      ${fr ? `<button class="primary" data-g="front" data-id="${fr.id}">Continue the front here</button>` : ''}
      ${near ? `<button data-g="scout" data-town="${esc(id)}">Scout the captain <span class="fine">1 action</span></button>${knownSome ? `<button data-g="talk" data-town="${esc(id)}">Talk to the captain <span class="fine">taunt, insult, parley or duel</span></button>` : ''}` : ''}
      ${!cptn && !mine && T.owner && !untouchable(w(), G.board, id) && touchesMine(id) && rank(L) >= rank('familiar') && !(w().footholds || {})[id] ? `<button data-g="foothold" data-town="${esc(id)}">Try for a foothold <span class="fine">1 action; decided at the next tick</span></button>` : ''}
      ${mine && T.force >= 3 && !T.dugIn ? `<button data-g="fortify" data-town="${esc(id)}">Dig in now <span class="fine">${ecoActive(w().clans[ME]) ? `${K8.fortifyCost} Build` : '1 action'}; defenders fight better</span></button>` : ''}
      ${mine && T.force >= 2 ? '<p class="fine">Tap a township next to it to send units, or:</p><button class="primary" data-g="pick" data-id="' + esc(id) + '">Send units from here</button>' : mine ? '<p class="fine">One unit alone has to stay home.</p>' : ''}
      ${closeBtn}</div>`);
  }
  function orderPanel(from, to) {
    const F = w().towns[from], T = w().towns[to], bd = G.board.border(from, to) || {};
    const attack = T.owner !== ME;
    const L = levelOf(to);
    const front = attack && !!T.captain;
    const blind = attack && rank(L) < rank('familiar');
    const max = attack ? Math.max(1, maxMarch(w().clans[ME], F.force)) : F.force - 1;
    const noFood = attack && maxMarch(w().clans[ME], F.force) < 1;
    const water = bd.river ? `across the ${typeof bd.river === 'string' ? esc(bd.river) : 'river'}` : bd.ridge ? 'over a ridge' : '';
    const hw = bd.highways && bd.highways.length ? `${esc(bd.highways[0])} runs through both` : '';
    const notes = [];
    if (attack && (bd.river || bd.ridge)) notes.push(hw ? `The ${bd.river ? 'river' : 'ridge'} is no obstacle: ${hw}.` : `Crossing ${bd.river ? 'the river' : 'the ridge'} makes the attackers' best roll worse.`);
    if (attack && T.dugIn) notes.push('They are dug in: their best roll is better.');
    if (noFood) notes.push(`You have no Food for a march (${marchCost(1)} needed). Food comes every tick.`);
    else if (attack && ecoActive(w().clans[ME]) && maxMarch(w().clans[ME], F.force) < F.force - 1) notes.push(`Your Food only pays for ${maxMarch(w().clans[ME], F.force)} units to march.`);
    if (attack && !hasAp(w().clans[ME], 1)) notes.push('You have no actions left. They refill at the next 09:00, 12:00 or 18:00.');
    if (front) notes.push('A captain defends it, so this is a front: a slow fight where you probe, press and look for a weakness before you decide. Nothing is lost until you decide, and you can pull back.');
    panel(`<div class="gob"><h3>${front ? 'Open a front at' : attack ? 'Attack' : 'Move to'} ${esc(G.board.town(to).name)}</h3>
      <p>${esc(placePhrase(G.board, from, to))}${water && !placePhrase(G.board, from, to).includes('over') ? ', ' + water : ''}. ${attack ? whatYouKnow(to, L) : `You hold it with <b>${T.force}</b>.`}${blind ? ' You would attack blind.' : ''} You send from ${esc(G.board.town(from).name)} (<b>${F.force}</b>; one stays).</p>
      ${front ? captainBlock(T, L) : ''}${notes.map((n) => `<p class="fine">${n}</p>`).join('')}
      <label class="gobn">Send <b id="gobN">${max}</b> <span class="fine" id="gobCost">${attack && ecoActive(w().clans[ME]) ? `costs ${marchCost(max)} Food` : ''}</span><input id="gobRange" type="range" min="1" max="${max}" value="${max}"></label>
      ${attack && ecoActive(w().clans[ME]) && (bd.river) && !hasBridge(w(), ME, from, to) && w().clans[ME].res.build >= bridgeCostFor(w(), G.board, ME, from) ? `<button data-g="bridge" data-from="${esc(from)}" data-to="${esc(to)}">Build a goblin bridge here <span class="fine">${bridgeCostFor(w(), G.board, ME, from)} Build, ${K8.bridgeMajors} ticks: the river stops hurting you</span></button>` : ''}
      <div class="gobrow"><button class="primary" data-g="send" data-from="${esc(from)}" data-to="${esc(to)}">${front ? 'Open the front' : attack ? 'Attack' : 'Move'}${attack ? ' <span class="fine">1 action</span>' : ''}</button><button data-g="close">Cancel</button></div></div>`);
    const r = $('#gobRange'); r.addEventListener('input', () => { $('#gobN').textContent = r.value; const c = $('#gobCost'); if (c && attack && ecoActive(w().clans[ME])) c.textContent = `costs ${marchCost(+r.value)} Food`; });
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
    panel(`<div class="gob">${messengerBlock()}<h3>${esc(d.headline)}</h3>
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
  /** The first two minutes (D198): one obvious, near-certain first move against the weakest garrison with no captain, one tap to do it. */
  function firstMove() {
    const world = w(); let best = null;
    const rng = makeRng(seedState('first-move'));
    for (const id of Object.keys(world.towns)) {
      const F = world.towns[id];
      if (F.owner !== ME || F.force < 3) continue;
      for (const n of G.board.neighbours(id)) {
        const T = world.towns[n];
        if (!T || !T.owner || T.owner === ME || T.captain || untouchable(w(), G.board, n)) continue;
        const b = G.board.border(id, n) || {};
        const mods = modsFor({ dugIn: T.dugIn, captainLeads: !!F.captain, riverBorder: !!(b.river || b.ridge), highway: !!(b.highways && b.highways.length) });
        let won = 0; for (let i = 0; i < 300; i++) if (skirmish({ attackers: F.force - 1, defenders: T.force, ...mods }, rng).won) won++;   // used only to choose the move; never shown
        if (!best || won > best.won) best = { from: id, to: n, won, F, T };
      }
    }
    if (best && best.won < 240) best = null;   // not near-certain (80 percent): leave the first move to the player
    if (!best) return doPanel();
    const n = best.F.force - 1;
    panel(`<div class="gob"><h3>Your first move</h3>
      <p>${esc(G.board.town(best.to).name)} is held by ${cap(best.T.owner)} with only <b>${best.T.force}</b>. You can send <b>${n}</b> from ${esc(G.board.town(best.from).name)}.</p>
      <p class="fine">Your green townships are yours. Red and brown are the rivals. The war moves on its own on the hour, so you can stop whenever you like.</p>
      <div class="gobrow"><button class="primary" data-g="first" data-from="${esc(best.from)}" data-to="${esc(best.to)}" data-n="${n}">Send them</button><button data-g="close">I'll look around</button></div></div>`);
  }
  function nextRegionName() { try { return kitName(G.board, kitOf(G.board, nextChapterCfg(G.board, w()).home)); } catch { return 'a new region'; } }
  /** A won chapter opens the next region with your clan; a lost one repeats this region with new rivals (D175). */
  function beginChapter(cfg) {
    const now = Date.now(), lastReal = now - (now % HOUR);
    const world = newWorld(G.board, { ...cfg, startHour: easternHour(lastReal), startMs: lastReal, guidedStart: true });
    save = { v: SAVE_V, world, lastReal, events: [], total: 0, seenTotal: 0, overShown: false, played: save.played || [], charges: save.charges };
    persist(); mode = 'play'; sel = null; charge = null;
    paint(); hud(); fitTheatre(); firstMove();
  }
  function warOverPanel() {
    const o = w().war.over, won = o.winner === ME;
    const days = Math.max(1, Math.round(o.tick / 24));
    const mine = Object.values(w().towns).filter((t) => t.owner === ME).length;
    save.overShown = true; persist();
    panel(`<div class="gob"><h3>${won ? 'The war is won' : 'The war is lost'}</h3>
      <p>${won ? 'Your goblins held more than half the map for three days.' : o.how === 'wiped out' ? 'Your goblins have no townships left.' : `The ${cap(o.winner)} held more than half the map for three days.`}</p>
      <p class="fine">It lasted ${days} day${days === 1 ? '' : 's'}. You finished with ${mine} townships.</p>
      ${won ? `<p>The next region is <b>${esc(nextRegionName())}</b>. Your clan, your captains and your stores go with you; new rivals wait there.</p>` : '<p>The same region waits, with new rivals. Your clan and your captains stay with you.</p>'}
      <div class="gobrow"><button data-g="ledger">Ledger</button><button class="primary" data-g="${won ? 'nextchapter' : 'retry'}">${won ? 'On to the next region' : 'Try this region again'}</button></div><button data-g="newwar">Start over from scratch</button></div>`);
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
    const seed = 'm1-' + lastReal;
    const world = newWorld(G.board, { seed, home, clans: [CLANS[0], ...rivalsFor(seed)], startHour: easternHour(lastReal), startMs: lastReal, guidedStart: true });
    save = { v: SAVE_V, world, lastReal, events: [], total: 0, seenTotal: 0, overShown: false, played: [] };
    persist(); mode = 'play'; sel = null;
    paint(); hud(); fitTheatre();
    firstMove();
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
  function talkPanel(town) {
    const T = w().towns[town], c = w().chars[T.captain]; if (!c) return panel('');
    const me = w().clans[ME], hasCoin = ecoActive(me) && me.res.coin >= K9.parleyCost;
    const duelOk = G.board.neighbours(town).some((n) => w().towns[n] && w().towns[n].owner === ME && w().towns[n].captain);
    panel(`<div class="gob"><h3>Talk to ${esc(c.name)}</h3>
      <p class="fine">Each costs one action. ${esc(c.name)} is ${c.state ? esc(G.content.states.get(c.state).word.toLowerCase()) : 'steady'}.</p>
      <button data-g="taunt" data-town="${esc(town)}"><b>Taunt</b> <span class="fine">the next front here starts a step higher</span></button>
      <button data-g="insult" data-town="${esc(town)}"><b>Insult</b> <span class="fine">shake their nerve; a shaken captain fights worse for a while</span></button>
      ${hasCoin ? `<button data-g="parley" data-town="${esc(town)}"><b>Parley</b> <span class="fine">${K9.parleyCost} Coin: a day's truce from this township</span></button>` : ''}
      ${duelOk ? `<button data-g="duel" data-town="${esc(town)}"><b>Duel</b> <span class="fine">your captain against theirs; a loser may be hurt</span></button>` : ''}
      <button data-g="close">Cancel</button></div>`);
  }
  function footholdPanel(town) {
    const hour = (w().startHour + w().tick) % 24;
    const hint = { swarm: 'Numbers count: the more you can bring, the better.', night: 'Better after dark (21:00 to 05:00).', ford: 'Cross the water where they do not expect it. Riskier.' };
    const name = { swarm: 'Swarm', night: 'By night', ford: 'Ford the river' };
    const methods = ['swarm'];
    if (footholdMods(w(), G.board, ME, town, 'night').mods.some((m) => m.v > 0)) methods.push('night');
    if (footholdMods(w(), G.board, ME, town, 'ford').mods.some((m) => m.v > 0)) methods.push('ford');
    const tired = footholdMods(w(), G.board, ME, town, 'swarm').mods.some((m) => m.why === 'your scouts are tired');
    panel(`<div class="gob"><h3>A foothold at ${esc(G.board.town(town).name)}</h3>
      <p class="fine">One action. A good roll plants a foothold, and at the next 09:00, 12:00 or 18:00 it becomes a conquest if your border garrison can hold it. ${tired ? 'Your scouts are tired from earlier runs today.' : ''}</p>
      ${methods.map((m) => `<button data-g="footdo" data-town="${esc(town)}" data-m="${m}"><b>${name[m]}</b> <span class="fine">${hint[m]}</span></button>`).join('')}
      <button data-g="close">Cancel</button></div>`);
  }
  function prisoners() {
    const list = Object.values(w().chars).filter((c) => c.status === 'captured' && c.heldBy === ME);
    if (!list.length) return '';
    return `<h4>Prisoners</h4>` + list.map((c) => `<p>${esc(c.name)} of ${cap(c.clan)} <span class="fine">(costs ${K9.keepFood} Food a tick to keep)</span></p>
      <div class="gobrow">${roomFor(w(), c) ? `<button data-g="ransom" data-char="${esc(c.id)}">Ransom <span class="fine">${ransomPrice(c)} Coin</span></button><button data-g="release" data-char="${esc(c.id)}">Let go <span class="fine">they will remember</span></button>` : '<span class="fine">Their clan has no place for them yet.</span>'}</div>`).join('');
  }
  function sittingResult(events) {
    const en = entriesOf(events, ctxFor());
    const rej = events.find((e) => e.type === 'order_rejected');
    const sc = events.find((e) => e.type === 'scouted' || e.type === 'taunted' || e.type === 'insulted');
    const other = events.find((e) => ['foothold_run', 'dueled', 'parleyed', 'ransomed', 'released', 'convoy_raided', 'guarded', 'dwarves_sought'].includes(e.type));
    panel(`<div class="gob"><h3>${rej ? 'That did not work' : other ? ({ foothold_run: other.placed ? 'A foothold' : 'No foothold', dueled: other.won === null ? 'A standoff' : other.won ? 'You won the duel' : 'You lost the duel', parleyed: 'A truce', ransomed: 'Ransomed', released: 'Let go', convoy_raided: other.won ? 'The convoy is yours' : 'Beaten off', guarded: 'Guarded', dwarves_sought: other.ok ? 'The dwarves are friends' : 'Turned away' })[other.type] : sc && sc.type === 'scouted' ? (sc.lost ? 'The scout is gone' : sc.learned.length ? 'Something learned' : 'Nothing new') : sc ? (sc.ok ? 'It worked' : 'It backfired') : 'Done'}</h3>
      ${rej ? `<p>${esc(rej.reason)}</p>` : en.map((e) => `<p>${esc(e.text)}</p>`).join('')}
      ${sc && sc.dice ? `<p class="fine">Dice: ${sc.dice.join(' + ')}</p>` : ''}${closeBtn}</div>`);
  }

  // ---------------------------------------------------------------- the quiz charge (D179)
  const prefs = () => ({ charges: true, ...store.get('goblin.prefs', {}) });
  const dayNo = () => Math.floor(Date.now() / 864e5);
  const chargesToday = () => (save.charges && save.charges.day === dayNo() ? save.charges.n : 0);
  const MAXC = 3;
  function chargeBlock(f) {
    if (!prefs().charges) return '';
    if (charge && charge.front === f.id && charge.beat === f.beat) return '<p class="fine">Charged: +1 on your next move.</p>';
    if (chargesToday() >= MAXC) return '';
    return `<button data-g="chargeq" data-front="${esc(f.id)}">Charge it with a question <span class="fine">optional: +1 on your next move; it also counts as a review</span></button>`;
  }
  function chargeQuestion(fid) {
    const f = w().fronts[fid]; if (!f) return panel('');
    const m = ctx.byKey.get(f.target); if (!m) return frontPanel(fid);
    const others = ctx.counties.filter((c) => c !== m.c).sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [m.c, ...others].sort(() => Math.random() - 0.5);
    panel(`<div class="gob"><h3>Which county is ${esc(m.n)} in?</h3>
      <p class="fine">A right answer charges your next move. A wrong one costs nothing.</p>
      ${opts.map((c) => `<button data-g="chargea" data-front="${esc(fid)}" data-ans="${esc(c)}" data-right="${esc(m.c)}">${esc(c)}</button>`).join('')}
      <button data-g="front" data-id="${esc(fid)}">Skip</button></div>`);
  }
  function chargeAnswer(fid, ans, right) {
    const f = w().fronts[fid]; if (!f) return panel('');
    const m = ctx.byKey.get(f.target), ok = ans === right;
    recordReview(store, m.key, ok);
    ctx.setKnow && ctx.setKnow(m);
    save.charges = { day: dayNo(), n: chargesToday() + 1 }; persist();
    if (ok) charge = { front: fid, beat: f.beat };
    panel(`<div class="gob"><h3>${ok ? 'Right' : `It is ${esc(right)} County`}</h3>
      <p>${ok ? 'Your next move is charged: +1.' : 'No charge this time, and the town will come back in your practice.'}</p>
      <button class="primary" data-g="front" data-id="${esc(fid)}">Back to the front</button></div>`);
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
      ${acts.some((a) => ['probe', 'pressure', 'lever'].includes(a)) ? chargeBlock(f) : ''}
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
    const world = w(), out = [], lv = fog();
    let hidden = 0;
    for (const f of openFronts(world, ME)) out.push({ rank: 0, label: `Continue the front at ${G.board.town(f.target).name}`, sub: `${STAND[f.standing]}, beat ${f.beat + 1}`, data: `data-g="front" data-id="${f.id}"` });
    const cands = [];
    for (const id of Object.keys(world.towns)) {
      const F = world.towns[id];
      if (F.owner !== ME || F.force < 3) continue;
      for (const n of G.board.neighbours(id)) {
        const T = world.towns[n];
        if (!T || !T.owner || T.owner === ME) continue;
        if (untouchable(world, G.board, n)) continue;
        if (rank(lv.get(n) || 'unknown') < rank('familiar')) { hidden++; continue; }   // you cannot weigh what you have not learned
        const ratio = (F.force - 1) / Math.max(1, T.force);
        cands.push({ from: id, to: n, ratio, captain: !!T.captain, F, T });
      }
    }
    cands.sort((a, b) => (b.ratio - a.ratio) || (a.to < b.to ? -1 : 1));
    const seen = new Set();
    for (const c of cands) {
      const cp = c.captain && world.chars[c.T.captain];
      const Lc = lv.get(c.to);
      if (cp && !seen.has('s' + c.to) && out.length < 4) { seen.add('s' + c.to); out.push({ rank: 1, label: Lc === 'known' ? `Scout ${cp.name} at ${G.board.town(c.to).name}` : `Scout the captain at ${G.board.town(c.to).name}`, sub: (cp.known[ME] || []).length ? `You know ${(cp.known[ME] || []).length} thing${(cp.known[ME] || []).length === 1 ? '' : 's'} about them. 1 action` : 'You know nothing about them yet. 1 action', data: `data-g="scout" data-town="${esc(c.to)}"` }); }
    }
    for (const c of cands) {
      if (seen.has(c.to) || out.length >= 5) continue;
      seen.add(c.to);
      const how = c.ratio >= 2 ? 'a good chance' : c.ratio >= 1 ? 'an even fight' : 'risky';
      const known = lv.get(c.to) === 'known';
      out.push({ rank: 1, label: `${c.captain ? 'Front' : 'Attack'}: ${G.board.town(c.to).name}`, sub: known ? `${c.T.force} there (${cap(c.T.owner)}${c.captain ? ', a captain' : ''}) against your ${c.F.force - 1} from ${G.board.town(c.from).name}: ${how}` : `${cap(c.T.owner)} hold it with ${forceWord(c.T.force, fw())}${c.captain ? ', and a captain' : ''}. You can send ${c.F.force - 1} from ${G.board.town(c.from).name}.`, data: `data-g="go" data-from="${esc(c.from)}" data-to="${esc(c.to)}"` });
    }
    const rp = world.reprisal && world.reprisal[ME];
    if (rp && world.tick <= rp.until && world.towns[rp.target] && world.towns[rp.target].owner === rp.by) out.unshift({ rank: 0, label: `Answer the ambush at ${G.board.town(rp.target).name}`, sub: `The ${cap(rp.by)} struck your convoy from there. The first attack on it costs no action.`, data: `data-g="go" data-from="${esc(G.board.neighbours(rp.target).find((n) => world.towns[n] && world.towns[n].owner === ME) || '')}" data-to="${esc(rp.target)}"` });
    for (const o of legalOrders(G.board, world, ME).filter((x) => x.type === 'raidconvoy').slice(0, 2)) { const c = world.convoys.find((x) => x.id === o.convoy); const at = positionAt(c, world.tick).at; if (rank(lv.get(at) || 'unknown') >= rank('familiar')) out.push({ rank: 1, label: `Raid a ${cap(c.clan)} convoy near ${G.board.town(at).name}`, sub: `1 action. It carries ${[c.cargo.build ? `${c.cargo.build} Build` : '', c.cargo.coin ? `${c.cargo.coin} Coin` : ''].filter(Boolean).join(' and ')}.`, data: `data-g="raidconvoy" data-convoy="${esc(c.id)}"` }); }
    const mine1 = convoysOf(world, ME)[0];
    if (mine1) { const gt = mine1.route.find((x) => world.towns[x].owner === ME); if (gt) out.push({ rank: 2, label: `Guard ${G.board.town(gt).name}`, sub: `1 action. Your convoy passes through; a guard makes it harder to take for a day.`, data: `data-g="guard" data-town="${esc(gt)}"` }); }
    const me = world.clans[ME];
    if (!(world.dwarfFriends && world.dwarfFriends[ME])) {
      const rockSeen = Object.keys(world.towns).find((t) => untouchable(world, G.board, t) && G.board.neighbours(t).some((n) => world.towns[n] && world.towns[n].owner === ME) && rank(lv.get(t) || 'unknown') >= rank('familiar'));
      if (rockSeen) out.push({ rank: 2, label: `Seek the dwarves at ${G.board.town(rockSeen).name}`, sub: '1 action. If they take to you, miners come to your border each tick.', data: `data-g="seek" data-town="${esc(rockSeen)}"` });
    }
    if (ecoActive(me)) {
      if (me.hireDay !== Math.floor((world.startHour + world.tick) / 24) && me.res.coin >= K8.hireCost) {
        const spot = Object.keys(world.towns).filter((t) => world.towns[t].owner === ME && G.board.neighbours(t).some((n) => world.towns[n] && world.towns[n].owner && world.towns[n].owner !== ME)).sort((a, b) => world.towns[a].force - world.towns[b].force)[0];
        if (spot) out.push({ rank: 2, label: `Hire a band at ${G.board.town(spot).name}`, sub: `${K8.hireCost} Coin for ${K8.hireUnits} units, once a day. You have ${me.res.coin} Coin.`, data: `data-g="hire" data-town="${esc(spot)}"` });
      }
      if (me.res.food === 0) out.push({ rank: 0, label: 'You are out of Food', sub: 'Marches and recruits wait for Food. Units drift home if it lasts a day. Fewer units, or more farming townships.', data: 'data-g="close"' });
    }
    if (hidden) out.push({ rank: 9, label: 'Learn the map', sub: `${hidden} neighbouring township${hidden === 1 ? ' is' : 's are'} hidden in fog. Learn them in the quiz and they will show.`, data: 'data-g="close"' });
    return out;
  }
  function messengerBlock() {
    const mood = messengerMood(w(), G.board, ME, wordOf(w(), ME));
    const lines = G.content.json.messenger.filter((l) => l.mood === mood);
    const line = lines.length ? lines[w().tick % lines.length].text : '';
    return `<div class="messenger">${messengerFace(mood)}<span>${esc(line)}</span></div>`;
  }
  function doPanel() {
    const list = suggestions(), nx = nextMajor();
    const kit = kitById(G.board, kitOf(G.board, w().clans[ME].home)), se = seasonOf(w());
    panel(`<div class="gob">${messengerBlock()}<h3>What can I do?</h3>
      ${kit || se ? `<p class="fine">${kit ? esc(kit.ruleText) : ''} ${se ? esc(SEASONS[se].name + ': ' + SEASONS[se].text) : ''}</p>` : ''}
      ${w().clans.dwarves ? '<p class="fine">The dwarves hold the rock towns. They cannot be conquered, they never strike first, and anyone who pushes at the rock is answered. That is a rule of this world, not a favour to anyone.</p>' : ''}
      <p class="fine">There is no end-turn button. You have <b>${ap()}</b> action${ap() === 1 ? '' : 's'} (attacks, fronts, scouting, digging in and taunts cost one; moving is free). The world moves by itself on the hour: at 09:00, 12:00 and 18:00 you get ${K6.apPerMajor} more (up to ${K6.apCap}), everyone gets recruits and the other clans act${nx ? `. Next: ${nx.hour}, in ${nx.left}` : ''}.</p>
      ${list.length ? list.map((o) => `<button ${o.data}><b>${esc(o.label)}</b><br><span class="fine">${esc(o.sub)}</span></button>`).join('') : '<p>Nothing worth doing right now. Your townships next to enemies are too thin to attack. Wait for recruits.</p>'}
      ${prisoners()}
      <button data-g="gentle">Gentle mode: ${w().clans[ME].gentle ? 'on' : 'off'} <span class="fine">on means no unwarned convoy losses</span></button>
      <button data-g="chargetoggle">Quiz charges: ${prefs().charges ? 'on' : 'off'} <span class="fine">tap to switch</span></button>
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
    if (sel && sel !== id && G.board.neighbours(sel).includes(id) && !untouchable(w(), G.board, id)) { if (T.owner === ME || T.owner) return orderPanel(sel, id); return ctx.toast('Nobody holds that'); }
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
      markPlayed(to);
      sel = null; paint(); hud();
      if (checkOver()) return;
      if (type === 'front_open') { const o = ev.find((e) => e.type === 'front_opened'); return o ? frontPanel(o.front, ev.filter((e) => e.type === 'front_opened')) : afterFrontOrder(ev, null); }
      resultPanel(ev);
    }
    else if (a === 'first') {
      const ev = run([{ type: 'present', clan: ME }, { type: 'attack', clan: ME, from: b.dataset.from, to: b.dataset.to, n: +b.dataset.n }], 0);
      markPlayed(b.dataset.to);
      sel = null; paint(); hud(); resultPanel(ev);
    }
    else if (a === 'front') frontPanel(b.dataset.id);
    else if (a === 'scout') scoutPanel(b.dataset.town);
    else if (a === 'seek') {
      const ev = run([{ type: 'present', clan: ME }, { type: 'seek', clan: ME, town: b.dataset.town }], 0);
      markPlayed(b.dataset.town); paint(); hud(); sittingResult(ev);
    }
    else if (a === 'raidconvoy' || a === 'guard' || a === 'gentle') {
      const o = a === 'raidconvoy' ? { type: a, clan: ME, convoy: b.dataset.convoy } : a === 'guard' ? { type: a, clan: ME, town: b.dataset.town } : { type: 'setting', clan: ME, key: 'gentle', value: !w().clans[ME].gentle };
      const ev = run([{ type: 'present', clan: ME }, o], 0);
      paint(); hud();
      if (a === 'gentle') return doPanel();
      sittingResult(ev);
    }
    else if (a === 'talk') talkPanel(b.dataset.town);
    else if (a === 'foothold') footholdPanel(b.dataset.town);
    else if (a === 'footdo' || a === 'insult' || a === 'parley' || a === 'duel' || a === 'ransom' || a === 'release') {
      const o = a === 'footdo' ? { type: 'foothold', clan: ME, town: b.dataset.town, method: b.dataset.m } : (a === 'ransom' || a === 'release') ? { type: a, clan: ME, char: b.dataset.char } : { type: a, clan: ME, town: b.dataset.town };
      const ev = run([{ type: 'present', clan: ME }, o], 0);
      if (b.dataset.town) markPlayed(b.dataset.town);
      paint(); hud(); if (checkOver()) return; sittingResult(ev);
    }
    else if (a === 'scoutdo' || a === 'taunt' || a === 'fortify') {
      const o = a === 'scoutdo' ? { type: 'scout', clan: ME, town: b.dataset.town, method: b.dataset.m } : { type: a, clan: ME, town: b.dataset.town };
      const ev = run([{ type: 'present', clan: ME }, o], 0);
      markPlayed(b.dataset.town);
      paint(); hud(); if (checkOver()) return; sittingResult(ev);
    }
    else if (a === 'bridge' || a === 'hire') {
      const o = a === 'bridge' ? { type: 'bridge', clan: ME, from: b.dataset.from, to: b.dataset.to } : { type: 'hire', clan: ME, town: b.dataset.town };
      const ev = run([{ type: 'present', clan: ME }, o], 0);
      paint(); hud(); sittingResult(ev);
    }
    else if (a === 'chargeq') chargeQuestion(b.dataset.front);
    else if (a === 'chargea') chargeAnswer(b.dataset.front, b.dataset.ans, b.dataset.right);
    else if (a === 'chargetoggle') { const p = prefs(); store.set('goblin.prefs', { ...p, charges: !p.charges }); doPanel(); }
    else if (a === 'fact') {
      const fr0 = w().fronts[b.dataset.front] || {};
      const maneuver = ['probe', 'pressure', 'lever'].includes(b.dataset.a);
      const useCharge = maneuver && charge && charge.front === b.dataset.front && charge.beat === fr0.beat;
      if (maneuver) charge = null;
      const ev = run([{ type: 'present', clan: ME }, { type: 'front', clan: ME, front: b.dataset.front, action: b.dataset.a, ...(b.dataset.a === 'decision' ? { n: fr0.units } : {}), ...(useCharge ? { charge: true } : {}) }], 0);
      afterFrontOrder(ev, b.dataset.front);
    }
    else if (a === 'go') { sel = b.dataset.from; paint(); orderPanel(b.dataset.from, b.dataset.to); }
    else if (a === 'ledger') ledgerPanel();
    else if (a === 'copy') { navigator.clipboard && navigator.clipboard.writeText(renderLedger(save.events, ctxFor())).then(() => ctx.toast('Copied'), () => ctx.toast('Could not copy')); }
    else if (a === 'cancelstart') { if (save) { mode = 'play'; panel(''); hud(); } else ctx.setMode(store.get('mode', 'practice') === 'goblin' ? 'practice' : store.get('mode', 'practice')); }
    else if (a === 'nextchapter') beginChapter(nextChapterCfg(G.board, w(), { guidedStart: true }));
    else if (a === 'retry') {
      const prev = w(), seed = `${prev.seed}r`;
      const base = nextChapterCfg(G.board, prev);
      beginChapter({ seed, home: prev.clans[ME].home, clans: [CLANS[0], ...rivalsFor(seed)], carry: base.carry, campaign: { chapter: prev.campaign ? prev.campaign.chapter : 1, kits: prev.campaign ? prev.campaign.kits : [] } });
    }
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
