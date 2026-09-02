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
