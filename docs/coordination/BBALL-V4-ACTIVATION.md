# SAL0MANder BBall V4 Activation Runbook

This is implementation evidence and an activation runbook, not a second V4
contract. The canonical rules live in `SAL0MANDER-BBALL.md` under **V4
possession contract**. If the two documents disagree, that section wins.

The activated implementation separates the execution channel from the visible
team channel:

- SQLite/GitHub owns task and score truth.
- Python dispatches CLI workers and records sessions, attempts, and timeouts.
- `~/.sal0mander/SHARED-STATE.md` is the cross-repo readable possession feed.
- Browser chats are coaching/review rooms, not automation endpoints.

The current broker implementation publishes this reduced machine sequence:

```text
NEXT-PASS -> CLAIMED -> AWAITING-VERIFICATION -> DONE or BLOCKED
```

The shared-state write is append-only, protected by an operating-system file
lock, and contains task ids and evidence pointers rather than prompts or private
contents. An agent exit of zero publishes only `AWAITING-VERIFICATION`; a
separate verifier publishes `DONE`.

The canonical contract adds `SHOT`, `EVIDENCE`, `REBOUND`, and `NEXT PASS` as
required possession states. Those are not yet fully enforced by the broker;
this runbook must not claim otherwise.

## Activated Slice

Commit `d24e040` makes the durable broker publish queue, claim, result, and
verification events to shared state using an operating-system file lock. Seven
broker tests passed, including a negative test proving private prompt text does
not enter the shared feed.

Scheduled worker wakeups remain paused. The owner pause and recorded
authentication blocker are separate controls that V4 must respect; activating
communication does not remove either one.
