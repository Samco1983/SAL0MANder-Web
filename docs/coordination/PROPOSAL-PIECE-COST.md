# Proposal — answers are currency, pieces have prices

**2026-09-02 · owner's design · Unity's schema, Unity's call**

Supersedes three earlier drafts in this file's history. Each was corrected by
the owner; the final model is simpler than all of them and is stated here as
the proposal. The corrections are recorded at the end because they are the
reason the design is what it is.

---

## What is hardcoded today

```
PuzzleManager.cs:1648   private void ReleaseNextPiece(bool saveUndo = true)
```

Singular. One correct answer releases exactly one piece.

A teacher choosing a 24-piece board has silently committed to writing 24
questions; write 8 and the picture never completes, with no warning.

### A correction, because earlier drafts of this file got it wrong

Three earlier revisions described the demos — 9 pieces, 10 questions — as an
undefined mismatch. **They are not.** `CreateDemoQuiz` sets
`requiredCorrectAnswers = 9` against 9 pieces and 10 questions, which is one
spare question. That is deliberate slack, and it is the existing design's answer
to a student skipping or missing one.


## The mental model: answers are currency

The owner's framing, and it makes every edge case obvious:

| Concept | In currency terms |
| --- | --- |
| Correct answer | earn 1 coin |
| Wrong answer | no coin — the student stays on the question (`"Incorrect! Try again!"`) |
| **Skipped question** | **simply no coin. Nothing special happens** |
| Release schedule | the price list, in coins |
| A `0` step | costs nothing; comes free with the piece before it |
| Spare questions | slack — how many a student may miss and still finish |

`requiredCorrectAnswers` is the total price. Questions available minus total
price is the miss allowance.

This is why skipping needs no requeue logic, no deferred-question list and no
special case: a student who skips simply has fewer coins. If the activity has
slack, they still finish; if it does not, they are short and the puzzle is
incomplete — which is the same outcome as answering wrong and giving up, already
the behaviour today.

**It also settles undo.** Undo refunds the coin and recomputes what is
affordable. Deterministic under any price list, with no per-piece question ids —
the same fix recommended below, with a name that fits in one's head.

## The model: one integer per release step

Not a cost attached to a piece. **A schedule attached to the activity** — a list
of how many more correct answers each release needs.

```
[1, 1, 1, 1, 1, 1, 1, 1, 2]     9 pieces, 10 questions
                                 eight one at a time, the last needs two
```

`0` means "release this one too, with no further answer":

```
[1, 0, 0, 0, 0, 1, 0, 0, 0]     9 pieces, 2 questions
                                 one answer releases five, another releases four
```

Two invariants, each a one-line check:

```
len(schedule) == piece count
sum(schedule) == requiredCorrectAnswers      # the puzzle's total price
```

Questions available may exceed the total price. The difference is the miss
allowance, and Teacher Studio should state it as a fact rather than an error:

> 10 questions · puzzle costs 9 · **students can miss 1**

That makes the teacher's lever obvious: more forgiveness means writing more
questions.

## Why a schedule and not a per-piece cost

**Pieces are not released in index order.** `releaseSequence` is a list of piece
indices and `QuestionMappingPolicy` offers `SequentialQueue`, **`RandomQueue`**
and `ExplicitIndexMap`:

```
PuzzleManager.cs:1660   int pieceIndex = releaseSequence[releasedPiecesCount];
```

A cost attached to piece 9 could be paid third under a shuffle, turning a
difficulty ramp into noise. The schedule is indexed by **release position**, so
it is parallel to `releaseSequence` by construction and the ramp holds under
every mapping policy.

**It is integers.** An earlier draft used fractional costs with an accumulating
credit balance. That version needed exact rationals — `1/3 + 1/3 + 1/3` is not
`1` in floating point, so a piece would fail to release on the answer that
should have freed it — and a flat fraction across pieces batched them the wrong
way round. None of that exists here. No fractions, no accumulator, no rounding.

**It is one field on the activity**, not a field on every piece. Nothing about
the piece model changes.

## Auto-assignment — the teacher never does this by hand

If a teacher does not set a schedule, one is generated. Manual is the advanced
case.

```
if questions >= pieces:
    base, extra = divmod(questions, pieces)
    schedule = [base] * (pieces - extra) + [base+1] * extra
else:
    per, rem = divmod(pieces, questions)
    batches  = [per+1] * rem + [per] * (questions - rem)
    schedule = flatten([1] + [0]*(n-1) for n in batches)
```

Verified complete — exactly `pieces` released on exactly `questions` answers:

| Questions | Pieces | Schedule |
| --- | --- | --- |
| 9 | 9 | `1,1,1,1,1,1,1,1,1` |
| 10 | 9 | `1,1,1,1,1,1,1,1,2` |
| 11 | 9 | `1,1,1,1,1,1,1,2,2` |
| 20 | 9 | `2,2,2,2,2,2,2,3,3` |
| 45 | 16 | `2,2,2,3,3,3,...` |
| 5 | 9 | `1,0,1,0,1,0,1,0,1` |
| 3 | 9 | `1,0,0,1,0,0,1,0,0` |
| 2 | 9 | `1,0,0,0,0,1,0,0,0` |
| 1 | 9 | `1,0,0,0,0,0,0,0,0` |
| 8 | 24 | `1,0,0` x 8 |

**The constraint this removes:** a teacher writes 11 questions because the
lesson needed 11, not because the board demanded 9 or 16.

## Ordering: reward front-loaded, effort back-loaded

Cheap steps first, the expensive one last. Bigger batches first when one answer
releases several.

This corrects the first draft, which front-loaded the expensive steps. Measured
at 10 questions over 9 pieces:

```
boss at end     pieces at answers  1, 2, 3, 4, 5, 6, 7, 8, 10
front-loaded    pieces at answers     2, 3, 4, 5, 6, 7, 8, 9, 10
```

Front-loading means **the student answers the first question correctly and
nothing happens** — the worst possible moment for no feedback, before they have
any reason to trust the mechanic.

## The low-question case comes free

```
2 questions, 9 pieces
  answer 1 -> pieces 1,2,3,4,5
  answer 2 -> pieces 6,7,8,9
```

Two questions, then it is a jigsaw. No separate mode. **Classic Puzzle and
Learning Puzzle stop being a hard boundary and become the two ends of one dial.**

## Showing it to the student

**Progress, not price.** A static `3` on a locked slot says what it costs;
`2 of 3` says how close they are, which is the motivating half — the same reason
the assembling picture beats a score. A slot that fills as answers land does it
with no number at all, needs no translation, and is worth prototyping against
the numeric version.

**Show nothing on a `0` step.** Those pieces arrive in a group, which explains
itself.

---

## Blockers — both predate this proposal

### 1. Undo assumes one answer per piece

```
PuzzleManager.cs:2764   public void SaveUndoState(string actionDesc = "", string questionId = "")
```

One undo entry carries **one** question id. Under a schedule this has no correct
behaviour: a step needing three answers has three questions and one slot, and a
`0` step released a piece that no answer paid for directly.

**Recommended fix: undo the answer, not the piece.** Keep an ordered answer log
and derive released pieces by replaying the schedule. Undo becomes "drop the
last answer, recompute" — deterministic, and it removes the need to store
per-piece question ids at all.

This is worth doing even if the schedule is rejected. The current design already
stores enough for the undo stack and the board to drift apart.

### 2. Only five piece counts work

```
PuzzleManager.cs:2189
    int cols = 3;  int rows = 3;
    if (pieceCountPreset == 4) { ... }
    else if (== 6) { ... } else if (== 9) { ... }
    else if (== 12) { ... } else if (== 16) { ... }
```

**There is no `else`.** Any other value falls through to 3x3 — nine pieces,
silently, no error, no log. Live today, independent of anything proposed here.
Note the Teacher Studio wireframe specifies 24 pieces: a teacher choosing 24
would get a 3x3 board and never be told.

## Open question: ExplicitIndexMap

`linkedPieceIndex` ties a question to a specific piece. If a step needs three
answers, which one is the linked question? Explicit mapping assumes 1:1, as undo
does.

Either make `ExplicitIndexMap` and non-uniform schedules mutually exclusive per
activity, or define that a linked step always needs exactly 1. Both defensible.
What must not ship is both enabled with no defined behaviour.

## How this proposal reached its final form

Recorded because it is the argument for keeping it behind a playable build.

1. First draft: per-question multiplier plus per-piece requirement. Owner
   replaced it with a single per-piece cost using fractions — simpler.
2. Front-loaded the expensive pieces. Owner corrected to boss-last; measurement
   showed the first draft produced no feedback on the first correct answer.
3. Used a flat fraction per piece, which batched releases the wrong way round.
4. Indexed cost by piece, which `RandomQueue` breaks. Owner caught it.
5. Owner replaced cost-per-piece with a schedule of integers, removing fractions,
   the credit accumulator and the ordering bug together.

Every correction came from the owner asking a question, not from review.

## Lane

The schedule lives in `QuizData` / `ActivityData` — Unity's schema. The web lane
does not invent activity schemas. Field name, type, and placement are Codex's
call.
