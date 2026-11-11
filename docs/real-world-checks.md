# Real-world checks

Finishes and routes the game says are fine, that only someone who drives them can confirm. Check a few, then tell Claude which are wrong and it will fix the data (`tools/build_streets.py`, the `CORNERS` and `LTE_GATES` tables).

How the game decides a finish: you arrive at the destination corner with the place on your right, or on either side if the street is one-way. It cannot know about no-standing zones, police-directed traffic, barriers or closures.

## Open issues to compare with real life

| Issue | Where | What the game does | Check in real life |
|---|---|---|---|
| #14 | 2nd Ave & E 37th St (a corner, no landmark) | Ends heading south on 2nd Ave, corner on your right | Is it a normal place to pull up? Also: "a ton of bridges on the map": is there anything odd drawn near it? |
| #16 | Macy's (Herald Square), at W 35th St & Broadway | Ends heading west on 35th St, Macy's on your left (south side, one-way left curb) | Can you stop on the left curb of W 35th by Macy's? Is 34th St & Broadway/6th Ave the better drop-off? |
| #21 | 2nd Ave & E 25th St | Lincoln Tunnel exit, Dyer Ave to 42nd St east to 2nd Ave south | Is this how you'd drive it from the Lincoln Tunnel? Any 42nd St turn that's really banned or blocked? |
| #22 | Hudson Yards, 10th Ave & W 33rd St | Ends heading north on 10th Ave, Hudson Yards (west side) on your left | Can you drop off on the left curb of 10th Ave at 33rd? Is the main entrance really on 10th Ave (vs 11th Ave/34th St)? |
| #23 | Radio City, 6th Ave & W 50th St | Ends heading north on 6th Ave, Radio City (west side) on your left. 50th St runs east, so this is the only curb reachable | Can you pull up on the west curb of 6th Ave at 50th? |

## Places the game uses (corner and side from my own knowledge, please correct)

Midtown: Grand Central (Park Ave & E 42nd, NE), Empire State Building (W 33rd & 5th, NW), Madison Square Garden (8th Ave & W 33rd, SE), Port Authority (8th Ave & W 41st, NW or SW), Radio City (6th Ave & W 50th, NW), MoMA (5th Ave & W 53rd, NW), Carnegie Hall (W 57th & 7th, SE), Flatiron Building (5th Ave & E 22nd, NW), Javits Center (W 36th & 11th Ave, NW or SW), Macy's (W 35th & Broadway, SW), Bloomingdale's (E 59th & Lexington, NE), Union Square (Union Sq W & E 15th, NE or SE), the UN (1st Ave & E 46th, NE or SE), Chelsea Market (9th Ave & W 16th, SW), Hudson Yards (10th Ave & W 33rd, SW).

Downtown: Stock Exchange (Wall & Broad, SW), Washington Square Park (Washington Sq N & 5th Ave, SW), Katz's Deli (E Houston & Ludlow, NW), Union Square (E 14th & Broadway, NE or SE).

## Entries to check

- Lincoln Tunnel entrance ramps: 30th St / 10th Ave, W 33rd St, Dyer Ave northbound (34th to 36th), 9th Ave southbound ramp at 36th. Overnight (Tue to Thu, 11 pm to 5 am) the game uses Galvin Plaza (W 40th St) as the only way in, while the Port Authority's alert feed still shows overnight Expressway closures (the game reads `data/advisories-summary.json`; the last closure alert in it is 5 Nov 2026). `DETOUR_THROUGH` (2027-02-28) is only the fallback when that file can't be read.
- GWB starts: down the West Side Highway (12th Ave near 59th), I-87 / I-278 / FDR exit 8 then E 38th St and 1st Ave (from Google Maps), and the FDR exit at E 53rd St.
- UN: security checkpoint at 46th St & 2nd Ave and a drop-off on the north side of 46th near 1st Ave (from a 2023 UN briefing; not in the game).

## Questions, not bugs

- #13: are the routes I take unconventional? Is there NYC driving practice (roads to favor or avoid) worth building in?
- #15: "does Park Ave allow a left turn onto 7th": which corner did you mean?
