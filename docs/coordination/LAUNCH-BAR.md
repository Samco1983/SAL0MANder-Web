# What "works" means before this launches

**2026-09-02 · the owner's bar, written down**

> "Things need to work as intended, that will launch — not have a million
> options and can't even drag a puzzle piece after initial drop."

Everything designed on 2026-09-02 is worth building. **None of it is worth
building before this list is true.** A teacher who meets a broken drag on a
Tuesday does not come back for the release schedule.

---

## The bar

An activity is playable when a student can, without being told how:

1. Open a share link and reach a board
2. Read the first question without zooming
3. Answer it and see a piece arrive
4. **Drag that piece — and drag it again after dropping it in the wrong place**
5. Rotate it
6. Place every piece and reach a finished picture

Six things. Nothing on this list is a feature.

## Where each one stands

| | Status |
| --- | --- |
| 1. Link reaches a board | fixed in web PR #95 — three activities resolve, unknown ids no longer run Unity behind a 404 |
| 2. First question readable | **unverified.** A-/A/A+ text size is filed as a "future setting" |
| 3. Answer releases a piece | works |
| 4. **Drag, and re-drag after a wrong drop** | fixed on `codex/p1-unity-ux-recovery`, **not in the deployed build** |
| 5. Rotate | works |
| 6. Finish the picture | blocked by 4 |

### On drag, specifically

Traced through `PuzzlePiece.cs` on `codex/p1-unity-ux-recovery`:

```
SnapIntoPlace()      isLocked = true    correct placement only
LockPermanently()    isLocked = true    called only when every piece is placed
```

Both `LockPermanently` call sites (`PuzzleManager.cs:1856` and `:3993`) are
guarded by `placedPiecesCount == pieces.Length`. A wrong or missed drop reaches
neither, so it stays draggable.

**That is the correct behaviour and it is not in the deployed build**, which
predates the fix. The rebuild is the test. Nobody should redesign anything on
the basis of the current live build.

## What this means for everything else

The piece-cost schedule, the tutorial, arcade juice, the reward timing, Mystery
Reveal's label, the coin display — **all of it waits.** Each is a good idea and
each is a reason not to have shipped.

The exceptions, because they are defects rather than features and they are
small:

- the missing `else` in the cols/rows selection — any piece count outside
  `{4,6,9,12,16}` silently renders 3x3
- white on the `CONTINUE` green at 1.21:1
- `RESET` labelled like the most dangerous control on the rail while being the
  safest, and playing the wrong-answer sound

## The same bar for Teacher Studio

A teacher can, without being told how:

1. Create an activity — **works**
2. Give it a title, subject and grade — **works**
3. Choose how students play — **works**
4. Pick a picture and a board — **works**, but the game cannot render the
   library yet (`HANDOFF-PICTURE-LIBRARY.md`)
5. Write questions with answers and a hint — **works**
6. Know why they cannot publish — **works**, the Readiness Checklist
7. Share it with a class — **not built.** Needs the backend

Six of seven. The seventh is the backend, and it is the right next thing *after*
the game is playable — not before.

## Simplicity is a rule, not a preference

Owner's instruction: simple, and not a million options.

Applied so far: Student Options shows **three** switches where `ActivityData`
has seven, and the four that are not lesson decisions keep Unity's defaults and
are not shown. Board settings live in one place instead of two.

The test for any future option: **would a teacher change this for a specific
lesson?** If not, it has a default and does not appear.
