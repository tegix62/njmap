#!/usr/bin/env python3
"""Keep a running log of the Port Authority's Lincoln Tunnel, Holland Tunnel and George Washington Bridge alerts.

The Port Authority's own site loads its "Bridge & Tunnel alerts" from a JSON endpoint
(www.panynj.gov/bin/portauthority/crossingtimesalertapi.json?start_date=YYYY-MM-DD). This script reads it,
keeps the alerts about our three crossings, tags them (which tube, which direction, what kind of event),
and merges them into data/advisories-log.json (deduplicated by message id, oldest first), so the log keeps
growing as the script is run (the scheduled GitHub Action runs it every few hours).

Usage: python3 -I tools/fetch_advisories.py [--since YYYY-MM-DD]     (default: the last 4 days)
"""
import datetime, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, 'data/advisories-log.json')
API = 'https://www.panynj.gov/bin/portauthority/crossingtimesalertapi.json?start_date='
UA = 'Mozilla/5.0 (compatible; njmap-advisory-log/1.0)'

FACILITIES = [('lincoln', r'lincoln tunnel|\bnj ?495\b|\bnj route 495\b'), ('holland', r'holland tunnel'),
              ('gwb', r'george washington bridge|\bgwb\b')]

def tags(msg, template):
    m = (msg + ' ' + template).lower()
    t = []
    for name, rx in [('north_tube', r'north tube'), ('center_tube', r'center tube'), ('south_tube', r'south tube'),
                     ('expressway', r'expressway'), ('xbl', r'\bxbl\b|exclusive bus lane'),
                     ('to_nj', r'to nj|nj-bound|new jersey-bound|toward nj|to new jersey'), ('to_ny', r'to ny|ny-bound|to new york'),
                     ('full_closure', r'all lanes (blocked|closed)|full closure|facility (full )?clos|is closed'),
                     ('lane_closure', r'lane (closed|blocked)|lane closure|lanes? closed'),
                     ('planned', r'planned|tonight|until \d'), ('crash', r'crash|accident'),
                     ('disabled', r'disabled'), ('cleared', r'cleared|reopened|has been reopened|all lanes are open'),
                     ('detour', r'detour|galvin|40th st|10th ave|11th ave|9th ave'), ('hold', r'traffic hold')]:
        if re.search(rx, m):
            t.append(name)
    return t

def fetch(since):
    req = urllib.request.Request(API + since, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def main():
    since = (datetime.date.today() - datetime.timedelta(days=4)).isoformat()
    if '--since' in sys.argv:
        since = sys.argv[sys.argv.index('--since') + 1]
    log = json.load(open(LOG)) if os.path.exists(LOG) else {'source': API + '…', 'alerts': []}
    have = {a['id']: a for a in log['alerts']}
    added = updated = 0
    for x in fetch(since):
        msg = x.get('SentMessage', '')
        text = msg + ' ' + x.get('TemplateName', '')
        fac = [n for n, rx in FACILITIES if re.search(rx, text, re.I)]
        if not fac:
            continue
        ms = int(re.search(r'\d+', x['sentdate2']).group(0))
        rec = {'id': x['messageid'], 'ts': datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
               'facility': fac, 'template': x.get('TemplateName', ''), 'state': x.get('state', ''), 'msg': msg, 'tags': tags(msg, x.get('TemplateName', ''))}
        if rec['id'] not in have:
            added += 1
        elif have[rec['id']] != rec:
            updated += 1  # (an alert's state flips from Open to Closed)
        have[rec['id']] = rec
    log['alerts'] = sorted(have.values(), key=lambda a: (a['ts'], a['id']))
    log['updated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ') if (added or updated) else log.get('updated', '')
    with open(LOG, 'w') as f:
        json.dump(log, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{added} new, {updated} changed; {len(log["alerts"])} in the log')
    write_summary(log['alerts'])

def write_summary(alerts):
    """A small file for the app (the full log is too big to load): when the Lincoln Tunnel Expressway was last
    closed overnight (so the game knows whether the detour is still running) and the recent tube closures."""
    lin = [a for a in alerts if 'lincoln' in a['facility']]
    closed = [a for a in lin if re.search(r'expressway (is )?closed', a['msg'], re.I)]
    tubes = [a for a in lin if re.search(r'(north|center|south) tube', a['msg'], re.I) and re.search(r'closed', a['msg'], re.I) and 'cleared' not in a['tags']]
    now = datetime.datetime.now(datetime.timezone.utc)
    cut = (now - datetime.timedelta(days=45)).strftime('%Y-%m-%dT%H:%M:%SZ')
    out = {'updated': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
           'lastExpresswayClosure': closed[-1]['ts'] if closed else None,
           'expresswayClosures': [a['ts'] for a in closed if a['ts'] >= cut],
           'tubeClosures': [{'ts': a['ts'], 'msg': a['msg']} for a in tubes if a['ts'] >= cut][-20:],
           'alertsInLog': len(alerts)}
    path = os.path.join(ROOT, 'data/advisories-summary.json')
    if os.path.exists(path):
        prev = json.load(open(path))
        if {k: v for k, v in prev.items() if k != 'updated'} == {k: v for k, v in out.items() if k != 'updated'}:
            return  # nothing new: leave the file alone
    with open(path, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
