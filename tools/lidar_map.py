#!/usr/bin/env python3
"""A heightmap picture of the lidar round a landmark with its footprint drawn on it, to see whether the 3D landmark is on the right building.
  python3 tools/lidar_map.py "Name" out.png [radius_m]"""
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lidar_parts as L
from shapely.geometry import Polygon
name, out = sys.argv[1], sys.argv[2]; R = float(sys.argv[3]) if len(sys.argv) > 3 else 200
lm, ring = L.footprint(name)
lon, lat = lm['p']; kx, ky = 111320 * math.cos(math.radians(lat)), 110574
F = Polygon([((x - lon) * kx, (y - lat) * ky) for x, y in ring])
pts = L.ept_points(L.EPT[name], lon, lat, R) if name in L.EPT else L.laz_points(lon, lat, R)
X, Y, Z, C = pts
g0 = np.median(Z[C == 2]) if (C == 2).sum() > 30 else np.percentile(Z, 5); h = Z - g0
N = int(2 * R); img = np.zeros((N, N))
ix, iy = (X + R).astype(int), (R - Y).astype(int); ok = (ix >= 0) & (ix < N) & (iy >= 0) & (iy < N) & (C != 2) & (C != 7) & (C != 18)
top = max(30, float(np.percentile(h[ok], 99.9)))
np.maximum.at(img, (iy[ok], ix[ok]), np.clip(h[ok], 0, top))
im = Image.fromarray((img / top * 255).astype(np.uint8)).convert('RGB').resize((N * 2, N * 2), Image.NEAREST)
d = ImageDraw.Draw(im); d.line([((x + R) * 2, (R - y) * 2) for x, y in F.exterior.coords], fill=(255, 0, 0), width=2)
d.text((6, 6), f'{name}  (white = {top:.0f} m)', fill=(255, 255, 0))
im.save(out)
