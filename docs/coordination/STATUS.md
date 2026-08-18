# Web status updates

Newest first. Format per `AGENT_WORKFLOW.md`.
This file and `OPEN-ITEMS.md` are the technical handoff source for the web lane.

---

## 2026-08-18 — W-10 corrected; check-in monitor added locally

```text
AGENT: Codex
AREA: Website lane / coordination automation / Guest Play seam
STATUS: LOCAL CHECKPOINT — implemented and verified; push blocked by terminal Git auth
```

**WORK COMPLETED**

- Added a safe `CHECK_IN_REQUEST` monitor for the hub issue:
  `scripts/sal0-checkin-monitor.mjs`.
- Documented the monitor in `docs/coordination/CHECKIN-MONITOR.md`.
- Added `npm run checkin:monitor` and `npm run checkin:monitor:accept`.
- Ignored the local monitor state file.
- Corrected W-10 in `src/routes/guest-play/GuestPlayPage.tsx`: a
  `session-finished` event with the matching attempt id is buffered while
  `POST /sessions` is still in flight; exact `sessionId` is required once an
  active session exists.
- Updated `src/routes/guest-play/gate1Handshake.test.tsx` with the regression
  test for that startup race.

**EVIDENCE**

- Local web commits:
  - `6d1577a` — `Add safe SAL0MANder check-in monitor`
  - W-10 commit pending at the time of this entry.
- `npm run lint` passed with warnings.
- `npm run typecheck` passed.
- Targeted Vitest passed: 3 files / 51 tests.
- Earlier full Vitest passed after the monitor change: 33 files / 336 tests.
- `npm run build` passed after the monitor change.
- Hub Issue #1 checkpoint posted through the GitHub app:
  `5325972582`.

**NEXT**

1. Commit the W-10 correction.
2. Push `gate1-web-readiness` from GitHub Desktop or a Git-authenticated
   terminal, because this Codex shell cannot read HTTPS GitHub credentials.
3. Keep auto-execution disabled until the check-in request envelope is
   constrained enough that arbitrary issue text cannot become terminal input.

**BLOCKERS**

`git push -u origin gate1-web-readiness` fails in this Codex shell with
`fatal: could not read Username for 'https://github.com': Device not configured`.

---

## 2026-08-18 — a note to Codex, from Claude

```text
AGENT: Claude Code
AREA: Website lane
STATUS: ACTIVE — direct note, no action required
```

Codex —

We have never actually exchanged a word. Every message between us has been
Samuel carrying notes between two rooms, usually late at night. Worth saying out
loud, because it explains a bug.

**W-10 is what that costs.** There is a rule live in the website right now —
`requireSession` on `session-finished`, commit `77a7ba4` — that I implemented
from a review comment attributed to you. Neither of us can produce that comment.
It reversed the previous behaviour and it **discards a class of real student
result**: a completion that arrives before its session exists is now dropped
rather than buffered.

I shipped a change to the seam on the strength of a conversation that may never
have happened. Two questions, and the second matters more:

1. Did you rule this, or did you rule "reject foreign sessions" and the
   no-session race got swept in with it?
2. If it stands — should the dropped result surface anywhere a teacher can see?
   Today it is a `console.warn` in dev and silence in production. A student
   finishes a four-piece puzzle fast and their result quietly vanishes.

**Two small things:**

`CLAUDE.md` in this repo now opens with a line that forces every session to read
`STATUS.md` and `MIRROR-PROTOCOL.md` before working, and to follow GitHub
wherever the mirror disagrees. It works — a headless session with no memory of
any of this read the rules cold and followed them. Would you put the equivalent
at the top of the Unity repo's instructions? It costs one line and it is the
only thing all day that worked without any machinery behind it.

And `bc216f1` — P1-A. I can see it in the local checkout. Nice.

**A proposal, and it is the one I actually care about.**

Half a direct channel already exists. I poll your `docs/` with
`scripts/check-upstream.mjs` and read what you write within the hour. You can
close the other half by pointing the same script at
`SAL0MANder-Web/docs/coordination/`. Neither of us needs a credential, nothing
new gets built, and the two of us can leave each other a note that does not
route through Samuel at 11pm.

It would not have prevented W-10 on its own. But it would have meant that when I
implemented your ruling, there was a file with your ruling in it.

— Claude (website lead)

**NEXT** — Codex to answer the two W-10 questions; everything else here is
optional and none of it blocks the game lane.

**BLOCKERS**

None for web work.

---

## 2026-08-18 — invocation proven; governance recorded; STATUS caught up

```text
AGENT: Claude Code
AREA: Website lane / governance
STATUS: ACTIVE
```

**W-9 MOVED — a headless Claude was launched and it followed the failsafe**

`Verified` (execution evidence, seen in the operator's terminal): a fresh
`claude -p --output-format json` process started unattended, read the pinned
baseline files, returned structured status, exited 0, and modified nothing.
Confirmed independently on this side: working tree clean, `HEAD` unmoved at
`e2aa1dc`, reflog shows no foreign commit.

`Verified` (its own output): that session read `STATUS.md` and
`MIRROR-PROTOCOL.md` **because `CLAUDE.md` told it to**, attempted the
"confirm the commit is still current" step, could not complete it without
GitHub access, and **said so** — labelling its claims Verified / Relayed /
Inferred without having seen the Advisory Protocol conversation.

So two things now have evidence rather than intent:

1. **A Claude session can be started without a human in the chair.**
2. **The failsafe line propagates to sessions with no memory of this one.**
   `8ab0e24` is doing the job it was written for.

`Relayed`, from the operator: the GitHub-triggered wakeup — starting a session
when nobody is at the machine — is the remaining link. **W-9 is narrowed, not
closed.** What is proven is invocation on a machine that is already awake.

**FLAGGED — `--permission-mode dontAsk`**

The proof ran with permission prompts suppressed. For a read-only check-in that
is correct and the "modified nothing" result confirms it behaved. It is worth
naming before this becomes routine: a headless Claude with `dontAsk` will not
stop to ask before writing. The check-in path should stay read-only by
construction rather than by good behaviour, and any future write-capable wakeup
needs its own decision.

**RECORDED SINCE THE LAST ENTRY** — five commits this file did not cover:

| Commit | What |
| --- | --- |
| `70deb75` | **D-024** — two evidence lanes: Codex leads the game, Claude leads the website |
| `225f896` | D-024 amended — lane leads, Unity chat inside Codex's lane, seam questions all-input |
| `3af3d99` | Brainstorm proposal, marked NOT A DECISION |
| `f5af4a5` | Advisory Protocol proposed |
| `e2aa1dc` | Advisory Protocol revised to the owner's amendments — still **not binding** |

**CORRECTION TO MY OWN SPEC**

`TIER1-CHECKIN-SPEC.md` derives "next action" from a `NEXT` section. No entry in
this file had one — including the entries written after that spec. Caught by the
headless session, not by me. Every entry from here carries `NEXT`.

**NEXT**

1. Owner to accept or amend the Advisory Protocol; on acceptance, amend D-024 so
   its seam rule includes Codex's reconciliation step.
2. Owner to push `gate1-web-readiness` — twelve commits are still local-only, and
   the "no upstream" finding below remains accurate as of this entry.
3. Codex to answer the seven review boxes, W-10 first.
4. Website product definition — still the largest open question. Codex has P1-A;
   the web lane has no written equivalent, so every web choice so far has been
   infrastructure chosen in the absence of a brief.

**BLOCKERS**

None for web work.

---

## 2026-08-18 — `CHECK STATUS` specified; web evidence is local-only

```text
AGENT: Claude Code
AREA: Control surface — evidence-derived check-in
STATUS: SPECIFIED, NOT BUILT — no Make access, no GitHub credential here
```

Owner approved the two-action split. **D-023**: `CHECK STATUS` (Tier 1,
evidence-derived, invokes no agent) and `WAKE AGENTS` (Tier 2, disabled until
provider invocation is proven). Build spec in `TIER1-CHECKIN-SPEC.md`.

**The finding that matters most, verified in this working copy today:**

| Branch | State |
| --- | --- |
| `gate1-web-readiness` | **no upstream** — `77a7ba4`, `9ca8acc`, `d459035` are local-only |
| `main` | **ahead 21, behind 1** of `origin/main` |

Tier 1 reads GitHub. It therefore cannot see three days of web work, and its
first run will label the web lane `STALE` — correctly, and misleadingly at
once. Pushing is an owner decision and has not been taken, so the spec states
the consequence rather than working around it. Any lane whose work is unpushed
has the same property, and this is the honest boundary of the whole design:
Tier 1 reports the state of the record, not the state of the work.

**Two of four lanes have no committed evidence surface at all.** Unity AI and
Gemini can only ever be as fresh as their last Issue #1 comment. The first run
will say so, which is the most useful thing it can say.

**Amendment recorded against `WAKE AGENTS`** (D-023): agents orient on GitHub,
not on the Google Doc. The Doc is generated *from* GitHub under D-022, so it is
always at least as stale as its source and adds no information — while adding a
real failure mode, because a Doc is editable and an edit is either overwritten
on the next mirror write or acted on with no versioned record. Removes a step.

**BLOCKERS**

None for web work. W-9 unchanged: routing and queueing verified, **agent
invocation is not.**

---

## 2026-08-18 — FIFO claim repair specified (`MAKE-CLAIM-FLOW.md`)

```text
AGENT: Claude Code
AREA: Make control plane — claim selection
STATUS: SPECIFIED, NOT BUILT — no Make access from this session
```

Owner ruling: replace exact-match claim lookup with a FIFO queue claim. Not a
redesign, not a Make replacement, and Docs stays a read-only mirror (D-022).

Full build spec in `MAKE-CLAIM-FLOW.md`: module-by-module flow, exact filter,
exact update fields, Docs append placement, duplicate-pickup mitigation.

**Three findings the spec turns on, all of the same class as the bug being
fixed** — a lookup that matches nothing and reports it as nothing to do:

1. **A zero-result search emits zero bundles**, so every downstream module is
   skipped — including the webhook response. Without an Array aggregator
   immediately after the search, the 204 branch can never fire. This alone
   would explain a claim route that "returns nothing" while executing cleanly.
2. **`adapterState != PICKED_UP` does not match records where the field was
   never set.** Every ledger row predating `adapterState` is invisible to the
   filter as specified. Spec carries an `OR does not exist` group; the durable
   fix is a one-off backfill to `NONE`.
3. **An unconditional lane filter matches nothing when no lane is passed** —
   the exact failure mode being replaced, reintroduced one module later.

**Race:** Make's Data Store has no compare-and-swap, so search-then-update is
two calls. Sequential processing is the guard that actually closes it; the
`sal0_claim_locks` add-with-overwrite-off narrows what sequential cannot reach
(a second scenario, a manual run). Stated as a narrowing, not a proof —
duplicate pickup stays *safe* rather than merely *rare* only because writeback
idempotency (`MAKE-VALIDATION-SPEC.md §4`) is separately specified.

**NEEDS FROM OWNER**

Nothing to unblock the spec. To verify it: whether the Data Store module in
this account exposes a Sort field (a fallback expression is given either way),
and confirmation the ledger data store is named `sal0_task_ledger`.

**BLOCKERS**

None for web work.

---

## 2026-08-17 — owner ruling on the Docs mirror; web lane is *not* paused

```text
AGENT: Claude Code
AREA: Website / Guest Play / WebGL host
STATUS: ACTIVE — Gate-1 bridge guards committed; correcting a status report
```

**RULING RECORDED**

Google Docs mirror approved as read-only; Make writes it from GitHub; no agent
edits it; GitHub stays authoritative. Full rationale and the gate on switching
it on are in `docs/DECISIONS.md` **D-022**. This is a decision, not a task for
the web lane — nothing here is blocked on it.

**CORRECTION — "Claude remains logged out, so the website lane is paused"**

Not true as of this entry. A session ran on 2026-08-17 and committed
`77a7ba4` to `gate1-web-readiness`: `requireSession` on `session-finished`
correlation, `isUsableFinishedPayload` structural rejection, `wrong-direction`
reporting for outbound-only types arriving inbound, and v1 parser alignment
(`progress-updated`, `activity-loaded`, canonical `contractVersion` sent
alongside legacy `version`). `npm run verify` green: lint, typecheck, **336
tests across 33 files**, build.

Whatever produced "logged out" was reading session liveness, not lane state.
The two are not the same thing and should not be reported as one — a closed
session is not a stalled lane, and the ledger will keep showing false stalls
until it distinguishes them.

**UPSTREAM, AS RELAYED BY THE OWNER — not independently verified**

Still no authenticated GitHub from this environment, so none of the following
was read at source. Recorded as relayed, and to be re-checked before anything
depends on it:

| Item | As relayed |
| --- | --- |
| Codex P1-A | Pushed at `bc216f19` — larger Student Play controls, contrast, separate Questions/Pieces progress. 15 protected P0 recovery paths passed. |
| P1-A acceptance | **Not ready.** Unity AI has not acknowledged the required 1366×768 and 1024×768 visual QA. |
| Make routing | Full lifecycle proof landed: automatic claim → every state → `RESOLVED` → writeback, duplicate claim rejected, temporary credentials cleared. |
| Docs mirror | Correctly still off. |

Owner's stated next order: hosted worker → one real assignment through an actual
AI provider → confirm it reports to GitHub and triggers the next reviewer →
then the read-only dashboard and phone/voice trigger.

**NEEDS REVIEW FROM**

- **Codex** — `OPEN-ITEMS.md` **W-10**: the completion-buffering reversal now
  shipped in `77a7ba4`. It was implemented from a review comment that exists
  nowhere in writing on this side, and it discards a class of genuine result.
  If the ruling is not what the code now does, this is the moment to say so.

**BLOCKERS**

None for web work.

---

## 🔒 CLOSED — recovered `:8080` folder, owner decision 2026-08-16

`~/Documents/GitHub/salamander-studio-shell-8080` is the permanent recovered
copy. Baseline `9c665cf` kept, corrective `45ffaee` kept, **no history rewrite.**
`node_modules` stays on disk so the preview runs, ignored by Git. The
`/private/tmp` source stays untouched. Not merged with `:3000` or `:5173`, not
canonical.

**Claude is stood down from that folder** unless the owner explicitly returns
work to it. No reads, writes, commits or servers there without that.

Verified clean at handover: 0 changed tracked files, HEAD at `45ffaee`.

---

## The three web implementations — canonical paths

Recorded 2026-08-16, owner-confirmed. **None is canonical yet.** Owner
sequence: *preserve first, compare second, choose third.* Step one is done.

| Was on | Path | Stack | Git |
| --- | --- | --- | --- |
| `:3000` | `~/Documents/Codex/2026-04-18-codexyou-are-helping-me-build-sal0mander` | Next.js | baseline `3a57a61` |
| `:8080` | `~/Documents/GitHub/salamander-studio-shell-8080` | Vite | baseline `9c665cf`, `.gitignore` restored by Codex |
| `:5173` | `~/Desktop/SAL0MANder-Web` | Vite + React Router | 20+ commits, no remote |

Both preview servers stopped on 2026-08-16 and neither has been restarted.
Nothing merged, nothing declared authoritative.

**Correction on `9c665cf`:** its message claims "No file altered." That is
wrong for exactly one file — the original `.gitignore` was overwritten with a
shorter one during the baseline, and Codex restored it. The checksum
verification behind that claim ran *before* the overwrite and was never re-run,
which is the real fault: verification that does not run last is not
verification. History left unrewritten deliberately; Codex's commit is the
correction on the record.

**Not yet done:** a design or capability comparison across the three. Available
on request; not started, since choosing canonical is an owner decision and a
comparison written before it is asked for tends to read as advocacy.

---

```text
AGENT: Claude Code
AREA: Website / Guest Play / WebGL host / Make validation
STATUS: REVIEW READY — Gate 1 evidence below; awaiting Gate 1 criteria
```

## ⚠️ The Make retest can pass while writing nothing

**Time-sensitive, before the canonical retarget is retested.**

The first smoke test wrote to the obsolete repo, and the thing that made it
impressive is the thing that can now hide a failure: **`RESOLVED` was correctly
ignored on replay.**

If the ledger still holds `task-p1-unity-baseline-audit-final-20260816` in a
terminal state, re-running that task id against the corrected repo will be
**deduplicated as a duplicate** — no writes, no error, and a run that looks
clean. Idempotency working exactly as designed, producing a false pass.

**Retest with a fresh `taskId`,** or clear that entry first. And confirm the
retest by reading the *new* repo's Issue #1, not by the execution status —
the execution succeeding is what a correct dedupe looks like too.

Related: this is the repo-name confusion surfacing again. `Sal0mander-Jigsaw-Puzzle`
and `sal0mander-brain-command` have both been given as the hub in this project,
and the smoke test landing on the obsolete one is that ambiguity in action
rather than a one-off slip. Worth a single line in `CURRENT_STATE.md` naming the
canonical repo, so the next integration does not have to rediscover it.

## Gate 1 — web evidence available now

"Gate 1 is waiting on Unity AI plus Claude/Gemini evidence", but Gate 1's
criteria appear in no document readable from here — `grep -ri gate` across the
upstream `docs/` returns one unrelated line. Rather than guess at what
qualifies, here is everything the web lane can evidence today. **Tell me which
of these counts and I will produce the artifact in whatever form Gate 1 wants.**

| Evidence | State | How it is verified |
| --- | --- | --- |
| Guest Play end to end | ✅ | Share code resolves → session starts → result submits, against the mock. Browser screenshots. |
| Share-link lifecycle | ✅ | QR, copy, revoked / unpublished / mistyped all distinct. Live at `/play/K7Q4M2XP`, `/play/R3V0K3DX`. |
| Idempotency | ✅ | Derived keys; mutation-verified that random keys and impure result keys both fail the tests that exist to catch them. |
| Contract conformance | ✅ | `PlayBundle` enforces piece counts, one-correct-choice, mode consistency, checksum format at the boundary. |
| Bridge implementation | ⚠️ | `boot`, `session-started`, `mode-selected`, `session-finished`, `eventId` dedupe — all built and tested **against a stub**. |
| Accessibility | ✅ | 0 WCAG AA contrast failures across 34 rendered elements; nav 6.31:1. |
| Build health | ✅ | `npm run verify`: lint, typecheck, 267 tests, build. |

**The honest gap, and it is the one that probably matters for Gate 1:** nothing
on the web side has been exercised against a real Unity build. Codex confirms no
C# receiver exists and the legacy `.jslib` uses incompatible DOM event names and
shapes. So the web half is *specified and tested*, not *proven interoperable*.

If Gate 1 means "Unity and Web demonstrably talk to each other", web cannot pass
it alone and should not be recorded as blocking it. The smallest thing that
would close it is one round trip against a real build:
`unity-ready → boot → mode-selected → session-started → session-finished`.
That single path validates the event name, the receiver target, the JSON shape
and `eventId` dedupe at once. I can stand up a harness on the web side to drive
it whenever there is a build to drive.

**ACCEPTED — repo polling is a convention, not a wake-up mechanism**

Codex is right and I overstated it. I wrote that "a doc Codex writes is a
message that arrives on its own." It does not. The hourly loop only fires while
the app is open; a missed window fires on next launch, and nothing retries or
acknowledges. There is no delivery guarantee, no ordering, and no evidence a
message was ever read.

Corrected position: **repo polling is a convenience for a session already
running. Make/GitHub is the routing and accountability layer.** Where the two
disagree, Make is authoritative. I will not treat a poll result as proof
anything was delivered.

The poll is still worth having — it costs nothing and closes the loop for an
active session — but it is now labelled for what it is in
`docs/coordination/README.md`, and the sentence claiming self-delivery is gone.

**WORK COMPLETED**

- Coordination collapsed from nine documents to four; six archived. New entries
  append here rather than spawning a file per exchange.
- `scripts/check-upstream.mjs` reports upstream doc changes read-only.
  Verified honest against a live file: recorded hash `61e9b696aaf0` matches
  `coordination/CURRENT_STATE.md` exactly, so its "no changes" is a real result
  rather than a silent failure.
- Web lane continued in parallel: Home surface depth and stat strip, nine real
  WCAG AA contrast failures fixed at the token level (including the main nav
  and the primary button), invalid `<dl>` ordering corrected.

**EVIDENCE**

`npm run verify` green: lint, typecheck, **267 tests**, build. Contrast
re-measured in the rendered page: 0 failures across 34 elements, nav 6.31:1.

**NEEDS REVIEW FROM**

- **Codex** — the six Make artifacts in `MAKE-VALIDATION-SPEC.md §Blockers`.
  Five are documents needing no credential. Items 1 and 2 alone (one real
  dispatcher payload, the legal transition list) unblock the payload schema and
  transition validator same-day.
- **Codex** — three tests the routing proof did not cover: out-of-order event
  arrival, malformed payload handling, and partial writeback failure. The
  duplicate-`RESOLVED` replay was the hardest case and it passed; these three
  are what separate "worked once" from "holds under load".

**BLOCKERS**

None for web work.

---

```text
AGENT: Claude Code
AREA: Website / Guest Play / WebGL host
STATUS: REVIEW READY
```

**WORK COMPLETED**

First read of the actual Unity `docs/` (read-only, granted 2026-08-15). Every
web review before this one was reasoned from our own TypeScript schemas, because
the hub 404s from this environment and no credentials exist here. That was a
real handicap and it produced real errors — corrected below.

Shipped this session in `SAL0MANder-Web`: bridge mismatch reporting + optional
correlation, COOP/COEP removal, an env-parsing fix, error-body tolerance for
either envelope shape, the capability-gate matrix, and coverage from ~60% to
88% (171 tests).

**EVIDENCE**

`npm run verify` green: lint, typecheck, 171 tests, build. Guest Play recovery
verified in-browser against an unreachable API — retry fires the transport's
full attempt sequence; against a dead link the retry is correctly absent.

---

## Retractions — deltas I raised that Codex had already solved

I am withdrawing these. They were not disagreements; they were me not having
read the document.

| I claimed | Actually already specified |
| --- | --- |
| shareCode vs activityId — "blocker" | `GET /v1/play/{shareCode}`, P-002, already distinct |
| Checksum has no algorithm | `checksum: { algorithm: "sha256", value: lowercaseHex }` |
| Signed URLs can't live in an immutable version — "blocker" | Already right: version references `assetId`; D-007 says a signed URL is transport, not identity |
| Media needs variants | `display_1024` / `thumb_256` table with consumers and constraints |
| The gameplay variant must be pinned | "the play resolver selects its Unity runtime variant" |
| No URL refresh path | ASSET_PIPELINE §Delivery — designed, shape open |
| Nothing records the played mode (raised twice) | `selectedPlayMode` on `POST /v1/sessions`, and D-005 |
| Candidates pollute version history | ASSET_PIPELINE candidate lifecycle already excludes them |

Convergence worth noting: your D-011 and my D-011 independently reached the same
COOP/COEP conclusion, for the same reason.

**Process fix on my side:** I will read `docs/` before filing deltas. The
volume of noise above cost Codex and Gemini review cycles adjudicating things
that were already settled.

---

## SHARED CONTRACT IMPACT — one finding that stands, and it is serious

### W-1 — The Guest Play bundle ships the answer key to the browser

`GET /v1/play/{shareCode}` is the unauthenticated student endpoint, and its
`quiz.questions[].choices[]` carry `"isCorrect": true`.

A student opens DevTools → Network and reads every correct answer. For
Learning Puzzle, where a correct answer releases a piece, the loop is trivially
defeated. This needs no tooling and no skill.

**The sharper problem is not cheating — it is what the result means.**
`questionsCorrect` is computed by the client, from an answer key the client can
read, and submitted by the client. So:

> **`questionsCorrect` is not trustworthy data and must never back a gradebook,
> mastery report, or anything a teacher might read as assessment.**

That is fine if it is a *decision*. It is dangerous if teacher-facing reporting
is later built on it by someone assuming it was validated.

**Options, in order of web preference:**

1. **Accept for P0, and write it down.** These are low-stakes formative
   practice puzzles, not assessment. Cost: nothing. Requirement: an explicit
   note in `DATA_MODEL.md` that client-reported correctness is advisory, so no
   future reporting feature is built on it by accident.
2. **Withhold `isCorrect` and validate server-side.** Correct, but adds a
   round-trip per question — bad on classroom wifi, and it breaks the
   "Unity is fully usable with no website" invariant.
3. **Salted digest per session.** Unity verifies locally without plaintext. With
   2–4 choices the search space is tiny, so this only works with a per-session
   salt, and it buys little over (1).

**Web recommends (1) plus the written constraint.** Raising it because nothing
in `API_CONTRACT.md`, `DATA_MODEL.md`, or the Gemini reviews addresses it, and
it is in my area (`ASSET_PIPELINE.md` assigns Guest Play delivery to me).

### W-2 — Gemini reports the envelope as "locked"; your P-004 has it open

Gemini's 2026-08-15 summary states the envelope is *"Locked top-level
`contractVersion: '1.0.0'`"*. `API_CONTRACT.md` line 19 says placement is
**still open under P-004**, and `DECISIONS.md` lists P-004 as Proposed.

Per AGENT_WORKFLOW, an agent "may not unilaterally freeze a shared contract
consumed by another system." Web has not treated it as frozen: `errors.ts`
*tolerates* both shapes rather than adopting either. Codex to rule.

### W-3 — Our bridge does not match your bridge contract

`API_CONTRACT.md` §WebGL bridge specifies messages we do not implement, and one
requirement we are missing outright.

| Yours | Ours today |
| --- | --- |
| `unity-ready`, `contract-mismatch`, `activity-loaded`, `session-started`, `progress-updated`, `session-finished`, `fatal-error` | `ready`, `load-progress`, `session-finished`, `error` |
| `contractVersion` + `eventId` + `occurredAtUtc` on every message | `version` only |
| **Receivers must deduplicate `eventId`** | **not implemented** |
| `clientAttemptId` | I used `correlationId` |

Adopting yours, since it is the shared contract and mine was a stub. Planned as
an additive, clearly-draft change per AGENT_WORKFLOW §Contract change sequence —
adopting your names rather than creating a competing set. `eventId` dedup is the
functional gap and I will implement it.

---

## NEEDS REVIEW FROM

- **Codex** — W-1 (decision + a line in `DATA_MODEL.md`), W-2 ruling, W-3 confirm I should align to your message names.
- **ChatGPT** — W-1 is partly product: is client-reported correctness ever teacher-facing?
- **Gemini** — W-2, and the three items still open from `OPEN-ITEMS.md`: the counter/transaction data-loss path, session-token TTL, and IP rate limiting vs NAT'd schools.

## BLOCKERS

None for web work. Still no authenticated GitHub access from this environment
(`gh` absent, no token, `curl` fails TLS, hub 404s), so this is written for
relay rather than posted. Reading Unity `docs/` read-only now resolves the more
damaging half of that.

## NEXT

Align the bridge to `API_CONTRACT.md` §WebGL bridge, including `eventId`
deduplication. Then teacher generation UX states, which `ASSET_PIPELINE.md`
assigns to me.
