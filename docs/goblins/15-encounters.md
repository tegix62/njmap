# 15. The rest of the sitting (as built, F3)

Built 2026-11-15 from stage F3 of the finish plan, in `js/goblin/sim/encounters.js` (constants `K9`). Each costs one action unless it says otherwise. Everything here is a proposal until the user has played it (D219); every sentence a player reads is placeholder wording (D68).

| Verb | What it does | Notes |
|---|---|---|
| **Foothold run** (D93, D95, D96) | A probe at a rival township with **no captain** next to one of yours. 2d6 plus the method: *Swarm* (+1 for each whole 1x your border force exceeds theirs, to +3), *By night* (+2 from 21:00 to 05:00), *Ford the river* (+3 across a river border, but a bad roll costs 2 units). 8 or more plants a foothold; 4 or less loses a unit. At the next major tick the foothold becomes a conquest if your best bordering garrison (less the one that stays) is at least as big as theirs; otherwise it fails | Brakes against grinding (H29): a run is 2 worse for each earlier run on the same township that day, and 3 worse for each earlier run by the clan that day |
| **Parley** (D92) | Needs something learned about the captain and 4 Coin. A day's truce: that township will not attack you. Attacking it breaks the truce | The only thing Coin buys besides a band and ransoms |
| **Insult** (D41 to D46) | Needs something learned. 8 or more (a known fact helps) lowers the captain's hidden *confidence* by 15 (20 for a proud one); a failure raises it by 10. At 40 or less the captain is **Humiliated** (the user's word) and a front against him starts a step better for you; it lifts above 55. Confidence creeps back 5 a day toward 70 | The number is never shown, the state word is |
| **Taunt** (D214) | Unchanged: needs something learned; 8 or more makes the next front there start a step higher | The first rung of the ladder |
| **Duel** | Your captain on a bordering township against theirs: 2d6 plus pressure traits plus confidence. The loser may be hurt or killed by the usual injury roll; the winner gains 10 confidence, the loser loses 15. No land changes hands | A draw hurts no one |
| **Captives** (H51, D201) | Keeping one costs 1 Food a tick and they slip away if you cannot feed them. **Ransom**: their clan pays 6 Coin, plus 3 for each generation, if it has the Coin and room for another captain. **Let go**: free, and the captain remembers: a front you open against him starts a step better for him | A freed captain who has nowhere to go (his clan is at its captain cap) is lost to the war, with no heir |
| **Confidence from fronts** (D124) | A won front: the defender loses 15, your lead gains 10. A lost front: the reverse | |
| **Legends** (D36, D125) | A captain who has led three won fronts becomes tier 3: a fifth, notable trait and the title *legend*. One a clan at a time | |

## Not built

- **The closeup on your own captains** (D107, D108): rare, at major events, shown afterwards as a changed portrait. It needs the art plan (F7).
- **Bonds and titles beyond "legend"** (D41 onward).
- **The user's insult lines** (D42): optional and not needed; the insult is an action with a roll and a line from the Ledger templates.

## Measured

A grind check (`tools/goblin/experiments/grind.mjs`, 12 seeds, 35 days): a lord who does nothing but foothold runs ends with 25.8 townships and wins 3 of 12 chapters, against Careful's 26.8 and 5 of 12. Without the brakes it ended with 33.4 and won 12 of 12, better than Careful: footholds were then a grind that beat thinking, against H29. The two brakes (3 worse per run by the clan, hold at 1 to 1) bring it just below the careful lord.

The tuning targets are unchanged by F3 apart from run-to-run noise (Careful 40 to 50 percent over 20 seeds).
