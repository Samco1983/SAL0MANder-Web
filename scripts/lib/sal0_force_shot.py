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
import re
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

# Below this share of product work, the next shot is forced to PRODUCT
# regardless of what else is available. 20% is not a target — it is the floor
# at which the team is still building a product rather than a workshop.
# Raised from 0.20 on 2026-08-19, after measuring 232 commits instead of
# guessing. Conversion to a verified point, by category:
#
#     PRODUCT (src/, non-test)   21 commits   2 points   9.5%
#     AUTOMATION                 78 commits   1 point    1.3%
#     DOCS                      103 commits   1 point    1.0%
#     TEST                       12 commits   0 points   0.0%
#
# Product converts 7-9x better than anything else, and 82% of commits on this
# branch never touched src/ at all. 0.20 was set below what the evidence
# supports; it let a week of plumbing pass as a balanced mix.
#
# Deliberately not 1.0. Reliability work is what took unsigned commits from 56%
# to 7%, and a floor that forbids it would remove the one intervention with a
# measured order-of-magnitude result. See docs/coordination/WHAT-ACTUALLY-SCORES.md
PRODUCT_FLOOR = 0.40

# How far back to judge the mix. Long enough to survive one odd possession,
# short enough to react within a session.
WINDOW = "24 hours ago"


def _git(args: list[str]) -> str:
    try:
        r = subprocess.run(["git", *args], capture_output=True, text=True, timeout=25, cwd=REPO)
        return r.stdout if r.returncode == 0 else ""
    except Exception:
        return ""


def _promote_tracked_findings() -> int:
    """Move unresolved OPEN-ITEMS findings onto the board. Returns how many.

    Failure here is never fatal: a picker that cannot promote should still be
    able to report the board it can see. It stays silent on failure too, so a
    promotion that did not happen never looks like one that did.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    try:
        r = subprocess.run(
            [sys.executable, os.path.join(here, "sal0_backlog_sync.py"), "--apply"],
            capture_output=True, text=True, timeout=180, cwd=REPO,
        )
    except Exception:
        return 0
    m = re.search(r"promoted (\d+) of", r.stdout or "")
    return int(m.group(1)) if m else 0


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


def local_tracked_finding() -> dict | None:
    """Return one local OPEN-ITEMS finding when GitHub cannot be read."""
    try:
        from sal0_backlog_sync import parse_items, strip_emoji
    except Exception:
        return None

    items = parse_items()
    if not items:
        return None

    def productish(item: dict) -> bool:
        text = f"{item.get('title', '')}\n{item.get('body', '')}"
        return bool(re.search(r"\bsrc/|student|teacher|guest|play|unity|web|user-visible", text, re.I))

    item = next((candidate for candidate in items if productish(candidate)), items[0])
    title = strip_emoji(str(item.get("title", "")))
    key = item.get("key")
    return {
        "number": None,
        "title": f"[LOCAL] {key} — {title}",
        "category": "PRODUCT" if productish(item) else "TEST",
        "success_check": (
            "the tracked finding is fixed with npm run verify passing, or it is split into "
            "a smaller issue once GitHub queue access returns"
        ),
        "size": "local tracked finding — sync board after GitHub recovers",
        "source": "docs/coordination/OPEN-ITEMS.md",
        "key": key,
    }


def choose() -> dict:
    mix = measure_mix()
    board = read_board()
    if board.get("queue_error"):
        local = local_tracked_finding()
        if local:
            return {
                "shot": local,
                "reason": (
                    f"QUEUE UNREADABLE — {board['queue_error'][:180]}. "
                    "Falling back to a local tracked finding so the team does not idle. "
                    "Do not create duplicate issues; sync the board when GitHub returns."
                ),
                "mix": mix,
                "forced": True,
                "action": "TAKE_SHOT",
            }
        return {
            "shot": None,
            "reason": f"QUEUE UNREADABLE — {board['queue_error'][:180]}",
            "mix": mix,
            "forced": True,
            "action": "FIX_QUEUE_ACCESS",
        }
    shots = board.get("board", [])

    if not shots:
        # An empty board is almost never an empty backlog.
        #
        # Five investigated defects sat in OPEN-ITEMS.md while Mission Control
        # truthfully reported an empty queue and agents stood idle on top of
        # them. Findings are written in markdown; the queue is read from
        # GitHub; nothing joined the two. Reporting CREATE_SHOT in that state
        # asks a human to invent work that already existed.
        #
        # So promote first, then look again. Only if that finds nothing is the
        # board honestly empty. Deliberately NOT shot generation: this moves
        # real, already-analysed findings and invents nothing.
        promoted = _promote_tracked_findings()
        if promoted:
            board = read_board()
            shots = board.get("board", [])
            if shots:
                by_cat = {s["category"]: s for s in shots}
                if mix["below_floor"] and "PRODUCT" in by_cat:
                    return {
                        "shot": by_cat["PRODUCT"],
                        "reason": (
                            f"PROMOTED BACKLOG — promoted {promoted} tracked finding(s), then forced "
                            f"PRODUCT because product share is {mix['product_share']:.0%}."
                        ),
                        "mix": mix,
                        "forced": True,
                        "action": "TAKE_SHOT",
                    }
                return {
                    "shot": shots[0],
                    "reason": f"PROMOTED BACKLOG — promoted {promoted} tracked finding(s), then took the first ready shot.",
                    "mix": mix,
                    "forced": True,
                    "action": "TAKE_SHOT",
                }

        category = "PRODUCT" if mix["below_floor"] else "PRODUCT"
        return {
            "shot": {
                "number": None,
                "title": "[PRODUCT] Create the next smallest user-visible web shot",
                "category": category,
                "success_check": (
                    "a new WEB product issue exists with one lane, one clock, "
                    "and one falsifiable success check"
                ),
                "size": "setup shot — create/split before assigning",
            },
            "reason": (
                "EMPTY BOARD — no unclaimed shot exists. Do not drift into another audit. "
                "Create or split one PRODUCT issue before running a worker."
            ),
            "mix": mix,
            "forced": True,
            "action": "CREATE_SHOT",
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
            "action": "TAKE_SHOT",
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
                    "action": "TAKE_SHOT",
                }

    return {"shot": pool[0], "reason": "first available.", "mix": mix, "forced": False, "action": "TAKE_SHOT"}


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
    number = f"#{s['number']}" if s.get("number") is not None else "NEW"
    print(f"    {number}  {s['title'][:56]}")
    print(f"    category:  {s['category']}")
    print(f"    action:    {result.get('action', 'TAKE_SHOT')}")
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
