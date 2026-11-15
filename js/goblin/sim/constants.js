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
  startHour: 8,               // the war begins at 08:00 so the first tick is the 09:00 major tick
  smallThird: 3, midThird: 5, bigThird: 8, homeBonus: 2,   // starting forces by population rank within the theatre, home +2
  absentAfterTicks: 72,       // D189: a human not seen for three days is "absent"
});
