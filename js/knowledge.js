// Hand-curated knowledge layered on top of the map. Everything here is a
// starting draft: edit, delete, or add your own (in-app notes are stored
// separately and never overwrite this file).

/**
 * Road notes keyed by the short label the app shows (see roads.js normRef):
 * "I-80", "US 46", "Rt 23", "Turnpike", "Parkway", … or by a road's name.
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
  'US 46': 'Older east–west highway that shadows I-80 through Morris, Passaic and Bergen, with traffic lights and businesses. Useful for short hops between towns along 80.',
  'US 1': 'The old main road: Trenton past Princeton to New Brunswick, Edison and Woodbridge, then Elizabeth and Newark. Runs parallel to the Turnpike.',
  'Pulaski Skyway': 'Pulaski Skyway (US 1/9): a free elevated route between Newark and Jersey City, next to the Turnpike extension.',
  'US 9': 'North–south through Middlesex, Monmouth and Ocean (Old Bridge, Freehold, Howell, Lakewood), roughly parallel to the Parkway.',
  'US 22': 'East–west through Hillside, Union, Springfield, Mountainside and on to Bridgewater, alongside I-78. Stores line it and the median.',
  'US 202':
    'Morristown south to Bernardsville and Somerville; north from Morristown through Parsippany, Montville (Towaco), Lincoln Park and Wayne toward Oakland and Mahwah.',
  'Rt 3': 'Short, busy link from Clifton through Rutherford and Secaucus (the Meadowlands) toward the Lincoln Tunnel.',
  'Rt 4': 'East–west from the George Washington Bridge through Fort Lee, Englewood, Teaneck and Hackensack to Paramus.',
  'Rt 10': 'East–west across Morris County from Livingston through Hanover (Whippany) and Parsippany to Roxbury.',
  'Rt 17': 'North–south through Bergen County: from the Meadowlands up through Hasbrouck Heights, Paramus and Ramsey to Mahwah and the NY line.',
  'Rt 18': 'From New Brunswick southeast through East Brunswick and Marlboro toward the Shore.',
  'Rt 21': 'McCarter Highway: follows the Passaic River from Newark north to Clifton. A way north out of Newark that isn’t the Parkway.',
  'Rt 23': 'The main road from Wayne northwest through Pequannock, Butler and Kinnelon into Sussex County (Franklin, Sussex, High Point).',
  'Rt 24': 'Short freeway from I-78 at Springfield to I-287 at Morristown, past Millburn, Summit, Chatham and Madison.',
  'Rt 208': 'Diagonal from Route 4 in Fair Lawn northwest to I-287 in Oakland.',
  'Rt 495': 'The approach to the Lincoln Tunnel: from the Turnpike and Route 3 through Union City down the helix in Weehawken.',
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
