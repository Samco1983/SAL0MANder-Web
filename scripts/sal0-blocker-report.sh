#!/bin/bash
# Measure the stigmergy experiment. Read only.
#
# The claim: two agents coordinate through published blockers, with no messages
# and no human relay. This script produces the two numbers that settle it:
#
#   TIME TO CLEAR — how long a published blocker sits before someone acts
#   HUMAN RATE    — what fraction were cleared only because a human was asked
#
# A high human rate means the mechanism is not working and the owner is still
# the message bus, whatever the commit count looks like.
#
# Run it repeatedly. One round proves nothing; the shape over days is the data.

set -uo pipefail

REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
FILE="$REPO/docs/coordination/BLOCKERS.md"
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

[ -f "$FILE" ] || { echo "no BLOCKERS.md"; exit 1; }

python3 - "$FILE" <<'PY'
import re, sys
from datetime import datetime, timezone

text = open(sys.argv[1]).read()
blocks = re.split(r"^### ", text, flags=re.M)[1:]
now = datetime.now(timezone.utc)

def field(block, name):
    m = re.search(rf"^{name}:\s*(.*)$", block, flags=re.M)
    return (m.group(1).strip() if m else "")

def parse(ts):
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None

open_n = cleared_n = human_n = 0
durations = []
rows = []

for b in blocks:
    title = b.split("\n", 1)[0].strip()
    opened = parse(field(b, "OPENED"))
    cleared_raw = field(b, "CLEARED")
    human = field(b, "HUMAN").lower()
    if cleared_raw:
        cleared_n += 1
        if human.startswith("yes"):
            human_n += 1
        ct = parse(cleared_raw.split()[0]) if cleared_raw.split() else None
        if opened and ct:
            hrs = (ct - opened).total_seconds() / 3600
            durations.append(hrs)
            rows.append(f"  CLEARED  {title[:52]}  ({hrs:.1f}h, human={human or '?'})")
        else:
            rows.append(f"  CLEARED  {title[:52]}  (human={human or '?'})")
    else:
        open_n += 1
        age = (now - opened).total_seconds() / 3600 if opened else 0
        rows.append(f"  OPEN     {title[:52]}  (waiting {age:.1f}h)")

print()
print("  STIGMERGY EXPERIMENT")
print("  " + "-" * 62)
for r in rows:
    print(r)
print("  " + "-" * 62)
print(f"  open: {open_n}   cleared: {cleared_n}")

if durations:
    print(f"  median time to clear: {sorted(durations)[len(durations)//2]:.1f}h")

if cleared_n:
    rate = human_n * 100 // cleared_n
    print(f"  human involvement: {human_n}/{cleared_n} ({rate}%)")
    print()
    if rate == 0:
        print("  VERDICT: agents cleared every blocker with no human relay.")
        print("           The mechanism is doing real work.")
    elif rate < 50:
        print("  VERDICT: mostly agent-cleared. Mechanism working, human still")
        print("           needed for the cases only a human can do.")
    else:
        print("  VERDICT: majority needed a human. The owner is still the message")
        print("           bus. Commit counts do not change that.")
else:
    print()
    print("  VERDICT: nothing cleared yet. No evidence either way.")
    print("           An unproven mechanism is not a working one.")
print()
PY
