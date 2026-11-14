"""Skirmish dice rule simulator for the goblin-mode design (docs/goblins, D145 and D149).

Starting rule (my own, Risk-style; the actual rule of the user's reference game is unknown to me):
  the attacker rolls up to 3 dice and must leave one unit behind; the defender rolls up to 2;
  dice are compared in pairs, highest first; a tie goes to the defender; each lost pair costs a unit.
  A captain leading gives that side one extra die.
  Fortification variants (see the bottom): the defender's best die gets +1 (the chosen default),
  the defender rolls one extra die, the attacker is limited to 2 dice, the defender's best die gets +2.

Run:  python3 -I tools/sim_skirmish.py
Pure random with fixed seeds, so the output is reproducible. No dependencies.
"""
import random


def battle(a, d, a_extra=0, d_extra=0, d_bonus_top=0):
    while a > 1 and d > 0:
        ad = min(3 + a_extra, a - 1)
        dd = min(2 + d_extra, d)
        ar = sorted((random.randint(1, 6) for _ in range(ad)), reverse=True)
        dr = sorted((random.randint(1, 6) for _ in range(dd)), reverse=True)
        if d_bonus_top and dr:
            dr[0] += d_bonus_top
            dr.sort(reverse=True)
        for x, y in zip(ar, dr):
            if x > y:
                d -= 1
            else:
                a -= 1
    return d == 0, a


def rate(a, d, n=20000, **kw):
    wins = left = 0
    for _ in range(n):
        ok, rem = battle(a, d, **kw)
        if ok:
            wins += 1
            left += rem
    return wins / n, (left / wins if wins else 0.0)


def part_one():
    random.seed(7)
    print("PART 1: attacker vs defender: attacker wins, average attackers left when it wins")
    for a, d in [(5, 5), (8, 8), (10, 4), (12, 6), (6, 10), (10, 10)]:
        p, l = rate(a, d)
        print(f"{a:>2} vs {d:>2} plain          {p:.0%} (left {l:.1f})")
    for a, d in [(8, 8), (10, 10)]:
        p, l = rate(a, d, d_extra=1)
        print(f"{a:>2} vs {d:>2} fortified (+1 die)  {p:.0%} (left {l:.1f})")
        p, l = rate(a, d, a_extra=1)
        print(f"{a:>2} vs {d:>2} captain leads  {p:.0%} (left {l:.1f})")
    n = 20000
    both = 0
    for _ in range(n):
        ok, rem = battle(16, 6)
        if ok:
            ok2, _ = battle(max(2, rem - 1), 6)
            both += ok2
    print(f"concentrate 16 on one 6-unit town, then the rest on a second: takes both {both / n:.0%}")
    both = 0
    for _ in range(n):
        ok1, _ = battle(8, 6)
        ok2, _ = battle(8, 6)
        both += ok1 and ok2
    print(f"split 8 and 8 against two 6-unit towns: takes both {both / n:.0%}")


def part_two():
    random.seed(11)
    variants = {
        "plain (no fortification)": dict(),
        "A: defender rolls one extra die": dict(d_extra=1),
        "B: attacker limited to 2 dice": dict(a_extra=-1),
        "C: defender best die +1": dict(d_bonus_top=1),
        "D: defender best die +2": dict(d_bonus_top=2),
    }
    print()
    print("PART 2: fortification variants, attacker win rate for 8v8, 10v10, 12v8 (1.5x), 12v6 (2x)")
    for name, kw in variants.items():
        cells = " ".join(f"{a}v{d}: {rate(a, d, **kw)[0]:.0%}" for a, d in [(8, 8), (10, 10), (12, 8), (12, 6)])
        print(f"{name:<34} {cells}")


if __name__ == "__main__":
    part_one()
    part_two()
