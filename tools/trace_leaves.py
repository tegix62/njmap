#!/usr/bin/env python3
"""Leaf outlines traced from real photos, for Trees of New Jersey (replacing the leaf shapes that were drawn from memory).

Stage 1 (score):  python3 tools/trace_leaves.py score   every photo of every broad-leaved tree in the iNaturalist cache (/tmp/trees/<slug>.json,
                                                        from build_trees.py fetch), downloaded small, and scored for "one whole green leaf lying
                                                        on a plain background": the leaf cut out by colour, one piece, not touching the edge,
                                                        a background that is not green
Stage 2 (sheet):  python3 tools/trace_leaves.py sheet   a numbered contact sheet per tree of the best 24, each with its cut-out outline drawn in red,
                                                        to choose from by eye (/tmp/leaves/sheet-<slug>.jpg)
Stage 3 (trace):  python3 tools/trace_leaves.py trace   the picks in tools/leaf_picks.json (slug -> [candidate, turn in degrees, {seed, tol, trim, smooth}]), downloaded at
                                                        medium size, cut out again, smoothed, turned stalk-down and written as SVG paths to
                                                        data/leafoutlines.json and js/treeoutlines.js (viewBox 0 0 100 120, stalk at the bottom), with the photo's credit
"""
import concurrent.futures as cf, io, json, math, os, sys, urllib.request
import numpy as np, cv2
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_trees import TREES, FACTS, UA

TMP = '/tmp/leaves'
BROAD = [slug for _, slug in TREES if FACTS[slug][0] in ('opposite', 'alternate')]


def fetch_img(url):
    for k in range(3):
        try:
            return Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40).read())).convert('RGB')
        except Exception:
            pass
    return None


def leaf_mask(im):
    """The leaf, cut out by colour: green (or the leaf's own colour) against a background that is not. Returns (mask, info)."""
    a = np.asarray(im)
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    green = (h >= 25) & (h <= 95) & (s >= 50) & (v >= 35)            # OpenCV hue is 0..180: 25..95 is yellow-green to blue-green
    m = green.astype(np.uint8) * 255
    k = max(3, im.width // 80) | 1
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        return None, None
    i = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    comp = (lab == i).astype(np.uint8) * 255
    # fill holes (veins, glare)
    ff = comp.copy(); cv2.floodFill(ff, np.zeros((comp.shape[0] + 2, comp.shape[1] + 2), np.uint8), (0, 0), 255)
    comp = comp | cv2.bitwise_not(ff)
    x, y, w, hh, area = stats[i]
    H, W = m.shape
    info = {'frac': area / (W * H), 'share': area / max(1, green.sum()), 'edge': int(x <= 1 or y <= 1 or x + w >= W - 1 or y + hh >= H - 1),
            'bg_green': float(green[comp == 0].mean()) if (comp == 0).any() else 1.0}
    return comp, info


def leaf_mask_seeded(im, seed=(0.5, 0.5), tol=14, trim=50):
    """For tracing: the leaf's own colour, learned from around the seed point (the middle of the photo unless told), the piece of that
    colour that holds the seed, holes filled, thin stems and stalks trimmed off (`trim`: opening kernel = width / trim)."""
    a = np.asarray(im); H, W = a.shape[:2]
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV).astype(int)
    cx, cy = int(seed[0] * W), int(seed[1] * H); r = max(4, W // 25)
    patch = hsv[max(0, cy - r):cy + r, max(0, cx - r):cx + r].reshape(-1, 3)
    patch = patch[patch[:, 1] > 40]
    if not len(patch):
        return None
    hm, sm = np.median(patch[:, 0]), np.median(patch[:, 1])
    m = ((np.abs(hsv[..., 0] - hm) <= tol) & (hsv[..., 1] >= max(30, sm * 0.45)) & (hsv[..., 2] >= 30)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    k = max(3, W // trim) | 1
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    n, lab = cv2.connectedComponents(m, 8)
    i = lab[cy, cx]
    if i == 0:
        box = lab[max(0, cy - r):cy + r, max(0, cx - r):cx + r]; vals = box[box > 0]
        if not len(vals):
            return None
        i = np.bincount(vals).argmax()
    comp = (lab == i).astype(np.uint8) * 255
    ff = comp.copy(); cv2.floodFill(ff, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 255)
    return comp | cv2.bitwise_not(ff)


def leaf_mask_gc(im, trim=50, iters=6):
    """For tracing: the rough cut-out made on a small copy (the one that scored the photo) refined on the full photo with GrabCut,
    which learns the leaf and the background from it; then thin stems trimmed and holes filled."""
    W, H = im.size
    sm = im.copy(); sm.thumbnail((240, 240))
    m0, _ = leaf_mask(sm)
    if m0 is None:
        return None
    m0 = cv2.resize(m0, (W, H), interpolation=cv2.INTER_NEAREST)
    k = max(3, W // 60)
    sure = cv2.erode(m0, np.ones((k, k), np.uint8)); maybe = cv2.dilate(m0, np.ones((k * 2, k * 2), np.uint8))
    g = np.full((H, W), cv2.GC_BGD, np.uint8); g[maybe > 0] = cv2.GC_PR_BGD; g[m0 > 0] = cv2.GC_PR_FGD; g[sure > 0] = cv2.GC_FGD
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR), g, None, bg, fg, iters, cv2.GC_INIT_WITH_MASK)
    m = np.where((g == cv2.GC_FGD) | (g == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    t = max(3, W // trim) | 1
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (t, t)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        return None
    comp = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8) * 255
    ff = comp.copy(); cv2.floodFill(ff, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 255)
    return comp | cv2.bitwise_not(ff)


def smooth_contour(c, sigma):
    """Smooth a closed outline along its length (keeps lobes and teeth bigger than sigma, drops pixel steps)."""
    n = len(c); k = int(3 * sigma) or 1
    w = np.exp(-0.5 * (np.arange(-k, k + 1) / sigma) ** 2); w /= w.sum()
    pad = np.vstack([c[-k:], c, c[:k]])
    return np.stack([np.convolve(pad[:, j], w, 'valid') for j in (0, 1)], 1)


def score_one(slug, k, p):
    im = fetch_img(p['url'].replace('square', 'small'))
    if im is None:
        return None
    m, info = leaf_mask(im)
    if m is None:
        return None
    sc = (info['share'] * (0 if info['edge'] else 1) * (1 - min(1, info['bg_green'] * 4)) * (1 if 0.06 < info['frac'] < 0.7 else 0.2))
    return {'k': k, 'url': p['url'], 'attr': p['attr'], 'lic': p['lic'], 'score': round(sc, 3), **{a: round(b, 3) for a, b in info.items()}}


def pool(slug):
    """Every candidate photo for a tree: the New Jersey ones from build_trees.py, then up to 600 more from anywhere, from observations
    annotated as showing green leaves (a leaf's shape does not depend on the state it grew in). Fixed once written, so picks stay valid."""
    out = f'{TMP}/pool-{slug}.json'
    if os.path.exists(out):
        return json.load(open(out))
    import build_trees as BT
    rec = json.load(open(f'/tmp/trees/{slug}.json'))
    photos = [p for o in rec['obs'] for p in o['photos']]
    seen = {p['id'] for p in photos}
    for page in (1, 2, 3):
        r = BT.get('observations', taxon_id=rec['taxon'], quality_grade='research', photos='true', photo_license=BT.OK_LICENSES, term_id=36, term_value_id=37,
                   order_by='votes', per_page=200, page=page)
        for o in r['results']:
            for p in o['photos']:
                if p.get('license_code') and p['id'] not in seen:
                    seen.add(p['id']); photos.append({'id': p['id'], 'url': p['url'], 'lic': p['license_code'], 'attr': p['attribution']})
        if page * 200 >= r['total_results']:
            break
    json.dump(photos, open(out, 'w'))
    return photos


def score():
    os.makedirs(TMP, exist_ok=True)
    for slug in BROAD:
        out = f'{TMP}/{slug}.json'
        if os.path.exists(out):
            continue
        photos = pool(slug)
        with cf.ThreadPoolExecutor(8) as ex:
            res = [r for r in ex.map(lambda kp: score_one(slug, *kp), enumerate(photos)) if r]
        res.sort(key=lambda r: -r['score'])
        json.dump(res, open(out, 'w'))
        print(f'{slug:18s} {len(photos)} photos, {sum(r["score"] > 0.5 for r in res)} good', flush=True)


def sheet():
    for slug in BROAD:
        res = json.load(open(f'{TMP}/{slug}.json'))[:24]
        S = Image.new('RGB', (6 * 200, 4 * 200), 'white')
        def tile(i_r):
            i, r = i_r
            im = fetch_img(r['url'].replace('square', 'small'))
            if im is None:
                return
            m, _ = leaf_mask(im)
            a = np.asarray(im).copy()
            cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            cv2.drawContours(a, cs, -1, (255, 0, 0), 2)
            t = Image.fromarray(a); t.thumbnail((196, 196))
            S.paste(t, ((i % 6) * 200 + 2, (i // 6) * 200 + 2))
            d = ImageDraw.Draw(S); d.rectangle(((i % 6) * 200, (i // 6) * 200, (i % 6) * 200 + 30, (i // 6) * 200 + 15), fill='black')
            d.text(((i % 6) * 200 + 3, (i // 6) * 200 + 2), str(r['k']), fill='yellow')
        with cf.ThreadPoolExecutor(8) as ex:
            list(ex.map(tile, enumerate(res)))
        S.save(f'{TMP}/sheet-{slug}.jpg', quality=82)
        print('sheet', slug, flush=True)


def trace():
    picks = json.load(open(os.path.join(ROOT, 'tools/leaf_picks.json')))
    out = {}
    for slug, pk in picks.items():
        k, turn = pk[:2]; opt = pk[2] if len(pk) > 2 else {}
        p = pool(slug)[k]
        im = fetch_img(p['url'].replace('square', 'medium'))
        m = leaf_mask_seeded(im, tuple(opt['seed']), opt.get('tol', 14), opt.get('trim', 50)) if 'seed' in opt else leaf_mask_gc(im, opt.get('trim', 50))
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        c = max(cs, key=cv2.contourArea).reshape(-1, 2).astype(float)
        c = smooth_contour(c, opt.get('smooth', max(1.5, len(c) / 400)))
        th = math.radians(turn)
        c = c @ np.array([[math.cos(th), math.sin(th)], [-math.sin(th), math.cos(th)]])
        x0, y0 = c.min(0); x1, y1 = c.max(0)
        sc = min(92 / (x1 - x0), 116 / (y1 - y0))
        c = (c - [(x0 + x1) / 2, y1]) * sc + [50, 118]
        eps = 0.35
        c = cv2.approxPolyDP(c.astype(np.float32).reshape(-1, 1, 2), eps, True).reshape(-1, 2)
        d = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in c) + 'Z'
        os.makedirs(f'{TMP}/traced', exist_ok=True); im.save(f'{TMP}/traced/{slug}.jpg')
        out[slug] = {'d': d, 'photo': p['url'].replace('square', 'medium'), 'credit': p['attr'], 'lic': p['lic'], 'obs_photo': k}
        print(f'{slug:18s} {len(c)} points', flush=True)
    json.dump(out, open(os.path.join(ROOT, 'data/leafoutlines.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(ROOT, 'js/treeoutlines.js'), 'w') as f:
        f.write('// Generated by tools/trace_leaves.py trace: each tree\'s leaf outline traced from a real photo (credit and licence with it).\n')
        f.write('export const OUTLINES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    {'score': score, 'sheet': sheet, 'trace': trace}[sys.argv[1]]()
