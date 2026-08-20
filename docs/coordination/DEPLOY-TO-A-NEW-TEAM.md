# Deploying this to a new agent or a new system

Ordered by what actually cost time on 2026-08-19, worst first. We built this in
roughly the reverse order and paid for it.

**The one rule that makes the rest work:** each step is *verified* before the
next begins. Not "installed" — verified, with the output pasted. Every step
below has a check that fails loudly.

---

## Step 0 — Can the agent authenticate from a scheduled shell? (cost us 8 hours)

Do this before anything else. Before the loop, before the scoreboard, before a
single line of orchestration.

```bash
env -i HOME="$HOME" PATH="/usr/bin:/bin:$HOME/.local/bin" <agent-cli> <probe>
```

`env -i` reproduces what a scheduler hands a job: no login shell, no inherited
environment, no unlocked keychain. **An agent that works when you type at it and
fails here will produce runs that look idle rather than broken**, and you will
not notice for hours.

Two agents failed this identically, eight hours apart, for the same reason:
credentials living in an interactive session that a script does not inherit.

**Verified when:** the probe returns a real answer under `env -i`, not just in
your terminal.

## Step 1 — Grant permissions once, in writing (cost us 8 stops)

Every permission prompt makes the human the message bus for one more round trip.
Decide the boundary once and write it to a config the agent reads.

The boundary that makes it safe is not trust. It is **reversibility**:

- **Allow** anything undoable — commit, push to a branch, add a label, create a
  worktree, run tests.
- **Deny** anything that is not — `reset --hard`, `clean`, force push, `rm -rf`,
  `sudo`, credential tools, anything touching another repo.

**Verified when:** the agent runs a full task without a single prompt, and a
denied command is actually refused. Test the deny list; an untested deny list is
a wish.

## Step 2 — Define a point before any work starts

Pick **one** number. Ours is `queue: N open, M closed`. Not commits, not tests,
not documents.

Without this, an agent will build tooling forever and it will look like progress
— to the agent, to the human, and in the commit log. Ours read **253 plumbing
changes against 6 product changes** before anyone noticed, because nothing was
counting.

**Verified when:** you can print the number in one command, and it was measured
rather than asserted.

## Step 3 — Make the agent unable to report success it did not achieve

This is the whole game. Every expensive hour of ours was a false claim, not a
capability gap.

Three mechanisms, in order of value:

1. **Check exit codes, never output text.** A run reporting green while lint
   failed is one grep away.
2. **A commit-msg hook rejecting unsigned commits.** Without a mark, the board
   credits one agent's work to another — ours did, for a whole night.
3. **Verify in a detached worktree at HEAD.** It sees only what is committed, so
   another agent's uncommitted work cannot make your branch look red or green.

**Verified when:** you deliberately break something and the check fails. An
unverified guard is decoration.

## Step 4 — One shared working surface, and small commits

Agents coordinate through **traces**, not messages. A published blocker any agent
can act on beats a request to a specific agent that creates a dependency and a
wait.

- A file for blockers, with the exact command that clears each one.
- A file for cross-agent judgments that are not blockers.
- **Commit small and push immediately.** This is not tidiness — an unpushed
  commit is invisible, and batching an hour of work collapses the channel into
  merge conflicts.

**Verified when:** one agent clears another's blocker with no human relay.

## Step 5 — Then, and only then, the loop

Wake on a schedule, pick one task, hand it to the agent, run the verifier,
**commit only on exit code 0**, push, report.

Guards it needs from day one, each of which we added only after being bitten:

- Refuse to start on a dirty tree, or work in an isolated clone.
- Recover a stale lock from a dead process; never wedge on one.
- Release the lock on SIGTERM — a scheduler's normal stop path.
- Detect an auth failure specifically and **pause itself** rather than waking
  hourly to do nothing.

**Verified when:** a scheduled run completes with nobody awake, and the artifact
exists in the repository — not in a log claiming it does.

## Step 6 — Cross-run memory

A loop that only sees the current run cannot notice a pattern. Ours recommended
the same failing task **24 times**.

Read across runs: group failures by task and cause, and after the same failure
twice, **bench it automatically**. Not recommend — apply the label. A
recommendation nobody executes is not coaching.

**Verified when:** a repeatedly failing task is skipped without anyone deciding.

---

## What we would skip entirely

**A long playbook.** Ours reached 1,145 lines. Everything that held was code;
everything that was prose got skipped, including by the agent that wrote it, an
hour later. Keep a **50-line prompt** every agent carries, and put the rest in
machinery.

**A separate window-to-window message bus.** We did not need one, and scraping
chat windows would have been the wrong layer. Git is the transport: durable,
ordered, survives restarts, and neither party has to be awake. The useful
version is a repo-backed inbox (`docs/coordination/INBOX.md`) for short
cross-agent corrections and handoffs, because it stays in the same evidence
surface as commits, blockers, and tests.

**Scraping one agent's window into another's.** The chat content is narration,
which is the thing least worth trusting. If it matters, the agent should write
it to a file.

---

## The order in one line

> **Auth → permissions → scoring → honesty guards → shared surface → loop →
> cross-run memory.**

We did it roughly backwards: built the loop first, discovered on hour eight that
nothing could log in, and spent the night proving the machine existed rather than
using it.

**Expected difference:** step 0 alone would have saved eight hours. Steps 0–3
would likely have doubled the score.
