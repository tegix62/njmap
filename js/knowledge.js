// Hand-curated knowledge layered on top of the map. Everything here is a
// starting draft: edit, delete, or add your own (in-app notes are stored
// separately and never overwrite this file).

/**
 * Road notes keyed by the short label the app shows (see roads.js normRef):
 * "I-80", "Route 46", "Route 23", "Turnpike", "Parkway", … or by a road's name.
 */
export const ROAD_NOTES = {
  'I-80':
    'East–west across North Jersey: from I-95 in Teaneck (toward the George Washington Bridge) west through Paterson, Wayne, Parsippany and Rockaway to the Delaware Water Gap.',
  'I-287':
    'Arcs around the metro area: from the Turnpike in Edison north through Piscataway, Bridgewater, Morristown and Parsippany, then up through Oakland to Mahwah and the NY Thruway.',
  'I-78': 'East–west from the Holland Tunnel through Newark and Union County, past Bridgewater and Clinton, to the Delaware River at Phillipsburg.',
  'I-280': 'Links I-80 in Parsippany with Newark, running east through Livingston, West Orange and the Oranges.',
  'I-195': 'Central Jersey east–west: from the Trenton area (Hamilton) toward the Shore, ending in Wall Township.',
  'I-295': 'Runs up the Delaware River side of South Jersey, from the Delaware Memorial Bridge to the Trenton area.',
  Turnpike:
    'The NJ Turnpike: toll road along the eastern corridor from the Delaware Memorial Bridge to the George Washington Bridge. Its exit numbers run in sequence (1–18), so they don’t tell you mileage.',
  Parkway:
    'The Garden State Parkway: from Cape May up the Shore and through Union, Essex, Passaic and Bergen to the NY line at Montvale. Exit numbers are mileposts from Cape May, so Exit 105 is about 105 miles up.',
  'AC Expressway': 'Toll road from the Philadelphia suburbs (Turnersville) to Atlantic City.',
  'Palisades Pkwy': 'Palisades Interstate Parkway: from the George Washington Bridge north along the Hudson cliffs into New York.',
  'Route 46': 'Older east–west highway that shadows I-80 through Morris, Passaic and Bergen, with traffic lights and businesses. Useful for short hops between towns along 80.',
  'Route 1': 'The old main road: Trenton past Princeton to New Brunswick, Edison and Woodbridge, then Elizabeth and Newark. Runs parallel to the Turnpike.',
  'Pulaski Skyway': 'Pulaski Skyway (Route 1&9): a free elevated route between Newark and Jersey City, next to the Turnpike extension.',
  'Route 9': 'North–south through Middlesex, Monmouth and Ocean (Old Bridge, Freehold, Howell, Lakewood), roughly parallel to the Parkway.',
  'Route 22': 'East–west through Hillside, Union, Springfield, Mountainside and on to Bridgewater, alongside I-78. Stores line it and the median.',
  'Route 202':
    'Morristown south to Bernardsville and Somerville; north from Morristown through Parsippany, Montville (Towaco), Lincoln Park and Wayne toward Oakland and Mahwah.',
  'Route 3': 'Short, busy link from Clifton through Rutherford and Secaucus (the Meadowlands) toward the Lincoln Tunnel.',
  'Route 4': 'East–west from the George Washington Bridge through Fort Lee, Englewood, Teaneck and Hackensack to Paramus.',
  'Route 10': 'East–west across Morris County from Livingston through Hanover (Whippany) and Parsippany to Roxbury.',
  'Route 17': 'North–south through Bergen County: from the Meadowlands up through Hasbrouck Heights, Paramus and Ramsey to Mahwah and the NY line.',
  'Route 18': 'From New Brunswick southeast through East Brunswick and Marlboro toward the Shore.',
  'Route 21': 'McCarter Highway: follows the Passaic River from Newark north to Clifton. A way north out of Newark that isn’t the Parkway.',
  'Route 23': 'The main road from Wayne northwest through Pequannock, Butler and Kinnelon into Sussex County (Franklin, Sussex, High Point).',
  'Route 24': 'Short freeway from I-78 at Springfield to I-287 at Morristown, past Millburn, Summit, Chatham and Madison.',
  'Route 208': 'Diagonal from Route 4 in Fair Lawn northwest to I-287 in Oakland.',
  'Route 495': 'The approach to the Lincoln Tunnel: from the Turnpike and Route 3 through Union City down the helix in Weehawken.',
};
ROAD_NOTES['I-95'] = ROAD_NOTES.Turnpike;

/**
 * Landmarks: things you see, drive to, or give directions by.
 * `town` is "<municipality full name>|<county>" and is checked against the
 * boundary data by the test script, so a landmark can't silently sit in the
 * wrong town.
 */
export const LANDMARKS = [
  { name: 'MetLife Stadium', kind: 'Stadium', pt: [-74.0745, 40.8135], town: 'East Rutherford Borough|Bergen' },
  { name: 'American Dream', kind: 'Mall', pt: [-74.069, 40.809], town: 'East Rutherford Borough|Bergen' },
  { name: 'Newark Airport', kind: 'Airport', pt: [-74.1745, 40.6895], town: 'Newark City|Essex' },
  { name: 'Prudential Center', kind: 'Arena', pt: [-74.1711, 40.7334], town: 'Newark City|Essex' },
  { name: 'Newark Penn Station', kind: 'Train station', pt: [-74.1644, 40.7347], town: 'Newark City|Essex' },
  { name: 'Red Bull Arena', kind: 'Stadium', pt: [-74.1503, 40.7369], town: 'Harrison Town|Hudson' },
  { name: 'Secaucus Junction', kind: 'Train station', pt: [-74.0753, 40.7612], town: 'Secaucus Town|Hudson' },
  { name: 'Hoboken Terminal', kind: 'Train station', pt: [-74.0275, 40.7353], town: 'Hoboken City|Hudson' },
  { name: 'Liberty State Park', kind: 'Park', pt: [-74.055, 40.704], town: 'Jersey City|Hudson' },
  { name: 'Holland Tunnel', kind: 'Tunnel', pt: [-74.038, 40.727], town: 'Jersey City|Hudson' },
  { name: 'Lincoln Tunnel', kind: 'Tunnel', pt: [-74.018, 40.764], town: 'Weehawken Township|Hudson' },
  { name: 'George Washington Bridge', kind: 'Bridge', pt: [-73.964, 40.853], town: 'Fort Lee Borough|Bergen' },
  { name: 'Garden State Plaza', kind: 'Mall', pt: [-74.076, 40.918], town: 'Paramus Borough|Bergen' },
  { name: 'Willowbrook Mall', kind: 'Mall', pt: [-74.256, 40.8848], town: 'Wayne Township|Passaic' },
  { name: 'The Mall at Short Hills', kind: 'Mall', pt: [-74.3638, 40.7403], town: 'Millburn Township|Essex' },
  { name: 'Menlo Park Mall', kind: 'Mall', pt: [-74.3355, 40.548], town: 'Edison Township|Middlesex' },
  { name: 'Bridgewater Commons', kind: 'Mall', pt: [-74.618, 40.5835], town: 'Bridgewater Township|Somerset' },
  { name: 'Jersey Gardens outlets', kind: 'Mall', pt: [-74.169, 40.66], town: 'Elizabeth City|Union' },
  { name: 'Great Falls', kind: 'Park', pt: [-74.1813, 40.9157], town: 'Paterson City|Passaic' },
  { name: 'Edison Laboratory (national park)', kind: 'Historic site', pt: [-74.2336, 40.7835], town: 'West Orange Township|Essex' },
  { name: 'Morristown Green', kind: 'Town center', pt: [-74.481, 40.7968], town: 'Morristown Town|Morris' },
  { name: 'Ramapo College', kind: 'College', pt: [-74.173, 41.082], town: 'Mahwah Township|Bergen' },
  { name: 'William Paterson University', kind: 'College', pt: [-74.198, 40.948], town: 'Wayne Township|Passaic' },
  { name: 'Rutgers (College Ave)', kind: 'College', pt: [-74.4474, 40.5008], town: 'New Brunswick City|Middlesex' },
  { name: 'Princeton University', kind: 'College', pt: [-74.6551, 40.3431], town: 'Princeton|Mercer' },
  { name: 'Six Flags Great Adventure', kind: 'Amusement park', pt: [-74.4401, 40.1376], town: 'Jackson Township|Ocean' },
  { name: 'Atlantic City Boardwalk', kind: 'Boardwalk', pt: [-74.438, 39.3555], town: 'Atlantic City|Atlantic' },
  { name: 'Sandy Hook', kind: 'Park', pt: [-74.001, 40.462], town: 'Middletown Township|Monmouth' },
  { name: 'Barnegat Lighthouse', kind: 'Lighthouse', pt: [-74.106, 39.764], town: 'Barnegat Light Borough|Ocean' },
  { name: 'Cape May Lighthouse', kind: 'Lighthouse', pt: [-74.96, 38.933], town: 'Lower Township|Cape May' },
  { name: 'High Point Monument', kind: 'Park', pt: [-74.6617, 41.3209], town: 'Montague Township|Sussex' },
];

/**
 * The big highways, each with its own color everywhere in the app, so the
 * Turnpike always looks like the Turnpike. Colors avoid the blue / green /
 * red that mean "selected / right / wrong".
 * `match` is the OpenStreetMap route ref that identifies the road.
 * End points are checked against the town boundaries by the test script.
 */
export const HIGHWAYS = [
  {
    label: 'Turnpike',
    full: 'New Jersey Turnpike',
    match: 'NJTP',
    color: '#7b5ea7',
    runs: 'southwest–northeast',
    ends: [
      { side: 'south', name: 'the Delaware Memorial Bridge', pt: [-75.475, 39.69], town: 'Carneys Point Township|Salem' },
      { side: 'north', name: 'the George Washington Bridge', pt: [-73.968, 40.851], town: 'Fort Lee Borough|Bergen' },
    ],
    exits: 'Exits are numbered in order, 1 to 18 (with lettered ones like 15W and 16E), so the number doesn’t tell you mileage.',
    note: 'It crosses the Parkway at Woodbridge, like an X. North of Woodbridge the Turnpike is the eastern one (Newark Airport, the Meadowlands). South of it, the Turnpike cuts southwest toward Trenton and Delaware while the Parkway heads down the Shore.',
  },
  {
    label: 'Parkway',
    full: 'Garden State Parkway',
    match: 'GSP',
    color: '#2e8b82',
    runs: 'south–north',
    ends: [
      { side: 'south', name: 'Cape May', pt: [-74.905, 38.955], town: 'Lower Township|Cape May' },
      { side: 'north', name: 'the New York line at Montvale', pt: [-74.045, 41.06], town: 'Montvale Borough|Bergen' },
    ],
    exits: 'Exit numbers are mileposts counted from Cape May: Exit 105 is about 105 miles up.',
    note: 'It crosses the Turnpike at Woodbridge, like an X. North of Woodbridge the Parkway swings inland through Union, the Oranges, Clifton and Paramus. South of it, the Parkway is the Shore road.',
  },
  {
    label: 'I-80',
    full: 'Interstate 80',
    match: 'I 80',
    color: '#c48a1e',
    runs: 'west–east',
    ends: [
      { side: 'west', name: 'the Delaware Water Gap', pt: [-75.105, 40.958], town: 'Knowlton Township|Warren' },
      { side: 'east', name: 'Teaneck (at I-95, toward the GWB)', pt: [-74.005, 40.885], town: 'Teaneck Township|Bergen' },
    ],
    exits: 'Exit numbers count miles from the Delaware River.',
    note: 'North Jersey’s east–west spine: Paterson, Wayne, Parsippany, Rockaway.',
  },
  {
    label: 'I-287',
    full: 'Interstate 287',
    match: 'I 287',
    color: '#9a5b2e',
    runs: 'an arc, south to north',
    ends: [
      { side: 'south', name: 'Edison (at the Turnpike)', pt: [-74.385, 40.53], town: 'Edison Township|Middlesex' },
      { side: 'north', name: 'the New York line at Mahwah', pt: [-74.165, 41.105], town: 'Mahwah Township|Bergen' },
    ],
    exits: 'Exit numbers count miles from Edison.',
    note: 'A ring around the metro area: Piscataway, Bridgewater, Morristown, Parsippany, then north through Oakland to Mahwah.',
  },
  {
    label: 'I-78',
    full: 'Interstate 78',
    match: 'I 78',
    color: '#7a8a2a',
    runs: 'west–east',
    ends: [
      { side: 'west', name: 'Phillipsburg (at the Delaware River)', pt: [-75.19, 40.69], town: 'Phillipsburg Town|Warren' },
      { side: 'east', name: 'the Holland Tunnel', pt: [-74.04, 40.727], town: 'Jersey City|Hudson' },
    ],
    exits: 'Exit numbers count miles from the Delaware River.',
    note: 'Central Jersey’s east–west spine: Clinton, Bridgewater, Union County, Newark.',
  },
  {
    label: 'I-295',
    full: 'Interstate 295',
    match: 'I 295',
    color: '#b0607e',
    runs: 'southwest–northeast, along the Delaware',
    ends: [
      { side: 'south', name: 'the Delaware Memorial Bridge', pt: [-75.47, 39.69], town: 'Carneys Point Township|Salem' },
      { side: 'north', name: 'the Trenton area', pt: [-74.82, 40.27], town: 'Ewing Township|Mercer' },
    ],
    exits: 'Exit numbers count miles from the Delaware Memorial Bridge.',
    note: 'The free alternative to the Turnpike on the Philadelphia side of South Jersey.',
  },
  {
    label: 'AC Expressway',
    full: 'Atlantic City Expressway',
    match: 'ACE',
    color: '#5f7286',
    runs: 'northwest–southeast',
    ends: [
      { side: 'west', name: 'Turnersville', pt: [-75.06, 39.77], town: 'Washington Township|Gloucester' },
      { side: 'east', name: 'Atlantic City', pt: [-74.44, 39.365], town: 'Atlantic City|Atlantic' },
    ],
    exits: '',
    note: 'The Philadelphia side’s road to Atlantic City. It meets the Parkway in Egg Harbor Township.',
  },
];

/** Where the big highways meet, checked against the boundaries. */
export const JUNCTIONS = [
  { a: 'Parkway', b: 'Turnpike', town: 'Woodbridge Township|Middlesex' },
  { a: 'I-287', b: 'Turnpike', town: 'Edison Township|Middlesex' },
  { a: 'I-80', b: 'Turnpike', town: 'Teaneck Township|Bergen' },
  { a: 'I-78', b: 'Turnpike', town: 'Newark City|Essex' },
  { a: 'I-195', b: 'Turnpike', town: 'Robbinsville Township|Mercer' },
  { a: 'AC Expressway', b: 'Parkway', town: 'Egg Harbor Township|Atlantic' },
];

/** Far-off places worth always being able to point to. */
export const BIG_PLACES = [
  { name: 'Manhattan (Midtown)', pt: [-73.9857, 40.7484] },
  { name: 'Philadelphia', pt: [-75.1636, 39.9526] },
  { name: 'Atlantic City', pt: [-74.4229, 39.3643] },
  { name: 'Newark Airport', pt: [-74.1745, 40.6895] },
  { name: 'Trenton', pt: [-74.7699, 40.2204] },
];
