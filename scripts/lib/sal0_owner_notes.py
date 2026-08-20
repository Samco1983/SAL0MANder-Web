#!/usr/bin/env python3
"""Read what the owner wrote, before choosing the next shot.

Communication has been one-directional all night: the agents post to INBOX and
the owner types into a chat window that no scheduled run can see. A possession
that starts at 3am has no way to know he asked for something at 2:55.

This closes that. OWNER-NOTES.md is editable from a phone browser with no
terminal, it lives in the repo, and every possession reads it. An instruction
there outranks the picker — the owner is not a source the coach gets to weigh.

    python3 scripts/lib/sal0_owner_notes.py            # anything new?
    python3 scripts/lib/sal0_owner_notes.py --always
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NOTES = os.path.join(REPO, "docs", "coordination", "OWNER-NOTES.md")
STATE = os.path.join(REPO, "docs", "coordination", "ops", ".owner-notes-state")

MARKER = "<!-- write below this line -->"


def content() -> str:
    if not os.path.exists(NOTES):
        return ""
    text = open(NOTES, encoding="utf-8").read()
    if MARKER in text:
        text = text.split(MARKER, 1)[1]
    # Strip comments so the template itself never reads as an instruction.
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    return text.strip()


def main() -> int:
    ap = argparse.ArgumentParser(description="Read the owner's notes.")
    ap.add_argument("--always", action="store_true")
    args = ap.parse_args()

    body = content()
    if not body:
        if args.always:
            print("\n  Owner has written nothing. Proceed on the picker.\n")
        return 0

    fingerprint = hashlib.sha256(body.encode()).hexdigest()[:16]
    previous = open(STATE, encoding="utf-8").read().strip() if os.path.exists(STATE) else ""
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    open(STATE, "w", encoding="utf-8").write(fingerprint)

    if fingerprint == previous and not args.always:
        return 0   # already acted on; repeating it would drown the new one

    print()
    print("  ** THE OWNER WROTE SOMETHING **")
    print(f"  {'-' * 62}")
    for line in body.split("\n"):
        print(f"    {line}")
    print(f"  {'-' * 62}")
    print("  This outranks the picker. Do this before the next shot.")
    print()
    return 1


if __name__ == "__main__":
    sys.exit(main())
