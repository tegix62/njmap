// Leaf pictures for the trees. Broad leaves: outlines traced from real photos (tools/trace_leaves.py -> js/treeoutlines.js, each with its photo's
// credit), drawn as solid shapes in one style. A broad-leaved tree with no traced outline gets none here (the screens show a photo of its leaf
// instead): the earlier shapes drawn from memory were not accurate and are gone. Needles and scales are simple stroke diagrams (needles in fives,
// threes or one by one; scale sprays), counts checked against Wikipedia.
// viewBox 0 0 100 120; the stalk at the bottom, the tip up.
import { OUTLINES } from './treeoutlines.js';

const rad = (d) => (d * Math.PI) / 180;
const NEEDLE_IDS = ['white-pine', 'pitch-pine', 'hemlock', 'red-cedar', 'white-cedar'];

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
/** The leaf picture of a tree as an inline SVG, or '' when there is no accurate one. */
export function leafSvg(id, cls = '') {
  const L = OUTLINES[id];
  if (L) return `<svg viewBox="0 0 100 120" class="leafsvg ${cls}" aria-hidden="true"><path d="${L.d}" class="lf-fill"/></svg>`;
  if (NEEDLE_IDS.includes(id)) return `<svg viewBox="0 0 100 120" class="leafsvg ${cls}" aria-hidden="true">${needleSvg(id)}</svg>`;
  return '';
}
/** Whether a tree has an accurate leaf picture (a traced outline, or a needle/scale diagram). */
export const HAS_LEAF = (id) => !!OUTLINES[id] || NEEDLE_IDS.includes(id);
export const HAS_OUTLINE = (id) => !!OUTLINES[id];
/** The photo a traced outline came from, for its credit. */
export const outlineSource = (id) => OUTLINES[id] || null;

export function twigSvg(id, { arr = 'alternate', n, cls = '' } = {}) {
  const L = OUTLINES[id];
  if (!L) return '';
  const compound = ['black-locust', 'tree-of-heaven', 'shagbark-hickory', 'black-walnut'].includes(id);
  const opp = arr === 'opposite';
  const k = n || (opp ? 3 : compound ? 2 : 4);
  const W = compound ? 250 : 160, X = W / 2, s = compound ? 0.92 : opp ? 0.58 : 0.52, cid = 'tw-' + id + '-' + (++uid);
  const top = 22, bottom = 214, span = bottom - top - (compound ? 70 : 30);
  const nodes = Array.from({ length: k }, (_, i) => bottom - 14 - (span * i) / Math.max(1, k - (opp ? 1 : compound ? 1 : 0.6)));
  const leafAt = (x, y, a) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s}) translate(-50 -120)"><path d="${L.d}" class="lf-fill"/><path d="M49 122L51 122L51.5 100L48.5 100Z" class="lf-fill"/></g>`;
  const bud = (x, y, a) => `<ellipse cx="0" cy="-5" rx="3.6" ry="6.2" class="lf-bud" transform="translate(${x} ${y}) rotate(${a})"/>`;
  let leaves = '', buds = '';
  nodes.forEach((y, i) => {
    const sides = opp ? [-1, 1] : [i % 2 ? 1 : -1];
    const a = compound ? 64 : 54;
    for (const sd of sides) { leaves += leafAt(X + sd * 2, y, sd * a); buds += bud(X + sd * 2.5, y - 3, sd * 22); }
  });
  return `<svg viewBox="0 0 ${W} 230" class="leafsvg twigsvg ${cls}" aria-hidden="true"><path d="M${X - 2.5} ${bottom + 12}L${X + 2.5} ${bottom + 12}L${X + 1} ${top}L${X - 1} ${top}Z" class="lf-stem"/>${leaves}${buds}${bud(X, top + 4, 0)}</svg>`;
}
