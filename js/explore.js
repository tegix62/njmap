import { bearing, compass8, ARROWS } from './geo.js';

// Explore: tap any town (or search) to see its county, its neighbors and
// which direction each neighbor lies in.
export function initExplore(ctx) {
  const { map } = ctx;
  let sel = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // datalist for search
  const list = document.createElement('datalist');
  list.id = 'townlist';
  const sorted = [...ctx.munis].sort((a, b) => a.n.localeCompare(b.n));
  const byOption = new Map();
  for (const m of sorted) {
    const label = `${m.full}, ${m.c} County`;
    byOption.set(label.toLowerCase(), m);
    const o = document.createElement('option');
    o.value = label;
    list.appendChild(o);
  }
  document.body.appendChild(list);

  function onClick(e) {
    if (ctx.mode !== 'explore') return;
    const m = ctx.locate([e.lngLat.lng, e.lngLat.lat]);
    select(m, false);
  }
  map.on('click', onClick);

  function select(m, fly = true) {
    if (sel) ctx.highlight(sel.id, null);
    sel = m;
    if (m) {
      ctx.highlight(m.id, 'sel');
      if (fly) ctx.fit([m], 13);
    }
    render();
  }

  function render() {
    const search = `<input id="search" type="search" list="townlist" placeholder="Search a town…" autocomplete="off" enterkeyhint="go">`;
    if (!sel) {
      ctx.hud(`${search}<div class="meta">Tap anywhere on the map to see which town it is, its county, and which way its neighbors are.</div>`);
    } else {
      const m = sel;
      const from = ctx.pos ? ctx.relative(ctx.pos.pt, m.pt) : null;
      const groups = ctx.confusables.byId.get(m.id) || [];
      const twins = [...new Set(groups.flatMap((g) => g.members))].filter((o) => o !== m);
      const nb = [...m.neighbors]
        .map((o) => ({ o, b: bearing(m.pt, o.pt) }))
        .sort((a, b) => a.b - b.b)
        .map(({ o, b }) => `<button class="chip" data-id="${o.id}"><span class="arr">${ARROWS[compass8(b)]}</span>${compass8(b)} ${esc(ctx.name(o))}</button>`)
        .join('');
      const tw = twins
        .slice(0, 8)
        .map((o) => `<button class="chip twin" data-id="${o.id}">${esc(ctx.name(o))} <span class="muted">${ctx.relative(m.pt, o.pt).text}</span></button>`)
        .join('');
      ctx.hud(
        `${search}
         <div class="town">${esc(m.n)}</div>
         <div class="meta">${esc(m.t)} · <b>${esc(m.c)} County</b> · pop. ${m.p.toLocaleString()} (2010)${from ? ` · ${from.text} of you` : ''}</div>
         <div class="label-sm">Borders (direction from ${esc(m.n)})</div><div class="chips">${nb || '<span class="muted">none</span>'}</div>
         ${tw ? `<div class="label-sm">Don't mix up with</div><div class="chips">${tw}</div>` : ''}`
      );
    }
    const input = document.getElementById('search');
    input.addEventListener('change', () => {
      const m = byOption.get(input.value.trim().toLowerCase());
      if (m) {
        input.blur();
        select(m);
      }
    });
    for (const b of document.querySelectorAll('#hud .chip')) b.addEventListener('click', () => select(ctx.munis[+b.dataset.id]));
  }

  return {
    enter() {
      ctx.showLabels(true);
      ctx.sheet('');
      ctx.reveal([]);
      ctx.line(null);
      ctx.clearHighlights();
      if (!sel && ctx.modes.drive.current) sel = ctx.modes.drive.current;
      if (sel) ctx.highlight(sel.id, 'sel');
      render();
    },
    leave() {
      ctx.clearHighlights();
    },
    select,
  };
}
