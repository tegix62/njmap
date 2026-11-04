/* global maplibregl */
import { bearing, destination, distanceMi, compass8, compass16, dirWord, angleDiff } from './geo.js';
import { nearbyRoads, alongRoad, travelDir, draftNote } from './roads.js';
import { editNote } from './notes.js';
import { gridDir, gridSide, intersection } from './grid.js';
import { ALL_REGIONS, switchRegion } from './region.js';

const MIN_MOVING_MPS = 2; // ~4.5 mph; below this GPS course is noise
const LOOK_STEP_MI = 0.08;
const GUESS_PAUSE_MS = 4000;

export function initDrive(ctx) {
  const { map, settings, store, region } = ctx;
  const GRID = region.gridAngle; // Manhattan: directions by the street grid
  const SCALE = GRID ? 0.25 : 1; // city distances are short
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
    roads: [], // nearby major roads, nearest first
    onRoad: null, // label of the road you're driving on, once it's been steady for a few seconds
    onCand: null,
    onCount: 0,
    expanded: store.get('driveExpanded', false),
  };
  let visited = store.get('visited', {});

  // ---- trip recording -----------------------------------------------------------
  // Each drive's route and the towns you entered, in order, kept for a
  // north-up recap afterwards (map study after route experience is what turns
  // a sequence of turns into a mental map; Thorndyke & Hayes-Roth, 1982).
  const MAX_TRIPS = 8;
  const MAX_PTS = 4000;
  const NEW_TRIP_AFTER = 30 * 60e3;
  const trips = (() => {
    let list = store.get('trips', []);
    let cur = null;
    let dirty = 0;
    const save = (force) => {
      if (!cur) return;
      if (!force && ++dirty < 10) return;
      dirty = 0;
      store.set('trips', list);
    };
    const ensure = () => {
      const now = Date.now();
      if (!cur || now - cur.last > NEW_TRIP_AFTER) {
        cur = { start: now, last: now, pts: [], towns: [] };
        list = [...list.filter((t) => t.towns.length >= 2), cur].slice(-MAX_TRIPS);
      }
      cur.last = now;
      return cur;
    };
    return {
      point(pt) {
        const t = ensure();
        const lastPt = t.pts[t.pts.length - 1];
        if (lastPt && distanceMi(lastPt, pt) < 0.08) return;
        t.pts.push([+pt[0].toFixed(5), +pt[1].toFixed(5)]);
        if (t.pts.length > MAX_PTS) t.pts = t.pts.filter((_, i) => i % 2 === 0);
        save();
      },
      town(m, h) {
        const t = ensure();
        const lastTown = t.towns[t.towns.length - 1];
        if (lastTown && lastTown.key === m.key) return;
        t.towns.push({ key: m.key, t: Date.now(), h: h == null ? null : Math.round(h) });
        save(true);
      },
      current: () => cur,
      end() {
        save(true);
        cur = null;
      },
      list: () => list,
    };
  })();

  // ---- position marker ------------------------------------------------------
  const el = document.createElement('div');
  el.className = 'me';
  el.innerHTML =
    '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">' +
    `<circle cx="20" cy="20" r="9" fill="${ctx.theme.you}" stroke="#fff" stroke-width="3"/>` +
    `<path class="me-arrow" d="M20 2 L27 14 L20 11 L13 14 Z" fill="${ctx.theme.you}" stroke="#fff" stroke-width="1.5"/></svg>`;
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
    const t = trips.current();
    if (t && t.towns.length >= 2) ctx.toast(`Drive saved: ${t.towns.length} towns. See Practice → My last drive.`, 5000);
    trips.end();
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
    if (settings.rememberPlaces && c.accuracy < 100) trips.point(pt);

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
      if (GRID) st.corner = intersection(map, pt);
      updateRoads(pt);
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
    // Only when you've opted in (Settings → Remember where I've been).
    if (m && settings.rememberPlaces) {
      visited[m.key] = Date.now();
      store.set('visited', visited);
      trips.town(m, st.gpsHeading ? st.heading : null);
    }
    // Speak on every change after the first fix.
    const first = !st.hadFix;
    st.hadFix = true;
    if (!first) announce(m, prev);
  }

  function announce(m, prev) {
    if (!m) {
      ctx.speak(region.leaving);
      return;
    }
    let s = `Entering ${m.n}`;
    if (m.dup) s += ` ${m.t}`;
    if (!prev || prev.c !== m.c) s += `, ${region.spokenGroup(m.c)}`;
    s += '.';
    if (st.heading != null && st.gpsHeading) s += ` Heading ${GRID ? gridDir(st.heading, GRID) : dirWord(compass8(st.heading))}.`;
    if (settings.voiceHints) {
      const twin = confusedWith(m);
      if (twin) s += ` Not ${twin.n} — that's ${ctx.relative(m.pt, twin.pt).words}.`;
    }
    if (settings.voiceGuess && settings.voice) {
      // Guess first: ask, pause, then answer. Recalling it yourself is what
      // builds the memory; being told passively (GPS-style) mostly doesn't
      // (Ishikawa et al., 2008; Dahmani & Bohbot, 2020).
      clearTimeout(st.guessTimer);
      st.guessing = m;
      const unit = region.unit === 'town' ? 'town' : 'neighborhood';
      ctx.speak(prev && prev.c !== m.c && !GRID ? `New ${unit}, and a new county. Which one?` : `New ${unit}. Which one?`);
      st.guessTimer = setTimeout(() => {
        st.guessing = null;
        ctx.speak(s);
        render();
      }, GUESS_PAUSE_MS);
      render();
      return;
    }
    ctx.speak(s);
  }

  /** The sound-alike to contrast with: from the first curated group listing
   *  this town (your own pairs go first in confusables.js), the most populous
   *  other member at least a few miles away. */
  function confusedWith(m) {
    for (const g of ctx.confusables.byId.get(m.id) || []) {
      if (!g.curated) continue;
      const others = g.members.filter((o) => o.n !== m.n && distanceMi(m.pt, o.pt) > 3 * SCALE).sort((a, b) => b.p - a.p);
      if (others.length) return others[0];
    }
    return null;
  }

  // ---- what's ahead / left / right -----------------------------------------
  function probe(pt, dir, maxMi) {
    const here = ctx.locate(pt);
    const step = LOOK_STEP_MI * SCALE;
    for (let d = step; d <= maxMi * SCALE; d += step) {
      const m = ctx.locate(destination(pt, dir, d));
      if (m !== here) return { m, d, dir };
    }
    return null;
  }
  // ---- roads ------------------------------------------------------------------
  function updateRoads(pt) {
    st.roads = nearbyRoads(map, pt, 3, 3);
    const top = st.roads[0];
    const on = top && top.d < 0.025 && st.heading != null && st.gpsHeading && alongRoad(st.heading, top.segBearing) ? top.label : null;
    if (on && on === st.onCand) st.onCount++;
    else {
      st.onCand = on;
      st.onCount = on ? 1 : 0;
    }
    const steady = st.onCount >= 2 ? st.onCand : on === null ? null : st.onRoad;
    if (steady !== st.onRoad) {
      st.onRoad = steady;
      if (steady) firstTimeOn(st.roads[0]);
    }
  }
  const sayRoad = (label) => label.replace(/&/g, ' and ');
  /** The first time you drive a road that has a note, read the note out once. */
  function firstTimeOn(r) {
    const spoken = store.get('spokenRoads', {});
    if (spoken[r.label]) return;
    const mine = ctx.notes.list('road', r.label);
    const note = mine.length ? mine[mine.length - 1].text : draftNote(r.label, r.name, ctx.region.roadNotes);
    if (!note) return;
    spoken[r.label] = Date.now();
    store.set('spokenRoads', spoken);
    ctx.speak(`On ${sayRoad(r.label)}. ${note}`);
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
    if (map.getZoom() < region.driveZoom - 1.5) opts.zoom = region.driveZoom;
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
    const name = r.m ? esc(ctx.name(r.m)) : esc(region.edgeName);
    return `<div class="look ${cls}"><span class="k">${label} <b>${compass8(r.dir)}</b></span><span class="v">${name}</span><span class="d">${mi(r.d)}</span></div>`;
  }

  function roadLine() {
    if (!st.roads.length) return '';
    if (st.onRoad && st.heading != null)
      return `<div class="roadline"><span class="on">On <b>${esc(st.onRoad)} ${travelDir(st.heading)}</b></span>${
        st.roads[1] ? ` · ${esc(st.roads[1].label)} ${mi(st.roads[1].d)} ${st.roads[1].dir}` : ''
      }</div>`;
    return `<div class="roadline">${st.roads
      .slice(0, 2)
      .map((r) => `<b>${esc(r.label)}</b> ${mi(r.d)} ${r.dir}`)
      .join(' · ')}</div>`;
  }

  function noteCards(kind, key, draft) {
    const mine = ctx.notes
      .list(kind, key)
      .map((n) => `<div class="notecard mine"><span class="tag">your note</span>${esc(n.text)}</div>`)
      .join('');
    return (draft ? `<div class="notecard"><span class="tag">draft note</span>${esc(draft)}</div>` : '') + mine;
  }

  /** Second layer: only rendered when the card is expanded. */
  function details(m) {
    const look = st.look
      ? `<div class="looks">${sideCell('left', '◀ Left', st.look.left)}${sideCell('ahead', '▲ Ahead', st.look.ahead)}${sideCell('right', 'Right ▶', st.look.right)}</div>`
      : '';
    const road = st.roads.find((r) => r.label === st.onRoad) || st.roads[0];
    const roadNotes = road
      ? `<div class="label-sm">${esc(road.label)}</div>${noteCards('road', road.label, draftNote(road.label, road.name, ctx.region.roadNotes))}
         <button class="addnote" data-note="road" data-key="${esc(road.label)}">＋ Note about ${esc(road.label)}</button>`
      : '';
    const townNotes = m
      ? `<div class="label-sm">${esc(m.n)}</div>${noteCards('town', m.key)}
         <button class="addnote" data-note="town" data-key="${esc(m.key)}">＋ Note about ${esc(m.n)}</button>`
      : '';
    const places = ctx.anchors
      .fromYou(ctx.pos.pt, st.heading)
      .slice(0, 3)
      .map((x) => `<div class="placeline"><b>${esc(x.a.name)}</b> ${mi(x.d)} ${x.dir}${x.rel ? ` <span class="muted">· ${x.rel}</span>` : ''}</div>`)
      .join('');
    return `<div class="detail">${look}${places ? `<div class="label-sm">Your places</div>${places}` : ''}${roadNotes}${townNotes}</div>`;
  }

  function render() {
    if (ctx.mode !== 'drive') return;
    const tracking = st.watchId != null;
    if (!tracking) {
      ctx.hud(
        `<div class="town">Where am I?</div>
         <div class="meta">${st.error ? esc(st.error) : `Shows the ${region.unit} you are in, which way you are heading, and the main road nearby. Your location never leaves this phone.`}</div>
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
    // Layer 1, readable at a glance: town, county, heading (+ which way is left/right), the main road.
    const head =
      h == null
        ? `<div class="heading muted">Heading appears once you start moving</div>`
        : GRID
          ? // Manhattan: the grid's words, with the true compass direction small
            `<div class="heading">Heading <b>${gridDir(h, GRID).toUpperCase()}</b> <span class="deg">${compass16(h)}</span> <span class="lr-key">· left <b>${gridSide(h - 90, GRID)}</b> · right <b>${gridSide(h + 90, GRID)}</b></span></div>`
          : `<div class="heading">Heading <b>${dirWord(compass8(h)).toUpperCase()}</b> <span class="lr-key">· left <b>${compass8(h - 90)}</b> · right <b>${compass8(h + 90)}</b></span></div>`;
    const near = m && st.near ? ` · near <i>${esc(st.near.name)}</i>` : '';
    const handle = `<button class="handle" id="hudToggle" aria-label="${st.expanded ? 'Show less' : 'Show more'}">${st.expanded ? '▴' : '▾'}</button>`;
    ctx.hud(
      `${handle}` +
        (m
          ? st.guessing === m
            ? `<div class="town">?</div>
             <div class="meta">New town. Say it before the voice does…</div>`
            : `<div class="town">${esc(m.n)}</div>
             <div class="meta">${GRID ? '' : `${esc(m.t)} · `}<b>${esc(ctx.groupName(m.c))}</b>${near} ${acc}</div>
             ${GRID && st.corner ? `<div class="corner">near <b>${esc(st.corner)}</b></div>` : ''}`
          : `<div class="town">${esc(region.outside)}</div><div class="meta">${esc(region.outsideSub)} ${acc}</div>${otherRegionButton()}`) +
        head +
        roadLine() +
        (st.expanded ? details(m) : '')
    );
    bindHud();
  }

  /** Crossed into the other region's map? Offer to switch. */
  function otherRegionButton() {
    const [x, y] = ctx.pos.pt;
    const other = ALL_REGIONS.find((r) => r !== region && x >= r.bounds[0][0] && x <= r.bounds[1][0] && y >= r.bounds[0][1] && y <= r.bounds[1][1]);
    return other ? `<button class="primary" id="switchRegion" data-r="${other.id}">Switch to ${esc(other.name)}</button>` : '';
  }

  function bindHud() {
    const hud = document.getElementById('hud');
    const sw = document.getElementById('switchRegion');
    if (sw)
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        switchRegion(sw.dataset.r);
      });
    document.getElementById('hudToggle').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleExpanded();
    });
    for (const b of hud.querySelectorAll('.addnote'))
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const label = b.dataset.note === 'town' ? ctx.byKey.get(b.dataset.key).n : b.dataset.key;
        const text = await editNote(`Note about ${label}`);
        if (text) {
          ctx.notes.add(b.dataset.note, b.dataset.key, text);
          render();
        }
      });
  }
  function toggleExpanded() {
    st.expanded = !st.expanded;
    store.set('driveExpanded', st.expanded);
    render();
    if (st.follow) camera(300);
  }
  // Tapping the card itself (not a button) also expands/collapses it.
  document.getElementById('hud').addEventListener('click', (e) => {
    if (ctx.mode !== 'drive' || st.watchId == null || e.target.closest('button, a, input')) return;
    toggleExpanded();
  });

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
    trips: () => trips.list(),
    get tracking() {
      return st.watchId != null;
    },
  };
}
