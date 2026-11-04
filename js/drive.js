/* global maplibregl */
import { bearing, destination, distanceMi, compass8, compass16, dirWord, angleDiff } from './geo.js';

const MIN_MOVING_MPS = 2; // ~4.5 mph; below this GPS course is noise
const LOOK_STEP_MI = 0.08;

export function initDrive(ctx) {
  const { map, settings, store } = ctx;
  const st = {
    watchId: null,
    cur: null, // municipality we're in
    pending: null,
    pendingN: 0,
    heading: null, // degrees, best estimate
    gpsHeading: false, // true when heading comes from movement
    compassHeading: null,
    lastFix: null,
    follow: true,
    look: null,
    lookAt: 0,
    wake: null,
    error: null,
    active: false,
  };
  let visited = store.get('visited', {});

  // ---- position marker ------------------------------------------------------
  const el = document.createElement('div');
  el.className = 'me';
  el.innerHTML =
    '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">' +
    '<circle cx="20" cy="20" r="9" fill="#2563eb" stroke="#fff" stroke-width="3"/>' +
    '<path class="me-arrow" d="M20 2 L27 14 L20 11 L13 14 Z" fill="#2563eb" stroke="#fff" stroke-width="1.5"/></svg>';
  const marker = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' });

  // ---- geolocation ----------------------------------------------------------
  function start() {
    if (!('geolocation' in navigator)) {
      st.error = 'This browser has no location support.';
      render();
      return;
    }
    // iOS needs a user gesture to unlock speech and the compass.
    if (settings.voice && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('Location on.');
      u.volume = 0.6;
      speechSynthesis.speak(u);
    }
    if (settings.phoneCompass) enableCompass();
    st.error = null;
    st.watchId = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 30000,
    });
    store.set('tracking', true);
    requestWake();
    render();
  }

  function stop() {
    if (st.watchId != null) navigator.geolocation.clearWatch(st.watchId);
    st.watchId = null;
    store.set('tracking', false);
    releaseWake();
    render();
  }

  function onError(e) {
    st.error =
      e.code === 1
        ? 'Location permission was denied. Allow location for this site in your browser settings, then tap Start.'
        : e.code === 3
          ? 'Still waiting for a GPS fix…'
          : 'Location unavailable right now.';
    if (e.code === 1) stop();
    render();
  }

  function onFix(pos) {
    const c = pos.coords;
    const pt = [c.longitude, c.latitude];
    const speed = c.speed == null || Number.isNaN(c.speed) ? null : c.speed;

    // Heading: GPS course when moving; otherwise bearing between fixes; else compass.
    let h = null;
    if (c.heading != null && !Number.isNaN(c.heading) && speed != null && speed >= MIN_MOVING_MPS) h = c.heading;
    else if (st.lastFix && distanceMi(st.lastFix.pt, pt) > 0.02 && (speed == null || speed >= MIN_MOVING_MPS))
      h = bearing(st.lastFix.pt, pt);
    if (h != null) {
      st.heading = h;
      st.gpsHeading = true;
    } else if (speed != null && speed < MIN_MOVING_MPS) {
      st.gpsHeading = false;
      if (st.compassHeading != null) st.heading = st.compassHeading;
    }
    if (!st.lastFix || distanceMi(st.lastFix.pt, pt) > 0.02) st.lastFix = { pt };

    ctx.pos = { pt, acc: c.accuracy, speed, heading: st.heading, t: pos.timestamp };
    st.error = null;

    // Which town? Require two agreeing fixes before switching, so GPS jitter
    // along a border doesn't flap back and forth.
    const m = ctx.locate(pt);
    if (m !== st.cur) {
      if (m === st.pending) st.pendingN++;
      else {
        st.pending = m;
        st.pendingN = 1;
      }
      if (st.cur == null || st.pendingN >= 2 || c.accuracy < 25) enterTown(m);
    } else st.pending = null;

    marker.setLngLat(pt);
    if (!marker._map) marker.addTo(map);
    el.classList.toggle('no-heading', st.heading == null);
    if (st.heading != null) marker.setRotation(st.heading);

    const now = Date.now();
    if (now - st.lookAt > 2000) {
      st.look = lookAround(pt, st.heading);
      st.near = nearestSection(pt, st.cur);
      st.lookAt = now;
    }
    if (ctx.mode === 'drive') {
      if (st.follow) camera();
      render();
    }
    ctx.updateEdges();
  }

  function enterTown(m) {
    const prev = st.cur;
    st.cur = m;
    st.pending = null;
    st.lookAt = 0;
    if (ctx.mode === 'drive') {
      if (prev) ctx.highlight(prev.id, null);
      if (m) ctx.highlight(m.id, 'cur');
    }
    if (m) {
      visited[m.key] = Date.now();
      store.set('visited', visited);
    }
    // Speak on every change after the first fix.
    const first = !st.hadFix;
    st.hadFix = true;
    if (!first) announce(m, prev);
  }

  function announce(m, prev) {
    if (!m) {
      ctx.speak('Leaving New Jersey.');
      return;
    }
    let s = `Entering ${m.n}`;
    if (m.dup) s += ` ${m.t}`;
    if (!prev || prev.c !== m.c) s += `, ${m.c} County`;
    s += '.';
    if (st.heading != null && st.gpsHeading) s += ` Heading ${dirWord(compass8(st.heading))}.`;
    if (settings.voiceHints) {
      const twin = confusedWith(m);
      if (twin) s += ` Not ${twin.n} — that's ${ctx.relative(m.pt, twin.pt).words}.`;
    }
    ctx.speak(s);
  }

  /** The sound-alike to contrast with: from the first curated group listing
   *  this town (your own pairs go first in confusables.js), the most populous
   *  other member at least a few miles away. */
  function confusedWith(m) {
    for (const g of ctx.confusables.byId.get(m.id) || []) {
      if (!g.curated) continue;
      const others = g.members.filter((o) => o.n !== m.n && distanceMi(m.pt, o.pt) > 3).sort((a, b) => b.p - a.p);
      if (others.length) return others[0];
    }
    return null;
  }

  // ---- what's ahead / left / right -----------------------------------------
  function probe(pt, dir, maxMi) {
    const here = ctx.locate(pt);
    for (let d = LOOK_STEP_MI; d <= maxMi; d += LOOK_STEP_MI) {
      const m = ctx.locate(destination(pt, dir, d));
      if (m !== here) return { m, d, dir };
    }
    return null;
  }
  /** Closest named village/section of the current town within 1.5 mi. */
  function nearestSection(pt, m) {
    if (!m) return null;
    let best = null;
    for (const s of ctx.placedSections(m).values()) {
      const d = distanceMi(pt, s.pt);
      if (d <= 1.5 && (!best || d < best.d)) best = { ...s, d };
    }
    return best;
  }

  function lookAround(pt, h) {
    if (h == null) return null;
    return {
      ahead: probe(pt, h, 8),
      left: probe(pt, h - 90, 5),
      right: probe(pt, h + 90, 5),
    };
  }

  // ---- phone compass (only used when stopped) -------------------------------
  function enableCompass() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return;
    const listen = () => {
      const handler = (e) => {
        let h = null;
        if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
        else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;
        if (h == null) return;
        const so = (screen.orientation && screen.orientation.angle) || 0;
        st.compassHeading = (h + so + 360) % 360;
        if (!st.gpsHeading && ctx.pos) {
          const changed = st.heading == null || Math.abs(angleDiff(st.heading, st.compassHeading)) > 4;
          st.heading = st.compassHeading;
          if (changed) {
            marker.setRotation(st.heading);
            el.classList.remove('no-heading');
            if (ctx.mode === 'drive' && st.follow && !settings.northUp) camera(0);
            throttledRender();
          }
        }
      };
      if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', handler);
      else window.addEventListener('deviceorientation', handler);
    };
    if (typeof DOE.requestPermission === 'function') {
      DOE.requestPermission()
        .then((r) => r === 'granted' && listen())
        .catch(() => {});
    } else listen();
  }
  let rt = 0;
  function throttledRender() {
    const now = Date.now();
    if (now - rt > 500) {
      rt = now;
      if (ctx.mode === 'drive') render();
    }
  }

  // ---- screen wake lock -----------------------------------------------------
  async function requestWake() {
    if (!settings.wakeLock || !('wakeLock' in navigator) || st.wake) return;
    try {
      st.wake = await navigator.wakeLock.request('screen');
      st.wake.addEventListener('release', () => (st.wake = null));
    } catch {
      /* not allowed right now */
    }
  }
  function releaseWake() {
    if (st.wake) st.wake.release().catch(() => {});
    st.wake = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && st.watchId != null) requestWake();
  });

  // ---- camera ---------------------------------------------------------------
  function camera(duration = 800) {
    if (!ctx.pos) return;
    const pad = ctx.padding();
    // Put the car in the lower third so more of what's ahead is visible.
    const h = window.innerHeight;
    const extra = settings.northUp ? 0 : Math.max(0, (h - pad.top - pad.bottom) * 0.28);
    const opts = {
      center: ctx.pos.pt,
      bearing: settings.northUp || st.heading == null ? 0 : st.heading,
      // offset (not padding): padding would stick to the map and skew later fits
      offset: [0, (pad.top + extra - pad.bottom) / 2],
      duration,
      essential: true,
    };
    if (map.getZoom() < 11) opts.zoom = 12.5;
    map.easeTo(opts);
  }
  map.on('dragstart', () => {
    if (ctx.mode === 'drive' && st.follow) {
      st.follow = false;
      document.body.classList.add('unfollowed');
    }
  });

  function recenter() {
    st.follow = true;
    document.body.classList.remove('unfollowed');
    if (ctx.pos) camera();
    else start();
  }

  function applyOrientation() {
    document.body.classList.toggle('north-up', !!settings.northUp);
    if (ctx.mode === 'drive' && st.follow) camera(400);
  }
  function toggleOrientation() {
    settings.northUp = !settings.northUp;
    ctx.saveSettings();
    applyOrientation();
    flash(settings.northUp ? 'North-up: map stays fixed, north is always the top edge' : 'Heading-up: map turns with you, watch the N/E/S/W letters on the edges');
  }
  const flash = (msg) => ctx.toast(msg);

  // ---- HUD ------------------------------------------------------------------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const mi = (d) => (d < 0.1 ? '<0.1 mi' : d < 10 ? `${d.toFixed(1)} mi` : `${Math.round(d)} mi`);
  function sideCell(cls, label, r) {
    if (!r) return `<div class="look ${cls}"><span class="k">${label}</span><span class="v muted">—</span></div>`;
    const name = r.m ? esc(ctx.name(r.m)) : 'NJ line / water';
    return `<div class="look ${cls}"><span class="k">${label} <b>${compass8(r.dir)}</b></span><span class="v">${name}</span><span class="d">${mi(r.d)}</span></div>`;
  }

  function render() {
    if (ctx.mode !== 'drive') return;
    const tracking = st.watchId != null;
    if (!tracking) {
      ctx.hud(
        `<div class="town">Where am I?</div>
         <div class="meta">${st.error ? esc(st.error) : 'Shows the town and county you are in, which way you are heading, and what is ahead. Your location never leaves this phone.'}</div>
         <button class="primary" id="startBtn">Start</button>`
      );
      document.getElementById('startBtn').addEventListener('click', start);
      return;
    }
    if (!ctx.pos) {
      ctx.hud(`<div class="town">Finding you…</div><div class="meta">${esc(st.error || 'Waiting for GPS')}</div>`);
      return;
    }
    const m = st.cur;
    const h = st.heading;
    const acc = ctx.pos.acc > 150 ? `<span class="warn">GPS ±${Math.round(ctx.pos.acc)} m</span>` : '';
    const head =
      h == null
        ? `<div class="heading muted">Heading appears once you start moving</div>`
        : `<div class="heading">Heading <b>${dirWord(compass8(h)).toUpperCase()}</b> <span class="deg">${Math.round(h)}° ${compass16(h)}</span></div>
           <div class="lr-key">your left = <b>${compass8(h - 90)}</b> · your right = <b>${compass8(h + 90)}</b></div>`;
    const look = st.look
      ? `<div class="looks">${sideCell('left', '◀ Left', st.look.left)}${sideCell('ahead', '▲ Ahead', st.look.ahead)}${sideCell('right', 'Right ▶', st.look.right)}</div>`
      : '';
    ctx.hud(
      m
        ? `<div class="town">${esc(m.n)}</div>
           <div class="meta">${esc(m.t)} · <b>${esc(m.c)} County</b> ${acc}</div>
           ${st.near ? `<div class="near">near <b>${esc(st.near.name)}</b> <span class="muted">· part of ${esc(m.n)}</span></div>` : ''}
           ${head}${look}`
        : `<div class="town">Outside New Jersey</div><div class="meta">or offshore ${acc}</div>${head}`
    );
  }

  return {
    enter() {
      document.body.classList.toggle('north-up', !!settings.northUp);
      ctx.showLabels(settings.driveLabels);
      ctx.sheet('');
      ctx.reveal([]);
      ctx.line(null);
      ctx.clearHighlights((id, kind) => kind === 'cur');
      if (st.cur) ctx.highlight(st.cur.id, 'cur');
      if (store.get('tracking', false) && st.watchId == null) start();
      st.follow = true;
      document.body.classList.remove('unfollowed');
      render();
      if (ctx.pos) camera(0);
    },
    leave() {
      if (st.cur) ctx.highlight(st.cur.id, null);
    },
    recenter,
    stop,
    toggleOrientation,
    applyOrientation,
    get current() {
      return st.cur;
    },
    get visited() {
      return (visited = store.get('visited', {}));
    },
    get tracking() {
      return st.watchId != null;
    },
  };
}
