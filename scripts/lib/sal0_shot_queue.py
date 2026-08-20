#!/usr/bin/env python3
"""Keep 3–5 ready shots on the board, one of each kind.

WHY. When the queue runs dry an agent invents work, and invented work is how
253 plumbing changes happened against 6 product changes on 2026-08-19. The
queue is the fuel; an empty one does not stop the team, it makes the team build
another scoreboard.

The categories exist so the mix stays honest. Left alone, agents drift toward
audits and tooling — those feel productive, read well in a commit log, and
close nothing. A product shot on the board at all times is the counterweight.

    python3 scripts/lib/sal0_shot_queue.py           # the board
    python3 scripts/lib/sal0_shot_queue.py --json    # machine readable

Read-only. Reads GitHub, decides nothing, changes nothing.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

REPO = "Samco1983/SAL0MANder-Web"
UNAVAILABLE = {"blocked", "in-progress"}
QUEUE_ERROR = ""

# Ordered: first match wins. PRODUCT is checked first on purpose — a shot that
# could be read as either is counted as product, because product is the one the
# team under-takes.
CATEGORIES: list[tuple[str, re.Pattern[str], str]] = [
    ("PRODUCT", re.compile(r"\bbuild\b|component|surface|navigation|entry point|page|ux", re.I),
     "a student or teacher can see the difference"),
    ("TEST", re.compile(r"\btest|coverage|regression|containment|invariant\b", re.I),
     "a defect that could ship is now caught"),
    ("AUTOMATION", re.compile(r"mission|loop|scheduler|launchd|supervisor|automation|script", re.I),
     "the machine needs less babysitting"),
    ("CLEANUP", re.compile(r"harden|refactor|cleanup|tidy|consolidat", re.I),
     "future shots get cheaper"),
    ("DOCS", re.compile(r"audit|analysis|specification|wireframe|blueprint|document|record", re.I),
     "a decision is written down where other agents read it"),
]

# A rough read of how big a shot is, from the words the issue uses. Wrong
# sometimes; useful because the alternative is discovering it at minute 29.
BIG = re.compile(r"end-to-end|blueprint|systems analysis|architecture|comprehensive|full", re.I)


def gh_issues() -> list[dict]:
    global QUEUE_ERROR
    QUEUE_ERROR = ""
    try:
        r = subprocess.run(
            ["gh", "issue", "list", "--repo", REPO, "--state", "open", "--limit", "100",
             "--json", "number,title,labels"],
            capture_output=True, text=True, timeout=40,
        )
        if r.returncode != 0:
            QUEUE_ERROR = (r.stderr or r.stdout or "gh issue list failed").strip()
            return []
        if not r.stdout.strip():
            QUEUE_ERROR = "gh issue list returned no JSON"
            return []
        return json.loads(r.stdout)
    except Exception as e:
        QUEUE_ERROR = f"could not read the queue: {e}"
        print(QUEUE_ERROR, file=sys.stderr)
        return []


def categorise(title: str) -> tuple[str, str]:
    for name, pattern, success in CATEGORIES:
        if pattern.search(title):
            return name, success
    return "DOCS", "a decision is written down where other agents read it"


def build_board() -> dict:
    issues = gh_issues()
    ready: dict[str, list[dict]] = {c[0]: [] for c in CATEGORIES}
    unavailable = []

    for i in issues:
        labels = {l["name"].lower() for l in i.get("labels", [])}
        title = i["title"]
        if "[WEB]" not in title.upper() and "[COORD]" not in title.upper():
            continue

        cat, success = categorise(title)
        entry = {
            "number": i["number"],
            "title": title,
            "category": cat,
            "success_check": success,
            "size": "BIG — split before taking" if BIG.search(title) else "fits a possession",
        }
        if labels & UNAVAILABLE:
            entry["why_unavailable"] = "benched" if "blocked" in labels else "claimed"
            unavailable.append(entry)
        else:
            ready[cat].append(entry)

    # One of each kind, smallest number first — oldest issues have waited longest.
    board = []
    for cat, _, _ in CATEGORIES:
        pool = sorted(ready[cat], key=lambda e: e["number"])
        if pool:
            board.append(pool[0])

    empty = [c[0] for c in CATEGORIES if not ready[c[0]]]
    return {
        "ready_count": sum(len(v) for v in ready.values()),
        "board": board,
        "empty_categories": empty,
        "unavailable": unavailable,
        "queue_error": QUEUE_ERROR,
        "warning": (
            f"no {', '.join(empty)} shot on the board — the mix will drift"
            if empty else ""
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Show the ready shots, one per kind.")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    b = build_board()
    if args.json:
        print(json.dumps(b, indent=2))
        return 0

    print()
    print("  SHOT QUEUE")
    print(f"  {'-' * 62}")
    if b.get("queue_error"):
        print(f"    queue unreadable — {b['queue_error'][:140]}")
        print()
        return 1
    if not b["board"]:
        print("    board is EMPTY — nothing unclaimed. Add issues before the next run.")
    for shot in b["board"]:
        print(f"    {shot['category']:<11} #{shot['number']:<4} {shot['title'][:44]}")
        print(f"    {'':11} size: {shot['size']}")
        print(f"    {'':11} scores when: {shot['success_check']}")
        print()

    if b["unavailable"]:
        print("  NOT AVAILABLE")
        for shot in b["unavailable"]:
            print(f"    #{shot['number']:<4} {shot['why_unavailable']:<9} {shot['title'][:42]}")
        print()

    if b["warning"]:
        print(f"  ⚠ {b['warning']}")
        print()
    print(f"  {b['ready_count']} unclaimed shot(s) total")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
