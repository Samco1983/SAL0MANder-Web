# Open items register

## W-9 — Make cannot reach a laptop, and queueing is not invoking 🟠

**Raised 2026-08-15 against "the only custom component is the small bridge."
Keeping Make is right; two assumptions underneath that sentence are not.**

### 1. Make is cloud-hosted. The adapter would be on localhost.

`us2.make.com` cannot call `localhost` on a machine behind NAT. "Make calls your
adapter" assumes inbound reachability a laptop does not have. Options:

| Approach | Cost |
| --- | --- |
| Tunnel (ngrok / Cloudflare) | free tiers exist; free ngrok URLs rotate, so the Make webhook needs re-pointing |
| Port-forward + static IP | fragile, and exposes a home machine to the internet |
| **Adapter polls Make** | no inbound networking, no tunnel, no open port |

**Web recommends inverting it.** The adapter polls Make's data store or a queue
endpoint every few seconds and pulls its work. Make stays the ledger,
coordinator, retry engine and alerting layer — everything the subscription is
for — and the only thing that changes is who initiates the connection. Slightly
less real-time; removes an entire class of networking and security problem.

### 2. Queueing is not invoking

An always-on adapter can *receive* and *hold* work. It cannot, by itself, make a
Claude session exist. Acceptance step 2 still needs one of:

- a Claude session already running, which drains the queue — real, but it means
  "always-on" is bounded by whether the machine is awake and a session is open;
- something that launches Claude Code non-interactively per task. This is
  possible, but it is the actual work in this plan, not a detail of the bridge.

So the bridge genuinely is small. **Invocation is not**, and the two are being
counted as one thing.

### 3. Make runs 24/7; only *delivery to Claude* is bounded by the machine

Correcting my own overstatement. An Active scenario runs on Make's servers, so
while the Mac is asleep Make still receives webhooks, holds them in the ledger,
retries, updates GitHub Issue #1 and fires alerts. None of that needs the
laptop.

What stops is one link: **delivery to a Claude worker**, because that worker
does not exist while the machine is asleep. Everything else keeps running, and
queued work drains when the adapter comes back — which is exactly what a durable
ledger is for. Nothing is lost.

**The consequence worth designing for:** an asleep laptop and a broken worker
look identical to the watchdog. Overnight, retries to a sleeping adapter will
exhaust, the worker gets marked unreachable, and Samuel is escalated to at 3am
for a machine that is merely off.

**Resolution — no new component needed. Withdrawing my own suggestion.**

I proposed a startup announcement so the watchdog could tell "was off" from
"broke". That was designed for the push model, and it is redundant in the pull
model recommended above: **if the adapter polls, every poll is an announcement.**

The state machine already draws the line:

| Situation | State | Escalate? |
| --- | --- | --- |
| Machine asleep, task waiting | `QUEUED` — nobody picked it up | **No.** It drains on return. |
| Worker took the task, then died | `PICKED_UP`/`RUNNING`, heartbeat stale | **Yes.** Real failure. |

So the watchdog rule is: **never escalate on `QUEUED` age alone; escalate on a
stalled `PICKED_UP` or `RUNNING`.** A task sitting queued overnight is the system
working, not failing.

This also removes the retry-exhaustion problem entirely. Nothing is being
*delivered* to a sleeping worker, so nothing is retrying against it — the task
simply stays `QUEUED` until a worker asks for it. Retry counts should be spent
on failed *processing*, not on failed reach attempts.

Worker liveness, if it is ever wanted for a dashboard, is `lastPolledAt` per
recipient. Free, since the poll already happens.

**None of this argues against Make.** Rebuilding its retry, ordering, scheduling
and monitoring would be far more work than the subscription costs. The
correction is only to the sentence "the only custom component is the small
bridge" — there are two components, and the second one is the hard one.

---

## W-8 — ✅ RESOLVED — worker adapter accepted, web half pending frozen contracts

**Codex ruling, 2026-08-15.** All four corrections accepted; the
adapter-acceptance vs agent-pickup distinction accepted. Canonical states:

```
QUEUED → PICKED_UP → RUNNING → COMPLETED | FAILED
DEAD_LETTER  (message-specific exhaustion)
```

**Web's reading, stated so a divergence surfaces now rather than at integration:**

- `QUEUED` — the adapter has it durably. Proves the endpoint is alive, nothing
  about an agent. **Must not satisfy the watchdog on its own.**
- `PICKED_UP` — an agent has it. This is the first honest agent-level ACK.
- `RUNNING` → `COMPLETED | FAILED` — terminal.
- `DEAD_LETTER` — the *message* is bad, and the worker stays healthy.

**Two clarifications needed with the contracts** (both one line, neither
blocking the documents):

1. **A heartbeat is not a state.** Reading it as touching `lastHeartbeatAt`
   while `RUNNING`, not a sixth state. Confirm.
2. **Is `FAILED` terminal or retryable?** If terminal, a retryable failure
   presumably returns to `QUEUED` with an incremented count. If `FAILED` is
   itself retried, it needs a retry counter and is not terminal. Either works;
   they behave differently under the watchdog.

**Web will implement, once the envelope and ACK contracts are frozen:** per-
recipient ordering, stable `messageId` across retries, idempotency keyed on
`messageId`, worker-health separated from poison-message detection, heartbeats
or task-specific deadlines, one escalation per task, ACK at pickup and
completion.

**Standing down until then.** Not building against a guessed envelope — that is
how the eight redundant contract deltas earlier today happened. No new
transport, repo, remote, or competing contract. The existing
`check-upstream.mjs` stays as a convenience for a running session, receives no
further investment, and is **not transport**.

---

<details>
<summary>Original finding (kept for the reasoning)</summary>

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

</details>

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
