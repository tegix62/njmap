# 14. The economy (as built, F2)

Built 2026-11-15 from the finish plan's stage F2 (P6 to P10), in `js/goblin/sim/economy.js` with constants `K8`. A clan has an economy only if its state has `res`, so older worlds and unit tests are unaffected; `newWorld` turns it on by default (`rules.economy` 1). Every number is a starting value to tune, and the whole of this document is a proposal until the user has played it (D218).

## The three resources

| | Source | Sinks |
|---|---|---|
| **Food** | every township farms 1 a major tick; a Food town 3 | units eat 1 Food per 14 a tick (units beyond 10 in one township eat double); each recruit costs 1; each march costs 1 per 4 units sent |
| **Build** | a Build town yields 1 a day (at 12:00) | digging in at a tick costs 1 per township; digging in at once costs 2; a goblin bridge costs 4 and takes three major ticks (D109) |
| **Coin** | a Coin town yields 1 a day | a hired band: 6 Coin for 4 units in one township, once a day |

A clan starts with 12 Food, 4 Build, 4 Coin; a stockpile holds at most 60 of each.

**A township's trade** (P8, a placeholder rule until real trades are verified in F5): by population rank inside the theatre, the biggest third are Coin towns, the middle third Build, the smallest third Food. The real industry of a town (zinc, silk, bog iron) will be flavour on top (D112).

## Shortage, and what it never does

A clan that cannot pay its upkeep gets a warning at the first short tick ("running short of Food: if it is not put right within a day, units will start to drift home"). After a day (three major ticks) short, a quarter of the unfed units drift home each major tick, from the largest garrisons, never below one a township, and never a captain (D113: a shortage is a story and never a penalty to a named character without warning). Recruits and marches simply wait for Food.

## Which rules the user asked about (P6 to P10), as built

- **P6** the Food rule above. 
- **P7** fortify at once costs Build, not an action; scouting, taunting, attacks and fronts still cost an action; an attack or front also costs Food by distance (D113).
- **P8** the trade rule above.
- **P9** a goblin bridge: 4 Build, three major ticks, then the river border no longer hurts that clan's attackers or starts its fronts Behind; it is that clan's structure (the other clans do not get it) and the real map is never changed (D106). It stays for the rest of the war.
- **P10** a hired band is in (the simplest thing for Coin to do before convoys).

AI clans live under the same rules: they pay for recruits and marches, dig in with Build, and spend Coin on a band at their best attack position.

## What was tried and not kept

- **Unrest on conquest** (a conquered township yields nothing for 2 to 6 days). It hurt the careful bot and did nothing to the bold one, so `unrestTicks` is 0.
- **A tighter upkeep** (1 Food per 6 or 8 units): Food sat at zero all war and the careful bot starved (0 percent of chapters won). 1 per 14, with the crowding rule, gave the careful bot 50 percent.

## Measured (docs/goblins/11-tuning-plan.md)

| Target | Want | Before F2 | After F2 |
|---|---|---|---|
| Careful wins a chapter | 50 to 70 percent | 55 | 50 |
| Bold wins a chapter | 40 to 60 percent | 100 | **100 (still fails)** |
| Biggest stack against the median | under 5 times | 5.2 | 6.7 (fails) |
| Passive keeps townships | at least 80 percent | 68 | 68 (fails) |
| Units per township after 400 days, any clan | bounded | unbounded (H52) | **under 40, tested** |

The economy does what it was for in one respect: force no longer grows without limit (H52 closed). It did not fix the bold bot, which wins before income matters: it runs three fronts at once, keeps one unit home and conquers in about ten days. The rival clans still mass stacks. Both are left as open findings for the user's play and for stage F3's costs (parley and captives) and F6's Director budget.

## Not built (named so nothing is silently dropped)

Real trades by town (F5); convoys (F4); repairing a township after it falls; gifts between allies (shared mode); Coin for ransom and parley (F3).
