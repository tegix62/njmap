# M1: goblin mode on the map (solo, placeholders)

Started 2026-11-15 after the S8 read of M0 (D210 adopted) and the user's answers on screens (D211 to D213). Scope of D199's M1: the skirmish layer on the real map in the starting theatre, solo, placeholder wording. No fronts, captains or characters yet (M2): the sim runs without content attached, so no township has a captain.

## Built (first pass)

- **Home page** (`js/goblin/ui/home.js`, reusing the welcome card): Goblin mode or Normal mode, asked on each opening, remembered per session. Settings has a "Back to the home page" button and the goblin bar has Home.
- **Goblin mode** (`js/goblin/ui/goblin.js`, a normal app mode beside Drive, Map, Play, Progress): paints the war onto the app's own `munis` source with feature-state (clan wash, selected outline, attack and move targets, incoming raids) and a force-and-name label per township; the map's own township names step aside during a war.
- **Starting a war:** tap a home township, confirm; the theatre is the usual 3 steps (12 to 60 townships), the rats and toads take the rest. The world clock aligns to Eastern time at the hour the war begins.
- **Playing:** tap one of your townships, then a neighbour: attack (red) or move (blue). The order card states the place from map data (distance, direction, river or ridge, highway) and the rule in words, no odds. The result shows the dice for every round.
- **Real time:** the world advances one tick per real hour, including while the app is closed (caught up on opening, capped at 72 hours by the sim) and while it is open (checked every 30 seconds). Saved in local storage (`njtf.goblin.save`: world, last real time, last 600 events, last seen tick).
- **The digest** (`js/goblin/sim/digest.js`, D213): a headline, raids still coming, at most five lines ranked by what matters to you, and a count of what the Ledger holds. The full Ledger is a tap away and can be copied.
- Service worker precaches the new files (`njtf-v235`).

## Checked

- Unit tests for the digest (`tools/goblin/test/digest.test.mjs`); the sim's 89 tests all pass.
- A scripted headless-browser run (`tools/goblin/ui-smoke.cjs`): home page, start a war at Paterson, attack, result with dice, digest, back to Normal mode with the tab bar restored; no page errors.
- Not yet checked on a phone, in the installed (home-screen) app, or across an overnight gap.

## Known gaps and questions

- Wording is placeholder throughout and the order card text is mine.
- No fog of war (everything is visible), no quiz charge, no resources: all later stages.
- Recruits are placed automatically (D203), so there is no place-your-recruits step.
- The HUD heading is large in this theme; the force labels crowd at the state-wide zoom.
- Next in M1: a play session on a phone, then whatever it shows.

## Round 2, 2026-11-15 (after the user's first phone play)

The user's words: attrition on the map felt like Strategery, but "I can't even tell if a turn ends or something, or what to even do after I've tried to take these little counties. I don't see any characters, none of that."

Three gaps, three changes (`js/goblin/ui/goblin.js`):

1. **No sense of time.** The HUD now says when the world next acts and how long that is ("Next: 09:00 (in 9h 5m): recruits arrive and the other clans move"). There is still no end-turn button, by design (D82, the world clock); the **Do** panel says so in plain words.
2. **No sense of what next.** A new **Do** button lists open fronts and the best targets by name, with the force on both sides and a word for how it looks (a good chance, an even fight, risky). Tapping one opens the order card.
3. **No characters.** The sim's captains are now on the board: a ★ before the township name, a captain line on the township card (what you know about them; nothing until you learn it), and your own captain leading attacks from their township. Attacking a township with a captain opens a **front** (spec section 6): a panel with Probe, Pressure, Use a weakness, Certain move, Decide and Pull back, the standing in words (Behind, Even, Ahead, Commanding), and a tally when it ends. This pulls the front, captain and tally work (M2's core) forward into M1 because the first play showed the skirmish layer alone is not a game.

Also: the digest now counts events since you last looked, so your own moves at the same hour are not skipped; front beats carry the captain and township so their Ledger lines name them. Saves are version 2, so an existing war is replaced by a new one on first opening. Smoke test (`tools/goblin/ui-smoke.cjs`) now plays a skirmish and a whole front.

Still missing and noticed: no goal or ending to a war (what wins?), no fog of war, no quiz link, no resources. The first of these is a design question for the user.
