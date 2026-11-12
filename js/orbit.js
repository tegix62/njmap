// "Name that tower": the camera circles one skyscraper, slowly, alone in a faint ghost of the city; which is it?
//
// Ten towers a round, four names to choose from. Hints cost a point (neighborhood, then height and year, then the corner it
// stands on). The towers you miss come round more often. The shapes are the same ones Explore and the drive games stand up
// (NYC's footprints and the surveyed towers); the base map's labels are hidden so nothing gives the name away.
import { buildingFeatures, applySurveyTowers, applyParts, loadParts, loadSurveyTowers, groundFeatures, GROUND_PAINT } from './city3d.js';
import { createMeshLayer, meshInfo } from './meshes.js';

const KEY = 'orbit';
const ROUND = 10;
const SPIN = 7; // degrees a second: a full turn in under a minute
const PITCH = 52; // tilted down more than the drive games' view, so the top of the tower shows and it can be framed closer
const TALL = 150; // metres: buildings at least this tall stand up in full round the tower
const GHOST_CAP = 26; // metres: the city around the tower is kept low so nothing stands in front of it
const AREAS = ['downtown', 'midtown', 'uptown'];
const ALIAS = { '30 Rockefeller Plaza': 'Rockefeller Center', 'Time Warner Center': 'Columbus Circle' }; // (the landmark photos)

const RAMP = /entrance|exit|\bramp|\bRp\b|Bridge|Tunnel|Expwy|\bEp\b|\bEn\b|\bEt\b|Unnamed|Transverse|Dr$|Drive|Pkwy|Hwy/i;
const shortName = (n) => n.replace(/^[EW] (\d+\w\w) St$/, '$1 St');
/** Every named street block of the three street files as { name, mid, pts }: for labelling what stands round a tower. */
function streetSegments(files) {
  const seen = new Set(), out = [];
  for (const d of files) {
    const [ox, oy] = d.origin;
    const geo = d.geoms.map((flat) => {
      const pts = [];
      let x = 0, y = 0;
      for (let i = 0; i < flat.length; i += 2) {
        x += flat[i];
        y += flat[i + 1];
        pts.push([ox + x / d.scale, oy + y / d.scale]);
      }
      return pts;
    });
    for (const [, , nid, gi] of d.links) {
      const name = d.names[nid];
      if (!name || RAMP.test(name)) continue;
      const shape = gi >= 0 ? gi : ~gi;
      const pts = geo[shape];
      if (!pts || pts.length < 2) continue;
      const mid = pts[Math.floor(pts.length / 2)];
      const key = shortName(name) + '|' + mid[0].toFixed(4) + ',' + mid[1].toFixed(4);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: shortName(name), mid, pts });
    }
  }
  return out;
}
/** A neighbourhood's outline as thin standing walls (one thin rectangle per edge of each outer ring), in lon/lat. */
function wallFeatures(geom, halfWidthM = 3.5) {
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  const out = [];
  for (const poly of polys) {
    const ring = poly[0];
    for (let i = 0; i + 1 < ring.length; i++) {
      const a = ring[i], b = ring[i + 1];
      const dx = (b[0] - a[0]) * 84200, dy = (b[1] - a[1]) * 111000;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      const nx = ((-dy / len) * halfWidthM) / 84200, ny = ((dx / len) * halfWidthM) / 111000;
      out.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny], [a[0] + nx, a[1] + ny]]] } });
    }
  }
  return out;
}

export function initOrbit(ctx) {
  const { map } = ctx;
  const cfg = ctx.region.orbit || null;                        // a region with its own landmark game (New Jersey), else Manhattan's towers
  const TITLE = cfg ? cfg.title : 'Name that tower';
  const ICON = cfg && cfg.icon ? cfg.icon : '🏙';
  const NOUN = { mountain: 'mountain or ridge', lake: 'lake or reservoir', river: 'river', park: 'park or forest', landmark: 'landmark' };
  let run = null; // the session
  let q = null; // the question
  let raf = 0;
  let city = null; // loaded once: { feats, cx, cy, list, pics }
  let loading = null;
  const meshes = createMeshLayer(map); // the towers the survey has as real triangle meshes
  const canMesh = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  let hiddenSymbols = [];
  // The township flash: during the wide orienting view of a long swing, the town the target is in is outlined and named for a moment
  // (the same outline and label layers the Manhattan game uses for the neighbourhood), then cleared as the camera drops in.
  // The shapes of the natural places (rivers as lines, lakes and parks as polygons) as map features, to outline what a question is about.
  const GEOM_COLOR = { target: '#0b9a82', wrong: '#d9622b' };
  const ptsOf = (g) => {
    const out = [];
    const walk = (c) => { if (typeof c[0] === 'number') out.push(c); else c.forEach(walk); };
    walk(g.coordinates);
    return out;
  };
  /** [west, south, east, north] of a shape; for a long river only the part within `km` of `near`. */
  function boundsOf(g, near, km) {
    let pts = ptsOf(g);
    if (near && km) {
      const close = pts.filter((p) => mDist(p, near) < km * 1000);
      if (close.length > 1) pts = close;
    }
    return pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [180, 90, -180, -90]);
  }
  function setGeom(items, labelled = false) {     // items: [{ name, role }]; the names are drawn only once the question is answered (they would give it away)
    const feats = [], walls = [], labs = [];
    for (const { name, role } of items) {
      const place = city.list.find((x) => x.n === name);
      const g = city.geoms && city.geoms[name];
      if (g) {
        feats.push({ type: 'Feature', properties: { role, name }, geometry: g });
        if (g.type === 'Polygon' || g.type === 'MultiPolygon') for (const w of wallFeatures(g, 3)) walls.push({ ...w, properties: { role, h: place && place.kind === 'lake' ? 70 : 160 } });
        const b = boundsOf(g, place && place.kind === 'river' ? place.p : null, place && place.kind === 'river' ? 22 : 0);
        if (labelled) labs.push({ type: 'Feature', properties: { role, name }, geometry: { type: 'Point', coordinates: place && place.kind === 'river' ? place.p : [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] } });
      } else if (place && labelled) {
        labs.push({ type: 'Feature', properties: { role, name }, geometry: { type: 'Point', coordinates: place.p } });   // (a ridge or a peak has no outline: its name at its point)
      }
    }
    const fc = (f) => ({ type: 'FeatureCollection', features: f });
    for (const [s, f] of [['orb-geom', feats], ['orb-geom-wall', walls], ['orb-geom-lab', labs]]) if (map.getSource(s)) map.getSource(s).setData(fc(f));
  }
  let flashed = false;
  function flashTown(t, on) {
    const src = map.getSource('orb-hood');
    if (!src) return;
    const m = on && ctx.locate ? ctx.locate(t.p) : null;
    src.setData({ type: 'FeatureCollection', features: m ? [{ type: 'Feature', properties: {}, geometry: m.geom }, { type: 'Feature', properties: { name: m.mapLabel || m.full || m.n }, geometry: { type: 'Point', coordinates: m.pt } }] : [] });
    flashed = !!m;
  }
  let arcRaf = 0;                                                  // the climbing swing between far-apart targets (region games)
  let spinOn = ctx.store.get('orbit.spin', true); // the camera circles by itself (off: it holds still and you turn it)
  let drag = null; // a finger or mouse turning the view
  let occl = []; // the tall towers round the one being asked about, for lowering the ones in front
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
  const stats = () => ctx.store.get(KEY, {});
  const ft = (m) => Math.round((m * 3.28084) / 10) * 10;
  const mDist = (a, b) => Math.hypot((a[0] - b[0]) * 84200, (a[1] - b[1]) * 111000);

  async function load() {
    if (city) return city;
    if (loading) return loading;
    loading = (async () => {
      if (cfg) {                                             // the region's own landmarks: one file of buildings, parts and street names
        const [list, pics, d, geoms] = await Promise.all([
          fetch(cfg.list).then((r) => r.json()),
          fetch(cfg.credits).then((r) => r.json()).catch(() => ({})),
          fetch(cfg.city).then((r) => r.json()),
          fetch(cfg.geoms || 'data/nj-geoms.json').then((r) => r.json()).catch(() => ({})),   // (the outlines of the rivers, lakes and parks)
        ]);
        const feats = applyParts(buildingFeatures(d, { o: d.o, s: d.s, g: d.g }));
        const cx = feats.map((f) => {
          const r = f.geometry.coordinates[0];
          let x = 0, y = 0;
          for (const p of r) { x += p[0]; y += p[1]; }
          return [x / r.length, y / r.length];
        });
        const segs = d.segs.map(([nid, ...flat]) => {
          const pts = [];
          let x = 0, y = 0;
          for (let i = 0; i < flat.length; i += 2) { x += flat[i]; y += flat[i + 1]; pts.push([d.o[0] + x / d.s, d.o[1] + y / d.s]); }
          return { name: d.names[nid], mid: pts[Math.floor(pts.length / 2)], pts };
        }).filter((s) => s.pts.length > 1);
        const lms = (ctx.region.landmarks || []).map((l) => ({ n: l.name, p: l.pt }));
        city = { feats, cx, list, pics, lms, segs, grounds: [], geoms };
        return city;
      }
      const [list, pics, lms, towers, ...rest] = await Promise.all([
        fetch('data/skyscrapers.json').then((r) => r.json()),
        fetch('data/landmark-credits.json').then((r) => r.json()).catch(() => ({})),
        fetch('data/landmarks.json').then((r) => r.json()).catch(() => []),
        loadSurveyTowers(),
        ...AREAS.map((a) => fetch(`data/buildings-${a}.json`).then((r) => r.json())),
        ...AREAS.map((a) => fetch(`data/ground-${a}.json`).then((r) => r.json()).catch(() => null)),
        ...AREAS.map((a) => fetch(`data/${a}-streets.json`).then((r) => r.json()).catch(() => null)),
        ...AREAS.map((a) => loadParts(a)),
      ]);
      const files = rest.slice(0, 3), grounds = rest.slice(3, 6), streetFiles = rest.slice(6, 9), partFiles = rest.slice(9, 12);
      const md = canMesh ? await meshes.data() : null;
      const quiz = new Set(list.map((x) => x.n));
      const meshList = meshInfo(md).filter((m) => quiz.has(m.n)); // (the other landmark and tower meshes are for Explore: here they stay blocks)
      const feats = applyParts(applySurveyTowers(files.flatMap((d, i) => buildingFeatures(d, partFiles[i])), towers, meshList));
      const cx = feats.map((f) => {
        const r = f.geometry.coordinates[0];
        let x = 0, y = 0;
        for (const p of r) { x += p[0]; y += p[1]; }
        return [x / r.length, y / r.length];
      });
      city = { feats, cx, list, pics, lms, segs: streetSegments(streetFiles.filter(Boolean)), grounds: grounds.filter(Boolean).flatMap(groundFeatures) };
      return city;
    })();
    return loading;
  }

  function layers() {
    if (map.getSource('orb-city')) return;
    const first = map.getStyle().layers.find((l) => l.type === 'symbol');
    const before = first && first.id;
    map.addSource('orb-ground', { type: 'geojson', data: { type: 'FeatureCollection', features: city.grounds } });
    for (const k of ['walk', 'road', 'park'])
      map.addLayer({ id: 'orb-' + k, type: 'fill', source: 'orb-ground', filter: ['==', ['get', 'k'], k], layout: { visibility: 'none' }, paint: GROUND_PAINT[k] }, before);
    map.addSource('orb-city', { type: 'geojson', generateId: true, data: { type: 'FeatureCollection', features: city.feats } });
    if (cfg && !map.getSource('orb-dem')) {                      // real relief: AWS terrain tiles (public elevation data), shaded
      map.addSource('orb-dem', { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 11, attribution: 'Terrain: AWS Terrain Tiles (USGS 3DEP, SRTM and others)' });
      map.addSource('orb-dem-hs', { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 11 });   // (its own source: MapLibre wants the shading and the terrain apart)
      map.addLayer({ id: 'orb-relief', type: 'hillshade', source: 'orb-dem-hs', layout: { visibility: 'none' }, paint: { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#4d5a52', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#6e7d70' } }, first && first.id);
    }
    if (cfg) {                                                    // the outline of the river, lake or park in question (and of the one you picked, after a miss)
      const col = ['match', ['get', 'role'], 'wrong', GEOM_COLOR.wrong, GEOM_COLOR.target];
      const none = { type: 'FeatureCollection', features: [] };
      map.addSource('orb-geom', { type: 'geojson', data: none });
      map.addSource('orb-geom-wall', { type: 'geojson', data: none });
      map.addSource('orb-geom-lab', { type: 'geojson', data: none });
      map.addLayer({ id: 'orb-geom-fill', type: 'fill', source: 'orb-geom', filter: ['==', ['geometry-type'], 'Polygon'], layout: { visibility: 'none' }, paint: { 'fill-color': col, 'fill-opacity': 0.3 } }, before);
      map.addLayer({ id: 'orb-geom-fill2', type: 'fill', source: 'orb-geom', filter: ['==', ['geometry-type'], 'MultiPolygon'], layout: { visibility: 'none' }, paint: { 'fill-color': col, 'fill-opacity': 0.3 } }, before);
      map.addLayer({ id: 'orb-geom-casing', type: 'line', source: 'orb-geom', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6, 12, 11], 'line-opacity': 0.9 } }, before);
      map.addLayer({ id: 'orb-geom-line', type: 'line', source: 'orb-geom', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6] } }, before);
      map.addLayer({ id: 'orb-geom-wall', type: 'fill-extrusion', source: 'orb-geom-wall', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': col, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.4, 'fill-extrusion-vertical-gradient': true } }, before);
      map.addLayer({ id: 'orb-geom-name', type: 'symbol', source: 'orb-geom-lab', layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'viewport', 'text-allow-overlap': true }, paint: { 'text-color': col, 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
    }
    map.addSource('orb-target', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const col = ['case', ['has', 'c'], ['get', 'c'], ['interpolate', ['linear'], ['get', 'h'], 6, '#e9e3d6', 60, '#d6cdbb', 200, '#bdb29d', 300, '#a99d88']];
    map.addLayer(
      {
        id: 'orb-ghost', type: 'fill-extrusion', source: 'orb-city', layout: { visibility: 'none' },
        paint: { 'fill-extrusion-color': '#9fb0c0', 'fill-extrusion-height': ['min', ['get', 'h'], GHOST_CAP], 'fill-extrusion-base': ['min', ['coalesce', ['get', 'b'], 0], GHOST_CAP], 'fill-extrusion-opacity': 0.3, 'fill-extrusion-vertical-gradient': false },
      },
      before
    );
    // the other tall towers (the surveyed and modelled ones, and any plain building over 150 m) stand up too, muted
    map.addLayer(
      {
        id: 'orb-others', type: 'fill-extrusion', source: 'orb-city', layout: { visibility: 'none' },
        filter: ['any', ['has', 'c'], ['>=', ['get', 'h'], TALL]],
        // a tower that stands between the camera and the tower being asked about sinks to the low ghost while it is in the way
        paint: {
          'fill-extrusion-color': '#a9b6c2',
          'fill-extrusion-height': ['case', ['boolean', ['feature-state', 'low'], false], ['min', ['get', 'h'], GHOST_CAP], ['get', 'h']],
          'fill-extrusion-base': ['case', ['boolean', ['feature-state', 'low'], false], ['min', ['coalesce', ['get', 'b'], 0], GHOST_CAP], ['coalesce', ['get', 'b'], 0]],
          'fill-extrusion-height-transition': { duration: 350, delay: 0 },
          'fill-extrusion-base-transition': { duration: 350, delay: 0 },
          'fill-extrusion-opacity': 0.55,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      before
    );
    // the neighbourhood the tower stands in: a faint tint on the ground, a dashed edge and a low glass wall round it
    map.addSource('orb-hood', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('orb-wall', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'orb-hood-fill', type: 'fill', source: 'orb-hood', layout: { visibility: 'none' }, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#0b7a68', 'fill-opacity': 0.1 } }, before);
    map.addLayer({ id: 'orb-hood-line', type: 'line', source: 'orb-hood', layout: { visibility: 'none' }, paint: { 'line-color': '#0b7a68', 'line-width': 2.2, 'line-opacity': 0.85, 'line-dasharray': [3, 2] } }, before);
    map.addLayer({ id: 'orb-hood-wall', type: 'fill-extrusion', source: 'orb-wall', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': '#0b9a82', 'fill-extrusion-height': 55, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.28, 'fill-extrusion-vertical-gradient': true } }, before);
    // subtle labels: the streets round it, the other landmarks (not the towers), and the neighbourhood's name
    map.addSource('orb-lab', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('orb-lm', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'orb-lab', type: 'symbol', source: 'orb-lab', layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 11, 'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'viewport', 'text-max-width': 8, 'text-optional': true },
      paint: { 'text-color': '#5d5648', 'text-opacity': 0.8, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 },
    });
    map.addLayer({
      id: 'orb-lm', type: 'symbol', source: 'orb-lm', layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'viewport', 'text-max-width': 7, 'text-optional': true, 'text-anchor': 'top', 'text-offset': [0, 0.5] },
      paint: { 'text-color': '#7a4f1d', 'text-opacity': 0.85, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 },
    });
    map.addLayer({
      id: 'orb-hood-name', type: 'symbol', source: 'orb-hood', filter: ['==', ['geometry-type'], 'Point'], layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-letter-spacing': 0.18, 'text-transform': 'uppercase', 'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'viewport' },
      paint: { 'text-color': '#0b6b5b', 'text-opacity': 0.75, 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.6 },
    });
    map.addLayer(
      {
        id: 'orb-target', type: 'fill-extrusion', source: 'orb-target', layout: { visibility: 'none' },
        paint: { 'fill-extrusion-color': col, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': ['coalesce', ['get', 'b'], 0], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true },
      },
      before
    );
  }
  const show = (on) => {
    meshes.show(on);
    if (cfg && map.getLayer('orb-relief')) map.setLayoutProperty('orb-relief', 'visibility', on ? 'visible' : 'none');
    if (cfg && map.getSource('orb-dem')) {
      map.stop();                                                // (terrain switched on or off in the middle of an ease makes MapLibre throw)
      map.setTerrain(on ? { source: 'orb-dem', exaggeration: 2.1 } : null);
    }
    for (const id of ['orb-geom-fill', 'orb-geom-fill2', 'orb-geom-casing', 'orb-geom-line', 'orb-geom-wall', 'orb-geom-name']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    for (const id of ['orb-walk', 'orb-road', 'orb-park', 'orb-ghost', 'orb-others', 'orb-hood-fill', 'orb-hood-line', 'orb-hood-wall', 'orb-lab', 'orb-lm', 'orb-hood-name', 'orb-target']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    if (on) {
      // no names on the map while this runs
      hiddenSymbols = map.getStyle().layers.filter((l) => !l.id.startsWith('orb-') && (l.type === 'symbol' || l.type === 'circle') && map.getLayoutProperty(l.id, 'visibility') !== 'none').map((l) => l.id);
      for (const id of hiddenSymbols) map.setLayoutProperty(id, 'visibility', 'none');
    } else {
      for (const id of hiddenSymbols) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      hiddenSymbols = [];
    }
  };

  /** The tower to ask about next: the ones missed before come round more often, never the same twice running. */
  function pick() {
    const st = stats();
    const w = city.list.map((t) => {
      if (run.seen.includes(t.n)) return 0;
      const s = st[t.n] || { r: 0, w: 0 };
      const n = s.r + s.w;
      return (n === 0 ? 3 : 1 + 4 * (s.w / n)) * (t.kind === 'landmark' ? 0.3 : 1);   // (a building landmark comes up now and then)
    });
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) if ((x -= w[i]) <= 0) return city.list[i];
    return city.list.find((t) => !run.seen.includes(t.n)) || rand(city.list);
  }
  function choicesFor(t) {
    const same = (o) => (cfg ? o.kind === t.kind : (o.k || 't') === (t.k || 't'));   // (mountains against mountains, lakes against lakes; landmarks against landmarks, towers against towers)
    const others = city.list.filter((o) => o.n !== t.n && same(o));
    const near = shuffle(others.filter((o) => (t.h ? Math.abs(o.h - t.h) / t.h < 0.3 : mDist(o.p, t.p) < 60000)));   // (the near ones: of a similar height, or within 60 km)
    const far = shuffle(others);
    const out = [];
    for (const o of [...near.slice(0, 2), ...far]) if (out.length < 3 && !out.includes(o)) out.push(o);
    return shuffle([t, ...out]);
  }

  // One finger (or the mouse) turns the view round the tower: sideways turns it, up and down tilts it. The map's own panning is
  // off while this runs, so the tower stays where it is; two fingers still zoom.
  function dragStart(e) {
    if (!run || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest && e.target.closest('.maplibregl-ctrl')) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function dragMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    map.setBearing(map.getBearing() - dx * 0.45);
    map.setPitch(Math.max(20, Math.min(70, map.getPitch() - dy * 0.25)));
  }
  function dragEnd(e) {
    if (drag && (!e || e.pointerId === drag.id)) drag = null;
  }
  const canvasBox = () => map.getCanvasContainer();
  function dragOn() {
    map.dragPan.disable();
    const el = canvasBox();
    el.addEventListener('pointerdown', dragStart);
    window.addEventListener('pointermove', dragMove);
    window.addEventListener('pointerup', dragEnd);
    window.addEventListener('pointercancel', dragEnd);
  }
  function dragOff() {
    map.dragPan.enable();
    const el = canvasBox();
    el.removeEventListener('pointerdown', dragStart);
    window.removeEventListener('pointermove', dragMove);
    window.removeEventListener('pointerup', dragEnd);
    window.removeEventListener('pointercancel', dragEnd);
    drag = null;
  }

  /** Lower the tall towers that stand between the camera and the tower (the camera looks along `bearing` degrees), raise the rest. */
  function updateOcclusion(bearing) {
    const r = (bearing * Math.PI) / 180;
    const fx = Math.sin(r), fy = Math.cos(r);
    for (const o of occl) {
      const along = o.dx * -fx + o.dy * -fy; // how far it is towards the camera from the tower
      const side = Math.abs(o.dx * fy - o.dy * fx); // how far off the line of sight
      const inFront = along > 12 && side < 70;
      if (inFront !== o.low) {
        o.low = inFront;
        map.setFeatureState({ source: 'orb-city', id: o.id }, { low: inFront });
      }
    }
  }

  /** The street names, other landmarks and neighbourhood round a tower, for finding where it stands. */
  function around(t) {
    const p = t.p;
    // streets: one label for each street within ~420 m, at its block nearest the tower
    const best = new Map();
    for (const sg of city.segs) {
      if (mDist(sg.mid, p) > 520) continue;
      let d = 1e9;
      for (const q of sg.pts) d = Math.min(d, mDist(q, p));
      if (d > 420) continue;
      const cur = best.get(sg.name);
      if (!cur || d < cur.d) best.set(sg.name, { d, sg, d0: mDist(sg.mid, p) });
    }
    // only a few: the two numbered streets and the two avenues (or other named streets) nearest the tower
    const all = [...best.values()].sort((a, b) => a.d - b.d);
    const isNum = (b) => /^\d+\w\w St$/.test(b.sg.name);
    const labels = [...all.filter(isNum).slice(0, 2), ...all.filter((b) => !isNum(b)).slice(0, 2)].map((b) => ({ type: 'Feature', properties: { name: b.sg.name }, geometry: { type: 'Point', coordinates: b.sg.mid } }));
    map.getSource('orb-lab').setData({ type: 'FeatureCollection', features: labels });
    // landmarks that are not themselves towers of the quiz (those would give the answers away)
    const taken = new Set((q && q.choices ? q.choices : city.list).map((x) => x.n));
    for (const [tower, lm] of Object.entries(ALIAS)) if (taken.has(tower)) taken.add(lm);
    const lm = city.lms.filter((l) => !taken.has(l.n) && mDist(l.p, p) < 700 && mDist(l.p, p) > 25).sort((a, b) => mDist(a.p, p) - mDist(b.p, p)).slice(0, 6).map((l) => ({ type: 'Feature', properties: { name: l.n }, geometry: { type: 'Point', coordinates: l.p } }));
    map.getSource('orb-lm').setData({ type: 'FeatureCollection', features: lm });
    // the neighbourhood
    const m = ctx.locate ? ctx.locate(p) : null;
    q.hood = m ? (cfg ? m.full || m.n : m.n) : null;
    if (m && !cfg) {
      map.getSource('orb-hood').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: m.geom }, { type: 'Feature', properties: { name: m.mapLabel || m.n }, geometry: { type: 'Point', coordinates: m.pt } }] });
      map.getSource('orb-wall').setData({ type: 'FeatureCollection', features: wallFeatures(m.geom) });
    } else {
      map.getSource('orb-hood').setData({ type: 'FeatureCollection', features: [] });
      map.getSource('orb-wall').setData({ type: 'FeatureCollection', features: [] });
    }
  }

  /** Make this tower the solid one: everything standing within 60 m that is part of it, the rest left as the ghost. */
  function focus(t) {
    if (t.k === 'nat') {                                  // nothing to stand up: clear what the last landmark left
      for (const o of occl) map.setFeatureState({ source: 'orb-city', id: o.id }, { low: false });
      occl = [];
      const none = { type: 'FeatureCollection', features: [] };
      for (const s of ['orb-target', 'orb-lab', 'orb-lm', 'orb-hood', 'orb-wall']) if (map.getSource(s)) map.getSource(s).setData(none);
      q.hood = null;
      setGeom([{ name: t.n, role: 'target' }]);
      return;
    }
    const p = t.p;
    const ids = [], mine = [];
    // the building itself: the nearest one of about the right height (not its neighbours, even tall ones)
    let main = -1, bd = 110;
    const meshed = meshes.ok && meshes.has(t.n); // drawn as a real mesh: no slab is the target
    if (!meshed) city.feats.forEach((f, i) => {
      const d = mDist(city.cx[i], p);
      if (cfg ? f.properties.lm === 1 && d < bd : d < bd && f.properties.h >= 0.5 * t.h) { bd = d; main = i; }   // (a region game flags the landmark's own building)
    });
    if (main >= 0) {
      const mc = city.cx[main];
      const modelled = city.feats[main].properties.c !== undefined;
      city.feats.forEach((f, i) => {
        const d = mDist(city.cx[i], mc);
        // a surveyed or modelled tower is many pieces: take every piece standing in its place; a plain one is just itself
        if (i === main || (modelled && f.properties.c !== undefined && d < 38)) {
          ids.push(i);
          mine.push(f);
        }
      });
    }
    map.getSource('orb-target').setData({ type: 'FeatureCollection', features: mine });
    // the surveyed meshes: this one solid, the others see-through and greyed
    if (meshes.ok) {
      meshes.all({ alpha: 0.5, mute: 0.55 });
      meshes.state(t.n, { alpha: 1, mute: 0 });
    }
    const not = ['!', ['in', ['id'], ['literal', ids.length ? ids : [-1]]]];
    // tall neighbours right beside the tower would stand in front of it: those within 90 m are kept low like the rest
    const nearIds = [];
    city.feats.forEach((f, i) => {
      if (!ids.includes(i) && (f.properties.c !== undefined || f.properties.h >= TALL) && mDist(city.cx[i], p) < 90) nearIds.push(i);
    });
    const near = ['in', ['id'], ['literal', nearIds.length ? nearIds : [-1]]];
    // the tall towers within 520 m that could stand in front of it, as metres east and north of it
    for (const o of occl) map.setFeatureState({ source: 'orb-city', id: o.id }, { low: false });
    occl = [];
    const skip = new Set([...ids, ...nearIds]);
    city.feats.forEach((f, i) => {
      if (skip.has(i) || !(f.properties.c !== undefined || f.properties.h >= TALL)) return;
      const dx = (city.cx[i][0] - p[0]) * 84200, dy = (city.cx[i][1] - p[1]) * 111000;
      if (Math.hypot(dx, dy) < 520) occl.push({ id: i, dx, dy, low: false });
    });
    // the low ghost: everything that is neither the tower nor one of the tall ones kept standing round it
    map.setFilter('orb-ghost', ['all', not, ['any', ['all', ['!', ['has', 'c']], ['<', ['get', 'h'], TALL]], near]]);
    map.setFilter('orb-others', ['all', ['any', ['has', 'c'], ['>=', ['get', 'h'], TALL]], not, ['!', near]]);
    around(t);
  }

  function camera(t, spin0, first) {
    cancelAnimationFrame(raf);
    // The tower is centred in the free area (the space between the top card and the answers): about 78% of that height, its
    // middle at the middle. A tower this many metres high shows about 1.15 x sin(pitch) x height / (metres per pixel) pixels
    // tall; its foot goes half of that below the middle, and the camera padding is worked out to put the foot there.
    // The free area is measured off the real top card and answer panel (not guessed): the panel must already be drawn.
    const boxH = map.getContainer().clientHeight || window.innerHeight;
    const hudEl = document.getElementById('hud');
    const sheetEl = document.getElementById('sheet');
    const mapTop = map.getContainer().getBoundingClientRect().top;
    const padTop = hudEl && !hudEl.hidden ? hudEl.getBoundingClientRect().bottom - mapTop + 30 : ctx.padding().top;
    const padBottom = sheetEl && !sheetEl.hidden ? boxH - (sheetEl.getBoundingClientRect().top - mapTop) + 8 : ctx.padding().bottom;
    const pad = { top: padTop, bottom: padBottom };
    const winH = boxH;
    const free = Math.max(120, winH - pad.top - pad.bottom);
    const mpp0 = 78271.5 * Math.cos((t.p[1] * Math.PI) / 180);
    const sinP = Math.sin((PITCH * Math.PI) / 180);
    const hh = t.k === 'lm' ? Math.max(t.h, cfg ? 40 : 85) : t.h; // a landmark is low: frame it as if it stood a little taller
    let zoom = Math.max(14.4, Math.min(cfg ? 16.0 : 16.9, Math.log2((mpp0 * 0.86 * free) / (1.15 * sinP * hh))));
    // a wide one (a stadium, a mall) must fit across the screen too: its width, with a margin for the turn
    if (t.w) zoom = Math.min(zoom, Math.max(14.2, Math.log2((0.8 * (map.getContainer().clientWidth || 400) * mpp0) / (t.w * 1.45))));
    const pxTall = (1.15 * sinP * hh * Math.pow(2, zoom)) / mpp0;
    const baseY = pad.top + free / 2 + pxTall / 2;
    let top = Math.max(pad.top, 2 * baseY - (winH - pad.bottom));
    let bearing = spin0;
    let last = performance.now();
    let lastOcc = 0;
    let center = t.p;
    if (t.k === 'nat') {                                  // a mountain, lake, river or park: high and steep over the terrain, centred in the free area
      zoom = t.z; top = pad.top;
      if (t.bearing != null) bearing = t.bearing;         // (a river: looking along it)
      const g = city.geoms && city.geoms[t.n];
      if (g) {                                            // fit its outline (a long river: the 22 km of it round the point)
        const b = boundsOf(g, t.kind === 'river' ? t.p : null, t.kind === 'river' ? 22 : 0);
        const ext = Math.max((b[2] - b[0]) * 84200, (b[3] - b[1]) * 111000, 1500);
        zoom = Math.max(9.4, Math.min(13, Math.log2((0.6 * (map.getContainer().clientWidth || 400) * mpp0) / ext)));
        if (t.kind !== 'river') center = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      }
    }
    const cam = { center, zoom, pitch: t.k === 'nat' ? t.pitch : PITCH, bearing, padding: { top, bottom: pad.bottom, left: 0, right: 0 } };
    const tick = (now) => {
      if (!run || q.t !== t) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        bearing = map.getBearing();
        if (spinOn && !drag && !(cfg && q.done && q.t.k === 'nat')) {
          bearing = (bearing + SPIN * dt * (ctx.reduceMotion ? 0.3 : 1)) % 360;
          map.setBearing(bearing);
        }
        if (now - lastOcc > 90) {
          lastOcc = now;
          updateOcclusion(bearing);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    // Swing over from wherever the camera is (the last tower, or the map you came from) to the next one, as the rest of the app
    // does between questions; the orbit starts when the camera arrives.
    q.flying = true;
    const go = () => {
      if (!run || q.t !== t || !q.flying) return;
      q.flying = false;
      last = performance.now();
      updateOcclusion(bearing);
      render();
      raf = requestAnimationFrame(tick);
    };
    // (easeTo, not flyTo: flyTo's long zoom-out makes MapLibre throw from its tile bookkeeping now and then; the towers are
    // only a few km apart, so a plain ease reads as a swing anyway)
    const from = map.getCenter();
    const km = mDist([from.lng, from.lat], cam.center) / 1000;
    if (cfg && km > 2) {
      // Far apart (New Jersey's landmarks are a state away from each other). In phases, so you can follow it: RISE straight up (no sideways
      // travel while still low, turning north-up), CRUISE across at height, drop to a wide ORIENTING view and hold there a beat with the
      // target in the middle (so you can see where you are), then settle into the orbit.
      cancelAnimationFrame(arcRaf);
      const z0 = map.getZoom(), b0 = map.getBearing(), p0 = map.getPitch(), pd0 = map.getPadding();
      const W = map.getContainer().clientWidth || 400;
      const zFit = Math.log2((0.6 * W * 78271.5 * Math.cos((cam.center[1] * Math.PI) / 180)) / (km * 1000));
      const zTop = Math.max(7.2, Math.min(zFit, z0 - 1, cam.zoom - 1));             // high enough to see both ends
      const zOri = Math.min(cam.zoom - 1.8, 12.4);                                   // the orienting view: regional, terrain readable
      const f = (ctx.reduceMotion ? 0.5 : 1) * Math.max(0.5, Math.min(1, km / 30)); // short hops are quicker
      const seg = [500 * f, Math.min(1150, 380 + km * 9) * f, 400 * f, 250 * f, 600 * f]; // rise, cruise, drop, hold, settle (about 2.9 s across the state)
      const total = seg.reduce((x, y) => x + y, 0);
      const ease = (x) => x * x * (3 - 2 * x);
      const dB0 = ((((0 - b0) % 360) + 540) % 360) - 180;                          // to north-up
      const dB1 = ((((cam.bearing - 0) % 360) + 540) % 360) - 180;                 // north-up to the orbit's start
      const pTop = Math.min(p0, 30), pOri = 45;
      const lerp = (x, y, e) => x + (y - x) * e;
      const t0 = performance.now();
      const step = (now) => {
        if (!run || q.t !== t) return;
        let tau = Math.min(total, now - t0);
        const st = { c: [from.lng, from.lat], z: z0, b: b0, p: p0, pad: 0 };
        if (tau < seg[0]) {                                                         // rise: up, level, north
          const e = ease(tau / seg[0]);
          st.z = lerp(z0, zTop, e); st.b = b0 + dB0 * e; st.p = lerp(p0, pTop, e);
        } else if ((tau -= seg[0]) < seg[1]) {                                      // cruise: across at height
          const e = ease(tau / seg[1]);
          st.c = [lerp(from.lng, cam.center[0], e), lerp(from.lat, cam.center[1], e)]; st.z = zTop; st.b = b0 + dB0; st.p = pTop;
        } else if ((tau -= seg[1]) < seg[2]) {                                      // drop to the orienting view
          const e = ease(tau / seg[2]);
          st.c = cam.center; st.z = lerp(zTop, zOri, e); st.b = b0 + dB0; st.p = lerp(pTop, pOri, e);
        } else if ((tau -= seg[2]) < seg[3]) {                                      // hold: look (and flash the town)
          if (!flashed) flashTown(t, true);
          st.c = cam.center; st.z = zOri + 0.15 * (tau / seg[3]); st.b = b0 + dB0; st.p = pOri;
        } else {                                                                    // settle into the orbit
          tau -= seg[3];
          const e = ease(Math.min(1, tau / seg[4]));
          if (flashed && tau > seg[4] * 0.35) flashTown(t, false);                     // (gone a third of the way down)
          st.c = cam.center; st.z = lerp(zOri + 0.15, cam.zoom, e); st.b = b0 + dB0 + dB1 * e; st.p = lerp(pOri, cam.pitch, e); st.pad = e;
        }
        map.jumpTo({
          center: st.c, zoom: st.z, pitch: st.p, bearing: st.b,
          padding: { top: lerp(pd0.top, cam.padding.top, st.pad), bottom: lerp(pd0.bottom, cam.padding.bottom, st.pad), left: 0, right: 0 },
        });
        if (now - t0 < total) arcRaf = requestAnimationFrame(step);
        else { if (flashed) flashTown(t, false); go(); }
      };
      arcRaf = requestAnimationFrame(step);
      return;
    }
    map.easeTo({ ...cam, duration: ctx.dur ? ctx.dur(first ? 800 : 900) : 900, easing: (x) => x * x * (3 - 2 * x), essential: true });
    // (after easeTo starts: starting it ends any motion already under way, and that motion's own "moveend" must not count)
    if (map.isMoving()) map.once('moveend', go);
    else go();
  }

  async function start(opts) {
    stop();
    run = { opts, n: 0, pts: 0, right: 0, seen: [], misses: [], streak: 0, done: false, loading: true };
    document.body.classList.add('framing');
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    ctx.hud(`<div class="qkind">${ICON} ${TITLE}</div><div class="q">Loading the ${cfg ? 'map' : 'skyline'}…</div>`);
    try {
      await load();
    } catch {
      if (run) ctx.hud(`<div class="qkind">${ICON} ${TITLE}</div><div class="q">Couldn’t load the buildings.</div>`);
      return;
    }
    if (!run) return;
    run.loading = false;
    layers();
    if (canMesh && !cfg) {
      await meshes.load(map.getStyle().layers.find((l) => l.type === 'symbol')?.id);
      const quiz = new Set(city.list.map((x) => x.n));
      for (const t of meshes.towers) t.hidden = !quiz.has(t.n);
    }
    if (!run) return;
    map.setMaxPitch(70);
    show(true);
    dragOn();
    next();
  }
  function stop() {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(arcRaf);
    if (flashed) flashTown(null, false);
    if (!run) return;
    run = null;
    q = null;
    document.body.classList.remove('framing');
    const pb = document.getElementById('orbPhoto');
    if (pb) pb.hidden = true;
    for (const o of occl) if (o.low) map.setFeatureState({ source: 'orb-city', id: o.id }, { low: false });
    occl = [];
    dragOff();
    show(false);
    map.easeTo({ pitch: 0, center: map.getCenter(), duration: ctx.dur ? ctx.dur(400) : 400 });
  }
  function next() {
    if (!run) return;
    if (run.n >= ROUND) {
      run.done = true;
      q = null;
      cancelAnimationFrame(raf);
      return render();
    }
    const t = (run.n === 0 && run.opts.first && city.list.find((x) => x.n === run.opts.first)) || pick();
    run.seen.push(t.n);
    q = { t, choices: choicesFor(t), hints: 0, picked: null, done: false, flying: true };
    const first = !run.flown;
    run.flown = true;
    // the last tower stays in place until the camera is about halfway there, then the new one stands up where it's going
    if (first) focus(t);
    else {
      const wait = ctx.dur ? ctx.dur(900) * 0.45 : 400;
      setTimeout(() => {
        if (!run || !q || q.t !== t) return;
        focus(t);
        render();
      }, wait);
    }
    render();
    camera(t, Math.random() * 360, first);
  }
  const HINTS = [
    (t) => (t.k === 'nat' ? `It's in <b>${esc(t.c)} County</b>.` : t.k === 'lm' ? `Opened in <b>${t.y}</b>.` : `<b>${t.h} m</b> (${ft(t.h)} ft), finished in <b>${t.y}</b>.`),
    (t) => (t.k === 'nat' ? `Near <b>${esc(t.at)}</b>.` : cfg ? `It's in <b>${esc(t.at)}</b>.` : `You'd find it at <b>${esc(t.at)}</b>.`),
    (t) => (t.k === 'nat' ? `${t.elev ? `<b>${t.elev.toLocaleString()} ft</b>. ` : ''}${esc(t.line)}.` : `${esc(t.line)}.`),
  ];
  function hint() {
    if (!q || q.done || q.hints >= HINTS.length) return;
    q.hints++;
    render();
  }
  function answer(name) {
    if (!q || q.done) return;
    const t = q.t;
    q.done = true;
    q.picked = name;
    q.ok = name === t.n;
    const pts = q.ok ? Math.max(1, 3 - q.hints) : 0;
    run.n++;
    run.pts += pts;
    q.pts = pts;
    if (q.ok) {
      run.right++;
      run.streak++;
    } else {
      run.streak = 0;
      run.misses.push(t.n);
    }
    const st = stats();
    const s = st[t.n] || { r: 0, w: 0 };
    q.ok ? s.r++ : s.w++;
    st[t.n] = s;
    ctx.store.set(KEY, st);
    render();
    if (cfg && t.k === 'nat') setTimeout(() => compare(name), 60);
  }

  /** After an answer: outline the right place (and, after a miss, the one you picked, in orange) and pull back to see both, so the difference is clear. */
  function compare(name) {
    if (!run || !q || !q.done) return;
    const t = q.t;
    const picked = !q.ok ? city.list.find((o) => o.n === name) : null;
    setGeom([{ name: t.n, role: 'target' }, ...(picked ? [{ name: picked.n, role: 'wrong' }] : [])], true);
    const all = [];
    for (const p of [t, picked].filter(Boolean)) {
      const g = city.geoms && city.geoms[p.n];
      if (g) { const b = boundsOf(g); all.push([b[0], b[1]], [b[2], b[3]]); } else all.push(p.p);
    }
    const bb = all.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [180, 90, -180, -90]);
    const boxH = map.getContainer().clientHeight || window.innerHeight;
    const hudEl = document.getElementById('hud'), sheetEl = document.getElementById('sheet');
    const mapTop = map.getContainer().getBoundingClientRect().top;
    const top = (hudEl && !hudEl.hidden ? hudEl.getBoundingClientRect().bottom - mapTop : 0) + 24;
    const bottom = (sheetEl && !sheetEl.hidden ? boxH - (sheetEl.getBoundingClientRect().top - mapTop) : 0) + 24;
    map.stop();
    // (not fitBounds: it refuses, and does nothing at all, when the two places will not fit with the padding, as with a river in the north and
    // one in the south; this works out the zoom for the area between the top card and the answers, and centres on the middle of that area)
    const W = map.getContainer().clientWidth || 400;
    const availW = Math.max(120, W - 72), availH = Math.max(120, boxH - top - bottom);
    const dx = Math.max(1, (bb[2] - bb[0]) * 84200), dy = Math.max(1, (bb[3] - bb[1]) * 111000);
    const mpp0 = 78271.5 * Math.cos((((bb[1] + bb[3]) / 2) * Math.PI) / 180);
    const z = Math.max(6.2, Math.min(12.4, Math.log2(Math.min((availW * mpp0) / dx, (availH * mpp0) / dy)) - 0.15));
    map.easeTo({ center: [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], zoom: z, pitch: z < 8.8 ? 0 : 32, bearing: 0, padding: { top, bottom, left: 36, right: 36 }, duration: ctx.dur ? ctx.dur(1100) : 1100, essential: true });
  }

  function reveal() {
    const t = q.t;
    const pic = city.pics[t.n] || city.pics[ALIAS[t.n]];
    return `<div class="fb ${q.ok ? 'ok' : 'no'} orb-reveal">
      ${pic ? `<img class="orb-thumb" src="${esc(pic.img)}" alt="Photo of ${esc(t.n)}: tap to enlarge" data-n="${esc(t.n)}" tabindex="0" />` : ''}
      <div><b>${q.ok ? '✓' : '✗'} ${esc(t.n)}</b> <span class="muted">${q.ok ? `+${q.pts}` : ''}</span>${cfg && t.k === 'nat' && !q.ok && q.picked ? `<div class="orb-legend"><span style="display:inline-block;width:.8em;height:.8em;border-radius:2px;background:${GEOM_COLOR.target};margin-right:.35em"></span>${esc(t.n)}<br><span style="display:inline-block;width:.8em;height:.8em;border-radius:2px;background:${GEOM_COLOR.wrong};margin-right:.35em"></span>${esc(q.picked)} <span class="muted">(your pick)</span></div>` : ''}<br>
      ${esc(t.line)}.<br><span class="muted">${t.k === 'nat' ? `${t.elev ? `${t.elev.toLocaleString()} ft · ` : ''}${esc(t.at)}, ${esc(t.c)} County` : `${t.k === 'lm' ? '' : `${t.h} m (${ft(t.h)} ft) · `}${t.y} · ${esc(t.at)}`}</span></div>
    </div>`;
  }
  /** The photo large, over everything, with its credit; a tap anywhere (or Escape) closes it. */
  function openPhoto(t) {
    const pic = city.pics[t.n] || city.pics[ALIAS[t.n]];
    if (!pic) return;
    let box = document.getElementById('orbPhoto');
    if (!box) {
      box = document.createElement('div');
      box.id = 'orbPhoto';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      document.body.appendChild(box);
      box.addEventListener('click', (e) => { if (e.target.tagName !== 'A') box.hidden = true; });
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') box.hidden = true; });
    }
    const credit = [pic.author && `Photo: ${esc(pic.author)}`, pic.license && esc(pic.license)].filter(Boolean).join(', ');
    box.innerHTML = `<figure><img src="${esc(pic.img)}" alt="${esc(t.n)}"><figcaption><b>${esc(t.n)}</b><br>${credit}${pic.page ? ` · <a href="${esc(pic.page)}" target="_blank" rel="noopener">source</a>` : ''}<br><span class="muted">Tap to close</span></figcaption></figure>`;
    box.hidden = false;
    // the saved picture is small: swap in a larger one from Wikimedia Commons when it arrives (and the phone is online)
    if (pic.file && navigator.onLine !== false) {
      const big = new Image();
      big.onload = () => { const cur = box.querySelector('img'); if (cur && !box.hidden && box.dataset.n === t.n) cur.src = big.src; };
      box.dataset.n = t.n;
      big.src = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(pic.file)}?width=900`;
    }
  }
  function render() {
    if (!run || run.loading) return;
    if (run.done) {
      const best = run.pts + '/' + ROUND * 3;
      ctx.hud(`<div class="qkind">${ICON} ${TITLE}</div><div class="q">Round done: <b>${best}</b></div>`);
      ctx.sheet(`${run.opts.header()}<div id="qbody">
        <div class="score">${run.right}/${ROUND} named · ${run.pts} points</div>
        ${run.misses.length ? `<div class="fb no">To look at again: ${run.misses.map(esc).join(', ')}</div>` : '<div class="fb ok">Every one named.</div>'}
        <button class="primary" id="orbAgain">Another ten</button></div>`);
      run.opts.bindHeader();
      document.getElementById('orbAgain')?.addEventListener('click', () => start(run.opts));
      return;
    }
    const hints = HINTS.slice(0, q.hints).map((h) => `<div class="orb-hint">${h(q.t)}</div>`).join('');
    const where = q.hood && q.t.k !== 'nat' ? `<div class="orb-where">📍 ${esc(q.hood)}</div>` : '';
    ctx.hud(`<div class="qkind">${ICON} ${TITLE} · ${run.n + (q.done ? 0 : 1)}/${ROUND}</div><div class="q">${q.done ? (q.ok ? 'Yes.' : 'Not quite.') : q.flying ? 'Swinging over…' : (cfg ? `Which ${NOUN[q.t.kind] || 'place'} is this?` : q.t.k === 'lm' ? 'Which landmark is this?' : 'Which tower is this?')}</div>${q.flying ? '' : where}${q.flying ? '' : hints}`);
    const btn = (c) => {
      const cls = q.done ? (c.n === q.t.n ? ' right' : c.n === q.picked ? ' wrong' : '') : '';
      return `<button class="orb-choice${cls}" data-n="${esc(c.n)}"${q.done || q.flying ? ' disabled' : ''}>${esc(c.n)}</button>`;
    };
    ctx.sheet(`${run.opts.header()}<div id="qbody">
      <div class="score"><button type="button" id="orbSpin" class="orb-mini" aria-pressed="${spinOn}">${spinOn ? '↻ Orbiting' : '✋ Drag to turn'}</button> ${run.pts} points${run.streak >= 3 ? ` · 🔥 ${run.streak}` : ''}</div>
      <div class="orb-choices">${q.choices.map(btn).join('')}</div>
      ${q.done ? `${reveal()}<button class="primary" id="orbNext">${run.n >= ROUND ? 'Finish' : cfg || q.t.k === 'lm' ? 'Next' : 'Next tower'}</button>` : `<button id="orbHint"${q.hints >= HINTS.length || q.flying ? ' disabled' : ''}>💡 Hint (−1 point)</button>`}
    </div>`);
    run.opts.bindHeader();
    for (const b of document.querySelectorAll('.orb-choice')) b.addEventListener('click', () => answer(b.dataset.n));
    document.getElementById('orbNext')?.addEventListener('click', next);
    document.getElementById('orbSpin')?.addEventListener('click', () => {
      spinOn = !spinOn;
      ctx.store.set('orbit.spin', spinOn);
      render();
    });
    document.querySelector('.orb-thumb')?.addEventListener('click', () => openPhoto(q.t));
    document.getElementById('orbHint')?.addEventListener('click', hint);
  }

  return {
    start,
    stop,
    get running() {
      return !!run;
    },
    _state: () => ({ run, q }),
  };
}
