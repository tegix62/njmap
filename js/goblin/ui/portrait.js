// Captain portraits, drawn in code (D59, D108, D196): three heads, three hats, three weapons, injury layers and three expressions, chosen from the captain's id
// so the same captain always looks the same. Placeholder art: the files can be swapped for the user's own later. No assets, no per-frame work.
const SKIN = { goblin: '#7fb069', rat: '#a8927a', toad: '#6a9f7a', gnome: '#d9a07a', dwarf: '#c08a5a' };
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const INK = '#1f2937';

const HEADS = [
  (c) => `<path d="M6 24 L12 8 L19 15 Q28 12 37 15 L44 8 L50 24 Q54 44 28 52 Q2 44 6 24Z" fill="${c}" stroke="${INK}" stroke-width="2"/>`,                       // pointed ears
  (c) => `<path d="M8 26 Q6 12 16 12 Q28 6 40 12 Q50 12 48 26 Q50 46 28 52 Q6 46 8 26Z" fill="${c}" stroke="${INK}" stroke-width="2"/><circle cx="9" cy="26" r="4" fill="${c}" stroke="${INK}" stroke-width="2"/><circle cx="47" cy="26" r="4" fill="${c}" stroke="${INK}" stroke-width="2"/>`,   // round, side ears
  (c) => `<path d="M10 22 L14 10 L22 16 L34 16 L42 10 L46 22 Q52 40 28 51 Q4 40 10 22Z" fill="${c}" stroke="${INK}" stroke-width="2"/>`,                              // broad, short ears
];
const HATS = [
  () => '',                                                                                                                                                  // bare
  () => `<path d="M12 18 Q28 0 44 18 Z" fill="#8b5a2b" stroke="${INK}" stroke-width="2"/><path d="M10 18 H46" stroke="${INK}" stroke-width="2.4"/>`,                  // cap
  () => `<path d="M11 20 Q28 -2 45 20 L45 24 H11Z" fill="#9ca3af" stroke="${INK}" stroke-width="2"/><path d="M28 3 V10" stroke="${INK}" stroke-width="2.4"/>`,         // helm
];
const WEAPONS = [
  () => `<path d="M52 56 L52 14" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/><path d="M52 8 L49 16 H55Z" fill="#9ca3af" stroke="${INK}" stroke-width="1.4"/>`,   // spear
  () => `<path d="M52 56 L52 18" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/><path d="M52 16 Q44 14 44 24 Q50 24 52 22Z" fill="#9ca3af" stroke="${INK}" stroke-width="1.4"/>`, // axe
  () => `<path d="M52 56 L52 20" stroke="#6b4423" stroke-width="4" stroke-linecap="round"/><circle cx="52" cy="17" r="5" fill="#6b4423" stroke="${INK}" stroke-width="1.4"/>`,   // club
];
const INJURY = {   // layers drawn over the face; ids are the content file's injuries
  scar: `<path d="M34 26 L42 40" stroke="#7f1d1d" stroke-width="2.2" stroke-linecap="round"/><path d="M36 30 l3 -1 M38 34 l3 -1" stroke="#7f1d1d" stroke-width="1.4"/>`,
  'lost-ear': `<path d="M44 8 L50 24 L44 22 Z" fill="#f3f4f6" stroke="${INK}" stroke-width="1.6"/>`,
  limp: `<path d="M6 54 L16 38" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/><path d="M4 55 H10" stroke="#6b4423" stroke-width="3"/>`,
  'lost-eye': `<path d="M32 22 H46" stroke="${INK}" stroke-width="3"/><ellipse cx="38" cy="26" rx="6" ry="5" fill="${INK}"/>`,
  burn: `<path d="M12 30 Q16 24 20 30 Q18 38 12 36Z" fill="#92400e" opacity="0.75"/><path d="M14 32 q2 -3 4 0" stroke="#fbbf24" stroke-width="1.2" fill="none"/>`,
};
const EXPR = {
  steady: { brow: '', eyes: `<circle cx="20" cy="30" r="2.6"/><circle cx="36" cy="30" r="2.6"/>`, mouth: `<path d="M21 42 H35" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` },
  grim: { brow: `<path d="M14 24 L24 28 M42 24 L32 28" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`, eyes: `<circle cx="20" cy="31" r="2.4"/><circle cx="36" cy="31" r="2.4"/>`, mouth: `<path d="M20 44 Q28 38 36 44" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` },
  shaken: { brow: `<path d="M15 26 L24 24 M41 26 L32 24" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`, eyes: `<circle cx="20" cy="31" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="36" cy="31" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="21" cy="31" r="1.2"/><circle cx="35" cy="31" r="1.2"/>`, mouth: `<path d="M21 44 Q24 40 28 43 Q32 46 35 42" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` },
};

/** The expression a captain's state and injuries call for: shaken when Humiliated or beaten down, grim when hurt, steady otherwise. */
export function expressionFor(c) { return c.state === 'humiliated' || c.state === 'shaken' ? 'shaken' : (c.injuries && c.injuries.length) ? 'grim' : 'steady'; }

export function portrait(c, kind = 'goblin', expression = null, size = 56) {
  const h = hash(c.id);
  const ex = EXPR[expression || expressionFor(c)] || EXPR.steady;
  const inj = (c.injuries || []).map((i) => INJURY[i] || '').join('');
  return `<svg class="portrait" viewBox="0 0 60 60" width="${size}" height="${size}" role="img" aria-label="${String(c.name).replace(/[<>"&]/g, '')}">` +
    WEAPONS[(h >>> 3) % 3]() + HEADS[h % 3](SKIN[kind] || SKIN.goblin) + HATS[(h >>> 6) % 3]() + `<g fill="${INK}">${ex.eyes}</g>${ex.brow}${ex.mouth}${inj}</svg>`;
}
export const PORTRAIT_PARTS = Object.freeze({ heads: HEADS.length, hats: HATS.length, weapons: WEAPONS.length, injuries: Object.keys(INJURY), expressions: Object.keys(EXPR) });

/** Dice as theatre (D100): glyph dice that tumble briefly and settle. The numbers are real; the motion is CSS and stops by itself (no render loop). */
const FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
export const dice = (values, cls = '') => `<span class="dice ${cls}">${values.map((v, i) => `<i style="animation-delay:${i * 70}ms" aria-label="${v}">${FACE[v] || v}</i>`).join('')}</span>`;
