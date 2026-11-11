#!/usr/bin/env python3
"""Cut the tall buildings out of NYC DCP's 3D Model (one community district's Rhino .3dm file) into stacked outlines.

The game draws buildings as extruded outlines (MapLibre fill-extrusion), so a surveyed tower becomes a stack of slabs:
the model's wall and roof surfaces are sliced every STEP feet of height, each slice's outline is a polygon, and runs of
slices with almost the same outline are merged into one slab.

  python3 tools/extract_towers.py <NYC_3DModel_MNxx.3dm> <out.json> [min height in metres, default 150]

Needs: pip install rhino3dm pyproj shapely numpy. The files are 400 MB to 1 GB and are not kept in the repo; only the
small result is (see tools/build_towers.py, which merges the districts into data/towers.json).

Source: NYC Department of City Planning, "NYC 3D Model by Community District" (the 2014 DoITT aerial survey: hybrid
CityGML LOD 1/2 with roof detail on iconic buildings; coordinates NAD83 / NY Long Island State Plane, feet).
Output: [{"lon", "lat", "h" (roof m above ground), "slabs": [[base m, top m, [[x, y] metres from the lon/lat, ...]], ...]}]
"""
import json, sys, time
import numpy as np
import rhino3dm
from pyproj import Transformer
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import unary_union, polygonize
from shapely.strtree import STRtree
from shapely.validation import make_valid

FT = 0.3048
STEP = 6.0          # feet between slices
MERGE_IOU = 0.985   # slices this alike are one slab
SIMPLIFY_FT = 1.5
to_lonlat = Transformer.from_crs(2263, 4326, always_xy=True)


U = 1.0  # model units -> feet (some districts are in millimetres or metres)
UNIT_FT = {'Feet': 1.0, 'Millimeters': 1 / 304.8, 'Meters': 1 / 0.3048, 'Centimeters': 1 / 30.48, 'Inches': 1 / 12.0}


def brep_triangles(brep):
    out = []
    for fi in range(len(brep.Faces)):
        mesh = brep.Faces[fi].GetMesh(rhino3dm.MeshType.Any)
        if mesh is None:
            continue
        verts = [(v.X * U, v.Y * U, v.Z * U) for v in (mesh.Vertices[i] for i in range(len(mesh.Vertices)))]
        for i in range(len(mesh.Faces)):
            f = mesh.Faces[i]
            out.append((verts[f[0]], verts[f[1]], verts[f[2]]))
            if f[3] != f[2]:
                out.append((verts[f[0]], verts[f[2]], verts[f[3]]))
    if not out and len(brep.Faces) == 1:  # (some districts carry no cached render meshes: the surface is a plain flat polygon)
        out = polygon_triangles([(v.Location.X * U, v.Location.Y * U, v.Location.Z * U) for v in brep.Vertices])
    return out


def polygon_triangles(pts):
    """A flat polygon's corners, in any order, as a fan of triangles (corners sorted round their centre in the polygon's plane)."""
    if len(pts) < 3:
        return []
    P = np.array(pts)
    c = P.mean(0)
    n = np.cross(P[1] - P[0], P[2] - P[0])
    for k in range(2, len(P)):
        n = np.cross(P[1] - P[0], P[k] - P[0])
        if np.linalg.norm(n) > 1e-6:
            break
    if np.linalg.norm(n) <= 1e-6:
        return []
    n = n / np.linalg.norm(n)
    u = P[0] - c
    u = u - n * u.dot(n)
    if np.linalg.norm(u) < 1e-9:
        u = np.cross(n, [0, 0, 1])
    u = u / np.linalg.norm(u)
    w = np.cross(n, u)
    ang = [np.arctan2((p - c).dot(w), (p - c).dot(u)) for p in P]
    order = [P[i] for i in np.argsort(ang)]
    return [(tuple(order[0]), tuple(order[i]), tuple(order[i + 1])) for i in range(1, len(order) - 1)]


def outline_at(tri, z):
    lo, hi = tri[:, :, 2].min(1), tri[:, :, 2].max(1)
    use = tri[(lo <= z) & (hi >= z)]
    segs = []
    for t in use:
        pts = []
        for a, b in ((0, 1), (1, 2), (2, 0)):
            za, zb = t[a, 2], t[b, 2]
            if (za - z) * (zb - z) < 0:
                u = (z - za) / (zb - za)
                pts.append((t[a, 0] + u * (t[b, 0] - t[a, 0]), t[a, 1] + u * (t[b, 1] - t[a, 1])))
        if len(pts) == 2 and pts[0] != pts[1]:
            segs.append(LineString(pts))
    if not segs:
        return None
    try:
        polys = list(polygonize(unary_union(segs)))
        if not polys:
            return None
        p = unary_union([make_valid(q).buffer(0) for q in polys]).buffer(1.0).buffer(-1.0)
    except Exception:  # (a slice with a bad edge: skip it, the slabs either side cover it)
        return None
    return None if p.is_empty else p


def slabs_of(tri, z0, z1):
    """[(base ft, top ft, polygon)] from slicing the triangles between z0 and z1."""
    cuts = []
    z = z0 + STEP / 2
    while z < z1:
        cuts.append((z, outline_at(tri, z)))
        z += STEP
    slabs = []
    for z, p in cuts:
        if p is None:
            continue
        if slabs:
            b, t, q = slabs[-1]
            try:
                inter = q.intersection(p).area
                union = q.union(p).area
            except Exception:
                inter, union = 0, 1
            if union and inter / union >= MERGE_IOU and abs(t - (z - STEP / 2)) < 1e-6:
                slabs[-1] = (b, z + STEP / 2, q)
                continue
        slabs.append((z - STEP / 2, z + STEP / 2, p))
    return slabs


def main():
    src, dst = sys.argv[1], sys.argv[2]
    min_m = float(sys.argv[3]) if len(sys.argv) > 3 else 150.0
    t0 = time.time()
    global U
    m = rhino3dm.File3dm.Read(src)
    U = UNIT_FT[str(m.Settings.ModelUnitSystem).split('.')[-1]]
    fps, surf = [], []
    for o in m.Objects:
        name = m.Layers[o.Attributes.LayerIndex].FullPath
        if name == 'Buildings::Building_FootPrint':
            g = o.Geometry
            pts = [(g.Point(i).X * U, g.Point(i).Y * U) for i in range(g.PointCount)]
            if len(pts) >= 3:
                fps.append(Polygon(pts).buffer(0))
        elif name in ('Buildings::Facade Surface', 'Buildings::RoofTop Surface'):
            bb = o.Geometry.GetBoundingBox()
            surf.append((o.Geometry, (bb.Min.X + bb.Max.X) / 2 * U, (bb.Min.Y + bb.Max.Y) / 2 * U, bb.Min.Z * U, bb.Max.Z * U))
    print(f'{src}: {len(fps)} footprints, {len(surf)} surfaces, read in {time.time() - t0:.0f}s', flush=True)
    tree = STRtree(fps)
    owned = [[] for _ in fps]
    for k, (g, x, y, a, b) in enumerate(surf):
        for i in tree.query(Point(x, y)):
            if fps[i].buffer(3).contains(Point(x, y)):
                owned[i].append(k)
                break
    out = []
    for i, ks in enumerate(owned):
        if not ks:
            continue
        z0 = min(surf[k][3] for k in ks)
        z1 = max(surf[k][4] for k in ks)
        if (z1 - z0) * FT < min_m:
            continue
        try:
            tri = []
            for k in ks:
                tri += brep_triangles(surf[k][0])
            if not tri:
                continue
            tri = np.array(tri)
            slabs = slabs_of(tri, z0, z1)
        except Exception as e:
            print(f'  skipped a building: {e}', flush=True)
            continue
        if not slabs:
            continue
        c = fps[i].centroid
        lon, lat = to_lonlat.transform(c.x, c.y)
        rec = []
        for b, t, p in slabs:
            polys = list(p.geoms) if p.geom_type == 'MultiPolygon' else [p]
            for pg in polys:
                if pg.area < 4:
                    continue
                ring = pg.simplify(SIMPLIFY_FT).exterior.coords
                rec.append([round((b - z0) * FT, 1), round((t - z0) * FT, 1), [[round((x - c.x) * FT, 1), round((y - c.y) * FT, 1)] for x, y in list(ring)[:-1]]])
        out.append({'lon': round(lon, 6), 'lat': round(lat, 6), 'h': round((z1 - z0) * FT, 1), 'area': round(fps[i].area * FT * FT), 'slabs': rec})
        print(f'  {lon:.5f},{lat:.5f}  {(z1 - z0) * FT:.0f} m  {len(rec)} slabs', flush=True)
    json.dump(out, open(dst, 'w'), separators=(',', ':'))
    print(f'{len(out)} buildings of {min_m:.0f} m or more -> {dst} ({time.time() - t0:.0f}s)', flush=True)


if __name__ == '__main__':
    main()
