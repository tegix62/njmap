// The skirmish: a quick dice fight for a township (D145, D149; docs/goblins/04-systems-spec.md section 5).
//
// Each round the attacker rolls up to 3 dice (one committed unit never rolls) and the defender up to 2. Dice are sorted high to low and
// compared in pairs: a higher attacker die kills a defender, otherwise (a tie too) the attacker loses a unit. It stops when the defenders are
// gone (the attack wins) or only one attacker is left (it fails). Force counts and every die are returned, so the dice can be shown (pillar 12);
// no probability is ever computed or shown (D99).
//
// rng: anything with d6(), such as makeRng() from rng.js (tests pass a scripted one). Attacker dice are rolled before defender dice.

import { K } from './constants.js';

/** Low-level modifiers for a skirmish, from the situation. */
export function modsFor({ captainLeads = false, dugIn = false, riverBorder = false, highway = false } = {}) {
  return {
    atkExtraDice: captainLeads ? K.captainExtraDice : 0,
    atkBestPenalty: riverBorder && !highway ? K.riverBestPenalty : 0,   // a highway through both towns cancels the river penalty (D206)
    defBestBonus: dugIn ? K.dugInBestBonus : 0,
    defExtraDice: 0,
  };
}

const desc = (a, b) => b - a;

export function skirmish({ attackers, defenders, atkExtraDice = 0, defExtraDice = 0, atkBestPenalty = 0, defBestBonus = 0 }, rng) {
  if (!Number.isInteger(attackers) || !Number.isInteger(defenders) || attackers < 0 || defenders < 0) throw new Error('skirmish: whole, non-negative forces only');
  let a = attackers, d = defenders;
  const rounds = [];
  while (a > 1 && d > 0) {
    const na = Math.min(K.attackerDice + atkExtraDice, a - 1);
    const nd = Math.min(K.defenderDice + defExtraDice, d);
    const ar = Array.from({ length: na }, () => rng.d6()).sort(desc);
    const dr = Array.from({ length: nd }, () => rng.d6()).sort(desc);
    const ae = ar.slice(), de = dr.slice();
    if (atkBestPenalty) { ae[0] -= atkBestPenalty; ae.sort(desc); }
    if (defBestBonus) { de[0] += defBestBonus; de.sort(desc); }
    let aLost = 0, dLost = 0;
    for (let i = 0; i < Math.min(ae.length, de.length); i++) { if (ae[i] > de[i]) dLost++; else aLost++; }
    a -= aLost; d -= dLost;
    rounds.push({ a: ar, d: dr, aEff: ae, dEff: de, aLost, dLost, attackers: a, defenders: d });
  }
  // an empty township is simply walked into (no dice); one lone unit cannot attack a defended one
  return { won: d === 0 && a >= 1, attackersLeft: a, defendersLeft: d, rounds, lost: { attackers: attackers - a, defenders: defenders - d } };
}
