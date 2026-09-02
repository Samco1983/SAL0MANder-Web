# Proposal — a tutorial derived from the activity's own options

**2026-09-02 · owner's design · Unity's build**

## What exists today

**Nothing.** A search for tutorial, onboarding, first-run or coach-mark code in
`Assets/Scripts/` returns no results. A student opening a share link is shown a
board and a question and left to work out the rest.

One primitive does exist and is the right one:

```
PuzzleManager.cs:1476   public void FocusPieceOnBoard(PuzzlePiece piece)
```

Drawing attention to a specific piece is already written. That is the "point
here" mechanism a tutorial needs.

## The owner's design: a fading scaffold

Not a wall of text before play. A demonstration that withdraws:

| | What the student gets |
| --- | --- |
| **Piece 1** | A hand or arrow points at the piece. It demonstrates the drag, shows the rotate, and drops it into position |
| **Piece 2** | Told the piece is unlocked. **Not** shown how. They try it |
| **Piece 3** | Nothing. They do it alone |

**Skippable at every step**, and the **hint button replays it** — no new control,
and a student who skipped can get it back.

This is the gradual release of responsibility — I do / we do / you do — which is
what teachers already use, applied to a game rather than a lesson.

The hint-button reuse also solves shared classroom devices: the second student
of the day gets no automatic tutorial, but the way back is a button already on
screen.

## The load-bearing rule: the tutorial is derived, never authored

**The tutorial teaches exactly what the activity's options enable, and nothing
else.** It reads the same flags the gameplay reads, so it cannot teach a gesture
the student will never perform.

Without this rule it is worse than no tutorial. Concretely, today:

> `autoPlaceCorrectPieces = true` for **all three demo activities**
> (`ActivityManager.cs:468`). In Mystery Reveal the piece places itself — there
> is no drag. A tutorial teaching drag-and-rotate on those activities teaches a
> gesture that does not exist, and that is the **default configuration right
> now**.

The flags it must branch on, from `ActivityData`:

| Option | Effect on the tutorial |
| --- | --- |
| `autoPlaceCorrectPieces` | true — skip drag and rotate entirely. Teach: answer, watch |
| `activityType` / `allowLearningMode` | Classic only — skip the question step |
| `allowClassicMode` | Both — mention the mode choice exists |
| `allowHints` | false — do not point at a hint button that is hidden |
| `enableCameraZoomAndPan` | true — teach zoom and pan. Otherwise never mention them |
| `showBoardGuide` | false — do not reference a guide outline that is not drawn |
| `allowRestart` / `allowResumeLater` | Mention only the controls actually present |
| `pieceCountPreset` / `boardShape` | Nothing to teach; affects only where the pointer goes |

So three shapes fall out of one engine:

```
Learning Puzzle   answer -> drag -> rotate -> drop      full scaffold
Mystery Reveal    answer -> watch                        two steps
Classic Puzzle    drag -> rotate -> drop                 no question step
```

## Note on rotation

No `allowRotation` field exists in `ActivityData`, so rotation appears to be
unconditional. If that is correct, nothing to do. If rotation ever becomes an
option, it joins the table above — same trap as drag, for the same reason.

## Why derived rather than authored

An authored tutorial is a second description of how the game works, maintained
by hand beside the real one. It drifts the first time an option changes, and the
drift shows up as a tutorial confidently teaching something that no longer
happens.

Deriving it from `ActivityData` means the tutorial cannot disagree with the
game, because it is reading the game's own configuration. This is the same
reason the piece-cost proposal recommends deriving released pieces from the
answer log rather than mutating piece state.

## Lane

`ActivityData` and the tutorial are both Unity's. This is a design the owner
specified and the web lane wrote down; field names, sequencing and presentation
are Codex's call.

## What "derived" rules out

Because the tutorial must match the activity the student actually opened, it
**cannot be a separate thing shown beforehand.** Two approaches that look
cheaper and do not work:

**A recorded video or animation.** It shows one fixed set of options. Play it
before a Mystery Reveal activity and it demonstrates a drag that will never
happen; play it before a rotation-free board and it teaches a control that is
not there. It is wrong for every activity except the one it was recorded from.

**A dedicated tutorial level or scene.** Same failure with more code. The
student learns the tutorial activity's rules, then opens their teacher's
activity, which has different options.

The tutorial has to run **inside the live activity**, pointing at that board's
real pieces, using that activity's real controls, reading that activity's
`ActivityData`. It is not a thing shown before the game — it is a layer over the
first three pieces of the game itself.

That is also why `FocusPieceOnBoard` is the right primitive: it points at a real
piece on the real board, not at a picture of one.
