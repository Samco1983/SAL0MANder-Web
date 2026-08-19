# Teacher companion dashboard — wireframe systems analysis

Systems analysis for GitHub issue #13. Docs-only, no `src/` change, no
fabricated production data. Non-binding: every wireframe here is a proposal to
review, not a build order. Everything marked **existing** is verified against
the current checkout; everything marked **proposed** carries no approval.

Companion documents: `INFORMATION-ARCHITECTURE.md` (issue #12, owns the route
map this sits inside — `/teacher/*` is reserved there as Batch B, not built),
`GUEST-PLAY-WIREFRAME.md` (issue #14, the student-facing surface this
dashboard distributes links *to*), `INTEGRATION-BLUEPRINT.md` (issue #15, the
end-to-end flow this dashboard is the teacher-facing entry point for).

---

## 0. The one rule this whole document obeys

**Web owns distribution and reporting metadata. Unity owns authoring.**
Restated from `CHARTER-WEB-POINT-PERSON.md`'s division-of-ownership table:
"activity editing · questions · puzzle generation · puzzle image handling"
stay Unity's. Nothing below designs an activity editor, a question builder, or
a puzzle-generation flow. Where a wireframe needs to reference authored
content, it links out to Unity Teacher Studio rather than reimplementing any
part of it.

**No teacher account is assumed to exist.** X-002 (auth provider and account
model) is undecided. Every wireframe below is drawn as if authentication is
already solved, because a dashboard needs *some* teacher identity to be
teacher-facing at all — but the login/account mechanism itself is explicitly
out of this document's scope, and every wireframe screen opens with a note
saying so rather than silently assuming a session exists.

**No student surveillance, no exposed student PII.** This constrains §5
directly: no per-student view exists in this proposal, no student
identification beyond what `D-018`'s teacher-managed roster already allows,
and no raw answer/interaction log. See §5.3.

---

## 1. What exists today — verified against code

Nothing. This is worth stating plainly rather than implying with silence:

- No route under `/teacher` exists in `src/app/router.tsx` — not a stub, not a
  placeholder, nothing (confirmed in `INFORMATION-ARCHITECTURE.md` §1).
- No endpoint lists activities. `src/api/mockTransport.ts`'s `route()`
  function handles exactly four paths: `GET /v1/play/{shareCode}`,
  `GET /guest/activities/{id}`, `POST /sessions`, `POST /sessions/{id}/result`.
  Nothing resembling `GET /activities` (a teacher's own list) exists in the
  mock, the contracts, or `src/api/endpoints/`.
- No endpoint mints or revokes a share code. The three demo codes in
  `MOCK_SHARE_CODES` (`mockTransport.ts:36-40`) are hardcoded fixtures for
  exercising the *resolution* path (ok / revoked / unpublished), not a working
  creation flow — there is no `POST` that produces a new one.
- No endpoint aggregates session results per activity. `sessionsApi`
  (`src/api/endpoints/sessions.ts`) only starts a session and submits one
  result; nothing reads results back, individually or aggregated.

What *does* exist and is directly reusable:

- **`ActivitySummarySchema`** (`src/contracts/v1/activity.ts:34-48`) already
  has every field a dashboard card needs: `title`, `description`, `mode`,
  `visibility`, `thumbnail`, `publishedVersionId`, `createdAt`, `updatedAt`.
  Nothing produces one yet, but the shape a list endpoint would return is
  already typed.
- **`PageSchema`** (`src/contracts/v1/common.ts:25-29`) is cursor-paginated
  and ready for a future activities list — D-008 was decided specifically so
  this would not need to be retrofitted later.
- **`VisibilitySchema`** (`'private' | 'unlisted' | 'public'`,
  `common.ts:33`) exists but nothing assigns or reads it today.
- **`SharePanel`** (`src/components/share/SharePanel.tsx`) is a complete,
  tested, accessible share surface — copy-to-clipboard with fallback, lazy-
  loaded QR (`ShareQr.tsx`), `role="status"` announcement. It already renders
  inside Guest Play's own companion panel for a *different* audience (the
  student, showing the link to a page they're already on). A teacher-facing
  reuse of this exact component is proposed in §4.3 rather than a new one.
- **`ShareCode` / `ShareCodeSchema`** (`src/contracts/v1/share.ts:31-43`) is a
  fully specified wire type — Crockford base32, no ambiguous glyphs, 6-16
  chars — with nothing that mints one server-side yet.
- **D-020's classification** ("Practice / Unproctored Diagnostics",
  `DECISIONS.md`) already forbids treating `SessionResult` as gradebook data.
  Any reports wireframe in this document inherits that constraint directly.

---

## 2. Data available vs. data a dashboard needs

| Dashboard need | Backed by | Status |
| --- | --- | --- |
| List of a teacher's activities | `ActivitySummarySchema` + `PageSchema` | Types exist; no endpoint, no auth to scope "a teacher's" |
| Which version is currently live | `ActivitySummary.publishedVersionId` | Field exists; nothing publishes today (Unity-owned per charter) |
| A share link/code for an activity | `ShareCodeSchema`, `buildShareLink()` (`src/config/routes.ts:30-33`) | Code shape and link-building exist; no mint/revoke endpoint |
| Whether a link is currently active | — | Nothing. `LINK_FAILURES` in the mock hardcodes revoked/unpublished as *fixtures*, not as a live toggle a teacher could flip |
| Aggregate play counts per activity | — | Nothing reads `SessionResult` back. Sessions are write-only from the teacher's perspective today |
| Per-student results | — | Deliberately not proposed here — see §5.3 |
| Teacher identity / auth | — | X-002, undecided |

The gap is total, not partial: every proposed wireframe below is drawn against
data the *schemas* can already represent, with the endpoint and auth layers
explicitly marked missing rather than assumed.

---

## 3. Dashboard overview — proposed, state by state

### 3.1 Signed-out / no teacher session

```
┌─────────────────────────────────────────────────────────────────┐
│  SAL0MANder            Home  Play  Teacher  Profile      [theme] │
├─────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Teacher tools need an account                                    │
│                                                                     │
│   Sign-in is not built yet (X-002). This dashboard cannot show      │
│   your activities without knowing who you are.                     │
│                                                                     │
│   [PlaceholderNotice — pending: authentication, activity list,     │
│    share management, reports]                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘
```
Same `PlaceholderNotice` pattern already used at `/profile` and `/unity`
(`INFORMATION-ARCHITECTURE.md` §1) — this is Batch B in that doc's
implementation table: reserve the route, name what's pending, build nothing
behind it. **This state is the only one this document recommends building
before X-002 lands**, for exactly the reason `/profile` and `/unity` already
exist in stub form: a reserved, honest placeholder is better than a 404 for
anyone who navigates there.

### 3.2 Empty — signed in, no activities yet

```
┌─────────────────────────────────────────────────────────────────┐
│  Your activities                                    [+ New in     │
│                                                        Teacher      │
│                                                        Studio]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                     │
│   No activities yet                                                │
│                                                                     │
│   Activities are created and edited in SAL0MANder Teacher Studio    │
│   (the desktop/Unity app). Once you publish one there, it appears   │
│   here for sharing and reporting.                                   │
│                                                                     │
│   [Open Teacher Studio ↗]  ── external, not a web route             │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘
```
No "create activity" button that leads anywhere in the web app — there is
nothing to lead to, per §0. The only action is a link out, and its target is
undefined (§7 open question: does Teacher Studio have any URL scheme to deep-
link into, or is "Open Teacher Studio" necessarily just instructional text
today?).

### 3.3 Populated — the recent-activities list

```
┌─────────────────────────────────────────────────────────────────┐
│  Your activities                          [+ New in Teacher Studio]│
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ [thumb] Fractions Review                    ● Published     │   │
│  │         Learning Puzzle · v3 · updated 2 days ago            │   │
│  │         [Share ▾]  [View reports]  [Edit in Teacher Studio ↗]│   │
│  ├───────────────────────────────────────────────────────────┤   │
│  │ [thumb] Solar System Match                   ○ Unpublished   │   │
│  │         Classic Puzzle · draft, never shared                 │   │
│  │         [Publish requires Teacher Studio]  [Edit ↗]           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Showing 2 of 2                                        [Load more] │
└─────────────────────────────────────────────────────────────────┘
```
Grounded in `ActivitySummarySchema`: `thumbnail`, `title`, `mode`,
`publishedVersionId` (null → "Unpublished" badge, present → "Published" +
version number from a joined `ActivityVersion.versionNumber`), `updatedAt`.
`[Load more]` maps directly to `PageSchema.nextCursor`. **Nothing here is a
new capability the schema doesn't already anticipate** — the gap is entirely
the endpoint and auth layer named in §2.

Each card's three actions map onto exactly the three things web is
responsible for around an already-published activity: distribute it (§4),
report on it (§5), or hand off to the surface that actually edits it (§6). No
fourth action exists because there is no fourth web-owned responsibility.

### 3.4 Loading

`role="status"`, same pattern as Guest Play's `"Loading activity…"`
(`GuestPlayPage.tsx:314-318`) — text-only, no skeleton screens invented here
since none exist elsewhere in the app to be consistent with.

### 3.5 Error — activity list fetch failed

Same `LinkFailure`-style treatment as Guest Play's recoverable error state
(`GUEST-PLAY-WIREFRAME.md` §3.4): `role="alert"`, `error.userMessage` (never a
raw server string, per `errors.ts:61-78`), a retry button when
`error.retryable` is true. Reused pattern, not a new one — the app has exactly
one error-surface convention today and this dashboard should not invent a
second.

---

## 4. Share actions — proposed

### 4.1 What "share" already means elsewhere in this app

`SharePanel` (§1) is a complete, tested component today, but it answers a
*different* question than a teacher dashboard needs to ask. In Guest Play it
renders `[current page's own URL]` to a student already on that page — there
is no create/revoke/rotate concept, because the link already exists and the
panel is purely presentational.

A teacher dashboard's share action is a **write**: mint a code, optionally
revoke one, and see whether the currently-displayed code is still live. None
of that exists in `src/contracts/v1/share.ts` — `ShareCodeSchema` validates
the *shape* of a code, nothing mints or revokes one.

### 4.2 Share panel — proposed states

```
┌─────────────────────────────────────────────────────────────────┐
│  Fractions Review — Share                                          │
├─────────────────────────────────────────────────────────────────┤
│  Share link                                                        │
│  [https://sal0mander.app/play/K7Q4M2XP..............] [Copy link]  │
│  [Show QR code]                                                    │
│                                                                     │
│  Status: ● Active — anyone with this link can play, no sign-in      │
│                                                                     │
│  [Turn off this link]   [Get a new link (invalidates this one)]     │
└─────────────────────────────────────────────────────────────────┘
```
The link/copy/QR block is `SharePanel`, reused as-is — same component, same
tests, teacher and student read the identical surface for the identical
reason (a link they can hand to someone else). What's new and proposed: the
status line and the two write actions.

**"Turn off this link"** is a proposed name for the operation `LINK_FAILURES`
already models as a *fixture* — `SHARE_LINK_REVOKED`
(`mockTransport.ts:104-122`). The mock can already represent "this link is
revoked" as a response; nothing can *cause* that state from the UI yet. The
button name is deliberately not "delete" — revoking a link must not delete
the activity or its play history, matching D-017's later ruling that a share
code is a separate, killable thing layered over a permanent activity.

**"Get a new link"** is deliberately proposed as invalidate-and-reissue, not
"add a second link." A worksheet already printed with the old code would
silently keep working if codes stacked instead of replaced — the opposite of
what a teacher pressing this button would expect ("the old one shouldn't work
anymore"). This is a proposed design choice, not one derived from any
existing code, and is flagged as a product decision in §7.

### 4.3 Share panel — blocked-by-D-017 state

```
┌─────────────────────────────────────────────────────────────────┐
│  Solar System Match — Share                                        │
├─────────────────────────────────────────────────────────────────┤
│  This activity can't be shared by link                             │
│                                                                     │
│  It uses a photo or audio clip you uploaded. Custom media stays     │
│  restricted to your class roster — see D-017. Class-level sharing   │
│  is not built yet.                                                  │
└─────────────────────────────────────────────────────────────────┘
```
Directly enforces `DECISIONS.md` D-017's resolution: *"don't make it a link
unless photo is premade"* — an activity referencing custom-uploaded media
must never be reachable through an anonymous shareCode. This state exists in
the wireframe **specifically so no future implementation accidentally skips
it** — the enforcement itself must be server-side (D-017 says so explicitly:
"client-side checks are not sufficient"), but the UI still needs a state that
tells the teacher *why* the share button is unavailable rather than showing
them a broken or missing one.

### 4.4 Share panel — no version published yet

```
┌─────────────────────────────────────────────────────────────────┐
│  Solar System Match — Share                                        │
├─────────────────────────────────────────────────────────────────┤
│  Publish this activity first                                       │
│                                                                     │
│  A share link points at a published version. Publish from Teacher   │
│  Studio, then come back here to share it.                           │
└─────────────────────────────────────────────────────────────────┘
```
`publishedVersionId: null` (`ActivitySummarySchema`) is already a
representable state; this is its wireframe. No share code can exist for an
activity with nothing published — consistent with `ActivityVersion`'s
append-only, publish-is-separate-from-authoring model
(`activity.ts:50-56`).

---

## 5. Reports — proposed, and deliberately the most constrained section

### 5.1 The classification banner is not optional

`docs/DECISIONS.md` D-020: *"`questionsCorrect` is computed by the client,
from an answer key the client can read, and submitted by the client. It must
never back a gradebook, mastery report, standards-attainment view, or
anything a teacher would read as assessment."* This is a hard constraint
carried into every wireframe in this section, restated from
`INFORMATION-ARCHITECTURE.md` §4.2, which named it a constraint on this exact
document before this document existed.

```
┌─────────────────────────────────────────────────────────────────┐
│  Fractions Review — Activity summary                               │
│  ⚠ Practice data, not verified. See "what this means" below.       │
├─────────────────────────────────────────────────────────────────┤
│  Plays: 34        Completed: 29        Avg. duration: 4m 12s        │
│  Avg. questions correct: 71%  (self-reported by the browser,        │
│                                  not proctored — see below)          │
│                                                                     │
│  ▾ What this means                                                  │
│    These numbers come from the student's own device after they      │
│    play. There's no sign-in and no server-side answer checking,      │
│    so a determined student could see answers in advance. Use this    │
│    for a sense of engagement, not as a grade or mastery record.      │
└─────────────────────────────────────────────────────────────────┘
```
The warning is not a tooltip or a footnote — it is the first thing on the
screen, above the numbers, per D-020's instruction that a reports UI "must
carry that classification in its own UI, not just in a doc."

### 5.2 Empty — no plays yet

```
Plays: 0
No one has played this activity yet. Numbers will appear here once
students start using the share link.
```
Plain, no invented engagement-nudge copy — this document does not design
growth/engagement features, only the state itself.

### 5.3 What this section deliberately does NOT propose

Named explicitly because "not designed" and "silently deferred" read
identically if left unstated:

- **No per-student breakdown.** Guest Play's `PlayerIdentity` is either an
  anonymous device token (`GuestIdentitySchema`, no PII) or, in the far
  future, a claimed profile (X-002). Nothing today associates a session with
  a named student except the optional, teacher-managed roster D-018
  describes for the *student → teacher* sharing direction specifically — and
  that roster attribution happens at submission time, by the student picking
  their own name from a list the teacher built, never by the teacher reading
  raw device data back. A per-student table is not wireframed here because it
  would require solving that attribution model first, and this document does
  not do product design work D-018 already scoped elsewhere.
- **No answer-by-answer or interaction log.** `SessionResultSchema`
  (`session.ts:59-69`) is aggregate-only by design — `questionsAnswered`,
  `questionsCorrect`, counts, not a list of which question got which answer.
  A reports UI can only ever show what the contract carries; showing more
  would require a contract change this document is not authorized to propose
  (issue #13's DO NOT: "no contract freeze" extends to no contract
  *expansion* either, without it being named as a proposal to Codex first).
- **No raw guest token surfaced to a teacher.** `/profile` shows a truncated
  token to the guest who owns it (`ProfilePage.tsx:23`); nothing proposes
  a teacher-facing view of any student's token, which would let a teacher
  correlate a specific device across activities without that device's owner
  choosing to be identified.

---

## 6. Links back to Unity-owned authoring

Every "Edit in Teacher Studio" / "Open Teacher Studio" affordance in §3–§4 is
drawn as an **external link**, never an embedded surface, per the charter's
ownership boundary. What this document cannot answer, because it is outside
web's authority to decide alone (`DECISIONS.md` X-009/X-010/X-011 pattern —
seam questions are joint, not unilateral):

- Does Teacher Studio expose any URL scheme or protocol handler an "Edit in
  Teacher Studio ↗" link could target, or is that necessarily inert/
  instructional text until Codex defines one?
- If Teacher Studio is a downloaded desktop app rather than something a
  browser link can open, what should this button actually say and do —
  "Download Teacher Studio," a deep link, or nothing until that's designed?

Recorded as open questions for Codex in §7, not answered here.

---

## 7. Privacy, authorization, and empty-state questions — listed, not resolved

1. **Auth model (X-002).** Every wireframe in §3–§5 assumes a teacher session
   exists. Nothing here proposes how that session is established, what a
   "teacher" role check looks like, or how COPPA/FERPA-relevant consent
   interacts with it — all explicitly deferred per the charter and D-017's
   own note that "a disclaimer does not transfer COPPA/FERPA obligations."
2. **Scoping "your activities."** `ActivitySummary.authorId: ProfileId |
   null` exists, but nothing today enforces that a teacher can only list or
   act on activities they authored. This is a server-side authorization
   question, not a UI one — the dashboard's list view in §3.3 is only ever as
   safe as the list endpoint's own filtering, which does not exist yet to
   audit.
3. **Link-revocation propagation.** §4.2's "Turn off this link" implies a
   currently-playing student's session should not be retroactively broken —
   `PlaySession.activityVersionId` is pinned at start (`session.ts:47`), so
   an in-progress game likely continues unaffected while new resolutions
   fail. Not verified against any backend, because no backend exists;
   flagged so whoever builds the mint/revoke endpoint decides this
   deliberately rather than by accident.
4. **Reissue vs. multiple live links.** §4.2 proposes invalidate-and-replace.
   Whether a teacher might legitimately want several simultaneous live links
   to the same activity (e.g., one per class period, so each can be revoked
   independently) is a real product question this document raises but does
   not decide.
5. **Report visibility to whom.** If a school later wants an admin or a
   second co-teacher to see the same reports, that's a sharing/permissions
   model this document does not design — flagging that "reports" implicitly
   assumes a single-teacher-per-activity ownership model that may not hold.
6. **Empty-state copy for "no share history."** §3.2 and §5.2 are drawn;
   what's not addressed is whether a *revoked* link should still show in
   history (so a teacher can see "this used to be shared, I turned it off")
   or disappear entirely — an audit-trail question with no answer proposed
   here.

---

## 8. Safe implementation slices — independent, reversible

Mirrors `INFORMATION-ARCHITECTURE.md` §6's batch structure, scoped to this
surface specifically. None of these is authorized by this document — they are
what becomes buildable once their stated blocker clears.

**Slice A — reserve `/teacher` (no approval needed, already named as Batch B
in `INFORMATION-ARCHITECTURE.md`).** §3.1's signed-out placeholder only.
Ships nothing this document designs beyond that one state.

**Slice B — activities list, read-only (blocked on X-002 + a list endpoint).**
§3.2/§3.3/§3.4/§3.5. Needs: teacher auth, a `GET /activities` (or equivalent)
endpoint scoped to the caller, and the mock transport extended to serve it —
none of which exist. Reversible: a read-only list adds no write surface and
can be pulled without data loss.

**Slice C — share mint/revoke (blocked on B + a share-management endpoint).**
§4.2/§4.3/§4.4. Needs an endpoint this document does not design (out of
scope: "no backend/auth/provider selection"), and needs Codex/product input
on §7 item 3 (revocation propagation) before the revoke half ships — the
mint half (read-only display of an existing/created code) could plausibly
ship before revoke does, as its own sub-slice.

**Slice D — reports (blocked on B + a results-aggregation endpoint + D-020's
banner treatment carried through design, not just this doc).** §5.1/§5.2.
The classification banner is a **hard requirement on this slice specifically**
— per D-020, this cannot ship without it, unlike A-C where the constraint is
"blocked on a decision," this one is "blocked on a decision, and even once
unblocked, must ship with a specific piece of UI intact."

Each slice is independently pull-able: none is load-bearing for another to
keep working, matching the reversibility bar `INFORMATION-ARCHITECTURE.md`
§6 already sets for the rest of the IA.

---

## 9. What this document does not claim

No screen above works today. No endpoint named in §2's gap table exists. No
teacher has ever seen any of this. This section exists because issue #13's
own acceptance criteria required it stated explicitly: **this is a proposal
for review, and a "not yet built" label on every wireframe is not decoration
— it is the actual state of the surface.**
