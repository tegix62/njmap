// The looks, for the whole app.
//
// Three looks, one switch, every game mode: 'plain' (the app's own Ink/Classic theme), 'paper' (a printed road map) and 'ps1'
// (a projection-table map drawn at PlayStation-1 resolution). The current look is a setting (`settings.look`), applied to the
// shared map, so Practice, Name that place, Drive, Explore and the grid games all show it, and it is changed from one place:
//   ctx.looks.cycle()           next look (the chip every game header carries)
//   ctx.looks.set('paper')      a specific look (Settings → Look & map)
//   ctx.looks.on(fn)            be told when it changes: fn(look)
//   ctx.looks.use({...})        a game says what it needs from the look while it runs (below)
//
// Where to change what a look *is*: js/looks.config.js (colours, strengths, widths — one file of numbers); the code that applies
// them is js/paper.js, js/holo.js, js/retro.js and js/world.js; panel/button styling for each is the `body.paper` / `body.holo`
// blocks at the end of css/app.css.
//
// A game does not need to know about looks. What it can do is `use({ fills, crisp })`:
//   fills  true: the look also recolours the town/county fills (for a game that does not colour them itself)
//   crisp  true: the game draws its own crisp labels, so under PS1 the map's own text may be hidden and the map rendered coarser
// and pass `use({})` when it stops. Everything else (base-map colours, linework, panels, resolution, dither) follows the look on its own.

import { createHolo } from './holo.js';
import { createPaper } from './paper.js';
import { createRetro } from './retro.js';
import { createMapText } from './maptext.js';
import { HOLO, PAPER } from './looks.config.js';

export const LOOKS = ['plain', 'paper', 'ps1'];
export const LOOK_LABEL = { plain: '▢ Default', paper: '▤ Paper', ps1: '🕹 PS1' };

export function createLooks(ctx) {
  const { map } = ctx;
  const bounds = ctx.region && ctx.region.bounds;
  const holo = createHolo(map, bounds);
  const paper = createPaper(map, bounds, () => !!ctx.settings.richTexture);   // richTexture: the heavier paper (full-screen fibre, texture swim); off by default, it costs battery
  const retro = createRetro(map);
  const mapText = createMapText(map);   // PS1: the map's own text redrawn as crisp DOM labels (games with their own labels opt out via crisp)
  const listeners = new Set();
  let needs = { fills: false, crisp: false };

  // the setting; the older per-game ones still count once
  const old = ctx.store.get('orbit.look', null);
  let look = ctx.settings.look || (old === 'holo' ? 'ps1' : old) || 'plain';
  // escape hatch: open the app with ?look=plain (or paper, ps1) to force a look, e.g. if one ever stops the map from loading
  const forced = new URLSearchParams(location.search).get('look');
  if (forced && LOOKS.includes(forced)) { look = forced; ctx.settings.look = forced; ctx.saveSettings && ctx.saveSettings(); }
  if (!LOOKS.includes(look)) look = 'plain';

  const isSaver = () => (ctx.settings.effects || 'saver') !== 'full';
  /**
   * Dynamic resolution. A phone's screen is 2-3 device pixels per CSS pixel, and by default the map renders every one of them, on every frame: at 3x that is
   * nine fragments per CSS pixel. In battery saver the map renders at most 2x at rest (about 0.44 of the pixels of 3x) and at most 1.5x while the camera
   * is moving (about 0.25), then sharpens a moment after it stops. PS1 sets its own, much lower, ratio.
   */
  const dpr = () => window.devicePixelRatio || 1;
  const res = {
    moving: false, timer: 0, lastSet: 0,
    target() { return isSaver() ? Math.min(dpr(), this.moving ? 1.5 : 2) : dpr(); },
    refresh() {
      if (look === 'ps1' || !map.setPixelRatio) return;
      const t = this.target();
      if (Math.abs(map.getPixelRatio() - t) > 0.01) { this.busy = true; try { map.setPixelRatio(t); } catch { /* older MapLibre */ } this.busy = false; }   // (resizing fires move events; they must not count as the camera moving, or the ratio would flip back and forth forever)
    },
    start() { if (!this.moving) { this.moving = true; this.refresh(); } this.end(); },
    end() { clearTimeout(this.timer); this.timer = setTimeout(() => { if (map.isMoving()) return this.end(); this.moving = false; this.refresh(); }, 600); },
  };
  map.on('movestart', () => { if (!res.busy) res.start(); });
  map.on('move', () => { if (res.moving && !res.busy) res.end(); });   // (every move event renews the 600 ms timer, so a lost moveend cannot leave the map coarse)
  map.on('moveend', () => { if (!res.busy) res.end(); });
  map.on('idle', () => { if (res.moving) res.end(); });   // (a move that never reports its end must not leave the map coarse)
  function apply() {
    const wantHolo = look === 'ps1', wantPaper = look === 'paper';
    // the look going away is switched OFF before the new one goes ON: each saves the paint it finds and puts it back, so one that saved
    // while another was still on would later restore that other look's colours
    if (!wantHolo) holo.apply(false);
    if (!wantPaper) paper.apply(false);
    holo.fills(needs.fills);
    paper.fills(needs.fills);
    holo.apply(wantHolo);
    paper.apply(wantPaper);
    retro.apply(wantHolo ? (needs.crisp ? 2 : 3) : 0, { saver: isSaver() });
    // text as DOM: Paper sets the map's words in Gill Sans (canvas text cannot use a system font); PS1 keeps text crisp over a coarse map (unless the game
    // draws its own); every look draws route numbers as shields, in its own style
    mapText.setSaver && mapText.setSaver(isSaver());
    res.refresh();
    mapText.show(true, wantPaper || (wantHolo && !needs.crisp) ? 'all' : 'shields', !!needs.crisp);   // (a game that supplies its own labels wants the rest of the map quiet)
  }
  const safe = () => { try { apply(); } catch (e) { console.warn('look failed', e); } };
  // apply as soon as the style has its layers (the map may have loaded already, or not yet)
  let applied = false;
  const first = () => { if (!applied && map.getLayer('bg')) { applied = true; safe(); } };
  first();
  if (!applied) { map.on('styledata', first); map.once('load', first); }

  const api = {
    get look() { return look; },
    get paperOn() { return paper.on; },
    get ps1On() { return holo.on; },
    get label() { return LOOK_LABEL[look]; },
    _res: res,
    /** Battery saver (the default): no full-screen filters, no per-frame extras, 30 fps orbit. Set in Settings → Effects. */
    get saver() { return isSaver(); },
    refresh() { safe(); for (const f of listeners) f(look); },
    set(v) {
      if (!LOOKS.includes(v) || v === look) return;
      look = v;
      ctx.settings.look = v;
      ctx.saveSettings && ctx.saveSettings();
      safe();
      for (const f of listeners) f(look);
    },
    cycle() { api.set(LOOKS[(LOOKS.indexOf(look) + 1) % LOOKS.length]); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** What a running game needs from the look (see the top of this file). Call with {} when it stops. */
    use(n = {}) {
      needs = { fills: !!n.fills, crisp: !!n.crisp };
      safe();
    },
    /** The colour of "the thing asked about" / "what you picked", for things drawn outside the map (pins, legends). */
    roleColor(role) {
      if (paper.on) return paper.color(role);
      if (holo.on) return holo.color(role);
      return role === 'wrong' ? '#d9622b' : '#0b9a82';
    },
    PAPER,
    HOLO,
  };
  // One floating look button for every mode, so the look can be switched anywhere. Hidden where the screen already carries the look chip (the practice header).
  const fab = document.createElement('button');
  fab.id = 'lookFab';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Map look');
  fab.addEventListener('click', () => api.cycle());
  document.body.appendChild(fab);
  const paintFab = () => { fab.textContent = { plain: '▢', paper: '▤', ps1: '🕹' }[look]; fab.title = LOOK_LABEL[look]; };
  const hasChip = () => !!document.getElementById('lookChip');
  const syncFab = () => { fab.hidden = hasChip(); };
  paintFab();
  listeners.add(paintFab);
  new MutationObserver(syncFab).observe(document.body, { childList: true, subtree: true });
  syncFab();
  return api;
}
