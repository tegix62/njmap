#!/usr/bin/env python3
"""Find named features in Overture Maps' base theme (water, land_use) inside New Jersey: the shapes of lakes, rivers and parks.

  python3 tools/overture_names.py water  /tmp/nj/water_lakes.pkl "lake hopatcong" "greenwood lake" ...
  python3 tools/overture_names.py land_use /tmp/nj/parks.pkl "branch brook park" ...

A name matches if the feature's primary name, lowercased, equals it or starts with it. Writes [(name, subtype, class, wkb)].
"""
import collections, pickle, re, sys, urllib.parse, urllib.request
import pyarrow.parquet as pq, fsspec
from concurrent.futures import ThreadPoolExecutor

base = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
RELEASE = '2026-10-21.0'
B = (-75.6, 38.9, -73.85, 41.4)


def keys_of(pre):
    keys, tok = [], None
    while True:
        u = base + f'?list-type=2&prefix={pre}' + (f'&continuation-token={urllib.parse.quote(tok)}' if tok else '')
        x = urllib.request.urlopen(u).read().decode()
        keys += re.findall(r'<Key>([^<]+\.parquet)</Key>', x)
        m = re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>', x)
        if not m:
            break
        tok = m.group(1)
    return keys


def main():
    typ, out, want = sys.argv[1], sys.argv[2], [w.lower() for w in sys.argv[3:]]
    ks = keys_of(f'release/{RELEASE}/theme=base/type={typ}/')
    def scan(k):
        got = []
        pf = pq.ParquetFile(fsspec.open(base + k, 'rb', block_size=2 * 1024 * 1024).open())
        md = pf.metadata
        ix = {md.schema.column(i).path: i for i in range(md.num_columns)}
        for g in range(md.num_row_groups):
            rg = md.row_group(g)
            st = lambda n: (rg.column(ix[n]).statistics.min, rg.column(ix[n]).statistics.max)
            if st('bbox.xmax')[1] < B[0] or st('bbox.xmin')[0] > B[2] or st('bbox.ymax')[1] < B[1] or st('bbox.ymin')[0] > B[3]:
                continue
            for r in pf.read_row_group(g, columns=['names', 'subtype', 'class', 'bbox', 'geometry']).to_pylist():
                nm = ((r['names'] or {}).get('primary') or '').lower()
                if not nm or not any(nm == w or nm.startswith(w) for w in want):
                    continue
                b = r['bbox']
                if B[0] < b['xmin'] and b['xmax'] < B[2] and B[1] < b['ymin'] and b['ymax'] < B[3]:
                    got.append((nm, r['subtype'], r['class'], bytes(r['geometry'])))
        return got
    rows = []
    with ThreadPoolExecutor(8) as ex:
        for res in ex.map(scan, ks):
            rows += res
    pickle.dump(rows, open(out, 'wb'))
    c = collections.Counter(r[0] for r in rows)
    print(len(rows), 'features;', {w: sum(v for n, v in c.items() if n == w or n.startswith(w)) for w in want})


if __name__ == '__main__':
    main()
