# Web Roadmap

Batches are coherent units of work, not tickets. Each ends with
`npm run verify` green and a git checkpoint.

---

## ✅ Batch 1 — Foundation (complete, 2026-08-15)

Vite/React/TS application · git initialized · project structure · README and
architecture docs · charter in-repo · design-token/theme foundation · responsive
app shell · routing · home, Guest Play, Profile, WebGL host, and 404 surfaces ·
42/58 companion layout architecture · API client boundary · versioned contract
boundary · storage abstraction · guest identity · `.env.example` ·
lint/typecheck/test/build · verified production build.

---

## Batch 2 — Share-link lifecycle end to end (recommended next)

The highest-value work that requires no deferred decision. Everything runs
against the mock transport, so it is provider-neutral and fully testable.

- Share-link resolution edge cases: unpublished, revoked, and unknown activities
- QR code generation for a share link (teacher-facing, client-side)
- A "copy share link" surface with correct absolute-URL construction
- Offline/failed-network handling on the Guest Play path
- Session lifecycle wired through the mock: start → play → submit result,
  including the idempotent retry path
- Route-level code splitting so the Unity loader is not in the initial bundle
- Expand the test suite around the guest path

**Approval needed:** none. Copy and layout stay in placeholder form.

## Batch 3 — Unity WebGL host hardening

Best done alongside a real Unity WebGL build from Codex.

- Load a real build end to end; verify compression, caching, and COOP/COEP
- Loading, progress, and failure UX for a large download on classroom wifi
- Canvas sizing/DPI behavior inside the 42/58 split and on collapse
- Implement the agreed bridge message set

**Approval needed:** X-009 (bridge message set, joint with Codex). A Unity WebGL
build must exist.

## Batch 4 — Backend integration

Blocked until a provider is chosen (X-001).

- Implement the HTTP transport against the real API
- Real activity storage, versioning, and publish flow
- Signed-URL media upload via `createHttpStorage`
- Error/retry behavior under real network conditions

**Approval needed:** X-001, X-003.

## Batch 5 — Accounts and profiles

Blocked on X-002, and on Product/Gameplay Discovery for the UX.

- Auth integration; guest → profile claim flow
- Profile surface with real (not placeholder) data
- Cloud saves and play history

**Approval needed:** X-002, X-005.

---

## Explicitly not being built yet

Per charter, these require later system/UX approval:

Teacher Studio on web · final profile UX · credits economy · badge economy ·
classes · full reports · full collaboration UI · final lesson system · paid
subscriptions · OCR · AI assignment extraction · final backend persistence ·
final shared Unity API contract.

## Sequencing constraints

- Unity is completing **P0 functional integrity**. Nothing here should ask for
  Unity changes before that lands.
- Broad UX implementation waits on Product/Gameplay Discovery and wireframes
  from ChatGPT and the human.
- Major visual and product workflows require human approval.
