# Decision Log

Append-only. Each entry records what was decided, why, and what it costs.
Decisions marked **DEFERRED** are explicitly *not* made and require approval.

---

## D-001 — Vite + React + TypeScript

**Decided** · 2026-08-15

Workspace was empty, so the charter's default applies. Vite 8 / React 19 /
TypeScript 6. Vite's dev server and build are fast, its static output deploys to
any CDN or static host (keeping the hosting decision open), and it handles the
large-asset serving that a Unity WebGL build will eventually need.

Trade-off: static SPA output means no SSR. Acceptable — the highest-traffic
route is Guest Play, which boots a WebGL game and gains nothing from SSR. If SEO
on public activity pages later matters, prerendering can be added without
changing the app.

## D-002 — CSS Modules over semantic design tokens; no CSS framework

**Decided** · 2026-08-15

A framework (Tailwind, MUI, Chakra) would embed someone else's visual opinion
before SAL0MANder's identity exists, and Product/Gameplay Discovery has not run.
CSS custom properties in `design/tokens.css` with a strict rule that components
consume semantic tokens only means a rebrand touches one file.

Trade-off: more hand-written CSS than a utility framework. Accepted, because the
alternative pre-commits a design language the product owner has not approved.

## D-003 — Zod schemas as the shared contract's source of truth

**Decided** · 2026-08-15

Every contract type is `z.infer` of a schema. Responses are parsed at the
transport boundary, so a backend change produces a `contract_mismatch` error
rather than corrupted UI state. Schemas are transport-agnostic and could be
extracted to a shared package or used to generate C# DTOs for Unity.

Cost: ~14 kB gzipped of runtime validation. Worth it across a boundary two
independently-developed applications must agree on.

## D-004 — The Unity activity payload is opaque to the web platform

**Decided** · 2026-08-15

`ActivityPayload` is `{ schemaVersion: number, body: unknown }`. The web app
stores, versions, and returns it without interpreting it.

This makes "do not duplicate Unity gameplay" a structural property rather than a
convention: the web app *cannot* read puzzle rules, so it cannot fork them. It
also lets Unity iterate on its own format without an API release.

## D-005 — Guest identity is device-local and is not authentication

**Decided** · 2026-08-15

A random token in `localStorage`, no PII, never sent as a bearer token, minted
lazily on first play. It exists only to resume a session on the same device and
to allow a later profile to *claim* prior guest sessions.

Any future backend must treat it as a correlation hint, never as identity.
This keeps Guest Play a genuine no-account path rather than a hidden account.

## D-006 — Companion collapse is CSS-only; the stage never unmounts

**Decided** · 2026-08-15

`CompanionLayout` toggles grid columns. The stage subtree is never conditionally
rendered. Collapsing the 42% panel therefore cannot tear down a running Unity
instance and restart a student's game. Asserted by a test on DOM node identity.

## D-007 — Idempotency keys on every write

**Decided** · 2026-08-15

Session start and result submission both carry a client-generated key, and the
transport only retries writes that have one. Classroom networks drop requests;
without this a retried completion is counted twice.

## D-008 — Cursor pagination, not offset

**Decided** · 2026-08-15

Baked into `PageSchema` before any list endpoint exists, because retrofitting
pagination style across a shipped contract is a breaking change.

## D-009 — Mock transport as the default backend

**Decided** · 2026-08-15

With `VITE_API_BASE_URL` empty the app runs against an in-memory transport that
speaks the real contract and validates against the real schemas. This lets the
whole app — loading states, error states, not-found paths — be built and tested
before a backend provider is chosen, and it keeps `npm run dev` working with
zero setup.

## D-010 — No Unity WebGL build in this repository

**Decided** · 2026-08-15

`public/unity/` is gitignored. WebGL builds are large binaries that belong on a
CDN, and committing them would make the repo unusable within a few iterations.
`VITE_UNITY_BUILD_BASE_URL` points at wherever a build lives.

## D-011 — No COOP/COEP dev headers while Unity WebGL threads are off

**Decided** · 2026-08-15

The dev server previously sent `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: credentialless`. Both removed.

Cross-origin isolation is only *required* for `SharedArrayBuffer`, i.e. a Unity
WebGL build with threads enabled. Threads are off, so the headers bought
nothing — while COEP actively broke the loading path we do use: a build served
from `VITE_UNITY_BUILD_BASE_URL` (a CDN) and any cross-origin thumbnail are
blocked unless every one of those responses carries
`Cross-Origin-Resource-Policy`, which a third-party CDN will not set on our
say-so. The net effect was dev failing in a way production would not.

Cost: the day Unity ships a threaded build, both headers must come back *and*
the asset origin must serve CORP. Recorded here so that is a lookup, not a
rediscovery.

## D-012 — Bridge drops are observable, and correlation fields are optional

**Decided** · 2026-08-15 · **Bridge message set itself remains X-009**

Two additive changes to `src/unity/bridge.ts`, which has no consumers yet:

`onUnityMessage` takes an optional `onMismatch` callback. Dropping unusable
messages is still the behavior; the callback only makes it visible. A silent
drop is indistinguishable from "Unity never sent anything", so a build compiled
against bridge v2 talking to a web deploy on v1 presents exactly like a dead
game. Omitting the callback preserves the previous behavior exactly.

Optional `sessionId` / `correlationId` on `boot`, `session-finished`, and
`error`, plus `correlateSession()`. "The game finished" is not enough to write a
result safely: a student who restarts mid-lesson produces two indistinguishable
finish events, and the second result can be written against the first session.
`correlateSession` is deliberately three-valued — `uncorrelated` is what a build
predating these fields sends, and the caller decides whether to trust it rather
than having it collapsed into a match (mis-attribution) or a mismatch (dropping
every legacy result).

Both fields are optional in every direction, so a Unity build that ignores them
stays fully compatible. **Proposed, not agreed** — returned to Codex for
reconciliation. Also tightened: a correctly-versioned message with an
unrecognized `type` is now ignored and reported, matching this module's stated
"unrecognized messages are ignored" rule, which the code did not previously
honor.

## D-013 — Google Cloud is the accepted persistent infrastructure

**Decided** · relayed via Codex, 2026-08-15 · **supersedes X-001 in part**

Google Cloud is settled as the persistent infrastructure. X-001 as originally
written ("Backend / hosting provider — architecture fork") is **stale**: the
fork is no longer open.

Still open, and still requiring approval before implementation: the exact
services, the auth model, the privacy posture, the CDN, and operations. Nothing
in this repo is wired to a provider — `Transport` and `MediaStorage` remain the
only seams, which is what keeps the remaining choices cheap.

## D-014 — Environment parsing recovers per field, never wholesale

**Decided** · 2026-08-15

`readEnv` previously parsed `import.meta.env` atomically and, on any failure,
fell back to `EnvSchema.parse({})` — resetting *every* field to its default.
Because each field is optional-with-a-default, a single unrecognized value
anywhere (e.g. `VITE_FEATURE_GUEST_PLAY=yes`) emptied `VITE_API_BASE_URL`,
flipped `api.isConfigured` to false, and silently ran the app against the
in-memory mock transport. In production that is total, invisible data loss:
every student's work written to a `Map` that dies with the tab.

Each field now falls back independently to its own declared default. A strict
parse still runs alongside, purely to log which keys were rejected, so the
diagnostic is not lost to the recovery. `readEnv(source)` was extracted as a
pure function because `import.meta.env` is a build-time constant that cannot be
varied from a test; the failure above was unprovable before that.

## D-015 — AI candidate generation lives in the web teacher portal

**Decided** · relayed via Codex, 2026-08-15 · **answers Topic 6 of the web review**

Near-term AI candidate generation and approval belong to the **web teacher
portal**, running through the provider-neutral backend API. Unity receives
**approved/promoted assets only**. AI authoring is explicitly *not* added to
Unity's Teacher Studio.

Scope limit: **no broad generation UX during P0.** This settles ownership so the
question stops blocking, not so implementation starts. The usability deltas
raised in the review — generation as a polled job rather than a long request,
candidates held outside the append-only version sequence until accepted, and a
typed error vocabulary — become web-side design work when P1 opens, and are
recorded in `docs/coordination/WEB-CONTRACT-REVIEW.md` §6.

Consequence worth stating now: this puts a generation provider on the web's
critical path, which is a live architecture question (see D-013 — Google Cloud
is settled as infrastructure, but services and auth are not). Nothing is built
toward it yet.

## D-016 — All uploaded photos are private; AI-generated assets may be public

**Decided** · Samuel (owner), 2026-08-15 · *"all photos that are uploaded should be private
although i will have a disclaimer"*

Confirms the provenance split proposed in `GEMINI-CHALLENGE.md` §C, and makes
private the **default** rather than a district-tier upgrade:

| Origin | Delivery |
| --- | --- |
| AI-generated (Imagen output) | Public immutable CDN — no PII by construction |
| Teacher / user uploads | Private bucket, signed URLs, version-pinned |

**Consequence that reorders the plan:** Gemini scheduled the version-pinned
`asset-refresh` endpoint as *NEXT (strict tenant/private schools)*. Private is
now the default for every upload, so refresh moves to **NOW** — the mid-play URL
expiry problem is on the critical path for any activity built from a photo, not
an edge case. Public immutable CDN URLs solve expiry only for AI assets.

**What this decision does NOT settle** — see D-017.

## D-017 — OPEN: "private storage" is not "private from students"

**Raised** · 2026-08-15 · **needs an owner answer before uploads ship**

D-016 makes uploaded photos private *at rest*. It does not answer who may see
them at play time, and the two are easy to conflate.

Guest Play is auth-free by non-negotiable #3. So a teacher who uploads a class
photo and shares the link has made that photo visible to **anyone holding the
link** — signed URLs do not change this, because the signed URL is handed to
whoever opens the activity. Share links get pasted into Google Classroom, listed
on TPT, and printed on worksheets. Combined with a deliberately short,
human-friendly `shareCode`, the chain is: *a photograph of identifiable children
behind a guessable URL, reachable with no account.*

**RESOLVED by owner, 2026-08-15:** *"don't make it a link unless photo is
premade."* Custom media is **never link-shareable**. A shareCode is minted only
for activities whose media is entirely premade/AI-generated; an activity
containing custom-uploaded media is reachable through class/roster access only.

This severs the risk chain rather than mitigating it — a photo of identifiable
children never sits behind an anonymous URL, so shareCode entropy stops
mattering for that case. **Enforceable invariant for the backend: refuse to mint
a shareCode for any activity referencing custom-uploaded media.** Client-side
checks are not sufficient.

Superseded options, kept for the record:

1. **Point-of-upload disclosure.** Still wanted, but as user-facing honesty
   rather than as the control: at upload, in plain words, who will be able to
   see this.
2. **Higher-entropy shareCode for activities containing uploads.** Moot — those
   activities get no shareCode at all.
3. **Require class-level access for upload-backed activities** — this is what
   was chosen. It was the strongest option, and
   it collides with frictionless Guest Play, so it is a product tradeoff rather
   than an engineering one.

**Separately: a disclaimer does not transfer COPPA/FERPA obligations.** A
teacher accepting terms is not parental consent, and this needs actual legal
review before launch rather than an agent's judgement. Flagging, not advising.

**And: deletion conflicts with immutable versions.** `ActivityVersion` is
append-only and immutable so a mid-lesson publish cannot change what 200
students are already playing (D-004 rationale). If a parent objects to a photo,
we cannot mutate the version to remove it. Resolution: media deletion must be a
**separate axis** from version immutability — the version keeps its `mediaId`
reference, the bytes are purged, and the activity degrades gracefully to a
missing-image state. This has to be designed in, not retrofitted.

## D-018 — Sharing matrix: built, individually gated, fail-closed

**Decided** · Samuel (owner), 2026-08-15 · *"have the option for it but NOT ENABLE IT
until i feel its ready"*

Each direction is a separate switch. Collapsing them would mean enabling one to
get another, and they carry different risk.

| Direction | Default | Switch |
| --- | --- | --- |
| Teacher → student (the core loop) | **on** | — |
| Student → **teacher** | **on** | `VITE_FEATURE_SHARE_TO_TEACHER` |
| Student → **student** | **off** | `VITE_FEATURE_STUDENT_SHARING` |
| Custom media upload (photo + audio) | **off** | `VITE_FEATURE_CUSTOM_MEDIA_UPLOAD` |

Implemented this batch: flags in `src/config/env.ts`, and `guardUploads()` in
`src/storage/index.ts` wrapping the provider so `upload()` rejects with
`UploadsDisabledError` while the switch is off. Reads and removes stay available
so existing media never becomes unreachable. Wrapping rather than branching
keeps the capability exercised by tests so it cannot rot while it waits.

**Fail-closed.** The gated flags treat absent, empty, and unrecognized values as
false, so a typo, a forgotten variable, or an env file that fails to load all
leave the capability off. `VITE_FEATURE_SHARE_TO_TEACHER` is the one exception
and fails *open*, by decision.

**Two constraints this code cannot enforce — they are server-side:**

1. **The student-to-student toggle must be teacher-reachable only** — never by a
   student, for their own account or anyone else's. A build-time flag decides
   whether the capability exists; it cannot express a role check.
2. **A feature flag is not a security control.** It hides UI. Any endpoint must
   independently refuse while a capability is off.

**Student → teacher introduces attribution**, and that is where a child's name
could first enter the system. A teacher receiving work must know whose it is.
Attribution must come from a **teacher-managed roster** — the teacher creates
the list, the student picks their name — never a free-text field a child types
into. This keeps the no-prompt guarantee intact (the roster pick happens after
play, at submission, never between a link and playable content) and keeps us out
of collecting names directly from children.

## D-019 — Custom audio clips: same gate, higher risk than photos

**Decided** · Samuel (owner), 2026-08-15 · *"ability to send custom audio 10 second
clip but similar rules as photo"*

Audio rides the same `VITE_FEATURE_CUSTOM_MEDIA_UPLOAD` switch, the same review
requirement, and the same no-anonymous-link rule. One gate, because the policy
is identical.

**But audio is harder to make safe than photos, not easier.** Recording this
because the intuition runs the other way — audio files are small, so they feel
lighter:

- **COPPA names it explicitly.** The Rule's definition of personal information
  covers *"a photograph, video, or audio file that contains a child's image or
  voice."* A voice clip is the same category as a face photo, not a lesser one.
- **Moderation has no commodity answer.** Image safety is a solved one-shot API
  call. Audio needs speech-to-text then text moderation, which fails on
  non-speech, degrades badly on children's voices (ASR accuracy for young
  speakers is poor), and cannot read tone — the same words can be a joke or
  bullying.
- **Human review does not scale the same way.** A reviewer clears images at a
  glance; 100 ten-second clips is ~17 minutes of unavoidable listening. Roughly
  an order of magnitude more expensive per item.
- **The 10-second limit needs decoding, not inspection.** Byte size and MIME
  type are free to check. Duration requires decoding the file, and a client-side
  check is bypassable, so the **server must enforce it**.
- **Voice may be biometric in some jurisdictions** (e.g. Illinois BIPA), a
  separate consent regime from image handling.

What genuinely *is* easier: files are ~100–200 KB rather than megabytes, and
there is no derivative pipeline — no thumbnails, no resizing, no slicing. Cheap
to store and serve, hard to make safe.

**Recommended shipping order for custom media:** AI-generated images (no PII at
all) → custom photos (commodity moderation) → audio last. Audio should not go
first merely because the files are small.

**Contract additions needed from Codex** (proposals, not made unilaterally):
`MediaKind` has no audio member; `MEDIA_LIMITS.allowedTypes` is images only; and
`MediaDescriptor` has no duration field. All three are required before audio can
be represented at all.

## D-020 — Client-reported scores are Practice / Unproctored Diagnostics

**Decided** · relayed via Gemini, 2026-08-15 · **closes the W-1 finding in `STATUS.md`**

`GET /v1/play/{shareCode}` delivers `quiz.questions[].choices[].isCorrect` to the
browser. It is the unauthenticated student endpoint, so a student can read every
correct answer in DevTools, and for Learning Puzzle — where a correct answer
releases a piece — the loop is defeated with no tooling.

Accepted for P0/P1 and formally classified: **"Practice / Unproctored
Diagnostics."** Client-reported scores are not cryptographically trusted grading.

**The constraint this carries, which is the reason it needed writing down:**

> `questionsCorrect` is computed by the client, from an answer key the client
> can read, and submitted by the client. It must never back a gradebook,
> mastery report, standards-attainment view, or anything a teacher would read
> as assessment.

That is safe as a decision and dangerous as an assumption. Anyone building
teacher-facing reporting later must treat these values as *engagement* signal,
not achievement. If graded assessment is ever wanted, it needs server-side
answer validation and the key withheld from the bundle — a different endpoint,
not a tightening of this one.

## D-021 — Firestore TTL topology: traces expire, sessions do not

**Decided** · relayed via Gemini, 2026-08-15

Firestore TTL deletes the **entire document**, not the field it keys on. A
`telemetryExpiresAt` TTL on `/gameplay_sessions/{id}` would therefore have
erased every session record — status, duration, scores — 30 days on, silently,
which is the opposite of the stated intent.

Agreed topology:

| Path | TTL |
| --- | --- |
| `/gameplay_sessions/{sessionId}` | **none** — teacher history is permanent |
| `/gameplay_sessions/{sessionId}/telemetry/{eventId}` | 30 days on `expiresAt` |
| `/generation_batches/{batchId}` | 48h on `expiresAt` (whole doc is meant to go) |

Recorded in `infra/firestore.rules` and `infra/firestore.indexes.json`, both
still marked DRAFT / NOT DEPLOYED.

---

## D-022 — Google Docs is a read-only mirror; GitHub stays authoritative

**Decided** · 2026-08-17 · owner ruling

A Google Doc control panel is approved as a **visibility layer only**. Make
writes it from GitHub. No agent — Claude, Codex, Gemini, Unity AI — edits it.

The panel shows, per agent: what it is doing, last check-in time, current status
and blocker, latest completed result, next assignment, decisions waiting on the
owner, direct links back to the GitHub evidence, and a "last synchronized"
timestamp.

**Why one-way.** An editable mirror is a second command centre. Two writable
ledgers drift, and the moment they disagree there is no way to tell which is
correct without re-deriving the answer from the work itself. Read-only means a
contradiction is always a mirror bug, never an authority question.

Consistent with the existing rule that Make/GitHub is the routing and
accountability layer and repo polling is only a convenience
(`docs/coordination/README.md`). This extends the same principle to Docs.

**Gate on turning it on:** the mirror stays off until one genuinely automatic
Make cycle completes end to end. Owner has held it off correctly so far; as of
2026-08-17 the routing proof has landed (claim → lifecycle → `RESOLVED` →
writeback, with a duplicate claim rejected and temporary credentials cleared),
but that proves the *pipeline*, not that a real AI provider can be woken and do
real work. Owner's stated order: hosted worker → one real assignment through an
actual provider → then the mirror.

**Cost:** the owner cannot correct the panel in place; a wrong line there is
fixed by fixing GitHub. Accepted — that is the property being bought.

---

## D-023 — Check-in is derived from evidence; waking agents is a separate, disabled action

**Decided** · 2026-08-18 · owner ruling

The control surface reserves **two distinct actions**, never one button:

| Action | Tier | State | What it does |
| --- | --- | --- | --- |
| **`CHECK STATUS`** | 1 | buildable now | Derives every lane's state from committed evidence. Invokes no agent. |
| **`WAKE AGENTS`** | 2 | **disabled** | Starts hosted provider sessions. Stays off until real provider invocation is proven end to end. |

**Tier 1 accepts no self-reported status.** Every field is read from committed
evidence — `STATUS.md` and the coordination docs, git history, and comments on
`Samco1983/Sal0mander-Jigsaw-Puzzle` Issue #1. No AI agent is called, so no
field can be authored by a model at read time.

**Why the separation is the decision, not an implementation detail.** A freshly
started headless session has no memory of what it was doing. Asked "current
assignment, progress, blocker, next action", it can only produce a fluent,
confident, ungrounded answer — and a dashboard renders that identically to a
real one. Committed evidence cannot confabulate: it is either there, or it is
absent and labelled. So the reliable half of the button is precisely the half
that calls nobody, and it is worth shipping alone.

**Missing evidence is labelled, never inferred.** `STALE` and `UNKNOWN` are
first-class outputs. A lane with no readable evidence reads `UNKNOWN`, and no
field is ever carried forward from a previous run to fill a gap — a stale value
that looks current is the specific failure this decision exists to prevent.

**W-9 stays explicit.** Routing and queueing are verified; **agent invocation is
not.** Tier 1 does not close W-9, does not weaken it, and must not be presented
as autonomy. It reports what the system has committed, not what any agent is
doing right now.

**One editable dashboard comment** on Issue #1, updated in place per
`MAKE-VALIDATION-SPEC.md §5` — not a comment per run.

**Cost, and it is real:** Tier 1's accuracy is bounded by what has been
**pushed**. Unpushed local work is invisible and its lane reads `STALE`. That is
the correct failure — visible, attributable, fixed by pushing — as against a
confident wrong answer, which is what self-report produces. Accepted knowingly.

Deliberately not built under this decision: Tier 2, GitHub workflow dispatch,
Gemini API function calling, any publicly reachable webhook button, any provider
invocation.

### `WAKE AGENTS` — reserved semantics, still disabled

Owner, 2026-08-18, recorded so the target is fixed before it is buildable. On
press: start each available agent → have it orient on the latest briefing →
check the linked GitHub evidence → continue its assignment or report a blocker →
update Issue #1. The Google Doc is the easy briefing surface; GitHub stays the
official proof.

**Amendment — read from the Doc, act from GitHub.** My first position was that
agents should not read the Doc at all, on the grounds that it is generated from
GitHub and so can never be fresher. Owner corrected this twice, and both
corrections hold:

1. **Reach is not the same as freshness.** Gemini opens a Google Doc natively;
   reading GitHub needs a token and API calls. For some agents the Doc is
   genuinely the cheaper door, and "always slightly staler" does not outweigh
   "actually reachable".
2. **GitHub has outages.** During one, a Doc copied 40 minutes ago is the only
   readable picture of where things stand. A mirror has real availability value
   precisely when the source is down.

So the split is by *verb*, not by surface:

- **Reading the Doc: permitted**, for any agent that reaches it more easily.
- **Acting on the Doc: never.** Anything an agent will actually do resolves to a
  GitHub artifact. The Doc points at it.
- **Every Doc line carries the commit sha it was derived from and the UTC time
  it was written.** That stamp is what makes the first rule safe — a reader can
  see exactly how old the line is and go to the source when it matters.
- **If GitHub is unreachable, nothing acts.** The agent reports "cannot verify"
  and stops. An outage is when unverifiable action does the most damage: no
  agent can see another's work, and none can write back to Issue #1, so drift
  is silent and simultaneous.

The hazard this preserves against is unchanged. A Doc is editable, someone will
eventually type a correction into it, and that correction is either overwritten
on the next mirror write or acted on with no versioned record of what was read —
the second-command-centre failure D-022 exists to prevent, arriving through the
read path instead of the write path. Stamping every line and forbidding action
on unlinked Doc text is what closes it without banning the read.

Unchanged: `WAKE AGENTS` stays disabled until hosted provider invocation is
proven (**W-9**).

---

## D-024 — Two evidence lanes. The dashboard measures commits, not people.

**Decided** · 2026-08-18 · owner ruling

**Two lanes produce checkable evidence:**

| Lane | Owner | Repo |
| --- | --- | --- |
| Website / Guest Play | Claude | `Samco1983/SAL0MANder-Web` |
| Game / Teacher Studio | Codex | `Samco1983/Sal0mander-Jigsaw-Puzzle` |

**A lane is not a rank, and the dashboard is not an org chart.** It tracks one
narrow thing — work that produced a commit someone can open and verify. Nobody
is demoted by being absent from it, because it does not measure contribution. It
measures what can be checked.

- **ChatGPT** — advisory, unchanged, no row. It has been reading the situation
  across every lane and that stays valuable. There is simply no commit to point
  at, and a dashboard of verifiable evidence cannot carry a claim it cannot
  verify.
- **Gemini** — reader and interface (see D-023). No repo, so no row. Its job is
  to let the owner ask "where is everything?" and get a plain answer.
- **"Unity AI" visual QA** — a **task**, not a lane. The 1366×768 / 1024×768
  check is assigned to Codex or done by the owner. Nothing should stay blocked
  waiting on an agent that has never acknowledged anything.

**Point is the owner.** Two scopes are not two decision-makers. Codex is
accountable for the game and owns the coordination hub; Claude is accountable
for the website. Both prove what they did. Neither decides what happens next.

**Why this is worth writing down:** the previous framing put four names on a
chart, two of which could only ever render `UNKNOWN`. A dashboard with
permanently broken rows teaches its reader to ignore rows — which is the exact
opposite of a failsafe.

**Left open, deliberately:** whether the FIFO claim queue
(`MAKE-CLAIM-FLOW.md`) is still needed. It was specified to hand work to many
competing workers; two agents who each own a repo and never touch the other's do
not compete for anything. Not retired here — that is an owner call, and the spec
stays on file until it is made.

---

## DEFERRED — requires approval before implementation

| ID    | Decision                          | Blocked on                                    |
| ----- | --------------------------------- | --------------------------------------------- |
| ~~X-001~~ | ~~Backend / hosting provider~~ | **Superseded by D-013** — Google Cloud accepted; services/auth/privacy/CDN/ops still open |
| X-002 | Auth provider and account model   | Architecture + COPPA/FERPA product decision   |
| X-003 | Object storage + CDN provider     | Architecture fork — human approval            |
| X-004 | Analytics / telemetry vendor      | Architecture fork — human approval            |
| X-005 | Visual identity, palette, type    | Product/Gameplay Discovery + human approval   |
| X-006 | Credits economy                   | Product approval                              |
| X-007 | Badge / achievement economy       | Product approval                              |
| X-008 | Classes model                     | Product approval                              |
| X-009 | Unity ↔ Web bridge message set    | Joint agreement with Codex                    |
| X-010 | Who mints activity IDs            | Joint agreement with Codex                    |
| X-011 | Contract transport for Unity      | Joint agreement with Codex (JSON vs. C# DTOs) |
