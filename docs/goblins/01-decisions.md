# 01. Pillars and decisions log

Logged 2026-11-14, transcribed from the design conversation (recovered from the session transcript after a context compaction). Status words: see README.

## Pillars

1. **Geography is the rule system.** Rivers, ridges, highways, towns and counties the app already knows are the physics of the game. Learning the map makes you better at the game; the game never quizzes you to continue.
2. **Truth in the texture.** Every proper noun, terrain feature, industry and event is real. Only the characters are invented. Goblins teach by accident, not through a lecture device.
3. **Hidden depth, small surface.** The simulation can be complicated. The player sees a few signals: traits, injuries, a state, odds, a daily report.
4. **Consequences without constant pressure.** Things happen to characters because an event caused them, never because a meter is ticking in the background.
5. **Fast and calm.** Astro-like: no continuous render loop, draw on demand, one small canvas at most. A session is about 30 seconds.
6. **Authored skeleton, procedural flesh.** Authored: what the world is (clans, towns, facts, rules). Procedural: what happens in it (names, trait combinations, injuries, rumours, timing, weather).
7. **Own characters and art only.** Mechanics may be inspired by other games; characters, names and art are not borrowed.
8. **Switch it off.** The strategy layer is a toggle. Quiz, Drive and Progress work without it.
9. **The two-minute door.** Opening the game must be as easy and quick as the Today quiz: one tap to something playable, done in about two minutes, no menu to cross first. (User, 2026-11-14: the Today quiz is the feel to match.)
10. **Depth by discovery.** The big conventions, storylines and stats exist below the surface and show up when you go looking, the way map labels appear only once you zoom in. The "wow, that exists" moment is a goal. The surface stays small.
11. **Novelty over format.** Keep the player slightly off balance, as the cardinal and relative orientation training does: vary the kind of beat so the brain can't settle into the format of the session. Constantly surprising, and quick.
12. **Chance is theatre, not the rule.** Probability must not govern everything. A choice that reduces to "I picked a percentage and it failed" drains the interest out of the game. Where chance appears it is shown as a performance, and every outcome is charged with purpose, whichever way it goes. (User, 2026-11-14.)

## Decisions

### Premise and modes

| ID | Status | Decision | Notes |
|---|---|---|---|
| D1 | DECIDED | A procedural land-grab strategy layer ("goblin war of New Jersey"), mainly teaching north-east New Jersey, other regions too | |
| D2 | DECIDED | Strategy layer has an off switch that keeps the existing quiz and Drive modes | |
| D3 | DECIDED | Anchors: Tecmo Koei strategy games (Romance of the Three Kingdoms, Nobunaga's Ambition) and Shadow of Mordor's Nemesis system. Also drawing on XCOM (Long War, War of the Chosen), Darkest Dungeon, Left 4 Dead's director | Not Dynasty Warriors (real-time action) |
| D4 | DECIDED | Solo mode stays separate and fully offline. A separate "goblin mode" is online and shared | |
| D5 | DECIDED | Shared mode is **cooperative**, about four players, each leading a faction. Duplicate clans are fine (recoloured, like Smash Bros). Players together fight AI-run clans | Small backend accepted |
| D6 | DECIDED | Player is "lord of yourself" commanding a clan; picks a faction | Original framing: goblins vs gnomes. Rats are playable (D22) |
| D7 | DECIDED 2026-11-14 (confirmed with D190) | The simulation is a pure function: (world state, seed, elapsed time) to new world state. Same code runs on device (solo) and on a server (shared) | Confirmed 2026-11-14 |
| D8 | DECIDED 2026-11-14 (confirmed with D190) | Solo first, shared later, no rewrite | Follows from D7 |

### Time and the world

| ID | Status | Decision | Notes |
|---|---|---|---|
| D9 | DECIDED | Semi-real-time with skips. Orders take real time based on real distance | |
| D10 | DECIDED | Time away is liked, provided changes are not too drastic. Occasional dramatic surprises are wanted | |
| D11 | SUPERSEDED 2026-11-14 by D82 | (First proposed) catch-up while away: about one game day per real hour, capped near eight game days. Speeds: Live, Daily rate, Skip to next event | Replaced by the world clock in D82. The idea of a cap on catch-up survives: missed ticks are processed up to a cap |
| D12 | DECIDED | A town or named character is not lost while away without a warning window (e.g. a siege countdown) | |
| D13 | DECIDED (partly) | The user sometimes wants a loss with no warning | Accepted in form 2026-11-14: convoys are the home for unwarned losses (D115). The Brutal setting idea is still only a proposal |
| D14 | DECIDED | A Director (Left 4 Dead style) manages pacing: build up, peak, relax. A drama budget limits how many big events land per day away | Source not read: Valve GDC 2009 slides |
| D15 | DECIDED | Fog of war is your own knowledge, as a gradient so the state stays readable: Known, Familiar, Rumoured, Unknown. Never lose all state-wide visibility | Restored 2026-11-14 by the full link (D81) |
| D16 | DECIDED (leaning) | Rumours are free and passive; a paid scout can confirm or sharpen. Rumours can be wrong | User unsure on cost |
| D17 | DECIDED | Daily report (a newspaper-style Ledger), weather and seasons on the map, alliances and bonds | The newspaper style is relaxed: the Ledger can simply be an event log (D94) |
| D18 | DECIDED in direction 2026-11-14 (D175) | Win condition. Candidates: unify New Jersey, with Civilization-style mini-objectives (hold a crossing for N days, survive a storm) | See D157: a final challenge that is a culmination of known skills, taken when the player chooses |
| D19 | OPEN | Seasons with legacy, reset timing | User wants quick replayability, unsure about resets. No hard reset (D175); whether a legacy carries over is still open (D174) |

### Clans and factions

| ID | Status | Decision | Notes |
|---|---|---|---|
| D20 | DECIDED | 3 or 4 clans per game, drawn from a larger pool. One main clan at full depth, a second at about two-thirds, the rest light | |
| D21 | DECIDED | The pool is authored deliberately. "Procedural" is used carefully | |
| D22 | DECIDED | Clans so far: goblins, gnomes, rats (playable), toads, a self-made clan (working name "goobers"), rare dwarves, and a lone rogue | |
| D23 | PROPOSED | Clan placement is random among towns matching the clan's habitat tags (rats: port and waterfront). The user is happy to randomise placement if it helps play | |
| D24 | PROPOSED | Rats are the second full-depth clan. First playable is goblins and rats only | |
| D25 | DECIDED | Rats are tier-1 heavy and funny "in a chaos sense". Rat King is one named rat | No plague tone (agreed) |
| D26 | PROPOSED | Chaos mechanic: a chaotic captain occasionally does something not ordered, within a cap, reported in the Ledger | |
| D27 | REJECTED / OPEN | "Highlands gnomes" as the gnomes' identity: too generic (user, 2026-11-14). What gnomes are is OPEN. Toads (wetlands, hard to insult) remain a suggestion | |
| D28 | OPEN | What the goobers are: look, temperament, turf | User's call |
| D29 | DECIDED | Dwarves: rare relief faction, full Tolkien/Warcraft style (not hard hats). They emerge from tunnels in geologically fitting rock or mining towns, are reliable (never betray), do a job and leave the game | Town list is hand-curated; to be verified |
| D30 | DECIDED 2026-11-14 ("hidden helping hand") | The Director raises dwarf appearance chance quietly when the player is losing | |
| D31 | DECIDED | A lone rogue in the Chosen/Omar style: belongs to no clan, can't be beaten by armies | Avoid anything past season 4 of The Wire |
| D32 | OPEN | Jersey Devil as a roaming wildcard | Suggested by Claude, not yet commented on |

### Characters

| ID | Status | Decision | Notes |
|---|---|---|---|
| D33 | DECIDED | Procedural named characters ("Gurgle Schnock III"), dynasties where a successor inherits a grudge or heirloom | |
| D34 | DECIDED | Characters can lose limbs, gain scars and fears (tied to places or terrain), and die | Not "stress": consequences, not pressure |
| D35 | DECIDED | Your own characters die somewhat less often than enemies | |
| D36 | DECIDED | Every clan has the same three tiers. Tier 1 grunts die often and are mostly nameless; tier 2 captains sometimes; tier 3 rarely | |
| D37 | DECIDED | Each clan has its own promotion difficulty. Rats climb slowly, so tier-3 rats are prestigious and rare | |
| D38 | PROPOSED | Cap on how many tier-3 characters a clan can have alive at once | |
| D39 | PROPOSED | A Mortality setting: Gentle, Standard, Brutal | |
| D40 | PROPOSED | Hall of the Fallen records the town of death; the killer is promoted and titled; grunts who survive or kill become named captains; at most five injuries/fears shown as icons | |

### Verbal harm

| ID | Status | Decision | Notes |
|---|---|---|---|
| D41 | DECIDED | Besides violence, a player can hurt characters with insults. It depends on the target's stats | |
| D42 | DECIDED | Insults are player actions using authored lines. They can be non sequiturs | Not tied to geography knowledge. Under review 2026-11-14: in paper test 01 the user said they might not write insult lines at all, because the action alone works (a taunt that exploits a trait they discovered). If so, the authoring load in H6 drops |
| D43 | DECIDED | Effects include lowered self-confidence, questioning their beliefs, a fragile sense of self-worth. Recovery is a support group (about a day) | |
| D44 | DECIDED | Your own characters can be hit by insults and need support | |
| D45 | DECIDED | Insults between other clans don't need to matter much | |
| D46 | PROPOSED | Targets differ: toads are nearly immune, rats may stab back. A hidden confidence stat with a visible state (e.g. Shaken) | |
| D47 | REJECTED | Insults that require knowing a real fact about the target's town | |

### Lore and content

| ID | Status | Decision | Notes |
|---|---|---|---|
| D48 | DECIDED | Lore is based in real New Jersey geology and history, including later industrial history. Real towns can be invaded | |
| D49 | REJECTED | The Chronicler versus Field Notes split (too gimmicky) | |
| D50 | DECIDED | The Lenape are never a faction or a joke target. They appear in the factual layer, written from tribal sources. Lenape-derived place names are a real teaching element. Humour may point at the overwriting, not at them | Start from the Delaware Tribe of Indians, the Delaware Nation, the Ramapough Lenape Nation. Etymologies must be checked |
| D51 | REJECTED | Kobolds, sprites, kabouters, knockers, boggarts, basalt brutes, hard-hat dwarves | |
| D52 | OPEN | Further little-dude archetypes | |

### Learning links (all proposals)

| ID | Status | Decision |
|---|---|---|
| D53 | DECIDED in direction (D81) | Knowledge is a bonus, never a gate: correct answers give advantages, wrong ones never block |
| D54 | PROPOSED (direction decided by D81; mechanics open, H24) | Orders cost knowledge (plot the route); scouting reuses the fly-over; quiz answers give extra orders |
| D55 | PROPOSED; odds shown as words with reasons, not percentages (D102) | Show the odds and the reason before a battle ("ridge, plus Ridge-hardened") |
| D56 | PROPOSED | Delegate by county; the player intervenes for events. Few verbs per turn |

### Art and technology

| ID | Status | Decision | Notes |
|---|---|---|---|
| D57 | DECIDED | Keep the existing MapLibre map; Astro-level speed is a hard requirement | |
| D58 | DECIDED | The user wants to learn Blender for low-poly goblins | |
| D59 | PROPOSED | Blender to toon-shaded pre-rendered sprites in layered parts (heads, hats, weapons, injuries) combined in the app. No live 3D on the map. Placeholders generated in code until the user's art is ready | |
| D60 | PROPOSED | Tone is comic with true facts underneath. Never gory | Not yet answered as a whole |

### Answers to the parked proposals (2026-11-14)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D61 | DECIDED (direction) | A narrator is wanted, but it must be cheap. It uses the device's built-in text-to-speech, as Drive mode does, not recorded audio | Voice choice and per-clan voices OPEN. Must be tried on real phones |
| D62 | DECIDED | Titles earned from places, and terrain mastery | |
| D63 | DECIDED | Bonds between characters who fight together | |
| D64 | DECIDED; odds shown as words with reasons, not percentages (D102) | Covert actions, with odds shown up front | The user later said percentage-style choices put them on edge |
| D65 | DECIDED | Raids visible on the map with timers | |
| D66 | DECIDED | A home base. The support group is either a building there or a separate non-main fortress, as in Nobunaga's Ambition | Which one is OPEN |
| D67 | DECIDED | Clans get regional flavour, loosely | |
| D68 | DECIDED | **The user writes the comedic content**: name banks (prefixes and so on), insult lines, clan flavour. Claude builds the structures, slots and tools and does not author lines for shipping | Replaces the earlier plan for Claude to draft insult lines |
| D69 | DECIDED | The primary model is the Tecmo style (many characters, a map of fiefs, a long campaign, delegation), not XCOM, which is too singularly turn-based. XCOM supplies supporting pieces only: covert actions, telegraphed threats, shown odds, bonds | |

### Session feel (2026-11-14)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D70 | DECIDED | The measure of the game's ease is the Today quiz: the user has tapped it countless times because it is fun and quick. The goblin game must open as easily | Pillar 9 |
| D71 | DECIDED | Hidden depth is revealed progressively, by exploring, not by menus. Zooming in already works this way on the map | Pillar 10 |
| D72 | DECIDED | Each session mixes different kinds of beats, so the format never becomes predictable | Pillar 11. The Today quiz already does this |
| D73 | DECIDED | The most valued thing from Shadow of Mordor is personalised storytelling for each enemy | |
| D74 | PROPOSED | A goblin Today: a two-minute session of three to five beats, each a different verb (a raid, a scout, an insult, a rumour, a decision). It shares the Today quiz's shell and the Play hub | Not yet discussed |
| D75 | NOTE | The Today quiz itself could use more work. The user is not focused on that now | |

### Core loop (2026-11-14)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D76 | DECIDED | The two moments the user most wants are the **reveal** (what happened) and the **choice** (what to do) | |
| D77 | DECIDED | Not every turn needs a reveal. Discovery ("wow, that exists") should happen often, but not every turn | The Director sets the rates (H20) |
| D78 | DECIDED | There must be a way to keep playing past two minutes. The user routinely does with the quiz | The two minutes are a door, not a ceiling (H19) |
| D79 | SUPERSEDED 2026-11-14 | (First said) quiz questions stay in the basic game mode and goblin mode probably has none inside it | Replaced by D81 the same day. History kept |
| D74 | PROPOSED (restored) | The goblin Today shares the Today quiz's shell and the Play hub | The full link (D81) makes this plausible again |
| D80 | DECIDED | **Two clocks.** Real time runs while the player is away (orders take real time, catch-up is capped). An **Advance** button fast-forwards time while the player is sitting down, so a long session works like a Tecmo turn | Refined by D82 and D83 |
| D81 | DECIDED | **Full link** between the quiz data and goblin mode: Progress knowledge sets the fog (D15), and quiz knowledge gives real advantages (D53, D54 in direction) | The user's own worry: "it would just be hard to make it fun" (H24). Specific mechanics of D54 are still OPEN |
| D82 | DECIDED | **A separate world clock.** The world advances in **hourly ticks, with significant events around morning, noon and evening Eastern time, daily** (user, 2026-11-14, replacing the first idea of every 8 hours from 9 am). **No single player can move the world clock.** A player's actions can intensify the Director's pacing | Exact times OPEN (suggestion: about 9:00, 12:00 and 18:00, in the region's own time zone). Nothing major overnight. Solves the shared-world problem with Advance (H25) |
| D83 | DECIDED (direction) | **Advance** moves only the player's own time within the current window: their own orders and encounters. It never moves the world clock or affects other players | What fills a long sitting is still OPEN (H19) |
| D84 | DECIDED | Players who are offline are treated and preserved, not punished. The user expects bursts: a week of play, a week away, then back, or deep engagement if it is fun and cooperative. Design for both | Specifics OPEN (H7) |
| D85 | DECIDED (direction) | Allies largely share knowledge, and every shared item names who shared it. Uneven knowledge is acceptable and can be fun. The feeling to design for is gratitude toward the ally who shared | Mechanics OPEN (H28) |
| D86 | DECIDED | The full link (D81) must be paced. The user covers only part of the map on their own, so the game cannot wait on quiz coverage or it would "take forever" | Opens H27 |
| D87 | DECIDED 2026-11-14 ("works all around") | **Drop-in clans.** Every player slot starts as an AI lord and a human can claim it at any time, and give it back. The world is complete with one human and four players is a bonus | Removes the dependence on friends playing |
| D88 | DECIDED 2026-11-14 ("works all around") | Allies cover an absent player's fief and are credited for it ("held Totowa for you"). The same gratitude loop as D85 | |
| D89 | DECIDED 2026-11-14 ("definitely") | The Director's pressure estimate counts active players, not enrolled ones | |
| D90 | DECIDED 2026-11-14 ("works all around") | Knowledge also rises through play (a fight, a scout, a march through a town), so the fog is not gated by the quiz alone | One way to meet D86 |
| D91 | DECIDED 2026-11-14 ("works all around") | A starting theatre: begin with the towns around the player's home and the north-east (the depth plan in H5), and widen the playable map as knowledge or conquest grows | Another way to meet D86 |
| D92 | DECIDED 2026-11-14 ("sure") | **Encounters as sit-down play.** The macro game runs on the world clock; the player's own sitting is spent on personal encounters (a duel, a parley, an insult, a scouting run) that resolve in minutes and feed the next world tick. This is the Shadow of Mordor part | Answers H19 |
| D93 | DECIDED (direction) | In turn-based sit-down play a player can **take territory by doing something well enough or trying hard enough** (user, 2026-11-14) | What counts as "well enough" and "hard enough", and how to stop grinding from beating cleverness, is OPEN (H29) |
| D94 | DECIDED (revised 2026-11-14) | The Ledger is an event log: a running list of what happened. It does not need a newspaper voice or a daily edition. Hourly ticks are small (marches, rumours, weather); major ticks carry the significant events, the Director's peaks, dwarf arrivals and sieges | |
| D95 | DECIDED | **The foothold model.** An encounter win places a foothold on a town, and the next world tick decides whether it holds. Repeated attempts have diminishing returns | Protects the world clock (D82) from grinding. Under revisit 2026-11-14: see D138 to D140 |
| D96 | DECIDED | "Doing it well enough" for a foothold is measured by: (1) a win by a large margin, (2) a clever choice that is unconventional or high risk, (3) quiz questions, which can "charge" it | The quiz is a boost and never a requirement (D53) |
| D97 | PROPOSED | The quiz charge is optional, capped per encounter, and can only add to a foothold, never decide it. "Unconventional" is recognised by the game when a choice uses a discovered lever (a fear, a trait, terrain) instead of the default strongest-force option | Both rules need testing (H29, H30) |
| D98 | DECIDED | One encounter takes about 30 seconds | So complexity must live in hidden state, not in many decisions per encounter |
| D99 | DECIDED | Percentage-style choices must not be the core of the game. "Games of chance quickly become a soul-sucking gimmick." Probability should not feel like it governs everything | Puts the odds part of D55 and D64 under review (H31) |
| D100 | DECIDED (direction) | Where chance appears, still show it: dice rolling, in the manner of Disco Elysium, so the player feels charged with purpose whichever way it goes | The reveal (D76) is the natural place for the roll |
| D101 | DECIDED in direction 2026-11-14 (style 2 with 3), except (e), which is still PROPOSED | Resolution principles: (a) fail forward, every outcome produces something (a scar, a grudge, a discovery); (b) outcomes in bands (clean win, win with a cost, setback with a gain, disaster with a lesson), not win or lose; (c) prefer hidden information to dice, so a loss means "I did not know" and not "I was unlucky"; (d) difficulty shown as words plus the reasons, not as a percentage; (e) the optional quiz charge (D97) can nudge a roll after it lands | To be paper-tested against a plain percentage version (H31) |
| D102 | DECIDED | **Resolution style: named difficulty with reasons and shown dice (style 2), combined with outcomes mostly decided by hidden information (style 3).** Difficulty is shown in words, never as a percentage | User: "2 probably works best with 3." Settles H31 in direction |
| D103 | DECIDED (direction) | **The breaking-point closeup.** A rare, high-drama closeup of a character's internal conflict, before they react and make a permanent choice, as in Darkest Dungeon and Shadow of Mordor. Outcomes: they break (and gain a fear or flaw); rarely they persist and gain a radical, courageous trait; or they hold on at the cost of further madness | Caused only by an event, never ambient stress (pillar 4). Rates and triggers OPEN (H33) |
| D104 | DECIDED (direction) | Encounter levers are discoverable features of the real map. The user's example: gobs discover a beaver dam upstream of a river, stall an enemy until it is broken, and the flood scares him off the bridge. Show, do not tell. A plan can span several 30-second encounters across ticks | Content and truth rules OPEN (H32) |
| D105 | PROPOSED | Lever templates are authored (perhaps ten to fifteen, for example a dam, a rockfall, a blockade, a tide, a canal lock); the map decides where each can apply; the time an effect takes to arrive follows real distance and flow direction | Keeps the content authored and the placement true to the map |
| D106 | DECIDED | **Fiction versus fact.** Embellishing something that cannot be tracked on a real map (a beaver dam) is fine. The indisputable facts you would see on a paper map of New Jersey cannot be changed: towns, counties, rivers, lakes, roads, ridges and major landmarks | Revised 2026-11-14 (see D109): the game never changes the real map. Towns, rivers, roads and real bridges stay as they are. Things the goblins build are in-game objects, drawn distinctly from real features. A beaver dam is fine because no map shows it |
| D107 | DECIDED | **Who gets the closeup.** Closeups happen in encounters with opposing goblins, and an enemy general in a battle can react in one. They are rare for the player's own allies, only during major events. When the player checks in afterward, an ally who was changed shows a portrait that looks lamentful, changed or different, with a text update | Settles whose characters (H33) |
| D108 | PROPOSED | An "aftermath portrait": a changed character gets an automatic changed-portrait variant (a marked expression plus the injury or scar layers already planned), so the closeup animation is needed only for enemies | Keeps the art cost down |
| D109 | DECIDED | Goblins can **construct their own bridge to cross certain rivers**, and it takes them time. By and large they use real bridges. Keep the game as close to real life as possible | A construction mechanic whose main cost is time. Whether a built bridge persists is OPEN. It must be drawn as a goblin structure, not as a real bridge |

### Economy (2026-11-14)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D110 | DECIDED | **Three resources: Food, Build and Coin** (working names, simpler than the first "provisions, materials, wealth"). Everything else stays hidden state | |
| D111 | DECIDED (leaning) | Convoys: goods visibly move on the map and can be raided. The user said "convoys could be cool" | Cost: complexity and drawing (H35) |
| D112 | DECIDED (the trade part) | Holding a town gives four things: a trade from its real history (checked before use), recruits, vision, and levers. The user likes the trade from real history. **The trade must not add resource types**: a town's real industry maps onto Food, Build or Coin, and its real name (zinc, silk, bog iron) is flavour. Varying what you spend is tedious | Recruits, vision and levers are still PROPOSED. Needs per-town trade data (H34) |
| D113 | DECIDED for "goods move automatically" (user: "I agree"); the other rules are still PROPOSED | Economy rules: goods move automatically by real road, river and rail and the player decides only when to guard or cut a route; marches cost Food by distance; healing, building and gifts cost Build, Coin or time; a shortage is a story event and never a penalty to a named character without warning; time is a cost for building, marching and healing | |
| D114 | DECIDED 2026-11-14 ("data, not a simulated entity") | A convoy is data, not a simulated entity: a start, an end, a route and a time of departure. Its position is worked out from the time, so nothing runs per frame and it fits the pure-function simulation (D7) | Keeps the battery cost near zero |
| D115 | DECIDED, with a caution | Convoys are where unwarned losses happen (the wish in D13): minor assets only, never named characters or the home | The user: "just be careful with that" (D116, H38) |
| D116 | PROPOSED, to be reshaped by D118 and D119 | Guardrails for unwarned losses: a cap per day inside the Director's drama budget; none in a player's first days; each leaves a trail and a way to answer it (a recovery or reprisal encounter); the Gentle mortality setting turns them off; a lost convoy never costs more than a small part of a stockpile | The user's own caution, turned into rules |
| D117 | DECIDED | Stockpiles are separate per clan, with gifts between allies and the giver credited (D85, D88) | Settles H37 |
| D170 | DECIDED (the user's own edit) | An unwarned loss **almost never** takes a named character or the home. The user changed "never" to "almost never" in the design summary on GitHub (2026-11-14) | Reading confirmed by the user 2026-11-14: a very rare unwarned loss of a named character or the home is allowed, still framed by D118, and towns and named characters otherwise keep their warning window (D12). Changes D115 |
| D118 | DECIDED | **A loss must be framed.** An unwarned loss feels like a bare taking if the player is not ready for it or in the mindset for it. It works when the game presents itself as giving a certain amount of wins and losses, so the player can be consciously "down to lose that", and when the loss sits among other things presented around it that make it interesting. A loss that just takes something and says "good luck" is what to avoid | The user's answer on H38. My reading of the last sentence of their message: the bad version is a loss with no setup |
| D119 | MIXED 2026-11-14: (a) DECIDED, (b) MAYBE under conditions (D122), (c) REJECTED (D123), (d) DECIDED, short | Tools for framing: (a) a loss budget shown in words ("a lean week is coming"), taken from the Director's drama budget; (b) a clue rule: every unwarned loss can be explained by an earlier Ledger entry (a rumour, a trail, a sighting), cryptic enough not to count as a warning; (c) a **mood dial**, a one-tap Calm or Eventful setting that tells the Director the player's mindset today, with unwarned losses only under Eventful or the default, and Eventful paying more as risk is rewarded (D96); (d) an opening statement that tells new players plainly that the war takes as well as gives | Does not replace D12: towns and named characters still get a warning window |
| D120 | DECIDED | **The messenger.** The loss budget ("a lean week") is delivered in character, by a cute little sad goblin who is scared to tell you the news. The mood carries the message, not a number | The user's wording: "reported by a cute little sad goblin who's really scared to tell you the news". The lines are the user's (D68) |
| D121 | PROPOSED | The messenger's mood is a standing signal: nervous means a lean week ahead, cheerful means a good one. The same character gives the short opening statement (D119d), and could read the Ledger. Art need: one character with a few expressions, reusing the aftermath-portrait approach (D108) | |
| D122 | DECIDED (condition) | If foreshadowing is used at all (D119b, still a maybe), it must never be required: missing it must not leave the player mechanically worse off. Missing it may make the blow land harder in feeling. The user does not want lore to be important in a way where you must read it or get surprised | Clues are better as things seen on the map than as lore to read |
| D123 | REJECTED | The mood dial (D119c): "too pandering" | |

### Characters (2026-11-14)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D124 | DECIDED | The hidden state of a character has five groups. **Identity:** name, clan, tier, dynasty number, home town. **Body:** injuries and missing limbs, scars. **Mind:** a hidden confidence stat, fears tied to places or terrain, personality traits. **History:** who they have beaten or lost to, titles, terrain mastery. **Bonds:** allies, rivals, grudges. The surface shows only three to five of these | User: "that's all great". Style 3 (D102) resolves outcomes from this state |
| D125 | DECIDED (revised 2026-11-14) | **Personality traits come in a gradient: 3 per goblin, 4 higher up, 5 at the highest. Only some are notable: 1 notable trait for the lowest, 2 for higher up, 3 at most for the highest.** The rest are minor and "not that big a deal". The notable trait is the accessible headline | My reading, to confirm: the 3, 4 and 5 map to tiers 1, 2 and 3 |
| D126 | DECIDED 2026-11-14 ("earned slots yes") | Promotion opens a trait slot, and the new trait is earned from what the character did (history), not rolled | Nemesis-style storytelling. Makes rising feel like gaining depth |
| D127 | PROPOSED | A nameless tier-1 grunt carries no individual traits until it is named and promoted. Traits are written as a word bank by the user (D68) | Keeps the data and the content small |
| D128 | DECIDED | Traits can change, but it is hard to change them | How hard, and what it takes, is OPEN (H40) |
| D129 | DECIDED | A closeup trait (D103) takes a slot | Which kind of slot is OPEN. My suggestion: a notable one, since it is radical |
| D131 | DECIDED | State names are the user's words. After R's break the user calls him **Humiliated**, not my placeholder "Shaken". The real list of visible states is written by the user (D68) | Paper test 01, beat 4 |
| D130 | PROPOSED | A closeup (D103) is triggered when a character's own notable traits conflict under pressure, for example Proud (cannot retreat in front of his rats) against Cautious (wants to). It ends in a break (a new fear tied to a place, a cracked confidence, a grudge) or, rarely, a radical persistence. A break does not rewrite a notable trait at once (D128) | Seen in paper test 01, beat 3. The conflict is the reason for the drama |
| D132 | DECIDED | **Conflicts end decisively.** The player either wrests the land from the enemy or loses the battle and is allowed to focus elsewhere. Having to find traits to exploit was "one too many" when it was the only way forward. Trait levers (D97, D104) are optional shortcuts, never a requirement for winning | User, after paper test 01 |
| D133 | DECIDED (direction) | A lost battle closes the front and frees the player's attention. There is always a way to disengage. Losing is not a spiral | Feeds H44 and the Director (domain 7) |
| D134 | DECIDED | A player has up to **3 fronts** (open conflicts) at once. The user first said 3 to 4, then settled on 3 | |
| D135 | DECIDED | A front lasts about **half a day** | How the clock counts while the player is away is OPEN (H46); settled by D142 |
| D136 | DECIDED (direction) | Fronts **pause while the player is away**, rather than being fought by standing orders. Coming back to significant changes elsewhere in the world is still wanted | Replaces my standing-orders idea for fronts. Pause details OPEN (H46) |
| D137 | DECIDED | Losing ground is **very rare, though allowed.** A lost attack usually costs units and scars, not land | Fits D132 and D133 |
| D138 | DECIDED | Territory expansion must feel quick: a smart player can "thresh through a few territories" in a sitting. The significant (major) timer brings something else on top and must not gate ordinary conquest | User: not gaining significant land until the significant timer goes off would be annoying |
| D139 | PROPOSED | A scale ladder: sites (landmarks) below townships below counties below the region. Sites and townships are taken at sitting speed; counties need more (for example every township or a stronghold); the major timer handles the largest layer and the world's reply | Townships are the base (D141). Sites (landmarks) are still unaddressed |
| D140 | PROPOSED | A won front captures its territory at once. The foothold (D95) becomes a progress mark inside a front and no longer waits for a world tick. The major tick is the world's answer to a burst of conquest (a counterattack, a new front) | Revisits D95 |
| D141 | DECIDED | **Townships are the primary territory unit.** Neighbourhoods are out: too granular | User, 2026-11-14 |
| D142 | DECIDED 2026-11-14 ("let's go with that") | **Fronts run on player time.** A front is a local scene of about 4 to 6 beats, and its clock advances with the player's own actions, not with real hours. Pausing is then automatic, nothing moves while the player is away, and no player touches the world clock (D82). The user's "half a day" (D135) is read as about half a day's worth of visits. Real time (the hourly ticks) still governs convoys, travel and the world's own events | The user said "I don't know what to do with the clock". This is a recommendation, not a decision |
| D143 | DECIDED 2026-11-14 ("let's go with that") | A paused front pins the enemy captain to it, so one captain can be at only one player's front at a time. The world continues elsewhere (other clans, weather, dwarves, convoys), so coming back to significant changes still happens | Answers what the enemy does at a paused front (H46) |

### Macro layer and the shape of a front (2026-11-14)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D144 | DECIDED in direction 2026-11-14 (D145 and D146 depend on it) | The macro layer is a **Strategery-style attrition game on the township graph.** Each township holds a force number; an attack along a shared border resolves with dice, with losses on both sides, shown rolling; skill is concentrating force, fortifying the front while expanding the back, and rolling over thin defences. Captains attach to forces and shift the results | Inspired by the user's favourite phone game (see 00). Reconciles the Tecmo map layer with the Shadow of Mordor character layer |
| D145 | DECIDED 2026-11-14 ("I agree with both") | **Two speeds of conflict.** A quick dice skirmish against a nameless garrison (one beat, force numbers and shown dice), and a front (maneuvers, a decision beat, a tally) when a named captain defends. Most conquest is quick; the drama is reserved for named characters | May also fill a long sitting (H19) |
| D146 | DECIDED 2026-11-14 ("I agree with both") | **Fortify before you leave.** Your border townships carry garrisons and fortification you set in advance, so enemy attacks bleed against them. This protects you while a front is paused or you are away, and fits "losing ground is very rare" (D137) | Replaces standing orders as the away-protection |
| D147 | DECIDED (for now) | A front has a shape: contact, two or three maneuver beats that move a standing up or down a ladder in words (Behind, Even, Ahead, Commanding), a decision beat, and a closing tally. Trait levers jump the ladder two steps; direct force can go to the decision beat at any time | User: "I think your front's shape suits me for now" |
| D148 | DECIDED | **Maneuvering can win on its own.** A front can end early at Commanding, with the enemy yielding or fleeing and no decision beat | The beaver-dam flood is the example |
| D149 | PROPOSED | **The skirmish dice rule, a first version.** The attacker rolls up to 3 dice and leaves one unit behind; the defender rolls up to 2; dice are compared in pairs, highest first; a tie goes to the defender; each lost pair costs a unit. Fortification gives the defender's best die +1 (chosen 2026-11-14: the user wanted something between nearly impassable and a mild edge); a stronger "fortress" tier, an extra defender die, could be an upgrade; a captain leading gives that side one extra die; geography (a river across the border, a ridge) gives one modifier per attack | My own Risk-style rule: Strategery's actual rule is unknown to me. Simulated in docs/goblins/sims/skirmish-01.md. Fortification now set between strong and mild (variant C); a captain is still large; needs tuning |
| D150 | DECIDED (leaning) | A front starts when a **named captain** defends the township. Where only nameless garrisons defend, it is a quick skirmish | User: "I don't really know. I guess so." |
| D151 | PROPOSED | **One feeling to cut against.** Write one sentence that names the single feeling the game gives (as FTL's designers used "captain of a starship") and test every feature against it. Anything that does not serve it is cut or postponed | Verified 2026-11-14 from Game Developer's coverage of the GDC 2013 postmortem: "By having one singular focus we were able to abandon everything else that didn't fit in line with that vision" (Davis). Helps with scope (H5, H6) |
| D152 | PROPOSED | **A visible clock that terrain can tune.** Whatever pushes a front toward its end (the beats left on the ladder, D147) is shown plainly, and the geography can speed or slow it (a swamp or the Pine Barrens slowing an enemy, a highway speeding one up), as some FTL sectors slow the rebel fleet | The designers' purpose for FTL's rebel fleet is not covered in the articles I read; the description came from fan guides. Feeds H44 |
| D153 | PROPOSED | **Each piece fun on its own, built in small steps.** Build in micro-progressions: one small piece at a time, each fun immediately. Be wary of a strategy layer whose parts only come together late, which the FTL designers found frustrating. When friends test, watch for what they do not understand | From the 2018 Into the Breach interview (Davis, Ma). Shapes the build order |
| D154 | PROPOSED | **One number, several jobs.** A single visible figure should carry more than one meaning (a township's force is both its strength and its garrison), and the interface stays minimal | FTL's power bar was strength, power used and health in one (Ma) |
| D155 | PROPOSED | **No wasted motion.** No confirmation dialogs, no loading exposition, instant return to play, in line with the two-minute door (pillar 9) | FTL went from game over to the menu in seconds |
| D156 | PROPOSED | **A test for choices:** if it is a decision, it should not be the same choice every time (Ma). Every option should be best in some situation. Use it on H41 | |
| D157 | PROPOSED | For the win condition (D18): a final challenge should be a culmination of skills the player has already used, not new mechanics, and the player could choose when to take it, which gives a dynamic play length | From the Into the Breach interview. Feeds D18 and D19 |
| D158 | DECIDED | **The dwarves are a hidden helping hand in *timing*, and a rule of the world in *place and reason*.** The Director quietly makes them more likely when the player is struggling (D30), and the player never sees that. Where and why they appear follows rules that can be learned: they come only from geologically fitting rock and mining towns (D29) | User: "hidden helping hand. But I kind of like the rule of the world thing." Settles H49 in direction |
| D159 | PROPOSED | The Director only adjusts *when*, never *where*: it cannot conjure dwarves in a town the rules say has none. A learnable tell comes first, such as rumours of hammering from a mine. Two routes to them (the user chose both): they can be **goaded by opposing forces to fend for themselves**, which benefits the player (D160), or the player can **make their way to them** (D161) | Details OPEN (H50) |
| D160 | DECIDED | **Goaded dwarves.** Opposing forces can provoke a rock town, and the dwarves fend for themselves, which is a benefit to the player | User: "they could be goaded by opposing forces to fend for themselves" |
| D161 | DECIDED | **Sought dwarves.** The player can make their way to them | User: "or you could make your way to them" |
| D162 | PROPOSED | The Director's hidden hand works by **steering enemy aggression toward a rock town** when the player is struggling; the dwarves' response then follows their own rule. The help is in the world's logic, not conjured | Fits D158 and D159 |

### Director v0 (2026-11-14, decided)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D163 | DECIDED 2026-11-14 ("no changes") | **Pressure, in words.** For each active player the Director estimates pressure from open fronts, losses in the last day, unread news and time since a quiet stretch, and names it **Calm, Steady, Heated or Overwhelmed**. The number stays hidden; the messenger's mood mirrors the word (D121) | Counts active players only (D89) |
| D164 | DECIDED 2026-11-14 ("no changes") | **A daily rhythm that follows the three major ticks:** morning builds (a new front opens), noon peaks (the day's big event), evening relaxes (quiet, good news). The Director bends it: no peak when pressure is Heated, an extra peak after two Calm days | Could later learn when each player usually opens the game |
| D165 | DECIDED 2026-11-14 ("no changes") | **The drama budget, per player per day:** at most one peak and two minor events; at most one unwarned loss every two days, only minor assets such as convoys (D115), none in the first three days, none under Gentle. The budget shows only through the messenger's mood ("a lean week", D120) | Numbers are starting values to tune in the simulator |
| D166 | DECIDED 2026-11-14 ("no changes") | **The empty day.** Opening the game always shows at least one thing to decide on the first screen: an open border, a rumour of trouble, a quiet skirmish chance, or a trade or travel event | Keeps the two-minute door (pillar 9) |
| D167 | DECIDED 2026-11-14 ("no changes") | **Reveal and discovery cadence.** A reveal (a result you waited for) on about half of opens; a discovery (a new fact on an enemy or a town) on most opens, with at most one big one per sitting | Starting rates to tune (H20) |
| D168 | DECIDED 2026-11-14 ("no changes") | **The catch-up report.** Missed hourly ticks are processed in order up to a cap of 72 hours (about nine major events); beyond that the world settles. The messenger gives a headline and up to three items, and the rest goes to the Ledger event log (D94). After a week or more, a short welcome back covering your own area only | Cap and counts are starting values |
| D169 | DECIDED 2026-11-14 ("no changes") | **Travel pace.** A march takes about one tick per three miles of real distance, so a neighbouring township is one to two ticks away and a skirmish is immediate | A starting value |

### Long-term hook (2026-11-14, decided)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D171 | DECIDED 2026-11-14 ("all good") | **Regions are the unit of authored content.** About eight to ten region kits (for example the Highlands, the Palisades and Hudson waterfront, the Meadowlands, the Watchungs and Piedmont, the Raritan and central New Jersey, the Pine Barrens, the Shore, the Delaware Valley). Each kit has a terrain rule, a hazard, a trade flavour and a handful of verified facts. Towns inherit their region's kit; only the starting theatre's towns get town-level facts | Answers the content scale in H5. The kits are the user's to write or approve (D68) |
| D172 | DECIDED 2026-11-14 ("all good") | **Three engines of novelty for week three:** new places (moving into a new region), new people (dynasties, nemeses and grudges that grow), new rules (seasons, weather and terrain) | The answer to H2 |
| D173 | DECIDED 2026-11-14 ("all good") | **Your knowledge is the progression bar.** The more of New Jersey you learn, the further the fog clears (D15, D81), so learning is also the long-term reason to open the quiz | |
| D174 | DECIDED 2026-11-14 ("all good") | **Replay.** Each new war draws different clans from the pool and places them randomly on matching habitat (D23), so a second campaign differs from the first. Whether a legacy carries over (D19) stays open | |
| D175 | DECIDED 2026-11-14 ("all good") | **The win condition as region chapters.** "Unify New Jersey" is the long game, taken a region at a time. Each region is a chapter with its own mini-objectives and a final challenge made of skills already used, taken when you choose (D157). No hard reset | Answers D18 in direction |

### Learning integration (2026-11-14, decided; the Known threshold is under review, see D182)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D176 | DECIDED 2026-11-14 ("all good") | **Fog levels come from the existing spaced-review data** (store `srs`: a box 0 to 5 per town, and `stats`). **Known** was first box 3 or more and is now **box 1 or more** (D182). **Familiar** is asked but missed lately, or familiar through play, or the starting floor. **Rumoured** is a town not yet asked about that lies along a border or a road from something Known or Familiar. **Unknown** is the rest | Nothing new is tracked. Read from js/progress.js: a town is "learned" at box 3 and above. Threshold amended by D182 after the user's real data showed only 3 towns at box 3 or more |
| D177 | DECIDED 2026-11-14 ("all good") | **Rumours travel along roads you know.** Learning a highway extends how far rumours reach | Makes the highway quiz matter to the map |
| D178 | DECIDED 2026-11-14 ("all good") | **In-game familiarity is separate from learning.** Fighting, scouting or marching through a township can raise it to **Familiar** at most. **Known** needs real learning (box 1 or more, D182). In-game familiarity is never written into the spaced-review data | The game can show you things; only learning makes it Known (H27) |
| D179 | DECIDED 2026-11-14 ("all good") | **The quiz charge is a real review.** A charge question is drawn from the places involved and counts as a spaced-review answer, so playing the game also reviews you. It is optional, at most one per beat and three per sitting, a wrong answer never blocks, and a Settings switch turns charges off | Keeps the link from feeling like homework (H24) |
| D180 | DECIDED 2026-11-14 ("all good") | **A floor for new players.** The player's home township and its neighbours start as Familiar, and the starting theatre is at least 12 townships, otherwise sized from the player's own data (D91). A friend with no quiz history still sees a readable map | Answers H14 and H26's empty-data case |
| D181 | DECIDED 2026-11-14 ("all good") | **Sharing among allies is automatic and shares levels only.** The Known or Familiar level of a township crosses the network, with credit to who shared it (D85). Scores, answers and history never do | Settles H28 |
| D182 | DECIDED 2026-11-14 ("yeah") | **Amend the Known threshold (D176).** The user's Progress screen (2026-11-14, 186 well-known towns) shows 3 learned, 44 getting there, 65 missed lately and 74 new. With Known at box 3 or more, only 3 townships would ever show full detail. Proposed: **Known is box 1 or more** (learned plus getting there, 47 of 186 now), **Familiar** is asked but missed lately (65), or familiar through play (D178), or the starting floor (D180). The full 4-level fog is otherwise unchanged. Box 3 ("learned") could later unlock one extra layer of detail | Accepted. Without it the fog would be nearly blind (H27) |
| D183 | DECIDED 2026-11-14 ("all good") | **The starting theatre is the home township plus its neighbours out to two or three border steps,** between 12 and about 60 townships. From the map's own borders (illustration only, centred on two Passaic County towns): within 2 steps 25 and 21 townships, within 3 steps 58 and 48, within 4 steps 102 and 83 | The player's real home is not assumed. Counts computed from data/nj.topo.json |

### Map and data (2026-11-14, decided)

Checked against the app's data: 564 townships with 1,445 shared-border pairs (from `data/nj.topo.json`), 16 rivers with flow direction, 11 mountains and ridges, 14 lakes, and 38 highways, each listing the towns it passes (4 to 53, about 20 on average) and the highways it meets.

| ID | Status | Decision | Notes |
|---|---|---|---|
| D184 | DECIDED 2026-11-14 ("all good") | **The board is the township border graph.** 564 nodes and 1,445 border pairs, computed from the topology the app already ships. No new data is needed for the board | |
| D185 | DECIDED 2026-11-14 ("all good") | **Routing uses a coarse network.** Marches and convoys move by border steps, and the 38 highways are fast lanes through the towns they pass, joined where they meet. No local road network is needed | Answers the routing half of H35. The render cost of moving convoys is still to measure |
| D186 | DECIDED 2026-11-14 ("all good") | **What a township carries:** owner, force, fortification, region (D171), its trade resource (D112), and flags derived from the map: a river on a border, a highway through it, a rock town (D29) | |
| D187 | DECIDED 2026-11-14 ("all good") | **Geography modifiers are computed, never written by hand.** A border crossed by one of the 16 rivers, or by a ridge, gives the defender the geography modifier (D149). A one-time build script works this out, and a sample is checked by eye | The lesson of H42: descriptions from memory were wrong |
| D188 | DECIDED 2026-11-14 ("all good") | At build time, one script (`tools/build_goblin_board.py`) writes one file (`data/goblin-board.json`) holding the graph, the flags and the fast lanes | Not to be built yet |

### Shared play, content, art, tech, onboarding, operations (2026-11-14, decided)

Counts, sizes and budgets below are Claude's starting estimates, not measurements.

| ID | Status | Decision | Notes |
|---|---|---|---|
| D189 | DECIDED 2026-11-14 ("all good") | **The quiet player.** After three days away, a player's clan is run by its AI lord in a defensive posture: it fortifies, does not attack, and loses no named characters. On return, control passes back with the welcome-back report (D168) | Settles the exact rule in H7 |
| D190 | DECIDED 2026-11-14 ("all good") | **How the shared world runs.** A small server holds the world state. Each phone sends its orders. A scheduled job runs the same simulation function every hour (D7, D82). Phones fetch the state when opened. Solo mode runs that same function on the phone, offline | Asks the user to confirm D7, the pure-function simulation, which everything since has assumed |
| D191 | DECIDED 2026-11-14 ("all good") | **Joining.** An invite code, a display name and a key kept on the device. No email, no password, up to four humans | |
| D192 | DECIDED 2026-11-14 ("all good") | **Operations.** The backend is chosen at build time by comparing two or three small services on: a free or near-free tier, scheduled jobs, simple storage, and no personal data. Only game state and display names are stored. Progress and location never leave the phone. The world is exported nightly as a backup. Nothing paid is started without the user's yes | Addresses H12 |
| D193 | DECIDED 2026-11-14 ("all good") | **Line inventory, version 0 (the user's writing load).** Whole game: name parts per clan (about 40 beginnings and 40 endings), about 60 trait words (30 notable, 30 minor), about 8 state words, 4 verdict words, about 20 messenger lines, 10 to 15 lever names, and 8 to 10 region kits of about 5 checked facts each. Insult lines are optional (D42). **First playable needs only:** name parts for two clans, 30 trait words, 6 state words, 4 verdict words, 10 messenger lines and one or two region kits | Addresses H6. Estimates |
| D194 | DECIDED 2026-11-14 ("all good") | **Placeholders are flagged in the data,** and a build check lists any that remain, so nothing Claude wrote as a stand-in ships by accident (D68) | |
| D195 | DECIDED 2026-11-14 ("all good") | **The fact pipeline.** Each fact is a row with its text, source link, a verified flag and a date. Unverified facts are left out of builds automatically | Addresses H11 |
| D196 | DECIDED 2026-11-14 ("all good") | **Art list, version 0, for the first playable.** Per clan: one grunt sprite; captain parts (3 heads, 3 hats, 3 weapons); 4 injury layers; 3 portrait expressions. Also: the messenger with 3 expressions, dice, a fill colour per clan, and icons for traits and states. Code-generated placeholders come first (D59). The narrator voice follows the existing voice setting | Addresses H15 and H39. Estimates |
| D197 | DECIDED 2026-11-14 ("all good") | **Tech and performance budget.** No continuous render loop; the map changes only when state changes. One hourly tick for a 60-township theatre in under 50 ms on a phone. Under 300 KB of added download before art, and under 2 MB of art, loaded only when goblin mode is on. Solo saves are one versioned file in the phone's storage. The simulation is a plain module with no screen code, so the same file runs headless for tuning | Targets, unmeasured (H17) |
| D198 | DECIDED 2026-11-14 ("all good") | **The first two minutes.** Pick a clan in one tap. The messenger gives the short opening statement. You see your home township and its neighbours. One guided skirmish against a weak nameless garrison, a near-certain win. Then your first front is offered. No walls of tutorial text: everything else is taught when first met (pillar 10). A friend's invite link leads to the same steps | Addresses H13 |
| D199 | DECIDED 2026-11-14 ("all good") | **Build order, each stage gated by the user playing it.** M0: the headless simulation (skirmish, front, Director), its Ledger read as stories. M1: the skirmish layer on the map in the starting theatre, solo, with placeholders. M2: fronts, characters and the tally. M3: economy and convoys. M4: the Director and messenger. M5: shared mode | Follows D153: each piece fun before the next |

### From paper test 02 (2026-11-14, proposed)

| ID | Status | Decision | Notes |
|---|---|---|---|
| D200 | PROPOSED | **Adopt the front rules from paper test 02.** A maneuver rolls 2d6 plus modifiers: 11 and over moves up two steps, 8 to 10 up one, 5 to 7 no move but a discovery, 4 or less down one. A discovered weakness used well moves up two on 8 and over. Some maneuvers are certain, with no roll (a goblin bridge: Behind to Even). The decision beat is a skirmish (D149) adjusted by standing: Behind, the defender is fortified and has a captain's die; Even, fortified; Ahead, neither; Commanding, the enemy yields (D148) | Worked in the test: "That felt great" |
| D201 | PROPOSED | **Captured captains.** A captain who holds to the end in a closeup and loses can be captured. A captive can be ransomed for Coin, released (which may earn a debt or a grudge), or kept as a bargaining piece. Your own captured captains can be rescued | Details are H51 |

### Working rules introduced by the systems spec (2026-11-15, proposed)

Written while turning the log into a buildable spec (04). Each fills a gap or resolves a contradiction. All need the user's yes.

| ID | Status | Decision | Notes |
|---|---|---|---|
| D202 | PROPOSED | **Conquest pace.** In a sitting a player may attack as often as they like. The limits are attrition, the one unit that must stay behind, and recruits arriving only at major ticks. Moving units between your own bordering townships is immediate | The Strategery feel (D138, D144). It leaves the Advance button (D80, D83) and the foothold's diminishing returns (D95, D96) with no job, so they are parked. Travel time (D9, D169) then applies to AI raids and convoys only |
| D203 | PROPOSED | **Recruits.** At each major tick a clan gains one unit per three townships, rounded up, placed on its weakest border by default | Fills the "recruits" part of D112 |
| D204 | PROPOSED | **Dig in.** A township with 3 or more units that has not attacked since the last major tick becomes fortified. Attacking out of it ends that. Later it costs Build | Makes "fortify before you leave" (D146) a rule |
| D205 | PROPOSED | **AI behaviour and warnings.** An AI clan makes at most one attack per major tick, only at 2 to 1 or better. Against another AI it attacks at once. Against a human it declares a raid that is visible on the map and lands no sooner than six hours later. It never attacks a paused front's township, an absent player's home, or a player in their first three days | Makes D12, D65, D137 and D143 concrete |
| D206 | PROPOSED | **Geography and standing in the dice.** Attacking across a river or ridge border costs the attacker 1 on their best die, unless a highway runs through both towns. In a front, the captain's defence replaces fortification: Behind gives the defender +1 on the best die and an extra die, Even gives +1, Ahead gives nothing | Defines D149's "one modifier" and tidies D200 |
| D207 | PROPOSED | **Even starting shares.** At the start of a war the clans claim townships in turn, each taking the unowned neighbour of its land nearest its home, so a three-clan war on 58 townships starts about 19, 20 and 19 | Found in M0 S3: nearest-home ownership gave the central clan 40 of 58 |
| D208 | PROPOSED | **An AI masses its recruits at its best attack position:** the border township with the best force against its weakest attackable neighbour. A human's clan, and an absent one, reinforce their weakest border township (D203) | Found in M0 S3: with recruits spread to the weakest border (D203) and attacks only at 2 to 1 (D205), no AI ever attacked and the world never moved |
| D209 | PROPOSED | **Conquest tempo and a leader's handicap for AI clans.** After capturing a township an AI clan waits 72 ticks (three days) before attacking again, and a clan holding more than half the theatre needs 3 to 1 instead of 2 to 1 to attack | Found in M0 S3 by experiment (docs/goblins/sims/snowball-01.md, round 2): without it one AI clan takes the whole theatre in about a month; with it, after a year no clan dominates in the human setup and fighting continues for most of the year. A force cap with tapering recruits was tried first and not adopted |

## Facts to verify before use

Everything below came from memory and is `unverified`.

- The "Norway rat" is not from Norway and arrived on ships in the 1700s.
- Boonton began as a logging camp (the user's recollection).
- Fowler's toad and the eastern spadefoot occur in New Jersey.
- Franklin and Sterling Hill fluorescent minerals.
- Palisades sill (about 200 million years), Watchung lava flows, glacial limit from Perth Amboy to Belvidere, Hadrosaurus from Haddonfield.
- Dwarf town list: Franklin, Ogdensburg (Sterling Hill), Dover, Mine Hill, Ringwood, Hibernia, Watchung and Palisades traprock quarry towns. Check against the New Jersey Geological Survey.

## Open questions, in priority order

1. Confirm the new working rules D202 to D206, and D149, D200 and D201 (see 04, section 14).
2. What the goobers are (D28).
3. Whether a legacy carries between wars (D19, D174). The win condition is settled in direction (D175).
4. Tone for the whole game (D60).
5. Insult lines: a first batch of authored lines, and a voice note for each clan.
6. Whether the rogue and the Jersey Devil are separate (D31, D32).

## Sources

- Valve, "The AI Systems of Left 4 Dead" (Mike Booth, GDC 2009), https://cdn.fastly.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf (not read; secondary summaries only)
- Game Developer, "Using Intensity to Drive Player Engagement"
- PC Gamer and Game Informer on the Nemesis system (de Plater). The DICE 2015 talk has not been read; the user offered to pull it.
- Reviews of Romance of the Three Kingdoms and Nobunaga's Ambition as cited in the design conversation.
