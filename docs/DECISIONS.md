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

---

## DEFERRED — requires approval before implementation

| ID    | Decision                          | Blocked on                                    |
| ----- | --------------------------------- | --------------------------------------------- |
| X-001 | Backend / hosting provider        | Architecture fork — human approval            |
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
