// A quiz charge counts as a real review (D179): it writes the same spaced-review data the Practice mode writes, in the same shape.
// (store 'srs': { townKey: { b: box 0-5, due } } and 'stats': { townKey: [seen, right] }; a right answer moves a town up a box, a miss sends it to box 0.)
const DAYS = [0, 1, 3, 7, 16, 35];
const DAY = 864e5;

export function recordReview(store, key, ok, now = Date.now()) {
  const st = store.get('stats', {});
  const [seen = 0, right = 0] = st[key] || [];
  st[key] = [seen + 1, right + (ok ? 1 : 0)];
  store.set('stats', st);
  const s = store.get('srs', {});
  const cur = s[key] || { b: 0, due: 0 };
  if (ok) { const b = Math.min(cur.b + 1, DAYS.length - 1); s[key] = { b, due: now + DAYS[b] * DAY, f: 'goblin' }; }
  else s[key] = { b: 0, due: now + 10 * 60e3, f: 'goblin' };
  store.set('srs', s);
}
