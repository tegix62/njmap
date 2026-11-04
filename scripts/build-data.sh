#!/usr/bin/env bash
# Rebuilds data/nj.topo.json from the NJ Office of GIS "Municipal Boundaries of NJ"
# layer, as packaged in the npm module @njam-data/new-jersey-municipalities.
#
#   Source: https://njogis-newjersey.opendata.arcgis.com/datasets/municipal-boundaries-of-nj-hosted-3857
#
# Requires node/npx. Usage: scripts/build-data.sh
set -euo pipefail
cd "$(dirname "$0")/.."
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

( cd "$WORK" && npm pack @njam-data/new-jersey-municipalities@1.3.0 >/dev/null && tar xzf ./*.tgz )
SRC="$WORK/package/data/new-jersey-municipalities.geojson"

# - Pine Valley merged into Pine Hill in 2022; the source still lists it separately.
# - Boundaries are simplified with a 10 m tolerance (keeps "which town am I in"
#   answers accurate to well under typical phone-GPS error near a border).
npx --yes mapshaper@0.6 -i "$SRC" name=munis \
  -each 'if (mun_label=="Pine Valley Borough") {mun_label="Pine Hill Borough"; gnis_name="Borough of Pine Hill"}' \
  -dissolve2 fields=mun_label,county copy-fields=mun_type,gnis_name sum-fields=pop2010 \
  -simplify interval=10 keep-shapes \
  -each '
    t = mun_type == "Princeton" ? "Borough" : mun_type;
    n = gnis_name;
    while (/^(City|Town|Township|Borough|Village) of /.test(n)) n = n.replace(/^\w+ of /, "");
    full = mun_label;
    c = county.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    p = pop2010;
  ' \
  -filter-fields n,t,full,c,p \
  -points inner + name=labels \
  -dissolve c target=munis + name=counties \
  -points inner + name=countylabels \
  -o data/nj.topo.json format=topojson target=munis,counties,labels,countylabels quantization=200000

ls -la data/nj.topo.json
