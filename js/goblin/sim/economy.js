// Food, Build and Coin (D110 to D117, docs/goblins/14-economy.md). A clan has an economy only if it has `res`: older worlds and unit tests without it are
// unaffected. Nothing here uses randomness or the clock.
//   Food   : every township farms 1 per major tick (a Food town 2). Units eat 1 Food per 8 a tick, recruits cost 1 each, marches cost 1 per 4 sent.
//            Short for a day and the unfed units start to drift home (warned at the first short tick).
//   Build  : a Build town yields 1 a day (at 12:00). Spent digging in (1 a township at a tick, 2 to do it at once) and on a goblin bridge (4, three ticks).
//   Coin   : a Coin town yields 1 a day. Spent on a hired band (6 Coin, 4 units, once a day).

import { K8 } from './constants.js';
import { splitIncome, spawnConvoy } from './convoys.js';

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const active = (clan) => !!clan && clan.res !== undefined;
export const dayOf = (w) => Math.floor((w.startHour + w.tick) / 24);

/** Trade by population rank within the theatre (P8, a placeholder rule until real trades are verified in F5): the biggest third Coin, the middle Build, the smallest Food. */
export function assignTrade(w, board) {
  const ranked = Object.keys(w.towns).sort((a, b) => (board.town(b).pop - board.town(a).pop) || byId(a, b));
  const third = Math.ceil(ranked.length / 3);
  ranked.forEach((t, r) => { w.towns[t].trade = r < third ? 'coin' : r < 2 * third ? 'build' : 'food'; });
}
export function initEconomy(w, board) {
  assignTrade(w, board);
  for (const c of Object.values(w.clans)) { c.res = { ...K8.start }; c.short = 0; c.hireDay = -1; }
  w.bridges = {}; w.bridging = [];
}

export const income = (w, clanId) => {
  let food = 0, build = 0, coin = 0;
  for (const T of Object.values(w.towns)) {
    if (T.owner !== clanId) continue;
    if (T.freshUntil && T.freshUntil > w.tick) continue;   // a township just taken yields nothing while it settles (K8.unrestTicks)
    food += K8.foodPerTown + (T.trade === 'food' ? K8.foodTownBonus : 0);
    if (T.trade === 'build') build += K8.buildPerTown;
    if (T.trade === 'coin') coin += K8.coinPerTown;
  }
  return { food, build, coin };
};
export const unitsOf = (w, clanId) => Object.values(w.towns).filter((t) => t.owner === clanId).reduce((n, t) => n + t.force, 0);
/** Mouths to feed: every unit, and a second time for each unit packed into a township beyond K8.crowd. */
export const mouths = (w, clanId) => Object.values(w.towns).filter((t) => t.owner === clanId).reduce((n, t) => n + t.force + Math.max(0, t.force - K8.crowd), 0);
export const upkeep = (w, clanId) => Math.ceil(mouths(w, clanId) / K8.unitsPerFood);
export const marchCost = (n) => Math.max(1, Math.ceil(n / K8.marchPerUnits));
export const canMarch = (clan, n) => !active(clan) || clan.res.food >= marchCost(n);
export const payMarch = (clan, n) => { if (active(clan)) clan.res.food -= marchCost(n); };
/** The most units a clan can send with the Food it has. */
export const maxMarch = (clan, force) => (active(clan) ? Math.min(force - 1, clan.res.food * K8.marchPerUnits) : force - 1);

/** Once per major tick, before recruits: income, upkeep, and what happens to a clan that cannot feed its units. */
export function economyTick(w, board, emit) {
  for (const c of Object.values(w.clans)) {
    if (!active(c) || c.out) continue;
    const inc = income(w, c.id);
    const noon = (w.startHour + w.tick) % 24 === 12;   // Build and Coin come once a day
    c.res.food = Math.min(K8.resCap, c.res.food + inc.food);
    if (noon) {   // Build and Coin: what far townships make travels as a convoy, the rest arrives at once (F4)
      const sp = splitIncome(w, board, c.id, inc);
      c.res.build = Math.min(K8.resCap, c.res.build + sp.near.build); c.res.coin = Math.min(K8.resCap, c.res.coin + sp.near.coin);
      if ((sp.far.build + sp.far.coin) > 0 && !spawnConvoy(w, board, emit, c.id, sp.farFrom, sp.far)) { c.res.build = Math.min(K8.resCap, c.res.build + sp.far.build); c.res.coin = Math.min(K8.resCap, c.res.coin + sp.far.coin); }
    }
    const need = upkeep(w, c.id);
    if (c.res.food >= need) { c.res.food -= need; c.short = 0; continue; }
    const fed = c.res.food * K8.unitsPerFood, units = mouths(w, c.id), unfed = units - fed;
    c.res.food = 0; c.short++;
    if (c.short === 1) emit('hunger', { clan: c.id, unfed, warning: true });   // the warning: a day to put it right
    if (c.short > K8.graceMajors) {
      let drift = Math.ceil(unfed / K8.desertDivisor);
      const from = [];
      while (drift > 0) {
        const t = Object.keys(w.towns).filter((x) => w.towns[x].owner === c.id && w.towns[x].force > 1).sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b))[0];
        if (!t) break;
        const take = Math.min(drift, w.towns[t].force - 1, Math.max(1, Math.ceil(w.towns[t].force / 4)));
        w.towns[t].force -= take; drift -= take; from.push(t);
      }
      emit('deserted', { clan: c.id, n: Math.ceil(unfed / K8.desertDivisor) - drift, from: [...new Set(from)] });
    }
  }
}

// ---------------------------------------------------------------- bridges (D109)
export const bridgeKey = (a, b) => (a < b ? a + '~' + b : b + '~' + a);
export const hasBridge = (w, clanId, a, b) => !!(w.bridges && (w.bridges[bridgeKey(a, b)] || []).includes(clanId));
export function completeBridges(w, emit) {
  if (!w.bridging) return;
  for (const br of w.bridging) br.majors--;
  for (const br of w.bridging.filter((x) => x.majors <= 0)) {
    const k = bridgeKey(br.a, br.b);
    (w.bridges[k] ||= []).push(br.clan);
    emit('bridge_built', { clan: br.clan, a: br.a, b: br.b });
  }
  w.bridging = w.bridging.filter((x) => x.majors > 0);
}

/** Human orders that spend Build or Coin: hire { clan, town } and bridge { clan, from, to }. Rejection reasons are in words. */
export function applyEconomyOrder(w, board, emit, o) {
  const clan = w.clans[o.clan];
  const reject = (reason) => emit('order_rejected', { clan: o.clan, order: o, reason });
  if (!clan || clan.lord !== 'human' || clan.out) return reject('not a live human clan');
  if (!active(clan)) return reject('no economy in this war');
  clan.lastActive = w.tick; clan.absentSince = null;
  if (o.type === 'hire') {
    const T = w.towns[o.town];
    if (!T || T.owner !== o.clan) return reject('not your township');
    if (clan.hireDay === dayOf(w)) return reject('you have already hired a band today');
    if (clan.res.coin < K8.hireCost) return reject(`a band costs ${K8.hireCost} Coin: you have ${clan.res.coin}`);
    clan.res.coin -= K8.hireCost; clan.hireDay = dayOf(w); T.force = Math.min((w.rules && w.rules.townForceCap) ?? Infinity, T.force + K8.hireUnits);
    return emit('hired', { clan: o.clan, town: o.town, n: K8.hireUnits });
  }
  if (o.type === 'bridge') {
    const F = w.towns[o.from], T = w.towns[o.to], b = board.border(o.from, o.to);
    if (!F || F.owner !== o.clan || !T) return reject('start from one of your townships');
    if (!b || !b.river) return reject('a bridge crosses a river border');
    if (hasBridge(w, o.clan, o.from, o.to)) return reject('you already have a bridge there');
    if (w.bridging.some((x) => x.clan === o.clan && bridgeKey(x.a, x.b) === bridgeKey(o.from, o.to))) return reject('that bridge is already being built');
    if (clan.res.build < K8.bridgeCost) return reject(`a bridge costs ${K8.bridgeCost} Build: you have ${clan.res.build}`);
    clan.res.build -= K8.bridgeCost; w.bridging.push({ clan: o.clan, a: o.from, b: o.to, majors: K8.bridgeMajors });
    return emit('bridge_started', { clan: o.clan, a: o.from, b: o.to, majors: K8.bridgeMajors });
  }
  return reject('unknown order');
}
