// Chapters (D175, finish plan F5): a war on one region is a chapter. Winning it keeps your clan and opens the next region with new rivals; losing it repeats the
// region (no hard reset). The theatre of a chapter is the usual 3 border steps around a home township (D183); the next home is the most populous township of
// the nearest region you have not yet played.
//   nextHome(board, prev)            -> township id
//   rivalsFor(seed, count)           -> clan configs for the AI clans of a chapter, drawn from the pool of kinds
//   carryOf(prev, board)             -> what travels from one chapter to the next
//   nextChapterCfg(board, prev, cfg) -> a cfg for newWorld

import { makeRng, seedState } from './rng.js';
import { kitOf } from './regions.js';
import { K3 } from './constants.js';

export const RIVAL_KINDS = Object.freeze([['rats', 'rat'], ['toads', 'toad'], ['gnomes', 'gnome']]);
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function rivalsFor(seed, count = 2) {
  const rng = makeRng(seedState('rivals:' + seed));
  const pool = RIVAL_KINDS.slice();
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out.sort((a, b) => byId(a[0], b[0])).map(([id, kind]) => ({ id, kind, lord: 'ai' }));
}

export function nextHome(board, prev) {
  const played = new Set([...(prev.campaign ? prev.campaign.kits : []), kitOf(board, prev.clans.goblins ? prev.clans.goblins.home : Object.values(prev.clans)[0].home)].filter(Boolean));
  const inTheatre = new Set(prev.theatre);
  // distance from the whole previous theatre, over the whole board
  const dist = new Map(), q = [];
  for (const t of prev.theatre) { dist.set(t, 0); q.push(t); }
  for (let i = 0; i < q.length; i++) for (const n of board.neighbours(q[i])) if (!dist.has(n)) { dist.set(n, dist.get(q[i]) + 1); q.push(n); }
  let best = null;
  for (const [t, d] of dist) {
    const k = kitOf(board, t);
    if (inTheatre.has(t) || !k || played.has(k)) continue;
    if (!best || d < best.d || (d === best.d && (board.town(t).pop > board.town(best.t).pop || (board.town(t).pop === board.town(best.t).pop && t < best.t)))) best = { t, d };
  }
  if (best) return best.t;
  // every region played: begin again from the most populous township outside the last theatre
  return Object.keys(board.towns).filter((t) => !inTheatre.has(t)).sort((a, b) => (board.town(b).pop - board.town(a).pop) || byId(a, b))[0];
}

/** What travels with the clan: its stockpile, its Gentle setting and its living captains (not prisoners), and the campaign's record. */
export function carryOf(prev, board, humanId = 'goblins') {
  const h = prev.clans[humanId];
  return {
    res: h.res ? { ...h.res } : null, gentle: !!h.gentle,
    chars: Object.values(prev.chars).filter((c) => c.clan === humanId && c.status === 'active').sort((a, b) => (b.tier - a.tier) || (b.wins || 0) - (a.wins || 0) || byId(a.id, b.id)).map((c) => structuredClone(c)),
    campaign: { chapter: (prev.campaign ? prev.campaign.chapter : 1) + 1, kits: [...new Set([...(prev.campaign ? prev.campaign.kits : []), kitOf(board, h.home)].filter(Boolean))] },
  };
}

export function nextChapterCfg(board, prev, cfg = {}) {
  const chapter = (prev.campaign ? prev.campaign.chapter : 1) + 1;
  const seed = cfg.seed ?? `${prev.seed}-ch${chapter}`;
  return { seed, home: nextHome(board, prev), clans: [{ id: 'goblins', kind: 'goblin', lord: 'human' }, ...rivalsFor(seed)], startMs: prev.startMs !== undefined ? prev.startMs + prev.tick * 3600000 : undefined,
    startHour: (prev.startHour + prev.tick) % 24, carry: carryOf(prev, board), guidedStart: !!cfg.guidedStart, rules: cfg.rules, campaign: carryOf(prev, board).campaign };
}

/** Seat the carried captains in the human clan's strongest townships of the new theatre. Called by newWorld. */
export function seatCarried(w, carry, humanId = 'goblins') {
  for (const c of Object.values(w.chars).filter((x) => x.clan === humanId)) { if (c.at && w.towns[c.at]) w.towns[c.at].captain = null; delete w.chars[c.id]; }
  const mine = Object.keys(w.towns).filter((t) => w.towns[t].owner === humanId).sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b));
  const cap = 1 + Math.floor(mine.length / 4);
  let i = 0;
  for (const old of carry.chars) {
    if (i >= mine.length || i >= Math.max(cap, K3.startCaptainsMin)) break;
    const id = 'c' + w.nextId++;
    w.chars[id] = { ...old, id, at: mine[i], homeTown: mine[i], status: 'active', heldBy: null, known: {}, grudges: [] };
    w.towns[mine[i]].captain = id; i++;
  }
  return i;
}
