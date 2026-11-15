# 16. Convoys, the messenger and framed losses (as built, F4)

Built 2026-11-15 from stage F4 of the finish plan, in `js/goblin/sim/convoys.js` (constants `K10`), `js/goblin/ui/messenger.js` and the goblin screen. Everything is a proposal until the user has played it (D220); the messenger's lines are placeholders for the user to write (D68, about 20 are needed, D193).

## Convoys (D111, D114, D185)

- **What travels.** Each noon a clan's Build and Coin made by townships two or more border steps from its home set out as **one convoy** from the farthest of them to the home; nearer townships' goods arrive at once. Food is not carried.
- **A convoy is data**: `{ from, to, route, legs, departTick, arriveTick, cargo, escort }`. Where it is comes from the tick, so nothing moves per frame (ten convoys cost under a millisecond a tick, tested). The route is the shortest chain of bordering townships; a leg takes one tick per three miles (D169) and half that along a highway lane.
- **On the map** a convoy is a dot in its clan's colour, between two township centres. You always see yours; you see a rival's only while it passes through a township you know a little (Familiar or better).
- **It can be taken.** A convoy that loses its home is lost with it.

## What the player does (D113: guard or cut)

- **Guard** (1 action): at one of your townships on a convoy's route, adding 3 to its escort for a day.
- **Raid** (1 action): from a township of yours with at least 3 units beside a rival convoy; up to 4 units against its escort of 2 (+3 if guarded). A win takes the cargo.

## The framed, unwarned loss (D115, D116, D118 to D122, D170)

An **ambush** is the only unwarned loss. It is bounded like this:

| Rule | Value |
|---|---|
| Never in a player's first days | 72 ticks |
| At most one | every 48 ticks |
| What it can take | one convoy's cargo and nothing else; the stockpile is untouched; never a named character or the home |
| Never while | the Director's word is Heated or Overwhelmed, the player is absent, or **Gentle mode** is on |
| A clue first | a cryptic Ledger line two ticks before ("Scouts of the Rats were seen near X"), naming the township the blow will come from and never the convoy (D119b); never required to avoid it (D122) |
| An answer after | for two days the first attack on the ambushers' township costs no action (a reprisal), offered at the top of the Do panel |

The clue is two ticks, not six: a convoy's journey is a few ticks and the noon tick is when it leaves. Over six quiet 60-day wars there were 17 ambushes (about one every 21 days a player), each with its clue before it and each within the caps (tested).

## The messenger (D120, D121)

A small, scared goblin on the Do panel and the digest. Its face (four expressions drawn in code: cheerful, steady, nervous, frantic) mirrors the Director's word, and it goes **nervous** when a loss could come within the day ("a lean week"); its line comes from the content file (`messenger`, two per mood, placeholders). The mood dial (D123) stays rejected.

## Not built

Goods by river or rail (after 1.0); Food convoys; convoy raids by the AI except as an ambush; gifts of goods between allies (shared mode).

## Measured

The tuning targets did not improve (4 of 9 pass; Careful 30 to 50 percent over runs, noise between rule changes of about 15 points). Careful's wins fell while F3 added captives that eat Food; the bots now ransom or release them, which restored part of it.
