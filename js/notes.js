// Your own notes on towns and roads ("take 23 instead of 287 at rush hour").
// Stored on this device only; Settings can export/import them as a file.
import { store } from './store.js';

const KEY = 'notes';
const load = () => store.get(KEY, { town: {}, road: {} });

/** Roads used to be labeled "US 46" / "Rt 23" / "US 1/9"; now "Route 46" etc. */
export const newRoadKey = (k) =>
  k.replace(/^US (\d+\w?)\/(\d+\w?)$/, 'Route $1&$2').replace(/^(?:US|Rt|NY) (\d+\w?)$/, 'Route $1');
export function migrateRoadKeys() {
  if (store.get('roadKeysV2', false)) return;
  const d = load();
  const road = {};
  for (const [k, v] of Object.entries(d.road || {})) road[newRoadKey(k)] = [...(road[newRoadKey(k)] || []), ...v];
  d.road = road;
  store.set(KEY, d);
  const spoken = store.get('spokenRoads', null);
  if (spoken) store.set('spokenRoads', Object.fromEntries(Object.entries(spoken).map(([k, v]) => [newRoadKey(k), v])));
  store.set('roadKeysV2', true);
}

export const notes = {
  /** kind: 'town' (key = municipality key) or 'road' (key = road label) */
  list(kind, key) {
    return (load()[kind] || {})[key] || [];
  },
  add(kind, key, text) {
    const d = load();
    d[kind] = d[kind] || {};
    (d[kind][key] = d[kind][key] || []).push({ text: text.trim(), t: Date.now() });
    store.set(KEY, d);
  },
  remove(kind, key, t) {
    const d = load();
    const arr = ((d[kind] || {})[key] || []).filter((n) => n.t !== t);
    if (arr.length) d[kind][key] = arr;
    else if (d[kind]) delete d[kind][key];
    store.set(KEY, d);
  },
  count() {
    const d = load();
    return ['town', 'road'].reduce((n, k) => n + Object.values(d[k] || {}).reduce((a, v) => a + v.length, 0), 0);
  },
  exportJSON() {
    return JSON.stringify({ app: 'nj-townfinder', version: 1, notes: load() }, null, 2);
  },
  /** Merges an exported file into the current notes; returns how many were added. */
  importJSON(text) {
    const incoming = JSON.parse(text).notes;
    if (!incoming || typeof incoming !== 'object') throw new Error('Not a Townfinder notes file');
    const d = load();
    let added = 0;
    for (const kind of ['town', 'road']) {
      for (const [key, arr] of Object.entries(incoming[kind] || {})) {
        if (!Array.isArray(arr)) continue;
        d[kind] = d[kind] || {};
        const cur = (d[kind][key] = d[kind][key] || []);
        for (const n of arr) {
          if (typeof n.text !== 'string' || !n.text.trim()) continue;
          if (cur.some((c) => c.t === n.t && c.text === n.text)) continue;
          cur.push({ text: n.text.slice(0, 2000), t: Number(n.t) || Date.now() });
          added++;
        }
      }
    }
    store.set(KEY, d);
    return added;
  },
};

/** Opens the note editor; resolves with the text, or null if cancelled. */
export function editNote(title) {
  const dlg = document.getElementById('noteDlg');
  const ta = dlg.querySelector('textarea');
  dlg.querySelector('h2').textContent = title;
  ta.value = '';
  dlg.showModal();
  setTimeout(() => ta.focus(), 50);
  return new Promise((resolve) => {
    const done = (v) => {
      dlg.removeEventListener('close', onClose);
      resolve(v);
    };
    const onClose = () => done(dlg.returnValue === 'save' && ta.value.trim() ? ta.value.trim() : null);
    dlg.addEventListener('close', onClose);
  });
}
