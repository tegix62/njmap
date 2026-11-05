// Offline support: the app shell, boundary data, libraries and fonts are
// cached, so "which town am I in" keeps working with no signal. Background map
// tiles are only cached opportunistically.
const VERSION = 'njtf-v34';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/geo.js',
  'js/inset.js',
  'js/roadlabel.js',
  'js/drive.js',
  'js/explore.js',
  'js/practice.js',
  'js/confusables.js',
  'js/store.js',
  'js/knowledge.js',
  'js/roads.js',
  'js/notes.js',
  'js/theme.js',
  'js/style.js',
  'js/regions.js',
  'js/anchors.js',
  'js/dropin.js',
  'js/gridgame.js',
  'js/grid.js',
  'js/region.js',
  'js/places/nj.js',
  'js/places/manhattan.js',
  'lib/maplibre-gl.js',
  'lib/maplibre-gl.css',
  'lib/topojson-client.min.js',
  'data/nj.topo.json',
  'data/sections.json',
  'data/manhattan.topo.json',
  'fonts/Noto Sans Medium/0-255.pbf',
  'fonts/Noto Sans Italic/0-255.pbf',
  'manifest.webmanifest',
  'icon.svg',
];
const TILES = 'njtf-tiles';
const MAX_TILES = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // stale-while-revalidate: instant from cache, refreshed in the background
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req, { ignoreSearch: true });
        const net = fetch(req)
          .then((r) => {
            if (r.ok) c.put(req, r.clone());
            return r;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  if (url.hostname === 'tiles.openfreemap.org') {
    e.respondWith(
      fetch(req)
        .then(async (r) => {
          if (r.ok) {
            const c = await caches.open(TILES);
            c.put(req, r.clone());
            trim(c);
          }
          return r;
        })
        .catch(() => caches.match(req))
    );
  }
});

let trimming = false;
async function trim(c) {
  if (trimming) return;
  trimming = true;
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
  trimming = false;
}
