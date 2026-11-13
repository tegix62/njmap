// The game toolbar: the chips beside the game's name in the shared header (one row for every game).
//
// A game says which chips it wants for as long as it runs; the header draws them next to the look chip, so a game never needs a row of its own for
// controls (they cost vertical space on a phone).
//   ctx.toolbar.set([{ id: 'spin', label: '↻ Orbit', pressed: true, title: 'Camera circles by itself', onClick: () => … }])
//   ctx.toolbar.clear()
// The header calls html() when it builds and bind() right after it is in the page.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createToolbar() {
  let items = [];
  return {
    set(list) { items = list || []; },
    clear() { items = []; },
    html() {
      return items.map((c) => `<button type="button" class="chip toggle tb" data-tb="${esc(c.id)}" aria-pressed="${!!c.pressed}"${c.title ? ` title="${esc(c.title)}"` : ''}>${esc(c.label)}</button>`).join('');
    },
    bind(root = document) {
      for (const c of items) root.querySelector(`[data-tb="${c.id}"]`)?.addEventListener('click', c.onClick);
    },
  };
}
