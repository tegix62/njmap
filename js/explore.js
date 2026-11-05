import { bearing, compass8, ARROWS } from './geo.js';
import { roadsInTown, roadsFrom, draftNote, countyNum, byName } from './roads.js';
import { editNote } from './notes.js';

let L; // label colors of the active theme (set in initExplore)

// Explore: tap any town (or search, including village names like "Towaco").
//
// Layer 1 (glance): name and county; the map itself shows the neighbors
// (tinted, labels solid, everything else faded), so the card stays short.
// Layer 2 (one tap): Borders · Villages · Roads · Landmarks · Notes ·
// Sound-alikes, one at a time.


export function initExplore(ctx) {
  const { map } = ctx;
  L = ctx.theme.label;
  let sel = null;
  let tab = null; // which detail panel is open
  let showAllSections = false;
  let roadSel = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const landmarksByTown = new Map();
  for (const l of ctx.landmarks) {
    if (!landmarksByTown.has(l.m.id)) landmarksByTown.set(l.m.id, []);
    landmarksByTown.get(l.m.id).push(l);
  }

  // datalist for search: municipalities, villages/sections, landmarks
  const list = document.createElement('datalist');
  list.id = 'townlist';
  const byOption = new Map();
  const addOption = (label, value) => {
    byOption.set(label.toLowerCase(), value);
    const o = document.createElement('option');
    o.value = label;
    list.appendChild(o);
  };
  for (const m of [...ctx.munis].sort((a, b) => a.n.localeCompare(b.n))) addOption(`${m.full}, ${ctx.groupName(m.c)}`, { m });
  const extra = [];
  for (const m of ctx.munis) for (const s of m.sections) extra.push([`${s.name} — part of ${m.full}, ${m.c} Co.`, { m, section: s.name }]);
  for (const l of ctx.landmarks) extra.push([`${l.name} — ${l.m.n}`, { m: l.m, landmark: l }]);
  extra.sort((a, b) => a[0].localeCompare(b[0])).forEach(([label, v]) => addOption(label, v));
  document.body.appendChild(list);

  map.on('click', (e) => {
    if (ctx.mode !== 'explore' || e.handledByAnchor) return;
    const m = ctx.locate([e.lngLat.lng, e.lngLat.lat]);
    select(m, m && m !== sel && !comfortablyInView(m));
  });

  /**
   * Snap to a tapped town and its neighbors only when they aren't already
   * comfortably on screen, so free looking around isn't interrupted.
   */
  function comfortablyInView(m) {
    const group = [m, ...m.neighbors];
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const o of group) {
      b[0] = Math.min(b[0], o.bbox[0]);
      b[1] = Math.min(b[1], o.bbox[1]);
      b[2] = Math.max(b[2], o.bbox[2]);
      b[3] = Math.max(b[3], o.bbox[3]);
    }
    // the part of the screen not covered by the card or the tab bar
    const pad = ctx.padding();
    const W = map.getContainer().clientWidth;
    const H = map.getContainer().clientHeight;
    const tl = map.unproject([pad.left, pad.top]);
    const br = map.unproject([W - pad.right, H - pad.bottom]);
    const inside = b[0] >= tl.lng && b[2] <= br.lng && b[3] <= tl.lat && b[1] >= br.lat;
    if (!inside) return false;
    // ...and not so small that it's hard to read
    const cam = map.cameraForBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad, maxZoom: 13 });
    return !cam || map.getZoom() >= cam.zoom - 1.5;
  }

  function select(m, fly = true) {
    natSel = null;
    if (hwySel) {
      hwySel = null;
      ctx.focusRoad(null);
    }
    if (sel) ctx.highlight(sel.id, null);
    if (m !== sel) {
      showAllSections = false;
      roadSel = null;
      ctx.focusRoad(null);
    }
    sel = m;
    ctx.reveal([]);
    ctx.focus(m);
    if (m) ctx.highlight(m.id, 'sel');
    render();
    // frame after the card has its new height
    if (m && fly) requestAnimationFrame(() => ctx.fit([m, ...m.neighbors], 13));
  }

  const offset = () => {
    const pad = ctx.padding();
    return [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2];
  };

  /** Put a section's name on the map, if the background tiles know where it is. */
  function showSection(m, name) {
    const tryFind = () => {
      const hit = ctx.placedSections(m).get(name.toLowerCase());
      if (hit) {
        ctx.reveal([{ m, pt: hit.pt, label: hit.name, color: L.place, key: true }]);
        map.easeTo({ center: hit.pt, zoom: Math.max(map.getZoom(), 13.5), offset: offset(), duration: 600 });
      }
      return !!hit;
    };
    if (tryFind()) return;
    const giveUp = () => ctx.toast(`${name} is part of ${m.n}, but the map data doesn't pin down exactly where.`);
    // The background map only includes small villages when zoomed in: zoom
    // into the town, let it load, then look again.
    if (map.getZoom() < 13.4) {
      ctx.fit([m], 14);
      map.once('idle', () => {
        if (sel === m && !tryFind()) giveUp();
      });
      return;
    }
    if (!map.isMoving() && map.areTilesLoaded()) return giveUp();
    map.once('idle', () => {
      if (sel === m && !tryFind()) giveUp();
    });
  }

  function showLandmark(l) {
    ctx.reveal([{ m: l.m, pt: l.pt, label: l.name, color: L.place, key: true }]);
    map.easeTo({ center: l.pt, zoom: Math.max(map.getZoom(), 13.5), offset: offset(), duration: 600 });
  }

  // ---- layer 2 ----------------------------------------------------------------
  function noteCards(kind, key, draft) {
    const mine = ctx.notes
      .list(kind, key)
      .map(
        (n) =>
          `<div class="notecard mine"><span class="tag">your note</span>${esc(n.text)}<button class="del" data-kind="${kind}" data-key="${esc(key)}" data-t="${n.t}" aria-label="Delete note">×</button></div>`
      )
      .join('');
    return (draft ? `<div class="notecard"><span class="tag">draft note</span>${esc(draft)}</div>` : '') + mine;
  }

  function panel(m) {
    if (tab === 'borders') {
      return `<div class="chips">${[...m.neighbors]
        .map((o) => ({ o, b: bearing(m.pt, o.pt) }))
        .sort((x, y) => x.b - y.b)
        .map(({ o, b }) => `<button class="chip" data-id="${o.id}"><span class="arr">${ARROWS[compass8(b)]}</span>${compass8(b)} ${esc(ctx.name(o))}</button>`)
        .join('')}</div>`;
    }
    if (tab === 'villages') {
      const secs = showAllSections ? m.sections : m.sections.slice(0, 12);
      const more = m.sections.length - secs.length;
      // Put every village we can place on the map right away
      const placed = ctx.placedSections(m);
      requestAnimationFrame(() =>
        ctx.reveal([...placed.values()].map((p) => ({ m, pt: p.pt, label: p.name, color: L.place })))
      );
      return `<div class="chips">${secs
        .map((s) => `<button class="chip sec${s.known ? ' known' : ''}${placed.has(s.name.toLowerCase()) ? ' located' : ''}" data-sec="${esc(s.name)}">${esc(s.name)}</button>`)
        .join('')}${more > 0 ? `<button class="chip more" id="moreSec">+${more} more</button>` : ''}</div>
        <div class="hint muted">Bold = names you'll see on mail and signs. ● = shown on the map now; tap any to zoom to it.</div>`;
    }
    if (tab === 'roads') {
      const roads = roadsInTown(map, m, ctx.locate);
      if (!roads.length)
        return `<div class="hint muted">${
          ctx.settings.basemap === 'none' ? 'Turn on the background map in Settings to see roads.' : 'No major roads found here yet (the map may still be loading).'
        }</div>`;
      const r = roads.find((x) => x.label === roadSel);
      let leads = '';
      if (r) {
        const SC = ctx.region.gridAngle ? 0.12 : 1;
        const rf = roadsFrom(map, m, ctx.locate, 10 * SC).find((x) => x.label === r.label);
        if (rf && rf.towns.length)
          leads = `<div class="leads"><span class="label-sm">${esc(r.label)} leads to</span> ${rf.towns
            .slice(0, 8)
            .map((t) => `<button class="chip" data-id="${t.m.id}">${esc(ctx.name(t.m))} <span class="muted">${t.dir} ${t.d < 10 ? t.d.toFixed(1) : Math.round(t.d)} mi</span></button>`)
            .join('')}</div>`;
      }
      return `<div class="chips">${roads
        .map((x) => `<button class="chip${x.label === roadSel ? ' on' : ''}" data-road="${esc(x.label)}">${ctx.swatch(x.label)}${esc(x.label)}</button>`)
        .join('')}</div>${
        r
          ? `${countyNum(r.raw.join(';')) ? `<div class="hint muted">County Route ${countyNum(r.raw.join(';'))}</div>` : ''}${leads}${noteCards('road', r.label, draftNote(r.label, r.name, ctx.region.roadNotes)) || '<div class="hint muted">No notes yet.</div>'}
             <button class="addnote" data-note="road" data-key="${esc(r.label)}">＋ Note about ${esc(r.label)}</button>`
          : '<div class="hint muted">Tap a road to highlight it and see notes.</div>'
      }`;
    }
    if (tab === 'landmarks') {
      const ls = landmarksByTown.get(m.id) || [];
      return `<div class="chips">${ls
        .map((l) => `<button class="chip" data-lm="${l.id}">${esc(l.name)} <span class="muted">${esc(l.kind)}</span></button>`)
        .join('')}</div>`;
    }
    if (tab === 'notes') {
      return `${noteCards('town', m.key) || '<div class="hint muted">Nothing yet. Add what you know: shortcuts, what it\'s near, how to remember it.</div>'}
        <button class="addnote" data-note="town" data-key="${esc(m.key)}">＋ Note about ${esc(m.n)}</button>`;
    }
    if (tab === 'alikes') {
      const groups = ctx.confusables.byId.get(m.id) || [];
      const twins = [...new Set(groups.flatMap((g) => g.members))].filter((o) => o !== m);
      const hooks = groups.map((g) => g.note).filter(Boolean);
      return `<div class="chips">${twins
        .map((o) => `<button class="chip twin" data-id="${o.id}">${esc(ctx.name(o))} <span class="muted">${ctx.relative(m.pt, o.pt).text}</span></button>`)
        .join('')}</div>${hooks.map((t) => `<div class="note">${esc(t)}</div>`).join('')}`;
    }
    return '';
  }

  // ---- highways -------------------------------------------------------------
  let hwySel = null;
  function highwayChips() {
    const hs = ctx.region.highways;
    if (!hs.length) return '';
    return `<div class="label-sm">Highways</div><div class="chips">${hs
      .map((h) => `<button class="chip" data-hwy="${esc(h.label)}">${ctx.swatch(h.label)}${esc(h.label)}</button>`)
      .join('')}</div>`;
  }
  function highwayCard(h) {
    const town = (key) => {
      const m = ctx.byKey.get(key);
      return m ? m.n : '';
    };
    const ends = h.ends
      .map((e) => `<div class="hwyend"><span class="k">${e.side}</span> ${esc(e.name)}${town(e.town) && !e.name.includes(town(e.town)) ? ` <span class="muted">(${esc(town(e.town))})</span>` : ''}</div>`)
      .join('');
    const meets = (ctx.region.junctions || [])
      .filter((j) => j.a === h.label || j.b === h.label)
      .map((j) => `${ctx.swatch(j.a === h.label ? j.b : j.a)}${esc(j.a === h.label ? j.b : j.a)} at ${esc(town(j.town))}`)
      .join(' · ');
    const others = ctx.region.highways
      .filter((o) => o !== h)
      .map((o) => `<button class="chip" data-hwy="${esc(o.label)}">${ctx.swatch(o.label)}${esc(o.label)}</button>`)
      .join('');
    return `<div class="titlerow"><div class="town">${ctx.swatch(h.label).replace('class="sw"', 'class="sw big"')}${esc(h.label)}</div><button class="star" id="hwyBack">✕ Close</button></div>
      <div class="meta">${esc(h.full)} · runs ${esc(h.runs)}</div>
      <div class="hwyends">${ends}</div>
      ${meets ? `<div class="hwymeets"><span class="label-sm">Meets</span> ${meets}</div>` : ''}
      <div class="note">${esc(h.note)}</div>
      ${h.exits ? `<div class="hint muted">${esc(h.exits)}</div>` : ''}
      <div class="chips" style="margin-top:8px">${others}</div>`;
  }
  function showHighway(h) {
    hwySel = h;
    natSel = null;
    if (sel) ctx.highlight(sel.id, null);
    sel = null;
    ctx.focus(null);
    ctx.reveal(h.ends.map((e) => ({ m: null, pt: e.pt, label: e.name.replace(/^the /, ''), color: L.neutral, key: true })));
    ctx.focusHighway(h);
    render();
    requestAnimationFrame(() => ctx.fit(h.ends.map((e) => e.pt), 11));
  }

  // ---- lakes & mountains -------------------------------------------------------
  let natSel = null;
  function natureChips() {
    const ns = ctx.region.nature || [];
    if (!ns.length) return '';
    const group = (kinds, title) =>
      `<div class="label-sm">${title}</div><div class="chips">${ns
        .map((n, i) => [n, i])
        .filter(([n]) => kinds.includes(n.kind))
        .map(([n, i]) => `<button class="chip nat" data-nat="${i}">${esc(n.name)}</button>`)
        .join('')}</div>`;
    return group(['Lake', 'Reservoir'], 'Lakes & reservoirs') + group(['Mountain', 'Ridge'], 'Mountains & ridges');
  }
  function natureCard(n) {
    const near = ctx.anchors.phrase(n.pt);
    const you = ctx.pos ? `${ctx.relative(ctx.pos.pt, n.pt).text} of you` : '';
    return `<div class="titlerow"><div class="town">${esc(n.name)}</div><button class="star" id="natBack">✕ Close</button></div>
      <div class="meta">${esc(n.kind)}${near ? ` · ${esc(near)}` : ''}${you ? ` · ${esc(you)}` : ''}</div>
      <div class="note">${esc(n.note)}</div>`;
  }
  function showNature(n) {
    natSel = n;
    hwySel = null;
    if (sel) ctx.highlight(sel.id, null);
    sel = null;
    ctx.focus(null);
    ctx.focusRoad(null);
    ctx.reveal([{ m: null, pt: n.pt, label: n.name, color: L.place, key: true }]);
    render();
    const pad = ctx.padding();
    requestAnimationFrame(() =>
      map.easeTo({ center: n.pt, zoom: n.r >= 4 ? 10.5 : 11.5, offset: [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2], duration: 700 })
    );
  }

  function starBtn(m) {
    const on = ctx.myList.has(m);
    return `<button class="star" id="starBtn" aria-pressed="${on}" title="${on ? 'On your list' : 'Add to your list to practice'}">${on ? '★ My list' : '☆ My list'}</button>`;
  }

  function render() {
    const R = ctx.region;
    const search = `<input id="search" type="search" list="townlist" placeholder="${R.sections ? 'Search a town, village or landmark…' : `Search a ${R.unit} or landmark…`}" autocomplete="off" enterkeyhint="go">`;
    if (natSel) {
      ctx.hud(`${search}${natureCard(natSel)}`);
    } else if (hwySel) {
      ctx.hud(`${search}${highwayCard(hwySel)}`);
    } else if (!sel) {
      ctx.hud(
        `${search}<div class="meta">Tap anywhere on the map to see which ${R.unit} it is and what surrounds it. ${
          R.sections ? 'Search also finds villages ("Towaco") and landmarks ("Willowbrook").' : 'Search also finds landmarks ("Penn Station").'
        }</div>${highwayChips()}${natureChips()}`
      );
    } else {
      const m = sel;
      const anchor = ctx.anchors.phrase(m.pt);
      const from = (anchor ? ` · ${esc(anchor)}` : '') + (ctx.pos ? ` · ${ctx.relative(ctx.pos.pt, m.pt).text} of you` : '');
      const nAlikes = new Set((ctx.confusables.byId.get(m.id) || []).flatMap((g) => g.members)).size - 1;
      const tabs = [
        ['borders', 'Borders', m.neighbors.length],
        ['villages', 'Villages', m.sections.length],
        ['roads', 'Roads', 0],
        ['landmarks', 'Landmarks', (landmarksByTown.get(m.id) || []).length],
        ['notes', 'My notes', ctx.notes.list('town', m.key).length],
        ['alikes', 'Sound-alikes', Math.max(0, nAlikes)],
      ].filter(([k, , n]) => k === 'roads' || k === 'notes' || n > 0);
      if (tab && !tabs.some(([k]) => k === tab)) tab = null;
      ctx.hud(
        `${search}
         <div class="titlerow"><div class="town">${esc(m.n)}</div>${starBtn(m)}</div>
         <div class="meta">${esc(m.t)} · <b>${esc(ctx.groupName(m.c))}</b>${from}</div>
         <div class="dtabs">${tabs
           .map(([k, label, n]) => `<button data-tab="${k}" aria-pressed="${tab === k}">${label}${n ? `<span class="n">${n}</span>` : ''}</button>`)
           .join('')}</div>
         ${tab ? `<div class="detail">${panel(m)}</div>` : ''}`
      );
    }
    bind();
  }

  function bind() {
    const hud = document.getElementById('hud');
    const input = document.getElementById('search');
    input.addEventListener('change', () => {
      const hit = byOption.get(input.value.trim().toLowerCase());
      if (!hit) return;
      input.blur();
      select(hit.m);
      if (hit.section) {
        ctx.toast(`${hit.section} is part of ${hit.m.full}, ${ctx.groupName(hit.m.c)}`);
        showSection(hit.m, hit.section);
      } else if (hit.landmark) {
        ctx.toast(`${hit.landmark.name} is in ${hit.m.full}, ${ctx.groupName(hit.m.c)}`);
        map.once('moveend', () => showLandmark(hit.landmark));
      }
    });
    for (const b of hud.querySelectorAll('[data-id]')) b.addEventListener('click', () => select(ctx.munis[+b.dataset.id]));
    for (const b of hud.querySelectorAll('[data-hwy]')) b.addEventListener('click', () => showHighway(ctx.hwy(b.dataset.hwy)));
    for (const b of hud.querySelectorAll('[data-nat]')) b.addEventListener('click', () => showNature(ctx.region.nature[+b.dataset.nat]));
    const natBack = document.getElementById('natBack');
    if (natBack)
      natBack.addEventListener('click', () => {
        natSel = null;
        ctx.reveal([]);
        render();
      });
    const back = document.getElementById('hwyBack');
    if (back)
      back.addEventListener('click', () => {
        hwySel = null;
        ctx.focusRoad(null);
        ctx.reveal([]);
        render();
      });
    const star = document.getElementById('starBtn');
    if (star)
      star.addEventListener('click', () => {
        const on = ctx.myList.toggle(sel);
        ctx.toast(on ? `${sel.n} added to My list. Practice → area → My list.` : `${sel.n} removed from My list`);
        render();
      });
    for (const b of hud.querySelectorAll('[data-tab]'))
      b.addEventListener('click', () => {
        tab = tab === b.dataset.tab ? null : b.dataset.tab;
        if (tab !== 'roads') {
          roadSel = null;
          ctx.focusRoad(null);
        }
        render();
      });
    for (const b of hud.querySelectorAll('[data-sec]')) b.addEventListener('click', () => showSection(sel, b.dataset.sec));
    for (const b of hud.querySelectorAll('[data-lm]')) b.addEventListener('click', () => showLandmark(ctx.landmarks[+b.dataset.lm]));
    for (const b of hud.querySelectorAll('[data-road]'))
      b.addEventListener('click', () => {
        roadSel = roadSel === b.dataset.road ? null : b.dataset.road;
        const r = roadSel && roadsInTown(map, sel, ctx.locate).find((x) => x.label === roadSel);
        ctx.focusRoad(r ? r.raw : null, r && ctx.hwy(r.label) ? ctx.hwy(r.label).color : null, byName(r));
        render();
      });
    for (const b of hud.querySelectorAll('.addnote'))
      b.addEventListener('click', async () => {
        const label = b.dataset.note === 'town' ? sel.n : b.dataset.key;
        const text = await editNote(`Note about ${label}`);
        if (text) {
          ctx.notes.add(b.dataset.note, b.dataset.key, text);
          render();
        }
      });
    for (const b of hud.querySelectorAll('.notecard .del'))
      b.addEventListener('click', () => {
        if (!confirm('Delete this note?')) return;
        ctx.notes.remove(b.dataset.kind, b.dataset.key, +b.dataset.t);
        render();
      });
    const moreBtn = document.getElementById('moreSec');
    if (moreBtn)
      moreBtn.addEventListener('click', () => {
        showAllSections = true;
        render();
      });
  }

  // The Roads tab reads roads from loaded map tiles; refresh once they arrive.
  map.on('idle', () => {
    if (ctx.mode === 'explore' && sel && tab === 'roads' && !document.querySelector('#hud [data-road]')) render();
  });

  return {
    enter() {
      ctx.showLabels(true);
      ctx.sheet('');
      ctx.reveal([]);
      ctx.line(null);
      ctx.clearHighlights();
      if (!sel && ctx.modes.drive.current) sel = ctx.modes.drive.current;
      if (sel) ctx.highlight(sel.id, 'sel');
      ctx.focus(sel);
      render();
    },
    leave() {
      ctx.focus(null);
      ctx.focusRoad(null);
      ctx.clearHighlights();
    },
    select,
  };
}
