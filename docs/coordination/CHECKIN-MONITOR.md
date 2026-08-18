# Check-in monitor v1

This is the safe first step toward the SAL0MANder dispatcher.

It reads GitHub Issue #1, finds the oldest unprocessed check-in request, and
prints the manual Codex command that should process it. It does **not** execute
Codex by itself.

That boundary matters: GitHub comments are outside input, so Version 1 reports
and queues. Execution stays explicit until the request envelope is locked down.

## Commands

```bash
npm run checkin:monitor
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

Post a comment on the hub issue containing either `CHECK_IN_REQUEST` or
`ACTION REQUIRED`:

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

## Local state

The monitor writes local seen-state here:

```text
docs/coordination/.checkin-monitor-state.json
```

That file is machine state and should not be committed.

## Next step

The later dispatcher can execute Codex automatically after the request envelope
is constrained enough to avoid feeding arbitrary GitHub text into a terminal.
