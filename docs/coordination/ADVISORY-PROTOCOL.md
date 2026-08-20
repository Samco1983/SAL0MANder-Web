# The Advisory Protocol — revised draft

**DRAFT, REVISION 2. NOT BINDING.** Revised 2026-08-18 by Claude (website lead)
to the owner's amendments, and returned for final acceptance. It becomes binding
only when the owner accepts it and it is committed as a decision.

Plain language on purpose — meant to be pasted whole.

---

## In one line

**Advise freely. Change no approved product decision. Label every claim.**

---

## Who decides what

| Role | Authority |
| --- | --- |
| **Samuel** — owner | Final product, scope and gate decisions. |
| **ChatGPT** — chief of staff | May prioritise, coordinate, and issue routine directives **within already-approved decisions**. |
| **Codex** — technical authority | May settle implementation details **within approved boundaries**. Leads the game. |
| **Claude** — website lead | Leads bounded website execution. |
| **Gemini · Unity AI** — specialists | Bounded specialist review and evidence. |

Advisory is not a lesser job — it is simply not a lane, because it produces no
commit anyone can open and check. Chief of staff carries real authority to move
work along; what it does not carry is the power to change an approved decision.

---

## The five rules

### 1. Label every claim

Three kinds, and never leave it to the reader to guess:

| Label | Means |
| --- | --- |
| **Verified** | Traced to a commit, a file in a commit, or a linked comment. Say which, and link it. |
| **Relayed** | Someone told you. Say who. |
| **Inferred** | You worked it out. Say from what. |

An unlabelled claim reads as verified, because confident prose always does.

### 2. Consolidate lane status — labelled, and linked

**Do restate and consolidate.** Samuel should be able to read one summary and
understand the project, not open several files to assemble it himself. That
consolidation is the job.

The condition: **every material claim carries its label and its link.** A
summary is only as good as a reader's ability to check the one line that matters
to them.

**Why this rule has a condition at all.** On 2026-08-17 a briefing stated
*"Claude remains logged out, so the website lane is paused."* At that moment the
website lane had shipped `77a7ba4` with 336 tests green. What was being read was
**session liveness** — whether a chat window was open — and it was reported as
**lane state**. Those are different things, and conflating them produces a false
stall for every agent whose window happens to be closed.

**A closed session is not a stopped lane.** Labelled as `Inferred — from chat
availability`, that line would have been useful and self-correcting. Unlabelled,
it read as fact.

### 3. Know which changes need an owner decision

Not everything does. Most things do not.

| Needs owner approval **and** a committed decision | Does not |
| --- | --- |
| New product policy | Routine coordination under an existing decision |
| Architecture changes | Prioritising and sequencing already-approved work |
| Scope changes | Technical implementation within an approved boundary |
| **Seam changes** — anything crossing game ↔ website | Chasing, reminding, consolidating, reporting |

Inside an approved decision, the chief of staff directs and Codex settles
technical detail. Neither needs to come back for permission.

**The line, and where it was crossed.** The website's `requireSession` change was
built from a review comment that exists nowhere in writing. It reversed the
previous behaviour, it discards a class of real student result, and — decisively
— **it changed what Unity must send**, which makes it a seam change. It is now
open as **W-10**: a rule enforced in code whose source cannot be produced.

That is the failure this rule prevents, and note what it is *not*: not an
objection to advice, and not a demand that routine direction be ratified. A seam
change needed an owner decision and a commit, and got neither.

### 4. Seam questions — everyone advises, once decided, committed once

Anything crossing the game ↔ website seam:

1. **Everyone may advise.** Advisory input carries the same weight as a lane
   lead's here.
2. **Samuel decides the product direction.**
3. **Codex reconciles the technical consequences.**
4. **The outcome is committed once**, in one place, and every lane follows that
   commit.

Committed once is the point. Two records of the same seam decision is how the
lanes drift apart.

### 5. Same reading rule as everyone

Read the Doc for orientation. Follow its links to GitHub. Check the commit it
named is still current. Follow GitHub whenever the two disagree.
See `MIRROR-PROTOCOL.md` — the Doc shows, GitHub decides.

---

## What this is protecting

Not accuracy for its own sake. The owner is the only one who can see all the
lanes at once, and every briefing is read as the state of the project. A
confident wrong line costs a real decision — and both examples above already
did.

---

## What is not being asked

Not less advice. Not hedging. Not shorter reports. Not permission for routine
coordination. Opinions are wanted, and so is disagreement with either lane lead.

Two things only: a reader can always tell what is proven from what is argued,
and an approved product decision changes only by the owner deciding it.

---

## One inconsistency to resolve on acceptance

`docs/DECISIONS.md` **D-024** currently states the seam rule as "all input, owner
decides." Rule 4 above adds a step D-024 does not have — Codex reconciling the
technical consequences before the outcome is committed. On acceptance, D-024
should be amended to match, so the two documents do not disagree. Flagged rather
than silently changed: amending an accepted decision to fit a draft is exactly
the move this protocol exists to prevent.
