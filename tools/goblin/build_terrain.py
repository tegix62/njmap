#!/usr/bin/env python3
"""Build data/goblin-terrain.png: the real terrain of New Jersey as a small dithered picture for Council's map.

Source: Mapzen/AWS terrain tiles (terrarium encoding), https://registry.opendata.aws/terrain-tiles/ (open data; credits in docs/goblins/08-art.md).
Method: zoom-10 elevation tiles are stitched (they are already Web Mercator, as the map is), shaded from the north-west, then ordered-dithered (a 4x4 Bayer matrix) to a fixed palette: five elevation families of three shades each.
Sea level and below is left transparent, so the map's own sea shows. Run from the repository root:  python3 tools/goblin/build_terrain.py [cache_dir]
"""
import io, json, math, os, sys, urllib.request
import numpy as np
from PIL import Image

Z = 10
WEST, SOUTH, EAST, NORTH = -75.60, 38.90, -73.85, 41.40       # New Jersey with a margin
URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
CACHE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/goblin-dem'

def tx(lon): return int((lon + 180) / 360 * 2 ** Z)
def ty(lat): return int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2 ** Z)
def lon_of(x): return x / 2 ** Z * 360 - 180
def lat_of(y): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2 ** Z))))

x0, x1, y0, y1 = tx(WEST), tx(EAST), ty(NORTH), ty(SOUTH)
os.makedirs(CACHE, exist_ok=True)
elev = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), dtype=np.float32)
for y in range(y0, y1 + 1):
    for x in range(x0, x1 + 1):
        p = os.path.join(CACHE, f'{Z}-{x}-{y}.png')
        if not os.path.exists(p):
            with urllib.request.urlopen(URL.format(z=Z, x=x, y=y), timeout=30) as r: open(p, 'wb').write(r.read())
        a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)
        elev[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

# shade from the north-west; New Jersey is low, so heights are exaggerated to make its ridges read
metres = 40075016 * math.cos(math.radians(40.1)) / (2 ** Z * 256)
gy, gx = np.gradient(elev, metres)
k = 9.0
nx, ny, nz = -gx * k, -gy * k, np.ones_like(elev)
n = np.sqrt(nx * nx + ny * ny + nz * nz)
lx, ly, lz = -0.6, -0.6, 0.55
shade = np.clip((nx * lx + ny * ly + nz * lz) / (n * math.sqrt(lx * lx + ly * ly + lz * lz)), 0, 1)

def half(a): return a.reshape(a.shape[0] // 2, 2, a.shape[1] // 2, 2).mean(axis=(1, 3))
if os.environ.get('HALF'): elev, shade = half(elev), half(shade)
h, w = elev.shape
bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16 - 0.47
B = np.tile(bayer, (h // 4 + 1, w // 4 + 1))[:h, :w]

# five elevation families (metres), each dark / mid / light
BANDS = [8, 45, 120, 260]
FAMS = [
    [(40, 92, 70), (62, 128, 86), (104, 168, 104)],      # marsh and shore
    [(34, 100, 44), (58, 142, 58), (120, 190, 84)],      # lowland green
    [(70, 104, 40), (112, 144, 56), (176, 190, 96)],     # rolling olive
    [(96, 84, 44), (150, 126, 70), (206, 184, 120)],     # highland tan
    [(88, 80, 76), (146, 136, 126), (226, 220, 206)],    # ridge grey
]
ex = np.log1p(np.maximum(elev, 0))
edges = np.log1p(np.array(BANDS, dtype=np.float32))
fam = np.zeros((h, w), dtype=np.int32)
spread = 0.35                                              # how far the dither blends one family into the next
for e in edges: fam += (ex + B * spread > e).astype(np.int32)
lvl = np.clip(np.floor((shade - 0.30) / 0.42 * 3 + B * 1.6 + 0.5), 0, 2).astype(np.int32)
pal = np.array(FAMS, dtype=np.uint8).reshape(-1, 3)
idx = fam * 3 + lvl
sea = elev <= 0.5
idx[sea] = len(pal)
im = Image.fromarray(idx.astype(np.uint8), 'P')
flat = list(pal.reshape(-1)) + [0, 0, 0]
im.putpalette([int(v) for v in flat] + [0] * (768 - len(flat)))
im.save('data/goblin-terrain.png', optimize=True, transparency=len(pal))
meta = {'v': 1, 'z': Z, 'size': [w, h], 'coordinates': [[lon_of(x0), lat_of(y0)], [lon_of(x1 + 1), lat_of(y0)], [lon_of(x1 + 1), lat_of(y1 + 1)], [lon_of(x0), lat_of(y1 + 1)]],
        'source': 'Mapzen/AWS terrain tiles (terrarium), zoom 10; shaded and ordered-dithered to 15 colours by tools/goblin/build_terrain.py'}
json.dump(meta, open('data/goblin-terrain.json', 'w'), indent=1)
print(w, h, os.path.getsize('data/goblin-terrain.png'), 'bytes', 'max elevation', float(elev.max()))
