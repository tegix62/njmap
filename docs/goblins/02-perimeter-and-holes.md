# 02. Perimeter walk and hole register

Logged 2026-11-14 at the user's request. Why this document exists: a design produced in conversation reads as coherent because every gap is filled with something plausible. The gaps show up only under play, at scale, or over weeks, none of which a conversation can observe. This document is the process for forcing them into view before anything is built. The user's own words: the work is easy to take 70 to 80 percent of the way and then the large holes appear, and a game that holds attention over a long period is a very large undertaking. We prepare for that now, in concept, and put things in later.

Status words follow the README. The method below is PROPOSED until the user corrects it.

## The method

For each domain, write the same five things:

1. **What it is for.** One sentence.
2. **What we have decided.** Links to entries in 01.
3. **What we do not know.** These are the holes.
4. **The decision needed** to close each hole.
5. **The cheapest experiment** that answers it without building the feature.

Rules:

- Every hole goes in the register below. Nothing lives only in conversation.
- **An unresolved hole blocks the build stage that depends on it.**
- **Anything built before a stage gate is disposable.** No investment in polish until the gate passes.
- Holes are found by play as well as by thought. The user's reactions to early prototypes and their own phone use feed the register.
- A fresh reviewer with no context attacks each document before it is accepted (a "cold review"), because the author cannot see its own blind spots. PROPOSED; spawning reviewers needs the user's go-ahead each time.

## Domains

| # | Domain | Walked? |
|---|---|---|
| 1 | Core loop: what one beat of play is, and why it is fun the hundredth time | walked 2026-11-14; open items H18 to H23 |
| 2 | Long-term hook: the reason to open it in week three | next |
| 3 | Resolution: how a raid or battle is settled, and how odds are shown | next |
| 4 | Economy: what you spend and earn | no |
| 5 | Characters: names, traits, injuries, dynasties, tiers | no |
| 6 | Map and data: what each town must carry for the rules to work | no |
| 7 | Time and Director: catch-up, pacing, drama budget | no |
| 8 | Shared play: four people, one world, asynchronous | no |
| 9 | Content pipeline: who writes what, how much | no |
| 10 | Art and audio | no |
| 11 | Tech and performance | no |
| 12 | Learning integration: how Progress and quiz data connect to the game | no |
| 13 | Onboarding: the first two minutes | no |
| 14 | Operations: hosting cost, accounts, privacy, backups | no |

Order is by risk. Domains 1 to 3 first, because everything else depends on them.

## Domain walks

### 1. Core loop (walked 2026-11-14)

**For:** one beat of play, repeated three to five times in a session, still worth doing on the hundredth day.

**Decided:** a session is a two-minute door that opens in one tap (pillars 9 to 11). The reveal and the choice are what the user most wants (D76). Reveals are not every turn and discovery is frequent but not every turn (D77). There is a way to keep playing (D78). Goblin mode is a different mode from the basic game and probably has no quiz questions inside it (D79).

**Draft anatomy of a beat (PROPOSED).** Situation (one line, a real place), Choice (two or three options with their odds shown), Commit (one tap), Reveal (later, in the Ledger, with its story). A session is about one reveal, two commits and one surprise. The Director picks the verbs. The loop is order, wait, reveal, as in the Tecmo games.

**Not known:** see H18 to H23 in the register.

**Cheapest experiment:** a paper playthrough of a short beat sequence.

## Hole register

Severity: **A** blocks the whole project if wrong; **B** blocks a stage; **C** costs time or quality but is recoverable.

| ID | Sev | Hole | Domain | How we find out | Status |
|---|---|---|---|---|---|
| H1 | A | Nobody has tested whether the core decision is fun. Everything so far is plausible, not proven | 1 | Paper playthrough: ten turns in text, Claude as the Director, the user as the lord. Watch where the rules fail | OPEN |
| H2 | A | Week three: the game could feel great for three days and run dry. No answer yet to "what is new on day twenty" | 2 | Content math plus a simulated 21 days. Count distinct situations seen. Judge whether the Ledger still surprises | OPEN |
| H3 | A | Resolution rules are undesigned: how a raid is decided, what odds are shown, what the inputs are | 3 | Write the rules as a table; run 1,000 resolutions on paper-level code; check the odds feel fair and legible | OPEN |
| H4 | A | The economy is undesigned. Tecmo-style games run on resources, upkeep and loyalty, and none is defined | 4 | Name the resources and their sinks and sources; look for runaway or dead loops in a simple model | OPEN |
| H5 | B | Content scale against "truth in the texture": New Jersey has about 565 municipalities (check against the app's town list). Verified facts for all of them are beyond one person | 6, 9 | Decide a depth plan, for example about 60 north-east towns authored in depth and the rest generic but correct. Count the research hours | OPEN |
| H6 | B | The user's authoring load. The user writes the comedic content (D68) and the number of lines needed is uncounted. It may be far larger than expected | 9 | Count the lines a 30-day and a 90-day game need: names, insults, Ledger templates, barks, per-clan voice. Compare against what one person can write | OPEN |
| H7 | B | A quiet player in a four-person co-op: what happens to an inactive player's clan for two weeks | 8 | Decide the rule (the AI takes over, the clan goes dormant, others cover it) and test it in simulation | OPEN |
| H8 | B | Time-away against the two-minute door: a long catch-up report breaks the user's own rule (pillar 9) | 7, 13 | Decide a report budget (for example a headline plus three items) and a way to compress a long absence | OPEN |
| H9 | B | Tuning without players. A simulator tunes only if the model is right, and the model is unproven | 7, 11 | Build the simulator early and read its output as stories; add real playtests as soon as there is anything playable | OPEN |
| H10 | B | Claude's blind spots. Gaps in a design that Claude wrote are the ones Claude cannot see | all | A cold review per document by a fresh reviewer | OPEN |
| H11 | B | Fact verification throughput. Every real-world claim needs a source and a verified flag (README rules) and the verification may be the slowest part | 9 | Time a sample of ten facts end to end; set a rule that unverified facts never ship | OPEN |
| H12 | B | Backend: which hosting, what it costs, how four people log in, how data is backed up. All unknown | 14 | Compare two or three small-backend options on cost, setup effort and offline behaviour; keep solo mode fully offline | OPEN |
| H13 | B | Onboarding: the first two minutes of a new player (including the user's three friends) is unplanned | 13 | Write the first-session script; test it with a person who has not seen the project | OPEN |
| H14 | B | Learning integration is undefined in detail: how Progress and spaced-repetition data become fog of war, bonuses and rumours, and what a new player with no data sees | 12 | Map each data field to a game effect on paper; define the empty-data case | OPEN |
| H15 | C | Art pipeline: learning Blender takes time and the sprite plan assumes the output exists. Placeholders must carry the game until then | 10 | Decide placeholder style; time the user's first model; keep the art swappable | OPEN |
| H16 | C | Narrator voice quality varies by phone (device text-to-speech). The user's iPhone voice is plain and older-sounding | 10 | The voice picker already shipped (Settings, More voice); the user to try voices on their phone and a friend's | OPEN |
| H17 | C | Performance claims are untested for this game: a sprite atlas and a realtime map with faction fills have not been measured | 11 | A throwaway page with 100 sprites and fill changes, measured with the existing performance test | OPEN |
| H18 | A | Relationship to the quiz mode. If goblin mode is separate (D79), where does "your knowledge" come from? Fog of war (D15), knowledge bonuses (D53), orders that cost knowledge (D54) and a shared Today shell (D74) all assumed a link. Options: no link at all; read-only link (Progress data sets fog and nothing else); or a full link | 6, 12 | The user decides between the three. Then rewrite the four affected entries | OPEN |
| H19 | A | Keeping playing past two minutes. Orders take real time (D9), so a player who sits down for twenty minutes may have nothing to do. A "two clocks" idea: real time while away, and an Advance button that fast-forwards in a sitting, as a Tecmo turn does. Not yet accepted | 1, 7 | The user confirms or rejects two clocks. Then paper-test whether twenty minutes of Advance stays fun | OPEN |
| H20 | B | Reveal and discovery cadence. Reveals are not every turn and discoveries are often but not every turn. What are the rates, and who sets them (the Director)? | 1, 7 | Set starting rates; read simulated sessions and count how many have no reveal in a row | OPEN |
| H21 | B | The empty queue. When nothing is pending, what is there to do? The Director would have to guarantee at least one decision per open | 1, 7 | Count content cost of the guarantee; paper-test a quiet day | OPEN |
| H22 | B | The length of the wait between an order and its reveal. Too short and there is no anticipation; too long and the game feels dead between visits | 1, 7 | Try three wait lengths in the paper playthrough and note which feels right | OPEN |
| H23 | B | Verb count. Raids, scouting, insults, rumours, bonds, covert actions and support groups are all on the list. The user's rule is a small surface and the Tecmo games lost people to menus | 1 | List every verb; pick the few that appear in the first week; hide the rest until found (pillar 10) | OPEN |

## Experiments, cheapest first

1. **Content math.** Count lines and facts for 30 and 90 days. Pure arithmetic. Feeds H2, H5, H6.
2. **Paper playthrough.** Ten turns in text. Feeds H1, H3, H4.
3. **Cold review.** A fresh reviewer reads each spec and lists what is missing. Feeds H10 and everything else.
4. **Simulator output read as stories.** After the model exists, generate twenty daily Ledgers and judge whether any are worth retelling. Feeds H2, H9.
5. **Throwaway performance page.** Feeds H17.
6. **Voice test on real phones.** Feeds H16.

## What this document cannot do

It cannot say whether the game is fun. Only play shows that. Treat every "is it fun" entry as OPEN until someone has played something, even something crude.
