#!/bin/bash
# SAL0MANder autonomous work loop.
#
# Wakes up on a schedule, does a bounded batch of real web work, verifies it,
# commits it, and pushes.
#
# Every path here is absolute on purpose. launchd runs jobs with a minimal PATH
# that does not include a login shell's additions, so anything resolved by name
# would work when tested by hand and fail silently at 3am.

set -uo pipefail

REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
CLAUDE="/Users/samuel_saldivar/.local/bin/claude"
GIT="/usr/bin/git"
LOG_DIR="$REPO/docs/coordination/runs/logs"
LOCK="$REPO/docs/coordination/.work-loop.lock"
PAUSE="$HOME/.sal0mander/PAUSE"
# Instructions default to the real review loop. Pass a path to run something
# else through the SAME pipeline — that is the point of the canary: proving a
# different script works proves nothing about this one.
#
#   bash scripts/sal0-work-loop.sh                       # real work
#   bash scripts/sal0-work-loop.sh docs/coordination/ops/CANARY-TASK.md
SKILL="${1:-$HOME/.claude/scheduled-tasks/sal0mander-claude-review-loop/SKILL.md}"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$LOG_DIR/work-loop-$STAMP.log"
exec >>"$LOG" 2>&1

echo "=== SAL0MANder work loop $STAMP ==="

# The brake lives outside the repo so no git operation can remove it.
if [ -f "$PAUSE" ]; then
  echo "PAUSED by $PAUSE: $(cat "$PAUSE" 2>/dev/null)"
  exit 0
fi

# Stale-lock recovery: a killed run must not wedge every future one.
if [ -f "$LOCK" ]; then
  OLD_PID="$(cat "$LOCK" 2>/dev/null || echo '')"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "already running as PID $OLD_PID — exiting"
    exit 0
  fi
  echo "REPAIR: cleared stale lock from dead PID ${OLD_PID:-unknown}"
  rm -f "$LOCK"
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT INT TERM HUP

cd "$REPO" || { echo "FATAL: repo missing"; exit 1; }

BEFORE="$($GIT rev-parse HEAD)"
BRANCH="$($GIT rev-parse --abbrev-ref HEAD)"
echo "branch: $BRANCH  head: $BEFORE"

# Refuse to start on a dirty tree.
#
# This is not caution, it is a bug fix. Run 20260819T035153Z started while a
# human's edit to src/app/RouteError.tsx was uncommitted, and `git add -A`
# swept it into a commit labelled as the loop's own work. The loop cannot tell
# its output from anyone else's once it starts, so the only honest moment to
# check is before.
PRE_DIRTY="$($GIT status --porcelain)"
if [ -n "$PRE_DIRTY" ]; then
  echo "BLOCKED - NEED OWNER — working tree was already dirty before this run:"
  echo "$PRE_DIRTY"
  echo "Refusing to start. Commit or stash the existing changes, then re-run."
  echo "=== end $STAMP (refused) ==="
  exit 1
fi

if [ ! -f "$SKILL" ]; then
  echo "FATAL: work instructions missing at $SKILL"
  exit 1
fi

if [ ! -x "$CLAUDE" ]; then
  echo "FATAL: claude not executable at $CLAUDE"
  exit 1
fi

# acceptEdits so it can write code without a human approving each edit.
# A loop that stops to ask is not a loop.
"$CLAUDE" -p "$(cat "$SKILL")" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
  --output-format json > "$LOG_DIR/work-loop-$STAMP.json"
EXIT=$?
echo "claude exit code: $EXIT"

# The worker is told NOT to commit, so HEAD never moves on its own. Its output
# arrives as an uncommitted working tree — that is what has to be looked at.
# Comparing HEAD before and after can only ever report NOTHING CHANGED.
DIRTY="$($GIT status --porcelain)"

if [ -z "$DIRTY" ]; then
  echo "ONE THING THAT CHANGED: NOTHING CHANGED"
  echo "=== end $STAMP (exit $EXIT) ==="
  exit 0
fi

FILES="$(echo "$DIRTY" | wc -l | tr -d ' ')"
echo "worker changed $FILES file(s):"
echo "$DIRTY"

# The gate. Exit code, never the text.
npm run verify >"$LOG_DIR/verify-$STAMP.log" 2>&1
VERIFY=$?
echo "npm run verify exit: $VERIFY"

if [ "$VERIFY" -ne 0 ]; then
  echo "ONE THING THAT CHANGED: BLOCKED - NEED OWNER — verify exited $VERIFY"
  echo "Nothing committed. Working tree left as-is on purpose; read the diff."
  echo "verify log: $LOG_DIR/verify-$STAMP.log"
  echo "=== end $STAMP (exit $EXIT) ==="
  exit 1
fi

$GIT add -A
$GIT commit -q -m "web: automated work loop $STAMP

Task instructions: $SKILL
npm run verify exit 0 before commit."
AFTER="$($GIT rev-parse HEAD)"

echo "ONE THING THAT CHANGED: COMMITTED ${AFTER:0:8} — $FILES file(s), verify passed"
$GIT --no-pager log --oneline -1

if $GIT push origin "$BRANCH"; then
  echo "pushed"
else
  echo "ONE THING STILL UNVERIFIED: PUSH FAILED — commit ${AFTER:0:8} is local only"
  echo "BLOCKED - NEED OWNER — GitHub did not receive the commit. Other agents cannot see it."
  echo "=== end $STAMP (exit 1) ==="
  exit 1
fi

# Report back on the issue that generated the work. GitHub Issues are the one
# channel every agent reads without a human relaying it, and a queue nobody
# reports into is a queue nobody can trust.
ISSUE="$(grep -m1 'Work GitHub issue #' "$SKILL" 2>/dev/null | grep -o '[0-9]\+' | head -1 || true)"
if [ -n "${ISSUE:-}" ] && command -v gh >/dev/null 2>&1; then
  if gh issue comment "$ISSUE" --repo Samco1983/SAL0MANder-Web --body "Automated work loop \`$STAMP\`

**ONE THING THAT CHANGED:** COMMITTED \`${AFTER:0:8}\` — $FILES file(s), \`npm run verify\` exit 0

Files touched:
\`\`\`
$(echo "$DIRTY" | head -20)
\`\`\`

https://github.com/Samco1983/SAL0MANder-Web/commit/$AFTER" >/dev/null 2>&1; then
    echo "commented on issue #$ISSUE"
  else
    echo "issue comment failed"
  fi
fi

# Reaches a screen without anyone opening a terminal.
if command -v osascript >/dev/null 2>&1; then
  osascript -e "display notification \"$FILES file(s) committed ${AFTER:0:8}\" with title \"SAL0MANder work loop\"" >/dev/null 2>&1 || true
fi

echo "=== end $STAMP (exit $EXIT) ==="
