// Fog of war (D15, D81, D173, D176 to D182). A pure function of what the player has learned: no DOM, no storage, and it never writes anything.
// The simulation does not read it: the fog only decides what the screen shows.
//
//   fogMap(board, { srs, played, own, home }) -> Map(townId -> 'known' | 'familiar' | 'rumoured' | 'unknown')
//   forceWord(n)                              -> 'a handful' | 'a band' | 'a host'   (placeholder words, D68)
//
// Known:    the review data says box 1 or better (D182), and every township of your own.
// Familiar: asked but missed lately (box 0), or raised by play (a fight, a scout, a march: never past Familiar, D178), or the starting floor
//           (your home township and its neighbours, D180).
// Rumoured: not yet Known or Familiar, but next to one that is, by a border or along a highway (D177).
// Unknown:  everything else.

export const LEVELS = ['unknown', 'rumoured', 'familiar', 'known'];
export const rank = (l) => LEVELS.indexOf(l);

export function fogMap(board, { srs = {}, played = [], own = [], home = null }) {
  const ids = Object.keys(board.towns);
  const level = new Map();
  const playedSet = new Set(played);
  for (const id of ids) {
    const r = srs[id];
    level.set(id, r && r.b >= 1 ? 'known' : 'unknown');
  }
  for (const id of own) if (level.has(id)) level.set(id, 'known');
  const raise = (id, to) => { if (level.has(id) && rank(to) > rank(level.get(id))) level.set(id, to); };
  for (const id of ids) if ((srs[id] && srs[id].b < 1) || playedSet.has(id)) raise(id, 'familiar');
  if (home && level.has(home)) { raise(home, 'familiar'); for (const n of board.neighbours(home)) raise(n, 'familiar'); }
  // rumours: next to something Known or Familiar by a border, or by a step along one highway segment (the road you know carries news)
  const sure = new Set(ids.filter((id) => rank(level.get(id)) >= rank('familiar')));
  const lane = new Map();
  for (const l of (board.json.lanes || [])) for (const seg of l.segments) for (let i = 0; i + 1 < seg.length; i++) {
    (lane.get(seg[i]) || lane.set(seg[i], []).get(seg[i])).push(seg[i + 1]);
    (lane.get(seg[i + 1]) || lane.set(seg[i + 1], []).get(seg[i + 1])).push(seg[i]);
  }
  for (const id of sure) for (const n of [...board.neighbours(id), ...(lane.get(id) || [])]) if (!sure.has(n)) raise(n, 'rumoured');
  return level;
}

export const FORCE_WORDS = Object.freeze([[1, 3, 'a handful'], [4, 8, 'a band'], [9, Infinity, 'a host']]);
export function forceWord(n, words = FORCE_WORDS) {
  const w = words.find(([lo, hi]) => n >= lo && n <= hi);
  return w ? w[2] : 'nobody';
}
