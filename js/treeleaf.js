// Leaf silhouettes for the 24 trees, drawn in code: solid shapes in one style, so the differences that matter (three lobes or five, toothed or
// smooth, V or U notches, rounded or bristle-tipped lobes, five leaflets or fifteen, needles in fives or threes) read at a glance, side by side.
// They are diagrams of the typical leaf, not portraits of one: lobe and leaflet counts checked against each species' Wikipedia article (November 2026); a field guide is still the authority.
// viewBox 0 0 100 120; the stalk at the bottom, the tip up.

const P = (pts) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
const rad = (d) => (d * Math.PI) / 180;

/** A hand-shaped (palmate) leaf from its lobes: [angle from straight up in degrees, length], how deep the notches go, whether lobes are
 *  pointed or round, and teeth along the edge. */
function palmate({ lobes, cx = 50, cy = 64, valley = 0.42, pointed = true, round = false, teeth = 0, toothDepth = 0.05, width = 26 }) {
  const pts = [];
  for (let k = 0; k < 720; k++) {
    const th = -180 + (k / 720) * 360;                 // angle from straight up, -180..180
    let r = 0;
    for (const [a, len] of lobes) {
      const x = (th - a) / width;
      const g = round ? Math.sqrt(Math.max(0, 1 - x * x)) : pointed ? Math.max(0, 1 - Math.abs(x)) ** 1.25 : Math.max(0, Math.cos(Math.min(Math.abs(x), 1) * Math.PI / 2));
      r = Math.max(r, len * (valley + (1 - valley) * g));
    }
    if (Math.abs(th) > 150) r *= Math.max(0.15, (180 - Math.abs(th)) / 30);   // the notch where the stalk joins
    if (teeth) r *= 1 - toothDepth * ((k * teeth / 720) % 1);                    // saw teeth
    pts.push([cx + r * Math.sin(rad(th)), cy - r * Math.cos(rad(th))]);
  }
  return P(pts);
}
/** A leaf with lobes down both sides (an oak's): the outline from the stalk to the tip, lobes rounded or bristle-pointed, cut `depth` deep. */
function pinnate({ n = 4, depth = 0.5, rounded = true, base = 108, tip = 8, maxW = 30, bristle = false }) {
  const L = [], R = [];
  const steps = 400;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, y = base - (base - tip) * t;
    const env = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.8 * maxW * (0.55 + 0.45 * Math.sin(Math.PI * t));
    const ph = (t * n + 0.25) % 1;
    const lobe = rounded ? Math.sqrt(Math.max(0, Math.sin(Math.PI * ph))) : Math.max(0, 1 - Math.abs(ph - 0.5) * 2) ** 0.7;
    const w = t < 0.06 ? env * 0.3 : env * (1 - depth + depth * lobe);
    L.push([50 - w, y]); R.push([50 + w, y]);
  }
  let d = P([...L, ...R.reverse()]);
  if (bristle) for (let k = 0; k < n; k++) {                 // a bristle at each lobe tip
    const t = (k + 0.25) / n; if (t > 0.95) continue;
    const y = base - (base - tip) * t, env = Math.sin(Math.PI * t) ** 0.8 * maxW * (0.55 + 0.45 * Math.sin(Math.PI * t));
    for (const s of [-1, 1]) d += `M${50 + s * env} ${y - 1.2}L${50 + s * (env + 5)} ${y - 3}L${50 + s * env} ${y + 1.2}Z`;
  }
  return d;
}
/** An undivided leaf: its outline (ovate, elliptic, lance, triangle, oval), its edge (smooth, fine teeth, coarse teeth, spines). */
function simple({ shape = 'elliptic', edge = 'smooth', cx = 50, base = 110, tip = 10, w = 26, rot = 0 }) {
  const pts = [], N = 300;
  const env = (t) => {
    if (shape === 'ovate') return Math.sin(Math.PI * t) ** 0.7 * (1.15 - 0.5 * t);
    if (shape === 'lance') return Math.sin(Math.PI * t) ** 0.9 * (1.05 - 0.45 * t);
    if (shape === 'triangle') return t < 0.3 ? (t / 0.3) ** 0.5 : (1 - t) / 0.7 * 0.95 + 0.05 * Math.sin(Math.PI * t);
    if (shape === 'oval') return Math.sin(Math.PI * t) ** 0.55;
    return Math.sin(Math.PI * t) ** 0.75;                     // elliptic
  };
  const side = (s) => {
    const out = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N; let ww = env(t) * w;
      if (edge === 'fine') ww *= 1 - 0.04 * ((i * 18 / N) % 1);
      if (edge === 'coarse') ww *= 1 - 0.09 * ((i * 10 / N) % 1);
      if (edge === 'spiny') ww *= 0.78 + 0.32 * Math.max(0, Math.sin(Math.PI * ((i * 5 / N) % 1))) ** 6;
      out.push([cx + s * ww, base - (base - tip) * t]);
    }
    return out;
  };
  const pts2 = [...side(-1), ...side(1).reverse()];
  const r = rad(rot), c = [cx, base];
  return P(pts2.map(([x, y]) => [c[0] + (x - c[0]) * Math.cos(r) - (y - c[1]) * Math.sin(r), c[1] + (x - c[0]) * Math.sin(r) + (y - c[1]) * Math.cos(r)]));
}
/** A compound leaf: a stalk with leaflets in pairs and one at the end. */
function compound({ pairs, leaf, size = 1, endBig = false, top = 6 }) {
  let d = '';
  const L = 112 - top;
  for (let i = 0; i < pairs; i++) {
    const t = 0.18 + (0.72 * i) / Math.max(1, pairs - 1), y = 112 - L * t;
    const sc = size * (endBig && i === pairs - 1 ? 1.35 : 1);
    for (const s of [-1, 1]) d += simple({ ...leaf, cx: 50, base: y, tip: y - 26 * sc, w: (leaf.w || 6) * sc, rot: s * 62 });
  }
  d += simple({ ...leaf, cx: 50, base: top + 30 * size * (endBig ? 1.35 : 1), tip: top, w: (leaf.w || 6) * size * (endBig ? 1.35 : 1) });
  return d;
}
const stalk = (y0 = 120, y1 = 100) => `M49 ${y0}L51 ${y0}L51 ${y1}L49 ${y1}Z`;

/** Veins and other light lines drawn over the solid leaf (a midrib, palmate veins, needle lines). */
const VEIN = {
  palm: (lobes, cx = 50, cy = 64) => lobes.map(([a, len]) => `M${cx} ${cy + 8}L${(cx + len * 0.85 * Math.sin(rad(a))).toFixed(1)} ${(cy - len * 0.85 * Math.cos(rad(a))).toFixed(1)}`).join(''),
  mid: (y0 = 108, y1 = 14) => `M50 ${y0}L50 ${y1}`,
};

/** A leaf built from lobes: each lobe a leaf shape from `at` (a point on the leaf), pointing `rot` degrees from straight up, `len` long,
 *  `w` wide, with its edge; plus a central body. The solid fills merge, so the notches between lobes come out as the gaps between them. */
const lobe = (at, rot, len, w, opts = {}) => simple({ shape: opts.shape || 'lance', edge: opts.edge || 'smooth', cx: at[0], base: at[1], tip: at[1] - len, w, rot });
const disc = (cx, cy, r) => { const pts = []; for (let k = 0; k < 48; k++) pts.push([cx + r * Math.cos((k / 48) * 2 * Math.PI), cy + r * Math.sin((k / 48) * 2 * Math.PI)]); return P(pts); };
const ray = (at, rot, len) => `M${at[0]} ${at[1]}L${(at[0] + len * Math.sin(rad(rot))).toFixed(1)} ${(at[1] - len * Math.cos(rad(rot))).toFixed(1)}`;
function oak({ pairs, body, lobeLen, lobeW, shape, edge, bristle, angle = 52 }) {
  let d = simple({ shape: 'lance', w: body, base: 108, tip: 10 }), v = VEIN.mid();
  for (let i = 0; i < pairs; i++) {
    const t = 0.22 + (0.62 * i) / (pairs - 1), y = 108 - 98 * t, len = lobeLen * Math.sin(Math.PI * (0.25 + 0.65 * t)) ** 0.6;
    for (const sd of [-1, 1]) {
      d += lobe([50, y], sd * angle, len, lobeW, { shape, edge });
      v += ray([50, y], sd * angle, len * 0.8);
      if (bristle) { const ex = 50 + len * Math.sin(rad(sd * angle)), ey = y - len * Math.cos(rad(sd * angle)); d += `M${ex.toFixed(1)} ${(ey - 1).toFixed(1)}L${(ex + 4 * Math.sin(rad(sd * angle))).toFixed(1)} ${(ey - 4 * Math.cos(rad(sd * angle))).toFixed(1)}L${(ex + 1).toFixed(1)} ${(ey + 1).toFixed(1)}Z`; }
    }
  }
  d += lobe([50, 34], 0, 26, lobeW * 0.9, { shape, edge });
  return { d, v };
}
function hand({ lobes, body, cy = 66, edge = 'smooth', shape = 'elliptic' }) {
  let d = disc(50, cy, body) + 'M49 120L51 120L51 70L49 70Z', v = '';
  for (const [rot, len, w, e] of lobes) { d += lobe([50, cy + 4], rot, len, w, { shape, edge: e || edge }); v += ray([50, cy + 4], rot, len * 0.85); }
  return { d, v };
}
const LEAVES = {
  // maples: leaves in pairs, a hand of lobes. Red: three lobes, toothed, V notches. Sugar: five, smooth, U notches. Norway: five, broad, few big teeth, wider than long.
  'red-maple': hand({ body: 14, lobes: [[0, 50, 15, 'coarse'], [-58, 42, 14, 'coarse'], [58, 42, 14, 'coarse'], [-118, 20, 8, 'coarse'], [118, 20, 8, 'coarse']], shape: 'ovate' }),
  'sugar-maple': hand({ body: 20, lobes: [[0, 50, 17], [-52, 46, 16], [52, 46, 16], [-108, 30, 12], [108, 30, 12]], shape: 'elliptic' }),
  'norway-maple': hand({ body: 22, cy: 64, lobes: [[0, 42, 18, 'coarse'], [-56, 46, 18, 'coarse'], [56, 46, 18, 'coarse'], [-112, 36, 14], [112, 36, 14]], shape: 'elliptic' }),
  // oaks: lobes down both sides. White: rounded lobes. Red: pointed, bristle-tipped, cut halfway. Pin: pointed, cut nearly to the midrib.
  'white-oak': oak({ pairs: 3, body: 11, lobeLen: 30, lobeW: 9, shape: 'oval', angle: 58 }),
  'red-oak': oak({ pairs: 4, body: 14, lobeLen: 28, lobeW: 8, shape: 'lance', bristle: true, angle: 54 }),
  'pin-oak': oak({ pairs: 3, body: 6, lobeLen: 38, lobeW: 6, shape: 'lance', bristle: true, angle: 62 }),
  // lobed but not oaks
  'tulip-tree': hand({ body: 21, cy: 66, lobes: [[-42, 36, 13], [42, 36, 13], [-98, 32, 12], [98, 32, 12]], shape: 'ovate' }),
  'sweetgum': hand({ body: 12, lobes: [[0, 50, 9, 'fine'], [-72, 44, 9, 'fine'], [72, 44, 9, 'fine'], [-140, 30, 8, 'fine'], [140, 30, 8, 'fine']], shape: 'lance' }),
  'sycamore': hand({ body: 30, cy: 62, lobes: [[0, 44, 20, 'coarse'], [-58, 40, 20, 'coarse'], [58, 40, 20, 'coarse'], [-112, 28, 14, 'coarse'], [112, 28, 14, 'coarse']], shape: 'ovate', edge: 'coarse' }),
  'sassafras': { d: simple({ shape: 'oval', w: 22, tip: 16 }) + lobe([46, 86], -40, 52, 12, { shape: 'elliptic' }), v: VEIN.mid(108, 20) + ray([46, 86], -40, 44) },
  // plain leaves
  'beech': { d: simple({ shape: 'elliptic', edge: 'coarse', w: 24 }), v: VEIN.mid() + Array.from({ length: 10 }, (_, i) => { const y = 98 - i * 8.4; return `M50 ${y}L28 ${y - 10}M50 ${y}L72 ${y - 10}`; }).join('') },
  'black-cherry': { d: simple({ shape: 'lance', edge: 'fine', w: 18 }), v: VEIN.mid() },
  'gray-birch': { d: simple({ shape: 'triangle', edge: 'coarse', w: 34, tip: 6, base: 100 }) + stalk(120, 98), v: VEIN.mid(98, 14) },
  // compound leaves
  'black-locust': { d: compound({ pairs: 5, leaf: { shape: 'oval', w: 7 }, size: 0.75 }) + stalk(), v: VEIN.mid(118, 8) },
  'tree-of-heaven': { d: compound({ pairs: 6, leaf: { shape: 'lance', w: 6 }, size: 0.95, top: 2 }) + stalk(), v: VEIN.mid(118, 4) },
  'shagbark-hickory': { d: lobe([50, 96], -62, 30, 9, { shape: 'elliptic', edge: 'fine' }) + lobe([50, 96], 62, 30, 9, { shape: 'elliptic', edge: 'fine' }) + lobe([50, 62], -55, 42, 12, { shape: 'elliptic', edge: 'fine' }) + lobe([50, 62], 55, 42, 12, { shape: 'elliptic', edge: 'fine' }) + lobe([50, 56], 0, 52, 13, { shape: 'elliptic', edge: 'fine' }) + stalk(120, 56), v: VEIN.mid(118, 8) },
  'black-walnut': { d: compound({ pairs: 8, leaf: { shape: 'lance', edge: 'fine', w: 5 }, size: 0.8, top: 4 }) + stalk(), v: VEIN.mid(118, 6) },
  // pairs, not lobed
  'dogwood': { d: simple({ shape: 'oval', w: 25, tip: 14 }), v: VEIN.mid(108, 18) + [0, 1, 2, 3].map((i) => { const y = 98 - i * 17; return [-1, 1].map((sd) => `M50 ${y}C${50 + sd * 14} ${y - 4} ${50 + sd * 20} ${y - 20} ${50 + sd * (17 - i * 3)} ${y - 38}`).join(''); }).join('') },
  // evergreen broad leaf
  'holly': { d: simple({ shape: 'elliptic', edge: 'spiny', w: 26, tip: 12 }), v: VEIN.mid(108, 16) },
};
// needles and scales: drawn as strokes, not solid shapes
const NEEDLES = {
  'white-pine': { n: 5, len: 78, stiff: false }, 'pitch-pine': { n: 3, len: 52, stiff: true },
};
function needleSvg(id) {
  if (id === 'hemlock') {
    let s = '<path d="M50 116L50 10" class="lf-twig"/>';
    for (let i = 0; i < 14; i++) { const y = 104 - i * 6.6; for (const sd of [-1, 1]) s += `<path d="M50 ${y}l${sd * 15} ${-3}" class="lf-ndl flat"/>`; }
    return s;
  }
  if (id === 'red-cedar' || id === 'white-cedar') {
    const flat = id === 'white-cedar';
    let s = '<path d="M50 118L50 20" class="lf-twig"/>';
    const sprays = flat ? [[-50, 92, 30], [50, 92, 30], [-45, 64, 26], [45, 64, 26], [-35, 40, 20], [35, 40, 20], [0, 22, 18]] : [[-35, 92, 26], [35, 88, 26], [-30, 66, 22], [30, 62, 22], [-22, 42, 18], [22, 40, 18], [0, 24, 16]];
    for (const [a, y, len] of sprays) {
      const ex = 50 + len * Math.sin(rad(a)), ey = y - len * Math.cos(rad(a));
      s += `<path d="M50 ${y}L${ex.toFixed(1)} ${ey.toFixed(1)}" class="lf-scale${flat ? ' flat' : ''}"/>`;
      if (!flat) s += `<path d="M${ex.toFixed(1)} ${ey.toFixed(1)}l${(3 * Math.sin(rad(a))).toFixed(1)} -4" class="lf-ndl"/>`;
    }
    return s;
  }
  const { n, len, stiff } = NEEDLES[id];
  let s = '<path d="M50 118L50 96" class="lf-twig"/>';
  for (let i = 0; i < n; i++) {
    const a = -24 + (48 * i) / (n - 1), ex = 50 + len * Math.sin(rad(a)), ey = 96 - len * Math.cos(rad(a));
    s += stiff ? `<path d="M50 96L${ex.toFixed(1)} ${ey.toFixed(1)}" class="lf-ndl stiff"/>` : `<path d="M50 96Q${(50 + (ex - 50) * 0.4 + (i - 2) * 3).toFixed(1)} ${(96 - len * 0.55).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" class="lf-ndl"/>`;
  }
  return s;
}

let uid = 0;
/** The leaf diagram of a tree as an inline SVG. */
export function leafSvg(id, cls = '') {
  const L = LEAVES[id];
  const cid = 'lfc-' + id + '-' + (++uid);
  const body = L ? `<defs><clipPath id="${cid}"><path d="${L.d}"/></clipPath></defs><path d="${L.d}" class="lf-fill"/>${L.v ? `<path d="${L.v}" class="lf-vein" clip-path="url(#${cid})"/>` : ''}<path d="M49 120L51 120L51.5 104L48.5 104Z" class="lf-fill"/>` : needleSvg(id);
  return `<svg viewBox="0 0 100 120" class="leafsvg ${cls}" aria-hidden="true">${body}</svg>`;
}
export const HAS_LEAF = (id) => !!LEAVES[id] || id in NEEDLES || ['hemlock', 'red-cedar', 'white-cedar'].includes(id);

/** A sketch of a twig of this tree with its leaves set on it the way they grow: in pairs ('opposite') or one at a time ('alternate'), with
 *  a small bud where each leaf's stalk meets the twig (the bud is what marks a whole leaf, not a leaflet). `n` is how many leaves (alternate)
 *  or pairs (opposite) to draw. Broad-leaved trees only. */
export function twigSvg(id, { arr = 'alternate', n, cls = '' } = {}) {
  const L = LEAVES[id];
  if (!L) return leafSvg(id, cls);
  const compound = ['black-locust', 'tree-of-heaven', 'shagbark-hickory', 'black-walnut'].includes(id);
  const opp = arr === 'opposite';
  const k = n || (opp ? 3 : compound ? 2 : 4);
  const W = compound ? 250 : 160, X = W / 2, s = compound ? 0.92 : opp ? 0.58 : 0.52, cid = 'tw-' + id + '-' + (++uid);
  const top = 22, bottom = 214, span = bottom - top - (compound ? 70 : 30);
  const nodes = Array.from({ length: k }, (_, i) => bottom - 14 - (span * i) / Math.max(1, k - (opp ? 1 : compound ? 1 : 0.6)));
  const leafAt = (x, y, a) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s}) translate(-50 -120)"><path d="${L.d}" class="lf-fill"/>${L.v ? `<path d="${L.v}" class="lf-vein" clip-path="url(#${cid})"/>` : ''}<path d="M49 122L51 122L51.5 100L48.5 100Z" class="lf-fill"/></g>`;
  const bud = (x, y, a) => `<ellipse cx="0" cy="-5" rx="3.6" ry="6.2" class="lf-bud" transform="translate(${x} ${y}) rotate(${a})"/>`;
  let leaves = '', buds = '';
  nodes.forEach((y, i) => {
    const sides = opp ? [-1, 1] : [i % 2 ? 1 : -1];
    const a = compound ? 64 : 54;
    for (const sd of sides) { leaves += leafAt(X + sd * 2, y, sd * a); buds += bud(X + sd * 2.5, y - 3, sd * 22); }
  });
  return `<svg viewBox="0 0 ${W} 230" class="leafsvg twigsvg ${cls}" aria-hidden="true"><defs><clipPath id="${cid}" clipPathUnits="userSpaceOnUse"><path d="${L.d}"/></clipPath></defs>
    <path d="M${X - 2.5} ${bottom + 12}L${X + 2.5} ${bottom + 12}L${X + 1} ${top}L${X - 1} ${top}Z" class="lf-stem"/>${leaves}${buds}${bud(X, top + 4, 0)}</svg>`;
}
