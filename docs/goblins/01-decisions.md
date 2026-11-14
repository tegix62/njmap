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
| D7 | PROPOSED | The simulation is a pure function: (world state, seed, elapsed time) to new world state. Same code runs on device (solo) and on a server (shared) | Needs the user's confirmation |
| D8 | PROPOSED | Solo first, shared later, no rewrite | Follows from D7 |

### Time and the world

| ID | Status | Decision | Notes |
|---|---|---|---|
| D9 | DECIDED | Semi-real-time with skips. Orders take real time based on real distance | |
| D10 | DECIDED | Time away is liked, provided changes are not too drastic. Occasional dramatic surprises are wanted | |
| D11 | PROPOSED | Catch-up while away: about one game day per real hour, capped near eight game days. Speeds: Live, Daily rate, Skip to next event | Numbers are placeholders for tuning |
| D12 | DECIDED | A town or named character is not lost while away without a warning window (e.g. a siege countdown) | |
| D13 | DECIDED (partly) | The user sometimes wants a loss with no warning | Proposal: only tier 1 and minor assets, or Brutal setting. Not accepted yet |
| D14 | DECIDED | A Director (Left 4 Dead style) manages pacing: build up, peak, relax. A drama budget limits how many big events land per day away | Source not read: Valve GDC 2009 slides |
| D15 | DECIDED | Fog of war is your own knowledge, as a gradient so the state stays readable: Known, Familiar, Rumoured, Unknown. Never lose all state-wide visibility | Restored 2026-11-14 by the full link (D81) |
| D16 | DECIDED (leaning) | Rumours are free and passive; a paid scout can confirm or sharpen. Rumours can be wrong | User unsure on cost |
| D17 | DECIDED | Daily report (a newspaper-style Ledger), weather and seasons on the map, alliances and bonds | |
| D18 | OPEN | Win condition. Candidates: unify New Jersey, with Civilization-style mini-objectives (hold a crossing for N days, survive a storm) | |
| D19 | OPEN | Seasons with legacy, reset timing | User wants quick replayability, unsure about resets |

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
| D30 | PROPOSED | The Director raises dwarf appearance chance quietly when the player is losing | |
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
| D42 | DECIDED | Insults are player actions using authored lines. They can be non sequiturs | Not tied to geography knowledge |
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
| D55 | PROPOSED | Show the odds and the reason before a battle ("ridge, plus Ridge-hardened") |
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
| D64 | DECIDED | Covert actions, with odds shown up front | |
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
| D80 | DECIDED | **Two clocks.** Real time runs while the player is away (orders take real time, catch-up is capped). An **Advance** button fast-forwards time while the player is sitting down, so a long session works like a Tecmo turn | Open: Advance against the shared world (H25) |
| D81 | DECIDED | **Full link** between the quiz data and goblin mode: Progress knowledge sets the fog (D15), and quiz knowledge gives real advantages (D53, D54 in direction) | The user's own worry: "it would just be hard to make it fun" (H24). Specific mechanics of D54 are still OPEN |

## Facts to verify before use

Everything below came from memory and is `unverified`.

- The "Norway rat" is not from Norway and arrived on ships in the 1700s.
- Boonton began as a logging camp (the user's recollection).
- Fowler's toad and the eastern spadefoot occur in New Jersey.
- Franklin and Sterling Hill fluorescent minerals.
- Palisades sill (about 200 million years), Watchung lava flows, glacial limit from Perth Amboy to Belvidere, Hadrosaurus from Haddonfield.
- Dwarf town list: Franklin, Ogdensburg (Sterling Hill), Dover, Mine Hill, Ringwood, Hibernia, Watchung and Palisades traprock quarry towns. Check against the New Jersey Geological Survey.

## Open questions, in priority order

1. Confirm D7 (the pure-function simulation).
2. What the goobers are (D28).
3. Win condition and seasons (D18, D19).
4. Tone for the whole game (D60).
5. Insult lines: a first batch of authored lines, and a voice note for each clan.
6. Whether the rogue and the Jersey Devil are separate (D31, D32).

## Sources

- Valve, "The AI Systems of Left 4 Dead" (Mike Booth, GDC 2009), https://cdn.fastly.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf (not read; secondary summaries only)
- Game Developer, "Using Intensity to Drive Player Engagement"
- PC Gamer and Game Informer on the Nemesis system (de Plater). The DICE 2015 talk has not been read; the user offered to pull it.
- Reviews of Romance of the Three Kingdoms and Nobunaga's Ambition as cited in the design conversation.
