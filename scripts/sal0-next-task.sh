#!/bin/bash
# Pull the next unworked issue and turn it into task instructions.
#
# GitHub Issues are the work queue and the mailbox at once: threaded, notifying,
# readable by every agent with `gh`, and already holding 14 open [WEB] tasks
# that nothing has been consuming. This makes the loop eat from that queue
# instead of re-reading a static file.
#
# Read-only against GitHub. Writes one local instructions file and prints the
# issue number so the caller can comment back on it.

set -uo pipefail

REPO_SLUG="Samco1983/SAL0MANder-Web"
REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
OUT="$REPO/docs/coordination/ops/CURRENT-TASK.md"
GH="$(command -v gh || echo /Users/samuel_saldivar/.local/bin/gh)"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

if [ ! -x "$GH" ]; then
  echo "BLOCKED - NEED OWNER — gh not found" >&2
  exit 1
fi

# Oldest first: a queue worked newest-first never reaches its bottom.
# `in-progress` marks an issue another agent already claimed.
ISSUE_JSON="$("$GH" issue list --repo "$REPO_SLUG" --state open \
  --json number,title,body,labels --limit 100 2>/dev/null \
  | python3 -c '
import json,sys
issues = json.load(sys.stdin)
def claimed(i):
    return any(l["name"].lower() in ("in-progress","blocked") for l in i.get("labels",[]))
web = [i for i in issues if "[WEB]" in i["title"].upper() and not claimed(i)]
web.sort(key=lambda i: i["number"])
print(json.dumps(web[0]) if web else "")
')"

if [ -z "$ISSUE_JSON" ]; then
  echo "NOTHING QUEUED — no unclaimed [WEB] issues open" >&2
  exit 2
fi

NUMBER="$(echo "$ISSUE_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["number"])')"
TITLE="$(echo "$ISSUE_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["title"])')"
BODY="$(echo "$ISSUE_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["body"] or "(no description)")')"

cat > "$OUT" <<TASK
You are the SAL0MANder web worker (SAL0-04). Work GitHub issue #$NUMBER.

TITLE:
$TITLE

ISSUE BODY:
$BODY

RULES:
- Work only in /Users/samuel_saldivar/Desktop/SAL0MANder-Web.
- Never touch /Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype.
- Read CLAUDE.md, docs/CHARTER-WEB-POINT-PERSON.md and
  docs/coordination/AGENT-DOCTRINE.md first. They bind you.
- Change code. Do not write a proposal, a review, or a plan document unless the
  issue explicitly asks for a written artifact.
- Scope: one coherent batch toward this issue. Do not start a second issue.
- Never read, print, move, or commit secrets, tokens, .env files, or auth files.
- Never run destructive git: no reset --hard, clean -fd, checkout -f, rebase,
  force push, or remote changes.
- Run \`npm run verify\` when done. It must pass. Check the exit code, not the
  words in the output.
- Do not commit. The loop commits if and only if verify passes.

WHEN YOU FINISH, end your reply with exactly these three lines:
ISSUE: $NUMBER
ONE THING THAT CHANGED: <what actually changed, or NOTHING CHANGED>
ONE THING STILL UNVERIFIED: <what you could not check>
TASK

echo "$NUMBER"
