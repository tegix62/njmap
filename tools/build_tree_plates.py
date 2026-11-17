#!/usr/bin/env python3
"""Botanists' drawings for Trees of New Jersey: the line drawings from Britton & Brown, *An Illustrated Flora of the Northern United States,
Canada and the British Possessions* (2nd ed., 1913; public domain), as uploaded to Wikimedia Commons under "<Genus species> drawing.png".

    python3 tools/build_tree_plates.py <dir of downloaded PNGs>

The downloads (named Genus_species.png) are trimmed, scaled to 720 px on the long side, reduced to grey ink and written to img/trees/bb/<slug>.png;
data/treeplates.json records each file, its Commons page and what the drawing clearly shows (SHOWS below, filled in by looking at each one).
"""
import json, os, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_trees import TREES  # (sci, slug)

CREDIT = 'Britton & Brown, An Illustrated Flora of the Northern United States, Canada and the British Possessions (1913). Public domain, via Wikimedia Commons.'
# What each drawing clearly shows, by eye: 'arr' when leaves in pairs or one at a time can be read off the twig, 'leaf' when one leaf (or a whole
# compound leaf) is drawn complete, plus anything else worth pointing at. Trees missing here have no usable drawing yet.
SHOWS = json.load(open(os.path.join(ROOT, 'tools/tree_plates_shows.json'))) if os.path.exists(os.path.join(ROOT, 'tools/tree_plates_shows.json')) else {}


def main(src):
    os.makedirs(os.path.join(ROOT, 'img/trees/bb'), exist_ok=True)
    out = {}
    for sci, slug in TREES:
        p = os.path.join(src, sci.replace(' ', '_') + '.png')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('L')
        box = ImageOps.invert(im).point(lambda v: 255 if v > 40 else 0).getbbox()
        if box:
            pad = 12
            im = im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))
        im.thumbnail((720, 720), Image.LANCZOS)
        im = im.point(lambda v: 255 if v > 200 else v)           # clean paper
        im = im.quantize(colors=16).convert('L')
        f = f'img/trees/bb/{slug}.png'
        im.save(os.path.join(ROOT, f), optimize=True)
        fn = sci + ' drawing.png'
        out[slug] = {'f': f, 'w': im.width, 'h': im.height, 'src': 'https://commons.wikimedia.org/wiki/File:' + fn.replace(' ', '_'), **SHOWS.get(slug, {})}
        print(f'{slug:18s} {im.width}x{im.height} {os.path.getsize(os.path.join(ROOT, f)) // 1024} KB')
    json.dump({'credit': CREDIT, 'plates': out}, open(os.path.join(ROOT, 'data/treeplates.json'), 'w'), ensure_ascii=False, indent=0)
    print(len(out), 'drawings')


if __name__ == '__main__':
    main(sys.argv[1])
