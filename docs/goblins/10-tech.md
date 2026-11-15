# 10. Tech and performance budget (measured)

Measured 2026-11-15 with `node tools/goblin/perf.mjs` (and a test that fails if the budget is broken).

| Budget (D197) | Measured | Verdict |
|---|---|---|
| An hourly tick for a 60-township theatre under 50 ms on a phone | median 0.2 ms, 95th percentile 1.6 ms, worst 9 ms in Node on a desktop (1,512 ticks over three homes). A phone is perhaps five times slower | met with a wide margin; not yet timed on a real phone |
| Under 300 KB added download before art | 141 KB gzipped (705 KB raw); the board is 51 KB gzipped, the screen code 17 KB, the whole simulation about 50 KB | met |
| No continuous render loop; the map changes only when the state changes | one 30-second timer checks the clock; dice are a half-second CSS animation that stops; the map is painted when an order, a tick or a panel changes the state | met by design, not measured on a device |
| The simulation is a plain module with no screens, no `Date`, no `Math.random` | `js/goblin/sim/` imports nothing from the app; randomness is a seeded generator in the state; the real start time is stored once so the calendar is integer arithmetic | held (the tests replay every run bit for bit) |
| Solo saves are one versioned file in the phone's storage | `njtf.goblin.save` (version 4): the world, the last real hour, the last 600 events | built; a new version replaces an old war |

## Layout

`js/goblin/sim/` the rules (board, rng, skirmish, world, chars, front, director, war, sitting, economy, encounters, convoys, dwarves, regions, seasons, kinds, chapters, ledger, digest); `js/goblin/ui/` the screen (goblin, home, fog, review, portrait, messenger); `data/goblin-*.json` the board, content and regions; `tools/goblin/` the bots, runner, targets, perf and browser checks; `tools/goblin/test/` 167 tests.

## Not done

A timing on a real phone; the shared mode's server (D190 to D192): the simulation is already a pure function of its state and orders, which is what that design needs, but no backend exists.
