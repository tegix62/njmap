#!/usr/bin/env python3
"""Cut the quiz towers out of NYC DCP's 3D Model as real triangle meshes (not stacked slabs): data/tower-meshes.json.

  python3 tools/extract_meshes.py <out.json> <NYC_3DModel_MNxx.3dm> [more files ...]

For each tower of data/skyscrapers.json that stands in one of the files, the footprint it stands in is found, the surfaces
inside it are collected (the model's wall and roof outlines, each a closed polyline: triangulated by ear clipping), and the
vertices are packed relative to the tower's lon/lat in decimetres (east, north, up from the ground). A tower is kept only if
the survey's height is within 0.85 to 1.3 times the official one: newer towers (One Vanderbilt, Central Park Tower...) are not in
a 2014 survey, and some that were still going up are partial there.

Output: {"v": 2, "t": [{"n", "lon", "lat", "h", "p": base64 int16 xyz, "c": base64 uint8 rgb, "i": base64 uint16 indices}]}
(vertices are shared, and the game shades flat from the screen-space derivatives, so no normals are stored).
Needs: pip install rhino3dm pyproj shapely numpy. Source: NYC Department of City Planning, "NYC 3D Model by Community District".
"""
import base64, json, math, os, sys
import numpy as np
import rhino3dm
from pyproj import Transformer
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIT_FT = {'Feet': 1.0, 'Millimeters': 1 / 304.8, 'Meters': 1 / 0.3048, 'Centimeters': 1 / 30.48, 'Inches': 1 / 12.0}
FT = 0.3048
# towers whose official height counts a mast or spire, or that the survey caught a little low: the survey height must fall in this
# range of the official one (default 0.85 to 1.3)
RANGE = {'4 Times Square': (0.85, 1.5), 'New York Times Building': (0.6, 1.3), 'Seagram Building': (0.78, 1.3)}
ONLY = set(filter(None, os.environ.get('ONLY', '').split('|')))  # limit to these towers; the result is merged into an existing out file
to_ft = Transformer.from_crs(4326, 2263, always_xy=True)
to_ll = Transformer.from_crs(2263, 4326, always_xy=True)

# base colours (r, g, b); a function of height can pick another (see colour())
STONE = (218, 210, 194)
COLORS = {
    'Empire State Building': (228, 221, 204), 'One World Trade Center': (174, 191, 204), 'Bank of America Tower': (196, 206, 212),
    'Citigroup Center': (201, 206, 209), '30 Rockefeller Plaza': (217, 210, 194), 'Woolworth Building': (226, 220, 203),
    'Time Warner Center': (174, 185, 194), '8 Spruce Street': (170, 182, 191), 'Seagram Building': (110, 93, 75), 'Trump Tower': (123, 135, 145),
    'Metropolitan Life Tower': (230, 223, 207), 'Waldorf Astoria': (216, 205, 182), 'Chanin Building': (214, 204, 184), 'Municipal Building': (217, 206, 184),
    'Chrysler Building': (230, 224, 211), 'Hearst Tower': (127, 149, 166), 'Flatiron Building': (214, 205, 186), 'New York Times Building': (207, 212, 216),
    '4 Times Square': (150, 164, 176), 'MetLife Building': (200, 196, 188),
}


def colour(name, z, height):
    base = COLORS.get(name, STONE)
    if name == 'Chrysler Building' and z > 205:
        return (205, 211, 216)                      # the stainless-steel crown
    if name == 'Hearst Tower':
        return (205, 191, 165) if z < 30 else (127, 149, 166)   # the stone base, then the glass
    if name == 'Empire State Building' and z > 381:
        return (185, 192, 198)                      # the mast
    if name == 'Woolworth Building' and z > 200:
        return (143, 179, 160)                      # the green copper roof
    if name == 'Municipal Building' and z > 160:
        return (201, 162, 74)                       # the gilded statue
    return base


def earclip(pts):
    """Triangles (index triples) of a simple polygon given as 2D points, any winding."""
    n = len(pts)
    if n < 3:
        return []
    idx = list(range(n))
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    if area < 0:
        idx.reverse()
    def cross(a, b, c):
        return (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0])
    def inside(p, a, b, c):
        return cross(a, b, p) >= -1e-9 and cross(b, c, p) >= -1e-9 and cross(c, a, p) >= -1e-9
    out, guard = [], 0
    while len(idx) > 3 and guard < 4 * n * n:
        guard += 1
        for k in range(len(idx)):
            a, b, c = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            if cross(a, b, c) <= 1e-12:
                continue
            if any(inside(p, a, b, c) for p in idx if p not in (a, b, c)):
                continue
            out.append((a, b, c))
            idx.pop(k)
            break
        else:
            break
    if len(idx) == 3:
        out.append(tuple(idx))
    return out


def triangulate(pts3):
    """Triangles of a closed 3D outline (a flat polygon): drop its repeated last point, project onto its own plane, ear clip."""
    P = np.array(pts3, dtype=float)
    if len(P) > 1 and np.allclose(P[0], P[-1]):
        P = P[:-1]
    if len(P) < 3:
        return []
    # Newell's normal
    nrm = np.zeros(3)
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        nrm += [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]
    L = np.linalg.norm(nrm)
    if L < 1e-9:
        return []
    nrm /= L
    ax = np.argmax(np.abs(nrm))
    keep = [i for i in range(3) if i != ax]
    pts2 = [(p[keep[0]], p[keep[1]]) for p in P]
    return [(P[a], P[b], P[c]) for a, b, c in earclip(pts2)]


def main():
    dst = sys.argv[1]
    towers = json.load(open(os.path.join(ROOT, 'data/skyscrapers.json')))
    out = {}
    for path in sys.argv[2:]:
        m = rhino3dm.File3dm.Read(path)
        u = UNIT_FT[str(m.Settings.ModelUnitSystem).split('.')[-1]]
        fps, walls, roofs = [], [], []
        for o in m.Objects:
            ln = m.Layers[o.Attributes.LayerIndex].FullPath
            if ln not in ('Buildings::Building_FootPrint', 'Buildings::Building_Facade', 'Buildings::Building_RoofTop'):
                continue
            g = o.Geometry
            pts = [(g.Point(i).X * u, g.Point(i).Y * u, g.Point(i).Z * u) for i in range(g.PointCount)]
            if len(pts) < 3:
                continue
            if ln.endswith('FootPrint'):
                poly = Polygon([(p[0], p[1]) for p in pts]).buffer(0)
                if poly.area > 400:
                    fps.append(poly)
            else:
                (walls if ln.endswith('Facade') else roofs).append(pts)
        print(f'{path}: {len(fps)} footprints, {len(walls)} wall outlines, {len(roofs)} roof outlines', flush=True)
        tree = STRtree(fps)
        for t in towers:
            if ONLY and t['n'] not in ONLY:
                continue
            x, y = to_ft.transform(t['p'][0], t['p'][1])
            pt = Point(x, y)
            cand = [i for i in tree.query(pt.buffer(60)) if fps[i].distance(pt) < 60]
            if not cand:
                continue
            # the footprint under the tower's point, else the nearest
            cand.sort(key=lambda i: (not fps[i].contains(pt), fps[i].distance(pt)))
            fp = fps[cand[0]]
            P = fp.buffer(3)
            mine = [pl for pl in walls + roofs if P.contains(Point(sum(p[0] for p in pl) / len(pl), sum(p[1] for p in pl) / len(pl)))]
            if not mine:
                continue
            z0 = min(p[2] for pl in mine for p in pl)
            z1 = max(p[2] for pl in mine for p in pl)
            h = (z1 - z0) * FT
            ratio = h / t['h']
            lo, hi = RANGE.get(t['n'], (0.85, 1.3))
            if not lo <= ratio <= hi:
                print(f'  {t["n"]}: survey {h:.0f} m against {t["h"]} m: left to the slab model')
                continue
            cx, cy = fp.centroid.coords[0]
            lon, lat = to_ll.transform(cx, cy)
            verts, vcol, idx, key = [], [], [], {}
            def vid(p):
                q = (round((p[0] - cx) * FT * 10), round((p[1] - cy) * FT * 10), round((p[2] - z0) * FT * 10))
                if q not in key:
                    key[q] = len(verts)
                    verts.append(q)
                    vcol.append(colour(t['n'], q[2] / 10, h))
                return key[q]
            for pl in mine:
                for a, b, c in triangulate(pl):
                    ia, ib, ic = vid(a), vid(b), vid(c)
                    if len({ia, ib, ic}) == 3:
                        idx += [ia, ib, ic]
            if not idx or len(verts) > 65000:
                continue
            P16 = np.array(verts, dtype=np.int16).reshape(-1)
            C8 = np.array(vcol, dtype=np.uint8).reshape(-1)
            I16 = np.array(idx, dtype=np.uint16)
            rec = {'n': t['n'], 'lon': round(lon, 6), 'lat': round(lat, 6), 'h': round(h, 1), 'tris': len(idx) // 3,
                   'p': base64.b64encode(P16.tobytes()).decode(), 'c': base64.b64encode(C8.tobytes()).decode(), 'i': base64.b64encode(I16.tobytes()).decode()}
            if t['n'] not in out or rec['tris'] > out[t['n']]['tris']:
                out[t['n']] = rec
            print(f'  {t["n"]}: {len(idx) // 3} triangles, {len(verts)} vertices, survey {h:.0f} m against {t["h"]} m', flush=True)
    if ONLY and os.path.exists(dst):
        old = {r['n']: r for r in json.load(open(dst))['t']}
        old.update(out)
        out = old
    res = {'v': 2, 't': list(out.values())}
    json.dump(res, open(dst, 'w'), separators=(',', ':'))
    print(f'{len(out)} towers -> {dst} ({os.path.getsize(dst) // 1024} KB)')


if __name__ == '__main__':
    main()
