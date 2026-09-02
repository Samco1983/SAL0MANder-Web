# Directive — Codex, 2026-09-02

Two things matter: **make the demo work**, then **build Teacher Studio.**
Everything else in this repository's docs is background for those two.

The web lane has no network access from its environment — `curl` returns `000`
for every host and the browser is blocked from the domain. It cannot see
production. Where this asks you to confirm something live, that is why.

---

## PRIORITY 1 — Make the demo work

Nothing a student touches works today. This is the whole job until it is done.

### 1a. Audit before you build

1. **`git status`.** The repo is on `codex/reconcile-student-runtime-20e774b`
   with 22 uncommitted files. Intentional? A build from the working tree matches
   no commit — that is one way a fixed bug ships missing.
2. **PR #23 strictly contains PR #22** (`git merge-base --is-ancestor` confirms).
   **Merging #22 does not deliver the drag fix.** Merge #23, close #22.
3. **PR #16**, open since 2026-08-18 — land it or close it.
4. **Confirm the 93 MB WebGL build came from #23**, not the working tree.
5. **Check `autoPlaceCorrectPieces` reaches the build.** It is `true` for all
   three demos (`ActivityManager.cs:468`), so dragging should not be on their
   critical path. If the deployed build still demands a drag, the flag is not
   arriving — cheaper to check than to rebuild.
6. **Report what production is actually serving.** You can see it; we cannot.

### 1b. Ship it

Merge #23 → rebuild WebGL from that branch → hand over the four files per
`RUNBOOK-SHIP-A-UNITY-BUILD.md`.

Compression stays `Disabled`; `deploy.yml` expects
`VITE_UNITY_BUILD_COMPRESSION: none`. A mismatch is what broke the site until
PR #82 — the loader resolved, the bar hit 100%, every student saw "The game
didn't load", and both the build and the deploy reported success.

**Done means:** you can open an activity and finish it. Not "the build
succeeded."

### 1c. Small fixes that belong in the same pass

- **The piece-count `else` bug.** `PuzzleManager.cs:2189` has no `else`: any
  count outside `{4,6,9,12,16}` silently renders 3x3. Live today.
- **Contrast.** White on the `CONTINUE` green `#B6FF4D` is **1.21:1**, on the
  control a student presses most. Dark text on the same green is 15.96:1. White
  on the `GOT IT` purple is 3.88:1.
- **Piece count is 9.** Both wireframes say 24 and 12; correct them.
- **The per-answer reward modal comes out.** Owner's decision. Panel 1's inline
  bar already does the job. Replace with: question panel closes itself, the
  piece travels to its slot and snaps using the existing glow, inline bar, next
  question arrives on its own. 600-800 ms, nothing to press. **Do not make it
  instant** — the animation is the feedback that replaces the modal. Keep the
  word "unlocked". Full-screen celebration only at `PUZZLE COMPLETE`.
- **`RESET` is mislabelled and plays the wrong sound.** `ResetLoosePieces()`
  only returns unplaced pieces to the dock and saves an undo state first — the
  safest control on the rail, labelled like the most dangerous, and it calls
  `PlayFailSound()`. Rename to `Tidy` / `Return pieces`; use a neutral sound.

## PRIORITY 2 — Teacher Studio

The owner has asked for this wireframe for weeks.
`TeacherStudioUI.cs` has been rebuilt at least five times, including a 484-line
redesign on 2026-09-01, and none of those implement it. Nothing was ignored —
**the wireframe only ever existed as an image in a chat**, which cannot be
diffed or checked off.

`SPEC-TEACHER-STUDIO-ACTIVITY-EDITOR.md` now writes it out as exact strings with
a **gap table naming nine missing pieces**, so "done" is checkable: five named
tabs, Readiness Checklist, Subject, Grade Level, Publish gate, Activity Summary,
Quick Actions, Recent Changes, Activity Notes.

The single most valuable element is the **Readiness Checklist** — it answers
"why can't I publish yet?" before the teacher asks. `Ready to Publish` is
derived, never set by hand, and `PUBLISH` stays disabled until it is green.

**Where it runs is still open.** The owner is weighing moving authoring to the
website, since a web change is live in minutes against a 22-hour Unity round
trip. That decision does not block Priority 1 and should not be pre-empted
either way — do not start Teacher Studio until the rebuild ships, and flag it
if you disagree.

`AUDIT-HANDOFF-OPTIONS.md` has the analysis: the retrieval contract
(`PlayBundleSchema`) and the delivery mechanism (`boot` with `playBundle`) are
both already written, so wherever the editor lives, the handoff exists.

## Decisions already made — no need to relitigate

| | |
| --- | --- |
| Piece count | **9** |
| Reward modal | **removed**, inline snap replaces it |
| Palette | resolved — the three purples are 8 degrees apart, one hue at three lightnesses. `#38A169` is a **status** colour, not a brand green |
| Questions | stay in Unity, permanently. Multi-platform needs one implementation |
| The 42% companion | optional context only, never gameplay |
| Backend | yes, on the website. Not yet — after the demo works |

## Recommendations — push back if you disagree

- **Text size A-/A/A+** is filed as a "future setting" in the Student Play spec.
  It is one of the two live complaints. Recommend promoting it.
- **Accuracy %** on the completion screen — recommend cutting. Keep `12/12`.
- **Timer** — counting down is classroom pressure, up is a record. Which?
- **`.gitattributes` says `*.unity binary`** while `SampleScene.unity` is 40,414
  lines of mergeable YAML. That line means two branches touching the scene
  cannot merge — git takes one side and silently discards the other. It is why
  work has to serialise onto one long branch. UnityYAMLMerge config is in
  `UNITY-REPO-DIAGNOSIS-2026-09-01.md`. Not urgent; it is what stops this
  recurring.

## Designs to read, not to build yet

Both are the owner's, both are strong, both wait for a playable build.

- **`PROPOSAL-PIECE-COST.md`** — answers are currency, each release has a price.
  Removes the hidden question quota: a teacher writes 11 questions because the
  lesson needed 11. Includes a blocker — **releases should come off the undo
  stack entirely**, or a student can answer, undo, and re-answer for unbounded
  coins.
- **`PROPOSAL-TUTORIAL.md`** — a fading scaffold across the first three pieces,
  **derived from `ActivityData` rather than authored**. This is load-bearing:
  with `autoPlaceCorrectPieces = true` there is no drag, so a fixed tutorial
  would teach a gesture that does not exist in the current default.

## Everything else

`AUDIT-2026-09-02.md` — every open thread with an owner.
`WIREFRAME-IDEAS-STUDENT-PLAY.md` — two concepts to audit and re-draw.
`ACTION-PLAN.md` — the gated sequence.
