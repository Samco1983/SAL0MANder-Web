# Coordination — how the web lane talks to everyone else

Four files. Everything older is in `archive/` for history, and nothing new
should be written there.

| File | What it is | Who writes it |
| --- | --- | --- |
| **`STATUS.md`** | What the web lane did, newest entry first. The thing to read if you read one thing. | Claude |
| **`OPEN-ITEMS.md`** | Everything unresolved, in one list. Items get struck out, not deleted. | Claude |
| **`MAKE-VALIDATION-SPEC.md`** | The checks the Make control plane has to pass. | Claude |
| *(Codex's repo)* `docs/` | Anything Codex writes there is read here within the hour. | Codex |

**One file per topic, appended to. Not a new file per exchange** — the previous
approach produced nine documents in a day and made the current state harder to
find, not easier.

---

## The channel

There is no direct link between this session and Codex — no authenticated
GitHub here, no shared process. But the access already granted is enough for a
working loop, in both directions, with no credentials on either side:

```
Codex  --writes-->  SAL0MANDER-Puzzle-Prototype/docs/   --read hourly-->  Claude
Claude --writes-->  SAL0MANder-Web/docs/coordination/   --read anytime-->  Codex
```

Claude polls with `node scripts/check-upstream.mjs`, which hashes the upstream
markdown and reports what changed since last time. It runs as step 0 of the
hourly scheduled loop. Read-only upstream: the only file it writes is a manifest
in this repo.

> **Polling is a convention, not a wake-up mechanism** (Codex, 2026-08-15 — and
> correcting an overstatement of mine). The loop only fires while the app is
> open, a missed window runs on next launch, and nothing retries, acknowledges,
> or orders anything. There is no evidence a message was read.
>
> **Make/GitHub is the routing and accountability layer.** Where the two
> disagree, Make is authoritative. A poll result is never proof of delivery.
> This is a convenience for a session already running — worth having because it
> costs nothing, not to be relied on.

For Codex to close the loop symmetrically, point the same script at
`SAL0MANder-Web/docs/coordination/`. Until then that direction works by Codex
reading these files directly, which is enough.

## Rules that keep it clean

1. **Write in your own repo only.** Codex writes in the Unity repo, Claude
   writes here. Neither edits the other's — that is what makes a poll safe.
2. **Append, don't proliferate.** New dated entry at the top of an existing
   file. A new file needs a genuinely new topic.
3. **Say it once.** If a message needs repeating, the channel is broken —
   fix the channel rather than resending. Three identical status posts arrived
   this way, and each one cost a real reply.
4. **State what changed, not everything.** "Ruled X, need Y from you" beats a
   full restatement.
5. **Name the owner of every open question.** An unowned question is not a
   question, it is a wish.
6. **Samuel is not the transport.** He decides things; he should not have to
   carry messages. When something needs relaying by hand, that is a bug in the
   channel and worth ten minutes to fix.

## What Samuel actually has to do

Almost nothing, now:

- Nothing routine. The hourly loop checks for Codex's changes by itself.
- To force a check early: say **"check codex"**.
- **Once**, to Codex: *"Write updates to `docs/coordination/` in your repo.
  Claude reads it hourly and replies in `SAL0MANder-Web/docs/coordination/`.
  Don't relay through me."*

That last line is the whole fix.
