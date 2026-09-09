# Android demo release 3 - September 9, 2026

Release revision: `2026-09-08-android-3`.
Unity source: `b944d25505f0867e4e385b85d8f5ce285e2a543f` on official main.

## Delivered behavior

Public lessons offer Learning Puzzle (earn and drag pieces) and Mystery Reveal
(answers reveal pieces automatically). Guide-off boards are opaque and dark,
with subtle shape-only target outlines. Full-photo setup and companion views
stay concealed, including when game state is unavailable. Independent Matching
keeps scrambled tiles without a solved-photo layer. Explicit teacher guide
choices and existing authored activity settings remain respected.

The player preserves Android responsive controls, earned dock access, wrong-drop
re-grab, fullscreen/orientation behavior, replay and temporary Teacher Studio
preview isolation. New web activity drafts hide the guide by default. Preview
reload behavior and guest/account/save limitations are described accurately.
Home/profile styling uses clearer responsive hierarchy and opaque hero covers;
production hides development placeholder notices.

## Validation and provenance

Unity PRs [30](https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/pull/30) and
[31](https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/pull/31) reconcile the
saved changes onto main and include Claude Code's focused visibility finding.
The final main tree matches tested checkpoint `1816411`.

- Fresh final aggregate: Matching pan/completion/settings/replay, Android pointer
  retry, lesson choices, stock guide migration, hidden board/reference/setup
  pixels and contours, missing-state concealment, preview and guest contracts.
  Passed with clean Unity process exit 0. Picture-leak regressions failed before
  their repairs, then passed.
- Four PlayMode checks on the preceding reconciled source `1785146`: focused
  four-mode startup/interaction, six public lesson starts, Mystery completion
  and replay, Learning dock/re-grab/completion/replay. All process exits 0.
  The final guard changes only the unavailable-manager case; initialized-game
  behavior is unchanged. No claim that those four runs were repeated afterward.
- Website: 975 tests / 95 files, 65 supporting tests, lint, types and build passed.
- Final player: Unity 6000.5.2f1, WebGL build succeeded, clean exit 0. All four
  staged player hashes match the new build; StreamingAssets also match.
- Final production build used root paths, production mode and
  `https://sal0mander.com`. Prerendered routes, deployment artifact serving and
  per-instance preview configuration passed.

Exact bytes, hashes and build timestamps are in the
[build manifest](WEBGL-BUILD-2026-09-08-android-3.json). The held player built from
`1785146` was replaced. Source was clean at staging; the build log began after
that source commit. This is recorded provenance, not an embedded binary attestation.

## Scope and remaining acceptance

Physical Samsung S24 Chrome touch acceptance remains outstanding. Browser
control was unavailable for a new visual run during this release; automated
Editor tests and HTTP/artifact checks do not substitute for that device check.
Accounts, cloud saves, custom-activity publishing, and durable Matching result
reporting are not completed by this release. Teacher preview remains temporary.

Claude supplied a focused rule review; long repository-review attempts did not
return usable results. Codex helpers reviewed Android isolation and web release
boundaries and prepared QA/design artifacts. A configured Unity AI/MCP is not
proof of a completed independent AI review.

The shared [agent task board](https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/blob/b944d25505f0867e4e385b85d8f5ce285e2a543f/docs/coordination/AGENT-TASK-BOARD-2026-09-09.md)
contains ownership, a phone-layout proposal and physical-device acceptance steps.
Its held-build note records the earlier preparation checkpoint; this manifest
is the final replacement build. Verify public deployment through the website
repository's deploy workflow and the served release revision before device QA.
