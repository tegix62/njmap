#!/usr/bin/env python3
"""Pictures from Wikimedia Commons for Trees of New Jersey, found without the (often throttled) search API: each tree's category page and its
subcategories are ordinary web pages that list their files.

Stage 1 (list):   python3 tools/commons_harvest.py list    every file in Category:<Genus species> and its subcategories (one level), sorted by
                                                           what the file name says (drawing, leaf, bark, winter, flower, fruit, fall, form, other),
                                                           into /tmp/commons/<slug>.json
Stage 2 (sheet):  python3 tools/commons_harvest.py sheet <slug> [kind ...]   numbered contact sheet of small previews of the chosen kinds
                                                           (/tmp/commons/sheet-<slug>.jpg), to pick from by eye; previews fetched slowly
Stage 3 (fetch):  python3 tools/commons_harvest.py fetch   the picks in tools/commons_picks.json (slug -> [[number, context, caption?], ...]):
                                                           author and licence (one batched request), the file (900 px), into incoming/<slug>/ under
                                                           its Commons name, and the picks appended to tools/incoming_picks.json and
                                                           tools/incoming_meta.json. Then run tools/build_incoming.py.
"""
import html, io, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_trees import TREES
TMP = '/tmp/commons'
UA = {'User-Agent': 'nj-townfinder-trees/1.0 (personal study app)'}
KINDS = [
    ('drawing', r'britton|bb-1913|drawing|illustrat|sylva|nas-\d|k[öo]hler|plate|line art|\.tiff?$|engraving|lithograph'),
    ('herbarium', r'herbari|specimen|sheet'),
    ('winter', r'winter|snow|bud|twig'),
    ('bark', r'bark|trunk'),
    ('leaf', r'lea(f|ves)|foliage|needle'),
    ('flower', r'flower|bloom|blossom|catkin|inflorescence'),
    ('fruit', r'fruit|seed|acorn|cone|nut|berr|samara|husk|pod'),
    ('fall', r'autumn|fall'),
    ('form', r'tree|habit|park|forest|grove|crown'),
]


def get(url, tries=6):
    wait = 10
    for k in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        except Exception as e:
            if getattr(e, 'code', 0) == 404:
                return None
            time.sleep(wait); wait = min(wait * 2, 300)
    return None


def page_files(cat):
    """Files and subcategories listed on a Commons category page (all of its pages, following 'next page')."""
    files, subs, url = [], [], 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote(cat)
    for _ in range(12):
        raw = get(url)
        if not raw:
            break
        h = raw.decode('utf-8', 'replace')
        files += [html.unescape(t) for t in re.findall(r'class="galleryfilename[^"]*"[^>]*title="(File:[^"]+)"', h)]
        files += [html.unescape(t) for t in re.findall(r'<a href="/wiki/File:[^"]+" class="mw-file-description" title="(File:[^"]+)"', h)]
        sub = h.split('id="mw-subcategories"')[1].split('id="mw-pages"')[0].split('id="mw-category-media"')[0] if 'id="mw-subcategories"' in h else ''
        subs += [html.unescape(t) for t in re.findall(r'href="/wiki/(Category:[^"#?]+)"', sub)]
        nxt = re.search(r'<a href="(/w/index\.php\?title=Category:[^"]+filefrom=[^"]+)"[^>]*>next page</a>', h)
        if not nxt:
            break
        url = 'https://commons.wikimedia.org' + html.unescape(nxt.group(1)); time.sleep(1)
    return list(dict.fromkeys(files)), list(dict.fromkeys(subs))


def kind_of(title):
    t = title.lower()
    for k, rx in KINDS:
        if re.search(rx, t):
            return k
    return 'other'


def list_():
    os.makedirs(TMP, exist_ok=True)
    for sci, slug in TREES:
        out = f'{TMP}/{slug}.json'
        if os.path.exists(out):
            continue
        cat = 'Category:' + sci.replace(' ', '_')
        files, subs = page_files(cat)
        for sc in subs[:25]:
            if sci.split()[0].lower() not in sc.lower():
                continue
            f2, _ = page_files(sc); files += [f for f in f2 if f not in files]; time.sleep(1)
        rec = [{'title': f, 'kind': kind_of(f + ' ' + ' '.join(s for s in subs if f in s))} for f in files if re.search(r'\.(jpe?g|png|gif|tiff?)$', f, re.I)]
        json.dump(rec, open(out, 'w'), indent=0)
        from collections import Counter
        print(f'{slug:18s} {len(rec):4d} files', dict(Counter(r['kind'] for r in rec)), flush=True)
        time.sleep(2)


def thumb_url(title, w):
    """The URL of a Commons thumbnail, from the file's name (the same hashed path the site uses)."""
    import hashlib
    fn = title[5:].replace(' ', '_'); h = hashlib.md5(fn.encode()).hexdigest()
    q = urllib.parse.quote(fn)
    ext = '.png' if fn.lower().endswith(('.tif', '.tiff')) else ''
    return f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{w}px-{q}{ext}'


def api_thumbs(titles, width=330):
    """Thumbnail URLs as Commons itself gives them (iiurlwidth): batched, 40 titles a request. Self-made thumbnail URLs at unusual sizes
    are throttled, so ask the API."""
    out = {}
    for i in range(0, len(titles), 40):
        q = {'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': width, 'titles': '|'.join(titles[i:i + 40]), 'format': 'json'}
        for k in range(6):
            try:
                d = json.load(urllib.request.urlopen(urllib.request.Request('https://commons.wikimedia.org/w/api.php', data=urllib.parse.urlencode(q).encode(), headers=UA), timeout=60)); break
            except Exception as e:
                print('  thumbs retry', e, flush=True); time.sleep(20 * (k + 1))
        else:
            continue
        norm = {n['to']: n['from'] for n in d['query'].get('normalized', [])}
        for pg in d['query']['pages'].values():
            if 'imageinfo' in pg:
                out[norm.get(pg['title'], pg['title'])] = pg['imageinfo'][0].get('thumburl')
        time.sleep(3)
    return out


def sheet(slug, kinds):
    from PIL import Image, ImageDraw
    rec = json.load(open(f'{TMP}/{slug}.json'))
    sel = [(i, r) for i, r in enumerate(rec) if not kinds or r['kind'] in kinds][:30]
    os.makedirs(f'{TMP}/thumbs', exist_ok=True)
    need = [r['title'] for i, r in sel if not os.path.exists(f'{TMP}/thumbs/{slug}-{i}.jpg')]
    urls = api_thumbs(need) if need else {}
    S = Image.new('RGB', (6 * 200, 5 * 215), 'white'); d = ImageDraw.Draw(S)
    for j, (i, r) in enumerate(sel):
        p = f'{TMP}/thumbs/{slug}-{i}.jpg'
        if not os.path.exists(p) and urls.get(r['title']):
            raw = get(urls[r['title']], tries=2)
            if raw:
                try: Image.open(io.BytesIO(raw)).convert('RGB').save(p)
                except Exception: pass
            time.sleep(1.5)
        x, y = (j % 6) * 200, (j // 6) * 215
        if os.path.exists(p):
            im = Image.open(p); im.thumbnail((196, 190)); S.paste(im, (x + 2, y + 2))
        d.rectangle((x, y, x + 34, y + 15), fill='black'); d.text((x + 3, y + 2), str(i), fill='yellow')
        d.text((x + 2, y + 196), f"{r['kind']}: {r['title'][5:32]}", fill='black')
    S.save(f'{TMP}/sheet-{slug}.jpg', quality=82)
    print('sheet', slug, len(sel), 'previews', sum(os.path.exists(f'{TMP}/thumbs/{slug}-{i}.jpg') for i, _ in sel), flush=True)


def fetch():
    picks = json.load(open(os.path.join(ROOT, 'tools/commons_picks.json')))
    ipicks = json.load(open(os.path.join(ROOT, 'tools/incoming_picks.json')))
    meta = json.load(open(os.path.join(ROOT, 'tools/incoming_meta.json')))
    from PIL import Image
    titles = []
    for slug, items in picks.items():
        rec = json.load(open(f'{TMP}/{slug}.json'))
        titles += [rec[it[0]]['title'] for it in items]
    info = {}
    for i in range(0, len(titles), 40):
        q = {'action': 'query', 'prop': 'imageinfo', 'iiprop': 'extmetadata|url', 'iiurlwidth': 900, 'titles': '|'.join(titles[i:i + 40]), 'format': 'json'}
        d = None
        for k in range(8):
            try:
                d = json.load(urllib.request.urlopen(urllib.request.Request('https://commons.wikimedia.org/w/api.php', data=urllib.parse.urlencode(q).encode(), headers=UA), timeout=60)); break
            except Exception as e:
                print('  metadata retry', e, flush=True); time.sleep(20 * (k + 1))
        if not d:
            raise SystemExit('could not read metadata')
        norm = {n['to']: n['from'] for n in d['query'].get('normalized', [])}
        for p in d['query']['pages'].values():
            if 'imageinfo' not in p:
                continue
            ii = p['imageinfo'][0]; em = ii.get('extmetadata', {})
            g = lambda k: html.unescape(re.sub(r'<[^>]+>', '', em.get(k, {}).get('value', ''))).strip()
            info[norm.get(p['title'], p['title'])] = {'artist': g('Artist'), 'lic': g('LicenseShortName'), 'page': ii.get('descriptionurl'), 'thumb': ii.get('thumburl') or ii.get('url')}
        time.sleep(3)
    for slug, items in picks.items():
        rec = json.load(open(f'{TMP}/{slug}.json'))
        os.makedirs(os.path.join(ROOT, 'incoming', slug), exist_ok=True)
        have = {it[0] for it in ipicks.get(slug, [])}
        for it in items:
            t = rec[it[0]]['title']; m = info.get(t)
            if not m or not m['lic']:
                print('  no licence, skipped:', slug, t); continue
            fn = t[5:].replace(' ', '_')
            if fn.lower().endswith(('.tif', '.tiff')):
                fn += '.png'
            path = os.path.join(ROOT, 'incoming', slug, fn)
            if not os.path.exists(path):
                raw = get(m['thumb'])
                if not raw:
                    print('  download failed:', fn); continue
                im = Image.open(io.BytesIO(raw)); im.save(path) if fn.lower().endswith('.png') else im.convert('RGB').save(path, quality=88)
                time.sleep(2)
            meta[fn] = {'slug': slug, 'artist': m['artist'], 'lic': m['lic'], 'page': m['page']}
            if fn not in have:
                ipicks.setdefault(slug, []).append([fn] + list(it[1:]))
            print('  ok', slug, fn[:60], m['lic'], flush=True)
    json.dump(ipicks, open(os.path.join(ROOT, 'tools/incoming_picks.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(meta, open(os.path.join(ROOT, 'tools/incoming_meta.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    a = sys.argv[1]
    if a == 'list': list_()
    elif a == 'sheet': sheet(sys.argv[2], sys.argv[3:])
    elif a == 'fetch': fetch()
