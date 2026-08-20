#!/usr/bin/env python3
"""Measure which agent actually scores in which category.

Rotation currently routes by DECLARED lane — Codex takes plumbing, Claude takes
web — and nobody has ever checked whether the declaration matches the evidence.
A roster is a hypothesis until someone counts.

This counts. For every closed issue it finds the commit that closed it, reads
the `Sal0-From` trailer on that commit, and buckets by the issue's category.
The output is measured fit, which is the input rotation should use instead of a
lane written down on day one.

What it deliberately does NOT do: recommend a roster change. A small sample says
less than it appears to, and one agent having closed more issues in a category
usually means it was handed more of them, not that it is better at them. This
prints the counts and the caveat; a human or a coach decides.

    python3 scripts/lib/sal0_fit.py           # the table
    python3 scripts/lib/sal0_fit.py --json    # machine readable
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

# Same buckets the shot queue uses, so fit and selection speak one language.
CATEGORIES = [
    ("PRODUCT", re.compile(r"\bbuild\b|component|surface|navigation|entry point|page|ux", re.I)),
    ("TEST", re.compile(r"\btest|coverage|regression|containment|invariant\b", re.I)),
    ("AUTOMATION", re.compile(r"mission|loop|scheduler|launchd|supervisor|automation|script", re.I)),
    ("CLEANUP", re.compile(r"harden|refactor|cleanup|tidy|consolidat", re.I)),
    ("DOCS", re.compile(r"audit|analysis|specification|wireframe|blueprint|document|record", re.I)),
]

# "Closed by `abc1234`." — the convention every close comment here follows.
CLOSED_BY = re.compile(r"[Cc]losed by [`']?([0-9a-f]{7,40})")

# Below this, differences are noise. Named rather than hidden, because a table
# that looks confident on four data points is worse than no table.
MEANINGFUL = 5


def categorise(title: str) -> str:
    for name, pattern in CATEGORIES:
        if pattern.search(title):
            return name
    return "DOCS"


def gh(args: list[str]) -> str:
    try:
        r = subprocess.run(["gh", *args], capture_output=True, text=True, timeout=60, cwd=REPO)
        return r.stdout if r.returncode == 0 else ""
    except Exception:
        return ""


def commit_author(sha: str) -> str:
    """Read the agent mark off a commit. Unsigned is reported, never guessed."""
    try:
        r = subprocess.run(
            ["git", "log", "-1", "--format=%(trailers:key=Sal0-From,valueonly)%n%(trailers:key=Co-Authored-By,valueonly)", sha],
            capture_output=True, text=True, timeout=20, cwd=REPO,
        )
        text = r.stdout
        if m := re.search(r"(SAL0-\d+)", text):
            return m.group(1)
        if "Claude Opus" in text:
            return "SAL0-04"
        return "UNSIGNED"
    except Exception:
        return "UNSIGNED"


def collect() -> dict:
    raw = gh(["issue", "list", "--repo", REPO_SLUG, "--state", "closed",
              "--limit", "100", "--json", "number,title,comments"])
    try:
        issues = json.loads(raw) if raw.strip() else []
    except ValueError:
        issues = []

    table: dict[str, dict[str, int]] = {}
    unattributed = 0

    for issue in issues:
        title = issue.get("title", "")
        if "[WEB]" not in title.upper() and "[COORD]" not in title.upper():
            continue
        category = categorise(title)

        sha = None
        for comment in issue.get("comments", []):
            if m := CLOSED_BY.search(comment.get("body", "")):
                sha = m.group(1)
                break

        agent = commit_author(sha) if sha else "UNATTRIBUTED"
        if agent in ("UNATTRIBUTED", "UNSIGNED"):
            unattributed += 1
            continue

        table.setdefault(agent, {}).setdefault(category, 0)
        table[agent][category] += 1

    scored = sum(sum(v.values()) for v in table.values())
    return {
        "by_agent": table,
        "attributed": scored,
        "unattributed": unattributed,
        "meaningful": scored >= MEANINGFUL,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Measured agent-category fit.")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    data = collect()
    if args.json:
        print(json.dumps(data, indent=2))
        return 0

    cats = [c[0] for c in CATEGORIES]
    print()
    print("  MEASURED FIT — issues closed, by agent and category")
    print(f"  {'-' * 62}")
    print(f"    {'AGENT':<10}" + "".join(f"{c[:9]:>11}" for c in cats))
    for agent, counts in sorted(data["by_agent"].items()):
        row = "".join(f"{counts.get(c, 0):>11}" for c in cats)
        print(f"    {agent:<10}{row}")
    print()
    print(f"  attributed: {data['attributed']}   unattributed: {data['unattributed']}")
    print()

    if not data["meaningful"]:
        print(f"  Too few closes ({data['attributed']}) to mean anything. Below {MEANINGFUL}")
        print("  this is a record, not a signal.")
    else:
        print("  Read with care: a higher count usually means an agent was HANDED")
        print("  more of that category, not that it is better at it. Use this to")
        print("  question the declared roster, never to rewrite it on its own.")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
