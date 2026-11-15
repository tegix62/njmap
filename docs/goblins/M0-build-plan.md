# M0 build plan: the headless simulation

Written 2026-11-15. M0 is the first stage of the build order (D199): the rules as plain code with no screens, judged by reading the stories it produces. Nothing here touches the app or the phone. Everything is disposable until the gate at the end passes.

**Read first:** `04-systems-spec.md` (the rules), then `03-design-summary.md` (what the game is). The decisions log (01) is the record, not required reading. Sections marked [M0] in the spec are in scope; nothing else is.

## Status

- **S1 built 2026-11-15** (`tools/build_goblin_board.py`, `data/goblin-board.json`, 418 KB, about 50 KB gzipped). All asserted anchors hold. Findings that changed the spec: (1) the river tolerance is **150 m**, not 50 m: wide rivers such as the Raritan sit about 100 m off the boundary line; (2) **Paterson–Totowa is a land border**, so the earlier claim that the Passaic runs along half of it was wrong (it came from sampling uneven border vertices; the builder samples every 25 m); (3) highways are stored in several pieces, and the two carriageways of one road are separate duplicates, so `lanes[].segments` keeps each ordered piece and drops any that adds no new link; (4) only 8 ridge lines exist (the Watchungs are not among them), so ridge borders are few (9); (5) 166 of 1,445 borders are river borders and 568 are crossed by a highway.
- S2 to S8: not started.

## What M0 must answer

| Question | Hole | How M0 answers it |
|---|---|---|
| Does a three-week war keep producing new situations? | H2 | Count distinct event shapes per day across 21 days |
| Are losses too high or too low? | H48 | Units lost per township taken, per clan |
| Do fronts end, and how long are they? | H44 | Distribution of beats per front; zero stalemates by construction, verified |
| Does a careful style or a bold style win, or both? | H41, D156 | Two bot lords with different policies, compared |
| Is the Director doing anything? | H20 | Pressure words over time; hostile actions cancelled or added |
| Do the stories read well? | H1 | The user reads three rendered Ledgers. Only this one is a judgment |

## Layout

```
tools/build_goblin_board.py     board builder (Python, like the other tools)
data/goblin-board.json          its output
data/goblin-content.json        placeholder content, every entry flagged
js/goblin/sim/rng.js            seeded generator, state in and out
js/goblin/sim/board.js          board access: neighbours, border facts, theatre
js/goblin/sim/skirmish.js
js/goblin/sim/front.js
js/goblin/sim/chars.js
js/goblin/sim/world.js          step(state, orders, ticks), the world's turn
js/goblin/sim/director.js
js/goblin/sim/ledger.js         event to text, from templates
js/goblin/sim/index.js          newWorld(), step(), legalOrders()
tools/goblin/bots.mjs           bot lords (policies)
tools/goblin/run.mjs            runs a war, writes a Ledger and a metrics file
tools/goblin/test/*.test.mjs    node:test
```

Plain ES modules, no dependencies, no DOM, no `Date`, no `Math.random` inside `js/goblin/sim/` (D7, D197). The same files will later load in the app. Node 22 is available here.

## Steps

Each step is small, ends with something runnable, and has a check that can fail. Do them in order; commit after each.

**S1. The board.** Write `tools/build_goblin_board.py` per spec section 3.
- Done when: 564 towns and 1,445 borders are written; every border has miles and river, ridge and highway fields; the spot-check table prints; the anchors in spec section 3 hold (Paterson–Hawthorne, Newark–Harrison and New Brunswick–Highland Park are river borders; Paterson–Totowa, Paterson–Haledon and Haledon–Totowa are land borders; Clifton–Totowa are not neighbours).
- Then stop and show the user the 12-row spot-check table. This is the one human check in S1 (D187).

**S2. Random numbers and the skirmish.** `rng.js` (mulberry32 or similar; the state is a value passed in and returned). `skirmish.js` per spec section 5, returning the rounds as events.
- Done when: over 20,000 trials the attacker win rates match `docs/goblins/sims/skirmish-01.md` within 2 points for 5v5, 8v8, 10v4, 6v10 plain, 8v8 and 12v8 with dug-in (variant C), and 8v8 with a captain. Same seed gives the same rounds.

**S3. The world's turn, no characters yet.** `world.js`: `newWorld(board, {home, seed, clans})` builds a theatre with clans placed apart, forces from population rank (small 3, medium 5, large 8 to start); `step` runs ticks; recruits, dig-in, AI attacks, declared raids (spec section 8).
- Done when: invariants hold for 1,000 simulated days across 20 seeds (no negative force, every town's owner exists, a raid never lands before its warning, no AI attack on a shielded player); the run is deterministic; 72-tick cap respected.

**S4. Characters.** `chars.js`: generation from the content file, traits with hooks, discovery, injury, death, succession, promotion (spec section 7). Captains are placed in some AI townships at world creation (about one per four townships).
- Done when: unit tests cover each rule; no clan exceeds the captain cap; every trait used exists in the content file and is flagged placeholder.

**S5. Fronts.** `front.js` per spec section 6: the ladder, the maneuver table, modifiers from hidden traits, the decision by standing, yield at Commanding, the closeup, the tally event. `legalOrders(state, clan)` lists what a player may do and never lists a dominated option.
- Done when: a scripted replay of paper test 02 (same choices, forced dice) produces the same standings and the same tally; a front never exceeds 5 beats; a lost front leaves a learned fact when one was available; a pinned captain is never moved by the AI.

**S6. The Director.** `director.js` per spec section 9.
- Done when: tests show a Heated player is not attacked that tick, two Calm days add one hostile action, the 18:00 tick adds nothing hostile, and the empty-day rule always leaves one decision.

**S7. Bots, the runner and the Ledger.** Two bot lords in `tools/goblin/bots.mjs`: **Careful** (probes first, fights at Ahead, keeps 3 at home) and **Bold** (levers and early decisions, goes all in). `run.mjs --seed N --days 21 --bot careful|bold --home "Name|County"` writes `out/ledger-<seed>.md` and `out/metrics-<seed>.json`. `ledger.js` renders events with placeholder templates; place phrases come from the board.
- Done when: 21-day runs complete for 10 seeds per bot in a few seconds; the metrics file has the measures in the table above; the Ledger reads as sentences with real place names, distances and directions.

**S8. The read (the gate).** Produce three Ledgers (one Careful, one Bold, one where the player is losing). The user reads them and answers: would I want to have played this? what is boring? what is confusing?
- This step is the user's. M1 does not start until they say so.

## What is deliberately out of M0

The map and any screen; fog of war; Food, Build and Coin; convoys; the quiz charge; insults as their own verb; dwarves, the rogue, weather and seasons; shared play; real names, traits or jokes (all placeholder, D68).

## Working notes for whoever builds it

- **Models.** S1 to S7 are well-specified work that a Sonnet session can do end to end. Come back to a stronger model for two things only: judging S8's output and deciding what to change, and any moment where a metric shows a structural problem rather than a tuning one.
- **Start a fresh session** for the build. This plan and the spec are written to be picked up cold.
- **When the spec is silent, do not invent a rule quietly.** Pick the simplest thing, put it in the constants table or note it at the top of the file, and list it in the step's commit message so it reaches the decisions log.
- **Geography is computed.** Any sentence about a place comes from the board file. Twice now, text written from memory was wrong (H42).
- **Keep every number in one constants module.** Tuning is the point of M0.
- Branch: `claude/nj-township-navigation-c74ho2`. Do not push to any other branch.

## Kickoff prompt for the build session

> Read `docs/goblins/M0-build-plan.md` and `docs/goblins/04-systems-spec.md`. Build M0 step by step, starting at S1. After each step run its checks, commit, and tell me in two or three lines what passed. Stop after S1 to show me the spot-check table, and stop at S8 with the three Ledgers.
