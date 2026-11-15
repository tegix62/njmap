// The dwarves (D29, D158 to D162, H50, finish plan F6). A clan that holds the rock towns (townships the app's own list of named mountains and ridges puts a
// mountain in), cannot be conquered, never attacks unprovoked and never betrays an ally.
//   goaded   an AI clan that would attack a rock town is stopped by its garrison and provokes the dwarves: they answer that clan's bordering townships for two days
//   sought   a player can make their way to the dwarves (an action, 2d6): friends for the chapter, sending miners each tick to a bordering township
//   hand     the Director's only help is timing (D158, D159, D162): when a player is Heated or Overwhelmed it steers one rival at a rock town (a "hammering" tell first)
//            and never makes dwarves appear where the rules say there are none
// A rock town is a geometry fact about the map. A mining history is not claimed: that needs a verified fact row (D195).

import { K11 } from './constants.js';

export const DWARF = 'dwarves';
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const isRock = (board, id) => !!(board.regions && board.regions.rock && board.regions.rock[id]);
/** A rock town the dwarves hold: nobody can take it. */
export const untouchable = (w, board, id) => !!w.towns[id] && w.towns[id].owner === DWARF && isRock(board, id);

export function initDwarves(w, board) {
  if (!board.regions || !board.regions.rock) return;
  const homes = new Set(Object.values(w.clans).map((c) => c.home));
  const rock = w.theatre.filter((t) => isRock(board, t) && !homes.has(t)).sort(byId);
  if (!rock.length) return;
  w.clans[DWARF] = { id: DWARF, kind: 'dwarf', lord: 'ai', home: rock[0], shieldUntil: 0, lastActive: 0, absentSince: null, out: false, peakTowns: rock.length };
  for (const t of rock) {
    const T = w.towns[t];
    if (T.captain && w.chars[T.captain]) { delete w.chars[T.captain]; T.captain = null; }
    T.owner = DWARF; T.force = K11.dwarfForce; T.dugIn = true; T.attackedTick = -1;
  }
  for (const c of Object.values(w.clans)) if (c.id !== DWARF) c.peakTowns = Object.values(w.towns).filter((t) => t.owner === c.id).length;
  w.goaded = {}; w.dwarfFriends = {}; w.steer = null; w.lastSteer = {};
}

/** A rival provokes the dwarves by trying for a rock town: no battle, the dwarves answer that clan. */
export function goad(w, byClan, town, emit) {
  (w.goaded ||= {})[byClan] = w.tick + K11.goadTicks;
  emit('dwarves_goaded', { by: byClan, town });
}

/** At each major tick: a goaded dwarf force strikes one bordering township of its provoker. `fight` is the world's own skirmish routine. */
export function dwarfTurn(w, board, emit, fight) {
  for (const by of Object.keys(w.goaded || {}).sort(byId)) {
    if (w.goaded[by] < w.tick) { delete w.goaded[by]; continue; }
    const clan = w.clans[by];
    if (!clan || clan.out || !w.clans[DWARF] || w.clans[DWARF].out) continue;
    let best = null;
    for (const [t, T] of Object.entries(w.towns)) {
      if (T.owner !== DWARF || T.force - K11.dwarfKeep < 2) continue;
      for (const u of board.neighbours(t)) {
        const U = w.towns[u];
        if (!U || U.owner !== by || untouchable(w, board, u)) continue;
        const n = T.force - K11.dwarfKeep, ratio = n / Math.max(1, U.force);
        if (ratio >= K11.strikeRatio && (!best || ratio > best.ratio)) best = { from: t, to: u, n, ratio };
      }
    }
    if (best) fight(w, board, emit, { by: DWARF, ...best });
  }
}

/** Friendly dwarves send miners to the weakest township of yours that borders their rock town. */
export function helpTurn(w, board, emit) {
  for (const [id, f] of Object.entries(w.dwarfFriends || {})) {
    if (!untouchable(w, board, f.town)) continue;
    const mine = board.neighbours(f.town).filter((n) => w.towns[n] && w.towns[n].owner === id).sort((a, b) => (w.towns[a].force - w.towns[b].force) || byId(a, b))[0];
    if (!mine) continue;
    w.towns[mine].force = Math.min((w.rules && w.rules.townForceCap) ?? Infinity, w.towns[mine].force + K11.helpUnits);
    emit('dwarves_help', { clan: id, town: mine, from: f.town, n: K11.helpUnits });
  }
}

/** The order: seek { clan, town } makes your way to the dwarves of an adjacent rock town. */
export function applySeek(w, board, rng, emit, o, hasAp, spend) {
  const clan = w.clans[o.clan];
  const reject = (reason) => emit('order_rejected', { clan: o.clan, order: o, reason });
  if (!clan || clan.lord !== 'human' || clan.out) return reject('not a live human clan');
  clan.lastActive = w.tick; clan.absentSince = null;
  if (!untouchable(w, board, o.town)) return reject('that is not a township the dwarves hold');
  if (!board.neighbours(o.town).some((n) => w.towns[n] && w.towns[n].owner === o.clan)) return reject('it must border one of yours');
  if (w.dwarfFriends && w.dwarfFriends[o.clan]) return reject('the dwarves are already your friends');
  const tried = clan.seekAt;
  if (tried !== undefined && tried !== null && w.tick - tried < K11.seekCooldown) return reject('they turned you away a little while ago');
  if (!hasAp(clan, 1)) return reject('no actions left: they refill at 09:00, 12:00 and 18:00');
  spend(clan, 1);
  const dice = [rng.d6(), rng.d6()], roll = dice[0] + dice[1];
  const ok = roll >= K11.seekTarget;
  if (ok) (w.dwarfFriends ||= {})[o.clan] = { town: o.town, since: w.tick }; else clan.seekAt = w.tick;
  emit('dwarves_sought', { clan: o.clan, town: o.town, dice, roll, ok });
}

/** The Director's hidden hand, in timing only (D158, D159, D162). Called at a major tick with the Director's own functions. It names no cause: the world just
 *  shows hammering from a rock town, and one tick later a rival provoking it. */
export function steerTurn(w, board, emit, dir) {
  if (!w.clans[DWARF] || w.steer) return;
  for (const id of Object.keys(w.clans).sort(byId)) {
    const c = w.clans[id];
    if (c.lord !== 'human' || c.out || c.absentSince !== null) continue;
    const word = dir.wordOf(w, id);
    if (word !== 'Heated' && word !== 'Overwhelmed') continue;
    if (!dir.peakFree(w, id)) continue;
    const last = (w.lastSteer || {})[id];
    if (last !== undefined && w.tick - last < K11.steerGap) continue;
    let best = null;
    for (const [t, T] of Object.entries(w.towns)) {
      if (T.owner !== DWARF || !isRock(board, t)) continue;
      for (const n of board.neighbours(t)) {
        const U = w.towns[n];
        if (!U || !U.owner || U.owner === id || U.owner === DWARF || w.clans[U.owner].lord !== 'ai') continue;
        const units = Object.values(w.towns).filter((x) => x.owner === U.owner).reduce((a, x) => a + x.force, 0);
        if (!best || units > best.units || (units === best.units && t < best.town)) best = { clan: U.owner, town: t, units };
      }
    }
    if (!best) continue;
    w.steer = { clan: best.clan, town: best.town, at: w.tick, for: id };
    (w.lastSteer ||= {})[id] = w.tick;
    dir.spendPeak(w, id);
    emit('hammering', { town: best.town });   // the tell: hammering from the rock; it names no clan and no cause
    return;
  }
}
/** At the next major tick the rival that was steered provokes the dwarves. */
export function resolveSteer(w, board, emit) {
  if (!w.steer || w.tick <= w.steer.at) return;
  const s = w.steer; w.steer = null;
  if (w.clans[s.clan] && !w.clans[s.clan].out && untouchable(w, board, s.town)) goad(w, s.clan, s.town, emit);
}
