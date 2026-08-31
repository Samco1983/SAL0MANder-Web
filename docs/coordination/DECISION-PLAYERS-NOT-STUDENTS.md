# Decision — they are players, not named students

**Owner decision, restated 2026-08-30.** Already implemented in code; recorded
here because it was never written down as a decision, and it is the one that
carries legal weight.

**Fold this into `docs/DECISIONS.md` as a numbered D-entry.** It is a ruling,
not a finding, and coordination notes are not where rulings should live.

## The decision

A person playing SAL0MANder is a **player**, identified by a self-chosen handle
or nothing at all. Not a student, not a real name, not a roster entry.

## What already implements it

`src/auth/guestIdentity.ts`:

- a device-local random token — "no email, no password, no account, no name
  prompt"
- an optional `displayName`, self-chosen, capped at 40 characters
- explicitly not authentication: no PII, never sent as a bearer token, grants
  access to nothing beyond a session the same device created
- a blank or whitespace-only value is treated as absent rather than stored as a
  name, so a submitted-empty field never becomes a label the UI renders

## Why it matters more than it looks

**This is what keeps SAL0MANder out of COPPA.** `src/auth/README.md` flags
student identity as a product/legal question — COPPA, FERPA, district
procurement — and warns it is "not an engineering one." That warning applies to
collecting student identity. Collecting none of it is what makes the warning
moot.

It also collapses the auth problem by half. If players never sign in, the only
account system that has to exist is **teacher accounts**, where the users are
adults and the legal picture is ordinary. That is a much smaller decision than
the one still marked open.

## The Kahoot pattern is fine — and presets are better than a blank box

Kahoot lets a player type a nickname with no account, and it is used across
K-12. A handle is not personal information while it stays untied to a real
identity and uncombined with other data about that child. Kahoot's own guidance
tells teachers to instruct students not to use real names.

So a picker offering **"Player 1 / Player 2"** with an optional custom handle is
not a workaround of that model — it is a stricter version of it. A blank field
invites a real name; a preset means most players never type anything.

**The risk is not the field. It is where the value goes.** Today `displayName`
lives in `localStorage` and never leaves the device, so nothing about a child is
stored server-side — nothing to breach, disclose, or delete on request. Sending
that handle to a backend and saving it beside scores is what turns it into
retained data about a minor, and that is a district-procurement conversation.

Keep it device-local for as long as the product allows. Teachers need results in
aggregate; the handle exists so a player recognizes their own screen.

## What this forbids

Do not add, and treat any of these as a reversal requiring owner approval:

1. A field that asks for a **real** name — "your name", "first name", a roster
   pick. A self-chosen handle or a `Player N` preset is explicitly fine.
2. Student email, class roster import, or district SSO for players.
3. Sending the guest token to a backend as proof of identity — it is a
   correlation hint. Any backend that accepts it as identity has turned a
   non-credential into one.
4. Anything that makes a player sign in before playing. Guest Play stays
   ungated; accounts add persistence, never access (CLAUDE.md non-negotiable 3).

## What stays open

Teacher accounts. Unchanged, and now the only auth fork that has to be resolved
for the product goal — teachers signing up and using SAL0MANder over school wifi
or as an installable app.
