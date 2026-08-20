# Distribution Flow — share link, QR, and teacher handoff

Systems analysis for issue #19. Scope is docs-only: no runtime, contract freeze,
Unity gameplay, auth, cloud, deploy, or Make changes.

## Status Key

- **Implemented** — present in current source or tests.
- **Proposed** — documented shape exists, but no production endpoint or UI flow
  creates it yet.
- **Unresolved** — needs cloud, Unity, or product review before implementation.

## Route and State Map

| Step | State | What exists today | Evidence |
| --- | --- | --- | --- |
| 1 | Teacher has a published activity to share | **Proposed.** A teacher-facing publish/mint flow is not implemented in web. The web can display a link once an activity id or prebuilt URL is provided. | `SharePanel` accepts either `activityId + baseUrl` or a prebuilt `url` (`src/components/share/SharePanel.tsx:10-16`). |
| 2 | Web builds the share URL | **Implemented.** `buildShareLink()` returns an absolute `/play/<id-or-code>` URL, includes the deploy base path exactly once, and URL-encodes the identifier. | `src/config/routes.ts:22-56`; deploy-subpath tests in `src/config/deployBasePath.test.ts:26-88`. |
| 3 | Teacher copies the link | **Implemented.** The link is visible in a readonly input, copy uses a button, and clipboard failure leaves the manual-select fallback intact. | `src/components/share/SharePanel.tsx:37-56`; tests in `src/components/share/SharePanel.test.tsx`. |
| 4 | Teacher shows or prints QR | **Implemented.** QR generation lazy-loads only after the teacher opens it, uses high error correction, and falls back to the visible link if encoding fails. | `src/components/share/ShareQr.tsx:4-49`; QR freshness and failure tests in `src/components/share/SharePanel.test.tsx` and `src/components/share/qrFreshness.test.tsx`. |
| 5 | QR encodes the same URL as copy | **Implemented.** The QR must encode the exact visible share link and must be absolute, because printed QR artifacts cannot be patched after handoff. | `src/components/share/qrMatchesLink.test.tsx:7-70`. |
| 6 | Student opens the link | **Implemented.** `/play/:activityId` is the no-account Guest Play route; the resolver accepts both proposed share codes and legacy activity ids until the contract is finalized. | `src/config/routes.ts:10-24`; `src/routes/guest-play/useGuestActivity.ts:6-20`. |
| 7 | Link resolves to playable bundle | **Implemented in mock/draft.** `GET /v1/play/{shareCode}` exists as a draft endpoint and returns no PII; current fallback still supports activity-id bundle lookup. | `src/api/endpoints/play.ts:4-29`; `src/routes/guest-play/useGuestActivity.ts:15-20`. |
| 8 | Teacher revokes or reissues a link | **Proposed.** Share-code revocation is the reason `shareCode` must differ from permanent `activityId`, but no mint/revoke endpoint exists yet. | `src/contracts/v1/share.ts:18-36`; `docs/TEACHER-DASHBOARD-WIREFRAME.md`. |

## Ownership Table

| Surface | Web owns | Unity owns | Cloud owns |
| --- | --- | --- | --- |
| Link shape | Canonical `/play/<identifier>` route, absolute link building, deploy-base handling. | Nothing. Unity should never need to know the public URL shape. | Future share-code mint/revoke records and stable resolution. |
| QR | Rendering a QR for the same URL shown in the copy field; failure fallback. | Nothing. QR is outside gameplay. | Nothing unless QR analytics or issued-code lifecycle is later added. |
| Guest Play entry | No-account route, loading/error/ready companion surface, bridge boot after bundle resolution. | Receives boot data and owns all gameplay after handoff. | Resolves share code to the current published immutable bundle. |
| Revocation | Displays revoked/unpublished/missing link copy when the resolver returns those states. | Nothing. A revoked link should never send a boot message. | Source of truth for revoked, unpublished, missing, and unavailable states. |
| Custom media privacy | Must not expose custom-media activities through anonymous share links. | Uses only assets delivered through the approved bundle. | Must refuse to mint a share code for activity versions with custom-uploaded media. |

## Printed QR Risk

A printed QR is the least forgiving artifact in the product: after it lands on a
worksheet, in TPT, or in an LMS announcement screenshot, the teacher cannot patch
it in place. The current protections are:

- The public URL builder lives in one file, not inside each component
  (`src/config/routes.ts:1-56`).
- Deploy subpaths are tested so GitHub Pages links do not silently double the
  `/SAL0MANder-Web` prefix (`src/config/deployBasePath.test.ts:66-88`).
- The QR is generated from the same resolved string that the copy field shows
  (`src/components/share/qrMatchesLink.test.tsx:41-70`).
- QR failure does not block distribution because the raw link remains visible
  and selectable (`src/components/share/ShareQr.tsx:44-49`).

## Review Questions

1. **Cloud:** What endpoint mints, revokes, and reissues share codes, and can a
   teacher revoke one code without unpublishing the activity?
2. **Cloud:** Is the resolver rate-limited by distinct failed share codes rather
   than raw request count, so one classroom behind one IP is not throttled?
3. **Cloud:** Where is the invariant enforced that custom-uploaded media cannot
   receive anonymous share codes?
4. **Product:** Should a teacher see separate links per class, assignment, or
   marketplace listing, or one link per activity version?
5. **Unity:** No distribution behavior should depend on Unity receiver names or
   gameplay objects. Unity only receives the already-resolved boot bundle.

## Acceptance

- **No blank/dead-end distribution state:** copy failure, QR failure, revoked
  link, unpublished link, missing link, and transient unavailable link all have
  a visible fallback or next action in current Guest Play docs/tests.
- **Guest Play stays shortest path:** opening a link requires no account, email,
  password, or name (`src/routes/guest-play/useGuestActivity.ts:39-44`).
- **Unknowns are marked:** share-code mint/revoke, rate limiting, custom-media
  enforcement, and per-class/per-version issuance are unresolved or proposed,
  not asserted as implemented.
- **Implementation can split:** link display/copy, QR correctness, resolver
  hardening, revocation UI, and cloud mint/revoke are independent batches.
