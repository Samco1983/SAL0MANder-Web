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
SKILL="$HOME/.claude/scheduled-tasks/sal0mander-claude-review-loop/SKILL.md"

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

AFTER="$($GIT rev-parse HEAD)"

# The one field a healthy-looking log cannot fake.
if [ "$BEFORE" = "$AFTER" ]; then
  echo "ONE THING THAT CHANGED: NOTHING CHANGED"
else
  COMMITS="$($GIT rev-list --count "$BEFORE..$AFTER")"
  FILES="$($GIT diff --name-only "$BEFORE..$AFTER" | wc -l | tr -d ' ')"
  echo "ONE THING THAT CHANGED: $COMMITS commit(s), $FILES file(s)"
  $GIT --no-pager log --oneline "$BEFORE..$AFTER"
  $GIT push origin "$BRANCH" && echo "pushed" || echo "PUSH FAILED"
fi

echo "=== end $STAMP (exit $EXIT) ==="
