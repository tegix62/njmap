// PlayStation-era rendering for a map, as a post-process on what MapLibre already draws.
//
//   const retro = createRetro(map);
//   retro.apply(0);   // off
//   retro.apply(1);   // "PS2": a little soft, slightly crushed colour, gentle fog, faint film grain
//   retro.apply(2);   // "PS1": chunky pixels, few colours, ordered dither, short draw distance
//
// What each part is:
//   resolution   map.setPixelRatio(): the map renders into a smaller canvas and the browser scales it up
//                (nearest-neighbour for PS1, so the pixels stay square and hard)
//   colour       an SVG filter that snaps every channel to a few levels (PS1 drew 15-bit colour)
//   dither       a 4x4 Bayer pattern laid over the picture, the way PS1 hid its banding
//   draw distance fog from the map's sky settings: distant terrain fades to the fog colour
// Not done (MapLibre has no vertex stage to hook): the PS1's vertex wobble and affine texture warping.
// The panels, text and buttons are DOM above the map and stay sharp.

const LEVELS = [
  null,
  { name: 'PS2', ratio: 0.8, smooth: true, levels: 0, dither: 0.0, grain: 0.07, fog: 0.35, tone: 'contrast(1.08) saturate(1.12)' },
  { name: 'PS1', ratio: 0.38, smooth: false, levels: 7, dither: 0.3, grain: 0, fog: 0.75, tone: 'contrast(1.12) saturate(1.05)' },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

// 4x4 ordered-dither matrix as one tiny SVG tile of grey squares
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayerUri = () => {
  const r = BAYER.map((v, i) => `<rect x='${i % 4}' y='${Math.floor(i / 4)}' width='1' height='1' fill='${v < 8 ? '#000' : '#fff'}' fill-opacity='${(Math.abs(v - 7.5) / 7.5).toFixed(2)}'/>`).join('');
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4' shape-rendering='crispEdges'>${r}</svg>`)}")`;
};

export function createRetro(map) {
  let level = 0, savedRatio = null, savedSky, filterEl = null, ditherEl = null;

  function ensureFilter(n) {
    if (!filterEl) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;pointer-events:none';
      svg.innerHTML = '<filter id="retroPost" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR id="rfR" type="discrete"/><feFuncG id="rfG" type="discrete"/><feFuncB id="rfB" type="discrete"/></feComponentTransfer></filter>';
      document.body.appendChild(svg);
      filterEl = svg;
    }
    const t = Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(' ');
    for (const id of ['rfR', 'rfG', 'rfB']) filterEl.querySelector('#' + id).setAttribute('tableValues', t);
  }
  function ensureDither() {
    if (ditherEl) return;
    ditherEl = document.createElement('div');
    ditherEl.id = 'retroDither';
    ditherEl.setAttribute('aria-hidden', 'true');
    ditherEl.style.backgroundImage = bayerUri();
    document.body.appendChild(ditherEl);
  }

  return {
    get level() { return level; },
    get name() { return level ? LEVELS[level].name : 'Off'; },
    apply(want) {
      want = Math.max(0, Math.min(2, want | 0));
      const L = LEVELS[want];
      const canvas = map.getCanvas();
      if (want && !level) {
        savedRatio = map.getPixelRatio ? map.getPixelRatio() : window.devicePixelRatio || 1;
        try { savedSky = map.getSky ? map.getSky() : undefined; } catch { savedSky = undefined; }
      }
      level = want;
      document.body.dataset.retro = want ? String(want) : '';
      if (!L) {
        if (savedRatio != null && map.setPixelRatio) map.setPixelRatio(savedRatio);
        canvas.style.imageRendering = '';
        canvas.style.filter = '';
        try { if (map.setSky) map.setSky(savedSky || { 'sky-color': '#000000', 'sky-horizon-blend': 0, 'horizon-color': '#000000', 'horizon-fog-blend': 0, 'fog-color': '#000000', 'fog-ground-blend': 0, 'atmosphere-blend': 0 }); } catch { /* older MapLibre: no sky */ }
        if (ditherEl) ditherEl.hidden = true;
        return;
      }
      // resolution: one rendered pixel = 1/ratio css pixels (the base ratio is the screen's own, so it looks the same on every phone)
      if (map.setPixelRatio) map.setPixelRatio(L.ratio);
      canvas.style.imageRendering = L.smooth ? '' : 'pixelated';
      // colour: snap channels, plus a little contrast
      let f = L.tone;
      if (L.levels) { ensureFilter(L.levels); f += ' url(#retroPost)'; }
      canvas.style.filter = f;
      // dither / grain
      ensureDither();
      ditherEl.hidden = !(L.dither || L.grain);
      ditherEl.style.opacity = String(L.dither || L.grain);
      ditherEl.style.imageRendering = 'pixelated';
      ditherEl.style.backgroundSize = want === 2 ? '6px 6px' : '3px 3px';
      // draw distance
      try {
        const fog = document.body.classList.contains('paper') ? '#efe8b4' : want === 2 ? '#02101a' : '#031722';
        if (map.setSky) map.setSky({ 'sky-color': fog, 'horizon-color': fog, 'fog-color': fog, 'sky-horizon-blend': 0.6, 'horizon-fog-blend': L.fog, 'fog-ground-blend': L.fog * 0.8, 'atmosphere-blend': 0 });
      } catch { /* no sky support: skip the fog */ }
    },
  };
}

/**
 * Town names as DOM text above the map, for when the map itself is drawn at PS1 resolution (map text would be
 * blocky and hard to read). They are placed with map.project, keep a few pixels apart, and take their look from
 * `.px-label` in css/app.css (hard stepped shadow, small caps, like a PS1 menu).
 */
export function createLabels(map) {
  const box = document.createElement('div');
  box.id = 'pxLabels';
  box.setAttribute('aria-hidden', 'true');
  map.getContainer().appendChild(box);
  let items = [], shown = false;

  function place() {
    if (!shown) return;
    const taken = [];
    for (const it of items) {
      const s = map.project(it.pt);
      const w = it.el.offsetWidth || it.name.length * 8 + 10, h = 16;
      const r = { x: s.x - w / 2, y: s.y - h / 2, w, h };
      const clash = taken.some((t) => r.x < t.x + t.w + 4 && r.x + r.w + 4 > t.x && r.y < t.y + t.h + 2 && r.y + r.h + 2 > t.y);
      it.el.style.visibility = clash ? 'hidden' : 'visible';
      it.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      if (!clash) taken.push(r);
    }
  }
  map.on('render', place);

  return {
    /** list: [{ n: name, pt: [lng, lat] }] */
    set(list) {
      box.textContent = '';
      items = list.map((m) => {
        const el = document.createElement('div');
        el.className = 'px-label';
        el.textContent = m.n;
        box.appendChild(el);
        return { el, name: m.n, pt: m.pt };
      });
      place();
    },
    show(on) { shown = !!on; box.hidden = !on; place(); },
  };
}
