# 06. The content bible (region kits)

Started 2026-11-15 with finish plan stage F5. Built by `node tools/goblin/build_regions.mjs` into `data/goblin-regions.json`. The kits follow D171: regions are the unit of authored content, each with a rule, a hazard, a trade flavour and a few verified facts. Everything below is a working proposal (D221) and every name and word is the user's to change.

## The ten kits

Grouped by county, a **county-level approximation** (a township that really belongs to a neighbouring region stays with its county for now; township-level corrections come later). Every one of the 564 townships is in exactly one kit; the build checks it.

| Kit (working name) | Counties | Townships | Rule |
|---|---|---|---|
| The Skylands | Sussex, Warren | 46 | farm |
| The Highlands | Morris, Passaic | 55 | rivers |
| The Palisades | Bergen | 70 | hills |
| The Waterfront | Hudson, Essex | 34 | hills |
| The Raritan | Union, Somerset, Middlesex | 67 | rivers |
| The Delaware Valley | Hunterdon, Mercer | 38 | roads |
| The Shore | Monmouth, Ocean | 86 | coast |
| The Pines | Burlington, Camden | 76 | roads |
| The Bayshore | Gloucester, Salem, Cumberland | 53 | farm |
| The Atlantic Coast | Atlantic, Cape May | 39 | coast |

## The rules, and why each kit has the one it has

The rule was chosen **from numbers computed on the board**, never from memory (H42): the share of a kit's internal borders that are river, ridge or highway borders, and its average population. Each kit takes the rule it scores highest on compared with the others; the two coastal kits are set to coast.

| Rule | Effect | How it was chosen |
|---|---|---|
| roads | convoys through the kit move twice as fast | highest share of borders with a highway |
| rivers | a goblin bridge over a river border costs 2 less Build | highest share of river borders |
| hills | townships dig in without paying Build | highest share of ridge borders |
| farm | Food towns yield 1 more Food | lowest average population |
| coast | a hired band brings 2 more units | the two coastal kits |

**A caution on "hills":** the board has only eight ridge lines (the Watchungs are not among them), so the ridge numbers are thin and two kits got "hills" on tiny differences. The user may reassign any rule; the kit file is data.

## Facts: none shipped yet

A fact is a row with its text, a source to check and a verified flag (D195). Unverified rows are kept for checking and **never shipped**. All ten kits currently have **no facts**: I have not written any from memory into the game. The pipeline and the check are built (a test fails if an unverified fact would ship); the work is: pick about five facts per region, find each in a source, and mark it verified. That is the slowest step in the project (H11) and needs the user's eye on every row.

## What the user writes here

Region names if the working ones are wrong; each kit's hazard and trade flavour (both placeholder words); and the verification of facts. Nothing blocks building: the kits work with placeholders.

## Not done

Township-level region corrections; real trades per town replacing the population-rank rule (needs verified facts); the 10 to 15 lever templates (D104, D105) tied to terrain; a hazard that does something (hazards are words today, the rules above are the mechanical part).
