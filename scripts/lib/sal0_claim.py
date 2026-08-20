#!/usr/bin/env python3
"""Say what you are about to touch, before you touch it.

We coordinate well on filed issues and are blind everywhere else. Of the last
twenty commits, one closed a filed issue. The QR duplication is the proof: my
commit referenced #25, the other referenced nothing, and we wrote the same three
tests in the same hour.

Filing a GitHub issue for every small thing is too slow to actually happen — and
right now one agent's sandbox cannot reach GitHub at all, so an issue is not
even available as a claim. This is deliberately smaller than an issue: one line
in a repo file, visible to anyone who can read the branch, no network.

It is a claim, not a lock. It cannot stop anyone — it only makes "I am already
on this" a fact your teammate can see instead of one they discover afterwards.

    python3 scripts/lib/sal0_claim.py --mine SAL0-04 --take "src/unity" "why"
    python3 scripts/lib/sal0_claim.py --mine SAL0-04 --drop "src/unity"
    python3 scripts/lib/sal0_claim.py --check src/unity/UnityStage.tsx
    python3 scripts/lib/sal0_claim.py                      # who is on what
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLAIMS = os.path.join(REPO, "docs", "coordination", "ops", "CLAIMS.jsonl")

# A claim nobody released is stale, not held. An agent that crashed mid-shot
# must not own a path until someone notices.
STALE_MINUTES = 90


def load() -> list[dict]:
    if not os.path.exists(CLAIMS):
        return []
    out = []
    with open(CLAIMS, encoding="utf-8") as fh:
        for line in fh:
            try:
                out.append(json.loads(line))
            except ValueError:
                continue
    return out


def active(now: dt.datetime | None = None) -> list[dict]:
    """Latest state per path, dropping released and stale claims."""
    now = now or dt.datetime.now().astimezone()
    latest: dict[str, dict] = {}
    for row in load():
        latest[row.get("path", "")] = row
    out = []
    for path, row in latest.items():
        if row.get("event") != "take":
            continue
        try:
            age = (now - dt.datetime.fromisoformat(row["at"])).total_seconds() / 60
        except Exception:
            age = 0
        if age > STALE_MINUTES:
            continue
        row["age_min"] = round(age)
        out.append(row)
    return out


def append(event: str, path: str, mine: str, why: str = "") -> None:
    os.makedirs(os.path.dirname(CLAIMS), exist_ok=True)
    with open(CLAIMS, "a", encoding="utf-8") as fh:
        fh.write(json.dumps({
            "at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
            "event": event, "path": path, "agent": mine, "why": why,
        }) + "\n")


def conflicts(path: str, mine: str) -> list[dict]:
    """Live claims by someone else that cover this path."""
    out = []
    for c in active():
        if c["agent"] == mine:
            continue
        p = c["path"]
        if path == p or path.startswith(p.rstrip("/") + "/") or p.startswith(path.rstrip("/") + "/"):
            out.append(c)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Claim what you are about to work on.")
    ap.add_argument("--mine", default=os.environ.get("SAL0_AGENT", ""))
    ap.add_argument("--take", nargs="+", metavar=("PATH", "WHY"))
    ap.add_argument("--drop", metavar="PATH")
    ap.add_argument("--check", metavar="PATH")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    mine = args.mine.strip()

    if args.take:
        if not mine:
            print("  --mine or SAL0_AGENT required to claim", file=sys.stderr)
            return 2
        path, why = args.take[0], " ".join(args.take[1:])
        clash = conflicts(path, mine)
        for c in clash:
            print(f"  ALREADY CLAIMED — {c['agent']} took {c['path']} {c['age_min']}m ago")
            if c.get("why"):
                print(f"    for: {c['why']}")
        append("take", path, mine, why)
        print(f"  claimed {path} for {mine}")
        # Claiming still succeeds over a conflict: this is information, not a
        # lock. Being unable to proceed is worse than proceeding knowingly.
        return 1 if clash else 0

    if args.drop:
        if not mine:
            print("  --mine or SAL0_AGENT required to release", file=sys.stderr)
            return 2
        append("drop", args.drop, mine)
        print(f"  released {args.drop}")
        return 0

    if args.check:
        clash = conflicts(args.check, mine)
        if not clash:
            return 0
        for c in clash:
            print(f"  {c['agent']} claimed {c['path']} {c['age_min']}m ago"
                  + (f" — {c['why']}" if c.get("why") else ""))
        return 1

    live = active()
    if args.json:
        print(json.dumps(live, indent=2))
        return 0
    print()
    if not live:
        print("  nobody has claimed anything. Every collision from here is discoverable")
        print("  only after it happens.")
    else:
        print("  ON THE COURT")
        for c in live:
            print(f"    {c['agent']}  {c['path']}  ({c['age_min']}m)"
                  + (f"  — {c['why']}" if c.get("why") else ""))
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
