// Read access to the static board (data/goblin-board.json, built by tools/build_goblin_board.py). The simulation never reads files:
// it is given the parsed JSON and wraps it here. Nothing in this file changes the board.

export function makeBoard(json) {
  const towns = json.towns;
  const bmap = new Map();
  for (const [k, v] of Object.entries(json.borders)) {
    const [a, b] = k.split('~');
    bmap.set(a + '~' + b, v); bmap.set(b + '~' + a, v);
  }
  const byPopThenId = (a, b) => (towns[b].pop - towns[a].pop) || (a < b ? -1 : a > b ? 1 : 0);

  const api = {
    json, towns,
    has: (id) => id in towns,
    town: (id) => towns[id],
    neighbours: (id) => towns[id].nb,
    /** The facts about a shared border ({ mi, river, ridge, highways }) or null if the two do not touch. */
    border: (a, b) => bmap.get(a + '~' + b) || null,
    /** Border steps from `from` to every township reachable (optionally only through `allowed`, a Set of ids). */
    distances(from, allowed = null) {
      const dist = new Map([[from, 0]]);
      const q = [from];
      for (let i = 0; i < q.length; i++) {
        for (const n of towns[q[i]].nb) {
          if (dist.has(n) || (allowed && !allowed.has(n))) continue;
          dist.set(n, dist.get(q[i]) + 1); q.push(n);
        }
      }
      return dist;
    },
    /** The playable set: the home township plus every township within `steps` border steps, widened until it holds at least `min`,
     *  and never more than `max` (D183). Returned in order of distance from home. */
    theatre(home, steps, { min = 12, max = 60 } = {}) {
      const seen = new Set([home]);
      const out = [home];
      let layer = [home];
      for (let d = 1; layer.length; d++) {
        const next = [];
        for (const t of layer) for (const n of towns[t].nb) if (!seen.has(n)) { seen.add(n); next.push(n); }
        if (!next.length) break;
        if (d > steps && out.length >= min) break;
        next.sort(byPopThenId);
        if (out.length + next.length > max) { out.push(...next.slice(0, max - out.length)); break; }
        out.push(...next);
        layer = next;
      }
      return out;
    },
  };
  return api;
}
