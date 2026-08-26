# Teacher Studio Execution

Status: active product track  
Baseline: `origin/main` at `750fa4d`  
Branch: `codex/teacher-studio-fast-break`

## Product outcome

A teacher can turn a question set and one puzzle image into a tested activity,
publish one immutable version, and retrieve every supported delivery format
without entering a student identity or choosing a cloud vendor.

The web Studio authors and distributes activity data. Unity remains the only
gameplay runtime; the web must not implement puzzle rules.

## School Compatibility Gate

Issue `#70` is the first measured school-network run, not universal proof.

Record these facts from the real school device and network:

1. Device, browser, network, and timestamp.
2. QR opens the student route without an account or Cloudflare Access.
3. Every requested hostname and any filter/block page.
4. Time until the first question is readable without zoom.
5. One correct answer unlocks one intended piece.
6. Drag/snap remains usable at the device orientation.
7. Completion writes once.

Automated checks may prove routes, artifacts, headers, and contracts. They may
not claim a school filter, camera policy, or managed device works without that
real-device run.

## Delivery ladder

All formats derive from the same immutable published activity version:

1. Student link on a first-party custom domain.
2. High-correction QR and short classroom code.
3. Installable offline web app after one successful load.
4. Downloadable `.sal0activity` package.
5. Standalone offline demo where managed-device policy permits it.
6. Printable pixel-art activity as the universal fallback.

Each delivery reports `Ready`, `Generating`, or `Failed` with a retry action.

## TPT funnel lane

Status: queued product lane. It does not run concurrently with another active
possession.

The funnel is one versioned path:

`TPT printable -> QR or short code -> matching demo -> activity completion`

Every package must contain:

1. Student printable PDF and separate answer key.
2. Accurate preview pages, title, description, credits, and usage terms.
3. High-error-correction QR plus a short typed fallback.
4. A package manifest naming the immutable activity version and demo URL.
5. A downloadable or printable fallback when the school network blocks play.
6. A test receipt with device, browser, network, scan result, and first usable
   screen time. Never include student names.

The package is `Ready` only when the QR and fallback code open the exact
activity represented by the printable, the first question is readable without
zoom, and one question-to-piece interaction succeeds. A generated PDF or HTTP
200 alone is not funnel proof.

### TPT Fast Breaks

| Order | User-visible shot | Rerunnable proof | Status |
| --- | --- | --- | --- |
| T1 | Define one package manifest linking printable, answer key, preview, activity version, and demo URL | Manifest schema test rejects mismatched or missing artifacts | Queued |
| T2 | Export a print-ready package with QR and short fallback code | PDF render check, QR decode, link resolution, and answer-key page count | Queued |
| T3 | Open the package's exact demo on phone, iPad, and a managed school device | Recorded device matrix and successful first question-to-piece interaction | Queued |
| T4 | Offer download/print recovery when live play is filtered | Blocked-network test exposes a working fallback without a student account | Queued |
| T5 | Measure which package reaches the demo without collecting student identity | Aggregate package code receipt; no student PII in payload or logs | Queued |

## Fast Breaks

| Order | User-visible shot | Rerunnable proof | Status |
| --- | --- | --- | --- |
| 1 | Paste/import nine questions and map one to each 3 x 3 piece | `npx vitest run src/routes/studio/TeacherStudioPage.test.tsx src/studio/questionImport.test.ts src/contracts/authoring/v1/activityDraft.test.ts` | Local pass |
| 2 | Review and repair only flagged imported rows, including keyboard reorder and undo | Focused Studio tests + 375px browser pass | Queued |
| 3 | Select puzzle media and expose privacy/share eligibility before upload | Contract tests; custom media cannot mint an anonymous share code | Queued |
| 4 | Test through an isolated preview identity against the real Unity runtime | Share route loads; question, unlock, drag, snap, restart, and completion pass | Queued |
| 5 | Publish an immutable snapshot while edits continue in a new draft | Multi-tab revision-conflict and snapshot tests | Queued |
| 6 | Retrieve link, QR, code, offline package, standalone demo, and printable | Every format names the same activity version and reports a real state | Queued |

## Provider boundary

Vendor decisions stay behind these interfaces until the workflow is proven:

- `AuthPort`
- `ActivityDraftRepository`
- `MediaRepository`
- `PreviewSession`
- `PublishService`

The first Studio slice uses `LocalActivityDraftRepository`. A later adapter may
replace it without changing the teacher workflow.

## Measured targets

- Import: under 60 seconds.
- Review flagged questions: under 90 seconds.
- Puzzle configuration: under 45 seconds.
- Verified test cycle: under 60 seconds.
- Publish and retrieve QR: under 30 seconds.

The school-access reminder is scheduled separately. It must capture evidence,
not replace the test with a remembered claim.
