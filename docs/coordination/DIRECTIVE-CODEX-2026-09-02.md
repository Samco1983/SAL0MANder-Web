# Directive — Codex, 2026-09-02

## 0. Read first

`AUDIT-2026-09-02.md` · `SPEC-TEACHER-STUDIO-ACTIVITY-EDITOR.md` ·
`WIREFRAME-REVIEW-2026-09-02.md` · `UNITY-REPO-DIAGNOSIS-2026-09-01.md`

The web lane has no network access from its environment — `curl` returns `000`
for every host, and the browser is blocked from the domain. **It cannot see
production.** Anywhere below that asks you to confirm something live, that is
why.

---

## A. Audit — state check before you build anything else

1. **`git status`.** The repo is on `codex/reconcile-student-runtime-20e774b`
   with 22 uncommitted files. Intentional? A build from the working tree matches
   no commit, which is one way a "fixed" bug ships missing.
2. **PR #23 strictly contains PR #22.** `git merge-base --is-ancestor` confirms
   it. **Merging #22 does not deliver the drag fix.** Recommend merging #23 and
   closing #22.
3. **PR #16** has been open since 2026-08-18. Land it or close it.
4. **Confirm the 93 MB WebGL build came from #23**, not from the working tree.
5. **Check `autoPlaceCorrectPieces` reaches the build.** It is `true` for all
   three demo activities (`ActivityManager.cs:468`), so dragging should not be
   on the critical path for them. If the deployed build still demands a drag,
   the flag is not arriving — cheaper to check than to rebuild.
6. **Report what production is actually serving.** You can see it; the web lane
   cannot.

## B. Do first — this is the only thing blocking a playable product

Merge #23 → rebuild WebGL from that branch → hand over the four files per
`RUNBOOK-SHIP-A-UNITY-BUILD.md`.

Compression must stay `Disabled`; `deploy.yml` expects
`VITE_UNITY_BUILD_COMPRESSION: none`. A mismatch is what broke the site until
PR #82 — loader resolved, progress hit 100%, every student saw "The game didn't
load", and both the build and the deploy reported success.

Nothing a student touches works until this lands.

## C. Decisions to implement — settled by the owner 2026-09-02

**C1 — Piece count is 9.** Correct both wireframes; they read 24 and 12.

**C2 — The per-answer reward modal is removed.** The spec contains two answers
to the same event; panel 1's inline bar wins.

Replace with: question panel closes itself → the piece travels to its slot and
snaps in using the glow already in `PuzzlePiece.cs` → inline bar → next question
arrives on its own. Roughly 600–800 ms, nothing to press.

**Do not make it instant.** The animation *is* the feedback that replaces the
modal. Keep the word "unlocked". Keep the full-screen celebration for
`PUZZLE COMPLETE` only — one modal per activity instead of twelve.

**C3 — Palette resolved.** The three purples are 8° apart: one hue at three
lightnesses, which is correct, not a conflict. Two of three greens already agree
at ~85°. Teacher Studio's `#38A169` is the **success/valid** colour — the Saved
tick, the checklist ticks — and stays distinct from the brand green. One brand
hue pair expressed as lightness steps per surface, not separate hexes.

**C4 — Mystery Reveal becomes a named Activity Type.** The engine already
supports it (`autoPlaceCorrectPieces`, shipped 2026-08-30) and it has never had
a label a teacher can see — your own commit comment describes the intended
"teacher choice between AUTO and DRAG". Four modes: `Learning Puzzle` /
`Mystery Reveal` / `Classic Puzzle` / `Both`. Mapping in the spec, §3.1. No new
data model required.

## D. Fix — measured, not opinion

**Contrast.** White on the `CONTINUE` green `#B6FF4D` measures **1.21:1** and
sits on the control a student presses most. Dark `#0E0E12` on that same green is
15.96:1. White on the `GOT IT` purple is 3.88:1 (fails AA normal). White on
`#38A169` is 3.25:1.

`design/tokens.css` in the web repo already records that white on the vivid
brand green measures 2.28:1 and was rejected for exactly this reason.

## E. Recommendations — push back if you disagree

- **Text size A−/A/A+** is filed in the spec as "future setting". It is one of
  the two live complaints. Recommend promoting it.
- **Accuracy percentage** on the completion screen — recommend cutting. Keep
  `12/12 pieces`. A student who has "already decided math is not for them"
  finishing at 58% will not press Play Again.
- **Timer direction** — counting down is classroom pressure, counting up is a
  record. Confirm which is intended.
- **`.gitattributes` says `*.unity binary`** while `SampleScene.unity` is 40,414
  lines of mergeable YAML. That single line means two branches touching the
  scene cannot be merged — git takes one side and discards the other silently.
  It is why work has to serialise onto one long branch. UnityYAMLMerge config is
  in `UNITY-REPO-DIAGNOSIS-2026-09-01.md`. Not urgent; it is the thing that stops
  this recurring.

## F. On hold — do not start, and do not continue

**Teacher Studio.** The owner is actively considering moving authoring to the
website and leaving a minimal Unity surface — an activity picker, a list with
dropdowns — with the C# editor made **dormant behind a flag rather than
deleted**.

**This is not decided.** It is recorded here so you do not spend another day on
a surface that may move. `TeacherStudioUI.cs` was rebuilt five times on
2026-09-01, including a 484-line redesign, and none of those rebuilds implement
the owner's wireframe — the wireframe only ever existed as an image in a chat,
which cannot be diffed or checked off.

`SPEC-TEACHER-STUDIO-ACTIVITY-EDITOR.md` now writes it out as exact strings with
a gap table naming nine missing pieces, so it is buildable **if** it stays in
Unity. Await the owner's decision before touching it either way.

Reasoning for the possible move, so it is not a surprise: Teacher Studio is a
forms app, the browser gives those controls for free, a web change deploys in
minutes against a 22-hour Unity round trip, browser zoom solves the text-size
request outright, and a teacher should not download 93 MB to type a title.
Unity's version also stores to `PlayerPrefs` — device-local, unshareable — so
moving loses no backend, because there is none.
