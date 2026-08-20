#!/bin/bash
# SAL0-07 Challenger — Gemini, reachable from a script.
#
# Why this wrapper exists: `gemini` authenticated interactively works in a
# terminal and fails headless with API_KEY_INVALID, because the interactive
# session holds the key in memory and a script inherits nothing. Signing in is
# not the same as being reachable, which is the whole reason this seat sat
# "unproven" for a week.
#
# Reads the key from Keychain at call time and passes it by environment. The
# value is never written to a file, never printed, and never appears in argv
# where `ps` would expose it to any process on the machine.
#
# Store the key once:
#   security add-generic-password -U -a "$USER" -s "SAL0MANder Gemini API" -w "$(pbpaste)" && pbcopy < /dev/null

set -uo pipefail

KEYCHAIN_SERVICE="SAL0MANder Gemini API"
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

GEMINI_BIN="$(command -v gemini || echo /usr/local/bin/gemini)"
if [ ! -x "$GEMINI_BIN" ]; then
  echo "BLOCKED - NEED OWNER — gemini not installed. sudo npm install -g @google/gemini-cli" >&2
  exit 1
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  GEMINI_API_KEY="$(security find-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  cat >&2 <<MSG
BLOCKED - NEED OWNER — no Gemini API key reachable from a script.

Signing in interactively is not enough: that key lives in the session and a
scheduled job inherits nothing. Google also discontinued "Sign in with Google"
for individual Code Assist accounts, so the \$20 subscription cannot drive the
CLI at all — this needs an API key, which has a free tier.

Get one at https://aistudio.google.com/apikey, copy it, then:

    security add-generic-password -U -a "\$USER" -s "$KEYCHAIN_SERVICE" -w "\$(pbpaste)" && pbcopy < /dev/null

Claude will not read, write, or handle the key.
MSG
  exit 1
fi

# Passed by environment, never argv. Everything else goes straight through, so
# this is a drop-in for `gemini`.
GEMINI_API_KEY="$GEMINI_API_KEY" exec "$GEMINI_BIN" "$@"
