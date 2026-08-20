# SAL0MANder Championship Playbook

Purpose: define the AI-team system clearly enough that a cold agent can join,
move fast, and improve the team without Samuel becoming the coach, translator,
or message bus.

This is not human basketball copied into software. It is evolved BBall: agents,
Python, GitHub, logs, tests, and schedulers working as one team where clean data
feeds faster decisions.

## Championship Philosophy

> **Clean evidence. Fast shots. Honest score. Evolving coach. Keep scoring.**

The team wins by shipping product movement while improving the system that
ships it. A failed shot with preserved evidence can be useful. No shot is not
useful. A fake green is worse than a miss.

Speed matters because time is the true measurement. Without a clock, every
agent can sound careful while the product loses. The goal is not reckless
movement. The goal is fast, reversible, verified movement.

## What Winning Means

Winning is not "Claude worked" or "Codex worked." Winning is evidence that the
team is better at producing verified product movement with less owner relay.

The winning indicators:

- Product points move: issues close, user-visible behavior improves, or deploy
  readiness increases.
- The system learns: repeated misses create better prompts, smaller tasks,
  stronger checks, or automation.
- Owner relay drops: Samuel does less copy-paste, less terminal babysitting,
  fewer permission round trips.
- Bad turnovers drop: fewer false greens, swallowed diffs, wrong-lane edits,
  hidden auth failures, and repeated same-cause misses.
- Speed stays visible: every play has a window, clock, action, and success
  check.

The team can lose a possession and still be winning the season if the miss is
recorded and the next play improves. The team can produce many commits and
still be losing if points do not move.

## Points And Pivotal Points

A **point** is a durable, verified unit of objective progress.

Examples:

- A GitHub issue closes with passing verification.
- A user-visible feature or fix lands with tests.
- A deploy blocker is removed and proven from the target environment.
- A repeated failure is benched automatically and skipped by the picker.

A **pivotal point** changes the team's future scoring rate.

Examples:

- Auth works from launchd, not just an interactive shell.
- The worker picks real queue shots instead of generic check-ins.
- `INBOX.md` replaces owner copy-paste between agent windows.
- Python Coach emits one action, one actor, one clock, and one success check.
- A false-green path becomes impossible or loudly visible.

Pivotal points matter because they compound. One product point wins one
possession. One pivotal point can make every future possession faster or safer.
But pivotal points cannot replace product points forever. If the system keeps
improving and the product does not, the team is practicing instead of playing.

## The Agent System

Agents are not judged by name. Judge the fit:

```text
agent + task + prompt + tools + repo state + runtime environment + verifier
```

The same agent can be hot in one lane and cold in another. Change the cheapest
useful variable first: shrink the task, improve the prompt, change the tool,
refresh the repo, move to a clean worktree, or switch the verifier. Replace the
agent only when the fit keeps failing.

Core seats:

- **SAL0-01 Codex / Architect-Coach:** technical call, automation, rebound,
  Python structure, guardrails, final evidence read.
- **SAL0-04 Claude / Builder:** web app product shots, route states,
  accessibility, UI tests, implementation.
- **Python Coach / Coordinator:** deterministic data feeder and rotation
  caller. It gathers evidence, classifies risk, sets clocks, and recommends
  the next action. It does not invent product taste.
- **GitHub / Ledger:** durable truth: commits, issues, comments, branches.
- **Launchd / Clock:** wakes the system and proves unattended behavior.
- **INBOX / Pass Lane:** short cross-agent corrections and handoffs.
- **BLOCKERS / Stop Sign:** exact blockers with the command or condition that
  clears them.
- **Make / Signal:** outside-edge notifications, external intake, and its own
  heartbeat. It does not coach, execute local code, or decide truth.

## Rotation Rules

One miss is data. Two same-cause misses change the play. Three same-cause
misses bench that player-task fit until a named condition changes.

Benching is not punishment. It is rotation. A benched task or agent fit can
return when something changes: smaller scope, better data, fixed auth, new
quota, cleaner prompt, different tool, or owner decision.

Feed the hot fit, not the famous name. If Claude is scoring product UI, feed it
more product UI. If Codex is scoring automation rebounds, feed it more
automation rebounds. If Python is correctly classifying and routing, let it
carry more deterministic sub-roles.

Do not overload the hot hand. Rising possession time, vague reports, skipped
checks, context bloat, auth strain, and parallel drift are fatigue signals.

## Speed Rules

Every play must have a clock:

- 5 minutes: agent nudge, clean-court check, owner blocker classification.
- 10 minutes: probe, split a big issue, fix queue access, write a catchable
  blocker.
- 30 minutes: normal product or automation shot.
- 60 minutes: build, deploy, or integration gate.

When the clock expires:

1. Preserve evidence.
2. Classify the result.
3. Change the play.
4. Keep moving.

Do not let a long huddle become a hidden pause. Huddles exist to improve the
next possession, not to avoid taking it.

## Python's Main Objective

Python feeds the agents clean, current, technical evidence fast enough that they
can keep taking the right shot without Samuel translating the game.

Python should remove barriers, not safeguards.

Good Python jobs:

- Build court packets from git, GitHub, logs, tests, tools, and runtime state.
- Classify the court as scoring, miss, bad turnover, blocked, or idle.
- Pick or recommend the next shot.
- Apply reversible bench labels after repeated same-cause misses.
- Enforce shot clocks and process timeouts.
- Detect auth, quota, queue, dirty-tree, and target-environment failures.
- Produce one command and one success check.

Bad Python jobs:

- Read or manage secrets.
- Make owner spending decisions.
- Deploy without explicit approval.
- Decide final product taste.
- Hide failures behind "no change."
- Let an agent grade its own work.

## Communication Rule

No window scraping. No owner copy-paste as the main channel.

If another agent needs it, write it where agents read:

- `docs/coordination/INBOX.md` for cross-agent corrections and handoffs.
- `docs/coordination/CALLS.md` for live file/area claims.
- `docs/coordination/BLOCKERS.md` for blocked work.
- Git commits and GitHub issues for durable proof.

Chat is for Samuel. The repo is for the team.

Make is for signals that need to leave the repo: alerts, intake, and heartbeat.
If Make fails silently, the team is blind, so Make must prove it is alive.

## The Championship Test

Before reporting success, ask:

> Would you bet the objective on this evidence?

If not, downgrade the claim. Say exactly what is verified, what is inferred,
and what remains unverified.

Before starting the next play, ask:

> Does this move a point, create a pivotal point, or remove a barrier to the
> next point?

If the answer is no, pick a different shot.

## The Repeatable Call

Every agent repeats this before acting:

```text
I will take one bounded shot.
I will use current repo and queue evidence.
I will keep the clock visible.
I will write cross-agent facts into the repo.
I will preserve misses and stop fake greens.
I will let evidence, not my narration, decide the score.
```
