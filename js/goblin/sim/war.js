// The goal for a war (D215, proposed): hold more than half of the theatre for three days in a row and the war is won; if a rival does it, it is lost.
// Small milestones along the way give the days in between something to aim at. All checked at major ticks, from the state alone.
//
//   initWar(w, board)         -> sets w.war
//   warTurn(w, board, emit)   -> advances the hold clocks, emits milestone / war_over; returns true when the war just ended
//   progress(w, clanId)       -> { held, need, total, hoursLeft|null, leading }   for the screen (counts, never percentages)

import { K7 } from './constants.js';

export const MILESTONES = ['first_township', 'first_captain', 'third', 'county', 'rival_home'];

export function initWar(w, board) {
  const humans = Object.values(w.clans).filter((c) => c.lord === 'human').map((c) => c.id);
  w.war = { hold: {}, done: {}, over: null, start: Object.fromEntries(humans.map((h) => [h, Object.keys(w.towns).filter((t) => w.towns[t].owner === h)])) };
}

const countOf = (w, id) => Object.values(w.towns).filter((t) => t.owner === id).length;

export function progress(w, clanId) {
  const total = Object.keys(w.towns).length;
  const need = Math.floor(total * K7.warShare) + 1;
  const held = countOf(w, clanId);
  const since = w.war && w.war.hold[clanId];
  return { held, need, total, hoursLeft: since != null ? Math.max(0, K7.warHoldTicks - (w.tick - since)) : null };
}

function milestones(w, board, emit, id) {
  const m = w.war.done[id] || (w.war.done[id] = {});
  const mine = Object.keys(w.towns).filter((t) => w.towns[t].owner === id);
  const give = (key, data = {}) => { if (!m[key]) { m[key] = w.tick; emit('milestone', { clan: id, key, ...data }); } };
  const start = new Set((w.war.start[id] || []));
  const gained = mine.find((t) => !start.has(t));
  if (gained) give('first_township', { town: gained });
  if (Object.values(w.chars).some((c) => c.heldBy === id && c.status === 'captured')) give('first_captain');
  if (mine.length / Object.keys(w.towns).length >= K7.thirdShare) give('third');
  const byCounty = {};
  for (const t of Object.keys(w.towns)) { const c = board.town(t).county; (byCounty[c] ||= []).push(t); }
  for (const [county, ts] of Object.entries(byCounty)) if (ts.length >= K7.countyMin && ts.every((t) => w.towns[t].owner === id)) give('county', { county });
  for (const o of Object.values(w.clans)) if (o.id !== id && w.towns[o.home] && w.towns[o.home].owner === id) give('rival_home', { town: o.home, of: o.id });
}

export function warTurn(w, board, emit) {
  if (!w.war || w.war.over) return false;
  for (const c of Object.values(w.clans)) if (c.lord === 'human' && !c.out) milestones(w, board, emit, c.id);
  const total = Object.keys(w.towns).length, need = Math.floor(total * K7.warShare) + 1;
  for (const c of Object.values(w.clans).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (c.out) { delete w.war.hold[c.id]; continue; }
    if (countOf(w, c.id) >= need) {
      if (w.war.hold[c.id] == null) { w.war.hold[c.id] = w.tick; emit('war_hold', { clan: c.id, started: true }); }
      if (w.tick - w.war.hold[c.id] >= K7.warHoldTicks) { w.war.over = { winner: c.id, tick: w.tick, how: 'held' }; emit('war_over', { winner: c.id, how: 'held', human: c.lord === 'human' }); return true; }
    } else if (w.war.hold[c.id] != null) { delete w.war.hold[c.id]; emit('war_hold', { clan: c.id, started: false }); }
  }
  // every human clan wiped out: the war is lost to whoever holds the most
  const humans = Object.values(w.clans).filter((c) => c.lord === 'human');
  if (humans.length && humans.every((c) => c.out)) {
    const lead = Object.values(w.clans).filter((c) => !c.out).sort((a, b) => countOf(w, b.id) - countOf(w, a.id))[0];
    w.war.over = { winner: lead ? lead.id : null, tick: w.tick, how: 'wiped out' };
    emit('war_over', { winner: lead ? lead.id : null, how: 'wiped out', human: false });
    return true;
  }
  return false;
}
