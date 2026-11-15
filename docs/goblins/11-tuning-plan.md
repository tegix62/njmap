# 11. Tuning plan

Started 2026-11-15 (finish plan stage F0). The targets are the finish plan's section 5, run as `node tools/goblin/targets.mjs` (20 seeds, about five seconds; `--set rule=value,...` tries a rule, `--strict` exits 1 on any failure). The Careful and Bold bots play up to 35 days, a Passive lord (it only opens the game each day) plays 60. The numbers are starting values and the user may move them (P1).

## The targets and where they stand

| Target | Want | Now (F0 done) | Before F0 |
|---|---|---|---|
| Careful wins a chapter in 35 days | 50 to 70 percent | **65 percent** | 100 |
| Bold wins a chapter in 35 days | 40 to 60 percent | 100 percent (fails) | 100 |
| Length of a won chapter (Careful) | 14 to 28 days | **24.2** | 11.5 |
| Passive keeps townships after 21 days | at least 80 percent | 68 percent (fails) | 70 |
| A rival wins against a passive player | not before day 40 | day 39 (fails by one) | day 36 |
| Biggest stack against the median garrison | under 5 times | **3.8** | 12 |
| Fronts that reach a decision beat | at least 60 percent | **100 percent** | 100 |
| Fronts lost by Careful | 15 to 30 percent | 33 percent (fails by three points) | 30 |
| Distinct kinds of event on an active day | at least 6 | **8.1** | 8.4 |

## What F0 changed, and what it measured

Three per-world rules were added (all in `DEFAULT_RULES`, all measured apart and together with `targets.mjs`):

1. **`aiRecruitSplit`** (adopted at 0.5): that fraction of an AI's recruits go to its weakest border township, the rest to its best attack position. 0.3 left Careful winning 95 percent; 0.5 gave 65 percent and cured the hoarding (biggest stack 3.8 times the median); 0.7 gave Careful 35 percent, too hard.
2. **`aiCounterRatio`** (built, off): an AI may retake a township it lost in the last day at a lower ratio. Measured alone and in combination it changed nothing that mattered.
3. **`aiPeaceShare`** (built, off): while a human holds more than a share of the theatre the AI clans stop fighting each other. At 0.4 with a split of 0.5 it lowered Careful to 55 percent (still passing) but broke the stack target; it is a rubber band and H49 asks whether it is fair, so it stays off until the user answers P2.

A 12-way sweep (split 0.3, 0.5, 0.7 against counter 0, 1.5 against peace 0, 0.4) is the evidence; only the split mattered.

## What is still failing, and why

- **Bold wins 100 percent.** Bold keeps one unit home, runs three fronts and attacks at 1.2 to 1. The thin garrisons that remain after any recruit rule are its food. A rule that makes a conquered township a liability (upkeep, unrest) is the economy's job, stage F2.
- **Passive loses about a third in 21 days** (68 percent kept, target 80). It is only that the AI raids a player it can beat 2 to 1, and a player who never moves is always beatable. The target may be wrong: a player who opens the game daily and never acts is an unusual case, and a player who is truly away is protected by D189. P1 asks the user.
- **Fronts lost by Careful, 33 against 30 percent.** Three points over; Careful's choices, not the rules, set this. Left for the bots' sake in F1, where scouting (fog) changes it.
- **A rival beats a passive player on day 39**, one day under the target; the same cause as the passive share.

## How to use this

After any rule or constant change, run `targets.mjs` and compare to this table; the plan's rule is that a stage ends with the table no worse than it began. Add a row when a stage adds something measurable (F2: stockpile bounds, units per Food; F4: unwarned losses per two days).

## After the peace rule went on (D216b, the user's yes to P2)

With `aiPeaceShare` 0.4: Careful wins 55 percent (pass), won chapters last 26.3 days (pass), the biggest stack is 5.2 times the median (fails by 0.2), Bold still wins 100 percent. Four of nine targets pass. The stack figure is the price of the rivals not fighting each other; the economy (F2) is the remedy.

## After the economy (F2, 2026-11-15)

Four of nine targets pass: Careful wins 50 percent of chapters and they last 20.8 days; fronts reach a decision and the day is varied (8.9 kinds of event). Failing: Bold 100 percent, the passive player keeping 68 percent, a rival beating a passive player on day 36, the biggest stack at 6.7 times the median, and Careful losing 33 percent of fronts. Force is bounded now (under 40 units a township after 400 days, a test), which closes H52. See `14-economy.md` for what was tried (a conquest unrest and a tighter upkeep) and why they were dropped. The bold bot is the open problem: it wins before income matters.

## After the dwarves (F6, 2026-11-15)

The targets script now rotates four homes (Paterson, Newark, Edison, Hackensack) and draws rivals from the pool, because the real map is uneven: with one home (Paterson) the dwarves around it made the careful bot win every chapter and left a passive player almost untouched, while Newark gave 4 wins in 10 and Toms River (no rock towns) 10 in 10. Results over the four homes:

```
Targets (20 seeds)
FAIL  Careful wins a chapter (35 days)                               80 percent             want 50 to 70 percent
FAIL  Bold wins a chapter (35 days)                                  100 percent            want 40 to 60 percent
pass  Length of a won chapter (Careful, mean days)                   17.8                   want 14 to 28 days
FAIL  Passive keeps townships after 21 days (mean share of start)    76 percent             want at least 80 percent
pass  A rival wins against a passive player                          earliest day 44        want not before day 40
FAIL  Biggest stack against the median garrison (mean)               8.4 times              want under 5 times
pass  Fronts that reach a decision beat (Careful)                    95 percent             want at least 60 percent
FAIL  Fronts lost by Careful                                         32 percent             want 15 to 30 percent
pass  Distinct kinds of event on an active day (mean)                12.0                   want at least 6
4 of 9 pass
```

The baseline moved: earlier tables used Paterson only and fixed rats and toads, so they are not comparable with this one. The dwarf strength numbers (goad time, strike ratio, garrison) were swept and made no difference; what matters is that rivals lose their rock towns at the start and waste attacks on the rock.
