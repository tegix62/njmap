# NJ Townfinder

A phone web app for learning New Jersey's 564 municipalities and keeping your bearings while you drive.

- **Drive**: big readout of the town and county you're in, the direction you're heading, and which towns are to your left, straight ahead, and to your right (each tagged with its compass direction). Speaks as you cross into a new town, e.g. *"Entering Clifton, Passaic County. Heading west. Not Rockaway — that's 19 miles west-northwest."*
- **Heading-up or north-up**: tap the compass button. In either mode, N/E/S/W markers sit on the edges of the map, and the readout spells out *"your left = N · your right = S"*. That's how you learn to turn a compass direction into a left or right turn.
- **Villages and sections**: many familiar place names aren't municipalities. Towaco is part of Montville Township, Pompton Plains is part of Pequannock, and Iselin is part of Woodbridge. While driving, the readout adds *"near Towaco · part of Montville"*, and the map labels these places in gray italics so they don't get confused with the towns themselves.
- **Explore**: tap anywhere or search (village names work too) to see a town's county, the villages and sections inside it, every town that borders it with the direction to each, and the towns it's easy to mix it up with.
- **Practice**: quizzes on *Find it on the map*, *Name the highlighted town*, *Which direction is B from A?*, *Which town is this village in?* ("Pompton Plains is part of…"), and *Sound-alikes* (Clifton/Rockaway, Mahwah/Rahway/Matawan, Montclair/Montvale/Montville, Fair Lawn/Fairfield/Fairview…). Limit questions to a county, a region, towns within 15 miles of you, or **towns you've actually driven through** (Drive mode records them). Towns you miss come up more often.

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
