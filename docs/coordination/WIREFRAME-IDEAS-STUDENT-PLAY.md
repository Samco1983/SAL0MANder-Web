# Wireframe ideas — student play

**2026-09-02 · starting points, not specifications · Codex should change these**

The owner's Student Play wireframe v1.0 predates the decisions of 2026-09-02.
These are two concepts showing what those decisions look like on the board.
**They are deliberately rough. Codex owns the build and should audit, reject and
re-draw them.**

## Concept A — board with piece cost, no modal

Changes from v1.0:

| v1.0 | Here | Why |
| --- | --- | --- |
| Full-screen modal on every correct answer | Inline bar under the board | Twelve interrupts per activity; the modal covers the picture at the moment it changed |
| All pieces equal | Locked slots show `2 of 3` | Variable piece cost — see `PROPOSAL-PIECE-COST.md` |
| `3 / 12 PIECES` | `3 / 9 PIECES` | Piece count is 9 |
| HINT and STRATEGY beside the question | HINT on the control rail | It also replays the tutorial, so it belongs with the persistent controls |

### The open question

`2 of 3` is precise and cold. A slot that **fills** as answers land may read
better to a twelve-year-old, needs no translation, and matches the
picture-assembling reward rather than competing with it.

Both are defensible. This is a judgement to make with the real board on screen,
not from a wireframe.

**Show nothing when a piece costs less than 1.** Those arrive in groups, which
explains itself, and "1/3" means nothing to a student.

## Concept B — the tutorial fades across three pieces

| Piece | Behaviour |
| --- | --- |
| 1 — *I do* | A hand points at the piece, demonstrates the drag, shows the rotate, drops it into place |
| 2 — *we do* | Says a piece is unlocked. Does **not** show how. The student tries |
| 3 — *you do* | Nothing. The hint button replays it if wanted |

Skip is available on 1 and 2.

**This must be driven by `ActivityData`, not authored.** With
`autoPlaceCorrectPieces = true` — the current default for all three demos —
there is no drag, so concept B as drawn would teach a gesture that does not
exist. See `PROPOSAL-TUTORIAL.md`, which has the full option table.

## What is NOT in these concepts, deliberately

**Points, badges, accuracy.** The owner is weighing an arcade feel. The
distinction worth keeping: arcade *juice* — motion, weight, sound, escalation —
costs nothing and makes the reveal land. Arcade *scoring* competes with the
picture for the same attention. Session-scoped and forward-looking (a streak
that builds and resets) is defensible; a permanent accuracy figure is the one
that costs you the student who has already decided the subject is not for them.

If it ships, it belongs behind a **Student Options** toggle so the teacher
chooses per activity.

**The timer.** Still unresolved whether it counts up or down. Down is classroom
pressure; up is a record.

## Lane

Student play is Unity's. These drawings came from the web lane because the
decisions were made here; the implementation, the layout, and the final call on
every element above are Codex's.

## Two small notes on the RESET control

Both cosmetic, both real, neither would surface in a test.

**`ResetLoosePieces()` is safe and its label says otherwise.** It touches only
pieces that are out but not placed — nothing earned is lost, and it saves an
undo state first. But `RESET` sitting beside `UNDO` on the control rail reads as
*reset everything* to a student. A twelve-year-old with eight pieces earned will
not press it to tidy their tray. The safest control on the rail looks like the
most dangerous one.

Suggested: `Tidy`, `Return pieces`, or `Send to tray`.

**It plays the wrong sound.**

```
PlayFailSound(); // Plays satisfying click to represent mechanical clink/reset
```

The comment states the intent — a mechanical clink. The method called is the one
used for a wrong answer, so tidying the tray sounds exactly like getting a
question wrong, which confirms the fear the label already created.

**RESET and RESTART are correctly separated** and this predates the 2026-09-02
work: `ResetLoosePieces` is non-destructive, while restarting the activity is
gated behind `allowRestart` / `SessionContext.CanRestart`. Worth preserving.
