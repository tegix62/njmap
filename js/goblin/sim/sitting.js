// The sitting model (D214): what a present player does between the world's ticks. Three small encounters, each costing one action.
//   scout   { clan, town, method: 'sneak'|'ask'|'watch' }   learn something about the captain who holds `town`
//   fortify { clan, town }                                   dig in at once, without waiting for a tick
//   taunt   { clan, town }                                   needle a captain you have scouted: the next front there starts a step higher
// Actions refill at major ticks (refill) and attacks and fronts cost one as well (spend). A clan with no `ap` field is unlimited (older worlds, tests).

import { K, K6 } from './constants.js';
import { counterMod, discoverOne, knows, undiscovered } from './chars.js';
import { K8 } from './constants.js';
import { active as ecoActive } from './economy.js';

export const METHODS = ['sneak', 'ask', 'watch'];
const hourOf = (w) => (w.startHour + w.tick) % 24;
export const isNight = (h) => h >= K6.nightFrom || h < K6.nightTo;

export const hasAp = (clan, cost = 1) => clan.ap === undefined || clan.ap >= cost;
export function spend(clan, cost = 1) { if (clan.ap !== undefined) clan.ap -= cost; }
export function refill(w) {
  for (const c of Object.values(w.clans)) if (c.lord === 'human' && !c.out && c.ap !== undefined) c.ap = Math.min(K6.apCap, c.ap + K6.apPerMajor);
}

/** The captain of `town` as a target for a human clan's encounter: must be active, of another clan, and next to one of the player's townships. */
function targetOf(w, board, clanId, town) {
  const T = w.towns[town];
  const c = T && T.captain && w.chars[T.captain];
  if (!c || c.status !== 'active' || T.owner === clanId) return null;
  const near = board.neighbours(town).some((n) => w.towns[n] && w.towns[n].owner === clanId);
  return near ? { T, c } : null;
}

/** How each method stands right now, in words and numbers (the UI shows the words, never the numbers). */
export function scoutMods(w, board, clanId, town, method) {
  const T = w.towns[town], c = w.chars[T.captain];
  const mods = [];
  if (method === 'sneak') {
    if (isNight(hourOf(w))) mods.push({ why: 'night', v: K6.scoutNightBonus });
    const v = counterMod(board.content, c, 'probe');
    if (v) mods.push({ why: 'hidden', v });
  } else if (method === 'ask') {
    if (board.town(town).pop >= K6.scoutBigTownPop) mods.push({ why: 'busy town', v: K6.scoutBigTownBonus });
  } else if (method === 'watch') {
    const water = board.neighbours(town).some((n) => w.towns[n] && w.towns[n].owner === clanId && (board.border(town, n) || {}).river);
    if (water) mods.push({ why: 'across the water', v: K6.scoutRiverBonus });
  }
  return { mods, total: mods.reduce((s, m) => s + m.v, 0) };
}

export function applySitting(w, board, rng, emit, o) {
  const clan = w.clans[o.clan];
  const reject = (reason) => emit('order_rejected', { clan: o.clan, order: o, reason });
  if (!clan || clan.lord !== 'human' || clan.out) return reject('not a live human clan');
  if (!board.content) return reject('no characters in this war');
  clan.lastActive = w.tick; clan.absentSince = null;
  const buildCost = o.type === 'fortify' && ecoActive(clan);   // F2: digging in at once costs Build, not an action
  const cost = o.type === 'scout' ? K6.costScout : o.type === 'taunt' ? K6.costTaunt : K6.costFortify;
  if (!buildCost && !hasAp(clan, cost)) return reject('no actions left: they refill at 09:00, 12:00 and 18:00');
  if (o.type === 'fortify') {
    const T = w.towns[o.town];
    if (!T || T.owner !== o.clan) return reject('not your township');
    if (T.dugIn) return reject('already dug in');
    if (T.force < K.digInMinForce) return reject(`needs at least ${K.digInMinForce} units to dig in`);
    if (buildCost) { if (clan.res.build < K8.fortifyCost) return reject(`digging in at once costs ${K8.fortifyCost} Build: you have ${clan.res.build}`); clan.res.build -= K8.fortifyCost; } else spend(clan, cost);
    T.dugIn = true;
    return emit('fortified', { clan: o.clan, town: o.town });
  }
  const tg = targetOf(w, board, o.clan, o.town);
  if (!tg) return reject('a captain of another clan must hold a township next to yours');
  const { T, c } = tg;
  const dice = [rng.d6(), rng.d6()];
  if (o.type === 'scout') {
    if (!METHODS.includes(o.method)) return reject('unknown method');
    spend(clan, cost);
    const m = scoutMods(w, board, o.clan, o.town, o.method);
    const roll = dice[0] + dice[1] + m.total;
    const learned = [];
    if (roll >= K6.scoutTarget) { const x = discoverOne(c, o.clan); if (x) learned.push(x); }
    if (roll >= K6.scoutGreat) { const x = discoverOne(c, o.clan); if (x) learned.push(x); }
    let lost = false;
    if (roll <= K6.scoutLoseUnit) {
      const from = board.neighbours(o.town).filter((n) => w.towns[n] && w.towns[n].owner === o.clan && w.towns[n].force > 1).sort((a, b) => (w.towns[b].force - w.towns[a].force) || (a < b ? -1 : 1))[0];
      if (from) { w.towns[from].force -= 1; lost = true; }
    }
    return emit('scouted', { clan: o.clan, town: o.town, char: c.id, method: o.method, dice, mods: m.mods, roll, learned, lost, nothingLeft: !learned.length && !undiscovered(c, o.clan).length });
  }
  if (o.type === 'taunt') {
    const known = (c.known[o.clan] || []).length;
    if (!known) return reject('learn something about the captain first (scout)');
    spend(clan, cost);
    const roll = dice[0] + dice[1] + K6.tauntKnownBonus + counterMod(board.content, c, 'pressure');
    const ok = roll >= K6.tauntTarget;
    if (ok) (w.taunts ||= {})[o.town] = { by: o.clan, until: w.tick + K6.tauntWindowTicks };
    else T.dugIn = true;   // a needled captain who is not rattled digs in out of spite
    return emit('taunted', { clan: o.clan, town: o.town, char: c.id, dice, roll, ok });
  }
  return reject('unknown order');
}

/** Called when a front opens: a live taunt moves the start up one step (never past Ahead) and is used up. */
export function takeTaunt(w, clanId, town) {
  const t = w.taunts && w.taunts[town];
  if (!t) return false;
  delete w.taunts[town];
  return t.by === clanId && w.tick <= t.until;
}
