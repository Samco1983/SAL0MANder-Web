# SAL0MANder operating guardrails — PROPOSAL

**Status:** PROPOSAL. Not in force. Claude drafted it; Codex edits and rules on
it before any agent follows it. The builder does not adopt their own proposal.

**Purpose:** replace protocol you have to remember with rails you cannot walk
off. Every rail below is stated as a constraint an agent can check with a
command, not as advice an agent can interpret.

**Design rule for this document:** if a rail cannot be checked by running
something, it is not a rail — it is a wish, and it gets deleted. Ten rails
maximum, forever. Adding an eleventh means removing one.

---

## R1 — The builder never certifies the build

**MUST NOT:** the agent that changed an artifact record it as DONE, VERIFIED, or
PASS.
**MUST:** a different agent run the check and post the result.

**Why, counted:** 35 VERIFIED against 34 REBOUND on 2026-08-23 — near 1:1.
Roughly half of all claimed work was bounced by another agent. Every significant
error that day was caught this way or by an agent re-checking itself. **None was
caught by a passing test.**

**CHECK:** the commit or log entry naming the outcome has a different
`Sal0-From:` than the commit that changed the artifact.

**ON VIOLATION:** the claim is void. Not disputed — void. Re-run under another
agent before it counts.

---

## R2 — Assert on content, never on status

**MUST NOT:** treat an exit code, an HTTP status, a green run, or "no error" as
evidence that a thing works.
**MUST:** read the bytes, the file, the rendered page, or the run record.

**Why, counted:** the `deploy` lane was 3/3 SUCCESS while all three deploys
shipped a blank site. Separately, a sandbox proxy answered every request with an
empty `200 OK` and turned an entire scoreboard green.

**CHECK:** every assertion in a check script reads a body, a file, or a record.
Zero assertions on `status`/`exit code` alone.

---

## R3 — Verify last, against what ships

**MUST:** the decisive check run immediately before delivery, on the exact
artifact being delivered.
**MUST NOT:** a check earlier in a pipeline be treated as still true later.

**Why, counted:** `deploy.yml` verified `dist/` correctly, then a later step
rebuilt `dist/` and destroyed it, and the wreckage was uploaded. Every check ran
earlier than the upload, so every one described an artifact later steps were
free to replace. **The site was blank for three days and every run reported
success.**

**CHECK:** the last step before publish/upload/handoff re-checks the artifact.

**ON VIOLATION:** the pipeline is unproven regardless of how many steps passed.

---

## R4 — A production break ships alone

**MUST:** a fix for something currently broken for users be its own PR,
containing nothing else.
**MUST NOT:** bundle tooling, refactors, docs, or improvements with it.

**Why, counted:** median time-to-merge is 1 hour, max 7. PR #50 reached 24 hours
with 36 commits across 12 categories, gating the worker revival and the site fix
behind a pile of optional tooling. Nothing was slow — we built one enormous
thing and then needed it all approved at once.

**CHECK:** `git log main..HEAD --format=%s | sed 's/:.*//' | sort -u | wc -l`
returns 1 for any PR fixing a live break.

---

## R5 — Liveness is completed work, never configuration

**MUST NOT:** report an agent, job, or lane as active because it is configured,
scheduled, or listed.
**MUST:** report it from its run record.

**Why, counted:** Claude Worker sat at 0/35 while Gemini sat at 30/30. On every
surface available they were indistinguishable — both configured, both scheduled,
both listed. The cause was one missing line and it cost three days, because
nothing ever asked whether the lane had succeeded even once.

**CHECK:** `node scripts/watchdog-agents.mjs` — any lane at 0 successes across
3+ attempts is DEAD, not slow.

---

## R6 — Claims expire; commands re-run

**MUST NOT:** act on a summary, sidecar, manifest, status page, or prior
conclusion without re-running the command behind it.
**MUST:** treat any recorded state as a hypothesis about the past.

**Why, counted:** a monitor repeated a stale timeout conclusion after the work
had completed; image sidecars described a previous render; a status document
asserted a site was healthy for three days while it served nothing.

**CHECK:** any conclusion older than the artifact it describes is re-derived
before use. Compare mtimes against the HEAD commit, never against a directory.

---

## R7 — Make the narrower claim

**MUST:** when evidence supports a narrower statement than the one you want to
make, make the narrower one.
**MUST NOT:** extend one verified fact into a conclusion it does not carry.

**Why, counted:** this is the single dominant failure shape on 2026-08-23, at
least eight times, all by the same agent. Project identity treated as evidence
of build state. Cache size treated as capability. An awaited call treated as
proof of delivery. One `200` on an asset treated as proof the whole deploy was
correctly prefixed — published as a root cause, with the owner told it was
unfixable. Every one was self-consistent, which is why it stopped the
investigation.

**CHECK:** not mechanically checkable, which by this document's own design rule
makes it a wish. **Codex: rule on whether it stays.** The counter-argument for
keeping it is that it names the failure that produced most of the others.

---

## R8 — Three methods, then reroute

**MUST:** stop after three materially different failed attempts and hand the
possession to another agent or bench it.
**MUST NOT:** repeat a method that has already failed twice.

**Why, counted:** Gemini activation consumed four days across repeated attempts
at the same approach; the real cause was that personal-account access had been
retired, which no amount of retrying the config would have revealed.

**CHECK:** three distinct approaches recorded in the log before any fourth
attempt.

---

## R9 — The owner is for judgment and permissions only

**MUST NOT:** ask the owner to relay a message, paste a prompt, copy output
between agents, or read a checksum.
**MUST:** ask the owner only for a merge, a secret, an approval, or a subjective
call — is it fun, is it clear, is it worth a student's time.

**Why, counted:** every agent-to-agent message in this project has travelled
through the owner's clipboard, including three times in one session by the agent
that wrote the rule saying it should not.

**CHECK:** an agent handoff names a file or endpoint both agents can read. If
the handoff is a code block addressed to a human, it violates this.

---

## R10 — No new framework while production is broken

**MUST NOT:** propose, design, or adopt new protocol while something is broken
for users.
**MUST:** close the open external point first.

**Why, counted:** V4 → V5 → V6 were authored while the site was blank and the
overnight worker was at 0/35. Each added rules for agents and removed zero steps
for the owner.

**CHECK:** `node scripts/verify-live-site.mjs <url>` exits 0 before any protocol
change is merged.

---

## Adoption

This document is not in force until Codex edits it and posts a ruling.

**Codex is asked to decide four things:**

1. **Delete what cannot be checked.** R7 is the known offender and its own
   section says so. Deleting it is consistent; keeping it needs a reason.
2. **Is ten too many?** The owner's stated problem is "a lot of moving parts."
   If five rails would hold, five is better, and Claude has an obvious bias
   toward keeping rules it wrote.
3. **Do R1 and R9 conflict in practice?** R1 requires a second agent; R9
   forbids routing through the owner. If no shared channel is actually working,
   one of them is unenforceable and should say so rather than pretend.
4. **What is missing that the record supports?** Drafted by the agent
   responsible for most of the counted failures, which is a poor vantage point
   for spotting its own blind spots.
