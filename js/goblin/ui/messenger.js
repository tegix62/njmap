// The messenger (D120, D121): a small, scared goblin whose face carries the news. Placeholder art drawn in code (D59, D196): four expressions, no assets.
const FACES = {
  cheerful: { brow: '', eyes: '<circle cx="14" cy="17" r="2.2"/><circle cx="26" cy="17" r="2.2"/>', mouth: '<path d="M12 26 Q20 33 28 26" stroke="#1f2937" stroke-width="2.4" fill="none" stroke-linecap="round"/>' },
  steady: { brow: '', eyes: '<circle cx="14" cy="17" r="2.2"/><circle cx="26" cy="17" r="2.2"/>', mouth: '<path d="M13 28 H27" stroke="#1f2937" stroke-width="2.4" fill="none" stroke-linecap="round"/>' },
  nervous: { brow: '<path d="M9 11 L18 14 M31 11 L22 14" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>', eyes: '<circle cx="14" cy="18" r="2.4"/><circle cx="26" cy="18" r="2.4"/>', mouth: '<path d="M13 30 Q16 26 20 29 Q24 32 27 28" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>' },
  frantic: { brow: '<path d="M8 10 L17 14 M32 10 L23 14" stroke="#1f2937" stroke-width="2.4" stroke-linecap="round"/>', eyes: '<circle cx="14" cy="18" r="3.6" fill="#fff" stroke="#1f2937" stroke-width="1.6"/><circle cx="26" cy="18" r="3.6" fill="#fff" stroke="#1f2937" stroke-width="1.6"/><circle cx="14" cy="18" r="1.3"/><circle cx="26" cy="18" r="1.3"/>', mouth: '<ellipse cx="20" cy="30" rx="4.2" ry="3.6" fill="#1f2937"/>' },
};
export function messengerFace(mood) {
  const f = FACES[mood] || FACES.steady;
  return `<svg class="mface" viewBox="0 0 40 40" width="44" height="44" aria-hidden="true"><path d="M4 18 L10 4 L16 11 Q20 9 24 11 L30 4 L36 18 Q38 32 20 37 Q2 32 4 18Z" fill="#7fb069" stroke="#1f2937" stroke-width="2"/><g fill="#1f2937">${f.eyes}</g>${f.brow}${f.mouth}</svg>`;
}
