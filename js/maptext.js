// Crisp map text under PS1.
//
// PS1 renders the map into a small canvas and scales it up, which turns the map's own text into blocks. This keeps the map's
// labelling logic (what is shown, where, what collides) but draws the words as ordinary DOM text above the map:
//   - every text layer of the style is made invisible (text-opacity 0) but left in place, so MapLibre still places and collides it;
//   - a few times a second the labels it placed are read back (queryRenderedFeatures), and drawn as `.px-label` elements.
// Games that draw their own crisp labels (Name that place) keep their `orb-*` layers out of this.

import { tilt } from './world.js';

const SKIP = (id) => id.startsWith('orb-');
const MAX = 70;

/** What a layer's text-field says, for the simple cases the app's style uses: a property name and whether it is upper-cased. */
function fieldOf(layout) {
  const f = layout && layout['text-field'];
  if (!f) return null;
  const s = JSON.stringify(f);
  const m = s.match(/\["get","([^"]+)"\]/);
  return { key: m ? m[1] : null, up: s.includes('"upcase"') };
}

export function createMapText(map) {
  const box = document.createElement('div');
  box.id = 'pxMapText';
  box.setAttribute('aria-hidden', 'true');
  map.getContainer().appendChild(box);
  box.hidden = true;

  let on = false, last = 0, raf = 0, layers = [];
  const saved = new Map();
  const pool = [];                     // elements reused between updates

  const textLayers = () =>
    map.getStyle().layers.filter((l) => l.type === 'symbol' && !SKIP(l.id) && l.layout && l.layout['text-field'] && map.getLayoutProperty(l.id, 'visibility') !== 'none');

  function hideNative() {
    layers = textLayers();
    for (const l of layers) {
      const k = l.id + '|text-opacity';
      if (!saved.has(k)) saved.set(k, map.getPaintProperty(l.id, 'text-opacity'));
      map.setPaintProperty(l.id, 'text-opacity', 0);
    }
  }
  function showNative() {
    for (const [k, v] of saved) {
      const id = k.split('|')[0];
      if (map.getLayer(id)) map.setPaintProperty(id, 'text-opacity', v === undefined ? null : v);
    }
    saved.clear();
    layers = [];
  }

  /** A point on screen for a feature: its point, or the middle of the part of a line that is on screen. */
  function anchor(geom) {
    const cv = map.getCanvas(), W = cv.clientWidth, H = cv.clientHeight;
    const pts = [];
    const walk = (c) => { if (typeof c[0] === 'number') pts.push(c); else c.forEach(walk); };
    walk(geom.coordinates);
    const sp = pts.map((p) => map.project(p)).filter((s) => s.x > -20 && s.y > -20 && s.x < W + 20 && s.y < H + 20);
    if (!sp.length) return null;
    return sp[Math.floor(sp.length / 2)];
  }

  function update() {
    raf = 0;
    if (!on) return;
    const paperOn = document.body.classList.contains('paper');
    const out = [];
    const seen = new Set();
    for (const l of layers) {
      if (!map.getLayer(l.id)) continue;
      const fld = fieldOf(l.layout);
      const fs = map.queryRenderedFeatures({ layers: [l.id] });
      for (const f of fs) {
        const p = f.properties || {};
        let text = fld && fld.key ? p[fld.key] : null;
        text = text || p.name || p.label || p.ref || p.c;
        if (!text) continue;
        text = String(text);
        if (fld && fld.up) text = text.toUpperCase();
        const s = anchor(f.geometry);
        if (!s) continue;
        const key = text + '|' + Math.round(s.x / 24) + '|' + Math.round(s.y / 24);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ text, x: s.x, y: s.y, line: f.geometry.type !== 'Point' && f.geometry.type !== 'MultiPoint' });
        if (out.length >= MAX * 3) break;
      }
    }
    // greedy: first come (the style lists the more important layers late, so later ones win ties by being drawn after) keep a few pixels apart
    const taken = [];
    let n = 0;
    for (const it of out) {
      if (n >= MAX) break;
      const w = it.text.length * 7 + 8, h = 15;
      const r = { x: it.x - w / 2, y: it.y - h / 2, w, h };
      if (taken.some((t) => r.x < t.x + t.w + 3 && r.x + r.w + 3 > t.x && r.y < t.y + t.h + 2 && r.y + r.h + 2 > t.y)) continue;
      taken.push(r);
      let el = pool[n];
      if (!el) { el = document.createElement('div'); el.className = 'px-label px-map'; box.appendChild(el); pool[n] = el; }
      if (el.textContent !== it.text) el.textContent = it.text;
      el.style.display = '';
      el.style.transform = `translate(${it.x}px, ${it.y}px) translate(-50%, -50%)${paperOn ? ` rotate(${tilt(it.text, 1.6).toFixed(2)}deg)` : ''}`;
      n++;
    }
    for (let i = n; i < pool.length; i++) pool[i].style.display = 'none';
  }

  const schedule = () => {
    if (!on || raf) return;
    const now = performance.now();
    if (now - last < 140) { raf = setTimeout(update, 140 - (now - last)); last = now + 140 - (now - last); return; }
    last = now;
    raf = requestAnimationFrame(update);
  };
  const onMove = () => schedule();

  return {
    show(want) {
      want = !!want;
      if (want === on) { if (want) { hideNative(); schedule(); } return; }
      on = want;
      box.hidden = !on;
      if (on) {
        hideNative();
        map.on('move', onMove);
        map.on('idle', onMove);
        map.on('sourcedata', onMove);
        schedule();
      } else {
        map.off('move', onMove);
        map.off('idle', onMove);
        map.off('sourcedata', onMove);
        clearTimeout(raf);
        cancelAnimationFrame(raf);
        raf = 0;
        showNative();
        for (const el of pool) el.style.display = 'none';
      }
    },
  };
}
