// Convoys, framed losses and the messenger (D110 to D122, D170; finish plan F4).
// A convoy is data: { id, clan, from, to, route, legs, departTick, arriveTick, cargo: { build, coin }, escort }. Where it is comes from the tick, so nothing
// moves per frame (D114). Far townships send their day's Build and Coin by convoy to the clan's home; near ones deliver at once.
// The only unwarned loss in the game is an ambush on a human clan's convoy, under tight rules (never in the first three days, at most one every two days,
// only the cargo, never in Heated or Overwhelmed, never under Gentle), always with a cryptic clue first and a reprisal offered after.

import { K, K8, K10 } from './constants.js';
import { skirmish } from './skirmish.js';
import { bearingMiles } from './ledger.js';
import { ruleOf } from './regions.js';

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const laneMap = new WeakMap();
function lanes(board) {
  if (!laneMap.has(board)) {
    const m = new Set();
    for (const l of (board.json.lanes || [])) for (const seg of l.segments) for (let i = 0; i + 1 < seg.length; i++) { m.add(seg[i] + '>' + seg[i + 1]); m.add(seg[i + 1] + '>' + seg[i]); }
    laneMap.set(board, m);
  }
  return laneMap.get(board);
}
export const legTicks = (board, a, b) => {
  const mi = bearingMiles(board, a, b).mi; let t = Math.max(1, Math.round(mi / K10.milesPerTick));
  if (lanes(board).has(a + '>' + b)) t = Math.max(1, Math.ceil(t / 2));
  if (ruleOf(board, a) === 'roads' && ruleOf(board, b) === 'roads') t = Math.max(1, Math.ceil(t / 2));   // a roads region: twice as fast
  return t;
};

/** The shortest route over the theatre's border graph from one township to another (ties by name). */
export function routeBetween(w, board, from, to) {
  const prev = new Map([[from, null]]), q = [from];
  for (let i = 0; i < q.length && !prev.has(to); i++) for (const n of [...board.neighbours(q[i])].sort(byId)) if (w.towns[n] && !prev.has(n)) { prev.set(n, q[i]); q.push(n); }
  if (!prev.has(to)) return null;
  const path = []; for (let t = to; t !== null; t = prev.get(t)) path.push(t);
  return path.reverse();
}

/** Split a clan's day of Build and Coin into what arrives at once and what must travel. Called by the economy at the noon tick. */
export function splitIncome(w, board, clanId, inc) {
  const clan = w.clans[clanId];
  const home = clan && w.towns[clan.home] && w.towns[clan.home].owner === clanId ? clan.home : null;
  const out = { near: { build: 0, coin: 0 }, far: { build: 0, coin: 0 }, farFrom: null, farBest: -1 };
  if (!home) { out.near = { build: inc.build, coin: inc.coin }; return out; }
  const dist = board.distances(home);
  for (const [t, T] of Object.entries(w.towns)) {
    if (T.owner !== clanId || (T.freshUntil && T.freshUntil > w.tick)) continue;
    const b = T.trade === 'build' ? 1 : 0, c = T.trade === 'coin' ? 1 : 0;
    if (!b && !c) continue;
    if ((dist.get(t) ?? 0) >= K10.farSteps) { out.far.build += b * K8.buildPerTown; out.far.coin += c * K8.coinPerTown; if ((dist.get(t) ?? 0) > out.farBest) { out.farBest = dist.get(t); out.farFrom = t; } }
    else { out.near.build += b * K8.buildPerTown; out.near.coin += c * K8.coinPerTown; }
  }
  return out;
}

export function spawnConvoy(w, board, emit, clanId, from, cargo) {
  const home = w.clans[clanId].home;
  const route = routeBetween(w, board, from, home);
  if (!route || route.length < 2 || (cargo.build + cargo.coin) < 1) return null;
  const legs = []; for (let i = 0; i + 1 < route.length; i++) legs.push(legTicks(board, route[i], route[i + 1]));
  const total = legs.reduce((a, b) => a + b, 0);
  const c = { id: 'v' + w.nextId++, clan: clanId, from, to: home, route, legs, departTick: w.tick, arriveTick: w.tick + total, cargo: { ...cargo }, escort: K10.escortBase };
  (w.convoys ||= []).push(c);
  emit('convoy_sent', { clan: clanId, convoy: c.id, from, to: home, cargo: c.cargo, arriveTick: c.arriveTick });
  return c;
}

/** Where a convoy is at a tick: the township it is in or has just left, the next one, and how far along the leg (0 to 1). */
export function positionAt(c, tick) {
  let el = Math.max(0, tick - c.departTick);
  for (let i = 0; i < c.legs.length; i++) {
    if (el < c.legs[i]) return { at: c.route[i], next: c.route[i + 1], frac: el / c.legs[i], index: i };
    el -= c.legs[i];
  }
  return { at: c.route[c.route.length - 1], next: null, frac: 0, index: c.route.length - 1 };
}

const escortOf = (w, c) => { const g = w.guards && w.guards[positionAt(c, w.tick).at]; return c.escort + (g && g.clan === c.clan && g.until >= w.tick ? K10.guardBonus : 0); };
export const convoysOf = (w, clanId) => (w.convoys || []).filter((c) => c.clan === clanId);

// ---------------------------------------------------------------- ambush (the framed, unwarned loss)

const isHuman = (w, id) => !!w.clans[id] && w.clans[id].lord === 'human';
const lastLoss = (w, id) => (w.lossLog && w.lossLog[id] ? w.lossLog[id].last : null);

/** The conditions (except the clock gap) under which a human clan could be ambushed now, and the plan if so: { convoy, by, from, at }. */
export function ambushPlan(w, board, clanId) {
  const clan = w.clans[clanId];
  if (!clan || clan.lord !== 'human' || clan.out || clan.gentle || w.tick < K10.ambushFirstTicks) return null;
  if (clan.absentSince !== null) return null;
  if ((w.ambushes || []).some((a) => a.clan === clanId)) return null;
  const last = lastLoss(w, clanId); if (last !== null && w.tick - last < K10.ambushGapTicks) return null;
  for (const c of convoysOf(w, clanId).sort((a, b) => a.arriveTick - b.arriveTick || byId(a.id, b.id))) {
    if (c.arriveTick - w.tick < K10.ambushLead + 1) continue;
    const spot = positionAt(c, w.tick + K10.ambushLead).at;
    const cands = board.neighbours(spot).filter((n) => w.towns[n] && w.towns[n].owner && w.towns[n].owner !== clanId && w.clans[w.towns[n].owner].lord === 'ai' && w.towns[n].force >= K10.ambushMinForce && !(w.towns[n].captain && (w.fronts && Object.values(w.fronts).some((f) => f.target === n))))
      .sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b));
    if (cands.length) return { convoy: c.id, by: w.towns[cands[0]].owner, from: cands[0], at: spot };
  }
  return null;
}

/** Per major tick, for each present human: maybe schedule an ambush. The clue is emitted now and the blow lands ambushLead ticks later. */
export function ambushTurn(w, board, emit, wordOf) {
  for (const id of Object.keys(w.clans).sort(byId)) {
    if (!isHuman(w, id)) continue;
    const word = wordOf(w, id);
    if (word === 'Heated' || word === 'Overwhelmed') continue;   // the Director's budget: no unwarned loss while the player is already under pressure
    const plan = ambushPlan(w, board, id);
    if (!plan) continue;
    (w.ambushes ||= []).push({ id: 'a' + w.nextId++, clan: id, convoy: plan.convoy, by: plan.by, from: plan.from, at: plan.at, lands: w.tick + K10.ambushLead });
    (w.lossLog ||= {})[id] = { last: w.tick };   // the gap counts from the clue, so two never overlap
    emit('sighting', { clan: id, by: plan.by, near: plan.from });   // cryptic: it names the rival township the scouts were seen near, never the convoy
  }
}

/** Every tick: convoys arrive, and ambushes land. */
export function convoyTick(w, board, rng, emit) {
  for (const a of (w.ambushes || []).filter((x) => x.lands <= w.tick).sort((x, y) => byId(x.id, y.id))) {
    w.ambushes = w.ambushes.filter((x) => x !== a);
    const c = (w.convoys || []).find((x) => x.id === a.convoy);
    const F = w.towns[a.from];
    if (!c || !F || F.owner !== a.by) { emit('ambush_foiled', { clan: a.clan, by: a.by, why: 'nothing there' }); continue; }
    const n = Math.min(K10.ambushUnits, F.force - 1);
    const r = skirmish({ attackers: Math.max(1, n), defenders: escortOf(w, c) }, rng);
    F.force = Math.max(1, F.force - r.lost.attackers);
    if (r.won) {
      w.convoys = w.convoys.filter((x) => x !== c);
      w.reprisal = { ...(w.reprisal || {}), [a.clan]: { target: a.from, by: a.by, until: w.tick + K10.reprisalTicks } };
      emit('convoy_ambushed', { clan: a.clan, by: a.by, from: a.from, at: positionAt(c, w.tick).at, cargo: c.cargo, convoy: c.id });
    } else emit('ambush_foiled', { clan: a.clan, by: a.by, why: 'the escort held', at: positionAt(c, w.tick).at });
  }
  for (const c of (w.convoys || []).filter((x) => x.arriveTick <= w.tick)) {
    w.convoys = w.convoys.filter((x) => x !== c);
    const clan = w.clans[c.clan], home = w.towns[c.to];
    if (!clan || clan.out || !home || home.owner !== c.clan || !clan.res) { emit('convoy_lost', { clan: c.clan, convoy: c.id, why: 'home was lost' }); continue; }
    clan.res.build = Math.min(K8.resCap, clan.res.build + c.cargo.build); clan.res.coin = Math.min(K8.resCap, clan.res.coin + c.cargo.coin);
    emit('convoy_arrived', { clan: c.clan, convoy: c.id, to: c.to, cargo: c.cargo });
  }
}

// ---------------------------------------------------------------- orders: guard, raid, setting

export function applyConvoyOrder(w, board, rng, emit, o, hasAp, spend) {
  const clan = w.clans[o.clan];
  const reject = (reason) => emit('order_rejected', { clan: o.clan, order: o, reason });
  if (!clan || clan.lord !== 'human' || clan.out) return reject('not a live human clan');
  clan.lastActive = w.tick; clan.absentSince = null;
  if (o.type === 'setting') { if (o.key !== 'gentle') return reject('unknown setting'); clan.gentle = !!o.value; return emit('setting', { clan: o.clan, key: 'gentle', value: !!o.value }); }
  if (!hasAp(clan, 1)) return reject('no actions left: they refill at 09:00, 12:00 and 18:00');
  if (o.type === 'guard') {
    const T = w.towns[o.town];
    if (!T || T.owner !== o.clan) return reject('not your township');
    if (!convoysOf(w, o.clan).some((c) => c.route.includes(o.town))) return reject('none of your convoys passes through there');
    spend(clan, 1);
    (w.guards ||= {})[o.town] = { clan: o.clan, until: w.tick + K10.guardTicks };
    return emit('guarded', { clan: o.clan, town: o.town });
  }
  if (o.type === 'raidconvoy') {
    const c = (w.convoys || []).find((x) => x.id === o.convoy);
    if (!c || c.clan === o.clan) return reject('no such convoy');
    const spot = positionAt(c, w.tick).at;
    const from = board.neighbours(spot).filter((n) => w.towns[n] && w.towns[n].owner === o.clan && w.towns[n].force >= 3).sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b))[0]
      || (w.towns[spot] && w.towns[spot].owner === o.clan && w.towns[spot].force >= 3 ? spot : null);
    if (!from) return reject('you need a township with at least 3 units beside it');
    const n = Math.min(K10.raidUnits, w.towns[from].force - 1);
    spend(clan, 1);
    const r = skirmish({ attackers: n, defenders: escortOf(w, c) }, rng);
    w.towns[from].force = Math.max(1, w.towns[from].force - r.lost.attackers);
    if (r.won) {
      w.convoys = w.convoys.filter((x) => x !== c);
      if (clan.res) { clan.res.build = Math.min(K8.resCap, clan.res.build + c.cargo.build); clan.res.coin = Math.min(K8.resCap, clan.res.coin + c.cargo.coin); }
    }
    return emit('convoy_raided', { clan: o.clan, against: c.clan, convoy: c.id, at: spot, from, n, won: r.won, cargo: r.won ? c.cargo : null, lost: r.lost.attackers });
  }
  return reject('unknown order');
}

/** The messenger's mood (D120, D121): it mirrors the Director's word and goes nervous when a loss could come within the day. */
export function messengerMood(w, board, clanId, word) {
  if (word === 'Overwhelmed') return 'frantic';
  if (word === 'Heated' || ambushPlan(w, board, clanId)) return 'nervous';
  return word === 'Calm' ? 'cheerful' : 'steady';
}
