#!/usr/bin/env python3
"""Builds data/landmarks.json: famous buildings and places worth knowing, for the "by the way, this is right
next to you" callouts in the drive games.

Each entry has a short name, a few words on why it matters, and the building's point from NYC's Points of
Interest dataset (NYC Open Data, t95h-5fsr, public domain). Where that dataset has no good match, the
fallback point listed here is used (and reported).

usage: python3 tools/build_landmarks.py            (writes data/landmarks.json and prints what matched)
"""
import json, os, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POI = 'https://data.cityofnewyork.us/resource/t95h-5fsr.json'

# (name shown, POI search text (upper case, matched against feature_name), note, fallback (lon, lat))
L = [
    # Midtown
    ('Chrysler Building', 'CHRYSLER BUILDING', 'Art Deco spire, Lexington Ave & 42nd St', (-73.97536, 40.75162)),
    ('Empire State Building', 'EMPIRE STATE BUILDING', '5th Ave, 33rd to 34th St', (-73.98532, 40.74844)),
    ('Grand Central Terminal', 'GRAND CENTRAL TERMINAL', '42nd St & Park Ave', (-73.97727, 40.7525)),
    ('New York Public Library', 'NEW YORK PUBLIC LIBRARY', '5th Ave & 42nd St, the lions', (-73.98213, 40.75319)),
    ('Bryant Park', 'BRYANT PARK', 'behind the library, 40th to 42nd St', (-73.98355, 40.75358)),
    ('Rockefeller Center', 'ROCKEFELLER CENTER', '30 Rock, 48th to 51st St, 5th to 6th Ave', (-73.97784, 40.75928)),
    ('Radio City Music Hall', 'RADIO CITY MUSIC HALL', '6th Ave & 50th St', (-73.97995, 40.76003)),
    ("St. Patrick's Cathedral", "ST PATRICK'S CATHEDRAL", '5th Ave & 51st St', (-73.97611, 40.75846)),
    ('Times Square', 'TIMES SQUARE', 'Broadway & 7th Ave, 42nd to 47th St', (-73.98513, 40.75899)),
    ('Port Authority Bus Terminal', 'PORT AUTHORITY BUS TERMINAL', '8th Ave, 40th to 42nd St', (-73.99078, 40.7567)),
    ('Madison Square Garden', 'MADISON SQUARE GARDEN', '7th to 8th Ave, 31st to 33rd St, on top of Penn Station', (-73.99337, 40.75048)),
    ('Penn Station', 'PENN STATION', 'under Madison Square Garden', (-73.99211, 40.75007)),
    ("Macy's Herald Square", 'MACYS HERALD SQUARE', 'Broadway & 34th St', (-73.98983, 40.75109)),
    ('Flatiron Building', 'FLATIRON BUILDING', '5th Ave & Broadway at 23rd St', (-73.98964, 40.74108)),
    ('Madison Square Park', 'MADISON SQUARE PARK', '23rd to 26th St, 5th Ave & Broadway', (-73.98788, 40.74228)),
    ('Union Square', 'UNION SQUARE PARK', '14th to 17th St, Broadway & Park Ave S', (-73.99043, 40.73594)),
    ('Carnegie Hall', 'CARNEGIE HALL', '57th St & 7th Ave', (-73.97997, 40.76502)),
    ('MoMA', 'MUSEUM OF MODERN ART (MOMA)', '11 W 53rd St, between 5th and 6th Ave', (-73.97713, 40.76117)),
    ('Plaza Hotel', 'PLAZA HOTEL', '5th Ave & 59th St, at Central Park', (-73.97467, 40.76457)),
    ("Bloomingdale's", 'BLOOMINGDALES 59 ST STORE', '59th St & Lexington Ave', (-73.96675, 40.76202)),
    ('Columbus Circle', 'ONE COLUMBUS CIRCLE', '59th St & 8th Ave, at Central Park', (-73.98345, 40.76817)),
    ('United Nations', 'UNITED NATIONS HEADQUARTERS', '1st Ave, 42nd to 48th St', (-73.96897, 40.74876)),
    ('Javits Center', 'JAVITS CENTER', '11th Ave, 34th to 38th St, the glass convention center', (-74.00341, 40.75746)),
    ('Chelsea Market', 'CHELSEA MARKET', '9th Ave, 15th to 16th St', (-74.00475, 40.74222)),
    ('Morgan Library', 'MORGAN LIBRARY', 'Madison Ave & 36th St', (-73.98134, 40.74927)),
    ('Waldorf Astoria', 'WALDORF ASTORIA', 'Park Ave, 49th to 50th St', (-73.97426, 40.75636)),
    ('Trump Tower', 'TRUMP TOWER', '5th Ave & 56th St', (-73.97367, 40.76237)),
    ('Tudor City', 'TUDOR CITY', '1st to 2nd Ave, 40th to 43rd St, above the UN', (-73.96995, 40.74903)),
    # Downtown
    ('One World Trade Center', '1 WORLD TRADE CENTER', 'the tallest tower, West St & Vesey St', (-74.01306, 40.71311)),
    ('9/11 Memorial', '9/11 MEMORIAL', 'the two pools, where the Twin Towers stood', (-74.01341, 40.71154)),
    ('Oculus', 'OCULUS', 'World Trade Center transit hub', (-74.01175, 40.71128)),
    ('Woolworth Building', 'WOOLWORTH BUILDING', 'Broadway & Park Place, Gothic tower', (-74.00797, 40.71264)),
    ('City Hall', 'CITY HALL', 'Broadway & Chambers St, in City Hall Park', (-74.0061, 40.71281)),
    ('Brooklyn Bridge', 'BROOKLYN BRIDGE', 'Manhattan end at Park Row & Centre St', (-74.00093, 40.71081)),
    ('Stock Exchange', 'NY STOCK EXCHANGE', 'Wall St & Broad St', (-74.01127, 40.70694)),
    ('Federal Hall', 'FEDERAL HALL', 'Wall St & Nassau St, with the Washington statue', (-74.01029, 40.70725)),
    ('Trinity Church', 'TRINITY CHURCH', 'Broadway at the head of Wall St', (-74.01208, 40.70814)),
    ('Charging Bull', 'CHARGING BULL', 'Broadway & Morris St, at Bowling Green', (-74.01339, 40.70558)),
    ('Battery Park', 'BATTERY PARK', 'the tip of Manhattan, Castle Clinton and ferries', (-74.01637, 40.70374)),
    ('Staten Island Ferry', 'WHITEHALL FERRY TERMINAL', 'Whitehall St & South St, free ferry', (-74.01329, 40.70123)),
    ('Washington Square Arch', 'WASHINGTON SQUARE PARK', 'the arch at 5th Ave & Waverly Pl', (-73.99765, 40.73097)),
    ('Cooper Union', 'COOPER UNION', 'Cooper Sq, 3rd Ave & 7th St', (-73.99125, 40.72928)),
    ("Katz's Delicatessen", "KATZ'S DELICATESSEN", 'E Houston St & Ludlow St', (-73.98743, 40.72228)),
    ('Whitney Museum', 'WHITNEY MUSEUM OF AMERICAN ART', 'Gansevoort St, the south end of the High Line', (-74.00916, 40.73955)),
    # Uptown (fallback points; approximate building centres)
    ('Lincoln Center', 'LINCOLN CENTER', 'Columbus Ave & 64th St, the fountain plaza and the Met Opera', (-73.9835, 40.7725)),
    ('Strawberry Fields', 'STRAWBERRY FIELDS', 'Central Park West & 72nd St, the Imagine mosaic', (-73.9751, 40.7756)),
    ('The Dakota', 'THE DAKOTA', 'Central Park West & 72nd St, the gabled apartment house', (-73.9763, 40.7766)),
    ('Natural History Museum', 'AMERICAN MUSEUM OF NATURAL HISTORY', 'Central Park West, 77th to 81st St', (-73.9740, 40.7813)),
    ("Zabar's", "ZABAR'S", 'Broadway & 80th St', (-73.9798, 40.7871)),
    ('Frick Collection', 'FRICK COLLECTION', '5th Ave & 70th St', (-73.9672, 40.7712)),
    ('The Met', 'METROPOLITAN MUSEUM OF ART', '5th Ave & 82nd St, the big steps', (-73.9632, 40.7794)),
    ('Guggenheim', 'SOLOMON R GUGGENHEIM MUSEUM', '5th Ave & 89th St, the white spiral', (-73.9590, 40.7830)),
    ('Mount Sinai Hospital', 'MOUNT SINAI HOSPITAL', 'Madison Ave & 99th St', (-73.9524, 40.7900)),
    ('Queensboro Bridge', 'QUEENSBORO BRIDGE', 'Manhattan end at 59th St & 2nd Ave', (-73.9610, 40.7585)),
    ('Roosevelt Island Tram', 'ROOSEVELT ISLAND TRAMWAY', '2nd Ave & 60th St, the cable car to the island', (-73.9648, 40.7612)),
]
FORCE_FALLBACK = {'Penn Station', 'Federal Hall', 'Charging Bull', 'Oculus', "Katz's Delicatessen", 'Washington Square Arch',
                  'Staten Island Ferry', 'Brooklyn Bridge', 'Trinity Church', 'Morgan Library', 'Waldorf Astoria', 'Trump Tower',
                  'Tudor City', 'Bryant Park', 'New York Public Library', "St. Patrick's Cathedral", 'Times Square', '9/11 Memorial',
                  'Plaza Hotel', 'Woolworth Building', 'Cooper Union', 'Battery Park',
                  'Lincoln Center', 'Strawberry Fields', 'The Dakota', 'Natural History Museum', "Zabar's", 'Frick Collection', 'The Met',
                  'Guggenheim', 'Mount Sinai Hospital', 'Queensboro Bridge', 'Roosevelt Island Tram'}


def poi(q):
    url = POI + '?' + urllib.parse.urlencode({'$where': f"upper(feature_name) like '%{q.replace(chr(39), chr(39)*2)}%' AND boroughcode='1'", '$limit': '25'})
    try:
        return json.load(urllib.request.urlopen(url, timeout=60))
    except Exception as e:
        print('  (POI lookup failed:', e, ')', file=sys.stderr)
        return []


def main():
    out, rep = [], []
    old = {l['n']: l for l in json.load(open(os.path.join(ROOT, 'data/landmarks.json')))}
    for name, q, note, fb in L:
        if name in old:
            out.append(old[name]); continue
        pt, src = fb, 'fallback'
        if name not in FORCE_FALLBACK:
            rows = poi(q)
            # the building itself (the exact name) before anything merely containing it
            rows.sort(key=lambda r: (r['feature_name'].upper() != q, len(r['feature_name'])))
            if rows:
                c = rows[0]['the_geom']['coordinates']
                pt, src = (round(c[0], 5), round(c[1], 5)), 'POI: ' + rows[0]['feature_name']
        out.append({'n': name, 'note': note, 'p': [pt[0], pt[1]]})
        rep.append(f'{name:28s} {pt[0]:.5f},{pt[1]:.5f}  {src}')
    json.dump(out, open(os.path.join(ROOT, 'data/landmarks.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('\n'.join(rep))
    print(f'wrote data/landmarks.json ({len(out)} landmarks)')


if __name__ == '__main__':
    main()
