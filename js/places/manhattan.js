// Manhattan: neighborhoods by the names people use, grouped by where they sit
// along the grid. Everything here is a starting draft; edit freely.

export const GRID_ANGLE = 29; // the street grid is turned ~29° clockwise from true north

/** Where each Jersey crossing comes out in Manhattan. */
export const CROSSINGS = [
  {
    name: 'George Washington Bridge',
    short: 'GWB',
    pt: [-73.9465, 40.8507],
    note: 'Lands around 178th–179th St in Washington Heights. For downtown, take the Henry Hudson Parkway south along the river; it becomes the West Side Highway at 72nd St.',
  },
  {
    name: 'Lincoln Tunnel',
    short: 'Lincoln',
    pt: [-73.9969, 40.7583],
    note: 'Comes out around 39th–42nd St between 9th and 10th Ave. Port Authority is at 8th & 42nd, Times Square two avenues east, Penn Station about eight blocks south.',
  },
  {
    name: 'Holland Tunnel',
    short: 'Holland',
    pt: [-74.008, 40.7213],
    note: 'Comes out near Canal St & Varick, between SoHo and Tribeca. Canal St runs crosstown to Chinatown and the Manhattan Bridge.',
  },
];

/** Which way the avenues run (going west from the East River). */
export const AVENUES = [
  ['1st Ave', 'uptown'],
  ['2nd Ave', 'downtown'],
  ['3rd Ave', 'uptown'],
  ['Lexington Ave', 'downtown'],
  ['Park Ave', 'two-way'],
  ['Madison Ave', 'uptown'],
  ['5th Ave', 'downtown'],
  ['6th Ave', 'uptown'],
  ['7th Ave', 'downtown'],
  ['8th Ave', 'uptown'],
  ['9th Ave', 'downtown'],
  ['10th Ave', 'uptown'],
  ['Amsterdam Ave', 'uptown'],
  ['Columbus Ave', 'downtown'],
  ['Central Park West', 'two-way'],
  ['West End Ave', 'two-way'],
  ['York Ave', 'two-way'],
];
export const AVENUE_NOTE =
  'Avenues mostly alternate: 1st up, 2nd down, 3rd up, Lex down, Park both ways, Madison up, 5th down, 6th up, 7th down, 8th up, 9th down, 10th up. ' +
  'Above 59th St, 9th becomes Columbus (down) and 10th becomes Amsterdam (up). Most numbered streets alternate too (odd westbound, even eastbound); the big crosstown ones like 14th, 23rd, 34th, 42nd, 57th, 72nd, 86th and 96th run both ways.';

const LANDMARKS = [
  // `quiz: false` = on the map, but not asked as "which neighborhood?",
  // because people would reasonably disagree on the answer.
  { name: 'GWB (Manhattan end)', kind: 'Crossing', pt: [-73.9465, 40.8507], town: 'Hudson Heights|Upper Manhattan', quiz: false },
  { name: 'Lincoln Tunnel (Manhattan end)', kind: 'Crossing', pt: [-73.9969, 40.7583], town: 'Hudson Yards|Midtown', quiz: false },
  { name: 'Holland Tunnel (Manhattan end)', kind: 'Crossing', pt: [-74.008, 40.7213], town: 'Tribeca|Downtown', quiz: false },
  { name: 'Penn Station', kind: 'Train station', pt: [-73.9935, 40.7506], town: 'Chelsea|Midtown', quiz: false },
  { name: 'Port Authority Bus Terminal', kind: 'Bus terminal', pt: [-73.9903, 40.757], town: 'Garment District|Midtown', quiz: false },
  { name: 'Grand Central', kind: 'Train station', pt: [-73.9772, 40.7527], town: 'Midtown East|Midtown' },
  { name: 'PATH 33rd St', kind: 'PATH', pt: [-73.9881, 40.7496], town: 'Herald Square|Midtown' },
  { name: 'PATH 23rd St', kind: 'PATH', pt: [-73.9928, 40.7429], town: 'Flatiron District|Midtown', quiz: false },
  { name: 'PATH 14th St', kind: 'PATH', pt: [-73.9969, 40.7375], town: 'Chelsea|Midtown', quiz: false },
  { name: 'PATH 9th St', kind: 'PATH', pt: [-73.9989, 40.7342], town: 'Greenwich Village|Downtown', quiz: false },
  { name: 'PATH Christopher St', kind: 'PATH', pt: [-74.0071, 40.7329], town: 'West Village|Downtown' },
  { name: 'PATH World Trade Center', kind: 'PATH', pt: [-74.011, 40.7115], town: 'Financial District|Downtown' },
  { name: 'Times Square', kind: 'Square', pt: [-73.9855, 40.758], town: 'Times Square|Midtown' },
  { name: 'Empire State Building', kind: 'Building', pt: [-73.9857, 40.7484], town: 'Midtown South|Midtown', quiz: false },
  { name: 'Rockefeller Center', kind: 'Building', pt: [-73.9787, 40.7587], town: 'Midtown|Midtown' },
  { name: 'Columbus Circle', kind: 'Circle', pt: [-73.9819, 40.7681], town: 'Columbus Circle|Midtown' },
  { name: 'Hudson Yards', kind: 'Development', pt: [-74.0021, 40.7539], town: 'Hudson Yards|Midtown' },
  { name: 'Union Square', kind: 'Square', pt: [-73.9906, 40.7359], town: 'Union Square|Midtown' },
  { name: 'Washington Square Park', kind: 'Park', pt: [-73.9973, 40.7308], town: 'Greenwich Village|Downtown' },
  { name: 'One World Trade Center', kind: 'Building', pt: [-74.0134, 40.7127], town: 'Financial District|Downtown' },
  { name: 'Staten Island Ferry', kind: 'Ferry', pt: [-74.0131, 40.7014], town: 'Financial District|Downtown' },
  { name: 'Brooklyn Bridge (Manhattan end)', kind: 'Bridge', pt: [-74.004, 40.7127], town: 'Civic Center|Downtown', quiz: false },
  { name: 'Lincoln Center', kind: 'Arts center', pt: [-73.9835, 40.7725], town: 'Lincoln Square|Uptown' },
  { name: 'Natural History Museum', kind: 'Museum', pt: [-73.974, 40.7813], town: 'Upper West Side|Uptown' },
  { name: 'The Met', kind: 'Museum', pt: [-73.9632, 40.7794], town: 'Central Park|Uptown', quiz: false },
  { name: 'Columbia University', kind: 'College', pt: [-73.9626, 40.8075], town: 'Morningside Heights|Upper Manhattan' },
  { name: 'Apollo Theater', kind: 'Theater', pt: [-73.95, 40.81], town: 'Harlem|Upper Manhattan' },
  { name: 'Midtown ferry (W 39th St)', kind: 'Ferry', pt: [-74.0045, 40.759], town: 'Hudson Yards|Midtown', quiz: false },
];

const ROAD_NOTES = {
  'FDR Drive': 'Runs along the East River the whole East Side, from the Battery up to Harlem, where it becomes the Harlem River Drive.',
  'Harlem River Drive': 'Continues the FDR north along the Harlem River to the GWB approaches in Washington Heights.',
  'NY 9A':
    'The West Side highway: West Street / West Side Highway from the Battery up to 72nd St, then the Henry Hudson Parkway north past the GWB to the Bronx.',
  'I-95': 'In Manhattan, the Trans-Manhattan Expressway: the short stretch across Washington Heights between the GWB and the Bronx.',
  'I-78': 'In Manhattan, I-78 is just the Holland Tunnel and its exits around Canal St.',
  'Rt 495': 'The helix in Weehawken down to the Lincoln Tunnel, fed by the Turnpike and Route 3.',
};

const CONFUSABLES = [
  {
    names: ['SoHo', 'NoHo', 'NoMad', 'Tribeca'],
    note: 'Named for where they sit: SoHo = SOuth of HOuston St, NoHo = NOrth of HOuston, NoMad = NOrth of MADison Square Park, Tribeca = TRIangle BElow CAnal St.',
  },
  {
    names: ['East Village', 'West Village', 'Greenwich Village'],
    note: 'The West Village is the western part of Greenwich Village. The East Village is a separate neighborhood east of the Bowery/3rd Ave.',
  },
  { names: ['Upper East Side', 'Upper West Side'], note: 'Split by Central Park. East vs West is decided by Fifth Avenue.' },
  {
    names: ['Hudson Yards', 'Hudson Square', 'Hudson Heights'],
    note: 'Hudson Yards: Midtown West, around 34th St & 11th Ave. Hudson Square: Downtown, by the Holland Tunnel. Hudson Heights: way uptown by the GWB.',
  },
  { names: ['Murray Hill', 'Rose Hill', 'Lenox Hill', 'Carnegie Hill', 'Sugar Hill'] },
  { names: ['Kips Bay', 'Turtle Bay'], note: 'Both on the East Side: Kips Bay in the 20s and low 30s, Turtle Bay in the 40s around the UN.' },
  { names: ['Washington Heights', 'Hudson Heights', 'Hamilton Heights', 'Morningside Heights'] },
  { names: ['Harlem', 'East Harlem'], note: 'East Harlem (El Barrio) is the part east of Fifth Avenue.' },
  { names: ['Times Square', 'Herald Square', 'Union Square'] },
  { names: ['Midtown', 'Midtown East', 'Midtown South'] },
];

export default {
  id: 'manhattan',
  name: 'Manhattan',
  short: 'Manhattan',
  data: 'data/manhattan.topo.json',
  sections: null,
  unit: 'neighborhood',
  units: 'neighborhoods',
  groupPlural: 'Areas',
  groupName: (c) => c,
  sub: (m) => m.c,
  spokenGroup: (c) => c,
  outside: 'Outside Manhattan',
  outsideSub: 'or on the water',
  edgeName: 'the river',
  leaving: 'Leaving Manhattan.',
  attribution: 'Neighborhoods: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, NYC Dept. of City Planning',
  bounds: [
    [-74.03, 40.698],
    [-73.905, 40.88],
  ],
  maxBounds: [
    [-74.45, 40.45],
    [-73.55, 41.1],
  ],
  zooms: { groups: 9, region: 11.3, town: 12.1, street: 14.2 },
  majorSize: 4000, // neighborhood area in units of 100 m²: the bigger ones get names first
  sizeWord: null,
  superGroups: null,
  groupTint: { Downtown: 'B', Midtown: 'D', Uptown: 'A', 'Upper Manhattan': 'E' },
  groupOrder: ['Downtown', 'Midtown', 'Uptown', 'Upper Manhattan'], // south to north
  landmarks: LANDMARKS,
  roadNotes: ROAD_NOTES,
  confusables: CONFUSABLES,
  gridAngle: GRID_ANGLE,
  driveZoom: 15,
  nearMi: 1.5,
  quizTypes: ['find', 'name', 'dir', 'borders', 'confuse', 'landmark', 'north', 'point', 'avedir', 'crossing', 'uptown'],
  crossings: CROSSINGS,
  wellKnown: null, // every neighborhood counts
  avenues: AVENUES,
  avenueNote: AVENUE_NOTE,
};
