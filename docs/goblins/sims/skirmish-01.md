# Simulation 01: the skirmish dice rule

Run 2026-11-14 with `python3 -I tools/sim_skirmish.py` (20,000 trials per line, fixed seed). The first artifact of the tuning plan: it tests whether a Strategery-style dice rule lets a smart player "roll people" (D144, D145) before any screen exists.

**The rule (D149, my own starting rule, Risk-style).** The attacker rolls up to 3 dice and leaves one unit behind; the defender rolls up to 2. Dice are compared in pairs, highest first. A tie goes to the defender. Each lost pair costs a unit. Fortification gives the defender one extra die; a captain leading gives that side one extra die. I do not know the actual rule of the user's reference game.

| Attacker vs defender | Attacker wins | Average attackers left |
|---|---|---|
| 5 vs 5 | 36% | 3.7 |
| 8 vs 8 | 45% | 4.7 |
| 10 vs 10 | 49% | 5.3 |
| 10 vs 4 | 93% | 7.3 |
| 12 vs 6 | 91% | 7.8 |
| 6 vs 10 | 12% | 3.7 |
| 8 vs 8, defender fortified | 16% | 4.4 |
| 10 vs 10, defender fortified | 14% | 4.9 |
| 8 vs 8, a captain leads the attackers | 61% | 5.2 |
| 10 vs 10, a captain leads the attackers | 68% | 5.9 |

**Concentration.** Sixteen units on one 6-unit town and then the rest on a second take both 74% of the time. Splitting 8 and 8 across the same two towns takes both 41% of the time.

## What it shows

1. **Concentration beats parity.** A 2-to-1 mass wins about 9 times in 10; even forces slightly favour the defender. This is the "if you are smart you can roll people" feeling the user described.
2. **Fortification is very strong.** One extra defender die cuts an even attack from about 45 to 50 percent down to about 15 percent. That matches the user's pleasure in watching enemies bleed against a fortified front (D146) and "losing ground is very rare" (D137). It also means an attacker needs about 2 to 1 against a fortified border.
3. **A captain is a large edge** (about +16 to +19 points at parity). It may be too large for a single extra die and should be tuned.
4. **Splitting the force is costly,** which makes the garrison question (H43) and the choice of where to attack real.

## Open

Whether fortification should be this strong; whether a captain should be one die or something smaller; how a river or ridge across the border adds one modifier per attack (geography as physics); and whether the player should ever see these numbers (the rule is counts and shown dice, never percentages, D99).

## Update: fortification tuning (2026-11-14)

The user wanted fortification "somewhere in between" nearly impassable and a mild edge. `tools/sim_skirmish.py` part 2 compares five variants (attacker win rate, 20,000 trials each):

| Variant | 8 vs 8 | 10 vs 10 | 12 vs 8 (1.5 to 1) | 12 vs 6 (2 to 1) |
|---|---|---|---|---|
| Plain (no fortification) | 44% | 48% | 79% | 90% |
| A: defender rolls one extra die | 16% | 14% | 40% | 62% |
| B: attacker limited to 2 dice | 17% | 15% | 44% | 65% |
| **C: defender's best die +1** | **20%** | **20%** | **53%** | **74%** |
| D: defender's best die +2 | 6% | 6% | 28% | 51% |

**Chosen default: C.** It makes an even attack unlikely, a 1.5 to 1 attack about a coin flip, and a 2 to 1 attack likely: between a wall and a speed bump. Variant A (an extra die) is kept as a possible stronger "fortress" tier, for example an upgrade bought with Build. The captain effect is still large and should be tuned.
