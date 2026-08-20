#!/usr/bin/env python3
"""Check every claimed point against the definition, mechanically.

A definition written in prose is one an agent can read and still get wrong. The
same definition as a script that fails is one nobody can skip. This is the
operational form of "what counts as a point":

    A point is a closed issue whose close comment names a commit,
    where that commit exists on the branch and actually changed files.

Each clause is a test. A close that fails any of them is not a point — it is a
claim, and the difference is the whole reason this project exists.

Nothing here trusts a comment's *words*. "verify passed", "tests green",
"merge confirmed" are all narration; the script re-checks the commit against
git instead of believing the sentence next to it.

    python3 scripts/lib/sal0_verify_points.py           # audit the score
    python3 scripts/lib/sal0_verify_points.py --json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

REPO_SLUG = "Samco1983/SAL0MANder-Web"
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLOSED_BY = re.compile(r"[Cc]losed by [`']?([0-9a-f]{7,40})")


def sh(cmd: list[str], timeout: int = 40) -> tuple[int, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=REPO)
        return r.returncode, r.stdout.strip()
    except Exception as e:
        return 1, str(e)


def check_one(issue: dict) -> dict:
    """Every clause of the definition, as a separate pass/fail."""
    number = issue["number"]
    result = {"issue": number, "title": issue.get("title", "")[:52], "failures": []}

    sha = None
    for c in issue.get("comments", []):
        if m := CLOSED_BY.search(c.get("body", "")):
            sha = m.group(1)
            break

    if not sha:
        result["failures"].append("close comment names no commit")
        result["point"] = False
        return result
    result["commit"] = sha

    # Clause: the commit exists at all. A hash in a comment is not a commit.
    code, _ = sh(["git", "cat-file", "-e", f"{sha}^{{commit}}"])
    if code != 0:
        result["failures"].append(f"commit {sha[:8]} does not exist in this repository")
        result["point"] = False
        return result

    # Clause: it is reachable from the branch. A commit on an abandoned branch
    # is work nobody has.
    code, out = sh(["git", "merge-base", "--is-ancestor", sha, "HEAD"])
    if code != 0:
        result["failures"].append(f"commit {sha[:8]} is not an ancestor of HEAD — not on the branch")

    # Clause: it changed something. A close pointing at an empty commit is a
    # claim wearing a hash.
    #
    # Diff against the FIRST PARENT, not the default. `git show --name-only` on
    # a merge commit lists nothing, because it diffs against every parent at
    # once and reports only conflicts. The first draft of this check used the
    # default and declared 7 of 9 real points fake — every one a merge that had
    # put genuine work on the branch. An audit that cries fraud at correct work
    # gets switched off, and then it protects nothing.
    code, out = sh(["git", "diff", "--name-only", f"{sha}^1", sha])
    files = [f for f in out.split("\n") if f.strip()]
    if code == 0 and not files:
        result["failures"].append(f"commit {sha[:8]} changed no files")
    result["files_changed"] = len(files)

    result["point"] = not result["failures"]
    return result


def audit_points() -> tuple[int, dict]:
    code, raw = sh(["gh", "issue", "list", "--repo", REPO_SLUG, "--state", "closed",
                    "--limit", "100", "--json", "number,title,comments"], timeout=90)
    if code != 0 or not raw:
        return 1, {"error": "could not read closed issues — cannot audit the score"}

    try:
        issues = [i for i in json.loads(raw)
                  if "[WEB]" in i.get("title", "").upper() or "[COORD]" in i.get("title", "").upper()]
    except ValueError:
        return 1, {"error": "unreadable issue list"}

    checked = [check_one(i) for i in issues]
    real = [c for c in checked if c["point"]]
    fake = [c for c in checked if not c["point"]]

    return (0 if not fake else 1), {
        "claimed": len(checked),
        "verified": len(real),
        "unverified": len(fake),
        "failures": fake,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify claimed points against the definition.")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    code, report = audit_points()
    if "error" in report:
        print(report["error"], file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(report, indent=2))
        return code

    print()
    print("  POINT AUDIT — every close re-checked against git")
    print(f"  {'-' * 62}")
    print(f"    claimed:  {report['claimed']}")
    print(f"    verified: {report['verified']}")
    print(f"    NOT verified: {report['unverified']}")
    print()

    if report["failures"]:
        print("  THESE ARE NOT POINTS")
        for f in report["failures"]:
            print(f"    #{f['issue']}  {f['title']}")
            for reason in f["failures"]:
                print(f"          {reason}")
        print()
        print("  A closed issue is not a point on its own. Reopen, or fix the")
        print("  close comment to name the commit that actually carries the work.")
    else:
        print("  Every closed issue names a real commit, on this branch, with files in it.")
        print("  The score is what it says it is.")
    print()
    return code


if __name__ == "__main__":
    sys.exit(main())
