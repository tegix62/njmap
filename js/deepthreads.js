// Deep Jersey: what has been read, which threads to pick up, which hooks to offer, and a check that the stories hold together.
// Pure functions (no map, no DOM), so they run in Node for tools/checks/deep-stories.cjs.

/** The subjects a story can belong to: a colour for its tag and its map marker. */
export const DOMAINS = {
  earth: { name: 'Earth', color: '#9a5b3c' }, ice: { name: 'Ice', color: '#3d7fbf' }, sea: { name: 'Sea', color: '#1f6f8b' },
  sky: { name: 'Sky', color: '#5a4fa2' }, weather: { name: 'Weather', color: '#5f7480' }, life: { name: 'Living things', color: '#3f7f3a' },
  people: { name: 'People', color: '#a2652a' }, gone: { name: 'Gone', color: '#7a6a5a' }, industry: { name: 'Industry', color: '#5b5f66' },
};
const BEATS = ['big', 'thread', 'here'];
const KEY = 'deep.read';

/** Stories read so far, oldest first. Storage that is blocked or broken reads as nothing read. */
export function readIds(store) { try { const v = store.get(KEY, []); return Array.isArray(v) ? v : []; } catch { return []; } }
/** Record a story as read (once). Never throws. */
export function markRead(store, id) { try { const r = readIds(store); if (!r.includes(id)) store.set(KEY, [...r, id]); } catch { /* storage blocked: reading still works */ } }

/** Unread stories linked from the ones already read, following the order they were read in. */
export function pickUp(stories, read, max = 3) {
  const by = Object.fromEntries(stories.map((s) => [s.id, s])), done = new Set(read), out = [];
  for (const id of read) for (const t of by[id]?.threads || []) if (by[t.to] && !done.has(t.to) && !out.includes(t.to)) out.push(t.to);
  return out.slice(0, max);
}

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** Stories to start from: unread first, in an order that changes from day to day; read ones fill in when everything is read. */
export function hooks(stories, read, n = 4, day = Math.floor(Date.now() / 864e5)) {
  const done = new Set(read), order = (a) => a.map((s) => [hash(s.id + day), s.id]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
  return [...order(stories.filter((s) => !done.has(s.id))), ...order(stories.filter((s) => done.has(s.id)))].slice(0, n);
}

/** Everything wrong with the stories, as plain sentences; empty when they hold together. */
export function checkStories(stories, refs) {
  const ids = new Set(stories.map((s) => s.id)), out = [];
  for (const s of stories) {
    const at = `Story "${s.id}"`;
    for (const f of ['title', 'hook', 'when']) if (!s[f]) out.push(`${at} has no ${f}.`);
    if (!DOMAINS[s.domain]) out.push(`${at} has an unknown domain "${s.domain}".`);
    const b = s.beats || {};
    if (Object.keys(b).length !== 3 || !BEATS.every((k) => b[k])) out.push(`${at} needs three beats: big, thread, here.`);
    for (const k of BEATS) if (b[k] && !(Array.isArray(b[k].text) && b[k].text.length && b[k].scene)) out.push(`${at}, beat ${k}, needs text and a scene.`);
    if (b.here && !(Array.isArray(b.here.cam) && b.here.cam.length >= 3)) out.push(`${at}: the here beat needs a camera point (it puts the story on the map).`);
    const th = s.threads || [];
    if (th.length < 2 || th.length > 3) out.push(`${at} has ${th.length} threads; it needs 2 or 3.`);
    for (const t of th) { if (!ids.has(t.to)) out.push(`${at} has a thread to "${t.to}", which does not exist.`); if (!t.why) out.push(`${at}: the thread to "${t.to}" has no why.`); if (t.to === s.id) out.push(`${at} threads to itself.`); }
    if (!(s.src || []).length) out.push(`${at} lists no sources.`);
    for (const k of s.src || []) if (!refs.src.has(k)) out.push(`${at} cites an unknown source "${k}".`);
    for (const p of s.places || []) if (!refs.places.has(p)) out.push(`${at} lands on an unknown place "${p}".`);
    for (const x of s.explain || []) if (!refs.explain.has(x)) out.push(`${at} uses an unknown explainer "${x}".`);
  }
  if (ids.size !== stories.length) out.push('Two stories share an id.');
  return out;
}
