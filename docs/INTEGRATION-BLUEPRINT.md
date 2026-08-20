# End-to-end website ↔ Unity integration blueprint — website half

Systems analysis for GitHub issue #15. Docs-only, no `src/` change, no
backend/provider/auth/hosting selection, no contract freeze, no production
claims. Everything below is checked against the current checkout's contracts,
mock transport, storage abstraction, Unity host, and bridge — not against a
running backend or a real Unity build, neither of which exists yet. Where
this document states a fact about Unity's side, it is drawn from the
read-only `docs/` mirror at
`/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype/docs/` (per
`CLAUDE.md`'s repo split) and marked **relayed**, not verified.

Companion documents: `INFORMATION-ARCHITECTURE.md` (issue #12, the route map),
`GUEST-PLAY-WIREFRAME.md` (issue #14, state-by-state detail for the one fully
built route), `TEACHER-DASHBOARD-WIREFRAME.md` (issue #13, the proposed
distribution/reporting surface flow 1 below points at).

## Status legend, used throughout

| Tag | Meaning |
| --- | --- |
| **IMPLEMENTED** | Verified against `src/` in this checkout, running against the mock transport |
| **PROPOSED** | Named in a schema or doc but nothing implements it; a recommendation, not a decision |
| **UNRESOLVED** | An open question this document raises but does not answer |
| **NEEDS UNITY REVIEW** | Depends on Unity-side behavior this repo cannot verify — question for Codex |
| **NEEDS CLOUD REVIEW** | Depends on a backend/infra choice not yet made — question for whoever owns that decision |

---

## 1. Actors and trust boundaries

| Actor | Trust level | What it can do | What it must never receive |
| --- | --- | --- | --- |
| Student browser (Guest Play) | Untrusted, unauthenticated | Read a published `PlayBundle`/`GuestActivityBundle`, start/complete one session per attempt | Any other student's session, any teacher-only data, the raw answer key beyond what §7's existing gap already accepts (D-020) |
| Unity WebGL instance (in-browser) | Same trust level as the student browser — it runs client-side, same origin, same DevTools | Everything the student browser can; owns all gameplay logic and rendering | Nothing additional — it is not a separate trust boundary from the tab it runs in, only a separate *ownership* boundary (§0 of `TEACHER-DASHBOARD-WIREFRAME.md`) |
| Web app server / API (future, **NEEDS CLOUD REVIEW**) | Trusted, holds the real data | Issues signed URLs, validates writes, enforces D-017's shareCode-vs-custom-media rule server-side | Secrets shipped to any `VITE_`-prefixed variable (`CLAUDE.md` non-negotiable #5) |
| Teacher browser (future, **PROPOSED**, X-002) | Authenticated once X-002 lands | List/share/report on own activities (`TEACHER-DASHBOARD-WIREFRAME.md`) | Other teachers' activities without an explicit sharing model (open question there, §7 item 5) |
| Unity Teacher Studio (desktop, Codex-owned) | Trusted, authors content | Creates/edits/publishes `ActivityVersion`s | Nothing web-side — it is out of this repo's reach entirely |

**The load-bearing line:** everything left of "Web app server" in the table
is client-side and must be assumed readable by whoever holds the device. This
is not a defect to fix — it is why D-020 classifies session results as
practice data rather than assessment, and why D-016/D-017 make custom media
private-by-default rather than trusting the client to withhold it.

---

## 2. Identifiers and correlation — one map, not eight separate ones

Confusing these is the single most likely integration bug, because several of
them are deliberately similar-shaped opaque strings. This table is the
disambiguation.

| Identifier | Minted by | Lifetime | Purpose | Schema |
| --- | --- | --- | --- | --- |
| `ActivityId` | Unity today, per a code comment (`ids.ts:4-7`) — **not settled by any decision.** `DECISIONS.md`'s own deferred table lists **X-010, "who mints activity IDs,"** as an open joint-agreement item with Codex | Permanent | Names the activity itself, across all its versions | `ids.ts:17,38` |
| `ActivityVersionId` | Unity, on publish | Permanent, one per published snapshot | Pins exactly what a session is playing (`activity.ts:58-67`) | `ids.ts:18,39` |
| `ShareCode` | **PROPOSED** — nothing mints one yet (§2 gap table in `TEACHER-DASHBOARD-WIREFRAME.md`) | Revocable, independent of the activity | Human-typable, killable distribution handle — distinct from `ActivityId` on purpose (`share.ts:19-30`) | `share.ts:31-43` |
| `SessionId` | Web backend / mock, on `POST /sessions` | One per play attempt that reached session-start | The canonical session Unity correlates its events against | `ids.ts:20,41` |
| `clientAttemptId` | Web, client-side, before Unity even boots (`useClientAttemptId.ts:22-39`) | Survives a reload (stored under `sal0mander.session.startKey.{versionId}` in `sessionStorage`); ends via `renewAttempt` | The stable identity of *one play attempt* — exists before a session does, which is what makes Student Choice's boot-before-session-exists case correlatable at all | `bridge.ts:42-63` (`BridgeCorrelation`) |
| `correlationId` | Same value space as `clientAttemptId` | **Deprecated** — kept only so an older-compiled Unity build stays compatible (`bridge.ts:54-55`) | Superseded name for the same concept | `bridge.ts` |
| `eventId` | Whoever emits a bridge message | Per-message | Bridge-level dedupe, so a redelivered `session-finished` cannot submit a result twice (`eventDedupe.ts`, `bridge.ts:424`) | `bridge.ts:61` |
| `idempotencyKey` | Web, **derived**, not random (`idempotency.ts:1-13`) | One per logical write (start, result) | Server-side dedupe for a retried write — see §7 for why "derived, not random" is the entire point | `transport.ts` |
| `guestToken` | Web, client-side, `localStorage` | Survives across visits on one device | Device-local, non-PII correlation hint (D-005); never authentication | `guestIdentity.ts:37-43` |
| `MediaId` + `checksum` | Web/backend, on upload; checksum is content-derived | Permanent, immutable per asset+checksum pair | Cache/version identity for a delivered asset — the CDN URL is transport and may rotate, the id+checksum pair is not (`share.ts:70-76`) | `share.ts:64-88`, `media.ts:16-29` |

**Why `clientAttemptId` and `SessionId` are not interchangeable, stated once
here rather than scattered:** an attempt exists from the moment a student
opens the link; a session exists only once `POST /sessions` succeeds. Every
correlation guard in `GuestPlayPage.tsx` and `bridge.ts`'s `correlateAttempt`
keys on whichever of the two is actually available at that point in the
handshake — `mode-selected` only requires the attempt to match (no session
exists yet), while `session-finished` requires the session to match too
(`GuestPlayPage.tsx:262`, `requireSession: true`, checked at `bridge.ts:493,503`). Treating them as
interchangeable would either let a superseded boot's `mode-selected` leak
through (attempt matched, but there's no session to check) or block a
legitimate `mode-selected` that hasn't reached `session-finished` yet.

---

## 3. End-to-end sequence — happy path, all nine flows in one diagram

```
Teacher              Web (browser)         Unity WebGL         Web backend        Unity
(flow 1)                                   (flow 5-6)          (mock today)       Teacher Studio
  │                                                                                    │
  │  author + publish activity ────────────────────────────────────────────────────▶  │  (Unity-owned,
  │                                                                                    │   out of scope)
  │  mint share link (PROPOSED,               ActivityVersion published ◀──────────────┘
  │   TEACHER-DASHBOARD §4) ──────────────────▶ [not built — flow 1]
  │
  │  hand link/QR to student (flow 2, SharePanel — IMPLEMENTED for display,
  │                            mint/revoke PROPOSED)
  │
Student
  │  opens /play/:activityId ──▶ GET /guest/activities/{id}
  │                              or GET /v1/play/{shareCode}     (flow 3, IMPLEMENTED)
  │                                        │
  │                              GuestActivityBundle / PlayBundle resolves,
  │                              pins activityVersionId + playMode data  (flow 4, IMPLEMENTED)
  │                                        │
  │                              clientAttemptId minted (useClientAttemptId,
  │                              survives reload)                        (flow 4/7, IMPLEMENTED)
  │                                        │
  │                    ┌───────────────────┴────────────────────┐
  │                    ▼ (WebGL host loads, independent race)     ▼ (activity fetch)
  │              script/createUnityInstance                  bundle ready
  │                    │                                          │
  │              Unity "ready" (handshake) ─────────────────────▶ │
  │                    │                                          │
  │              boot{activityId, activityVersionId,               │
  │                    playBundle, clientAttemptId,                │
  │                    selectedPlayMode?} ◀────────────────────────┘  (flow 5, IMPLEMENTED
  │                    │                                                against a STUB —
  │                    │                                                NEEDS UNITY REVIEW)
  │           [Student Choice only] mode-selected ───────────────▶ web pins chosenMode
  │                    │                                          │
  │                    │                            POST /sessions{...,
  │                    │                              clientAttemptId, selectedPlayMode},
  │                    │                              idempotencyKey = startKey  (flow 4/7)
  │                    │                                          │
  │                    │◀───────────────── session-started{sessionId, ...}
  │                    │                                          │
  │            [gameplay — fully Unity-owned, web sees            │
  │             only coarse lifecycle]              (flow 6, IMPLEMENTED
  │                    │                              by construction — D-004)
  │                    │                                          │
  │              session-finished{durationMs, questionsAnswered,   │
  │                questionsCorrect, piecesPlaced, piecesTotal}    │
  │                    │─────────────────────────────────────────▶│
  │                    │                            correlateAttempt (requireSession)
  │                    │                            isUsableFinishedPayload
  │                    │                                          │
  │                    │                            POST /sessions/{id}/result
  │                    │                              idempotencyKey = resultKeyFor(id)
  │                    │                                          │  (flow 7, IMPLEMENTED,
  │                    │◀───────────────────── PlaySession{completed}   mutation-verified)
  │                    │
  │            [local save — Unity-owned checkpoints, e.g. piece
  │             released/snapped/mode change/exit — relayed from
  │             BLUEPRINT.md, NOT verified from web]  (flow 8, NEEDS UNITY REVIEW)
```

Every box left of "Web backend" in this diagram is **IMPLEMENTED** and
exercised by the existing Vitest suite against the mock transport. Every box
inside Unity WebGL is drawn from `bridge.ts`'s type definitions, which are a
**stub never exercised against a real Unity build** — restated from
`STATUS.md`: "Unity receiver behavior is still not proven by a real build."
Flow 1 (teacher publish/share) is entirely **PROPOSED**.

---

## 4. Flow-by-flow detail

### Flow 1 — Teacher share/publish, without duplicating Teacher Studio

**PROPOSED.** Fully covered in `TEACHER-DASHBOARD-WIREFRAME.md` §3-§4. The
web's only role is post-authoring: turn an already-published
`ActivityVersion` into a `ShareCode`, never edit the version itself. No
endpoint exists for any part of this today (§2 of that document).

### Flow 2 — Stable share link and QR distribution

**IMPLEMENTED for display, PROPOSED for creation.** `buildShareLink()`
(`config/routes.ts:30-33`) and `SharePanel`/`ShareQr` render and copy a link
that already resolves (§4.2's reuse of the same component teachers would
use). What's proposed, not implemented: minting and revoking the code itself
— see `TEACHER-DASHBOARD-WIREFRAME.md` §4.1's gap analysis. `ShareCode`'s
alphabet (Crockford base32, no `I`/`L`/`O`/`U`) is already chosen
specifically for this distribution path — "worksheet, TPT, QR" per
`share.ts:26-29` — so nothing here is invented; the shape is fixed, the
lifecycle operations are not.

### Flow 3 — Account-free Guest Play resolution

**IMPLEMENTED.** Two resolution paths exist side by side and both work
today: `activitiesApi.getGuestBundle(activityId)` (`GET
/guest/activities/{id}`) and `playApi.resolve(shareCode)` (`GET
/v1/play/{shareCode}`) — the latter per P-002's still-Proposed shareCode
split, run alongside the former rather than replacing it (`share.ts:6-16`).
Zero account/email/password/name prompts on this path — structurally true,
not merely intended, per the existing "no sign-in prompt" test
(`ARCHITECTURE.md` §2.2, restated in `INFORMATION-ARCHITECTURE.md` §3.1).

### Flow 4 — ActivityVersion/media resolution and selected play mode

**IMPLEMENTED**, with one **NEEDS UNITY REVIEW** inside it. `PlayBundle`
(`share.ts:125-163`) cross-validates at the boundary — a Learning activity
must carry at least `pieceCount` questions, every `linkedPieceIndex` must fit
inside `pieceCount` — so a malformed bundle fails at the API boundary rather
than stranding a student mid-puzzle. `PuzzleAssetSchema` carries
`assetId + checksum` as identity and `downloadUrl` as pure transport
(`share.ts:70-88`). Note: `share.ts:74`'s own comment attributes this
"signed URL is transport, not identity" framing to D-007, but D-007
(`DECISIONS.md:76-82`) is actually about idempotency keys on writes and says
nothing about signed URLs — a pre-existing wrong citation in the code comment,
propagated here rather than introduced by this doc. The correct D-007
citation is the idempotency-conflict behavior at §7 (Flow 9) below.

The play-mode question — one allowed mode vs. Student Choice — is derived,
never a stored third value (`isStudentChoice()`, `share.ts:165-168`). For a
single allowed mode the web sends `selectedPlayMode` at boot; for Student
Choice the web deliberately sends nothing and waits for Unity's
`mode-selected` (`GuestPlayPage.tsx:102-109`, `:138-163`) — **because Unity
owns the picker UI**, not the web. **NEEDS UNITY REVIEW:** nothing on the web
side has verified that a real Unity build actually renders a mode picker and
emits `mode-selected` in the shape `bridge.ts` expects; this is drawn from
the bridge's own type definitions, not from observed behavior.

**UNRESOLVED:** nothing in this repo verifies `PuzzleAsset.checksum` against
the bytes actually downloaded. It is plausible this validation belongs
entirely to Unity (which is what fetches and decodes the asset), but that is
inferred, not confirmed — a question for Codex in §8.

### Flow 5 — Unity WebGL loader and exactly-once bridge handoff

**IMPLEMENTED against a stub; NEEDS UNITY REVIEW for interop.**
`UnityStage.tsx` is the loader: `unconfigured → loading → ready → error`,
independent of activity-resolution state (`GUEST-PLAY-WIREFRAME.md` §3.5).
"Exactly once" is enforced on both ends of the boot handoff:

- `bootedRef` ensures `boot` is sent exactly once per Unity instance
  (`UnityStage.tsx:120-133`) — a second `boot` would ask a running game to
  reload an activity the student is already playing.
- `sentSessionRef` ensures `session-started` is sent exactly once per session
  id (`UnityStage.tsx:144-157`), ordered explicitly *after* boot rather than
  relying on it happening later by construction — a session id reaching a
  build that never received its activity would name a session for a game
  that was never started.
- The `handshakes` counter (`UnityStage.tsx:105-111`) exists because the
  WebGL loader promise resolving and Unity's own bridge receiver existing are
  two different facts — `SendMessage` throws if the target GameObject isn't
  there yet, and a first boot can fail for a reason that resolves a moment
  later with nothing in `boot`'s own dependencies ever changing again. Recount
  on each `ready`/`unity-ready` re-fires the send effects; the refs are what
  keep the sends themselves to exactly one each.

**Confirmed by `bridge.ts`'s own comments, not by observation:** *"no Unity C#
receiver exists yet, and Codex reports the legacy `.jslib` uses incompatible
DOM event names and shapes"* (`bridge.ts:168-169`). Everything above is
correct against the bridge's own type contract and has never been run against
a real build — the single largest gap in this entire blueprint, restated
because it is the fact every other IMPLEMENTED tag in this document is
implicitly qualified by.

### Flow 6 — Unity-owned gameplay, coarse web lifecycle only

**IMPLEMENTED by construction**, and structurally guaranteed rather than
merely followed as convention: `ActivityPayload` (`activity.ts:26-31`) is
`{ schemaVersion: number, body: unknown }` — the web literally cannot parse
gameplay content, so it cannot fork the rules (D-004). The web's visibility
into "gameplay in progress" is exactly nothing beyond what already rendered
before play started (`GUEST-PLAY-WIREFRAME.md` §2.4) — no progress bar, no
per-move state, nothing. `load-progress`/`progress-updated` exists in the
bridge type (`bridge.ts:113-116`) but is scoped to the *WebGL download*, not
to gameplay progress within an activity — worth stating because the name
alone could be misread as the latter.

### Flow 7 — Result submission with correlation and idempotency

**IMPLEMENTED, mutation-verified** (per `STATUS.md`'s W-10 through W-16
chain). Two independent guards run before a `session-finished` event is ever
trusted:

1. **Correlation** (`correlateAttempt`, `bridge.ts:480-520`) — fails closed.
   A missing attempt id, a stale attempt, or (for `session-finished`
   specifically) a missing/mismatched session all reject the event rather
   than guessing. `requireSession: true` is set only for `session-finished`
   (`GuestPlayPage.tsx:262-263`) because a completion is a write against one
   specific session — "right attempt, unstated session" is not good enough,
   unlike `mode-selected`, where no session exists yet by construction.
2. **Structural validity** (`isUsableFinishedPayload`, `bridge.ts:530-541`) —
   a known message type can still carry a missing/non-finite metric; without
   this a missing `piecesTotal` would reach `submitResult` as `undefined` and
   be recorded as a real result.

Idempotency is **derived, never random** (`idempotency.ts:1-13`) — the
concrete failure this defends against is specific and already documented:
wifi stalls mid-submit, the student reloads, a *random* key would make the
retry a distinct write and double-count the completion. `startKeyFor` and
`resultKeyFor` both survive exactly that sequence. The mock transport
enforces the other half of D-007 as a first-class behavior, not an
afterthought: replaying an idempotency key with a **different** request body
throws `conflict` rather than silently returning the first response
(`mockTransport.ts:167-178`) — this is what stands in for the "same
idempotency key with a different request body must be rejected" reconciled
direction named in this repo's own work-loop instructions.

The full silent-loss chain this flow closes (buffering a completion that
arrives before its session exists, surfacing a submit failure instead of
discarding it, and surviving a reload) is `STATUS.md`'s W-10 through W-16 —
not re-derived here, only cited, since re-explaining already-recorded,
independently-reviewed work would drift from it.

### Flow 8 — Local save slots vs. optional future cloud saves

**NEEDS UNITY REVIEW for the local half; PROPOSED and blocked on X-002 for
the cloud half.** The web repo implements neither. What's on record,
relayed from Unity's own `BLUEPRINT.md` (`/Users/samuel_saldivar/
SAL0MANDER-Puzzle-Prototype/docs/BLUEPRINT.md`, "Autosave and Resume"):
*"Save meaningful checkpoints only, such as: question answered, piece
released, piece snapped, mode change, exit, completion... Guest Play should
preserve lightweight local progress when technically possible."* This is
squarely inside Unity's ownership (`CHARTER-WEB-POINT-PERSON.md`: "answer →
unlock → drag → rotate → snap gameplay" is Unity's), and this document
records it only so the seam is visible, not to design it.

**The web-visible half is already scoped narrowly, by design:**
`resultHold.ts`'s `sessionStorage` record (W-16) holds exactly one
*completed-but-undelivered* result — it is not a mid-game save, has no
concept of partial progress, and is explicitly not what Unity's own
checkpoint autosave describes. Conflating the two would be a real design
error: `resultHold` exists to survive a reload *after* the game already
ended; Unity's autosave is meant to resume a game that's still in progress.
Nothing in this repo today lets a student close the tab mid-puzzle and
resume where they left off — that capability, if it exists at all, lives
entirely in Unity's own local storage (likely `PlayerPrefs` or
`IndexedDB`-backed, unverified from here) and the web has no visibility into
it.

**Cloud saves and account-linked history** are explicitly Batch 5 in
`ROADMAP.md`, blocked on X-002, and D-005 already specifies the mechanism a
guest→profile claim would use (a device-local `guestToken`, meant to be
claimable, never treated as identity itself).

### Flow 9 — Failure matrix

See §5 below — pulled into its own section since it is dense enough to need
one.

---

## 5. Failure matrix

| Failure | Where it's caught | Recoverable? | Status |
| --- | --- | --- | --- |
| Activity resolve — loading | `useGuestActivity` `status: 'loading'` | N/A | IMPLEMENTED |
| Activity resolve — invalid/mistyped | `not_found`, no `serverCode` match | No retry — retrying the same bad URL cannot resolve it. Navigation recovery links point back to Guest Play and home. | IMPLEMENTED |
| Activity resolve — revoked | `serverCode: SHARE_LINK_REVOKED` | No retry — retrying a revoked link cannot succeed (`linkState.ts:60-62`). Navigation recovery links point back to Guest Play and home. | IMPLEMENTED |
| Activity resolve — unpublished | `serverCode: ACTIVITY_UNPUBLISHED` | No retry. Navigation recovery links point back to Guest Play and home. | IMPLEMENTED |
| Activity resolve — offline/transient | `error.retryable` from the transport | Yes — `[Try again]` re-invokes the fetch | IMPLEMENTED |
| Session start — offline/server error | Buffered if a `session-finished` already raced ahead of it; otherwise surfaces as `result-undeliverable` with `retryable: false` (no session exists to resend against) | Partial — see `canRetry` gating | IMPLEMENTED (W-12/W-13) |
| Session start — duplicate submit (retried write) | `idempotencyKey = startKeyFor(...)`, same key replays the same response | Yes, by construction — same key ⇒ same session | IMPLEMENTED |
| Session start — idempotency key reused with a *different* body | Mock throws `conflict` (409) rather than silently replaying (`mockTransport.ts:167-178`) | No — this is the bug-detection path, not a retry path | IMPLEMENTED in the mock; **NEEDS CLOUD REVIEW** for whether a real backend enforces the same |
| Result submit — network/server failure | Held via `resultHold.ts`, surfaced as `result-undeliverable`, retryable | Yes — `[Try saving again]`, survives reload (W-16) | IMPLEMENTED, mutation-verified |
| Result submit — reload before delivery | `resultHold.ts` rehydrates on the session-start effect's first live run | Yes | IMPLEMENTED (W-16) |
| Version/checksum mismatch on the delivered asset | Nothing in this repo | — | **UNRESOLVED** — flagged in Flow 4 above |
| Bridge — malformed message | `onMismatch` reports `{reason: 'malformed'}`; dropped | N/A — not actionable by a student | IMPLEMENTED |
| Bridge — version skew (`contractVersion` mismatch) | `{reason: 'version', received, expected}` | N/A — this is a deploy-skew signal for an operator, not a student-facing error | IMPLEMENTED |
| Bridge — unknown message type | `{reason: 'unknown-type'}`, ignored (forward-compat) | N/A | IMPLEMENTED |
| Bridge — wrong-direction message (e.g. `session-started` arriving inbound) | `{reason: 'wrong-direction'}`, rejected per Codex ruling | N/A | IMPLEMENTED |
| Bridge — duplicate `session-finished` (redelivery) | `eventId` dedupe (`eventDedupe.ts`), silent | N/A — a duplicate is not a fault | IMPLEMENTED |
| Bridge — send fails (`SendMessage` throws, e.g. `SAL0MANderBridge` GameObject absent) | `sendToUnity` catches, logs loud in dev / silent in prod, gameplay continues | Boot: yes, retried on next `ready` handshake. `session-started`: same. | IMPLEMENTED; **the actual trigger condition (no receiver) is today's real state — NEEDS UNITY REVIEW to close** |
| Unity WebGL — download failure (network/404) | `describeLoadFailure` pattern-matches network/memory/generic, `[Try again]` bumps `retryToken` | Yes — full teardown-then-reload, verified not to duplicate an instance | IMPLEMENTED |
| Unity WebGL — out of memory | Same path, memory-specific copy | Partial — "close other tabs and try again" is the only mitigation offered | IMPLEMENTED |
| Unity build entirely unconfigured (`VITE_UNITY_BUILD_BASE_URL` empty) | Explicit placeholder, not an error state | N/A — this is the default dev/foundation state, not a failure | IMPLEMENTED |
| Custom-media activity given a share link | **PROPOSED** state in `TEACHER-DASHBOARD-WIREFRAME.md` §4.3 | N/A — must never be possible per D-017 | **UNRESOLVED** — no server-side enforcement exists to audit, because no such endpoint exists yet |

---

## 6. Privacy notes — cross-referencing decisions already on record

Nothing new is decided here; this is where each already-recorded constraint
lands on the end-to-end flow, so a reviewer sees it in context rather than
having to cross-reference eight documents themselves.

- **Guest identity carries no PII and is never authentication** (D-005) — the
  only identity flowing through flows 3-7 for an unauthenticated student.
- **Session results are advisory, not assessment** (D-020) — constrains
  Flow 7's data and any future reporting surface built on it
  (`TEACHER-DASHBOARD-WIREFRAME.md` §5).
- **Custom media is private by default; a shareCode must never reach an
  activity referencing it** (D-016/D-017) — a hard constraint on Flow 1/2
  this document cannot verify is enforced, because the minting endpoint that
  would need to enforce it does not exist (§5's last row).
- **The answer key ships to the browser** (the standing W-1 finding,
  `STATUS.md`) — Flow 4's `PlayBundle.quiz.questions[].choices[].isCorrect`
  is readable in DevTools by construction of an unauthenticated, client-
  validated activity. Named again here because Flow 7's `questionsCorrect` is
  directly downstream of this fact, not a separate concern.
- **`sessionStorage`, not `localStorage`, for anything attempt-scoped**
  (`idempotency.ts`, `resultHold.ts`) — a new tab must never inherit a
  stranger's in-progress attempt or held result on a shared classroom device;
  `guestToken` is the sole deliberate exception, because a *device-level*
  guest identity is meant to survive a reload (`INFORMATION-ARCHITECTURE.md`
  §3.4).
- **Bridge messages carry no secrets and are not authentication** — restated
  because Flow 5/6's `boot` payload includes the full `playBundle`, which
  under D-016 may include a private-bucket signed URL. Signed URLs are
  transport by design (D-007) and expire; nothing here changes that, but a
  bridge-mismatch diagnostic must never log the raw payload — already
  enforced by `summarizeBridgeMismatch()` (`bridge.ts:339-355`), which strips
  the payload from anything a mismatch report surfaces.

---

## 7. Phased integration plan — reversible, independently reviewable batches

Mirrors `ROADMAP.md`'s existing batch structure; this section adds nothing
that isn't already there, it only maps each roadmap batch onto which of the
nine flows above it advances.

| Batch | Flows advanced | Blocked on |
| --- | --- | --- |
| **Roadmap Batch 2** (share-link lifecycle, already recommended next) | 2 (creation half), 3, 7 | Nothing — mock-transport-only |
| **Roadmap Batch 3** (Unity WebGL host hardening) | 5, 6, part of 8 | X-009 (bridge message set, joint with Codex) **and** a real Unity WebGL build existing at all |
| **Roadmap Batch 4** (backend integration) | 1, 2, 4 (real checksums/signed URLs), 7 (real backend idempotency enforcement) | X-001/X-003 |
| **Roadmap Batch 5** (accounts and profiles) | 8 (cloud half), teacher auth for Flow 1 | X-002, X-005 |

**The one integration step this document recommends as the highest-leverage
next real-world test, restated from `STATUS.md`'s own standing
recommendation:** one round trip against an actual Unity build — `unity-ready
→ boot → mode-selected → session-started → session-finished` — would validate
the event names, the receiver target, the JSON shape, and `eventId` dedupe
simultaneously. Every "NEEDS UNITY REVIEW" tag in §4/§5 collapses into either
a confirmed pass or a concrete named defect the moment that trip runs once.

---

## 8. Questions for Codex

1. **Flow 4/5 — does a real Unity build exist yet to run the round-trip
   named in §7, and if so, where is it hosted for a smoke test?**
2. **Flow 4 — does Unity or the web verify `PuzzleAsset.checksum` against
   downloaded bytes, or is this unverified on both sides today?**
3. **Flow 5 — is `UNITY_BRIDGE_TARGET` (`gameObject: 'SAL0MANderBridge'`,
   `method: 'ReceiveWebMessage'`) still the agreed receiver target, or has
   Teacher Studio work since moved it?**
4. **Flow 8 — what mechanism does Unity's local autosave actually use
   (`PlayerPrefs`, `IndexedDB` via WebGL, something else), and does it
   survive a full page reload the way `resultHold.ts` does, or only a
   same-session pause/resume?** This matters because a mismatch between "the
   web thinks the result is held for retry" and "Unity thinks the whole game
   state is gone" would confuse a student differently than either failure
   alone.
5. **Flow 1/`TEACHER-DASHBOARD-WIREFRAME.md` §6 — does Teacher Studio expose
   any URL scheme a web "Edit in Teacher Studio" link could target?**
6. **§2's identifier table — `ActivityId` minting is X-010, still open per
   `DECISIONS.md`'s deferred table, not settled by any decision (an earlier
   draft of this doc cited D-004, which is unrelated). Is client-minted still
   the working assumption, or has this been discussed and just not
   recorded?**

## 9. Questions for Gemini

1. **§1's trust boundary table — is there a client-side attack beyond the
   already-named "DevTools reads the answer key" (W-1/D-020) that this
   blueprint's boundary table misses?**
2. **§5's bridge failure rows — `sendToUnity` is loud in dev, silent in
   prod (`bridge.ts:234-241`). Is silent-in-production the right call for a
   security/observability posture, or does a production deploy need its own
   (non-console) diagnostic channel before Batch 3 ships?**
3. **§6 — the `boot` payload carries the full `playBundle`, which can include
   a signed URL to a private-bucket asset. Once Batch 4 wires a real backend,
   should that signed URL have a shorter expiry specifically because it now
   transits a bridge message that could be captured by anything else with
   access to the page (a browser extension, a compromised script), or is the
   existing signed-URL expiry model (D-016/§ASSET_PIPELINE) already
   sufficient?**

---

## 10. What this document does not claim

No flow above has been exercised against a real Unity WebGL build. No backend
exists to test Batch 4's assumptions against real network conditions, real
concurrent load, or a real idempotency implementation outside the mock's
in-memory `Map`. `npm run verify` (lint, typecheck, the existing test suite,
build) passes with this document added, because it is a docs-only change —
that is evidence the repository is still healthy, not evidence any flow
above works end to end against production infrastructure that does not yet
exist.

**Also not modeled anywhere in this document, and worth naming rather than
leaving implicit:** none of the nine flows above are analyzed at 30 (one
classroom), 1,000 (one school), or 10,000+ (district) concurrent sessions.
That is defensible pre-backend — there is nothing to load-test — but it means
"the web half is specified and tested" should not be read as "the web half is
sized." The mock's in-memory `Map` gives zero signal here either way. Worth a
design question once a real backend topology is chosen, not a blocker now.
