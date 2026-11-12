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
    'Rockefeller Center': '30 Rockefeller Plaza', 'Tudor City': 'Tudor City', 'Madison Square Garden': 'Madison Square Garden', 'Staten Island Ferry': 'Staten Island Ferry',
    "Katz's Delicatessen": "Katz's Delicatessen", "Bloomingdale's": "Bloomingdale's",
    'Lincoln Center': 'Lincoln Center', 'Strawberry Fields': 'Strawberry Fields', 'The Dakota': 'The Dakota',
    'Natural History Museum': 'American Museum of Natural History', "Zabar's": "Zabar's", 'Frick Collection': 'Frick Collection',
    'The Met': 'Metropolitan Museum of Art', 'Guggenheim': 'Solomon R. Guggenheim Museum', 'Mount Sinai Hospital': 'Mount Sinai Hospital (Manhattan)',
    'Queensboro Bridge': 'Queensboro Bridge', 'Roosevelt Island Tram': 'Roosevelt Island Tramway',
    'Bank of America Tower': 'Bank of America Tower (New York City)', 'MetLife Building': 'MetLife Building', 'Citigroup Center': 'Citigroup Center',
    'Hearst Tower': 'Hearst Tower (New York City)', 'New York Times Building': 'The New York Times Building', 'One Vanderbilt': 'One Vanderbilt',
    'Central Park Tower': 'Central Park Tower', '432 Park Avenue': '432 Park Avenue', '111 West 57th Street': '111 West 57th Street', 'Seagram Building': 'Seagram Building',
    '8 Spruce Street': '8 Spruce Street', 'Four World Trade Center': '4 World Trade Center', '4 Times Square': '4 Times Square',
    'Metropolitan Life Tower': 'Metropolitan Life Insurance Company Tower', 'Chanin Building': 'Chanin Building', 'Municipal Building': 'Manhattan Municipal Building',
    '53 West 53rd': '53 West 53rd',
    'Columbia University': 'Columbia University', 'Cathedral of St. John the Divine': 'Cathedral of St. John the Divine', 'Riverside Church': 'Riverside Church (New York City)',
    "Grant's Tomb": "General Grant National Memorial", 'Apollo Theater': 'Apollo Theater',
}

# where the article's lead image is a logo or drawing, a chosen Commons file instead
FILES = {
    'Cooper Union': 'The Cooper Union Foundation Building 002.jpg',
    'Chrysler Building': 'Chrysler Building by David Shankbone Retouched.jpg',
    'Trinity Church': 'NYC - Trinity Church - Watts statue.JPG',
    'One World Trade Center': 'One World Trade Center Building (2021).jpg',
    'Woolworth Building': 'Woolworth Building 9495.JPG',
    'United Nations': 'UN Headquarters 2.jpg',
    'Charging Bull': 'Bowling Green td (2018-12-13) 06 - 26 Broadway, Charging Bull.jpg',
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

def clean(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s or '')).strip()

def batch(titles, **q):
    """One API call for up to 50 titles."""
    r = api(action='query', titles='|'.join(titles), redirects=1, **q)
    return r['query']

NJ_TITLES = {
    'American Dream': 'American Dream (shopping mall)', 'Red Bull Arena': 'Red Bull Arena (Harrison)', 'Prudential Center': 'Prudential Center',
    'Newark Penn Station': 'Newark Penn Station', 'Boardwalk Hall': 'Boardwalk Hall', 'Great Auditorium': 'Great Auditorium (Ocean Grove)',
    'High Point Monument': 'High Point State Park', 'Garden State Plaza': 'Westfield Garden State Plaza', 'New Jersey State House': 'New Jersey State House',
    'Old Queens': 'Old Queens', 'Nassau Hall': 'Nassau Hall', 'Barnegat Lighthouse': 'Barnegat Lighthouse', 'Hoboken Terminal': 'Hoboken Terminal',
}


def main():
    nj = os.environ.get('NJ')          # NJ=1: the New Jersey landmarks (data/nj-landmarks.json -> data/nj-landmark-credits.json)
    TITLES.update(NJ_TITLES if nj else {})
    lm = json.load(open(os.path.join(ROOT, 'data/nj-landmarks.json' if nj else 'data/landmarks.json')))
    skip = set()  # silhouettes get a photo too (tap the callout to see it)
    only = set(sys.argv[1:])  # optional: just these landmarks (the rest of data/landmark-credits.json is kept)
    lm = [{'n': l['n']} if 'n' in l else {'n': l['name']} for l in lm]
    want = {l['n']: TITLES.get(l['n'], l['n']) for l in lm if l['n'] not in skip and (not only or l['n'] in only)}
    # 1. each article's lead image file (one call)
    q = batch(list(want.values()), prop='pageimages', piprop='name')
    redir = {r['from']: r['to'] for r in q.get('redirects', [])}
    norm = {r['from']: r['to'] for r in q.get('normalized', [])}
    byTitle = {pg['title']: pg.get('pageimage') for pg in q['pages']}
    files = {n: FILES[n] for n in want if n in FILES}
    for n, t in want.items():
        if n in files:
            continue
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
    cp = os.path.join(ROOT, 'data/nj-landmark-credits.json' if nj else 'data/landmark-credits.json')
    credits = json.load(open(cp)) if only and os.path.exists(cp) else {}
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
        try:
            data = get(ii['thumburl'], binary=True)
            out = f'img/landmarks/{slug}' + ('.png' if data[:4] == b'\x89PNG' else '.jpg')
        except Exception as e:
            print('FAILED download', n, e); continue
        open(os.path.join(ROOT, out), 'wb').write(data)
        credits[n] = {'img': out, 'file': f, 'author': clean(md.get('Artist', {}).get('value'))[:120], 'license': lic,
                      'page': ii.get('descriptionurl', '')}
        print('ok', n, f, lic, len(data), flush=True)
        time.sleep(1.0)
    json.dump(credits, open(cp, 'w'), indent=1, ensure_ascii=False)
    print(len(credits), 'photos')

if __name__ == '__main__':
    main()
