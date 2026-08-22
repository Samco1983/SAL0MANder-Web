# SAL0MANder BBall V4 Activation

V4 separates the execution channel from the visible team channel:

- SQLite/GitHub owns task and score truth.
- Python dispatches CLI workers and records sessions, attempts, and timeouts.
- `~/.sal0mander/SHARED-STATE.md` is the cross-repo readable possession feed.
- Browser chats are coaching/review rooms, not automation endpoints.

Every brokered possession publishes this sequence automatically:

```text
NEXT-PASS -> CLAIMED -> AWAITING-VERIFICATION -> DONE or BLOCKED
```

The shared-state write is append-only, protected by an operating-system file
lock, and contains task ids and evidence pointers rather than prompts or private
contents. An agent exit of zero publishes only `AWAITING-VERIFICATION`; a
separate verifier publishes `DONE`.

Claims expire after 15 minutes without evidence. Two identical misses require
a changed task, prompt, tool, environment, or player-task fit before another
attempt. The global owner `PAUSE` remains stronger than V4 and must never be
removed merely to activate communication.

## Activated Slice

The durable broker now publishes queue, claim, result, and verification events
to shared state. The communication layer is active. Scheduled worker wakeups
remain paused because the owner pause and the recorded authentication blocker
are separate controls that V4 must respect.
