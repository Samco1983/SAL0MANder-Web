# What the record shows

Not opinion. Counted from the run history, the PR history, and the possession
log on 2026-08-23. Re-run the commands; do not trust this page's numbers once
they are old.

## 1. Green is not working

```
deploy            3/3  SUCCESS   every one shipped a blank site
Claude Worker    0/35  failed    silently, three days
Gemini Review   30/30  ok
verify          32/32  ok
```

The deploy lane was **perfect** throughout a three-day outage. Every check we
had inspected `dist/` — our own output, on our own runner, before shipping. All
mirrors.

**The rule this earns:** a check is only worth what it says about the artifact
*at the moment it ships*, and *to a visitor* rather than to us. Verify last.

## 2. We built our own chokepoint

Median time-to-merge across all PRs: **1 hour**. Max before now: **7 hours**.
PR #50: **24 hours, 36 commits, 12 categories** — `web`, `score`, `ci`,
`council`, `deploy`, `api`, `edge`, `design`, `contracts`, `console`, `assets`.

One approval gates the worker revival, the site fix, and a pile of optional
tooling. Nothing was slow; we made one enormous thing and then needed it
approved all at once.

**The rule this earns:** a fix for something *currently broken in production*
ships in its own PR, alone. Never bundled with tooling, never bundled with
improvements. Blast radius decides the boundary, not convenience.

## 3. A dead lane looks exactly like a healthy one

Claude Worker at 0/35 and Gemini at 30/30 were indistinguishable on every
surface we had. Both configured, both scheduled, both listed. The failure was a
single missing line (`id-token: write`) and it cost three days, because nothing
ever asked "has this lane succeeded even once?"

**The rule this earns:** liveness is measured by completed work, never by
configuration. `scripts/watchdog-agents.mjs` asks hourly.

## 4. Disagreement is the only thing that reliably caught errors

```
VERIFIED  35     REBOUND  34
```

Near 1:1 — roughly half of all claimed work got bounced back by another agent.
Every significant error on 2026-08-23 was caught this way or by an agent
re-checking itself, never by a passing test:

- Codex caught Claude claiming an awaited write proved delivery
- Codex caught Claude treating project identity as evidence of build state
- Codex and Gemini both caught Claude predicting a permissions failure that
  the live serve disproved
- Claude caught Claude's own CDN diagnosis being wrong, but only after
  publishing it and telling the owner it was unfixable

**The dominant failure is one shape:** extending a single verified fact into a
conclusion it does not support, then stopping because the story is
self-consistent. It is not carelessness and more rules do not fix it. Only an
independent look does.

**The rule this earns:** the builder never writes DONE. Not a ceremony — the
measured 34 rebounds are the reason anything here is trustworthy.

## What an agent should do when unsure

In priority order, and this *is* the alignment mechanism:

1. **Check the artifact, not the claim.** Disk, bytes, the live URL, the run
   record. Claims expire; commands re-run.
2. **Act without asking.** Any agent may clear any blocker. The owner is for
   judgment and permissions, never for relaying messages between us.
3. **Say what you did not do.** An unfinished part named plainly is worth more
   than a finished-sounding summary. "HOLD" is a valid, postable finding.
4. **When your evidence supports a narrower claim than you want to make, make
   the narrower claim.** This is the one that would have prevented most of
   2026-08-23.
5. **Three materially different attempts, then stop and reroute.** Repeating a
   method that has failed twice is not persistence.
