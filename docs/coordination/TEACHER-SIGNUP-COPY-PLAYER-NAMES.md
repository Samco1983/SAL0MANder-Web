# Teacher signup copy — setting the no-real-names expectation

**Draft copy, pending the teacher-auth decision.** The signup screen does not
exist yet; this is the wording to use when it does, and the reasoning behind it.

Owner's ask, 2026-08-30: tell the teacher at signup, and word it so students end
up using nicknames rather than real names.

## Why the teacher is the right place to say it

Kahoot does exactly this, and it is the reason their nickname model holds up in
K-12: the product does not police names, it sets the expectation with the adult
who is standing in the room. A filter cannot reliably tell "Emma R" from "Ember"
and would reject plenty of harmless handles while missing real names anyway.

The teacher can say one sentence to thirty kids in three seconds. That is a
better control than anything the software can do, and it costs nothing.

## The copy

Shown once, at signup, near the finish button:

> **Students never make accounts.**
> You share a link, they play. No emails, no passwords, nothing for you to
> manage or reset.
>
> Players pick a name like **Player 1** or make one up. Ask your class to use a
> nickname rather than their real name — we don't need it, and it keeps their
> information out of it entirely.

Then a quieter line beneath:

> Names stay on the student's own device. We never see them.

## Why it is worded this way

**It leads with what the teacher gains.** "Nothing for you to manage or reset"
is the sentence that matters to someone who has spent a prep period resetting
passwords. The privacy point rides along behind it instead of opening with a
legal warning, which reads as a liability disclaimer and gets skipped.

**It says "ask your class", not "do not enter real names".** The teacher is the
one who can act on it. A prohibition aimed at the teacher is aimed at the wrong
person.

**"We don't need it" is the honest reason.** Not "for compliance", not "for
safety" — the product genuinely does not use a real name for anything. Saying so
plainly is more persuasive than a policy citation, and it is true, which matters
if a district ever asks.

**"Names stay on the student's own device"** is the strongest sentence available
and it is currently accurate — handles live in `localStorage` and never leave.
It must be deleted the moment that stops being true. Shipping it while sending
handles to a backend would be a false privacy claim, which is worse than saying
nothing.

## Where else this belongs

- **The player picker itself**, as placeholder text: `Player 1` prefilled, not
  an empty box. A blank field invites a real name; a filled one rarely gets
  changed. Implemented — see `PRESET_HANDLES` in `src/auth/playerProfiles.ts`.
- **Teacher share dialog**, one line: "Students won't be asked for an account."
- **NOT on the student-facing screen.** A child reading "don't use your real
  name" is being handed a worry they did not have. The preset already solves it.

## Constraint on any future edit

If teacher accounts ever gain a roster feature, or handles are ever stored
server-side, this copy becomes false and must change in the same release. See
`DECISION-PLAYERS-NOT-STUDENTS.md` for what that would cost.
