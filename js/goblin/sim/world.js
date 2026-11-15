// The world and its turn (docs/goblins/04-systems-spec.md sections 2, 4, 5 and 8).
//
//   newWorld(board, cfg)                      -> World
//   step(board, world, orders, ticks, opts)   -> { state, events }      pure: the input is never changed
//   checkInvariants(board, world)             -> [problems]
//
// World is plain JSON. The ledger is not part of it: step returns the events it produced and the caller keeps them (state stays small).
// S3 covers the territory game: recruits, dig-in, AI attacks, declared raids and human attack and move orders. Characters, fronts and the
// Director are added in S4 to S6; their hooks are marked.

import { K, K2, K4, K5, K6 } from './constants.js';
import { makeRng, seedState } from './rng.js';
import { skirmish, modsFor } from './skirmish.js';
import * as Dir from './director.js';
import { initWar, warTurn } from './war.js';
import { applySitting, hasAp, spend as spendAp, refill as refillAp } from './sitting.js';
import { openFront, actFront, settleFronts, pinnedTowns, openFronts } from './front.js';
import { placeInitialCaptains, captainsOf, capture, place, promote, succeed } from './chars.js';

/** The world-level tunables, kept in each world (w.rules) so a saved or simulated war records the rules it ran under, and tuning can vary them per run. */
export const DEFAULT_RULES = Object.freeze({ townForceCap: K2.townForceCap, recruitFullTowns: K2.recruitFullTowns, recruitDivisorBeyond: K2.recruitDivisorBeyond,
  aiAttackRatio: K.aiAttackRatio, aiCommitFraction: K2.aiCommitFraction,
  aiCaptureCooldownTicks: 72,  // conquest tempo (D209): after taking a township an AI clan waits this many ticks before attacking again (0 = off)
  leaderShare: 0.5,            // (D209) a clan holding more than this share of the theatre needs leaderAttackRatio to attack (1.01 = never)
  leaderAttackRatio: 3.0,
  aiRecruitSpread: 0,          // 1: an AI reinforces its weakest border township like a human instead of massing at its best attack position (experiment, H52)
  frontMaxGain: K4.frontMaxGain });   // the most a single front maneuver may raise standing (D210: 1)
const R = (w) => w.rules || DEFAULT_RULES;

export const hourOf = (w) => (w.startHour + w.tick) % 24;
export const isMajor = (w) => K.majorTickHours.includes(hourOf(w));
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------- creation

function farthestFrom(board, theatre, homes) {
  const inT = new Set(theatre);
  const maps = homes.map((h) => board.distances(h, inT));
  let best = null, bestD = -1;
  for (const t of [...theatre].sort(byId)) {
    if (homes.includes(t)) continue;
    const d = Math.min(...maps.map((m) => (m.has(t) ? m.get(t) : 99)));
    if (d > bestD) { bestD = d; best = t; }
  }
  return best;
}

/** cfg: { seed, home, clans: [{ id, kind, lord: 'human'|'ai', home? }], steps?, startHour? }. The first clan starts at cfg.home; others are placed apart. */
export function newWorld(board, cfg) {
  const theatre = board.theatre(cfg.home, cfg.steps ?? K.theatreSteps, { min: K.theatreMin, max: K.theatreMax });
  const inT = new Set(theatre);
  const homes = [];
  cfg.clans.forEach((c, i) => homes.push(c.home || (i === 0 ? cfg.home : farthestFrom(board, theatre, homes))));
  // ownership: clans claim townships in turn, each taking the unowned neighbour of its land nearest its home, so shares come out even
  // (nearest-home ownership gave the central clan most of the board)
  const owner = new Map();
  const mine = homes.map((h) => [h]);
  const dists = homes.map((h) => board.distances(h, inT));
  homes.forEach((h, i) => owner.set(h, i));
  for (let moved = true; owner.size < theatre.length && moved;) {
    moved = false;
    for (let i = 0; i < homes.length; i++) {
      const cand = new Set();
      for (const t of mine[i]) for (const n of board.neighbours(t)) if (inT.has(n) && !owner.has(n)) cand.add(n);
      if (!cand.size) continue;
      const pick = [...cand].sort((x, y) => (dists[i].get(x) - dists[i].get(y)) || byId(x, y))[0];
      owner.set(pick, i); mine[i].push(pick); moved = true;
    }
  }
  // starting forces by population rank within the theatre
  const ranked = [...theatre].sort((a, b) => (board.town(b).pop - board.town(a).pop) || byId(a, b));
  const third = Math.ceil(ranked.length / 3);
  const towns = {};
  ranked.forEach((t, r) => {
    const base = r < third ? K2.bigThird : r < 2 * third ? K2.midThird : K2.smallThird;
    towns[t] = { owner: null, force: base, dugIn: false, captain: null, attackedTick: -1 };
  });
  for (const t of theatre) towns[t].owner = owner.has(t) ? cfg.clans[owner.get(t)].id : null;
  homes.forEach((h) => { towns[h].force += K2.homeBonus; });
  const clans = {};
  cfg.clans.forEach((c, i) => {
    clans[c.id] = { id: c.id, kind: c.kind, lord: c.lord, home: homes[i], shieldUntil: c.lord === 'human' ? K.newPlayerShieldTicks : 0,
                    lastActive: 0, absentSince: null, out: false, ...(c.lord === 'human' ? { ap: K6.apStart } : {}) };
  });
  for (const c of Object.values(clans)) c.peakTowns = theatre.filter((t) => towns[t].owner === c.id).length;
  const w = { v: 1, seed: cfg.seed ?? 1, rng: 0, tick: 0, startHour: cfg.startHour ?? K2.startHour, lastMajor: 0,
              theatre, towns, clans, chars: {}, heirs: [], fronts: {}, raids: [], director: {}, nextId: 1, rules: { ...DEFAULT_RULES, ...(cfg.rules || {}) } };
  const rng = makeRng(seedState(cfg.seed ?? 1));
  if (board.content) placeInitialCaptains(w, rng, board.content);
  initWar(w, board);
  w.rng = rng.state;
  return w;
}

// ---------------------------------------------------------------- helpers

const ownedBy = (w, clanId) => Object.keys(w.towns).filter((t) => w.towns[t].owner === clanId).sort(byId);
const isHuman = (w, id) => !!id && w.clans[id] && w.clans[id].lord === 'human';
const borderMods = (board, from, to, dugIn, captainLeads = false) => {
  const b = board.border(from, to) || {};
  return modsFor({ dugIn, captainLeads, riverBorder: !!(b.river || b.ridge), highway: !!(b.highways && b.highways.length) });
};

/** One skirmish: units from `from` (or already on the road, `inTransit`) attack `to`. Mutates w, emits events.
 *  A captain in the origin township leads the attack (an extra die) and travels with it; if the attack wins they take the township, if it loses they go home.
 *  A captain defending a township that falls is captured (D201). A win against odds (or a very costly one) names a grunt a captain. */
function fight(w, board, rng, emit, { by, from, to, n, inTransit = false, raid = null }) {
  const T = w.towns[to], F = w.towns[from];
  const content = board.content;
  let leadId = null;
  if (inTransit) leadId = raid && raid.lead ? raid.lead : null;
  else if (content && F.captain && w.chars[F.captain] && w.chars[F.captain].status === 'active') { leadId = F.captain; F.captain = null; w.chars[leadId].at = null; }
  if (!inTransit) { F.force -= n; F.attackedTick = w.tick; F.dugIn = false; }
  const against = T.owner;
  if (against === by) {
    T.force = Math.min(R(w).townForceCap, T.force + n);
    if (leadId && !place(w, w.chars[leadId], to)) w.chars[leadId].status = 'dead';
    emit('units_arrived', { clan: by, from, to, n }); return;
  }
  const defendersBefore = T.force;
  const bd = board.border(from, to) || {};
  const r = skirmish({ attackers: n, defenders: T.force, ...borderMods(board, from, to, T.dugIn, !!leadId) }, rng);
  const detail = isHuman(w, by) || isHuman(w, against);
  const extra = [];
  if (r.won) {
    const dc = T.captain && w.chars[T.captain];
    if (dc && dc.status === 'active') { capture(w, dc, by); extra.push(['captured', { clan: against, by, char: dc.id, town: to }]); }
    T.owner = by; T.force = r.attackersLeft; T.dugIn = false; T.captain = null; T.attackedTick = -1;
    if (w.clans[by].lord === 'ai') w.clans[by].coolUntil = w.tick + R(w).aiCaptureCooldownTicks;
    if (leadId) { w.chars[leadId].at = to; T.captain = leadId; }
    else if (content) {
      const tag = n < defendersBefore ? 'outnumbered' : (bd.river ? 'river' : (r.attackersLeft <= 3 && n >= 6 ? 'bloody' : null));
      const c = tag && promote(w, rng, content, to, tag);
      if (c) extra.push(['promoted', { clan: by, char: c.id, town: to, tag }]);
    }
  } else {
    T.force = r.defendersLeft;
    if (F.owner === by) F.force += r.attackersLeft;
    if (leadId && !place(w, w.chars[leadId], from)) w.chars[leadId].status = 'dead';
  }
  emit(raid ? 'raid_landed' : 'skirmish_result', { by, against, from, to, n, won: r.won, lost: r.lost, left: { a: r.attackersLeft, d: r.defendersLeft },
        ...(leadId ? { lead: leadId } : {}), ...(detail ? { rounds: r.rounds } : {}) });
  for (const [type, data] of extra) emit(type, data);
}

// ---------------------------------------------------------------- orders (a human's, applied before time passes)

function applyOrder(w, board, rng, emit, o) {
  const clan = w.clans[o.clan];
  const reject = (reason) => emit('order_rejected', { clan: o.clan, order: o, reason });
  if (!clan || clan.lord !== 'human' || clan.out) return reject('not a live human clan');
  if (o.type === 'present') { clan.lastActive = w.tick; clan.absentSince = null; return; }   // the player opened the game
  const F = w.towns[o.from], T = w.towns[o.to];
  if (!F || !T || F.owner !== o.clan) return reject('origin is not yours');
  if (!board.border(o.from, o.to)) return reject('not neighbours');
  if (!Number.isInteger(o.n) || o.n < 1 || o.n > F.force - 1) return reject('n must be from 1 to the force minus 1');
  clan.lastActive = w.tick; clan.absentSince = null;
  if (o.type === 'move') { if (T.owner !== o.clan) return reject('move needs your own township'); if (T.force + o.n > R(w).townForceCap) return reject('that township would be over the cap'); F.force -= o.n; T.force += o.n; return emit('units_moved', { clan: o.clan, from: o.from, to: o.to, n: o.n }); }
  if (o.type === 'attack') {
    if (T.owner === o.clan) return reject('that is your own township');
    if (T.captain) return reject('a captain defends it: open a front (front_open)');
    if (!hasAp(clan, K6.costAttack)) return reject('no actions left: they refill at 09:00, 12:00 and 18:00');
    spendAp(clan, K6.costAttack);
    return fight(w, board, rng, emit, { by: o.clan, from: o.from, to: o.to, n: o.n });
  }
  return reject('unknown order');
}

function applyFrontOrder(w, board, rng, emit, o) {
  const clan = w.clans[o.clan];
  const reject = (reason) => emit('order_rejected', { clan: o.clan, order: o, reason });
  if (!clan || clan.lord !== 'human' || clan.out) return reject('not a live human clan');
  clan.lastActive = w.tick; clan.absentSince = null;
  if (o.type === 'front_open' && !hasAp(clan, K6.costFront)) return reject('no actions left: they refill at 09:00, 12:00 and 18:00');
  const res = o.type === 'front_open' ? openFront(w, board, emit, o) : actFront(w, board, rng, emit, o);
  if (res !== true) reject(res);
  else if (o.type === 'front_open') spendAp(clan, K6.costFront);
}

// ---------------------------------------------------------------- the world's turn

function recruits(w, board, emit) {
  for (const clan of Object.values(w.clans)) {
    if (clan.out) continue;
    const mine = ownedBy(w, clan.id);
    if (!mine.length) continue;
    const n = Math.ceil(Math.min(mine.length, R(w).recruitFullTowns) / K.recruitsDivisor + Math.max(0, mine.length - R(w).recruitFullTowns) / R(w).recruitDivisorBeyond);
    const enemyNb = (t) => board.neighbours(t).filter((x) => w.towns[x] && w.towns[x].owner && w.towns[x].owner !== clan.id);
    const border = mine.filter((t) => enemyNb(t).length);
    let at;
    if (clan.lord === 'ai' && border.length && !R(w).aiRecruitSpread) {
      // an AI masses its recruits where it can attack: the border township with the best force against its weakest attackable neighbour
      const score = (t) => { const tg = enemyNb(t).filter((x) => !shielded(w, w.towns[x].owner) && !protectedHome(w, x)).map((x) => w.towns[x].force); return tg.length ? w.towns[t].force / Math.max(1, Math.min(...tg)) : -1; };
      at = border.slice().sort((a, b) => (score(b) - score(a)) || byId(a, b))[0];
    } else {
      // a human's clan (and an absent one) reinforces its weakest border township, or its weakest township if it has no border (D203)
      const pool = border.length ? border : mine;
      at = pool.slice().sort((a, b) => (w.towns[a].force - w.towns[b].force) || byId(a, b))[0];
    }
    // fill the chosen township up to the cap, then spill the rest to the clan's weakest townships; whatever fits nowhere is lost
    let left = n;
    const order = [at, ...mine.filter((t) => t !== at).sort((x, y) => (w.towns[x].force - w.towns[y].force) || byId(x, y))];
    for (const t of order) { const put = Math.min(left, R(w).townForceCap - w.towns[t].force); if (put > 0) { w.towns[t].force += put; left -= put; } if (!left) break; }
    emit('recruits', { clan: clan.id, town: at, n, lost: left });
  }
}

function digIn(w, emit) {
  for (const t of Object.keys(w.towns).sort(byId)) {
    const T = w.towns[t];
    if (T.owner && !T.dugIn && T.force >= K.digInMinForce && T.attackedTick <= w.lastMajor) { T.dugIn = true; emit('dug_in', { town: t, clan: T.owner }); }
  }
}

function shielded(w, clanId) { const c = w.clans[clanId]; return !!c && c.lord === 'human' && w.tick < c.shieldUntil; }
function protectedHome(w, to) {
  const T = w.towns[to];
  const c = T.owner && w.clans[T.owner];
  return !!c && c.lord === 'human' && c.absentSince !== null && c.home === to;   // an absent player's home is never attacked (D205)
}

function aiTurn(w, board, rng, emit, clan) {
  if (w.tick < (clan.coolUntil || 0)) return;
  const pinned = pinnedTowns(w);                                               // a captain pinned to a player's front: his township neither attacks nor is attacked                                  // conquest tempo
  const share = ownedBy(w, clan.id).length / Object.keys(w.towns).length;
  const need = share > R(w).leaderShare ? R(w).leaderAttackRatio : R(w).aiAttackRatio;   // a leader needs better odds
  let best = null;
  for (const t of ownedBy(w, clan.id)) {
    const avail = w.towns[t].force - 1;
    if (avail < 2 || pinned.has(t)) continue;
    const n = Math.max(2, Math.floor(avail * R(w).aiCommitFraction));
    for (const u of board.neighbours(t)) {
      const U = w.towns[u];
      if (!U || !U.owner || U.owner === clan.id) continue;
      if (shielded(w, U.owner) || protectedHome(w, u) || pinned.has(u)) continue;
      if (isHuman(w, U.owner) && !Dir.allowsHostile(w, U.owner)) { Dir.noteHeld(w, U.owner); continue; }   // the Director: rhythm, budget, pressure
      const ratio = n / Math.max(1, U.force);
      if (ratio >= need && (!best || ratio > best.ratio)) best = { from: t, to: u, n, ratio };
    }
  }
  if (!best) return;
  if (isHuman(w, w.towns[best.to].owner)) {   // against a human: a visible raid with a warning (D12, D205)
    declareRaid(w, board, emit, clan, best);
    Dir.spend(w, w.towns[best.to].owner);
  } else {
    fight(w, board, rng, emit, { by: clan.id, from: best.from, to: best.to, n: best.n });
  }
}

function declareRaid(w, board, emit, clan, best) {
  const F = w.towns[best.from];
  F.force -= best.n; F.attackedTick = w.tick; F.dugIn = false;
  let lead = null;
  if (board.content && F.captain && w.chars[F.captain] && w.chars[F.captain].status === 'active') { lead = F.captain; F.captain = null; w.chars[lead].at = null; }   // the captain rides with the raid
  const raid = { id: w.nextId++, by: clan.id, from: best.from, target: best.to, force: best.n, lead, declaredAt: w.tick, landsAt: w.tick + K.raidWarningTicks };
  w.raids.push(raid);
  emit('raid_declared', { by: clan.id, from: best.from, to: best.to, n: best.n, landsAt: raid.landsAt, raid: raid.id });
}

function landRaids(w, board, rng, emit) {
  const due = w.raids.filter((r) => r.landsAt <= w.tick).sort((a, b) => (a.landsAt - b.landsAt) || (a.id - b.id));
  w.raids = w.raids.filter((r) => r.landsAt > w.tick);
  for (const r of due) {
    const T = w.towns[r.target];
    if (!T) continue;
    fight(w, board, rng, emit, { by: r.by, from: r.from, to: r.target, n: r.force, inTransit: true, raid: r });
  }
}

/** The Director's part of a major tick (spec 9): an extra hostile action after two Calm days, the empty-day rule, then the words. */
function directorTurn(w, board, emit) {
  for (const id of Object.keys(w.clans).sort(byId)) {
    const c = w.clans[id];
    if (c.lord !== 'human' || c.out || c.absentSince !== null) continue;
    if (Dir.extraDue(w, id)) {
      // the best bordering AI township against this player at the lowered ratio
      let best = null;
      for (const t of ownedBy(w, id)) for (const e of board.neighbours(t)) {
        const E = w.towns[e];
        if (!E || !E.owner || E.owner === id || w.clans[E.owner].lord !== 'ai' || shielded(w, id) || protectedHome(w, t) || pinnedTowns(w).has(e) || E.force - 1 < 2) continue;
        const n = Math.max(2, Math.floor((E.force - 1) * R(w).aiCommitFraction));
        const ratio = n / Math.max(1, w.towns[t].force);
        if (ratio >= K5.extraRatio && (!best || ratio > best.ratio)) best = { from: e, to: t, n, ratio, by: E.owner };
      }
      if (best) { declareRaid(w, board, emit, w.clans[best.by], best); Dir.spendExtra(w, id); emit('director_extra', { clan: id, from: best.from, to: best.to }); }
    }
    const plan = Dir.emptyDay(w, board, id);
    const d = Dir.dstate(w, id);
    if (plan && d.nudgeDay !== Dir.dayOf(w)) {
      w.towns[plan.enemy].force -= plan.move; w.towns[plan.to].force += plan.move; d.nudgeDay = Dir.dayOf(w);
      emit('director_nudge', { clan: id, enemy: plan.enemy, to: plan.to, n: plan.move });
    }
    const was = d.word, word = Dir.closeDay(w, id);
    emit('director_word', { clan: id, word, changed: was !== word });
  }
}

function majorTick(w, board, rng, emit) {
  for (const c of Object.values(w.clans)) {                    // who is absent (D189)
    if (c.lord === 'human' && !c.out && c.absentSince === null && w.tick - c.lastActive >= K2.absentAfterTicks) { c.absentSince = w.tick; emit('player_absent', { clan: c.id }); }
  }
  recruits(w, board, emit);
  refillAp(w);
  digIn(w, emit);
  if (board.content) for (const m of succeed(w, rng, board.content)) emit('succeeded', { clan: m.char.clan, char: m.char.id, town: m.char.at, dynasty: m.char.dynasty });
  for (const c of Object.values(w.clans)) c.peakTowns = Math.max(c.peakTowns || 0, ownedBy(w, c.id).length);
  for (const clan of Object.values(w.clans).sort((a, b) => byId(a.id, b.id))) {
    if (clan.out || clan.lord === 'human') continue;            // AI lords only; a human's clan is theirs (an absent one sits defensively)
    aiTurn(w, board, rng, emit, clan);
  }
  settleFronts(w, board, rng, emit);
  directorTurn(w, board, emit);
  for (const c of Object.values(w.clans)) {
    if (!c.out && !ownedBy(w, c.id).length) { c.out = true; emit('clan_out', { clan: c.id }); }
  }
  warTurn(w, board, emit);
  w.lastMajor = w.tick;
}

/** Advance the world. Orders are applied first (they are the player's sitting), then `ticks` hours pass, at most K.catchUpCapTicks of them
 *  simulated; any more are skipped and the world "settles" (D168). Never changes `state`. */
export function step(board, state, orders = [], ticks = 0, opts = {}) {
  const w = structuredClone(state);
  const rng = opts.rng || makeRng(w.rng);   // opts.rng lets tests script the dice
  const events = [];
  const emit = (type, data = {}) => { const e = { tick: w.tick, type, ...data }; events.push(e); Dir.observe(w, [e]); };
  if (w.war && w.war.over) {   // a finished war takes no orders and no time
    for (const o of orders) emit('order_rejected', { clan: o.clan, order: o, reason: 'the war is over' });
    return { state: w, events };
  }
  for (const o of orders) (o.type === 'front_open' || o.type === 'front' ? applyFrontOrder : (o.type === 'scout' || o.type === 'fortify' || o.type === 'taunt') ? applySitting : applyOrder)(w, board, rng, emit, o);
  const n = Math.min(ticks, K.catchUpCapTicks);
  for (let i = 0; i < n; i++) {
    w.tick++;
    landRaids(w, board, rng, emit);
    if (isMajor(w)) majorTick(w, board, rng, emit);
  }
  if (ticks > n) { w.tick += ticks - n; emit('settled', { skipped: ticks - n }); }
  if (!opts.rng) w.rng = rng.state;
  return { state: w, events };
}

// ---------------------------------------------------------------- checks

export function checkInvariants(board, w) {
  const bad = [];
  for (const [id, t] of Object.entries(w.towns)) {
    if (!board.has(id)) bad.push(`${id}: not on the board`);
    if (!Number.isInteger(t.force) || t.force < 0) bad.push(`${id}: force ${t.force}`);
    if (t.owner !== null && !w.clans[t.owner]) bad.push(`${id}: owner ${t.owner} does not exist`);
    if (t.owner !== null && t.force < 1) bad.push(`${id}: owned but empty`);
    if (t.force > R(w).townForceCap) bad.push(`${id}: force ${t.force} is over the cap`);
  }
  for (const r of w.raids) {
    if (r.landsAt - r.declaredAt < K.raidWarningTicks) bad.push(`raid ${r.id}: warning of ${r.landsAt - r.declaredAt} ticks`);
    if (!Number.isInteger(r.force) || r.force < 1) bad.push(`raid ${r.id}: force ${r.force}`);
    if (!w.clans[r.by]) bad.push(`raid ${r.id}: unknown clan`);
  }
  for (const c of Object.values(w.clans)) if (!w.towns[c.home]) bad.push(`clan ${c.id}: home missing`);
  for (const f of openFronts(w)) {
    if (!w.clans[f.attacker]) bad.push(`front ${f.id}: unknown clan`);
    if (f.units < 1) bad.push(`front ${f.id}: ${f.units} units`);
    if (f.beat > K4.frontMaxManeuvers + 1) bad.push(`front ${f.id}: ${f.beat} beats`);
    if (!w.towns[f.target] || !w.towns[f.target].captain) bad.push(`front ${f.id}: no captain at the target`);
  }
  for (const c of Object.values(w.clans)) if (openFronts(w, c.id).length > K4.frontMaxPerPlayer) bad.push(`clan ${c.id}: too many fronts`);
  if (board.content) {
    const content = board.content;
    for (const c of Object.values(w.chars)) {
      if (!['active', 'captured', 'dead'].includes(c.status)) bad.push(`${c.id}: status ${c.status}`);
      if (c.status === 'active') {
        if (c.at === null) { if (!w.raids.some((r) => r.lead === c.id)) bad.push(`${c.id}: active but nowhere`); }
        else if (!w.towns[c.at]) bad.push(`${c.id}: at unknown township`);
        else if (w.towns[c.at].captain !== c.id) bad.push(`${c.id}: not recorded in ${c.at}`);
        else if (w.towns[c.at].owner !== c.clan) bad.push(`${c.id}: in a township their clan does not own`);
      }
      if (c.status === 'captured' && !w.clans[c.heldBy]) bad.push(`${c.id}: held by unknown clan`);
      const ids = c.traits.map((t) => t.id);
      if (new Set(ids).size !== ids.length) bad.push(`${c.id}: repeated trait`);
      for (const id of ids) if (!content.traits.has(id)) bad.push(`${c.id}: trait ${id} is not in the content`);
      const nn = c.traits.filter((t) => t.notable).length;
      if (c.tier === 2 && (c.traits.length !== 4 || nn < 2)) bad.push(`${c.id}: tier 2 needs 4 traits, 2 notable`);
      if (c.tier === 3 && (c.traits.length !== 5 || nn < 3)) bad.push(`${c.id}: tier 3 needs 5 traits, 3 notable`);
    }
    for (const [id, t] of Object.entries(w.towns)) if (t.captain) { const c = w.chars[t.captain]; if (!c || c.status !== 'active' || c.at !== id) bad.push(`${id}: captain ${t.captain} is not there`); }
    for (const clan of Object.values(w.clans)) {
      const peak = Math.max(clan.peakTowns || 0, Object.values(w.towns).filter((t) => t.owner === clan.id).length);
      const count = captainsOf(w, clan.id).length + w.raids.filter((r) => r.lead && w.chars[r.lead] && w.chars[r.lead].clan === clan.id).length * 0;
      if (count > K.captainCapBase + Math.floor(peak / K.captainCapPerTowns)) bad.push(`clan ${clan.id}: ${count} captains is over its cap`);
    }
  }
  return bad;
}
