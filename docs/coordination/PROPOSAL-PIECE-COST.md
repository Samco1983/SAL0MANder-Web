# Proposal — give each piece a cost

**2026-09-02 · owner's idea · Unity's schema, Unity's call**

## What is hardcoded today

```
PuzzleManager.cs:1648   private void ReleaseNextPiece(bool saveUndo = true)
```

Singular. One correct answer releases exactly one piece. There is no ratio
anywhere in the model.

The engine can already choose **which** piece releases —
`QuestionMappingPolicy` (sequential or random) and `linkedPieceIndex` for a
question tied to a specific piece. It cannot choose **how many**.

This was never decided against. It is the simplest thing that worked and was
never revisited.

## The problem that already exists

Piece count and question count are independent settings, so they disagree by
default. **The three demo activities are 9 pieces with 10 questions.** A teacher
choosing a 24-piece board today has silently committed to writing 24 questions,
and if they write 8 the picture never completes. Nothing warns them.

## The owner's model

**Each piece is assigned a cost.** A correct answer is worth one credit; a piece
unlocks when accumulated credits reach its cost. Fractions invert the
relationship, so one field covers both directions.

| Cost | Meaning |
| --- | --- |
| `1` | one correct answer unlocks it — today's behaviour |
| `3` | three correct answers to unlock this piece |
| `10` | a long multi-step problem set behind one piece |
| `1/3` | one correct answer unlocks three such pieces |

Verified against all of these:

```
9 pieces, costs 3,3,3,1,1,1,1/3,1/3,1/3
  answer  3 -> piece 1
  answer  9 -> piece 3
  answer 10 -> piece 4
  answer 12 -> piece 6

24-piece board, 8 questions, every piece 1/3
  answer 1 -> pieces 1,2,3
  answer 8 -> pieces 22,23,24     completes exactly
```

Release loop, in full:

```
on correct answer:
    credits += 1
    while next piece exists and next.cost <= credits:
        credits -= next.cost
        release(next)
```

## Why it is cheap

**It is backward compatible with no migration.** Today's behaviour is every
piece at cost 1, so existing activities keep working if the field defaults to 1.

It is one value per piece and one loop in the release path. It does not touch
the question model, the answer model, or the bridge.

## The balance check it makes possible

`sum(costs)` against the number of questions tells a teacher whether the puzzle
can finish:

```
9 pieces x 1      total 9   questions 9    balanced
24 pieces x 1/3   total 8   questions 8    balanced
3,3,3,1,1,1,...   total 13  questions 12   MISMATCH
```

That last row was an error in the proposal's own first draft, caught by the
check — which is the argument for having it.

**Recommended as a Readiness Checklist row** in Teacher Studio: an activity
whose costs do not sum to its question count cannot be completed by a student,
and today nothing says so.

## Lane

The cost field lives in `QuizData` — Unity's schema. The web lane does not
invent activity schemas, so this is a request for Codex to design, amend or
reject. Field name, type (rational vs float), and whether cost attaches to the
piece or to the board are all his call.

One note if it is accepted: floats make `1/3 + 1/3 + 1/3 != 1`, so a piece can
fail to unlock on the answer that should have released it. A rational or a
fixed-denominator integer avoids that. The model above was verified with exact
fractions.

---

# Two blockers found while checking this — both predate the proposal

Raised by the owner, confirmed in the code. Neither is caused by the cost model,
but the first one **must** be solved before cost can ship.

## 1. Undo has the 1:1 assumption in its data model

```
PuzzleManager.cs:2764   public void SaveUndoState(string actionDesc = "", string questionId = "")
PuzzleManager.cs:1650   if (saveUndo) SaveUndoState("Piece Released");
PuzzleManager.cs:1366   if (saveUndo) SaveUndoState("Piece Unlocked");
```

One undo entry carries **one** question id. That is only coherent while one
answer equals one piece.

Under variable cost it has no correct behaviour:

- **Cost 3** — three answers bought one piece. Undo it, and which three
  questions reopen? There is one slot for one id.
- **Cost 1/3** — one answer released pieces 1, 2 and 3. Undo piece 2 and the
  system would have to un-answer a third of a question. **There is no inverse.**

### Recommended fix: undo the answer, not the piece

Keep an ordered answer log and **derive** released pieces by replaying credits
through the release loop. Undo becomes "drop the last answer, recompute", which
is deterministic at any cost including fractional ones, and removes the need to
store per-piece question ids at all.

Deriving state beats mutating it. This is worth doing even if cost is rejected —
the current design already stores enough to drift between the undo stack and the
real board.

## 2. Only five piece counts actually work

```
PuzzleManager.cs:2189
    int cols = 3;
    int rows = 3;
    if (pieceCountPreset == 4)  { cols = 2; rows = 2; }
    else if (pieceCountPreset == 6)  { ... }
    else if (pieceCountPreset == 9)  { cols = 3; rows = 3; }
    else if (pieceCountPreset == 12) { ... }
    else if (pieceCountPreset == 16) { cols = 4; rows = 4; }
```

**There is no `else`.** Supported values are `{4, 6, 9, 12, 16}`. Any other value
falls through to the 3x3 default — nine pieces, silently, with no error and no
log line.

This is live today, independent of anything proposed here. Note that **the
Teacher Studio wireframe specifies 24 pieces**: a teacher choosing 24 would get a
3x3 board and never be told. The owner has since set the piece count to 9, but
the field would accept 24 and quietly lie.

### Recommended fix

Derive `cols`/`rows` from the piece count and board shape, or close the set and
validate the input. Either is acceptable. Silently substituting 9 is not, and it
is the kind of defect that reaches a classroom rather than a test.

---

# Auto-assignment — the teacher should never have to do this by hand

Owner's refinement, 2026-09-02: **if a teacher does not assign costs, the system
assigns them.** Manual assignment is the advanced case; the default is
automatic. This is what turns the cost model from a new setting to learn into
the thing that removes a constraint.

## The constraint it removes

Today the piece count silently dictates a question quota. A teacher with 11
questions and a 9-piece board has no correct option: two questions are wasted,
or they invent two more. A teacher with one great question cannot use it.

With auto-assignment, **any question count works with any piece count.**

| Teacher writes | Pieces | Auto-assigned | Completes |
| --- | --- | --- | --- |
| 9 | 9 | 9 x cost 1 | yes |
| 11 | 9 | 2 x cost 2, 7 x cost 1 | yes |
| 20 | 9 | 2 x cost 3, 7 x cost 2 | yes |
| 1 | 9 | 9 x cost 1/9 — one answer reveals everything | yes |
| 3 | 9 | 9 x cost 1/3 | yes |
| 8 | 24 | 24 x cost 1/3 | yes |
| 30 | 16 | 14 x cost 2, 2 x cost 1 | yes |
| 45 | 16 | 13 x cost 3, 3 x cost 2 | yes |
| 2 | 4 | 4 x cost 1/2 | yes |

Algorithm:

```
if questions >= pieces:
    base, extra = divmod(questions, pieces)
    costs = [base+1] * extra + [base] * (pieces - extra)
else:
    costs = [Fraction(questions, pieces)] * pieces
```

Every row above was verified to release exactly `pieces` pieces on exactly
`questions` answers, with no remainder.

## Ordering: the expensive pieces go LAST

Owner's call, and it corrects an error in this proposal's first draft.

The first version distributed the extra cost to the **first** pieces. Measured
against back-loading, at 10 questions over 9 pieces:

```
boss at end     pieces at answers  1, 2, 3, 4, 5, 6, 7, 8, 10
front-loaded    pieces at answers     2, 3, 4, 5, 6, 7, 8, 9, 10
```

**Front-loading means the student answers the first question correctly and
nothing happens.** That is the worst moment in the activity to produce no
feedback: first answer, first impression, and the mechanic looks broken before
the student has any reason to trust it.

Back-loading gives eight pieces one-for-one and makes the final piece cost two —
a boss. At 20 questions it is a steady every-two rhythm, then the last two
pieces cost three each, so the puzzle gets harder exactly as the picture becomes
legible enough to want.

Corrected algorithm:

```
if questions >= pieces:
    base, extra = divmod(questions, pieces)
    costs = [base] * (pieces - extra) + [base+1] * extra   # cheap first, boss last
else:
    costs = [Fraction(questions, pieces)] * pieces
```

## The low-question case falls out for free

A teacher who wants the class to mostly play with the puzzle writes two
questions:

```
2 questions, 9 pieces
  answer 1 -> pieces 1, 2, 3, 4
  answer 2 -> pieces 5, 6, 7, 8, 9
```

Two questions, then it is a jigsaw. No separate mode, no extra setting — the
same model with different numbers. This is worth noting because it means
"Classic Puzzle" and "Learning Puzzle" stop being a hard boundary and become
the two ends of one dial.

## Showing it to the student

The owner suggested an icon or reminder on pieces that need more questions.
Recommended refinement:

**Show progress, not price.** A static `3` on a slot tells a student what it
costs. `2 of 3` tells them how close they are, which is the motivating
information — the same reason the assembling picture works better than a score.
A locked slot that fills as answers land does this without a number at all.

**Show nothing when cost is below 1.** "1/3" is meaningless to a student, and
those pieces arrive in groups anyway, which explains itself.

## Where this belongs in Teacher Studio

Auto-assignment means the balance check stops being an error a teacher must fix
and becomes a line of information:

> 20 questions across 9 pieces — some pieces will take 2 or 3 answers.

Manual override sits behind an advanced control, consistent with the wireframe's
own principle that advanced options stay hidden.
