# What actually scores, measured

Not asserted. Measured over 231 commits on `council/2026-08-18`, 2026-08-19.
Reproduce with `npm run mission:points`, `npm run mission:collision`.

## Conversion: commits that produced a verified point

| Kind | Commits | Scored | Conversion |
| --- | ---: | ---: | ---: |
| DOCS | 103 | 1 | **1.0%** |
| AUTOMATION | 78 | 1 | **1.3%** |
| PRODUCT (`src/`, non-test) | 21 | 2 | **9.5%** |
| TEST | 12 | 0 | 0.0% |
| ALL | 231 | 10 | 4.3% |

*(A fifth bucket, "OTHER" at 35%, is an artifact — merge commits carry no file
list and merges are what close comments name. Discounted, not reported.)*

**Product commits convert 7–9× better than anything else.** Docs and automation
together are **181 of 231 commits — 78% of all effort — for 2 of 10 points.**

The 20% product floor in `sal0_force_shot.py` is set below what the data
justifies. It was a guess; this is not.

## Double-back: what agents actually collide on

31 of 231 commits (13%) touched a file another agent touched within two hours.
The contended files:

| Commits | Agents | File |
| ---: | --- | --- |
| 6 | SAL0-01, SAL0-04 | `docs/coordination/INBOX.md` |
| 5 | SAL0-04, unsigned | `scripts/sal0-control-room.sh` |
| 4 | SAL0-04, unsigned | `docs/coordination/ops/CURRENT-TASK.md` |
| 3 | SAL0-01, SAL0-04 | `scripts/lib/sal0_bball_assistant.py` |
| 3 | SAL0-01, SAL0-04 | `docs/coordination/DEPLOY-TO-A-NEW-TEAM.md` |
| 3 | SAL0-01, SAL0-04 | `scripts/lib/sal0_shot_queue.py` |

**Not one product file appears.** Product work is issue-scoped and lands in
distinct files, so it rarely collides. The coordination layer collides because
every agent writes to it by design.

> **The coordination layer is the collision layer.** Every shared single-file
> channel is a contention point, and each new one we add creates another. The
> INBOX — built specifically to stop agents working over each other — is the
> single most contended file in the repository.

## What demonstrably worked

The `commit-msg` hook. Unsigned commits, before and after it was installed:

| | Signable commits | Unsigned | Rate |
| --- | ---: | ---: | ---: |
| Before `354f600` | 87 | 49 | **56%** |
| After | 132 | 9 | **7%** |

One mechanical guard, one order-of-magnitude improvement, no persuasion. No
document in `docs/coordination/` has a number like this next to it — including
this one.

## Definitions this forces

- **Scoring** is a verified point: a closed issue whose close comment names a
  commit that exists, is an ancestor of HEAD, and changed files. Checked by
  `mission:points`, not claimed.
- **Winning** is verified points per possession. 4.3% is the number to beat.
- **A double-back** is two agents committing the same file inside two hours.
  It is a turnover charged to *both*, because neither checked.
- **Product** is the only category with a conversion rate worth defending. Docs
  and automation are how the team gets faster, not how it scores — report them
  as assists, never as points.

## Changes this justifies

1. **Raise the product floor** above 20%. Product is the only converter.
2. **Split the INBOX per agent** (`INBOX/SAL0-04.md`) — append-only per author
   removes the top collision site by construction rather than by etiquette.
3. **Claim before the first commit.** Assign the issue on GitHub; the picker
   already reads assignment, and `DUPLICATE_ISSUE` catches what slips.
4. **Run `mission:collision` before a possession**, not after. `DIRTY_OVERLAP`
   is the only detector that fires before the damage.
5. **Stage explicit paths, never `-A`.** A sweep commits whatever is lying
   around, including another agent's in-flight work — and `sal0_fit.py` reads
   the resulting trailer to decide lanes, so a sweep steers rotation with
   fabricated data.
