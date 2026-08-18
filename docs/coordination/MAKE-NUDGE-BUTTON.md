# Make button — NUDGE AGENTS

Status: BUILD CARD

This is the first Make control button to build. It does not execute arbitrary
agent work. It creates a visible productivity check and writes the result to the
GitHub coordination hub.

## Goal

Samuel should not have to copy/paste between agents just to learn who is working.

The button asks every lane for one state:

- `WORKING`
- `DONE - NEED NEW TASK`
- `BLOCKED - NEED OWNER`
- `WRONG LANE - REASSIGN`
- `UNKNOWN/UNREACHABLE`

## Inputs

Manual Make trigger or webhook body:

```json
{
  "requestedBy": "Samuel",
  "reason": "agent-state-check",
  "lanes": ["Web", "Unity", "Gemini", "Make", "Coordination"],
  "source": "manual-button",
  "idempotencyKey": "nudge-YYYYMMDD-HHMM"
}
```

`idempotencyKey` must be derived from the button run window, not random. A retry
of the same button press should update/reuse the same GitHub comment.

## Make modules

Scenario name: `sal0-nudge-agents`

| # | Module | Purpose |
| - | --- | --- |
| 1 | Webhooks or Manual trigger | Starts the nudge. |
| 2 | Tools -> Set variable | Build static lane list and run id. |
| 3 | Data store -> Add/replace record | Store `NUDGE_REQUESTED`. |
| 4 | HTTP -> GitHub Issue comment search | Find existing dashboard/nudge marker. |
| 5 | Router | Existing marker -> update; no marker -> create. |
| 6A | HTTP PATCH issue comment | Update existing nudge dashboard. |
| 6B | HTTP POST issue comment | Create nudge dashboard once. |
| 7 | Webhook response | Return dashboard body and run id. |

## GitHub writeback

Target:

- Repo: `Samco1983/Sal0mander-Jigsaw-Puzzle`
- Issue: `#1`

Comment marker:

```text
<!-- sal0-agent-nudge-dashboard v1 -->
```

Body template:

```markdown
<!-- sal0-agent-nudge-dashboard v1 -->
## SAL0MANder agent nudge

Last nudge: 2026-08-18T14:40:00Z
Requested by: Samuel
Run: make-run-id

| Lane | Expected owner | Required state | Latest evidence | Action |
| --- | --- | --- | --- | --- |
| Web | Claude | WORKING / DONE / BLOCKED / WRONG LANE | UNKNOWN | respond with state |
| Unity | Codex | WORKING / DONE / BLOCKED / WRONG LANE | UNKNOWN | respond with state |
| Gemini | Gemini | WORKING / DONE / BLOCKED / WRONG LANE | UNKNOWN | respond with state |
| Make | Make/Codex | WORKING / DONE / BLOCKED / WRONG LANE | UNKNOWN | respond with state |

Required response:
ACK
State:
Lane:
Folder:
Branch:
Latest commit:
Evidence:
Blocked by:
Next action:
```

## Data store fields

Store one row per nudge:

- `nudgeId`
- `idempotencyKey`
- `requestedBy`
- `requestedAtUtc`
- `source`
- `reason`
- `lanes`
- `githubCommentId`
- `state`
- `updatedAtUtc`

Valid nudge states:

- `NUDGE_REQUESTED`
- `COMMENT_CREATED`
- `COMMENT_UPDATED`
- `FAILED`

## Duplicate prevention

- Search Issue #1 for `<!-- sal0-agent-nudge-dashboard v1 -->`.
- Update the existing comment when found.
- Create a comment only when no marker exists.
- Store the resulting `githubCommentId`.
- Reuse the same `idempotencyKey` on retries.

## What this button does not do yet

- Does not run Codex CLI.
- Does not call Claude or Gemini directly.
- Does not create provider credentials.
- Does not execute code from GitHub comments.
- Does not mark an agent productive just because a task exists.

## Acceptance criteria

- Pressing the button creates or updates exactly one GitHub dashboard comment.
- The dashboard lists all lanes and required state format.
- Re-pressing within the same run window updates the same comment.
- No duplicate nudge comments appear.
- No secrets or tokens appear in Make output or GitHub comments.

## Next button after this

After `NUDGE AGENTS` works, build `DONE - NEED NEW TASK`. That button should
close the current task state and immediately show the next claimable task.
