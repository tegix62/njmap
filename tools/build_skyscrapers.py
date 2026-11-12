#!/usr/bin/env python3
"""The named skyscrapers: data/skyscrapers.json (for the "name that tower" game) and their landmark entries.

Each entry: name, where it stands (lon, lat of its middle), height in metres (the architectural top), year, a short
description, and the address in words. Positions and heights are checked against NYC's building footprints and the
survey towers (data/towers.json) by `--check`, which prints each tower's nearest building and the difference.

  python3 tools/build_skyscrapers.py --check      (compare with the footprint data and the survey towers)
  python3 tools/build_skyscrapers.py              (write data/skyscrapers.json, add missing ones to data/landmarks.json)
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# name, (lon, lat), height m, year, [style/architect/fact], address, neighborhood
S = [
    ('Empire State Building', (-73.98566, 40.74844), 381, 1931, 'Art Deco, 102 floors, built in 410 days', '5th Ave & 34th St', 'Midtown South'),
    ('Chrysler Building', (-73.97535, 40.75166), 319, 1930, 'Art Deco, a stainless-steel crown of arches and a needle', 'Lexington Ave & 42nd St', 'Turtle Bay'),
    ('One World Trade Center', (-74.01310, 40.71270), 541, 2014, 'the tallest building in the Western Hemisphere, 1,776 ft with its spire', 'West St & Vesey St', 'Financial District'),
    ('30 Rockefeller Plaza', (-73.97931, 40.75874), 259, 1933, 'the slab of Rockefeller Center, home of NBC', '6th Ave & 50th St', 'Midtown'),
    ('Bank of America Tower', (-73.98458, 40.75537), 366, 2009, 'glass crystal with a spire, beside Bryant Park', '6th Ave & 42nd St', 'Midtown'),
    ('Woolworth Building', (-74.00797, 40.71264), 241, 1913, 'Gothic "Cathedral of Commerce", the world\'s tallest until 1930', 'Broadway & Park Place', 'Tribeca'),
    ('MetLife Building', (-73.97665, 40.75339), 246, 1963, 'the wide octagonal slab that sits on Grand Central, built as Pan Am', 'Park Ave & 45th St', 'Midtown East'),
    ('Citigroup Center', (-73.97000, 40.75840), 279, 1977, 'a slanted roof, standing on four stilts above a church', 'Lexington Ave & 53rd St', 'Midtown East'),
    ('Hearst Tower', (-73.98361, 40.76656), 182, 2006, 'a diamond-lattice glass tower on top of a 1928 base', '8th Ave & 57th St', 'Midtown West'),
    ('New York Times Building', (-73.99032, 40.75570), 319, 2007, 'Renzo Piano\'s tower with a ceramic-rod screen and a mast', '8th Ave & 41st St', 'Midtown West'),
    ('One Vanderbilt', (-73.97839, 40.75263), 427, 2020, 'a tapering glass tower beside Grand Central, with an observation deck', 'Vanderbilt Ave & 42nd St', 'Midtown East'),
    ('Central Park Tower', (-73.98065, 40.76595), 472, 2020, 'among the tallest residential towers in the world, on Billionaires\' Row', 'W 57th St, 7th Ave to 8th Ave', 'Midtown'),
    ('432 Park Avenue', (-73.97194, 40.76166), 426, 2015, 'a plain concrete square, a slender 1:15 ratio', 'Park Ave & 56th St', 'Midtown East'),
    ('111 West 57th Street', (-73.97835, 40.76490), 435, 2021, 'the Steinway Tower, one of the thinnest towers in the world', 'W 57th St, 6th Ave to 7th Ave', 'Midtown'),
    ('Seagram Building', (-73.97200, 40.75800), 157, 1958, 'Mies van der Rohe\'s bronze-glass slab set back on a plaza', 'Park Ave & 53rd St', 'Midtown East'),
    ('Trump Tower', (-73.97394, 40.76240), 202, 1983, 'a sawtooth glass tower with an atrium', '5th Ave & 56th St', 'Midtown'),
    ('Time Warner Center', (-73.98287, 40.76846), 229, 2003, 'twin glass towers on Columbus Circle', 'Columbus Circle', 'Columbus Circle'),
    ('8 Spruce Street', (-74.00570, 40.71070), 265, 2011, 'Frank Gehry\'s rippling stainless-steel tower', 'Spruce St & Nassau St', 'Financial District'),
    ('Four World Trade Center', (-74.01150, 40.70980), 298, 2013, 'a plain glass prism at the 9/11 Memorial', 'Church St & Liberty St', 'Financial District'),
    ('4 Times Square', (-73.98573, 40.75601), 247, 1999, 'the Condé Nast building, with a mast and a giant sign wall', 'Broadway & 42nd St', 'Times Square'),
    ('Metropolitan Life Tower', (-73.98720, 40.74146), 213, 1909, 'a clock tower modeled on Venice\'s campanile', 'Madison Ave & 24th St', 'Flatiron'),
    ('Flatiron Building', (-73.98964, 40.74108), 87, 1902, 'a wedge on a triangular block, only 22 floors', '5th Ave & Broadway at 23rd St', 'Flatiron'),
    ('Chanin Building', (-73.97640, 40.75190), 207, 1929, 'Art Deco, with a bronze-and-terra-cotta lobby', 'Lexington Ave & 42nd St', 'Turtle Bay'),
    ('Waldorf Astoria', (-73.97394, 40.75613), 191, 1931, 'Art Deco twin-towered hotel, a block of Park Avenue', 'Park Ave & 50th St', 'Midtown East'),
    ('Municipal Building', (-74.00440, 40.71270), 178, 1914, 'a Beaux-Arts tower topped by a gold statue, with an arch for the street', 'Centre St & Chambers St', 'Civic Center'),
    ('53 West 53rd', (-73.97790, 40.76170), 320, 2019, 'a faceted tower of diagonal braces rising from beside MoMA', 'W 53rd St, 5th Ave to 6th Ave', 'Midtown'),
]


def check():
    towers = json.load(open(os.path.join(ROOT, 'data/towers.json')))['t']
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    feats = []
    for area in ('downtown', 'midtown', 'uptown'):
        d = json.load(open(os.path.join(ROOT, f'data/buildings-{area}.json')))
        for b in d['b']:
            x = y = 0
            xs, ys = [], []
            for i in range(2, len(b), 2):
                x += b[i]; y += b[i + 1]
                xs.append(d['o'][0] + x / d['s']); ys.append(d['o'][1] + y / d['s'])
            feats.append((sum(xs) / len(xs), sum(ys) / len(ys), b[0]))
    md = lambda a, b: math.hypot((a[0] - b[0]) * 84200, (a[1] - b[1]) * 111000)
    print(f'{"name":28s} {"given m":>7s}  {"footprint data: nearest tall (dist m, height)":46s} survey tower (dist m, height, slabs)')
    for name, p, h, *_ in S:
        near = sorted((md(p, (lo, la)), hh) for lo, la, hh in feats if md(p, (lo, la)) < 80 and hh > 0.5 * h)[:1]
        sv = sorted((md(p, (t[0], t[1])), t[2], len(t[3])) for t in towers if md(p, (t[0], t[1])) < 90)[:1]
        print(f'{name:28s} {h:7d}  {str([(round(a), b) for a, b in near]):46s} {[(round(a), b, c) for a, b, c in sv]}')


def footprints():
    """(lon, lat, roof height m) of every building in the three footprint files (the middle of each outline)."""
    feats = []
    for area in ('downtown', 'midtown', 'uptown'):
        d = json.load(open(os.path.join(ROOT, f'data/buildings-{area}.json')))
        for b in d['b']:
            x = y = 0
            xs, ys = [], []
            for i in range(2, len(b), 2):
                x += b[i]; y += b[i + 1]
                xs.append(d['o'][0] + x / d['s']); ys.append(d['o'][1] + y / d['s'])
            feats.append((sum(xs) / len(xs), sum(ys) / len(ys), b[0]))
    return feats


def snap(p, h, feats):
    """The middle of the real building: the nearest footprint within 110 m that is about this tall (the data's roof heights run
    a good deal under the architectural height, which counts the spire: half to 1.3 times it)."""
    best = None
    for lo, la, hh in feats:
        d = math.hypot((p[0] - lo) * 84200, (p[1] - la) * 111000)
        if d < 110 and 0.5 * h <= hh <= 1.3 * h and (best is None or d < best[0]):
            best = (d, (lo, la))
    return best


def write():
    feats = footprints()
    moved = []
    for i, (n, p, h, y, line, at, hood) in enumerate(S):
        b = snap(p, h, feats)
        if b:
            S[i] = (n, (round(b[1][0], 6), round(b[1][1], 6)), h, y, line, at, hood)
            moved.append(f'{n} {b[0]:.0f} m')
        else:
            print('  NO footprint of about this height within 110 m:', n)
    print('snapped to the footprint:', ', '.join(moved))
    out = [{'n': n, 'p': list(p), 'h': h, 'y': y, 'line': line, 'at': at, 'hood': hood} for n, p, h, y, line, at, hood in S]
    json.dump(out, open(os.path.join(ROOT, 'data/skyscrapers.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    path = os.path.join(ROOT, 'data/landmarks.json')
    lm = json.load(open(path))
    have = {l['n'] for l in lm}
    # a few skyscrapers are already landmarks under another name: don't add them twice
    alias = {'30 Rockefeller Plaza': 'Rockefeller Center', 'One World Trade Center': 'One World Trade Center', 'Woolworth Building': 'Woolworth Building',
             'Time Warner Center': 'Columbus Circle', 'Trump Tower': 'Trump Tower', 'Waldorf Astoria': 'Waldorf Astoria',
             'Empire State Building': 'Empire State Building', 'Chrysler Building': 'Chrysler Building', 'Flatiron Building': 'Flatiron Building'}
    added = []
    for n, p, h, y, line, at, hood in S:
        if n in have or alias.get(n) in have:
            continue
        lm.append({'n': n, 'note': f'{line}, {at}', 'p': [p[0], p[1]]})
        added.append(n)
    json.dump(lm, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(S)} skyscrapers -> data/skyscrapers.json; added to landmarks: {added}')


if __name__ == '__main__':
    check() if '--check' in sys.argv else write()
