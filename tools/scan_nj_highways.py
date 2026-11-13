"""Scan Overture's transportation segments for the numbered and named highways of New Jersey, to /tmp/nj/hwy.pkl.
Keeps motorway / trunk / primary / secondary segments whose `routes` name a route (or whose name is the Turnpike / Parkway) inside the state's box."""
import pickle, re, sys, urllib.request, urllib.parse
import pyarrow.parquet as pq, fsspec
from concurrent.futures import ThreadPoolExecutor
base = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
pre = 'release/2026-10-21.0/theme=transportation/type=segment/'
BOX = (-75.62, 38.90, -73.88, 41.37)
def keys_of(p):
    keys = []; tok = None
    while True:
        u = base + f'?list-type=2&prefix={p}' + (f'&continuation-token={urllib.parse.quote(tok)}' if tok else '')
        x = urllib.request.urlopen(u).read().decode()
        keys += re.findall(r'<Key>([^<]+\.parquet)</Key>', x)
        m = re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>', x)
        if not m: break
        tok = m.group(1)
    return keys
keys = keys_of(pre); print(len(keys), 'files', flush=True)
CLS = {'motorway', 'trunk', 'primary', 'secondary'}
def scan(k):
    out = []
    try:
        pf = pq.ParquetFile(fsspec.open(base + k, 'rb', block_size=2 * 1024 * 1024).open()); md = pf.metadata
        ix = {md.schema.column(i).path: i for i in range(md.num_columns)}
        for g in range(md.num_row_groups):
            rg = md.row_group(g); st = lambda n: (rg.column(ix[n]).statistics.min, rg.column(ix[n]).statistics.max)
            if st('bbox.xmax')[1] < BOX[0] or st('bbox.xmin')[0] > BOX[2] or st('bbox.ymax')[1] < BOX[1] or st('bbox.ymin')[0] > BOX[3]: continue
            for r in pf.read_row_group(g, columns=['names', 'class', 'routes', 'geometry', 'bbox']).to_pylist():
                if r['class'] not in CLS: continue
                b = r['bbox']
                if b['xmax'] < BOX[0] or b['xmin'] > BOX[2] or b['ymax'] < BOX[1] or b['ymin'] > BOX[3]: continue
                rts = [(x.get('network'), x.get('ref')) for x in (r['routes'] or []) if x.get('ref')]
                nm = ((r['names'] or {}).get('primary')) or ''
                if not rts and not re.search(r'Turnpike|Garden State Parkway|Atlantic City Expressway', nm): continue
                out.append({'cls': r['class'], 'routes': rts, 'name': nm, 'geometry': bytes(r['geometry'])})
    except Exception as e:
        print('err', k, e, flush=True)
    return out
rows = []
with ThreadPoolExecutor(16) as ex:
    for res in ex.map(scan, keys): rows += res
pickle.dump(rows, open('/tmp/nj/hwy.pkl', 'wb')); print(len(rows), 'segments', flush=True)
