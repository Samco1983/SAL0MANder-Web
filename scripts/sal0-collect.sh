#!/bin/bash
# SAL0MANder environment collector — READ ONLY.
#
# Changes nothing. Starts nothing. Costs nothing. It answers the questions that
# have been guessed at all week:
#
#   - which tools exist, and would a SCHEDULED job find them?
#   - what is actually scheduled on this machine right now?
#   - what has the Codex heartbeat been doing, and how big has it grown?
#   - is the repo where we think it is?
#
# The launchd comparison is the point. launchd runs jobs with a minimal PATH
# that does not include a login shell's additions, so a tool that works when you
# type it can be invisible at 3am. This measures that gap instead of assuming it.

set -uo pipefail

REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
OUT_DIR="$REPO/docs/coordination/ops"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/COLLECT-$STAMP.md"

mkdir -p "$OUT_DIR"

# Minimal PATH, matching what launchd hands a job.
LAUNCHD_PATH="/usr/bin:/bin:/usr/sbin:/sbin"

TOOLS="claude codex gemini gh node npm git python3 make"

{
  echo "# SAL0MANder environment collection"
  echo
  echo "Collected: $STAMP"
  echo "Read-only. Nothing was started, changed, or billed."
  echo
  echo "## Who and where"
  echo
  echo '```'
  echo "whoami : $(whoami)"
  echo "host   : $(hostname)"
  echo "shell  : ${SHELL:-unknown}"
  echo "pwd    : $(pwd)"
  echo "uptime :$(uptime)"
  echo '```'
  echo
  echo "## Tools — interactive PATH vs launchd PATH"
  echo
  echo "The second column is what a scheduled job would find. A tool present in"
  echo "the first column and missing from the second works when you test it by"
  echo "hand and fails silently on a schedule."
  echo
  echo "| Tool | Your shell | A launchd job | Version |"
  echo "| --- | --- | --- | --- |"
  for tool in $TOOLS; do
    mine="$(command -v "$tool" 2>/dev/null || echo '—')"
    sched="$(PATH="$LAUNCHD_PATH" command -v "$tool" 2>/dev/null || echo '**MISSING**')"
    ver='—'
    if [ "$mine" != "—" ]; then
      ver="$("$tool" --version 2>&1 | head -1 | cut -c1-40)"
    fi
    echo "| \`$tool\` | $mine | $sched | $ver |"
  done
  echo
  echo "## Auth (status only — no secrets read, no tokens printed)"
  echo
  echo '```'
  if command -v gh >/dev/null 2>&1; then
    gh auth status 2>&1 | grep -viE "token|secret" | head -6
  else
    echo "gh: not installed"
  fi
  echo
  for f in "$HOME/.claude" "$HOME/.codex" "$HOME/.gemini"; do
    if [ -d "$f" ]; then
      echo "$(basename "$f") config dir: present"
    else
      echo "$(basename "$f") config dir: ABSENT"
    fi
  done
  echo '```'
  echo
  echo "## What is actually scheduled"
  echo
  echo '```'
  echo "--- launchd jobs matching sal0/claude/codex ---"
  launchctl list 2>/dev/null | grep -iE "sal0|claude|codex" || echo "(none)"
  echo
  echo "--- ~/Library/LaunchAgents ---"
  ls ~/Library/LaunchAgents/ 2>/dev/null | grep -iE "sal0|claude|codex" || echo "(no sal0/claude/codex plist installed)"
  echo
  echo "--- crontab ---"
  crontab -l 2>/dev/null || echo "(no crontab)"
  echo
  echo "--- codex automations ---"
  for f in "$HOME"/.codex/automations/*/automation.toml; do
    [ -f "$f" ] || continue
    id="$(grep -m1 '^id' "$f" | cut -d'"' -f2)"
    status="$(grep -m1 '^status' "$f" | cut -d'"' -f2)"
    rrule="$(grep -m1 '^rrule' "$f" | cut -d'"' -f2)"
    echo "$id | $status | $rrule"
  done
  echo
  echo "--- claude scheduled-task definitions ---"
  ls "$HOME/.claude/scheduled-tasks" 2>/dev/null || echo "(none)"
  echo '```'
  echo
  echo "## Heartbeat growth"
  echo
  echo "A heartbeat appending to one thread costs more every run, because the"
  echo "context it carries keeps growing. These are the largest session files."
  echo
  echo '```'
  find "$HOME/.codex/sessions" -type f -name "*.jsonl" -exec ls -l {} \; 2>/dev/null \
    | sort -k5 -n -r | head -5 | awk '{printf "%8.1f MB  %s  %s\n", $5/1048576, $6" "$7, $NF}'
  echo
  echo "sessions total   : $(du -sh "$HOME/.codex/sessions" 2>/dev/null | cut -f1)"
  echo "archived total   : $(du -sh "$HOME/.codex/archived_sessions" 2>/dev/null | cut -f1)"
  echo '```'
  echo
  echo "## Repo"
  echo
  echo '```'
  cd "$REPO" 2>/dev/null && {
    echo "toplevel : $(git rev-parse --show-toplevel)"
    echo "branch   : $(git rev-parse --abbrev-ref HEAD)"
    echo "head     : $(git rev-parse --short HEAD) $(git log -1 --format=%s)"
    echo "upstream : $(git status -sb | head -1)"
    echo "dirty    : $(git status --porcelain | wc -l | tr -d ' ') file(s)"
    echo
    echo "--- last 5 commits, with author and time ---"
    git --no-pager log -5 --format='%h %ad %s' --date=format:'%m-%d %H:%M'
  } || echo "REPO NOT FOUND at $REPO"
  echo '```'
  echo
  echo "## Council run ledger"
  echo
  echo '```'
  LEDGER="$REPO/docs/coordination/runs/ledger.jsonl"
  if [ -f "$LEDGER" ]; then
    echo "entries: $(wc -l < "$LEDGER" | tr -d ' ')"
    echo "statuses:"
    grep -o '"status":"[^"]*"' "$LEDGER" | sort | uniq -c | sort -rn
    echo
    echo "runs that called a model: $(grep -c '"modelCalls":[1-9]' "$LEDGER" 2>/dev/null || echo 0)"
  else
    echo "(no ledger — nothing has run)"
  fi
  echo '```'
  echo
  echo "## Disk"
  echo
  echo '```'
  df -h "$REPO" | tail -2
  echo '```'
  echo
  echo "## Read this first"
  echo
  echo "1. Any row above where a tool is in your shell but **MISSING** for launchd"
  echo "   is a scheduled job that will fail at 3am with no symptom."
  echo "2. An automation listed ACTIVE that produces no commits is taking"
  echo "   attendance, not working."
  echo "3. If the ledger shows runs but zero model calls, Mission Control has"
  echo "   been running and deciding nothing."
} > "$OUT"

echo "wrote $OUT"
echo
cat "$OUT"
