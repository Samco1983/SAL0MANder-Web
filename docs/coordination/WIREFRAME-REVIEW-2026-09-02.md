# Wireframe review — four things to settle before they get built

**2026-09-02 · web lane · advisory only**

Reviewed at the owner's request: *Teacher Studio — Activity Editor (Jigsaw
Puzzle Room) v1.0* and *Unity Game (Student Play) Wireframe Spec v1.0*.

## Standing

**Unity owns both surfaces.** Teacher Studio and Student Play are Unity's to
build; the web lane builds neither and is not proposing to. Everything below is
a finding, not a requirement — Codex takes it or leaves it.

The web lane has one legitimate stake, and it is narrow: **the website is the
third surface a person sees.** A teacher goes site → studio → game and a student
goes share link → game. If those three disagree visually, they read as three
products from three vendors. That is the only reason a web-lane document has an
opinion about a Unity palette at all.

## What is strong, and should survive whatever else changes

**The Readiness Checklist** — Basic Info / Puzzle Image / Questions (10+) /
Student Options / Ready to Publish. It answers "why can't I publish yet?"
*before* the teacher asks. That is the most common failure in authoring tools
and most products never solve it. Keep it.

**"House owns the system, Room owns the interaction."** A real architectural
principle rather than a slogan: it is what allows a second room later without
rebuilding Teacher Studio.

**Chromebook 1366×768 listed first** among the breakpoints. Correct for schools,
and frequently got wrong in favour of a desktop-first order.

Autosave, 44px touch targets, and "first question fully readable without zoom"
are all the right calls.

---

## 1. Piece count: three sources, three numbers

| Source | Pieces |
| --- | --- |
| Shipped code (`CreateDemoActivity`, mirrored in `mockTransport.ts`) | **9** |
| Teacher Studio wireframe (Activity Summary) | 24 |
| Student Play wireframe (`3 / 12 PIECES`) | 12 |

Any of the three may be the right answer. What cannot hold is three. The web
side pins 9 in `threeDemoActivities.test.ts` **because Unity hardcodes 9**, so
if the real target is 12 or 24, that is a web change too and the web lane needs
telling. It is a one-line change here and a silent wrong-looking demo if nobody
says anything.

## 2. Three palettes, no two matching

| Surface | Purple | Green |
| --- | --- | --- |
| Website (live today) | `#7c3aed` | `#84cc16` |
| Teacher Studio spec | `#6B46C1` | `#38A169` |
| Student Play spec | `#A259FF` | `#B6FF4D` |

Six values for what should be two. Nobody chose this — it is what happens when
three surfaces are specified at three different times, which is ordinary and
worth fixing once rather than reconciling forever.

No proposal is made here about *which* pair wins. That is the owner's call, and
the web lane will follow whatever is decided: the site consumes semantic tokens
only, so a rebrand touches `design/tokens.css` and nothing else.

## 3. Two contrast failures already visible in the specs

Measured against WCAG AA (4.5:1 for normal text, 3:1 for large):

| Pairing | Ratio | AA normal | AA large |
| --- | --- | --- | --- |
| White on the `GOT IT` purple `#A259FF` | 3.88:1 | **fail** | pass |
| White on the `CONTINUE` green `#B6FF4D` | **1.21:1** | **fail** | **fail** |
| Dark `#0E0E12` on that same green | 15.96:1 | pass | pass |
| White on Teacher Studio primary `#6B46C1` | 6.42:1 | pass | pass |
| White on Teacher Studio success `#38A169` | 3.25:1 | **fail** | pass |
| White body text on game background `#0E0E12` | 19.26:1 | pass | pass |

The green one is the severe case: white on `#B6FF4D` is effectively unreadable,
and it appears to sit on the `CONTINUE` button — the single control a student
presses most. **Dark text on the same green measures 15.96:1**, so the fix costs
nothing if it is made now and is a re-export of every screen if it is found
later.

This is not a new lesson for the project. `design/tokens.css` already carries
per-colour ratios and an explicit note that white on the vivid brand green
measures 2.28:1 and was rejected for this exact reason. The same green, the same
trap.

No accessibility *conformance* is claimed anywhere by this document — these are
measurements of two colour pairs, nothing more.

## 4. The text-size control is deferred, and it is the live complaint

Student Play accessibility notes read: *"Adjustable text (future setting)."*

The missing A−/A/A+ control is one of the two defects the owner has been chasing
for days on the deployed build. The spec is internally consistent — it is
labelled future — but it should be a deliberate decision that it stays future,
not something discovered later by a teacher.

---

## Suggested order

1. **Piece count** — one number, and tell the web lane which
2. **Contrast** — cheapest to fix now, especially `CONTINUE`
3. **Palette** — owner decides one pair; web follows via tokens
4. **Text size** — confirm deferred on purpose, or promote it

Items 1 and 3 are the only two that touch the web lane at all. The web lane will
implement neither wireframe and is not asking to.

---

# 5. The reward moment: the spec contains two answers to it

Added after review with the owner, 2026-09-02. **A product call, not an
engineering one, and Unity's build either way.** Recorded here so the choice is
made deliberately rather than by whichever panel gets implemented first.

## Both patterns are drawn

**Panel 1 (live gameplay)** — an inline bar under the board:

> ✓ Correct! Piece unlocked!

Board stays visible. Nothing to dismiss.

**Panel 2 (correct answer feedback)** — the board dims and a centred modal
appears: *AWESOME! / You got it! / Piece Unlocked*, the piece rendered inside
the box with confetti, and a CONTINUE button.

These are two solutions to the same event. Shipping both means the student gets
the bar *and* the modal for every correct answer.

## The case for the inline one

**The modal shows the piece in the wrong place.** The piece is drawn inside the
celebration box, detached from the puzzle. The student sees it twice — floating
in a modal, then again on the board — and the moment that actually matters, the
piece landing in its slot and the picture getting closer, happens behind the dim
or after the dismiss. The reward here is the picture assembling. The modal
covers it.

**It costs a click every time.** Twelve questions is twelve modals and twelve
CONTINUE presses, per student, per activity. Thirty students on Chromebooks
clicking through a box that reports something the board already shows.

**It repeats a problem already identified.** The owner's note on the questions
panel — *"auto close the questions when you're done, so you can see the puzzle
piece"* — is the same complaint about a different overlay: something covering
the board at the moment the board is worth looking at.

## Suggested behaviour

On a correct answer, keep the board on screen and let the piece fly to its slot
and snap in, using the snap glow that already exists in `PuzzlePiece.cs`.
Celebrate **at** the board rather than over it: the inline bar from panel 1,
and confetti originating from the piece's slot.

Reserve the full-screen celebration for **PUZZLE COMPLETE**, where stopping the
student is the entire point and the picture is finished.

That is one modal per activity instead of twelve.

## What this does not touch

"Piece Unlocked" as language stays — it names the real reward rather than
awarding a point for it. The completion screen stays. Only the per-answer
interrupt is in question.

The separate note in section 4 of this document — accuracy percentage on the
completion screen — is a different decision and is not bundled with this one.
