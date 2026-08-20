#!/usr/bin/env python3
"""Tell the owner when he is needed — and stay silent when he is not.

Every other tool here answers a question someone asked. This one exists because
of the questions that got asked all night: "is anything blocked", "are you
moving", "what needs me". Having to ask is the babysitting.

So: it reads the championship conditions, keeps only the ones no agent can
clear, and speaks ONCE when that set changes. Not on a timer, not every run —
a notifier that fires when nothing has changed is a notifier that gets muted,
and then the one that mattered is muted too.

Three rules it will not break:

  It never invents an owner action. If a condition can be cleared by an agent,
  it is not on this list, and an agent should be doing it instead.

  It never repeats itself. State is fingerprinted; an unchanged set is silence.

  It never claims something is done. It reports what is blocked and who can
  clear it, nothing else.

    python3 scripts/lib/sal0_owner_needed.py            # notify if changed
    python3 scripts/lib/sal0_owner_needed.py --always   # print regardless
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
STATE = os.path.join(REPO, "docs", "coordination", "ops", ".owner-needed-state")

# Phrases that mean a human with an account or a wallet, not an agent with a
# shell. Kept explicit so the list cannot quietly grow to include things we
# simply have not automated yet.
OWNER_MARKERS = (
    "owner must", "owner action", "needs Pro", "public repo", "enable it",
    "billing", "not on main", "default branch",
)


def championship() -> dict:
    r = subprocess.run(
        [sys.executable, os.path.join(HERE, "sal0_championship.py"), "--json"],
        capture_output=True, text=True, timeout=900, cwd=REPO,
    )
    try:
        return json.loads(r.stdout or "{}")
    except ValueError:
        return {}


def owner_items(data: dict) -> list[dict]:
    out = []
    for group, checks in (data.get("groups") or {}).items():
        for c in checks:
            if c.get("ok"):
                continue
            blocker = c.get("blocker", "")
            if any(m.lower() in blocker.lower() for m in OWNER_MARKERS):
                out.append({"group": group, "name": c["name"], "blocker": blocker})
    return out


def notify(title: str, body: str) -> None:
    """macOS notification. Best effort — a failed notification must never be
    the reason a report does not reach the terminal."""
    try:
        safe = body.replace('"', "'")[:220]
        subprocess.run(
            ["osascript", "-e",
             f'display notification "{safe}" with title "{title}"'],
            capture_output=True, timeout=20,
        )
    except Exception:
        pass


def main() -> int:
    ap = argparse.ArgumentParser(description="Speak only when the owner is actually needed.")
    ap.add_argument("--always", action="store_true", help="print even if nothing changed")
    args = ap.parse_args()

    data = championship()
    if not data:
        # An unreadable scoreboard is not "nothing is blocked".
        print("  could not read the championship state — not claiming anything is clear",
              file=sys.stderr)
        return 2

    items = owner_items(data)
    won, total = data.get("won", 0), data.get("total", 0)
    fingerprint = hashlib.sha256(
        json.dumps([i["name"] for i in items], sort_keys=True).encode()
    ).hexdigest()[:16]

    previous = ""
    if os.path.exists(STATE):
        previous = open(STATE, encoding="utf-8").read().strip()
    changed = fingerprint != previous
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    open(STATE, "w", encoding="utf-8").write(fingerprint)

    if not items:
        if args.always or changed:
            print(f"\n  Nothing needs you. Championship {won}/{total}, and every")
            print("  remaining condition is something an agent can clear.\n")
            if changed:
                notify("SAL0MANder", f"Nothing needs you — {won}/{total}")
        return 0

    if not (changed or args.always):
        return 0   # same blockers as last time; silence is the feature

    print()
    print(f"  YOU ARE NEEDED — championship {won}/{total}")
    print(f"  {'-' * 62}")
    print("  These cannot be cleared by any agent:")
    print()
    for i in items:
        print(f"    {i['group']} · {i['name']}")
        print(f"       {i['blocker']}")
    print()
    print("  Everything else is being worked. You are not the bottleneck on")
    print("  anything not listed above.")
    print()
    notify("SAL0MANder — you are needed",
           f"{len(items)} thing(s) only you can clear. Championship {won}/{total}.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
