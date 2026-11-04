# NJ Townfinder

A phone web app for learning New Jersey's 564 municipalities and Manhattan's neighborhoods, and for keeping your bearings while you drive.

**Two maps.** Switch between them in Settings → Map. When your GPS shows you've crossed into the other region's area, Drive offers a one-tap switch.
- **New Jersey:** 564 towns, grouped by county.
- **Manhattan:** 58 neighborhoods by the names people actually use, grouped Downtown (below 14th St), Midtown (14th–59th), Uptown (59th–110th) and Upper Manhattan.

The screen is built in two layers. The first is what you can take in at a glance while driving. Everything else is one tap away, so the screen never asks you to read a paragraph at 50 mph.

- **Drive**
  - *At a glance:* the town and county you're in, the village you're near ("near Towaco"), your heading with which way is left and right (*"Heading EAST · left N · right S"*), and the main road: *"On I-80 E"* or *"I-80 0.4 mi N · Route 46 1.1 mi S"*. Roads are named the way people say them: I-80, Route 46, Route 23, Route 1&9, the Turnpike, the Parkway.
  - *Tap the card for more:* which towns lie to your left, ahead and right; notes on the road you're on; your notes on the town.
  - *Voice:* speaks when you cross a town line (*"Entering Clifton, Passaic County. Heading west. Not Rockaway — that's 19 miles west-northwest."*). The first time you drive a road that has a note, it reads the note once.
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
- **Your notes**: add a note to any town or road, e.g. *"Use 23 instead of 287 at rush hour"*. Notes show up in Drive and Explore. They stay on your phone; Settings can export and import them as a file.
- **On the map**: river and lake names, and 31 landmarks (stadiums, malls, train stations, parks, colleges).

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
- **Neighborhood map:** OpenStreetMap's neighborhood boundaries, where the smaller, more specific name wins (Times Square over Midtown). Gaps are filled from NYC's official 2020 Neighborhood Tabulation Areas. Nolita isn't in the OpenStreetMap snapshot, so it falls under Little Italy. Rebuild with `python3 scripts/build-manhattan.py` (needs `pip install shapely`).
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

**Privacy.** Remembering where you've been (the towns you pass through and your drive routes) is **off by default**. Turn it on in Settings if you want trip recaps and the "towns I've been through" practice area. It stays on this phone, and "Forget where I've been" wipes it.

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
| `data/manhattan.topo.json` | 58 Manhattan neighborhoods in 4 areas |
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
