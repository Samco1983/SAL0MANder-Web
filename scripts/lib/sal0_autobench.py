#!/usr/bin/env python3
"""Act on the assistant's call: bench a shot that keeps missing the same way.

The assistant already detects a repeated failure. Until now a human had to read
that and apply the label — and the one time it was done by hand, the `gh` call
failed silently because the label did not exist, and nobody noticed. A
recommendation nobody executes is not coaching.

    python3 scripts/lib/sal0_autobench.py            # show what it would bench
    python3 scripts/lib/sal0_autobench.py --apply    # actually bench it

Only ever ADDS the `blocked` label and a comment saying why. It never closes an
issue, never edits a body, never touches code. Benching is reversible by
removing a label; that asymmetry is the reason this is safe to automate and
closing would not be.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

import os
from datetime import datetime, timezone

REPO = "Samco1983/SAL0MANder-Web"
SEASON_LOG = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "docs", "coordination", "ops", "SEASON.jsonl",
)
ASSISTANT = "scripts/lib/sal0_bball_assistant.py"
ISSUE_NUM = re.compile(r"#(\d+)")


def gh(args: list[str], timeout: int = 30) -> tuple[int, str, str]:
    """Run gh and return everything. Never swallow stderr — masking it is how a
    failed bench got reported as done."""
    try:
        r = subprocess.run(["gh", *args], capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except FileNotFoundError:
        return 127, "", "gh not installed"
    except subprocess.TimeoutExpired:
        return 124, "", f"gh timed out after {timeout}s"


def read_call() -> list[dict]:
    r = subprocess.run(
        [sys.executable, ASSISTANT, "--json"], capture_output=True, text=True, timeout=120
    )
    if not r.stdout.strip():
        print(f"assistant produced nothing: {r.stderr.strip()[:200]}", file=sys.stderr)
        return []
    try:
        return json.loads(r.stdout).get("repeated_failures", [])
    except ValueError as e:
        print(f"assistant output was not JSON: {e}", file=sys.stderr)
        return []


def ensure_label() -> bool:
    """The one-time failure that made this script necessary: the label did not
    exist, so every edit failed and the error was thrown away."""
    code, out, _ = gh(["label", "list", "--repo", REPO, "--json", "name", "--jq", ".[].name"])
    if code == 0 and "blocked" in out.split("\n"):
        return True
    code, _, err = gh([
        "label", "create", "blocked", "--repo", REPO, "--color", "B60205",
        "--description", "benched: failed repeatedly; schedulers skip it",
    ])
    if code != 0 and "already exists" not in err.lower():
        print(f"could not create the blocked label: {err[:160]}", file=sys.stderr)
        return False
    return True


def already_benched(number: str) -> bool:
    code, out, _ = gh([
        "issue", "view", number, "--repo", REPO, "--json", "labels", "--jq", ".labels[].name",
    ])
    return code == 0 and "blocked" in out.split("\n")


def bench(number: str, failure: dict) -> bool:
    body = (
        f"**Benched automatically by `npm run mission:bball`.**\n\n"
        f"This shot has failed **{failure['times']} times** with `{failure['cause']}`. "
        f"Labelled `blocked` so the scheduled picker skips it.\n\n"
        f"The issue is not necessarily wrong — a repeated identical failure usually "
        f"means the shot is too big for one possession, or it is blocked on something "
        f"outside this lane. Split it into pieces that fit the clock, or record what "
        f"it is waiting on, then remove the label.\n\n"
        f"No single run could have detected this: each one only sees itself."
    )
    code, _, err = gh(["issue", "edit", number, "--repo", REPO, "--add-label", "blocked"])
    if code != 0:
        print(f"  ✗ #{number}: {err[:150]}", file=sys.stderr)
        return False
    gh(["issue", "comment", number, "--repo", REPO, "--body", body])
    return True


def record_bench(number: str, failure: dict) -> None:
    """Write the substitution into the season log.

    A bench with no record is indistinguishable from an issue nobody wanted.
    Six weeks from now the label alone will not say why, and the run logs that
    justified it will have rotated away.
    """
    entry = {
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": "BENCH",
        "issue": int(number),
        "cause": failure.get("cause"),
        "times": failure.get("times"),
        "shot": failure.get("shot", "")[:120],
    }
    try:
        os.makedirs(os.path.dirname(SEASON_LOG), exist_ok=True)
        with open(SEASON_LOG, "a") as fh:
            fh.write(json.dumps(entry) + "\n")
    except OSError as e:
        print(f"  (could not record the bench: {e})", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser(description="Bench shots the assistant says keep missing.")
    ap.add_argument("--apply", action="store_true", help="actually apply the label")
    args = ap.parse_args()

    failures = read_call()
    if not failures:
        print("no repeated failures — nothing to bench")
        return 0

    # One entry per issue: the same shot can fail two different ways, and it
    # only needs benching once. Report the worst reason.
    by_issue: dict[str, dict] = {}
    for f in failures:
        m = ISSUE_NUM.search(f.get("shot", ""))
        if not m:
            continue
        n = m.group(1)
        if n not in by_issue or f["times"] > by_issue[n]["times"]:
            by_issue[n] = f

    if not by_issue:
        print("repeated failures found, but none name an issue number")
        return 0

    if args.apply and not ensure_label():
        return 1

    benched = skipped = 0
    for number, failure in sorted(by_issue.items(), key=lambda kv: int(kv[0])):
        line = f"#{number}  {failure['times']}x {failure['cause']}"
        if not args.apply:
            print(f"  would bench  {line}")
            continue
        if already_benched(number):
            print(f"  already benched  {line}")
            skipped += 1
            continue
        if bench(number, failure):
            record_bench(number, failure)
            print(f"  BENCHED  {line}")
            benched += 1

    if args.apply:
        print(f"\nbenched {benched}, already benched {skipped}")
    else:
        print("\nnothing applied — re-run with --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
