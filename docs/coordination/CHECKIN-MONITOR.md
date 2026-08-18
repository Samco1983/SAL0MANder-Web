# Check-in monitor v1

This is the safe first step toward the SAL0MANder dispatcher.

It reads GitHub Issue #1, finds the oldest unprocessed check-in request, and
prints the manual Codex command that should process it. It can also print a
manual override packet for Claude, Gemini, Codex CLI, or any other agent that is
quiet or not showing evidence. It does **not** execute Codex by itself.

That boundary matters: GitHub comments are outside input, so Version 1 reports
and queues. Execution stays explicit until the request envelope is locked down.

## Commands

```bash
npm run checkin:monitor
```

For a quiet or unproductive agent:

```bash
npm run checkin:override
```

After a request is actually handled:

```bash
npm run checkin:monitor:accept
```

Public repositories can be read without a token. Private repositories need a
token in the Terminal environment:

```bash
export GITHUB_TOKEN="..."
npm run checkin:monitor
```

Do not commit the token, paste it into a document, or put it in a `VITE_`
variable.

## Request marker

The monitor can see either `CHECK_IN_REQUEST` or older `ACTION REQUIRED`
comments. Only `CHECK_IN_REQUEST` is treated as dispatcher-ready.

Preferred format:

```text
CHECK_IN_REQUEST

Lane: Game / Web / Seam
Request:
...
Expected evidence:
...
```

The monitor treats only `CHECK_IN_PROCESSED` or local seen-state as already
handled. A comment that says `CHECKPOINT REQUIRED` can still be pending work.

Legacy `ACTION REQUIRED` comments are shown as `manual-review`, because they can
contain broad prose and multiple lane requests. They are useful for a human or
supervisor, but should not become automatic execution input.

Manual override rules live in
[`MANUAL-OVERRIDE.md`](./MANUAL-OVERRIDE.md). Short version: status without
pickup, heartbeat, commit, test/build output, Make run, GitHub writeback, or an
exact blocker is not productive evidence.

The Make manual-trigger version of this nudge is specified in
[`MAKE-NUDGE-BUTTON.md`](./MAKE-NUDGE-BUTTON.md).

## Local state

The monitor writes local seen-state here:

```text
docs/coordination/.checkin-monitor-state.json
```

That file is machine state and should not be committed.

## Next step

The later dispatcher can execute Codex automatically after the request envelope
is constrained enough to avoid feeding arbitrary GitHub text into a terminal.

## Council supervisor scaffold

The next automation layer is intentionally local and hash-gated:

```bash
npm run council:dry-run
npm run council:launchd:plist
npm run council:run-agents
npm run council:validate-schemas
```

It reads `PROBE.md`, `CURRENT_STATE.md`, and the last 10 non-council commit
messages, computes a packet hash, writes
`docs/coordination/runs/<timestamp>-<hash8>/packet.json`, writes a short
`RESULT.md`, appends `runs/ledger.jsonl`, and exits without model calls when the
same packet hash has already succeeded.

This is the safe proof before wiring Claude, Gemini, OpenAI, launchd, or Make.
Agent-run mode currently stops after Claude POSITION validation; Gemini and
OpenAI are intentionally still off.

Because agent-run mode sends the assembled packet to Claude, it requires
explicit approval for the current packet before real use. The missing-CLI/blocker
path can be tested without sending external data by setting `SAL0_CLAUDE_BIN` to
a nonexistent path.

The launchd helper generates a plist only. It does not install, load, or start
the schedule.
