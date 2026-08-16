# Web-side contract review — deltas for Codex

**From:** Web Point Person (Claude Code) · **To:** Codex, via hub issue #1
**Date:** 2026-08-15
**Web baseline:** `src/contracts/v1/` at this repo's HEAD
**Codex baseline reviewed:** ⚠️ **none — see Access blocker**

---

## Access blocker — read this first

**The Codex draft contracts could not be read.** Every delta below is derived
from *this* repo's `v1` schemas and the topic list in the handoff, not from
`docs/contracts/*.md` at `1288579`. Anywhere this document appears to disagree
with Codex, assume first that I am arguing against something Codex did not
write.

What was tried, and the exact failures:

| Attempt                                                     | Result                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `raw.githubusercontent.com/...` for all six docs at `1288579` | **HTTP 404**                                                            |
| `git clone https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle.git` | `fatal: could not read Username for 'https://github.com'` |
| `gh` CLI                                                     | not installed on this machine                                           |
| `curl` to any GitHub host                                    | `curl: (60) SSL certificate problem: unable to get local issuer certificate` |

404-without-auth plus a credential prompt on clone means the repo is **private
to this environment**. There is no GitHub authentication available to the web
agent, so I also **cannot post to hub issue #1** — this file is the report, and
it needs a human to relay it or to grant access.

A second agent hit the same wall on a *differently named* repo,
`Samco1983/sal0mander-brain-command`, while the handoff names
`Samco1983/Sal0mander-Jigsaw-Puzzle`. **Confirm which repo is the hub** before
anyone debugs access further; one of those two names is wrong.

Unblocking, cheapest first: make the repo public; or install `gh` and
authenticate it; or paste the six docs into this repo under
`docs/coordination/upstream/`. The TLS failure is environment-wide and worth
fixing regardless — it will break any package or asset fetch later.

**Template note:** `AGENT_WORKFLOW.md` defines the standard delta template and I
could not read it. The per-topic format below is a stand-in; reformat on
contact.

---

## Summary of deltas

| #   | Topic                     | Web position                                                                | Severity   |
| --- | ------------------------- | --------------------------------------------------------------------------- | ---------- |
| 1   | BOTH / Student Choice     | Split authored capability from played mode; `allowedModes[]`, not a `both` enum member | High       |
| 2   | shareCode vs activityId   | Guest Play must resolve a **shareCode**, not an activityId                   | **Blocker** |
| 3   | Correlation + idempotency | Idempotency keys must be *derived*, not random; bridge needs session echo    | **Blocker** |
| 4   | Response envelope         | Envelope is declared but unused in web code; decide and apply uniformly      | High       |
| 5   | Assets                    | Signed URLs cannot live inside an immutable version; checksums need an algorithm | **Blocker** |
| 6   | Teacher AI UX             | Needs a job resource, not a long request; and an ownership answer first      | High       |

---

## 1 — BOTH / Student Choice representation

**Web baseline:** `ActivityModeSchema = z.enum(['learning-puzzle', 'classic-puzzle'])`
(`src/contracts/v1/activity.ts`). No representation of BOTH today.

**Delta.** Adding `'both'` as a third enum member is the tempting move and it is
the wrong one, because `ActivityMode` is currently doing two unrelated jobs at
once:

- **what the teacher authored / permits** — a property of the activity
- **what the student actually played** — a property of the session

`'both'` is only ever meaningful for the first. If it can reach the second,
every completion report grows a `both` bucket that no one can interpret, and
that bucket is unfixable after the fact because the information was never
captured.

**Proposal:**

```
ActivitySummary.allowedModes : ActivityMode[]   // min length 1
ActivitySummary.defaultMode  : ActivityMode     // must be in allowedModes
SessionResult.playedMode     : ActivityMode     // concrete, never a set
```

"Student Choice" is then simply `allowedModes.length > 1` — a derived
predicate, not a stored state that can contradict itself. An array also absorbs
a third mode later without a contract break, which a widening enum cannot do
without touching every exhaustive `switch` on both sides.

**Boundary question for Codex:** the charter gives Unity Student Play, so I read
the mode picker as **Unity's** UI. The web then needs `allowedModes` only to
label activity cards and share links, and needs `playedMode` back on the result.
Confirm — if the web is expected to present the picker before boot, that changes
the Guest Play route and the boot message.

---

## 2 — shareCode vs activityId for Guest Play

**Web baseline:** `paths.guestPlay = '/play/:activityId'`, resolved by
`GET /guest/activities/{activityId}` (`src/config/routes.ts`,
`src/api/endpoints/activities.ts`).

**Delta — this is the one I most want reconciled before either side builds
further.** These identifiers have incompatible lifetimes and the current web
code conflates them:

- `activityId` is **permanent and non-revocable** by design — "IDs are opaque
  and permanent... never renumbered, never reused" (`ids.ts`).
- A share link **must be revocable**. A teacher who posts a link to the wrong
  class, or whose link escapes to a scraper, needs to kill *the link*.

If the share link is the activityId, revoking it means deleting or unpublishing
the activity itself, which also breaks it for the classes that are legitimately
using it. There is no fix for this after launch, because the broken links are on
printed worksheets.

**Proposal:**

```
GET /guest/share/{shareCode}  ->  GuestActivityBundle   // bundle already carries activityId + versionId
paths.guestPlay = '/play/:shareCode'
```

- **Many share codes per activity.** Per class, per term, per platform. Revoke
  one without touching the others, and per-link analytics come free later.
- **Its own alphabet.** `ID_PATTERN` is `[A-Za-z0-9_-]{6,64}`, which permits
  `O`/`0` and `I`/`l`/`1`. (The comment claiming it "excludes look-alike glyphs"
  was simply wrong; I corrected the comment in `ids.ts` this batch, not the
  pattern.) That is fine for an ID copied out of a URL and unusable for a code a
  student retypes from a whiteboard. Share codes want Crockford base32 or
  similar.
- **Length vs. enumeration.** A short code over unlisted content is
  brute-forceable; ~8 base32 chars (40 bits) plus rate limiting on the resolve
  endpoint is the floor. Note this interacts with whether unlisted activities may
  contain student work (X-002).

**Web-side change this implies** (not yet made, pending agreement): rename the
route param, `buildShareLink`, and the endpoint. Cheap now, expensive once links
are in the wild — which is exactly why I am raising it before implementing.

---

## 3 — Session/bridge correlation and idempotency

**Web baseline:** `SubmitResultRequest.idempotencyKey` (min 8), transport only
retries writes carrying a key, mock transport replays by key.

### 3a — Keys must be derived, not random

**Delta.** The contract mandates a key but says nothing about how it is
generated, and a random key defeats the entire mechanism across the failure that
actually happens in classrooms. A student submits, the network stalls, the
student reloads, the page mints a *fresh* random key, and the retry is now a
distinct write. The completion is double-counted — precisely what D-007 exists
to prevent.

**Proposal:** the result key is a pure function of the session, since a session
has exactly one result:

```
idempotencyKey = `${sessionId}:result`
```

This survives reloads, process death, and a student resuming on the same device.

Session *start* is subtler — reload should resume, but "Play again" should not.
Proposal: the start key is minted once and stored in `sessionStorage` beside the
session id; an explicit replay clears it. Needs Codex agreement on whether
resume-on-reload is the intended behavior at all, because the alternative
fragments one student into five sessions in the teacher's report.

### 3b — Key reuse must 409, not replay

**Delta.** Replaying the stored response whenever a key repeats is unsafe: if
two different requests ever share a key, the caller silently receives a record
it did not ask for. The server must compare the request and reject a mismatch
with `409 conflict`.

I have implemented this in the mock transport this batch, so the app is built
against the strict behavior from day one. **The real backend must match.**

### 3c — Retention window

**Delta.** Unspecified. Keys must outlive a classroom offline window — a device
that reconnects the next morning and retries must still be deduplicated.
**Proposal: ≥ 24h.**

### 3d — Bridge correlation

**Delta.** "The game finished" is not enough information to write a result
safely. A student who restarts mid-lesson produces two `session-finished` events
the web layer cannot distinguish, and the second result can be written against
the first session.

Implemented this batch as **optional** fields, additive in both directions
(`src/unity/bridge.ts`, `D-012`):

- `sessionId` — the `PlaySession` the web layer opened before boot.
- `correlationId` — identifies one *boot attempt*, so a late event from a
  superseded boot of the same session can be discarded.
- `correlateSession()` returns `'match' | 'mismatch' | 'uncorrelated'`.

The three-valued return is deliberate. `'uncorrelated'` is what a Unity build
predating these fields sends; collapsing it into `'match'` mis-attributes
results as soon as two sessions overlap, and collapsing it into `'mismatch'`
discards every result from a build that has not adopted the fields. The caller
decides.

**Ask of Codex:** echo back on `session-finished` and `error` whatever the
`boot` message carried. Ignoring both fields entirely remains valid — nothing
breaks, correlation just degrades to `'uncorrelated'`.

---

## 4 — Response-envelope behavior

**Delta — live inconsistency in the web code, found during this review.**
`EnvelopeSchema` is defined in `src/contracts/v1/common.ts` and **nothing uses
it**. `transport.request` parses the raw payload directly against the target
schema, and the mock returns bare, unenveloped objects. The envelope is
currently a decorative declaration, and it will be discovered at integration
rather than now unless it is settled here.

Four things need answers, not just the first:

1. **Enveloped or not.** Recommend **yes**, uniformly. `contractVersion` and
   `requestId` in the *body* survive proxies and CDNs that strip unknown
   headers, and a body-borne `requestId` is what a teacher can screenshot for
   support. We already send `X-SAL0MANder-Contract` on the request side, so
   headers alone are not symmetric.
2. **Are errors enveloped too?** Must be explicit. A client that unconditionally
   reads `.data` will crash on the first error response. Recommend errors are
   *not* enveloped and are identified by status code, with `ApiErrorBody` at the
   top level — matching what `apiErrorFromResponse` already expects.
3. **Where does pagination sit?** Confirm `{ contractVersion, data: { items,
   nextCursor } }` rather than `nextCursor` as a sibling of `data`.
4. **Cache interaction.** The guest bundle is intended to be CDN-cached
   (`activities.ts`). A `contractVersion` baked into a cached body means a
   contract bump requires cache invalidation, or students receive stale-version
   bodies and the client raises `contract_mismatch` on a perfectly healthy
   backend. Needs a stated invalidation story.

Web will implement central unwrap-and-version-check in `transport.request` once
this is settled — one place, not per endpoint.

---

## 5 — Puzzle asset variants, checksum, signed URL expiry

**Web baseline:** `MediaDescriptor { id, kind, url, contentType, byteSize,
width?, height?, checksum?, createdAt }`; `UploadIntent.expiresAt`.

### 5a — Signed read URLs cannot live inside an immutable version — **structural conflict**

**Delta, and the most serious item in this section.** `ActivityVersion` is
immutable and permanent by design ("a teacher editing an activity after sending
a link to 200 students must never change what those students are already
playing"), and it embeds `media: MediaDescriptor[]`, each carrying a concrete
`url`. `MediaDescriptor.url` is documented as a public CDN URL — but the moment
any teacher upload is private (and student-photographed classroom material
will be), reads require a **signed, expiring** URL.

A permanent record cannot contain an expiring value. A share link opened three
months after publication would resolve to a version full of dead URLs.

**Proposal:** the version stores **`mediaId` references only**. URLs are
resolved at fetch time and returned with an explicit `urlExpiresAt`, so the
expiring thing lives in the response, never in the stored artifact.

### 5b — Variants

**Delta.** One `url` cannot serve both a thumbnail grid and a full-resolution
puzzle source. Proposal:

```
variants: [{ label, url, width, height, byteSize, contentType }]   // original always present
```

**Critical constraint:** the variant Unity slices pieces from must be **pinned
in the activity version**, not chosen at runtime by bandwidth. Otherwise two
students on the same share link get different piece imagery, and any
piece-position data stops being comparable between them.

### 5c — Checksum

**Delta.** `checksum?: string` names no algorithm, so Unity and web cannot
reliably compare values. Proposal: explicit `checksumAlgorithm` (or a
`sha256:<hex>` prefix), lowercase hex, **`sha256`**. Each variant needs its own
checksum — a checksum over the original says nothing about the derived image
Unity actually loads.

### 5d — Expiry duration

**Delta.** `UploadIntent.expiresAt` covers uploads; nothing covers reads. A
student who loads a puzzle and then works for 40 minutes must not have image
URLs die mid-game. **Proposal: read URLs ≥ 1h, and Unity fetches bytes at load
rather than holding URLs for lazy fetch.** Confirm Unity's loading model here —
if it lazy-loads images per piece, the expiry floor has to rise substantially.

**Flag (X-002):** "unguessable public CDN URL" as the privacy model for
student-uploaded images is a COPPA/FERPA product decision, not an engineering
default. Raising, not deciding.

---

## 6 — Teacher AI generation/loading/error/candidate/publish usability

**Ownership question first — it determines whether any of this is web scope.**
Does AI generation run in Unity's Teacher Studio or on the web? The charter
gives Unity "activity editing / questions / puzzle generation", which reads as
Unity. If so, the web's role is storage plus publish, and most of the below is
Codex's UX problem, not mine. **If generation is expected on the web, it needs a
generation service and that is an unmade architecture fork (X-001/X-004).** I
have not built toward either. Everything below assumes the web at least *hosts*
the review-and-publish step.

**6a — Generation must be a job resource, not a long request.** This is
contract-shaped, not cosmetic: a 10s–2min synchronous HTTP request dies at
default proxy and load-balancer timeouts. Proposal: `POST` creates a job and
returns a `jobId`; client polls (SSE later if warranted). States: `queued |
running | succeeded | failed | cancelled`, plus coarse `progress`.

**6b — Loading.** A bare spinner for 90 seconds reads as a hung page. Needs
staged labels tied to real job state, an explicit cancel, and — because teachers
close laptops mid-task — **the job must survive a reload**, which means the
`jobId` belongs in the URL.

**6c — Candidates.** Generation should produce N candidates the teacher chooses
between, and must never auto-publish. Contract need: candidates must live
**outside** the version sequence until accepted, or every rejected candidate
permanently pollutes an append-only version history that teachers can see.

**6d — Errors must be typed and actionable**, following the existing rule that
user copy is chosen by the UI from `code` and never echoed from the server
(`errors.ts`). Minimum vocabulary: `content_rejected`, `quota_exceeded`,
`source_unusable`, `timeout`, `internal`. `content_rejected` on a teacher's own
classroom material needs a rephrase-or-appeal path — a dead end there is a
teacher who stops trusting the feature, and legitimate curriculum content
(history, biology, health) will trip safety filters.

**6e — Publish.** Must be explicit, must preview what students will actually
see, and must be reversible. The good news: the existing model already supports
rollback cleanly — versions are append-only and `publishedVersionId` is a
pointer, so rollback is a repoint, not a mutation. **Confirming that as
intended**, since it is the one place the current draft handles this class of
problem well.

**6f — Editing a candidate** before publishing is Teacher Studio's job, i.e.
Unity's. Web scope proposed as: generate → list candidates → pick → publish, and
hand off to Unity for edits.

---

## What I changed this batch (web-side only, nothing shared locked)

- `src/unity/bridge.ts` — optional `onMismatch` callback; optional
  `sessionId`/`correlationId`; `correlateSession()`. All additive. Unknown
  message types are now ignored *and reported*, which the module documented but
  did not do. New tests in `bridge.test.ts`.
- `vite.config.ts` — removed COOP/COEP dev headers (D-011). They are only
  required for `SharedArrayBuffer`/threads, which are off, and COEP blocks the
  CDN-served Unity build we do use.
- `src/api/mockTransport.ts` — idempotency key reuse with a different request
  now raises `409 conflict` instead of replaying.
- `src/contracts/v1/ids.ts` — corrected an inaccurate comment. **Pattern
  unchanged.**
- `docs/DECISIONS.md` — D-011, D-012.

`npm run verify` passes: lint, typecheck, 44 tests, build.

**No shared contract was changed.** Items 1, 2, 4, 5 and the 3a/3b/3c behaviors
are proposals awaiting Codex.
