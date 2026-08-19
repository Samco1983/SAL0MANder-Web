#!/bin/bash
# SAL0MANder Control Room — one screen, real data, read only.
#
# Answers, without anyone being asked: who worked, what actually changed, what
# is queued, what ran, what it cost, and what is broken right now.
#
# Every number here comes from git, the GitHub API, the run ledger, or the
# filesystem. Nothing is self-reported by an agent, because a field an agent
# types is a field an agent can invent.
#
# Actors are told apart by commit trailer:
#   Co-Authored-By: Claude Opus 5   -> Claude (SAL0-04)
#   "web: automated work loop"      -> the loop itself
#   everything else on this branch  -> Codex (SAL0-01/02)

set -uo pipefail

REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
REPO_SLUG="Samco1983/SAL0MANder-Web"
SINCE="${1:-24 hours ago}"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"
cd "$REPO" || { echo "REPO NOT FOUND"; exit 1; }

hr() { printf '%.0s─' {1..66}; echo; }

echo
echo "  SAL0MANDER CONTROL ROOM"
echo "  $(date '+%Y-%m-%d %H:%M %Z')   ·   window: $SINCE"
hr

# ── Who worked ──────────────────────────────────────────────────────────────
CLAUDE_N=$(git log --since="$SINCE" --format='%(trailers:key=Co-Authored-By,valueonly)' | grep -c 'Claude Opus' || true)
LOOP_N=$(git log --since="$SINCE" --format='%s' | grep -c '^web: automated work loop' || true)
TOTAL_N=$(git log --since="$SINCE" --oneline | wc -l | tr -d ' ')
CODEX_N=$(( TOTAL_N - CLAUDE_N - LOOP_N ))
[ "$CODEX_N" -lt 0 ] && CODEX_N=0

FILES_N=$(git log --since="$SINCE" --name-only --format='' | sort -u | grep -c . || true)

echo "  WHO WORKED"
printf "    %-24s %3d commit(s)\n" "Claude (SAL0-04)" "$CLAUDE_N"
printf "    %-24s %3d commit(s)\n" "Codex (SAL0-01/02)" "$CODEX_N"
printf "    %-24s %3d commit(s)\n" "Work loop (unattended)" "$LOOP_N"
printf "    %-24s %3d file(s) touched\n" "TOTAL" "$FILES_N"
echo
echo "    Most recent:"
git --no-pager log --since="$SINCE" --format='      %h %ad  %s' --date=format:'%H:%M' | head -6
hr

# ── The queue ───────────────────────────────────────────────────────────────
echo "  WORK QUEUE  (github issues)"
if command -v gh >/dev/null 2>&1; then
  if ISSUE_JSON=$(gh issue list --repo "$REPO_SLUG" --state open --json number,title,labels --limit 100 2>/dev/null); then
    printf '%s\n' "$ISSUE_JSON" | python3 -c '
import json, sys
try:
    issues = json.load(sys.stdin)
except Exception:
    issues = []
web = [i for i in issues if "[WEB]" in i["title"].upper()]

def state(i):
    names = [l["name"].lower() for l in i.get("labels", [])]
    if "blocked" in names:
        return "BLOCKED"
    if "in-progress" in names:
        return "CLAIMED"
    return "open"

free = sorted([i for i in web if state(i) == "open"], key=lambda x: x["number"])
print("    %d open [WEB] issue(s), %d unclaimed" % (len(web), len(free)))
print()
for i in sorted(web, key=lambda x: x["number"])[:6]:
    print("      #%-3d [%s] %s" % (i["number"], state(i), i["title"][:52]))
print()
print("    NEXT UP: #%d" % free[0]["number"] if free else "    NEXT UP: nothing unclaimed")
'
  else
    echo "    (could not read issues)"
  fi
else
  echo "    gh not available"
fi
hr

# ── The loop ────────────────────────────────────────────────────────────────
echo "  UNATTENDED RUNS"
LOG_DIR="$REPO/docs/coordination/runs/logs"
if [ -d "$LOG_DIR" ] && ls "$LOG_DIR"/work-loop-*.log >/dev/null 2>&1; then
  RUNS=$(ls "$LOG_DIR"/work-loop-*.log 2>/dev/null | wc -l | tr -d ' ')
  COMMITTED=$(grep -l "ONE THING THAT CHANGED: COMMITTED" "$LOG_DIR"/work-loop-*.log 2>/dev/null | wc -l | tr -d ' ')
  NOTHING=$(grep -l "ONE THING THAT CHANGED: NOTHING CHANGED" "$LOG_DIR"/work-loop-*.log 2>/dev/null | wc -l | tr -d ' ')
  BLOCKED=$(grep -l "BLOCKED - NEED OWNER" "$LOG_DIR"/work-loop-*.log 2>/dev/null | wc -l | tr -d ' ')
  printf "    %d run(s): %d committed · %d nothing changed · %d blocked\n" "$RUNS" "$COMMITTED" "$NOTHING" "$BLOCKED"
  if [ "$RUNS" -gt 0 ]; then
    PCT=$(( COMMITTED * 100 / RUNS ))
    echo "    hit rate: ${PCT}% of runs produced a commit"
    [ "$PCT" -lt 50 ] && echo "    ^ under half. A loop that mostly changes nothing is burning money."
  fi
  echo
  echo "    Last run:"
  tail -4 "$(ls -t "$LOG_DIR"/work-loop-*.log | head -1)" | sed 's/^/      /'
else
  echo "    no work-loop runs yet"
fi
hr

# ── Spend and decisions ─────────────────────────────────────────────────────
echo "  MISSION CONTROL LEDGER"
LEDGER="$REPO/docs/coordination/runs/ledger.jsonl"
if [ -f "$LEDGER" ]; then
  ENTRIES=$(wc -l < "$LEDGER" | tr -d ' ')
  # grep -c already prints 0 when it matches nothing; `|| echo 0` on top of that
  # appends a second line and breaks every arithmetic test downstream.
  CALLS=$(grep -c '"modelCalls":[1-9]' "$LEDGER" 2>/dev/null | head -1)
  CALLS=${CALLS:-0}
  echo "    $ENTRIES run(s), $CALLS of them called a model"
  [ "$CALLS" -eq 0 ] && echo "    ^ zero model calls: Mission Control has been running and deciding nothing."
else
  echo "    no ledger"
fi
hr

# ── What is actually running ────────────────────────────────────────────────
echo "  SCHEDULED RIGHT NOW"
INSTALLED=$(ls ~/Library/LaunchAgents/ 2>/dev/null | grep -c "sal0mander" || true)
if [ "$INSTALLED" -gt 0 ]; then
  echo "    launchd: $INSTALLED sal0mander job(s) installed"
  launchctl list 2>/dev/null | grep -i sal0mander | sed 's/^/      /'
else
  echo "    launchd: NOT INSTALLED — nothing wakes up on its own"
fi
for f in "$HOME"/.codex/automations/*/automation.toml; do
  [ -f "$f" ] || continue
  id="$(grep -m1 '^id' "$f" | cut -d'"' -f2)"
  st="$(grep -m1 '^status' "$f" | cut -d'"' -f2)"
  rr="$(grep -m1 '^rrule' "$f" | cut -d'"' -f2)"
  printf "    codex: %-42s %s  %s\n" "$id" "$st" "$rr"
done
if [ -f "$HOME/.sal0mander/PAUSE" ]; then
  echo
  echo "    *** PAUSED: $(cat "$HOME/.sal0mander/PAUSE") ***"
fi
hr

# ── What is broken ──────────────────────────────────────────────────────────
echo "  BROKEN OR BLOCKED"
ANY=0
DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$DIRTY" -gt 0 ]; then
  echo "    · working tree dirty ($DIRTY file(s)) — the loop will refuse to start"
  ANY=1
fi
AHEAD=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
if [ "$AHEAD" -gt 0 ]; then
  echo "    · $AHEAD commit(s) unpushed — invisible to every other agent"
  ANY=1
fi
if [ "$INSTALLED" -eq 0 ]; then
  echo "    · no launchd job installed — nothing runs unattended"
  ANY=1
fi
command -v gemini >/dev/null 2>&1 || { echo "    · gemini CLI not installed — SAL0-07 seat empty"; ANY=1; }
[ "$ANY" -eq 0 ] && echo "    nothing"
hr

# ── The coach ───────────────────────────────────────────────────────────────
# Players inside the game cannot see the shape of it. This section says the
# uncomfortable thing rather than printing another number.
echo "  THE COACH SEES"

PRODUCT=$(git log --since="$SINCE" --name-only --format='' | grep -c '^src/' || true)
PLUMBING=$(git log --since="$SINCE" --name-only --format='' | grep -cE '^(scripts/|docs/coordination/)' || true)

if [ "$PLUMBING" -gt 0 ] && [ "$PRODUCT" -eq 0 ]; then
  echo "    · $PLUMBING changes to plumbing, ZERO to src/. You built the machine"
  echo "      and shipped no product. The queue did not move."
elif [ "$PLUMBING" -gt $(( PRODUCT * 3 )) ] && [ "$PRODUCT" -gt 0 ]; then
  echo "    · plumbing $PLUMBING vs product $PRODUCT — better than three to one"
  echo "      spent on the machine rather than the thing it is meant to build."
fi

if command -v gh >/dev/null 2>&1; then
  QUEUE=$(gh issue list --repo "$REPO_SLUG" --state open --limit 100 --json number --jq 'length' 2>/dev/null || echo "?")
  CLOSED=$(gh issue list --repo "$REPO_SLUG" --state closed --limit 100 --json closedAt --jq "[.[] | select(.closedAt > \"$(date -u -v-1d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo 2000-01-01T00:00:00Z)\")] | length" 2>/dev/null || echo 0)
  echo "    · queue: $QUEUE open, $CLOSED closed in this window."
  [ "$CLOSED" = "0" ] && echo "      Nothing was finished. Motion is not progress."
fi

if [ -f "$REPO/docs/coordination/BLOCKERS.md" ]; then
  SELF=$(git log --since="$SINCE" --format='%s' | grep -ciE '^council: fix|^council: stop|^council: correct' || true)
  echo "    · $SELF commit(s) were fixing our own mistakes."
  echo "      Rebounds by the other agent: check the blocker report. Self-caught"
  echo "      does not count — the misses nobody sees are the shooter's blind spot."
fi

[ "$INSTALLED" -eq 0 ] && {
  echo "    · nothing is scheduled. Everything above happened because a human"
  echo "      was awake and typing. That is the whole problem, unchanged."
}
hr
echo
