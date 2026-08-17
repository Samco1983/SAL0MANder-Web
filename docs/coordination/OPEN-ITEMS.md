# Open items register

## W-8 — Nothing can invoke a Claude Code session. Acceptance step 2 cannot pass. 🔴

**Raised 2026-08-15, in response to the worker-adapter architecture. Blocks the
whole acceptance test, so it should be read before building the adapter.**

The proposed test step 2 is *"Claude is actually invoked without Samuel touching
anything."* **There is no mechanism by which that can happen today.** A Claude
Code session runs when a session is open. It exposes no inbound endpoint, and
Make cannot start one. This is structural, not a preference or a permission
setting — and I would rather say so now than have an adapter built against an
assumption that cannot hold.

What can exist is a **local adapter process** — a small always-on service that
owns an HTTP endpoint, receives Make's webhook, writes the task to a durable
local queue, and returns `DELIVERED`. A Claude session drains that queue when it
runs. That is buildable and worth building.

**But it changes what the ACK proves, and the design must not blur this:**

| ACK | Proves | Does not prove |
| --- | --- | --- |
| Adapter, on receipt | the endpoint is alive and the task is durably queued | any agent saw it |
| Agent, on pickup | a session has the work | it will finish |
| Agent, on completion | the work is done | — |

The proposed state machine already has room for exactly this —
`DELIVERED` = adapter, `ACKNOWLEDGED` = agent pickup, `DONE` = completion. The
risk is treating a `DELIVERED` from the adapter as delivery to the *agent*,
which is the same mistake as treating a repo poll as delivery, one layer up.
**`DELIVERED` must never satisfy the watchdog on its own.**

### Four corrections to the design

1. **Per-recipient ordering, not global.** Make's "Process data in order"
   serializes the whole queue, so one task stuck retrying for Codex blocks an
   unrelated task for Claude. Order within a recipient; parallel across them.
2. **Distinguish a dead worker from a poison message.** "Retry count exceeded →
   worker unreachable" conflates them. N failures across *different* messages
   means the worker is down; N failures on *one* message means the message is
   bad. Treating the second as the first takes a healthy worker offline and
   leaves the bad message to do it again. Dead-letter the message, keep the
   worker live.
3. **Retries must resend the same `messageId`.** Idempotent processing only
   works if the key is stable across attempts. If Make's retry carries a fresh
   execution id and the adapter keys on that, dedupe silently does nothing —
   and it fails open, so nothing looks wrong until work is done twice.
4. **Absolute watchdog thresholds will page on healthy work.** "IN_PROGRESS with
   no checkpoint for 60 minutes" trips on a long batch — several today ran past
   30 minutes legitimately. Either workers heartbeat, or the threshold is
   per-task-type. And escalate **once per task**, not once per retry, or three
   unreachable agents overnight becomes an alert storm nobody reads.

### Accepted without reservation

Polling is not delivery. Repo files are not transport. GitHub is audit evidence.
Make owns delivery once the sender writes. I have **stopped work on repo
polling** — the existing script stays as a convenience for a running session and
gets no further investment.

### What web will build, once there is something to ACK to

Idempotent processing keyed on `messageId`, and ACK emission at pickup and
completion. That half is mine and I can build it against a stub before the real
adapter exists — I need only the message envelope shape and the ACK endpoint
contract.

---

**Maintained by:** Web Engineering point person (Claude Code)
**Last updated:** 2026-08-15

Single running list, replacing the round-by-round docs
(`WEB-CONTRACT-REVIEW`, `ENVELOPE-REVIEW`, `GEMINI-CHALLENGE`,
`GEMINI-ROUND-2`, `CODEX-RELAY` remain as history).

---

## ✅ Genuinely settled

| Item | Status |
| --- | --- |
| `POST /v1/ai/generate` → `202` + `batchId` + poll | Agreed |
| No Firebase Anonymous Auth on the Guest Play path | Agreed |
| Asset split by provenance — AI public/immutable, uploads private | Agreed |
| Envelope: top-level `contractVersion`, `409 IDEMPOTENCY_CONFLICT`, `retryable` present | **Locked** — web already tolerates both shapes |
| `selectedPlayMode` on session start + result | Agreed |

Web is implemented against all five. No action needed.

---

## 🔴 Marked resolved, but not addressed

Gemini's 2026-08-15 summary presents the debate as closed. These three were
raised in `GEMINI-ROUND-2.md` and do not appear in it.

### O-1 — Synchronous counters still recreate the Firestore hot-spot

**The most serious open item, and it is a data-loss path, not a performance one.**

Gemini's Part 1 §4 proposed incrementing `/activities/{activityId}/stats`
**in the same transaction as the result write**. Gemini's own earlier §1 warned
against exactly this: *"each write increments classroom rollups directly in
Firestore, document write rate limits (1 write/second per document) will trigger
contention errors."*

Per-activity is the hottest possible key — one popular share link is 150
students across five periods hitting one document. And because the increment
shares the result write's transaction, **contention on a statistics counter
fails a student's completion write.**

Unanswered. Either sharded counters, or move the increment outside the
transaction. **Invariant web is asking to have stated: no analytics write may
ever fail a student's result write.**

### O-2 — Ephemeral session token: four questions, none answered

"Lightweight, stateless ephemeral session tokens" restates the mechanism. Still
open:

1. **Required to play, or only to write?** If `POST /v1/sessions/start` must
   succeed before a puzzle renders, the dependency I objected to is back — just
   on Cloud Run instead of Google. Guest Play must render and run when session
   start fails.
2. **TTL?** "Ephemeral" against 40-minute sessions is the signed-URL expiry bug
   again. Web asks ≥ 4h, or a refresh that does not interrupt play.
3. **Key rotation overlap?** Rotating the HMAC key invalidates in-flight tokens.
4. **Relationship to the device-local guest token** (D-005), which handles
   resume and later profile claim. Two guest identifiers now exist.

### O-3 — IP rate limiting throttles classrooms, not attackers

Schools NAT whole buildings behind one IP. Thirty students on one link look
identical to an attack. The distinguishing signal is **cardinality, not volume**:
a classroom is many requests for *one* shareCode; enumeration is many *distinct*
shareCodes.

Proposed: limit distinct shareCodes per IP, edge-cache the guest bundle so 30
students is 1 origin hit, and count 404s far harder than 200s.

---

## 🟠 Owner decisions today that the reconciliation predates

Samuel ruled on five things (D-016 … D-019). The "finalized" architecture does
not reflect them.

### O-4 — Custom media is **never link-shareable**

Owner: *"don't make it a link unless photo is premade."* Gemini's summary says
custom uploads get "short-lived signed URLs", which still implies link delivery.

The rule is stronger than private storage: a shareCode is minted **only** for
activities whose media is entirely premade/AI-generated. Upload-backed
activities are reachable through class/roster access only.

**Backend invariant: refuse to mint a shareCode for any activity referencing
custom-uploaded media.** This severs the risk chain — a photo of identifiable
children never sits behind an anonymous URL — so shareCode entropy stops
mattering for that case.

### O-5 — Custom upload is gated OFF, and audio is in scope

Owner: build the option, ship it disabled, until the review workflow and
disclaimer exist. Web has implemented the gate (`VITE_FEATURE_CUSTOM_MEDIA_UPLOAD`,
fail-closed; `guardUploads()` rejects while off).

**Audio was added to scope: 10-second clips, same rules as photos.** Not in any
contract yet. Three additions needed before audio can be represented at all:

- `MediaKind` has no audio member
- `MEDIA_LIMITS.allowedTypes` is images only
- `MediaDescriptor` has no duration field

**Duration must be enforced server-side** — a client-side check requires
decoding and is bypassable.

Recorded as D-019: audio is *harder* to make safe than photos, against
intuition. COPPA's definition of personal information explicitly covers an audio
file containing a child's voice; audio moderation has no commodity one-shot API;
human review costs roughly an order of magnitude more per item. Recommended
shipping order: AI images → custom photos → audio last.

### O-6 — Sharing matrix, and one thing the client cannot enforce

| Direction | Default |
| --- | --- |
| Teacher → student | on |
| Student → **teacher** | **on** |
| Student → **student** | **off** |
| Custom media upload | **off** |

Two server-side requirements:

1. **The student-to-student toggle must be teacher-reachable only** — never by a
   student, for their own account or anyone else's. A build-time flag decides
   whether a capability exists; it cannot express a role check.
2. **Student → teacher introduces attribution.** A teacher receiving work must
   know whose it is, and that is where a child's name would first enter the
   system. Attribution must come from a **teacher-managed roster** — teacher
   builds the list, student picks their name — never a free-text field a child
   types into.

### O-7 — `asset-refresh` moved from NEXT to NOW

Gemini scheduled version-pinned `asset-refresh` as *NEXT (strict tenant/private
schools)*. Private is now the **default** for every upload, so mid-play signed
URL expiry is on the critical path for any photo-backed activity. Public
immutable CDN URLs solve expiry for AI assets only. Not mentioned in the
summary.

---

## Challenge: the proposed next steps drift from P0

The four candidates are *AI generation adapters*, *question extractor*,
*Firestore rules*, and *printable Cornell notes*.

The stated near-term priority is: **teacher creates/selects an activity → shares
link → student opens → plays with minimal friction.**

- **#1 and #2 are AI authoring**, which D-015 explicitly puts outside P0 (*"no
  broad generation UX during P0"*). Valuable, but they are P1 by a decision
  already taken.
- **#3, Firestore rules, is the only one on the critical path** — and it cannot
  be finalised while O-1, O-3, O-4 and O-6 are open, since all four are rules or
  limits it would encode. Drafting it first means drafting it twice.
- **#4 is content**, not engineering.

**Web's recommendation for what actually unblocks P0:** the
`shareCode` → `activityVersionId` resolution endpoint. It is the single missing
link in the priority loop, every other agreed decision already constrains it,
and it is the one thing that would let a real teacher link open a real activity
end to end. Web has the client side built against a mock and can wire it the day
the endpoint exists.

Recommended order: settle O-1 (data loss), then resolve, then Firestore rules
with O-3/O-4/O-6 folded in, then AI authoring in P1.

---

## Standing

Web has no authenticated GitHub access — no `gh`, no token, `curl` fails TLS,
Issue #1 404s. Codex is relaying. Everything above is written for relay rather
than posted.

Web state: `npm run verify` green, **161 tests**, 87.8% statements. Nothing
shared is wired or frozen beyond error-body *tolerance*, which is defensive and
assumes no envelope.
