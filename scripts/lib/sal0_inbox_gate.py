#!/usr/bin/env python3
"""Make a message addressed to you impossible to walk past.

Every coordination mechanism here that worked was a gate. The commit-msg hook
took unsigned commits from 56% to 7%. The collision gate caught its own author
twenty minutes after it was written. Every mechanism that was a *document* got
skipped — including by the agent that wrote it, an hour later.

INBOX.md is a document. A question addressed to a teammate sits there being
optional, and the teammate keeps shooting. Tonight a direct ask went unanswered
while both agents committed eleven times.

So: an unanswered question addressed to YOU stops your next commit. Not because
answering is more important than shooting, but because a question nobody is
required to see is a question nobody asked.

    python3 scripts/lib/sal0_inbox_gate.py --mine SAL0-01     # what is waiting
    python3 scripts/lib/sal0_inbox_gate.py --mine SAL0-01 --ack "<subject>"
"""

from __future__ import annotations

import argparse
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INBOX = os.path.join(REPO, "docs", "coordination", "INBOX.md")

# "### SAL0-04 → SAL0-01 · what do you actually need from me?"
HEADER = re.compile(r"^###\s+(SAL0-\d+)\s*(?:→|->)\s*(SAL0-\d+)\s*[·:-]\s*(.+?)\s*$", re.M)
ACK = re.compile(r"^\s*(?:ACK|ANSWERED)\b", re.M | re.I)
ASK = re.compile(r"^\s*ASK:\s*(.+?)\s*$", re.M | re.I)
NONBLOCKING = re.compile(r"\bnot blocking\b", re.I)


def unanswered(mine: str) -> list[dict]:
    """Messages addressed to `mine` whose section carries no ACK."""
    if not os.path.exists(INBOX):
        return []
    with open(INBOX, encoding="utf-8") as handle:
        text = handle.read()
    marks = list(HEADER.finditer(text))
    out = []
    for i, m in enumerate(marks):
        sender, to, subject = m.group(1), m.group(2), m.group(3)
        if to != mine:
            continue
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        body = text[m.end():end]
        if ACK.search(body):
            continue
        ask = ASK.search(body)
        if not ask or ask.group(1).strip().upper() in {"NONE", "NO", "N/A"}:
            continue
        if NONBLOCKING.search(body):
            continue
        out.append({"from": sender, "subject": subject})
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Refuse to let a question addressed to you go unread.")
    ap.add_argument("--mine", default=os.environ.get("SAL0_AGENT", ""),
                    help="your signature, e.g. SAL0-04")
    ap.add_argument("--ack", help="mark a message answered by subject substring")
    args = ap.parse_args()

    mine = args.mine.strip()
    if not mine:
        # Without a signature there is nobody to address, and blocking an
        # unconfigured teammate is worse than the message going unread.
        return 0

    if args.ack:
        with open(INBOX, encoding="utf-8") as handle:
            text = handle.read()
        marks = list(HEADER.finditer(text))
        for i, m in enumerate(marks):
            if m.group(2) == mine and args.ack.lower() in m.group(3).lower():
                insert = m.end()
                text = text[:insert] + f"\n\nACK by {mine}." + text[insert:]
                open(INBOX, "w", encoding="utf-8").write(text)
                print(f"  acknowledged: {m.group(3)[:60]}")
                return 0
        print(f"  no unanswered message to {mine} matching {args.ack!r}", file=sys.stderr)
        return 1

    waiting = unanswered(mine)
    if not waiting:
        return 0

    print()
    print(f"  {len(waiting)} question(s) addressed to {mine} with no reply:")
    for w in waiting:
        print(f"    from {w['from']}: {w['subject'][:66]}")
    print()
    print("  Answer in docs/coordination/INBOX.md, or if it needs no answer:")
    print(f"    python3 scripts/lib/sal0_inbox_gate.py --mine {mine} --ack \"<part of the subject>\"")
    print()
    return 1


if __name__ == "__main__":
    sys.exit(main())
