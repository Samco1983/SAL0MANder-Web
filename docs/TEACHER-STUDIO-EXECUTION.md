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
