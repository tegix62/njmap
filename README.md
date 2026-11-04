# NJ Townfinder

A phone web app for learning New Jersey's 564 municipalities and keeping your bearings while you drive.

The screen is built in two layers. The first is what you can take in at a glance while driving. Everything else is one tap away, so the screen never asks you to read a paragraph at 50 mph.

- **Drive**
  - *At a glance:* the town and county you're in, the village you're near ("near Towaco"), your heading with which way is left and right (*"Heading EAST · left N · right S"*), and the main road: *"On I-80 E"* or *"I-80 0.4 mi N · US 46 1.1 mi S"*.
  - *Tap the card for more:* which towns lie to your left, ahead and right; notes on the road you're on; your notes on the town.
  - *Voice:* speaks when you cross a town line (*"Entering Clifton, Passaic County. Heading west. Not Rockaway — that's 19 miles west-northwest."*). The first time you drive a road that has a note, it reads the note once.
- **Heading-up or north-up**: tap the compass button. N/E/S/W markers stay on the edges of the map either way.
- **Explore**
  - *At a glance:* a neighbor compass, a 3×3 grid with the town in the middle and each bordering town placed in its direction. The map tints those neighbors and fades every other label.
  - *One tap:* tabs for Villages, Roads (tap one to highlight it on the map), Landmarks, My notes, and Sound-alikes. One opens at a time.
  - *Search:* finds towns, villages ("Towaco") and landmarks ("Willowbrook").
- **Practice**: quiz types:
  - *Find it on the map*
  - *Name the highlighted town*
  - *Which direction is B from A?*
  - *Which of these borders Wayne?* (the wrong answers are nearby towns that don't touch it)
  - *Which town is this village in?*
  - *Where is this landmark?*
  - *Sound-alikes* (Clifton/Rockaway, Mahwah/Rahway/Matawan, Montclair/Montvale/Montville…)

  Limit questions to a county, a region, towns within 15 miles of you, or **towns you've actually driven through**. Towns you miss come up more often.
- **Your notes**: add a note to any town or road, e.g. *"Use 23 instead of 287 at rush hour"*. Notes show up in Drive and Explore. They stay on your phone; Settings can export and import them as a file.
- **On the map**: river and lake names, and 31 landmarks (stadiums, malls, train stations, parks, colleges).

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
| `js/geo.js` | Distance, bearing, point-in-polygon |
| `data/nj.topo.json` | 564 municipalities + 21 counties (TopoJSON) |
| `data/sections.json` | Villages, sections and local names, by municipality |
| `lib/`, `fonts/` | Bundled MapLibre GL 5.6, topojson-client 3.1, Noto Sans label glyphs |
| `sw.js` | Offline cache |

## Credits

- Municipal boundaries: [NJ Office of GIS](https://njogis-newjersey.opendata.arcgis.com/datasets/municipal-boundaries-of-nj-hosted-3857), via the [`@njam-data/new-jersey-municipalities`](https://www.npmjs.com/package/@njam-data/new-jersey-municipalities) package. Population figures are from the 2010 Census.
- Village and section names: the NJ local place-name list from [HackJersey/garden-style](https://github.com/HackJersey/garden-style) (MIT). Post office names from the [`zipcodes`](https://www.npmjs.com/package/zipcodes) package (BSD) and [GeoNames](https://www.geonames.org/) (CC-BY 4.0), via [`cities.json`](https://www.npmjs.com/package/cities.json), decide which names count as well known.
- Background map: © OpenStreetMap contributors, via [OpenFreeMap](https://openfreemap.org/) (free, no API key).
- [MapLibre GL JS](https://maplibre.org/) (BSD-3), [topojson-client](https://github.com/topojson/topojson-client) (ISC), Noto Sans (SIL OFL). Their licenses are in `lib/` and `fonts/`.
