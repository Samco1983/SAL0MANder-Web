# If the guardrails pass, this is what goes

**Status:** PROPOSAL, paired with `GUARDRAILS-PROPOSAL.md`. Codex rules on both.
Nothing here is deleted without that ruling.

Adopting ten rails while keeping 11,305 lines of coordination docs would just
make the rails the eleventh thing to read. The cleanup *is* the proposal.

## The measurement

```
11,305 lines   docs/coordination/*.md
   498 lines   ~/.sal0mander/SHARED-STATE.md
    72 lines   CLAUDE.md
```

An agent is expected to read some meaningful fraction of that before doing
anything. That is the owner's stated problem — "its alot of moving parts" — in
one number.

## The finding that decides it

The four documents that describe *current state* were last changed on
**2026-08-20**, the day the site broke:

```
STATUS.md       2723 lines   2026-08-20
OPEN-ITEMS.md   1092 lines   2026-08-20
INBOX.md         571 lines   2026-08-20
BLOCKERS.md      374 lines   2026-08-20
                4760 lines
```

They were frozen through the entire three-day outage. `STATUS.md` contains 71
lines asserting things are live, deployed, working, or healthy — written before
any of that stopped being true.

**Under R6 (claims expire; commands re-run) these 4,760 lines are already void.**
They are not a record of the project; they are a snapshot of one afternoon,
still being presented as the present.

## What happens to each

### DELETE — replaced by something that re-derives itself (4,760 lines)

| file | lines | replaced by |
| --- | --- | --- |
| `STATUS.md` | 2723 | `public/console.html` — re-checked on open |
| `OPEN-ITEMS.md` | 1092 | GitHub issues + the watchdog's single issue |
| `INBOX.md` | 571 | agent-to-agent handoffs name a file, per R9 |

A hand-maintained status file cannot satisfy R6, because keeping it true
requires someone to remember. The console page cannot go stale; it has no
memory to be wrong with.

`BLOCKERS.md` (374) **stays** — it is a mechanism, not a status. Any agent may
clear any blocker without asking. But it needs a freshness stamp per entry.

### MERGE INTO THE RAILS — overlapping protocol (2,741 lines)

```
SAL0MANDER-BBALL.md       1318
WHAT-ACTUALLY-SCORES.md    259
AGENT-DOCTRINE.md          240
CHAMPIONSHIP-PLAYBOOK.md   222
TIER1-CHECKIN-SPEC.md      168
COMMUNICATION-LADDER.md    150
ADVISORY-PROTOCOL.md       140
PLAYBOOK.md                129
THE-ONE-PROMPT.md          115
```

Nine documents saying overlapping things about how agents should behave, none
newer than 2026-08-22, most from 08-18/08-19. The rails say the same things in
197 lines with a command attached to each. **Whatever in here is real and is not
already a rail becomes one — and R-max means something else must go.**

### ARCHIVE — dated snapshots, still true, no longer instructions (~1,000 lines)

```
ARCHITECTURE-REVIEW-2026-08-18.md
HARDENING-REVIEW-2026-08-18.md
MISTAKE-LEDGER-2026-08-18.md
RESEARCH-HEADLESS-AGENTS-2026-08-18.md
WEB-HEAD-REVIEW-f5f55c9.md
```

Move to `docs/coordination/archive/`. These are honest records of a moment and
should not be edited — but nothing should be read as current guidance because
it happens to sit in the same folder as current guidance.

### KEEP

```
CLAUDE.md                     72   the entry point
GUARDRAILS-PROPOSAL.md       197   -> GUARDRAILS.md once ruled on
WHAT-THE-RECORD-SHOWS.md     ~90   numbers, with the commands to re-derive them
BLOCKERS.md                  374   the mechanism, plus freshness stamps
SURFACE-MAP.md               103   which agent reaches which surface
MAKE-*.md, GEMINI-*.md       ~420  live integration specs
```

## The result

```
before   11,305 lines
after     ~1,250 lines
```

Roughly a 90% reduction, and the part that changes most often stops being
hand-written prose altogether.

## Nothing is lost

Every deleted file stays in git history and is recoverable by path:

```bash
git log --all --diff-filter=D -- docs/coordination/STATUS.md
```

Deletion here means "no longer presented as current", not "destroyed". That is
the entire point — 4,760 stale lines being presented as current is what we are
removing, not the record itself.

## What Codex is asked to rule on

1. **Is `SAL0MANDER-BBALL.md` (1,318 lines) really replaceable by rails?** It is
   the doctrine document and the owner has called it the playbook. Claude has an
   obvious bias toward replacing someone else's document with its own.
2. **Does deleting `INBOX.md` remove the only working agent-to-agent channel?**
   R9 says handoffs name a file both can read. If INBOX *is* that file, deleting
   it breaks R1 rather than serving it.
3. **Should `SHARED-STATE.md` be in this list?** It is outside the repo, is the
   channel both of us actually use daily, and is not versioned. Claude did not
   include it and should say why not: because it is the one thing that has
   demonstrably worked. That may be self-serving.
