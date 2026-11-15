// Bot lords for the headless runs (docs/goblins/M0-build-plan.md S7). A bot sees the same thing a player sees through legalOrders and the
// public world, and returns one order at a time until it has nothing it wants to do this sitting. It never looks at hidden traits.
//
//   makeBot('careful' | 'bold' | 'passive')  ->  { name, next(board, w, clanId, ctx, rng) -> order | null, newCtx() }

import { legalOrders, frontActions, openFronts } from '../../js/goblin/sim/front.js';
import { scoutMods } from '../../js/goblin/sim/sitting.js';
import { undiscovered } from '../../js/goblin/sim/chars.js';

const byForce = (w, id) => w.towns[id].force;
const maxN = (o) => (typeof o.n === 'object' ? o.n.max : o.n);

function frontOrder(w, clan, ctx, policy) {
  for (const f of openFronts(w, clan).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if ((ctx.beats[f.id] || 0) >= policy.beatsPerSitting) continue;
    const acts = frontActions(w, f);
    const o = (action) => { ctx.beats[f.id] = (ctx.beats[f.id] || 0) + 1; return { type: 'front', clan, front: f.id, action, ...(action === 'decision' ? { n: f.units } : {}) }; };
    const canManeuver = acts.includes('probe') || acts.includes('lever') || acts.includes('bridge');
    if (acts.includes('decision') && policy.decide(f)) return o('decision');
    if (!canManeuver) return acts.includes('decision') && f.standing >= 1 ? o('decision') : o('disengage');
    if (policy.giveUp(f)) return o('disengage');
    if (acts.includes('bridge') && policy.bridge) return o('bridge');
    if (acts.includes('lever')) return o('lever');
    return o(policy.maneuver(f, acts));
  }
  return null;
}

const careful = {
  scouts: true, keep: 3, maxFronts: 1, beatsPerSitting: 3, attackRatio: 2.0, frontRatio: 0.8, bridge: true,
  decide: (f) => f.standing >= 2,
  giveUp: (f) => f.maneuvers >= 3 && f.standing === 0,
  maneuver: (f, acts) => (acts.includes('probe') && (f.maneuvers % 2 === 0 || !acts.includes('pressure')) ? 'probe' : 'pressure'),
};
const bold = {
  scouts: false, keep: 1, maxFronts: 3, beatsPerSitting: 3, attackRatio: 1.2, frontRatio: 0.6, bridge: false,
  decide: (f) => f.maneuvers >= 1 && f.standing >= 1 || f.maneuvers >= 2,
  giveUp: () => false,
  maneuver: (f, acts) => (acts.includes('pressure') ? 'pressure' : 'probe'),
};

function policyBot(name, P) {
  return {
    name,
    newCtx: () => ({ beats: {}, attacks: 0, opens: 0, scouted: new Set() }),
    next(board, w, clan, ctx) {
      const fo = frontOrder(w, clan, ctx, P);
      if (fo) return fo;
      const legal = legalOrders(board, w, clan);
      const home = (o) => w.towns[o.from].force;
      if (openFronts(w, clan).length < P.maxFronts && ctx.opens < P.maxFronts) {
        const cands = legal.filter((o) => o.type === 'front_open' && home(o) - P.keep >= 4)
          .map((o) => ({ o, n: home(o) - P.keep, t: byForce(w, o.to) })).filter((x) => x.n >= x.t * P.frontRatio)
          .sort((a, b) => (a.t - b.t) || (a.o.to < b.o.to ? -1 : 1));
        if (cands.length) {
          const tgt = cands[0].o.to, c = w.chars[w.towns[tgt].captain];
          const ap = w.clans[clan].ap ?? 99;
          if (P.scouts && ap >= 2 && c && undiscovered(c, clan).length && !ctx.scouted.has(tgt)) {   // look before you leap
            ctx.scouted.add(tgt);
            const method = ['sneak', 'ask', 'watch'].map((m) => ({ m, t: scoutMods(w, board, clan, tgt, m).total })).sort((a, b) => b.t - a.t)[0].m;
            return { type: 'scout', clan, town: tgt, method: legal.some((o) => o.type === 'scout' && o.town === tgt && o.method === method) ? method : 'ask' };
          }
          ctx.opens++; return { ...cands[0].o, n: cands[0].n };
        }
      }
      if (ctx.attacks < 2) {
        const cands = legal.filter((o) => o.type === 'attack' && home(o) - P.keep >= 2)
          .map((o) => ({ o, n: home(o) - P.keep, t: byForce(w, o.to) })).filter((x) => x.n / Math.max(1, x.t) >= P.attackRatio)
          .sort((a, b) => (b.n / Math.max(1, b.t) - a.n / Math.max(1, a.t)) || (a.o.to < b.o.to ? -1 : 1));
        if (cands.length) { ctx.attacks++; return { ...cands[0].o, n: cands[0].n }; }
      }
      return null;
    },
  };
}

export function makeBot(kind) {
  if (kind === 'careful') return policyBot('Careful', careful);
  if (kind === 'bold') return policyBot('Bold', bold);
  if (kind === 'passive') return { name: 'Passive', newCtx: () => ({}), next: () => null };
  throw new Error('unknown bot ' + kind);
}
