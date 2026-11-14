# Paper test 02

Run 2026-11-14 in text, Claude as the engine, the user as the goblin lord. Purpose: test the redesign after test 01 (two speeds of conflict, the front ladder with a decision beat, the closing tally) with every place fact taken from the app's own map data. Names and traits are placeholders (D68). Dice were real random rolls, run with the skirmish rule (D149).

## Setting (from data/nj.topo.json and data/nj-geoms.json)

Goblins hold Paterson. Haledon shares a land border with Paterson and with Totowa (0.4 miles, no river). The Passaic runs along about half of the 1.5-mile Paterson–Totowa border; I-80 and Route 46 run through both towns.

## Hidden state (revealed)

- Haledon: a nameless rat garrison of 5, not fortified.
- Totowa: Rat Captain V, tier 2, with 9 rats behind fortification. Notable traits Greedy and Vain; minor traits Night owl and Clumsy; fear of dogs (never found).
- Test-only front rules: a maneuver rolls 2d6 plus modifiers (11 and over up two steps, 8 to 10 up one, 5 to 7 no move but a discovery, 4 or less down one); a discovered weakness used well moves up two on 8 and over; a goblin bridge moves Behind to Even with no roll. The decision is a skirmish adjusted by standing: Behind, the defender is fortified and has a captain die; Even, fortified; Ahead, neither; Commanding, the enemy yields.

## Log

| Step | Choice | Roll | Result |
|---|---|---|---|
| Skirmish | Send 16 of 20 at Haledon | four rounds | Haledon taken for 2 goblins |
| Front beat 1 | Cross the river from Paterson, as a gamble | none | The 14 march back; standing Behind |
| Front beat 2 | Moss probes at night | 4+1=5, +2 Sharp-eyed, -1 hidden Night owl = 6 | No move; discovered Greedy and Night owl |
| Front beat 3 | Food cart as bait, using Greedy | 2+4=6, +2 Greedy, +1 hidden Clumsy = 9 | Lever works: Behind to Ahead |
| Front beat 4 | Decision, all in: 17 with Flint against 9, unfortified | nine rounds | Totowa taken, 9 of 17 left |
| Closeup | Greedy (run with the Food) against Vain (never be seen running) | 3+4=7 | V holds and is captured |

**Tally:** won Haledon and Totowa; lost 10 of 20 goblins and a cart of Food; learned Greedy, Vain, Night owl and Clumsy; captured Captain V; left Haledon empty and 1 goblin in Paterson.

## Verdict, in the user's words

"That felt great. I lost more goblins than I expected, but I'm okay with it, considering I feel rewarded for both taking a risk and being patient with the scouting. I would play a game like this."

## What the test found

1. **First real evidence that it can be fun** (H1). One player, on paper, but a clear yes, against a clear checked-out no in test 01.
2. **The stalemate is gone** (H44). The front reached a decision in four beats, and the closing tally named what was won, lost and learned.
3. **Patience and risk were both rewarded** (H41). Scouting found the lever; the gamble on the river and the all-in decision were the user's own risks.
4. **Losses ran high but felt fair.** Ten of twenty goblins over two fights. Worth watching in tuning (H48), not changing yet.
5. **The board was readable.** The user sensed the empty Haledon before being told. The game must still show exposed townships plainly; the test engine failed to flag it at the time.
6. **Real geography made the choice real.** The land border from Haledon against the river from Paterson was a genuine decision taken from the map. This test also found that test 01's in-test geography correction was itself wrong (H42).
7. **A design error:** front beat 1's third option was strictly worse than the second (same march, worse start), against D156. The user picked it deliberately as a gamble, but a real game should not offer a choice that is never right.
8. **A new rule is needed** for captured captains (H51).
9. **The test-only front rules worked** and are proposed for adoption (D200).

## Holes fed

H1, H41, H42, H44, H48 (evidence); H51 (new).
