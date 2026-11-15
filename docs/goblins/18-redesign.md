# 18. Redesign: from a ledger to a cast

Written 2026-11-15 after the user played the finished plan and called it "a very boring game ... I will likely never use it in this state." This document says why, and what changes. It supersedes the *order and emphasis* of `13-finish-plan.md`; the simulation built under that plan stays.

## 1. The verdict, in the user's words

Could not read the numbers (stacked on township names). Hard to scroll. Could not tell how many actions there were or what they did; "I ended up just spamming every option." No idea what the currency is or when it comes in. Never got to confront a captain ("that should come in about 3 minutes"). Too much text, "a statistical land shift ... the rats took this town." "I have no interest in what other factions are doing. I have no interest in what my faction is doing. I don't even know my guys. I don't know why they're there." None of the "high chaos" of a Tecmo game: "it's all just numbers being rolled quietly."

## 2. Diagnosis: what the build lost

Paper test 02 "felt great". It had five things. The build kept the rules of all five and the *experience* of none:

| What the paper test had | What the build did with it |
|---|---|
| **One enemy with a face.** Captain V, greedy and vain, sitting in Totowa | Captains are a ★ and a name on a card you must go looking for. The first one is met by accident, if ever |
| **A gamble the player authored** ("cross the river, as a gamble") | Eleven verbs offered at once, each a button with a cost. Nothing is a gamble because nothing is understood |
| **A narrator.** I told it as a scene, a line at a time | A log of templated sentences about every clan's every move |
| **Your own guy mattered** (Moss probes at night; Flint leads the charge) | Your captains are never introduced. They lead automatically. You never choose one |
| **An ending you could feel** (V captured; Haledon left empty) | A tally paragraph, then back to a map of numbers |

Against our own pillars: the two-minute door (9) opens onto a dashboard; "detail below the surface" (10) is inverted, with every system on the surface on day one; "chance is theatre" (12) became arithmetic shown politely. And D153, which this project adopted from the FTL and Into the Breach designers, said exactly what went wrong: *each piece must be fun alone before the next is added; beware a strategy layer whose parts only come together late.* Nine systems were added in a day and none was played before the next. That was the mistake, and it was a process mistake before it was a design one.

**The structural error:** the build made the *map* the game and characters a feature of it. The paper test was the reverse: the *confrontation* was the game and the map was where it happened. Tecmo's energy comes from the same place: you pick a play, then you watch a short, loud scene. The map of the league is a menu.

## 3. The new core: you run a crew, and the game is their confrontations

**One sentence:** you are the boss of a small crew of named goblins, the rival captains are a small cast who remember you, and the game is a string of short, loud scenes between them, staged on the real map.

Three rules follow, and everything else bends to them:

1. **Your captains are your actions.** No action points. Each of your captains can do one thing per window (the windows are the 09:00, 12:00 and 18:00 ticks we already have). "What can I do?" becomes "who do I send?", which also answers "I don't even know my guys": you learn them because they are how you act.
2. **Every scene has a face on each side.** A fight against a nameless garrison is a three-second scuffle shown on the map. Anything longer is your captain against theirs, in a full-screen scene.
3. **The news is about people.** At most three moments on opening, each about someone with a face: yours, or a rival who has a history with you. Land changing hands between two rival clans is never news.

## 4. The first three minutes, beat by beat

| Time | What happens | What is on screen |
|---|---|---|
| 0:00 | The messenger bursts in: a rival captain is on your border, mocking you | The messenger's face, one line, the rival's portrait and name. One button: "Who do we send?" |
| 0:15 | **Meet your crew.** Three goblins, each a portrait, a name, one trait word and one line on why they follow you | Three cards. Tap one |
| 0:35 | The scene opens: your captain on the left, theirs on the right, the township's name and how it lies (from map data) in a single line | Two portraits, a four-step standing bar, three big buttons |
| 0:40 to 2:20 | Three or four beats. Each press: the dice tumble, the portraits react (flinch, grin, shake), a bark of eight words or fewer, the bar moves. On a middling roll you learn one thing about the rival, shown as a word stamped on their portrait | Nothing else. No resources, no map |
| 2:20 | The decision: a burst of dice, the unit counts drop in front of you, the screen shakes on each loss | Dice, two numbers, shake |
| 2:50 | The ending is about the rival: captured (their face behind bars, yours grinning), or fled with a grudge ("he'll be back"), or you were thrown out and *your* captain comes home with a scar you can see | One portrait moment, one line |
| 3:00 | The map, briefly: one township changed colour. The messenger: "Come back at noon." | The map with faces on it, one button |

The first confrontation is at 0:35, not "about three minutes". Everything in that table already exists in the simulation (fronts, traits, discovery, injuries, closeup, portraits, the messenger). What does not exist is the scene.

## 5. What is cut or hidden, and how each earns its way back

Nothing is deleted from the simulation. It is switched off or made automatic on screen, and returns only after the user has played the stage before it and asked for more.

| System | First experience | Earns its way back when |
|---|---|---|
| Action points | **Gone.** Replaced by "each captain acts once a window" | Never, unless the crew rule fails in play |
| Food, Build, Coin | **Hidden and automatic.** The clan feeds itself; nothing is spent by hand | The user says the war lacks a reason to choose between two things. Then as *one* number ("Supplies") before three |
| Convoys, ambushes, guard, raid | Off | A rival character can be the one who robs you: then it is a scene with a face, not a system |
| Foothold run, parley, duel, insult, taunt, scout as separate buttons | Folded into the scene: they are *moves inside a confrontation*, not menu items on a township card | Individually, when a scene needs a new move |
| Fog of war and the quiz charge | Fog stays as a visual (grey where you have not learned the map); nothing explains it on day one. The charge is off | Week two: "you do not know this town; learn it and your captain gets a good look" is one sentence, shown when it first matters |
| Seasons, region rules, clan-kind rules | Running, never mentioned | Each gets one line the first time it changes a scene |
| Dwarves | Off in the first chapter | As a character: a dwarf with a face who turns up |
| The Ledger | Kept as a log, off the main bar | It is the record, not the news |
| The war goal | Kept, said in one line once | Already earned |

## 6. Energy: what a phone web page can do cheaply

In order of impact per hour of work. None needs art files or a render loop.

1. **A full-screen scene** instead of a bottom sheet. The single biggest change: the game stops looking like a form.
2. **Portraits that react**: the existing code-drawn faces swap expression on each beat (steady, grim, shaken exist already), and shake or lurch with a CSS animation.
3. **Screen shake and flash** on losses and wins (a 200 ms CSS transform on the scene).
4. **Dice that land hard**: larger, tumbling in sequence, the winning die growing, the losing one dropping away.
5. **Numbers that pop**: unit counts tick down visibly, "-2" floats up and fades.
6. **Sound from the Web Audio API**: synthesised thumps, a rising blip for a win, a low buzz for a loss. No files. A mute switch. (iOS needs a first tap to start audio: the "Who do we send?" tap is it.)
7. **The messenger speaks**: the app already has a voice picker; barks of a few words through text-to-speech, off by default.
8. **Vibration** where the phone allows it (Android; iOS web does not).
9. **Text in bursts**: eight words or fewer per beat, one line at a time, tap to skip.

## 7. The map: a stage, not a spreadsheet

- **Faces on the map.** Each captain is a small portrait pin on their township: yours ringed in your colour, rivals in theirs. The map shows *who is where*; that is what the player needs.
- **Numbers step back.** Force is a small badge shown only when zoomed in, or on tap. Names and numbers never share a line.
- **One thing asks for you.** A single pulsing marker on the township where something wants a decision. Tapping it opens the scene.
- **Movement is constrained.** The view fits your theatre; a "next" button hops between the places that matter. Free panning stays, but the player should never *need* to scroll.
- **The top of the screen is one line**: the day and time, and when the next window opens. Everything else is behind a tap.

## 8. The news: three moments about people

On opening: at most three cards, each a portrait and one sentence, in this priority: something done *to* one of your captains; something a rival *who has met you* did; a window opening on a confrontation. Examples of shape (the words are the user's to write): "[Rival], who you threw out of Totowa, has taken it back." "[Your captain] came home with a limp." Events between two rival clans, recruits, digging in, convoys, seasons: never news. They stay in the Ledger.

Rivals need memory for this to work, and they have it: grudges, bonds, confidence, injuries and dynasties are all in the simulation. A **nemesis** is simply the rival captain with the most history with you; the news leads with them.

## 9. The plan, in stages that each end with the user playing

| Stage | What | The check |
|---|---|---|
| **R0** | **Paper-test the first three minutes** in chat, as we did test 02, with the crew rule and a nemesis. Ten minutes | The user says it has the feel, or says what is missing. Nothing in R2 onward is built before this |
| **R1** (patched now, see below) | Stop the bleeding on the current screen: faces on the map, numbers off the names, a one-line header, three news items about you, and a confrontation offered in the first minute | The user opens it and sees characters before numbers |
| **R2** | **The scene**: full screen, two portraits, the standing bar, big moves, dice that land, shake, sound. Built over the existing front rules. The first three minutes of section 4 | The user plays one confrontation and wants a second |
| **R3** | **The crew**: three named captains at the start with a line each; captains as actions (one per window); you pick who goes; action points removed | The user can name their captains without looking |
| **R4** | **Nemeses and the news**: rivals with history lead the opening; three moments; the Ledger off the bar | The user cares what one rival does |
| **R5** | **The map as a stage**: the pulsing "wants you" marker, "next" hopping, constrained view | The user never has to scroll to find what to do |
| **R6** | Bring systems back **one at a time**, each only after the user asks for more: Supplies, then fog explained, then a robbing rival, then the dwarf | Each is played alone before the next |

The process rule this time, without exception: **one stage, then the user plays it, then the next.** The last plan's gates were written down and then walked past nine times in a row.

## 10. What stays true

The pure simulation and its tests. Real New Jersey geography, computed and never recalled. No percentages. The user writes the comedy; everything else is a flagged placeholder. A loss is framed. The quiz is a help and never a gate.

## 11. What was patched alongside this document (R1)

See the commit that carries this file. In short: captain portrait pins on the map; force as a separate badge that never shares a line with a name, and names only when zoomed in; the header cut to two lines; the news cut to three items that involve you; the first-move result leads straight to a named rival and a confrontation; and the action economy explained in one line where it is spent. These are patches on the old screen, not the redesign. The redesign is R2 onward.
