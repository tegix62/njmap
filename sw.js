// Offline support: the app shell, boundary data, libraries and fonts are
// cached, so "which town am I in" keeps working with no signal. Online, the
// app's own files come from the network first (the latest version every time). Background map
// tiles are only cached opportunistically.
const VERSION = 'njtf-v103';
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
  'js/gridclassic.js',
  'js/briefing.js',
  'js/motion.js',
  'js/midtowngrid.js',
  'js/frames.js',
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
  'data/downtown-streets.json',
  'data/midtown-streets.json',
  'data/landmarks.json', 'data/landmark-icons.json', 'data/landmark-credits.json', 'credits.html',
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
    // network first: online you always get the latest version (no "reload twice");
    // the saved copy is the fallback offline, or when the network is too slow
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const net = fetch(req, { cache: 'no-cache' }).then((r) => {
          if (r.ok) c.put(req, r.clone());
          return r;
        });
        const slow = new Promise((res) => setTimeout(res, 4000, null));
        try {
          const r = await Promise.race([net, slow]);
          if (r) return r;
        } catch {}
        const hit = await c.match(req, { ignoreSearch: true });
        return hit || net;
      })
    );
    return;
  }

  if (url.hostname === 'tiles.openfreemap.org') {
    e.respondWith(
      fetchRetry(req)
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

// A tile that fails to download would stay blank until the app reloads (the
// map doesn't ask again), so try a couple more times before giving up.
async function fetchRetry(req, tries = 3) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(req);
      if (r.ok || r.status === 404 || i >= tries - 1) return r;
    } catch (err) {
      if (i >= tries - 1) throw err;
    }
    await new Promise((res) => setTimeout(res, 600 * (i + 1)));
  }
}

let trimming = false;
async function trim(c) {
  if (trimming) return;
  trimming = true;
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
  trimming = false;
}
