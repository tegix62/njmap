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

// Added in S5 (docs/goblins/04-systems-spec.md section 6): fronts.
export const K4 = Object.freeze({
  frontMaxPerPlayer: 3,       // D134
  frontMaxManeuvers: 4,       // after this many maneuvers the next beat must be the decision (a front is 2 to 5 beats)
  frontMinManeuvers: 1,       // at least one maneuver before a decision, so a front is never a single beat
  frontMaxGain: 1,            // D210: no single maneuver raises standing by more than one step (the roll bands still read 2, but the gain is capped)
  frontStartStanding: 1,      // Even
  leverBonus: 2,              // a Lever uses a known weakness
  modClamp: 4,                // total modifier to a maneuver roll is clamped to +-this
  maneuverNeedUnits: 3,       // Probe and Pressure need a leading captain or at least this many committed units
  closeupBreakMax: 6, closeupHoldMax: 10,   // 2d6: up to 6 he breaks, 7-10 he holds and is captured, 11+ he persists
});

// Added in S6 (docs/goblins/04-systems-spec.md section 9): the Director.
export const K5 = Object.freeze({
  wCalmBelow: 3, wSteadyBelow: 7, wHeatedBelow: 12,    // pressure score to word
  perFront: 2, perRaid: 3, perFiveUnitsLost: 1, perTownLost: 4, quietPerTicks: 12, quietMax: 3,
  unitsWindow: 24, townsWindow: 72,
  peakPerDay: 1, minorPerDay: 2,
  calmDaysForExtra: 2,        // two consecutive Calm days allow one extra hostile action
  extraRatio: 1.0,            // the extra action needs only this ratio (a lower bar than the AI's 2.0)
  emptyDayRatio: 2.0,         // a bordering enemy weaker than this ratio is "a chance"
  hourMinor: 9, hourPeak: 12, hourRelax: 18,
});

// Added in the sitting model (D214): what a player does between the world's ticks.
export const K6 = Object.freeze({
  apStart: 3, apCap: 4, apPerMajor: 2,   // actions: a human clan starts with 3, gains 2 at each 09:00, 12:00 and 18:00 tick, holds at most 4
  costAttack: 1, costFront: 1, costScout: 1, costFortify: 1, costTaunt: 1,
  scoutTarget: 7, scoutGreat: 10, scoutLoseUnit: 3,   // 2d6 + mods: 7+ learns one fact, 10+ two, 3 or less costs the scout his life (one unit)
  scoutNightBonus: 2, nightFrom: 21, nightTo: 5,       // Sneak: +2 between 21:00 and 05:00
  scoutRiverBonus: 2,                                   // Watch from across the water
  scoutBigTownPop: 20000, scoutBigTownBonus: 2,         // Ask a trader: busier towns have more traders
  tauntTarget: 8, tauntKnownBonus: 2, tauntWindowTicks: 24,   // Taunt: 8+ (with +2 if you use something you have learned) and the next front there starts a step higher
});

// Added with the goal for a war (D215, proposed): what winning is.
export const K7 = Object.freeze({
  warShare: 0.5,            // hold MORE than this share of the theatre...
  warHoldTicks: 72,         // ...for this many ticks (three days) and the war is won
  countyMin: 3,             // a "county" milestone needs a county with at least this many townships in the theatre
  thirdShare: 1 / 3,
});

// Added in F2 (docs/goblins/14-economy.md): Food, Build and Coin. All proposals until the user has played them.
export const K8 = Object.freeze({
  start: { food: 12, build: 4, coin: 4 },
  foodPerTown: 1, foodTownBonus: 2, buildPerTown: 1, coinPerTown: 1,   // every township farms 1 Food a major tick; Food towns +2; a Build town yields 1 Build and a Coin town 1 Coin, once a day (the 12:00 tick)
  unitsPerFood: 14,            // 1 Food a major tick feeds this many units
  crowd: 10,                  // units in one township beyond this eat double: a big stack costs more to keep than the same units spread out
  unrestTicks: 0,             // a township just conquered yields nothing for this many ticks (tried 48 to 144: it hurt the careful bot and not the bold one, so it is off)
  recruitCost: 1,             // Food per recruit
  marchPerUnits: 4,           // an attack, front or raid costs 1 Food per this many units sent (at least 1)
  resCap: 60,                 // a stockpile holds at most this much of each
  graceMajors: 3,             // short of Food for this many major ticks in a row (a day) and units start to drift home
  desertDivisor: 4,           // ...losing this fraction (1 in 4) of the unfed units each major tick
  digInCost: 1,               // Build, per township, when it digs in at a tick
  fortifyCost: 2,             // Build, to dig in at once (instead of an action)
  bridgeCost: 4, bridgeMajors: 3,   // Build, and major ticks to finish a goblin bridge over a river border (D109)
  hireCost: 6, hireUnits: 4,  // Coin: a hired band of this many units in one township, once a day
});

// Added in F3 (docs/goblins/13-finish-plan.md): the rest of the sitting. All proposals until the user has played them.
export const K9 = Object.freeze({
  footholdTarget: 8, footholdLoseUnit: 4, footholdDecay: 2,   // 2d6 + method: 8+ places a foothold, 4 or less loses a unit; each earlier run on the same township the same day is -2 (D95)
  swarmCap: 3, nightBonus: 2, fordBonus: 3, fordLose: 2,        // swarm: +1 per whole 1x of your force over theirs (to +3); night: +2; ford: +3 across a river, but a bad roll costs 2 units
  footholdTired: 3,            // each earlier foothold run by the same clan the same day is this much worse (the grind brake, H29)
  footholdHoldAt: 1,           // at the next tick the foothold becomes a conquest if your best bordering garrison (minus the one that stays) is at least this multiple of theirs
  parleyCost: 4, truceTicks: 24,   // Coin; the captain's township will not attack you for a day
  insultTarget: 8, insultKnownBonus: 2, insultDrop: 15, insultBackfire: 10,
  humiliatedBelow: 40, recoverAbove: 55, confidenceRecovery: 5,   // confidence 0 to 100; at or below 40 a captain is Humiliated and his fronts start a step better for you; +5 a day back toward 70
  frontWinConfidence: 10, frontLossConfidence: 15,
  duelWin: 10, duelLose: 15,
  ransomBase: 6, ransomPerGeneration: 3, keepFood: 1,           // Coin the other clan pays; Food a major tick to keep a captive
  legendWins: 3,
});
