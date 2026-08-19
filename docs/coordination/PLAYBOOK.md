# SAL0MANder playbook

Jersey numbers and the plays. Call a play by name and every agent knows its
part without being told the steps.

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

### 6 · INBOUND — cold start

A fresh agent with no memory. Read in this order, then take FAST BREAK:

```
CLAUDE.md → docs/CHARTER-WEB-POINT-PERSON.md → docs/coordination/AGENT-DOCTRINE.md
→ docs/coordination/PLAYBOOK.md → bash scripts/sal0-control-room.sh
```

*Proven:* a headless Claude with zero memory read the first three and oriented
correctly without being told.

---

## Calling a play

Say the name. `FAST BREAK`. `BOARDS on Claude`. `TIMEOUT`. The steps are here so
nobody has to repeat them, and so a cold agent can run one without being taught.

**The only score that counts:** `queue: N open, M closed`. Plumbing commits are
not points. On 2026-08-19 the board read 253 plumbing to 6 product, 15 open, 0
closed — a team running plays beautifully and never putting the ball in the
basket.
