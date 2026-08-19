#!/bin/bash
# SAL0-03 Director — the coach seat, in terminal.
#
# ChatGPT has no CLI. Codex *is* OpenAI's terminal agent and already holds
# SAL0-01/02. What was missing is the coach: the seat that watches the whole
# floor, does not touch the ball, and calls one play.
#
# This feeds the Control Room and the blocker report to the OpenAI API and asks
# for exactly ONE next action. One, because a coach who calls four plays at once
# has called none.
#
# COST NOTE: the ChatGPT subscription and the API are separate products with
# separate billing. A $200 ChatGPT plan grants no API credit. This run is small
# — a status report in, a short decision out — but it is not free.
#
# THE KEY NEVER LIVES IN THIS REPO. Every VITE_ variable here ships in the
# bundle and the charter forbids secrets outright. Put it in
# ~/.sal0mander/openai.env, which is outside the repo and outside git's reach:
#
#     mkdir -p ~/.sal0mander
#     echo 'OPENAI_API_KEY=sk-...' > ~/.sal0mander/openai.env
#     chmod 600 ~/.sal0mander/openai.env

set -uo pipefail

REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
ENV_FILE="$HOME/.sal0mander/openai.env"
MODEL="${SAL0_COACH_MODEL:-gpt-5}"
OUT_DIR="$REPO/docs/coordination/ops"
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

cd "$REPO" || exit 1
mkdir -p "$OUT_DIR"

if [ -z "${OPENAI_API_KEY:-}" ] && [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  cat <<'MSG'
BLOCKED - NEED OWNER — no OpenAI API key.

The coach seat needs an API key, which is billed separately from a ChatGPT
subscription. Get one at https://platform.openai.com/api-keys, then:

    mkdir -p ~/.sal0mander
    echo 'OPENAI_API_KEY=sk-...' > ~/.sal0mander/openai.env
    chmod 600 ~/.sal0mander/openai.env

Never put it in this repo. Claude will not read, write, or handle the key.
MSG
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

# What the coach sees: the same board the players see, and nothing they said
# about themselves.
BOARD="$(bash scripts/sal0-control-room.sh 2>&1)"
BLOCKERS="$(bash scripts/sal0-blocker-report.sh 2>&1)"

PROMPT="You are SAL0-03 Director, the coach for the SAL0MANder agent team.

Two agents work one branch in terminal: Codex (SAL0-01/02) owns automation
plumbing, the supervisor, launchd and Make. Claude (SAL0-04) owns the web app —
src/, components, routes, accessibility. A rebounder seat for Gemini is empty.

You do not touch the ball. You watch the floor and call ONE play.

Below is the board. Everything in it comes from git, the GitHub API, run logs
and the filesystem — nothing is self-reported by an agent.

=== CONTROL ROOM ===
$BOARD

=== BLOCKERS ===
$BLOCKERS

Answer in this exact shape, nothing else:

READ: one sentence on what is actually happening, not what the numbers say.
THE MISS: the most costly thing being ignored right now.
ONE PLAY: a single concrete next action, and which agent runs it.
SUCCESS CHECK: how we will know in one hour whether it worked.
DO NOT: one thing the team should stop doing.

Be blunt. The team's own doctrine says a coach who softens the read is worse
than no coach."

RESPONSE="$(OPENAI_API_KEY="$OPENAI_API_KEY" MODEL="$MODEL" PROMPT="$PROMPT" python3 "$REPO/scripts/lib/sal0_coach_call.py")"
CALL_EXIT=$?

if [ "$CALL_EXIT" -ne 0 ]; then
  echo "BLOCKED - NEED OWNER — coach call failed:"
  echo "$RESPONSE"
  exit 1
fi

REPORT="$OUT_DIR/COACH-$STAMP.md"
{
  echo "# Coach read — SAL0-03 Director"
  echo
  echo "Model: \`$MODEL\` · $STAMP"
  echo
  echo "$RESPONSE"
} > "$REPORT"

echo "$RESPONSE"
echo
echo "wrote $REPORT"
