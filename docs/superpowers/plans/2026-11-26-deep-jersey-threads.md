# Deep Jersey: stories and threads, first release — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Deep Jersey from a nine-chapter tour into a library of three-beat stories joined by threads. The map is a secondary index. Lake Passaic visibly drains.

**Architecture:**
- Story content lives in a new data module, `js/deepstories.js`.
- Pure logic lives in `js/deepthreads.js`, testable in Node: read state, "pick up a thread", rotating hooks, and a validator.
- `js/deep.js` gains:
  - a story view, which replaces `chapter()`
  - a new home screen, which replaces `intro()`
  - a map index
  - a lake-drain animation, fed by a new `data/deep/drain.json` built by `tools/build_deep.py`

**Tech Stack:**
- Plain ES modules, no build step
- MapLibre GL 5.6
- Playwright checks in `tools/checks/*.cjs`
- Python build script for map data

**Spec:** `docs/superpowers/specs/2026-11-26-deep-jersey-threads-design.md`

## Global Constraints

- Accurate data only. Every story lists its sources. Where sources hedge, the text hedges; where they disagree, the text says so. Nothing invented or embellished.
- Every story has exactly three beats, in order: `big`, `thread`, `here`.
- Every story has 2–3 threads. Each thread is `{ to, why }`, where `why` is one line.
- Each beat shows its first paragraph; the rest sits behind Read more. The panel stays short: at most 40% of the viewport height when not expanded.
- A story counts as read once its third beat is reached.
- Reading history is kept in `localStorage` via `store` under `deep.read`, and never leaves the device. Every read and write tolerates a store that throws.
- Photos come only from Wikimedia Commons or the public domain. Each is credited with author, licence and a link, and saved small in `img/deep/`. Photos not of New Jersey are tagged "Not New Jersey".
- Test at 390×664 with the launch flags `['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']`.
- The service worker `VERSION` is bumped on release (currently `njtf-v320`).
- After testing: `git fetch origin main && git merge origin/main`, then push to `claude/nj-township-navigation-c74ho2` and to `main`.
- Commit trailer:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VbHYcpJJCeFC23cU6EtBJy
  ```

## Review Focus

1. **A thread pointing to a story that doesn't exist yet.** The validator must fail on it; the release never ships a dead link. Test: `checkStories` fixture in Task 1.
2. **Storage blocked or throwing (private mode).** Deep Jersey still opens, and everything shows as unread. Test: `readIds` with a throwing store, in Task 1.
3. **Everything read.** "Pick up a thread" is hidden rather than empty, and "Start somewhere" still offers hooks. Test: `pickUp` and `hooks` with all stories read, in Task 1.
4. **Leaving mid-animation** (Home, the arrows, or leaving Deep Jersey during a beat's animation or the drain). There must be no stray captions, no layers left on, and no errors. Test: the UI check in Tasks 3 and 5.
5. **A long beat.** The panel stays at or below 40% of the viewport until the grab handle is used. Test: a panel-height assertion in the Task 3 UI check.

---

### Task 1: Thread logic and validator

**Files:**
- Create: `js/deepthreads.js`
- Create: `tools/checks/deep-stories.cjs` (Node, no browser; run with `node tools/checks/deep-stories.cjs`)

**Interfaces:**
- Produces:
  - `readIds(store) -> string[]`: returns `[]` if `store.get` throws.
  - `markRead(store, id) -> void`: swallows store errors.
  - `pickUp(stories, read, max = 3) -> string[]`: unread ids that are linked from read stories, in the order the read stories were read, with no duplicates.
  - `hooks(stories, read, n = 4, day = Math.floor(Date.now() / 864e5)) -> string[]`: prefers unread stories; the order rotates by `day` so a later visit sees different ones; falls back to read stories when all are read.
  - `checkStories(stories, refs) -> string[]`: returns problems as plain sentences, empty when valid. `refs = { places: Set<string>, src: Set<string>, explain: Set<string> }`.
  - `DOMAINS`: an object mapping each domain to `{ name, color }`, for exactly these domains: earth, ice, sea, sky, weather, life, people, gone, industry.

- [ ] **Step 1: Write the failing test** `tools/checks/deep-stories.cjs`. It uses dynamic `import()` of `../../js/deepthreads.js` and a fixture of three stories, `a`, `b` and `c`. Assertions:
  - `checkStories` on a valid fixture returns `[]`.
  - A thread to `'zz'` yields a problem containing `'zz'`.
  - A story with two beats yields a problem containing `'three beats'`.
  - A source key not in `refs.src` yields a problem.
  - A place not in `refs.places` yields a problem.
  - A domain outside `DOMAINS` yields a problem.
  - With `a` read and a thread from `a` to `b`: `pickUp(fixture, ['a'])` deep-equals `['b']`.
  - `pickUp(fixture, ['a', 'b', 'c'])` deep-equals `[]`.
  - `hooks(fixture, ['a', 'b', 'c'], 2)` has length 2.
  - `hooks` with `day` 0 and `day` 1 can differ in order, over a 6-story fixture.
  - `readIds({ get() { throw new Error('blocked'); } })` deep-equals `[]`.
  - `markRead({ get() { throw 1; }, set() { throw 1; } }, 'a')` does not throw.
  - The script prints `deep-stories ok` and exits 0 on success, and exits 1 with the failures listed otherwise.
- [ ] **Step 2:** Run `node tools/checks/deep-stories.cjs`. Expected: it fails because the module is missing.
- [ ] **Step 3:** Implement `js/deepthreads.js` with the signatures above. `hooks` rotates by sorting on a hash of `id + day`.
- [ ] **Step 4:** Run `node tools/checks/deep-stories.cjs`. Expected: `deep-stories ok`.
- [ ] **Step 5:** Commit: "Deep Jersey: thread logic and story validator".

### Task 2: The nine chapters as three-beat stories

**Files:**
- Create: `js/deepstories.js`
- Modify: `js/deepcards.js` (keep `STORY` for now; add new `SRC` keys if needed)
- Modify: `tools/checks/deep-stories.cjs` (validate the real data)

**Interfaces:**
- Consumes: `checkStories`, `DOMAINS` (Task 1); `CARD`, `SRC`, `LAND` (`deepcards.js`); `EXPLAIN` (`deepexplain.js`).
- Produces:
  - `STORIES: Story[]` and `STORY_BY: { [id]: Story }`.
  - `SEQUENCE: string[]`: the nine ids in the "How the ground was made" order: `s-oldest`, `s-mountains`, `s-rift`, `s-coast`, `s-ice`, `s-lake`, `s-people`, `s-iron`, `s-today`.
  - `Story` is:
    ```
    { id, title, hook, domain, when,
      beats: { big, thread, here },
      places: string[], threads: [{ to, why }],
      photos?, explain?: string[], src: string[], gone?: boolean }
    ```
  - A beat is `{ text: string[], scene: Scene, cam?: [lon, lat, zoom], fit?: regionId, play?: PlayName }`.
  - `Scene` is the existing `applyScene` argument.
  - `PlayName` is one of `'rise' | 'lava' | 'ice' | 'sand' | 'drain'`.

- [ ] **Step 1:** Extend the test to import the real `STORIES` and assert `checkStories(STORIES, refs)` deep-equals `[]`, with `refs` built from `Object.keys(CARD)`, `Object.keys(SRC)` and `Object.keys(EXPLAIN)`. Also assert that every `SEQUENCE` id is in `STORY_BY`.
- [ ] **Step 2:** Run it. Expected: it fails because `js/deepstories.js` is missing.
- [ ] **Step 3:** Write the nine stories.
  - The existing chapter text and scene become `big` (or `thread` where the chapter is already local).
  - `here` lands on one of the chapter's close-up cards, with `cam` at that card's `p` and zoom 10–11.
  - Every claim is taken from the chapter's existing sourced text, or from the sources listed in `SRC`; new facts must cite a source added to `SRC`.
  - Threads join the sequence neighbours, plus at least one cross-link each (for example, `s-rift` → `s-lake`: "the lava ridges are the walls that held the lake").
  - `play` values:
    - `s-mountains` big: `'rise'`
    - `s-rift` thread: `'lava'`
    - `s-coast` big: `'sand'`
    - `s-ice` big: `'ice'`
    - `s-lake` thread: `'drain'`
- [ ] **Step 4:** Run `node tools/checks/deep-stories.cjs`. Expected: `deep-stories ok`.
- [ ] **Step 5:** Commit: "Deep Jersey: the nine chapters as three-beat stories".

### Task 3: The story view

**Files:**
- Modify: `js/deep.js`. Replace `chapter(i)` and its `play` map with `story(id, beat = 0)`. Keep `applyScene`, `fly`, `fitBox`, `rise`, `lavaFloods`, `playIce`, `showEx` and the back stack.
- Modify: `css/app.css` (the `Where next` block and domain tags)
- Modify: `tools/checks/ui-deep.cjs`

**Interfaces:**
- Consumes: `STORIES`, `STORY_BY`, `SEQUENCE` (Task 2); `readIds`, `markRead`, `DOMAINS` (Task 1).
- Produces, inside `initDeep`:
  - `story(id: string, beat = 0)`
  - `PLAYS: { [PlayName]: () => void }`: `rise` → the current mountain rise; `lava` → `lavaFloods`; `ice` → `playIce`; `sand` → the current sand fill; `drain` → `drainLake` (Task 5; until then a no-op).
  - The `data-d` actions `story` (with `data-id`), `beat` (with `data-b`) and `threadmap`.
- [ ] **Step 1:** Update `ui-deep.cjs`:
  - Open the story `s-rift` from the sequence. Step through 3 beats with `#deepbar [data-b=next]`, logging the bar title for each (it must contain "1 of 3", "2 of 3", "3 of 3").
  - After beat 3: assert `#deep .dp-next button` count is between 2 and 3, and `localStorage['njtf.deep.read']` contains `s-rift`.
  - Assert `#deep` height ≤ 0.4 × 664 before the grab handle is used.
  - Click the first thread, and assert the new story's title differs.
  - Click Home in the middle of the `s-rift` thread beat (the lava). Assert `#deepcap` is hidden after Home, and that `errors 0` holds at the end.
- [ ] **Step 2:** Run the check against `python3 -m http.server 8077`. Expected: it fails because there is no `.dp-next`.
- [ ] **Step 3:** Implement `story(id, beat)`:
  - The bar shows `${beat + 1} of 3 · ${['The big thing', 'The thread down', 'Where you stand'][beat]}`, with the arrows moving between beats.
  - Each beat: `applyScene(beat.scene)`, then camera (`fit` → `fitBox(regionBbox, 7)`, else `fly(cam)`), then `PLAYS[beat.play]` after arrival via `afterEx`.
  - The panel: domain tag (plus a "Gone" tag when `gone`), title, `paras(beat.text)`, the how-it-works row from `explain`, photos if any, and sources.
  - On beat 3, the story's `places` appear as card chips (`chips()`), which reach the existing close-ups.
  - On beat 3: `markRead`, plus a "Where next" list (each thread: the target title, its `why`, and an unread dot) and a "Show on the map" button.
  - The overlay illustration (`STORY_EX`) plays on beat 1 as now.
- [ ] **Step 4:** Run the check. Expected: all logged assertions hold, and `errors 0`.
- [ ] **Step 5:** Commit: "Deep Jersey: three-beat story view with threads".

### Task 4: Home screen and map index

**Files:**
- Modify: `js/deep.js`: rewrite `intro()` and add `mapIndex()`
- Modify: `css/app.css`
- Modify: `tools/checks/ui-deep.cjs`

**Interfaces:**
- Consumes: `hooks`, `pickUp`, `readIds`, `DOMAINS` (Task 1); `story` (Task 3).
- Produces:
  - `intro()`, with these sections:
    - "Start somewhere": 4 hook cards from `hooks`.
    - "Pick up a thread": from `pickUp`; hidden when empty.
    - "The map".
    - "How the ground was made": the first `SEQUENCE` story, and where you got to.
    - The existing "The land today" and close-up buttons kept below.
  - `mapIndex()`: a geojson source `deep-stories` with one point per story at its `here` beat's `cam`, coloured by `DOMAINS[domain].color`, with read stories at opacity 0.4. Tapping a point shows hook + Open in the panel. The camera fits all story points.
- [ ] **Step 1:** Update the check. On a fresh context, assert:
  - `#deep .dp-hook` count is 4
  - `#deep .dp-pickup` is absent
- [ ] **Step 2:** Continue the check:
  - Read `s-rift` to beat 3 and return home: `.dp-pickup button` count ≥ 1.
  - Open the map: the `deep-stories` layer is visible.
  - Click the rendered point for `s-rift` (via `map.project`): the panel shows its hook.
- [ ] **Step 3:** Run it. Expected: fails.
- [ ] **Step 4:** Implement `intro()` and `mapIndex()`.
- [ ] **Step 5:** Run it. Expected: passes, with `errors 0`.
- [ ] **Step 6:** Commit: "Deep Jersey: home with hooks and threads, and the map index".

### Task 5: Lake Passaic drains

**Files:**
- Modify: `tools/build_deep.py`: add a step `drain` writing `data/deep/drain.json`
- Modify: `js/deep.js`: add `drainLake()` and a layer `deep-drain` (line, animated dash)
- Modify: `tools/checks/ui-deep.cjs`

**Interfaces:**
- Consumes: the `moggy` and `notch` lake polygons in `data/deep/lakes.json` (levels 103 m and 93 m, USGS I-2540-C); the omt `waterway` source-layer for the Passaic's course.
- Produces: `data/deep/drain.json`, a FeatureCollection of LineStrings with property `stage`:
  - `moggy`: from the lake's south-west end through Moggy Hollow, near Pluckemin (about −74.66, 40.65), down to the Raritan.
  - `notch`: from the lake east through Great Notch (about −74.21, 40.88).
  - `passaic`: the modern Passaic from the Great Swamp round the north end of the Watchungs, through Little Falls, to the Great Falls at Paterson (about −74.18, 40.916).
  
  Build the lines from OSM river geometry where it exists, and from hand-placed points where it doesn't (the old spillway channels). Points are listed in the script, each with a comment citing I-2540-C or the Great Falls article.
- `drainLake()` plays three stages, each with a caption:
  1. The `moggy` lake is shown and its flow line animates (dash offset moving). Caption: "The lake spills out at Moggy Hollow, its lowest gap, south-west to the Raritan".
  2. The lake fill animates from the `moggy` to the `notch` polygon, and the `notch` line runs. Caption: "The ice melts back and opens Great Notch, 34 ft lower: the lake drops and spills east".
  3. The lake fades out and the `passaic` line runs. Caption: "The ice is gone: the Passaic, blocked from its old shortcut by the moraine, takes the long way round and over the Great Falls".
  
  All timers are pushed to `timers`, so leaving clears them.
- [ ] **Step 1:** Run `python3 tools/build_deep.py drain`. Then check that `data/deep/drain.json` has exactly the three stages and that every coordinate falls within the bbox (−75.0, 40.4, −74.0, 41.1). Print `drain ok` from a one-off assertion in the script's main.
- [ ] **Step 2:** Add to the check: open `s-lake`, go to beat 2, and wait for the full play. Log the caption at three times (each must match the stage text above). Check the `deep-drain` layer is visible during stage 2. Then press Home mid-stage: `#deepcap` is hidden, and `errors 0`.
- [ ] **Step 3:** Implement `drainLake()` and register it as `PLAYS.drain`.
- [ ] **Step 4:** Run the check, and look at three screenshots (one per stage) to confirm the water is visibly leaving through each gap.
- [ ] **Step 5:** Commit: "Deep Jersey: Lake Passaic visibly drains through Moggy Hollow, Great Notch, then the Great Falls".

### Task 6: Eight new stories

**Files:**
- Modify: `js/deepstories.js` and `js/deepcards.js` (new `SRC` keys and new place cards where a story lands somewhere new)
- Possibly create: `img/deep/*.jpg` (Commons photos, credited)

**Interfaces:**
- Consumes: the `Story` shape (Task 2); `checkStories` (Task 1).

**Stories** (ids fixed):
- `great-falls`: the Great Falls and the river's new road
- `paterson`: Hamilton's planned industrial city and the 1913 silk strike
- `moraine`: the ice's farthest line, and what it left
- `franklin`: Franklin and Sterling Hill's fluorescent minerals
- `compass`: the compass in New Jersey doesn't point north (declination and its drift)
- `low-sea`: the coast 100+ miles further out when sea level was low
- `hudson-canyon`: the canyon under the sea off New Jersey
- `horseshoe`: horseshoe crabs and red knots in Delaware Bay

**Required threads** (each with a one-line why):
- `s-lake` → `great-falls` → `paterson`
- `s-ice` → `low-sea` → `hudson-canyon`
- `s-ice` → `moraine`
- `s-rift` → `great-falls`
- `s-oldest` → `franklin`
- `compass` ↔ `s-oldest`: "the Highlands' iron ore turns compass needles", only if a source supports magnetite deflecting compasses there; otherwise thread `compass` to `s-iron`
- `horseshoe` → `s-coast`

- [ ] **Step 1:** For each story, fetch its sources first: Wikipedia via `curl "https://en.wikipedia.org/wiki/<Title>?action=raw"`, plus USGS or NOAA pages where they are reachable. Write each beat only from what those sources say, noting the source keys. Drop any story the sources can't carry through all three beats, and say so in the commit message.
- [ ] **Step 2:** Run `node tools/checks/deep-stories.cjs`. Expected: `deep-stories ok`, with 17 stories (or fewer if any were dropped).
- [ ] **Step 3:** Run `ui-deep.cjs`, then open each new story through all three beats at 390×664, and look at beat 3's screenshot: the camera is on the place and the pin is labelled.
- [ ] **Step 4:** Commit: "Deep Jersey: eight new stories".

### Task 7: Release

**Files:**
- Modify: `README.md` (Deep Jersey section: stories, threads, map index, the drain)
- Modify: `sw.js` (bump `VERSION`; precache `js/deepstories.js` and `js/deepthreads.js` alongside the other deep modules)
- [ ] **Step 1:** Run `node tools/checks/deep-stories.cjs`, `ui-deep.cjs` and `ui-home.cjs`. Expected: `deep-stories ok`, and `errors 0` in both UI checks.
- [ ] **Step 2:** Merge main, push the branch and main, and report the commit.
