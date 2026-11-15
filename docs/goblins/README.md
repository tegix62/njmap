# Goblin mode: design documents

A strategy layer for the NJ Townfinder: clans of small creatures fight over real New Jersey towns, and the map you have been learning is the board. Nothing here is built yet. These documents exist so that the design survives between sessions and so the build can be held to it.

The strategy layer is optional. Turned off, the app is exactly the quiz, Drive and Progress app it is today.

## Documents

| # | Document | Status |
|---|---|---|
| 00 | [Influences and sources](00-influences.md): everything the design draws on, what we take and leave, and which sources have actually been read | written, awaiting additions |
| 01 | [Pillars and decisions log](01-decisions.md): what we are building, what we refuse, and every decision, with who made it | written, awaiting corrections |
| 02 | [Perimeter walk and hole register](02-perimeter-and-holes.md): the method for finding gaps before building, the 14 domains, and the open holes | written; domains 1, 3, 4 and 5 walked in part |
| 02a | [Paper test 01](paper-tests/test-01.md): the core loop and resolution, played in text, with the hidden state revealed and the findings | run 2026-11-14 |
| 02d | [Simulation 02](sims/snowball-01.md): does a force cap stop one clan taking everything? (no), with five variants over 20 seeds | run 2026-11-15 |
| 02e | [Simulation 03](sims/bots-01.md): Careful, Bold and Passive bot lords over 21 days; findings on yield-heavy fronts and a hoarding AI | run 2026-11-15 |
| 02f | [The three Ledgers](ledgers/): what S8 asks the user to read | ready |
| 02c | [Paper test 02](paper-tests/test-02.md): the redesign played on real map data; the user's verdict was "That felt great" | run 2026-11-14 |
| 02b | [Simulation 01](sims/skirmish-01.md): a first skirmish dice rule, simulated (script: `tools/sim_skirmish.py`) | run 2026-11-14 |
| 03 | [The game as it stands](03-design-summary.md): a one-page plain-language summary, to read as a check that this is the game the user wants | draft for correction |
| 04 | [Systems spec, version 0](04-systems-spec.md): the rules as a builder needs them, with the data model, constants, and where it fills or departs from the log | written 2026-11-15; five new working rules await the user (D202 to D206) |
| M0 | [M0 build plan](M0-build-plan.md): the headless simulation in eight small steps, each with a check, ending in three Ledgers for the user to read | written 2026-11-15; S1 to S7 built; S8 (the user reads three Ledgers) next |
| M1 | [M1 build plan](M1-build-plan.md): goblin mode on the app's own map, with a home page and a short digest | first pass built 2026-11-15; needs a phone play session |
| 12 | [Gap list](12-gap-list.md): the game as built against the design, with what is missing, what each piece needs from the user, and the order to finish | written 2026-11-15 |
| 13 | [The plan to finish the game](13-finish-plan.md): what finished means, ten stages with checks and gates, the decisions each needs, what only the user can write and when, tuning targets | written 2026-11-15; the build follows this |
| 06 | [Content bible](06-content-bible.md) (started): the ten region kits, how each rule was computed, and the fact pipeline (no fact shipped yet) | started 2026-11-15 |
| 05 | Director spec: pressure estimate, drama budget, relief valve | to write |
| 07 | Screen map and flows | to write |
| 08 | Art spec and asset list | to write |
| 09 | Writing guide and line inventory | to write |
| 10 | Tech and performance budget (simulation as a pure function, save format, sync) | to write |
| 11 | Tuning plan (headless simulator) | to write |

## Rules for these documents

- **Status words are strict.** `DECIDED` means the user said so. `PROPOSED` means Claude suggested it and it has not been accepted. `REJECTED` means the user said no. `OPEN` means nobody has settled it. Do not promote a proposal to a decision without the user saying so.
- **Every real-world claim carries a source and a flag** (`verified` / `unverified`). Until it is verified it does not ship. Claims written from memory are `unverified`.
- **Private information stays out.** No names of the user's friends or players, no locations, no account details. Use "Player 1..4".
- **Changing a decision means editing its entry** and adding the date, not deleting history.
- **An unresolved hole blocks the build stage that depends on it** (see 02).
