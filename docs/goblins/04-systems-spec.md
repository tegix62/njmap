# 04. Systems spec, version 0

Written 2026-11-15 from the decisions log (01). This is the document a builder works from, so they never have to read 200 log rows. Where the log is silent or contradicts itself, this spec picks a working rule and marks it **(new, D2xx)**: those need the user's yes and are listed in 01. Every number is a starting value held in one constants table (section 12), to be tuned by simulation.

Scope markers: **[M0]** is in the first headless build. Everything else is specified enough to not be painted into a corner, and built later (build order: D199).

## 1. The shape of the game in one paragraph

A world of townships on the real New Jersey border graph. Each township has an owner and a force number. Clans (one or more led by humans, the rest by AI lords) take townships from each other. Against a nameless garrison a fight is a quick dice skirmish. Against a named captain it is a front: a short scene of maneuvers on a four-step ladder, a decision, and a tally. The world ticks hourly with three major ticks a day; a hidden Director paces what the world does to each player. Named characters carry traits, fears and histories that hidden-information rules resolve against.

## 2. World state [M0]

One plain JSON-serialisable object. The simulation is a pure function of it (D7): `step(state, orders, ticks) -> { state, events }`. No clocks, no DOM, no global randomness.

```
World {
  v: 1,                       // schema version
  seed, rng,                  // rng: the generator's current internal state (so the function stays pure)
  tick,                       // hours since the war began; hourOfDay = (startHour + tick) % 24
  towns:   { [townId]: Town },
  clans:   { [clanId]: Clan },
  chars:   { [charId]: Character },
  fronts:  { [frontId]: Front },
  raids:   [ Raid ],          // declared AI attacks, with their landing tick
  director:{ [playerClanId]: DirectorState },
  ledger:  [ Event ]          // append-only
}
Town      { id, owner: clanId|null, force: int, dugIn: bool, captain: charId|null }
Clan      { id, kind: 'goblin'|'rat'|..., lord: 'human'|'ai', home: townId, colour }
Character { id, name, clan, tier: 1|2|3, dynasty: int, homeTown,
            traits: [ {id, notable: bool} ], fears: [ {kind:'town'|'terrain', ref} ],
            injuries: [id], confidence: int (hidden), state: stateId|null,
            titles: [..], grudges: [charId], bonds: [charId],
            known: { [playerClanId]: [factId] },     // what each player has discovered about them
            status: 'active'|'captured'|'dead', heldBy: clanId|null, at: townId }
Front     { id, attacker: clanId, from: townId, target: townId, captain: charId (defender),
            lead: charId|null (attacker's captain), standing: 0..3, beat: int, log: [..], status }
Raid      { id, by: clanId, from: townId, target: townId, force: int, declaredAt, landsAt }
```

The static board is separate and read-only (section 3). Static content (trait definitions, name parts, state words) lives in content files (section 11), never in code.

## 3. The board [M0]

Built once by `tools/build_goblin_board.py` into `data/goblin-board.json` (D184 to D188) from `data/nj.topo.json`, `data/nj-geoms.json` and `data/nj-places.json`:

- `towns[id] = { name, type, county, pop, centroid, neighbours: [id] }` for all 564 townships. `id` is `"Name|County"` (names repeat across counties).
- `borders["a~b"] = { miles, river: name|null, ridge: name|null, highway: [names] }` for all 1,445 pairs. `highway` lists highways that pass through both towns.
- **River on a border, the rule (D187):** sample the shared boundary; the border is a river border when at least 25% of its points lie within 0.05 miles of a river line. Measure against the boundary line itself, never by points inside a town (the mistake in paper test 01, H42). The same test with ridges.
- The builder prints a spot-check table of 12 borders for a human to compare with a map. Known anchors: Paterson–Totowa is a Passaic border (about half its 1.5 miles); Paterson–Hawthorne is entirely the Passaic; Paterson–Haledon and Haledon–Totowa have no river; Clifton and Totowa do not touch.
- **Theatre [M0]:** the playable set is the home township plus everything within N border steps (D183, default 3, clamped to 12–60 townships).

## 4. Time [M0]

- **World clock (D82):** one tick is one hour. Major ticks at 09:00, 12:00 and 18:00 Eastern (exact times still open; these are the working values). No player moves it.
- **`step` processes whole ticks in order**, at most 72 per call (D168). Beyond that the world "settles": remaining ticks are skipped, not simulated.
- **Fronts run on player time (D142):** a front advances only when its player acts. A paused front pins the defending captain (D143): the AI may not move, attack with, or reassign a pinned captain or his township's force.
- **Conquest pace (new, D202):** within a sitting a player may attack as often as they like. The limits are the natural ones: attrition, the one unit that must stay behind, and that recruits arrive only at major ticks. Moving units between two of your own bordering townships is immediate. This is the Strategery feel the user asked for (D138, D144). Consequences, to confirm: the Advance button (D80, D83) and the foothold's diminishing returns (D95, D96) have no job left and are parked; travel time (D169) applies to AI raids and convoys only.

## 5. Skirmish [M0] (D145, D149)

Used when the target township has no active captain, and for every AI attack.

1. The attacker commits `n` units from one bordering township; at least 1 stays behind.
2. Rounds repeat while attackers > 1 and defenders > 0. Attacker rolls `min(3 + A, attackers − 1)` dice, defender `min(2 + D, defenders)`. Sort both descending and compare in pairs: higher attacker die kills a defender, otherwise an attacker dies (ties to the defender).
3. Modifiers: a captain leading the attack, `A = 1`. Defender dug in: defender's best die +1 each round (variant C). River or ridge border: the attacker's best die −1 each round **(new, part of D206; D149 said "one modifier" without defining it)**. A highway through both towns cancels the river penalty.
4. Win: the survivors (all but 1 left behind, already accounted) occupy the township; it changes owner; `dugIn = false`. Loss: the attack stops with 1 attacker left; survivors stay home.
5. Every round is an event, so the dice can be shown (pillar 12). Force counts are always visible; no probability is ever computed for display (D99).

## 6. Fronts [M0] (D147, D148, D150, D200)

A front opens when a player attacks a township whose captain is active. At most 3 per player (D134).

**Standing ladder:** 0 Behind, 1 Even, 2 Ahead, 3 Commanding. Start at Even; start Behind when the attack crosses a river or ridge border with no shared highway.

**Beats.** Each beat the player picks one maneuver. After beat 4 the next beat must be the decision (so a front is 2 to 5 beats, D142).

| Maneuver | Needs | Roll | Result |
|---|---|---|---|
| Probe | a captain or 3+ units | 2d6 + mods | 11+: up 2. 8–10: up 1. 5–7: no move, discover one hidden fact. 4−: down 1 |
| Pressure (taunt, feint, show of force) | same | 2d6 + mods | same bands |
| Lever | a discovered weakness (a trait or fear in `known`) | 2d6 + mods | 8+: up 2. 5–7: no move. 4−: down 1 |
| Certain move (goblin bridge) | started Behind because of a river | none | Behind to Even, once |
| Decision | always available | skirmish | see below |
| Disengage | always available | none | front closes as Withdrew (D133) |

**Modifiers to a maneuver roll (hidden-information style, D102):** +2 if the acting captain has a notable trait whose `suits` includes the maneuver; +1 for a minor one; +2 on a Lever (it uses a known weakness); then the defender's hidden traits add their `counters` value for that maneuver (typically −1 or +1). The sum is clamped to ±4. Any hidden trait that changed the result becomes discovered (the player learns why). Bands 5–7 on Probe always discover something if anything is left to find.

**Commanding (D148):** reaching 3 ends the front at once; the defender yields. Resolve the closeup (section 7), then capture the township with no losses.

**Decision:** a skirmish (section 5) with the attacker's chosen `n`, replacing the dug-in and geography modifiers by standing **(new, D206: in a front, the captain's defence stands in for fortification)**:

| Standing | Defender gets |
|---|---|
| Behind | best die +1 and one extra die |
| Even | best die +1 |
| Ahead | nothing |

The attacker's lead captain still gives `A = 1`. Win: capture, then the closeup. Loss: the front closes as Lost; the attacker keeps 1 unit at home; no land changes hands (D137).

**Tally (H44):** on close, emit one `front_closed` event carrying: verdict (Won, Lost, Withdrew, Yielded), township, units lost on each side, facts learned, characters changed or captured, and what is now exposed (own townships with force ≤ 1). A lost front always leaves at least one learned fact if any was undiscovered (D101a, D118).

**Options must not be dominated (D156).** The engine offers a maneuver only when it can be the best choice in some state; a UI or bot must never present a strictly worse variant of another option (the error in paper test 02, beat 1).

## 7. Characters [M0, reduced]

- **Tiers (D36):** tier 1 is the force number itself, nameless, no traits (D127). Tier 2 captains and tier 3 legends are `Character` records.
- **Traits (D125):** tier 2 has 4 traits of which 2 notable; tier 3 has 5 of which 3 notable. Trait definitions come from the content file, each with machine hooks:
  `{ id, word, placeholder: bool, suits: [maneuver], counters: { maneuver: int }, drive: 'stand'|'flee'|'grab'|null }`.
- **Discovery:** a player sees only `known[player]`. Tier and name are always visible.
- **Closeup (D103, D130, proposed rule):** fires when a defending captain's front is lost and two of his notable traits have opposing `drive`s. Roll 2d6: 6 or less he **breaks** (flees to a bordering friendly township, gains a fear of the lost township, takes a state word); 7–10 he **holds** and is **captured** (D201); 11+ he **persists** (escapes, and gains a new notable trait, replacing a minor one, D129). With no conflict he simply retreats if a friendly township borders, else is captured.
- **Injury and death (D34, D35):** after a lost decision the attacker's lead captain rolls 1d6: on 1, an injury; and on a second 1, death. Enemy captains use the same roll at 1–2 for injury. A dead tier 2+ may be succeeded by the next of the dynasty (`dynasty + 1`, inherits one grudge) at the next major tick (D33).
- **Promotion (D126):** when a force wins a skirmish it entered outnumbered, or ends a won decision with 3 or fewer left, one grunt is named: a new tier-2 captain whose first notable trait is chosen by the event (a tag on the event selects from traits with a matching `earnedBy`). Cap: `1 + floor(townships / 4)` captains per clan.
- **Later, not M0:** confidence and insults as a separate verb (D41–D46), bonds, titles, terrain mastery, rescue and ransom of captives (H51), the aftermath portrait.

## 8. The world's turn [M0]

At every **major tick**, in this order:

1. **Recruits (new, D203):** each clan gains `ceil(townships / 3)` units. AI clans and absent players place them on their weakest border township. A present human places them (default: same rule, one tap to accept).
2. **Dig in (new, D204):** a township whose force did not attack since the last major tick and has force ≥ 3 becomes `dugIn`. Attacking out of it clears the flag. (Later this costs Build.)
3. **AI clans act (new, D205).** For each AI clan, at most one action per major tick: find the bordering enemy township with the best ratio of own bordering force to its force. If the ratio is ≥ 2 and the target is another AI's, attack now by skirmish. If the target is a human's, **declare a raid** that lands no sooner than 6 ticks later; it is visible on the map with its landing time (D12, D65). On landing it resolves as a skirmish against whatever is there then. AI never attacks a pinned captain's township, an absent player's home, or a player in their first 3 days.
4. **The Director adjusts** (section 9), possibly cancelling or adding to step 3.

Hourly non-major ticks only land raids and (later) move convoys.

## 9. The Director [M0, reduced] (D163–D168)

Per human player:

- **Pressure score** = 2 × open fronts + 3 × raids declared against them + units lost in the last 24 ticks ÷ 5 + townships lost in the last 72 ticks × 4 − quiet (ticks since the last hostile event ÷ 12, max 3). Word: under 3 Calm, under 7 Steady, under 12 Heated, else Overwhelmed. Only the word is ever exposed.
- **Rhythm:** the 09:00 tick may open something (step 3 allowed to target the player); 12:00 is the peak slot (a raid may be declared or a rival captain moved to the player's border); 18:00 relaxes (no new hostile action against the player).
- **Bending:** Heated or Overwhelmed cancels hostile AI actions against that player this tick. Two consecutive Calm days allow one extra hostile action.
- **Budget per player per day:** 1 peak, 2 minor events. Unwarned losses belong to convoys and are not in M0.
- **Empty day (D166):** if a present player has no open front, no raid against them and no bordering enemy weaker than 2:1, the Director moves the nearest weak enemy garrison's reinforcement elsewhere or surfaces a skirmish chance, so there is always one thing to decide.
- **Not M0:** dwarves (needs the verified rock-town list, H50), the messenger, weather.

## 10. The Ledger [M0]

`ledger` is an append-only list of structured events: `{ tick, type, towns: [id], chars: [id], clans: [id], data }`. Types in M0: `skirmish_round`, `skirmish_result`, `front_opened`, `front_beat`, `front_closed`, `closeup`, `raid_declared`, `raid_landed`, `recruits`, `dug_in`, `promoted`, `injured`, `died`, `succeeded`, `captured`, `director_word`.

A separate renderer turns events into lines using templates from the content file. Templates are data, marked placeholder until the user writes them (D68, D194). Place descriptions in any line come from the board (direction, distance, river, highway), never from free text (H42).

## 11. Content files [M0]

`data/goblin-content.json`: clans (colour, name parts), traits, state words, verdict words, ledger templates. Every entry carries `placeholder: true` until the user replaces it. A check script lists remaining placeholders. Placeholder words must be plain and unfunny on purpose, so nobody mistakes them for finished writing.

## 12. Constants (all tunable)

| Name | Value | Source |
|---|---|---|
| attacker dice / defender dice | 3 / 2 | D149 |
| dug-in bonus | defender best die +1 | D149 variant C |
| river or ridge penalty | attacker best die −1 | D206 |
| captain lead | +1 attacker die | D149 (large; H48) |
| front beats before forced decision | 4 | D142 |
| max fronts per player | 3 | D134 |
| recruits per major tick | ceil(townships / 3) | D203 |
| dig-in threshold | force ≥ 3, one quiet major tick | D204 |
| AI attack ratio | 2.0 | D205 |
| raid warning | 6 ticks minimum | D205, D12 |
| new-player shield | 72 ticks | D165 |
| catch-up cap | 72 ticks | D168 |
| major ticks | 09, 12, 18 Eastern | D82 |
| theatre radius | 3 border steps, 12–60 towns | D183 |
| captain cap | 1 + floor(townships / 4) | new |

## 13. Later systems, with their one constraint each

- **Fog (D176, D182):** a pure function `fogLevel(townId, srs, played, shared)`. The simulation never reads quiz data; the UI filters what it shows. Known is box 1+.
- **Economy and convoys (D110–D117, D185):** Food, Build, Coin per clan; a convoy is `{from, to, route, departTick}` and its position is computed from the tick.
- **Quiz charge (D179):** UI-side; it passes `charge: true` on a maneuver order, worth +1 to the roll, at most one per beat.
- **Shared mode (D190):** the server runs `step` hourly; clients send orders. Nothing in `World` may assume a single player.
- **Dwarves, rogue, seasons, insults, captives' ransom:** not specified here yet.

## 14. Where this spec departs from, or fills, the log

1. **Foothold model (D95) is replaced** by "a won front or skirmish captures at once" (D140, still marked proposed, but D138 and paper test 02 both assume it).
2. **Advance (D80, D83) has no remaining job** under D202. Parked, not deleted.
3. **Travel time (D9, D169)** now applies to raids and convoys, not to a player's attack on a neighbour.
4. **D149 and D200 are still "proposed" in the log** although both tests and three decided entries rest on them. This spec treats them as the working rules.
5. **D178 and D176 carried the old Known threshold** (box 3); D182 changed it to box 1. The log is corrected.
6. **New working rules needing a yes:** D202 (conquest pace), D203 (recruits), D204 (dig in), D205 (AI behaviour and raid warnings), D206 (river penalty; standing replaces fortification in a front).
