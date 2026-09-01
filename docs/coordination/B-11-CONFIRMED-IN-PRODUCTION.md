# B-11 confirmed in production — the link launched the wrong activity

**2026-08-30, minutes after PR #82 deployed.** Observed on the live site, not
inferred.

## What was loaded

`https://sal0mander.com/play/demo-activity`

## What the screen showed

| Surface | Activity |
| --- | --- |
| Web companion panel | **"Sample SAL0MANder Activity"** — the mock's `demo-activity` |
| Unity stage | **"What is the standard form of a quadratic…"** — `act_quadratics`, "Quadratics Review" |

Two different activities, on one screen, at the same time. The share link named
one thing; Unity played another.

## Why this is exactly B-11

`SAL0MANderBridge.ReceiveBoot` stores `activityId` and never consults
`ActivityManager`. Nothing parses the URL into `SessionContext.TargetActivityId`
in a production build. So Unity played whatever `ActivityManager.ActiveActivity`
happened to be — the seeded default, `act_quadratics`.

The web layer resolved `demo-activity` correctly through the mock transport and
rendered its title. Unity never received a usable instruction and fell back.
Both halves behaved exactly as their code says they do.

## Why nobody would have caught this

Nothing looks broken. There is no error, no console warning, no failed request.
A student gets a real, playable, correctly-rendered puzzle. It is simply not the
one the teacher sent. The only visible tell is that the companion panel's title
disagrees with the puzzle — and the companion is collapsible, so on a phone it is
usually not on screen at all.

This is the precise failure `src/unity/activityResolution.ts` was written to
detect, and the precise reason `'unverifiable'` must never be scored as
`'confirmed'`. Had the demo cards claimed "launch verified" on the strength of
"the page loaded and a puzzle appeared", they would have been wrong here.

## Correction to the record

Another agent's report of the same deploy read: "the Unity canvas rendered the
Quadratics puzzle" for the URL `/play/demo-activity`, and concluded the fix was
verified. The loading fix **is** verified — that part is correct and confirmed
independently. But the same sentence contains the evidence that the activity was
wrong, and it was not flagged. Loading and launching the right thing are two
claims; only the first one passed.

## Status

- **PR #82 (loading): fixed and verified in production.** Loader 200, the three
  `.br` 404s gone, uncompressed files served, game reaches playable state.
- **B-11 (right activity): OPEN, and now demonstrated on the live site** rather
  than argued from source. Unity-lane, unchanged asks in
  `CONTRACT-DELTA-ACTIVITY-RESOLUTION.md`.

The demo is one bug closer, and the remaining bug is now reproducible by anyone
in ten seconds.
