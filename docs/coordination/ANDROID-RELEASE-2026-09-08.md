# Android gameplay and teacher preview release

Release identifier: `2026-09-08-android-1`.
Unity source: `71f65da8677e5a6a2cf71f50dbb51d602ca974bc` on
`Samco1983/Sal0mander-Jigsaw-Puzzle`.
The four coherent WebGL artifacts and their SHA-256 hashes are recorded in
`WEBGL-BUILD-2026-09-08.json`. All four request URLs carry the release identifier
so a previous cached player cannot silently substitute for this build.

## User-visible repairs

- Portrait questions now have an on-screen Hide control that returns to the
  puzzle without losing the current question. Orientation changes preserve play.
- Loose puzzle pieces can be selected again after an unsuccessful drop. Actual
  graphic controls still block board input; correctly placed pieces stay locked.
- Correct Mystery answers now reveal their earned image section. Previously the
  dock refresh erased the earned index before the reveal coroutine used it.
  Integer Operations uses automatic placement, so its piece tray is intentionally
  hidden. Manual Learning and Classic have draggable pieces.
- Teacher Studio can launch the saved activity picture, questions and settings
  into a temporary Unity preview. Ending a preview returns to the editor; preview
  play does not overwrite student progress. See `../TEACHER-STUDIO-PREVIEW.md`.
- The website header and game occupy their own layout rows, including when the
  local preview banner is present.

## Verification before publication

- Full local web gate: 961 tests across 94 files, 65 Python tests, both TypeScript
  checks, lint and production build passed. Existing lint/React test warnings remain.
- Production configuration build, eight prerendered public routes, Pages fallback,
  deploy artifact verification and visitor-path checks passed.
- Unity challenge drawer, mouse/touch retry, Mystery reward/completion, teacher
  preview and guest bridge checks passed. Real Play Mode reward checks cover wrong
  answers, duplicate submission, four earned pieces and completion.
- Local rebuilt browser at 412x915 shows the Hide control and a revealed piece
  after the first correct Integer Operations answer.

Browser checks at phone dimensions and simulated Unity touch input are not a
physical Samsung Galaxy S24 Chrome test. Publication and public browser acceptance
must be confirmed separately from these source/build checks. Teacher account,
class publishing and cloud persistence are not implemented by this release.
