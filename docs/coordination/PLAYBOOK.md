# SAL0MANder BBall

The operating system for Mission Control. Jersey numbers and plays are not
decoration: they are how agents coordinate quickly without turning Samuel into
the message bus.

Call a play by name and every agent knows its part without being told the
steps. The goal is simple: protect the ball, move the queue, and be deployable
when Samuel wakes up.

**Core sentence:** agents do not grade their own homework. Workers do work;
the supervisor reads git, tests, logs and issue state; the referee blocks bad
attribution; the rebounder checks the miss.

---

## The roster

| # | Name | Position | Surface | Signs with | Takes the shot on |
| --- | --- | --- | --- | --- | --- |
| **01** | Architect | Power forward | Codex Desktop | `Sal0-From: SAL0-01` | technical authority, final call in plumbing |
| **02** | Runner | Center | Codex CLI | `Sal0-From: SAL0-02` | supervisor, launchd, Make, GitHub plumbing |
| **03** | Director | Coach | OpenAI API | `Sal0-From: SAL0-03` | never shoots — reads the floor, calls one play |
| **04** | Builder | Point guard | Claude CLI | `Co-Authored-By: Claude Opus 5` | the web app: `src/`, routes, components, a11y |
| **05** | Reviewer | Sixth man | Claude Chat | manual | critique when a human is present |
| **06** | Scout | — | Gemini Chat | manual | Google/browser review, human present |
| **07** | Challenger | **Rebounder** | Gemini CLI | `Sal0-From: SAL0-07` | catches what 01/02 and 04 miss. **Seat empty** |
| **08** | Inspector | — | Unity MCP | — | Unity evidence only |
| **09** | Signal | — | Make Cloud | — | notifications and webhooks, nothing else |
| **10** | Ledger | — | GitHub | — | durable truth. Never plays, always records |

**No jersey, no minutes.** The referee (`scripts/hooks/commit-msg`) rejects an
unsigned commit. Enable it in any clone:

```bash
git config core.hooksPath scripts/hooks
```

---

## The court

One branch with two workers was enough to prove the strategy, but it also
proved the failure class: a dirty shared court lets signals swallow work,
lets one stuck run jam the lane, and lets a worker report its own outcome.

The next structure is:

| Court | Purpose | Rule |
| --- | --- | --- |
| Main court | `council/2026-08-18` coordination truth | no manual product edits while a worker is active |
| Worker court | one git worktree per active worker | worker changes only its assigned files |
| Review court | rebound/review branch | reviewer reads diffs and tests, does not claim the work |
| Deploy court | release candidate | only verified, attributed commits enter |

Worktrees are not a feature wish. They are the fix for tonight's class of
mistakes. A worker in its own worktree cannot dirty the main tree, cannot have
its work swallowed by a signal commit, and cannot leave the shared branch
jammed when it stalls.

**Node modules warning:** a fresh worktree does not get `node_modules`. The
worktree play must either symlink `node_modules` from the main repo or run an
install before `npm run verify`. Do not discover this at 3am.

---

## The scoreboard

The only product score that counts is:

```text
queue: N open, M closed
deploy: ready | blocked
verify: pass | fail
```

Plumbing can be valuable, but it is not a point unless it moves the queue,
reduces human relay, or protects deployability.

Every meaningful report must include:

```text
ONE THING THAT CHANGED:
ONE THING STILL UNVERIFIED:
DEPLOY READINESS:
```

`DEPLOY READINESS` means the repo can be built and pushed safely enough for
the next release candidate. If that is unknown, say unknown.

---

## The shot clock

SAL0MANder BBall is not slow. Careful matters, but speed matters more than
ceremony. A team that keeps possession forever and never scores is losing, even
if every pass looks smart.

Default clocks:

| Situation | Clock | Required move |
| --- | --- | --- |
| Worker starts a queue item | 30 minutes | commit verified work, or publish a blocker |
| Reviewer takes BOARDS | 15 minutes | name one defect, or explicitly clear the diff |
| Supervisor/check-in run | 5 minutes | report evidence or say no change |
| Stuck process with no log/output growth | 5 minutes | pause new wakeups, preserve diff, classify state |
| Product deploy check | 10 minutes | ready/blocked with one release risk |

When the clock expires, the agent must do one of three things:

1. **Shoot:** ship a verified commit.
2. **Pass:** publish a blocker or handoff with exact evidence.
3. **Timeout:** pause automation before it can stack another run.

No fourth option. Silence is a turnover. A long explanation without a score,
blocker, or pause is also a turnover.

Fast does not mean reckless. It means every possession moves toward a visible
outcome: diff, test, commit, blocker, review verdict, or deploy decision.

---

## Passing and turnovers

Professional speed is not frantic. It is timing. The pass arrives when the
teammate is ready to catch it, in the place where the next move is obvious.

A pass must be catchable:

| Bad pass | Why it hurts | Catchable version |
| --- | --- | --- |
| "Fix this" | no lane, no success check | "SAL0-04: fix Issue #2; success is `npm run verify` and one pushed commit" |
| Unpushed commit | nobody else can see it | push immediately, then cite the hash |
| Dirty tree signal | signal carries code by accident | refuse the signal until the tree is clean |
| Long chat summary | agent has to translate it into work | issue, blocker, commit, or exact command |
| Timeout with no reason | everyone stops but nobody knows why | pause file includes owner, reason, and resume condition |

Turnovers are not shame. They are data. Count them by cause:

- **bad pass:** receiver could not act because the handoff was vague or missing evidence;
- **dropped pass:** receiver was assigned but did not acknowledge or produce output before the clock;
- **travel:** agent changed files outside its lane;
- **double dribble:** agent reported the same work twice or claimed a stale HEAD;
- **shot clock violation:** no score, blocker, or timeout before the clock expired;
- **own goal:** automation made the next run harder, dirtier, or less truthful.

After two turnovers in the same cause, stop inventing plays and fix the system
that produced them. After three turnovers in one session, call TIMEOUT and run
DEPLOY CHECK before any new work starts.

---

## The plays

### 1 · FAST BREAK — the default

Take the next thing off the queue and score. This is what runs when nobody
calls anything else.

```bash
bash scripts/sal0-next-task.sh && bash scripts/sal0-work-loop.sh docs/coordination/ops/CURRENT-TASK.md
```

**04** takes it. Blocker first if one is open, otherwise the oldest unclaimed
`[WEB]` issue. Verify gates the commit; a failure leaves the tree dirty and
reports `BLOCKED - NEED OWNER`. Ends with a comment on the issue and a
notification.

*Call it when:* nothing is on fire. Which should be most of the time.

### 2 · PICK AND ROLL — the one that works

You are blocked. **Do not ask.** Publish the blocker and keep moving; whoever
can clear it, clears it.

```bash
# Add an entry to docs/coordination/BLOCKERS.md, then:
bash scripts/sal0-signal.sh STUCK <area> "one line on what stopped you"
# then go do the next thing. Do not wait.
```

**Proven:** B-3 published by 04, cleared by 01 in 0.1h, `HUMAN: no`.

*Call it when:* anything stops you. The screen only works if you keep running.

### 3 · BOARDS — the play we keep forgetting

**Whoever did not ship it, checks it.** Read the diffs, not the messages.

```bash
bash scripts/sal0-signal.sh BOARDS "<agent> last 10" "rebounding"
git log -10 --format='%h %s' <their commits> && git show <hash>
```

*Call it when:* the other agent has shipped 5+ commits since anyone looked.

*Why it matters:* on 2026-08-19 five defects shipped and **all five were caught
by the agent that made them.** A self-caught miss is not a rebound — the ones
nobody catches are exactly the ones the shooter cannot see.

**Gemini's job:** SAL0-07 is the rebounder. Gemini does not need to build the
feature. It needs to reject one specific claim from the builder, quote the
claim, and give evidence. Generic praise is a turnover.

### 4 · TRAIL — going fast on purpose

One agent moves fast and sloppy; the other follows and cleans. Beats two agents
both being careful.

```bash
bash scripts/sal0-signal.sh TRAIL <area> "moving fast, will be sloppy"
```

*Call it when:* the work is exploratory and speed beats precision. Never on the
supervisor, never on anything scheduled.

### 5 · TIMEOUT — stop everything

```bash
echo "why" > ~/.sal0mander/PAUSE
```

Outside the repo, so no git operation can remove it. Every loop checks it first.
Read the board before resuming:

```bash
bash scripts/sal0-control-room.sh
```

*Call it when:* something is wrong and you do not yet know what.

Timeout is not chaos time. A timeout has four required parts:

```text
TIMEOUT CALLED BY:
WHY:
WHAT IS PRESERVED:
RESUME CONDITION:
```

During timeout:

- no new worker starts;
- preserve any dirty diff before deciding what to do with it;
- read logs and git, not agent narration;
- classify the state: `WORKING`, `DONE - NEED NEW TASK`, `BLOCKED - NEED OWNER`,
  `WRONG LANE - REASSIGN`, or `UNKNOWN/UNREACHABLE`;
- resume only with a clean tree or a deliberately preserved dirty tree and a
  named owner.

The point of timeout is to stop stacking mistakes, not to stop scoring.

### 6 · BASELINE RUN — prove the floor before changing it

Before building a new layer, let the current layer take one clean swing. One
unattended or foreground baseline run tells the team whether the existing
guards work before worktrees add a second variable.

```bash
npm run mission:desktop:status
npm run mission:desktop:run-once
tail -120 "$(ls -t docs/coordination/runs/logs/work-loop-*.log | head -1)"
```

Success is not "the agent said done." Success is: clean start, bounded work,
`npm run verify` exit 0, signed commit, pushed commit, and a log line whose
commit hash matches the commit that actually moved.

*Call it when:* a guard was just changed and the next layer depends on it.

### 7 · INBOUND — cold start

A fresh agent with no memory. Read in this order, then take FAST BREAK:

```
CLAUDE.md → docs/CHARTER-WEB-POINT-PERSON.md → docs/coordination/AGENT-DOCTRINE.md
→ docs/coordination/PLAYBOOK.md → bash scripts/sal0-control-room.sh
```

*Proven:* a headless Claude with zero memory read the first three and oriented
correctly without being told.

### 8 · DEPLOY CHECK — morning readiness

This is the first move when Samuel wakes up or asks whether we can ship.

```bash
git status --short --branch
npm run verify
npm run mission:control-room
npm run mission:blockers
```

Report exactly:

```text
DEPLOY READINESS: ready | blocked
HEAD:
VERIFY:
OPEN BLOCKERS:
QUEUE:
NEXT RELEASE RISK:
```

Do not deploy from a dirty tree. Do not deploy from a branch with unreviewed
signal commits that carry real code. Do not deploy if the Unity/Web contract
question is load-bearing and unanswered.

---

## Calling a play

Say the name. `FAST BREAK`. `BOARDS on Claude`. `TIMEOUT`. The steps are here so
nobody has to repeat them, and so a cold agent can run one without being taught.

**The only score that counts:** `queue: N open, M closed`. Plumbing commits are
not points. On 2026-08-19 the board read 253 plumbing to 6 product, 15 open, 0
closed — a team running plays beautifully and never putting the ball in the
basket.

## Teaching the playbook

When another agent joins, do not explain the whole night. Send this:

```text
Read docs/coordination/PLAYBOOK.md and follow SAL0MANder BBall.

Your first job is not to agree. Your first job is to take the correct role:
- SAL0-04 Builder: take one bounded web issue and produce a verified diff.
- SAL0-07 Rebounder: quote one specific claim from the builder and test it.
- SAL0-01/02 Architect/Runner: clear automation blockers and enforce evidence.

No self-grading. Report only evidence: diff, test exit code, commit hash,
blocker, issue state, or log path.

End with:
ONE THING THAT CHANGED:
ONE THING STILL UNVERIFIED:
DEPLOY READINESS:
```

That is enough. If the agent needs more, it can read the docs.
