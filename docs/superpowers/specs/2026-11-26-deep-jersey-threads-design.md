# Deep Jersey: stories and threads

Design, 26 November 2026. Replaces the "guided tour" shape of Deep Jersey with a library of stories you wander through on a slow evening.

## Why

Deep Jersey feels like a demo. It is a nine-chapter tour you watch once, two close-up places, and the rest of New Jersey blank.

The person it is for uses it on the couch in the evening, to come across esoteric things and things beyond them. The appeal, in their words: the context of what's bigger than me or us oddly brings it all back to where I stand. That is the appeal of the whole app to them, not just this part.

So every story makes that movement: from something far bigger than us, down a thread, to a place in New Jersey you can name, see or visit, or one that is gone.

## Goals

- **A library, not a tour.** Enough stories for many evenings, each one complete on its own.
- **Every story in three beats:**
  1. **The big thing:** the phenomenon at its own scale, shown on the map at that scale.
  2. **The thread down:** how it reached New Jersey.
  3. **Where you stand:** a real place, today or gone, with the map flying down to it.
- **Wander by threads.** Each story ends with two or three links to other stories, each with one line saying why it leads there. This is the main way through.
- **The map as a secondary index.** Stories appear as markers and outlines on the 3D map; tap to open one.
- **Any domain**, as long as it passes the three-beat test: earth, ice, sea, sky, weather, magnetism, living things, disasters, the Lenape, lost places, industry.
- **Some stories end on what is no longer there:** drowned villages, emptied forge towns, a drained lake.
- **The animations read without the text:** you can see what happened (fix Lake Passaic first; see Polish).

## Non-goals (for now)

- Quizzes, practice or spaced review for Deep Jersey.
- GPS, or "what's under me".
- Curated collections or playlists. They can come later over the same stories.
- Covering every county or town.

## Anti-goals (failure even if it works)

- **Fact soup:** trivia that never makes the zoom-out and return.
- **Anything invented or embellished.** Every claim is sourced; where sources hedge, the text hedges; where they disagree, it says so.
- **Walls of text.** Each beat is short, with Read more for depth.
- **Stories you have to sit through:** nothing makes you watch to the end before you can move on.

## Constraints (from the project)

- Static PWA, no build step. Plain ES modules; MapLibre GL 5.6 (already used).
- Accurate data only. Every story lists its sources, and a legend is labelled as a legend.
- Photos only from Wikimedia Commons (or the public domain), credited with author and licence and linked to the source page, saved small in `img/deep/`. Photos that are not of New Jersey are tagged as such.
- Phone first: tested at 390×664. The panel stays short and the map keeps its room (the overlay pattern from the last round).
- Privacy: nothing about the user leaves the device. Reading history is kept in `localStorage` under the `njtf.` prefix.
- Bump the service-worker version on each release.

## Approaches considered

1. **A web of threads** (picked as the main way through). Each story ends in "this leads to…" links. This is closest to a rabbit hole, which is what the evening is. The risk is that it feels random; the one-line "why it leads there" is the cure.
2. **The map as the index** (picked as secondary). Stories live on the map; you spin it and tap. This keeps "where I stand" in view, but you have to go looking, so it is weaker as the main pull.
3. **Collections** (deferred). Curated runs of 6–10 stories you can finish in an evening. These are satisfying to complete but less wandering; they can be added later over the same stories.

The person chose: threads first, the map as the secondary index.

## The shape

### A story

| Field | What it holds |
|---|---|
| `id`, `title` | Identity |
| `hook` | One line you'd want to tap: a surprising claim or question |
| `domain` | One of: earth, ice, sea, sky, weather, life, people, gone, industry. Used for colour and filtering only. |
| `beats` | Three beats: `big`, `thread`, `here`. Each has 1–3 short paragraphs (first shown, the rest behind Read more) and a `scene` (camera, layers, labels, an optional animation). |
| `places` | Map points or outlines for beat three (the existing cards can be reused as places). |
| `threads` | 2–3 links, each `{ to: storyId, why: 'one line' }` |
| `photos` | Optional, in the "See the real thing" format. |
| `explain` | Optional: the ids of the existing "How it works" explainers. |
| `src` | Source keys |
| `gone` | True when beat three is a place that no longer exists. Shown as a tag. |

### Screens

- **Deep Jersey home**
  - "Start somewhere": three or four hooks, rotated so a returning visit sees new ones.
  - "Pick up a thread": up to three unread stories that are linked from stories already read.
  - "The map": opens the map index.
  - "How the ground was made": the current nine-chapter sequence, kept as one way in.
- **A story**
  - The bar shows the beat ("1 of 3 · The big thing"), with arrows.
  - Each beat moves the camera and plays its scene; the panel stays short.
  - After beat three comes "Where next": the thread links (unread ones marked), plus "Show on the map".
- **The map index**
  - Story markers coloured by domain, and outlines where a story covers an area.
  - Tap one for its hook and Open.
  - Read stories are dimmed.

```
┌──────────────────────────────┐
│ ‹  2 of 3 · The thread down › │  bar
│                              │
│        3D map, scene         │
│                              │
├──────────────────────────────┤
│ Lake Passaic                 │  short panel
│ The ice stops at the moraine │
│ and the meltwater is trapped…│
│ Read more                    │
└──────────────────────────────┘
After beat 3:  Where next ─ The Great Falls · "the river's new road"
                         ─ Moggy Hollow · "the first way out"
```

### What happens to what exists

- **The nine story chapters** become stories in the new format (most already have a big beat; they gain the thread and here beats) and stay reachable as the "How the ground was made" sequence.
- **The 66 cards** become places that stories point to. Their text stays.
- **The two close-ups** (Boonton, Pine Barrens) stay as they are, reachable from the stories that land there.
- **The explainers and "See the real thing" photos** attach to stories.

## The first batch (proposal; each to be sourced before it is written)

About 24 stories, chosen so threads cross between domains:

- **Earth:**
  - The Newark Basin lava
  - The Palisades
  - The moraine
  - Franklin and Sterling Hill's fluorescent minerals
  - The Delaware Water Gap
  - The Ramapo Fault and New Jersey's earthquakes
  - *Hadrosaurus foulkii* at Haddonfield
- **Ice and water:**
  - Glacial Lake Passaic
  - The Great Falls and the Passaic's new route
  - The Great Swamp
- **Sea:**
  - The coast 100+ miles further out when sea level was low
  - The Hudson Canyon
  - Barrier islands that move
- **Sky and magnetism:**
  - The compass in New Jersey doesn't point north (declination, and its drift)
  - 1816, the year without a summer
- **Weather and disaster:**
  - Sandy and the barrier islands
  - The Black Tom explosion
  - The Hindenburg at Lakehurst
- **Living things:**
  - Horseshoe crabs and red knots in Delaware Bay
  - The Pine Barrens' fire forest and pygmy pines
  - The American chestnut's disappearance
- **People and gone:**
  - The Lenape
  - Feltville, the deserted village
  - Towns drowned under reservoirs
  - Paterson: Hamilton's planned industrial city and the 1913 silk strike

Threads in this batch include:
- The lava → the Palisades → the Hudson Canyon
- The moraine → Lake Passaic → the Great Falls → Paterson
- The sea level → the barrier islands → Sandy
- The Pine Barrens' fire forest → its sand (the existing close-up)

## Polish in this round

- **Lake Passaic:** show the water leaving.
  - It streams out through Moggy Hollow, and the lake shrinks to that level.
  - Then it streams out through Great Notch, and the lake shrinks again.
  - Then the Passaic takes its new route round the north end of the Watchungs and over the Great Falls.
  - Each step is shown with moving flow lines and a caption.
- Any scene whose animation doesn't read without the text gets the same treatment, as each story is written.

## Calls made in writing this up (check these)

- A story counts as **read** once you reach its third beat.
- **First release:** the new format, the nine chapters converted, about 8 new stories (Lake Passaic redone, the Great Falls, Paterson, the moraine, Franklin's minerals, the compass, the Hudson Canyon, horseshoe crabs). The rest of the batch follows in rounds of about 6, each sourced first.
- The nine-chapter sequence stays visible on the home screen as one way in, not hidden.
- The domain list and the first-batch topics are proposals. Any topic is dropped if the sources don't support a three-beat story.

## Left to the builder

- Module layout. Suggested: stories in a new data module, a story view in `js/deep.js`, and the map index alongside it.
- How beats reuse `applyScene`, `fly`, the overlay illustration and the existing animations.
- How "Start somewhere" rotates.
- The exact domain colours.
- How many stories to write before the first release. A release with the format, the converted chapters and about 8 new stories would let the person feel the shape before the rest are written.
