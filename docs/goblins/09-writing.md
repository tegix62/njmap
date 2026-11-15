# 09. Writing guide and line inventory (as of F7)

The user writes the comedy (D68); the tools write structure and placeholders flagged as such (D194). `node tools/goblin/check_placeholders.mjs` lists what is still a stand-in; `--strict` exits 1 if any remain and is meant to block a release, not a stage.

## What is still a placeholder (127 entries, 2026-11-15)

| Section | Count | What it is | Who writes it |
|---|---|---|---|
| traits | 24 | 12 notable and 12 minor trait words with their machine hooks (which maneuver they suit and counter, what they drive) | the user writes the words; the hooks may stay |
| names | 4 | clan name pools: goblin, rat, toad, default | the user (about 40 beginnings and 40 endings each, D193) |
| fears, injuries | 3 + 5 | the words for river, ridge, highway fears and the five injuries | the user |
| states, verdicts | 2 + 4 | shaken and grieving (Humiliated is already the user's); Won, Lost, Withdrew, Yielded | the user (about 8 and 4, D193) |
| force words | 3 | a handful, a band, a host | the user |
| messenger lines | 8 | two for each of four moods | the user (about 20, D193) |
| templates | 74 | every sentence the Ledger can print: marches, fronts, scouts, footholds, convoys, dwarves, seasons, the war's end | the user, over time; the game reads fine with mine |

Region names, hazards and trade flavours (`data/goblin-regions.json`) are working words too, and so are the clan rules' sentences (`kinds.js`) and the season rule sentences (`seasons.js`).

## Voice rules the placeholders follow, so the user can keep or change them

- Real places and geology; invented characters. The Lenape are never a faction or a joke.
- Reasons are a few words, never numbers; odds are never shown (D99, H45).
- A loss is framed: a clue before, an answer after (D118).
- Every statement about a place comes from the map data: distance, direction, river, highway. Never from memory (H42).
- A line that names a real-world fact needs a source and a verified flag (D195). None exists yet in the game.

## What could be cut

The 74 templates are the bulk. A first pass could rewrite only the ones a player sees daily (marches, taken and thrown back, front beats, raid warnings, the digest headline): about 15.
