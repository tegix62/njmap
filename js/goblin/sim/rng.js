// Seeded random numbers (mulberry32). The whole simulation is a pure function of the world state (D7), so the generator's state is a plain
// 32-bit integer kept in the world and passed in and out. Nothing here touches Math.random or the clock.
//
//   nextUint(state)  -> { value, state }       pure
//   makeRng(state)   -> { state, next(), int(n), d6() }   a small mutable wrapper for use inside one call; read .state back out when done
//   hashSeed(text)   -> uint32                 turn a seed phrase into a starting state

export function hashSeed(text) {
  let h = 0x811c9dc5;                              // FNV-1a
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function seedState(seed) {
  return typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0);
}

export function nextUint(state) {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: (t ^ (t >>> 14)) >>> 0, state: s };
}

export function makeRng(state) {
  const r = {
    state: state >>> 0,
    next() { const o = nextUint(r.state); r.state = o.state; return o.value / 4294967296; },
    int(n) { return Math.floor(r.next() * n); },          // 0 .. n-1
    d6() { return 1 + Math.floor(r.next() * 6); },        // 1 .. 6
  };
  return r;
}
