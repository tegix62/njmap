#!/usr/bin/env python3
"""New Jersey landmarks for the "Name that landmark" game: data/nj-landmarks.json (the quiz list) and data/nj-landmark-city.json (the
buildings and street names round each one, in the same packed form as data/buildings-*.json and data/parts-*.json).

  python3 tools/overture_scan.py building ; building_part ; segment      (reads Overture Maps from its public S3 bucket into /tmp/nj/*.pkl;
                                                                          the windows come from LANDMARKS in /tmp/nj/cands.py: copy tools/nj_candidates.py there)
  python3 tools/build_nj_landmarks.py

Overture's New Jersey buildings mostly have no height, so a landmark's roof height is its Overture height when it has one, else a floor
count, else the rough figure below (`h`): used only for how it stands in the 3D view, never shown as a fact.  (c) OpenStreetMap
contributors, ODbL, via Overture Maps.
"""
import json, math, os, pickle, sys
from shapely import wkb
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = '/tmp/nj'
sys.path.insert(0, CACHE)
from cands import L as CANDS   # (name, lon, lat, year, line, at) for each candidate, in the order the scans used

# name -> (substring of the building's name | None for the biggest within 150 m, roof height to use if the data has less, kind, town key)
PICK = {
    'MetLife Stadium': (None, 48, 'Stadium', 'East Rutherford Borough|Bergen'),
    'American Dream': ('American Dream', 36, 'Mall', 'East Rutherford Borough|Bergen'),
    'Prudential Center': ('Prudential Center', 34, 'Arena', 'Newark City|Essex'),
    'Newark Penn Station': ('Newark Penn Station', 26, 'Train station', 'Newark City|Essex'),
    'Red Bull Arena': (None, 28, 'Stadium', 'Harrison Town|Hudson'),
    'Hoboken Terminal': ('Hoboken Terminal', 22, 'Train station', 'Hoboken City|Hudson'),
    'Secaucus Junction': ('Secaucus Junction', 18, 'Train station', 'Secaucus Town|Hudson'),
    'Liberty Science Center': ('Liberty Science Center', 30, 'Museum', 'Jersey City|Hudson'),
    'New Jersey State House': ('New Jersey State House', 32, 'Capitol', 'Trenton City|Mercer'),
    'Nassau Hall': ('Nassau Hall', 20, 'Historic building', 'Princeton|Mercer'),
    'Old Queens': ('Old Queens', 20, 'Historic building', 'New Brunswick City|Middlesex'),
    'Boardwalk Hall': ('Boardwalk Hall', 42, 'Arena', 'Atlantic City|Atlantic'),
    'Absecon Lighthouse': ('Absecon Lighthouse', 52, 'Lighthouse', 'Atlantic City|Atlantic'),
    'Barnegat Lighthouse': ('Barnegat Lighthouse', 50, 'Lighthouse', 'Barnegat Light Borough|Ocean'),
    'Cape May Lighthouse': ('Cape May Lighthouse', 47, 'Lighthouse', 'Lower Township|Cape May'),
    'Sandy Hook Lighthouse': ('Sandy Hook Lighthouse', 27, 'Lighthouse', 'Middletown Township|Monmouth'),
    'Great Auditorium': ('Great Auditorium', 26, 'Hall', 'Neptune Township|Monmouth'),
    'High Point Monument': ('High Point Monument', 67, 'Monument', 'Montague Township|Sussex'),
    'Garden State Plaza': ('Garden State Plaza', 16, 'Mall', 'Paramus Borough|Bergen'),
    'Adventure Aquarium': ('Adventure Aquarium', 22, 'Aquarium', 'Camden City|Camden'),
}
RADIUS = 480           # metres of buildings and streets kept round each landmark
O = [-75.6, 38.8]
S = 100000
RAMP = ('driveway', 'parking_aisle', 'alley')


def main():
    B = pickle.load(open(f'{CACHE}/building.pkl', 'rb'))
    P = pickle.load(open(f'{CACHE}/building_part.pkl', 'rb'))
    G = pickle.load(open(f'{CACHE}/segment.pkl', 'rb'))
    byB, byP, byG = {}, {}, {}
    for r in B: byB.setdefault(r['_i'], []).append(r)
    for r in P: byP.setdefault(r['_i'], []).append(r)
    for r in G: byG.setdefault(r['_i'], []).append(r)
    kept, listing = {}, []
    bld, parts, segs, names = [], [], [], []
    nid = {}
    seen_b, seen_s = set(), set()
    def enc(coords):
        flat, x, y = [], 0, 0
        for lo, la in coords:
            nx, ny = int(round((lo - O[0]) * S)), int(round((la - O[1]) * S))
            flat += [nx - x, ny - y]; x, y = nx, ny
        return flat
    for i, (name, lo0, la0, year, line, at) in enumerate(CANDS):
        if name not in PICK:
            continue
        match, hmin, kind, town = PICK[name]
        kx, ky = 111320 * math.cos(math.radians(la0)), 110574
        rows = []
        for r in byB.get(i, []):
            g0 = wkb.loads(r['geometry'])
            for g in (g0.geoms if g0.geom_type == 'MultiPolygon' else [g0]):   # (some buildings are several polygons: each is drawn, the biggest is the landmark)
                if g.geom_type != 'Polygon' or g.is_empty:
                    continue
                c = g.centroid
                rows.append((r, g, math.hypot((c.x - lo0) * kx, (c.y - la0) * ky)))
        near = [t for t in rows if t[2] < 250]
        if match:
            nm_of = lambda t: ((t[0]['names'] or {}).get('primary') or '').lower()
            cand = [t for t in near if nm_of(t) == match.lower()] or [t for t in near if match.lower() in nm_of(t)]    # (the exact name first: "Barnegat Lighthouse", not its Interpretive Center)
        else:
            cand = [t for t in near if t[2] < 150]
        if not cand:
            print('  NO building for', name); continue
        tr, tg, _ = max(cand, key=lambda t: t[1].area)
        c = tg.centroid
        lon, lat = c.x, c.y
        kx, ky = 111320 * math.cos(math.radians(lat)), 110574
        h0 = tr['height'] or (tr['num_floors'] * 3.4 if tr['num_floors'] else 0)
        h = round(max(h0, hmin), 1)
        # buildings round it (not the ones another landmark's window already gave: the Atlantic City windows overlap)
        idx_of = {}
        for r, g, _ in rows:
            c2 = g.centroid
            if math.hypot((c2.x - lon) * kx, (c2.y - lat) * ky) > RADIUS:
                continue
            key = (round(c2.x, 5), round(c2.y, 5), round(g.area * 1e9))
            is_t = g is tg
            if key in seen_b and not is_t:
                continue
            seen_b.add(key)
            area = g.area * kx * ky
            hh = r['height'] or (r['num_floors'] * 3.4 if r['num_floors'] else 0)
            if is_t:
                hh = h
            elif not hh:
                hh = 7.0 if area < 600 else 10.0
            if area < 30 and hh < 5 and not is_t:
                continue
            q = g.simplify(0.8 / kx)
            if q.geom_type != 'Polygon' or q.is_empty:
                continue
            ring = list(q.exterior.coords)[:-1]
            if len(ring) < 3:
                continue
            bld.append([round(hh, 1), 1 if is_t else 0, *enc(ring)])
            idx_of[id(g)] = (len(bld) - 1, g)
        # the parts of buildings in the window (podiums, setbacks): a building is drawn from them when they cover most of it
        pp = []
        for r in byP.get(i, []):
            g = wkb.loads(r['geometry'])
            if g.geom_type == 'Polygon' and not g.is_empty and r['height']:
                pp.append((g, r['min_height'] or 0.0, r['height']))
        if pp:
            tree = STRtree([g for g, a, b in pp])
            for rid, (bi, g) in idx_of.items():
                got = [pp[j] for j in tree.query(g) if g.contains(pp[j][0].representative_point())]
                if len(got) < 2 and not (got and got[0][1] > 0):
                    continue
                cover = unary_union([x[0] for x in got]).intersection(g).area / g.area if g.area else 0
                if cover < 0.55:
                    continue
                ent = [bi]
                for q, a, b in sorted(got, key=lambda t: (t[1], t[2])):
                    q = q.simplify(0.5 / kx)
                    if q.geom_type != 'Polygon' or q.is_empty:
                        continue
                    ent.append([round(a, 1), round(max(b, a + 1), 1), *enc(list(q.exterior.coords)[:-1])])
                if len(ent) > 1:
                    parts.append(ent)
        # street names: one entry per block, within the window
        for r in byG.get(i, []):
            nm = (r['names'] or {}).get('primary')
            if not nm or r.get('subtype') != 'road' or r.get('class') in RAMP:
                continue
            g = wkb.loads(r['geometry'])
            if g.geom_type != 'LineString':
                continue
            m = g.interpolate(0.5, normalized=True)
            if math.hypot((m.x - lon) * kx, (m.y - lat) * ky) > RADIUS * 1.2:
                continue
            key = (nm, round(m.x, 4), round(m.y, 4))
            if key in seen_s:
                continue
            seen_s.add(key)
            if nm not in nid:
                nid[nm] = len(names); names.append(nm)
            segs.append([nid[nm], *enc(list(g.simplify(1.0 / kx).coords))])
        listing.append({'n': name, 'p': [round(lon, 6), round(lat, 6)], 'h': h, 'y': year, 'line': line, 'at': at, 'hood': at, 'k': 'lm', 'kind': kind, 'town': town, 'w': round(math.sqrt(tg.area * kx * ky))})
        print(f'  {name}: building {tg.area * kx * ky:.0f} m2, h {h}, {len(idx_of)} buildings round it')
    json.dump({'o': O, 's': S, 'b': bld, 'g': parts, 'names': names, 'segs': segs}, open(os.path.join(ROOT, 'data/nj-landmark-city.json'), 'w'), separators=(',', ':'))
    json.dump(listing, open(os.path.join(ROOT, 'data/nj-landmarks.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(listing), 'landmarks;', len(bld), 'buildings,', len(parts), 'drawn from parts,', len(segs), 'street blocks ->', os.path.getsize(os.path.join(ROOT, 'data/nj-landmark-city.json')) // 1024, 'KB')


if __name__ == '__main__':
    main()
