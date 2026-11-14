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
| D15 | DECIDED | Fog of war is your own knowledge, as a gradient so the state stays readable: Known, Familiar, Rumoured, Unknown. Never lose all state-wide visibility | |
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
| D27 | PROPOSED | Gnomes: Highlands mining. Toads: wetlands, hard to insult. Both are suggestions | |
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
| D53 | PROPOSED | Knowledge is a bonus, never a gate: correct answers give advantages, wrong ones never block |
| D54 | PROPOSED | Orders cost knowledge (plot the route); scouting reuses the fly-over; quiz answers give extra orders |
| D55 | PROPOSED | Show the odds and the reason before a battle ("ridge, plus Ridge-hardened") |
| D56 | PROPOSED | Delegate by county; the player intervenes for events. Few verbs per turn |

### Art and technology

| ID | Status | Decision | Notes |
|---|---|---|---|
| D57 | DECIDED | Keep the existing MapLibre map; Astro-level speed is a hard requirement | |
| D58 | DECIDED | The user wants to learn Blender for low-poly goblins | |
| D59 | PROPOSED | Blender to toon-shaded pre-rendered sprites in layered parts (heads, hats, weapons, injuries) combined in the app. No live 3D on the map. Placeholders generated in code until the user's art is ready | |
| D60 | PROPOSED | Tone is comic with true facts underneath. Never gory | Not yet answered as a whole |

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
