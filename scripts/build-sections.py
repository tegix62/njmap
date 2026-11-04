#!/usr/bin/env python3
"""Builds data/sections.json: the villages, sections and local place names
inside each municipality (e.g. Towaco -> Montville Township).

Sources
- Membership: HackJersey/garden-style data/localnames.csv (MIT), a list of
  ~3,300 NJ local place names and the municipality each belongs to.
- "Well-known" flag: a name counts as well known if it is a NJ post office
  name (npm `zipcodes`, BSD) or a GeoNames populated place with 1,000+ people
  (npm `cities.json`, CC-BY 4.0). Those are the names that show up in mailing
  addresses and on signs. Only the flag is derived from them.

Data files are parsed as text; no downloaded code is executed.
Usage: python3 scripts/build-sections.py
"""
import csv
import io
import json
import os
import re
import tarfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCALNAMES = "https://raw.githubusercontent.com/HackJersey/garden-style/master/data/localnames.csv"
ZIPCODES = "https://registry.npmjs.org/zipcodes/-/zipcodes-8.0.0.tgz"
CITIES = "https://registry.npmjs.org/cities.json/-/cities.json-1.1.66.tgz"

# Municipality spellings in localnames.csv that differ from the NJOGIS layer.
ALIASES = {
    "Caldwell Borough Township": "Caldwell Borough",
    "Princeton Township": "Princeton",
    "Princeton Borough": "Princeton",
    "Essex Fells Township": "Essex Fells Borough",
    "Peapack & Gladstone Borough": "Peapack-Gladstone Borough",
    "Orange City": "City of Orange Township",
    "Pine Valley Borough": "Pine Hill Borough",
}


def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def tar_member(blob, suffix):
    with tarfile.open(fileobj=io.BytesIO(blob)) as t:
        for m in t.getmembers():
            if m.name.endswith(suffix):
                return t.extractfile(m).read().decode("utf-8")
    raise SystemExit(f"{suffix} not found")


def main():
    topo = json.load(open(os.path.join(ROOT, "data/nj.topo.json")))
    munis = [g["properties"] for g in topo["objects"]["munis"]["geometries"]]
    keys = {(m["full"], m["c"]): m for m in munis}
    muni_names = {m["n"].lower() for m in munis}

    # Well-known names
    zips_js = tar_member(get(ZIPCODES), "lib/codes.js")
    start = zips_js.index("{")
    codes = json.loads(zips_js[start : zips_js.index("};", start) + 1])
    known = {z["city"].lower() for z in codes.values() if z.get("state") == "NJ"}
    cities = json.loads(tar_member(get(CITIES), "cities.json"))
    known |= {c["name"].lower() for c in cities if c.get("country") == "US" and c.get("admin1") == "NJ"}

    rows = csv.DictReader(io.StringIO(get(LOCALNAMES).decode("utf-8-sig")))
    out = {}
    unmatched = set()
    for r in rows:
        name = re.sub(r"\s+", " ", r["local_name"]).strip()
        muni = re.sub(r"\s+", " ", r["municipality"]).strip()
        county = r["County"].strip()
        muni = ALIASES.get(muni, muni)
        m = keys.get((muni, county))
        if not m:
            unmatched.add((muni, county))
            continue
        low = name.lower()
        own = {m["n"].lower(), m["full"].lower(), f"{m['n']} {m['t']}".lower(), f"{m['n']} township".lower()}
        if low in own:
            continue
        sec = out.setdefault(f"{m['full']}|{m['c']}", {})
        # A section that shares its name with another municipality (Woodbridge's
        # "Fairfield", Hanover's "Monroe") is real but not what people mean by
        # that name, so it's never flagged as well known.
        sec[name] = 1 if low in known and low not in muni_names else 0
    if unmatched:
        raise SystemExit(f"unmatched municipalities: {sorted(unmatched)}")

    # {key: [[name, wellKnown], ...]} with well-known names first
    data = {k: sorted(([n, f] for n, f in v.items()), key=lambda x: (-x[1], x[0])) for k, v in sorted(out.items())}
    path = os.path.join(ROOT, "data/sections.json")
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    total = sum(len(v) for v in data.values())
    known_n = sum(f for v in data.values() for _, f in v)
    print(f"wrote {path}: {total} names in {len(data)} municipalities ({known_n} well-known)")


if __name__ == "__main__":
    main()
