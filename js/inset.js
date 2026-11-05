// Drive's overview circle: a small zoomed-out picture of the town you're in
// and the towns around it, with you in the middle. It turns with you when the
// map does (heading-up) and stays north-up when the map does, so it always
// matches the big map's orientation, just from higher up.
// Drawn from the town boundaries, not map tiles: it works offline and stays
// legible at a glance.

const SIZE = 132; // px
const R_PX = SIZE / 2;
const SVGNS = 'http://www.w3.org/2000/svg';

export function initInset(ctx) {
  const wrap = document.createElement('div');
  wrap.id = 'inset';
  wrap.hidden = true;
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs><clipPath id="insetClip"><circle cx="${R_PX}" cy="${R_PX}" r="${R_PX - 1}"/></clipPath></defs>
    <circle class="bg" cx="${R_PX}" cy="${R_PX}" r="${R_PX - 1}"/>
    <g clip-path="url(#insetClip)"><g class="world"><g class="towns"></g><g class="counties"></g></g><g class="labels"></g></g>
    <circle class="rim" cx="${R_PX}" cy="${R_PX}" r="${R_PX - 1}"/>
    <g class="me"><circle class="dot" cx="${R_PX}" cy="${R_PX}" r="5"/><path d="M${R_PX} ${R_PX - 9} L${R_PX + 6} ${R_PX + 6} L${R_PX} ${R_PX + 3} L${R_PX - 6} ${R_PX + 6} Z"/></g>
    <g class="north"><circle r="8"/><text dy="3.5">N</text></g>
  </svg>`;
  document.body.appendChild(wrap);
  const svg = wrap.querySelector('svg');
  const world = svg.querySelector('.world');
  const townsG = svg.querySelector('.towns');
  const countiesG = svg.querySelector('.counties');
  const labelsG = svg.querySelector('.labels');
  const meG = svg.querySelector('.me');
  const northG = svg.querySelector('.north');

  let built = null; // { town, ref, kx, ky, s, labels:[{el,x,y}] }
  const el = (tag, attrs, text) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };

  /** Radius shown, in miles: enough for the whole town plus a band of neighbors. */
  function radiusMi(m, kx, ky) {
    const [x0, y0, x1, y1] = m.bbox;
    const half = Math.hypot((x1 - x0) * kx, (y1 - y0) * ky) / 2;
    const city = !!ctx.region.gridAngle;
    return Math.min(city ? 1.6 : 7, Math.max(city ? 0.35 : 1.6, half * 1.25));
  }

  function build(m) {
    const ref = m.pt;
    const ky = 69.05;
    const kx = 69.17 * Math.cos((ref[1] * Math.PI) / 180);
    const R = radiusMi(m, kx, ky);
    const s = R_PX / R; // px per mile
    const P = (c) => [((c[0] - ref[0]) * kx * s).toFixed(1), (-(c[1] - ref[1]) * ky * s).toFixed(1)];
    const pathOf = (geom) => {
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      let d = '';
      for (const poly of polys) for (const ring of poly) d += ring.map((c, k) => (k ? 'L' : 'M') + P(c).join(',')).join('') + 'Z';
      return d;
    };
    // everything within reach of anywhere you could be in this town
    const [bx0, by0, bx1, by1] = m.bbox;
    const padX = (2 * R) / kx, padY = (2 * R) / ky;
    const near = ctx.munis.filter((o) => o.bbox[2] >= bx0 - padX && o.bbox[0] <= bx1 + padX && o.bbox[3] >= by0 - padY && o.bbox[1] <= by1 + padY);
    townsG.replaceChildren(
      ...near.map((o) => el('path', { d: pathOf(o.geom), class: o === m ? 'cur' : 'other', 'fill-rule': 'evenodd' }))
    );
    // county lines on top, a little heavier (NJ only)
    const cfc = ctx.countyShapes;
    countiesG.replaceChildren(
      ...(cfc && !ctx.region.gridAngle
        ? cfc.features
            .filter((f) => near.some((o) => o.c === f.properties.c))
            .map((f) => el('path', { d: pathOf(f.geometry), class: 'county', 'fill-rule': 'evenodd' }))
        : [])
    );
    // Label each neighbor where most of its visible part is: sample a grid over
    // the area and average the samples that land in each town.
    const acc = new Map();
    const N = 18;
    for (let i = 0; i <= N; i++)
      for (let j = 0; j <= N; j++) {
        const pt = [bx0 - padX / 2 + ((bx1 - bx0 + padX) * i) / N, by0 - padY / 2 + ((by1 - by0 + padY) * j) / N];
        const o = ctx.locate(pt);
        if (!o || o === m) continue;
        const a = acc.get(o) || { x: 0, y: 0, n: 0 };
        a.x += pt[0];
        a.y += pt[1];
        a.n++;
        acc.set(o, a);
      }
    const labels = [];
    labelsG.replaceChildren();
    // only the towns that touch this one: the ones you could drive into next
    for (const [o, a] of acc) {
      if (a.n < 3 || (m.neighbors && !m.neighbors.includes(o))) continue;
      const [x, y] = P([a.x / a.n, a.y / a.n]).map(Number);
      const t = el('text', {}, shortName(o));
      labelsG.appendChild(t);
      labels.push({ el: t, x, y, w: 0, n: a.n });
    }
    labels.sort((p, q) => q.n - p.n); // bigger visible share first: they win overlaps
    built = { town: m, ref, kx, ky, s, labels };
  }

  const shortName = (o) => o.n.replace(/ (Township|Borough|City|Town|Village)$/, '');

  function update(pt, heading, m, northUp) {
    if (!m || !pt) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    if (!built || built.town !== m) build(m);
    const { ref, kx, ky, s, labels } = built;
    const x = (pt[0] - ref[0]) * kx * s;
    const y = -(pt[1] - ref[1]) * ky * s;
    const rot = northUp || heading == null ? 0 : -heading;
    world.setAttribute('transform', `translate(${R_PX} ${R_PX}) rotate(${rot}) translate(${-x} ${-y})`);
    // Labels stay upright and inside the circle: a neighbor that's off the
    // edge is named at the edge, in its direction.
    const a0 = (rot * Math.PI) / 180, ca = Math.cos(a0), sa = Math.sin(a0);
    const boxes = [];
    for (const l of labels) {
      if (!l.w) l.w = l.el.getComputedTextLength() || l.el.textContent.length * 5.5;
      let dx = (l.x - x) * ca - (l.y - y) * sa;
      let dy = (l.x - x) * sa + (l.y - y) * ca;
      const d = Math.hypot(dx, dy);
      const maxR = R_PX - 12;
      if (d > maxR) {
        dx *= maxR / d;
        dy *= maxR / d;
      }
      const half = Math.sqrt(Math.max(0, (R_PX - 4) ** 2 - dy * dy)) - l.w / 2;
      dx = Math.max(-half, Math.min(half, dx));
      // skip one that would sit on top of a label already placed
      const box = [dx - l.w / 2 - 2, dy - 7, dx + l.w / 2 + 2, dy + 7];
      const hit = boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
      l.el.style.display = hit ? 'none' : '';
      if (hit) continue;
      boxes.push(box);
      l.el.setAttribute('x', (R_PX + dx).toFixed(1));
      l.el.setAttribute('y', (R_PX + dy).toFixed(1));
    }
    // your arrow: points up when the map turns with you, else along your heading
    const arrow = heading == null ? 0 : northUp ? heading : 0;
    meG.setAttribute('transform', `rotate(${arrow} ${R_PX} ${R_PX})`);
    meG.classList.toggle('no-heading', heading == null);
    // N on the rim, where north is
    const a = (rot * Math.PI) / 180;
    northG.setAttribute('transform', `translate(${R_PX + Math.sin(a) * (R_PX - 9)} ${R_PX - Math.cos(a) * (R_PX - 9)})`);
  }

  return {
    update,
    hide: () => (wrap.hidden = true),
    reset: () => (built = null),
    el: wrap,
  };
}
