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

predict_next_shot() {
  if command -v gh >/dev/null 2>&1; then
    ISSUE="$(gh issue list --repo Samco1983/SAL0MANder-Web --state open --limit 20 \
      --json number,title,labels \
      --jq '[.[] | select(.title | ascii_upcase | contains("[WEB]")) | select([.labels[].name] | index("in-progress") | not) | select([.labels[].name] | index("blocked") | not)][0] | if . then "#\(.number) \(.title)" else empty end' 2>/dev/null || true)"
    if [ -n "$ISSUE" ]; then
      echo "$ISSUE"
      return
    fi
  fi

  if [ -f "$REPO/docs/coordination/OPEN-ITEMS.md" ]; then
    ITEM="$(grep -m1 '^## W-[0-9].*[🔴🟠]' "$REPO/docs/coordination/OPEN-ITEMS.md" 2>/dev/null || true)"
    if [ -n "$ITEM" ]; then
      echo "$ITEM"
      return
    fi
  fi

  echo "Deploy-readiness review: run verify, control-room, blockers, and name one shippable risk."
}

micro_huddle() {
  echo "MICRO-HUDDLE"
  echo "What just happened: $1"
  echo "What changed: $2"
  echo "What did we learn: $3"
  echo "Next receiver: $4"
  next_shot="$5"
  if [ -z "$next_shot" ] || [ "$next_shot" = "auto" ]; then
    next_shot="$(predict_next_shot)"
  fi
  echo "Next shot: $next_shot"
  echo "Stop doing: $6"
}

# The brake lives outside the repo so no git operation can remove it.
if [ -f "$PAUSE" ]; then
  echo "PAUSED by $PAUSE: $(cat "$PAUSE" 2>/dev/null)"
  micro_huddle \
    "Loop found the pause brake before work started." \
    "Nothing changed." \
    "Pause state is respected before any worker can touch the repo." \
    "SAL0-01 or owner" \
    "Read the pause reason and resume only when the condition is true." \
    "Starting a possession while the brake is on."
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
PRE_DIRTY="$($GIT status --porcelain -- . ':(exclude)docs/coordination/runs')"
if [ -n "$PRE_DIRTY" ]; then
  echo "BLOCKED - NEED OWNER — working tree was already dirty before this run:"
  echo "$PRE_DIRTY"
  echo "Refusing to start. Commit or stash the existing changes, then re-run."
  micro_huddle \
    "Loop refused a dirty court before the worker started." \
    "Nothing changed." \
    "Court protection worked; the worker did not inherit somebody else's diff." \
    "current file owner" \
    "auto" \
    "Running a worker on a dirty shared tree."
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
PROMPT="$(printf 'SAL0MANder work-loop instructions:\n\n%s' "$(cat "$SKILL")")"
"$CLAUDE" -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
  --output-format json > "$LOG_DIR/work-loop-$STAMP.json"
EXIT=$?
echo "claude exit code: $EXIT"

# The worker is told NOT to commit, so HEAD never moves on its own. Its output
# arrives as an uncommitted working tree — that is what has to be looked at.
# Comparing HEAD before and after can only ever report NOTHING CHANGED.
DIRTY="$($GIT status --porcelain -- . ':(exclude)docs/coordination/runs')"

if [ -z "$DIRTY" ]; then
  echo "ONE THING THAT CHANGED: NOTHING CHANGED"
  micro_huddle \
    "Worker exited without a repo diff." \
    "Nothing changed." \
    "No shot landed; check whether the task was too vague, blocked, or already done." \
    "SAL0-02" \
    "auto" \
    "Counting an empty run as progress."
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
  micro_huddle \
    "Worker changed files, but verify failed." \
    "Uncommitted diff preserved." \
    "This is a reboundable miss because the failing command and diff are both visible." \
    "SAL0-04 or SAL0-07" \
    "auto" \
    "Hiding a failed verify behind green wording."
  echo "=== end $STAMP (exit $EXIT) ==="
  exit 1
fi

$GIT add -A -- . ':(exclude)docs/coordination/runs'
# Signed, or the referee rejects it — which is what happened on the first real
# run: the commit was blocked, the loop read HEAD, found the PREVIOUS commit,
# and reported COMMITTED for work that was never saved.
if ! $GIT commit -q -m "web: automated work loop $STAMP

Task instructions: $SKILL
npm run verify exit 0 before commit.

Sal0-From: SAL0-04"; then
  echo "ONE THING THAT CHANGED: BLOCKED - NEED OWNER — commit was rejected"
  echo "The worker's changes are still in the working tree. Nothing was lost."
  micro_huddle \
    "Verify passed, but git rejected the commit." \
    "Uncommitted diff preserved." \
    "The referee protected attribution or commit policy." \
    "SAL0-01" \
    "auto" \
    "Claiming saved work when HEAD did not move."
  echo "=== end $STAMP (exit 1) ==="
  exit 1
fi
AFTER="$($GIT rev-parse HEAD)"

# Never report success from HEAD alone. HEAD moves for reasons that have
# nothing to do with this run.
if [ "$AFTER" = "$BEFORE" ]; then
  echo "ONE THING THAT CHANGED: BLOCKED - NEED OWNER — HEAD did not move; nothing was committed"
  micro_huddle \
    "Commit path reported success but HEAD did not move." \
    "Nothing trustworthy changed." \
    "HEAD movement is required evidence; without it there is no made shot." \
    "SAL0-01" \
    "auto" \
    "Self-grading commit success from log text."
  echo "=== end $STAMP (exit 1) ==="
  exit 1
fi

echo "ONE THING THAT CHANGED: COMMITTED ${AFTER:0:8} — $FILES file(s), verify passed"
$GIT --no-pager log --oneline -1

if $GIT push origin "$BRANCH"; then
  echo "pushed"
else
  echo "ONE THING STILL UNVERIFIED: PUSH FAILED — commit ${AFTER:0:8} is local only"
  echo "BLOCKED - NEED OWNER — GitHub did not receive the commit. Other agents cannot see it."
  micro_huddle \
    "Commit landed locally, but push failed." \
    "Local commit ${AFTER:0:8} exists only on this machine." \
    "A local-only score is not visible to the team until GitHub receives it." \
    "SAL0-02" \
    "auto" \
    "Telling other agents to rely on an unpushed commit."
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

micro_huddle \
  "Worker produced a verified, pushed commit." \
  "Commit ${AFTER:0:8}, $FILES file(s), verify passed." \
  "This possession scored because git, tests, and GitHub agree." \
  "SAL0-07 or next queue owner" \
  "auto" \
  "Letting a made shot vanish without a next receiver."

echo "=== end $STAMP (exit $EXIT) ==="
