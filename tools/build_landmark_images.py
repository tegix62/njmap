#!/usr/bin/env python3
"""Fetch a small lead photo + credit for each landmark that has no silhouette.

Uses the English Wikipedia API (its lead image, and the file's license data from Wikimedia
Commons) and downloads 220px thumbnails to img/landmarks/. Writes data/landmark-credits.json.
Usage: python3 -I tools/build_landmark_images.py   (needs en.wikipedia.org + upload.wikimedia.org)
"""
import json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = 'landmark-thumbnail-builder/1.0 (static hobby map app)'
# landmark name -> Wikipedia article, where the plain name is not the article
TITLES = {
    'MoMA': 'Museum of Modern Art', 'Stock Exchange': 'New York Stock Exchange', 'Plaza Hotel': 'The Plaza (New York City)',
    'Javits Center': 'Jacob K. Javits Convention Center', 'Morgan Library': 'Morgan Library & Museum',
    'Waldorf Astoria': 'Waldorf Astoria New York', 'Whitney Museum': 'Whitney Museum of American Art',
    '9/11 Memorial': 'National September 11 Memorial & Museum', 'Oculus': 'World Trade Center station (PATH)',
    'City Hall': 'New York City Hall', 'Penn Station': 'Pennsylvania Station (New York City)',
    'Trinity Church': 'Trinity Church (Manhattan)', "St. Patrick's Cathedral": "St. Patrick's Cathedral (Manhattan)",
    'New York Public Library': 'New York Public Library Main Branch', 'Union Square': 'Union Square, Manhattan',
    "Macy's Herald Square": "Macy's Herald Square", 'Columbus Circle': 'Columbus Circle', 'Battery Park': 'Battery Park',
    'Tudor City': 'Tudor City', 'Madison Square Garden': 'Madison Square Garden', 'Staten Island Ferry': 'Staten Island Ferry',
    "Katz's Delicatessen": "Katz's Delicatessen", "Bloomingdale's": "Bloomingdale's",
}

def get(url, binary=False, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                b = r.read()
                return b if binary else json.loads(b)
        except Exception as e:
            code = getattr(e, 'code', 0)
            if i == tries - 1:
                raise
            time.sleep(20 * (i + 1) if code in (429, 503) else 2)

def api(**q):
    q.update(format='json', formatversion='2')
    return get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(q))

def batch(titles, **q):
    """One API call for up to 50 titles."""
    r = api(action='query', titles='|'.join(titles), redirects=1, **q)
    return r['query']

def main():
    lm = json.load(open(os.path.join(ROOT, 'data/landmarks.json')))
    ip = os.path.join(ROOT, 'data/landmark-icons.json')
    skip = set(json.load(open(ip)).keys()) if os.path.exists(ip) else set()
    want = {l['n']: TITLES.get(l['n'], l['n']) for l in lm if l['n'] not in skip}
    # 1. each article's lead image file (one call)
    q = batch(list(want.values()), prop='pageimages', piprop='name')
    redir = {r['from']: r['to'] for r in q.get('redirects', [])}
    norm = {r['from']: r['to'] for r in q.get('normalized', [])}
    byTitle = {pg['title']: pg.get('pageimage') for pg in q['pages']}
    files = {}
    for n, t in want.items():
        t2 = redir.get(norm.get(t, t), norm.get(t, t))
        if byTitle.get(t2):
            files[n] = byTitle[t2]
        else:
            print('no lead image:', n)
    # 2. licence + thumbnail URL for all those files (one call)
    q = batch(['File:' + f for f in files.values()], prop='imageinfo', iiprop='url|extmetadata', iiurlwidth=220)
    redir = {r['from']: r['to'] for r in q.get('redirects', [])}
    norm = {r['from']: r['to'] for r in q.get('normalized', [])}
    info = {pg['title']: (pg.get('imageinfo') or [None])[0] for pg in q['pages']}
    credits = {}
    for n, f in files.items():
        t = 'File:' + f
        t = norm.get(t, t); t = redir.get(t, t)
        ii = info.get(t)
        if not ii:
            print('no info:', n, f); continue
        md = ii.get('extmetadata', {})
        lic = clean(md.get('LicenseShortName', {}).get('value'))
        if not lic or 'fair use' in lic.lower() or 'non-free' in lic.lower():
            print('license unusable:', n, lic); continue
        slug = re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')
        out = f'img/landmarks/{slug}.jpg'
        try:
            data = get(ii['thumburl'], binary=True)
        except Exception as e:
            print('FAILED download', n, e); continue
        open(os.path.join(ROOT, out), 'wb').write(data)
        credits[n] = {'img': out, 'file': f, 'author': clean(md.get('Artist', {}).get('value'))[:120], 'license': lic,
                      'page': ii.get('descriptionurl', '')}
        print('ok', n, f, lic, len(data), flush=True)
        time.sleep(1.0)
    json.dump(credits, open(os.path.join(ROOT, 'data/landmark-credits.json'), 'w'), indent=1, ensure_ascii=False)
    print(len(credits), 'photos')

if __name__ == '__main__':
    main()
