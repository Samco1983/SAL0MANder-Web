# SAL0MANder Web — Architecture

Last updated: 2026-08-15 · Foundation batch

## 1. System shape

```
┌──────────────────────────────────────────────────────────────────────┐
│  SAL0MANder Unity application  (self-contained, works fully offline) │
│  Teacher Studio · Student Play · Puzzle generation · Piece Dock       │
│  answer → unlock → drag → rotate → snap                              │
└───────────────┬──────────────────────────────────────────────────────┘
                │  shared versioned data contract (JSON)
                │  coarse messages only — never per-frame, never per-piece
┌───────────────┴──────────────────────────────────────────────────────┐
│  SAL0MANder Web  (this repo) — cloud companion platform              │
│                                                                      │
│  routes/            home · guest-play · profile · unity host         │
│  components/layout  AppShell · CompanionLayout (optional 42/58)      │
│  unity/             WebGL host surface + bridge (stub)               │
│  api/               Transport interface ─┬─ mock (today)             │
│                                          └─ HTTP (when a backend     │
│                                             provider is chosen)      │
│  contracts/v1/      Zod schemas — the single source of truth         │
│  storage/           MediaStorage ─┬─ memory (today)                  │
│                                   └─ signed-URL → object store + CDN │
│  auth/              guest identity (NOT authentication)              │
└──────────────────────────────────────────────────────────────────────┘
```

**Direction of dependency:** UI → api/storage/auth interfaces → contracts.
Nothing flows the other way. `contracts/` imports nothing but Zod, so it could
be extracted to a package (or used to generate C# DTOs) without untangling it
from React.

## 2. The load-bearing decisions

### 2.1 Gameplay stays in Unity

The activity payload the web platform stores is **opaque** —
`{ schemaVersion, body: unknown }`. The web app cannot read it, so it cannot
accidentally start reimplementing puzzle rules. This is enforced by the type
system, not by discipline.

### 2.2 Guest Play is never gated

`GuestPlayPage` renders the Unity stage unconditionally. The companion panel can
be loading, collapsed, errored, or empty and the stage is unaffected. The guest
token is device-local, carries no PII, is never sent as an `Authorization`
header, and is minted lazily. There is no sign-in prompt anywhere on the play
path — a test asserts this.

### 2.3 The companion panel is optional by construction

`CompanionLayout` collapses via CSS grid columns only. The stage node is never
unmounted or re-created, so hiding the companion cannot restart a running game.
A test asserts the DOM node identity survives a collapse. Below 60rem the
companion becomes a bottom sheet over the stage so small screens never lose
playable area.

### 2.4 Provider boundaries, not provider lock-in

| Seam    | Interface                 | Today          | Later                                     |
| ------- | ------------------------- | -------------- | ----------------------------------------- |
| API     | `Transport`               | mock in-memory | HTTP against a chosen backend             |
| Storage | `MediaStorage`            | memory/blob    | signed URL → object storage → CDN         |
| Auth    | `getGuestIdentity()`      | guest only     | a chosen auth provider, additively        |
| Unity   | `bridge.ts` message types | stub           | agreed message set with Codex             |

Each is a one-file swap selected by an environment variable. No provider SDK
appears in feature code.

### 2.5 Versioned contracts, never edited in place

`contracts/v1/` freezes once Unity ships against it. Breaking changes create
`v2/` and both run until Unity migrates. Types are always `z.infer` of a schema,
never hand-written beside it, so a backend change surfaces as a
`contract_mismatch` error rather than corrupted UI state.

## 3. Scale posture

Targets: 10,000+ trying it, ~1,000 concurrent routine, 100,000+ total without
redesign, 1,000,000 as a later goal. Expensive infrastructure is **not** being
built now — these are the choices that avoid a rewrite when it is.

| Choice                       | Why it matters at scale                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **Client-side gameplay**     | Piece movement never touches the network. 1,000 concurrent players ≈ 2,000 writes total, not a stream. |
| **Stateless API**            | No server-side session affinity, so the app tier scales horizontally.                  |
| **Cursor pagination**        | Offset pagination skips/duplicates rows under writes and degrades with depth.           |
| **Direct-to-object-storage** | Images — the heaviest payload — never pass through the app tier. CDN absorbs the reads. |
| **Auth-free guest read**     | `/guest/activities/:id` is identical for every student on a link and CDN-cacheable at the edge. One viral link should be one origin hit, not 10,000. |
| **Idempotency keys**         | Classroom wifi drops requests. Retries must not double-count a completion.              |
| **Durable opaque IDs**       | A printed QR code from 2026 must resolve in 2031. IDs are never renumbered or reused.   |
| **Immutable versions**       | A teacher editing after sharing must not change what 200 students are already playing.  |
| **Contract version header**  | Old clients detect drift instead of silently mis-parsing.                               |

## 4. Client architecture

- **Routing** — `createBrowserRouter`. Route paths are centralized in
  `config/routes.ts` so share-link shape is defined once and stays stable. Every
  route has an `errorElement`; a student never sees a blank page.
- **Styling** — CSS Modules over CSS custom properties. Components consume
  *semantic* tokens (`--color-surface`) and never primitives (`--neutral-700`),
  so a rebrand edits `tokens.css` and nothing else. Placeholder values only;
  final identity is an approval-gated pass.
- **Theme** — light/dark/system, stamped on `<html>` before first paint (no
  flash), following the OS live while set to `system`.
- **Errors** — one `ApiError` type crossing the boundary. User-facing copy is
  chosen from a stable `code`; server message strings are never rendered.
- **Accessibility floors** — visible focus rings, skip link, 44px touch targets,
  `prefers-reduced-motion`, `inert`/`aria-hidden` on the collapsed companion.
  Classroom devices include tablets and switch access; these are floors, not
  styling.
- **Bundle** — 380 kB raw / 118 kB gzipped. The Unity loader is deliberately not
  in it. When the app grows, route-level `lazy` splitting goes in first.

## 5. What is deliberately absent

No backend. No database. No auth provider. No storage provider. No hosting
target. No analytics vendor. No CSS framework. No state-management library
(React state suffices at this size; adding one before there is server state to
manage would be premature).

No Unity WebGL build is committed — those are large binaries that belong on a
CDN. `public/unity/` is gitignored.

## 6. Open items requiring decision

**Product/human approval:**

- Visual identity, brand palette, typography (tokens are placeholders)
- Credits and badge economies
- Whether student accounts are self-serve or teacher-provisioned (K-12 argues
  for the latter; this has COPPA/FERPA implications)

**Architecture fork — approval required:**

- Backend/hosting provider
- Auth provider and account model
- Object storage + CDN provider
- Analytics/telemetry vendor

**Joint with Codex:**

- Does Unity consume the contract as JSON over HTTP, or should C# DTOs be
  generated from these schemas?
- Who mints activity IDs? Offline-first argues for Unity minting them
  client-side; authority argues for the backend.
- The Unity ↔ Web bridge message set.
- The minimum result payload a Guest Play session reports when no account exists
  to attach it to.
