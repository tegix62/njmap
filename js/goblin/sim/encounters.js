// The rest of the sitting (finish plan F3; D41 to D46, D92 to D98, D124, H51): a foothold run, parley, insults and confidence, a duel, captives, legends.
// Orders (all by a human clan):
//   foothold { clan, town, method: 'swarm'|'night'|'ford' }   a probe at a township with no captain; a foothold is decided at the next major tick (D95)
//   parley   { clan, town }                                  Coin buys a day's truce with the captain who holds `town`
//   insult   { clan, town }                                  needle a captain you have learned about: his confidence falls, and low confidence is Humiliated
//   duel     { clan, town }                                  your captain against theirs on a shared border: injury and confidence, not land
//   ransom   { clan, char }  release { clan, char }          decide what to do with a captive (keeping one costs Food each tick)
// Nothing here uses randomness except the dice passed in, and nothing reads the clock.

import { K, K6, K8, K9 } from './constants.js';
import { counterMod, injuryRoll, applyInjury, kill, place, suitBonus, captainsOf, captainCap } from './chars.js';
import { active as ecoActive, canMarch, payMarch, dayOf } from './economy.js';
import { hasAp, spend } from './sitting.js';
import { untouchable } from './dwarves.js';

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const hourOf = (w) => (w.startHour + w.tick) % 24;
const isNight = (h) => h >= K6.nightFrom || h < K6.nightTo;
export const FOOTHOLD_METHODS = ['swarm', 'night', 'ford'];
export const conf = (c) => (c.confidence ?? 70);

const ownedNear = (w, board, clanId, town) => board.neighbours(town).filter((n) => w.towns[n] && w.towns[n].owner === clanId);

/** How a foothold method stands right now (words in the UI, numbers here). */
export function footholdMods(w, board, clanId, town, method) {
  const T = w.towns[town], near = ownedNear(w, board, clanId, town);
  const best = Math.max(0, ...near.map((n) => w.towns[n].force - 1));
  const mods = [];
  if (method === 'swarm') { const v = clamp(Math.floor(best / Math.max(1, T.force)), 0, K9.swarmCap); if (v) mods.push({ why: 'numbers', v }); }
  if (method === 'night' && isNight(hourOf(w))) mods.push({ why: 'night', v: K9.nightBonus });
  if (method === 'ford') {
    const river = near.some((n) => (board.border(town, n) || {}).river);
    if (river) mods.push({ why: 'across the water', v: K9.fordBonus });
  }
  const g = w.footDay && w.footDay[town];
  if (g && g.day === dayOf(w)) mods.push({ why: 'been tried today', v: -K9.footholdDecay * g.n });
  const cl = w.clans[clanId], t = cl && cl.footToday;
  if (t && t.day === dayOf(w) && t.n > 0 && K9.footholdTired) mods.push({ why: 'your scouts are tired', v: -K9.footholdTired * t.n });
  return { mods, total: mods.reduce((s, m) => s + m.v, 0) };
}

export function applyEncounter(w, board, rng, emit, o) {
  const clan = w.clans[o.clan];
  const reject = (reason) => emit('order_rejected', { clan: o.clan, order: o, reason });
  if (!clan || clan.lord !== 'human' || clan.out) return reject('not a live human clan');
  clan.lastActive = w.tick; clan.absentSince = null;
  const noAp = () => !hasAp(clan, 1) && 'no actions left: they refill at 09:00, 12:00 and 18:00';
  const T = o.town && w.towns[o.town];

  if (o.type === 'foothold') {
    if (!T || !T.owner || T.owner === o.clan) return reject('pick a township a rival holds');
    if (T.captain) return reject('a captain holds it: that is a front');
    if (untouchable(w, board, o.town)) return reject('the dwarves hold the rock: they cannot be conquered, only befriended');
    if (!ownedNear(w, board, o.clan, o.town).length) return reject('it must border one of yours');
    if (!FOOTHOLD_METHODS.includes(o.method)) return reject('unknown method');
    if (w.footholds && w.footholds[o.town]) return reject('a foothold is already waiting there');
    const e = noAp(); if (e) return reject(e);
    spend(clan, 1);
    const dice = [rng.d6(), rng.d6()], m = footholdMods(w, board, o.clan, o.town, o.method);
    const roll = dice[0] + dice[1] + m.total;
    const ft = clan.footToday; clan.footToday = { day: dayOf(w), n: (ft && ft.day === dayOf(w) ? ft.n : 0) + 1 };   // counted after this run's own roll is set below
    const fd = (w.footDay ||= {}); const g = fd[o.town]; fd[o.town] = { day: dayOf(w), n: g && g.day === dayOf(w) ? g.n + 1 : 1 };
    let lost = 0;
    if (roll <= K9.footholdLoseUnit) {
      lost = o.method === 'ford' ? K9.fordLose : 1;
      const from = ownedNear(w, board, o.clan, o.town).filter((n) => w.towns[n].force > 1).sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b))[0];
      if (from) { lost = Math.min(lost, w.towns[from].force - 1); w.towns[from].force -= lost; } else lost = 0;
    }
    const placed = roll >= K9.footholdTarget;
    if (placed) (w.footholds ||= {})[o.town] = { clan: o.clan, tick: w.tick };
    return emit('foothold_run', { clan: o.clan, town: o.town, method: o.method, dice, mods: m.mods, roll, placed, lost });
  }

  if (o.type === 'parley' || o.type === 'insult' || o.type === 'duel') {
    const c = T && T.captain && w.chars[T.captain];
    if (!c || c.status !== 'active' || T.owner === o.clan) return reject('a captain of another clan must hold that township');
    if (!ownedNear(w, board, o.clan, o.town).length) return reject('it must border one of yours');
    if (o.type === 'parley') {
      if (!ecoActive(clan)) return reject('no economy in this war');
      if (clan.res.coin < K9.parleyCost) return reject(`a parley costs ${K9.parleyCost} Coin: you have ${clan.res.coin}`);
      if (!(c.known[o.clan] || []).length) return reject('learn something about the captain first (scout)');
      const e = noAp(); if (e) return reject(e);
      spend(clan, 1); clan.res.coin -= K9.parleyCost;
      (w.truces ||= {})[o.town] = { by: o.clan, until: w.tick + K9.truceTicks };
      return emit('parleyed', { clan: o.clan, town: o.town, char: c.id, until: w.tick + K9.truceTicks });
    }
    if (o.type === 'insult') {
      if (!(c.known[o.clan] || []).length) return reject('learn something about the captain first (scout)');
      const e = noAp(); if (e) return reject(e);
      spend(clan, 1);
      const dice = [rng.d6(), rng.d6()];
      const prideful = c.traits.some((t) => board.content.traits.get(t.id).drive === 'stand' && t.notable);   // a proud captain takes it harder
      const roll = dice[0] + dice[1] + K9.insultKnownBonus + counterMod(board.content, c, 'pressure');
      const ok = roll >= K9.insultTarget;
      const before = conf(c);
      c.confidence = clamp(before + (ok ? -(K9.insultDrop + (prideful ? 5 : 0)) : K9.insultBackfire), 0, 100);
      settleState(board.content, c);
      return emit('insulted', { clan: o.clan, town: o.town, char: c.id, dice, roll, ok, humiliated: c.state === 'humiliated' });
    }
    if (o.type === 'duel') {
      const mine = ownedNear(w, board, o.clan, o.town).map((n) => w.towns[n].captain && w.chars[w.towns[n].captain]).find((x) => x && x.status === 'active');
      if (!mine) return reject('you need a captain on a township that borders theirs');
      const e = noAp(); if (e) return reject(e);
      spend(clan, 1);
      const a = [rng.d6(), rng.d6()], d = [rng.d6(), rng.d6()];
      const ra = a[0] + a[1] + suitBonus(board.content, mine, 'pressure') + Math.round((conf(mine) - 70) / 20);
      const rd = d[0] + d[1] + suitBonus(board.content, c, 'pressure') + Math.round((conf(c) - 70) / 20);
      const won = ra > rd, winner = won ? mine : c, loser = won ? c : mine;
      winner.confidence = clamp(conf(winner) + K9.duelWin, 0, 100); loser.confidence = clamp(conf(loser) - K9.duelLose, 0, 100);
      let hurt = 'none';
      if (ra !== rd) { const res = injuryRoll(rng, won ? 'enemy' : 'own'); if (res !== 'none') { applyInjury(rng, board.content, loser); hurt = res; if (res === 'dead') kill(w, loser); } }
      settleState(board.content, winner); settleState(board.content, loser);
      return emit('dueled', { clan: o.clan, town: o.town, mine: mine.id, theirs: c.id, dice: { a, d }, won: ra === rd ? null : won, hurt, loser: ra === rd ? null : loser.id });
    }
  }

  if (o.type === 'ransom' || o.type === 'release') {
    const c = w.chars[o.char];
    if (!c || c.status !== 'captured' || c.heldBy !== o.clan) return reject('you do not hold that captive');
    const theirs = w.clans[c.clan];
    if (!roomFor(w, c)) return reject('their clan has no place for another captain right now');
    if (o.type === 'ransom') {
      if (!ecoActive(clan)) return reject('no economy in this war');
      const price = ransomPrice(c);
      if (!theirs || theirs.out) return reject('their clan is gone');
      if (ecoActive(theirs) && theirs.res.coin < price) return reject(`they cannot pay ${price} Coin yet`);
      if (ecoActive(theirs)) theirs.res.coin -= price;
      clan.res.coin = Math.min(K8.resCap, clan.res.coin + price);
      freeCaptive(w, c);
      return emit('ransomed', { clan: o.clan, char: c.id, from: c.clan, price, at: c.at });
    }
    freeCaptive(w, c);
    if (!c.bonds.includes(o.clan)) c.bonds.push(o.clan);   // he remembers the mercy: a front against him by this clan starts a step better
    return emit('released', { clan: o.clan, char: c.id, from: c.clan, at: c.at });
  }
  return reject('unknown order');
}

/** A captive goes home if their clan has room for another captain; otherwise they have nowhere to be a captain and are lost to the war (no heir: they did not die in battle). */
export const roomFor = (w, c) => captainsOf(w, c.clan).length < captainCap(w, c.clan);
export const ransomPrice = (c) => K9.ransomBase + K9.ransomPerGeneration * (c.dynasty - 1);
function freeCaptive(w, c) {
  c.heldBy = null;
  if (roomFor(w, c) && place(w, c, c.homeTown)) { c.status = 'active'; return true; }
  c.status = 'dead'; c.at = null; return false;
}

/** A captain with confidence at or below the line is Humiliated (the user's word, placeholder flag in the content); above the recovery line he is not. */
export function settleState(content, c) {
  if (conf(c) <= K9.humiliatedBelow && content.states.has('humiliated')) c.state = 'humiliated';
  else if (c.state === 'humiliated' && conf(c) > K9.recoverAbove) c.state = null;
}

/** Called when a front closes: confidence moves with the result (D124). */
export function frontConfidence(content, att, def, attackerWon) {
  if (def) { def.confidence = clamp(conf(def) + (attackerWon ? -K9.frontLossConfidence : K9.frontWinConfidence), 0, 100); settleState(content, def); }
  if (att) { att.confidence = clamp(conf(att) + (attackerWon ? K9.frontWinConfidence : -K9.frontLossConfidence), 0, 100); settleState(content, att); }
}

/** A tier 2 captain who has led three won fronts becomes a legend (tier 3): a fifth trait, a notable one, and a title; one a clan. */
export function maybeLegend(w, content, rng, c, emit) {
  c.wins = (c.wins || 0) + 1;
  if (c.tier !== 2 || c.wins < K9.legendWins) return null;
  if (Object.values(w.chars).some((x) => x.clan === c.clan && x.tier === 3 && x.status === 'active')) return null;
  const held = new Set(c.traits.map((t) => t.id));
  const pool = content.notable.filter((t) => !held.has(t.id));
  if (!pool.length) return null;
  const gain = pool[rng.int(pool.length)];
  c.traits.push({ id: gain.id, notable: true }); c.tier = 3; c.titles.push('legend');
  emit('legend', { clan: c.clan, char: c.id, trait: gain.id });
  return c;
}

/** At every major tick: footholds are decided, truces lapse, captives are fed or escape, confidence creeps back at the evening tick. */
export function encounterTick(w, board, rng, emit) {
  for (const t of Object.keys(w.footholds || {}).sort(byId)) {
    const f = w.footholds[t], T = w.towns[t];
    delete w.footholds[t];
    const clan = w.clans[f.clan];
    if (!T || !T.owner || T.owner === f.clan || !clan || clan.out) { emit('foothold_lost', { clan: f.clan, town: t, why: 'it changed hands' }); continue; }
    const near = ownedNear(w, board, f.clan, t).sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b));
    const src = near[0];
    if (!src || T.captain || (w.towns[src].force - 1) < Math.ceil(T.force * K9.footholdHoldAt)) { emit('foothold_lost', { clan: f.clan, town: t, why: 'too thin to hold' }); continue; }
    const move = Math.min(w.towns[src].force - 1, T.force + 2);
    w.towns[src].force -= move;
    const against = T.owner;
    T.owner = f.clan; T.force = move; T.dugIn = false; T.captain = null; T.attackedTick = -1;
    emit('foothold_held', { clan: f.clan, town: t, from: src, n: move, against });
  }
  for (const [t, tr] of Object.entries(w.truces || {})) if (tr.until <= w.tick) delete w.truces[t];
  // captives eat: a clan that cannot feed them loses them (they slip away home)
  for (const c of Object.values(w.chars)) {
    if (c.status !== 'captured') continue;
    const holder = w.clans[c.heldBy];
    if (!holder || holder.out) { freeCaptive(w, c); emit('escaped', { char: c.id, clan: c.clan, why: 'their captors are gone' }); continue; }
    if (ecoActive(holder)) {
      if (holder.res.food >= K9.keepFood) holder.res.food -= K9.keepFood;
      else { freeCaptive(w, c); emit('escaped', { char: c.id, clan: c.clan, why: 'unfed' }); }
    }
  }
  if (hourOf(w) === 18) for (const c of Object.values(w.chars)) if (c.status === 'active' && conf(c) < 70) { c.confidence = Math.min(70, conf(c) + K9.confidenceRecovery); settleState(board.content, c); }
}
