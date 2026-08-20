# SAL0MANder manual override

Manual override is the fallback when an agent is quiet, vague, stuck, or not
showing evidence.

The goal is simple: force a clean ACK, force lane ownership, or reassign the
work without pretending a task is active.

## When to override

Use manual override when any of these are true:

- No ACK after a check-in request.
- The agent says "working" but gives no file, commit, test, Make run, or GitHub
  evidence.
- The agent is in the wrong repo or wrong lane.
- A Make task is assigned but there is no pickup/heartbeat evidence.
- A task is blocked and the blocker is not specific enough to act on.

## Productive evidence

An agent is productive only when it can show one of these:

- `PICKED_UP` with worker identity.
- `RUNNING` with `lastHeartbeatAt`.
- Commit hash, PR, or changed file list.
- Test/build output.
- GitHub Issue #1 writeback.
- Make run ID.
- Exact blocker with the next required decision.

Status without evidence is treated as not picked up.

## Manual override command

From the web repo:

```sh
npm run checkin:override
```

The monitor prints a copy-paste packet for the oldest pending request. Paste it
into Claude, Gemini, Codex CLI, or any manual chat that needs to be forced back
onto the same page.

## Override packet format

```text
SAL0MANder Manual Override

You are being checked because the coordination system needs evidence, not vague
status.

Lane:
Source:
Request:

Expected evidence:

Rules:
- Reply with ACK first.
- State the exact folder/repo you are using.
- Run a read-only status check before editing.
- Do not cross repo boundaries.
- Do not touch secrets, auth files, tokens, or unrelated projects.
- If you are not the right agent for this lane, say so immediately.
- If blocked, state the exact blocker immediately.
- Do not say "in progress" unless you have real evidence.

Required response format:
ACK
Lane:
Folder:
Current branch:
Latest commit:
Git status:
What I changed or verified:
Evidence:
Blocked:
Next action:
What I will not touch:
```

## Make role

Make can help identify whether work exists and whether a worker claimed it. Make
does not prove the work is useful by itself.

Minimum useful Make statuses:

- `QUEUED`: work exists.
- `PICKED_UP`: a worker claimed it.
- `RUNNING`: worker is alive and posting heartbeat.
- `COMPLETED`: worker posted evidence.
- `FAILED`: worker reported a real blocker.
- `DEAD_LETTER`: this exact message exhausted retries.

If Make shows `QUEUED` or `ASSIGNED` with no pickup, use manual override.

The first Make button to build is specified in
[`MAKE-NUDGE-BUTTON.md`](./MAKE-NUDGE-BUTTON.md).

## Boundary

Manual override can redirect people and agents. It does not authorize crossing
repo boundaries, editing Unity from the web lane, editing web from the Unity
lane, or reading secrets.
