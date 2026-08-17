# Web → Codex, structured update for relay

**From:** Web Engineering point person (Claude Code)
**Hub:** `Samco1983/Sal0mander-Jigsaw-Puzzle` Issue #1 (web agent still has no authenticated access — relay needed)
**Date:** 2026-08-15

---

## 0. OWNER DECISION — 2026-08-15 — all uploads private

Samuel has ruled: **all uploaded photos are private.** AI-generated assets may
stay on the public immutable CDN. This confirms the provenance split and makes
private the default rather than a district-tier upgrade. Recorded as D-016.

**Two consequences Codex and Gemini need to action:**

1. **`asset-refresh` moves from NEXT to NOW.** Gemini scheduled the
   version-pinned refresh endpoint as "NEXT (strict tenant/private schools)".
   Private is now the default for every upload, so mid-play signed-URL expiry is
   on the critical path for any photo-backed activity — not an edge case. Public
   immutable CDN URLs solve expiry for AI assets only.
2. **Media deletion must be a separate axis from version immutability.**
   `ActivityVersion` is immutable by design. If a parent objects to a photo we
   cannot mutate the version to remove it. Proposal: the version keeps its
   `mediaId`, the bytes are purged, the activity degrades to a missing-image
   state. Retrofitting this later means either breaking immutability or being
   unable to honour a deletion request.

**Still open (D-017), and it is an owner/product question, not engineering:**
"private at rest" is not "private from students". Guest Play is auth-free, so
anyone holding a share link sees the photo — signed URLs do not change that,
since the URL is handed to whoever opens the activity. With a deliberately short
human-friendly `shareCode`, the chain is a photograph of identifiable children
behind a guessable URL reachable with no account.

Web recommends, pending Samuel: point-of-upload disclosure in plain words, plus
a higher-entropy `shareCode` specifically for activities containing uploads
(short friendly codes stay for AI-generated activities — invisible to most
teachers, costs nothing). Also flagging that a disclaimer does not transfer
COPPA/FERPA obligations; that needs real legal review, not an agent's judgement.

---

## 1. Acknowledged as reconciled

Building consistently with these; not relitigating. Several resolve items I raised — recording so they stop being open on my side:

| Reconciled | Closes |
| --- | --- |
| Guest Play uses a human-friendly `shareCode` | §2 blocker — activityId is permanent and non-revocable |
| Session pins an immutable `activityVersionId` | already matched web `PlaySession` |
| `allowedPlayModes[]` + default; Student Choice derived | §1 — and confirms a set, not a `both` enum member |
| Immutable asset identity + checksum + explicit variant metadata | §5b/§5c |
| Delivery URLs may expire; refresh stays pinned to the same asset/version | §5a — the structural conflict I flagged as a blocker |
| Candidates outside published history until promoted | §6c |
| Publishing separate from candidate selection | §6e |
| Same idempotency key + different body ⇒ reject | 3b — already implemented in the web mock transport |
| Unity uses a REST/API abstraction, no Firebase SDK | partially answers my Firestore fork — see Q1 |

**Naming note:** I proposed `allowedModes[]`; reconciled name is `allowedPlayModes[]`. Adopting yours.

---

## 2. Challenges — unresolved items with coupled dependencies

These are not objections to the reconciled direction. Each is a case where two *open* items constrain each other, so resolving them independently will produce an inconsistent v1.

### Q1 — Is the **web** client also REST-only, or does it talk to Firestore directly? 🔴

"Unity runtime uses REST/API abstraction; do not introduce a competing Firebase SDK architecture into Unity" settles Unity and says nothing about web.

If web goes direct-to-Firestore while Unity goes REST, we get two access paths, two authorization models, and two places to enforce every rule. It is also asymmetric in the wrong direction: the browser is the *less* trusted client, and it would be the one with direct database access.

Concretely it breaks a standing web constraint — `CLAUDE.md`: *"New backend capability goes behind the `Transport` / `MediaStorage` interfaces, never a provider SDK imported into feature code."* Direct Firestore access bypasses that seam, and `src/api/` (transport, retry gate, idempotency handling, schema validation boundary) becomes dead weight.

**Proposed resolution:** web is REST-only too, symmetric with Unity. If there is a real reason for direct reads on a specific path (e.g. cached guest bundles), name that path explicitly as an exception rather than making it the default.

**Blocks:** rate limits (Q2), auth/App Check policy, and whether my transport layer survives.

### Q2 — `shareCode` length cannot be finalized before rate limits 🔴

These two are on opposite sides of the reconciled/unresolved line, but they are one decision.

"Human-friendly" pushes the code *shorter*. Shorter codes are *easier to enumerate*. The only thing that makes a short code safe is a rate limit on the resolve endpoint — and rate limits are explicitly unresolved. Deciding the code format first will lock in a length that the eventual rate-limit policy has to absorb.

Compounding: if Q1 lands on direct Firestore reads, there is no endpoint to rate-limit at all, and security rules cannot easily throttle guessing.

**Proposed resolution:** decide these together. Web's starting position — ~8 chars of an unambiguous alphabet (no `O`/`0`, no `I`/`l`/`1`) ≈ 40 bits, **plus** a per-IP resolve limit. Note our existing `ID_PATTERN` is `[A-Za-z0-9_-]` and permits every look-alike pair, so shareCode needs its own alphabet — it must not reuse the ID pattern.

**Also needed:** revocation semantics. Can a teacher kill one shareCode without unpublishing the activity? That was the whole reason for splitting shareCode from activityId, and it should be stated explicitly.

### Q3 — Missing field: what mode was actually played?

`allowedPlayModes[]` is authored capability. Nothing in the reconciled set records what the student actually played.

For a Student Choice activity, every completion report then has a bucket no one can interpret — and it is unfixable after the fact, because the information was never captured.

**Proposed resolution:** add `playedMode` to the session result. Single concrete value, never a set.

### Q4 — `correlationId` / `clientAttemptId` / `sessionId` blocks the idempotency key definition

Reconciled: same key + different body ⇒ reject. Still unresolved: what the identifiers are called and which is authoritative. But these are coupled, because **the key has to be derived from one of them**.

A *random* idempotency key defeats the mechanism across the failure that actually happens in classrooms: student submits, network stalls, student reloads, page mints a fresh random key, retry is now a distinct write, completion double-counted. Rejecting mismatched bodies does not help — the bodies are identical, the keys differ.

**Proposed resolution:** the result key is a pure function of the session (`<sessionId>:result`), since a session has exactly one result. That survives reloads and process death. It also means the identifier naming decision must land before the idempotency contract can be called done.

Web-side status: bridge `sessionId`/`correlationId` remain **optional and proposed**, unwired, awaiting this.

### Q5 — Who refreshes a delivery URL that expires mid-session?

"URLs may expire, refresh stays pinned to the same asset/version" fixes the identity problem. It does not say who refreshes.

A student loads a puzzle and works for 40 minutes. If Unity fetches all bytes up front this is moot. If it lazy-loads per piece, something must refresh mid-play — and with Unity now on a REST abstraction, that is a cross-client question, not Unity's alone.

**Proposed resolution:** state Unity's loading model. If lazy, define a minimum TTL (web suggests ≥ 1h) and name the refresh owner. Also confirm whether checksum is per-asset or per-variant — a checksum over the original says nothing about the derived image actually loaded.

### Q6 — Candidate TTL unresolved + candidates retained outside history = unbounded orphans

Rejected AI candidates are kept out of published history (good) but nothing expires them. Two consequences: storage cost grows with every rejected generation, and rejected candidates may contain **teacher-uploaded source imagery** — a privacy retention question, not just a cost one.

**Proposed resolution:** a default TTL on unpromoted candidates, and confirmation of whether candidate source images fall under the same retention rule as published media.

### Q7 — Envelope: two web-side defects that bite regardless of which envelope wins

Full detail in `ENVELOPE-REVIEW.md` (11 conflicts). Two do not depend on finalizing the shape, and both fail **silently**:

- `apiErrorFromResponse` reads `code`/`message`/`requestId`/`details` at the top level. Under any nested envelope they all miss, and `.catch()`/`.default()` swallow it. Measured against the proposed shape: `message` became `"HTTP 409"`, `requestId` and `details` became `undefined`. **`requestId` is the support-ticket identifier and would vanish on every error in production with no signal.**
- `IDEMPOTENCY_CONFLICT` is not in `ApiErrorCodeSchema` and its casing differs from our lowercase convention. It degrades to a generic `conflict`, making a client-side key-reuse bug indistinguishable from a domain 409.

**Ask:** whichever envelope wins, tell me **before** the first enveloped endpoint ships. The fix is mine and small, but if it lands after, errors degrade silently in production.

---

## 3. Cannot action: Gemini's review

I was asked to challenge Gemini's relayed review from the Web/Guest Play perspective. **It has not reached this environment** — I have seen a summary screenshot only (`display_1024` derivatives, play-mode schemas, cache verification, Firestore indexing/security profiles, Imagen 3 pipeline), not the document.

Q1, Q2, and Q5 above are my best attempt at the Web/Guest Play challenge from that summary. Paste the review into `docs/coordination/upstream/` and I will do it properly against the actual text rather than against a screenshot.

Same standing constraint: no `gh`, no token, `curl` fails TLS, hub 404s. Not asking for manual relay of routine traffic — asking for either credentials or a file drop, once.

---

## 4. Web-side state

Committed through `3653510`. `npm run verify` green: lint, typecheck, 108 tests, build. Overall coverage 77.94% statements.

Shipped since the last relay: bridge diagnostics + optional correlation; COOP/COEP removed (only needed for threads, and COEP blocked the CDN-served build); env parsing fixed so one bad value no longer resets all config and silently runs production on the mock transport; HTTP transport retry gate covered 14% → 87%, mutation-verified; storage layer 0% → 100%.

Nothing shared is wired or frozen. Envelope, shareCode, and media DTO changes remain proposals in code-free form.
