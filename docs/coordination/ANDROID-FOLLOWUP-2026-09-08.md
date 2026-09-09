# Android follow-up: release 2

Release identifier: `2026-09-08-android-2`. Build source and hashes are in
`WEBGL-BUILD-2026-09-08-android-2.json`. Release 1 remains a rollback checkpoint.

## Repairs

- Direct `/unity`, `/unity/`, and `/unity/index.html` links use the responsive
  React host. GitHub Pages previously served a separate legacy 960×600 export
  from the physical directory, bypassing host sizing and versioned build URLs.
- The fullscreen control has a separate row below the canvas, keeping the
  bottom-right puzzle card reachable. It remains available in fullscreen.
- Fullscreen exit followed by rotation no longer scrolls the game shell upward.
  The observed failure displaced the board by 255 pixels; the fill shell now
  uses overflow clipping instead of a focus-scrollable hidden container.
- Tapping an On board card can focus its loose piece at default zoom, even when
  rotation leaves the piece outside the viewport. Explicit focus bypasses the
  gesture pan clamp; piece position, rotation, placement and locks are preserved.
- Teacher preview locks background editor scrolling while its modal is open,
  using the full phone width and restoring editor scrolling when closed.
- Preview persistence is set by immutable per-instance loader configuration.
  Closing during startup cannot allow late preview initialization to write
  student saves. Stale route markers cannot change ordinary game persistence.

## Verification

The final web gate passed 971 tests across 94 files, 65 Python tests, lint,
application/build TypeScript checks, and a production build. Existing warnings
remain. Regression coverage includes Pages-style HTTP direct entry, delayed
preview cancellation/replacement, and explicit guest configuration.

Unity source `983f3c2de099af327d437f057c438cc01394e27f` is pushed to
`codex/matching-learning-checkpoint-2026-09-07`. Teacher preview contract, guest
bridge and board pointer retry checks passed. The pointer suite includes
default-zoom focus after layout changes in both phone aspects, checking visible
sprite corners and preserved piece transforms, locks and progress. The shipped
loader/JavaScript plugin isolation test passed (`PASS_PREVIEW_INSTANCE_CONFIG`).

Local browser checks at 412×915 and 915×412 verified manual drag/re-grab,
reachable rightmost cards, a separate fullscreen row, and preservation through
fullscreen exit and rotation. The repaired shell stayed at scrollTop 0 with the
canvas at y=0. The preview used all 412 pixels and restored scrolling on exit.

Public release 1 also passed the full Teacher Studio create-to-play path in this
browser: four authored Ocean addition questions and a coral reef picture,
wrong-answer retry, four earned pieces, completion at 75% first-try accuracy,
return to editing, and draft persistence after reload. This is a local browser
draft on the public origin, not a published class activity or a phone draft.

The new Unity build succeeded in 6m46.300s (90,683,529 bytes reported). All four
artifacts were staged together and verified by SHA-256; the instance-config test
also passed against the new loader. The production web build, eight public
prerendered routes plus the shared Unity entry, Pages fallback, artifact check,
and visitor-path checks passed. Deployment and public acceptance of release 2
must be confirmed separately before declaring this follow-up live. Browser dimensions and
queued Unity touch tests do not establish physical Samsung Galaxy S24 acceptance.
Accounts, class publishing and cloud persistence remain unfinished.
