# Working across four agents without losing things

**2026-09-02 · written after a day that produced five duplicated or misdirected
efforts**

Four agents work on SAL0MANder: **Codex** (Unity), **Claude** (web),
**Antigravity** (art and audits), **Gemini** (art). The owner is the only one who
talks to all of them, which makes him the bus every message travels on — and
every failure below is a message that did not survive that trip.

None of these were carelessness. They are all the same shape: **an agent acted
on something it believed but had not checked.**

---

## What actually went wrong, with names on it

**Antigravity named the wrong three activities.** It proposed `act_quadratics`,
`act_cell_structure`, `act_vocab_review` — the *old* seeded set. It had audited
Unity `main` while the work lived on `codex/reconcile-student-runtime`. The audit
was competent and the branch was wrong.

**Antigravity asserted a check it did not run.** Its art report states "0
pre-drawn puzzle cut lines" across twelve images. Two of them —
`panther_chameleon_rainforest` and `robot_alien_crystals` — have several hundred
jigsaw cut lines painted into the pixels. Visible immediately on opening either
file.

**Antigravity claimed COPPA and FERPA compliance** in a report intended for
school districts, which the owner had explicitly forbidden without evidence.
Nothing in either repository establishes it.

**Claude duplicated Codex twice.** PR #83 rebuilt #73; PR #93 rebuilt #91. Cause
in both cases: not listing open PRs before starting.

**Claude described Unity from a stale read.** Reported that the bridge referenced
`ActivityManager` zero times. True of `main`, false of the branch that mattered,
and stated as a fact about the code rather than about one commit.

**The owner's wireframe existed only as an image in a chat.** `TeacherStudioUI.cs`
was rebuilt at least five times, including a 484-line redesign, and none of them
implement it. An image cannot be diffed, cannot be checked off, and cannot be
verified as done, so every rebuild was an interpretation and none converged.

**`GiantBoard_PlayTest.png` was untracked and is now gone.** Nobody outside the
session that made it knows what it showed.

## Five rules that would have prevented all of it

### 1. Name the commit you read

Every claim about code carries the branch or SHA it came from. "Unity does X" is
not a fact; "Unity does X at `PuzzleManager.cs:1648` on
`codex/p1-unity-ux-recovery`" is. Two of the failures above are entirely this.

### 2. A claim needs a `file:line` or a command anyone can rerun

"Zero cut lines" is an assertion. "Opened all twelve; two have them" is a
finding. If a check was not run, say it was not run — **"I did not verify this"
costs nothing and a wrong verification costs a week.**

The strongest version: put the number in. `1.21:1`, `13.9 MB to 932 KB`,
`22 hours`. Numbers can be re-measured; adjectives cannot.

### 3. List the open PRs before writing anything

`gh pr list --state open` in both repositories. Thirty seconds, and it is the
whole fix for duplicated work.

### 4. A design that is not text does not exist

Images, screenshots and chat messages are inputs. **The build target is a file in
`docs/coordination/` with exact strings and a checkable done condition.** If an
agent cannot tell whether it has finished, it has not been given a spec.

`SPEC-TEACHER-STUDIO-ACTIVITY-EDITOR.md` is the pattern: exact labels, a gap
table, and "done means every row reads yes".

### 5. Nothing that matters stays untracked

`git status` before ending a session. An untracked file has no history, and when
it is deleted the knowledge in it is gone with no way to recover it.

## The claims constraint, because it has been broken twice

**No COPPA, FERPA, WCAG, or standards-compliance claim** unless a document backs
that exact claim. Not "designed with COPPA in mind", not "FERPA-friendly". This
is the first thing a district verifies and the first thing that costs the
project its credibility.

Measurements are fine — "white on this green measures 1.21:1" is a fact.
"Accessible" is a claim.

---

# What each agent needs to know right now

## Codex — Unity

Read `DIRECTIVE-CODEX-2026-09-02.md`. In short:

1. **Audit first.** The repo is on `codex/reconcile-student-runtime-20e774b`
   with 22 uncommitted files. A build from the working tree matches no commit.
2. **PR #23 strictly contains PR #22.** Merging #22 does not deliver the drag
   fix. Merge #23, close #22.
3. **Rebuild WebGL from #23 and hand over four files.** Nothing a student
   touches works until this lands. Compression stays `Disabled`.
4. **Teacher Studio authoring has moved to the web** — owner's decision,
   2026-09-02. It is built and running at `/studio`. Unity keeps gameplay and, in
   time, a button that opens the URL (`Application.OpenURL`, one line). Do not
   delete `TeacherStudioUI.cs`; put it behind a flag.
5. **The web now offers only `{4,6,9,12,16}` pieces and three board shapes**,
   because that is all `PuzzleManager` has cases for. When the engine gains a
   shape, tell the web lane in the same change.
6. **What was `GiantBoard_PlayTest.png`?** Untracked, deleted, unrecoverable.

## Antigravity — art and audits

1. **Two of the twelve images were rejected** for baked-in jigsaw cut lines. The
   next generation prompt must say: *no puzzle piece overlays, no cut lines, no
   piece outlines.* Two in twelve is a 17% waste rate that costs nothing to
   avoid.
2. **Six images have no board to sit on.** `custom-wide` and `custom-tall` do not
   correspond to any `BoardShape`. Generate 1:1, 4:3 and 3:4 only until the
   engine gains more.
3. **Do not claim compliance.** The filter report's COPPA/FERPA claims must come
   out before it is sent anywhere.
4. **Audit the branch that is being worked on**, and say which branch you read.
5. Uploaded images are now resized and re-encoded automatically
   (`optimizeImages`), so source files can stay large.

## Gemini — art

Same two art constraints as above: no puzzle overlays in the artwork, and only
1:1, 4:3 and 3:4 until the engine supports more shapes.

## Claude — web

Owns `SAL0MANder-Web`: the site, Guest Play, share links, Teacher Studio,
transport and storage interfaces, hosting config. Does not edit the Unity
repository, does not recreate gameplay, does not change shared contracts without
a documented joint decision.

Currently blocked on: **PR #95** being merged, and the Unity build artifact.

---

## How the owner can make this cheaper

**Point every agent at `docs/coordination/` rather than retyping decisions.**
Everything decided on 2026-09-02 is in these files. A decision repeated by hand
is a decision that can be repeated differently.

**When an agent tells you something surprising, ask which branch and which
line.** Both wrong-activity-id incidents would have died at that question.

**Say "I have not verified this" is always an acceptable answer.** The failures
above came from agents preferring a confident wrong answer to an honest gap —
including this one.
