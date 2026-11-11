#!/usr/bin/env python3
"""Merge the per-district results of tools/extract_towers.py into data/towers.json.

  python3 tools/build_towers.py <dir with MNxx.json files> [min height in metres, default 150]

A building that two district files both cover (they overlap a little at their edges) is kept once, from the file that has
more slabs for it. Output: {"v": 1, "t": [[lon, lat, heightM, [[baseM, topM, [x, y, x, y, ...]], ...]], ...]} with the
outline coordinates in whole decimetres from the lon/lat (integers keep the file small).
"""
import glob, json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# The survey is a hybrid of CityGML levels 1 and 2: some towers come out with holes (no outline at some heights, from walls
# or roofs the model lacks) and some lose the part that matters. A tower is kept only when slabs cover at least 92% of 50
# heights between 2% and 80% of its height, and not if it is on this list (checked by eye against what the building really
# looks like): the Chrysler Building's survey has the right place and height (328 m) but a bare 5 m needle where its crown is.
NOT_THE_SHAPE = [('Chrysler Building', -73.97535, 40.75166)]


def covered(slabs, height):
    ok = 0
    for k in range(50):
        h = height * (0.02 + 0.78 * k / 49)
        if any(s[0] <= h < s[1] and len(s[2]) >= 3 for s in slabs):
            ok += 1
    return ok / 50


def main():
    src = sys.argv[1]
    min_h = float(sys.argv[2]) if len(sys.argv) > 2 else 150
    allb, dropped = [], []
    for f in sorted(glob.glob(os.path.join(src, 'MN*.json'))):
        for b in json.load(open(f)):
            if b['h'] < min_h or len(b['slabs']) < 3:  # (a plain box needs no model: the footprint data draws it)
                continue
            if covered(b['slabs'], b['h']) < 0.92:
                dropped.append((round(b['h']), b['lon'], b['lat'], 'holes'))
                continue
            if any(math.hypot((b['lon'] - lo) * 84200, (b['lat'] - la) * 111000) < 40 for _, lo, la in NOT_THE_SHAPE):
                dropped.append((round(b['h']), b['lon'], b['lat'], 'listed'))
                continue
            allb.append(b)
    keep = []
    for b in sorted(allb, key=lambda b: -len(b['slabs'])):
        if any(math.hypot((b['lon'] - k['lon']) * 84200, (b['lat'] - k['lat']) * 111000) < 20 for k in keep):
            continue
        keep.append(b)
    keep.sort(key=lambda b: -b['h'])
    t = []
    for b in keep:
        slabs = [[s[0], s[1], [round(v * 10) for xy in s[2] for v in xy]] for s in b['slabs']]
        t.append([b['lon'], b['lat'], round(b['h']), slabs])
    path = os.path.join(ROOT, 'data/towers.json')
    json.dump({'v': 1, 't': t}, open(path, 'w'), separators=(',', ':'))
    print(f'dropped {len(dropped)} (holes or listed):', sorted(dropped, reverse=True)[:12])
    print(f'{len(allb)} -> {len(keep)} towers, {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    main()
