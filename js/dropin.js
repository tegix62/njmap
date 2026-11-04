// Drop in: a county with some towns cut out. Each missing town falls from the
// top as a piece shaped exactly like it (at map scale), labeled with its
// name; drag it into its hole before it reaches the bottom. Pieces fall
// faster as you go. Ties together a place's name, shape and location.

const PIECES = 6;
const FIRST_FALL_S = 16; // seconds for the first piece to fall the whole way
const MIN_FALL_S = 7;

export function initDropIn(ctx) {
  const { map } = ctx;
  let g = null; // the running game
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function lockMap(lock) {
    for (const h of ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate']) {
      if (lock) map[h].disable();
      else map[h].enable();
    }
  }

  /** Pick the county: the chosen county area, or one with well-known towns from the pool. */
  function pickCounty(pool, area) {
    if (area && area.startsWith('county:')) return area.slice(7);
    const known = pool.filter((m) => m.wellKnown);
    return rand(known.length ? known : pool).c;
  }

  function start(opts) {
    stop();
    const county = pickCounty(opts.pool, opts.area);
    const towns = ctx.munis.filter((m) => m.c === county);
    const ranked = shuffle([...towns]).sort((a, b) => (b.wellKnown ? 1 : 0) - (a.wellKnown ? 1 : 0));
    const pieces = shuffle(ranked.slice(0, Math.min(PIECES, Math.max(3, towns.length - 2))));
    g = { opts, county, towns, pieces, i: 0, placed: 0, misses: 0, firstTry: 0, el: null, raf: 0, done: false };
    ctx.clearHighlights();
    ctx.reveal([]);
    lockMap(true);
    document.body.classList.add('dropping');
    for (const m of towns) ctx.highlight(m.id, pieces.includes(m) ? 'hole' : 'near');
    render();
    requestAnimationFrame(() => {
      ctx.fit(towns, 13, { bearing: 0, duration: 1000 });
      map.once('moveend', () => g && nextPiece());
    });
  }

  function stop() {
    if (!g) return;
    cancelAnimationFrame(g.raf);
    if (g.el) g.el.remove();
    g = null;
    lockMap(false);
    document.body.classList.remove('dropping');
  }

  function render(extra = '') {
    if (!g) return;
    ctx.hud(
      `<div class="qkind">🧩 Drop in</div><div class="q">${esc(ctx.groupName(g.county))}: drag each ${esc(ctx.region.unit)} into its hole</div>`
    );
    ctx.sheet(
      `${g.opts.header()}<div id="qbody"><div class="hint">${[
        g.done ? '' : `Piece ${Math.min(g.i, g.pieces.length)} of ${g.pieces.length}`,
        g.misses ? `${g.misses} miss${g.misses === 1 ? '' : 'es'}` : '',
      ]
        .filter(Boolean)
        .join(' · ')}</div>${extra}</div>`
    );
    g.opts.bindHeader();
    const again = document.getElementById('dropAgain');
    if (again) again.addEventListener('click', () => start(g.opts));
  }

  /** The town's outline as an SVG path at the current map scale. */
  function pieceSVG(m) {
    const polys = m.geom.type === 'Polygon' ? [m.geom.coordinates] : m.geom.coordinates;
    const pts = [];
    for (const poly of polys) for (const ring of poly) for (const c of ring) pts.push(map.project(c));
    const minX = Math.min(...pts.map((p) => p.x)), minY = Math.min(...pts.map((p) => p.y));
    const maxX = Math.max(...pts.map((p) => p.x)), maxY = Math.max(...pts.map((p) => p.y));
    let d = '';
    for (const poly of polys)
      for (const ring of poly) {
        d += ring.map((c, k) => {
          const p = map.project(c);
          return `${k ? 'L' : 'M'}${(p.x - minX).toFixed(1)},${(p.y - minY).toFixed(1)}`;
        }).join('') + 'Z';
      }
    return { d, w: maxX - minX, h: maxY - minY, x: minX, y: minY };
  }

  function nextPiece() {
    if (!g) return;
    if (g.i >= g.pieces.length) return finish();
    const m = g.pieces[g.i++];
    const shape = pieceSVG(m);
    const rect = map.getContainer().getBoundingClientRect();
    const pad = ctx.padding();
    const el = document.createElement('div');
    el.className = 'piece';
    el.innerHTML = `<svg width="${shape.w + 4}" height="${shape.h + 4}" viewBox="-2 -2 ${shape.w + 4} ${shape.h + 4}"><path d="${shape.d}" fill-rule="evenodd"/></svg><span>${esc(ctx.name(m))}</span>`;
    document.body.appendChild(el);
    const top = rect.top + pad.top;
    const bottom = rect.top + rect.height - pad.bottom;
    const fallS = Math.max(MIN_FALL_S, FIRST_FALL_S - 1.5 * (g.i - 1));
    const piece = {
      m,
      shape,
      el,
      x: rect.left + Math.max(8, Math.min(rect.width - shape.w - 8, (rect.width - shape.w) / 2)),
      y: top,
      speed: (bottom - top) / fallS, // px per second
      bottom,
      dragging: false,
      tries: 0,
      t: performance.now(),
    };
    g.cur = piece;
    g.el = el;
    // where it belongs, in screen coordinates (handy for testing)
    el.dataset.tx = rect.left + shape.x;
    el.dataset.ty = rect.top + shape.y;
    place(piece);
    bindDrag(piece);
    render();
    const step = (now) => {
      if (!g || g.cur !== piece) return;
      const dt = (now - piece.t) / 1000;
      piece.t = now;
      if (!piece.dragging) piece.y += piece.speed * dt;
      place(piece);
      if (piece.y + Math.min(piece.shape.h, 40) >= piece.bottom) return landed(piece);
      g.raf = requestAnimationFrame(step);
    };
    g.raf = requestAnimationFrame(step);
  }

  function place(p) {
    p.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  function bindDrag(p) {
    let ox = 0, oy = 0;
    p.el.addEventListener('pointerdown', (e) => {
      p.dragging = true;
      p.el.setPointerCapture(e.pointerId);
      ox = e.clientX - p.x;
      oy = e.clientY - p.y;
      p.el.classList.add('held');
    });
    p.el.addEventListener('pointermove', (e) => {
      if (!p.dragging) return;
      p.x = e.clientX - ox;
      p.y = e.clientY - oy;
      place(p);
    });
    p.el.addEventListener('pointerup', () => {
      if (!p.dragging) return;
      p.dragging = false;
      p.t = performance.now();
      p.el.classList.remove('held');
      check(p);
    });
  }

  /** Close enough to its hole? (within a third of its size, or 24 px) */
  function check(p) {
    const rect = map.getContainer().getBoundingClientRect();
    const tx = rect.left + p.shape.x;
    const ty = rect.top + p.shape.y;
    const tol = Math.max(24, 0.33 * Math.min(p.shape.w, p.shape.h));
    if (Math.hypot(p.x - tx, p.y - ty) <= tol) return placed(p, tx, ty);
    p.tries++;
    g.misses++;
    p.el.classList.remove('shake');
    void p.el.offsetWidth;
    p.el.classList.add('shake');
    render();
  }

  function placed(p, tx, ty) {
    cancelAnimationFrame(g.raf);
    p.x = tx;
    p.y = ty;
    p.el.classList.add('snap');
    place(p);
    if (p.tries === 0) g.firstTry++;
    g.opts.record(p.m, p.tries === 0);
    setTimeout(() => {
      if (!g) return;
      p.el.remove();
      ctx.highlight(p.m.id, 'good');
      revealPlaced();
      g.placed++;
      setTimeout(() => g && nextPiece(), 250);
    }, 280);
  }

  function landed(p) {
    // It hit the bottom: show where it went, count it as a miss, move on.
    cancelAnimationFrame(g.raf);
    g.misses++;
    g.opts.record(p.m, false);
    p.el.remove();
    ctx.highlight(p.m.id, 'bad');
    revealPlaced(p.m);
    render();
    setTimeout(() => g && nextPiece(), 1300);
  }

  function revealPlaced(missed) {
    const items = g.pieces
      .slice(0, g.i)
      .filter((m) => m !== g.cur?.m || missed)
      .map((m) => ({ m, color: m === missed ? ctx.theme.label.bad : ctx.theme.label.good, key: m === missed }));
    ctx.reveal(items);
  }

  function finish() {
    g.done = true;
    g.cur = null;
    lockMap(false);
    document.body.classList.remove('dropping');
    ctx.showLabels(true);
    render(
      `<div class="fb ${g.firstTry >= g.pieces.length - 1 ? 'ok' : 'no'}">${g.firstTry} of ${g.pieces.length} placed on the first try.</div><button class="primary" id="dropAgain">Another county</button>`
    );
  }

  return { start, stop, get running() {
    return !!g;
  } };
}
