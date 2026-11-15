# 05. The Director and the dwarves (as built)

Written 2026-11-15 after finish plan stage F6, from what is in the code: `js/goblin/sim/director.js`, `dwarves.js`, `convoys.js` and the world's turn. Everything here is a proposal until the user has played it (D222).

## What the Director does (D163 to D168)

- **Pressure** for each present human player, as a number nobody sees: 2 for each open front, 3 for each raid against them, a fifth of the units lost in the last day, 4 for each township lost in three days, less up to 3 for quiet. Words: under 3 **Calm**, under 7 **Steady**, under 12 **Heated**, else **Overwhelmed**. Only the word is shown.
- **Rhythm**: a raid may start at 09:00 (a minor event) or 12:00 (the peak); nothing hostile at 18:00. **Heated or Overwhelmed** cancels hostile actions against the player that tick. Two Calm days in a row earn one extra raid.
- **The empty day (D166)**: a present player with no front, no raid and no good chance gets one: a weak garrison's extras are moved off their border. One decision is always on offer (Scout, Fortify and the rest add more since D214).
- **The shared budget (D164, D165)**: the day's **one peak** is shared by every hostile thing that is a peak: a raid at 12:00, an ambush on a convoy, and the steering of a rival at the dwarves. Once any of them has taken the day's peak, none of the others may. Two minor events a day stay for 09:00 raids. Not yet metered: the "reveal on half of opens" and "discovery on most" cadence (D167).

## The dwarves (D29, D158 to D162, H50)

**Where they are.** The townships the app's own curated list of named mountains and ridges (`data/nj-places.json`, kind "mountain") puts a mountain in: 11 places, about 30 townships, 6 to 8 in a typical theatre. That is a fact about the map and nothing more. A **mining history is not claimed**: it needs verified fact rows (D195), which do not exist yet. Rock towns held by a player or a clan's home stay with them; the others become the dwarves', held dug in with 12, with no economy and no recruits.

**The rules (the user's, D158 to D161):**

- **Cannot be conquered.** Nobody can take a rock town. A player's attack, front or foothold on one is refused with a reason; the order list offers **Seek** instead. (P21, proposed.)
- **Never strike first.** The dwarves act only when goaded, and never against an ally of theirs.
- **Goaded (D160).** A rival clan that would attack a rock town is stopped by its garrison: no battle, but it has provoked the dwarves, who for two days answer that clan, striking its bordering townships at even odds or better and keeping 4 at home. A rival never goads while already provoking.
- **Sought (D161).** A player can make their way to the dwarves: one action, 2d6, 8 or more and they are **friends for the chapter**: each tick their miners bring 2 units to your weakest township bordering the rock. A failure waits a day.
- **The war does not count them.** Their townships are not part of the map you win.

**The hidden hand, in timing only (D158, D159, D162).** While a player is Heated or Overwhelmed, once every three days and using the day's one peak, the Director picks the rival with the most units that has a township beside a rock town. A tick before, the Ledger reads "Hammering is heard from the rock at X" (the tell: no clan, no cause); at the next tick that rival provokes the dwarves. The Director **never makes dwarves appear** where the rules say there are none, and never changes where anything is, only when.

**H49 (is a hidden hand fair?)** Proposed answer: the deck is not stacked, the dealer is known. The Do panel says in plain words that the dwarves cannot be conquered, never strike first and answer anyone who pushes at the rock, "a rule of this world, not a favour to anyone". The timing is hidden, the rule is not.

## What this did to the balance

Rock towns sit thick around Paterson (7 in its theatre), so a war there starts with a buffer and the rivals bleed against the dwarves; the Newark theatre has 8 and a hard war. The targets script now rotates four homes (Paterson, Newark, Edison, Hackensack) because a single home is not representative. Results are in `11-tuning-plan.md`.

## Not built

The reveal and discovery cadence (D167); dwarf arrivals as "events" beyond goading and miners (siege, a dwarf champion); what a rock town looks like after the dwarves are gone (they cannot be driven out, so it never arises); a mining-history fact for each rock town.
