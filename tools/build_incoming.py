#!/usr/bin/env python3
"""Pictures added by hand in incoming/<tree>/ (from Wikimedia Commons), into the app.

    python3 tools/build_incoming.py

tools/incoming_picks.json says what each chosen picture shows ([file, context, optional caption]; context "drawing" for a botanist's plate);
tools/incoming_meta.json holds each file's author and licence from Commons (fetched once, by file name). Pictures with no licence found are
left out. Photos are written to img/trees/x/<tree>-<n>.jpg (900 px), drawings to img/trees/bb/<tree>.<png|jpg>; data/treeextra.json lists them
with credits, for js/trees.js to merge into each tree.
"""
import json, os, re
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def credit(m):
    a = m.get('artist', '')
    a = re.sub(r'^No machine-readable author provided\.\s*', '', a)
    a = re.sub(r'\s*assumed \(based on copyright claims\)\.?', '', a)
    a = re.sub(r'^Photo by and \(c\)\s*\d{4}\s*', '', a)
    a = a.split(' / ')[-1] if 'Britton' in a else a
    a = re.sub(r'\s+', ' ', a).strip(' .')
    if len(a) > 70:
        a = a[:67].rsplit(' ', 1)[0] + '…'
    return a or 'Unknown author'


def main():
    picks = json.load(open(os.path.join(ROOT, 'tools/incoming_picks.json')))
    meta = json.load(open(os.path.join(ROOT, 'tools/incoming_meta.json')))
    os.makedirs(os.path.join(ROOT, 'img/trees/x'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'img/trees/bb'), exist_ok=True)
    out = {}
    for slug, items in picks.items():
        rec = {'photos': [], 'drawings': []}
        n = 0
        for it in items:
            f, ctx = it[0], it[1]
            cap = it[2] if len(it) > 2 else ''
            m = meta.get(f) or {}
            if not m.get('lic'):
                print('  no licence, skipped:', slug, f); continue
            im = Image.open(os.path.join(ROOT, 'incoming', slug, f))
            im = ImageOps.exif_transpose(im)
            if im.mode in ('RGBA', 'LA', 'P'):      # transparent drawings: on white paper, not black
                im = im.convert('RGBA'); bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im); im = bg
            im = im.convert('RGB')
            entry = {'credit': credit(m), 'lic': m['lic'], 'src': m.get('page', ''), 'cap': cap}
            if ctx == 'drawing':
                im.thumbnail((1000, 1000), Image.LANCZOS)
                g = im.convert('L')
                colour = max(abs(a - b) for px in [im.resize((40, 40)).getpixel((x, y)) for x in range(40) for y in range(40)] for a, b in [(px[0], px[1]), (px[1], px[2])]) > 40
                k = len(rec['drawings'])
                name = f'img/trees/bb/{slug}{"-" + str(k) if k else ""}.{"jpg" if colour else "png"}'
                (im.save(os.path.join(ROOT, name), quality=85) if colour else g.save(os.path.join(ROOT, name), optimize=True))
                rec['drawings'].append({'f': name, 'w': im.width, 'h': im.height, 'colour': colour, **entry})
            else:
                n += 1
                im.thumbnail((900, 900), Image.LANCZOS)
                name = f'img/trees/x/{slug}-{n}.jpg'
                im.save(os.path.join(ROOT, name), quality=82, optimize=True)
                rec['photos'].append({'f': name, 'ctx': ctx, **entry})
        out[slug] = rec
        print(f'{slug:14s} {len(rec["photos"])} photos, {len(rec["drawings"])} drawings')
    json.dump(out, open(os.path.join(ROOT, 'data/treeextra.json'), 'w'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
