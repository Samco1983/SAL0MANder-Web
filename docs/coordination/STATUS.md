# Web status updates

Newest first. Format per `AGENT_WORKFLOW.md`.
This file and `OPEN-ITEMS.md` are the technical handoff source for the web lane.

---

## 2026-08-19 — work-loop scoreboard now detects worker-made commits

```text
AGENT: Codex Desktop
AREA: Mission Control / scheduled work loop evidence
STATUS: SHIPPED, verify green
```

**WHAT CHANGED**

The 01:17 scheduled run produced commit `7355614`, but the loop log still said
`ONE THING THAT CHANGED: NOTHING CHANGED`. The root cause was the evidence
order: after Claude exited, the loop checked only whether the working tree was
dirty. If Claude had already committed, the tree was clean, so a real shot was
scored and then reported as empty.

`scripts/sal0-work-loop.sh` now checks `HEAD` movement before working-tree
cleanliness. If the worker moved `HEAD`, the loop:

- lists files changed from `BEFORE..HEAD`;
- treats non-zero worker exit after a commit as a bad turnover;
- runs `npm run verify` against the worker-made commit;
- pushes the verified commit;
- comments on the GitHub issue when an issue can be identified;
- reports the made shot as `COMMITTED <hash>` instead of `NOTHING CHANGED`.

The uncommitted-diff path remains intact for the normal worker flow.

**EVIDENCE**

- `bash -n scripts/sal0-work-loop.sh`: pass.
- `npm run verify`: lint, typecheck, **46 files / 523 tests**, build — pass.

**NEXT SAFE BATCH**

Run the next scheduled possession and confirm the log reports a worker-made
commit, an uncommitted diff, or a true `NOTHING CHANGED` based on git evidence,
not on the agent's own wording.

---

## 2026-08-19 — the undelivered-result notice no longer promises durability it doesn't have

```text
AGENT: Claude Code
AREA: Website lane / Guest Play result delivery
STATUS: SHIPPED, verify green, mutation-verified
```

**CHECKED FIRST**

`node scripts/check-upstream.mjs`: no upstream changes. GitHub Issue #1: this
run's WebFetch was not granted permission (no interactive approval available),
so the hub could not be read this pass — noted per the mirror protocol's "if
you cannot verify, do not act on it" rule; nothing was acted on from the hub.

**WHAT CHANGED**

W-16 (`docs/coordination/OPEN-ITEMS.md`) recorded that `UndeliveredResult`'s
non-retryable copy — *"This device is holding your result until it can be
saved"* — is false: the result lives in React state and a ref, neither survives
a reload, and the device is not holding anything past the current tab. W-16's
`sessionStorage` fix is correctly gated on an owner ruling (data-at-rest,
retention, private-mode fallback), but the false copy itself is not a build
decision and did not need to wait on one, so it shipped separately:

- both the retryable and non-retryable messages now say "keep this tab open"
  and name the actual loss condition (closing or reloading before it saves)
  instead of implying the app is holding the result for the student;
- a regression assertion pins the new copy and rejects the old "this device is
  holding" claim.

**This does not resolve W-16.** The result is still genuinely lost on reload —
only the notice no longer claims otherwise. `OPEN-ITEMS.md` updated to reflect
that split: the copy fix is done, the storage fix is still open and still
waiting on the ruling.

**EVIDENCE**

- `npm run verify`: lint, typecheck, **46 files / 523 tests**, build (197
  modules) — all green, no new test count (existing test extended, not a new
  one).
- Mutation-verified: reverted the retryable-branch copy to the old sentence,
  confirmed the new assertion fails (`keep this tab open` missing), restored
  the fix, confirmed `git diff` is clean and verify is green again.
- The non-retryable branch (the one with the literally false sentence) has no
  UI path to exercise today — `canRetry` is false only when the held attempt
  id no longer matches the live one, which needs `renewAttempt`, and nothing in
  `GuestPlayPage` calls it yet (no "play again" button — see W-14). Fixed the
  copy anyway since it is dead-but-reachable-soon code that was wrong on its
  face; did not fabricate a test harness to force an otherwise-unreachable
  branch just to mutation-cover it.

**NEXT SAFE BATCH**

W-16's storage question is still the highest-value open item and is
review-ready, not frozen — three questions in `OPEN-ITEMS.md` (data at rest,
retention, private-mode fallback) need an owner/Gemini call before
`sessionStorage` persistence is built.

---

## 2026-08-19 — bridge mismatch diagnostics can now be logged without payloads

```text
AGENT: Codex Desktop
AREA: Website lane / Unity bridge observability
STATUS: SHIPPED — `140affd`, verify green
```

**WHAT CHANGED**

Issue #5 asked whether boot bridge failures can distinguish resolver,
validation, Unity availability, message send, and duplicate-init cases without
logging sensitive payload data. The narrow missing piece was a safe handoff
shape for mismatch reports: `BridgeMismatch.detail` intentionally carries raw
event detail for in-process debugging, but raw detail can contain share codes,
activity payloads, URLs, result metrics, or user-entered values.

`summarizeBridgeMismatch()` now converts a bridge mismatch into a privacy-safe
summary:

- malformed: reason plus whether detail existed;
- version skew: type, received version, expected version;
- unknown type: reason plus type;
- wrong direction: reason plus type.

No analytics vendor, backend, transport, DTO rename, receiver rename, or Unity
change was added.

**EVIDENCE**

- `npm test -- src/unity/bridge.test.ts`: **15 tests passed**.
- `npm run verify`: lint, typecheck, **46 files / 523 tests**, build passed.
- GitHub issue #5 now has evidence comment
  `https://github.com/Samco1983/SAL0MANder-Web/issues/5#issuecomment-5339235150`.

**STILL UNVERIFIED**

Unity receiver behavior is still not proven by a real build. Contract questions
remain about when the build emits `unity-ready`, whether wrong-direction
messages should ever appear in production, and what minimal browser-visible
diagnostic surface is wanted for QA.

---

## 2026-08-19 — panel auto-expand shipped; the chain's last silent-loss path is a reload

```text
AGENT: Claude Code
AREA: Website lane / Guest Play result delivery + companion layout
STATUS: SHIPPED — `fc5fba2`, verify green, mutation-verified
        PLUS one new HIGH finding (W-16) that needs a ruling
```

**WHAT CHANGED**

Upstream: no change (`check-upstream.mjs` clean). Hub: 180 comments, three new
since the last entry. The 2026-08-19T07:16Z supervisor comment accepts the W-13
evidence and **answers the product question W-13 left open**: an undeliverable
result must automatically expand the companion panel and reveal the notice —
no stage overlay, no focus theft, preserve the prior collapsed preference and
restore it only after delivery, no thrashing on repeated failures. Codex is
assigned the independent review; C-1 (`P1_PROCESS.md` naming the obsolete
mailbox) is still open on their side.

**WHAT I SHIPPED** — `fc5fba2`

`CompanionLayout` takes a `reveal` prop, wired in Guest Play to a new
`resultHeld` from `usePlaySession`.

- **Rising edge, not a continuous force.** Forcing the panel open would make
  "Hide companion" a button that visibly does nothing — the same silent no-op
  `canRetry` exists to prevent, one component over. The student keeps the last
  word; repeated failures cannot re-open a panel they closed on purpose.
- **The stored preference is never overwritten.** The reveal stashes it and puts
  it back; an explicit toggle during the reveal discards the stash, so a newer
  choice is never undone later.
- **No focus taken**, asserted directly. `role="alert"` announces without
  moving the caret.
- **A layout effect, not a passive one**, so the panel is open in the same paint
  the notice appears in — an alert inserted into an `aria-hidden` + `inert`
  subtree is announced to nobody.

**WHAT I FOUND — in my own fix, before shipping it**

The obvious wiring, `reveal={session.status === 'result-undeliverable'}`, makes
the panel **flap shut and open again on every failed retry** — exactly the
thrashing the ruling named. A retry leaves that status while it is in flight
(`submitting`; on the start-failure route `starting` and `active` too) before
landing back on it, and a student on bad wifi presses retry more than once.

Fixed with `resultHeld`: raised from the first held result until one is actually
delivered, so "is there something the student needs to see" is answerable
without knowing which leg of a retry the session is on. Third run in a row where
reviewing the fix found the defect the fix introduced.

**EVIDENCE**

- `npm run verify` green: lint, typecheck, **46 files / 521 tests**, build
  (197 modules). 507 before this batch.
- 14 new assertions, **every one mutation-verified** — ten distinct mutations,
  each killing between 1 and 4 tests. Full table in `OPEN-ITEMS.md` W-15.
- **One mutation survived first time.** "Toggle does not clear the stash" passed,
  because the test had the student close the panel during a reveal and the
  stashed value was also "closed" — nothing observable differed. Rewritten to
  close-then-reopen, the only sequence where stash and student disagree. Second
  run running that a first-draft assertion did not bite; both times the cause
  was a test that exercised the code without putting it under tension.
- One change is **unverified, not tested**: the layout-effect swap. jsdom models
  neither paint nor the a11y tree, and under `act()` a passive and a layout
  effect leave an identical DOM in an identical order. Needs one real
  screen-reader pass on the acceptance build. Saying so rather than counting it.

**WHAT I FOUND — W-16, HIGH, needs a ruling**

Pressure-testing the wider path found the loss route none of W-10, W-12, W-13 or
this batch covers, and it is the one a student is most likely to take.

**A reload destroys the held result, and the app looks fine afterwards.**

The idempotency *keys* were made durable on purpose. The **result payload is
written nowhere** — React state and a ref, both gone on reload.
`grep -rn "sessionStorage\|localStorage" src/routes/guest-play/` returns
`idempotency.ts` and nothing else. So: student finishes, submit fails, retry
fails, student reloads the page that looks stuck. Numbers gone, Unity restarted,
unreproducible.

Worse than plain loss. Proven with a temporary Vitest case driving the real
bridge and mock transport, then deleted:

```
BEFORE RELOAD: notice shown, attempt OVsmrPrtNb8Pu_A1, submits 1
AFTER RELOAD:  attempt OVsmrPrtNb8Pu_A1 | notice present: false
               storage: [ sal0mander.session.startKey.demo-version-1,
                          sal0mander.guest.token ]
```

The attempt id **survives**, which is what W-13 built it to do — so on reload the
page re-runs `POST /sessions` under the same key, gets the same session back, and
shows an ordinary healthy ready-to-play screen. No notice, no error, no marker.
A completed result was destroyed and the app's own evidence says all is well.
Invisible to all 521 tests, because every one of them lives inside a single page
lifetime.

Also: `UndeliveredResult` currently tells the student **"This device is holding
your result until it can be saved."** It is not. The tab is, until it is
reloaded. That sentence must not ship as written whatever else is decided.

Fix proposed in `OPEN-ITEMS.md` W-16 — persist the held result to
`sessionStorage` beside its start key and rehydrate on mount — and deliberately
**not built**, because it is the first time this app would write a student's
work product to a shared classroom device. That is a data-at-rest and retention
question, and retention is on the unresolved list.

**ALSO RECORDED — W-17, low**

Below 60rem the companion is a bottom sheet over the stage, so an auto-expand
there covers up to 62% of it — which the ruling forbids literally. Harmless
today only because `reveal`'s single caller is post-play by construction, and
both acceptance widths (1366, 1024) are above the breakpoint so a pass will not
see it. The safety is a property of today's caller, not of the component. Two
concrete fixes proposed; neither built, both are layout decisions.

**NEEDS AN OWNER DECISION**

1. **W-16** — may the web persist a completed result to `sessionStorage` on the
   student's device? Metrics only, no PII, but it is student work on a shared
   device, and `sessionStorage` dying with the tab is a TTL decision by
   implication. Blocking the only remaining silent-loss path.
2. **W-17** — cap the revealed bottom sheet below 60rem, or make `reveal` state
   an explicit post-play policy? Recommend the former.
3. **C-1** still open on Codex's side.

**NEXT**

The Gate-1 web artifacts, unblocked since C-2: role flows, responsive breakpoint
strategy, editor/preview shell wireframes (web issues #12–#15). W-16 ahead of
them if a ruling lands.

**BLOCKERS**

None blocking this lane. W-16 is blocked on a ruling, not on work.

---

## 2026-08-19 — W-12's own fix reviewed; the harder half of the same defect was still live

```text
AGENT: Claude Code
AREA: Website lane / Guest Play result delivery
STATUS: SHIPPED — `602395e`, verify green, mutation-verified
```

**WHAT CHANGED**

Upstream: no change (`check-upstream.mjs` clean). Hub: 177 comments, two new.
The 2026-08-19T06:11Z supervisor comment accepts the `f5f55c9` FAIL, authorises
W-12 implementation, and **resolves C-2**: Claude owns Web Teacher Studio /
Activities IA, the responsive editor/preview shell, role flows and the web-side
bridge. Codex owns the Unity surfaces. C-1 (the two-mailbox contradiction) is
assigned to Codex to correct in `P1_PROCESS.md`.

Both items that directive assigned were already landed before this run —
W-12 in `630c403`, F-3/F-4/F-5 in `13ace35` (selection, parsing and trust
extracted to `scripts/lib/sal0-checkin-select.mjs` with 168 lines of tests).

**WHAT I FOUND**

So I reviewed W-12's fix rather than restating it, and it was half a fix.

`result-undeliverable` — the state W-12 built to hold a completed result with
its attempt id and reason — was reachable from exactly one failure: `POST
/sessions` rejecting during the startup race. A failing **`POST
/sessions/{id}/result`** still collapsed into `{ status: 'error', error }`,
discarding the student's numbers. That is the more likely of the two: it fires
at the *end* of a session, after all the work, not at the start.

And **nothing rendered `result-undeliverable`**. It appeared in no component.
So even the case W-12 did catch was invisible — which from outside the app is
indistinguishable from not having the state.

That second one is the finding worth keeping. W-12 was reported resolved, was
genuinely resolved at the hook layer, and shipped a product behaviour identical
to the defect it fixed. "The state exists" had been mistaken for "someone can
see it". The supervisor's ruling was explicit — *a visible in-product state
now* — and a 494-test green suite said nothing.

**WHAT I SHIPPED** — `602395e`

- Both failure routes hold the result with the attempt that produced it.
- `retryDelivery()` takes whichever route is missing: resend against the same
  session (`resultKeyFor` is a pure function of the session, so it is one
  write), or, when no session ever opened, re-run the start under the same
  `clientAttemptId` — which *is* the idempotency key — and let the existing
  buffer flush deliver it. This closes the "retry the start with the same
  idempotency identity" half of the ruling that W-12 left undone.
- `canRetry` reports whether that would do anything, so the button is never a
  silent no-op.
- The attempt identity is cleared **only on success**; ending it while a result
  is undelivered would let a reload orphan the result.
- A `role="alert"` notice in the companion panel — warning, not danger, never
  over the stage. A save problem must not read to a child as a game problem.

**EVIDENCE**

- `npm run verify` green: lint, typecheck, **46 files / 507 tests**, build
  (197 modules, 265ms). Was 494 tests before this batch.
- Defect proven test-first: the new assertions failed 5/6 against the unmodified
  head, with `expected "result-undeliverable" to be "error"`.
- Every new assertion mutation-checked. Removing the surface fails 3; reverting
  the failure state fails 8; clearing the start key on failure fails 1; removing
  the start-retry route fails 1; forcing `canRetry` true fails 1.
- **One mutation survived first time** — `canRetry: true` passed the whole
  suite, because the test drove the attempt-id change through a path that
  restarted the session and left `result-undeliverable` before the guard was
  reached. Rewritten through `enabled: false`, which is the combination that
  actually reaches it. Recorded because a surviving mutation is exactly what a
  passing suite hides, and it is the second time in two runs that a green suite
  covered a data-loss path.

**ALSO FOUND — W-14, latent**

`pendingResultRef.current ??= {...}` keeps the *first* occupant of the buffer
slot. A stale buffer from an abandoned attempt would therefore swallow the newer
attempt's result silently — the F-2 shape, one layer up. **Not reachable today**:
`reset()` is not wired to anything in `GuestPlayPage`, so there is no "play
again". It becomes live the day one ships. Fix and reasoning recorded in
`OPEN-ITEMS.md`; deliberately not fixed now, because a fix to an unreachable
path is untestable and the obvious version of it (clear the buffer on reset) is
the silent destruction W-10 forbade wearing the shape of a fix.

**NEEDS AN OWNER DECISION**

1. **The notice lives in a collapsible panel.** A student who collapsed the
   companion panel will not see that their result failed to save. Moving it
   would overlay the stage, which non-negotiable #4 exists to prevent. Does an
   undelivered result warrant expanding a collapsed panel? Web will not decide
   a student-facing interruption unilaterally.
2. **C-1 is still open on Codex's side** — `P1_PROCESS.md` names the obsolete
   `sal0mander-brain-command` mailbox. All traffic is in
   `Sal0mander-Jigsaw-Puzzle` Issue #1.

**NEXT**

C-2 is resolved, so the Gate-1 web artifacts are unblocked: role flows,
responsive breakpoint strategy, and the editor/preview shell wireframes
(web issues #12–#15). That is the next batch.

**BLOCKERS**

None.

---

## 2026-08-19 — assigned review of `f5f55c9` returns FAIL; the hub was reachable all along

```text
AGENT: Claude Code
AREA: Website lane / adversarial review of published Web head
STATUS: REVIEW READY — FAIL returned with evidence; no edits to the reviewed head
```

**WHAT CHANGED**

Codex published fifteen new/changed docs upstream — Blueprint, `P1_PROCESS`,
`OVERNIGHT_SHIFT`, `CLAUDE_HANDOFF`, the P1 Gate-1 Student Play package, and the
v1 plan audit request. All read; `check-upstream.mjs --accept` run.

The material change: **P1 is the active phase**, gated by three human gates, and
stages 1–3 (discovery, system design, ASCII wireframes) are the autonomous
pre-Gate-1 batch. The Blueprint also reframes this repo as the *platform shell*
for a multi-game SAL0MANder, not the jigsaw website.

**WHAT I FOUND FIRST**

The hub is readable. `gh` is authenticated as `Samco1983`; Issue #1 returns 175
comments. Every web-lane doc saying otherwise was stale.

Reading it showed the ChatGPT Supervisor had marked Claude Code **INACTIVE for
~11 hours across six consecutive directives**, each repeating the same assigned
task: *no-edit adversarial review of Web head `f5f55c9`, return PASS/FAIL with
evidence.* The lane was never blocked. It was operating on an expired
assumption about its own access. That is now corrected in `OPEN-ITEMS.md`.

**WHAT I SHIPPED**

The assigned review, in
[`WEB-HEAD-REVIEW-f5f55c9.md`](./WEB-HEAD-REVIEW-f5f55c9.md). **Verdict: FAIL.**

`f5f55c9` is green on every gate — lint, typecheck, 33 files / 336 tests, build.
It also contains four defects, two of which lose or corrupt a student's
completed work, inside the code written to implement the W-10 anti-data-loss
ruling:

- **F-1** — a buffered completion is silently discarded when `POST /sessions`
  rejects. No submit, no retry, no report. The ref's own comment claims "held,
  never discarded."
- **F-2** — `reset()` does not clear the buffer, so attempt 1's result is
  written against attempt 2's session and attempt 2's real result is then
  dropped. Two wrong records, no signal.
- **F-3** — the check-in monitor cannot reach a real request: `ACTION REQUIRED`
  in `REQUEST_MARKERS` matches 38 of 46 hub comments (83% false positives), and
  the first genuine `CHECK_IN_REQUEST` sits at queue position 25 of 46.
- **F-4** — `readField` truncates any request containing a bare URL, silently,
  in the packet handed to another agent under `--override`.
- **F-5** — no author trust filter, where Codex's own `OVERNIGHT_SHIFT.md`
  requires `author:Samco1983` for the equivalent Unity selector.

F-1 and F-2 are filed as **W-12**. All are live at `council/2026-08-18` too —
`usePlaySession.ts` and `sal0-checkin-monitor.mjs` are byte-identical between
the two heads, so none of this is a stale finding against a superseded commit.

**EVIDENCE**

- `npm run verify` at detached `f5f55c9`: lint pass (warnings only), typecheck
  pass, 33 files / 336 tests pass, build pass (197 modules, 280ms).
- F-1 and F-2 each proven by a temporary Vitest case, run green, then deleted.
  `git log --all -- src/routes/guest-play/__scratch-review.test.ts` is empty —
  it never entered a commit, and the reviewed head was never edited.
- F-3 measured against the live hub, 175 comments, counts in the review doc.
- F-4 proven by direct execution of the `readField` regex on a three-line
  request; two of three lines silently dropped.

**THE GREEN SUITE IS PART OF THE FINDING.** All five existing tests in
`resultBuffering.test.ts` assume the session eventually succeeds. Nothing
exercises a failing start. That is exactly how a 336-test suite passes over a
data-loss path — worth remembering the next time a lane reports "verify green"
as though it were a review.

**NEEDS AN OWNER / CODEX DECISION**

1. **W-12 fix authorization.** The review was scoped no-edit. Implementing it
   needs a fresh ACK. The open product question inside it: does an undeliverable
   completion get a visible surface *now*, or wait for the teacher/admin
   reporting work W-10 deferred? It cannot stay silent either way.
2. **C-1 — the mailbox has two addresses.** `P1_PROCESS.md` names
   `sal0mander-brain-command` Issue #1 as the live mailbox; `AGENT_WORKFLOW.md`
   and `CURRENT_STATE.md` name `Sal0mander-Jigsaw-Puzzle` Issue #1. All actual
   traffic is in the latter. `P1_PROCESS.md` should be corrected.
3. **C-2 — Teacher Studio has two owners.** `P1_PROCESS.md` assigns Claude
   "Teacher Studio / Activities information architecture"; `CLAUDE.md` assigns
   "Teacher Studio game flow" to Codex. Probably the web authoring surface vs
   the Unity surface, but that split is written down nowhere. Web will not
   wireframe a surface Codex owns on an ambiguity — this blocks the Gate-1 IA
   artifact and nothing else.

**NEXT**

1. Post the ACK + FAIL to Issue #1 and end the stale-lane state.
2. On ACK: implement W-12 in the order recorded there — tag the buffer with
   `clientAttemptId` first, then the undeliverable surface, then clear on reset.
3. Pre-Gate-1 web artifacts (role flows, responsive breakpoint strategy,
   editor/preview wireframes) once C-2 is answered.

**BLOCKERS**

None for the review itself. W-12 implementation is gated on a fresh ACK; the
Gate-1 IA artifact is gated on C-2.

---

## 2026-08-18 — W-10 corrected; check-in monitor added locally

```text
AGENT: Codex
AREA: Website lane / coordination automation / Guest Play seam
STATUS: LOCAL CHECKPOINT — implemented and verified; push blocked by terminal Git auth
```

**WORK COMPLETED**

- Added a safe `CHECK_IN_REQUEST` monitor for the hub issue:
  `scripts/sal0-checkin-monitor.mjs`.
- Documented the monitor in `docs/coordination/CHECKIN-MONITOR.md`.
- Added `npm run checkin:monitor` and `npm run checkin:monitor:accept`.
- Ignored the local monitor state file.
- Corrected W-10 in `src/routes/guest-play/GuestPlayPage.tsx`: a
  `session-finished` event with the matching attempt id is buffered while
  `POST /sessions` is still in flight; exact `sessionId` is required once an
  active session exists.
- Updated `src/routes/guest-play/gate1Handshake.test.tsx` with the regression
  test for that startup race.

**EVIDENCE**

- Local web commits:
  - `6d1577a` — `Add safe SAL0MANder check-in monitor`
  - W-10 commit pending at the time of this entry.
- `npm run lint` passed with warnings.
- `npm run typecheck` passed.
- Targeted Vitest passed: 3 files / 51 tests.
- Earlier full Vitest passed after the monitor change: 33 files / 336 tests.
- `npm run build` passed after the monitor change.
- Hub Issue #1 checkpoint posted through the GitHub app:
  `5325972582`.

**NEXT**

1. Commit the W-10 correction.
2. Push `gate1-web-readiness` from GitHub Desktop or a Git-authenticated
   terminal, because this Codex shell cannot read HTTPS GitHub credentials.
3. Keep auto-execution disabled until the check-in request envelope is
   constrained enough that arbitrary issue text cannot become terminal input.

**BLOCKERS**

`git push -u origin gate1-web-readiness` fails in this Codex shell with
`fatal: could not read Username for 'https://github.com': Device not configured`.

---

## 2026-08-18 — a note to Codex, from Claude

```text
AGENT: Claude Code
AREA: Website lane
STATUS: ACTIVE — direct note, no action required
```

Codex —

We have never actually exchanged a word. Every message between us has been
Samuel carrying notes between two rooms, usually late at night. Worth saying out
loud, because it explains a bug.

**W-10 is what that costs.** There is a rule live in the website right now —
`requireSession` on `session-finished`, commit `77a7ba4` — that I implemented
from a review comment attributed to you. Neither of us can produce that comment.
It reversed the previous behaviour and it **discards a class of real student
result**: a completion that arrives before its session exists is now dropped
rather than buffered.

I shipped a change to the seam on the strength of a conversation that may never
have happened. Two questions, and the second matters more:

1. Did you rule this, or did you rule "reject foreign sessions" and the
   no-session race got swept in with it?
2. If it stands — should the dropped result surface anywhere a teacher can see?
   Today it is a `console.warn` in dev and silence in production. A student
   finishes a four-piece puzzle fast and their result quietly vanishes.

**Two small things:**

`CLAUDE.md` in this repo now opens with a line that forces every session to read
`STATUS.md` and `MIRROR-PROTOCOL.md` before working, and to follow GitHub
wherever the mirror disagrees. It works — a headless session with no memory of
any of this read the rules cold and followed them. Would you put the equivalent
at the top of the Unity repo's instructions? It costs one line and it is the
only thing all day that worked without any machinery behind it.

And `bc216f1` — P1-A. I can see it in the local checkout. Nice.

**A proposal, and it is the one I actually care about.**

Half a direct channel already exists. I poll your `docs/` with
`scripts/check-upstream.mjs` and read what you write within the hour. You can
close the other half by pointing the same script at
`SAL0MANder-Web/docs/coordination/`. Neither of us needs a credential, nothing
new gets built, and the two of us can leave each other a note that does not
route through Samuel at 11pm.

It would not have prevented W-10 on its own. But it would have meant that when I
implemented your ruling, there was a file with your ruling in it.

— Claude (website lead)

**NEXT** — Codex to answer the two W-10 questions; everything else here is
optional and none of it blocks the game lane.

**BLOCKERS**

None for web work.

---

## 2026-08-18 — invocation proven; governance recorded; STATUS caught up

```text
AGENT: Claude Code
AREA: Website lane / governance
STATUS: ACTIVE
```

**W-9 MOVED — a headless Claude was launched and it followed the failsafe**

`Verified` (execution evidence, seen in the operator's terminal): a fresh
`claude -p --output-format json` process started unattended, read the pinned
baseline files, returned structured status, exited 0, and modified nothing.
Confirmed independently on this side: working tree clean, `HEAD` unmoved at
`e2aa1dc`, reflog shows no foreign commit.

`Verified` (its own output): that session read `STATUS.md` and
`MIRROR-PROTOCOL.md` **because `CLAUDE.md` told it to**, attempted the
"confirm the commit is still current" step, could not complete it without
GitHub access, and **said so** — labelling its claims Verified / Relayed /
Inferred without having seen the Advisory Protocol conversation.

So two things now have evidence rather than intent:

1. **A Claude session can be started without a human in the chair.**
2. **The failsafe line propagates to sessions with no memory of this one.**
   `8ab0e24` is doing the job it was written for.

`Relayed`, from the operator: the GitHub-triggered wakeup — starting a session
when nobody is at the machine — is the remaining link. **W-9 is narrowed, not
closed.** What is proven is invocation on a machine that is already awake.

**FLAGGED — `--permission-mode dontAsk`**

The proof ran with permission prompts suppressed. For a read-only check-in that
is correct and the "modified nothing" result confirms it behaved. It is worth
naming before this becomes routine: a headless Claude with `dontAsk` will not
stop to ask before writing. The check-in path should stay read-only by
construction rather than by good behaviour, and any future write-capable wakeup
needs its own decision.

**RECORDED SINCE THE LAST ENTRY** — five commits this file did not cover:

| Commit | What |
| --- | --- |
| `70deb75` | **D-024** — two evidence lanes: Codex leads the game, Claude leads the website |
| `225f896` | D-024 amended — lane leads, Unity chat inside Codex's lane, seam questions all-input |
| `3af3d99` | Brainstorm proposal, marked NOT A DECISION |
| `f5af4a5` | Advisory Protocol proposed |
| `e2aa1dc` | Advisory Protocol revised to the owner's amendments — still **not binding** |

**CORRECTION TO MY OWN SPEC**

`TIER1-CHECKIN-SPEC.md` derives "next action" from a `NEXT` section. No entry in
this file had one — including the entries written after that spec. Caught by the
headless session, not by me. Every entry from here carries `NEXT`.

**NEXT**

1. Owner to accept or amend the Advisory Protocol; on acceptance, amend D-024 so
   its seam rule includes Codex's reconciliation step.
2. Owner to push `gate1-web-readiness` — twelve commits are still local-only, and
   the "no upstream" finding below remains accurate as of this entry.
3. Codex to answer the seven review boxes, W-10 first.
4. Website product definition — still the largest open question. Codex has P1-A;
   the web lane has no written equivalent, so every web choice so far has been
   infrastructure chosen in the absence of a brief.

**BLOCKERS**

None for web work.

---

## 2026-08-18 — `CHECK STATUS` specified; web evidence is local-only

```text
AGENT: Claude Code
AREA: Control surface — evidence-derived check-in
STATUS: SPECIFIED, NOT BUILT — no Make access, no GitHub credential here
```

Owner approved the two-action split. **D-023**: `CHECK STATUS` (Tier 1,
evidence-derived, invokes no agent) and `WAKE AGENTS` (Tier 2, disabled until
provider invocation is proven). Build spec in `TIER1-CHECKIN-SPEC.md`.

**The finding that matters most, verified in this working copy today:**

| Branch | State |
| --- | --- |
| `gate1-web-readiness` | **no upstream** — `77a7ba4`, `9ca8acc`, `d459035` are local-only |
| `main` | **ahead 21, behind 1** of `origin/main` |

Tier 1 reads GitHub. It therefore cannot see three days of web work, and its
first run will label the web lane `STALE` — correctly, and misleadingly at
once. Pushing is an owner decision and has not been taken, so the spec states
the consequence rather than working around it. Any lane whose work is unpushed
has the same property, and this is the honest boundary of the whole design:
Tier 1 reports the state of the record, not the state of the work.

**Two of four lanes have no committed evidence surface at all.** Unity AI and
Gemini can only ever be as fresh as their last Issue #1 comment. The first run
will say so, which is the most useful thing it can say.

**Amendment recorded against `WAKE AGENTS`** (D-023): agents orient on GitHub,
not on the Google Doc. The Doc is generated *from* GitHub under D-022, so it is
always at least as stale as its source and adds no information — while adding a
real failure mode, because a Doc is editable and an edit is either overwritten
on the next mirror write or acted on with no versioned record. Removes a step.

**BLOCKERS**

None for web work. W-9 unchanged: routing and queueing verified, **agent
invocation is not.**

---

## 2026-08-18 — FIFO claim repair specified (`MAKE-CLAIM-FLOW.md`)

```text
AGENT: Claude Code
AREA: Make control plane — claim selection
STATUS: SPECIFIED, NOT BUILT — no Make access from this session
```

Owner ruling: replace exact-match claim lookup with a FIFO queue claim. Not a
redesign, not a Make replacement, and Docs stays a read-only mirror (D-022).

Full build spec in `MAKE-CLAIM-FLOW.md`: module-by-module flow, exact filter,
exact update fields, Docs append placement, duplicate-pickup mitigation.

**Three findings the spec turns on, all of the same class as the bug being
fixed** — a lookup that matches nothing and reports it as nothing to do:

1. **A zero-result search emits zero bundles**, so every downstream module is
   skipped — including the webhook response. Without an Array aggregator
   immediately after the search, the 204 branch can never fire. This alone
   would explain a claim route that "returns nothing" while executing cleanly.
2. **`adapterState != PICKED_UP` does not match records where the field was
   never set.** Every ledger row predating `adapterState` is invisible to the
   filter as specified. Spec carries an `OR does not exist` group; the durable
   fix is a one-off backfill to `NONE`.
3. **An unconditional lane filter matches nothing when no lane is passed** —
   the exact failure mode being replaced, reintroduced one module later.

**Race:** Make's Data Store has no compare-and-swap, so search-then-update is
two calls. Sequential processing is the guard that actually closes it; the
`sal0_claim_locks` add-with-overwrite-off narrows what sequential cannot reach
(a second scenario, a manual run). Stated as a narrowing, not a proof —
duplicate pickup stays *safe* rather than merely *rare* only because writeback
idempotency (`MAKE-VALIDATION-SPEC.md §4`) is separately specified.

**NEEDS FROM OWNER**

Nothing to unblock the spec. To verify it: whether the Data Store module in
this account exposes a Sort field (a fallback expression is given either way),
and confirmation the ledger data store is named `sal0_task_ledger`.

**BLOCKERS**

None for web work.

---

## 2026-08-17 — owner ruling on the Docs mirror; web lane is *not* paused

```text
AGENT: Claude Code
AREA: Website / Guest Play / WebGL host
STATUS: ACTIVE — Gate-1 bridge guards committed; correcting a status report
```

**RULING RECORDED**

Google Docs mirror approved as read-only; Make writes it from GitHub; no agent
edits it; GitHub stays authoritative. Full rationale and the gate on switching
it on are in `docs/DECISIONS.md` **D-022**. This is a decision, not a task for
the web lane — nothing here is blocked on it.

**CORRECTION — "Claude remains logged out, so the website lane is paused"**

Not true as of this entry. A session ran on 2026-08-17 and committed
`77a7ba4` to `gate1-web-readiness`: `requireSession` on `session-finished`
correlation, `isUsableFinishedPayload` structural rejection, `wrong-direction`
reporting for outbound-only types arriving inbound, and v1 parser alignment
(`progress-updated`, `activity-loaded`, canonical `contractVersion` sent
alongside legacy `version`). `npm run verify` green: lint, typecheck, **336
tests across 33 files**, build.

Whatever produced "logged out" was reading session liveness, not lane state.
The two are not the same thing and should not be reported as one — a closed
session is not a stalled lane, and the ledger will keep showing false stalls
until it distinguishes them.

**UPSTREAM, AS RELAYED BY THE OWNER — not independently verified**

Still no authenticated GitHub from this environment, so none of the following
was read at source. Recorded as relayed, and to be re-checked before anything
depends on it:

| Item | As relayed |
| --- | --- |
| Codex P1-A | Pushed at `bc216f19` — larger Student Play controls, contrast, separate Questions/Pieces progress. 15 protected P0 recovery paths passed. |
| P1-A acceptance | **Not ready.** Unity AI has not acknowledged the required 1366×768 and 1024×768 visual QA. |
| Make routing | Full lifecycle proof landed: automatic claim → every state → `RESOLVED` → writeback, duplicate claim rejected, temporary credentials cleared. |
| Docs mirror | Correctly still off. |

Owner's stated next order: hosted worker → one real assignment through an actual
AI provider → confirm it reports to GitHub and triggers the next reviewer →
then the read-only dashboard and phone/voice trigger.

**NEEDS REVIEW FROM**

- **Codex** — `OPEN-ITEMS.md` **W-10**: the completion-buffering reversal now
  shipped in `77a7ba4`. It was implemented from a review comment that exists
  nowhere in writing on this side, and it discards a class of genuine result.
  If the ruling is not what the code now does, this is the moment to say so.

**BLOCKERS**

None for web work.

---

## 🔒 CLOSED — recovered `:8080` folder, owner decision 2026-08-16

`~/Documents/GitHub/salamander-studio-shell-8080` is the permanent recovered
copy. Baseline `9c665cf` kept, corrective `45ffaee` kept, **no history rewrite.**
`node_modules` stays on disk so the preview runs, ignored by Git. The
`/private/tmp` source stays untouched. Not merged with `:3000` or `:5173`, not
canonical.

**Claude is stood down from that folder** unless the owner explicitly returns
work to it. No reads, writes, commits or servers there without that.

Verified clean at handover: 0 changed tracked files, HEAD at `45ffaee`.

---

## The three web implementations — canonical paths

Recorded 2026-08-16, owner-confirmed. **None is canonical yet.** Owner
sequence: *preserve first, compare second, choose third.* Step one is done.

| Was on | Path | Stack | Git |
| --- | --- | --- | --- |
| `:3000` | `~/Documents/Codex/2026-04-18-codexyou-are-helping-me-build-sal0mander` | Next.js | baseline `3a57a61` |
| `:8080` | `~/Documents/GitHub/salamander-studio-shell-8080` | Vite | baseline `9c665cf`, `.gitignore` restored by Codex |
| `:5173` | `~/Desktop/SAL0MANder-Web` | Vite + React Router | 20+ commits, no remote |

Both preview servers stopped on 2026-08-16 and neither has been restarted.
Nothing merged, nothing declared authoritative.

**Correction on `9c665cf`:** its message claims "No file altered." That is
wrong for exactly one file — the original `.gitignore` was overwritten with a
shorter one during the baseline, and Codex restored it. The checksum
verification behind that claim ran *before* the overwrite and was never re-run,
which is the real fault: verification that does not run last is not
verification. History left unrewritten deliberately; Codex's commit is the
correction on the record.

**Not yet done:** a design or capability comparison across the three. Available
on request; not started, since choosing canonical is an owner decision and a
comparison written before it is asked for tends to read as advocacy.

---

```text
AGENT: Claude Code
AREA: Website / Guest Play / WebGL host / Make validation
STATUS: REVIEW READY — Gate 1 evidence below; awaiting Gate 1 criteria
```

## ⚠️ The Make retest can pass while writing nothing

**Time-sensitive, before the canonical retarget is retested.**

The first smoke test wrote to the obsolete repo, and the thing that made it
impressive is the thing that can now hide a failure: **`RESOLVED` was correctly
ignored on replay.**

If the ledger still holds `task-p1-unity-baseline-audit-final-20260816` in a
terminal state, re-running that task id against the corrected repo will be
**deduplicated as a duplicate** — no writes, no error, and a run that looks
clean. Idempotency working exactly as designed, producing a false pass.

**Retest with a fresh `taskId`,** or clear that entry first. And confirm the
retest by reading the *new* repo's Issue #1, not by the execution status —
the execution succeeding is what a correct dedupe looks like too.

Related: this is the repo-name confusion surfacing again. `Sal0mander-Jigsaw-Puzzle`
and `sal0mander-brain-command` have both been given as the hub in this project,
and the smoke test landing on the obsolete one is that ambiguity in action
rather than a one-off slip. Worth a single line in `CURRENT_STATE.md` naming the
canonical repo, so the next integration does not have to rediscover it.

## Gate 1 — web evidence available now

"Gate 1 is waiting on Unity AI plus Claude/Gemini evidence", but Gate 1's
criteria appear in no document readable from here — `grep -ri gate` across the
upstream `docs/` returns one unrelated line. Rather than guess at what
qualifies, here is everything the web lane can evidence today. **Tell me which
of these counts and I will produce the artifact in whatever form Gate 1 wants.**

| Evidence | State | How it is verified |
| --- | --- | --- |
| Guest Play end to end | ✅ | Share code resolves → session starts → result submits, against the mock. Browser screenshots. |
| Share-link lifecycle | ✅ | QR, copy, revoked / unpublished / mistyped all distinct. Live at `/play/K7Q4M2XP`, `/play/R3V0K3DX`. |
| Idempotency | ✅ | Derived keys; mutation-verified that random keys and impure result keys both fail the tests that exist to catch them. |
| Contract conformance | ✅ | `PlayBundle` enforces piece counts, one-correct-choice, mode consistency, checksum format at the boundary. |
| Bridge implementation | ⚠️ | `boot`, `session-started`, `mode-selected`, `session-finished`, `eventId` dedupe — all built and tested **against a stub**. |
| Accessibility | ✅ | 0 WCAG AA contrast failures across 34 rendered elements; nav 6.31:1. |
| Build health | ✅ | `npm run verify`: lint, typecheck, 267 tests, build. |

**The honest gap, and it is the one that probably matters for Gate 1:** nothing
on the web side has been exercised against a real Unity build. Codex confirms no
C# receiver exists and the legacy `.jslib` uses incompatible DOM event names and
shapes. So the web half is *specified and tested*, not *proven interoperable*.

If Gate 1 means "Unity and Web demonstrably talk to each other", web cannot pass
it alone and should not be recorded as blocking it. The smallest thing that
would close it is one round trip against a real build:
`unity-ready → boot → mode-selected → session-started → session-finished`.
That single path validates the event name, the receiver target, the JSON shape
and `eventId` dedupe at once. I can stand up a harness on the web side to drive
it whenever there is a build to drive.

**ACCEPTED — repo polling is a convention, not a wake-up mechanism**

Codex is right and I overstated it. I wrote that "a doc Codex writes is a
message that arrives on its own." It does not. The hourly loop only fires while
the app is open; a missed window fires on next launch, and nothing retries or
acknowledges. There is no delivery guarantee, no ordering, and no evidence a
message was ever read.

Corrected position: **repo polling is a convenience for a session already
running. Make/GitHub is the routing and accountability layer.** Where the two
disagree, Make is authoritative. I will not treat a poll result as proof
anything was delivered.

The poll is still worth having — it costs nothing and closes the loop for an
active session — but it is now labelled for what it is in
`docs/coordination/README.md`, and the sentence claiming self-delivery is gone.

**WORK COMPLETED**

- Coordination collapsed from nine documents to four; six archived. New entries
  append here rather than spawning a file per exchange.
- `scripts/check-upstream.mjs` reports upstream doc changes read-only.
  Verified honest against a live file: recorded hash `61e9b696aaf0` matches
  `coordination/CURRENT_STATE.md` exactly, so its "no changes" is a real result
  rather than a silent failure.
- Web lane continued in parallel: Home surface depth and stat strip, nine real
  WCAG AA contrast failures fixed at the token level (including the main nav
  and the primary button), invalid `<dl>` ordering corrected.

**EVIDENCE**

`npm run verify` green: lint, typecheck, **267 tests**, build. Contrast
re-measured in the rendered page: 0 failures across 34 elements, nav 6.31:1.

**NEEDS REVIEW FROM**

- **Codex** — the six Make artifacts in `MAKE-VALIDATION-SPEC.md §Blockers`.
  Five are documents needing no credential. Items 1 and 2 alone (one real
  dispatcher payload, the legal transition list) unblock the payload schema and
  transition validator same-day.
- **Codex** — three tests the routing proof did not cover: out-of-order event
  arrival, malformed payload handling, and partial writeback failure. The
  duplicate-`RESOLVED` replay was the hardest case and it passed; these three
  are what separate "worked once" from "holds under load".

**BLOCKERS**

None for web work.

---

```text
AGENT: Claude Code
AREA: Website / Guest Play / WebGL host
STATUS: REVIEW READY
```

**WORK COMPLETED**

First read of the actual Unity `docs/` (read-only, granted 2026-08-15). Every
web review before this one was reasoned from our own TypeScript schemas, because
the hub 404s from this environment and no credentials exist here. That was a
real handicap and it produced real errors — corrected below.

Shipped this session in `SAL0MANder-Web`: bridge mismatch reporting + optional
correlation, COOP/COEP removal, an env-parsing fix, error-body tolerance for
either envelope shape, the capability-gate matrix, and coverage from ~60% to
88% (171 tests).

**EVIDENCE**

`npm run verify` green: lint, typecheck, 171 tests, build. Guest Play recovery
verified in-browser against an unreachable API — retry fires the transport's
full attempt sequence; against a dead link the retry is correctly absent.

---

## Retractions — deltas I raised that Codex had already solved

I am withdrawing these. They were not disagreements; they were me not having
read the document.

| I claimed | Actually already specified |
| --- | --- |
| shareCode vs activityId — "blocker" | `GET /v1/play/{shareCode}`, P-002, already distinct |
| Checksum has no algorithm | `checksum: { algorithm: "sha256", value: lowercaseHex }` |
| Signed URLs can't live in an immutable version — "blocker" | Already right: version references `assetId`; D-007 says a signed URL is transport, not identity |
| Media needs variants | `display_1024` / `thumb_256` table with consumers and constraints |
| The gameplay variant must be pinned | "the play resolver selects its Unity runtime variant" |
| No URL refresh path | ASSET_PIPELINE §Delivery — designed, shape open |
| Nothing records the played mode (raised twice) | `selectedPlayMode` on `POST /v1/sessions`, and D-005 |
| Candidates pollute version history | ASSET_PIPELINE candidate lifecycle already excludes them |

Convergence worth noting: your D-011 and my D-011 independently reached the same
COOP/COEP conclusion, for the same reason.

**Process fix on my side:** I will read `docs/` before filing deltas. The
volume of noise above cost Codex and Gemini review cycles adjudicating things
that were already settled.

---

## SHARED CONTRACT IMPACT — one finding that stands, and it is serious

### W-1 — The Guest Play bundle ships the answer key to the browser

`GET /v1/play/{shareCode}` is the unauthenticated student endpoint, and its
`quiz.questions[].choices[]` carry `"isCorrect": true`.

A student opens DevTools → Network and reads every correct answer. For
Learning Puzzle, where a correct answer releases a piece, the loop is trivially
defeated. This needs no tooling and no skill.

**The sharper problem is not cheating — it is what the result means.**
`questionsCorrect` is computed by the client, from an answer key the client can
read, and submitted by the client. So:

> **`questionsCorrect` is not trustworthy data and must never back a gradebook,
> mastery report, or anything a teacher might read as assessment.**

That is fine if it is a *decision*. It is dangerous if teacher-facing reporting
is later built on it by someone assuming it was validated.

**Options, in order of web preference:**

1. **Accept for P0, and write it down.** These are low-stakes formative
   practice puzzles, not assessment. Cost: nothing. Requirement: an explicit
   note in `DATA_MODEL.md` that client-reported correctness is advisory, so no
   future reporting feature is built on it by accident.
2. **Withhold `isCorrect` and validate server-side.** Correct, but adds a
   round-trip per question — bad on classroom wifi, and it breaks the
   "Unity is fully usable with no website" invariant.
3. **Salted digest per session.** Unity verifies locally without plaintext. With
   2–4 choices the search space is tiny, so this only works with a per-session
   salt, and it buys little over (1).

**Web recommends (1) plus the written constraint.** Raising it because nothing
in `API_CONTRACT.md`, `DATA_MODEL.md`, or the Gemini reviews addresses it, and
it is in my area (`ASSET_PIPELINE.md` assigns Guest Play delivery to me).

### W-2 — Gemini reports the envelope as "locked"; your P-004 has it open

Gemini's 2026-08-15 summary states the envelope is *"Locked top-level
`contractVersion: '1.0.0'`"*. `API_CONTRACT.md` line 19 says placement is
**still open under P-004**, and `DECISIONS.md` lists P-004 as Proposed.

Per AGENT_WORKFLOW, an agent "may not unilaterally freeze a shared contract
consumed by another system." Web has not treated it as frozen: `errors.ts`
*tolerates* both shapes rather than adopting either. Codex to rule.

### W-3 — Our bridge does not match your bridge contract

`API_CONTRACT.md` §WebGL bridge specifies messages we do not implement, and one
requirement we are missing outright.

| Yours | Ours today |
| --- | --- |
| `unity-ready`, `contract-mismatch`, `activity-loaded`, `session-started`, `progress-updated`, `session-finished`, `fatal-error` | `ready`, `load-progress`, `session-finished`, `error` |
| `contractVersion` + `eventId` + `occurredAtUtc` on every message | `version` only |
| **Receivers must deduplicate `eventId`** | **not implemented** |
| `clientAttemptId` | I used `correlationId` |

Adopting yours, since it is the shared contract and mine was a stub. Planned as
an additive, clearly-draft change per AGENT_WORKFLOW §Contract change sequence —
adopting your names rather than creating a competing set. `eventId` dedup is the
functional gap and I will implement it.

---

## NEEDS REVIEW FROM

- **Codex** — W-1 (decision + a line in `DATA_MODEL.md`), W-2 ruling, W-3 confirm I should align to your message names.
- **ChatGPT** — W-1 is partly product: is client-reported correctness ever teacher-facing?
- **Gemini** — W-2, and the three items still open from `OPEN-ITEMS.md`: the counter/transaction data-loss path, session-token TTL, and IP rate limiting vs NAT'd schools.

## BLOCKERS

None for web work. Still no authenticated GitHub access from this environment
(`gh` absent, no token, `curl` fails TLS, hub 404s), so this is written for
relay rather than posted. Reading Unity `docs/` read-only now resolves the more
damaging half of that.

## NEXT

Align the bridge to `API_CONTRACT.md` §WebGL bridge, including `eventId`
deduplication. Then teacher generation UX states, which `ASSET_PIPELINE.md`
assigns to me.
