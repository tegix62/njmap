// Shared button feel: every button presses in and springs back (chosen in the feel lab:
// "spring snappy", 40% faster = stiffness x1.96, damping x1.4, same damping ratio).
// Uses the `scale` property so it never fights a button's own transform.
export const MOTION = {
  press: { k: 1019, c: 42, depth: 0.94, minHoldMs: 70 },
};

const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const anims = new WeakMap();
const live = new Set();
let raf = 0, last = 0;

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  for (const a of [...live]) {
    const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
    for (let i = 0; i < n; i++) {
      a.vel += (-MOTION.press.k * (a.v - a.tgt) - MOTION.press.c * a.vel) * h;
      a.v += a.vel * h;
    }
    if (Math.abs(a.v - a.tgt) < 0.0003 && Math.abs(a.vel) < 0.004) {
      a.v = a.tgt;
      a.vel = 0;
      live.delete(a);
    }
    a.el.style.scale = a.v === 1 ? '' : a.v.toFixed(4);
  }
  raf = live.size ? requestAnimationFrame(frame) : 0;
}

function to(el, tgt) {
  let a = anims.get(el);
  if (!a) anims.set(el, (a = { el, v: 1, vel: 0, tgt: 1, down: 0 }));
  a.tgt = tgt;
  live.add(a);
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  return a;
}

const pressed = new Set();
function target(e) {
  const b = e.target && e.target.closest ? e.target.closest('button, .pressable') : null;
  return b && !b.disabled ? b : null;
}
function release(b) {
  const a = anims.get(b);
  const wait = a ? Math.max(0, MOTION.press.minHoldMs - (performance.now() - a.down)) : 0;
  setTimeout(() => {
    pressed.delete(b);
    to(b, 1);
  }, wait);
}
document.addEventListener('pointerdown', (e) => {
  if (reduce()) return;
  const b = target(e);
  if (!b) return;
  to(b, MOTION.press.depth).down = performance.now();
  pressed.add(b);
}, { passive: true, capture: true });
const up = () => pressed.forEach(release);
document.addEventListener('pointerup', up, { passive: true, capture: true });
document.addEventListener('pointercancel', up, { passive: true, capture: true });
