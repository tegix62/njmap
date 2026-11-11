# NJ Townfinder

A phone web app for learning New Jersey's 564 municipalities and Manhattan's neighborhoods, and for keeping your bearings while you drive.

**Two maps.** Switch between them in Settings → Map. When your GPS shows you've crossed into the other region's area, Drive offers a one-tap switch.
- **New Jersey:** 564 towns, grouped by county.
- **Manhattan:** 57 neighborhoods by the names people actually use, grouped Downtown (below 14th St), Midtown (14th–59th), Uptown (59th–110th) and Upper Manhattan.

The screen is built in two layers. The first is what you can take in at a glance while driving. Everything else is one tap away, so the screen never asks you to read a paragraph at 50 mph.

- **Drive**
  - *At a glance:* the town with its type and county in one line (*"Montville Twp (Morris)"*), the village you're near (*"near Lower Montville (village)"*: a named section inside the town), your heading, the road you're on (*"Heading NORTHEAST · on I-287 N"*), and which towns lie to your **left, ahead and right**, with distances. Roads are named the way people say them: I-80, Route 46, Route 23, Route 1&9, the Turnpike, the Parkway. County routes go by their street name (Columbia Turnpike, not "CR 510").
  - *Overview circle:* a small zoomed-out picture in the corner with your town, the towns around it and county lines, you in the middle. It turns with the map in heading-up and stays north-up in north-up mode.
  - *North line:* a thin red line from you to the N on the map edge, so north is one glance away while the map turns.
  - *Tap ▾ for more:* your places and the other main roads nearby, each said relative to you (*"Route 202 0.5 mi · on your right"*; compass directions in north-up mode).
  - *Voice:* speaks when you cross a town line (*"Entering Clifton, Passaic County. Heading west. Not Rockaway — that's 19 miles west-northwest."*). The first time you drive a road that has a note, it reads the note once. When you settle onto north, east, south or west it says so (*"Heading north."*), at most every 20 seconds; the in-between directions stay quiet.
  - *Quiz me while I drive* (Settings): every few minutes, one spoken question about where you are right now, using your real heading: "Paterson: left, right, ahead or behind?", "What's the next town ahead?", "Which county are you in?", "What road are you on, and which direction?", "You're near Towaco. What town is that part of?", or where Home is. A pause to answer in your head, then the answer. Nothing to tap. Town announcements wait until the answer is out. (Like everything here, it only runs while the app is on screen.)
  - *Guess first* (Settings): *"New town. Which one?"*, a 4-second pause, then the answer. The card shows "?" until then.
  - *Your places:* home, work, and so on, with distance and direction from you (*"Home 7.2 mi NW · behind-left"*).
  - *Trips:* each drive's route and the towns you passed are saved on your phone for a recap afterwards.
- **Heading-up or north-up**: tap the compass button. N/E/S/W markers stay on the edges of the map either way.
- **Explore**
  - *Villages:* opening a town's Villages tab labels every village it can place right on the map. Locations come from GeoNames, and are only used when they fall inside that town; others are looked up in the background map when you tap them.
  - *At a glance:* the card is short (name, county, distance), and the map does the rest: the selected town's neighbors are tinted and labeled, and everything else fades.
  - *One tap:* tabs for Borders (the neighbors as a list, with directions), Villages, Roads, Landmarks, My notes and Sound-alikes, one open at a time. Tapping a road highlights it on the map and lists where it **leads to** ("I-80 → Passaic (SE 1.9 mi), Little Falls (W 2.8 mi)…").
  - *★ My list:* star a town to learn it, e.g. when someone mentions they're from Harrison. Practice can then quiz only your list.
  - *Search:* finds towns, villages ("Towaco") and landmarks ("Willowbrook").
- **☀ Today** (Practice opens on it once a day until it's done): about 10 quick questions, roughly two minutes. Places due for review come first, then two or three new places, and each new place comes back three times from different angles (find it, its borders, left or right of somewhere), spread through the set. A place you're reviewing gets a different kind of question than last time. Dots show progress; the finish screen shows what you practiced and your streak of days.
- **Practice**: quiz types:
  - *Find it on the map*
  - *Name the highlighted town*
  - *Which direction is B from A?*
  - *Which of these borders Wayne?* (the wrong answers are nearby towns that don't touch it)
  - *⚡ Rapid round:* one-tap questions back to back against a shrinking timer bar, 3 lives, faster every round. A hit or miss just flashes, then the next question starts. It's built for speed: recall that's automatic rather than worked out. Misses go into review, and your best score is kept.
  - *🧩 Drop in:* a county with some towns cut out. Each missing town falls from the top as a piece shaped exactly like it, labeled with its name; drag it into its hole before it lands. Pieces fall faster as you go. It ties a place's name, shape and location together. Pick a county in the area menu, or let it choose one.
  - *🧭 Left, right & compass*: holding your body's left/right and the compass at the same time is a mental rotation, and it's hardest facing south, where everything mirrors. A few seconds per question: *"Facing south. Your left is…?"*, *"Facing east. Where is north?"*, *"Facing west, you turn right. Now you're facing…?"*. Answer on a compass or an ahead/left/right/behind pad; then the map turns to face that heading, so the N/E/S/W letters on its edges show the answer. It keeps your recent accuracy for each heading and serves more of your weak ones (in Manhattan, in grid words: uptown, downtown, east, west).
  - **Both drive games start with a briefing** and wait for you (no timer), two short lines: where you are (a famous spot if there is one, then the street and the next one, and which way you face) and where you're going (the place and its two streets, or just the two streets). Before you drive you **guess which way the destination is**: ahead, behind, left or right (near a diagonal either neighbour counts). The answer says where it really is (*"It's ahead and to your right: 0.8 mi uptown · 0.3 mi east"*); your guesses are kept as a running score. The destination's marker and any arrow stay hidden until you tap Go. **Guide** (Options) sets how much the game tells you while you drive: *words* (the default: how far uptown/downtown and east/west, no arrow), *arrow* (the pointer too), or *off* (nothing; **👁 Peek** shows it for 3 seconds, and the result counts your peeks).
  - *🚕 Drive Midtown (classic)*: the original game on a straightened grid of Midtown and the Upper East and West Sides (14th–110th St), every block's direction from the city's data (`js/midtowngrid.js`). Left/Right at the next corner, tap a corner to zip there, hold to speed up; starts from the tunnels, bridges and FDR exits that land on the grid. The default while the whole-island game below is being reworked.
  - *🚕 Drive Midtown (new)* is **plan, then ride**: the round opens straight on the plan screen (where you are, where you're going, and the top card's count to the destination; no separate briefing or guess in this style), and you plan the route with no clock. Tap the corner where you turn (a row of the avenues or streets coming up on your road), then the way you turn (Left, Straight, Right, or a named way at an odd junction). A ghost car hops to each corner and the route draws on the map. A wrong turn is refused with the reason and what to try instead (*"7th Ave runs downtown (avenues alternate). Try ▲ straight onto 23rd St"*), nothing is lost, and **Undo** and **Hint** are there; **Ride it** appears when the plan reaches the destination, and the car rides it at speed. Stars, the shortest-route comparison, saved trips and mistakes work as before; Options → *Play: free drive* gives the earlier real-time version (the default for Downtown, which can also be set to plan). The top card counts in the grid's own units instead of miles and compass points, *"4 streets uptown · 3 avenues west"*, updating as the plan moves (and the briefing's answer says it the same way). The rest of this game is the same as Drive Downtown below, on Midtown's streets: the same game as Drive Downtown below, everything in it, on Midtown's streets, 14th to 60th St (`tools/build_streets.py --midtown` → `data/midtown-streets.json`): the avenues and numbered streets, with the real exceptions, Broadway's diagonal, and starts from the Lincoln Tunnel (out on Dyer Ave), the Queens-Midtown Tunnel (E 37th St) and the Queensboro Bridge (E 60th St or 2nd Ave). Separate stars, trips, mistakes and coverage from Downtown's.
  - *🚕 Drive Downtown (new)*: every street below 14th St with its legal direction, from NYC's street centerline (NYC Open Data), built by `tools/build_streets.py --downtown` into `data/downtown-streets.json`. **Streets only**: no FDR, ramps, tunnels or bridges (tunnels by road type too, so the 1st Ave tunnel at the UN is out), and where the city's data has the same road twice side by side (a service lane, a duplicated roadbed), one button for it. A round from the **Holland Tunnel**, the Brooklyn-Battery Tunnel or the Brooklyn, Manhattan or Williamsburg Bridge starts where it comes out onto a street (*"From the Holland Tunnel → out on Beach St in Tribeca"*). The map is turned so the grid stands upright; downtown streets run at their real angles. Corners are real intersections: a divided road's two roadbeds, median crossings and short connector pieces are merged at build time, so the car only stops or turns where a driver sees a corner. The car drives at a steady rhythm, the classic game's (0.55 s a corner plus the block's length), with no speeding up or slowing down between corners. Speeds: **Relaxed** (the default: every block at least 2 s, time to decide at every corner), Easy (at least 1 s a block, as in the classic), Normal and Fast. At an ordinary corner, tap **Left** or **Right** before you get there (**Straight** when stopped). Where the ways out don't fit Left / Straight / Right (five-way junctions, forks, angled streets: about 1 in 25 corners) **the car stops and waits**: each way out is a button with its street name, an arrow at its real angle on screen, and where it heads (*"Kenmare St → SoHo"*). Tap a corner ahead to zip there; hold the map to speed up. Direction words are true where you are: uptown / downtown / east / west on roads lined up with the grid, the compass elsewhere. Wrong-way turns are refused with the reason. The build checks every corner (every way out has a button, no U-turns, every corner can reach every other) and refuses to write the data otherwise. The game is tested by a scripted player that only learns about a corner when the car starts the block before it, then reacts late. At Relaxed with a 1 s reaction it missed no corners in 12 rounds; at Easy it needs about 0.7 s (no misses at 0.7 s, many at 1 s, mostly where two turns come one short block apart); Fast is for routes you already know. **No surprises at corners:** the car never turns without you: where the road ends and the only way on is a turn, it stops (*"Road ends: only right ▶ onto Delancey St"*) unless you've already pressed that way. Left and Right only ever mean a real turn (55–125°); a shallow fork or a hairpin gets named buttons. The top card says where you are and what's coming: *"📍 Alphabet City · 5th St west · next Ave A ◀▶"* (the ways the next corner allows), and a queued turn says it's for that corner (*"◀ left there"*). **Getting around:** a row of the corners coming up on your road (*"Go to: Spring St · Prince St · Houston St…"*): tap one and the car drives straight there in about a second and stops, so a long run is one decision (which street to turn on) instead of a wait; **⏩ Hold: faster** speeds up while held. Driving controls act on touch-down, so a tap isn't lost when the panel redraws at a corner. **Replaying:** each round gets stars (★ there, ★★ the shortest way with no wrong-way tries, ★★★ that plus a right start guess and no peeks or arrow) with your best per route; **↻ Same route** replays it; **☆ Save trip** keeps it, and saved trips are mixed into later rounds (Options). Corners where you tried a wrong-way turn, or left the shortest way when it cost you, are remembered and come back as the start of a later round (*"↺ On the way: West St & Laight St, where you went wrong before"*), until you drive them right. **Stuck?** After 45 seconds of driving, or once you've gone well past the shortest distance, a **💡 Hint** button gives the next roads on the shortest way from where you are (*"5th St west → Ave A downtown → E Houston St west → 🏁"*); hints count against the third star, like peeks. **When the game stops you or says no, it says why and what to do:** where the road ends in a turn it says what the road carries on as that the game leaves out (*"30th St goes on as Lincoln Tunnel Entrance 10 Ave (not in this game): only ◀ left onto 10th Ave"*); a wrong-way refusal adds the first move of the shortest way (*"⛔ 1st Ave runs uptown. Try ◀ left onto 1st Ave"*); a stop's reason is never hidden by an older message; destinations are always a corner of two different streets; and the view holds a moment at the destination before zooming out. **Crossing a corner follows the road:** where one road ends and the next begins inside a big junction (bridge and tunnel approaches, divided avenues; up to 50 m across), the car follows the road pieces that join them and the game draws them, instead of cutting straight across blocks (362 crossings in Midtown and 618 in Downtown had a gap over 6 m; none are straight lines now). **⚑** on the bar marks a spot with one tap, without pausing; the end screen then offers to send everything you marked. **Reporting a problem:** every move in a round is logged (presses, taps, stops, the messages shown, hints), and the last 10 rounds are kept on the phone. **⚑** while driving (it pauses) or **📋 Round log** at the end opens a panel: add a note, then **Send to GitHub** opens a new issue on this repository with the report filled in (where you were, what the corner ahead allowed, the timeline in words, and the raw log to replay on the same street data), or **Copy** it. Options → an earlier round does the same for one of the last 10. Game moves only: no GPS. **Hard mode** (Options: Street names off): no street names on the map or in the top card, corners ahead shown as +1, +2…. **Nothing interrupts a round:** there are no spontaneous check-ins (the "which side is the Hudson?" and "what street are you on?" questions are gone). **Famous and need-to-know spots** (Penn Station, Grand Central, Times Square, the tunnels, PATH stations, the places the game sends you, about 20 to 25 per area) are labelled in passing with a small dot and an italic name that gives way to street names; they appear once the round is under way, not during a free-drive briefing, so they can't give the destination away. **Neighborhoods in passing:** the neighborhood you're in is outlined softly on the map (a thin line that scales with zoom and a light tint), and the outline pulses brighter for a moment when you cross into another one. Its name stays in view in a small teal tag just under the top card for as long as it's outlined (it pulses when you cross), including while you choose streets in the plan; the top card names it too. No pill, no questions. In the plan, the ghost car's jumps move the outline but don't count; the ride and free driving do. In the end ride the outline follows your car. The result lists the ones you drove through (*"🏘 Through: Murray Hill → Turtle Bay"*). **Coverage:** the blocks you've driven are kept, the result shows how much of downtown that is, and Options can draw them on the map. The whole-island version (`tools/build_streets.py` without `--downtown`) isn't offered: highway exits leave at angles too shallow to tell apart, are named by number rather than where they go, and come up while the car is moving fast.
  - *Left or right?* "You're in Clifton heading north. Is Paterson ahead, left, right or behind?" The map turns to your heading, which drills turning a compass direction into a turn.
  - *Point to the big places:* from a town, point the dial at Manhattan, Philadelphia, Atlantic City, Newark Airport or Trenton.
  - *Which way does the highway run?* Point the dial along it (either direction counts).
  - *Highway ends & crossings:* "Where does the Parkway end in the north?" "Where do the Parkway and the Turnpike meet?"
  - *Which road gets you there?* "From Wayne, which road gets you to Boonton?" Road numbers are hidden on the map until you answer; then the road is highlighted along with the towns it passes.
  - *Which town is this village in?*
  - *Where is this landmark?*
  - *Which is farther north / east?* Built from town pairs where the county is misleading: West Caldwell is north of Chester, even though Morris County as a whole sits north of Essex.
  - *Point to it:* from you, one of your places, or a town, drag a dial toward the target and see how many degrees off you were.
  - *My last drive:* a north-up replay of your route with the towns in order, then questions about it.
  - *Sound-alikes* (Clifton/Rockaway, Mahwah/Rahway/Matawan, Montclair/Montvale/Montville…)

  Practice starts with the **168 well-known towns**: those over 25,000 people, the county seats, towns with a landmark, your sound-alike pairs, and a hand-picked list of places people name all the time (Shore towns, Hoboken, Montclair, Red Bank, Harrison…), editable in `js/places/nj.js`. You can also limit questions to **My list**, all of NJ, a region, a county, towns near you, or towns you've been through. Review is spaced over days: a right answer pushes a town's next review out to 1, 3, 7, 16, then 35 days, and a miss brings it back within 10 minutes. Mixed mode never asks the same type of question twice in a row.
- **Highways have identities.** The seven big ones each keep one color everywhere in the app: on the map, in Drive's road line, on Explore's road chips, in quiz answers. The Turnpike is purple, the Parkway teal, I-80 amber, I-287 rust, I-78 olive, I-295 rose and the AC Expressway slate. These colors stay clear of the blue, green and red used for selections and answers. Explore → **Highways** lights one up across the state and shows a card: where it starts and ends, which way it runs, how its exits are numbered, and where it meets the others. The key fact for telling the two toll roads apart: **the Parkway and the Turnpike cross at Woodbridge, like an X.** North of there the Turnpike is the eastern one; south of there the Parkway takes the Shore.
- **Lakes & mountains**: 25 of them: lakes and reservoirs from Lake Hopatcong and Greenwood Lake to Round Valley and Union Lake, plus High Point, the Kittatinny Ridge, the Watchungs, the Ramapos, the Palisades, Schooley's and Sourland Mountains and more. They're marked on the map, listed in Explore with a short card each, and asked about in Practice: *point to it* from a town (dial), or *tap it on the map* (scored by distance, since lakes and ridges span several towns).
- **Your notes**: add a note to any town or road, e.g. *"Use 23 instead of 287 at rush hour"*. Notes show up in Explore, and Drive reads a road's note aloud the first time you drive it. They stay on your phone; Settings can export and import them as a file.
- **On the map**: river and lake names, and 31 landmarks (stadiums, malls, train stations, parks, colleges).



**Plan screen:** the corner chips list every corner you could turn at along the road (up to 40, nearest first, in one row you swipe along); before, a cap of nine could leave out the corner the shortest way needed (about 1 round in 6 in Midtown), so you had to pick a nearer one and ask again. In the plan the camera glides once to each place the ghost car jumps to, instead of restarting its ease every frame and trailing behind. Undo, Hint, ⚑ and ⋯ share one row, and the 📍 line shows only while you're choosing a corner (it repeated the question at a corner).

**End of a round:** one sequence, not two. In plan style the shortest way's car (green) rides out alongside yours (blue) during the ride itself, by the same distance, and the camera frames both, zooming out as they pull apart; when it ends, the label where the two ways parted (*"the shortest way went Park Ave"*) appears if yours was clearly longer. After a drive you made in real time, both ride out together right after you arrive, at the ride's fast pace (2 to 4.5 seconds). **▶ Watch again** replays it.


**Typing a report note:** the game's keys (space = pause, arrows = turn) are ignored while you type in a text box. Before, a space re-drew the panel under your fingers and the iPhone keyboard closed.

**Result screen:** short enough to fit above the tab bar: stars, the one-line summary, neighborhoods, a legend, a folded *Details* (the shortest route in words, blocks driven) and one row of buttons (Replay, Same, Save, Log).


**Plan chips:** six corners at most, not all of them: always the one the shortest way needs, up to two before it and a few past it (one of them close), mixed differently each time and fixed while the plan stays at that spot, so you can get one wrong and a replay isn't the same list. (In 20 bot rounds the needed corner was always offered.)

**End ride:** the two cars stay well inside the map (the camera zooms out as they pull apart, with margin), a street-name tag appears where each car turns onto a different street (blue: yours, green: the shortest), and **Options → Replay: quick / steady / slow** sets the pace (steady is the default; it also applies to the replay after a free drive).


**Pulling up at the curb:** every destination is one corner of its intersection (*Port Authority · 8th Ave & W 41st St · SW corner*), shown in the briefing and top card, and the pin sits on that corner. You finish by arriving with that corner on your right, as a driver would pull up to the curb: the corner can be just behind the intersection or just ahead of it, along either street that touches it. On a one-way street the left curb counts too (you can stop on either side there). Arriving the wrong way doesn't end the round: *"🏁 the southwest corner is on your left here. Go around and come in with it on your right"*, and you carry on round the block. In the plan, the 🏁 chip appears only at a corner you can finish at, the shortest-way comparison, hints and stars use the same rule, and the six chips always include the corner the shortest way needs. Landmarks use the corner they really occupy (Carnegie Hall: SE of 57th & 7th; Macy's: SW of 35th & Broadway; Bloomingdale's: NE of 59th & Lexington; and so on); places with no single corner (neighborhoods, tunnels, ferries) and plain street-corner rounds get any corner you can pull up to. Measured on random routes, the rule makes the shortest way longer on about 9% of Midtown and 23% of Downtown rounds (about 2 to 3% longer on average); every destination stays reachable.


**Where rounds start:** the ways you actually come in come up far more often: the **Lincoln Tunnel**, the **GWB** and the **Holland Tunnel** are five times as likely as the bridges and the Queens-Midtown Tunnel (in Midtown that's about 40% GWB, 36% Lincoln, 16% Queensboro, 8% Queens-Midtown among tunnel/bridge starts; in Downtown about half are the Holland Tunnel). The GWB is far uptown, off this map, so a GWB round starts on the northernmost southbound stretch of 12th Ave (*"From the GWB (down the West Side Highway)"*): the Henry Hudson Parkway comes down to the West Side Highway, which is an ordinary street grid by about 57th to 59th St. The other real way down from the GWB goes east to the FDR Drive (Google Maps' own routing, as seen on a phone, takes I-87 to I-278 over the Triborough/RFK Bridge and then the FDR south; Harlem River Drive is the other link) and is two more GWB starts. **"From the GWB (I-87, I-278, FDR exit 8)"** follows Google Maps' own route to the UN as read off a phone: the FDR's exit 8 ("toward I-495/Midtown Tun/E 34 St"), the FDR service road, a right onto E 38th St, a right onto 1st Ave, then straight up 1st Ave (about 740 m to the UN at 1st Ave & E 46th St). **"From the GWB (down the FDR, E 53rd St exit)"** is the other, on E 53rd St at Sutton Pl heading west: the FDR's southbound exit 11 (the exit list calls it a southbound exit only), and the city's ramp data ends it there. It comes up less often than the West Side start. The FDR's other southbound exits are at E 63rd (outside this map), 49th and 34th St (their ramps land on spur streets this map leaves out) and 23rd/20th St; there is no southbound exit at 42nd. The Holland Tunnel is in the Downtown game and the Lincoln Tunnel and GWB in Midtown. A round almost never ends at the crossing it started from (out of the Lincoln Tunnel, back to the Lincoln Tunnel): about 1 in 20 of the rounds that start at a crossing the map has a destination for, the rest skip it.


**Tunnel destinations are the real entrance ramps** (not a corner you pull up to). The **Lincoln Tunnel entrance** ends when you take one of the car entrances from the street grid, as named in the city's street data and the Port Authority's description of the Expressway: the **30th St / 10th Ave ramp**, the **W 33rd St ramp**, **Dyer Ave** northbound (34th to 36th St), and the **9th Ave southbound ramp at 36th St**. The **Holland Tunnel entrance** ends at the end of **Watts St**. The top card says how to get in. **Overnight detour (Lincoln):** the Port Authority is closing the Lincoln Tunnel Expressway 11 pm to 5 am on Tuesday, Wednesday and Thursday nights for the Dyer Avenue deckover work (advisory "Phase 1A (Dyer Deck Overs)"), with 9th Ave's entrance ramps closed, and sends New Jersey-bound traffic north on 10th or 11th Ave to **Galvin Plaza** (W 40th St). During those hours the game uses that as the only way in (*"overnight detour: north on 10th or 11th Ave to Galvin Plaza"*). **Options → Lincoln detour:** *auto* follows the clock in New York until `DETOUR_THROUGH` (2027-02-28 in `js/gridgame.js`, an assumption: the advisory gave about 120 days from April 22, 2026 and closures were still being announced in late September; the real end date is unconfirmed), *always on*, or *off*. The map can't show police-directed approaches or one-off closures; check the Port Authority's weekly travel advisory before relying on any of this in a real car.


**Fewer repeats and clearer corners:** a new round never goes to the same place as the round before it. Where two streets cross at one corner (5th Ave and Broadway at 23rd St), the chip and the top card name both (*"5th Ave / Broadway"*), so a chip never names one street for a corner you'd reach by the other.


**Reports carry what you saw:** a ⚑ mark or *Something's off* taken while planning now records where the ghost car was (the corner and the plan step), not where the real car started, and keeps the words on screen at that moment (the top card and panel), the chips, turn buttons and picks you were shown, and the target with its corner or ramp. The issue text lists the last four marked screens, so a bug can be reconstructed without the game still being open.


**Gaps in the city's street data:** the centerline data sometimes breaks a block a few metres short of its other half (W 53rd St between 5th and 6th Ave stopped 10 m short, so the block fell out of the network and you couldn't go straight across 5th Ave towards MoMA). The builder now joins two dangling ends of the same street that lie within 16 m of each other, point the same way and carry traffic the same way (5 joins in each area). Because the data changed, progress saved against the old street map (saved trips, stars, marked mistakes, driven blocks) starts fresh.


**Landmarks are pinned to the corner you'd really pull up at** (`CORNERS` in `tools/build_streets.py`): each named destination is a two-street intersection and the corner of it the place occupies, checked against NYC's building points. Corrected this round: the **UN** was a bare node on 1st Ave (it's now 1st Ave & E 46th St, the visitors' entrance, east of the avenue), **MoMA** was one corner too far west and on the wrong side (it's now 5th Ave & W 53rd St, northwest corner, where 11 W 53rd St is), **Chelsea Market** was a bare node (now 9th Ave & W 16th St, southwest), **Hudson Yards** was a bare node (now 10th Ave & W 33rd St), and the **Stock Exchange** is now at Wall & Broad. The Brooklyn Bridge (Manhattan end) is no longer a destination (entering a bridge isn't arriving at a corner), and places the street data doesn't reach (Chelsea Market and the UN in Downtown) are dropped from that area. Because the street data changed again, progress saved against the old map starts fresh.


**Landmark callouts ("by the way"):** about 45 famous buildings and places worth knowing in Midtown and Downtown (the Chrysler Building, Empire State Building, Grand Central, the New York Public Library and Bryant Park, Rockefeller Center, Radio City, St. Patrick's, Times Square, Penn Station and Madison Square Garden, the Flatiron Building, the UN, One World Trade Center, the Woolworth Building, City Hall, the Stock Exchange, Trinity Church, Washington Square Arch and more; `data/landmarks.json`, built by `tools/build_landmarks.py` from NYC's building points) are named for a few seconds, once per round, when you come within a block: *"Chrysler Building on your right: Art Deco spire, Lexington Ave & 42nd St"*. One at a time, at least 5 seconds apart, never one that's already behind you, and a plan's ghost car and the ride each get theirs. The result lists the ones you really drove past (*"🏛 Passed: Bryant Park · Carnegie Hall"*) and the ones by your destination (*"📍 By your destination: Charging Bull"*). **Options → More options → Landmark callouts** turns them off.


**Park Ave Viaduct:** the elevated Park Ave round Grand Central (from the ramp at 40th St to 46th St) is now a street the game uses; it was left out with other viaducts, so you couldn't go straight up Park Ave past 41st. At Park Ave & 40th heading uptown there are now three buttons: Park Ave (the ground-level block that ends at 41st), **Park Ave Viaduct** (the ramp up, which carries on up Park Ave past the terminal), and 40th St. The street data changed, so progress saved for Midtown starts fresh. `docs/real-world-checks.md` lists the finishes and entries that need a real-world check. The ramp and viaduct are tinted tan with a brown edge so they read as raised over the cross streets, and the bend where the ramp meets the viaduct is no longer offered as a left or right (it is the same road).

**Button feel:** every button presses in to 94% and springs back (`js/motion.js`, spring stiffness 1019, damping 42: the feel lab's "snappy" spring made 40% faster). It uses the `scale` property so it can't clash with a button's own transform, a quick tap still shows its press (70 ms minimum), and it's skipped under reduced-motion. Further feedback (wrong-turn shake, star landings, panel curves) is still being chosen.

## Getting around the app

- **First launch:** before anything else you pick **New Jersey** or **New York City** (remembered). The tab bar's **⇄ NJ / NYC** button switches maps from any screen, and Settings has the same switch at the top. The page title follows the map.
- **Practice** shows what you're practicing on one button; tapping it opens a grouped picker (*Start here*, *Games*, *Driving practice*, *Quizzes*) with a line on each, and your recent picks on top.
- **Settings** keeps the three everyday switches (speak when I cross into a new town, north-up, remember where I've been) in view and folds the rest into *More voice*, *More driving*, *My places*, *Look & map* and *Data & privacy*.
- **Drive games** show Pause, Hold and (when needed) Hint or Peek; **⋯** holds *Something's off* and *Options*, and the less-used options sit under *More options*.

## Manhattan mode

- **Directions the way New Yorkers give them.** The street grid is turned about 29° clockwise from true north. Drive says *"Heading UPTOWN (NNE) · left West Side · right East Side"*, and announcements say "heading uptown".
- **Your corner:** *"near 9th Ave & W 40th St"*, read from street names in the map data. GPS bounces off Midtown's tall buildings, so expect it to wobble a block or two there.
- **The three crossings:**

  | Crossing | Comes out | So it's for |
  | --- | --- | --- |
  | GWB | Washington Heights, ~178th St | Uptown |
  | Lincoln Tunnel | Hell's Kitchen / Hudson Yards, ~39th–42nd St | Midtown |
  | Holland Tunnel | Canal & Varick, between SoHo and Tribeca | Downtown |

  The landmarks also include Penn Station, Port Authority, Grand Central, and the PATH stops at 33rd, 23rd, 14th, 9th, Christopher and WTC.
- **Practice adds:**
  - *Which way does 7th Ave run?* (uptown / downtown / both ways)
  - *Which crossing lands closest to SoHo?* (only asked when one clearly does)
  - *Point uptown* (the 29° tilt)
  - *Which is farther uptown?*
  - Sound-alikes: SoHo/NoHo/NoMad/Tribeca, Hudson Yards/Hudson Square/Hudson Heights, the Hills, the Heights, Kips Bay/Turtle Bay…
- **Neighborhood map:** OpenStreetMap's neighborhood boundaries, where the smaller, more specific name wins (Times Square over Midtown). Gaps are filled from NYC's official 2020 Neighborhood Tabulation Areas, and everything is clipped to the **real shoreline** (NYC's shoreline-clipped areas, so no neighborhood reaches out over the rivers or the harbor; Highbridge Park, a thin strip, now belongs to its neighbors). Nolita isn't in the OpenStreetMap snapshot, so it falls under Little Italy. Rebuild with `python3 scripts/build-manhattan.py` (needs `pip install shapely`).
- **Debatable answers stay out of quizzes.** Some landmarks sit where people disagree on the neighborhood, like Penn Station (Chelsea? Midtown? the Garment District?). Those are shown on the map but never asked as "which neighborhood?".

Everything Manhattan-specific lives in `js/places/manhattan.js`: crossings, avenue directions, landmarks, road notes (FDR Drive, West Side Highway / Henry Hudson Parkway, Harlem River Drive…) and sound-alikes. New Jersey's equivalent is `js/places/nj.js`.

## Design notes

**Color is reserved for meaning.** Large areas stay near-neutral, and saturated color only appears on small things that carry a message (Eduard Imhof's rule, as discussed by Edward Tufte in *Envisioning Information*):
- **Amber:** you, and the town you're in
- **Blue:** what you selected or are being asked about, and water
- **Green / red:** right / wrong answers
- **One warm tan:** highways, which get more important by getting wider, not by changing color

Every color lives in `js/theme.js`, so trying another scheme is a change to that one file.

**Four zoom levels, each adding one kind of thing.** These loosely follow Kevin Lynch's elements of a mental map in *The Image of the City*: paths, edges, districts, nodes and landmarks.

| Level | What appears |
| --- | --- |
| Whole state | North / Central / South Jersey, interstates, the Turnpike and the Parkway |
| One step in | The 21 counties |
| Region | The largest and best-known towns, all main highways, landmark dots, big rivers |
| Town | Every town, secondary roads, lakes, landmark names |
| Street | Villages and sections, local roads, street names |

The level breakpoints are in `js/style.js`.

**Practice follows learning research:**
- Being quizzed beats re-reading (Roediger & Karpicke, 2006), and reviews spread over days beat cramming (Cepeda et al., 2006).
- Mixing similar items helps you tell them apart (Kornell & Bjork, 2008).
- People misjudge where places are based on the larger region they belong to (Stevens & Coupe, 1978).
- Spatial skills improve with practice and feedback (Uttal et al., 2013).
- People organize what they know about a place around a few personal anchor points (Couclelis et al., 1987).
- Following GPS directions passively weakens spatial learning (Ishikawa et al., 2008; Dahmani & Bohbot, 2020). Hence *guess first*.
- A heading-up map helps you decide turns, while north-up helps you understand the area (Aretz & Wickens, 1992). Hence heading-up while driving, and north-up for Explore, Practice and the trip recap.

**Ink look (the default).** Paper and ink, plus three colors that each have one job: **blue** for you, what's selected and what a question is about; **green** for right; **red** for wrong. As you practice, each town fills in with ink, so the map becomes a picture of what you *know* rather than where you've *been*. The classic softer county colors are in Settings → Look.

**Tapping a town in Explore** frames it with all of its neighbors, but only when they aren't already comfortably on screen, so free looking around isn't interrupted.

**Privacy.** Remembering where you've been (the towns you pass through and your drive routes) is **off by default**. Turn it on in Settings if you want trip recaps and the "towns I've been through" practice area. It stays on this phone, and "Forget where I've been" wipes it. While it's off, nothing about your travel is kept: anything saved earlier (including by older versions of the app, which saved towns without asking) is erased on the next launch, and the list of road notes already read aloud is kept only until you close the app. The app reads your location only between Start and Stop in Drive. The map tiles it downloads (from OpenFreeMap) do reveal which area is on screen, as with any online map.

**Limitation:** a web page can't run in the background on a phone. When Google Maps is in front, Townfinder goes quiet. A native app would fix that, but building one needs a Mac, or a paid Apple developer account plus a cloud build service.

Everything runs on your phone: no account, no tracking, and nothing is sent anywhere. Once it has loaded, it works with no signal. Only the background street map needs a connection; set the background to *None* and nothing goes over the network.

## Put it on your phone

The site is static, so any HTTPS host works. GitHub Pages is the simplest:

1. On GitHub, open the repo → **Settings → Pages**.
2. Under *Build and deployment*, set **Source: Deploy from a branch**. Pick the branch and `/ (root)`, then save.
3. After a minute it's live at `https://<your-user>.github.io/njmap/`.
4. Open that on your phone and add it to your home screen (iPhone: Share → *Add to Home Screen*; Android: ⋮ → *Add to Home screen* / *Install app*). Allow location when it asks.

Location only works over HTTPS (or on `localhost`). To try it on a computer, run `python3 -m http.server` in this folder and open <http://localhost:8000>.

### Using it in the car

- Mount the phone and tap **Start** once. The screen stays awake while you're tracking (turn this off in Settings).
- Heading comes from GPS while you're moving, so it's accurate. When you're stopped it falls back to the phone's compass, which is less reliable near a car's metal and electronics.
- *Ahead / Left / Right* are measured in a straight line from where you are, not along the road. Take them as "what's over there", not as directions.
- The voice works alongside Google Maps or Waze, so you can keep your normal navigation app on screen and still hear town changes.

## Make it yours

- **Road notes and landmarks**: edit `js/knowledge.js`. The road notes there are drafts: short, factual summaries of where each major road goes. Correct them, or add your own from inside the app. Every landmark records which town it's in, and the test checks that against the boundary data.
- **Your own confusable pairs**: edit `js/confusables.js`. Each group is a list of names, with an optional `note` that shows after a practice answer. The voice uses these groups to say "Not X — that's N miles <direction>".
- **Rebuilding the boundary data**: run `scripts/build-data.sh` (needs Node). It downloads the NJ Office of GIS *Municipal Boundaries of NJ* layer, folds Pine Valley into Pine Hill (the two merged in 2022), simplifies the edges to a 10 m tolerance, and writes `data/nj.topo.json`. The simplified shapes put a random point in the same town as the full-resolution data 99.98% of the time; the rare misses all fall within about 10 m of a border.

- **Rebuilding the village/section list**: run `python3 scripts/build-sections.py`. It writes `data/sections.json`, which records which municipality each of about 2,700 local place names belongs to. Places are only drawn on the map, and only named in the Drive readout, where an OpenStreetMap point with that name falls inside that same municipality. So a village only appears where both sources agree.

## Files

| Path | What |
| --- | --- |
| `index.html`, `css/app.css` | Page and styles |
| `js/app.js` | Map setup, layers, mode switching, settings |
| `js/drive.js` | GPS tracking, heading, look-ahead, voice, wake lock |
| `js/explore.js` | Tap/search a town, neighbors with directions |
| `js/practice.js` | Quiz engine |
| `js/confusables.js` | Sound-alike groups and memory notes |
| `js/knowledge.js` | Draft road notes and landmarks |
| `js/roads.js` | Reads major roads from the map tiles: nearest road, roads through a town |
| `js/notes.js` | Your notes (on-device, export/import) |
| `js/theme.js` | Every color |
| `js/style.js` | Map layers and zoom levels |
| `js/anchors.js` | Your places |
| `js/regions.js` | North / Central / South Jersey by county |
| `js/region.js`, `js/places/*.js` | The active map and each region's settings, words and knowledge |
| `js/grid.js` | Manhattan grid directions and nearest intersection |
| `data/manhattan.topo.json` | 57 Manhattan neighborhoods in 4 areas |
| `js/geo.js` | Distance, bearing, point-in-polygon |
| `data/nj.topo.json` | 564 municipalities + 21 counties (TopoJSON) |
| `data/sections.json` | Villages, sections and local names, by municipality |
| `lib/`, `fonts/` | Bundled MapLibre GL 5.6, topojson-client 3.1, Noto Sans label glyphs |
| `sw.js` | Offline cache |

## Credits

- Municipal boundaries: [NJ Office of GIS](https://njogis-newjersey.opendata.arcgis.com/datasets/municipal-boundaries-of-nj-hosted-3857), via the [`@njam-data/new-jersey-municipalities`](https://www.npmjs.com/package/@njam-data/new-jersey-municipalities) package. Population figures are from the 2010 Census.
- Village and section names: the NJ local place-name list from [HackJersey/garden-style](https://github.com/HackJersey/garden-style) (MIT). Post office names from the [`zipcodes`](https://www.npmjs.com/package/zipcodes) package (BSD) and [GeoNames](https://www.geonames.org/) (CC-BY 4.0), via [`cities.json`](https://www.npmjs.com/package/cities.json), decide which names count as well known.
- Manhattan neighborhoods: © OpenStreetMap contributors (ODbL), via an Overpass snapshot from January 2019, with gaps filled from NYC Department of City Planning's 2020 Neighborhood Tabulation Areas (public domain).
- Background map: © OpenStreetMap contributors, via [OpenFreeMap](https://openfreemap.org/) (free, no API key).
- [MapLibre GL JS](https://maplibre.org/) (BSD-3), [topojson-client](https://github.com/topojson/topojson-client) (ISC), Noto Sans (SIL OFL). Their licenses are in `lib/` and `fonts/`.

**Where am I?** A small magnifier button, top right of the map during a round in either Drive game. Tap it to pull back to all of Manhattan (you, the red destination dot and the neighborhoods); tap again to return to the drive. The round carries on while you look; map taps are ignored in the wide view.
