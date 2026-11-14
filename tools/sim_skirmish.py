"""Skirmish dice rule simulator for the goblin-mode design (docs/goblins, D145 and D149).

Starting rule (my own, Risk-style; the actual rule of the user's reference game is unknown to me):
  the attacker rolls up to 3 dice and must leave one unit behind; the defender rolls up to 2;
  dice are compared in pairs, highest first; a tie goes to the defender; each lost pair costs a unit.
  Fortification gives the defender one extra die. A captain leading gives that side one extra die.

Run:  python3 -I tools/sim_skirmish.py
Pure random with a fixed seed, so the output is reproducible. No dependencies.
"""
import random

random.seed(7)


def battle(a, d, a_extra=0, d_extra=0):
    while a > 1 and d > 0:
        ad = min(3 + a_extra, a - 1)
        dd = min(2 + d_extra, d)
        ar = sorted((random.randint(1, 6) for _ in range(ad)), reverse=True)
        dr = sorted((random.randint(1, 6) for _ in range(dd)), reverse=True)
        for x, y in zip(ar, dr):
            if x > y:
                d -= 1
            else:
                a -= 1
    return d == 0, a


def rate(a, d, ae=0, de=0, n=20000):
    wins = left = 0
    for _ in range(n):
        ok, rem = battle(a, d, ae, de)
        if ok:
            wins += 1
            left += rem
    return wins / n, (left / wins if wins else 0.0)


if __name__ == "__main__":
    print("attacker vs defender: attacker wins, average attackers left when it wins")
    for a, d in [(5, 5), (8, 8), (10, 4), (12, 6), (6, 10), (10, 10)]:
        p, l = rate(a, d)
        print(f"{a:>2} vs {d:>2} plain          {p:.0%} (left {l:.1f})")
    for a, d in [(8, 8), (10, 10)]:
        p, l = rate(a, d, de=1)
        print(f"{a:>2} vs {d:>2} fortified      {p:.0%} (left {l:.1f})")
        p, l = rate(a, d, ae=1)
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
