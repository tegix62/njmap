import { bearing, compass8, ARROWS } from './geo.js';

const SECTIONS_SHOWN = 10;

// Explore: tap any town (or search, including village names like "Towaco")
// to see its county, its villages/sections, its neighbors and which direction
// each neighbor lies in.
export function initExplore(ctx) {
  const { map } = ctx;
  let sel = null;
  let showAllSections = false;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // datalist for search: municipalities, then villages/sections
  const list = document.createElement('datalist');
  list.id = 'townlist';
  const byOption = new Map();
  const addOption = (label, value) => {
    byOption.set(label.toLowerCase(), value);
    const o = document.createElement('option');
    o.value = label;
    list.appendChild(o);
  };
  for (const m of [...ctx.munis].sort((a, b) => a.n.localeCompare(b.n))) addOption(`${m.full}, ${m.c} County`, { m });
  const secOpts = [];
  for (const m of ctx.munis)
    for (const s of m.sections) secOpts.push([`${s.name} — part of ${m.full}, ${m.c} Co.`, { m, section: s.name }]);
  secOpts.sort((a, b) => a[0].localeCompare(b[0])).forEach(([label, v]) => addOption(label, v));
  document.body.appendChild(list);

  map.on('click', (e) => {
    if (ctx.mode !== 'explore') return;
    select(ctx.locate([e.lngLat.lng, e.lngLat.lat]), false);
  });

  function select(m, fly = true) {
    if (sel) ctx.highlight(sel.id, null);
    if (m !== sel) showAllSections = false;
    sel = m;
    ctx.reveal([]);
    if (m) {
      ctx.highlight(m.id, 'sel');
      if (fly) ctx.fit([m], 13);
    }
    render();
  }

  /** Put a section's name on the map, if the background tiles know where it is. */
  function showSection(m, name) {
    const tryFind = () => {
      const hit = ctx.placedSections(m).get(name.toLowerCase());
      if (hit) {
        ctx.reveal([{ m, pt: hit.pt, label: hit.name, color: '#3730a3' }]);
        const pad = ctx.padding();
        map.easeTo({
          center: hit.pt,
          zoom: Math.max(map.getZoom(), 13.5),
          offset: [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2],
          duration: 600,
        });
      }
      return !!hit;
    };
    if (tryFind()) return;
    const giveUp = () => ctx.toast(`${name} is part of ${m.n}, but the map data doesn't pin down exactly where.`);
    if (!map.isMoving() && map.areTilesLoaded()) return giveUp();
    // Tiles for the area may still be loading after a fly-to.
    map.once('idle', () => {
      if (sel === m && !tryFind()) giveUp();
    });
  }

  function render() {
    const search = `<input id="search" type="search" list="townlist" placeholder="Search a town or village…" autocomplete="off" enterkeyhint="go">`;
    if (!sel) {
      ctx.hud(
        `${search}<div class="meta">Tap anywhere on the map to see which town it is, its county, its villages and sections, and which way its neighbors are. Search works for villages too (try "Towaco").</div>`
      );
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
      const secs = showAllSections ? m.sections : m.sections.slice(0, SECTIONS_SHOWN);
      const more = m.sections.length - secs.length;
      const sec =
        secs
          .map((s) => `<button class="chip sec${s.known ? ' known' : ''}" data-sec="${esc(s.name)}">${esc(s.name)}</button>`)
          .join('') + (more > 0 ? `<button class="chip more" id="moreSec">+${more} more</button>` : '');
      ctx.hud(
        `${search}
         <div class="town">${esc(m.n)}</div>
         <div class="meta">${esc(m.t)} · <b>${esc(m.c)} County</b> · pop. ${m.p.toLocaleString()} (2010)${from ? ` · ${from.text} of you` : ''}</div>
         ${m.sections.length ? `<div class="label-sm">Villages &amp; sections inside ${esc(m.n)}</div><div class="chips">${sec}</div>` : ''}
         <div class="label-sm">Borders (direction from ${esc(m.n)})</div><div class="chips">${nb || '<span class="muted">none</span>'}</div>
         ${tw ? `<div class="label-sm">Don't mix up with</div><div class="chips">${tw}</div>` : ''}`
      );
    }
    const input = document.getElementById('search');
    input.addEventListener('change', () => {
      const hit = byOption.get(input.value.trim().toLowerCase());
      if (!hit) return;
      input.blur();
      select(hit.m);
      if (hit.section) {
        ctx.toast(`${hit.section} is part of ${hit.m.full}, ${hit.m.c} County`);
        showSection(hit.m, hit.section);
      }
    });
    for (const b of document.querySelectorAll('#hud .chip[data-id]')) b.addEventListener('click', () => select(ctx.munis[+b.dataset.id]));
    for (const b of document.querySelectorAll('#hud .chip[data-sec]')) b.addEventListener('click', () => showSection(sel, b.dataset.sec));
    const moreBtn = document.getElementById('moreSec');
    if (moreBtn)
      moreBtn.addEventListener('click', () => {
        showAllSections = true;
        render();
      });
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
