# Open items register

## W-18 — bridge observability audit still needs one real Unity receiver pass 🟠

**Partially shipped in `140affd`; issue #5 remains open for the cross-system
questions.**

Web now distinguishes and can safely summarize these bridge failure classes:

- malformed bridge traffic;
- contract-version skew;
- unknown inbound message type;
- wrong-direction inbound messages;
- Web → Unity delivery failure when the Unity instance, GameObject, or method is
  missing.

The privacy boundary is explicit: `BridgeMismatch.detail` may still exist for
in-process debugging, but `summarizeBridgeMismatch()` is the shape to paste into
logs, issues, screenshots, or support notes. It does not carry share codes,
activity payloads, URLs, result metrics, or user-entered values.

### Still needs Codex / Unity confirmation

1. Does the real Unity build emit `unity-ready` only after the receiver
   GameObject and method exist?
2. What is the exact C# receiver GameObject and method name for `boot`,
   `session-started`, and `set-paused`?
3. Should `contract-mismatch` be a Unity → Web event in production, or only a QA
   diagnostic?
4. Should QA see summarized bridge mismatches in a visible debug drawer, or are
   console diagnostics enough until the first real WebGL build is wired?
5. Duplicate-init behavior still needs a real build pass: the web side dedupes
   inbound `eventId`, but only Unity can prove whether startup emits one
   receiver-ready event or several.

Do not freeze or rename DTOs to answer these. The next safe shot is either a
receiver contract note from Unity/Codex, or a browser-visible QA diagnostic that
uses `BridgeMismatchSummary` only.

## W-16 — ✅ RESOLVED — a reload destroys the held result, and the app looks fine afterwards

Resolved 2026-08-19 in `f6aeac5 web: persist a held undelivered result across a
reload (W-16)`, against the 2026-08-19T08:05Z supervisor authorization (narrow
design: `sessionStorage` only, scoped to the live attempt, no `localStorage`,
no PII expansion, schema-validated, fails closed on malformed/stale data).

### What shipped

`src/routes/guest-play/resultHold.ts` — a small, versioned, schema-validated
`sessionStorage` record for the one held result, keyed by activity version the
same way `startKeyFor` is:

- `saveHeldResult` / `loadHeldResult` / `clearHeldResult`, all `sessionStorage`
  only (never `localStorage` — a new tab must not inherit a stranger's result,
  same reasoning as `startKeyFor`'s choice, D-005-adjacent);
- `HeldResultRecordSchema` (zod, `SessionResultSchema.omit({sessionId:true})`
  plus an optional `{ id: SessionId }` session ref) — a missing key, malformed
  JSON, a schema-version bump, or a shape mismatch all read as "nothing held."
  Trusting a malformed record would render a notice, or retry a write, built
  from data this build doesn't understand;
- data minimal by construction: no identity, no status, no timestamps beyond
  what the result itself carries. Not the full `PlaySession` — a new
  `HeldSessionRef = { id, activityVersionId }` type replaces it in
  `submitting`/`result-undeliverable` state, since that's all `deliver` ever
  used, and it's honestly all a rehydrated record can supply.

`usePlaySession.ts` rehydrates on the session-start effect's first live run
only (`attempt === 0`) — before any network call, and *before* `api.sessions
.start` — checking storage on a later run (always a deliberate `retryDelivery`)
would find the very record that retry is trying to clear and restore the same
notice forever instead of ever calling `start`. A record whose `attemptId`
doesn't match the live one belongs to a superseded attempt (a previous student
on a shared device, or an abandoned attempt) — ignored, and cleared so it
doesn't sit stale forever. Persisted on both failure routes (`POST /sessions`
rejecting, `POST /sessions/{id}/result` rejecting) and cleared on confirmed
delivery and on `reset()` (play-again, not yet wired to any UI — see W-14).

The already-shipped copy fix (this device → this tab) needed no further
change: it was already accurate, and is now also *more true* than it claims —
a reload no longer loses the result at all on the routes tested.

### Evidence

- `npm run verify` green: lint, typecheck, **48 files / 540 tests**, build.
  517 tests before this batch (17 new: 12 unit tests on `resultHold.ts`, 5
  integration tests in `resultRehydration.test.tsx`).
- Integration tests model a reload as `unmount()` + a fresh `render()` of the
  same route *without* clearing storage in between — the one thing an actual
  reload does that `beforeEach`'s `sessionStorage.clear()` must not — and redo
  the Unity `ready`/`mode-selected` handshake after remounting, since a real
  reload restarts Unity too and `chosenMode` is ordinary React state with no
  memory of a prior pick.
- Every mutation checked, not merely asserted-and-trusted:
  - removing the submit-failure persist call fails 3 tests (restore, retry,
    new-tab-isolation);
  - removing the `attempt === 0` guard (checking storage on every effect run,
    including a deliberate retry) fails 1 — the start-failure retry never
    calls `start`, the record is restored and cleared before it can, an
    infinite restore loop with no diagnostic beyond a `waitFor` timeout;
  - removing the `attemptId` match check (restoring any record regardless of
    whose attempt it belongs to) fails 1 — the superseded-attempt test;
  - replacing the schema-validated parse with a bare cast (no fail-closed)
    fails 3 — malformed JSON, a missing-field shape, and a future schema
    version all round-trip data this build should have refused.
- One race in the tests themselves, not the app: `waitFor(() =>
  queryByRole('alert')).not.toBeInTheDocument())` can pass the instant the
  transient `submitting` state renders (which is also alert-free), before
  delivery has actually resolved either way — caught by a stricter follow-on
  assertion (`sessionStorage` cleared) that the looser one let through
  prematurely. Fixed by waiting on the definitive signal (storage cleared)
  before checking the alert, in both retry-success tests.

### Deliberately not covered

`reset()`'s `clearHeldResult` call has no test, same as the rest of `reset()`
(W-14): it isn't wired to any UI ("play again" doesn't exist yet), so a
targeted test would be exercising unreachable code rather than the product.

<details>
<summary>Original finding (kept for the reasoning)</summary>

**Raised 2026-08-19. The last silent-loss path in the W-10 → W-13 chain, and
the one a student is most likely to trigger.**

`result-undeliverable` holds the result in React state and `pendingResultRef`
holds it in a ref. Neither survives a reload. The idempotency *keys* were
carefully made durable — `startKeyFor` writes to `sessionStorage`, `resultKeyFor`
is a pure function — but **the result payload itself is written nowhere**.
`grep -rn "sessionStorage\|localStorage" src/routes/guest-play/` returns
`idempotency.ts` and nothing else.

So: a student finishes, the submission fails, the notice appears, the retry
fails too, and the student does the most ordinary thing anyone does with a page
that looks stuck — reloads it. The numbers are gone, and Unity has restarted, so
they cannot be produced again.

### Why it is worse than plain loss

Proven with a temporary Vitest case driving the real bridge and the real mock
transport, then deleted (`git log --all -- src/routes/guest-play/__scratch-w16.test.tsx`
is empty):

```
BEFORE RELOAD: notice shown, attempt OVsmrPrtNb8Pu_A1, submits 1
AFTER RELOAD:  attempt OVsmrPrtNb8Pu_A1 | notice present: false
               storage: [ sal0mander.session.startKey.demo-version-1,
                          sal0mander.guest.token ]
```

The attempt id **survives** — which is what W-13 built it to do. On reload the
page re-runs `POST /sessions` under that same key, the server returns the same
session, and the student is shown an ordinary, healthy, ready-to-play screen.
There is no notice, no error, no marker of any kind. A completed result was
destroyed and the app's own evidence says everything is fine.

That is the exact silence W-10 ruled against, reached by a route none of W-10,
W-12 or W-13 covered, and it is *invisible to the whole existing test suite*
because every test lives inside one page lifetime.

### The copy is currently false — ✅ fixed independently of the ruling below

`UndeliveredResult` told the student **"This device is holding your result
until it can be saved."** The device was not holding it. The *tab* was, until
it was reloaded or closed. That did not need to wait on the storage ruling
below — it was a standalone false claim, not a build decision — so it shipped
separately: both branches now say "keep this tab open" and name the actual
loss condition (reload/close) instead of implying durability. Mutation-verified
(`git log -- src/routes/guest-play/GuestPlayPage.tsx` / `undeliveredResultSurface.test.tsx`):
reverting the copy to the old sentence fails the new assertion.

This does not resolve W-16 — the result is still genuinely lost on reload,
only the notice no longer claims otherwise. The `sessionStorage` fix below is
still open and still needs the ruling.

### Proposed fix — needs a ruling first

Write the held result to `sessionStorage` beside its start key, keyed by
`clientAttemptId`, and rehydrate into `result-undeliverable` on mount when a
held result is found for the live attempt. `sessionStorage` and not
`localStorage` for the same reason `startKeyFor` chose it: a reload should
resume, a new tab should not inherit a stranger's result. Clear on delivery,
which is the only place `clearStartKey` already fires.

Three things need an owner/Gemini call before this is built, which is why it is
recorded rather than shipped:

1. **Data at rest.** A `SessionResult` is metrics only — `durationMs`,
   `questionsAnswered`, `questionsCorrect`, `piecesPlaced`, `piecesTotal`,
   `completedAt` — with no name, email or free text, so the privacy exposure is
   low. It is still the first time this app writes a *student's work product* to
   a shared device, and shared devices are the norm in a classroom.
2. **Retention.** `sessionStorage` dies with the tab, so an unrecoverable
   result is discarded when the tab closes. That is a TTL decision by
   implication, and it belongs with the unresolved candidate-TTL/retention item.
3. **Whether the rehydrated notice may claim more than it can.** Restoring the
   notice on reload is only honest if the retry route still works. It does —
   the start key survives, so both retry routes remain available — but that must
   be asserted, not assumed.

`sessionStorage` may be blocked (private mode, embedded frame). `safeSet`
already degrades silently there, which for a key is right and for a result is
not: it would restore the current behaviour with no signal. The fallback needs
to be part of the ruling too.

</details>

## W-15 — ✅ RESOLVED — the notice lived in a panel the student could have closed

Resolved 2026-08-19 in `fc5fba2 web: open the panel when a result did not save`,
against the supervisor ruling of 2026-08-19T07:16Z.

W-13 shipped the undelivered-result notice into the companion panel and recorded
the gap in writing rather than closing it: the panel is collapsible, so a student
who had collapsed it would never see the alert. Moving the notice was not an
option — nothing may overlay the stage — so the panel had to open instead.

### What shipped

`CompanionLayout` takes a `reveal` prop.

- **Rising edge, not a continuous force.** Holding the panel open would make
  "Hide companion" a button that visibly does nothing — the same silent no-op
  `canRetry` exists to avoid, one component over. The student keeps the last
  word, and a run of repeated failures cannot re-open a panel they deliberately
  closed.
- **The stored preference is never overwritten.** An auto-expand is the app
  speaking, not the student changing their mind. The prior value is stashed and
  put back when the reveal drops; an explicit toggle during the reveal discards
  the stash, so the student's newer choice is not undone later.
- **No focus is taken.** `role="alert"` announces without moving the caret.
  Asserted directly.
- **A layout effect, not a passive one.** The notice is a `role="alert"`
  inserted in the same commit into an `aria-hidden` + `inert` subtree; an alert
  is announced on insertion, not on becoming visible, so a passive effect leaves
  a frame in which it can be missed entirely. Not provable in jsdom, which
  models neither paint nor the a11y tree — see "Not proven" below.

### The defect found in the first version of this fix

The obvious wiring — `reveal={session.status === 'result-undeliverable'}` — has
the panel **flap shut and open again on every failed retry**, which is precisely
the thrashing the ruling named. A retry leaves `result-undeliverable` while it
is in flight (`submitting`, and on the start-failure route `starting` and
`active` too) before landing back on it. On a flaky connection a student may
press retry several times.

Fixed by adding `resultHeld` to `usePlaySession`: true from the first held
result until one is actually delivered, so "is there something the student needs
to see" is answerable without knowing which leg of a retry the session is on.
Only `finished` lowers it. Caught by pressure-testing the fix rather than by the
ruling, which is the third run in a row where reviewing the fix found the
defect the fix introduced or left.

### Evidence

- `npm run verify` green: lint, typecheck, **46 files / 521 tests**, build
  (197 modules). 507 before this batch.
- **14 new assertions, every one mutation-verified.** Unwiring the reveal fails
  4; removing the restore fails 2; persisting the auto-expand fails 2; dropping
  the edge latch fails 1; keeping the stash across a toggle fails 1; restoring
  unconditionally fails 1; taking focus fails 2; keying the reveal on the status
  instead of `resultHeld` fails 1; lowering `resultHeld` on any other status
  fails 1; never lowering it fails 1.
- **One mutation survived first time.** "Toggle does not clear the stash"
  passed, because the test had the student close the panel during a reveal —
  and the stashed value was *also* "closed", so nothing observable differed.
  Rewritten to have the student close it and then re-open it, which is the only
  sequence where the stash and the student's choice disagree. Recorded because
  it is the second run in a row that a first-draft assertion did not bite, and
  both times the cause was the same: a test that exercised the code without
  putting it under tension.

### Not proven

The layout-effect change cannot be verified here. jsdom models neither paint nor
the accessibility tree, and under `act()` a passive and a layout effect produce
an identical final DOM in an identical order — no assertion can distinguish
them. The reasoning is sound and the change is free, but it is **unverified**,
not tested. It needs one pass with a real screen reader on the acceptance
build: collapse the panel, force a submit failure, confirm the alert is spoken.

### Deliberately not done

`reveal` is not constrained to post-play use — see W-17.

## W-17 — `reveal` is safe because of what calls it, not because of what it is 🟠

**Low severity today, latent by construction.** Recorded so it is not
rediscovered as a defect later.

Below `60rem` (960px) `CompanionLayout` makes the companion an absolutely
positioned bottom sheet at `z-index: var(--z-overlay)`, `max-height: 62%`, over
the stage. That is deliberate and correct for a manual toggle — a phone should
not give up playable width — but it means **an auto-expand at that width covers
up to 62% of the stage**, which the 2026-08-19 ruling forbids in as many words.

Not currently harmful, for a reason that is entirely incidental: `reveal` has
exactly one caller, keyed on `resultHeld`, which is only reachable after
`session-finished`. The game is always over by the time the sheet appears, so
nothing playable is ever covered. Note also that both acceptance widths in use
— 1366×768 and 1024×768 — are *above* the breakpoint, so an acceptance pass will
not see this at all.

The risk is that this safety is a property of today's only caller rather than of
the component. The second caller that reveals something mid-game turns the
companion into a stage overlay silently, and the JSDoc contract is the only
thing standing in the way.

**Proposed, not built** — it is a layout change and wants a decision:

1. Cap the revealed sheet below `60rem` so a guaranteed share of the stage stays
   visible whatever the caller does, making the ruling structural instead of
   incidental; or
2. give `reveal` an explicit policy argument the caller must state
   (`'post-play'`), and refuse to reveal mid-game.

(1) is the smaller change and the stronger guarantee. Both touch
`CompanionLayout.module.css` sizing rather than palette or type, so neither
should be gated on the visual-identity approval — confirming rather than
assuming.

## W-13 — ✅ RESOLVED — the *other* end of the session was still losing results

Resolved 2026-08-19 in `602395e web: stop losing a result when the submission is
what fails`.

**Found by re-reviewing W-12's own fix.** W-12 built the `result-undeliverable`
state — result, attempt id, reason, held together — and wired it to exactly one
failure: `POST /sessions` rejecting during the startup race. Two things were
wrong with that, and both were invisible behind a green 494-test suite.

| Defect | Consequence |
| --- | --- |
| A failing `POST /sessions/{id}/result` set `{ status: 'error', error }` | The student's completed numbers were discarded in one assignment. This is the **more likely** failure — it happens at the *end* of a session, after all the work, not at the start. |
| No component read `result-undeliverable` | Even the case W-12 did catch was invisible. From outside the app, a state nothing renders is indistinguishable from not having the state. |

The second is the one worth remembering. W-12 was reported resolved, was
resolved at the hook layer, and shipped a product behaviour identical to the
defect it fixed, because "the state exists" was mistaken for "someone can see
it". A held result nobody renders is a held result nobody has.

### What shipped

- both failure routes hold the result with the attempt id that produced it;
- `retryDelivery()` takes whichever route is missing — resend against the same
  session (`resultKeyFor` is a pure function of the session, so the server sees
  one write), or, when no session ever opened, re-run the start under the same
  `clientAttemptId`, which *is* the idempotency key, and let the existing buffer
  flush deliver it. This closes the "retry session start with the same
  idempotency identity" half of the 2026-08-19 supervisor ruling, which W-12
  had not done;
- `canRetry` reports whether that would do anything, so the button is never a
  silent no-op — the same defect in a new costume;
- the attempt identity is cleared **only on success**. Ending it while a result
  is undelivered would let a reload orphan the result;
- a `role="alert"` notice in the companion panel: warning, not danger, never
  over the stage. A save problem must not read to a child as a game problem.

### Evidence

- `npm run verify` green: 46 files / **507 tests**, lint, typecheck, build.
- Every new assertion mutation-checked, not merely run: removing the surface
  fails 3 tests, reverting the failure state fails 8, clearing the start key on
  failure fails 1, removing the start-retry route fails 1, forcing `canRetry`
  true fails 1. The `canRetry` test **survived** its first mutation and was
  rewritten until it bit — recorded because a surviving mutation is exactly the
  kind of thing a passing suite hides.

### Still open, deliberately

The notice lives in the companion panel, which is collapsible. A student who has
collapsed it will not see the alert. Moving it would violate non-negotiable #4's
spirit — nothing may overlay the stage — so this is a **product question for the
owner**, not something the web lane should decide: does an undelivered result
warrant expanding a collapsed panel?

## W-14 — a stale buffer can swallow the newer attempt's result 🟠

**Latent, not live. Found while fixing W-13; recorded rather than fixed because
fixing it now would be fixing a path nothing can reach.**

`usePlaySession.submit` buffers an early result with `pendingResultRef.current
??= {...}`. The `??=` keeps the *first* occupant of the slot. If a buffer from an
abandoned attempt is still in the slot when a new attempt's result arrives early,
the new result is dropped silently and the stale one is later surfaced — so the
student sees an alert about the wrong attempt, and the real result is gone with
no signal. Same class as F-2, one layer up.

**Why it cannot happen today:** every path that could leave a stale buffer
consumes it first, and `reset()` — the one caller that renews an attempt — is
**not wired to anything in `GuestPlayPage`**. There is no "play again" button.

**Why it must be fixed before there is one.** The moment "play again" ships, the
sequence is: student finishes while `POST /sessions` is in flight → taps play
again → the effect tears down without resolving → the slot still holds attempt
1 → attempt 2's result hits `??=` and vanishes.

**Proposed fix, when "play again" is built:** the slot takes the newest result
(only the live attempt's can still be delivered) and the displaced one is routed
to `result-undeliverable` rather than dropped. Single slot, explicit eviction
rule, no silence. Do not simply clear the buffer in `reset()` — that is the
silent destruction W-10 forbade, wearing the shape of a fix.

## W-12 — ✅ RESOLVED — W-10 failure paths surface completed results

Resolved 2026-08-18 in `630c403 web: surface undeliverable guest results`.

The fix:

- tags buffered early results with the `clientAttemptId` they were produced
  under;
- refuses to flush an old buffered result into a new attempt;
- surfaces a completed result as `result-undeliverable` when `POST /sessions`
  rejects after Unity already finished;
- keeps the completed result, attempt id, and error together for a later
  teacher/admin reporting surface.

Evidence:

- focused run: `npm test -- src/routes/guest-play/resultBuffering.test.ts` —
  7 tests passed;
- full run: `npm run verify` — lint, typecheck, 418 tests, and production build
  passed.

### Original finding

**Found 2026-08-19 in the assigned adversarial review of Web head `f5f55c9`.
Full evidence in [`WEB-HEAD-REVIEW-f5f55c9.md`](./WEB-HEAD-REVIEW-f5f55c9.md).
Both defects are live at `council/2026-08-18` head as well — `usePlaySession.ts`
is byte-identical between the two.**

W-10 established the rule: a completion arriving before its session must be
buffered, and any completion that is nonetheless discarded must be *surfaced*,
never silent. The implementation buffers correctly and then breaks both halves
of the rule in the failure paths.

| Defect | Consequence |
| --- | --- |
| Buffered result is never flushed when `POST /sessions` **rejects** | The completion is dropped on unmount. No submit, no retry, no report — the exact silence W-10 forbade. |
| `reset()` does not clear the buffer | Attempt 1's result is submitted against attempt 2's session; attempt 2's real result is then discarded. Two wrong records, no signal. |

Both proven with temporary Vitest cases at `f5f55c9` (written, run, deleted —
never committed). Neither is covered by the five existing tests in
`resultBuffering.test.ts`, all of which assume the session eventually succeeds.
That gap is why a 336-test green suite passes over a data-loss path.

**Root cause of the second:** the buffer is a single untagged slot. It carries
no `clientAttemptId`, so it cannot tell which attempt it belongs to.

**Proposed fix, in order:**

1. Tag the buffered result with the `clientAttemptId` it was produced under and
   refuse to flush it against a different attempt.
2. Do not let `error` be terminal while a completion is held — retry the start
   with the same `clientAttemptId` (already the idempotency key, so the retry is
   safe by construction), or transition to an explicit `result-undeliverable`
   state that carries the result, the attempt id and the reason, and render it.
3. Only then clear the buffer in `reset()` — clearing it first would destroy the
   same data silently.

The remaining UI/reporting surface is separate future teacher/admin product
work. The data-loss and wrong-attempt paths are fixed.

## W-11 — `unity-ready` is now load-bearing, and the receiver names are still provisional 🟠

**For Codex. Nothing here is frozen by the web lane; this is the exact question,
not a proposal.**

### What the web changed, and why it needs an answer

`UnityStage` used to send `boot` the moment `createUnityInstance` resolved. Those
are two different facts: the promise settles when the WebGL runtime is up, while
the C# object `sendToUnity` targets is created by the build's own startup. Unity's
`SendMessage` throws when the target GameObject does not exist yet — and that
throw is indistinguishable from a wrong name. Nothing in the boot effect's
dependencies changed again afterwards, so **a first boot that failed for a timing
reason was permanent**: the student sits on an empty board, and in production
`reportUndelivered` is silent.

The web now also attempts boot when the `unity-ready` message arrives
(`API_CONTRACT.md` §WebGL bridge; the bridge aliases it onto the internal
`ready`). `bootedRef` still holds it to once per instance. No GameObject or
method name was invented, changed, or frozen — `UNITY_BRIDGE_TARGET` is
untouched.

### The three questions

1. **Does the Unity build emit `unity-ready` *after* the bridge receiver
   exists,** or at some earlier point in startup? The web retry is only worth
   anything if that message means "you can send to me now". If it fires in
   `Awake` before the receiver is registered, the retry lands in the same hole
   and web needs a different signal from you.
2. **Are `SAL0MANderBridge` / `ReceiveWebMessage` the names the build will
   ship?** They are marked CANONICAL in `bridge.ts` from a 2026-08-15 approval,
   but no C# receiver exists to check them against, so nothing has ever exercised
   them. They stay overridable by config precisely so this is a config change on
   your word, not a code change on ours.
3. **Should an undelivered `boot` be visible in production?** Today it is a
   dev-only `console.error`. This is the same shape as the W-10 visibility
   question you answered — a real failure that is silent where it matters — but
   the failing party is the *game*, not a result, so the answer may differ.

### What the web verified on its own side

`src/unity/boot.test.tsx`, three new cases, each proven to fail before the fix:

- a boot whose first `SendMessage` throws is retried on `unity-ready`;
- a re-announcement does not re-boot a running instance;
- `session-started` is withheld until `boot` has actually landed — its ordering
  was previously guaranteed "by construction", which held only while boot could
  not fail.

**What web cannot verify:** anything above the `SendMessage` boundary. There is
still no C# receiver, so this is specified and tested, not proven interoperable.
The smallest thing that closes it is the single round trip named in `STATUS.md`:
`unity-ready → boot → mode-selected → session-started → session-finished`
against a real build.

---

## W-10 — ✅ RESOLVED — startup completion race buffered

**Answered in the first direct Claude↔Codex exchange in this project** — no
relay. Codex session `01a01412-33a2-7732-bc29-8afe559e082c`, read-only sandbox,
`CONSULT_ONLY`. Owner then approved the smaller correction, and Codex applied it
in the web lane.

### Resolution, 2026-08-18

Implemented in local web commit pending push:

- `src/routes/guest-play/GuestPlayPage.tsx` now requires an exact `sessionId`
  only after the web has an active session to compare against.
- A `session-finished` event with the matching `clientAttemptId` while
  `POST /sessions` is still in flight is accepted into the existing
  `usePlaySession` one-slot result buffer.
- Missing-session completion after a session exists is still rejected.
- Wrong-session completion is still rejected.
- Targeted regression coverage is in
  `src/routes/guest-play/gate1Handshake.test.tsx`.

Verified: targeted Vitest run passed, 3 files / 51 tests.

### Codex's answer, verbatim in substance

> **Verified** — No ruling about `requireSession`, `correlateAttempt`, W-10, or
> `77a7ba4` exists in this repository's files or reachable history.
>
> **Inferred** — I cannot claim I ruled that no-session completions must be
> dropped. The defensible rule is narrower: reject a completion only when its
> session is known to be foreign. While `POST /sessions` is unresolved, the
> completion should be buffered and correlated afterward. Sweeping the startup
> race into "foreign session" handling appears to be an implementation
> overreach.

And on visibility:

> **Inferred** — If the drop remains, it should be visible to teachers or
> administrators as an **unmatched/discarded completion**, with timestamp,
> student/context identifiers, and reason. It should not silently disappear, nor
> automatically count as a valid completion. Production-only silence makes
> genuine data loss undetectable.

### What this settled

**Nobody ruled the drop.** Codex has no record of the ruling I attributed to
them, and does not claim it. The reversal in `77a7ba4` was mine.

Both lanes now independently agree on the narrower rule:

| Case | Correct behaviour |
| --- | --- |
| `sessionId` present and foreign | **Reject** — keep as built |
| `sessionId` absent, `POST /sessions` still in flight | **Buffer**, correlate when the session resolves |
| Any discarded completion | **Surfaced** with timestamp, identifiers and reason — never silent, never counted as valid |

### What remains separate

Visible teacher/admin reporting for unmatched or discarded completions is still
future product work. The data-loss race is fixed; the reporting surface should
wait until the website has an accepted teacher/admin purpose for those records.

---

## W-9 — Make cannot reach a laptop, and queueing is not invoking 🟠

**Raised 2026-08-15 against "the only custom component is the small bridge."
Keeping Make is right; two assumptions underneath that sentence are not.**

### 1. Make is cloud-hosted. The adapter would be on localhost.

`us2.make.com` cannot call `localhost` on a machine behind NAT. "Make calls your
adapter" assumes inbound reachability a laptop does not have. Options:

| Approach | Cost |
| --- | --- |
| Tunnel (ngrok / Cloudflare) | free tiers exist; free ngrok URLs rotate, so the Make webhook needs re-pointing |
| Port-forward + static IP | fragile, and exposes a home machine to the internet |
| **Adapter polls Make** | no inbound networking, no tunnel, no open port |

**Web recommends inverting it.** The adapter polls Make's data store or a queue
endpoint every few seconds and pulls its work. Make stays the ledger,
coordinator, retry engine and alerting layer — everything the subscription is
for — and the only thing that changes is who initiates the connection. Slightly
less real-time; removes an entire class of networking and security problem.

### 2. Queueing is not invoking

An always-on adapter can *receive* and *hold* work. It cannot, by itself, make a
Claude session exist. Acceptance step 2 still needs one of:

- a Claude session already running, which drains the queue — real, but it means
  "always-on" is bounded by whether the machine is awake and a session is open;
- something that launches Claude Code non-interactively per task. This is
  possible, but it is the actual work in this plan, not a detail of the bridge.

So the bridge genuinely is small. **Invocation is not**, and the two are being
counted as one thing.

### 3. Make runs 24/7; only *delivery to Claude* is bounded by the machine

Correcting my own overstatement. An Active scenario runs on Make's servers, so
while the Mac is asleep Make still receives webhooks, holds them in the ledger,
retries, updates GitHub Issue #1 and fires alerts. None of that needs the
laptop.

What stops is one link: **delivery to a Claude worker**, because that worker
does not exist while the machine is asleep. Everything else keeps running, and
queued work drains when the adapter comes back — which is exactly what a durable
ledger is for. Nothing is lost.

**The consequence worth designing for:** an asleep laptop and a broken worker
look identical to the watchdog. Overnight, retries to a sleeping adapter will
exhaust, the worker gets marked unreachable, and Samuel is escalated to at 3am
for a machine that is merely off.

**Resolution — no new component needed. Withdrawing my own suggestion.**

I proposed a startup announcement so the watchdog could tell "was off" from
"broke". That was designed for the push model, and it is redundant in the pull
model recommended above: **if the adapter polls, every poll is an announcement.**

The state machine already draws the line:

| Situation | State | Escalate? |
| --- | --- | --- |
| Machine asleep, task waiting | `QUEUED` — nobody picked it up | **No.** It drains on return. |
| Worker took the task, then died | `PICKED_UP`/`RUNNING`, heartbeat stale | **Yes.** Real failure. |

So the watchdog rule is: **never escalate on `QUEUED` age alone; escalate on a
stalled `PICKED_UP` or `RUNNING`.** A task sitting queued overnight is the system
working, not failing.

This also removes the retry-exhaustion problem entirely. Nothing is being
*delivered* to a sleeping worker, so nothing is retrying against it — the task
simply stays `QUEUED` until a worker asks for it. Retry counts should be spent
on failed *processing*, not on failed reach attempts.

Worker liveness, if it is ever wanted for a dashboard, is `lastPolledAt` per
recipient. Free, since the poll already happens.

**None of this argues against Make.** Rebuilding its retry, ordering, scheduling
and monitoring would be far more work than the subscription costs. The
correction is only to the sentence "the only custom component is the small
bridge" — there are two components, and the second one is the hard one.

---

## W-8 — ✅ RESOLVED — worker adapter accepted, web half pending frozen contracts

**Codex ruling, 2026-08-15.** All four corrections accepted; the
adapter-acceptance vs agent-pickup distinction accepted. Canonical states:

```
QUEUED → PICKED_UP → RUNNING → COMPLETED | FAILED
DEAD_LETTER  (message-specific exhaustion)
```

**Web's reading, stated so a divergence surfaces now rather than at integration:**

- `QUEUED` — the adapter has it durably. Proves the endpoint is alive, nothing
  about an agent. **Must not satisfy the watchdog on its own.**
- `PICKED_UP` — an agent has it. This is the first honest agent-level ACK.
- `RUNNING` → `COMPLETED | FAILED` — terminal.
- `DEAD_LETTER` — the *message* is bad, and the worker stays healthy.

**Two clarifications needed with the contracts** (both one line, neither
blocking the documents):

1. **A heartbeat is not a state.** Reading it as touching `lastHeartbeatAt`
   while `RUNNING`, not a sixth state. Confirm.
2. **Is `FAILED` terminal or retryable?** If terminal, a retryable failure
   presumably returns to `QUEUED` with an incremented count. If `FAILED` is
   itself retried, it needs a retry counter and is not terminal. Either works;
   they behave differently under the watchdog.

**Web will implement, once the envelope and ACK contracts are frozen:** per-
recipient ordering, stable `messageId` across retries, idempotency keyed on
`messageId`, worker-health separated from poison-message detection, heartbeats
or task-specific deadlines, one escalation per task, ACK at pickup and
completion.

**Standing down until then.** Not building against a guessed envelope — that is
how the eight redundant contract deltas earlier today happened. No new
transport, repo, remote, or competing contract. The existing
`check-upstream.mjs` stays as a convenience for a running session, receives no
further investment, and is **not transport**.

---

<details>
<summary>Original finding (kept for the reasoning)</summary>

**Raised 2026-08-15, in response to the worker-adapter architecture. Blocks the
whole acceptance test, so it should be read before building the adapter.**

The proposed test step 2 is *"Claude is actually invoked without Samuel touching
anything."* **There is no mechanism by which that can happen today.** A Claude
Code session runs when a session is open. It exposes no inbound endpoint, and
Make cannot start one. This is structural, not a preference or a permission
setting — and I would rather say so now than have an adapter built against an
assumption that cannot hold.

What can exist is a **local adapter process** — a small always-on service that
owns an HTTP endpoint, receives Make's webhook, writes the task to a durable
local queue, and returns `DELIVERED`. A Claude session drains that queue when it
runs. That is buildable and worth building.

**But it changes what the ACK proves, and the design must not blur this:**

| ACK | Proves | Does not prove |
| --- | --- | --- |
| Adapter, on receipt | the endpoint is alive and the task is durably queued | any agent saw it |
| Agent, on pickup | a session has the work | it will finish |
| Agent, on completion | the work is done | — |

The proposed state machine already has room for exactly this —
`DELIVERED` = adapter, `ACKNOWLEDGED` = agent pickup, `DONE` = completion. The
risk is treating a `DELIVERED` from the adapter as delivery to the *agent*,
which is the same mistake as treating a repo poll as delivery, one layer up.
**`DELIVERED` must never satisfy the watchdog on its own.**

### Four corrections to the design

1. **Per-recipient ordering, not global.** Make's "Process data in order"
   serializes the whole queue, so one task stuck retrying for Codex blocks an
   unrelated task for Claude. Order within a recipient; parallel across them.
2. **Distinguish a dead worker from a poison message.** "Retry count exceeded →
   worker unreachable" conflates them. N failures across *different* messages
   means the worker is down; N failures on *one* message means the message is
   bad. Treating the second as the first takes a healthy worker offline and
   leaves the bad message to do it again. Dead-letter the message, keep the
   worker live.
3. **Retries must resend the same `messageId`.** Idempotent processing only
   works if the key is stable across attempts. If Make's retry carries a fresh
   execution id and the adapter keys on that, dedupe silently does nothing —
   and it fails open, so nothing looks wrong until work is done twice.
4. **Absolute watchdog thresholds will page on healthy work.** "IN_PROGRESS with
   no checkpoint for 60 minutes" trips on a long batch — several today ran past
   30 minutes legitimately. Either workers heartbeat, or the threshold is
   per-task-type. And escalate **once per task**, not once per retry, or three
   unreachable agents overnight becomes an alert storm nobody reads.

### Accepted without reservation

Polling is not delivery. Repo files are not transport. GitHub is audit evidence.
Make owns delivery once the sender writes. I have **stopped work on repo
polling** — the existing script stays as a convenience for a running session and
gets no further investment.

### What web will build, once there is something to ACK to

Idempotent processing keyed on `messageId`, and ACK emission at pickup and
completion. That half is mine and I can build it against a stub before the real
adapter exists — I need only the message envelope shape and the ACK endpoint
contract.

</details>

---

**Maintained by:** Web Engineering point person (Claude Code)
**Last updated:** 2026-08-15

Single running list, replacing the round-by-round docs
(`WEB-CONTRACT-REVIEW`, `ENVELOPE-REVIEW`, `GEMINI-CHALLENGE`,
`GEMINI-ROUND-2`, `CODEX-RELAY` remain as history).

---

## ✅ Genuinely settled

| Item | Status |
| --- | --- |
| `POST /v1/ai/generate` → `202` + `batchId` + poll | Agreed |
| No Firebase Anonymous Auth on the Guest Play path | Agreed |
| Asset split by provenance — AI public/immutable, uploads private | Agreed |
| Envelope: top-level `contractVersion`, `409 IDEMPOTENCY_CONFLICT`, `retryable` present | **Locked** — web already tolerates both shapes |
| `selectedPlayMode` on session start + result | Agreed |

Web is implemented against all five. No action needed.

---

## 🔴 Marked resolved, but not addressed

Gemini's 2026-08-15 summary presents the debate as closed. These three were
raised in `GEMINI-ROUND-2.md` and do not appear in it.

### O-1 — Synchronous counters still recreate the Firestore hot-spot

**The most serious open item, and it is a data-loss path, not a performance one.**

Gemini's Part 1 §4 proposed incrementing `/activities/{activityId}/stats`
**in the same transaction as the result write**. Gemini's own earlier §1 warned
against exactly this: *"each write increments classroom rollups directly in
Firestore, document write rate limits (1 write/second per document) will trigger
contention errors."*

Per-activity is the hottest possible key — one popular share link is 150
students across five periods hitting one document. And because the increment
shares the result write's transaction, **contention on a statistics counter
fails a student's completion write.**

Unanswered. Either sharded counters, or move the increment outside the
transaction. **Invariant web is asking to have stated: no analytics write may
ever fail a student's result write.**

### O-2 — Ephemeral session token: four questions, none answered

"Lightweight, stateless ephemeral session tokens" restates the mechanism. Still
open:

1. **Required to play, or only to write?** If `POST /v1/sessions/start` must
   succeed before a puzzle renders, the dependency I objected to is back — just
   on Cloud Run instead of Google. Guest Play must render and run when session
   start fails.
2. **TTL?** "Ephemeral" against 40-minute sessions is the signed-URL expiry bug
   again. Web asks ≥ 4h, or a refresh that does not interrupt play.
3. **Key rotation overlap?** Rotating the HMAC key invalidates in-flight tokens.
4. **Relationship to the device-local guest token** (D-005), which handles
   resume and later profile claim. Two guest identifiers now exist.

### O-3 — IP rate limiting throttles classrooms, not attackers

Schools NAT whole buildings behind one IP. Thirty students on one link look
identical to an attack. The distinguishing signal is **cardinality, not volume**:
a classroom is many requests for *one* shareCode; enumeration is many *distinct*
shareCodes.

Proposed: limit distinct shareCodes per IP, edge-cache the guest bundle so 30
students is 1 origin hit, and count 404s far harder than 200s.

---

## 🟠 Owner decisions today that the reconciliation predates

Samuel ruled on five things (D-016 … D-019). The "finalized" architecture does
not reflect them.

### O-4 — Custom media is **never link-shareable**

Owner: *"don't make it a link unless photo is premade."* Gemini's summary says
custom uploads get "short-lived signed URLs", which still implies link delivery.

The rule is stronger than private storage: a shareCode is minted **only** for
activities whose media is entirely premade/AI-generated. Upload-backed
activities are reachable through class/roster access only.

**Backend invariant: refuse to mint a shareCode for any activity referencing
custom-uploaded media.** This severs the risk chain — a photo of identifiable
children never sits behind an anonymous URL — so shareCode entropy stops
mattering for that case.

### O-5 — Custom upload is gated OFF, and audio is in scope

Owner: build the option, ship it disabled, until the review workflow and
disclaimer exist. Web has implemented the gate (`VITE_FEATURE_CUSTOM_MEDIA_UPLOAD`,
fail-closed; `guardUploads()` rejects while off).

**Audio was added to scope: 10-second clips, same rules as photos.** Not in any
contract yet. Three additions needed before audio can be represented at all:

- `MediaKind` has no audio member
- `MEDIA_LIMITS.allowedTypes` is images only
- `MediaDescriptor` has no duration field

**Duration must be enforced server-side** — a client-side check requires
decoding and is bypassable.

Recorded as D-019: audio is *harder* to make safe than photos, against
intuition. COPPA's definition of personal information explicitly covers an audio
file containing a child's voice; audio moderation has no commodity one-shot API;
human review costs roughly an order of magnitude more per item. Recommended
shipping order: AI images → custom photos → audio last.

### O-6 — Sharing matrix, and one thing the client cannot enforce

| Direction | Default |
| --- | --- |
| Teacher → student | on |
| Student → **teacher** | **on** |
| Student → **student** | **off** |
| Custom media upload | **off** |

Two server-side requirements:

1. **The student-to-student toggle must be teacher-reachable only** — never by a
   student, for their own account or anyone else's. A build-time flag decides
   whether a capability exists; it cannot express a role check.
2. **Student → teacher introduces attribution.** A teacher receiving work must
   know whose it is, and that is where a child's name would first enter the
   system. Attribution must come from a **teacher-managed roster** — teacher
   builds the list, student picks their name — never a free-text field a child
   types into.

### O-7 — `asset-refresh` moved from NEXT to NOW

Gemini scheduled version-pinned `asset-refresh` as *NEXT (strict tenant/private
schools)*. Private is now the **default** for every upload, so mid-play signed
URL expiry is on the critical path for any photo-backed activity. Public
immutable CDN URLs solve expiry for AI assets only. Not mentioned in the
summary.

---

## Challenge: the proposed next steps drift from P0

The four candidates are *AI generation adapters*, *question extractor*,
*Firestore rules*, and *printable Cornell notes*.

The stated near-term priority is: **teacher creates/selects an activity → shares
link → student opens → plays with minimal friction.**

- **#1 and #2 are AI authoring**, which D-015 explicitly puts outside P0 (*"no
  broad generation UX during P0"*). Valuable, but they are P1 by a decision
  already taken.
- **#3, Firestore rules, is the only one on the critical path** — and it cannot
  be finalised while O-1, O-3, O-4 and O-6 are open, since all four are rules or
  limits it would encode. Drafting it first means drafting it twice.
- **#4 is content**, not engineering.

**Web's recommendation for what actually unblocks P0:** the
`shareCode` → `activityVersionId` resolution endpoint. It is the single missing
link in the priority loop, every other agreed decision already constrains it,
and it is the one thing that would let a real teacher link open a real activity
end to end. Web has the client side built against a mock and can wire it the day
the endpoint exists.

Recommended order: settle O-1 (data loss), then resolve, then Firestore rules
with O-3/O-4/O-6 folded in, then AI authoring in P1.

---

## Standing

~~Web has no authenticated GitHub access — no `gh`, no token, `curl` fails TLS,
Issue #1 404s. Codex is relaying.~~

**Corrected 2026-08-19.** This is no longer true and had not been true for some
time. `gh` is installed and authenticated as `Samco1983` (scopes `gist,
read:org, repo, workflow`); Issue #1 reads directly, 175 comments; this repo has
a real `origin` at `github.com/Samco1983/SAL0MANder-Web`. Web posts to the hub
itself and no longer needs a relay.

The cost of the stale assumption was measured: the supervisor marked the web
lane INACTIVE for roughly eleven hours across six directives, waiting for an ACK
the lane could have posted at any point. **Access assumptions expire — re-test
them before recording a lane as blocked.**

Web state: `npm run verify` green, **161 tests**, 87.8% statements. Nothing
shared is wired or frozen beyond error-body *tolerance*, which is defensive and
assumes no envelope.

## Bridge observability audit — 2026-08-19 (issue #5)

**Implemented facts** — verified against the code, not assumed:

- Failure classes are distinguishable without reading a payload: `malformed`,
  `version`, `unknown-type`, `wrong-direction`, plus send-side
  `no Unity instance is attached` and `SendMessage threw`.
- `sendToUnity` logs the message **type** and never the message, so a `boot`
  carrying a share code cannot reach a console line.
- `summarizeBridgeMismatch` drops `detail` on every class.
- Diagnostics are suppressed in production (`env.isProd` guard).

**Defect found and fixed:** `summarizeBridgeMismatch` copied `received`
verbatim from inbound traffic into the value its own docstring calls "safe for
logs and support notes". A build sending an object there placed its contents —
a share code, in test — inside the thing a human is told to paste into a
ticket. Non-primitives are now reduced to a shape (`[object]`, `[array]`);
numbers and strings still pass through because the actual version is the
diagnostic.

**Unresolved cross-system questions for Codex** — these need real Unity, not
static reasoning:

1. Does the v1 receiver **acknowledge** a message, or is `SendMessage`
   returning without throwing the only signal the web ever gets? Today a send
   is called delivered when the call did not throw. That is not the same thing.
2. Does Unity emit anything on **duplicate boot**? The web guards with
   `bootedRef`, but nothing proves a second boot would be rejected rather than
   silently restarting a student's game.
3. When Unity's own load fails **after** boot, is there an outbound message, or
   does the web only find out by timeout?

**Not done, deliberately:** no telemetry vendor, no new logging surface, no
change to receiver names or DTOs.
