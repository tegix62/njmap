#!/usr/bin/env python3
"""More New Jersey landmarks for the landmark quiz, Explore search and the map: appended to LANDMARKS in js/knowledge.js.

A curated list (mostly North Jersey, then the places everyone in the state knows): name, kind, the Wikipedia article for its coordinates,
and the county I expect (a check: a coordinate that lands in a different county is reported, not added). Each point is put in a town with
the app's own boundary data (data/nj.topo.json), the same check the test script makes.

  python3 tools/build_nj_landmark_list.py          (needs en.wikipedia.org; prints a report and rewrites the generated block in js/knowledge.js)
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from shapely.geometry import Point, Polygon, MultiPolygon, shape
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = 'landmark-list-builder/1.0 (static hobby map app)'
# (name, kind, Wikipedia article, expected county)
LIST = [
    # --- getting around: airports, bridges, stations, ports
    ('Teterboro Airport', 'Airport', 'Teterboro Airport', 'Bergen'),
    ('Port Newark–Elizabeth Marine Terminal', 'Port', 'Port Newark–Elizabeth Marine Terminal', 'Union'),
    ('Newark Broad Street Station', 'Train station', 'Newark Broad Street station', 'Essex'),
    ('Journal Square', 'Transit hub', 'Journal Square Transportation Center', 'Hudson'),
    ('Port Imperial', 'Ferry terminal', 'Port Imperial', 'Hudson'),
    ('Pulaski Skyway', 'Bridge', 'Pulaski Skyway', 'Hudson'),
    ('Bayonne Bridge', 'Bridge', 'Bayonne Bridge', 'Hudson'),
    ('Goethals Bridge', 'Bridge', 'Goethals Bridge', 'Union'),
    ('Outerbridge Crossing', 'Bridge', 'Outerbridge Crossing', 'Middlesex'),
    ('Driscoll Bridge', 'Bridge', 'Driscoll Bridge', 'Middlesex'),
    ('Metropark Station', 'Train station', 'Metropark station', 'Middlesex'),
    ('Princeton Junction', 'Train station', 'Princeton Junction station', 'Mercer'),
    ('Lower Trenton Bridge', 'Bridge', 'Lower Trenton Bridge', 'Mercer'),
    ('Delaware Water Gap Bridge', 'Bridge', 'Delaware Water Gap Toll Bridge', 'Warren'),
    # --- stadiums, arenas, venues
    ('NJPAC', 'Performing arts center', 'New Jersey Performing Arts Center', 'Essex'),
    ('Bergen Performing Arts Center', 'Theater', 'Bergen Performing Arts Center', 'Bergen'),
    ('Paper Mill Playhouse', 'Theater', 'Paper Mill Playhouse', 'Essex'),
    ('State Theatre', 'Theater', 'State Theatre (New Brunswick, New Jersey)', 'Middlesex'),
    ('SHI Stadium', 'Stadium', 'SHI Stadium', 'Middlesex'),
    ('Hinchliffe Stadium', 'Stadium', 'Hinchliffe Stadium', 'Passaic'),
    ('Yogi Berra Stadium', 'Stadium', 'Yogi Berra Stadium', 'Passaic'),
    ('Meadowlands Racetrack', 'Racetrack', 'Meadowlands Racetrack', 'Bergen'),
    ('PNC Bank Arts Center', 'Amphitheater', 'PNC Bank Arts Center', 'Monmouth'),
    ('The Stone Pony', 'Music venue', 'The Stone Pony', 'Monmouth'),
    ('Count Basie Center', 'Theater', 'Count Basie Center for the Arts', 'Monmouth'),
    # --- museums, culture, schools
    ('Newark Museum', 'Museum', 'Newark Museum of Art', 'Essex'),
    ('Newark Public Library', 'Library', 'Newark Public Library', 'Essex'),
    ('Morris Museum', 'Museum', 'Morris Museum', 'Morris'),
    ('Montclair Art Museum', 'Museum', 'Montclair Art Museum', 'Essex'),
    ('Turtle Back Zoo', 'Zoo', 'Turtle Back Zoo', 'Essex'),
    ('Bergen County Zoo', 'Zoo', 'Bergen County Zoo', 'Bergen'),
    ('Land of Make Believe', 'Amusement park', 'Land of Make Believe', 'Warren'),
    ('Space Farms Zoo', 'Zoo', 'Space Farms Zoo and Museum', 'Sussex'),
    ('Mountain Creek', 'Ski resort', 'Mountain Creek', 'Sussex'),
    ('Grounds For Sculpture', 'Sculpture park', 'Grounds For Sculpture', 'Mercer'),
    ('Thomas Edison Center', 'Museum', 'Menlo Park, Edison, New Jersey', 'Middlesex'),
    ('Stevens Institute of Technology', 'University', 'Stevens Institute of Technology', 'Hudson'),
    ('NJIT', 'University', 'New Jersey Institute of Technology', 'Essex'),
    ('Seton Hall University', 'University', 'Seton Hall University', 'Essex'),
    ('Montclair State University', 'University', 'Montclair State University', 'Essex'),
    ('Kean University', 'University', 'Kean University', 'Union'),
    ('Drew University', 'University', 'Drew University', 'Morris'),
    ("Saint Peter's University", 'University', "Saint Peter's University", 'Hudson'),
    ('The College of New Jersey', 'University', 'The College of New Jersey', 'Mercer'),
    ('New Jersey State House', 'Capitol', 'New Jersey State House', 'Mercer'),
    ('Battle Monument', 'Monument', 'Trenton Battle Monument', 'Mercer'),
    # --- skyline and city landmarks
    ('Goldman Sachs Tower', 'Skyscraper', '30 Hudson Street', 'Hudson'),
    ('99 Hudson Street', 'Skyscraper', '99 Hudson Street', 'Hudson'),
    ('Colgate Clock', 'Landmark', 'Colgate Clock', 'Hudson'),
    ("Newark City Hall", 'City hall', 'Newark City Hall', 'Essex'),
    ('National Newark Building', 'Skyscraper', 'National Newark Building', 'Essex'),
    ('Cathedral Basilica (Newark)', 'Cathedral', 'Cathedral Basilica of the Sacred Heart (Newark, New Jersey)', 'Essex'),
    ('Ironbound', 'Neighborhood', 'Ironbound', 'Essex'),
    ('Branch Brook Park', 'Park', 'Branch Brook Park', 'Essex'),
    ('Newport Centre', 'Mall', 'Newport Centre Mall', 'Hudson'),
    ('Loew\'s Jersey Theatre', 'Theater', "Loew's Jersey Theatre", 'Hudson'),
    ('Hudson County Courthouse', 'Courthouse', 'Hudson County Courthouse', 'Hudson'),
    ('Hamilton Park (Weehawken)', 'Park', 'Alexander Hamilton', 'Hudson'),
    ('Sinatra Park', 'Park', 'Frank Sinatra Park', 'Hudson'),
    ("Carlo's Bakery", 'Bakery', "Carlo's Bake Shop", 'Hudson'),
    ('Lambert Castle', 'Castle', 'Lambert Castle', 'Passaic'),
    ('Liberty Hall Museum', 'Historic house', 'Liberty Hall (Union, New Jersey)', 'Union'),
    ('Menlo Park Tower', 'Monument', 'Edison Memorial Tower', 'Middlesex'),
    ('Bell Works', 'Landmark', 'Bell Works', 'Monmouth'),
    # --- malls and shopping
    ('Paramus Park', 'Mall', 'Paramus Park', 'Bergen'),
    ('Riverside Square', 'Mall', 'Riverside Square Mall', 'Bergen'),
    ('Livingston Mall', 'Mall', 'Livingston Mall', 'Essex'),
    ('Rockaway Townsquare', 'Mall', 'Rockaway Townsquare', 'Morris'),
    ('Woodbridge Center', 'Mall', 'Woodbridge Center', 'Middlesex'),
    ('Freehold Raceway Mall', 'Mall', 'Freehold Raceway Mall', 'Monmouth'),
    # --- parks and nature, north first
    ('Palisades Interstate Park', 'Park', 'Palisades Interstate Park', 'Bergen'),
    ('Fort Lee Historic Park', 'Park', 'Fort Lee Historic Park', 'Bergen'),
    ('Overpeck County Park', 'Park', 'Overpeck County Park', 'Bergen'),
    ('Van Saun Park', 'Park', 'Van Saun Park', 'Bergen'),
    ('DeKorte Park', 'Park', 'DeKorte Park', 'Bergen'),
    ('Garret Mountain Reservation', 'Park', 'Garret Mountain Reservation', 'Passaic'),
    ('Eagle Rock Reservation', 'Park', 'Eagle Rock Reservation', 'Essex'),
    ('South Mountain Reservation', 'Park', 'South Mountain Reservation', 'Essex'),
    ('Watchung Reservation', 'Park', 'Watchung Reservation', 'Union'),
    ('Ramapo Mountain State Forest', 'State forest', 'Ramapo Mountain State Forest', 'Bergen'),
    ('Skylands Manor', 'Botanical garden', 'Skylands Manor', 'Passaic'),
    ('Pyramid Mountain', 'Park', 'Pyramid Mountain Natural Historic Area', 'Morris'),
    ('Lake Hopatcong', 'Lake', 'Lake Hopatcong', 'Morris'),
    ('Great Swamp National Wildlife Refuge', 'Wildlife refuge', 'Great Swamp National Wildlife Refuge', 'Morris'),
    ('Morristown National Historical Park', 'Historic park', 'Morristown National Historical Park', 'Morris'),
    ('Stokes State Forest', 'State forest', 'Stokes State Forest', 'Sussex'),
    ('Mount Tammany', 'Mountain', 'Mount Tammany', 'Warren'),
    ('Worthington State Forest', 'State forest', 'Worthington State Forest', 'Warren'),
    ('Hacklebarney State Park', 'State park', 'Hacklebarney State Park', 'Morris'),
    ('Washington Rock', 'Park', 'Washington Rock State Park', 'Somerset'),
    ('Round Valley Reservoir', 'Reservoir', 'Round Valley Reservoir', 'Hunterdon'),
    ('Washington Crossing State Park', 'Historic park', 'Washington Crossing State Park (New Jersey)', 'Mercer'),
    ('Island Beach State Park', 'State park', 'Island Beach State Park', 'Ocean'),
    ('Asbury Park Boardwalk', 'Boardwalk', 'Asbury Park, New Jersey', 'Monmouth'),
    ('Seaside Heights Boardwalk', 'Boardwalk', 'Seaside Heights, New Jersey', 'Ocean'),
    ('Cheesequake State Park', 'State park', 'Cheesequake State Park', 'Middlesex'),
    ('Twin Lights', 'Lighthouse', 'Navesink Twin Lights', 'Monmouth'),
    ('Allaire State Park', 'State park', 'Allaire State Park', 'Monmouth'),
    ('Monmouth Battlefield', 'Historic park', 'Monmouth Battlefield State Park', 'Monmouth'),
    ('Bergen County Courthouse', 'Courthouse', 'Bergen County Courthouse', 'Bergen'),
    ('Battleship New Jersey', 'Museum ship', 'USS New Jersey (BB-62)', 'Camden'),
]


def get(url):
    for i in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read()
        except Exception as e:
            print('  retry', e); time.sleep(3 + 4 * i)
    raise SystemExit('Wikipedia not reachable')


CACHE = '/tmp/nj/wiki_coords.json'


def coords(titles):
    out = {}
    if os.path.exists(CACHE):
        out = {k: tuple(v) for k, v in json.load(open(CACHE)).items()}
        titles = [t for t in titles if t not in out]
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'coordinates', 'colimit': 'max', 'redirects': 1, 'titles': '|'.join(chunk)})
        d = json.loads(get('https://en.wikipedia.org/w/api.php?' + q))['query']
        redir = {r['from']: r['to'] for r in d.get('redirects', [])}
        norm = {r['from']: r['to'] for r in d.get('normalized', [])}
        by = {p['title']: p for p in d['pages'].values()}
        for t in chunk:
            t2 = redir.get(norm.get(t, t), norm.get(t, t))
            p = by.get(t2)
            if p and p.get('coordinates'):
                c = p['coordinates'][0]
                out[t] = (c['lon'], c['lat'])
        time.sleep(2)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(out, open(CACHE, 'w'))
    return out


def towns():
    t = json.load(open(os.path.join(ROOT, 'data/nj.topo.json')))
    sx, sy = t['transform']['scale']; tx, ty = t['transform']['translate']
    arcs = []
    for a in t['arcs']:
        x = y = 0; pts = []
        for dx, dy in a:
            x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    def ring(idx):
        pts = []
        for i in idx:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts += seg if not pts else seg[1:]
        return pts
    polys, props = [], []
    for g in t['objects']['munis']['geometries']:
        rs = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]
        ps = [Polygon(ring(p[0]), [ring(h) for h in p[1:]]).buffer(0) for p in rs]
        polys.append(MultiPolygon(ps) if len(ps) > 1 else ps[0]); props.append(g['properties'])
    return polys, props


def main():
    exist = open(os.path.join(ROOT, 'js/knowledge.js')).read()
    have = set(re.findall(r"name: '([^']+)'", exist[exist.index('export const LANDMARKS'):exist.index('export const ROAD_NOTES') if 'export const ROAD_NOTES' in exist else None]))
    titles = [w for _, _, w, _ in LIST]
    cs = coords(titles)
    polys, props = towns()
    tree = STRtree(polys)
    out, bad = [], []
    for name, kind, wiki, county in LIST:
        if name in have:
            continue
        if wiki not in cs:
            bad.append((name, 'no coordinates for ' + wiki)); continue
        lon, lat = cs[wiki]
        pt = Point(lon, lat)
        hit = [i for i in tree.query(pt) if polys[i].contains(pt)]
        if not hit:                                 # over water (a bridge): the nearest town within 700 m, the point moved to its shore
            near = [(polys[i].distance(pt), i) for i in range(len(polys)) if polys[i].distance(pt) < 0.009]
            if not near:
                bad.append((name, f'in no town ({lon:.4f}, {lat:.4f}): outside the state?')); continue
            d, i = min(near)
            from shapely.ops import nearest_points
            q = nearest_points(polys[i], pt)[0]
            c = polys[i].representative_point()
            lon, lat = q.x + (c.x - q.x) * 0.02, q.y + (c.y - q.y) * 0.02
            pt = Point(lon, lat)
            hit = [i]
        p = props[hit[0]]
        if p['c'] != county:
            bad.append((name, f'lands in {p["full"]}, {p["c"]} County, expected {county}')); continue
        out.append((name, kind, round(lon, 4), round(lat, 4), f'{p["full"]}|{p["c"]}'))
    for n, why in bad:
        print('  SKIPPED', n, '-', why)
    q = lambda v: ("'" + v.replace('\\', '\\\\') + "'") if "'" not in v else json.dumps(v, ensure_ascii=False)    # (a name with an apostrophe gets double quotes)
    block = '\n'.join("  { name: %s, kind: %s, pt: [%s, %s], town: %s }," % (q(n), q(k), lo, la, q(t)) for n, k, lo, la, t in out)
    path = os.path.join(ROOT, 'js/knowledge.js')
    s = open(path).read()
    a, b = '  // --- generated: tools/build_nj_landmark_list.py ---\n', '  // --- end generated ---\n'
    if a in s:
        s = s[:s.index(a)] + s[s.index(b) + len(b):]
    i = s.index('export const LANDMARKS')
    j = s.index('\n];', i)
    s = s[:j] + '\n' + a + block + '\n' + b.rstrip('\n') + s[j:]
    open(path, 'w').write(s)
    print(f'{len(out)} landmarks added, {len(bad)} skipped')
    for n, k, lo, la, t in out:
        print(f'   {n:40s} {t}')


if __name__ == '__main__':
    main()
