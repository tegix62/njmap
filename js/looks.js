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
    retro.apply(wantHolo ? (needs.crisp ? 2 : 3) : 0);
    // text as DOM: Paper sets the map's words in Gill Sans (canvas text cannot use a system font); PS1 keeps text crisp over a coarse map (unless the game
    // draws its own); every look draws route numbers as shields, in its own style
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
  return api;
}
