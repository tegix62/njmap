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
