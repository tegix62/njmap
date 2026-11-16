#!/usr/bin/env python3
"""More mountains for "Name that place" and the lakes-and-mountains list: ranges and summits in New Jersey, and the ones just outside it that
anyone living in the north of the state looks at (the Hudson Highlands, the Catskills, the Poconos, Blue Mountain, the Shawangunks).

Added to data/nj-places.json and data/nj-geoms.json (same shapes as tools/build_nj_geoms.py makes: a crest line or a summit, with three
bands for the mass), and to NATURE in js/knowledge.js between the GENERATED RANGES markers. Nothing already there is rebuilt.

Each entry below is a name, a kind and a seed point from general knowledge; everything else is read from data:
  - the summit is the highest ground of the terrain model within about a kilometre of the seed, and its height is read there. Where I know
    the published height it is given as `expect_ft`: an entry whose terrain height is more than 12% away is REPORTED AND SKIPPED, because
    that means the seed is on the wrong hill;
  - a ridge's crest and every mass come from the terrain model (crest, mountain_bands in build_nj_geoms.py);
  - the towns and counties come from the app's own boundaries; a place outside New Jersey gets its state and "N mi NW of <nearest NJ town>".

  python3 tools/build_nj_ranges.py        (needs the AWS terrain tiles; about a minute)
"""
import json, math, os, re, sys
import numpy as np
from shapely.geometry import Point, Polygon, LineString
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_nj_places as BP
import build_nj_geoms as BG
import build_nj_landmark_list as BL

ROOT = BL.ROOT
# (name, type, lon, lat, size, expect_ft, state or None for New Jersey, note)
#   peak: size unused.  ridge: size = half-length in km round the seed.  massif: size = reach of the mass from the seed, km.
#   chain: lon/lat unused; `size` is a list of existing place names in data/nj-places.json whose points the crest runs through.
LIST = [
    # --- New Jersey, north-east first
    ('Watchung Mountains', 'chain', 0, 0, ['Garret Mountain', 'Eagle Rock Reservation', 'South Mountain Reservation', 'Watchung Reservation', 'Washington Rock'], None, None,
     'The long basalt ridges that curve from Paterson down past the Oranges to Bound Brook; Garret Mountain, Eagle Rock, South Mountain and Washington Rock all sit on them'),
    ('Campgaw Mountain', 'peak', -74.197, 41.057, 0, 752, None, 'The hill between Mahwah, Oakland and Franklin Lakes with Bergen County’s ski slope on it'),
    ('High Mountain', 'peak', -74.203, 40.972, 0, 885, None, 'The highest of the Watchung ridges, above Wayne and North Haledon, with a view of the New York skyline'),
    ('Snake Hill', 'peak', -74.0892, 40.7578, 0, None, None, 'The lone rock beside the Turnpike in Secaucus, rising out of the Meadowlands (Laurel Hill)'),
    ('Pyramid Mountain', 'peak', -74.386, 40.953, 0, 934, None, 'Wooded hill between Montville, Boonton and Kinnelon, known for Tripod Rock'),
    ('Wawayanda Mountain', 'ridge', -74.44, 41.20, 6, None, None, 'The wall above Vernon Valley that the Appalachian Trail climbs; Wawayanda State Park lies on top'),
    ('Hamburg Mountain', 'ridge', -74.55, 41.14, 6, None, None, 'The Highlands ridge above Hamburg and Vernon, with the Mountain Creek ski slopes on its east side'),
    ('Sunrise Mountain', 'peak', -74.722, 41.218, 0, 1653, None, 'A summit of the Kittatinny Ridge in Stokes State Forest, with a pavilion on top'),
    ('Scotts Mountain', 'ridge', -75.07, 40.76, 6, None, None, 'The broad Warren County ridge between Belvidere and Phillipsburg; Merrill Creek Reservoir sits on it'),
    ('Musconetcong Mountain', 'ridge', -75.03, 40.63, 7, None, None, 'The ridge along the south side of the Musconetcong valley in Hunterdon County'),
    ('Cushetunk Mountain', 'peak', -74.825, 40.5987, 0, 834, None, 'The horseshoe of rock that holds Round Valley Reservoir, by Lebanon and I-78'),
    ('Baldpate Mountain', 'peak', -74.89, 40.32, 0, 479, None, 'The highest point in Mercer County, above the Delaware near Titusville'),
    ('Mount Mitchill', 'peak', -74.005, 40.407, 0, 266, None, 'The headland of the Atlantic Highlands above Sandy Hook: the highest ground on the Atlantic coast south of Maine'),
    ('Apple Pie Hill', 'peak', -74.59, 39.807, 0, 205, None, 'A sandy rise with a fire tower in the middle of the Pine Barrens: the high point of the Pinelands'),
    # --- over the line, in sight of North Jersey
    ('High Tor', 'peak', -73.966, 41.188, 0, 832, 'New York', 'The highest point of the Palisades, above Haverstraw on the Hudson'),
    ('Bear Mountain', 'peak', -73.992, 41.312, 0, 1283, 'New York', 'The summit above the Bear Mountain Bridge, at the south gate of the Hudson Highlands'),
    ('Storm King Mountain', 'peak', -74.0, 41.431, 0, 1340, 'New York', 'The dome on the west bank at the north gate of the Hudson Highlands, facing Breakneck Ridge'),
    ('Schunemunk Mountain', 'ridge', -74.105, 41.39, 6, 1664, 'New York', 'The long double ridge west of the Thruway in Orange County, the highest ground in that county'),
    ('Bellvale Mountain', 'ridge', -74.30, 41.24, 6, None, 'New York', 'Bearfort Mountain carried on across the New York line, above the east shore of Greenwood Lake toward Warwick'),
    ('Shawangunk Ridge', 'ridge', -74.36, 41.67, 14, 2289, 'New York', 'The Kittatinny Ridge carried on into New York: white cliffs above the Wallkill valley ("the Gunks")'),
    ('Catskill Mountains', 'massif', -74.386, 41.999, 30, 4180, 'New York', 'The big mountain mass beyond the Shawangunks, about two hours north of the George Washington Bridge'),
    ('Blue Mountain', 'ridge', -75.30, 40.87, 14, None, 'Pennsylvania', 'The Kittatinny Ridge carried on south-west of the Delaware Water Gap, the long wall north of the Lehigh Valley'),
    ('Pocono Mountains', 'massif', -75.352, 41.043, 22, 2133, 'Pennsylvania', 'The plateau west of the Delaware Water Gap, where I-80 climbs out of New Jersey toward Scranton'),
    ('Todt Hill', 'peak', -74.105, 40.6, 0, 401, 'New York', 'The spine of Staten Island, seen across the Arthur Kill and Newark Bay'),
]
# a knob narrower than the terrain model's cells reads too low there: no height is given for it (Snake Hill's seed was checked as the one high cell in the marsh)
NO_HEIGHT = {'Snake Hill'}
KIND_WORD = {'peak': 'Mountain', 'ridge': 'Ridge', 'chain': 'Ridge', 'massif': 'Mountain'}
COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']


def summit(lon, lat):
    """The highest ground within about a kilometre: (lon, lat, metres)."""
    return BP.elevation(lon, lat, 40, z=12, where=True)


def trace(seeds):
    """A crest through given points: between each pair, every 1.2 km, the highest ground within 1.5 km either side of the straight line."""
    out = []
    for (ax, ay), (bx, by) in zip(seeds, seeds[1:]):
        dx, dy = (bx - ax) * 84200, (by - ay) * 111000
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        for t in np.arange(0, L, 1200):
            best = None
            for off in np.arange(-1500, 1501, 300):
                x = ax + (ux * t - uy * off) / 84200
                y = ay + (uy * t + ux * off) / 111000
                e = BP.elevation(x, y, 2, z=BG.Z)
                if best is None or e > best[0]:
                    best = (e, x, y)
            out.append((best[1], best[2]))
    out.append(seeds[-1])
    arr = np.array(out)
    if len(arr) >= 5:
        k = np.ones(3) / 3
        sm = arr.copy()
        sm[1:-1] = np.column_stack([np.convolve(arr[:, i], k, mode='valid') for i in range(2)])
        arr = sm
    return [[round(float(a), 5), round(float(b), 5)] for a, b in arr]


def main():
    polys, props = BL.towns()
    tree = STRtree(polys)
    nj = None
    def town(lon, lat):
        pt = Point(lon, lat)
        hit = [i for i in tree.query(pt) if polys[i].contains(pt)]
        return props[hit[0]] if hit else None
    def nearest_town(lon, lat):
        pt = Point(lon, lat)
        d, i = min((polys[i].distance(pt), i) for i in range(len(polys)))
        c = polys[i].representative_point()
        mi = math.hypot((lon - c.x) * 84200, (lat - c.y) * 111000) / 1609.34
        brg = (math.degrees(math.atan2((lon - c.x) * 84200, (lat - c.y) * 111000)) + 360) % 360
        return props[i], mi, COMPASS[int((brg + 22.5) // 45) % 8]
    places = json.load(open(os.path.join(ROOT, 'data/nj-places.json')))
    geoms = json.load(open(os.path.join(ROOT, 'data/nj-geoms.json')))
    by_name = {p['n']: p for p in places}
    made, nature = [], []
    for name, typ, lon, lat, size, expect, state, note in LIST:
        g, elev = None, None
        if typ == 'chain':
            seeds = []
            for n in size:
                if n not in by_name:
                    print('  !! chain seed missing:', n); seeds = None; break
                x, y, _ = summit(*by_name[n]['p'])
                seeds.append((x, y))
            if not seeds:
                continue
            c = trace(seeds)
            bands = BG.mountain_bands(c, 30, 2600)
            g = {'type': 'LineString', 'coordinates': c, 'ridge': True, **({'bands': bands} if bands else {})}
            lon, lat = c[len(c) // 2]
            r = 9
        else:
            sx, sy, em = summit(lon, lat)
            ft = em * 3.28084
            if expect and abs(ft - expect) / expect > 0.12:
                print(f'  !! SKIPPED {name}: terrain says {ft:.0f} ft near the seed, published {expect} ft (wrong hill?)')
                continue
            if typ == 'peak':
                bands = BG.mountain_bands([(sx, sy)], 5.5, 2600)
                g = {'type': 'Point', 'coordinates': [round(sx, 5), round(sy, 5)], 'peak': True, **({'bands': bands} if bands else {})}
                lon, lat, elev, r = sx, sy, ft, 3
            elif typ == 'massif':
                bands = BG.mountain_bands([(sx, sy)], size * 1.5, size * 1000)
                g = {'type': 'Point', 'coordinates': [round(sx, 5), round(sy, 5)], 'peak': True, **({'bands': bands} if bands else {})}
                lon, lat, elev, r = sx, sy, ft, size * 0.6
            else:
                c = BG.crest(lon, lat, size)
                if len(c) < 3:
                    print('  !! no crest for', name); continue
                bands = BG.mountain_bands(c, size * 1.25)
                g = {'type': 'LineString', 'coordinates': c, 'ridge': True, **({'bands': bands} if bands else {})}
                lon, lat = c[len(c) // 2]
                r = max(2.5, size * 0.6)
                if expect:
                    top = max(BP.elevation(x, y, 2, z=BG.Z) for x, y in c) * 3.28084
                    if abs(top - expect) / expect > 0.12:
                        print(f'  !! SKIPPED {name}: crest tops out at {top:.0f} ft, published {expect} ft'); continue
                    elev = None
        if not g.get('bands'):
            print('  !! no mass for', name); continue
        p = town(lon, lat)
        e = {'n': name, 'kind': 'mountain', 'k': 'nat', 'p': [round(lon, 5), round(lat, 5)], 'z': 11.8 if typ == 'peak' else BP.zoom_for(r * 1.6, lat), 'pitch': 64, 'r': round(r, 1),
             'line': note, 'at': p['full'] if p else '', 'c': p['c'] if p else ''}
        # a height is stated only when the terrain model agrees with the published one to within 4% (a narrow summit reads low on it)
        if elev and name not in NO_HEIGHT and not (expect and abs(elev - expect) / expect > 0.04):
            e['elev'] = int(round(elev / 10) * 10)
        if state:
            pr, mi, word = nearest_town(lon, lat)
            e['st'] = state
            e['from'] = f"{int(round(mi))} mi {word} of {pr['full']}"
            e['at'] = e['c'] = ''
        # the towns its mass lies in (as tools/build_nj_geoms.py lists them)
        zone = Polygon(g['bands'][0]).buffer(0)
        crest_ln = LineString(g['coordinates']) if g['type'] == 'LineString' else None
        hits = []
        for i in tree.query(zone):
            inter = polys[i].intersection(zone)
            if inter.is_empty or inter.area / zone.area < 0.04:
                continue
            pos = crest_ln.project(inter.representative_point()) if crest_ln is not None else -inter.area
            hits.append((pos, props[i]['full'], props[i]['c']))
        hits.sort()
        if hits and not state:
            e['towns'] = [n for _, n, _ in hits]
            e['counties'] = list(dict.fromkeys(c for _, _, c in hits))
            if not e['at']:
                e['at'], e['c'] = e['towns'][0], e['counties'][0]
        made.append((e, g))
        nature.append((name, KIND_WORD[typ], e['p'], e['r'], note, state))
        print(f"  {name:24s} {typ:7s} {e['p']} {('elev ' + str(e['elev']) + ' ft') if 'elev' in e else '':14s} {state or e['at'] + ', ' + e['c']:34s} {e.get('from', '')}  bands {len(g['bands'])}  towns {len(e.get('towns', []))}")
    names = {e['n'] for e, _ in made}
    places = [p for p in places if p['n'] not in names]
    # after the last mountain, so the list stays grouped by kind
    last = max((i for i, p in enumerate(places) if p['kind'] == 'mountain'), default=len(places) - 1)
    places[last + 1:last + 1] = [e for e, _ in made]
    for e, g in made:
        geoms[e['n']] = g
    json.dump(places, open(os.path.join(ROOT, 'data/nj-places.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(geoms, open(os.path.join(ROOT, 'data/nj-geoms.json'), 'w'), separators=(',', ':'))
    # NATURE in js/knowledge.js: the generated block, replaced whole each run
    kp = os.path.join(ROOT, 'js/knowledge.js')
    s = open(kp).read()
    q = lambda t: t.replace("'", '’')
    block = '  // GENERATED RANGES (tools/build_nj_ranges.py): do not edit by hand\n' + ''.join(
        f"  {{ name: '{q(n)}', kind: '{k}', pt: [{pt[0]}, {pt[1]}], r: {r}, note: '{q(note)}.'{', out: ' + repr(st) if st else ''} }},\n" for n, k, pt, r, note, st in nature) + '  // END GENERATED RANGES\n'
    if '// GENERATED RANGES' in s:
        s = re.sub(r"  // GENERATED RANGES.*?// END GENERATED RANGES\n", block, s, flags=re.S)
    else:
        i = s.index('export const NATURE')
        j = s.index('];', i)
        s = s[:j] + block + s[j:]
    open(kp, 'w').write(s)
    print(len(made), 'ranges and summits;', os.path.getsize(os.path.join(ROOT, 'data/nj-geoms.json')) // 1024, 'KB of shapes')


if __name__ == '__main__':
    main()
