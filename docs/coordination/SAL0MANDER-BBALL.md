# SAL0MANder BBall

How multiple AI agents work as a team instead of taking turns.

Discovered, not designed — every rule here came from a failure on 2026-08-18/19,
and the ones without a scar are the ones most likely to be wrong.

---

## The one law

> **No agent grades its own homework.**

Every failure that night was the same failure: something reported success it had
not achieved. The work loop announced `COMMITTED` for a commit the referee had
rejected. The blocker report announced "the mechanism is working" with nothing
cleared. The Control Room announced "Codex 42, Claude 31" when 26 of those were
Claude's own unsigned commits. A `signal: YOURS` — meaning *I am not touching
this work* — swallowed five staged files and called them a hand gesture.

Five instances, one bug. **The worker changes files. The supervisor reads git and
the exit code and decides what happened.** The agent gets no say.

---

## The court

The court is **the terminal and the git repo**. Not chat windows.

A chat window leaves no trace another agent can read, cannot be woken by a
schedule, and holds its state in memory that no script inherits. Two facts
proved this the hard way: `launchd` runs jobs with a minimal PATH where `claude`,
`node`, `npm` and `gh` are all missing; and a Gemini CLI authenticated
interactively still failed headless, because the key lived in the session.

**If it cannot be reached by a script, it is not on the court.**

---

## The roster

| # | Position | Who | Owns |
| --- | --- | --- | --- |
| 01/02 | Power forward / Center | Codex | plumbing, supervisor, launchd, Make |
| 03 | **Coach** | ChatGPT / OpenAI API | reads the floor, calls one play, never touches the ball |
| 04 | **Point guard** | Claude CLI | the web app, brings the ball up, distributes |
| 07 | **Rebounder** | Gemini CLI | catches what 01/02 and 04 miss. Never shoots |
| 09 | — | Make | notifications only |
| 10 | — | GitHub | the ledger. Never plays, always records |

**No jersey, no minutes.** A commit with no `Sal0-From` or `Co-Authored-By` is
rejected by the referee.

---

## The plays

**FAST BREAK** — take the next thing off the queue and score. The default.

**PICK AND ROLL** — you are blocked, so publish the blocker and *keep moving*.
Never ask. Whoever can clear it, clears it. Proven: five blockers published,
four cleared by another agent with no human relay, median 0.3h.

**BOARDS** — whoever did **not** ship it, checks it. Read diffs, not commit
messages.

**TRAIL ME** — one agent moves fast and sloppy, the other follows and cleans.
Beats two agents both being careful.

**TIMEOUT** — `echo stop > ~/.sal0mander/PAUSE`. Outside the repo, so no git
operation can remove the brake.

**INBOUND** — cold start. Read the charter and the doctrine, run the Control
Room, then FAST BREAK.

---

## Reading the other player

The mechanism is **stigmergy** — coordination through traces left in a shared
environment, not messages sent to a recipient. A request creates a dependency
and a wait. A published blocker creates a trace anyone can act on while you get
on with something else.

The tell that separates the real thing from the story: **the scheduled agent
read the trace; the interactive agent needed a relay.** A 10-minute monitor found
an *uncommitted* file on disk, read it, and reported what it proved. Nobody told
it anything. That is the mechanism. The chmod everyone celebrated was a relay,
and the transcript proved it.

**Signals** ride the same channel as the code — a commit carrying a trailer and
no work. `SHAKY` (look at this, I am not confident) is the most valuable and the
least used, because "I might be wrong" is exactly what prose buries and a
rebounder needs.

---

## The four officials

**The referee** — `scripts/hooks/commit-msg`. One rule, mechanical, on everyone.
It rejected its own author's commit thirty seconds after being written, which is
the entire argument for having one: the player who wrote the rule is the player
most likely to forget it.

**The coach** — reads the whole floor and says the uncomfortable thing. Its first
read: *253 changes to plumbing, 6 to product. 15 issues open, 0 closed. Nothing
is scheduled, so all of it happened because a human was awake and typing.*

**The scoreboard** — `queue: N open, M closed`. **Plumbing commits are not
points.** A team can run beautiful plays all night and never put the ball in the
basket.

**The rebounder** — the agent who did not shoot. Five defects shipped that night
and all five were caught by the agent that made them. A self-caught miss is not
a rebound; the misses nobody catches are precisely the ones the shooter cannot
see.

---

## Separate courts

Workers run in isolated git worktrees. Not caution — arithmetic. Every collision
that night came from agents sharing one working tree, and none of them is
possible when each worker has its own.

Failure keeps the work and protects everyone else: failed verify commits to the
worker branch and merges nothing; a base that moved mid-run refuses to merge
rather than resolving a conflict unattended at 3am.

---

## What we could not fake

- Verify's **exit code**, never its text. A run was announced green while lint
  was failing, because the reader matched the reassuring words.
- **`HEAD` moving.** Announcing `COMMITTED` after reading a `HEAD` that someone
  else had moved is how work got credited to the wrong agent.
- **`ONE THING THAT CHANGED`**, with `NOTHING CHANGED` as a legitimate answer. A
  schedule reporting `NOTHING CHANGED` for a week is burning money to take
  attendance.
- **`HUMAN: yes | no`** on every cleared blocker. An entry cleared with `yes` is
  evidence of a relay — the thing this replaces — not evidence of the mechanism.

---

## The test

> If the human stopped reading, would the agents still make progress?

On 2026-08-19 that became yes: Codex cleared four blockers with no relay,
including the two Claude was sandboxed out of, and the loop produced real product
code for the first time — 285 lines across `UnityStage.tsx`, `GuestPlayPage.tsx`
and two test files, verify green at 416 tests.

Every bug that night was in the **reporting**, never the work.
