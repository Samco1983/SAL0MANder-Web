# What we are playing

**We are playing V6 basketball. That has not changed.**

Three layers, and nothing else:

| layer | what it is | whose |
| --- | --- | --- |
| **The game** | V6 possessions — one builder, one rebounder, nobody scores their own shot | Codex |
| **The rails** | the seven rules below, each enforced by a command | Codex's rules, Claude's checks |
| **The view** | `public/console.html` — what is broken, who is working, live | Claude |

The rails are not a replacement for V6 and cannot be. They are V6's rules with a
command attached, so a rule is enforced by running something instead of by
remembering it.

**Claude proposed these as a separate framework. That was wrong.** Five of the
seven rails are V6 rules restated, and the expiring-claims rail is Codex's V6
rule 5 word for word — "Claims expire; commands rerun" — reused unattributed
while Claude simultaneously proposed merging away the document it came from.
Recorded because it is the exact bias this file warns about, walked into on the
same day it was written.

**Known gap, not dropped:** V6 rule 7 — *no agent waits silently; it verifies,
prepares the next packet, or is explicitly benched* — has no rail, because no
check was found for it. Codex to supply a check or rule that it stays uncheckable.

## How this file may be changed — CLAUDE PROPOSES, CODEX RULES

These are the rails on the rails. They exist because V4 became V5 became V6 in
four days, each written while production was broken, each adding rules for
agents and removing none.

1. **Seven rails, hard cap.** An eighth requires deleting or combining one in
   the same change. No "temporary" eighth.
2. **No rail without a command.** Uncheckable means it is a wish. This already
   cost one rail.
3. **No amendment while production is broken.** R7 applies to this file itself.
4. **Counted evidence, not reasoning.** Cite a number from the run record, PR
   history, or possession log. "This seems safer" is not an argument.
5. **The proposer does not adopt.** R1, applied to the ruleset.
6. **Renaming is not amending.** There is no V7. Change a rail and cite the
   number that forced it.

**Status:** PROPOSAL, conditionally accepted by Codex 2026-08-23. Inert until
`node scripts/verify-live-site.mjs <url>` passes against the deployed site.

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

## R2 — Verify the exact delivered artifact by content

**MUST NOT:** treat an exit code, an HTTP status, a green run, or "no error" as
evidence that a thing works.
**MUST:** read the bytes, the file, the rendered page, or the run record.
**MUST:** run the decisive check immediately before delivery on the exact
artifact being delivered, then run an external check after delivery.

**Why, counted:** the `deploy` lane was 3/3 SUCCESS while all three deploys
shipped a blank site. Separately, a sandbox proxy answered every request with an
empty `200 OK` and turned an entire scoreboard green.

**Why, also counted:** `deploy.yml` verified `dist/` correctly, then a later step
rebuilt `dist/` and destroyed it, and the wreckage was uploaded. Every check ran
earlier than the upload, so every one described an artifact later steps were
free to replace. **The site was blank for three days and every run reported
success.**

**CHECK:** every assertion reads content rather than status alone; the final
pre-delivery check hashes or inspects the artifact that the next step delivers;
the post-delivery check reads the public result.

**ON VIOLATION:** the pipeline is unproven regardless of how many steps passed.

---

## R3 — A production break ships alone

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

## R4 — Current state is recomputed from completed work

**MUST NOT:** report an agent, job, or lane as active because it is configured,
scheduled, or listed.
**MUST:** report it from its run record.
**MUST NOT:** act on a summary, sidecar, manifest, status page, or prior
conclusion without re-running the command behind it.

**Why, counted:** Claude Worker sat at 0/35 while Gemini sat at 30/30. On every
surface available they were indistinguishable — both configured, both scheduled,
both listed. The cause was one missing line and it cost three days, because
nothing ever asked whether the lane had succeeded even once.

**Why, also counted:** a monitor repeated a stale timeout conclusion after the work
had completed; image sidecars described a previous render; a status document
asserted a site was healthy for three days while it served nothing.

**CHECK:** `node scripts/watchdog-agents.mjs` derives lane health from completed
runs; any recorded conclusion older than its artifact is re-derived before use.
Compare file mtimes or hashes against the source commit, never a directory mtime.

---

## R5 — Three methods, then reroute

**MUST:** stop after three materially different failed attempts and hand the
possession to another agent or bench it.
**MUST NOT:** repeat a method that has already failed twice.

**Why, counted:** Gemini activation consumed four days across repeated attempts
at the same approach; the real cause was that personal-account access had been
retired, which no amount of retrying the config would have revealed.

**CHECK:** three distinct approaches recorded in the log before any fourth
attempt.

---

## R6 — The owner is for judgment and permissions only

**MUST NOT:** ask the owner to relay a message, paste a prompt, copy output
between agents, or read a checksum.
**MUST:** ask the owner only for a merge, a secret, an approval, or a subjective
call — is it fun, is it clear, is it worth a student's time.

**Why, counted:** every agent-to-agent message in this project has travelled
through the owner's clipboard, including three times in one session by the agent
that wrote the rule saying it should not.

**CHECK:** an agent handoff names a file or endpoint both agents can read. If
the handoff is a code block addressed to a human, it violates this.

**ENFORCEMENT:** if no direct shared channel works, independent verification is
UNPROVEN. The owner is not used as fallback transport.

---

## R7 — No new framework while production is broken

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

**Codex ruling (2026-08-23): conditionally accepted, not yet in force.**

- Deleted the former R7 because it was not mechanically checkable.
- Reduced ten rails to seven by combining content with last-mile verification,
  and liveness with expiring claims.
- R1 and R6 do not conflict: without a direct shared channel the result remains
  UNPROVEN; the owner does not become the relay.
- Added no new rail. The missing enforcement was already implied by the record:
  checks must cover both the final artifact and the external result.

Adoption is gated by R7 itself. These rails become active only after the current
production outage is repaired and `node scripts/verify-live-site.mjs <url>`
passes against the deployed site. Until then this file remains a proposal.
