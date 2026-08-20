#!/bin/bash
# SAL0-07 Challenger — the rebounder.
#
# Reads what the other agents shipped and finds what they missed. It never
# writes code, never claims a file, never takes a shot. It only reads diffs.
#
# WHY THIS SEAT EXISTS: on 2026-08-19 five defects shipped and all five were
# caught by the agent that made them. A self-caught miss is not a rebound — the
# ones nobody catches are precisely the ones the shooter cannot see. Gemini took
# none of those shots, so it does not inherit either agent's blind spots.
#
# THE CONTRACT: a rebound must name a specific file and line and quote the code
# it objects to. Generic review is refused, because a critique that could have
# been written without reading the diff is not a critique.
#
# Usage: sal0-rebound.sh [count]      default: commits since the last rebound

set -uo pipefail

REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
OUT_DIR="$REPO/docs/coordination/ops"
GEMINI="$REPO/scripts/sal0-gemini.sh"
COUNT="${1:-10}"
MAX_DIFF_BYTES=180000

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"
cd "$REPO" || exit 1
mkdir -p "$OUT_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

# Never rebound your own shot. Skip signal commits — they carry no code.
COMMITS="$(git log -"$COUNT" --format='%h %s' | grep -v '^[0-9a-f]* signal:' || true)"
if [ -z "$COMMITS" ]; then
  echo "NOTHING TO REBOUND — no code commits in the last $COUNT"
  exit 0
fi

DIFF="$(git log -"$COUNT" -p --format='=== %h %an %s ===' -- \
  ':!docs/coordination/runs' ':!*.log' ':!package-lock.json' 2>/dev/null | head -c "$MAX_DIFF_BYTES")"

if [ -z "$DIFF" ]; then
  echo "NOTHING TO REBOUND — no reviewable diff"
  exit 0
fi

PROMPT="You are SAL0-07 Challenger, the rebounder for the SAL0MANder agent team.

Claude (SAL0-04) and Codex (SAL0-01/02) wrote this code. You did not. That is
why you are reading it: on 2026-08-19 five defects shipped and every one was
caught by the agent that wrote it, which means nobody caught the ones those
agents could not see.

Find what they missed. Not style. Not preference. Defects.

HARD RULES — a report that breaks any of these is worthless:
- Every finding MUST name the file and quote the exact line or lines you object
  to. A finding without a quote is refused.
- Say what breaks, concretely. 'This could be improved' is not a finding.
  'If X is null on line N, this throws' is.
- If you find nothing real, say NOTHING FOUND. That is a legitimate and useful
  answer. Do not invent a finding to look useful.
- Do not suggest rewrites of working code. Only report what is wrong.

Look hardest at: error paths that are never taken, state that can be stale,
things that report success without checking, shell quoting, and anything that
assumes an environment it did not verify.

Answer in this shape:

FINDING 1
  FILE: path:line
  QUOTE: the exact code
  BREAKS: what goes wrong, concretely
  CONFIDENCE: high | medium | low

(repeat, or write NOTHING FOUND)

THE ONE I AM LEAST SURE ABOUT: which finding you would bet against, and why.

=== COMMITS UNDER REVIEW ===
$COMMITS

=== DIFF ===
$DIFF"

REPORT="$OUT_DIR/REBOUND-$STAMP.md"
RESULT="$(bash "$GEMINI" -p "$PROMPT" 2>&1 | grep -viE '256-color|ripgrep is not available')"
EXIT=${PIPESTATUS[0]}

# The rebounder must not grade its own homework either.
#
# The first real rebound exhausted Gemini's free-tier quota (20 requests/day),
# spent five minutes on exponential backoff, produced zero findings — and the
# script exited 0. A seat built to catch false success reported false success.
if printf '%s' "$RESULT" | grep -qiE 'quota|rate.?limit|429|TerminalQuotaError'; then
  echo "BLOCKED - NEED OWNER — Gemini quota exhausted. The rebounder did not review anything."
  echo "Free tier is 20 requests/day. Wait for reset, or add billing."
  exit 1
fi
if [ "$EXIT" -ne 0 ] || [ -z "$(printf '%s' "$RESULT" | tr -d '[:space:]')" ]; then
  echo "BLOCKED - NEED OWNER — rebound produced no findings and no NOTHING FOUND (exit $EXIT)."
  echo "Silence is not a clean bill of health."
  exit 1
fi

{
  echo "# Rebound — SAL0-07 Challenger"
  echo
  echo "$STAMP · last $COUNT commits · gemini exit $EXIT"
  echo
  echo '## Commits reviewed'
  echo '```'
  echo "$COMMITS"
  echo '```'
  echo
  echo '## Findings'
  echo
  echo "$RESULT"
} > "$REPORT"

echo "$RESULT"
echo
echo "wrote $REPORT"
