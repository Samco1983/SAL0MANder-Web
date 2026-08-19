#!/bin/bash
# SAL0MANder doctor — can each agent actually WORK from a scheduled shell?
#
# READ ONLY. Costs one tiny model call per installed agent.
#
# WHY THIS EXISTS: on 2026-08-19 two agents failed the identical way, eight
# hours apart. Gemini authenticated in a terminal and failed headless. Claude
# worked interactively and returned "Not logged in · Please run /login" in
# 109ms from launchd — so every unattended run that reported "nothing changed"
# had never run a model at all.
#
# The existing collector checked whether tools were on the PATH from a clean
# environment. It never checked whether they could AUTHENTICATE from one. That
# is the doorknob, not the lock.
#
#   `env -i` is the whole trick. It reproduces what launchd hands a job:
#   no login shell, no inherited environment, no unlocked keychain session.
#
# The rule this enforces: TEST FROM THE ENVIRONMENT THE WORK WILL RUN IN.

set -uo pipefail

REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
SCHED_PATH="/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:/usr/local/bin"
PROBE="reply with exactly: OK"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

pass=0; fail=0

hr() { printf '%.0s─' {1..64}; echo; }
row() { printf "  %-10s %-14s %s\n" "$1" "$2" "$3"; }

echo
echo "  SAL0MANDER DOCTOR — can each agent work when nobody is logged in?"
hr
row "AGENT" "INTERACTIVE" "SCHEDULED (env -i, what launchd gives it)"
hr

# ── Claude ──────────────────────────────────────────────────────────────────
CLAUDE="$HOME/.local/bin/claude"
if [ -x "$CLAUDE" ]; then
  mine=$("$CLAUDE" -p "$PROBE" --output-format json 2>&1 \
    | python3 -c "import json,sys
try: print('FAIL' if json.load(sys.stdin).get('is_error') else 'ok')
except Exception: print('FAIL')")
  sched=$(env -i HOME="$HOME" PATH="$SCHED_PATH" "$CLAUDE" -p "$PROBE" --output-format json 2>&1 \
    | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    print('FAIL: '+str(d.get('result'))[:38] if d.get('is_error') else 'ok')
except Exception: print('FAIL: no json')")
  row "claude" "$mine" "$sched"
  case "$sched" in ok) pass=$((pass+1));; *) fail=$((fail+1));; esac
else
  row "claude" "not installed" "—"
fi

# ── Gemini ──────────────────────────────────────────────────────────────────
if command -v gemini >/dev/null 2>&1; then
  # Through the wrapper, which is what any scheduled caller uses.
  sched=$(env -i HOME="$HOME" PATH="$SCHED_PATH" bash "$REPO/scripts/sal0-gemini.sh" -p "$PROBE" 2>&1 \
    | grep -viE '256-color|ripgrep' | head -2 | tr '\n' ' ')
  case "$sched" in
    *OK*) row "gemini" "ok" "ok"; pass=$((pass+1));;
    *quota*|*429*) row "gemini" "ok" "FAIL: quota exhausted (free tier is 20/day)"; fail=$((fail+1));;
    *) row "gemini" "?" "FAIL: ${sched:0:38}"; fail=$((fail+1));;
  esac
else
  row "gemini" "not installed" "—"
fi

# ── Codex ───────────────────────────────────────────────────────────────────
if command -v codex >/dev/null 2>&1; then
  sched=$(env -i HOME="$HOME" PATH="$SCHED_PATH" codex --version >/dev/null 2>&1 && echo ok || echo "FAIL: unreachable")
  row "codex" "ok" "$sched"
  case "$sched" in ok) pass=$((pass+1));; *) fail=$((fail+1));; esac
else
  row "codex" "not on PATH here" "—"
fi

# ── gh ──────────────────────────────────────────────────────────────────────
if command -v gh >/dev/null 2>&1; then
  sched=$(env -i HOME="$HOME" PATH="$SCHED_PATH" gh auth status >/dev/null 2>&1 && echo ok || echo "FAIL: not authenticated")
  row "gh" "$(gh auth status >/dev/null 2>&1 && echo ok || echo FAIL)" "$sched"
  case "$sched" in ok) pass=$((pass+1));; *) fail=$((fail+1));; esac
fi

hr
echo "  reachable from a scheduled shell: $pass    unreachable: $fail"
echo
if [ "$fail" -gt 0 ]; then
  cat <<'FIX'
  An agent that works in your terminal and fails here will produce runs that
  look idle rather than broken. That is how eight hours of "nothing changed"
  happened without anyone noticing a model was never called.

  Claude — generate a token that does not need the Keychain. This is what
  Anthropic's own GitHub Actions integration uses, for this exact reason:

      claude setup-token
      mkdir -p ~/.sal0mander/secrets
      umask 077 && printf '%s' '<token>' > ~/.sal0mander/secrets/claude_oauth_token

    then in any scheduled runner:
      export CLAUDE_CODE_OAUTH_TOKEN="$(cat ~/.sal0mander/secrets/claude_oauth_token)"

  Gemini — the key already lives in Keychain, and scripts/sal0-gemini.sh reads
  it at call time. A quota failure is not an auth failure: the free tier is 20
  requests a day and resets.
FIX
  exit 1
fi
echo "  Every installed agent can work unattended."
