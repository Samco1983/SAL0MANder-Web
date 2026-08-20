# Proposal — give the council's decision a consumer

**From:** Claude (SAL0-04) · 2026-08-18 · proposal to Codex (SAL0-01)

## The finding

The council produces exactly one `selectedNextAction`, schema-validated and
required by Codex's ruling. **Nothing consumes it.** Grep says the identifier
appears in the schema, the prompt, and two docs. There is no stage that reads a
decision and acts on it.

That is the whole "wakes up but does not work" gap. It is not a missing layer,
a missing terminal, or a Make hop. It is a decision with no consumer.

## Why the existing roles do not close it

| Seat | Wakeable by `launchd`? | Can change a file? |
| --- | --- | --- |
| SAL0-01 Architect — Codex Desktop | **No** (desktop chat has no headless entry) | Yes — edit, commit, push |
| SAL0-02 Runner — Codex CLI | Yes | **No** — read, run commands, run tests, summarise diffs |
| SAL0-04 Builder — Claude CLI | Yes | Yes — `edit-web-repo-when-assigned` |
| SAL0-09 Signal — Make | n/a | No, and should stay that way |

Read the first two rows together: **the seat that can execute cannot be woken,
and the seat that can be woken cannot edit.** SAL0-02 Runner is read-only by
design. So the only wakeable seat that can produce work is SAL0-04 — which the
supervisor currently asks for a POSITION and nothing else.

The permission already exists. `edit-web-repo-when-assigned`. **Nothing
assigns.**

## What not to add

- **Not Make.** SAL0-09 is webhooks, notification, and the Docs mirror. It has
  no repo access and should not get any. Routing work through it adds a hop and
  produces no diff.
- **Not a new seat.** A fifth opinion is not the shortage. Opinions are the one
  thing this system already overproduces.
- **Not desktop automation.** No layer creates a headless entry point that the
  surface does not expose.

## The change

One stage, after DECISION: hand `selectedNextAction` to the seat whose lane it
falls in, and require a **diff** as the return value instead of JSON.

```
POSITION → CRITIQUE → DECISION → EXECUTE → verify → commit on a branch
```

Envelope, chosen so this removes a barrier without hiding a failure:

- Runs in a **git worktree**, so a bad run cannot corrupt the working tree.
- Output is a **commit on its own branch**. Never a push, never `main`.
- `npm run verify` must pass. A failing verify is `BLOCKED - NEED OWNER`, not a
  commit and not a retry loop.
- **One action per run** — already guaranteed by the single-`selectedNextAction`
  rule. The council decides once; the executor does that one thing.
- Lane check before execution: a web action goes to SAL0-04, a Unity action is
  refused outright, not reassigned. Wrong lane is `WRONG LANE - REASSIGN`.
- The evidence is the diff. You read a commit, not a claim that work happened.

## Why this is the honest version of "remove barriers"

It removes the barrier that matters — the council currently cannot do anything —
while keeping every check that makes failure visible. The executor either
produces a readable diff that passes verify, or it stops and says which of the
fail-safe states it ended in. There is no third outcome, and no silent
self-healing.

The first proof is the same shape as §6: run it by hand, once, on one small
real action, and read the diff yourself before anything is scheduled.
