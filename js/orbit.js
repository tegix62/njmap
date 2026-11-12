// "Name that tower": the camera circles one skyscraper, slowly, alone in a faint ghost of the city; which is it?
//
// Ten towers a round, four names to choose from. Hints cost a point (neighborhood, then height and year, then the corner it
// stands on). The towers you miss come round more often. The shapes are the same ones Explore and the drive games stand up
// (NYC's footprints and the surveyed towers); the base map's labels are hidden so nothing gives the name away.
import { buildingFeatures, applySurveyTowers, applyParts, loadParts, loadSurveyTowers, groundFeatures, GROUND_PAINT } from './city3d.js';
import { createMeshLayer } from './meshes.js';

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
  let run = null; // the session
  let q = null; // the question
  let raf = 0;
  let city = null; // loaded once: { feats, cx, cy, list, pics }
  let loading = null;
  const meshes = createMeshLayer(map); // the towers the survey has as real triangle meshes
  const canMesh = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  let hiddenSymbols = [];
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
      const meshList = md ? md.t.map(({ n, lon, lat, h }) => ({ n, lon, lat, h })) : [];
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
      return n === 0 ? 3 : 1 + 4 * (s.w / n);
    });
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) if ((x -= w[i]) <= 0) return city.list[i];
    return city.list.find((t) => !run.seen.includes(t.n)) || rand(city.list);
  }
  function choicesFor(t) {
    const others = city.list.filter((o) => o.n !== t.n);
    const near = shuffle(others.filter((o) => Math.abs(o.h - t.h) / t.h < 0.3));
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
    const taken = new Set(city.list.map((x) => x.n));
    for (const [tower, lm] of Object.entries(ALIAS)) if (taken.has(tower)) taken.add(lm);
    const lm = city.lms.filter((l) => !taken.has(l.n) && mDist(l.p, p) < 700 && mDist(l.p, p) > 25).sort((a, b) => mDist(a.p, p) - mDist(b.p, p)).slice(0, 6).map((l) => ({ type: 'Feature', properties: { name: l.n }, geometry: { type: 'Point', coordinates: l.p } }));
    map.getSource('orb-lm').setData({ type: 'FeatureCollection', features: lm });
    // the neighbourhood
    const m = ctx.locate ? ctx.locate(p) : null;
    q.hood = m ? m.n : null;
    if (m) {
      map.getSource('orb-hood').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: m.geom }, { type: 'Feature', properties: { name: m.mapLabel || m.n }, geometry: { type: 'Point', coordinates: m.pt } }] });
      map.getSource('orb-wall').setData({ type: 'FeatureCollection', features: wallFeatures(m.geom) });
    } else {
      map.getSource('orb-hood').setData({ type: 'FeatureCollection', features: [] });
      map.getSource('orb-wall').setData({ type: 'FeatureCollection', features: [] });
    }
  }

  /** Make this tower the solid one: everything standing within 60 m that is part of it, the rest left as the ghost. */
  function focus(t) {
    const p = t.p;
    const ids = [], mine = [];
    // the building itself: the nearest one of about the right height (not its neighbours, even tall ones)
    let main = -1, bd = 110;
    const meshed = meshes.ok && meshes.has(t.n); // drawn as a real mesh: no slab is the target
    if (!meshed) city.feats.forEach((f, i) => {
      const d = mDist(city.cx[i], p);
      if (d < bd && f.properties.h >= 0.5 * t.h) { bd = d; main = i; }
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
    const zoom = Math.max(14.4, Math.min(16.9, Math.log2((mpp0 * 0.86 * free) / (1.15 * sinP * t.h))));
    const pxTall = (1.15 * sinP * t.h * Math.pow(2, zoom)) / mpp0;
    const baseY = pad.top + free / 2 + pxTall / 2;
    const top = Math.max(pad.top, 2 * baseY - (winH - pad.bottom));
    let bearing = spin0;
    let last = performance.now();
    let lastOcc = 0;
    const cam = { center: t.p, zoom, pitch: PITCH, bearing, padding: { top, bottom: pad.bottom, left: 0, right: 0 } };
    const tick = (now) => {
      if (!run || q.t !== t) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        bearing = map.getBearing();
        if (spinOn && !drag) {
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
    ctx.hud('<div class="qkind">🏙 Name that tower</div><div class="q">Loading the skyline…</div>');
    try {
      await load();
    } catch {
      if (run) ctx.hud('<div class="qkind">🏙 Name that tower</div><div class="q">Couldn’t load the buildings.</div>');
      return;
    }
    if (!run) return;
    run.loading = false;
    layers();
    if (canMesh) await meshes.load(map.getStyle().layers.find((l) => l.type === 'symbol')?.id);
    if (!run) return;
    map.setMaxPitch(70);
    show(true);
    dragOn();
    next();
  }
  function stop() {
    cancelAnimationFrame(raf);
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
    map.easeTo({ pitch: 0, duration: ctx.dur ? ctx.dur(400) : 400 });
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
    (t) => `<b>${t.h} m</b> (${ft(t.h)} ft), finished in <b>${t.y}</b>.`,
    (t) => `You'd find it at <b>${esc(t.at)}</b>.`,
    (t) => `${esc(t.line)}.`,
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
  }

  function reveal() {
    const t = q.t;
    const pic = city.pics[t.n] || city.pics[ALIAS[t.n]];
    return `<div class="fb ${q.ok ? 'ok' : 'no'} orb-reveal">
      ${pic ? `<img class="orb-thumb" src="${esc(pic.img)}" alt="Photo of ${esc(t.n)}: tap to enlarge" data-n="${esc(t.n)}" tabindex="0" />` : ''}
      <div><b>${q.ok ? '✓' : '✗'} ${esc(t.n)}</b> <span class="muted">${q.ok ? `+${q.pts}` : ''}</span><br>
      ${esc(t.line)}.<br><span class="muted">${t.h} m (${ft(t.h)} ft) · ${t.y} · ${esc(t.at)}</span></div>
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
      ctx.hud(`<div class="qkind">🏙 Name that tower</div><div class="q">Round done: <b>${best}</b></div>`);
      ctx.sheet(`${run.opts.header()}<div id="qbody">
        <div class="score">${run.right}/${ROUND} named · ${run.pts} points</div>
        ${run.misses.length ? `<div class="fb no">To look at again: ${run.misses.map(esc).join(', ')}</div>` : '<div class="fb ok">Every one named.</div>'}
        <button class="primary" id="orbAgain">Another ten</button></div>`);
      run.opts.bindHeader();
      document.getElementById('orbAgain')?.addEventListener('click', () => start(run.opts));
      return;
    }
    const hints = HINTS.slice(0, q.hints).map((h) => `<div class="orb-hint">${h(q.t)}</div>`).join('');
    const where = q.hood ? `<div class="orb-where">📍 ${esc(q.hood)}</div>` : '';
    ctx.hud(`<div class="qkind">🏙 Name that tower · ${run.n + (q.done ? 0 : 1)}/${ROUND}</div><div class="q">${q.done ? (q.ok ? 'Yes.' : 'Not quite.') : q.flying ? 'Swinging over…' : 'Which tower is this?'}</div>${q.flying ? '' : where}${q.flying ? '' : hints}`);
    const btn = (c) => {
      const cls = q.done ? (c.n === q.t.n ? ' right' : c.n === q.picked ? ' wrong' : '') : '';
      return `<button class="orb-choice${cls}" data-n="${esc(c.n)}"${q.done || q.flying ? ' disabled' : ''}>${esc(c.n)}</button>`;
    };
    ctx.sheet(`${run.opts.header()}<div id="qbody">
      <div class="score"><button type="button" id="orbSpin" class="orb-mini" aria-pressed="${spinOn}">${spinOn ? '↻ Orbiting' : '✋ Drag to turn'}</button> ${run.pts} points${run.streak >= 3 ? ` · 🔥 ${run.streak}` : ''}</div>
      <div class="orb-choices">${q.choices.map(btn).join('')}</div>
      ${q.done ? `${reveal()}<button class="primary" id="orbNext">${run.n >= ROUND ? 'Finish' : 'Next tower'}</button>` : `<button id="orbHint"${q.hints >= HINTS.length || q.flying ? ' disabled' : ''}>💡 Hint (−1 point)</button>`}
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
