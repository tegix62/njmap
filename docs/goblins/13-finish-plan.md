# 13. The plan to finish the game

Written 2026-11-15 from the decisions log (01), the hole register (02), the spec (04), the gap list (12) and what the first phone plays showed. This is the plan the build follows from here. It replaces the one-line stages M2 to M5 of D199 with stages small enough to build and check, keeps D199's rule that every stage ends with the user playing it, and says what "finished" means.

**How to use it.** Each stage has: what it is for, the steps (each with a check that can fail), the holes it must close, a short batch of decisions for the user (answer "all good" or change one), what the user must write and by when, and the gate. A builder session picks up one stage, reads its section and the documents it names, and stops at the gate.

## 1. Where the build stands, plainly

Built and tested (101 tests): the board from real borders; skirmish; captains, traits, hidden information, injury, death, succession, promotion; fronts; the Director's raid pacing; the real-time clock; AI clans; a home page; the digest and Ledger; sitting actions (Scout, Fortify, Taunt); a goal for a war with milestones.

Three things went out of order and need to be said:

1. **The economy was skipped.** Everything with a cost today costs an *action* or nothing. That is why the AI hoards and why the bots win every war in under two weeks (H52, H36).
2. **The purpose of the app is not in the game yet.** Fog of war from what you have learned (D15, D81, D173, D176 to D182) is the reason this lives inside a geography app, and none of it is built. Right now goblin mode teaches place names only by showing them.
3. **The war goal (D215) was built without reference to D175.** D175 decided that winning is a region at a time, in chapters, with no hard reset. D215 ("hold more than half for three days") is a fine *chapter ending* but it is not the win condition of the game. Section 4, stage F5, reconciles them: a theatre war is one chapter.

Two measured problems that every later stage inherits until fixed: fronts were ending in one or two beats (fixed, D210), and the rivals do not push back (open).

## 2. What "finished" means

Two finish lines, because the second needs a server and the first does not.

**Solo 1.0, the game is finished for one player, when all of these are true:**

- [ ] A new player reaches their first front inside two minutes with no wall of text (D198).
- [ ] The map shows what you have learned: four fog levels from your review data, and learning a town or a highway visibly changes the war (D173, D176, D177).
- [ ] A sitting has more than attacking in it, and nothing in it is the same choice every time (D92, D156, H41).
- [ ] Food, Build and Coin exist, armies cost Food, and no clan can grow without limit (D110, H52).
- [ ] Convoys move on real highways and can be raided; a framed, unwarned small loss can happen and is announced by the messenger (D111, D115, D118, D120).
- [ ] A war is a chapter of a region; winning it opens the next region, and a second war is different from the first (D171, D174, D175).
- [ ] The dwarves exist, follow rules a player can learn, and come only from verified rock towns (D158 to D161).
- [ ] A careful bot wins a chapter in two to four weeks about half to two thirds of the time; a player who does nothing for three weeks keeps most of their land (D84, section 5 targets).
- [ ] No placeholder ships: `check_placeholders.mjs --strict` passes, because the user has written the names, traits, state words and messenger lines (D68, D194).
- [ ] Every real-world statement in the game has a source and is marked verified (D195).
- [ ] The user has played three real weeks and still wants to open it (H1, H2).

**Shared 1.0** adds: up to four friends in one world by invite code, the clock run by a small server, allies covering an absent player, knowledge shared with credit (D87, D88, D181, D189 to D192).

**Deliberately after 1.0** (named so they stop pulling on the plan): the lone rogue; a self-made clan; a legacy carried between wars (D19); goods by river and rail (roads only at first); whether a goblin bridge persists; custom art beyond placeholders; the narrator reading the Ledger aloud.

## 3. The order, and why

| Stage | What | Why here |
|---|---|---|
| F0 | Steady the base: first two minutes, rivals that push back, tuning targets | Cheap, and every later play session is worthless if the war is a walkover |
| F1 | Fog and the quiz link | The purpose of the app. Mostly decided already (D176 to D182), mostly on the screen side, and it makes scouting matter |
| F2 | The economy: Food, Build, Coin | The cure for hoarding and for "nothing to spend"; gives the sitting real choices |
| F3 | The rest of the sitting: footholds, parley, duel, insults, captives, legends | Needs Coin and Food to price things |
| F4 | Convoys, the messenger, framed losses | Needs the economy; the first unwarned loss must be framed (D118) |
| F5 | Regions and chapters: kits, the next region, clan variety, replay, seasons | Week three (H2). Needs the content bible |
| F6 | Dwarves and the Director's full budget | Needs verified geology and the convoy and siege events to budget |
| F7 | Look, words and the performance budget | The user's writing and the art list, checked on real phones |
| F8 | The three-week play (the gate for Solo 1.0) | Only play answers H1 and H2 |
| F9 | Shared mode | Needs a server; solo must be good first |

The user's words and the verified facts are not a stage. They run alongside from F1 (section 6).

## 4. The stages

### F0. Steady the base

**For:** a war that is worth playing while everything else is built.

Steps:

1. **Tuning targets as a test.** Write `docs/goblins/11-tuning-plan.md` with the targets in section 5 and add `tools/goblin/targets.mjs`, which runs the bots and prints pass or fail per target. *Check:* it runs in under ten seconds and fails today on "careful win rate" and "war length".
2. **Rivals that push back, without the economy.** Three small rules, each a per-world rule so they can be measured apart: (a) AI recruits split, half to the best attack position and half to the weakest border (between D208 and the `aiRecruitSpread` experiment); (b) an AI clan that loses a township may counter-attack it next tick at 1.5 to 1 instead of 2 to 1; (c) the two rivals stop attacking each other while a human holds more than a third of the theatre. *Check:* `targets.mjs` passes "careful win rate 50 to 70 percent" and "passive keeps at least 80 percent for 21 days"; AI-versus-AI fights still happen (at least two per run).
3. **The first two minutes (D198).** A new war starts with one guided skirmish against the weakest neighbour, then the Do panel. *Check:* the smoke test reaches a first result card in at most five taps from the home page.
4. **Verb audit (H23).** List every verb on screen; anything not needed on day one is hidden until first met (pillar 10). *Check:* the first-day township card shows at most three buttons.

Holes: H13, H23, H41 (scouting must not always be right: check the bots), H52 (interim).

Decisions for the user:

- P1. The targets in section 5 are the right shape (numbers can move).
- P2. Rivals may make peace with each other while you are winning (2c). It is a rubber band; H49 asks whether that is fair. My pick: yes, but the Ledger says so ("the rats and toads have stopped fighting each other"), so it is a rule of the world, not a hidden hand.

Gate: the user plays three days. Question: does the war push back?

### F1. Fog and the quiz link

**For:** the map shows what you know, and knowing more wins wars (D173).

Read first: D176 to D182, D90, D177, D179, D180; spec section 13.

Steps:

1. **`fogLevel(townId, srs, played, roads)`**, a pure function in `js/goblin/ui/fog.js` (the simulation never reads quiz data): Known is box 1 or more; Familiar is asked but missed lately, or raised by play, or the starting floor; Rumoured is unasked but next to something Known or Familiar by a border or a known highway; else Unknown. *Check:* unit tests for each rule, and a count from the user's real Progress data matching D182's numbers (47 Known of 186 well-known towns on 2026-11-14).
2. **What each level shows.** Known: everything (force as a number, captain, dug in). Familiar: owner, and force in a word (a handful, a band, a host). Rumoured: owner only. Unknown: a blank township with no name. Your own townships are always Known to the game. *Check:* a screenshot test per level; no percentages anywhere.
3. **Play raises knowledge to Familiar at most (D178).** Fighting in, scouting or holding a township marks it played; this is saved with the war, never written into the review data. *Check:* a test that the `srs` store is byte-identical after a war.
4. **Knowing the place helps.** Attacking into a Known township needs no scout to see its force; into Unknown you attack blind (the card says so). *Check:* the order card's text changes with the level.
5. **The quiz charge (D179).** On a front maneuver, an optional question about the places involved; right adds +1 to the roll; it counts as a real review; at most one per beat and three per sitting; a wrong answer never blocks; a Settings switch turns it off. Reuse the app's own question code. *Check:* a charge writes one review to `srs`; with the switch off no question ever appears.
6. **The floor (D180):** home and its neighbours start Familiar; the theatre is at least 12 townships. *Check:* a fresh profile sees a readable map.

Holes: H14, H18, H24 (must not feel like homework: the gate asks exactly this), H27, H26's empty-data half.

Decisions for the user:

- P3. The four levels show what step 2 says.
- P4. Force words for Familiar: "a handful" (1 to 3), "a band" (4 to 8), "a host" (9 or more). The words are yours to replace (D68).
- P5. Attacking blind into an Unknown township is allowed (my pick), not forbidden. Forbidding it would make the quiz a gate, against D53.

The user writes: the three force words, and the names of the four levels if "Known, Familiar, Rumoured, Unknown" are not right.

Gate: the user plays a week with their real Progress data. Questions: did you go and learn a town because of the war? Did a charge feel like homework?

### F2. The economy

**For:** things cost something, armies cannot grow without limit, and a sitting has trade-offs (D110, H4, H36, H52).

First write `docs/goblins/14-economy.md` (rules and the toy model's results) and get P6 to P10 answered. Then:

1. **A toy model before any game code** (`tools/goblin/experiments/economy.mjs`): three clans, the proposed rules, 20 simulated weeks. *Check:* no stockpile runs to infinity or to zero for all clans; total force levels off.
2. **Food.** Each township yields Food each major tick (1, or 2 for a Food town). Each unit eats: 1 Food per 4 units per major tick. A clan short of Food gets no recruits, and after a full day short its largest stack loses one unit per tick ("they drift home"), announced a tick ahead. *Check:* a 1,000-day run where total force stays under a bound; the hoarding test (biggest stack) passes its target.
3. **Build.** Yielded by Build towns. Spent on Fortify (instead of an action), on a goblin bridge (D109: three major ticks, then that river border counts as having a crossing), and on repairing a township after it falls. *Check:* unit tests per sink; the bridge is drawn as a goblin structure and never changes the real map (D106).
4. **Coin.** Yielded by Coin towns. Spent on ransom (H51), on a hired band (units for one day), and as gifts between allies later (D117). *Check:* unit tests; nothing bought with Coin is always the best buy (D156, a bot comparison).
5. **A township's trade (D112).** Each township is a Food, Build or Coin town. Until region kits exist (F5) the type comes from data the app already has, by a stated rule (P8). The real trade name is flavour and ships only when verified (D195). *Check:* every township has a type; the split is roughly even inside any theatre.
6. **Recruits cost Food** instead of being free; AI clans use the same rules. Remove F0's interim AI rules that the economy makes unnecessary, one at a time, re-running the targets.
7. **Screen:** three numbers in the HUD, a cost on every button, a "why can't I" line when short.

Holes: H4, H36, H52, H34 (partly), H43's last part.

Decisions for the user:

- P6. The Food rule in step 2 (income per township, upkeep per four units, the warned drift home). A shortage never touches a named character without warning (D113).
- P7. Fortify moves from costing an action to costing Build. Scout and Taunt stay actions. Attacks cost an action *and* Food by distance (D113's "marches cost Food").
- P8. How a township gets its trade before the kits: by population rank inside the theatre (large towns Coin, middle Build, small Food). It is a placeholder rule, replaced by real trades in F5.
- P9. The goblin bridge takes three major ticks and stays for the rest of the war.
- P10. A hired band: Coin buys a few units for one day, once per day. My pick is to include it; it is the simplest thing for Coin to do before convoys exist.

Gate: the user plays a week. Questions: did you ever have to choose what to spend on? Was a shortage a story or an annoyance?

### F3. The rest of the sitting

**For:** D92's promise in full, priced by the economy.

1. **The foothold run (D93, D95, D96), reconciled with actions.** One action. A short encounter at a township with no captain: win it and a *foothold* is placed; the next major tick decides whether it holds (it holds if your bordering force is at least the garrison's). A second foothold run on the same township the same day has a lower chance (diminishing returns, D95). A clever choice (using something learned, or a risky method) or a quiz charge raises the chance (D96, D97). *Check:* a bot that only does footholds cannot out-conquer the Careful bot (H29: grinding must not beat thinking).
2. **Parley** with a captain you know something about: for Coin, a truce on that border for a day, or the release of a captive. *Check:* never the best choice in every state (D156).
3. **The duel:** your captain against theirs, when both are on the same border. Stakes are injury and confidence, not land. *Check:* the injury rules are the existing ones (spec 7).
4. **Insults and confidence (D41 to D46, D124):** an insult is a player action against a known captain; confidence (hidden) moves; at a low threshold the captain takes the state word "Humiliated" and fights a front one step worse. Taunt becomes the first rung of this ladder. *Check:* the number is never shown; the state word is.
5. **Captives (H51):** keep (costs Food), ransom (Coin to you), release (the captain remembers it: a bond or a grudge). *Check:* three short scenes, none always best.
6. **Legends (D36, D125):** a captain who wins three fronts, or survives a closeup by persisting twice, becomes tier 3: a fifth trait and a title. At most one per clan at a time.
7. **The closeup on your side (D107):** rare, only at major events, shown afterwards as a changed portrait and a line (D108).

Holes: H29, H30, H33, H40, H51, H23 again (verb count after adding four verbs).

Decisions for the user:

- P11. The foothold rule in step 1, including that it only works on townships with no captain.
- P12. Duels cannot kill outright; death stays where the spec puts it (after a second roll).
- P13. A legend needs three won fronts (my pick) and there is one per clan.
- P14. Which two of parley, duel and insults to build first if time is short. My pick: insults and the foothold run, because they are the ones that are fun in thirty seconds.

The user writes (needed before this gate): about 8 state words, the verdict words, optional insult lines (D42, D193).

Gate: a week of play. Questions: which verb did you never use? Which did you use every time?

### F4. Convoys, the messenger, framed losses

**For:** D111 to D122, and the user's caution "just be careful with that".

1. **Convoys as data (D114, D185):** a clan's surplus moves from a producing township to its home along highway lanes and borders; `{from, to, route, departTick}`; position computed from the tick; one dot per convoy on the map, moved only when the tick changes (D197). *Check:* no per-frame work; ten convoys cost under 1 ms a tick.
2. **Guard or cut:** the player's only decisions about convoys (D113): put units on a route township to guard, or raid an enemy convoy where it passes next to you (one action, a skirmish against its escort). *Check:* a raid shows the place from map data.
3. **The messenger (D120, D121):** one character with three expressions (placeholder art), whose mood mirrors the Director's word and who delivers the opening line of the digest. *Check:* mood changes only when the word changes.
4. **The framed, unwarned loss (D115, D118, D119, D170):** at most one every two days, never in the first three days, only a convoy or a small part of a stockpile, always explainable by an earlier Ledger line, always followed by a way to answer it (a reprisal raid offered in the Do panel). The "lean week" is said by the messenger ahead of time, in mood, not numbers. *Check:* a 60-day simulation where every unwarned loss has an earlier clue event and a following offer; the count per two days never exceeds one.

Holes: H35, H38, H39.

Decisions for the user:

- P15. The cap in step 4 is right, and the Gentle setting turns unwarned losses off entirely (D116).
- P16. Enemy convoys are always visible when they pass through a township you know (Known or Familiar); never in Unknown.

The user writes: about 20 messenger lines (D193). Needed before this gate. Placeholders until then.

Gate: two weeks. Question for the user, exactly as they framed it: did a loss ever feel like a bare taking?

### F5. Regions and chapters

**For:** week three (H2, D172), and the real win condition (D175).

First write `docs/goblins/06-content-bible.md`: the region kits and the fact table.

1. **Region kits (D171):** assign all 564 townships to about eight to ten regions by a computed rule (county groups first, then corrected by hand and checked against the map data). Each kit: a terrain rule, a hazard, a trade flavour, about five verified facts. *Check:* every township has exactly one region; every fact row has a source and a verified flag; unverified rows are left out of the build (D195).
2. **A chapter is a theatre war (reconciling D215 with D175).** Winning a chapter (D215's rule, plus a final challenge you choose when to take, D157) keeps your land and opens the bordering region as the next theatre, with new rivals. Losing a chapter costs the chapter, not the game: you keep your home and start the region again (no hard reset, D175). *Check:* a bot can play three chapters in a row; state carries over.
3. **Clan variety and replay (D23, D174):** a pool of clans, each with one rule that makes it play differently (P18), drawn at random onto matching habitat for each chapter. *Check:* two wars from the same home differ in rivals.
4. **Seasons and weather (D172's "new rules"):** one rule per season, taken from the real calendar. *Check:* each is a single modifier the Ledger can state in a sentence.
5. **Real trades replace F2's placeholder rule** where verified.
6. **Levers from places (D104, D105, H32):** 10 to 15 lever templates tied to real terrain (a river in flood, a ridge road), each a fictional event on true ground and never a false claim of fact (D106).

Holes: H2, H5, H11, H32, H34, H47's last part.

Decisions for the user:

- P17. Chapters as in step 2: win keeps your land and opens the next region; a loss repeats the region.
- P18. One rule per clan. Proposals, all placeholders for you to change: goblins dig in faster; rats recruit faster and feed worse; toads ignore river penalties; gnomes build for less. 
- P19. The list of regions, once drafted from the data, with you checking the names.
- P20. The final challenge of a chapter: take the strongest rival's home township by a front (skills already used, D157).

The user writes: region names if the working ones are wrong; lever names (10 to 15, D193). The user verifies or rejects each fact.

Gate: the user plays two chapters. Question: was the second region different in a way you could name?

### F6. Dwarves and the Director's full budget

First write `docs/goblins/05-director.md`. Needs the rock-town list: built from public geology and mining records, every town a row with a source, verified by the user or left out (H50, D195).

1. **Rock towns** flagged on the board (D186). 
2. **The two routes (D160, D161):** a rival that attacks a rock town provokes the dwarves, who fight for themselves (good for you); or you go to them (an encounter, short enough for the two-minute door). They never betray an ally (D29).
3. **The hidden hand in timing only (D158, D159, D162):** when the player is struggling the Director steers a rival's aggression toward a rock town; it never conjures dwarves where the rules say none are. A tell comes first (hammering heard).
4. **The full drama budget (D164, D165, D167):** one peak and two minor events a day, across raids, convoys, dwarf arrivals and sieges; a reveal on about half of opens; a discovery on most.

Holes: H49 (decide and write down whether the Director's bending is fair), H50, H20.

Decisions: P21, dwarves cannot be conquered and a player who attacks a rock town makes them hostile for the chapter. P22, the hidden hand stays hidden but its *rule* is in the game's help text (my pick, answering H49: the deck is not stacked, the dealer is known).

Gate: the user plays a chapter in a region with rock towns.

### F7. Look, words, and the budget

Write `07-screens.md`, `08-art.md`, `09-writing.md`, `10-tech.md` from what now exists (they describe the built game, so they are short).

1. **Placeholder art by code (D59, D196):** a grunt mark, captain parts, injury layers, three portrait expressions, the messenger, dice. Swappable for the user's own art later.
2. **Dice as theatre (D100)** and **reasons as a few words or icons, not arithmetic (H45).**
3. **The user's words go in.** `check_placeholders.mjs --strict` must pass.
4. **Measure the budget (D197, H17):** an hourly tick under 50 ms on a phone; under 300 KB added before art; no continuous render loop.
5. **A cold review (H10):** one fresh session reads each document and the game with no context and lists what it does not understand.

Holes: H6, H10, H15, H16, H17, H45.

### F8. The three-week play

The user plays one war for three real weeks, with a friend watching once if possible. Nothing is built except fixes. The Solo 1.0 checklist in section 2 is ticked or not.

### F9. Shared mode

As D190 to D192 decided: compare two or three small backends (free tier, scheduled jobs, simple storage, no personal data), then the server runs `step` hourly, phones send orders and fetch state, invite codes, drop-in clans (D87), allies covering an absent player with credit (D88), shared levels with credit (D181). Nothing paid starts without the user's yes. Holes: H7, H12, H25, H26, H28. Its own plan is written when F8 passes.

## 5. Tuning targets (the starting numbers; `11-tuning-plan.md` will own them)

| Target | Value | Now |
|---|---|---|
| Careful bot wins a chapter | 50 to 70 percent of seeds | 100 percent |
| Bold bot wins a chapter | 40 to 60 percent, with more lost fronts than Careful | 100 percent |
| Length of a won chapter | 14 to 28 days | 8 to 15 |
| Passive player after 21 days | keeps at least 80 percent of townships | 70 percent |
| A rival wins against a passive player | not before day 40 | never (untested past 21) |
| Biggest stack in the theatre | under 5 times the median garrison | 20 to 60 times |
| Fronts that reach a decision beat | at least 60 percent | about 100 percent since D210 |
| Fronts lost by Careful | 15 to 30 percent | 23 percent |
| Distinct kinds of event on an active day | at least 6 | 7 |
| Days with nothing to decide (present player) | none | none measured |

## 6. What only the user can do, and when

| What | How much (D193) | Needed by |
|---|---|---|
| Force words, fog level names | 3 + 4 words | F1 gate |
| Name parts per clan | about 40 beginnings and 40 endings each | F3 (placeholders carry F0 to F2) |
| Trait words | about 30 notable, 30 minor | F3 |
| State words, verdict words | about 8 and 4 | F3 |
| Insult lines | optional | F3 |
| Messenger lines | about 20 | F4 |
| Lever names, region names | 10 to 15, 8 to 10 | F5 |
| Checking facts | about 5 per region | F5, F6 |
| Art, when ready | D196's list | after F7; placeholders ship until then |

Nothing here blocks building: every item has a flagged placeholder until it arrives, and the strict check stops a release, not a stage.

## 7. Documents still to write, and the stage that writes each

`11-tuning-plan.md` (F0), `14-economy.md` (F2), `06-content-bible.md` (F5), `05-director.md` (F6), `07-screens.md`, `08-art.md`, `09-writing.md`, `10-tech.md` (F7). The spec (04) is updated at the end of every stage so it always describes the game as built.

## 8. Rules for whoever builds

- One stage at a time. Stop at the gate.
- A decision the user has not made is built only as a flagged proposal, said out loud in the report. Do not build past two unanswered batches.
- When the spec is silent, pick the simplest rule, make it a constant, and list it in the stage report.
- Every statement about a place comes from the board or a verified fact row. Never from memory (H42).
- No percentages on any screen (D99). Counts and words.
- Comedy is the user's (D68). Everything a tool writes is flagged placeholder.
- No personal names or locations in the repository.
- Commit to `claude/nj-township-navigation-c74ho2` and merge to `main` as you go (the user's standing permission, 2026-11-15). Never name another branch in a push.
- After each stage: run the tests, run `targets.mjs`, update the gap list and this plan's status table below.

## 9. Status

| Stage | Status |
|---|---|
| F0 | built 2026-11-15; gate pending (the user plays three days). Rival recruit split adopted (0.5), guided first move (four taps from the home page), targets script and tuning plan written. 5 of 9 targets pass; Bold's win rate, the passive player's losses and Careful's lost fronts still fail (see 11-tuning-plan.md) |
| F1 | built 2026-11-15; gate pending (the user plays a week with their real Progress data). Fog: `js/goblin/ui/fog.js` (pure; Known box 1+, Familiar, Rumoured by border or highway, Unknown), grey fog on the map, cards and the Do panel respect levels, force words from the content file, play raises to Familiar only and never writes `srs`. Quiz charge: optional which-county question on a front, +1 to the next maneuver, writes one real review, at most 3 a day, can be switched off in the Do panel. Browser checks: `ui-fog.cjs`, `ui-charge.cjs`. P3 to P5 built as proposed (P5: attacking blind is allowed) |
| F2 | built 2026-11-15; gate pending (the user plays a week). Food, Build and Coin; trade by population rank; upkeep with a crowding rule and a day's warning before units drift home; marches and recruits cost Food; dig-in and fortify cost Build; hired bands (Coin); goblin bridges; AI under the same rules; screens show the three numbers, the cost of a march and a Food warning. Details and measurements in `14-economy.md`. Hoarding in the sense of unbounded force is closed (tested over 400 days); the bold bot still wins every chapter and the biggest stack is 6.7 times the median |
| F3 to F9 | not started |

## 10. Kickoff prompt for a build session

> Read `docs/goblins/13-finish-plan.md`, then the section for the first stage not marked done and the documents it names. Build that stage step by step, running each step's check. Report what passed in a few lines after each step, list any rule you had to invent, and stop at the gate with the decisions the user needs.
