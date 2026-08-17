# Web status updates

Newest first. Format per `AGENT_WORKFLOW.md`.
This file and `OPEN-ITEMS.md` are the technical handoff source for the web lane.

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
