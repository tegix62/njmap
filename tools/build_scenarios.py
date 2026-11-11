#!/usr/bin/env python3
"""Turn the Port Authority alert log into the small file the game reads: data/lincoln-scenarios.json.

For every weekday x hour (New York time) it works out how often, in the alert history, the Lincoln Tunnel was in
each of two unusual states, from the alerts themselves:
  * "The Lincoln Tunnel Expressway is closed until 5:00 am. Follow detours."  (New Jersey-bound traffic goes
    north on 10th or 11th Ave to Galvin Plaza)
  * "Lincoln Tunnel North Tube to NJ closed tonight 11pm to 5am tomorrow. Use Center Tube to NJ. Vehicles on
    10th Ave use right on 40th St for Tunnel access to NJ."
The game picks a practice time at random (more often mornings, daytime and evenings), then picks the state with
those real frequencies, so the odd ones come up in the hours they really happen, and less often.

The output is ~3 KB; the full log (data/advisories-log.json) is never loaded by the app.
Usage: python3 -I tools/build_scenarios.py
"""
import datetime, json, os, re
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ET = ZoneInfo('America/New_York')
UTC = datetime.timezone.utc

def clock(s):
    m = re.match(r'(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m', s.strip().lower())
    return (int(m.group(1)) % 12) + (12 if m.group(3) == 'p' else 0), int(m.group(2) or 0)

def next_at(start, h, mi):
    t = start.replace(hour=h, minute=mi, second=0, microsecond=0)
    return t if t > start else t + datetime.timedelta(days=1)

def slots(start, end):
    """Every (date, hour) a closure touched."""
    t = start.replace(minute=0, second=0, microsecond=0)
    while t < end:
        yield (t.date(), t.hour)
        t += datetime.timedelta(hours=1)

def main():
    log = json.load(open(os.path.join(ROOT, 'data/advisories-log.json')))
    lin = [a for a in log['alerts'] if 'lincoln' in a['facility']]
    stamp = lambda a: datetime.datetime.strptime(a['ts'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=UTC).astimezone(ET)
    first, last = stamp(log['alerts'][0]), stamp(log['alerts'][-1])
    exp, nt = set(), set()
    last_exp = last_nt = None
    quote = {}
    for a in lin:
        t, m = stamp(a), a['msg']
        x = re.search(r'expressway (?:is )?closed until (\d{1,2}(?::\d{2})?\s*[ap]\.?m)', m, re.I)
        if x:
            h, mi = clock(x.group(1))
            exp.update(slots(t, next_at(t, h, mi)))
            last_exp, quote['expressway'] = a['ts'], m.split(' Updates')[0]
        y = re.search(r'north tube to nj closed tonight (\d{1,2}(?::\d{2})?\s*[ap]m) to (\d{1,2}(?::\d{2})?\s*[ap]m)', m, re.I)
        if y:
            (h1, m1), (h2, m2) = clock(y.group(1)), clock(y.group(2))
            day = t.date()
            if h1 == 0 and t.hour >= 12:
                day += datetime.timedelta(days=1)  # "tonight 12am" = just after midnight
            start = datetime.datetime(day.year, day.month, day.day, h1, m1, tzinfo=ET)
            nt.update(slots(start, next_at(start, h2, m2)))
            last_nt, quote['northTube'] = a['ts'], m.split(' Updates')[0]
    weeks = max(4.0, (last - first).days / 7)
    def table(s):
        grid = [[0.0] * 24 for _ in range(7)]
        for d, hr in s:
            wd = (d.weekday() + 1) % 7  # JavaScript's: Sunday = 0
            grid[wd][hr] += 1
        return [round(min(0.95, c / weeks), 2) for row in grid for c in row]  # 7 x 24, Sunday first, flattened
    out = {
        'built': datetime.datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'since': first.strftime('%Y-%m-%d'), 'through': last.strftime('%Y-%m-%d'), 'weeks': round(weeks, 1),
        'pExpressway': table(exp), 'pNorthTube': table(nt),
        'lastExpresswayClosure': last_exp, 'lastNorthTubeClosure': last_nt,
        # when you practice: mornings, days and evenings most, nights a bit less; weekdays over weekends
        'hourWeight': [2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2],
        'dayWeight': [0.7, 1, 1, 1, 1, 1, 0.7],
        'quotes': quote,
    }
    path = os.path.join(ROOT, 'data/lincoln-scenarios.json')
    if os.path.exists(path):
        prev = json.load(open(path))
        if {k: v for k, v in prev.items() if k not in ('built', 'through')} == {k: v for k, v in out.items() if k not in ('built', 'through')}:
            print('no change in the scenario tables')
            return  # nothing new: leave the file (and the repo) alone
    with open(path, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'{os.path.getsize(path)} bytes; {len(exp)} expressway-closed hours, {len(nt)} north-tube-closed hours over {weeks:.0f} weeks')
    # how often each state would come up with those weights
    tot = a = b = 0.0
    for d in range(7):
        for h in range(24):
            w = out['hourWeight'][h] * out['dayWeight'][d]
            pe, pn = out['pExpressway'][d * 24 + h], out['pNorthTube'][d * 24 + h]
            tot += w
            a += w * pe
            b += w * (1 - pe) * pn
    print(f'practice share: expressway detour {100 * a / tot:.1f}%, north tube closed {100 * b / tot:.1f}%, usual {100 * (1 - (a + b) / tot):.1f}%')

if __name__ == '__main__':
    main()
