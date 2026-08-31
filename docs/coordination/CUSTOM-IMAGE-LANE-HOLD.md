# Custom Puzzle Image — web-side hold

**Owner directive, 2026-08-30.** Codex is restoring the Custom Puzzle Image
workflow inside Unity Teacher Studio. Unity remains the authority for image
selection, aspect-preserving puzzle generation, board layout, pieces, and
Student Preview.

**Web must not:** recreate custom-image gameplay, change shared activity or
bridge contracts, or build anything that assumes a custom image is already a
portable web asset.

**Waiting on Codex** to report whether an exportable image reference or a
bridge-contract addition is required. No web work should anticipate the answer.

## The fact that constrains us

`imagePresetIndex = -1` marks an activity as Custom. The uploaded image itself
is **Unity-local persistent data** — `PlayerPrefs`, i.e. IndexedDB in WebGL,
scoped to one browser and one origin. It is not addressable from the web layer
and does not travel with a share link. Related: `BLOCKERS.md` B-11 item 4,
which found the same property for activity content generally.

## Audit of existing web code (2026-08-30)

Checked, not assumed:

| Looked for | Result |
| --- | --- |
| `imagePresetIndex`, `customImage`, `puzzleImage` in `src/` | **zero references** |
| Anything rendering an activity image | none — the only `<img>` in the app is the share QR code |
| `thumbnail` consumers | declared in the schema; every actual value is `null` (`mockTransport.ts:132`, `playBundleAdapter.ts:26`) |

Nothing currently assumes transferability. The hold costs us nothing today.

## The two places a future change would silently violate this

Naming them because both are the *natural* next step for someone polishing the
demo surface, and neither looks like a contract change while you are doing it.

1. **`ActivitySummary.thumbnail`** (`src/contracts/v1/activity.ts:42`) is a
   declared, currently-always-null slot. A demo card that starts rendering
   `activity.thumbnail` would be assuming a portable image without anyone
   deciding that it is one.

2. **`MediaKindSchema` includes `'puzzle-image'`** (`src/contracts/v1/media.ts:13`).
   The slot for exactly this already exists in v1. Its presence is not
   permission to fill it — that is the decision Codex is being asked to make.

## Why the demo cards use generated art

`src/demo/demoActivities.ts` gives each card an `accent` colour and
`DemoActivityCard` renders an abstract CSS gradient. That was chosen before this
directive, for an unrelated reason recorded in the component: a screenshot of
gameplay we have never successfully launched would be the most misleading
element on the page.

It happens to satisfy this hold exactly. **Do not "improve" those cards by
swapping in real puzzle images** — that is the change this document exists to
prevent, and it would look like a visual polish pass rather than a contract
assumption.

## What web work continues

Everything not touching image portability: demo card presentation, share links,
QR, loading and error states, fullscreen, accessibility, and the activity
resolution probe (`src/unity/activityResolution.ts`), which reads only an id and
never an asset.
