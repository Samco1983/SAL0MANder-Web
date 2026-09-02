# Wireframe review — decisions

**2026-09-02 · web lane · four items reviewed, four decided**

Reviewed at the owner's request: *Teacher Studio — Activity Editor (Jigsaw
Puzzle Room) v1.0* and *Unity Game (Student Play) Wireframe Spec v1.0*.

## Standing

**Unity owns both surfaces.** Teacher Studio and Student Play are Unity's to
build; the web lane builds neither and is not proposing to.

The web lane has one narrow stake: **the website is the third surface a person
sees.** A teacher goes site → studio → game; a student goes share link → game.
That is the only reason a web-lane document has a view on a Unity palette.

Items 1 and 2 were decided by the owner. Items 3 and 4 are the web lane's
recommendation, which the owner accepted without a separate ruling — so treat
them as recommendations Codex may push back on, not as settled instructions.

## What is strong, and should survive whatever else changes

**The Readiness Checklist** — Basic Info / Puzzle Image / Questions (10+) /
Student Options / Ready to Publish. It answers "why can't I publish yet?"
*before* the teacher asks. That is the most common failure in authoring tools
and most products never solve it. Keep it.

**"House owns the system, Room owns the interaction."** A real architectural
principle: it is what allows a second room later without rebuilding Teacher
Studio.

**Chromebook 1366×768 listed first** among breakpoints. Correct for schools, and
frequently got wrong in favour of a desktop-first order.

Autosave, 44px touch targets, and "first question fully readable without zoom"
are all the right calls.

---

## 1. Piece count — DECIDED: nine

| Source | Pieces |
| --- | --- |
| Shipped code (`CreateDemoActivity`, mirrored in `mockTransport.ts`) | **9** |
| Teacher Studio wireframe (Activity Summary) | 24 |
| Student Play wireframe (`3 / 12 PIECES`) | 12 |

**Nine.** Owner's call, 2026-09-02. That matches what both repositories already
ship, so no web change is required and `threeDemoActivities.test.ts` keeps
pinning 9 against Unity's constant.

Both wireframes should be corrected — 24 and 12 are illustrative numbers that
will otherwise be read as a target by whoever implements them next.

## 2. Palette — RESOLVED: there is less conflict than it looked

Converting all six brand values to hue/saturation/lightness:

**Purple — 8 degrees apart. Not a conflict.**

| Surface | Hue | Sat | Light |
| --- | --- | --- | --- |
| Website `#7c3aed` | 262° | 83% | 58% |
| Teacher Studio `#6B46C1` | 258° | 50% | 52% |
| Student Play `#A259FF` | 266° | 100% | 67% |

One hue at three lightnesses. That is not three brands — it is correct
behaviour: a dark UI needs a lighter step or the colour disappears into the
background. Nothing to change.

**Green — 64 degrees apart, but only one outlier.**

| Surface | Hue |
| --- | --- |
| Website `#84cc16` | 84° lime |
| Student Play `#B6FF4D` | 85° lime |
| Teacher Studio `#38A169` | **148° emerald** |

Two of the three already agree. And the odd one is used on the *Saved* tick and
the Readiness Checklist ticks — its own style guide labels it **"Success."**

**That is not a competing brand green. It is a status colour, and it should stay
separate.** Once lime means "correct", lime cannot be used decoratively anywhere
without reading as a checkmark. Keeping brand and status distinct is the right
call rather than an inconsistency to iron out.

**Resolution:** one brand hue pair — green ~85°, purple ~262° — expressed as
lightness steps per surface rather than as separate hex values per surface.
Emerald `#38A169` remains the success/valid colour and is not a brand colour.

The website consumes semantic tokens only, so it follows this automatically:
a change touches `design/tokens.css` and nothing else.

## 3. Contrast — this is the real defect

Measured against WCAG AA (4.5:1 normal text, 3:1 large):

| Pairing | Ratio | AA normal | AA large |
| --- | --- | --- | --- |
| White on the `GOT IT` purple `#A259FF` | 3.88:1 | **fail** | pass |
| White on the `CONTINUE` green `#B6FF4D` | **1.21:1** | **fail** | **fail** |
| Dark `#0E0E12` on that same green | 15.96:1 | pass | pass |
| White on Teacher Studio primary `#6B46C1` | 6.42:1 | pass | pass |
| White on Teacher Studio success `#38A169` | 3.25:1 | **fail** | pass |
| White body text on game background `#0E0E12` | 19.26:1 | pass | pass |

**Recommendation: dark text on the light greens, not white.** The `CONTINUE`
case is the severe one — white on `#B6FF4D` is effectively invisible, and it
sits on the control a student presses most. The same green with dark text
measures 15.96:1. The fix costs nothing now and is a re-export of every screen
later.

This is not a new lesson here: `design/tokens.css` already carries per-colour
ratios and an explicit note that white on the vivid brand green measures 2.28:1
and was rejected for exactly this reason. Same green, same trap.

No accessibility *conformance* is claimed by this document. These are
measurements of six colour pairs, nothing more.

## 4. Text size — recommend promoting it out of "future"

Student Play accessibility notes read: *"Adjustable text (future setting)."*

The missing A−/A/A+ control is one of the two defects the owner has been chasing
on the deployed build for days. **Recommendation: it is not a future setting.**
If it stays deferred that should be a decision someone made, not something a
teacher discovers.

## 5. The reward moment — DECIDED: the modal goes

The spec contains **two** answers to the same event:

- **Panel 1 (live gameplay)** — an inline bar under the board: *✓ Correct! Piece
  unlocked!* Board stays visible, nothing to dismiss.
- **Panel 2 (correct answer feedback)** — the board dims, a centred modal
  appears (*AWESOME! / You got it! / Piece Unlocked*) with the piece drawn
  inside the box and a CONTINUE button.

**Panel 1 wins. Panel 2's modal is removed.** Owner's call, 2026-09-02.

Why:

**The modal shows the piece in the wrong place.** It is drawn inside the
celebration box, detached from the puzzle, so the student sees it twice — and
the moment that actually matters, the piece landing in its slot and the picture
getting closer, happens behind the dim.

**It costs a click every time.** Twelve questions is twelve modals and twelve
CONTINUE presses per student. A class of thirty spends roughly 330 extra taps
dismissing a box that reports what the board already shows.

**It repeats a problem already identified.** The owner's note on the questions
panel — *"auto close the questions when you're done, so you can see the puzzle
piece"* — is the same complaint about a different overlay.

### What replaces it

Correct answer → the question panel closes itself → the piece travels to its
slot and snaps in using the glow already in `PuzzlePiece.cs` → the inline bar
appears → the next question arrives on its own. Roughly 600–800ms of motion,
nothing to press.

**Do not make it instant.** The animation *is* the feedback that replaces the
modal; a piece that teleports into place is missed by a distracted student and
the reward does not land.

Keep the word **"unlocked"** — it names the real reward rather than awarding a
point for it. Keep the full-screen celebration for **PUZZLE COMPLETE**, where
stopping the student is the entire point. One modal per activity instead of
twelve.

## 6. Accuracy percentage — recommend cutting it

The completion screen shows `12/12 pieces · 09:31 · 100% accuracy`.

**Recommendation: drop the accuracy figure.** The About page describes the
student this is built for — one who has *"already decided that math is not for
them."* That student finishes and is shown 58%. In a practice tool, a permanent
score on getting things wrong is the thing that stops them pressing Play Again.

`12/12 pieces` is completion rather than judgement, and should stay. The timer
is a separate question: counting **down** is pressure in a classroom, counting
**up** is a record. Worth confirming which is intended.

---

## Summary for Codex

| # | Item | Status |
| --- | --- | --- |
| 1 | Piece count | **Decided: 9.** Correct both wireframes |
| 2 | Palette | **Resolved.** One hue pair, lightness steps per surface; emerald stays a status colour |
| 3 | Contrast | **Fix.** Dark text on light greens; `CONTINUE` at 1.21:1 is the urgent one |
| 4 | Text size | Recommend promoting out of "future" |
| 5 | Reward modal | **Decided: removed.** Inline snap, 600–800ms, nothing to press |
| 6 | Accuracy % | Recommend cutting; keep `12/12`; confirm timer direction |

Only items 1 and 2 touch the web lane, and both are already satisfied by what
this repository ships today.
