# Simulation 02: does a force cap stop the snowball?

Run 2026-11-15 in M0 S3 with `node tools/goblin/experiments/snowball.mjs [--ai-only]` (20 seeds, 365 days each, the real board, a 58-township theatre around Paterson, three clans). Question: with the world rules as specified (D203 recruits, D205 attacks at 2 to 1 or better, D207 even starting shares, D208 AI recruits at its best attack position), one clan takes everything and force grows without limit (H52). Does the simplest fix, a cap on force per township with tapering recruits, stop that?

**Answer: no.** It bounds the force and does nothing about the runaway; in one setup it froze the world.

## Setup 1: one idle human and two AI clans

| Variant | Median fights | Last fight, day | Seeds where one clan took 50+ of 58 | Final force | Biggest clan |
|---|---|---|---|---|---|
| A. No cap, no taper (the world as specified) | 121 | 70 | 20 of 20 (by day 49) | 18,953 | 57 |
| B. **Cap 30 + taper (the simplest)** | **0** | **0** | **0 of 20** | 1,740 | 20 |
| C. Taper only | 129 | 104 | 20 of 20 (by day 65) | 12,403 | 57 |
| D. Cap 30 + taper, AI attacks at 0.7 | 200 | 66 | 20 of 20 (by day 55) | 1,740 | 57 |
| E. Cap 30 + taper, AI attacks at 1.0 | 139 | 29 | 0 of 20 | 1,740 | 40 |

## Setup 2: three AI clans, no human

| Variant | Median fights | Last fight, day | Seeds where one clan took 50+ of 58 | Final force | Biggest clan |
|---|---|---|---|---|---|
| A. No cap, no taper | 185 | 31 | 20 of 20 (by day 27) | 20,588 | 58 |
| B. Cap 30 + taper | 224 | 36 | 20 of 20 (by day 31) | 1,740 | 58 |
| C. Taper only | 215 | 35 | 20 of 20 (by day 31) | 13,306 | 58 |
| D. Cap 30 + taper, AI attacks at 0.7 | 270 | 38 | 20 of 20 (by day 35) | 1,740 | 58 |
| E. Cap 30 + taper, AI attacks at 1.0 | 265 | 38 | 20 of 20 (by day 35) | 1,740 | 58 |

Invariants held in every run (zero problems).

## What it shows

1. **A cap of 30 fills the board, then freezes it.** Every township ends at 30 (58 x 30 = 1,740 units), so no attacker can reach 2 to 1 against a defender at the cap (an AI commits at most 75% of 29, about 21 units). Setup 1 variant B has no fights at all in a year.
2. **The cap bounds force but not the snowball.** With no human in the way (setup 2) every variant is dominated by one clan in 20 of 20 seeds, in about 27 to 35 days, and fights stop by about day 31 to 38. Tapering recruits only slows it (day 27 to day 31).
3. **So recruits are not the engine.** The runaway comes from the AI rule itself: an AI that just won has massed units at its best attack position and attacks again at the next major tick; the clan it beat massed its own recruits for attack, not defence (D208), so nothing holds a border.
4. **The idle human is a punching bag.** In setup 1 the human never fights back, which exaggerates the outcome. Setup 2 is the fair measure of the AI's own dynamics.
5. **A world dominated in about a month undermines the long-term hook** (H2, D172). The human's war needs the AIs to stay roughly balanced for weeks.

## Decision taken

The cap and taper are **not adopted**. They remain available as per-world rules (`world.rules`: `townForceCap`, `recruitFullTowns`, `recruitDivisorBeyond`, `aiAttackRatio`, `aiCommitFraction`); the defaults switch them off, so the world behaves as built in S3.

## Options for the real fix (untested, for the user to choose)

- **Conquest tempo:** after capturing a township an AI clan waits some major ticks (for example three, one day) before its next attack.
- **Defend first:** an AI puts recruits on its weakest border township when any border township faces a neighbour at 1.5 to 1 or better, and masses for attack only when it is safe.
- **A leader's handicap:** a clan holding more than half the theatre needs a higher ratio to attack (for example 3 to 1), and the Director may hold it back (the spec only protects a human today).
- **Weaker conquests:** survivors who take a township arrive at half strength.
- Any of these plus the economy's sinks (Food, Build, Coin upkeep, D110 and D113) once those exist.

# Round 2: conquest tempo and the leader's handicap

Run 2026-11-15 with `node tools/goblin/experiments/snowball.mjs --set tempo [--ai-only]` (20 seeds, 365 days). Both are world rules: **tempo**, an AI clan that has just captured a township waits N ticks before attacking again; **leader's handicap**, a clan holding more than a share of the theatre needs a higher ratio to attack.

## Three AI clans, no human

| Variant | Fights after day 60 | Last fight, day | Seeds where one clan took 50+ of 58 | Biggest clan at day 30 / 100 / 365 |
|---|---|---|---|---|
| A. No tempo, no handicap | 0 | 31 | 20 of 20, by day 27 | 58 / 58 / 58 |
| F. Tempo 24 ticks | 54 | 98 | 20 of 20, by day 89 | 31 / 58 / 58 |
| G. Leader needs 3 to 1 above half | 0 | 32 | 20 of 20, by day 28 | 58 / 58 / 58 |
| H. Tempo 24 + leader 3 to 1 | 46 | 92 | 20 of 20, by day 82 | 31 / 58 / 58 |
| **I. Tempo 72 + leader 3 to 1 (adopted)** | **150** | **290** | **18 of 20, by day 259** | **26 / 27 / 58** |
| J. Tempo 72 + leader 4 to 1 above 40% | 148 | 288 | 20 of 20, by day 238 | 26 / 27 / 58 |

## One idle human and two AI clans

| Variant | Fights after day 60 | Last fight, day | Seeds where one clan took 50+ of 58 | Biggest clan at day 30 / 100 / 365 |
|---|---|---|---|---|
| A. No tempo, no handicap | 3 | 70 | 20 of 20, by day 49 | 41 / 57 / 57 |
| F. Tempo 24 ticks | 57 | 214 | 20 of 20, by day 153 | 20 / 40 / 57 |
| G. Leader needs 3 to 1 above half | 7 | 96 | 20 of 20, by day 60 | 39 / 57 / 57 |
| H. Tempo 24 + leader 3 to 1 | 57 | 290 | 19 of 20, by day 185 | 20 / 39 / 57 |
| **I. Tempo 72 + leader 3 to 1 (adopted)** | **158** | **363** | **0 of 20** | **20 / 22 / 42** |
| J. Tempo 72 + leader 4 to 1 above 40% | 159 | 362 | 0 of 20 | 20 / 22 / 41 |

## What it shows

1. **Tempo is the lever.** Waiting 24 ticks after a capture triples the time to a runaway (day 27 to about day 85); 72 ticks makes it about ten times longer (about day 250).
2. **The leader's handicap alone does nothing** (G is identical to A). A leader only exists once the runaway has begun; the handicap helps only on top of tempo.
3. **With 72 ticks the war stays alive for most of a year** (fights keep happening past day 60, the last fight is around day 290 to 363) instead of ending in a month.
4. **A slow AI fits the design.** The AI takes about one township every three days per clan while a human can take several in a sitting (D138), so the human is the engine of the war.
5. Force still grows (about 9,000 to 10,000 at the end); that needs the economy's sinks (D110, D113), still to come.

## Decision taken

Variant I is the default: `aiCaptureCooldownTicks: 72`, `leaderShare: 0.5`, `leaderAttackRatio: 3.0` (proposed as D209). The tempo and handicap are per-world rules, so tuning can change them.
