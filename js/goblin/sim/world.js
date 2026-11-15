// The world and its turn (docs/goblins/04-systems-spec.md sections 2, 4, 5 and 8).
//
//   newWorld(board, cfg)                      -> World
//   step(board, world, orders, ticks, opts)   -> { state, events }      pure: the input is never changed
//   checkInvariants(board, world)             -> [problems]
//
// World is plain JSON. The ledger is not part of it: step returns the events it produced and the caller keeps them (state stays small).
// S3 covers the territory game: recruits, dig-in, AI attacks, declared raids and human attack and move orders. Characters, fronts and the
// Director are added in S4 to S6; their hooks are marked.

import { K, K2 } from './constants.js';
import { makeRng, seedState } from './rng.js';
import { skirmish, modsFor } from './skirmish.js';

/** The world-level tunables, kept in each world (w.rules) so a saved or simulated war records the rules it ran under, and tuning can vary them per run. */
export const DEFAULT_RULES = Object.freeze({ townForceCap: K2.townForceCap, recruitFullTowns: K2.recruitFullTowns, recruitDivisorBeyond: K2.recruitDivisorBeyond,
  aiAttackRatio: K.aiAttackRatio, aiCommitFraction: K2.aiCommitFraction });
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
                    lastActive: 0, absentSince: null, out: false };
  });
  return { v: 1, seed: cfg.seed ?? 1, rng: seedState(cfg.seed ?? 1), tick: 0, startHour: cfg.startHour ?? K2.startHour, lastMajor: 0,
           theatre, towns, clans, chars: {}, fronts: {}, raids: [], director: {}, nextId: 1, rules: { ...DEFAULT_RULES, ...(cfg.rules || {}) } };
}

// ---------------------------------------------------------------- helpers

const ownedBy = (w, clanId) => Object.keys(w.towns).filter((t) => w.towns[t].owner === clanId).sort(byId);
const isHuman = (w, id) => !!id && w.clans[id] && w.clans[id].lord === 'human';
const borderMods = (board, from, to, dugIn) => {
  const b = board.border(from, to) || {};
  return modsFor({ dugIn, riverBorder: !!(b.river || b.ridge), highway: !!(b.highways && b.highways.length) });
};

/** One skirmish: units from `from` (or already on the road, `inTransit`) attack `to`. Mutates w, emits one event. */
function fight(w, board, rng, emit, { by, from, to, n, inTransit = false, raid = null }) {
  const T = w.towns[to], F = w.towns[from];
  if (!inTransit) { F.force -= n; F.attackedTick = w.tick; F.dugIn = false; }
  const against = T.owner;
  if (against === by) { T.force = Math.min(R(w).townForceCap, T.force + n); emit('units_arrived', { clan: by, from, to, n }); return; }
  const r = skirmish({ attackers: n, defenders: T.force, ...borderMods(board, from, to, T.dugIn) }, rng);
  const detail = isHuman(w, by) || isHuman(w, against);
  if (r.won) { T.owner = by; T.force = r.attackersLeft; T.dugIn = false; T.captain = null; T.attackedTick = -1; }
  else { T.force = r.defendersLeft; if (F.owner === by) F.force += r.attackersLeft; }
  emit(raid ? 'raid_landed' : 'skirmish_result', { by, against, from, to, n, won: r.won, lost: r.lost, left: { a: r.attackersLeft, d: r.defendersLeft },
        ...(detail ? { rounds: r.rounds } : {}) });
}

// ---------------------------------------------------------------- orders (a human's, applied before time passes)

function applyOrder(w, board, rng, emit, o) {
  const clan = w.clans[o.clan];
  const reject = (reason) => emit('order_rejected', { clan: o.clan, order: o, reason });
  if (!clan || clan.lord !== 'human' || clan.out) return reject('not a live human clan');
  const F = w.towns[o.from], T = w.towns[o.to];
  if (!F || !T || F.owner !== o.clan) return reject('origin is not yours');
  if (!board.border(o.from, o.to)) return reject('not neighbours');
  if (!Number.isInteger(o.n) || o.n < 1 || o.n > F.force - 1) return reject('n must be from 1 to the force minus 1');
  clan.lastActive = w.tick; clan.absentSince = null;
  if (o.type === 'move') { if (T.owner !== o.clan) return reject('move needs your own township'); if (T.force + o.n > R(w).townForceCap) return reject('that township would be over the cap'); F.force -= o.n; T.force += o.n; return emit('units_moved', { clan: o.clan, from: o.from, to: o.to, n: o.n }); }
  if (o.type === 'attack') {
    if (T.owner === o.clan) return reject('that is your own township');
    if (T.captain) return reject('a captain defends it: this needs a front (S5)');   // hook for S5
    return fight(w, board, rng, emit, { by: o.clan, from: o.from, to: o.to, n: o.n });
  }
  return reject('unknown order');
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
    if (clan.lord === 'ai' && border.length) {
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
  let best = null;
  for (const t of ownedBy(w, clan.id)) {
    const avail = w.towns[t].force - 1;
    if (avail < 2) continue;
    const n = Math.max(2, Math.floor(avail * R(w).aiCommitFraction));
    for (const u of board.neighbours(t)) {
      const U = w.towns[u];
      if (!U || !U.owner || U.owner === clan.id) continue;
      if (shielded(w, U.owner) || protectedHome(w, u)) continue;
      // hook for S5: a township whose captain is pinned to a player's front is never attacked
      const ratio = n / Math.max(1, U.force);
      if (ratio >= R(w).aiAttackRatio && (!best || ratio > best.ratio)) best = { from: t, to: u, n, ratio };
    }
  }
  if (!best) return;
  if (isHuman(w, w.towns[best.to].owner)) {   // against a human: a visible raid with a warning (D12, D205)
    const F = w.towns[best.from];
    F.force -= best.n; F.attackedTick = w.tick; F.dugIn = false;
    const raid = { id: w.nextId++, by: clan.id, from: best.from, target: best.to, force: best.n, declaredAt: w.tick, landsAt: w.tick + K.raidWarningTicks };
    w.raids.push(raid);
    emit('raid_declared', { by: clan.id, from: best.from, to: best.to, n: best.n, landsAt: raid.landsAt, raid: raid.id });
  } else {
    fight(w, board, rng, emit, { by: clan.id, from: best.from, to: best.to, n: best.n });
  }
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

function majorTick(w, board, rng, emit) {
  for (const c of Object.values(w.clans)) {                    // who is absent (D189)
    if (c.lord === 'human' && !c.out && c.absentSince === null && w.tick - c.lastActive >= K2.absentAfterTicks) { c.absentSince = w.tick; emit('player_absent', { clan: c.id }); }
  }
  recruits(w, board, emit);
  digIn(w, emit);
  for (const clan of Object.values(w.clans).sort((a, b) => byId(a.id, b.id))) {
    if (clan.out || clan.lord === 'human') continue;            // AI lords only; a human's clan is theirs (an absent one sits defensively)
    aiTurn(w, board, rng, emit, clan);
  }
  // hook for S6: the Director adjusts here
  for (const c of Object.values(w.clans)) {
    if (!c.out && !ownedBy(w, c.id).length) { c.out = true; emit('clan_out', { clan: c.id }); }
  }
  w.lastMajor = w.tick;
}

/** Advance the world. Orders are applied first (they are the player's sitting), then `ticks` hours pass, at most K.catchUpCapTicks of them
 *  simulated; any more are skipped and the world "settles" (D168). Never changes `state`. */
export function step(board, state, orders = [], ticks = 0, opts = {}) {
  const w = structuredClone(state);
  const rng = makeRng(w.rng);
  const events = [];
  const emit = (type, data = {}) => events.push({ tick: w.tick, type, ...data });
  for (const o of orders) applyOrder(w, board, rng, emit, o);
  const n = Math.min(ticks, K.catchUpCapTicks);
  for (let i = 0; i < n; i++) {
    w.tick++;
    landRaids(w, board, rng, emit);
    if (isMajor(w)) majorTick(w, board, rng, emit);
  }
  if (ticks > n) { w.tick += ticks - n; emit('settled', { skipped: ticks - n }); }
  w.rng = rng.state;
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
  return bad;
}
