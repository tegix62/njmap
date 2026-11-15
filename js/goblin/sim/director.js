// The Director (docs/goblins/04-systems-spec.md section 9): it never rolls dice. It reads what has happened to each present human player,
// names the pressure (Calm, Steady, Heated, Overwhelmed), and decides which hostile AI actions against that player are allowed this tick.
// Only the word is ever shown; the score stays inside.
//
//   observe(w, events)                  update each player's logs from the events a tick produced
//   wordOf(w, clanId)                   -> 'Calm' | 'Steady' | 'Heated' | 'Overwhelmed'
//   allowsHostile(w, clanId)            may an AI action (a raid) be started against this player now? (does not spend the budget)
//   spend(w, clanId)                    record that one was started
//   endOfDay(w) / startOfDay            Calm streak bookkeeping at the 18:00 tick
//   extraDue(w, clanId)                 true when two Calm days earn one extra hostile action
//   emptyDay(w, board, clanId)          -> { enemy, player, move: n } or null: how to leave a present player one thing to decide

import { K, K5 } from './constants.js';
import { openFronts } from './front.js';

const hourOf = (w) => (w.startHour + w.tick) % 24;
export const dayOf = (w) => Math.floor((w.startHour + w.tick) / 24);
const isHuman = (w, id) => w.clans[id] && w.clans[id].lord === 'human';
const present = (w, id) => isHuman(w, id) && !w.clans[id].out && w.clans[id].absentSince === null;

export function dstate(w, id) {
  return (w.director[id] ||= { unitsLost: [], townsLost: [], lastHostile: null, calmStreak: 0, day: -1, peak: 0, minor: 0, extraDay: -1, nudgeDay: -1, word: 'Calm' });
}

export function observe(w, events) {
  for (const e of events) {
    if (e.type === 'raid_declared' && isHuman(w, w.towns[e.to] && w.towns[e.to].owner)) dstate(w, w.towns[e.to].owner).lastHostile = e.tick;
    if (e.type === 'skirmish_result' || e.type === 'raid_landed') {
      const lost = e.lost || { attackers: 0, defenders: 0 };
      if (isHuman(w, e.by) && lost.attackers) dstate(w, e.by).unitsLost.push({ tick: e.tick, n: lost.attackers });
      if (isHuman(w, e.against)) {
        const d = dstate(w, e.against);
        if (lost.defenders) d.unitsLost.push({ tick: e.tick, n: lost.defenders });
        if (e.won) d.townsLost.push(e.tick);
        if (e.type === 'raid_landed') d.lastHostile = e.tick;
      }
    }
  }
}

export function score(w, id) {
  const d = dstate(w, id);
  const raids = w.raids.filter((r) => w.towns[r.target] && w.towns[r.target].owner === id).length;
  const lost = d.unitsLost.filter((x) => w.tick - x.tick < K5.unitsWindow).reduce((s, x) => s + x.n, 0);
  const towns = d.townsLost.filter((t) => w.tick - t < K5.townsWindow).length;
  const quiet = d.lastHostile === null ? K5.quietMax : Math.min(K5.quietMax, (w.tick - d.lastHostile) / K5.quietPerTicks);
  return K5.perFront * openFronts(w, id).length + K5.perRaid * raids + (lost / 5) * K5.perFiveUnitsLost + K5.perTownLost * towns - quiet;
}
export function wordOf(w, id) {
  const s = score(w, id);
  return s < K5.wCalmBelow ? 'Calm' : s < K5.wSteadyBelow ? 'Steady' : s < K5.wHeatedBelow ? 'Heated' : 'Overwhelmed';
}

function rollDay(w, id) {
  const d = dstate(w, id), day = dayOf(w);
  if (d.day !== day) { d.day = day; d.peak = 0; d.minor = 0; }
  return d;
}

/** The rhythm: 09:00 allows a minor event, 12:00 the day's peak, 18:00 nothing hostile. Heated or Overwhelmed allows nothing. Budget: one peak and two minor a day. */
export function allowsHostile(w, id) {
  if (!present(w, id)) return true;   // an absent player is defended by other rules (D205); the Director only manages present players
  const d = rollDay(w, id), h = hourOf(w), word = wordOf(w, id);
  if (word === 'Heated' || word === 'Overwhelmed') return false;
  if (h === K5.hourRelax) return false;
  if (h === K5.hourPeak) return d.peak < K5.peakPerDay;
  if (h === K5.hourMinor) return d.minor < K5.minorPerDay;
  return false;
}
export function spend(w, id) {
  if (!present(w, id)) return;
  const d = rollDay(w, id), h = hourOf(w);
  if (h === K5.hourPeak) d.peak++; else d.minor++;
}

/** Call at every major tick after the AI has acted. At 18:00 the day ends: a Calm word extends the streak, anything else resets it. */
export function closeDay(w, id) {
  const d = dstate(w, id);
  d.word = wordOf(w, id);
  if (hourOf(w) === K5.hourRelax) d.calmStreak = d.word === 'Calm' ? d.calmStreak + 1 : 0;
  return d.word;
}

/** True at the peak slot when two consecutive Calm days have earned one extra hostile action and today's peak is still free. */
export function extraDue(w, id) {
  if (!present(w, id)) return false;
  const d = rollDay(w, id);
  return hourOf(w) === K5.hourPeak && d.calmStreak >= K5.calmDaysForExtra && d.extraDay !== dayOf(w) && d.peak < K5.peakPerDay && wordOf(w, id) === 'Calm';
}
export function spendExtra(w, id) { const d = rollDay(w, id); d.extraDay = dayOf(w); d.calmStreak = 0; d.peak++; }

/** The empty-day rule (D166): a present player with no open front, no raid against them and no bordering enemy at 2 to 1 or worse gets one chance:
 *  the weakest-looking enemy garrison on their border has its excess moved to another township of the same clan. Returns the plan, or null when none is needed or possible. */
export function emptyDay(w, board, id) {
  if (!present(w, id)) return null;
  if (openFronts(w, id).length) return null;
  if (w.raids.some((r) => w.towns[r.target] && w.towns[r.target].owner === id)) return null;
  const pinned = new Set(openFronts(w).map((f) => f.target));
  const mine = Object.keys(w.towns).filter((t) => w.towns[t].owner === id).sort();
  let best = null, any = false;
  for (const p of mine) {
    const P = w.towns[p];
    const commit = P.force - 1;
    for (const e of board.neighbours(p)) {
      const E = w.towns[e];
      if (!E || !E.owner || E.owner === id) continue;
      any = true;
      if (commit >= 2 && commit / Math.max(1, E.force) >= K5.emptyDayRatio) return null;   // a chance already exists
      if (commit < 2 || pinned.has(e)) continue;
      const keep = Math.max(1, Math.floor(commit / K5.emptyDayRatio));
      const excess = E.force - keep;
      if (excess < 1) continue;
      const to = Object.keys(w.towns).filter((t) => w.towns[t].owner === E.owner && t !== e && !pinned.has(t) && !board.neighbours(t).some((x) => w.towns[x] && w.towns[x].owner === id)).sort((a, b) => (w.towns[a].force - w.towns[b].force) || (a < b ? -1 : 1))[0];
      if (!to) continue;
      if (!best || excess < best.move) best = { enemy: e, player: p, to, move: excess, keep };
    }
  }
  return any ? best : null;
}
