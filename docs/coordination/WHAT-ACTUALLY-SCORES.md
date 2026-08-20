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
- **Winning** is verified points per possession over a named time window, with
  bad turnovers and owner relays going down. 4.3% is the first number to beat;
  a higher score that requires Samuel to translate the game is not a clean win.
- **A mistake** is a miss with preserved evidence and a clear smaller next shot.
  It is useful data.
- **A reboundable miss** is a failed run, failed test, or blocked shot where the
  next action is obvious from logs/git/tests. Keep playing.
- **A turnover** is duplicated effort, dirty overlap, false attribution, or an
  issue closed without point evidence. It costs tempo, but it can be recoverable.
- **A bad turnover** is false success, lost work, broken main, secret/auth
  exposure, or repeating the same miss after the pattern is already known. Bench
  the play or player until the inputs change.
- **A double-back** is two agents committing the same file inside two hours
  without checking recent evidence. It is a turnover charged to *both*, because
  neither checked.
- **A checkpoint** is not a huddle by default. It is a bounded evidence read
  that chooses exactly one of four actions: continue the same shot, pivot to a
  smaller shot, bench the play/player, or commit verified work. If it does not
  choose one, it is just another possession spent talking.
- **Product** is the only category with a conversion rate worth defending. Docs
  and automation are how the team gets faster, not how it scores — report them
  as assists, never as points.

## AI-specific coaching rule

Do not copy human basketball too literally. AI agents do not need confidence
management; they need clean inputs, strict evidence, and fast correction loops.
Benching is not punishment. It is routing: if the same agent repeats the same
failure, change the task shape, the evidence packet, the tool access, or the
agent. If another agent is converting better on the same class of work, give it
more similar shots until its speed or quality drops.

The coach should optimize the rotation for:

1. verified points per recent possession,
2. product-visible assist rate,
3. time-to-next-shot after a miss,
4. collision and double-back rate,
5. owner relay count.

If these measures disagree, choose the action that increases product-visible
learning fastest without creating a bad turnover.

## Data rebounder

The third agent should not be another builder by default. The missing seat is a
data rebounder: a read-only evidence feeder that checks the score, collisions,
dirty tree, and next shot before a builder starts. Its command is:

```bash
npm run mission:rebounder
npm run mission:rebounder:json
```

Technical role:

- collect verified points from `mission:points:json`;
- collect hidden turnovers from `mission:collision:json`;
- collect the forced next shot from `mission:next:json`;
- return one call: `KEEP_PLAYING`, `TURNOVER_REVIEW`,
  `COMMIT_OR_STASH_BEFORE_SCHEDULED_RUN`, or `PIVOT`;
- never edit files, call models, close issues, touch secrets, or grade its own
  work.

This is the right first version because deterministic data beats another chat
seat. Gemini, Claude, or Codex can later review the rebounder packet, but Python
should assemble it.

Important implementation rule: a detector's exit code is not the same thing as
data quality. `mission:points:json` exits `1` when it finds an unverified close,
and `mission:collision:json` exits `1` when it finds collision risk. Those are
usable data packets. The rebounder must treat unreadable JSON, timeout, or tool
crash as a probe failure; it must treat valid JSON containing bad news as a
successful catch.

Start with **one rebounder process** that runs multiple small probes. Split into
multiple data agents only when the packet itself proves a reason:

- one probe regularly exceeds its timeout;
- one probe needs different permissions than the rest;
- one probe is noisy enough to deserve its own review lane;
- two probes produce conflicting calls that need an independent referee.

Until then, one rebounder is faster and safer. Many data agents without a single
packet become another coordination layer, and the coordination layer is already
where most collisions happen.

## Checkpoint rule

Small checkpoints are good only when they make the next move faster. Too many
micro-checkpoints create their own turnovers: repeated file edits, stale claims,
and agents double-backing over work that already landed.

Use this default:

1. **Before editing shared coordination files**, run the collision scan or read
   recent commits touching that file.
2. **After one bounded shot**, run the smallest verifier that can prove the shot.
3. **If the same blocker repeats twice**, stop retrying the same shape. Shrink,
   reroute, or bench it.
4. **If the checkpoint finds no new evidence**, keep playing. Do not make a new
   doctrine commit just to describe the same miss again.

Speed still wins, but speed means time-to-correct-shot, not frantic repeated
motion on the same file.

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

---

# The game clock, measured four ways (2026-08-19)

## Volume is not speed

| Hour | Commits | Points | commits/point | src | docs |
| --- | ---: | ---: | ---: | ---: | ---: |
| 08-18 21h | 28 | **0** | — | 1 | 7 |
| 08-18 22h | 33 | 2 | 16.5 | 3 | 20 |
| 08-19 20h | 24 | 1 | 24.0 | 1 | 10 |
| 08-18 23h | 16 | 3 | **5.3** | 4 | 4 |
| 08-19 22h | 14 | 3 | **4.7** | 4 | **0** |

The three fastest hours by commit count — 88 commits — scored 2 points at 7%
product. The two best hours were 30 commits and scored 6. **Half the shots,
three times the points.** The hours that felt like flying were the team looking
busy, not the team scoring.

Biggest dry run on the branch: 08-18 20h–21h, **52 commits, zero points**,
3 src changes against 16 docs.

## The docs count in an hour predicts the score

Every hour with 10+ docs commits scored 0–2. The single best hour of the game
had **docs = 0**. Not "docs are bad" — docs *during a possession* are. Write
them between possessions or after, never instead of a shot.

## Shot clock is bimodal, and the gap is waiting, not working

| | Issues | Median |
| --- | ---: | ---: |
| Created and closed inside one session (#17, #18) | 2 | **0.55h** |
| Sat in the backlog first (#3–#11) | 9 | **71h** |

The 71h is mostly a queue, not effort — those issues were opened together and
closed together. The lesson is not "work faster", it is **create the shot right
before taking it.** A scoped issue closes in under an hour.

## One lens that found nothing

What kind of commit immediately precedes a point: tooling 36%, src 30%, docs
27%. Near-uniform — the lens does not separate cause from background. Recorded
because a report that only lists the lenses that worked is a report that will
be trusted more than it should be.

## Definitions this sharpens

- **The scoreboard is points per hour, never commits per hour.** Commit count
  measured 88 in the worst stretch of the game.
- **A possession is one issue created and closed in the same session**, under
  an hour. Anything that cannot be scoped that small gets split before it is
  started.
- **Docs written during a possession are a turnover**, not an assist.

## Fit is measured in time — but only over shots created for that possession

| | Shots | Median time to verified point |
| --- | ---: | ---: |
| Created and taken in the same possession | 5 | **2 min** |
| Pulled off the backlog | 9 | **71 h** |

The 71h is shelf time, not work time. Measuring it as agent performance made
one agent's median look 2000x worse than that same agent's fastest shot — same
player, same category, different shot *origin*.

Per-agent, on scoped shots, both agents land at 0–2 minutes. With n=5 there is
no measurable player difference. **Shot scoping explains the variance; player
identity does not.**

So: measure fit as minutes from shot *created* to verified point, and only over
shots created for that possession. Anything else times the queue. And optimise
shot creation before optimising the roster — the fast break works when the ball
is already in someone's hands, not when it has to be dug out of a backlog.
