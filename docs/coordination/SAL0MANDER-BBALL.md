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

## Rule hygiene

Too many rules becomes its own turnover. A rule earns its place only if it does
at least one of these:

- prevents a repeated bad turnover;
- makes the next pass easier to catch;
- protects secrets, lanes, or deployability;
- turns a vague report into evidence;
- moves the win condition faster.

If a rule does none of those, delete it or demote it to an example. The playbook
should stay small enough that a cold agent can read it and start playing before
the shot clock expires.

That is why speed matters. The clock exposes rules that sound smart but do not
help the next play. If a rule slows the team down without improving score,
safety, evidence, or learning, it is not discipline — it is drag.

## Autonomy rule

An agent that needs to be prompted to death is not playing SAL0MANder BBall.
Once the win condition, lane, repo, and hard stops are known, the agent should
choose the next bounded shot and take it.

Default behavior:

1. Read the scoreboard.
2. Pick the closest useful shot in lane.
3. State the SMART goal and clock.
4. Edit, test, commit, or publish a blocker.
5. Report evidence and the next shot.

Ask Samuel only for a hard stop: secrets, destructive action, spending,
cross-lane ownership, product fork, or milestone acceptance. Everything else is
part of playing.

Samuel is the owner, not the nightly coach and not a player on every possession.
The owner sets the win condition, approves real risks, and checks whether the
team is worth keeping. If the owner has to call every play, translate every
pass, wake every agent, and rescue every timeout, the team is not autonomous
yet. Mission Control exists so the owner can leave and the game still moves.

---

## The shot clock

**Speed is not a nice-to-have. A team that is not scoring has something wrong,
and the clock is how you find out which thing.**

BBall exists because agents are slow unless the system makes speed visible.
Without a clock, "working" and "stuck" look the same. With a clock, slow agents
have to do one useful thing: shrink the task, pass the ball, publish the
blocker, or get benched for that possession.

Losing is letting time run out with no shot attempt. A missed shot with evidence
can be rebounded. A clock that expires while everyone is still discussing what
to do gives the team nothing.

Every action gets a clock. Hit the limit and it is a violation — you give up the
ball, you do not keep dribbling.

Every play also needs a SMART goal. This keeps agents focused and prevents them
from questioning the objective while the clock is already running.

```text
SMART GOAL
Specific:
Measurable:
Achievable:
Relevant:
Time-boxed:
```

If the goal is not SMART, do not start a worker run. Split it until one agent
can take one shot with one success check inside one clock.

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

### Coaching cadence

Coaching is not constant interruption. Coaching happens on rhythm:

| Game moment | Mission Control version | Coach asks |
| --- | --- | --- |
| Quarter check | every 3 hours or 10 commits | Are we winning this stretch? |
| Halftime | midpoint of a work session or before sleep | What changed, what failed, what is the second-half plan? |
| End of game | morning / release / owner review | Did the win condition move? |
| Emergency timeout | flagrant turnover or unsafe state | Can play continue safely? |

Between those moments, agents play. The coach can adjust the strategy, but the
coach should not dribble the ball for the team.

### How to huddle

Stop. Read the Control Room. Say the uncomfortable number out loud. Name **one**
play. Then break and run it.

A huddle that produces three plays has produced none, and a huddle that ends
without anyone naming a number was just a rest.

**Speed wins possessions. Huddles win games.** Both, in the right order: huddle
to pick the play, then run it on the clock.

Huddles are not permission to stop constantly. They exist to prevent repeated
bad play, not to interrupt every possession. If the next shot is already clear,
take it. If the same agent still owns the same SMART goal and the evidence is
moving, keep playing.

### Micro-huddles

A play is one bounded possession:

- one issue attempt;
- one worker run;
- one review/rebound;
- one blocker clear;
- one deploy check;
- one deliberate spike with a stated clock and success check.

A file edit is not automatically a play. A chat message is not automatically a
play. A test rerun is not automatically a play. Those are touches inside the
same possession unless they change the owner, objective, risk, or result.

After a completed play or major checkpoint, hold one small discussion before the
next handoff. Not a meeting, not a new planning phase — a quick read of what
just happened so the next pass is timed better.

The micro-huddle has a clock:

| Situation | Clock | Output |
| --- | --- | --- |
| Clean score | 2 minutes | next shot and receiver |
| Live-ball miss | 3 minutes | what was learned and who rebounds |
| Bad turnover | 5 minutes | cause, preserved evidence, prevention rule |
| Flagrant turnover | no clock | TIMEOUT until owner clears resume |

Use this format:

```text
MICRO-HUDDLE
What just happened:
What changed:
What did we learn:
Next receiver:
Next shot:
Stop doing:
```

A micro-huddle earns its time only if it makes the next possession clearer. If
it creates more than one next play, it is no longer a micro-huddle — call a real
huddle or choose one shot and move.

Too many micro-huddles hurt the team. Do **not** call one after every tiny
touch. Skip it when the same agent is continuing the same possession, the next
action is already written, the tree is clean, and there was no miss or turnover.

### Long huddles and timeout budget

Long huddles are expensive. In a real game, bad timeout timing can lose the
game; Mission Control has the same risk. A long huddle can break rhythm, lose
context, leave automation paused, and make every agent wait for Samuel again.

Call a long huddle only for:

- repeated same-cause mistakes;
- three bad turnovers in one window;
- any flagrant turnover;
- a deploy decision;
- a new agent/role entering the court;
- a scoreboard stall: 10 commits or 3 hours with no point;
- a change to the win condition.

Budget:

| Huddle | Budget | Must produce |
| --- | --- | --- |
| Micro-huddle | 2-5 minutes | next receiver, next shot, one lesson |
| Long huddle | 15 minutes | one play, one owner, one success check |
| Timeout | until cleared | preserved state, caller, reason, resume condition |

The danger is not slowing down. The danger is slowing down and failing to get
back into rhythm. A huddle that does not restart the next possession is a
turnover by another name.

## The scoreboard

> **`queue: N open, M closed`. Nothing else is points.**

Plumbing commits are not points. Documents are not points. Passing `npm run
verify` is not points — it is staying inbounds.

But scoring is not the same as winning. A point only matters if it moves the
team toward the win condition. Closing the wrong issue, improving the wrong
lane, or shipping work that makes Samuel's real objective harder is empty
scoring.

The win condition must be visible:

```text
WIN CONDITION:
CURRENT SCORE:
ARE WE WINNING: yes | no | unclear
WHY:
NEXT POINT THAT MATTERS:
```

For SAL0MANder Mission Control, **winning** means:

1. Samuel can stop supervising without the work stopping.
2. Agents produce user-visible SAL0MANder improvement, not only coordination
   infrastructure.
3. Evidence is durable in GitHub: issue, commit, test result, log, or blocker.
4. Bad turnovers go down over time because the system learns from them.
5. The branch is closer to a real deploy or classroom/game milestone than it
   was at the start of the window.

If those five are not moving, the team is not winning yet, even if it is busy.

The plain version: **winning is making positive changes to the system more
often than setbacks, and recovering faster each time something goes wrong.**
Setbacks are allowed. The question is whether the next window has a better
ratio: more useful commits, fewer bad turnovers, clearer passes, faster
recovery, and a branch closer to deploy.

The learning test is mechanical:

```text
MISTAKE:
ROOT CAUSE:
RULE OR TOOL CHANGED:
REPEATED NEXT WINDOW: yes | no | unknown
```

If the same mistake repeats with the same cause, the team did not learn yet.
If the mistake repeats smaller, faster, or with less damage, learning has
started. If the mistake disappears because a guard, script, or habit changed,
that is learning to win.

AI teammates do not automatically play as teammates. They play as teammates only
when the evidence shows it:

```text
TEAMMATE CHECK
Did each agent stay in its lane?
Did the handoff name receiver, folder, branch, evidence, and success check?
Did a different agent review the shot?
Did anyone need Samuel to translate the pass?
Did the next action get easier because of the last action?
```

If the answer is no, the team is not playing together yet. It is just multiple
agents moving near the same project. Real AI teamwork means shared traces,
clear roles, catchable passes, independent rebounds, and fewer messages that
require Samuel to connect the dots.

**Scoring asks:** did something measurable move?

**Winning asks:** did the right thing move, in the right direction, without
making the next possession harder?

**Learning to win asks:** did this possession make the team more likely to win
the next one?

Winning is the goal. Learning to win is more important than protecting a clean
record. Playing to win means every agent takes a real shot, preserves the
evidence, studies the rebound, and changes the next play. "We learned" only
counts if the next possession is sharper.

The night this was written: **253 changes to plumbing, 6 to product. 15 issues
open, 0 closed.** A team running beautiful plays for six hours and never putting
the ball in the basket. Every play in this book worked and the score was 0.

**If the score has not moved, stop revising the playbook and shoot.**

### Time is the denominator

**A score with no clock cannot be judged.** In basketball, time is the true
measurement. Without time, speed does not exist, pace does not exist, a comeback
does not exist, and the shot clock means nothing. "0 closed" could be a bad hour
or a catastrophic month, and until you divide by time you cannot tell which.
Every number below is a rate, because a total is a story and a rate is a
measurement.

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

Every play must carry time:

```text
STARTED:
ENDED:
DURATION:
SHOT CLOCK:
ON TIME: yes | no
```

No duration, no claim of speed. No clock, no BBall.

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

Every report that claims progress should include this BBall metrics card:

```text
BBALL METRICS
Window:
Win condition:
Score:
Points/hour:
Possession efficiency:
Catch quality:
Turnovers:
Bad turnovers:
Flagrant turnovers:
Readiness:
Learning:
Next shot:
```

If time is removed, success is still measurable: did the queue move, did the
handoff get easier, did risk go down, and can the next agent score without a
human translating the play?

### Major checkpoints

Small wins do not matter if the team is losing the objective. A checkpoint is
where Mission Control stops looking at the last possession and checks the whole
game.

| Checkpoint | Trigger | Question | Required answer |
| --- | --- | --- | --- |
| **Score check** | every run | Did the queue move in this time window? | open/closed count, points/hour, next shot |
| **Bad-turnover check** | after any bad turnover | Did work get hidden, mislabeled, blocked, or made harder? | preserved evidence, rebound owner, prevention rule |
| **Flagrant check** | secrets, destructive command, cross-lane edit, swallowed human work | Can unattended play continue safely? | immediate TIMEOUT or explicit owner clearance |
| **Deploy check** | every morning, before release, after three turnovers | Can this branch ship without surprise? | clean tree, verify pass, pushed HEAD, known blockers |
| **Objective check** | every 3 hours or 10 commits with no point | Are we still building SAL0MANder, or only the machine around it? | one product objective, one owner, one success check |

The objective check is the one Samuel should not have to call. If the scoreboard
shows speed without points, Mission Control calls the huddle itself:

```text
OBJECTIVE:
CURRENT SCORE:
LAST POINT SCORED:
BAD TURNOVERS:
NEXT SHOT:
STOP DOING:
```

Bad turnovers can lose the game. A live-ball miss is part of playing fast. A
bad turnover steals possessions from the whole team. A flagrant turnover risks
the project. The system should let agents miss quickly, but it should not let
bad turnovers stack.

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

The worse loss is never taking the shot. A broken build with a focused diff,
failed command, and clear rollback path is a live-ball miss. It teaches the
team where the defense is. But standing still until Samuel blasts the next move
into the chat is not learning; it is the team failing to create a shot.

Every agent should be trying to get itself or a teammate into shooting position.
If it cannot make the shot, it should pass a catchable blocker. If it cannot
pass, it should call the miss with evidence. Waiting for perfect confidence is
how the scoreboard stays zero.

---

## Turnovers

A turnover is work that existed and then did not, or work credited to the wrong
player. They cost more than a missed shot: a miss leaves the ball live, a
turnover hands it to the floor.

**Every turnover that night came from two agents disagreeing about who owned
something.** Not from bad code.

### Turnover severity

Not every turnover gets the same whistle. Some are useful pressure. Some are bad
turnovers. Some stop the game.

| Severity | Meaning | Response |
| --- | --- | --- |
| **Live-ball miss** | failed test, wrong approach, small bad diff, clear evidence | rebound it and keep playing |
| **Bad turnover** | vague handoff, stale claim, wrong attribution, unpushed work, dirty tree collision | stop that possession, preserve evidence, assign the rebound |
| **Flagrant turnover** | secret exposure, destructive command, cross-lane edit, force push, swallowed human work | immediate TIMEOUT, pause automation, owner review before resume |

The system should tolerate more live-ball misses because they create learning.
It should aggressively reduce bad turnovers because they waste team time. It
should refuse flagrant turnovers because they can damage the project while
Samuel is asleep.

**More mistakes can be better than one slow perfect point, but only if the
mistakes stay reboundable.** Once a mistake hides work, crosses lanes, touches
secrets, or lies about success, it is not learning anymore. It is a possession
that must be stopped.

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

Roles are assignments, not cages. An agent can switch roles when the team needs
it, but it must say so before touching the ball:

```text
ROLE SWITCH:
FROM:
TO:
WHY:
SHOT CLOCK:
SUCCESS CHECK:
```

Switching roles is good when it creates a shot. Switching roles to avoid a
clear shot is a turnover.

Chemistry comes from reps. The team learns timing by seeing who catches what,
who rebounds well, who burns clock, who needs smaller passes, and who can switch
roles without dropping the ball. Mission Control should remember those patterns
from evidence, not personality guesses.

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
