# Goblin mode: design documents

A strategy layer for the NJ Townfinder: clans of small creatures fight over real New Jersey towns, and the map you have been learning is the board. Nothing here is built yet. These documents exist so that the design survives between sessions and so the build can be held to it.

The strategy layer is optional. Turned off, the app is exactly the quiz, Drive and Progress app it is today.

## Documents

| # | Document | Status |
|---|---|---|
| 00 | [Influences and sources](00-influences.md): everything the design draws on, what we take and leave, and which sources have actually been read | written, awaiting additions |
| 01 | [Pillars and decisions log](01-decisions.md): what we are building, what we refuse, and every decision, with who made it | written, awaiting corrections |
| 02 | [Perimeter walk and hole register](02-perimeter-and-holes.md): the method for finding gaps before building, the 14 domains, and the open holes | written; domains not yet walked |
| 03 | Systems spec: character data model, tiers, injuries and fears, confidence and insults, orders and time, fog, combat | to write |
| 04 | Director spec: pressure estimate, drama budget, relief valve | to write |
| 05 | Content bible: clans, dwarf towns, every real fact with its source and a verified flag | to write |
| 06 | Screen map and flows | to write |
| 07 | Art spec and asset list | to write |
| 08 | Writing guide and line inventory | to write |
| 09 | Tech and performance budget (simulation as a pure function, save format, sync) | to write |
| 10 | Tuning plan (headless simulator) | to write |

## Rules for these documents

- **Status words are strict.** `DECIDED` means the user said so. `PROPOSED` means Claude suggested it and it has not been accepted. `REJECTED` means the user said no. `OPEN` means nobody has settled it. Do not promote a proposal to a decision without the user saying so.
- **Every real-world claim carries a source and a flag** (`verified` / `unverified`). Until it is verified it does not ship. Claims written from memory are `unverified`.
- **Private information stays out.** No names of the user's friends or players, no locations, no account details. Use "Player 1..4".
- **Changing a decision means editing its entry** and adding the date, not deleting history.
- **An unresolved hole blocks the build stage that depends on it** (see 02).
