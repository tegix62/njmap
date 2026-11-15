# 12. Gap list: the game as built against the design

Written 2026-11-15, at the user's request ("make sure the game is finished per the design"). Sources: `03-design-summary.md`, the decisions log (01), the spec (04) and the build order (D199). Status words: **Built** (in the app or the simulation, tested), **Partial**, **Missing**. Each stage ends at a gate where the user plays and decides before the next stage (D153, D199).

## What exists today

Territory and skirmish on real township borders with river, ridge and highway rules; captains with traits, hidden information, injury, death, succession and promotion; fronts (ladder, maneuvers, decision, closeup, tally); a Director that paces raids; a real-time hourly clock with 09:00, 12:00 and 18:00 major ticks and catch-up; AI clans that recruit, dig in, raid and fight each other; a home page; a digest and Ledger; sitting actions (D214: actions, Scout, Fortify, Taunt); a solo save on the phone. 95 tests, bots and a headless runner.

## The list

| # | Design feature (source) | Status | What is missing | Needs from the user |
|---|---|---|---|---|
| 1 | **A goal for a war** (D215, proposed) | Built, to confirm | Hold more than half for three days wins; a rival doing it loses; five milestones; the screen shows the count and the days left. Bots win in 8 to 15 days, so the AI does not push back enough yet | Confirm or choose another option (below) |
| 2 | **Fog of war from quiz knowledge** (D15, D81, D176 to D182, D186) | Missing | `fogLevel` from your Progress data, the four levels on the map, "known" is box 1 or better, play also raises knowledge (D90). This is the part that teaches NJ geography, the reason for the game | Confirm the four level names and look |
| 3 | **Quiz charge** (D53, D54, D179) | Missing | An optional answer that adds +1 to a maneuver roll, one per beat, never required | Confirm after fog exists |
| 4 | **Economy: Food, Build, Coin; upkeep** (D110 to D117, D218) | Built, to play | Food, Build, Coin, upkeep, hired bands, goblin bridges, dig-in costs; force is bounded (H52 closed). Bold still wins every chapter; repairs, gifts and ransom are not in | Play it; say what Build should make beyond digging in and bridges |
| 5 | **Convoys and trade routes** (D115, D185, D220) | Built, to play | A convoy as data on a real highway lane, visible, raidable, the one place a small unwarned loss may happen | None until 4 exists |
| 6 | **Encounters, the rest of D92** (D92 to D98, D219) | Built, to play (foothold run, parley, duel, insult; the other pieces below) | Scout, Taunt and Fortify exist. Missing: a foothold run (take territory by doing something well, D93, D95, D96), parley, duel, the insult verb (D41 to D46) | Which of these you want first |
| 7 | **The messenger and framed losses** (D115, D120, D121, D165, D220) | Built with placeholder lines | The scared little messenger whose mood mirrors the Director's word; the one small unwarned loss, framed. The digest stands in for now | Yours: the messenger's voice (D68) |
| 8 | **Clan variety** (summary: goblins, rats, gnomes, toads, a self-made clan; D221) | Built for four kinds (no self-made clan; you are always goblins) | Three clans with the same rules. Gnomes and the self-made clan do not exist; clans differ only by name | What makes each clan play differently |
| 9 | **Legends, tier 3** (D36, D125) | Partial | The record and trait counts exist; nothing creates a legend or gives them a role | Rules for when a captain becomes a legend |
| 10 | **Confidence, state words, bonds, titles, grudges** (D41 to D46, D124) | Partial | Fields exist and grudges pass to heirs; confidence never changes, there are no insults, bonds or titles, and "Humiliated" is never applied | Your state words and insult lines (D68) |
| 11 | **Captives: ransom and rescue** (H51, D201) | Partial | Captives are held and listed; nothing frees, ransoms or exchanges them | A rule |
| 12 | **Dwarves, the rogue, weather and seasons** (D163, summary, H50, D221, D222) | Dwarves and seasons built; no rogue; no mining-history facts | Dwarves need the verified list of rock towns (not yet built); the rogue and seasons are unspecified | A verified rock-town list (I can build it from geology data you approve) |
| 13 | **Drama budget beyond raids** (D164, D165, D167, D222) | Partial: one shared peak a day across raids, ambushes and the dwarves' hand; the reveal and discovery cadence is not metered | Raids are paced. Peaks like a siege or a dwarf arrival, the reveal and discovery cadence, and "one unwarned loss every two days" are not | After 5 and 12 |
| 14 | **Region kits and the content bible** (D199, doc 06, D221) | Partial: ten kits with rules; no verified facts yet | Authored places: which towns have what history, beaver-dam-style small inventions, real facts with sources | You and I together; every real claim sourced (H42) |
| 15 | **Names, traits, jokes, art** (D68, D223) | Placeholder: 127 entries listed in 09-writing.md; art is code-drawn placeholders (08-art.md) | All words are mine, flagged `placeholder`; `check_placeholders.mjs` lists about 60. No art | **Yours.** The game is not finished until they are written |
| 16 | **Shared mode** (D190, M5) | Missing | A server that runs the clock, orders from friends, drop-in clans, allies covering an absent player. Needs a backend choice (H12) | A hosting decision, last |
| 17 | **Travel and the Advance button** (D9, D80, D169) | Superseded | Replaced by actions (D214); travel time only applies to AI raids today | None |
| 18 | **Offline play and sync** (D84, doc 10) | Partial | The war is saved on the phone and catches up on opening; nothing syncs between devices | After 16 |
| 19 | **Tuning** (doc 11) | Partial | The runner exists. Known problems: the AI hoards, bots take most of the theatre in three weeks (docs/goblins/sims/bots-01.md) | Fixed by 4 and 1 |

## The goal for a war (row 1): options

1. **Take the rivals' homes.** A war is won when both rival clans have lost their home townships. Simple, clear, and a war ends in days to weeks. Weak point: a runaway player ends it in a week.
2. **Hold a share for some days.** Hold more than half the theatre for three days in a row. Gives the AI time to push back and a reason to defend what you take.
3. **Open war with milestones.** No end; named milestones ("hold a county", "take a rival's capital", "capture a legend") and a quiet history of past wars. Fits "a week away, a week back" play.

My pick is **2 plus milestones**: a clear win a person can see coming, and small goals along the way for the days in between.

## Order I would build the rest in

1. Goal for a war (1), with the AI pushing back to make it worth something.
2. Fog and the quiz link (2, 3): the heart of the app's purpose.
3. Economy and upkeep (4), then convoys (5): gives sitting play more verbs and fixes the hoarding.
4. The other encounters (6), the messenger (7), clan variety and legends (8, 9), the confidence and insult system (10).
5. Dwarves and weather (12) once their data is verified, then the drama budget (13).
6. Region kits (14) and the user's words (15) throughout, not at the end.
7. Shared mode last (16, 18): it needs a server.

Each stage ends at a gate where the user plays and says what is wrong. A finished game is the end of that list, not one session's work.
