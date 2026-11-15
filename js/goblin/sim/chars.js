// Characters (docs/goblins/04-systems-spec.md section 7). Tier 1 is the force number itself and is never a character (D127); tier 2 captains and
// tier 3 legends are records in world.chars. Content (words, trait rules) comes from data/goblin-content.json and is all placeholder until the user
// writes it. The hidden-information rules here (what a clan has discovered, how traits suit or counter a maneuver) are what the front rules read.

import { K, K3 } from './constants.js';

export const MANEUVERS = Object.freeze(['probe', 'pressure', 'lever']);
const DRIVES = [null, 'stand', 'flee', 'grab'];

// ---------------------------------------------------------------- content

/** Validate and index the content JSON. Throws on anything malformed, so a bad content file is caught at load. */
export function loadContent(json) {
  const bad = (m) => { throw new Error('goblin-content: ' + m); };
  const traits = new Map();
  for (const t of json.traits) {
    if (!t.id || traits.has(t.id)) bad('duplicate or missing trait id ' + t.id);
    if (t.pool !== 'notable' && t.pool !== 'minor') bad(`trait ${t.id}: pool must be notable or minor`);
    for (const m of t.suits) if (!MANEUVERS.includes(m)) bad(`trait ${t.id}: unknown maneuver ${m}`);
    for (const m of Object.keys(t.counters)) if (!MANEUVERS.includes(m)) bad(`trait ${t.id}: unknown maneuver ${m}`);
    if (!DRIVES.includes(t.drive)) bad(`trait ${t.id}: unknown drive ${t.drive}`);
    if (typeof t.placeholder !== 'boolean') bad(`trait ${t.id}: placeholder flag missing`);
    traits.set(t.id, t);
  }
  const notable = json.traits.filter((t) => t.pool === 'notable'), minor = json.traits.filter((t) => t.pool === 'minor');
  if (notable.length < K3.notableTier3 + 1 || minor.length < K3.minorTier3 + 1) bad('too few traits to build a captain');
  const byId = (arr, what) => { const m = new Map(); for (const x of arr) { if (m.has(x.id)) bad('duplicate ' + what + ' ' + x.id); m.set(x.id, x); } return m; };
  return { json, traits, notable, minor, fears: byId(json.fears, 'fear'), injuries: byId(json.injuries, 'injury'), states: byId(json.states, 'state'),
           names: (kind) => json.clans[kind] || json.clans.default };
}

/** Every entry marked placeholder, for the build check (D194). */
export function placeholdersIn(content) {
  const out = [];
  const j = content.json;
  for (const t of j.traits) if (t.placeholder) out.push(['trait', t.id]);
  for (const [k, v] of Object.entries(j.clans)) if (v.placeholder) out.push(['names', k]);
  for (const sec of ['fears', 'injuries', 'states', 'verdicts', 'templates']) for (const x of j[sec] || []) if (x.placeholder) out.push([sec, x.id]);
  return out;
}

// ---------------------------------------------------------------- helpers

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const pick = (rng, arr) => arr[rng.int(arr.length)];
function sample(rng, arr, k) {
  const a = arr.slice(), out = [];
  for (let i = 0; i < k && a.length; i++) out.push(a.splice(rng.int(a.length), 1)[0]);
  return out;
}
const isActive = (c) => c && c.status === 'active';
export const captainsOf = (w, clanId) => Object.values(w.chars).filter((c) => c.clan === clanId && c.status === 'active');
/** The most captains a clan may have: 1 + one per four townships (spec section 12). It is checked when one is made, never by dismissing anyone. */
export const captainCap = (w, clanId) => K.captainCapBase + Math.floor(Object.values(w.towns).filter((t) => t.owner === clanId).length / K.captainCapPerTowns);
const ownedTowns = (w, clanId) => Object.keys(w.towns).filter((t) => w.towns[t].owner === clanId).sort(byId);

// ---------------------------------------------------------------- making captains

/** Make one captain, put them in `town` (which must be theirs and free of a captain) and return them. opts: { clan, tier, town, base, dynasty, grudges, firstNotable }. */
export function makeCaptain(w, rng, content, opts) {
  const tier = opts.tier || 2;
  const T = w.towns[opts.town];
  if (!T || T.owner !== opts.clan || T.captain) throw new Error('makeCaptain: the township must be the clan\'s and free');
  const kind = w.clans[opts.clan].kind;
  const pool = content.names(kind);
  const base = opts.base || `${pick(rng, pool.first)} ${pick(rng, pool.last)}`;
  const nNot = tier === 3 ? K3.notableTier3 : K3.notableTier2, nMin = tier === 3 ? K3.minorTier3 : K3.minorTier2;
  const first = opts.firstNotable ? content.traits.get(opts.firstNotable) : null;
  const notable = [...(first ? [first] : []), ...sample(rng, content.notable.filter((t) => !first || t.id !== first.id), nNot - (first ? 1 : 0))];
  const minor = sample(rng, content.minor, nMin);
  const hasFear = rng.next() < K3.fearChance;
  const fear = pick(rng, [...content.fears.values()]);
  const id = 'c' + w.nextId++;
  const c = { id, name: base, clan: opts.clan, tier, dynasty: opts.dynasty || 1, homeTown: opts.town,
    traits: [...notable.map((t) => ({ id: t.id, notable: true })), ...minor.map((t) => ({ id: t.id, notable: false }))],
    fears: hasFear ? [{ kind: fear.kind, ref: fear.ref }] : [], injuries: [], confidence: K3.confidenceStart, state: null, titles: [],
    grudges: opts.grudges ? opts.grudges.slice() : [], bonds: [], known: {}, status: 'active', heldBy: null, at: opts.town };
  w.chars[id] = c;
  T.captain = id;
  return c;
}

/** At the start of a war every clan gets max(2, floor(townships / 4)) captains (never above its cap), in its strongest townships, one to a township. */
export function placeInitialCaptains(w, rng, content) {
  for (const clan of Object.values(w.clans)) {
    const mine = ownedTowns(w, clan.id).sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b));
    const n = Math.min(captainCap(w, clan.id), Math.max(K3.startCaptainsMin, Math.floor(mine.length / K3.captainsPerTowns)), mine.length);
    for (let i = 0; i < n; i++) makeCaptain(w, rng, content, { clan: clan.id, town: mine[i] });
  }
}

// ---------------------------------------------------------------- hidden information

/** The facts about a character a clan can discover: notable traits first, then fears, then minor traits. Name, tier and visible injuries are not facts: everyone sees those. */
export function factsOf(c) {
  return [...c.traits.filter((t) => t.notable).map((t) => 'trait:' + t.id), ...c.fears.map((f) => 'fear:' + f.ref), ...c.traits.filter((t) => !t.notable).map((t) => 'trait:' + t.id)];
}
export const knows = (c, clanId, fact) => (c.known[clanId] || []).includes(fact);
export const undiscovered = (c, clanId) => factsOf(c).filter((f) => !knows(c, clanId, f));
export function discover(c, clanId, fact) {
  if (!factsOf(c).includes(fact)) throw new Error('discover: ' + c.id + ' has no fact ' + fact);
  (c.known[clanId] ||= []);
  if (!c.known[clanId].includes(fact)) c.known[clanId].push(fact);
}
/** Reveal the next undiscovered fact (notable traits first). Returns it, or null when the clan already knows everything. */
export function discoverOne(c, clanId) {
  const next = undiscovered(c, clanId)[0];
  if (!next) return null;
  discover(c, clanId, next);
  return next;
}

// ---------------------------------------------------------------- traits and maneuvers

/** Roll bonus for a captain acting: +2 per notable trait whose suits include the maneuver, +1 per minor one. */
export function suitBonus(content, c, maneuver) {
  let b = 0;
  for (const t of c.traits) if (content.traits.get(t.id).suits.includes(maneuver)) b += t.notable ? K3.maneuverSuitNotable : K3.maneuverSuitMinor;
  return b;
}
/** Roll modifier a defender's traits add to an attacker's maneuver (negative: harder for the attacker). */
export function counterMod(content, c, maneuver) {
  let m = 0;
  for (const t of c.traits) m += content.traits.get(t.id).counters[maneuver] || 0;
  return m;
}
/** True when two of a captain's notable traits pull opposite ways (stand against flee): the trigger for a closeup (D130). */
export function hasConflict(content, c) {
  const drives = new Set(c.traits.filter((t) => t.notable).map((t) => content.traits.get(t.id).drive).filter(Boolean));
  return drives.has('flee') && (drives.has('stand') || drives.has('grab'));
}

// ---------------------------------------------------------------- injury, death, capture

/** After a lost fight: 'none', 'injured' or 'dead'. side 'own' is the losing attacker's captain; 'enemy' the other side. */
export function injuryRoll(rng, side) {
  if (rng.d6() > (side === 'enemy' ? K3.injuryEnemy : K3.injuryOwn)) return 'none';
  return rng.d6() <= K3.deathAfterInjury ? 'dead' : 'injured';
}
/** Give a captain an injury they do not already have; returns its id, or null if they have them all. */
export function applyInjury(rng, content, c) {
  const free = [...content.injuries.keys()].filter((i) => !c.injuries.includes(i));
  if (!free.length) return null;
  const id = free[rng.int(free.length)];
  c.injuries.push(id);
  return id;
}
/** A captain dies: they leave their township and an heir is queued for the next major tick (D33). */
export function kill(w, c) {
  if (c.at && w.towns[c.at] && w.towns[c.at].captain === c.id) w.towns[c.at].captain = null;
  w.heirs.push({ clan: c.clan, base: c.name, dynasty: c.dynasty, grudge: c.grudges[0] || null, town: c.at || c.homeTown, tick: w.tick });
  c.status = 'dead'; c.at = null;
}
/** A captain is taken prisoner by `byClan` (D201). */
export function capture(w, c, byClan) {
  if (c.at && w.towns[c.at] && w.towns[c.at].captain === c.id) w.towns[c.at].captain = null;
  c.status = 'captured'; c.heldBy = byClan; c.at = null;
}
/** Put a captain back in a township of their clan: the preferred one, else their clan's home, else its strongest free township. False if there is nowhere. */
export function place(w, c, preferred) {
  const free = (t) => w.towns[t] && w.towns[t].owner === c.clan && !w.towns[t].captain;
  const order = [preferred, w.clans[c.clan].home, ...ownedTowns(w, c.clan).sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b))];
  const t = order.find((x) => x && free(x));
  if (!t) return false;
  w.towns[t].captain = c.id; c.at = t;
  return true;
}

// ---------------------------------------------------------------- succession and promotion

/** At a major tick, heirs queued before this tick arrive: the next of the dynasty, one grudge inherited, if the clan is under its cap. Returns the new captains. */
export function succeed(w, rng, content) {
  const made = [], waiting = [];
  for (const h of w.heirs) {
    const clan = w.clans[h.clan];
    if (h.tick >= w.tick || !clan || clan.out) { if (clan && !clan.out) waiting.push(h); continue; }
    if (captainsOf(w, h.clan).length >= captainCap(w, h.clan)) { waiting.push(h); continue; }
    const free = (t) => w.towns[t] && w.towns[t].owner === h.clan && !w.towns[t].captain;
    const at = [h.town, clan.home, ...ownedTowns(w, h.clan).sort((a, b) => (w.towns[b].force - w.towns[a].force) || byId(a, b))].find((t) => t && free(t));
    if (!at) { waiting.push(h); continue; }
    const c = makeCaptain(w, rng, content, { clan: h.clan, town: at, base: h.base, dynasty: h.dynasty + 1, grudges: h.grudge ? [h.grudge] : [] });
    made.push({ char: c, from: h });
  }
  w.heirs = waiting;
  return made;
}

/** A grunt earns a name after a hard win: a new tier 2 captain in `townId`, whose first notable trait is chosen by what happened (tag). Null if not allowed. */
export function promote(w, rng, content, townId, tag) {
  const T = w.towns[townId];
  if (!T || !T.owner || T.captain || captainsOf(w, T.owner).length >= captainCap(w, T.owner)) return null;
  const eligible = content.notable.filter((t) => t.earnedBy.includes(tag));
  const firstNotable = (eligible.length ? pick(rng, eligible) : pick(rng, content.notable)).id;
  return makeCaptain(w, rng, content, { clan: T.owner, town: townId, firstNotable });
}
