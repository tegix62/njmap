// Shared pieces of the question UI, used by every game (Practice, Name that place, the grid games).
// Markup only: the look comes from the classes in css/app.css (.choices/.choice, .hint, .where, .fb),
// which follow the active theme, so a change there reaches every game at once.

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * A grid of answer buttons.
 *   items    the options
 *   o.label  (item) → text (plain; escaped here)
 *   o.data   (item, i) → value of the button's data-* attribute
 *   o.attr   name of that attribute (default 'id')
 *   o.state  (item) → '' | 'right' | 'wrong' | 'close'
 *   o.html   (item) → ready-made inner HTML (instead of label), e.g. with a swatch
 *   o.off    disable every button
 *   o.cls    extra class on the grid (e.g. 'three')
 */
export function choicesHtml(items, o = {}) {
  const attr = o.attr || 'id';
  return `<div class="choices${o.cls ? ' ' + o.cls : ''}">${items.map((it, i) => {
    const st = o.state ? o.state(it) : '';
    return `<button class="choice${st ? ' ' + st : ''}" data-${attr}="${esc(o.data ? o.data(it, i) : i)}"${o.off ? ' disabled' : ''}>${o.html ? o.html(it) : esc(o.label(it))}</button>`;
  }).join('')}</div>`;
}

/** Hint lines, "where it is" line, in the same classes everywhere. */
export const hintsHtml = (lines) => lines.map((h) => `<div class="hint">${h}</div>`).join('');
export const whereHtml = (text) => (text ? `<div class="where">📍 ${esc(text)}</div>` : '');
