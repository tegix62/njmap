/* global maplibregl, topojson */
import { bbox, makeLocator, bearing, distanceMi, compass16, dirWord } from './geo.js';
import { resolveGroups } from './confusables.js';
import { store } from './store.js';
import { initDrive } from './drive.js';
import { initExplore } from './explore.js';
import { initPractice } from './practice.js';
import { notes, migrateRoadKeys } from './notes.js';
import { buildStyle, MUNI_LABEL_IDS, PLACE_LAYER_IDS } from './style.js';
import { THEMES } from './theme.js';
import { activeRegion, switchRegion, ALL_REGIONS } from './region.js';
import { initAnchors } from './anchors.js';
import { initDropIn } from './dropin.js';

const TYPE_ABBR = { Township: 'Twp', Borough: 'Boro', City: 'City', Town: 'Town', Village: 'Vlg' };

const DEFAULT_SETTINGS = {
  voice: true,
  voiceHints: true,
  voiceGuess: false,
  rememberPlaces: false, // opt-in: visited towns + drive routes, on this phone only
  mapStyle: 'ink',
  basemap: 'streets',
  northUp: false,
  driveLabels: true,
  wakeLock: true,
  phoneCompass: true,
};

async function main() {
  const region = activeRegion();
  document.body.dataset.region = region.id;
  const [topo, sectionsByKey] = await Promise.all([
    fetch(region.data).then((r) => r.json()),
    region.sections
      ? fetch(region.sections)
          .then((r) => r.json())
          .catch(() => ({}))
      : {},
  ]);
  const fc = (o) => topojson.feature(topo, topo.objects[o]);
  const munisFC = fc('munis');
  const labelsFC = fc('labels');
  const countiesFC = fc('counties');
  const countyLabelsFC = fc('countylabels');
  const nbIdx = topojson.neighbors(topo.objects.munis.geometries);

  const nameCount = {};
  for (const f of munisFC.features) nameCount[f.properties.n] = (nameCount[f.properties.n] || 0) + 1;

  const munis = munisFC.features.map((f, i) => {
    const p = f.properties;
    const dup = nameCount[p.n] > 1;
    return {
      id: i,
      n: p.n,
      t: p.t,
      full: p.full,
      c: p.c,
      p: p.p,
      key: `${p.full}|${p.c}`,
      dup,
      mapLabel: dup ? `${p.n} ${TYPE_ABBR[p.t] || p.t}` : p.n,
      geom: f.geometry,
      bbox: bbox(f.geometry),
      pt: labelsFC.features[i].geometry.coordinates,
    };
  });
  munis.forEach((m, i) => {
    m.neighbors = nbIdx[i].map((j) => munis[j]);
    // Villages / sections inside this municipality: [{name, known}], well-known first
    m.sections = (sectionsByKey[m.key] || []).map(([name, known, cands]) => ({ name, known: !!known, cands: cands || [] }));
  });
  // Names drawn on the map as sections. Skip any that are also a municipality's
  // name (Hanover's "Monroe"), which would read as the wrong town.
  // Built-in village locations: use a candidate only if it really falls inside
  // this municipality (a same-named place elsewhere must not mislabel the map).
  {
    const locate0 = makeLocator(munis);
    for (const m of munis) for (const x of m.sections) x.pt = x.cands.find((p) => locate0(p) === m) || null;
  }
  const muniNames = new Set(munis.map((m) => m.n.toLowerCase()));
  // Names the background map's own place points may label (those without a built-in location)
  const sectionNames = [...new Set(munis.flatMap((m) => m.sections.filter((x) => !x.pt).map((x) => x.name)))].filter(
    (n) => !muniNames.has(n.toLowerCase())
  );
  const byKey = new Map(munis.map((m) => [m.key, m]));
  // "Well-known" flag (see the region config); every Manhattan neighborhood counts.
  {
    const wk = region.wellKnown;
    const seats = new Set(wk ? wk.seats : []);
    const names = new Set(wk ? wk.names : []);
    const lmTowns = new Set(region.landmarks.map((l) => l.town));
    const pairs = new Set(region.confusables.filter((g) => g.note).flatMap((g) => g.names));
    for (const m of munis)
      m.wellKnown = !wk || m.p >= wk.minPop || seats.has(m.key) || names.has(m.n) || names.has(`${m.n}|${m.c}`) || lmTowns.has(m.key) || pairs.has(m.n);
  }
  const confusables = resolveGroups(munis, region.confusables);
  const counties = countiesFC.features.map((f) => f.properties.c).sort();
  if (region.groupOrder) counties.sort((a, b) => region.groupOrder.indexOf(a) - region.groupOrder.indexOf(b));

  const settings = { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };
  migrateRoadKeys();

  // ---- map ------------------------------------------------------------------
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const munisData = {
    type: 'FeatureCollection',
    features: munisFC.features.map((f, i) => ({ type: 'Feature', id: i, properties: { c: f.properties.c }, geometry: f.geometry })),
  };
  const labelsData = {
    type: 'FeatureCollection',
    features: munis.map((m) => ({
      type: 'Feature',
      id: m.id,
      properties: { label: m.mapLabel, p: m.p, wk: m.wellKnown ? 1 : 0 },
      geometry: { type: 'Point', coordinates: m.pt },
    })),
  };
  const empty = { type: 'FeatureCollection', features: [] };
  const landmarks = region.landmarks.filter((l) => byKey.has(l.town)).map((l, i) => ({ ...l, id: i, m: byKey.get(l.town) }));
  const landmarksData = {
    type: 'FeatureCollection',
    features: landmarks.map((l) => ({ type: 'Feature', id: l.id, properties: { name: l.name }, geometry: { type: 'Point', coordinates: l.pt } })),
  };
  if (!['streets', 'light', 'none'].includes(settings.basemap)) settings.basemap = 'streets';
  const regionLabels = {
    type: 'FeatureCollection',
    features: Object.entries(region.superGroups || {}).map(([name, cs]) => {
      const ms = munis.filter((m) => cs.includes(m.c));
      const pt = [ms.reduce((a, m) => a + m.pt[0], 0) / ms.length, ms.reduce((a, m) => a + m.pt[1], 0) / ms.length];
      return { type: 'Feature', properties: { name }, geometry: { type: 'Point', coordinates: pt } };
    }),
  };
  const anchorsData = (list) => ({
    type: 'FeatureCollection',
    features: list.map((a, i) => ({ type: 'Feature', id: i, properties: { name: a.name }, geometry: { type: 'Point', coordinates: a.pt } })),
  });

  const theme = THEMES[settings.mapStyle] || THEMES.ink;
  document.body.classList.toggle('ink', !!theme.inkMode);
  const built = buildStyle({
    theme,
    base,
    basemap: settings.basemap,
    sectionNames,
    Z: region.zooms,
    majorSize: region.majorSize,
    groupTint: region.groupTint,
    attribution: region.attribution,
    highways: region.highways,
    data: {
      munis: munisData,
      counties: countiesFC,
      labels: labelsData,
      countyLabels: countyLabelsFC,
      regionLabels,
      landmarks: landmarksData,
      nature: {
        type: 'FeatureCollection',
        features: (region.nature || []).map((n) => ({ type: 'Feature', properties: { name: n.name, kind: n.kind }, geometry: { type: 'Point', coordinates: n.pt } })),
      },
      sectionPts: {
        type: 'FeatureCollection',
        features: munis.flatMap((m) =>
          m.sections
            .filter((x) => x.pt && !muniNames.has(x.name.toLowerCase()))
            .map((x) => ({ type: 'Feature', properties: { name: x.name }, geometry: { type: 'Point', coordinates: x.pt } }))
        ),
      },
      anchors: anchorsData(store.get('anchors', [])),
      empty,
    },
  });

  const map = new maplibregl.Map({
    container: 'map',
    attributionControl: false,
    bounds: region.bounds,
    fitBoundsOptions: { padding: 20 },
    maxBounds: region.maxBounds,
    dragRotate: true,
    pitchWithRotate: false,
    touchPitch: false,
    style: built.style,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial', maxWidth: 90 }), 'bottom-left');
  // Wait for the style only (all local), not 'load', which also waits on
  // background tiles and would stall with no signal.
  await new Promise((r) => (map.isStyleLoaded() ? r() : map.once('style.load', r)));

  // ---- shared context ---------------------------------------------------------
  const $ = (s) => document.querySelector(s);
  const hudEl = $('#hud');
  const sheetEl = $('#sheet');
  const highlighted = new Map();
  let labelsOn = true;
  let focused = [];
  let tinted = [];
  let toastTimer = 0;

  const ctx = {
    map,
    munis,
    byKey,
    counties,
    confusables,
    settings,
    store,
    locate: makeLocator(munis),
    pos: null, // {pt, acc, speed, heading, t}
    mode: null,
    region,
    theme,
    /** Ink mode: shade a place by how well you know it (from spaced review). */
    setKnow(m) {
      if (!theme.inkMode || !m || m.id == null) return;
      const r = store.get('srs', {})[m.key];
      const level = !r ? 0 : r.b >= 3 ? 3 : r.b >= 1 ? 2 : 1;
      map.setFeatureState({ source: 'munis', id: m.id }, { know: level });
    },
    sub: (m) => region.sub(m),
    groupName: (c) => region.groupName(c),
    name: (m) => (m.dup ? `${m.n} ${TYPE_ABBR[m.t] || m.t} (${m.c})` : m.n),
    saveSettings() {
      store.set('settings', settings);
    },
    hud(html) {
      hudEl.innerHTML = html;
      hudEl.hidden = !html;
      requestAnimationFrame(updateEdges);
    },
    sheet(html) {
      sheetEl.innerHTML = html;
      sheetEl.hidden = !html;
      requestAnimationFrame(updateEdges);
    },
    highlight(id, kind) {
      if (kind) {
        map.setFeatureState({ source: 'munis', id }, { hl: kind });
        highlighted.set(id, kind);
      } else {
        map.removeFeatureState({ source: 'munis', id }, 'hl');
        highlighted.delete(id);
      }
    },
    clearHighlights(except) {
      for (const id of [...highlighted.keys()]) if (!except || !except(id, highlighted.get(id))) ctx.highlight(id, null);
    },
    reveal(items) {
      // priority: right 0, wrong 1, the question 2, everything else 3 (minor)
      const L = theme.label;
      const prio = (c) => (c === L.good ? 0 : c === L.bad ? 1 : c === L.q ? 2 : 3);
      map.getSource('reveal').setData({
        type: 'FeatureCollection',
        features: items.map(({ m, color, label, pt, key }) => ({
          type: 'Feature',
          properties: { label: label || m.mapLabel, color, prio: key ? 2 : prio(color) },
          geometry: { type: 'Point', coordinates: pt || m.pt },
        })),
      });
    },
    /** Several lines at once: [{coords, color?}] */
    lines(list) {
      map.getSource('qline').setData({
        type: 'FeatureCollection',
        features: list.map((l) => ({ type: 'Feature', properties: l.color ? { color: l.color } : {}, geometry: { type: 'LineString', coordinates: l.coords } })),
      });
    },
    /** Draw a recorded trip's route (or clear it with null). */
    trip(coords) {
      map.getSource('trip').setData(coords ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } : empty);
    },
    line(coords) {
      map.getSource('qline').setData(
        coords ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } : empty
      );
    },
    showLabels(on) {
      labelsOn = on;
      for (const id of MUNI_LABEL_IDS) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      map.setLayoutProperty('section-label', 'visibility', on && settings.basemap !== 'none' ? 'visible' : 'none');
      map.setLayoutProperty('section-label-local', 'visibility', on ? 'visible' : 'none');
      for (const id of PLACE_LAYER_IDS) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    },
    padding() {
      const top = hudEl.hidden ? 12 : hudEl.getBoundingClientRect().bottom + 12;
      const sheetTop = sheetEl.hidden ? $('#tabs').getBoundingClientRect().top : sheetEl.getBoundingClientRect().top;
      const bottom = Math.max(12, window.innerHeight - sheetTop + 12);
      return { top, bottom, left: 16, right: 56 };
    },
    fit(items, maxZoom = 13) {
      // fitBounds adds any padding already stored on the map; keep it at zero.
      const mp = map.getPadding();
      if (mp.top || mp.bottom || mp.left || mp.right) map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      let b = null;
      for (const it of items) {
        const bb = Array.isArray(it) ? [it[0], it[1], it[0], it[1]] : it.bbox;
        b = b ? [Math.min(b[0], bb[0]), Math.min(b[1], bb[1]), Math.max(b[2], bb[2]), Math.max(b[3], bb[3])] : bb;
      }
      if (!b) return;
      map.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: ctx.padding(), maxZoom, bearing: map.getBearing(), duration: 600 }
      );
    },
    /** "12 mi NW of Clifton" style phrase: where `to` sits relative to `from`. */
    relative(fromPt, toPt) {
      const d = distanceMi(fromPt, toPt);
      const dir = compass16(bearing(fromPt, toPt));
      return { d, dir, text: `${d < 10 ? d.toFixed(1) : Math.round(d)} mi ${dir}`, words: `${d < 10 ? d.toFixed(1) : Math.round(d)} miles ${dirWord(dir)}` };
    },
    /** Queued, so a town announcement doesn't cut off a road note (or vice versa). */
    speak(text) {
      if (!settings.voice || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      speechSynthesis.speak(u);
    },
    setBasemap(key) {
      settings.basemap = key;
      ctx.saveSettings();
      for (const [l, modes] of built.baseLayers)
        map.setLayoutProperty(l.id, 'visibility', modes.split(' ').includes(key) ? 'visible' : 'none');
      ctx.showLabels(labelsOn);
    },
    /**
     * Sections of `m` that the loaded background tiles can place on the map:
     * Map<lowercased name, {name, pt}>. Empty offline or with the basemap off.
     */
    placedSections(m) {
      const out = new Map();
      for (const x of m.sections) if (x.pt) out.set(x.name.toLowerCase(), { name: x.name, pt: x.pt });
      if (!m.sections.length || settings.basemap === 'none' || !map.getSource('omt')) return out;
      const want = new Map(m.sections.map((x) => [x.name.toLowerCase(), x.name]));
      let feats = [];
      try {
        feats = map.querySourceFeatures('omt', { sourceLayer: 'place' });
      } catch {
        return out;
      }
      for (const f of feats) {
        const n = f.properties && f.properties.name;
        if (!n || f.geometry.type !== 'Point') continue;
        const k = n.toLowerCase();
        if (!want.has(k) || out.has(k)) continue;
        const pt = f.geometry.coordinates;
        if (ctx.locate(pt) !== m) continue; // must actually sit inside this town
        out.set(k, { name: want.get(k), pt });
      }
      return out;
    },
    landmarks,
    notes,
    /** Places you've starred to learn ("someone mentioned Harrison"). On this phone only. */
    myList: {
      has: (m) => !!store.get('mylist', {})[m.key],
      keys: () => Object.keys(store.get('mylist', {})),
      toggle(m) {
        const l = store.get('mylist', {});
        if (l[m.key]) delete l[m.key];
        else l[m.key] = Date.now();
        store.set('mylist', l);
        return !!l[m.key];
      },
    },
    /**
     * Focus a town: tint its neighbors and fade every other town label.
     * Pass null to clear.
     */
    focus(m) {
      for (const id of focused) map.removeFeatureState({ source: 'labels', id }, 'focus');
      for (const id of tinted) if (highlighted.get(id) === 'near') ctx.highlight(id, null);
      focused = [];
      tinted = [];
      if (m) {
        for (const o of [m, ...m.neighbors]) {
          map.setFeatureState({ source: 'labels', id: o.id }, { focus: true });
          focused.push(o.id);
        }
        for (const o of m.neighbors)
          if (!highlighted.has(o.id)) {
            ctx.highlight(o.id, 'near');
            tinted.push(o.id);
          }
      }
      map.setGlobalStateProperty('focusing', !!m);
    },
    /** The big highway with this label (Turnpike, Parkway, I-80…), if any. */
    hwy: (label) => region.highways.find((h) => h.label === label) || null,
    /** A small color swatch for a highway label ('' for ordinary roads). */
    swatch(label) {
      const h = ctx.hwy(label);
      return h ? `<span class="sw" style="background:${h.color}"></span>` : '';
    },
    /** Light up one whole highway across the map, in its own color. */
    focusHighway(h) {
      if (!h) return ctx.focusRoad(null);
      map.setFilter('road-focus', ['>=', ['index-of', h.match, ['coalesce', ['get', 'ref'], '']], 0]);
      map.setPaintProperty('road-focus', 'line-color', h.color);
    },
    /** Hide or show road numbers on the map (hidden while a road question is open). */
    showRoadRefs(on) {
      for (const id of ['road-ref-major', 'road-ref'])
        map.setLayoutProperty(id, 'visibility', on && settings.basemap === 'streets' ? 'visible' : 'none');
    },
    /** Highlight one road (its raw OSM refs) on the map; null clears. */
    focusRoad(raw, color) {
      map.setFilter('road-focus', raw && raw.length ? ['in', ['get', 'ref'], ['literal', raw]] : ['==', ['get', 'ref'], '__none__']);
      map.setPaintProperty('road-focus', 'line-color', color || theme.hl.sel);
      if (!raw) map.setFilter('road-focus-bad', ['==', ['get', 'ref'], '__none__']);
    },
    /** The road you picked when it was wrong (drawn in the "wrong" color). */
    focusRoadBad(raw) {
      map.setFilter('road-focus-bad', raw && raw.length ? ['in', ['get', 'ref'], ['literal', raw]] : ['==', ['get', 'ref'], '__none__']);
    },
    toast(msg, ms = 3200) {
      const t = $('#toast');
      t.textContent = msg;
      t.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (t.hidden = true), ms);
    },
    anchorsData,
    updateEdges: () => updateEdges(),
  };
  window.njtf = ctx; // handy for debugging from the console

  // ---- compass edge labels ----------------------------------------------------
  // N/E/S/W letters pinned to the edges of the visible map, rotated with it, so
  // in heading-up mode you can see at a glance that "north is to my left".
  const edgeEls = [...document.querySelectorAll('#edges span')];
  function updateEdges() {
    const W = window.innerWidth;
    const top = hudEl.hidden ? 8 : hudEl.getBoundingClientRect().bottom + 4;
    const sheetTop = sheetEl.hidden ? $('#tabs').getBoundingClientRect().top : sheetEl.getBoundingClientRect().top;
    const bottom = sheetTop - 4;
    const inset = 16;
    let cx = W / 2;
    let cy = (top + bottom) / 2;
    if (ctx.pos && ctx.mode === 'drive') {
      const p = map.project(ctx.pos.pt);
      if (p.x > inset && p.x < W - inset && p.y > top + inset && p.y < bottom - inset) {
        cx = p.x;
        cy = p.y;
      }
    }
    const b = map.getBearing();
    for (const el of edgeEls) {
      const a = (((+el.dataset.d - b) % 360) + 360) % 360;
      const r = (a * Math.PI) / 180;
      const dx = Math.sin(r);
      const dy = -Math.cos(r);
      const tx = dx > 0 ? (W - inset - cx) / dx : dx < 0 ? (inset - cx) / dx : Infinity;
      const ty = dy > 0 ? (bottom - inset - cy) / dy : dy < 0 ? (top + inset - cy) / dy : Infinity;
      const t = Math.max(0, Math.min(tx, ty));
      el.style.transform = `translate(${cx + dx * t}px, ${cy + dy * t}px) translate(-50%, -50%)`;
    }
    $('#compass .rose').style.transform = `rotate(${-b}deg)`;
  }
  map.on('move', updateEdges);
  window.addEventListener('resize', updateEdges);

  ctx.anchors = initAnchors(ctx); // before the modes, so it can claim map taps
  ctx.dropin = initDropIn(ctx);
  for (const m of munis) ctx.setKnow(m);

  // ---- modes ----------------------------------------------------------------
  const modes = {
    drive: initDrive(ctx),
    explore: initExplore(ctx),
    practice: initPractice(ctx),
  };
  ctx.modes = modes;

  function setMode(m) {
    if (ctx.mode === m) return;
    if (ctx.mode) modes[ctx.mode].leave();
    ctx.mode = m;
    document.body.dataset.mode = m;
    for (const b of document.querySelectorAll('#tabs [data-mode]')) b.setAttribute('aria-selected', b.dataset.mode === m);
    store.set('mode', m);
    // Study modes are north-up; Drive re-applies its own orientation.
    if (m !== 'drive' && map.getBearing() !== 0) map.jumpTo({ bearing: 0 });
    modes[m].enter();
    updateEdges();
  }
  ctx.setMode = setMode;
  for (const b of document.querySelectorAll('#tabs [data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));

  // compass button: north-up <-> heading-up (drive) / reset to north (other modes)
  $('#compass').addEventListener('click', () => {
    if (ctx.mode === 'drive') modes.drive.toggleOrientation();
    else map.easeTo({ bearing: 0, duration: 400 });
  });
  $('#recenter').addEventListener('click', () => modes.drive.recenter());

  // ---- settings dialog ------------------------------------------------------
  const dlg = $('#settings');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function renderAnchors() {
    const list = ctx.anchors.list();
    $('#anchorList').innerHTML = list.length
      ? list.map((a, i) => `<div class="anchorrow"><span>${esc(a.name)}</span><span class="muted2">in ${esc(townOf(a.pt))}</span><button data-i="${i}" aria-label="Remove ${esc(a.name)}">×</button></div>`).join('')
      : '<p class="fine">None yet.</p>';
    for (const b of $('#anchorList').querySelectorAll('button')) b.addEventListener('click', () => {
      ctx.anchors.remove(+b.dataset.i);
      renderAnchors();
    });
  }
  const townOf = (pt) => {
    const m = ctx.locate(pt);
    return m ? m.n : 'outside NJ';
  };
  const anchorName = () => {
    const n = $('#anchorName').value.trim();
    if (!n) {
      $('#anchorName').focus();
      ctx.toast('Give the place a name first');
    }
    return n;
  };
  $('#anchorHere').addEventListener('click', () => {
    const n = anchorName();
    if (!n) return;
    if (!ctx.pos) return ctx.toast('No location yet. Start Drive mode first, or tap on the map instead.');
    ctx.anchors.add(n, ctx.pos.pt);
    $('#anchorName').value = '';
    renderAnchors();
  });
  $('#anchorPick').addEventListener('click', () => {
    const n = anchorName();
    if (!n) return;
    $('#anchorName').value = '';
    dlg.close();
    ctx.anchors.startPick(n);
  });
  $('#regionSel').addEventListener('change', (e) => switchRegion(e.target.value));
  $('#settingsBtn').addEventListener('click', () => {
    $('#regionSel').value = region.id;
    renderAnchors();
    for (const el of dlg.querySelectorAll('[data-setting]')) {
      const k = el.dataset.setting;
      if (el.type === 'checkbox') el.checked = !!settings[k];
      else el.value = settings[k];
    }
    dlg.showModal();
  });
  dlg.addEventListener('change', (e) => {
    const el = e.target;
    const k = el.dataset.setting;
    if (!k) return;
    settings[k] = el.type === 'checkbox' ? el.checked : el.value;
    ctx.saveSettings();
    if (k === 'basemap') ctx.setBasemap(el.value);
    if (k === 'mapStyle') location.reload();
    if (k === 'northUp') modes.drive.applyOrientation();
    if (k === 'driveLabels' && ctx.mode === 'drive') ctx.showLabels(settings.driveLabels);
  });
  $('#resetStats').addEventListener('click', () => {
    if (confirm('Clear practice scores?')) store.del('stats');
  });
  $('#resetVisited').addEventListener('click', () => {
    if (!confirm('Forget every place and drive this phone has remembered?')) return;
    store.del('visited');
    store.del('trips');
    ctx.toast('Forgotten.');
  });
  $('#closeSettings').addEventListener('click', () => dlg.close());
  $('#exportNotes').addEventListener('click', () => {
    const blob = new Blob([notes.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `townfinder-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importNotes').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const n = notes.importJSON(await f.text());
      ctx.toast(`Imported ${n} note${n === 1 ? '' : 's'}`);
    } catch (err) {
      ctx.toast(`Couldn't import: ${err.message}`);
    }
    e.target.value = '';
  });
  $('#stopTracking').addEventListener('click', () => {
    modes.drive.stop();
    dlg.close();
  });

  setMode(store.get('mode', 'drive'));
  document.body.classList.add('ready');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    // When a new version takes over, reload once so you see it right away
    // (otherwise the offline copy shows the old version until the next open).
    if (navigator.serviceWorker.controller) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
    }
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  document.getElementById('hud').hidden = false;
  document.getElementById('hud').innerHTML = `<div class="town">Couldn't load the map</div><div class="meta">${String(err.message || err)}</div>`;
});
