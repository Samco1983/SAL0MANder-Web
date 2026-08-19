#!/bin/bash
# Run a worker in its own git worktree.
#
# THE PROBLEM THIS SOLVES, from 2026-08-19:
#
#   Every failure that night came from agents sharing one working tree. A
#   `signal: YOURS` commit — meaning "I am not touching this work" — swallowed
#   five staged files from another agent's run. The loop committed a human's
#   uncommitted edit under its own name. A stuck worker jammed the branch for
#   everyone. None of those are possible when the worker has its own tree.
#
# THE RULE THIS ENFORCES:
#
#   The worker does not report its outcome. It changes files. The supervisor
#   reads git and the verify exit code and decides what happened. An agent
#   grading its own homework is how every false success that night occurred.
#
# Usage: sal0-worker-worktree.sh <instructions-file>

set -uo pipefail

REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
CLAUDE="/Users/samuel_saldivar/.local/bin/claude"
GIT="/usr/bin/git"
LOG_DIR="$REPO/docs/coordination/runs/logs"
PAUSE="$HOME/.sal0mander/PAUSE"
WORKTREE_ROOT="$HOME/.sal0mander/worktrees"
INSTRUCTIONS="${1:?usage: sal0-worker-worktree.sh <instructions-file>}"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

mkdir -p "$LOG_DIR" "$WORKTREE_ROOT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$LOG_DIR/worktree-$STAMP.log"
exec >>"$LOG" 2>&1

echo "=== worker worktree run $STAMP ==="

if [ -f "$PAUSE" ]; then
  echo "PAUSED by $PAUSE: $(cat "$PAUSE" 2>/dev/null)"
  exit 0
fi

cd "$REPO" || { echo "FATAL: repo missing"; exit 1; }
BASE_BRANCH="$($GIT rev-parse --abbrev-ref HEAD)"
BASE_COMMIT="$($GIT rev-parse HEAD)"
WORK_BRANCH="worker/$STAMP"
WORKTREE="$WORKTREE_ROOT/$STAMP"

echo "base: $BASE_BRANCH @ ${BASE_COMMIT:0:8}"
echo "worker branch: $WORK_BRANCH"

# Reap worktrees abandoned by a killed run. Same failure shape as a stale lock:
# without this, dead runs accumulate and eventually fill the disk.
$GIT worktree prune
for old in "$WORKTREE_ROOT"/*; do
  [ -d "$old" ] || continue
  age_days=$(( ( $(date +%s) - $(stat -f %m "$old" 2>/dev/null || echo 0) ) / 86400 ))
  if [ "$age_days" -ge 1 ]; then
    echo "REPAIR: removing abandoned worktree $(basename "$old") (${age_days}d old)"
    $GIT worktree remove --force "$old" 2>/dev/null || rm -rf "$old"
  fi
done

if ! $GIT worktree add -b "$WORK_BRANCH" "$WORKTREE" "$BASE_COMMIT" >/dev/null 2>&1; then
  echo "BLOCKED - NEED OWNER — could not create worktree at $WORKTREE"
  exit 1
fi
cleanup() {
  cd "$REPO" 2>/dev/null || return
  $GIT worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"
}
trap cleanup EXIT INT TERM HUP

# A fresh worktree has no node_modules, so `npm run verify` fails on missing
# dependencies and reads as "the worker broke the build" when the folder is
# simply empty. Symlink rather than install: an install per run costs minutes
# and gigabytes, and the dependency set is identical by construction.
if [ -d "$REPO/node_modules" ]; then
  ln -s "$REPO/node_modules" "$WORKTREE/node_modules"
  echo "node_modules: symlinked from main tree"
else
  echo "BLOCKED - NEED OWNER — no node_modules in $REPO to share; run npm install"
  exit 1
fi

cp "$INSTRUCTIONS" "$WORKTREE/.worker-instructions.md" 2>/dev/null || {
  echo "FATAL: instructions missing at $INSTRUCTIONS"; exit 1; }

cd "$WORKTREE" || exit 1

"$CLAUDE" -p "$(cat .worker-instructions.md)" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
  --output-format json > "$LOG_DIR/worktree-$STAMP.json"
WORKER_EXIT=$?
echo "worker exit: $WORKER_EXIT"

# ── Evidence only from here. The worker gets no say in what happened. ────────
rm -f .worker-instructions.md
DIRTY="$($GIT status --porcelain | grep -v '^?? node_modules' || true)"

if [ -z "$DIRTY" ]; then
  echo "ONE THING THAT CHANGED: NOTHING CHANGED"
  echo "=== end $STAMP ==="
  exit 0
fi

FILES="$(echo "$DIRTY" | wc -l | tr -d ' ')"
echo "worker changed $FILES file(s):"
echo "$DIRTY"

npm run verify >"$LOG_DIR/worktree-verify-$STAMP.log" 2>&1
VERIFY=$?
echo "npm run verify exit: $VERIFY"

if [ "$VERIFY" -ne 0 ]; then
  # The branch survives with the work on it. Nothing reaches the base branch,
  # so a bad run cannot jam anyone else.
  $GIT add -A
  $GIT commit -q -m "worker: FAILED VERIFY $STAMP

npm run verify exit $VERIFY. Not merged. Read the diff.

Sal0-From: SAL0-04"
  echo "ONE THING THAT CHANGED: BLOCKED - NEED OWNER — verify exit $VERIFY"
  echo "Work preserved on branch $WORK_BRANCH. Base branch untouched."
  trap - EXIT
  cd "$REPO" && $GIT worktree remove --force "$WORKTREE" 2>/dev/null
  exit 1
fi

$GIT add -A
if ! $GIT commit -q -m "web: worker run $STAMP

Instructions: $(basename "$INSTRUCTIONS")
npm run verify exit 0 in an isolated worktree before merge.

Sal0-From: SAL0-04"; then
  echo "ONE THING THAT CHANGED: BLOCKED - NEED OWNER — commit rejected on $WORK_BRANCH"
  exit 1
fi
WORK_COMMIT="$($GIT rev-parse HEAD)"

# Merge only if the base has not moved under us. If it has, the work stays on
# its branch and a human resolves it — an automated merge conflict at 3am is
# how a shared branch gets wedged.
cd "$REPO" || exit 1
trap - EXIT
$GIT worktree remove --force "$WORKTREE" 2>/dev/null

NOW_BASE="$($GIT rev-parse HEAD)"
if [ "$NOW_BASE" != "$BASE_COMMIT" ]; then
  echo "ONE THING THAT CHANGED: BLOCKED - NEED OWNER — base moved during the run"
  echo "Work is safe on $WORK_BRANCH (${WORK_COMMIT:0:8}). Merge it by hand."
  exit 1
fi

if $GIT merge --ff-only "$WORK_BRANCH" >/dev/null 2>&1; then
  echo "ONE THING THAT CHANGED: MERGED ${WORK_COMMIT:0:8} — $FILES file(s), verify exit 0"
  $GIT push -q origin "$BASE_BRANCH" && echo "pushed" || echo "PUSH FAILED — commit is local only"
  $GIT branch -q -d "$WORK_BRANCH" 2>/dev/null
else
  echo "ONE THING THAT CHANGED: BLOCKED - NEED OWNER — fast-forward merge refused"
  echo "Work is safe on $WORK_BRANCH (${WORK_COMMIT:0:8})."
  exit 1
fi

echo "=== end $STAMP ==="
