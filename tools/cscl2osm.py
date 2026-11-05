"""NYC CSCL centerline GeoJSON -> Overpass-like JSON for blocks.py.

usage: python3 -I cscl2osm.py cscl.geojson out.json
trafdir: FT = with the line's drawing direction, TF = against it, TW = both,
NV = not for vehicles (skipped).
"""
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))

def ordinal(n):
    n = int(n)
    if 11 <= n % 100 <= 13:
        return f'{n}th'
    return f"{n}{ {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th') }"

AVES = {
    '11 AVE': '11th Avenue', '10 AVE': '10th Avenue', '9 AVE': '9th Avenue', '8 AVE': '8th Avenue',
    '7 AVE': '7th Avenue', 'AVE OF THE AMERICAS': 'Avenue of the Americas', '5 AVE': '5th Avenue',
    'MADISON AVE': 'Madison Avenue', 'PARK AVE': 'Park Avenue', 'PARK AVE S': 'Park Avenue South',
    'UNION SQ E': 'Union Square East', 'PARK AVE VIADUCT': 'Park Avenue Viaduct',
    'LEXINGTON AVE': 'Lexington Avenue', '3 AVE': '3rd Avenue', '2 AVE': '2nd Avenue', '1 AVE': '1st Avenue',
}
els = []
for i, f in enumerate(d['features']):
    p = f['properties']
    name = re.sub(r'\s+', ' ', p.get('full_street_name') or '').strip()
    td = p.get('trafdir')
    if td not in ('FT', 'TF', 'TW'):
        continue
    m = re.match(r'^([EW]) (\d+) ST$', name)
    if m:
        osm_name = f"{'West' if m.group(1) == 'W' else 'East'} {ordinal(m.group(2))} Street"
    elif name in AVES:
        osm_name = AVES[name]
    else:
        continue
    g = f['geometry']
    lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for line in lines:
        els.append({
            'type': 'way',
            'id': i,
            'tags': {'name': osm_name, 'oneway': {'FT': 'yes', 'TF': '-1', 'TW': 'no'}[td], 'rw_type': p.get('rw_type')},
            'geometry': [{'lon': c[0], 'lat': c[1]} for c in line],
        })
json.dump({'osm3s': {'timestamp_osm_base': 'NYC CSCL ' + max((x['properties'].get('modified_date') or '') for x in d['features'])}, 'elements': els}, open(out, 'w'))
print(len(els), 'segments')
