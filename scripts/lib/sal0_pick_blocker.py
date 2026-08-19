#!/usr/bin/env python3
"""Pick the first open blocker this agent is allowed to clear.

Lives in its own file rather than a heredoc inside a command substitution.
Embedding it in the shell script broke bash's parser twice tonight, once via
$'\\x1e' and once via the heredoc itself, each time reporting the error on a
line far from the cause.

Prints three lines — title, why, command — or nothing. Exit 0 either way;
"nothing to do" is not an error.

Usage: sal0_pick_blocker.py <BLOCKERS.md> <agent-alias-regex>
"""

import re
import sys


def field(block: str, name: str) -> str:
    """Read one `NAME:` field from a blocker entry.

    `[^\\S\\n]*` and not `\\s*`: `\\s` matches newlines, so an empty field
    swallows the line break and returns the NEXT field's text as its value.
    That bug made every unclaimed blocker read as cleared and produced a
    report claiming the mechanism worked when nothing had happened.
    """
    match = re.search(rf"^{re.escape(name)}:[^\S\n]*(.*)$", block, flags=re.M)
    return match.group(1).strip() if match else ""


def pick(text: str, aliases: str) -> list[str] | None:
    # The format template lives in a fenced block and looks exactly like an
    # entry. Strip fences before splitting or the template gets picked as work.
    text = re.sub(r"```.*?```", "", text, flags=re.S)

    for block in re.split(r"^### ", text, flags=re.M)[1:]:
        if field(block, "CLEARED"):
            continue
        # Opt in per blocker. Anything not explicitly marked AUTO: yes needs a
        # human to look first, so an agent must not pick it up on a schedule.
        if field(block, "AUTO").lower() != "yes":
            continue
        if not re.search(aliases, field(block, "WHO CAN"), re.I):
            continue

        title = block.split("\n", 1)[0].strip()
        return [title, field(block, "BLOCKED"), field(block, "COMMAND")]
    return None


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: sal0_pick_blocker.py <blockers.md> <alias-regex>", file=sys.stderr)
        return 2
    try:
        text = open(sys.argv[1], encoding="utf-8").read()
    except OSError as error:
        print(f"cannot read blockers: {error}", file=sys.stderr)
        return 1

    picked = pick(text, sys.argv[2])
    if picked:
        # One field per line. Any in-band delimiter has to survive shell
        # quoting, and none of them reliably do.
        for line in picked:
            print(line.replace("\n", " "))
    return 0


if __name__ == "__main__":
    sys.exit(main())
