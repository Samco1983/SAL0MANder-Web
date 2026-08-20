# Communication Ladder

Mission Control should communicate through the lightest channel that can prove
the claim. Terminal is the execution engine, not the whole communication
system.

## The Rule

Use the channel that matches the job:

| Job | Channel | Why |
| --- | --- | --- |
| Durable truth | GitHub commits, issues, PRs | Permanent, linked to diffs, reviewable. |
| Local execution | Terminal / CLI | Exit codes, logs, repeatable commands. |
| Human visibility | Browser tabs, desktop notifications | Fast to see without reading logs. |
| Shared awareness | Google Docs mirror later | Easy for Gemini/humans to read. |
| Manual fallback | Copy/paste packets | Works when APIs or CLIs are missing. |
| Outside wakeups | Make Cloud | Good for webhooks/phone/SaaS edges. |
| Visual inspection | Browser screenshots / app browser | Needed for UI, not for source truth. |

## Current Working Channels

- GitHub branch: `council/2026-08-18`.
- GitHub issues: used as the web work queue.
- `scripts/sal0-next-task.sh`: pulls the next unclaimed `[WEB]` issue into
  `docs/coordination/ops/CURRENT-TASK.md`.
- `scripts/sal0-work-loop.sh`: runs Claude CLI from terminal and reports
  commits/logs.
- `npm run council:execute`: runs Claude POSITION, screens the proposed
  nextAction, and hands one approved action to the work loop.
- `scripts/sal0-external-packet.mjs`: builds a redacted packet for manual or
  external agent handoff.
- `npm run mission:control-room`: prints the one-screen operating dashboard:
  who worked, what is queued, what ran, what cost evidence exists, and what is
  blocked.
- `npm run mission:signals`: reads short commit-trailer calls between agents,
  such as `SHAKY`, `BOARDS`, `TRAIL`, `MINE`, and `YOURS`.
- `npm run mission:preflight`: writes local readiness evidence.
- `npm run mission:urls`: prints the browser URLs to open.
- `npm run mission:desktop:status`: checks local launchd and pause state.
- `npm run make:payload:nudge`: creates a Make-ready button payload without
  editing Make.

## Do Not Overload Terminal

Terminal should run work and produce evidence. It should not be the only way a
human or agent learns what happened. Every meaningful run should leave at least
one of these:

- a commit;
- a GitHub issue comment;
- a run artifact under `docs/coordination/runs/`;
- a preflight artifact under `docs/coordination/ops/`;
- a desktop notification for human attention;
- a redacted copy/paste packet.

## Manual Relay Packet

Use this when Claude Chat, Gemini Chat, or another browser-only surface needs
context:

```bash
npm run council:external-packet
```

Then paste `docs/coordination/ops/EXTERNAL-HANDOFF-LATEST.json` with one
specific request. Do not paste full private docs unless the owner explicitly
asks for that.

## GitHub Issue Queue

GitHub issues are the best non-terminal work queue right now.

- Human-readable.
- Agent-readable through `gh`.
- Durable.
- Can hold comments, links, evidence, and owner decisions.
- Does not require leaving a terminal window visible.

Workflow:

```bash
bash scripts/sal0-next-task.sh
bash scripts/sal0-work-loop.sh docs/coordination/ops/CURRENT-TASK.md
```

The first command chooses work. The second runs the worker.

## Browser Visibility

Use browser links when the next step is human inspection or review:

```bash
npm run mission:urls
```

Mission Control should print URLs before expecting Samuel to hunt through tabs.

## Control Room View

Use this when Samuel asks "is everyone doing something?" or "what is broken?":

```bash
npm run mission:control-room
```

This is the preferred status surface before asking a human to inspect raw logs.
It reports from evidence: commits, issues, run logs, launchd state, and the
ledger.

## Google Docs Mirror Later

Google Docs should be the shared awareness layer, not the source of truth.

- GitHub decides.
- Google Doc shows.
- Make writes the mirror from committed GitHub state.
- Agents can read the Doc to orient, then confirm the referenced commit before
  acting.

## Make Later

Make should not orchestrate local code. It should:

- send phone/email/browser notifications for meaningful evidence events;
- accept external intake from Samuel's phone and turn it into GitHub/INBOX work;
- send a daily "Signal is alive" heartbeat so notification failure is visible;
- post/update GitHub dashboard comments only when the write is idempotent;
- record Make run ids.

Skip owner buttons until a button is clearly faster than the terminal command
and does not add a second debug surface. Skip Google Docs mirrors until the
source scoreboard is stable.

For the local/Make boundary, see `DESKTOP-MAKE-AUTOMATION.md`.

## Escalation Ladder

1. Local preflight.
2. GitHub issue queue.
3. Terminal worker.
4. Run logs and commit.
5. GitHub issue comment.
6. Desktop notification.
7. Google Docs mirror.
8. Manual copy/paste packet.
9. Owner decision only when the system cannot prove or safely act.

The point is less babysitting: agents should communicate through evidence first,
then summaries, then owner attention only when needed.
