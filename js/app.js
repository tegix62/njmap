/* global maplibregl, topojson */
import { bbox, makeLocator, bearing, distanceMi, compass16, dirWord } from './geo.js';
import { resolveGroups } from './confusables.js';
import { store } from './store.js';
import { initDrive } from './drive.js';
import { initExplore } from './explore.js';
import { initPractice } from './practice.js';
import { LANDMARKS } from './knowledge.js';
import { notes } from './notes.js';

// Hand-assigned so that bordering counties never share a color.
const PALETTE = {
  A: '#f4a261', B: '#8ecae6', C: '#a7c957', D: '#cdb4db', E: '#ffd166', F: '#f28482', G: '#84a59d',
};
const COUNTY_COLOR = {
  Sussex: 'A', Warren: 'B', Passaic: 'C', Bergen: 'D', Morris: 'E', Essex: 'F', Hudson: 'A',
  Union: 'B', Hunterdon: 'C', Somerset: 'D', Middlesex: 'G', Mercer: 'F', Monmouth: 'E',
  Burlington: 'B', Ocean: 'C', Atlantic: 'D', Camden: 'A', Gloucester: 'E', Salem: 'C',
  Cumberland: 'B', 'Cape May': 'F',
};

// Background map: OpenFreeMap vector tiles (OpenStreetMap data, no API key,
// no usage limits). Only water and roads are drawn; OSM place names are left
// out on purpose so the only town names on screen are the official ones.
const OMT_SOURCE = {
  type: 'vector',
  url: 'https://tiles.openfreemap.org/planet',
};
const ROAD_CLASSES = {
  major: ['motorway', 'trunk', 'primary'],
  mid: ['secondary', 'tertiary'],
  minor: ['minor'],
};
const isClass = (list) => ['match', ['get', 'class'], list, true, false];
const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];
const roadWidth = (a, b, c) => ['interpolate', ['exponential', 1.5], ['zoom'], 8, a, 12, b, 16, c];
// [layer, which basemaps show it]
const BASE_LAYERS = [
  [{ id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#a9cbe3' } }, 'streets light'],
  [
    {
      id: 'river',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      filter: ['==', ['get', 'class'], 'river'],
      paint: { 'line-color': '#a9cbe3', 'line-width': roadWidth(0.6, 1.5, 4) },
    },
    'streets light',
  ],
  [
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['all', isClass(ROAD_CLASSES.minor), notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': roadWidth(0.3, 0.8, 7) },
    },
    'streets',
  ],
  [
    {
      id: 'road-mid',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 9,
      filter: ['all', isClass(ROAD_CLASSES.mid), notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#fffdf5', 'line-width': roadWidth(0.4, 1.4, 9) },
    },
    'streets',
  ],
  [
    {
      id: 'road-major-casing',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['all', isClass(ROAD_CLASSES.major), notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#9a6a2f', 'line-opacity': 0.5, 'line-width': roadWidth(1.2, 3.6, 16) },
    },
    'streets light',
  ],
  [
    {
      id: 'road-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['all', isClass(ROAD_CLASSES.major), notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], 'motorway', '#f6b26b', 'trunk', '#fcd38a', '#fde9a9'],
        'line-width': roadWidth(0.7, 2.4, 13),
      },
    },
    'streets light',
  ],
  [
    {
      id: 'road-focus',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation_name',
      filter: ['==', ['get', 'ref'], '__none__'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#2563eb', 'line-opacity': 0.75, 'line-width': roadWidth(3, 6, 18) },
    },
    'streets light',
  ],
];
// Drawn above the town fills/lines, below the town names.
const BASE_LABEL_LAYERS = [
  [
    {
      id: 'river-name',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'waterway',
      minzoom: 9.5,
      filter: ['all', ['==', ['get', 'class'], 'river'], ['has', 'name']],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 400,
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Italic'],
        'text-size': 12,
        'text-letter-spacing': 0.05,
      },
      paint: { 'text-color': '#2b6cb0', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.4 },
    },
    'streets light',
  ],
  [
    {
      id: 'lake-name',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      minzoom: 9.5,
      filter: ['match', ['get', 'class'], ['lake', 'bay', 'reservoir'], true, false],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'text-max-width': 7 },
      paint: { 'text-color': '#2b6cb0', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.4 },
    },
    'streets light',
  ],
  [
    {
      id: 'road-ref',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 9,
      filter: ['all', isClass(['motorway', 'trunk', 'primary']), ['has', 'ref']],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 350,
        'text-field': ['get', 'ref'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 11,
        'text-rotation-alignment': 'viewport',
        'text-padding': 4,
      },
      paint: { 'text-color': '#7c4a03', 'text-halo-color': '#fff7e6', 'text-halo-width': 2 },
    },
    'streets',
  ],
  [
    {
      id: 'road-name',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 14,
      filter: isClass(['primary', 'secondary', 'tertiary', 'minor']),
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Italic'],
        'text-size': 11,
        'text-padding': 4,
      },
      paint: { 'text-color': '#475467', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    },
    'streets',
  ],
];
const withVis = (pairs, key) =>
  pairs.map(([l, modes]) => ({ ...l, layout: { ...(l.layout || {}), visibility: modes.split(' ').includes(key) ? 'visible' : 'none' } }));

const TYPE_ABBR = { Township: 'Twp', Borough: 'Boro', City: 'City', Town: 'Town', Village: 'Vlg' };
const HL_COLORS = { cur: '#f59e0b', sel: '#2563eb', good: '#16a34a', bad: '#dc2626', q: '#7c3aed', near: '#94a3b8' };

const DEFAULT_SETTINGS = {
  voice: true,
  voiceHints: true,
  basemap: 'streets',
  northUp: false,
  driveLabels: true,
  wakeLock: true,
  phoneCompass: true,
};

async function main() {
  const [topo, sectionsByKey] = await Promise.all([
    fetch('data/nj.topo.json').then((r) => r.json()),
    fetch('data/sections.json')
      .then((r) => r.json())
      .catch(() => ({})),
  ]);
  const fc = (o) => topojson.feature(topo, topo.objects[o]);
  const munisFC = fc('munis');
  const labelsFC = fc('labels');
  const countiesFC = fc('counties');
  const countyLabelsFC = fc('countylabels');
  const nbIdx = topojson.neighbors(topo.objects.munis.geometries);

  const nameCount = {};
  for (const f of munisFC.features) nameCount[f.properties.n] = (nameCount[f.properties.n] || 0) + 1;

  const munis = munisFC.features.map((f, i) => {
    const p = f.properties;
    const dup = nameCount[p.n] > 1;
    return {
      id: i,
      n: p.n,
      t: p.t,
      full: p.full,
      c: p.c,
      p: p.p,
      key: `${p.full}|${p.c}`,
      dup,
      mapLabel: dup ? `${p.n} ${TYPE_ABBR[p.t] || p.t}` : p.n,
      geom: f.geometry,
      bbox: bbox(f.geometry),
      pt: labelsFC.features[i].geometry.coordinates,
    };
  });
  munis.forEach((m, i) => {
    m.neighbors = nbIdx[i].map((j) => munis[j]);
    // Villages / sections inside this municipality: [{name, known}], well-known first
    m.sections = (sectionsByKey[m.key] || []).map(([name, known]) => ({ name, known: !!known }));
  });
  // Names drawn on the map as sections. Skip any that are also a municipality's
  // name (Hanover's "Monroe"), which would read as the wrong town.
  const muniNames = new Set(munis.map((m) => m.n.toLowerCase()));
  const sectionNames = [...new Set(munis.flatMap((m) => m.sections.map((x) => x.name)))].filter(
    (n) => !muniNames.has(n.toLowerCase())
  );
  const byKey = new Map(munis.map((m) => [m.key, m]));
  const confusables = resolveGroups(munis);
  const counties = countiesFC.features.map((f) => f.properties.c).sort();

  const settings = { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };

  // ---- map ------------------------------------------------------------------
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const countyColorExpr = ['match', ['get', 'c']];
  for (const [c, k] of Object.entries(COUNTY_COLOR)) countyColorExpr.push(c, PALETTE[k]);
  countyColorExpr.push('#dddddd');
  const hlColorExpr = ['match', ['coalesce', ['feature-state', 'hl'], '']];
  for (const [k, v] of Object.entries(HL_COLORS)) hlColorExpr.push(k, v);
  hlColorExpr.push('rgba(0,0,0,0)');

  const munisData = {
    type: 'FeatureCollection',
    features: munisFC.features.map((f, i) => ({ type: 'Feature', id: i, properties: { c: f.properties.c }, geometry: f.geometry })),
  };
  const labelsData = {
    type: 'FeatureCollection',
    features: munis.map((m) => ({
      type: 'Feature',
      id: m.id,
      properties: { label: m.mapLabel, p: m.p },
      geometry: { type: 'Point', coordinates: m.pt },
    })),
  };
  const empty = { type: 'FeatureCollection', features: [] };
  const landmarks = LANDMARKS.filter((l) => byKey.has(l.town)).map((l, i) => ({ ...l, id: i, m: byKey.get(l.town) }));
  const landmarksData = {
    type: 'FeatureCollection',
    features: landmarks.map((l) => ({ type: 'Feature', id: l.id, properties: { name: l.name }, geometry: { type: 'Point', coordinates: l.pt } })),
  };
  if (!['streets', 'light', 'none'].includes(settings.basemap)) settings.basemap = 'streets';

  const map = new maplibregl.Map({
    container: 'map',
    attributionControl: false,
    bounds: [
      [-75.56, 38.93],
      [-73.89, 41.36],
    ],
    fitBoundsOptions: { padding: 20 },
    maxBounds: [
      [-78, 37.5],
      [-71.5, 42.5],
    ],
    dragRotate: true,
    pitchWithRotate: false,
    touchPitch: false,
    style: {
      version: 8,
      glyphs: base + 'fonts/{fontstack}/{range}.pbf',
      sources: {
        omt: OMT_SOURCE,
        munis: { type: 'geojson', data: munisData },
        counties: { type: 'geojson', data: countiesFC, attribution: 'Boundaries: <a href="https://njogis-newjersey.opendata.arcgis.com/">NJOGIS</a>' },
        labels: { type: 'geojson', data: labelsData },
        countylabels: { type: 'geojson', data: countyLabelsFC },
        landmarks: { type: 'geojson', data: landmarksData },
        reveal: { type: 'geojson', data: empty },
        qline: { type: 'geojson', data: empty },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#e9ede6' } },
        {
          id: 'muni-fill',
          type: 'fill',
          source: 'munis',
          paint: {
            'fill-color': countyColorExpr,
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.45, 11, 0.22, 14, 0.12],
          },
        },
        {
          id: 'muni-hl',
          type: 'fill',
          source: 'munis',
          paint: { 'fill-color': hlColorExpr, 'fill-opacity': 0.42 },
        },
        // Water and roads sit above the county tint so they stay crisp.
        ...withVis(BASE_LAYERS, settings.basemap),
        {
          id: 'muni-line',
          type: 'line',
          source: 'munis',
          paint: {
            'line-color': '#344054',
            'line-opacity': 0.75,
            'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.25, 10, 0.8, 13, 1.6, 16, 2.5],
          },
        },
        {
          id: 'county-line',
          type: 'line',
          source: 'counties',
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': '#101828',
            'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.2, 10, 2.2, 13, 3.5, 16, 5],
          },
        },
        {
          id: 'muni-hl-line',
          type: 'line',
          source: 'munis',
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': hlColorExpr,
            'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 12, 3.5, 16, 5],
          },
        },
        {
          id: 'qline',
          type: 'line',
          source: 'qline',
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': '#101828', 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
        },
        ...withVis(BASE_LABEL_LAYERS, settings.basemap),
        {
          id: 'county-label',
          type: 'symbol',
          source: 'countylabels',
          maxzoom: 10.5,
          layout: {
            'text-field': ['upcase', ['get', 'c']],
            'text-font': ['Noto Sans Italic'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 9, 15],
            'text-letter-spacing': 0.15,
            'symbol-sort-key': 0,
          },
          paint: { 'text-color': '#7a2e0e', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.5 },
        },
        {
          // Villages & sections (Towaco, Pompton Plains…): position from
          // OpenStreetMap place points in the background tiles, shown only when
          // the name is on the official local-names list.
          id: 'section-label',
          type: 'symbol',
          source: 'omt',
          'source-layer': 'place',
          minzoom: 11.5,
          filter: [
            'all',
            ['match', ['get', 'class'], ['town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood'], true, false],
            ['in', ['get', 'name'], ['literal', sectionNames]],
          ],
          layout: {
            visibility: settings.basemap === 'none' ? 'none' : 'visible',
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Italic'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 11.5, 11, 16, 14],
            'text-padding': 4,
            'text-max-width': 8,
            'text-rotation-alignment': 'viewport',
          },
          paint: { 'text-color': '#55606f', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 },
        },
        {
          id: 'landmark-dot',
          type: 'circle',
          source: 'landmarks',
          minzoom: 8.5,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8.5, 3, 13, 5.5],
            'circle-color': '#9f1239',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
          },
        },
        {
          id: 'landmark-label',
          type: 'symbol',
          source: 'landmarks',
          minzoom: 10,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 11.5,
            'text-anchor': 'top',
            'text-offset': [0, 0.6],
            'text-max-width': 8,
            'text-optional': true,
          },
          paint: { 'text-color': '#9f1239', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
        },
        {
          id: 'muni-label',
          type: 'symbol',
          source: 'labels',
          minzoom: 8.3,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 8.3, 10, 11, 12.5, 14, 15, 16, 18],
            'text-max-width': 7,
            'text-padding': 3,
            'symbol-sort-key': ['-', 0, ['get', 'p']],
            'text-rotation-alignment': 'viewport',
          },
          paint: {
            'text-color': '#101828',
            'text-halo-color': 'rgba(255,255,255,0.92)',
            'text-halo-width': 1.6,
            // Explore "focus": the selected town and its neighbors stay solid.
            'text-opacity': ['case', ['boolean', ['global-state', 'focusing'], false], ['case', ['boolean', ['feature-state', 'focus'], false], 1, 0.28], 1],
          },
        },
        {
          id: 'reveal-label',
          type: 'symbol',
          source: 'reveal',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 16,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-max-width': 9,
          },
          paint: { 'text-color': ['coalesce', ['get', 'color'], '#101828'], 'text-halo-color': '#ffffff', 'text-halo-width': 2.2 },
        },
      ],
    },
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial', maxWidth: 90 }), 'bottom-left');
  // Wait for the style only (all local), not 'load', which also waits on
  // background tiles and would stall with no signal.
  await new Promise((r) => (map.isStyleLoaded() ? r() : map.once('style.load', r)));

  // ---- shared context ---------------------------------------------------------
  const $ = (s) => document.querySelector(s);
  const hudEl = $('#hud');
  const sheetEl = $('#sheet');
  const highlighted = new Map();
  let labelsOn = true;
  let focused = [];
  let tinted = [];
  let toastTimer = 0;

  const ctx = {
    map,
    munis,
    byKey,
    counties,
    confusables,
    settings,
    store,
    locate: makeLocator(munis),
    pos: null, // {pt, acc, speed, heading, t}
    mode: null,
    sub: (m) => `${m.t} · ${m.c} County`,
    name: (m) => (m.dup ? `${m.n} ${TYPE_ABBR[m.t] || m.t} (${m.c})` : m.n),
    saveSettings() {
      store.set('settings', settings);
    },
    hud(html) {
      hudEl.innerHTML = html;
      hudEl.hidden = !html;
      requestAnimationFrame(updateEdges);
    },
    sheet(html) {
      sheetEl.innerHTML = html;
      sheetEl.hidden = !html;
      requestAnimationFrame(updateEdges);
    },
    highlight(id, kind) {
      if (kind) {
        map.setFeatureState({ source: 'munis', id }, { hl: kind });
        highlighted.set(id, kind);
      } else {
        map.removeFeatureState({ source: 'munis', id }, 'hl');
        highlighted.delete(id);
      }
    },
    clearHighlights(except) {
      for (const id of [...highlighted.keys()]) if (!except || !except(id, highlighted.get(id))) ctx.highlight(id, null);
    },
    reveal(items) {
      map.getSource('reveal').setData({
        type: 'FeatureCollection',
        features: items.map(({ m, color, label, pt }) => ({
          type: 'Feature',
          properties: { label: label || m.mapLabel, color },
          geometry: { type: 'Point', coordinates: pt || m.pt },
        })),
      });
    },
    line(coords) {
      map.getSource('qline').setData(
        coords ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } : empty
      );
    },
    showLabels(on) {
      labelsOn = on;
      map.setLayoutProperty('muni-label', 'visibility', on ? 'visible' : 'none');
      map.setLayoutProperty('section-label', 'visibility', on && settings.basemap !== 'none' ? 'visible' : 'none');
      for (const id of ['landmark-dot', 'landmark-label']) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    },
    padding() {
      const top = hudEl.hidden ? 12 : hudEl.getBoundingClientRect().bottom + 12;
      const sheetTop = sheetEl.hidden ? $('#tabs').getBoundingClientRect().top : sheetEl.getBoundingClientRect().top;
      const bottom = Math.max(12, window.innerHeight - sheetTop + 12);
      return { top, bottom, left: 16, right: 56 };
    },
    fit(items, maxZoom = 13) {
      // fitBounds adds any padding already stored on the map; keep it at zero.
      const mp = map.getPadding();
      if (mp.top || mp.bottom || mp.left || mp.right) map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      let b = null;
      for (const it of items) {
        const bb = Array.isArray(it) ? [it[0], it[1], it[0], it[1]] : it.bbox;
        b = b ? [Math.min(b[0], bb[0]), Math.min(b[1], bb[1]), Math.max(b[2], bb[2]), Math.max(b[3], bb[3])] : bb;
      }
      if (!b) return;
      map.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: ctx.padding(), maxZoom, bearing: map.getBearing(), duration: 600 }
      );
    },
    /** "12 mi NW of Clifton" style phrase: where `to` sits relative to `from`. */
    relative(fromPt, toPt) {
      const d = distanceMi(fromPt, toPt);
      const dir = compass16(bearing(fromPt, toPt));
      return { d, dir, text: `${d < 10 ? d.toFixed(1) : Math.round(d)} mi ${dir}`, words: `${d < 10 ? d.toFixed(1) : Math.round(d)} miles ${dirWord(dir)}` };
    },
    /** Queued, so a town announcement doesn't cut off a road note (or vice versa). */
    speak(text) {
      if (!settings.voice || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      speechSynthesis.speak(u);
    },
    setBasemap(key) {
      settings.basemap = key;
      ctx.saveSettings();
      for (const [l, modes] of [...BASE_LAYERS, ...BASE_LABEL_LAYERS])
        map.setLayoutProperty(l.id, 'visibility', modes.split(' ').includes(key) ? 'visible' : 'none');
      ctx.showLabels(labelsOn);
    },
    /**
     * Sections of `m` that the loaded background tiles can place on the map:
     * Map<lowercased name, {name, pt}>. Empty offline or with the basemap off.
     */
    placedSections(m) {
      const out = new Map();
      if (!m.sections.length || settings.basemap === 'none' || !map.getSource('omt')) return out;
      const want = new Map(m.sections.map((x) => [x.name.toLowerCase(), x.name]));
      let feats = [];
      try {
        feats = map.querySourceFeatures('omt', { sourceLayer: 'place' });
      } catch {
        return out;
      }
      for (const f of feats) {
        const n = f.properties && f.properties.name;
        if (!n || f.geometry.type !== 'Point') continue;
        const k = n.toLowerCase();
        if (!want.has(k) || out.has(k)) continue;
        const pt = f.geometry.coordinates;
        if (ctx.locate(pt) !== m) continue; // must actually sit inside this town
        out.set(k, { name: want.get(k), pt });
      }
      return out;
    },
    landmarks,
    notes,
    /**
     * Focus a town: tint its neighbors and fade every other town label.
     * Pass null to clear.
     */
    focus(m) {
      for (const id of focused) map.removeFeatureState({ source: 'labels', id }, 'focus');
      for (const id of tinted) if (highlighted.get(id) === 'near') ctx.highlight(id, null);
      focused = [];
      tinted = [];
      if (m) {
        for (const o of [m, ...m.neighbors]) {
          map.setFeatureState({ source: 'labels', id: o.id }, { focus: true });
          focused.push(o.id);
        }
        for (const o of m.neighbors)
          if (!highlighted.has(o.id)) {
            ctx.highlight(o.id, 'near');
            tinted.push(o.id);
          }
      }
      map.setGlobalStateProperty('focusing', !!m);
    },
    /** Highlight one road (its raw OSM refs) on the map; null clears. */
    focusRoad(raw) {
      map.setFilter('road-focus', raw && raw.length ? ['in', ['get', 'ref'], ['literal', raw]] : ['==', ['get', 'ref'], '__none__']);
    },
    toast(msg, ms = 3200) {
      const t = $('#toast');
      t.textContent = msg;
      t.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (t.hidden = true), ms);
    },
    updateEdges: () => updateEdges(),
  };
  window.njtf = ctx; // handy for debugging from the console

  // ---- compass edge labels ----------------------------------------------------
  // N/E/S/W letters pinned to the edges of the visible map, rotated with it, so
  // in heading-up mode you can see at a glance that "north is to my left".
  const edgeEls = [...document.querySelectorAll('#edges span')];
  function updateEdges() {
    const W = window.innerWidth;
    const top = hudEl.hidden ? 8 : hudEl.getBoundingClientRect().bottom + 4;
    const sheetTop = sheetEl.hidden ? $('#tabs').getBoundingClientRect().top : sheetEl.getBoundingClientRect().top;
    const bottom = sheetTop - 4;
    const inset = 16;
    let cx = W / 2;
    let cy = (top + bottom) / 2;
    if (ctx.pos && ctx.mode === 'drive') {
      const p = map.project(ctx.pos.pt);
      if (p.x > inset && p.x < W - inset && p.y > top + inset && p.y < bottom - inset) {
        cx = p.x;
        cy = p.y;
      }
    }
    const b = map.getBearing();
    for (const el of edgeEls) {
      const a = (((+el.dataset.d - b) % 360) + 360) % 360;
      const r = (a * Math.PI) / 180;
      const dx = Math.sin(r);
      const dy = -Math.cos(r);
      const tx = dx > 0 ? (W - inset - cx) / dx : dx < 0 ? (inset - cx) / dx : Infinity;
      const ty = dy > 0 ? (bottom - inset - cy) / dy : dy < 0 ? (top + inset - cy) / dy : Infinity;
      const t = Math.max(0, Math.min(tx, ty));
      el.style.transform = `translate(${cx + dx * t}px, ${cy + dy * t}px) translate(-50%, -50%)`;
    }
    $('#compass .rose').style.transform = `rotate(${-b}deg)`;
  }
  map.on('move', updateEdges);
  window.addEventListener('resize', updateEdges);

  // ---- modes ----------------------------------------------------------------
  const modes = {
    drive: initDrive(ctx),
    explore: initExplore(ctx),
    practice: initPractice(ctx),
  };
  ctx.modes = modes;

  function setMode(m) {
    if (ctx.mode === m) return;
    if (ctx.mode) modes[ctx.mode].leave();
    ctx.mode = m;
    document.body.dataset.mode = m;
    for (const b of document.querySelectorAll('#tabs [data-mode]')) b.setAttribute('aria-selected', b.dataset.mode === m);
    store.set('mode', m);
    // Study modes are north-up; Drive re-applies its own orientation.
    if (m !== 'drive' && map.getBearing() !== 0) map.jumpTo({ bearing: 0 });
    modes[m].enter();
    updateEdges();
  }
  ctx.setMode = setMode;
  for (const b of document.querySelectorAll('#tabs [data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));

  // compass button: north-up <-> heading-up (drive) / reset to north (other modes)
  $('#compass').addEventListener('click', () => {
    if (ctx.mode === 'drive') modes.drive.toggleOrientation();
    else map.easeTo({ bearing: 0, duration: 400 });
  });
  $('#recenter').addEventListener('click', () => modes.drive.recenter());

  // ---- settings dialog ------------------------------------------------------
  const dlg = $('#settings');
  $('#settingsBtn').addEventListener('click', () => {
    for (const el of dlg.querySelectorAll('[data-setting]')) {
      const k = el.dataset.setting;
      if (el.type === 'checkbox') el.checked = !!settings[k];
      else el.value = settings[k];
    }
    dlg.showModal();
  });
  dlg.addEventListener('change', (e) => {
    const el = e.target;
    const k = el.dataset.setting;
    if (!k) return;
    settings[k] = el.type === 'checkbox' ? el.checked : el.value;
    ctx.saveSettings();
    if (k === 'basemap') ctx.setBasemap(el.value);
    if (k === 'northUp') modes.drive.applyOrientation();
    if (k === 'driveLabels' && ctx.mode === 'drive') ctx.showLabels(settings.driveLabels);
  });
  $('#resetStats').addEventListener('click', () => {
    if (confirm('Clear practice scores?')) store.del('stats');
  });
  $('#resetVisited').addEventListener('click', () => {
    if (confirm('Forget the list of towns you have driven through?')) store.del('visited');
  });
  $('#closeSettings').addEventListener('click', () => dlg.close());
  $('#exportNotes').addEventListener('click', () => {
    const blob = new Blob([notes.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `townfinder-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importNotes').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const n = notes.importJSON(await f.text());
      ctx.toast(`Imported ${n} note${n === 1 ? '' : 's'}`);
    } catch (err) {
      ctx.toast(`Couldn't import: ${err.message}`);
    }
    e.target.value = '';
  });
  $('#stopTracking').addEventListener('click', () => {
    modes.drive.stop();
    dlg.close();
  });

  setMode(store.get('mode', 'drive'));
  document.body.classList.add('ready');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  document.getElementById('hud').hidden = false;
  document.getElementById('hud').innerHTML = `<div class="town">Couldn't load the map</div><div class="meta">${String(err.message || err)}</div>`;
});
