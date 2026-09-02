# Build spec — Teacher Studio Activity Editor

**2026-09-02 · transcribed from the owner's wireframe v1.0 · build target**

## Why this document exists

The owner produced a Teacher Studio wireframe and has been asking for it for
weeks. `TeacherStudioUI.cs` has meanwhile been rebuilt at least five times —
including a 484-line redesign on 2026-09-01 at 22:59 — and none of those
rebuilds implement the wireframe.

Nothing was ignored. **The wireframe only ever existed as an image in a chat
thread.** An image cannot be diffed, cannot be checked off, and cannot be
verified as done, so each rebuild has been someone's interpretation and none of
them converge.

This document is the wireframe written out as exact strings and explicit
conditions, so there is one target and anyone can tell whether it has been hit.

**Unity owns this build. The web lane wrote this spec and implements none of
it.** Where a string here is ambiguous, the owner's image is the authority.

---

## 1. Persistent chrome

**Top bar, left to right:**

| Element | Exact text |
| --- | --- |
| Wordmark | `SALØMANDER` |
| Context label | `Teacher Studio` |
| Activity picker | `My Activities` (dropdown) |
| Current activity | `Activity: <title>` |
| Save state | `Saved` with a check |
| Secondary button | `PREVIEW / TEST` |
| Primary button | `PUBLISH` |
| Help | `?` |
| Account | avatar |

**Left rail:** heading `ACTIVITIES`, a `+ Create Activity` button, then the
activity list. The selected row is highlighted.

## 2. Tabs — five, in this order

```
OVERVIEW | QUESTIONS | PUZZLE & IMAGE | STUDENT OPTIONS | PREVIEW
```

None of these five labels currently appear in `TeacherStudioUI.cs`. This is the
single largest gap between the spec and the build.

## 3. Overview tab

### Activity Overview (primary column)

| Field | Control | Notes |
| --- | --- | --- |
| `Activity Title` | text input | |
| `Subject` | dropdown | e.g. Science |
| `Grade Level` | dropdown | e.g. 5th Grade |
| `Description` | multi-line | |
| `Activity Type` | 3-way segmented | `Learning Puzzle` / `Classic Puzzle` / `Both` |
| `Created` | read-only | |
| `Last Modified` | read-only | |
| `Status` | read-only | e.g. Draft |

### Activity Summary (second column)

Thumbnail of the puzzle image, then labelled rows:

`ROOM TYPE` · `PUZZLE IMAGE` · `PIECE COUNT` · `QUESTIONS` ·
`STUDENT OPTIONS` · `STATUS`

**`PIECE COUNT` is 9.** The wireframe reads 24 and the Student Play wireframe
reads 12; the owner settled this on 2026-09-02 and both wireframes should be
corrected. See `WIREFRAME-REVIEW-2026-09-02.md`.

### Quick Actions (third column)

`Preview as Student` · `Edit Questions` · `Change Puzzle Image` ·
`Activity Settings`

### Readiness Checklist (third column, below Quick Actions)

The most valuable element in the wireframe: it answers "why can't I publish
yet?" before the teacher asks. Each row is a label plus a state marker.

| Row | Complete when |
| --- | --- |
| `Basic Info` | title, subject and grade level are all set |
| `Puzzle Image` | an image is chosen or uploaded |
| `Questions (10+)` | at least 10 questions exist |
| `Student Options` | the options step has been visited and saved |
| `Ready to Publish` | all four rows above are complete |

`Ready to Publish` is derived, never set by hand. `PUBLISH` is disabled until it
is complete, and the checklist is the explanation for why.

### Lower row

- `Recent Changes` — reverse-chronological list of edits with timestamps
- `Activity Notes` — textarea, placeholder `Add notes about this activity...`,
  helper `(Only you can see these notes)`, `Save Note` button

### Footer

`All changes saved automatically` on the left; `Discard Changes` and
`Save Activity` on the right. Autosave is real, not a label.

## 4. Entry flow

Preceding screens from the wireframe's left column:

**Teacher Studio Home** — `Welcome back, Teacher!` /
`Choose an option to get started.` Four tiles: `CREATE` (active), `IMPORT`,
`LIBRARY`, `MANAGE` — the last three marked `Coming Soon` and not clickable.

**Create Screen** — `CREATE ACTIVITY` (active) and `CREATE ARTIFACT`
(`Coming Soon`).

**Create Activity Flow** — three numbered steps:
`1 CHOOSE ROOM` → `2 ACTIVITY INFO` → `3 ROOM SETTINGS`

**Available Rooms (MVP)** — one entry: `JIGSAW PUZZLE MAKER`,
"Create jigsaw puzzle activities with custom images and questions".

**Teacher flow, end to end:**
`CREATE → QUESTIONS → IMAGE/PUZZLE → PREVIEW → SAVE/PUBLISH`

## 5. Design principle, from the wireframe

> **House owns the system. Room owns the interactions.**
>
> Teacher Studio (House) manages activities, questions, publishing, reports and
> files. Each Room (like Jigsaw Puzzle) owns its own interaction and settings.

Worth preserving as stated: it is what allows a second room later without
rebuilding Teacher Studio.

## 6. Colour and style

| Role | Hex |
| --- | --- |
| Primary | `#6B46C1` |
| Success | `#38A169` |
| Neutral dark | `#2D3748` |
| Neutral light | `#F7FAFC` |

`#38A169` is the **success/valid** colour — the Saved tick and the checklist
ticks — not a brand colour. It stays distinct from the brand green.

**White text on `#38A169` measures 3.25:1 and fails AA for normal text.** Use
dark text on that green, or reserve it for icons and large text only.

---

## Gap table — spec versus `TeacherStudioUI.cs` as of 2026-09-01 23:13

| Item | Built |
| --- | --- |
| Five named tabs | **no** |
| Readiness Checklist | **no** |
| `Subject` field | **no** |
| `Grade Level` field | **no** |
| `PUBLISH` button and gating | **no** |
| Activity Summary panel | **no** |
| Quick Actions panel | **no** |
| `Recent Changes` | **no** |
| `Activity Notes` | **no** |
| Activity title field | yes |
| Board shape selection | yes |
| Learning / Classic / Both | yes |
| Student preview launch | yes |
| Create-activity wizard | yes |

Roughly half the editor exists; the organising structure — tabs, summary,
checklist, publish gate — does not. That structure is what the owner has been
asking for, and it is why each rebuild has felt like it changed everything
except the thing being complained about.

## How to tell when it is done

Every row in the gap table reads `yes`, and every string in sections 1–4 appears
in the build with the exact wording above. That is a checkable condition, which
the image was not.
