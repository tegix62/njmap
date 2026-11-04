// New Jersey: 564 municipalities, grouped by county.
import { LANDMARKS, ROAD_NOTES } from '../knowledge.js';
import { GROUPS } from '../confusables.js';
import { REGIONS } from '../regions.js';
import { THEME } from '../theme.js';

export default {
  id: 'nj',
  name: 'New Jersey',
  short: 'NJ',
  data: 'data/nj.topo.json',
  sections: 'data/sections.json',
  unit: 'town',
  units: 'towns',
  groupPlural: 'Counties',
  groupName: (c) => `${c} County`,
  sub: (m) => `${m.t} · ${m.c} County`,
  spokenGroup: (c) => `${c} County`,
  outside: 'Outside New Jersey',
  outsideSub: 'or offshore',
  edgeName: 'NJ line / water',
  leaving: 'Leaving New Jersey.',
  attribution: 'Boundaries: <a href="https://njogis-newjersey.opendata.arcgis.com/">NJOGIS</a>',
  bounds: [
    [-75.56, 38.93],
    [-73.89, 41.36],
  ],
  maxBounds: [
    [-78, 37.5],
    [-71.5, 42.5],
  ],
  // Zoom levels: groups = where county names replace the three regions
  zooms: { groups: 7.45, region: 8.3, town: 10.3, street: 13 },
  majorSize: 20000, // towns this populous get names at region zoom
  sizeWord: 'pop.',
  superGroups: REGIONS,
  groupTint: THEME.countyKey,
  landmarks: LANDMARKS,
  roadNotes: ROAD_NOTES,
  confusables: GROUPS,
  gridAngle: null,
  driveZoom: 12.5,
  nearMi: 15,
  quizTypes: ['find', 'name', 'dir', 'borders', 'confuse', 'section', 'landmark', 'north', 'point'],
  crossings: [],
};
