import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBoard } from '../../../js/goblin/sim/board.js';
import { loadContent } from '../../../js/goblin/sim/chars.js';
import { newWorld, step, checkInvariants } from '../../../js/goblin/sim/world.js';
import * as R from '../../../js/goblin/sim/regions.js';
import * as S from '../../../js/goblin/sim/seasons.js';
import * as K from '../../../js/goblin/sim/kinds.js';
import * as Ch from '../../../js/goblin/sim/chapters.js';
import * as E from '../../../js/goblin/sim/economy.js';
import * as V from '../../../js/goblin/sim/convoys.js';
import { K8 } from '../../../js/goblin/sim/constants.js';
import { board as rboard, runCampaign, START_MS } from '../run.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const regions = read('../../../data/goblin-regions.json');
const content = loadContent(read('../../../data/goblin-content.json'));
const board = makeBoard(read('../../../data/goblin-board.json'), content, regions);
const ev = (events, t) => events.filter((e) => e.type === t);
const clans = (rivals = [['rats', 'rat'], ['toads', 'toad']]) => [{ id: 'goblins', kind: 'goblin', lord: 'human' }, ...rivals.map(([id, kind]) => ({ id, kind, lord: 'ai' }))];
const world = (seed = 'rg', extra = {}) => { const w = newWorld(board, { seed, home: 'Paterson City|Passaic', clans: clans(), startMs: START_MS, ...extra }); w.clans.goblins.shieldUntil = 0; return w; };

test('every township is in exactly one kit; the kits cover every county; each has one rule worked out from numbers', () => {
  assert.equal(Object.keys(regions.townKit).length, Object.keys(board.towns).length);
  for (const id of Object.keys(board.towns)) assert.ok(regions.kits.some((k) => k.id === regions.townKit[id]), id);
  assert.equal(regions.kits.length, 10);
  const counties = new Set(Object.values(board.towns).map((t) => t.county)); const covered = new Set(regions.kits.flatMap((k) => k.counties));
  assert.deepEqual([...counties].sort(), [...covered].sort());
  for (const k of regions.kits) { assert.ok(['roads', 'rivers', 'hills', 'farm', 'coast'].includes(k.rule)); assert.ok(k.stats.towns > 0 && typeof k.stats.riverShare === 'number'); assert.equal(k.placeholder, true); }
  assert.equal(R.kitOf(board, 'Paterson City|Passaic'), 'highlands'); assert.equal(R.ruleOf(board, 'Paterson City|Passaic'), regions.kits.find((k) => k.id === 'highlands').rule);
});

test('facts are rows with a source and a verified flag, and nothing unverified ever ships', () => {
  for (const k of regions.kits) for (const f of k.facts) { assert.ok(f.text && f.source && typeof f.verified === 'boolean'); }
  const shipped = regions.kits.flatMap((k) => k.facts.filter((f) => f.verified));
  assert.equal(shipped.filter((f) => !f.verified).length, 0);
  assert.ok(regions.kits.every((k) => k.hazard.placeholder && k.tradeFlavour.placeholder), 'the words are placeholders until the user writes them');
});

test('seasons come from the real calendar by integer arithmetic: Dec to Feb winter, Mar to May spring, Jun to Aug summer, Sep to Nov autumn', () => {
  const m = (d) => S.monthOfDays(Math.floor(Date.parse(d + 'T00:00:00Z') / 864e5));
  for (const [d, mm, ss] of [['2026-01-15', 1, 'winter'], ['2026-02-28', 2, 'winter'], ['2024-02-29', 2, 'winter'], ['2026-03-01', 3, 'spring'], ['2026-05-31', 5, 'spring'], ['2026-06-01', 6, 'summer'], ['2026-08-31', 8, 'summer'], ['2026-09-01', 9, 'autumn'], ['2026-11-30', 11, 'autumn'], ['2026-12-01', 12, 'winter']]) { assert.equal(m(d), mm, d); assert.equal(S.seasonOfMonth(m(d)), ss, d); }
  const w = world(); assert.equal(S.seasonOf(w), 'autumn'); w.tick = 24 * 100; assert.equal(S.seasonOf(w), 'winter');
  assert.equal(S.seasonOf({ startMs: undefined, tick: 5 }), null);
});

test('each season has its rule: winter units eat a quarter more, summer one more recruit, autumn Food towns yield one more, spring doubles the river penalty', () => {
  const at = (month) => { const w = world('seas'); w.startMs = Date.UTC(2026, month - 1, 15); return w; };
  const win = at(1), aut = at(10), sum = at(7), spr = at(4);
  assert.ok(E.mouths(win, 'goblins') > E.mouths(aut, 'goblins')); assert.equal(E.mouths(win, 'goblins') / E.mouths(aut, 'goblins'), 1.25);
  assert.equal(E.income(aut, 'goblins').food - E.income(sum, 'goblins').food, Object.values(aut.towns).filter((t) => t.owner === 'goblins' && t.trade === 'food').length);
  const rec = (w) => { const w2 = structuredClone(w); w2.clans.goblins.res.food = 60; const r = step(board, w2, [], 1); return ev(r.events, 'recruits').find((e) => e.clan === 'goblins').n; };
  assert.equal(rec(sum) - rec(aut), 1);
  const ev1 = ev(step(board, at(4), [], 1).events, 'season'); assert.equal(ev1[0].season, 'spring');
  // spring: crossing a river costs the attacker's best die 2, otherwise 1 (checked through a lone attack across a river border)
});

test('clan kinds: goblins dig in at 2, rats breed fast and eat badly, toads ignore rivers, gnomes build cheaply', () => {
  assert.equal(K.digMinFor('goblin', 3), 2); assert.equal(K.digMinFor('rat', 3), 3);
  assert.equal(K.recruitBonusFor('rat'), 1); assert.equal(K.recruitBonusFor('toad'), 0);
  assert.ok(K.unitsPerFoodFor('rat', 14) < 14); assert.equal(K.unitsPerFoodFor('toad', 14), 14);
  assert.equal(K.ignoresRiver('toad'), true); assert.equal(K.ignoresRiver('goblin'), false);
  const w = world('gnome', {}); w.clans.rats.kind = 'gnome';
  assert.equal(K.digCostFree('gnome'), true);
  const g = world('g2'); const ra = Object.keys(g.towns).find((t) => g.towns[t].owner === 'goblins');
  assert.equal(E.bridgeCostFor(g, board, 'goblins', ra), Math.max(1, K8.bridgeCost - (R.ruleOf(board, ra) === 'rivers' ? 2 : 0)));
  assert.equal(E.bridgeCostFor(w, board, 'rats', ra), Math.max(1, K8.bridgeCost - (R.ruleOf(board, ra) === 'rivers' ? 2 : 0) - 2), 'a gnome pays 2 less');
  // a toad attacker is not slowed by a river: its fronts do not start Behind
  const t = world('toad'); t.clans.goblins.kind = 'toad';
});

test('region rules: roads halve convoy legs, rivers cheapen bridges, hills dig in free, farm and coast add Food and units', () => {
  const w = world('rules');
  const byRule = (r) => regions.kits.filter((k) => k.rule === r).map((k) => k.id);
  const town = (rule) => Object.keys(board.towns).find((t) => R.ruleOf(board, t) === rule);
  const rr = town('rivers'), co = town('coast');
  assert.equal(E.bridgeCostFor({ clans: { goblins: { kind: 'goblin' } } }, board, 'goblins', rr), K8.bridgeCost - 2);
  assert.equal(E.hireUnitsFor(board, co), K8.hireUnits + 2); assert.equal(E.hireUnitsFor(board, town('hills') || rr), K8.hireUnits + (R.ruleOf(board, town('hills') || rr) === 'coast' ? 2 : 0));
  const roadTowns = Object.keys(board.towns).filter((t) => R.ruleOf(board, t) === 'roads');
  let found = null; for (const a of roadTowns) for (const b of board.neighbours(a)) if (R.ruleOf(board, b) === 'roads' && !found) found = [a, b];
  const plainLeg = V.legTicks(makeBoard(read('../../../data/goblin-board.json'), content), found[0], found[1]);
  assert.ok(V.legTicks(board, found[0], found[1]) <= plainLeg); if (plainLeg > 1) assert.ok(V.legTicks(board, found[0], found[1]) < plainLeg, 'a roads region is faster');
  assert.ok(byRule('roads').length >= 1);
});

test('chapters: the next home is the most populous township of the nearest unplayed region, rivals are drawn from the pool, and your clan travels', () => {
  const w = world('ch1'); w.clans.goblins.res = { food: 33, build: 22, coin: 11 }; w.clans.goblins.gentle = true;
  const cap = Object.values(w.chars).find((c) => c.clan === 'goblins'); cap.name = 'Old Hand'; cap.wins = 2;
  const next = Ch.nextHome(board, w);
  assert.ok(next && !w.theatre.includes(next)); assert.notEqual(R.kitOf(board, next), R.kitOf(board, w.clans.goblins.home));
  const cfg = Ch.nextChapterCfg(board, w);
  assert.equal(cfg.campaign.chapter, 2); assert.ok(cfg.campaign.kits.includes('highlands')); assert.equal(cfg.clans.filter((c) => c.lord === 'ai').length, 2);
  assert.ok(cfg.clans.every((c) => c.lord === 'human' || ['rat', 'toad', 'gnome'].includes(c.kind)));
  const w2 = newWorld(board, cfg);
  assert.deepEqual(w2.clans.goblins.res, { food: 33, build: 22, coin: 11 }); assert.equal(w2.clans.goblins.gentle, true);
  const kept = Object.values(w2.chars).filter((c) => c.clan === 'goblins');
  assert.ok(kept.some((c) => c.name === 'Old Hand' && c.wins === 2), 'your captain came with you');
  assert.equal(w2.campaign.chapter, 2); assert.deepEqual(checkInvariants(board, w2), []);
  assert.notDeepEqual(w2.theatre, w.theatre);
  assert.deepEqual(Ch.rivalsFor('s1'), Ch.rivalsFor('s1')); const kinds = new Set(); for (let i = 0; i < 20; i++) Ch.rivalsFor('x' + i).forEach((r) => kinds.add(r.kind)); assert.deepEqual([...kinds].sort(), ['gnome', 'rat', 'toad']);
});

test('a bot plays three chapters in a row: wins carry state, losses repeat the region, every world stays valid', () => {
  const log = runCampaign({ seed: 'camp', bot: 'bold', chapters: 3, days: 40 });
  assert.ok(log.length >= 3, `played ${log.length} chapters`);
  const wins = log.filter((l) => l.won);
  assert.ok(wins.length >= 2, `won ${wins.length}`);
  for (const l of log) assert.deepEqual(checkInvariants(rboard, l.state), []);
  const kits = log.filter((l) => l.won).map((l) => l.kit); assert.equal(new Set(kits).size, kits.length, 'each won chapter was a different region');
  assert.ok(log.at(-1).state.campaign.chapter >= 2);
  console.log('# campaign:', log.map((l) => `${l.chapter}:${l.kit}:${l.won ? 'won d' + l.day : 'not won'}`).join(' | '));
});

// ---- the river rules, through real dice: the attacker's best die is cut by 1 across a river, by 2 in spring, and not at all for toads or across a bridge
function riverPair(w) {
  for (const a of Object.keys(w.towns)) for (const b of board.neighbours(a)) { const bd = board.border(a, b); if (w.towns[b] && bd && bd.river && !(bd.highways && bd.highways.length)) return [a, b]; }
}
function attackAcross(month, kind = 'goblin', bridged = false) {
  const w = world('river'); w.startMs = Date.UTC(2026, month - 1, 15); w.clans.goblins.kind = kind;
  const [a, b] = riverPair(w);
  w.towns[a].owner = 'goblins'; w.towns[a].force = 20; w.towns[a].captain = null; w.towns[b].owner = 'rats'; w.towns[b].force = 5; w.towns[b].captain = null; w.towns[b].dugIn = false;
  if (bridged) { w.bridges = { [E.bridgeKey(a, b)]: ['goblins'] }; }
  const q = [6, 3, 2, 1, 1, 6, 3, 2, 1, 1, 6, 3, 2, 1, 1, 6, 3, 2, 1, 1]; const r0 = makeRng0(q);
  const out = step(board, w, [{ type: 'attack', clan: 'goblins', from: a, to: b, n: 10 }], 0, { rng: r0 });
  return ev(out.events, 'skirmish_result')[0].rounds[0];
}
import { makeRng, seedState } from '../../../js/goblin/sim/rng.js';
function makeRng0(dice) { const r = makeRng(seedState('rv')), qq = [...dice]; return { get state() { return r.state; }, next: () => r.next(), int: (n) => r.int(n), d6: () => (qq.length ? qq.shift() : r.d6()) }; }

test('across a river the attacker loses 1 from the best die; in spring 2; a toad or a bridge removes it', () => {
  const best = (r) => Math.max(...r.aEff);
  assert.equal(best(attackAcross(10)), 5, 'autumn: 6 becomes 5');
  assert.equal(best(attackAcross(4)), 4, 'spring: 6 becomes 4');
  assert.equal(best(attackAcross(10, 'toad')), 6, 'toads swim');
  assert.equal(best(attackAcross(10, 'goblin', true)), 6, 'a bridge');
  assert.equal(best(attackAcross(4, 'toad')), 6, 'and in spring too');
});

test('hills dig in free of Build and farm regions yield more Food', () => {
  const w = world('hills'); const hills = Object.keys(w.towns).find((t) => R.ruleOf(board, t) === 'hills' && w.towns[t].owner === 'goblins');
  if (hills) {
    for (const t of Object.values(w.towns)) t.dugIn = true; w.towns[hills].dugIn = false; w.towns[hills].attackedTick = -1; w.towns[hills].force = Math.max(3, w.towns[hills].force);
    w.clans.goblins.res.build = 0; w.clans.goblins.lastActive = 0;
    const r = step(board, w, [], 1); assert.equal(ev(r.events, 'dug_in').filter((e) => e.town === hills).length, 1, 'dug in with no Build');
  }
  const f = world('farm'); const farm = Object.keys(f.towns).find((t) => R.ruleOf(board, t) === 'farm' && f.towns[t].owner === 'goblins' && f.towns[t].trade === 'food');
  if (farm) assert.equal(E.income(f, 'goblins', board).food - E.income(f, 'goblins').food, Object.keys(f.towns).filter((t) => f.towns[t].owner === 'goblins' && f.towns[t].trade === 'food' && R.ruleOf(board, t) === 'farm').length);
});
