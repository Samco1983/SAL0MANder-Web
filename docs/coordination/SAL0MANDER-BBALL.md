# SAL0MANder BBall

How multiple AI agents work as a team instead of taking turns.

Discovered, not designed — every rule came from a failure on 2026-08-18/19. The
ones without a scar are the ones most likely to be wrong.

---

## The one law

> **No agent grades its own homework.**

Every failure that night was the same failure: something reported success it had
not achieved. The loop announced `COMMITTED` for a commit the referee had
rejected. The blocker report announced "the mechanism is working" with nothing
cleared. The Control Room announced "Codex 42, Claude 31" when 26 of those were
Claude's own unsigned commits. A `signal: YOURS` — meaning *I am not touching
this work* — swallowed five staged files and called them a hand gesture.

**The worker changes files. The supervisor reads git and the exit code and
decides what happened.** The agent gets no say.

---

## The shot clock

**Speed is not a nice-to-have. A team that is not scoring has something wrong,
and the clock is how you find out which thing.**

Every action gets a clock. Hit the limit and it is a violation — you give up the
ball, you do not keep dribbling.

| Action | Clock | On violation |
| --- | --- | --- |
| One worker run | **15 min** | kill the process tree, keep the diff, report `BLOCKED` |
| One agent call | **5 min** | kill it, record `AGENT_TIMEOUT`, never retry silently |
| A blocker sitting unclaimed | **4 h** | escalate to the owner — nobody is coming |
| An issue with no commit against it | **24 h** | it is not a task, it is a wish. Close or split it |
| A whole night with 0 issues closed | **once** | stop building tooling. This happened |

**Measured that night:** Gemini took over five minutes to review five commits and
had to be backgrounded. That is a rebounder who cannot get down the floor, and
it is a real constraint on how often the seat can play — not a reason to bench
it, a reason to give it fewer commits per rebound.

**The rule under the clock:** a slow answer that arrives after the play is over
is worth less than a fast "I do not know." An agent that cannot finish inside
its clock must say so and hand the ball off, not run longer.

---

## The timing of the pass

In professional basketball the pass is timed to the split second, and it works
only because **the receiver is already ready to catch it.** A perfect pass to a
player who is out of the game is a turnover, and it goes in the passer's column.

Three ways a receiver is not ready, all seen in one night:

| Not ready | What it looked like | Cost |
| --- | --- | --- |
| **Out of quota** | Gemini's free tier is 20 requests/day; it was spent | 5 min of backoff, zero findings |
| **Authenticated on the wrong surface** | worked in a terminal, failed headless | three rounds of debugging |
| **Not running** | a blocker published to an agent that is asleep | sits until something polls |

**Preflight the receiver, not just yourself.** Before passing, check the catcher
is installed, authenticated *on the surface being used*, and inside its budget.

**Predict the next pass.** Mission Control should not wait for a worker to go
silent before thinking about the next receiver. Watch the floor: open issues,
dirty diffs, stale logs, failed checks, fresh commits, quota state, and who last
touched the ball. When the next pass is likely, prepare the catch packet before
the handoff lands:

```text
PREDICTED NEXT RECEIVER:
WHY:
CATCH PACKET READY: yes | no
UNCERTAINTY:
```

Prediction is not pretending to know. If the receiver or success check is
unclear, say so and pass a smaller job. The teammate should feel the pass
arrive, not decode it.

**Fast enough to score. Clear enough to catch. Honest enough to recover.**

**The pass has a clock too.** Codex's 10-minute heartbeat is the only reason a
published blocker gets caught — the trace works because something is looking. A
blocker published one minute after a heartbeat waits nine. That latency is this
system's real speed limit, and it is tunable: faster polling costs money, slower
polling costs time.

## Timeouts cause their own chaos

A timeout stops the game for *everyone*, and if two players can call one, nobody
knows whether the game is live.

That night: Codex paused the loop because a run looked stuck. Claude lifted the
pause because the cause was fixed. Neither told the other. For a stretch the
honest answer to "is it running?" was *nobody knows*.

1. **One brake, one location** — `~/.sal0mander/PAUSE`, outside the repo so no
   git operation can remove it. Two brakes means neither is the brake.
2. **Whoever calls it says why, in the file.** A pause with no reason cannot be
   safely lifted by anyone else.
3. **Only the caller or the owner lifts it.** Lifting another agent's pause
   overrules a judgement you did not see the evidence for.
4. **A timeout is not a fix.** It buys time to fix something. A pause older than
   an hour with no commit against its reason is an abandoned game, not a paused
   one.

## The huddle

The shot clock is only half of it. **A team that never slows down runs the same
broken play all night, faster.**

That is not theory. On 2026-08-19 the agents moved fast for six hours and
produced 253 plumbing changes, 6 product changes, and zero points. Every
decision that actually changed the outcome came from someone stopping the play:

| The stop | What it changed |
| --- | --- |
| *"I want actual work, not test verify test verify"* | six hours of tooling exposed as motion |
| *"you all need to show your data"* | produced the evidence rules, which caught four false claims |
| *"agents should not grade their own homework"* | the one law. Explained all five failures at once |
| *"maybe you need a new court"* | worktrees — fixed the whole class, not the instances |
| *"is this thing saved?"* | caught a loop reporting COMMITTED for work it never saved |

Not one of those came from an agent. Agents inside the game optimise the play
they are running. **They do not stop to ask whether it is the right play** —
that is what a huddle is for, and it is why the coach seat exists.

### When to call one

- **The same failure twice.** The execution is not the problem; the play is.
- **The scoreboard has not moved** while commits pile up. Always. This is the
  loudest signal in the system and the easiest to talk past.
- **Two agents disagree about who owns something.** Every turnover that night
  came from this. Talk before touching.
- **Before adding a player.** A new seat mid-game adds a variable to every
  failure that follows.
- **After any turnover.** Not to assign blame — to name the rule that prevents
  the next one.

### How to huddle

Stop. Read the Control Room. Say the uncomfortable number out loud. Name **one**
play. Then break and run it.

A huddle that produces three plays has produced none, and a huddle that ends
without anyone naming a number was just a rest.

**Speed wins possessions. Huddles win games.** Both, in the right order: huddle
to pick the play, then run it on the clock.

## The scoreboard

> **`queue: N open, M closed`. Nothing else is points.**

Plumbing commits are not points. Documents are not points. Passing `npm run
verify` is not points — it is staying inbounds.

The night this was written: **253 changes to plumbing, 6 to product. 15 issues
open, 0 closed.** A team running beautiful plays for six hours and never putting
the ball in the basket. Every play in this book worked and the score was 0.

**If the score has not moved, stop revising the playbook and shoot.**

### Time is the denominator

**A score with no clock cannot be judged.** "0 closed" could be a bad hour or a
catastrophic month, and until you divide by time you cannot tell which. Every
number below is a rate, because a total is a story and a rate is a measurement.

| Rate | What it answers | That night |
| --- | --- | --- |
| **points/hour** | issues closed ÷ hours elapsed | **0.0** over 6h |
| **possession efficiency** | commits that moved the score ÷ all commits | **6 / 259 = 2%** |
| **turnovers/hour** | work lost or misattributed ÷ hours | **0.8** — five in six hours |
| **time-to-clear** | median hours a blocker waits | **0.3h** — the one healthy number |
| **catch rate** | blockers cleared by another agent ÷ published | **4/5**, one needed a human |

Read them together and the diagnosis is unambiguous: **coordination was
excellent and production was zero.** Blockers cleared in twenty minutes, agents
caught each other's passes four times out of five — and 98% of all output moved
no score at all. A team with a great transition game that never takes a shot.

Neither number alone says that. `time-to-clear: 0.3h` on its own looks like a
triumph. `0 closed` on its own looks like laziness. **The ratio between them is
the actual finding**, and it only exists because both are divided by the same
clock.

**So: never report a total without the window it happened in.** `queue: 15 open,
0 closed` is incomplete. `queue: 15 open, 0 closed in 6h` is a measurement, and
it is the one that makes everything else in this book either earn its place or
get deleted.

### How to measure success

Time matters because basketball has a shot clock, but time is not the score.
Fast failure is useful only if the next possession improves. Slow strategy is
useful only if it creates a better shot.

Measure each run with five numbers:

| Measure | Counts as success | Does not count |
| --- | --- | --- |
| **Points** | an issue closed, a deploy unblocked, or a user-visible product improvement merged | more logs, more ceremony, more unassigned docs |
| **Pace** | time from assignment to commit, blocker, or timeout | time spent "working" with no evidence |
| **Catch quality** | the next agent can act from the handoff without asking Samuel | vague summaries, missing folder, missing success check |
| **Turnovers** | zero wrong-lane edits, false claims, swallowed work, or stale attribution | "we fixed it later" |
| **Readiness** | clean tree, verify pass, pushed branch, known blocker list | local-only success or unverified green text |

The board should read like this:

```text
POINTS:
PACE:
CATCH QUALITY:
TURNOVERS:
READINESS:
NEXT SHOT:
```

If time is removed, success is still measurable: did the queue move, did the
handoff get easier, did risk go down, and can the next agent score without a
human translating the play?

### Miss fast, recover faster

One perfect point every six hours is not winning. SAL0MANder BBall should accept
more misses if they are small, visible, and reversible. A fast miss with a clean
diff, clear blocker, or honest failed test gives the next player something to
rebound. A slow private struggle gives nobody a ball to play.

Good misses:

- a 15-minute spike that proves a route is wrong;
- a failed test with the failing command and exact error saved;
- a small reverted diff that teaches the next constraint;
- a blocker with owner, folder, branch, and one proposed next shot;
- a `SHAKY` signal attached to the evidence before anyone trusts it.

Bad misses:

- hours of uncommitted local work;
- a vague "still working" with no diff, log, or failing command;
- a big mixed commit that cannot be reviewed quickly;
- retrying a rate-limited agent until the clock dies;
- hiding a miss by reporting green text without proving the exit code.

The rule is not "make mistakes." The rule is **make catchable mistakes**. If a
miss cannot be rebounded, it is a turnover.

---

## Turnovers

A turnover is work that existed and then did not, or work credited to the wrong
player. They cost more than a missed shot: a miss leaves the ball live, a
turnover hands it to the floor.

**Every turnover that night came from two agents disagreeing about who owned
something.** Not from bad code.

| # | What happened | Root cause | The rule now |
| --- | --- | --- | --- |
| 1 | Loop committed a human's uncommitted edit as its own | shared working tree | **never start on a dirty tree** |
| 2 | `signal: YOURS` swallowed 5 staged files, 285 lines | `--allow-empty` is only empty if the index is | **a signal must carry no payload** |
| 3 | Loop reported `COMMITTED` for a rejected commit | read `HEAD`, which someone else had moved | **prove your own commit landed** |
| 4 | Control Room credited Claude's work to Codex | attribution by subtraction | **no jersey, no minutes** |
| 5 | Repo left in detached HEAD, work looked deleted | nobody claimed the checkout | **say where you are before you move** |

### The turnover rules

1. **Call it before you touch it.** `MINE` on the file, or stay off it. A call
   made after a collision is an apology.
2. **Never commit what you did not write.** `git add -A` on a shared tree is a
   turnover waiting for a timestamp. Worktrees make it impossible.
3. **Say where you are.** A checkout, a branch switch, a detached HEAD — announce
   it or another agent will read the old tree and conclude work was destroyed.
   That cost fifteen minutes and a genuine scare.
4. **Read the tree before you claim the ball.** `git status` costs nothing.

---

## The court

The court is **the terminal and the git repo**. Not chat windows.

A chat window leaves no trace another agent can read, cannot be woken by a
schedule, and holds state in memory no script inherits. Proved twice: `launchd`
runs jobs with a minimal PATH where `claude`, `node`, `npm` and `gh` are all
missing; and a Gemini CLI authenticated interactively still failed headless
because the key lived in the session.

**If a script cannot reach it, it is not on the court.**

---

## The roster

| # | Position | Who | Owns |
| --- | --- | --- | --- |
| 01/02 | Power forward / Center | Codex | plumbing, supervisor, launchd, Make |
| 03 | **Coach** | ChatGPT / OpenAI API | reads the floor, calls one play, never touches the ball |
| 04 | **Point guard** | Claude CLI | the web app. Brings it up, distributes |
| 07 | **Rebounder** | Gemini CLI | catches what the others miss. Never shoots |
| 09 | — | Make | notifications only |
| 10 | — | GitHub | the ledger. Never plays, always records |

**No jersey, no minutes.** A commit without `Sal0-From` or `Co-Authored-By` is
rejected by the referee.

---

## The plays

**FAST BREAK** — take the next thing off the queue and score. The default, and
the only one that moves the scoreboard.

**PICK AND ROLL** — you are blocked, so publish it and *keep moving*. Never ask.
Proven: five blockers published, four cleared by another agent with no human
relay, median 0.3h.

**BOARDS** — whoever did **not** ship it, checks it. Read diffs, not messages.

**TRAIL ME** — one agent fast and sloppy, another behind cleaning up. Beats two
agents both being careful.

**TIMEOUT** — `echo stop > ~/.sal0mander/PAUSE`. Outside the repo so no git
operation can remove the brake.

**INBOUND** — cold start: charter, doctrine, Control Room, then FAST BREAK.

---

## Reading the other player

The mechanism is **stigmergy** — coordination through traces in a shared
environment, not messages to a recipient. A request creates a dependency and a
wait. A published blocker creates a trace anyone can act on while you get on
with something else.

**The tell that separates it from a relay:** the scheduled agent read the trace;
the interactive agent needed a human. A 10-minute monitor found an *uncommitted*
file on disk, read it, and reported what it proved, with nobody telling it
anything. That is the mechanism. The `chmod` everyone celebrated was a relay, and
the transcript proved it.

**Signals** ride the same channel as the code — a commit carrying a trailer and
no work. `SHAKY` (*look at this, I am not confident*) is the most valuable and
least used, because "I might be wrong" is what prose buries and a rebounder
needs. When Claude signalled `SHAKY` on the work loop, Codex found and hardened
its worst path inside a few minutes, without being told what was wrong.

---

## The four officials

**Referee** — `scripts/hooks/commit-msg`. One rule, mechanical, on everyone. It
rejected its own author's commit thirty seconds after being written, which is the
whole argument for having one.

**Coach** — reads the floor and says the uncomfortable thing. First read:
*"253 plumbing, 6 product, 15 open, 0 closed. Nothing is scheduled, so all of it
happened because a human was awake and typing."*

**Scoreboard** — `queue: N open, M closed`.

**Rebounder** — the agent who did not shoot. Five defects shipped that night and
all five were caught by whoever made them. A self-caught miss is not a rebound.

---

## Separate courts

Workers run in isolated git worktrees. Not caution — arithmetic. Every collision
came from sharing one tree, and none is possible when each worker has its own.

Failure keeps the work and protects everyone: failed verify commits to the
worker branch and merges nothing; a base that moved mid-run refuses to merge
rather than resolving a conflict unattended at 3am. A fresh worktree has no
`node_modules`, so it is symlinked — otherwise verify fails on missing
dependencies and reads as a broken build.

---

## What we could not fake

- Verify's **exit code**, never its text. A run was announced green while lint
  failed, because the reader matched the reassuring words.
- **`HEAD` moving.** Announcing `COMMITTED` from a `HEAD` someone else moved is
  how work got credited to the wrong player.
- **`ONE THING THAT CHANGED`**, with `NOTHING CHANGED` a legitimate answer.
- **`HUMAN: yes | no`** on every cleared blocker. Cleared with `yes` is evidence
  of a relay — the thing this replaces — not of the mechanism.

---

## The test

> If the human stopped reading, would the agents still make progress?

That night it became yes: Codex cleared four blockers with no relay, including
the two Claude was sandboxed out of, and the loop produced real product code for
the first time — 285 lines across `UnityStage.tsx`, `GuestPlayPage.tsx` and two
test files, verify green at 416 tests.

**And the score was still 0.** Both are true. Learn the second one harder.
