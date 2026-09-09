# If I had to gamify it

**2026-09-02 · SAL0-04 Claude · proposal, not a work order**

Owner asked what I would do to gamify the game. This is an opinion, grounded in
what the code already contains. Lane is Codex; nothing here is built by Web.

## The core loop is already right. Do not add a second one.

Answer a question -> earn a piece -> the picture uncovers itself.

That is a complete game loop and a good one. The code says so out loud:
"the board remains the reward surface" (`PuzzleOptionsUI.cs:4428`).

**The most common way to ruin an educational game is to bolt a currency onto a
loop that already works.** Coins, gems, a shop, badges — each is a second
economy that competes with the first, needs balancing forever, and quietly
teaches that the puzzle is the chore you do to buy things. The picture is
already the prize. Amplify that; do not compete with it.

So: no coins, no shop, no badges, no XP bar. My recommendation is that the
piece-cost schedule stay shelved permanently, not just deferred.

## What I would do, in order

### 1. Make the combo visible — it already exists

`comboSnapCount` (`PuzzleManager.cs:101, :1824-1836`) already escalates audio
pitch across up to six consecutive fast snaps. It is the best game feel in the
build and **nothing on screen shows it.**

Show it. A rising streak marker, the pitch it already plays, done. This is
surfacing finished code, not new design.

### 2. Score first-try accuracy, because it is the only honest score

`QuizManager` already records `isCorrectOnFirstTry` per question and computes
`GetFirstTryAccuracyPercentage()` (`:118-126`). It is shown to teachers in
`ReportsUI` and never to the student.

Use it as *the* score. It rewards thinking before answering rather than
guessing through four options, and it cannot be farmed by grinding. Every other
scoring scheme has to be invented and balanced. This one is written and correct.

### 3. Streak that builds but never punishes

A wrong answer should not subtract. It should simply not advance the streak.
`isCorrectOnFirstTry` already provides the signal.

Subtraction in a classroom tool punishes the student who most needs another
attempt, in front of the people whose opinion they care about most. Build-only
streaks keep the pull without the sting.

### 4. Give the picture an identity before it is earned

The strongest lever available and it costs no systems work: **the student should
want to know what the picture is.** Mystery Reveal already exists
(`autoPlaceCorrectPieces`, `PuzzleOptionsUI.cs:2453`).

A title card before question one — "Uncover: The Solar System" — turns twelve
questions into one question with twelve steps. Anticipation is the cheapest
engagement mechanic ever invented and this game is built for it.

### 5. Sound, because silence is the loudest problem

There is no music at all, and every effect is synthesized in C# at runtime
(`GAME-FEEL-AUDIT-2026-09-02.md`). One ambient loop plus real snap and chime
samples will do more for "does this feel professional" than every mechanic
above combined. A silent game reads as a prototype no matter how good it is.

## What I would refuse to add

- **Leaderboards.** In a classroom, a public ranking tells the bottom third
  something about themselves every single session. The cost lands on exactly
  the students the tool exists to help.
- **Timed pressure.** Keep the timer as a record of what happened, never as a
  countdown. Pressure narrows thinking, which is the opposite of the point.
- **Lives, hearts, or lockouts.** A student who runs out mid-lesson is a
  student sitting idle in a classroom with a teacher who cannot fix it.
- **Daily streaks / login rewards.** School attendance is not the student's
  decision. Punishing a Tuesday absence is punishing the wrong person.

## On the word "addictive"

Worth saying plainly, because it was the word in the question.

Addictive is the wrong target for a classroom tool, and not for squeamish
reasons: a teacher needs the lesson to **end**. A mechanic optimized to prevent
stopping is a mechanic that fights the bell, and the teacher will stop assigning
it. It is also the fastest way to fail a district review.

The right target is **"one more"** — a student who reaches the end of a puzzle
and wants the next one. That comes from a satisfying finish, not a hook that
resists closing. Everything above aims at the finish.

## Sequencing

Items 1 and 2 are surfacing code that already exists and could ship with the
next build. Items 3-5 are real work and sit behind the six things in
`LAUNCH-BAR.md` — item 4, re-drag after a wrong drop, is still not deployed.

A game that cannot re-drag a piece does not need a streak counter yet.

---

## Addendum — the owner is right, and the machinery is already there

**Same day.** Owner pushed back: extra sound effects, lighting, special sounds
on streaks. That instinct is correct and this document undersold it. Correcting.

The build already contains the juice machinery:

| Effect | Where |
| --- | --- |
| Glow outline / glow line | `PuzzleManager.cs:62, :129` |
| Unlock pulse — scale to 1.22x, 10Hz green blink | `DockSlotUI.cs:29, :111, :204-208` |
| Particle bursts (20 systems) | `PuzzleManager.cs`, 30-particle burst at `:1887` |
| Shimmer stage in the chime | `PuzzleManager.cs:485` |
| Streak counter | `comboSnapCount`, `:101, :1824-1836` |

**The defect is not that juice is missing. It is that none of it escalates.**

Piece 1 fires exactly the same glow, the same burst, the same pulse and the same
chime as piece 12. `comboSnapCount` climbs to 6 and is spent on pitch alone
(`:1836`, `targetPitch = 1.0f + comboSnapCount * 0.08f`). Everything else
ignores it.

### The fix is a multiplier, not new features

Feed `comboSnapCount` into what already runs:

- **Particles**: burst count scales with the streak instead of a flat 30.
- **Glow**: outline intensity and colour warm as the streak climbs.
- **Pulse**: `TriggerUnlockPulse` amplitude grows — a bigger pop at streak 5.
- **Sound**: pitch already rises. Add a distinct layered chime at 3 and 6 so a
  streak *sounds* different, not just higher.
- **Break**: when the streak resets, everything drops back at once. The
  contrast is what makes the climb feel earned.

Each is a coefficient on an existing call site. No new systems, no new assets
beyond audio samples, and no second economy.

This is the cheapest big win in the game and it is fully inside item 1 of the
proposal above ("make the combo visible") — it just turns out that "visible"
means *escalating*, not a number in the corner.

### Still true

Escalating juice does not replace the audio problem. Every sound is still
synthesized at runtime and there is still no music. A louder synthesized beep at
streak 6 is still a synthesized beep.
