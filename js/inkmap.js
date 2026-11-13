// One rule for every layer the looks do not know by name.
//
// The looks recolour the base map by layer id (js/paper.js, js/holo.js), but each game adds layers of its own — Manhattan's street-grid game alone has
// about thirty — and which game, which region, even which version, differs. So that every game follows a look the same way, any colour a layer
// uses is mapped to the look's ink by what the colour *is*: reds and oranges to the red ink, blues to the blue ink, greens to the green, yellows to
// the yellow, dark neutrals to the navy, light neutrals to the stock. Alpha is kept. The same rule applies in New Jersey and in New York, whatever
// a layer is called, and a game that adds layers later is picked up too.

const PROPS = {
  line: ['line-color'],
  fill: ['fill-color', 'fill-outline-color'],
  circle: ['circle-color', 'circle-stroke-color'],
  'fill-extrusion': ['fill-extrusion-color'],
};

// ink palettes: what each hue family becomes under each look
export const INKS = {
  paper: { red: '#e8452a', yellow: '#e8452a', green: '#1f6b3a', blue: '#2438a8', purple: '#14235e', dark: '#14235e', mid: '#2438a8', light: '#f2ea9c' },
  ps1: { red: '#ff8a4a', yellow: '#ffd54a', green: '#4dffb0', blue: '#3cc3e0', purple: '#9f8bff', dark: '#1b7088', mid: '#2aa8c4', light: '#04202c' },
};

let cx = null;
/** Any CSS colour string -> [r, g, b, a] (0-255, 0-1), or null if it is not a colour. */
function parse(s) {
  if (typeof s !== 'string' || !s || !(window.CSS && CSS.supports('color', s))) return null;
  cx = cx || document.createElement('canvas').getContext('2d');
  cx.fillStyle = '#000';
  cx.fillStyle = s;
  const v = cx.fillStyle;
  let m;
  if ((m = /^#([0-9a-f]{6})$/i.exec(v))) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  if ((m = /^rgba?\(([^)]+)\)$/.exec(v))) { const a = m[1].split(',').map(Number); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; }
  return null;
}

function family([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.14) return l > 0.78 ? 'light' : l < 0.3 ? 'dark' : 'mid';
  let h = 0;
  if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (l > 0.9) return 'light';
  if (h < 22 || h >= 335) return 'red';
  if (h < 44) return 'red';             // orange reads as the red ink
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 262) return 'blue';
  return 'purple';
}

const toCss = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return a >= 1 ? hex : `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${+a.toFixed(3)})`;
};

/** A paint value (a colour, or an expression containing colours) with every colour mapped to the look's inks. */
export function inkify(value, look) {
  const pal = INKS[look];
  const walk = (v) => {
    if (typeof v === 'string') {
      const c = parse(v);
      return c ? toCss(pal[family(c)], c[3]) : v;
    }
    if (Array.isArray(v)) return v.map(walk);
    return v;
  };
  return walk(value);
}

/**
 * Recolour every layer the look does not handle itself. `set` is the look's own saving setter (so turning the look off restores everything);
 * `skip(id)` says which layers are handled elsewhere; `done` is the set of layers already processed (colours are mapped once per layer).
 */
export function recolorOthers(map, look, set, skip, done) {
  for (const l of map.getStyle().layers) {
    if (done.has(l.id) || skip(l.id) || !PROPS[l.type]) continue;
    done.add(l.id);
    for (const prop of PROPS[l.type]) {
      const v = map.getPaintProperty(l.id, prop);
      if (v == null) continue;
      const nv = inkify(v, look);
      if (JSON.stringify(nv) !== JSON.stringify(v)) set(l.id, prop, nv);
    }
  }
}
