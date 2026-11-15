# Simulation 03: bot lords over 21 days (M0 step S7)

Run 2026-11-15 with `node tools/goblin/run.mjs --seeds 10 --days 21 --bot careful|bold|passive`, home Paterson, spec rules as written (`frontMaxGain` 2), three clans (the bot's goblins against two AI clans). Ten seeds take under a second per bot. Everything is placeholder wording; the numbers are what matter here.

**The bots** (see `tools/goblin/bots.mjs`): **Careful** keeps 3 at home, opens one front at a time against a captain it can roughly match, probes and presses, levers once it has learned something, fights the decision only when Ahead, and gives up from Behind after three maneuvers; it attacks without a captain only at 2 to 1. **Bold** keeps 1 at home, runs up to three fronts, presses and levers, decides after one or two maneuvers, and attacks at 1.2 to 1. **Passive** only opens the game (a `present` order) and never gives another.

## Results (means over 10 seeds; start 20 townships each)

| | Careful | Bold | Passive |
|---|---|---|---|
| Townships after 21 days | 47.8 | 57.7 | 14.0 |
| Distinct event shapes per day | 6.1 | 6.6 | 1.3 |
| Fronts opened | 18 | 34 | 0 |
| Fronts closed by Yield / Won / Lost (all 10 seeds) | 125 / 36 / 15 | 194 / 57 / 89 | |
| Units lost per township taken | 6.3 | 7.8 | |
| Extra raids from two Calm days | 1.8 | 0.8 | 5.4 |

## What it answers (the table in the M0 plan)

- **H2, does a three-week war keep producing new situations?** Yes by this measure: 6 to 7 different kinds of event on an average day for an active lord. A passive lord sees about 1: raids against them and the mood word.
- **H48, are losses too high or too low?** About 6 to 8 of the player's units per township taken, and the AI armies lose far more (they fight with stacks of 50 or more). Not alarming. Whether it *feels* too high is the user's call in S8.
- **H44, do fronts end?** Always. Beats per front ran 1 to 4 for the bots; none stalled (one front was open at the end of a run, as expected).
- **H41 / D156, careful or bold?** Both win, bold more and with far more lost fronts (89 against 15). That is the shape wanted, but both conquer most of the theatre in three weeks, which is too fast (below).
- **H20, is the Director doing anything?** Yes. It held back hostile actions 8 to 9 times per run against an active lord and added 1 to 2 extra raids; a passive lord drew 5.4 extra raids. The empty-day rule did not matter in these runs either.
- **H1, do the stories read well?** The user's judgment, S8.

## Findings that need the user's decision (none applied)

1. **A front is usually over in one or two beats.** Of 125 + 36 + 15 Careful fronts, 71 percent ended by the defender yielding (Commanding), usually probe, then lever. A lever has +2 for the known fact, so a roll of 6 or more moves up two, and from Even two steps is Commanding. The decision beat, the tension the design wanted, appears in under a third of fronts. Variant tested: `frontMaxGain` 1 (no maneuver moves more than one step): yields vanish, the decision happens in every front, Careful loses 21 percent of its fronts (Careful 41 lost, 135 won) and pays 8.1 units per township instead of 6.3, and the end result barely changes (44.9 townships). This is probably the right direction but it changes D148 and is the user's call.
2. **The AI hoards.** Each AI clan masses all its recruits in one township (D208), so stacks of 50 to 80 sit beside garrisons of 1 to 3. The bots exploit the thin garrisons, and whenever a stack moves against the player it crushes a 10-unit township (H52, force without upkeep, is the cause). Needs the economy (Food upkeep) or a spreading rule in recruits.
3. **The player conquers 80 to 100 percent of the theatre in 21 days.** Follows from the first two. The conquest tempo (D209) only throttles the AI.
4. **Passive loses ground slowly** (20 to 14), mostly to a few huge raids; that is the "losing" Ledger.
5. The first sitting often has nothing to do: forces start at 3 to 10, and the bots need 7 or more to open a front.

## The three Ledgers for S8

`docs/goblins/ledgers/ledger-careful-1.md`, `ledger-bold-1.md`, `ledger-passive-1.md` (seed 1, with their metrics files beside them). Wording is all placeholder.
