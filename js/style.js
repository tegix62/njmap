// Builds the MapLibre style. Colors come from theme.js; this file decides
// what is drawn at which zoom.
//
// Four levels, each adding one kind of thing (after Kevin Lynch's paths,
// edges, districts, nodes and landmarks):
//   State  (< 8.3)   regions, counties, interstates/Turnpike/Parkway, big rivers
//   Region (8.3–10.3) county names, the largest towns, all main highways, landmarks
//   Town   (10.3–13)  every town name, secondary roads, lakes, landmark names
//   Street (13+)      villages and sections, local roads, street names
import { THEME } from './theme.js';
import { LABEL_EXPR } from './roadlabel.js';

let T = THEME; // the active theme; set by buildStyle()
let HWYS = []; // the region's highways with their colors; set by buildStyle()


const isClass = (list) => ['match', ['get', 'class'], list, true, false];
const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];
const roadWidth = (a, b, c) => ['interpolate', ['exponential', 1.5], ['zoom'], 8, a, 12, b, 16, c];
// Practice quiets the street network so the question's places stand out.
const QUIET = ['case', ['boolean', ['global-state', 'quiet'], false], 0.35, 1];
const fadeIn = (z0, z1) => ['interpolate', ['linear'], ['zoom'], z0, 0, z1, QUIET];

// Background (OpenFreeMap) layers: [layer, basemaps that show it]
const baseLayers = (Z) => [
  [{ id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': T.water } }, 'streets light'],
  [
    {
      id: 'river',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      filter: ['==', ['get', 'class'], 'river'],
      paint: { 'line-color': T.water, 'line-width': roadWidth(0.6, 1.5, 4) },
    },
    'streets light',
  ],
  [
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: Z.street - 0.5,
      filter: ['all', isClass(['minor']), notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': T.road.minor, 'line-width': roadWidth(0.3, 0.8, 7), 'line-opacity': fadeIn(Z.street - 0.5, Z.street) },
    },
    'streets',
  ],
  [
    {
      id: 'road-mid',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: Math.max(Z.town, 10.3) - 0.5,
      filter: ['all', isClass(['secondary', 'tertiary']), notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': T.road.mid, 'line-width': roadWidth(0.4, 1.4, 9), 'line-opacity': fadeIn(Math.max(Z.town, 10.3) - 0.5, Math.max(Z.town, 10.3)) },
    },
    'streets',
  ],
  [
    {
      id: 'road-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['all', isClass(['motorway', 'trunk', 'primary']), notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], 'motorway', T.road.motorway, T.road.major],
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'],
          8, ['match', ['get', 'class'], 'motorway', 1, 0.6],
          12, ['match', ['get', 'class'], 'motorway', 3, 2.2],
          16, ['match', ['get', 'class'], 'motorway', 14, 12]],
        // State level: interstates/Turnpike/Parkway only; the rest fade in at region level.
        'line-opacity': ['interpolate', ['linear'], ['zoom'], Z.region - 0.6, ['*', ['match', ['get', 'class'], 'motorway', 1, 0], QUIET], Z.region, QUIET],
      },
    },
    'streets light',
  ],
  [
    {
      // Each big highway in its own color (Turnpike purple, Parkway teal…)
      id: 'hwy-color',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 6,
      filter: HWYS.length
        ? ['all', ['==', ['get', 'class'], 'motorway'], ['in', LABEL_EXPR, ['literal', HWYS.map((h) => h.label)]]]
        : ['==', ['get', 'ref'], '__none__'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': HWYS.length
          ? ['match', LABEL_EXPR, ...HWYS.flatMap((h) => [h.label, h.color]), T.road.motorway]
          : T.road.motorway,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 6, 1.4, 9, 2.4, 12, 3.6, 16, 14],
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
      paint: { 'line-color': T.hl.sel, 'line-opacity': 0.75, 'line-width': roadWidth(3, 6, 18) },
    },
    'streets light',
  ],
  [
    {
      // the road you picked, when it was the wrong one
      id: 'road-focus-bad',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation_name',
      filter: ['==', ['get', 'ref'], '__none__'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': T.hl.bad, 'line-opacity': 0.75, 'line-width': roadWidth(3, 6, 18) },
    },
    'streets light',
  ],
];

const refLayer = (id, classes, minzoom) => ({
  id,
  type: 'symbol',
  source: 'omt',
  'source-layer': 'transportation_name',
  minzoom,
  filter: ['all', isClass(classes), ['has', 'ref']],
  layout: {
    'symbol-placement': 'line',
    'symbol-spacing': 350,
    'text-field': LABEL_EXPR,
    'text-font': ['Noto Sans Medium'],
    'text-size': 11,
    'text-rotation-alignment': 'viewport',
    'text-padding': 4,
  },
  paint: { 'text-color': T.road.ref, 'text-halo-color': T.road.refHalo, 'text-halo-width': 2 },
});

// Background labels: above town fills/lines, below town names
const baseLabelLayers = (Z) => [
  [
    {
      id: 'river-name',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'waterway',
      minzoom: 9,
      filter: ['all', ['==', ['get', 'class'], 'river'], ['has', 'name']],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 400,
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Italic'],
        'text-size': 12,
        'text-letter-spacing': 0.05,
      },
      paint: { 'text-color': T.waterInk, 'text-halo-color': T.halo, 'text-halo-width': 1.4 },
    },
    'streets light',
  ],
  [
    {
      id: 'lake-name',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      minzoom: Z.town,
      filter: ['match', ['get', 'class'], ['lake', 'bay', 'reservoir'], true, false],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'text-max-width': 7 },
      paint: { 'text-color': T.waterInk, 'text-halo-color': T.halo, 'text-halo-width': 1.4 },
    },
    'streets light',
  ],
  [refLayer('road-ref-major', ['motorway'], 7.5), 'streets'],
  [refLayer('road-ref', ['trunk', 'primary'], Z.town), 'streets'],
  [
    {
      id: 'road-name',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 14,
      filter: [
        'all',
        isClass(['primary', 'secondary', 'tertiary', 'minor']),
        // county routes already show their name in the route-label layer
        ['!', ['all', isClass(['trunk', 'primary']), ['==', ['slice', ['coalesce', ['get', 'ref'], ''], 0, 3], 'CR ']]],
      ],
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-padding': 4 },
      paint: { 'text-color': T.ink3, 'text-halo-color': T.halo, 'text-halo-width': 1.5 },
    },
    'streets',
  ],
];

const withVis = (pairs, key) =>
  pairs.map(([l, modes]) => ({ ...l, layout: { ...(l.layout || {}), visibility: modes.split(' ').includes(key) ? 'visible' : 'none' } }));

// Labels of the focused town + neighbors stay solid; the rest fade (Explore).
const focusOpacity = ['case', ['boolean', ['global-state', 'focusing'], false], ['case', ['boolean', ['feature-state', 'focus'], false], 1, 0.25], 1];

const muniLabel = (Z, id, minzoom, maxzoom, filter) => ({
  id,
  type: 'symbol',
  source: 'labels',
  minzoom,
  ...(maxzoom ? { maxzoom } : {}),
  ...(filter ? { filter } : {}),
  layout: {
    'text-field': ['get', 'label'],
    'text-font': ['Noto Sans Medium'],
    'text-size': ['interpolate', ['linear'], ['zoom'], Z.region, 10.5, Z.town, 12.5, 14, 15, 16, 18],
    'text-max-width': 7,
    'text-padding': 3,
    'symbol-sort-key': ['-', 0, ['get', 'p']],
    'text-rotation-alignment': 'viewport',
  },
  paint: { 'text-color': T.ink, 'text-halo-color': T.halo, 'text-halo-width': 1.6, 'text-opacity': focusOpacity },
});

/** Every layer that shows a town name (toggled together). */
export const MUNI_LABEL_IDS = ['muni-label-major', 'muni-label'];
export const PLACE_LAYER_IDS = ['landmark-dot', 'landmark-label', 'nature-dot', 'nature-label'];

/**
 * Returns { style, baseLayers } for a region. `Z` = the region's zoom levels:
 * { groups, region, town, street }.
 */
export function buildStyle({ base, basemap, data, sectionNames, Z, majorSize, groupTint, attribution, theme, highways, innerBorders }) {
  T = theme || THEME;
  HWYS = highways || [];
  const BASE_LAYERS = baseLayers(Z);
  const BASE_LABEL_LAYERS = baseLabelLayers(Z);
  const countyTint = ['match', ['get', 'c']];
  for (const [c, k] of Object.entries(groupTint)) countyTint.push(c, T.countyTint[k]);
  countyTint.push(T.land);
  const hl = ['match', ['coalesce', ['feature-state', 'hl'], '']];
  for (const [k, v] of Object.entries(T.hl)) hl.push(k, v);
  hl.push('rgba(0,0,0,0)');

  const style = {
    version: 8,
    glyphs: base + 'fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      munis: { type: 'geojson', data: data.munis },
      counties: { type: 'geojson', data: data.counties, attribution },
      ...(innerBorders ? { muniedges: { type: 'geojson', data: data.muniEdges }, countyedges: { type: 'geojson', data: data.countyEdges } } : {}),
      labels: { type: 'geojson', data: data.labels },
      countylabels: { type: 'geojson', data: data.countyLabels },
      regionlabels: { type: 'geojson', data: data.regionLabels },
      landmarks: { type: 'geojson', data: data.landmarks },
      sectionpts: { type: 'geojson', data: data.sectionPts },
      nature: { type: 'geojson', data: data.nature },
      anchors: { type: 'geojson', data: data.anchors },
      trip: { type: 'geojson', data: data.empty },
      reveal: { type: 'geojson', data: data.empty },
      qline: { type: 'geojson', data: data.empty },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': T.land } },
      {
        id: 'muni-fill',
        type: 'fill',
        source: 'munis',
        // Classic: a quiet tint per county. Ink: paper, darkening as you learn each place.
        paint: T.inkMode
          ? {
              'fill-color': T.ink,
              'fill-opacity': ['match', ['coalesce', ['feature-state', 'know'], 0], 1, T.know[1], 2, T.know[2], 3, T.know[3], 0],
            }
          : { 'fill-color': countyTint },
      },
      { id: 'muni-hl', type: 'fill', source: 'munis', paint: { 'fill-color': hl, 'fill-opacity': 0.3 } },
      ...withVis(BASE_LAYERS, basemap),
      {
        id: 'muni-line',
        type: 'line',
        source: innerBorders ? 'muniedges' : 'munis',
        paint: innerBorders
          ? {
              // dotted and thin: a border, not a street
              'line-color': T.ink3,
              'line-opacity': 0.75,
              'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 1.2, 16, 1.6],
              'line-dasharray': [1, 2.5],
            }
          : {
              'line-color': T.ink4,
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.5, Z.region, 0.7, Z.town, 0.9],
              'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.3, Z.town, 0.9, 13, 1.5, 16, 2.4],
            },
      },
      {
        id: 'county-line',
        type: 'line',
        source: innerBorders ? 'countyedges' : 'counties',
        layout: { 'line-join': 'round' },
        paint: innerBorders
          ? {
              'line-color': T.ink2,
              'line-opacity': 0.6,
              'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.4, 14, 2, 16, 2.6],
              'line-dasharray': [3, 2],
            }
          : {
              'line-color': T.ink2,
              'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.1, Z.region, 1.6, Z.town, 2.2, 13, 3, 16, 4],
            },
      },
      {
        id: 'muni-hl-line',
        type: 'line',
        source: 'munis',
        layout: { 'line-join': 'round' },
        paint: { 'line-color': hl, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 12, 3, 16, 4.5] },
      },
      {
        id: 'trip-line',
        type: 'line',
        source: 'trip',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': T.trip, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 14, 5], 'line-opacity': 0.9 },
      },
      {
        id: 'qline',
        type: 'line',
        source: 'qline',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': ['coalesce', ['get', 'color'], T.ink], 'line-width': 2.5, 'line-dasharray': [1.5, 1.5] },
      },
      ...withVis(BASE_LABEL_LAYERS, basemap),
      {
        id: 'region-label',
        type: 'symbol',
        source: 'regionlabels',
        maxzoom: Z.groups + 0.2,
        layout: {
          'text-field': ['upcase', ['get', 'name']],
          'text-font': ['Noto Sans Medium'],
          'text-size': 15,
          'text-letter-spacing': 0.3,
          'text-max-width': 6,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': T.ink2,
          'text-halo-color': T.halo,
          'text-halo-width': 2,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], Z.groups - 0.2, 1, Z.groups + 0.1, 0],
        },
      },
      {
        id: 'county-label',
        type: 'symbol',
        source: 'countylabels',
        minzoom: Z.groups - 0.15,
        maxzoom: Z.town,
        layout: {
          'text-field': ['upcase', ['get', 'c']],
          'text-font': ['Noto Sans Medium'],
          'text-size': ['interpolate', ['linear'], ['zoom'], Z.groups, 8.5, Z.region, 11, Z.town - 0.5, 14],
          'text-letter-spacing': 0.22,
        },
        paint: {
          'text-color': T.ink2,
          'text-halo-color': T.halo,
          'text-halo-width': 1.5,
          // Whole state: regions only. One step in: counties replace them.
          'text-opacity': ['interpolate', ['linear'], ['zoom'], Z.groups - 0.15, 0, Z.groups + 0.15, 1, Z.town - 0.4, 1, Z.town, 0],
        },
      },
      {
        // Villages & sections: positions from OSM place points in the tiles,
        // shown only when the name is on that town's official local-names list.
        id: 'section-label',
        type: 'symbol',
        source: 'omt',
        'source-layer': 'place',
        minzoom: 12,
        filter: [
          'all',
          ['match', ['get', 'class'], ['town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood'], true, false],
          ['in', ['get', 'name'], ['literal', sectionNames]],
        ],
        layout: {
          visibility: basemap === 'none' ? 'none' : 'visible',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 16, 14],
          'text-padding': 4,
          'text-max-width': 8,
          'text-rotation-alignment': 'viewport',
        },
        paint: { 'text-color': T.ink3, 'text-halo-color': T.halo, 'text-halo-width': 1.4 },
      },
      {
        // Villages & sections: positions from OSM place points in the tiles,
        // shown only when the name is on that town's official local-names list.
        id: 'section-label-local',
        type: 'symbol',
        source: 'sectionpts',
        minzoom: 12,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 16, 14],
          'text-padding': 4,
          'text-max-width': 8,
          'text-rotation-alignment': 'viewport',
        },
        paint: { 'text-color': T.ink3, 'text-halo-color': T.halo, 'text-halo-width': 1.4 },
      },
      {
        // Lakes and mountains (curated): small marks with italic names
        id: 'nature-dot',
        type: 'circle',
        source: 'nature',
        minzoom: 8.2,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8.2, 2.5, 13, 4.5],
          'circle-color': ['match', ['get', 'kind'], ['Lake', 'Reservoir'], T.waterInk, T.ink3],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },
      {
        id: 'nature-label',
        type: 'symbol',
        source: 'nature',
        minzoom: 8.2,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8.2, 10.5, 12, 13],
          'text-anchor': 'top',
          'text-offset': [0, 0.5],
          'text-max-width': 8,
          'text-optional': true,
        },
        paint: {
          'text-color': ['match', ['get', 'kind'], ['Lake', 'Reservoir'], T.waterInk, T.ink2],
          'text-halo-color': T.halo,
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'landmark-dot',
        type: 'circle',
        source: 'landmarks',
        minzoom: Z.region,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], Z.region, 2.5, 13, 5],
          'circle-color': T.ink2,
          'circle-stroke-color': T.land,
          'circle-stroke-width': 1.5,
        },
      },
      {
        id: 'landmark-label',
        type: 'symbol',
        source: 'landmarks',
        minzoom: Z.town + 0.8,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-size': 11.5,
          'text-anchor': 'top',
          'text-offset': [0, 0.6],
          'text-max-width': 8,
          'text-optional': true,
        },
        paint: { 'text-color': T.ink2, 'text-halo-color': T.halo, 'text-halo-width': 1.6 },
      },
      // Region zoom: the big and the well-known first
      muniLabel(Z, 'muni-label-major', Z.region, Z.town, ['any', ['>=', ['get', 'p'], majorSize], ['==', ['get', 'wk'], 1]]),
      muniLabel(Z, 'muni-label', Z.town),
      {
        id: 'anchor-dot',
        type: 'circle',
        source: 'anchors',
        paint: { 'circle-radius': 6, 'circle-color': T.anchor, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
      },
      {
        id: 'anchor-label',
        type: 'symbol',
        source: 'anchors',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Medium'],
          'text-size': 13,
          'text-anchor': 'left',
          'text-offset': [0.9, 0],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': T.anchor, 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      },
      {
        // A dot on each key place, so even a tiny town (Harrison) is easy to
        // find; its name sits beside the dot, not on top of the town.
        id: 'reveal-dot',
        type: 'circle',
        source: 'reveal',
        filter: ['<', ['get', 'prio'], 3],
        paint: {
          'circle-radius': 5.5,
          'circle-color': ['coalesce', ['get', 'color'], T.ink],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      },
      {
        // Labels revealed by a question. Minor ones (other neighbors) only
        // where there's room; the key ones (question, right, wrong) are placed
        // first and slide to a free side instead of stacking on each other.
        id: 'reveal-minor',
        type: 'symbol',
        source: 'reveal',
        filter: ['==', ['get', 'prio'], 3],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Medium'],
          'text-size': 13,
          'text-max-width': 8,
          'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.4,
          'text-padding': 3,
        },
        paint: { 'text-color': ['coalesce', ['get', 'color'], T.ink], 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      },
      {
        id: 'reveal-label',
        type: 'symbol',
        source: 'reveal',
        filter: ['<', ['get', 'prio'], 3],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Medium'],
          'text-size': 16,
          'text-max-width': 9,
          'symbol-sort-key': ['get', 'prio'],
          'text-variable-anchor': ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
          'text-radial-offset': 0.75,
          'text-padding': 2,
        },
        paint: { 'text-color': ['coalesce', ['get', 'color'], T.ink], 'text-halo-color': '#ffffff', 'text-halo-width': 2.2 },
      },
    ],
  };
  return { style, baseLayers: [...BASE_LAYERS, ...BASE_LABEL_LAYERS] };
}
