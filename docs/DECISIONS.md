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
