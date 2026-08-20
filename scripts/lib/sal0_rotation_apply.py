#!/usr/bin/env python3
"""Execute the rotation call — but only the moves that can be taken back.

`mission:rotation` decides. This runs the decision, closing the gap where a
correct call sat in a terminal waiting for a human to copy a command.

THE BOUNDARY, and it is the whole design:

Automate a move when undoing it costs nothing. A bench is a label you remove; a
skipped run is a run you start again. Those are safe because being wrong is
cheap.

Refuse a move when being wrong is expensive OR when the machine cannot do it
well. CREATE_SHOT fails the second test, not the first: Python can detect that
the board is empty, but it cannot read the codebase to find what is actually
worth fixing. It would file "create the next smallest product shot" — a
placeholder that *looks* like a shot and is not one.

That distinction is not theoretical. #15 was benched after failing 14 times,
and it failed because it was too big and too vague. **An auto-generated issue is
vague by construction.** An empty board is a visible problem; a board full of
hollow issues is an invisible one, and the agents will burn possessions
discovering it one at a time.

    python3 scripts/lib/sal0_rotation_apply.py           # what it would do
    python3 scripts/lib/sal0_rotation_apply.py --apply   # do it
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

# Reversible, and the machine can do them correctly. These run unattended.
AUTO_APPLY = {
    "BENCH_APPLY": (
        [sys.executable, os.path.join(HERE, "sal0_autobench.py"), "--apply"],
        "a bench is a label; removing it restores the shot",
    ),
}

# Decisions that are already their own action — there is nothing to run.
NO_OP = {
    "TAKE_SHOT": "an agent takes the shot; nothing for the coach to execute",
    "WAIT_CLEAN_TREE": "the loop already refuses to start dirty — waiting is the action",
    "KEEP_PLAYING": "nothing is blocked and nothing is repeating",
    "NONE": "no call to make",
}

# Refused on purpose. Each names why, because a refusal without a reason reads
# as a bug and gets removed by the next person who meets it.
REFUSE = {
    "CREATE_SHOT": (
        "Python can see the board is empty but cannot read the codebase to find "
        "what is worth fixing. It would file a placeholder that looks like a "
        "shot. An empty board is a visible problem; hollow issues are an "
        "invisible one."
    ),
    "FIX_QUEUE_ACCESS": (
        "the queue is unreadable, which is an auth or network failure. Retrying "
        "it automatically hides an outage behind a loop."
    ),
    "CALL_OWNER": "by definition a human decision",
}


def read_call() -> dict:
    """Take the rotation's JSON if it has one, otherwise parse its markdown."""
    r = subprocess.run(
        ["npm", "run", "mission:rotation:json", "--silent"],
        capture_output=True, text=True, timeout=120, cwd=REPO,
    )
    if r.returncode == 0 and r.stdout.strip():
        try:
            return json.loads(r.stdout)
        except ValueError:
            pass

    r = subprocess.run(
        ["npm", "run", "mission:rotation", "--silent"],
        capture_output=True, text=True, timeout=120, cwd=REPO,
    )
    text = r.stdout
    action = re.search(r"Action:\s*`([A-Z_]+)`", text)
    reason = re.search(r"Reason:\s*(.+)", text)
    owner = re.search(r"Owner needed:\s*`?(\w+)", text)
    return {
        "action": action.group(1) if action else "NONE",
        "reason": reason.group(1).strip() if reason else "",
        "owner_needed": bool(owner and owner.group(1).lower() in ("true", "yes")),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Run the rotation call, if it is reversible.")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    call = read_call()
    action = str(call.get("action") or "NONE").upper()
    reason = call.get("reason", "")

    print()
    print(f"  CALL: {action}")
    if reason:
        print(f"  why:  {reason[:110]}")
    print()

    # An owner-needed call is never auto-applied, whatever the action says.
    if call.get("owner_needed"):
        print("  HELD — the call is marked owner-needed. Not automating a human decision.")
        return 2

    if action in NO_OP:
        print(f"  NOTHING TO RUN — {NO_OP[action]}")
        return 0

    if action in REFUSE:
        print(f"  REFUSED — {REFUSE[action]}")
        print("  This is deliberate, not a gap. A human or an agent takes this one.")
        return 2

    if action not in AUTO_APPLY:
        # Unknown means new. Refusing an unrecognised action is the only safe
        # default: the alternative is running a command nobody has reviewed.
        print(f"  REFUSED — '{action}' is not on the reversible list.")
        print("  Add it deliberately after deciding what undoing it costs.")
        return 2

    cmd, why_safe = AUTO_APPLY[action]
    if not args.apply:
        print(f"  WOULD RUN — {' '.join(cmd[-2:])}")
        print(f"  safe because: {why_safe}")
        print("\n  re-run with --apply")
        return 0

    print(f"  RUNNING — safe because: {why_safe}")
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, timeout=300)
    for line in (r.stdout or "").strip().split("\n"):
        if line.strip():
            print(f"    {line}")
    if r.returncode != 0:
        # Never swallow it. A failed action reported as applied is the exact
        # failure this whole system exists to prevent.
        print(f"  FAILED — exit {r.returncode}")
        for line in (r.stderr or "").strip().split("\n")[:4]:
            print(f"    {line}")
        return 1

    print("  APPLIED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
