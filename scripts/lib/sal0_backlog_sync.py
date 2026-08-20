#!/usr/bin/env python3
"""Put the findings we already have onto the board the picker actually reads.

The board went empty tonight while five fully-analysed defects sat in
OPEN-ITEMS.md. Not one was a GitHub issue, so the picker could not see them and
Mission Control reported an empty queue — which is true of the board and false
of the work.

That is the whole bug: findings are written in markdown, and the queue is read
from GitHub. Nothing joins them.

WHY THIS RATHER THAN GENERATING SHOTS. An auto-generated issue is vague by
construction — #15 was benched after fourteen failures for exactly that reason.
These items are not generated: each was investigated, has a severity, a
consequence, and usually a proposed fix. Promoting a real finding beats
inventing a plausible one, every time, and this needs no model to do it.

    python3 scripts/lib/sal0_backlog_sync.py            # what is missing
    python3 scripts/lib/sal0_backlog_sync.py --apply    # create them
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SLUG = "Samco1983/SAL0MANder-Web"
ITEMS = os.path.join(REPO, "docs", "coordination", "OPEN-ITEMS.md")

HEADING = re.compile(r"^## (W-\d+)\s*—\s*(.+?)\s*$", re.M)
# An item that says RESOLVED in its heading is done, whatever colour it carries.
RESOLVED = re.compile(r"RESOLVED", re.I)


def sh(cmd: list[str], timeout: int = 90) -> tuple[int, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=REPO)
        return r.returncode, r.stdout.strip()
    except Exception as e:
        return 1, str(e)


def parse_items() -> list[dict]:
    """Every unresolved W-item, with the body that was already written for it."""
    if not os.path.exists(ITEMS):
        return []
    text = open(ITEMS, encoding="utf-8").read()
    marks = list(HEADING.finditer(text))
    out = []
    for i, m in enumerate(marks):
        key, title = m.group(1), m.group(2)
        if RESOLVED.search(title):
            continue
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        body = text[m.end():end].strip()
        out.append({"key": key, "title": title.strip(), "body": body})
    return out


def existing_keys() -> tuple[set[str], bool]:
    """W-keys already on the board. Returns (keys, ok) — an unreadable board is
    not an empty one, and must never be treated as one."""
    code, raw = sh(["gh", "issue", "list", "--repo", SLUG, "--state", "all",
                    "--limit", "200", "--json", "title,body"])
    if code != 0 or not raw:
        return set(), False
    try:
        issues = json.loads(raw)
    except ValueError:
        return set(), False
    keys = set()
    for i in issues:
        for m in re.finditer(r"\bW-\d+\b", (i.get("title") or "") + " " + (i.get("body") or "")):
            keys.add(m.group(0))
    return keys, True


def strip_emoji(s: str) -> str:
    return re.sub(r"[\U0001F300-\U0001FAFF☀-➿️]", "", s).strip()


def main() -> int:
    ap = argparse.ArgumentParser(description="Promote tracked findings onto the board.")
    ap.add_argument("--apply", action="store_true", help="create the missing issues")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    items = parse_items()
    have, ok = existing_keys()
    if not ok:
        print("  could not read the board — refusing to act.", file=sys.stderr)
        print("  An unreadable queue is not an empty queue, and treating it as one", file=sys.stderr)
        print("  would file duplicates of every finding.", file=sys.stderr)
        return 2

    missing = [i for i in items if i["key"] not in have]

    if args.json:
        print(json.dumps({"tracked": len(items), "on_board": len(items) - len(missing),
                          "missing": [i["key"] for i in missing]}, indent=2))
        return 1 if missing else 0

    print()
    print(f"  {len(items)} unresolved findings tracked · {len(items) - len(missing)} on the board")
    print()
    if not missing:
        print("  Every tracked finding is on the board. An empty queue here means")
        print("  genuinely nothing is known, not that something was lost.")
        print()
        return 0

    for i in missing:
        print(f"    {i['key']}  {strip_emoji(i['title'])[:64]}")
    print()

    if not args.apply:
        print(f"  {len(missing)} finding(s) invisible to the picker. Re-run with --apply.")
        print()
        return 1

    made = 0
    for i in missing:
        title = f"[WEB] {i['key']} — {strip_emoji(i['title'])}"
        body = (
            f"{i['body']}\n\n---\n\n"
            f"Promoted from `docs/coordination/OPEN-ITEMS.md` ({i['key']}) by "
            f"`mission:backlog --apply`.\n\n"
            f"This is a **tracked finding**, not a generated shot: it was investigated "
            f"and written up before it reached the board. If it carries a proposed fix, "
            f"that fix is above and may need an owner decision before work starts.\n\n"
            f"Sal0-From: SAL0-04\n"
        )
        code, out = sh(["gh", "issue", "create", "--repo", SLUG,
                        "--title", title, "--body", body])
        if code != 0:
            # Never swallow it. A finding reported as filed and not filed is
            # worse than one nobody promoted.
            print(f"    FAILED {i['key']}: {out[:120]}")
            continue
        made += 1
        print(f"    created {i['key']} → {out.splitlines()[-1] if out else ''}")

    print()
    print(f"  promoted {made} of {len(missing)}")
    print()
    return 0 if made == len(missing) else 1


if __name__ == "__main__":
    sys.exit(main())
