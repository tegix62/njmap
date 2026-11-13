// A small Mapbox Vector Tile reader: just enough to pull the lines of one layer out of a tile (here: the road names of OpenFreeMap's
// `transportation_name` layer), so Drive can know the local streets without the map being zoomed in on them.
//   decodeLines(arrayBuffer, 'transportation_name') -> { extent, features: [{ props, lines: [[[x, y], ...]] }] }   (tile coordinates)

function reader(buf) {
  const b = new Uint8Array(buf);
  let p = 0;
  const varint = () => {
    let r = 0, s = 0, x;
    do { x = b[p++]; r += (x & 0x7f) * 2 ** s; s += 7; } while (x & 0x80);
    return r;
  };
  return {
    get pos() { return p; }, set pos(v) { p = v; },
    done: (end) => p >= end,
    varint,
    zigzag: () => { const n = varint(); return (n >>> 1) ^ -(n & 1); },
    bytes: () => { const n = varint(); const s = p; p += n; return [s, p]; },
    skip: (wt) => { if (wt === 0) varint(); else if (wt === 1) p += 8; else if (wt === 2) { const n = varint(); p += n; } else if (wt === 5) p += 4; },
    str: (s, e) => new TextDecoder().decode(b.subarray(s, e)),
    f64: () => { const v = new DataView(b.buffer, b.byteOffset + p, 8).getFloat64(0, true); p += 8; return v; },
    f32: () => { const v = new DataView(b.buffer, b.byteOffset + p, 4).getFloat32(0, true); p += 4; return v; },
    packed: (s, e) => { const out = []; const q = p; p = s; while (p < e) out.push(varint()); p = q; return out; },
  };
}

export function decodeLines(buf, layerName) {
  const R = reader(buf);
  const end = new Uint8Array(buf).length;
  while (!R.done(end)) {
    const tag = R.varint(), field = tag >> 3, wt = tag & 7;
    if (field !== 3 || wt !== 2) { R.skip(wt); continue; }                    // Tile.layers
    const [ls, le] = R.bytes();
    const save = R.pos;
    R.pos = ls;
    let name = '', extent = 4096;
    const keys = [], vals = [], feats = [];
    while (R.pos < le) {
      const t = R.varint(), f = t >> 3, w = t & 7;
      if (f === 1 && w === 2) { const [s, e] = R.bytes(); name = R.str(s, e); }
      else if (f === 2 && w === 2) feats.push(R.bytes());
      else if (f === 3 && w === 2) { const [s, e] = R.bytes(); keys.push(R.str(s, e)); }
      else if (f === 4 && w === 2) {                                           // Value
        const [s, e] = R.bytes(); const q = R.pos; R.pos = s; let v = null;
        while (R.pos < e) {
          const t2 = R.varint(), f2 = t2 >> 3, w2 = t2 & 7;
          if (f2 === 1) { const [a, c] = R.bytes(); v = R.str(a, c); }
          else if (f2 === 2) v = R.f32();
          else if (f2 === 3) v = R.f64();
          else if (f2 === 4 || f2 === 5) v = R.varint();
          else if (f2 === 6) v = R.zigzag();
          else if (f2 === 7) v = !!R.varint();
          else R.skip(w2);
        }
        R.pos = q; vals.push(v);
      } else if (f === 5) extent = R.varint();
      else R.skip(w);
    }
    if (name !== layerName) { R.pos = save; continue; }
    const features = [];
    for (const [fs, fe] of feats) {
      R.pos = fs;
      let tags = [], type = 0, geom = [];
      while (R.pos < fe) {
        const t = R.varint(), f = t >> 3, w = t & 7;
        if (f === 2 && w === 2) { const [s, e] = R.bytes(); tags = R.packed(s, e); }
        else if (f === 3) type = R.varint();
        else if (f === 4 && w === 2) { const [s, e] = R.bytes(); geom = R.packed(s, e); }
        else R.skip(w);
      }
      if (type !== 2) continue;                                                // lines only
      const props = {};
      for (let i = 0; i + 1 < tags.length; i += 2) props[keys[tags[i]]] = vals[tags[i + 1]];
      const lines = [];
      let x = 0, y = 0, cur = null;
      for (let i = 0; i < geom.length;) {
        const cmd = geom[i] & 7, cnt = geom[i] >> 3; i++;
        if (cmd === 7) continue;
        for (let k = 0; k < cnt; k++) {
          const dx = (geom[i] >>> 1) ^ -(geom[i] & 1), dy = (geom[i + 1] >>> 1) ^ -(geom[i + 1] & 1); i += 2;
          x += dx; y += dy;
          if (cmd === 1) { cur = [[x, y]]; lines.push(cur); } else cur.push([x, y]);
        }
      }
      features.push({ props, lines });
    }
    return { extent, features };
  }
  return { extent: 4096, features: [] };
}

/** Tile coordinates -> [lng, lat]. */
export function tileToLngLat(z, tx, ty, extent, x, y) {
  const n = 2 ** z;
  const lng = ((tx + x / extent) / n) * 360 - 180;
  const m = Math.PI - (2 * Math.PI * (ty + y / extent)) / n;
  return [lng, (180 / Math.PI) * Math.atan(Math.sinh(m))];
}
export const lngLatToTile = (z, lng, lat) => {
  const n = 2 ** z, s = Math.sin((lat * Math.PI) / 180);
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log((1 + s) / (1 - s)) / (2 * Math.PI)) / 2) * n)];
};
