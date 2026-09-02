# Decisions — made by the web lane because the owner asked for calls, not a menu

**2026-09-02**

Every item below was an open question. The owner asked for decisions rather than
options. **These are the web lane's calls, not the owner's** — Codex may
override any of them, and should say so rather than silently doing something
else. Where a decision is the owner's own, it is marked.

---

## 1. Coins are shown only when the schedule is non-uniform

If every release costs 1, a coin counter repeats what the piece count already
says. The moment a release costs 3, the student needs to know why a correct
answer produced no piece — without it, it reads as broken, which is the same
failure back-loading fixed at the start of an activity.

**No coin display on a uniform activity. Coin state appears the moment a teacher
writes 20 questions for 9 pieces.**

## 2. The coin display lives on the slot, not in a corner

`2 of 3` on the locked slot **is** the coin display, attached to the thing being
bought. One number, in the place where it means something, rather than a
floating counter competing with the picture.

## 3. Show both the fill and the number

Earlier drafts posed "fill the slot" against "show 2 of 3" as either/or. Take
both: the slot fills as coins land, with the number inside it. The fill is
glanceable from across a classroom; the number is exact when a student stops to
look. Neither costs anything the other needs.

## 4. Text size A-/A/A+ ships — it is not a future setting

It is one of two defects the owner has been chasing for weeks, and the Student
Play spec files it as "future". Promote it. Everything else on this list is
smaller than it.

## 5. Accuracy percentage is cut

Keep `12/12 pieces` — completion, not judgement. A permanent score of how wrong
a student was is the thing that stops the student this product exists for from
pressing Play Again.

## 6. The timer counts UP

Down is a countdown, and a countdown in a classroom is pressure on the students
least able to absorb it. Up is a record — the same number, and a student can
beat it next time instead of losing to it.

## 7. Arcade: all of the juice, almost none of the scoring

**Juice ships unconditionally** — motion, weight, sound, a piece that flies and
lands, escalation as the picture fills. It costs nothing and it is what makes
the reveal land.

**Scoring: streaks only**, session-scoped and forward-looking, behind a Student
Options toggle, **off by default**. A streak that builds and resets encourages
the next answer. A permanent figure judges the last one.

## 8. `BoardShape` gains wide and tall

The art library has five aspect ratios and the engine has three, so six
generated images cannot be displayed at all. Adding the shapes is the cheaper
side: the `cols`/`rows` block at `PuzzleManager.cs:2189` has to be touched
regardless — it currently has no `else` and silently renders 3x3 for any
unrecognised piece count.

Discarding six finished images to avoid touching code that is already broken is
the wrong trade.

## 9. MAGNET is on by default, teacher can disable

It is an accessibility aid before it is an assist. Dropping a piece within a few
pixels is hard on a trackpad and harder with a motor difficulty, and a student
who cannot place a piece cannot play at all. Teachers who want the precision
challenge can switch it off.

## 10. STRATEGY is cut from the wireframe

It appears as a tab beside HINT and has no definition anywhere, no field in
`ActivityData`, and no described behaviour. `allowHints` covers the need today.

Two undefined help systems is worse than one good one. Add it back when a
teacher asks for something HINT cannot do.

## 11. The question panel auto-closes on a correct answer

The owner's own early request — *"auto close the questions when you're done, so
you can see the puzzle piece"* — and it stands on its own, independent of the
reward-modal work. Nothing should cover the board at the moment the board
changed.

## 12. Reacquisition after a wrong drop must work

A piece dropped in the wrong place stays draggable. Only a *correct* placement
locks, which is what `PuzzlePiece.cs` now does. A student who cannot pick up
their own mistake is stuck, and stuck is worse than wrong.

## 13. `RESET` is renamed `Return pieces` and gets a neutral sound

It only sends unplaced pieces back to the dock and saves an undo state first —
the safest control on the rail, currently labelled like the most dangerous one
and playing `PlayFailSound()`. A student with eight pieces earned will not
press a button called RESET.

## 14. Teacher Studio authoring moves to the website

**Recommendation, not yet ratified by the owner.** A web change is live in
minutes against a 22-hour Unity round trip, and that loop is the direct cause of
the wireframe being rebuilt five times without landing. Browser zoom solves the
text-size request outright, and Unity's `PlayerPrefs` storage is device-local
and unshareable, so nothing is lost by moving.

Unity keeps a button that opens `sal0mander.com/studio` —
`Application.OpenURL`, one line. The C# editor goes dormant behind a flag rather
than being deleted.

**Do not start until the rebuild ships.**

---

## Owner's decisions, for completeness

Piece count is **9**. The per-answer reward modal is **removed**. The palette is
resolved — one hue pair, `#38A169` is a status colour. **Questions stay in
Unity** permanently. The 42% companion is optional context only. There will be a
**backend on the website**, after the demo works.

## What is still genuinely open

Only two, and both need something that does not exist yet:

- **What the paid tier includes.** Custom uploads, certainly. Needs a decision
  before the backend is built, not before the demo works.
- **Where the backend runs.** Recommendation is Supabase with a custom domain on
  `api.sal0mander.com`, because a second domain would break the single-domain
  claim the privacy and district pages make — which matters more here than for
  most projects, given the site is already blocked.
