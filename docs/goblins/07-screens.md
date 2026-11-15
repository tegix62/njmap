# 07. Screens and flows (as built)

Written 2026-11-15 from what is in `js/goblin/ui/goblin.js` after finish plan F7. It describes the game as it is, not as it was planned; the user's words are placeholders throughout.

## Entering

**Home page** (on every opening, remembered for the session): Normal mode or Goblin mode. Goblin mode needs the New Jersey map; Settings has "Back to the home page", and goblin mode's bottom bar has Home.

**A new war**: tap your home township on the map, confirm, and the war begins at the current real hour. The first screen is **Your first move**, one near-certain attack with one tap (four taps from the home page to a first result). A won war offers **On to the next region**; a lost one **Try this region again**; both keep your clan.

## The board

The app's own map. Each township in the war is washed in its clan's colour (goblins green, rats brown, toads blue, gnomes violet, dwarves ochre) with its name and force on it; a ★ marks a captain. Fog greys what you do not know. Convoys are dots; a raid on its way glows red on its target.

**Top of the screen**: townships and units, chapter, region and season, the clock and actions left, Food, Build and Coin (with a red line when Food runs short), the war's goal in counts ("hold 26 of 51 townships for 3 days"), and when the world next moves.

**Bottom bar**: Home, **Do**, Digest, Ledger, New war.

## Cards (tap a township)

| Township | What it shows | Buttons (at most three on a fresh card) |
|---|---|---|
| yours | force, dug in or not | Send units from here; Dig in now (2 Build) |
| a rival's, known | owner, force, captain with portrait and what you know | Scout the captain; Talk to the captain (once you know something); Try for a foothold (no captain) |
| a rival's, less known | owner and force in words, or only rumour, or nothing | fewer: you cannot weigh what you have not learned |
| a rock town | "the dwarves hold the rock; nobody can take it" | Seek the dwarves |
| with a convoy passing | the cargo | Raid it |

Tapping your township then a neighbour opens the **order card**: what you send (a slider), what it costs in Food, the place described from map data, rules in words (river, highway, dug in), never odds. A captain's township opens a **front**; a rock town never opens an attack.

## Panels

- **Do**: the messenger (face and a line), what the clock and actions mean, the region's rule and the season's, then options ranked by what matters: an answer to an ambush, open fronts, scouting, the best targets named with how they look in words, spending (hire a band, guard a route), prisoners (ransom or let go), Gentle mode, quiz charges on or off.
- **Front**: standing in words (Behind, Even, Ahead, Commanding), the captain's portrait and what you know, an optional quiz charge, then Probe, Pressure, Use a weakness, Certain move, Decide, Pull back; a closing tally.
- **Digest**: the messenger, a headline, who of yours came back hurt, raids still coming, at most five lines, a count of what the Ledger holds.
- **Ledger**: the full list, copyable.
- **Results** show the dice (glyph dice that tumble once) and the reasons as a few words ("helped by your captain's skill; hurt by something you had not seen"), never plus-and-minus arithmetic.

## The rules of the screen

No percentages, ever (D99). Every cost is on its button. Anything not needed on day one is hidden until it can matter (pillar 10). No confirmation dialogs. Nothing runs per frame: the map changes when the state changes; the only timer checks the clock every 30 seconds.
