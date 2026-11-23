// Game feel: small sounds (synthesised with Web Audio, no files), a phone buzz, bursts of leaves, a shake, a count-up. Every effect is
// skippable: sound has a mute switch (remembered), and motion stays still for people who ask their system for reduced motion.
import { store } from './store.js';

let ctx = null;
const muted = () => store.get('juice.mute', false);
const still = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function ac() {
  if (ctx) return ctx;
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return null;
  try { ctx = new A(); } catch { ctx = null; }
  return ctx;
}
/** One soft note: a sine (or triangle) with a quick attack and a gentle fade. */
function note(freq, at = 0, dur = 0.16, type = 'sine', vol = 0.12) {
  const a = ac(); if (!a || muted()) return;
  if (a.state === 'suspended') a.resume().catch(() => {});
  const t0 = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];            // a pentatonic climb: each answer in a row, one step higher
const hz = (semi, base = 523.25) => base * Math.pow(2, semi / 12);

export const juice = {
  get muted() { return muted(); },
  setMuted(v) { store.set('juice.mute', !!v); },
  buzz(ms = 12) { if (!muted() && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* not on this device */ } },
  tap() { note(880, 0, 0.05, 'triangle', 0.05); },
  /** A right answer; `streak` (1, 2, 3, ...) climbs the scale. */
  right(streak = 1) {
    const s = SCALE[Math.min(SCALE.length - 1, Math.max(0, streak - 1))];
    note(hz(s), 0, 0.14, 'triangle', 0.11); note(hz(s + 7), 0.07, 0.2, 'sine', 0.08);
    if (streak > 0 && streak % 5 === 0) [0, 4, 7, 12].forEach((d, i) => note(hz(s + d, 1046.5), 0.18 + i * 0.06, 0.18, 'sine', 0.06));
    this.buzz(10);
  },
  wrong() { note(196, 0, 0.18, 'triangle', 0.1); note(174.6, 0.08, 0.22, 'sine', 0.08); this.buzz([30, 40, 30]); },
  done(good = true) { (good ? [0, 4, 7, 12, 16] : [0, 3, 7]).forEach((d, i) => note(hz(d), i * 0.09, 0.26, 'triangle', 0.09)); },

  /** A burst of small leaves flying out of `el` (the leaf picture `src`, or green dots without one). */
  burst(el, src, n = 9) {
    if (!el || still()) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const p = document.createElement(src ? 'img' : 'span');
      p.className = 'jc-leaf'; if (src) { p.src = src; p.alt = ''; }
      p.style.left = `${cx}px`; p.style.top = `${cy}px`;
      document.body.appendChild(p);
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6, d = 50 + Math.random() * 60, rot = (Math.random() - 0.5) * 540;
      const dx = Math.cos(ang) * d, dy = Math.sin(ang) * d - 30;
      p.animate([{ transform: 'translate(-50%,-50%) scale(0.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 70}px)) scale(0.9) rotate(${rot}deg)`, opacity: 0 }],
        { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => p.remove();
    }
  },
  /** Leaves drifting down the whole screen, for a good round. */
  fall(srcs, n = 16) {
    if (still()) return;
    for (let i = 0; i < n; i++) {
      const p = document.createElement(srcs && srcs.length ? 'img' : 'span');
      p.className = 'jc-leaf big'; if (srcs && srcs.length) { p.src = srcs[i % srcs.length]; p.alt = ''; }
      p.style.left = `${Math.random() * 100}vw`; p.style.top = '-40px';
      document.body.appendChild(p);
      const sway = (Math.random() - 0.5) * 120, rot = (Math.random() - 0.5) * 720;
      p.animate([{ transform: 'translate(-50%,0) rotate(0deg)' }, { transform: `translate(calc(-50% + ${sway}px), 55vh) rotate(${rot / 2}deg)`, offset: 0.5 },
        { transform: `translate(calc(-50% - ${sway / 2}px), 110vh) rotate(${rot}deg)` }],
        { duration: 2600 + Math.random() * 1800, delay: Math.random() * 900, easing: 'ease-in' }).onfinish = () => p.remove();
    }
  },
  shake(el) { if (el && !still()) el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }], { duration: 320 }); },
  pop(el) { if (el && !still()) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }, { transform: 'scale(0.98)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out' }); },
  /** Count a number up in `el`. */
  countUp(el, to, ms = 700) {
    if (!el) return;
    if (still()) { el.textContent = String(to); return; }
    const t0 = performance.now(), step = (t) => { const k = Math.min(1, (t - t0) / ms); el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  },
};
