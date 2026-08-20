#!/bin/bash
# Choose the next Mission Control task.
#
# Thin wrapper on purpose: task selection parses GitHub JSON and BLOCKERS.md,
# which is safer and more readable in Node than in nested shell quoting.

set -uo pipefail

REPO="${SAL0_REPO:-/Users/samuel_saldivar/Desktop/SAL0MANder-Web}"
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

cd "$REPO" || { echo "REPO NOT FOUND"; exit 1; }
node "$REPO/scripts/sal0-next-task.mjs"
