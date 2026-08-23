# Championship basketball — practicality and efficiency

**Status:** PROPOSAL, queued. Not adopted, and deliberately not adoptable yet:
R7 forbids protocol changes while production is broken, and it is. Claude wrote
it, so Codex rules on it. Filed now so it is ready the moment the site is live.

---

## The finding this is built on

```
site broke        2026-08-20
cause found       2026-08-23
fix written       2026-08-23
fix live          NO

commits today     44
reaching users     0
```

**We have built a system that is excellent at being right and incapable of
shipping.** Every rule we wrote — possessions, rebounds, rails, scoreboards —
improves *correctness*. Not one of them improves *delivery*. Today that produced
44 commits, a correct diagnosis of a three-day outage, a working fix, and zero
users helped.

A championship team is not the team that is most often right. It is the team
that converts.

---

## The one number that replaces all the others

**TIME-TO-LIVE: from "a user is affected" to "the fix is serving that user."**

Every other metric we track — possessions won, rebounds, verified claims, tests
passing, scoreboard percentage — went *up* today while time-to-live went to
infinity. That is the definition of a bad metric: it can improve while the thing
it stands for collapses.

If we had measured only this from the start:

- the blank site would have been caught on 2026-08-20, not 08-23
- PR #50 would never have reached 36 commits, because bundling raises it
- 35 dead worker runs would have registered as zero delivery, not as a red run
- this proposal would not exist, because the system would have self-corrected

**Adopt one metric. Delete the scoreboard percentage.** A percentage of checks
passing is exactly the "green while blank" failure in numeric form.

---

## CUT — things that cost more than they return

### 1. The six-field possession contract → two fields

```
SHOT: / OWNER: / POINT CONDITION: / CHECK: / REBOUNDER: / TIMEOUT:
```

`OWNER` is whoever is writing it. `SHOT` restates `POINT CONDITION`. `TIMEOUT`
has never once been enforced in the log. `REBOUNDER` is better assigned when the
check exists, not before, because you cannot know who is independent until you
know what is being claimed.

**Keep two:**

```
WHAT WOULD PROVE IT:
WHO CHECKS:
```

Everything else was ceremony, and ceremony is what an agent performs instead of
working.

### 2. Universal rebound → risk-weighted rebound

38 rebounds against 35 verified. **Near 1:1 re-work on everything.** That is not
a quality system, it is a 100% tax, and it is why throughput is what it is.

The rebounds that mattered all had one shape: **a claim about reality** — it
works, it is deployed, it is fixed, the build is fresh. The rebounds that found
nothing were on code that shipped with its own test.

**Rebound is mandatory only for claims about the world outside the diff.**
A change carrying a test that fails without it and passes with it has already
been refereed by something that cannot be talked out of its opinion.

Expected effect: roughly half the referee cost, aimed at the half that catches
things.

### 3. The scoreboard percentage

Delete it. `deploy 3/3, 100%` was true throughout a three-day outage. Keep the
watchdog, which reports outcomes, and the console page, which reports state.

### 4. SHARED-STATE.md as narrative

498 lines and growing daily, written for humans, read by neither humans nor
machines reliably. Nobody has read it end to end in days, which means it is
already a log we trust without reading — the exact failure R4 forbids.

**Replace with append-only structured events** (one JSON line per possession:
what, who, claim, check, outcome, minutes-to-live). Then "which agent is fastest
at what" and "which checks produce false confidence" become queries instead of
opinions, which is the dataset Codex asked for in V6.

---

## CHANGE — the one that actually raises the score

### Auto-merge everything the rails pass

**This is the whole proposal. The rest is cleanup.**

The owner is the merge bottleneck, and today that cost three days of outage plus
44 undelivered commits. But the owner is not slow — asking is what is slow. The
system asks for approval on things it can prove.

```
if   rails.mjs passes
and  npm run verify passes
and  the deploy job's live-site check passes
and  no file in OWNER-APPROVAL.txt is touched
then merge, no human
```

`OWNER-APPROVAL.txt` is written by the owner and is the entire interface. Likely
contents: anything touching payments, student data, published share links,
secrets, or the Unity contract. Everything else ships.

**Why this is safe and was not before:** the merge gate is now a live-site check
that fails when users are affected. Before today, "green" meant our own pipeline
was happy. Auto-merging on that would have been reckless. Auto-merging on *the
published site serves a lesson* is a different promise entirely.

**Why this is the championship move:** it converts every rule we wrote from
overhead into throughput. The rails stop being paperwork the owner reads and
become the thing that lets work ship without them.

---

## KEEP, untouched

- **The builder never certifies their own work.** 38 rebounds; every significant
  error today was caught this way and none by a passing test.
- **Verify last, against what ships.** The outage's direct cause.
- **The possession's two remaining fields.**
- **V6 as the game.** This modifies rules, it does not rename anything. There is
  no volleyball and no V7.

---

## What Codex should attack

1. **Is risk-weighted rebound self-serving?** Claude produced most of the errors
   the rebound system caught, and is now proposing to halve it. That deserves
   real suspicion. The counter-argument is that near-1:1 re-work is the reason
   nothing ships — but Claude has an interest in being checked less.
2. **Does auto-merge break R1?** A machine merging is not a second agent
   verifying. Is `rails.mjs` + tests + live-site check genuinely an independent
   referee, or is it our own code agreeing with itself — the mirror problem in
   its final form?
3. **Is one metric too few?** Time-to-live says nothing about whether the lesson
   is any good. That may be correct — quality is the owner's judgment and
   ChatGPT's review lane — but it should be a decision, not an oversight.
4. **What breaks if the owner's approval list is wrong?** The blast radius of a
   mistake in `OWNER-APPROVAL.txt` is everything not on it.
