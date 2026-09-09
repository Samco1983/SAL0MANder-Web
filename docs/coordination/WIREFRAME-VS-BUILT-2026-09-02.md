# The wireframes against the code

**2026-09-02 · SAL0-04 Claude · read-only, Unity `origin/main`**

Owner shared two wireframe specs v1.0 — Teacher Studio Activity Editor and
Unity Student Play (Learning Puzzle Mode). This is what is already built, what
is missing, and what is built but hidden.

## Student Play — top bar and controls

| Wireframe | Built? | Evidence |
| --- | --- | --- |
| Progress `3 / 12 PIECES` | **yes** | `progressText`, `PuzzleManager.cs:2008` |
| Timer `08:42` | **yes** | timer logic, 26 refs |
| Zoom | **yes** | 35 refs |
| Undo / Reset | **yes** | on the rail today |
| Sound toggle 🔊 | **no** | no `ToggleSound` / mute button anywhere |
| Music toggle ♫ | **no, and nothing to toggle** | there is no music in the game |
| Menu ☰ | partial | navigation exists, no single menu control |
| **Magnet ON/OFF** | **no** | zero hits for "magnet" in all 60 scripts |

## Student Play — question panel

| Wireframe | Built? | Evidence |
| --- | --- | --- |
| Question + A/B/C/D | **yes** | works today |
| **HINT** | **yes** | `allowHints`, `hintText`, `[Show Hint]` toggle |
| **STRATEGY** tab | **no** | zero hits for "strategy" |
| Math rendering | **yes** | `UI/Sal0manderMathRenderer.cs` |

## Correct-answer feedback

Wireframe: an "AWESOME! You got it!" modal, piece unlocked, confetti, CONTINUE.

Built: a **30-particle burst** on snap (`PuzzleManager.cs:1870-1887`) plus
combo pitch escalation, and the piece reveal `RevealUnlockedImageSection` at
0.70s. There is no full-screen celebration modal and no CONTINUE gate.

The reveal-as-reward decision is deliberate and good. The wireframe's modal
would *interrupt* it. Worth an owner decision rather than a silent build:
**a modal every correct answer is a modal 12 times a puzzle.**

## Completion screen

| Wireframe | Built? | Evidence |
| --- | --- | --- |
| "PUZZLE COMPLETE!" | **yes** | `PuzzleOptionsUI.cs:4443, :4793` |
| Time | **yes** | `Completion Time: mm:ss` (`:4856`) |
| Pieces | **yes** | `Pieces: n/n` (`:4865`) |
| **Accuracy %** | **built, but hidden from the student** | see below |
| VIEW FULL IMAGE | **yes**, labelled "VIEW PICTURE" (`:4809`) |
| **PLAY AGAIN** | **no** | zero hits |

### Accuracy already exists — the student just never sees it

`QuizManager.cs:118` implements `GetFirstTryAccuracyPercentage()`. It is used
in exactly one place: `UI/ReportsUI.cs:103-108`, the **teacher** report.

The student completion modal shows time, pieces and questions answered. Adding
accuracy is surfacing a number that is already computed, not building a
feature. This is the cheapest item on either wireframe.

## Teacher Studio

`LAUNCH-BAR.md` already scores this 6 of 7 — create, title/subject/grade,
student options, picture and board, questions with hints, readiness checklist
all work. The seventh, **share with a class, needs the backend** and no backend
has been chosen (`docs/DECISIONS.md`).

The wireframe adds three things not in that list: **Recent Changes**, **Activity
Notes**, and the Activity Type switch **Learning / Classic / Both**. Release
modes exist in code (`QuizData.cs:12`) so "Both" is a labelling question, not an
engine one.

Wireframe also marks IMPORT, LIBRARY and MANAGE "Coming Soon" — consistent with
the Launch Bar. Nothing to do.

## What this changes about priority

Nothing on this page outranks the six in `LAUNCH-BAR.md`, and item 4 —
re-drag after a wrong drop — is still not in the deployed build.

But three items here are unusually cheap and two are defects:

1. **Show accuracy on the completion modal.** The function exists and is
   already called elsewhere. One line.
2. **Fix the `#if UNITY_EDITOR` audio load** (`PuzzleManager.cs:577`) so the
   one real recording reaches the web. See `GAME-FEEL-AUDIT-2026-09-02.md`.
3. **The wireframe promises a music button.** There is no music. Either add one
   ambient loop or drop the control from the spec — shipping a dead toggle is
   worse than shipping neither.

**Magnet and Strategy are genuinely new features**, not polish. They are the
two largest gaps between spec v1.0 and the build, and both belong behind the
six.

## Lane

All Student Play items are **SAL0-01 Codex** in `SAL0MANDER-Puzzle-Prototype`.
This repo implements none of it.
