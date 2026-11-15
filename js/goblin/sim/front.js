// Fronts (docs/goblins/04-systems-spec.md section 6): the slow fight for a township that has an active captain.
//
//   openFront(w, board, emit, order)                 -> true | reason string
//   actFront(w, board, rng, emit, order)             -> true | reason string
//   settleFronts(w, board, emit)                     closes any front that can no longer go on (Withdrew)
//   legalOrders(board, w, clanId)                    -> every order the clan may give now; dominated options are never listed
//   pinnedTowns(w)                                   -> Set of townships whose captain is pinned by an open front
//
// Units a front commits leave their township when it opens and are held in front.units until it closes. Nothing here uses Math.random or Date.

import { K, K2, K4 } from './constants.js';
import { skirmish } from './skirmish.js';
import { takeTaunt, hasAp, scoutMods } from './sitting.js';
import { frontConfidence, maybeLegend, FOOTHOLD_METHODS, footholdMods, roomFor, ransomPrice } from './encounters.js';
import { K9 } from './constants.js';
import { active, hasBridge, maxMarch, canMarch, marchCost, bridgeCostFor } from './economy.js';
import { ignoresRiver } from './kinds.js';
import { untouchable } from './dwarves.js';
import { K11 } from './constants.js';
import { convoysOf, positionAt } from './convoys.js';
import { K8 } from './constants.js';
import { discoverOne, discover, knows, undiscovered, suitBonus, counterMod, hasConflict, injuryRoll, applyInjury, kill, capture, place, promote } from './chars.js';

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const R = (w) => w.rules || {};
export const MANEUVERS = ['probe', 'pressure', 'lever'];
const STANDING = ['Behind', 'Even', 'Ahead', 'Commanding'];

export const openFronts = (w, clanId = null) => Object.values(w.fronts).filter((f) => f.status === 'open' && (!clanId || f.attacker === clanId));
export const pinnedTowns = (w) => new Set(openFronts(w).map((f) => f.target));

const activeLead = (w, f) => { const c = f.lead && w.chars[f.lead]; return c && c.status === 'active' && c.at === f.from ? c : null; };
const defenderOf = (w, f) => { const c = w.chars[f.captain]; return c && c.status === 'active' && c.at === f.target ? c : null; };
const hasWeakness = (w, f) => { const d = w.chars[f.captain]; return !!d && (d.known[f.attacker] || []).length > 0; };

/** Which actions the front allows right now (the single source for legalOrders and for validation). */
export function frontActions(w, f) {
  const out = [];
  if (f.status !== 'open') return out;
  const mayManeuver = f.maneuvers < K4.frontMaxManeuvers;
  const canAct = !!activeLead(w, f) || f.units >= K4.maneuverNeedUnits;
  if (mayManeuver && canAct) out.push('probe', 'pressure');
  if (mayManeuver && hasWeakness(w, f)) out.push('lever');
  if (mayManeuver && f.behindByRiver && !f.bridgeUsed && f.standing === 0) out.push('bridge');
  if (f.maneuvers >= K4.frontMinManeuvers) out.push('decision');
  out.push('disengage');
  return out;
}

// ---------------------------------------------------------------- opening

export function openFront(w, board, emit, o) {
  const F = w.towns[o.from], T = w.towns[o.to];
  if (!board.content) return 'fronts need characters';
  if (!F || !T || F.owner !== o.clan || !T.owner || T.owner === o.clan) return 'bad origin or target';
  const d = T.captain && w.chars[T.captain];
  if (!d || d.status !== 'active') return 'no captain defends that township: attack it directly';
  if (openFronts(w, o.clan).length >= K4.frontMaxPerPlayer) return `at most ${K4.frontMaxPerPlayer} fronts at once`;
  if (openFronts(w).some((f) => f.target === o.to)) return 'a front is already open there';
  if (!Number.isInteger(o.n) || o.n < 1 || o.n > F.force - 1) return 'n must be from 1 to the force minus 1';
  const b = board.border(o.from, o.to) || {};
  const behindByRiver = !!(b.river || b.ridge) && !(b.highways && b.highways.length) && !hasBridge(w, o.clan, o.from, o.to) && !ignoresRiver(w.clans[o.clan].kind);
  const lead = F.captain && w.chars[F.captain] && w.chars[F.captain].status === 'active' ? F.captain : null;
  const taunted = takeTaunt(w, o.clan, o.to);
  F.force -= o.n; F.attackedTick = w.tick; F.dugIn = false;
  const f = { id: 'f' + w.nextId++, attacker: o.clan, defender: T.owner, from: o.from, target: o.to, captain: d.id, lead, units: o.n,
    standing: Math.min(2, (behindByRiver ? 0 : K4.frontStartStanding) + (taunted ? 1 : 0) + (d.state === 'humiliated' ? 1 : 0) + ((d.bonds || []).includes(o.clan) ? 1 : 0)), behindByRiver, bridgeUsed: false, beat: 0, maneuvers: 0,
    learned: [], lostA: 0, lostD: 0, changed: [], log: [], status: 'open', openedTick: w.tick };
  w.fronts[f.id] = f;
  emit('front_opened', { front: f.id, taunted, humiliated: d.state === 'humiliated', mercy: (d.bonds || []).includes(o.clan), clan: o.clan, from: o.from, to: o.to, n: o.n, standing: STANDING[f.standing], captain: d.id, lead });
  return true;
}

// ---------------------------------------------------------------- one beat

/** Band of a maneuver roll as the change in standing; null delta marks "discover" (5 to 7 on Probe and Pressure). */
export function bandOf(maneuver, roll) {
  if (maneuver === 'lever') return roll >= 8 ? 2 : roll >= 5 ? 0 : -1;
  return roll >= 11 ? 2 : roll >= 8 ? 1 : roll >= 5 ? 0 : -1;
}

function rollMods(w, board, f, maneuver, skipTrait = null) {
  const content = board.content, d = w.chars[f.captain], lead = activeLead(w, f);
  const parts = [];
  if (lead) { const s = suitBonus(content, lead, maneuver); if (s) parts.push({ why: 'captain suits it', v: s }); }
  if (maneuver === 'lever') parts.push({ why: 'known weakness', v: K4.leverBonus });
  for (const t of d.traits) {
    if (t.id === skipTrait) continue;
    const v = content.traits.get(t.id).counters[maneuver] || 0;
    if (v) parts.push({ why: 'trait:' + t.id, v, trait: t.id });
  }
  return { parts, total: clamp(parts.reduce((s, p) => s + p.v, 0), -K4.modClamp, K4.modClamp) };
}

export function actFront(w, board, rng, emit, o) {
  const f = w.fronts[o.front];
  if (!f || f.status !== 'open' || f.attacker !== o.clan) return 'no such open front';
  if (!frontActions(w, f).includes(o.action)) return `${o.action} is not available now`;
  const content = board.content;
  const act = o.action;
  if (act === 'disengage') { f.beat++; emit('front_beat', { front: f.id, clan: f.attacker, captain: f.captain, to: f.target, maneuver: 'disengage', standing: STANDING[f.standing] }); close(w, board, rng, emit, f, 'Withdrew'); return true; }
  if (act === 'bridge') {
    f.beat++; f.maneuvers++; f.bridgeUsed = true; f.standing = 1;
    emit('front_beat', { front: f.id, clan: f.attacker, captain: f.captain, to: f.target, maneuver: 'bridge', standing: STANDING[f.standing] });
    return true;
  }
  if (act === 'decision') { f.beat++; return decide(w, board, rng, emit, f, o.n); }
  // probe, pressure, lever
  const d = w.chars[f.captain];
  const dice = [rng.d6(), rng.d6()];
  const m = rollMods(w, board, f, act);
  const charged = !!o.charge;   // an optional quiz answer (D179): +1 to this roll, never required
  const roll = dice[0] + dice[1] + m.total + (charged ? 1 : 0);
  const delta = Math.min(bandOf(act, roll), R(w).frontMaxGain ?? K4.frontMaxGain);   // D210: capped at one step by default
  const learned = [];
  // a hidden trait that changed the band becomes known: the player learns why
  for (const p of m.parts) {
    if (!p.trait || knows(d, f.attacker, 'trait:' + p.trait)) continue;
    const without = rollMods(w, board, f, act, p.trait).total;
    if (bandOf(act, dice[0] + dice[1] + without + (charged ? 1 : 0)) !== delta) { discover(d, f.attacker, 'trait:' + p.trait); learned.push('trait:' + p.trait); }
  }
  if (act !== 'lever' && delta === 0) { const x = discoverOne(d, f.attacker); if (x) learned.push(x); }
  f.learned.push(...learned);
  f.beat++; f.maneuvers++;
  f.standing = clamp(f.standing + delta, 0, 3);
  emit('front_beat', { front: f.id, clan: f.attacker, captain: f.captain, to: f.target, maneuver: act, dice, charged, mods: [...m.parts.map((p) => ({ why: p.why.startsWith('trait:') ? 'hidden' : p.why, v: p.v })), ...(charged ? [{ why: 'quiz charge', v: 1 }] : [])], total: m.total, roll, change: delta, standing: STANDING[f.standing], learned });
  if (f.standing === 3) close(w, board, rng, emit, f, 'Yielded');
  return true;
}

function decide(w, board, rng, emit, f, n) {
  const T = w.towns[f.target];
  const lead = activeLead(w, f);
  const units = f.units;
  const defendersBefore = T.force;
  const mods = { atkExtraDice: lead ? 1 : 0, atkBestPenalty: 0,
    defBestBonus: f.standing <= 1 ? 1 : 0, defExtraDice: f.standing === 0 ? 1 : 0 };
  const r = skirmish({ attackers: units, defenders: T.force, ...mods }, rng);
  emit('front_beat', { front: f.id, clan: f.attacker, captain: f.captain, to: f.target, maneuver: 'decision', standing: STANDING[f.standing], won: r.won, rounds: r.rounds, lead: lead ? lead.id : null });
  f.lostA = units - r.attackersLeft; f.lostD = defendersBefore - r.defendersLeft;
  if (r.won) { f.survivors = r.attackersLeft; f.defendersBefore = defendersBefore; close(w, board, rng, emit, f, 'Won'); }
  else { T.force = r.defendersLeft; f.survivors = r.attackersLeft; close(w, board, rng, emit, f, 'Lost'); }
  return true;
}

// ---------------------------------------------------------------- closing

function returnUnits(w, f, n) {
  if (n < 1) return;
  const F = w.towns[f.from];
  let to = F && F.owner === f.attacker ? f.from : null;
  if (!to) { const h = w.clans[f.attacker].home; if (w.towns[h] && w.towns[h].owner === f.attacker) to = h; }
  if (!to) to = Object.keys(w.towns).filter((t) => w.towns[t].owner === f.attacker).sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b))[0];
  if (to) w.towns[to].force = Math.min(R(w).townForceCap ?? Infinity, w.towns[to].force + n);
}

function refugeFor(w, board, f, d) {
  const c = board.neighbours(f.target).filter((t) => w.towns[t] && w.towns[t].owner === d.clan && !w.towns[t].captain);
  return c.sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b))[0] || null;
}

/** The closeup (D130, D201): what happens to a defending captain whose township has fallen. Returns what changed. */
function closeup(w, board, rng, emit, f, d, byYield) {
  const content = board.content, T = w.towns[f.target], refuge = refugeFor(w, board, f, d);
  const flee = () => { d.at = refuge; w.towns[refuge].captain = d.id; if (byYield && T._retreat) { w.towns[refuge].force += T._retreat; } return 'fled'; };
  let what, roll = null;
  if (hasConflict(content, d)) {
    roll = rng.d6() + rng.d6();
    if (roll <= K4.closeupBreakMax) {
      if (!d.fears.some((x) => x.ref === f.target)) d.fears.push({ kind: 'town', ref: f.target });
      if (content.states.has('shaken')) d.state = 'shaken';
      what = refuge ? flee() : (capture(w, d, f.attacker), 'captured');
    } else if (roll <= K4.closeupHoldMax) { capture(w, d, f.attacker); what = 'captured'; }
    else {
      what = refuge ? flee() : (capture(w, d, f.attacker), 'captured');
      const held = new Set(d.traits.map((t) => t.id));
      const pool = content.notable.filter((t) => !held.has(t.id)), minors = d.traits.filter((t) => !t.notable);
      if (what === 'fled' && pool.length && minors.length) {
        const gone = minors[rng.int(minors.length)], gain = pool[rng.int(pool.length)];
        d.traits = d.traits.filter((t) => t !== gone); d.traits.push({ id: gain.id, notable: true });
        what = 'persisted';
      }
    }
  } else what = refuge ? flee() : (capture(w, d, f.attacker), 'captured');
  emit('closeup', { front: f.id, char: d.id, clan: d.clan, roll, what, town: f.target, ...(refuge && what !== 'captured' ? { to: refuge } : {}) });
  return what;
}

function close(w, board, rng, emit, f, verdict) {
  const T = w.towns[f.target], d = w.chars[f.captain];
  const content = board.content;
  const changed = [];
  if (verdict === 'Withdrew') returnUnits(w, f, f.units);
  else if (verdict === 'Lost') {
    returnUnits(w, f, f.survivors);
    const lead = activeLead(w, f);
    if (lead) {
      const res = injuryRoll(rng, 'own');
      if (res !== 'none') { const inj = applyInjury(rng, content, lead); changed.push({ char: lead.id, what: res === 'dead' ? 'died' : 'injured', injury: inj }); if (res === 'dead') kill(w, lead); }
    }
    if (!f.learned.length && d) { const x = discoverOne(d, f.attacker); if (x) f.learned.push(x); }   // a lost front always teaches something (D101a)
  } else {   // Won or Yielded: the attacker takes the township
    const yielded = verdict === 'Yielded';
    const lead = activeLead(w, f);
    let died = false;
    if (!yielded && d) {
      const res = injuryRoll(rng, 'enemy');
      if (res !== 'none') { const inj = applyInjury(rng, content, d); changed.push({ char: d.id, what: res === 'dead' ? 'died' : 'injured', injury: inj }); if (res === 'dead') { kill(w, d); died = true; } }
    }
    const garrison = yielded ? f.units : f.survivors;
    const defenders = yielded ? T.force : 0;
    const wasOutnumbered = f.units < (f.defendersBefore ?? T.force);
    T.owner = f.attacker; T.force = garrison; T.dugIn = false; T.attackedTick = -1; T.freshUntil = w.tick + K8.unrestTicks;
    T.captain = null;
    if (w.clans[f.attacker].lord === 'ai') w.clans[f.attacker].coolUntil = w.tick + (R(w).aiCaptureCooldownTicks ?? 0);
    if (d && !died) {
      if (yielded) T._retreat = defenders;
      const what = closeup(w, board, rng, emit, f, d, yielded);
      delete T._retreat;
      changed.push({ char: d.id, what });
    }
    if (lead) { w.towns[f.from].captain = null; lead.at = f.target; T.captain = lead.id; }
    else if (!yielded) {
      const tag = wasOutnumbered ? 'outnumbered' : (f.survivors <= 3 && f.units >= 6 ? 'bloody' : null);
      const c = tag && promote(w, rng, content, f.target, tag);
      if (c) changed.push({ char: c.id, what: 'promoted', tag });
    }
  }
  if (verdict === 'Won' || verdict === 'Yielded' || verdict === 'Lost') {
    const wonIt = verdict !== 'Lost', ld = f.lead && w.chars[f.lead];
    frontConfidence(content, ld && ld.status === 'active' ? ld : null, d && d.status !== 'dead' ? d : null, wonIt);
    if (wonIt && ld && ld.status === 'active') maybeLegend(w, content, rng, ld, emit);
  }
  f.status = 'closed'; f.verdict = verdict;
  const exposed = Object.keys(w.towns).filter((t) => w.towns[t].owner === f.attacker && w.towns[t].force <= 1).sort(byId);
  emit('front_closed', { front: f.id, clan: f.attacker, verdict, town: f.target, from: f.from, beats: f.beat,
    lost: { a: verdict === 'Withdrew' || verdict === 'Yielded' ? 0 : f.lostA, d: verdict === 'Yielded' || verdict === 'Withdrew' ? 0 : f.lostD },
    learned: f.learned.slice(), changed, exposed });
  delete w.fronts[f.id];   // the tally is the record; open fronts are all that state keeps
}

/** A front cannot go on if its attacker is gone or absent, the origin or target changed hands, or the captain is no longer there. */
export function settleFronts(w, board, rng, emit) {
  for (const f of openFronts(w).sort((a, b) => byId(a.id, b.id))) {
    const A = w.clans[f.attacker], T = w.towns[f.target];
    const dead = !A || A.out || A.absentSince !== null || !T || T.owner !== f.defender || !defenderOf(w, f);
    if (dead) close(w, board, rng, emit, f, 'Withdrew');
  }
}

// ---------------------------------------------------------------- what a player may do

export function legalOrders(board, w, clanId) {
  const out = [];
  const clan = w.clans[clanId];
  if (!clan || clan.out || (w.war && w.war.over)) return out;
  const mine = openFronts(w, clanId);
  for (const f of mine.sort((a, b) => byId(a.id, b.id))) {
    for (const action of frontActions(w, f)) out.push({ type: 'front', clan: clanId, front: f.id, action, ...(action === 'decision' ? { n: f.units } : {}) });
  }
  const targeted = new Set(openFronts(w).map((f) => f.target));
  const canHit = hasAp(clan, 1);   // attacks and fronts cost an action
  const scouted = new Set();
  for (const from of Object.keys(w.towns).sort(byId)) {
    const F = w.towns[from];
    if (F.owner !== clanId) continue;
    if (board.content && !F.dugIn && F.force >= K.digInMinForce && (active(clan) ? clan.res.build >= K8.fortifyCost : canHit)) out.push({ type: 'fortify', clan: clanId, town: from });
    if (active(clan) && clan.hireDay !== Math.floor((w.startHour + w.tick) / 24) && clan.res.coin >= K8.hireCost && board.neighbours(from).some((n) => w.towns[n] && w.towns[n].owner && w.towns[n].owner !== clanId)) out.push({ type: 'hire', clan: clanId, town: from });
    if (active(clan) && clan.res.build >= bridgeCostFor(w, board, clanId, from)) for (const to of board.neighbours(from)) { const bd = board.border(from, to); if (bd && bd.river && w.towns[to] && !hasBridge(w, clanId, from, to) && !(w.bridging || []).some((x) => x.clan === clanId && ((x.a === from && x.b === to) || (x.a === to && x.b === from)))) out.push({ type: 'bridge', clan: clanId, from, to }); }
    if (F.force < 2) continue;
    const range = { min: 1, max: maxMarch(clan, F.force) };
    if (range.max < 1) continue;
    for (const to of board.neighbours(from)) {
      const T = w.towns[to];
      if (!T) continue;
      if (T.owner === clanId) { out.push({ type: 'move', clan: clanId, from, to, n: range }); continue; }
      if (!T.owner) continue;
      if (untouchable(w, board, to)) { if (canHit && !(w.dwarfFriends && w.dwarfFriends[clanId]) && !(clan.seekAt !== undefined && clan.seekAt !== null && w.tick - clan.seekAt < K11.seekCooldown) && !out.some((o) => o.type === 'seek' && o.town === to)) out.push({ type: 'seek', clan: clanId, town: to }); continue; }
      if (!canHit) continue;
      if (T.captain) { if (mine.length < K4.frontMaxPerPlayer && !targeted.has(to)) out.push({ type: 'front_open', clan: clanId, from, to, n: range }); }
      else out.push({ type: 'attack', clan: clanId, from, to, n: range });
    }
  }
  if (active(clan)) for (const c of Object.values(w.chars).filter((x) => x.status === 'captured' && x.heldBy === clanId).sort((a, b) => byId(a.id, b.id))) {
    if (!roomFor(w, c) || !w.clans[c.clan] || w.clans[c.clan].out) continue;
    out.push({ type: 'release', clan: clanId, char: c.id });
    const theirs = w.clans[c.clan];
    if (!active(theirs) || theirs.res.coin >= ransomPrice(c)) out.push({ type: 'ransom', clan: clanId, char: c.id });
  }
  if (canHit) {
    for (const t of Object.keys(w.towns).sort(byId)) if (w.towns[t].owner === clanId && convoysOf(w, clanId).some((c) => c.route.includes(t))) out.push({ type: 'guard', clan: clanId, town: t });
    for (const c of (w.convoys || []).filter((x) => x.clan !== clanId).sort((a, b) => byId(a.id, b.id))) {
      const spot = positionAt(c, w.tick).at;
      if (board.neighbours(spot).some((n) => w.towns[n] && w.towns[n].owner === clanId && w.towns[n].force >= 3) || (w.towns[spot] && w.towns[spot].owner === clanId && w.towns[spot].force >= 3)) out.push({ type: 'raidconvoy', clan: clanId, convoy: c.id });
    }
  }
  if (board.content && canHit) {
    for (const town of Object.keys(w.towns).sort(byId)) {
      const T0 = w.towns[town];
      if (T0 && T0.owner && T0.owner !== clanId && !T0.captain && !untouchable(w, board, town) && board.neighbours(town).some((n) => w.towns[n] && w.towns[n].owner === clanId) && !(w.footholds && w.footholds[town])) {
        for (const m of FOOTHOLD_METHODS) { const fm = footholdMods(w, board, clanId, town, m); if (m === 'swarm' || fm.mods.some((x) => x.v > 0)) out.push({ type: 'foothold', clan: clanId, town, method: m }); }
      }
      const T = w.towns[town], c = T.captain && w.chars[T.captain];
      if (!c || c.status !== 'active' || T.owner === clanId || scouted.has(town)) continue;
      if (!board.neighbours(town).some((n) => w.towns[n] && w.towns[n].owner === clanId)) continue;
      scouted.add(town);
      const methods = ['sneak', 'ask'];
      if (scoutMods(w, board, clanId, town, 'watch').total > 0) methods.push('watch');
      for (const method of methods) out.push({ type: 'scout', clan: clanId, town, method });
      if ((c.known[clanId] || []).length) { out.push({ type: 'taunt', clan: clanId, town }); out.push({ type: 'insult', clan: clanId, town }); if (active(clan) && clan.res.coin >= K9.parleyCost) out.push({ type: 'parley', clan: clanId, town }); }
      if (board.neighbours(town).some((n) => w.towns[n] && w.towns[n].owner === clanId && w.towns[n].captain && w.chars[w.towns[n].captain].status === 'active')) out.push({ type: 'duel', clan: clanId, town });
    }
  }
  return out;
}
