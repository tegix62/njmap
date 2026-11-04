// Your own reference places (home, work, family…). People organize what they
// know about an area around a few well-known anchor points (Couclelis et al.,
// 1987), so the app relates towns to yours: "Clifton is 8 mi SE of Home".
// Stored on this device only.
import { store } from './store.js';
import { distanceMi, bearing, compass8, angleDiff } from './geo.js';

const MAX = 10;

export function initAnchors(ctx) {
  const { map } = ctx;
  let list = store.get('anchors', []);

  function save() {
    store.set('anchors', list);
    map.getSource('anchors').setData(ctx.anchorsData(list));
  }

  const api = {
    list: () => list,
    add(name, pt) {
      list = [...list.filter((a) => a.name !== name), { name, pt }].slice(-MAX);
      save();
    },
    remove(i) {
      list = list.filter((_, j) => j !== i);
      save();
    },
    /** Nearest anchor to pt: {a, d, dir} or null. */
    nearest(pt) {
      let best = null;
      for (const a of list) {
        const d = distanceMi(a.pt, pt);
        if (!best || d < best.d) best = { a, d, dir: compass8(bearing(a.pt, pt)) };
      }
      return best;
    },
    /** "8.1 mi SE of Home" for pt, relative to the nearest anchor. */
    phrase(pt) {
      const n = api.nearest(pt);
      if (!n || n.d < 0.3) return n ? `at ${n.a.name}` : '';
      return `${n.d < 10 ? n.d.toFixed(1) : Math.round(n.d)} mi ${n.dir} of ${n.a.name}`;
    },
    /** Where each anchor is from you, relative to the way you're facing. */
    fromYou(pt, heading) {
      return list
        .map((a) => {
          const d = distanceMi(pt, a.pt);
          const b = bearing(pt, a.pt);
          return { a, d, dir: compass8(b), rel: heading == null ? null : relWord(angleDiff(b, heading)) };
        })
        .sort((x, y) => x.d - y.d);
    },
  };

  // ---- adding a place by tapping the map --------------------------------------
  let pending = null;
  api.startPick = (name) => {
    pending = name;
    document.body.classList.add('picking');
    ctx.toast(`Tap the map to place “${name}”`, 6000);
  };
  // Registered before the modes' click handlers, so it can claim the tap.
  map.on('click', (e) => {
    if (!pending) return;
    e.handledByAnchor = true;
    api.add(pending, [e.lngLat.lng, e.lngLat.lat]);
    ctx.toast(`Saved “${pending}”`);
    pending = null;
    document.body.classList.remove('picking');
  });

  return api;
}

/** Signed angle (deg, + = clockwise) -> "ahead", "ahead-right", … */
function relWord(d) {
  const a = Math.abs(d);
  const side = d > 0 ? 'right' : 'left';
  if (a <= 22.5) return 'ahead';
  if (a <= 67.5) return `ahead-${side}`;
  if (a <= 112.5) return side;
  if (a <= 157.5) return `behind-${side}`;
  return 'behind';
}
