// New Jersey: 564 municipalities, grouped by county.
import { LANDMARKS, ROAD_NOTES, HIGHWAYS, JUNCTIONS, BIG_PLACES } from '../knowledge.js';
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
  zooms: { groups: 7.45, region: 7.9, town: 9.4, street: 13 },
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
  quizTypes: ['find', 'roadto', 'leftright', 'name', 'dir', 'borders', 'confuse', 'section', 'landmark', 'north', 'point', 'bigpoint', 'hwydir', 'hwyfact'],
  crossings: [],
  highways: HIGHWAYS,
  junctions: JUNCTIONS,
  bigPlaces: BIG_PLACES,
  // "Well-known": towns over 25,000 people, county seats, towns with a
  // landmark, your own sound-alike pairs, plus these: places people name all
  // the time even though they're small. A judgment call; edit freely.
  wellKnown: {
    minPop: 25000,
    seats: [
      'Hamilton Township|Atlantic', 'Hackensack City|Bergen', 'Mount Holly Township|Burlington', 'Camden City|Camden',
      'Middle Township|Cape May', 'Bridgeton City|Cumberland', 'Newark City|Essex', 'Woodbury City|Gloucester',
      'Jersey City|Hudson', 'Flemington Borough|Hunterdon', 'Trenton City|Mercer', 'New Brunswick City|Middlesex',
      'Freehold Borough|Monmouth', 'Morristown Town|Morris', 'Toms River Township|Ocean', 'Paterson City|Passaic',
      'Salem City|Salem', 'Somerville Borough|Somerset', 'Newton Town|Sussex', 'Elizabeth City|Union', 'Belvidere Town|Warren',
    ],
    names: [
      // Shore
      'Asbury Park', 'Belmar', 'Point Pleasant Beach', 'Seaside Heights', 'Long Branch', 'Spring Lake', 'Sea Girt', 'Red Bank',
      'Long Beach', 'Beach Haven', 'Atlantic City', 'Ocean City', 'Margate City', 'Ventnor City', 'Sea Isle City',
      'Wildwood', 'North Wildwood', 'Cape May', 'Brigantine', 'Avalon', 'Stone Harbor', 'Manasquan', 'Bradley Beach',
      // Hudson waterfront & close-in
      'Hoboken', 'Weehawken', 'Harrison', 'Secaucus', 'East Rutherford', 'Rutherford', 'Lyndhurst', 'Fort Lee', 'Edgewater',
      'Englewood', 'Teaneck', 'Nutley', 'Belleville', 'Montclair', 'Maplewood', 'South Orange Village', 'West Orange', 'Orange',
      // Suburban names everyone uses
      'Ridgewood', 'Paramus', 'Mahwah', 'Ramsey', 'Wayne', 'Little Falls', 'Boonton', 'Denville', 'Rockaway', 'Madison',
      'Chatham', 'Summit', 'Millburn', 'Westfield', 'Cranford', 'Rahway', 'Metuchen', 'Princeton', 'Hightstown',
      'Collingswood', 'Haddonfield', 'Moorestown', 'Lambertville', 'Hackettstown', 'Sparta', 'Bernardsville',
    ],
  },
};
