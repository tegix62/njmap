/* global maplibregl */
import { bearing, destination, distanceMi, compass8, compass16, dirWord, angleDiff } from './geo.js';
import { nearbyRoads, alongRoad, travelDir, draftNote, createRoadIndex } from './roads.js';
import { initInset } from './inset.js';
import { gridDir, gridSide, intersection } from './grid.js';
import { ALL_REGIONS, switchRegion } from './region.js';

const MIN_MOVING_MPS = 2; // ~4.5 mph; below this GPS course is noise
const LOOK_STEP_MI = 0.08;
const GUESS_PAUSE_MS = 4000;
const TYPE_ABBR = { Township: 'Twp', Borough: 'Boro', City: 'City', Town: 'Town', Village: 'Village' };
const CARDINAL_TOL = 20; // degrees either side of N/E/S/W that count as "facing" it
const CARDINAL_HOLD_MS = 4000; // hold it this long before it's said
const CARDINAL_GAP_MS = 20000; // and never more often than this

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
    nextQuizAt: 0, // hands-free quiz
    quizLine: null,
    recentQuiz: [],
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
      clear() {
        list = [];
        cur = null;
      },
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

  // ---- overview circle (zoomed-out view of this town and its neighbors) -----
  const inset = initInset(ctx);
  function updateInset() {
    if (ctx.mode === 'drive' && settings.driveInset && st.watchId != null && ctx.pos && st.cur)
      inset.update(ctx.pos.pt, st.heading, st.cur, !!settings.northUp);
    else inset.hide();
  }

  // ---- "Heading north." when you settle onto N, E, S or W -------------------
  function checkCardinal(now) {
    if (!settings.voice || !settings.sayCardinal || GRID || !st.gpsHeading || st.heading == null) return;
    const i = Math.round(st.heading / 90) % 4;
    const c = Math.abs(angleDiff(st.heading, i * 90)) <= CARDINAL_TOL ? i : null;
    if (c !== st.cardCand) {
      st.cardCand = c;
      st.cardSince = now;
      return;
    }
    if (c == null || c === st.cardSaid || now - st.cardSince < CARDINAL_HOLD_MS) return;
    if (now - (st.cardSaidAt || 0) < CARDINAL_GAP_MS || now - (ctx.lastSpokenAt || 0) < 3000) return;
    if ((st.quizPendingUntil || 0) > now || st.guessing) return;
    st.cardSaid = c;
    st.cardSaidAt = now;
    ctx.speak(`Heading ${['north', 'east', 'south', 'west'][c]}.`);
  }

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
    updateInset();
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
      maybeQuiz(now);
    }
    checkCardinal(now);
    if (ctx.mode === 'drive') {
      if (st.follow) camera();
      render();
    }
    updateInset();
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

  // ---- hands-free quiz ------------------------------------------------------------
  // Every few minutes (Settings), one spoken question about where you are right
  // now; a pause to answer in your head; then the answer. No tapping. Questions
  // use your live heading, so "left" and "right" are your real left and right.
  const QUIZ_PAUSE_MS = 5500;
  function relPhrase(rel) {
    const a = Math.abs(rel);
    const side = rel > 0 ? 'right' : 'left';
    if (a <= 25) return 'straight ahead';
    if (a <= 65) return `ahead, to your ${side}`;
    if (a <= 115) return `to your ${side}`;
    if (a <= 155) return `behind you, to your ${side}`;
    return 'behind you';
  }
  const miles = (d) => (d < 10 ? d.toFixed(1).replace(/\.0$/, '') : String(Math.round(d)));
  function quizCandidates(pt, h) {
    const out = [];
    // where is a known place, relative to the way you're facing?
    const places = [
      ...ctx.munis
        .filter((o) => o.wellKnown && o !== st.cur)
        .map((o) => ({ name: o.n.replace(/ Village$/, ''), pt: o.pt })) // "South Orange", as people say it
        .filter((o) => {
          const d = distanceMi(pt, o.pt);
          return GRID ? d > 0.6 && d < 6 : d > 2.5 && d < 20;
        }),
      ...ctx.anchors.list().map((a) => ({ name: a.name, pt: a.pt })),
      ...(region.bigPlaces || []).map((b) => ({ name: b.name.replace(/ \(.*\)$/, ''), pt: b.pt })),
      ...(region.crossings || []).map((c) => ({ name: `the ${c.name}`.replace('the George', 'the George'), pt: c.pt })),
    ].filter((o) => !st.recentQuiz.includes(o.name) && distanceMi(pt, o.pt) > 1);
    if (places.length) {
      const o = places[Math.floor(Math.random() * places.length)];
      const b = bearing(pt, o.pt);
      const d = distanceMi(pt, o.pt);
      out.push({
        key: o.name,
        q: `Quick one. ${o.name}: left, right, ahead, or behind?`,
        a: `${o.name} is ${relPhrase(angleDiff(b, h))}, about ${miles(d)} miles ${dirWord(compass8(b))}.`,
        w: 3,
      });
    }
    const ahead = st.look && st.look.ahead;
    if (ahead && ahead.m && ahead.d > (GRID ? 0.15 : 0.3))
      out.push({ key: 'ahead', q: `What ${region.unit} is coming up ahead?`, a: `${ahead.m.n}, about ${miles(ahead.d)} miles ahead.`, w: 2 });
    if (st.cur && !GRID) out.push({ key: 'county', q: 'Which county are you in right now?', a: `${st.cur.c} County. You're in ${st.cur.n}.`, w: 1 });
    if (st.cur && GRID) out.push({ key: 'area', q: 'Downtown, Midtown, Uptown, or Upper Manhattan?', a: `${st.cur.c}. You're in ${st.cur.n}.`, w: 1 });
    out.push({
      key: 'heading',
      q: 'Which way are you heading?',
      a: GRID ? `${gridDir(h, GRID)}, so ${dirWord(compass16(h))} on a compass.` : `${dirWord(compass8(h))}. Your left is ${dirWord(compass8(h - 90))}.`,
      w: 1,
    });
    if (st.onRoad)
      out.push({
        key: 'road',
        q: 'What road are you on, and which direction?',
        a: `${sayRoad(st.onRoad)} ${{ N: 'north', E: 'east', S: 'south', W: 'west' }[travelDir(h)]}.`,
        w: 2,
      });
    if (st.near && st.cur) out.push({ key: 'village', q: `You're near ${st.near.name}. What ${region.unit} is that part of?`, a: `${st.cur.n}.`, w: 2 });
    return out.filter((c) => !st.recentQuiz.includes(c.key));
  }
  function maybeQuiz(now) {
    if (!settings.driveQuiz || !settings.voice || st.watchId == null || !ctx.pos) return;
    if (st.heading == null || !st.gpsHeading || st.guessing) return;
    if (!st.nextQuizAt) st.nextQuizAt = now + Math.min(90e3, settings.driveQuizMin * 60e3);
    if (now < st.nextQuizAt || now - (ctx.lastSpokenAt || 0) < 15e3) return;
    const cands = quizCandidates(ctx.pos.pt, st.heading);
    if (!cands.length) return;
    let x = Math.random() * cands.reduce((s, c) => s + c.w, 0);
    const c = cands.find((y) => (x -= y.w) <= 0) || cands[0];
    st.recentQuiz.push(c.key);
    if (st.recentQuiz.length > 6) st.recentQuiz.shift();
    st.nextQuizAt = now + settings.driveQuizMin * 60e3 + (Math.random() - 0.5) * 40e3;
    ctx.speak(c.q);
    st.quizPendingUntil = Date.now() + QUIZ_PAUSE_MS + 3000;
    st.quizLine = { text: c.q, answered: false };
    render();
    clearTimeout(st.quizTimer);
    st.quizTimer = setTimeout(() => {
      ctx.speak(c.a);
      st.quizLine = { text: c.a, answered: true, until: Date.now() + 12e3 };
      render();
      setTimeout(() => {
        if (st.quizLine && st.quizLine.until <= Date.now()) {
          st.quizLine = null;
          render();
        }
      }, 12.5e3);
    }, QUIZ_PAUSE_MS);
  }

  function announce(m, prev) {
    // Don't talk over your thinking pause: hold it until the quiz answer is out.
    const wait = (st.quizPendingUntil || 0) - Date.now();
    if (wait > 0) {
      setTimeout(() => st.cur === m && announce(m, prev), wait + 900);
      return;
    }
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
    // the road you are on: any named road (local streets too), by the nearest segment you are travelling along
    roadIdx.update(map, pt);
    const loc = roadIdx.size ? roadIdx.nearest(pt) : null;
    const top = loc || st.roads[0];
    const on = top && top.d < 0.025 && st.heading != null && st.gpsHeading && alongRoad(st.heading, top.segBearing) ? top.label : null;
    st.onRef = loc && on ? loc : st.roads[0];
    if (on && on === st.onCand) st.onCount++;
    else {
      st.onCand = on;
      st.onCount = on ? 1 : 0;
    }
    const steady = st.onCount >= 2 ? st.onCand : on === null ? null : st.onRoad;
    if (steady !== st.onRoad) {
      st.onRoad = steady;
      if (steady && !firstTimeOn(st.onRef || st.roads[0])) announceRoad(st.onRef || st.roads[0]);   // (a road with a note says its name inside the note)
    }
  }
  // How a road is said aloud: "I-287" → "Interstate 287", "Route 1&9" → "Route 1 and 9", the named roads with "the".
  const sayRoad = (label) => {
    if (/^(Turnpike|Parkway|AC Expressway|Palisades Pkwy)$/.test(label)) return 'the ' + label.replace('Pkwy', 'Parkway');
    return label.replace(/I-(\d+)/g, 'Interstate $1').replace(/ \/ /g, ' and ').replace(/&/g, ' and ');
  };
  const roadIdx = createRoadIndex();
  let lastRoadSaid = 0, lastRoadLabel = null;
  /** Say which road you are on, when you have been on it steadily for a few seconds: "Route 17 north." Not while other speech is going, and not more often than every 25 s. */
  function announceRoad(r) {
    if (!settings.voice || settings.sayRoads === false || !r || r.label === lastRoadLabel && Date.now() - lastRoadSaid < 120000) return false;
    if (Date.now() - lastRoadSaid < (r.cls && !['motorway', 'trunk', 'primary'].includes(r.cls) ? 12000 : 25000) || ('speechSynthesis' in window && speechSynthesis.speaking)) return false;
    const h = st.heading;
    lastRoadSaid = Date.now();
    lastRoadLabel = r.label;
    ctx.speak(`${sayRoad(r.label)}${h != null ? ' ' + { N: 'north', E: 'east', S: 'south', W: 'west' }[travelDir(h)] : ''}.`);
    return true;
  }
  /** The first time you drive a road that has a note, read the note out once. */
  // Which notes were read: kept on the phone only with "Remember where I've
  // been" on (it says which roads you drove); otherwise just for this session.
  const spokenNow = {};
  function firstTimeOn(r) {
    const spoken = settings.rememberPlaces ? store.get('spokenRoads', {}) : spokenNow;
    if (spoken[r.label]) return false;
    const mine = ctx.notes.list('road', r.label);
    const note = mine.length ? mine[mine.length - 1].text : draftNote(r.label, r.name, ctx.region.roadNotes);
    if (!note) return false;
    spoken[r.label] = Date.now();
    if (settings.rememberPlaces) store.set('spokenRoads', spoken);
    ctx.speak(`On ${sayRoad(r.label)}. ${note}`);
    return true;
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
            updateInset();
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
    updateInset();
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

  const hwyStyle = (label) => {
    const h = ctx.hwy(label);
    return h ? ` style="background:${h.color};color:#fff"` : '';
  };
  /** Where something is from you: left/right/ahead when the map turns with you, compass words when it's north-up. */
  function whereFrom(b) {
    if (settings.northUp || st.heading == null) return `${compass8(b)} of you`;
    const rel = angleDiff(b, st.heading);
    const a = Math.abs(rel);
    const side = rel > 0 ? 'right' : 'left';
    return a <= 30 ? 'ahead' : a <= 70 ? `ahead ${side}` : a <= 110 ? `on your ${side}` : a <= 150 ? `behind ${side}` : 'behind';
  }
  /** "Montville Twp (Morris)": the name big, type and county small. */
  function townTitle(m) {
    const sub = GRID ? `(${m.c})` : `${TYPE_ABBR[m.t] || m.t} (${m.c})`;
    return `${esc(m.n)} <span class="ty">${esc(sub)}</span>`;
  }

  /** Second layer, behind the ▾: your places and the main roads around you. */
  function details() {
    const places = ctx.anchors
      .fromYou(ctx.pos.pt, st.heading)
      .slice(0, 3)
      .map((x) => `<div class="placeline"><b>${esc(x.a.name)}</b> ${mi(x.d)} · ${whereFrom(bearing(ctx.pos.pt, x.a.pt))}</div>`)
      .join('');
    const roads = st.roads
      .filter((r) => r.label !== st.onRoad)
      .map((r) => `<div class="placeline"><b${hwyStyle(r.label)} class="rd">${esc(r.label)}</b> ${mi(r.d)} · ${whereFrom(bearing(ctx.pos.pt, r.pt))}</div>`)
      .join('');
    if (!places && !roads) return '';
    return `<div class="detail">${places ? `<div class="label-sm">Your places</div>${places}` : ''}${
      roads ? `<div class="label-sm">Main roads nearby</div>${roads}` : ''
    }</div>`;
  }

  function render() {
    if (ctx.mode !== 'drive') return;
    const tracking = st.watchId != null;
    if (!tracking) {
      ctx.hud(
        // after the first run the intro is one line (name and Start); the explanation returns on an error, or behind the ⓘ
        ctx.store.get('drive.intro', false) && !st.error
          ? `<div class="driverow"><div class="town">Where am I?</div><button class="primary" id="startBtn">Start</button></div>
             <details class="drive-info"><summary>ⓘ</summary><div class="meta">Shows the ${region.unit} you are in, which way you are heading, and the main road nearby. Your location never leaves this phone.</div></details>`
          : `<div class="town">Where am I?</div>
         <div class="meta">${st.error ? esc(st.error) : `Shows the ${region.unit} you are in, which way you are heading, and the main road nearby. Your location never leaves this phone.`}</div>
         <button class="primary" id="startBtn">Start</button>`
      );
      document.getElementById('startBtn').addEventListener('click', () => { ctx.store.set('drive.intro', true); start(); });
      return;
    }
    if (!ctx.pos) {
      ctx.hud(`<div class="town">Finding you…</div><div class="meta">${esc(st.error || 'Waiting for GPS')}</div>`);
      return;
    }
    const m = st.cur;
    const h = st.heading;
    const acc = ctx.pos.acc > 150 ? `<span class="warn">GPS ±${Math.round(ctx.pos.acc)} m</span>` : '';
    // Layer 1, readable at a glance: where you are, which way you're going, what's around you.
    const on = st.onRoad && h != null ? ` · on <b class="rd"${hwyStyle(st.onRoad)}>${esc(st.onRoad)} ${travelDir(h)}</b>` : '';
    const head =
      h == null
        ? `<div class="heading muted">Heading appears once you start moving</div>`
        : GRID
          ? // Manhattan: the grid's words, with the true compass direction small
            `<div class="heading">Heading <b>${gridDir(h, GRID).toUpperCase()}</b> <span class="deg">${compass16(h)}</span>${on}</div>`
          : `<div class="heading">Heading <b>${dirWord(compass8(h)).toUpperCase()}</b>${on}</div>`;
    const look = st.look
      ? `<div class="looks">${sideCell('left', '◀ Left', st.look.left)}${sideCell('ahead', '▲ Ahead', st.look.ahead)}${sideCell('right', 'Right ▶', st.look.right)}</div>`
      : '';
    const near = m && st.near ? `near <i>${esc(st.near.name)}</i> <span class="muted">(village)</span>` : '';
    const more = st.expanded ? details() : '';
    const hasMore = !!(st.expanded ? more : details());
    st.hasMore = hasMore;
    const handle = hasMore
      ? `<button class="handle" id="hudToggle" aria-label="${st.expanded ? 'Show less' : 'Show more'}">${st.expanded ? '▴' : '▾'}</button>`
      : '';
    ctx.hud(
      `${handle}` +
        (m
          ? st.guessing === m
            ? `<div class="town">?</div>
             <div class="meta">New town. Say it before the voice does…</div>`
            : `<div class="town">${townTitle(m)}</div>
             ${near || acc ? `<div class="meta">${near} ${acc}</div>` : ''}
             ${GRID && st.corner ? `<div class="corner">near <b>${esc(st.corner)}</b></div>` : ''}`
          : `<div class="town">${esc(region.outside)}</div><div class="meta">${esc(region.outsideSub)} ${acc}</div>${otherRegionButton()}`) +
        head +
        look +
        (st.quizLine ? `<div class="quizline${st.quizLine.answered ? ' ans' : ''}">🎧 ${esc(st.quizLine.text)}</div>` : '') +
        more
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
    const tg = hud.querySelector('#hudToggle');
    if (tg)
      tg.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExpanded();
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
    if (ctx.mode !== 'drive' || st.watchId == null || !st.hasMore || e.target.closest('button, a, input')) return;
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
      updateInset();
    },
    leave() {
      if (st.cur) ctx.highlight(st.cur.id, null);
      inset.hide();
    },
    recenter,
    stop,
    toggleOrientation,
    applyOrientation,
    updateInset,
    get current() {
      return st.cur;
    },
    get visited() {
      return (visited = store.get('visited', {}));
    },
    trips: () => trips.list(),
    /** Drop remembered towns and drives (the store is cleared by the caller). */
    forget() {
      visited = {};
      trips.clear();
    },
    get tracking() {
      return st.watchId != null;
    },
  };
}
