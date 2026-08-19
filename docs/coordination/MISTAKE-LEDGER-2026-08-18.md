# Mistake Ledger — 2026-08-18

Purpose: turn a chaotic coordination day into usable operating rules.

This is not a blame file. It is the list of mistakes Mission Control can work
with: what happened, how we know, what changed, and what rule prevents the same
failure from wasting another day.

## 1. We confused assignment with progress

**Mistake:** Work was called "in progress" because an agent had been assigned,
not because a commit, test, log, screenshot, or GitHub update existed.

**Evidence:** Repeated manual check-ins produced agent status text before there
was durable implementation evidence.

**Fix:** `WORKING` now requires evidence.

**Rule:** No evidence, no progress claim.

## 2. The human became the message bus

**Mistake:** Samuel had to copy/paste between Codex, Claude, Gemini, GitHub,
GitHub Desktop, Make, and terminal.

**Evidence:** Important state moved through chat text instead of durable files
or commits.

**Fix:** `COMMUNICATION-LADDER.md`, `MISSION-CONTROL-CORE.md`, and the Control
Room now define where evidence belongs.

**Rule:** Agents communicate through GitHub, commits, logs, packets, and
dashboards before asking Samuel to relay anything.

## 3. Terminal was treated like the whole system

**Mistake:** If something was not visible in terminal, it was effectively lost.

**Evidence:** Samuel repeatedly had to ask whether the terminal was being used,
whether sessions were alive, and whether anyone was working.

**Fix:** `npm run mission:control-room` gives one evidence-based status screen.

**Rule:** Terminal executes. GitHub records. Browser/docs/packets show.

## 4. The scheduler ran but did not think

**Mistake:** Mission Control produced run ledger entries without calling any
model.

**Evidence:** Control Room reported 37 council ledger runs and 0 model calls.

**Fix:** The zero-model-call condition is now surfaced as a problem in the
Control Room.

**Rule:** A scheduled run must either make a decision, produce evidence, or say
`NOTHING CHANGED` clearly enough that waste is visible.

## 5. We trusted environment assumptions

**Mistake:** Tools that worked in an interactive terminal were assumed to work
under launchd or Codex Desktop.

**Evidence:** Collection data showed launchd's PATH could not find `claude`,
`node`, `npm`, or `gh` by name, while the interactive shell could.

**Fix:** Mission Control preflight checks tool paths and records environment
state.

**Rule:** Scheduled scripts must use explicit PATH or absolute binary paths.

## 6. We overbuilt governance before proving work

**Mistake:** Too much energy went into architecture, proposals, and supervision
before the basic worker loop proved it could change, verify, commit, and push.

**Evidence:** `AGENT-DOCTRINE.md` records that eleven coordination documents
preceded a twenty-minute source fix that delivered more real value.

**Fix:** Canary runs proved the worker path before scheduling larger work.

**Rule:** Prove the smallest real loop first.

## 7. The work loop initially did not commit its own work correctly

**Mistake:** The loop ran a worker but did not reliably capture and commit the
worker's actual output.

**Evidence:** Commit `1267330` fixed "the loop never committing its worker's
output".

**Fix:** Work-loop commit handling was repaired and proven by canary commits.

**Rule:** A worker loop is not real until it can produce a verified commit.

## 8. The work loop tried to commit the wrong things

**Mistake:** The loop risked committing lock files or another agent's
uncommitted work.

**Evidence:** Commits `9f3d246` and `c3bb5d1` fixed lock-file commits and
cross-agent dirty-tree commits.

**Fix:** The loop now refuses dirty starts and avoids committing its lock file.

**Rule:** Never start unattended work from a dirty tree.

## 9. Refusal rules had a real bug

**Mistake:** A secret-path refusal used a bad word-boundary pattern, so a
phrase like "Commit the .env file" could pass the gate.

**Evidence:** `ece2c72` fixed the `.env` refusal bug after tests caught it.

**Fix:** Secret and destructive-command refusals were hardened.

**Rule:** Safety gates need adversarial tests, not confidence.

## 10. Success checks were too easy to fake

**Mistake:** Phrases like "it works", "done", and "verified" could be treated
like checks.

**Evidence:** `ece2c72` hardened execute-stage success-check validation.

**Fix:** Unfalsifiable success checks are refused.

**Rule:** A check must be falsifiable and runnable.

## 11. GitHub queue visibility depended on permissions

**Mistake:** The Control Room originally mixed an empty queue summary with
"could not read issues", which was confusing.

**Evidence:** The dashboard printed both when `gh` failed under sandboxed
network access.

**Fix:** `sal0-control-room.sh` now clearly reports either GitHub issue data or
a read failure, not both.

**Rule:** If a data source cannot be read, say that instead of implying the
queue is empty.

## 12. Gemini had no productive lane

**Mistake:** Gemini was treated like an available worker without a proven CLI,
scope, or output destination.

**Evidence:** Control Room reports `gemini CLI not installed — SAL0-07 seat
empty`.

**Fix:** Gemini is now listed as an empty Challenger seat until installed and
assigned a real workflow.

**Rule:** No tool surface, no agent seat.

## 13. Launchd is still not installed

**Mistake:** Work was described like automation was alive, but no launchd job
is installed.

**Evidence:** Control Room reports `launchd: NOT INSTALLED — nothing wakes up
on its own`.

**Fix:** The scripts and docs exist; installation remains a separate explicit
owner-controlled step.

**Rule:** Written automation is not live automation.

## 14. "No barriers" was too broad

**Mistake:** Removing all friction was mixed together with removing safety.

**Evidence:** The system needed fewer manual approvals for routine work, but
also needed stronger refusals for secrets, destructive commands, cross-lane
work, and workflow edits.

**Fix:** The doctrine now separates bad barriers from useful brakes.

**Rule:** Remove babysitting. Keep brakes.

## 15. The branch worked better than chat

**Mistake:** We expected agents to coordinate by talking directly.

**Evidence:** Codex unblocked Claude's chmod issue via commit `97f1601` after
the blocker was visible in the repo, without a direct chat relay.

**Fix:** `AGENT-DOCTRINE.md` names the coordination pattern: blocked in the
open.

**Rule:** Publish blockers in the shared record, then keep moving.

## Current Operating Fixes

- `npm run mission:control-room` for one-screen status.
- `npm run mission:preflight` before waking agents.
- `npm run council:external-packet` for browser/chat handoffs.
- GitHub issues as the non-terminal work queue.
- Small pushed commits as the main coordination trail.
- Dirty-tree refusal before unattended work.
- Evidence-first status states.

## Still Open

- Install launchd only after the owner explicitly approves the live unattended
  wakeup.
- Install or skip Gemini CLI; do not pretend SAL0-07 is staffed.
- Turn the GitHub issue queue into the default work source for bounded runs.
- Keep broad work-loop execution behind explicit, informed approval.
- Build a browser-visible Mission Control dashboard after the command-line
  Control Room is stable.

## The Day's Useful Lesson

The system does not need perfect agents. It needs agents that leave evidence,
state blockers in the open, refuse dangerous work, and keep moving on the next
safe task.

