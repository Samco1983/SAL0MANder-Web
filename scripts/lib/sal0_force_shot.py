#!/usr/bin/env python3
"""Choose the next shot, and enforce product pressure while choosing it.

The gap this closes: everything before it *recommended*. The shot queue listed
options, the assistant suggested a bench, and an agent was trusted to pick well.
Agents do not pick well — left alone they drift toward audits and tooling,
because those feel productive, read well in a commit log, and close nothing.

The measured drift on 2026-08-19: **163 plumbing changes against 37 product
changes** in one day. No rule written in prose stopped that. This does, by
returning exactly one shot instead of a menu.

    python3 scripts/lib/sal0_force_shot.py           # the forced shot
    python3 scripts/lib/sal0_force_shot.py --json    # machine readable

Read-only. Chooses; changes nothing.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

# Below this share of product work, the next shot is forced to PRODUCT
# regardless of what else is available. 20% is not a target — it is the floor
# at which the team is still building a product rather than a workshop.
PRODUCT_FLOOR = 0.20

# How far back to judge the mix. Long enough to survive one odd possession,
# short enough to react within a session.
WINDOW = "24 hours ago"


def _git(args: list[str]) -> str:
    try:
        r = subprocess.run(["git", *args], capture_output=True, text=True, timeout=25, cwd=REPO)
        return r.stdout if r.returncode == 0 else ""
    except Exception:
        return ""


def measure_mix() -> dict:
    files = _git(["log", f"--since={WINDOW}", "--name-only", "--format="]).split("\n")
    product = sum(1 for f in files if f.startswith("src/"))
    plumbing = sum(1 for f in files if f.startswith(("scripts/", "docs/coordination/")))
    total = product + plumbing
    return {
        "product_changes": product,
        "plumbing_changes": plumbing,
        "product_share": round(product / total, 3) if total else 0.0,
        "below_floor": (product / total < PRODUCT_FLOOR) if total else False,
    }


def read_board() -> dict:
    r = subprocess.run(
        [sys.executable, os.path.join(HERE, "sal0_shot_queue.py"), "--json"],
        capture_output=True, text=True, timeout=90,
    )
    try:
        return json.loads(r.stdout)
    except ValueError:
        return {"board": [], "ready_count": 0}


def choose() -> dict:
    mix = measure_mix()
    board = read_board()
    shots = board.get("board", [])

    if not shots:
        return {
            "shot": None,
            "reason": "the board is empty — no unclaimed shot exists. Add issues.",
            "mix": mix,
            "forced": False,
        }

    by_cat = {s["category"]: s for s in shots}

    # Product pressure. This is the enforcement, and it overrides everything
    # below it: a team under the floor does not get to pick an audit.
    if mix["below_floor"] and "PRODUCT" in by_cat:
        return {
            "shot": by_cat["PRODUCT"],
            "reason": (
                f"PRODUCT FORCED — product share is {mix['product_share']:.0%}, "
                f"below the {PRODUCT_FLOOR:.0%} floor "
                f"({mix['product_changes']} product vs {mix['plumbing_changes']} plumbing changes). "
                "The next shot must move the product."
            ),
            "mix": mix,
            "forced": True,
        }

    # A shot flagged BIG is the shape that failed 14 times before being
    # benched. Prefer one that fits the clock over one that will time out.
    fits = [s for s in shots if "BIG" not in s.get("size", "")]
    pool = fits or shots

    # Otherwise: product first anyway, then test, then the rest. Product is
    # first because it is the category the team under-takes.
    for cat in ("PRODUCT", "TEST", "AUTOMATION", "CLEANUP", "DOCS"):
        for s in pool:
            if s["category"] == cat:
                return {
                    "shot": s,
                    "reason": f"{cat} — highest-priority available shot that fits a possession.",
                    "mix": mix,
                    "forced": False,
                }

    return {"shot": pool[0], "reason": "first available.", "mix": mix, "forced": False}


def main() -> int:
    ap = argparse.ArgumentParser(description="Return exactly one next shot, with product pressure.")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    result = choose()
    if args.json:
        print(json.dumps(result, indent=2))
        return 0 if result["shot"] else 1

    print()
    if not result["shot"]:
        print(f"  NO SHOT — {result['reason']}")
        print()
        return 1

    s = result["shot"]
    mark = "  ⚑ FORCED" if result["forced"] else "  NEXT SHOT"
    print(f"{mark}")
    print(f"    #{s['number']}  {s['title'][:56]}")
    print(f"    category:  {s['category']}")
    print(f"    size:      {s['size']}")
    print(f"    scores when: {s['success_check']}")
    print()
    print(f"    why: {result['reason']}")
    m = result["mix"]
    print(f"    mix: {m['product_changes']} product / {m['plumbing_changes']} plumbing "
          f"({m['product_share']:.0%} product) over the last day")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
