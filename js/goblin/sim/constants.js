// Every tunable number in one place (docs/goblins/04-systems-spec.md section 12). Starting values: tuning them is the point of M0.
// Nothing in js/goblin/sim reads a number from anywhere else.

export const K = Object.freeze({
  attackerDice: 3,            // D149
  defenderDice: 2,            // D149
  dugInBestBonus: 1,          // D149 variant C: the defender's best die +1
  riverBestPenalty: 1,        // D206: attacking across a river or ridge border costs the attacker 1 on the best die
  captainExtraDice: 1,        // D149: a captain leading adds one die (large; H48)
  frontBeatsBeforeDecision: 4, // D142
  maxFrontsPerPlayer: 3,      // D134
  recruitsDivisor: 3,         // D203: one unit per three townships, rounded up, at each major tick
  digInMinForce: 3,           // D204
  aiAttackRatio: 2.0,         // D205
  raidWarningTicks: 6,        // D205, D12
  newPlayerShieldTicks: 72,   // D165
  catchUpCapTicks: 72,        // D168
  majorTickHours: Object.freeze([9, 12, 18]), // D82 (Eastern; exact times still open)
  theatreSteps: 3,            // D183
  theatreMin: 12,
  theatreMax: 60,
  captainCapBase: 1,          // spec: 1 + floor(townships / 4) captains per clan
  captainCapPerTowns: 4,
});

// Added in S3 (docs/goblins/04-systems-spec.md section 8; a new working rule beyond D205, flagged in the build log):
export const K2 = Object.freeze({
  aiCommitFraction: 0.75,     // an AI commits this share of its spare units (all but one) so it never empties a border
  // Tried in S3 and NOT adopted (docs/goblins/sims/snowball-01.md): a force cap froze the world or left the snowball untouched. They stay available as
  // per-world rules (world.rules) so tuning can vary them; the defaults below switch them off.
  townForceCap: 99999,        // no township holds more than this; recruits that do not fit spill to the clan's next township, else are lost
  recruitFullTowns: 999,      // up to this many townships a clan recruits 1 per 3 (D203)...
  recruitDivisorBeyond: 6,    // ...and 1 per this many for each township beyond it
  startHour: 8,               // the war begins at 08:00 so the first tick is the 09:00 major tick
  smallThird: 3, midThird: 5, bigThird: 8, homeBonus: 2,   // starting forces by population rank within the theatre, home +2
  absentAfterTicks: 72,       // D189: a human not seen for three days is "absent"
});

// Added in S4 (docs/goblins/04-systems-spec.md section 7): characters.
export const K3 = Object.freeze({
  confidenceStart: 70,        // hidden (D124)
  fearChance: 0.3,            // chance a new captain starts with one terrain fear
  injuryOwn: 1,               // a d6 at or below this injures a captain on the losing attacker's side (1 in 6)
  injuryEnemy: 2,             // ...and this for the other side (2 in 6)
  deathAfterInjury: 1,        // a second d6 at or below this makes the injury fatal
  notableTier2: 2, minorTier2: 2,   // D125: tier 2 has four traits, two notable
  notableTier3: 3, minorTier3: 2,   // tier 3 has five traits, three notable
  startCaptainsMin: 2,        // every clan starts with at least this many captains (and at most its cap)
  captainsPerTowns: 4,        // ...about one per this many townships
  maneuverSuitNotable: 2, maneuverSuitMinor: 1,   // roll bonus when a captain's trait suits a maneuver
});
