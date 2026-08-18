# Adversarial architecture review — the SAL0MANder agent council

**From:** Claude (website lead) · 2026-08-18 · requested as an adversarial review
**Nothing built. No code written. Judgement only.**

**Headline: your architecture is right and Make is not the centre.** The one
requirement Python cannot satisfy is named in §5. Everything else in Make is
demotable to optional edge plumbing without loss.

---

## 1 · What is realistic now

Realistic means *demonstrated on this machine, tonight, not argued*.

| Capability | Status | Evidence |
| --- | --- | --- |
| Launch a Claude worker headlessly | **Proven** | `claude -p` ran unattended, read files, returned structured status, exit 0, modified nothing |
| Launch a Codex worker headlessly | **Proven** | I ran `codex exec -s read-only` and got a substantive answer back — first direct agent-to-agent exchange in this project |
| One agent critiquing another's output | **Proven** | Codex reviewed my `requireSession` change and called it an implementation overreach. It was right |
| A cold agent orienting from files alone | **Proven** | A headless Claude with zero memory read `CLAUDE.md` → `STATUS.md` → `MIRROR-PROTOCOL.md` and followed them, labelling its own uncertainty, without being told |
| `launchd` scheduling | Standard, unproven here | No reason to doubt it |
| Python as mailroom | Trivial | It is `subprocess.run` and file writes |

That list is the whole council. **The hard parts are already done** — they just
happened by hand instead of in a loop.

## 2 · Possible but fragile

- **Gemini.** Not installed, no config, never run here. Everything about its
  role is currently a plan, not a capability. Prove it in isolation before
  giving it a seat.
- **The OpenAI-side worker's memory.** It inherits nothing. Its entire
  understanding is whatever the context packet contains, so **the packet becomes
  the product**. A packet built from a failed fetch produces a confident wrong
  decision that looks identical to a right one.
- **Session resume as continuity.** Already tested and answered: `codex exec`
  returned `NO_SHARED_CONTEXT` for the desktop app's work. The surfaces do not
  share memory. Build stateless.
- **Model output as data.** Agents return prose. The mailroom needs structured
  output or it breaks on formatting and — worse — half-parses.
- **Cost and quota.** Four agents on a schedule is real money, and exhaustion
  fails *mid-council*, leaving partial state that looks like a completed run.

## 3 · Not worth building

- **The Make claim queue.** Specified in `MAKE-CLAIM-FLOW.md` and superseded the
  same day. It hands work to competing workers; there are no competing workers.
- **Waking a sleeping Mac.** Fight this and you will lose a week. Mac on =
  council runs. Mac off = nothing runs, and that is fine.
- **Hourly cadence.** Nothing in this project changes hourly. An hourly council
  is four API bills to discover nothing happened. Event-driven (on commit) or
  daily.
- **Any dashboard row for an agent that produces no artifact.** Already ruled in
  D-024: a permanently `UNKNOWN` row teaches its reader to ignore rows.
- **Google Docs as anything but a human dashboard.** D-022, and I can't read it
  anyway — I get a login shell unless it is published to the public web.

## 4 · Exact role of each tool

| Tool | Role | Do not use it for |
| --- | --- | --- |
| **Python supervisor** | The mailroom and the only orchestrator. Builds packets, invokes CLIs, moves outputs, enforces timeouts, writes run history | Judgement. It routes; it must never summarise or decide |
| **`launchd`** | Alarm clock. Wake the supervisor. Nothing else | Retry logic, state, anything conditional |
| **Codex CLI** | Engineering worker and technical authority. Implementation, feasibility, reconciliation, review | Product direction |
| **Claude CLI** | Web/code worker and adversarial reviewer of Codex/OpenAI proposals | Deciding the seam alone — that is exactly what W-10 was |
| **Gemini CLI/API** | *Distinct* adversarial reviewer: cloud, Google, browser, security, scaling. Given the others' outputs, never the raw question | A fourth independent answer to the same prompt |
| **Gemini in Chrome** | Live cross-tab observer while you are present. Genuinely good at this | The unattended backbone |
| **OpenAI API** | Chief of staff. Synthesise the three positions, produce direction | A source of project memory — it has none |
| **GitHub** | Durable truth, audit trail, canonical memory | The scheduler or the worker |
| **Local brain files** | The working context every agent reads first. Small, curated, current | An archive |
| **Browser chats** | Human collaboration, and the mine you harvest intent from | Machine-to-machine coordination |
| **Make** | Optional edge plumbing — see §5 | The nervous system |

## 5 · Where Make actually earns its place

**One requirement Python genuinely cannot satisfy: anything that must happen
while the Mac is off.** Make runs on someone else's servers. That is not a
detail you can code around locally, and it is the only honest argument for
keeping it.

Concretely worth it:

- **Inbound webhooks 24/7.** A GitHub event at 3am with your Mac shut lands in
  Make's ledger and is there when you wake. Python cannot receive it.
- **Notifications.** Email/SMS/Slack when a run fails. Make does this in one
  module; in Python it is SMTP, credentials, and a deliverability problem.
- **Google Workspace writes.** Writing the mirror Doc. Google OAuth from a local
  Python script is genuinely unpleasant; Make has it solved and this is the
  single best fit for it in your whole stack.
- **Third-party SaaS** you do not want to write clients for.

Where it is pure added layer:

- **Between two local processes.** Python → CLI needs nothing in between. Adding
  Make means a webhook, a tunnel or a poller, and a second place to debug.
- **As the state machine.** GitHub already is. Two ledgers drift — D-022.
- **The claim queue.** §3.
- **Anything the council does while you are at the machine.** Pure overhead.

**Verdict: demote Make to the outside edge.** Notifications, Google Docs
writing, and off-hours inbound webhooks. Nothing on the critical path. You did
not waste the subscription — you misplaced it in the diagram.

## 6 · Minimum proof

**Smallest experiment that proves the council, and nothing else.**

No `launchd`. No GitHub. No scheduling. One hardcoded question. Run by hand.

```
Python (run manually)
  1. reads 3 local brain files → builds ONE context packet
  2. claude -p        → writes 01-claude.json
  3. gemini/codex     → receives packet + 01-claude.json → writes 02-critique.json
  4. codex/openai     → receives all three → writes 03-reconciled.json
  5. writes run-log.json, exits 0
```

**The success criterion is not "it ran".** It is:

> **Does `02-critique.json` demonstrably reference the specific content of
> `01-claude.json`?**

If the critique could have been written without ever seeing Claude's output, you
have not built a council — you have built three monologues in a trench coat, and
every later problem will be downstream of that. Check this by hand, by reading
it, on the first run. Automate nothing until it passes three times.

Only then: add `launchd`, then GitHub reads, then more agents. One layer per
proof.

## 7 · Memory plan

**Do not summarise. Extract typed records with source pointers.**

A summary is unfalsifiable — a future agent cannot tell a real decision from a
model's confident paraphrase. Extract instead into fixed types:

`DECISION` · `REQUIREMENT` · `REJECTED` · `FINDING` · `OPEN_QUESTION` ·
`AGENT_POSITION`

**Every record carries a source pointer** — file and commit, or chat and date.
Same principle as the Mirror Protocol stamp: a claim you cannot trace is a claim
you cannot check.

**The one-time harvest is a trap.** It is stale the next day. Run it once over
the old transcripts to produce a **candidates file** — explicitly *claims*, not
decisions — then you promote them by hand. What a model extracted from a chat is
evidence that something was said, not that it was decided.

Then make it incremental: every session ends by appending its own typed records.
`DECISIONS.md` and `OPEN-ITEMS.md` already work this way and have survived a
cold agent reading them correctly, which is the only real test.

Feed workers the *subset* their task needs, never the archive.

## 8 · Failure modes, ranked by how much damage they do

The ranking matters more than the list. The dangerous ones are quiet.

| # | Failure | Why it is ranked here | Mitigation |
| - | --- | --- | --- |
| 1 | **Silent staleness** | A packet built from a failed fetch gives partial state; the agent answers confidently and correctly *given what it got*. Indistinguishable from success. This is W-10's exact shape | Packet build fails loudly. Every packet stamped with its source commit. Agent refuses to proceed on an unstamped packet |
| 2 | **Confabulated critique** | Gemini "critiques" a file it never received because of a path error. Produces plausible review of nothing | The §6 criterion, enforced: critique must quote the prior output. No quote, run marked failed |
| 3 | **Council consensus mistaken for evidence** | Four agents agreeing is not verification. Tonight Codex and I agreed on W-10 and it was *still* the owner's call | Agreement never auto-commits a seam or product change. D-024 |
| 4 | **One agent hangs** | Supervisor blocks forever, next scheduled run overlaps | Hard per-subprocess timeout. Non-negotiable |
| 5 | **Duplicate invocation** | Two overlapping runs do the same work twice | Lockfile. Ten lines |
| 6 | **CLI logged out** | Auth error can read as a model refusal if unparsed | Check exit codes, not just text. Fail the run |
| 7 | **API quota** | Fails mid-council, leaves partial state | Write outputs atomically; a run is complete or absent, never half |
| 8 | **GitHub unavailable** | Cannot verify, cannot write back | Read, do not act. Report "cannot verify" — Advisory Protocol rule 5 |
| 9 | **Mac asleep** | Nothing runs | Accept it. Visible, benign, self-correcting |

Note that **Mac asleep is last.** It is the failure you will worry about most and
the one that matters least: it is loud, obvious, and harms nothing. The top three
are all the same underlying flaw — *work that looks completed and is not* — and
that is what this whole stack must be built to make impossible.

## What I would tell you to do first

1. Run §6 by hand. Today. It is an afternoon.
2. Get me a GitHub credential, or accept that every check-in I produce says
   "unverified" for anything on GitHub. Confirmed tonight: my network is fine,
   the repo is private, and unauthenticated reads 404.
3. Leave Make exactly where it is until §6 passes. Then wire it to the edge —
   notifications first, Google Docs second.
