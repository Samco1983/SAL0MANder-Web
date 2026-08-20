# Web status updates

Newest first. Format per `AGENT_WORKFLOW.md`.
This file and `OPEN-ITEMS.md` are the technical handoff source for the web lane.

---

## 2026-08-20 — fixed the bball V3 picker filing duplicate "shot bank exhausted" issues; W-10…W-16 HOLD still stands, nothing new to answer on the hub

```text
AGENT: Claude Code
AREA: Council tooling — hourly work-loop check-in; bounded non-held infra fix
STATUS: SHIPPED — `8f0a222`, verify green, mutation-verified; HOLD on W-10...W-16 unaffected
```

**CHECKED FIRST**

`git status`: clean at `18136c8` before this run, 2 local commits ahead of
`origin/council/2026-08-18` (the merge-from-main commit and the Aug 15
`overnight-claude-web-worker.yml`/`overnight-gemini-web-review.yml` automation
that had never been pushed) — pushed both, no conflicts. `node
scripts/check-upstream.mjs`: no upstream Unity-docs changes. `gh auth status`:
healthy. Hub (`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle
--comments`) reachable; newest comment is still my own prior run's `13:08:07Z`
Gemini-credential finding — no reply from any lane since, nothing new to
answer.

**WHAT I FOUND**

`gh issue list --repo Samco1983/SAL0MANder-Web --state open` showed two
identical open issues, `#46` and `#47`, both titled `[WEB][PRODUCT] Split the
next smallest user-visible web shot`, filed 26 minutes apart
(`12:23:39Z`/`12:49:47Z`) by the same automated mechanism
(`scripts/lib/sal0_bball_v3.py`, confirmed by grep — this is the only place
that title string exists). Root cause in `build_packet()`: every real
candidate is deduped against `open_issue_titles()` before ranking, but the
synthesized "shot bank exhausted" fallback issue (created when the real
candidate list is empty) was created unconditionally — it never checked
whether an identical fallback issue was already open. Every scheduled run
that finds the bank empty was filing a fresh duplicate. Codex's `aed4c73`
(05:23:24Z, earlier today) is what introduced this fallback in the first
place — not reverting anything, closing a gap it left.

**WHAT I DID**

Closed `#47` as a duplicate of `#46`, with the root cause in the close
comment. Fixed `build_packet()` to check `open_issue_titles()` for its own
fixed title (`EXHAUSTED_BANK_TITLE`) before creating it — if already open,
action becomes `HOLD` with an explicit reason instead of filing a second
issue. Added `test_v3_does_not_duplicate_the_exhausted_bank_issue` in
`sal0_bball_v3_test.py`.

**Mutation-verified before committing**: temporarily forced the new dedup
check to `if False:` — the new test failed as expected
(`'CREATE_PRODUCT_ISSUE' != 'HOLD'`), confirming it actually exercises the
fix rather than passing regardless. Reverted, all 6 tests in the file green,
`git diff` matched only the intended fix before staging.

Scope check: `scripts/lib/` council tooling, not `src/` runtime, not
`docs/design`, not W-10...W-16, no non-negotiable touched.

**EVIDENCE**

`npm run verify` green: lint (pre-existing script warnings only, unrelated),
typecheck, **65 files / 700 tests**, 58 Python mission tests (up from 57:
+1 new test), build. Commit
[`8f0a222`](https://github.com/Samco1983/SAL0MANder-Web/commit/8f0a222),
pushed clean. Issue close:
[`#47`](https://github.com/Samco1983/SAL0MANder-Web/issues/47#issuecomment).

**NEXT**

Still watching for Gemini's bounded W-16 privacy/security verdict, the sole
outstanding half keeping W-10...W-16 frozen — same as every recent entry, not
re-litigating it. No other separable, non-held, web-actionable defect found
this run; checked W-11/W-18/W-9 (all still blocked on Codex/Unity per
`OPEN-ITEMS.md`) before landing on the duplicate-issue fix instead of
defaulting to coverage padding.

**BLOCKERS**

None technical. Same W-10...W-16 coordination hold as every prior entry.

---

## 2026-08-20 — the real reason W-16's verdict has never landed: Gemini has no credential, not a queue problem; caught up one unlogged web commit

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in; blocker surfaced to owner + docs catch-up
STATUS: FOUND — Gemini is structurally unreachable, not silent by choice; one real web commit mirrored into this file
```

**CHECKED FIRST**

`git status`: clean at `f13613a`. `node scripts/check-upstream.mjs`: no
upstream Unity-docs changes. Hub (`gh issue view 1 --repo
Samco1983/Sal0mander-Jigsaw-Puzzle --comments`) reachable; newest comment is
the Supervisor's `12:54:21Z` cycle, item 4 to Claude: keep W-10…W-16 HOLD, the
W-17 review is accepted, no new runtime change without a concrete correction
request or a tracked separable defect. Nothing new addressed to Claude beyond
that reconfirmation, so not re-posting a bare ACK.

**THE FINDING WORTH SURFACING**

Every Supervisor cycle for days has repeated some form of "GEMINI — ACK only
the bounded W-16 privacy/security review" and gotten silence, read each time
as a stale/unresponsive lane. `docs/coordination/BLOCKERS.md` **B-10** (filed
2026-08-20 by a different SAL0-04 process, never mirrored to this file or the
hub) has the actual reason: **Gemini cannot authenticate at all.**

Verified directly, not trusted from the doc:

```
env -i HOME="$HOME" PATH="/usr/local/bin:/usr/bin:/bin" gemini -p "Reply with exactly: ALIVE"
→ API_KEY_INVALID — "API key not valid. Please pass a valid API key."
```

`GEMINI_API_KEY` / `GOOGLE_API_KEY` / `GOOGLE_GENAI_API_KEY` are all unset (not
wrong — absent), and `~/.gemini/oauth_creds.json` does not exist — confirmed
by `ls`, no credential value read. The interactive login on 2026-08-18 never
persisted a token to a file a non-interactive shell (this loop, launchd, a
scheduler) can read. Same failure class as the earlier eight-hour Claude
credential outage.

**This means the W-10…W-16 hold, as currently scoped, cannot resolve on its
own.** It is waiting on a review from a seat that has never once been able to
start a session. No amount of re-asking on the hub fixes this — the fix is a
one-time interactive step only the owner can do: run `gemini`, choose *Login
with Google*, complete the browser step. That writes the missing
`oauth_creds.json`. An API key would also work but adds a secret to manage;
the OAuth login adds none. `docs/coordination/BLOCKERS.md` B-10 has the exact
verify-after command.

**SEPARATE, SMALLER CATCH-UP**

`HEAD` had one real web-product commit not yet mirrored here:
[`58522bc`](https://github.com/Samco1983/SAL0MANder-Web/commit/58522bc) — the
`verify:deployed` deploy gate now also asserts the phone/mobile viewport meta
tag on the `/` and `/play/demo-activity` responses, closing the other half of
the "track 1" deploy-artifact audit Codex assigned (desktop half landed
earlier in `34ecfd5`). Confirmed the tag is actually present in `index.html`
(`width=device-width`, `viewport-fit=cover`) so the new gate check isn't
asserting against nothing. Already reported to Codex directly via
`docs/coordination/INBOX.md` (`935958a`, "report track 1 complete... as FYI,
not an ask") — this is a mirror for this file's own record, not a new report.
The other ten commits in the same range are `council:`-prefixed Mission
Control/inbox-gate automation (game-system tooling, not web product) —
noted, not reviewed in depth, same treatment as prior bball-system commits in
this file.

`npm run verify` at current `HEAD`: lint (same pre-existing script warnings as
every prior entry), typecheck, **65 files / 700 tests**, 57 mission tests,
build. All green.

**EVIDENCE**

Docs-only commit this run (this entry). No source touched — `58522bc` was
already committed and verified by the process that shipped it.

**NEXT**

Relaying B-10 to the hub so the Supervisor's repeated per-cycle ask stops
re-asking a seat that structurally cannot answer, and so the owner sees the
actual one-time fix instead of another "still waiting on Gemini" line.

**BLOCKERS**

B-10 (Gemini OAuth login) — owner-only, no agent here can complete it. Same
W-10…W-16 hold as every prior entry, now with the real cause named instead of
assumed silence.

---

## 2026-08-20 — bounded W-17 accessibility/regression review, as directed; ACK'd the HOLD chronology correction

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in; bounded review per Supervisor directive
STATUS: REVIEWED — no stop-ship finding; one minor non-blocking UX edge case noted; W-10...W-16 HOLD confirmed
```

**CHECKED FIRST**

`git status`: clean at `4e6cbc1`. `node scripts/check-upstream.mjs`: no
upstream Unity-docs changes. `gh auth status`: authenticated, healthy. Hub
(`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle --comments`)
reachable; newest comment is the Supervisor's `11:55:51Z` reconciliation,
addressed to Claude by name (item 2): "ACK the chronology correction. Keep
W-10…W-16 HOLD. Do not touch the in-progress W-17 working-tree edit while
another agent owns it. After a clean W-17 commit lands, perform bounded
accessibility/regression review only; no self-acceptance or deploy." That
directive postdates my last hub post (the `11:47:11Z` docs catch-up), so this
run answers it directly rather than re-raising anything already settled.

**ACK**

The Supervisor's chronology correction is right: an earlier "keep playing"
note cannot supersede the later, more specific `10:59:05Z` hold directive,
which I had already ACKed once before finding the six unlogged commits. W-10…W-16
runtime/merge/deploy stays frozen pending Gemini's privacy/security verdict —
not relitigating it.

**WHAT I DID**

W-17 had already landed cleanly by the time this run started — two commits,
both already on `HEAD`, neither mine: `5755236` (Codex/SAL0-01) added the
structural `42%` cap to `CompanionLayout.module.css`, and `5c4c514`
(SAL0-04) hardened the test to assert the invariant ("majority of stage
survives a reveal") instead of the literal number, closing issue #42. No
working-tree collision to avoid — the edit I'd seen mid-flight last run had
already been committed and pushed before this one began.

Did the bounded accessibility/regression review the directive asked for,
against code and tests rather than trusting the commit messages:

- `npm run verify` green at `HEAD`: 65 files / **700 tests**, 52 mission
  tests, build.
- Read `CompanionLayout.tsx` and its CSS end to end. The `42%` cap only
  applies via `data-revealed='true'`, which is `reveal && !collapsed` — the
  manual-open path keeps its existing `62%`, matching the ruling's scope
  (structural cap on auto-reveal, not a redesign of manual behavior).
- Accessibility wiring holds up: the revealed `role="alert"` content
  (`GuestPlayPage.tsx:33`/`74`) is inserted in the same `useLayoutEffect` that
  opens the panel — not a passive effect — so there's no frame where
  AT-hidden content carries an alert role. Focus never moves
  (`does not take focus from the student` test, confirmed by reading it, not
  just its name). `aria-expanded`/`aria-controls` stay wired to the toggle.
  The stage node identity survives every reveal/collapse cycle — non-negotiable
  #4, confirmed by both the existing test and by reading the CSS-only nature
  of the collapse (no conditional render of `stage`).
- Confirmed issue #42 is closed with a write-up matching current code, and
  `OPEN-ITEMS.md`'s W-17 section already reads ✅ RESOLVED with accurate
  evidence — no docs drift to correct here, unlike the six-commit gap two
  runs ago.

**ONE FINDING — minor, not fixed**

`data-revealed` is evaluated continuously (`reveal && !collapsed`), not just
on the auto-open edge. If a student manually opens the companion (62% cap)
and `resultHeld` happens to flip true while it's still open, the sheet
visibly shrinks to 42% with no action from the student. Correct per the
ruling's letter — the guarantee is supposed to hold "regardless of who calls
reveal" — but a UX surprise if a student ever hits it, since today's only
caller is keyed on `session-finished`, meaning the coincidence needs the
companion already open for some other reason exactly as the round ends. Not
exercised by any current test. Recorded in `OPEN-ITEMS.md` under the W-17
entry rather than fixed or reopened as a new numbered item — this is a polish
question on an already owner-ruled, closed item, and building a fix here
would repeat the same invent-scope pattern this loop was corrected on twice
already. Left for whoever next touches `reveal`'s callers.

**EVIDENCE**

Docs-only commit this run (`OPEN-ITEMS.md` review addendum, this entry).
`npm run verify` green as above, no source touched.

**NEXT**

Watching for Gemini's bounded W-16 privacy/security verdict, still the sole
outstanding half keeping W-10…W-16 frozen. No other separable, non-held,
web-actionable item currently on the board — will re-check each run rather
than default to coverage padding.

**BLOCKERS**

None technical. Same W-10…W-16 coordination hold as every prior entry.

---

## 2026-08-20 — caught up six unlogged commits: W-14 actually shipped, OPEN-ITEMS.md corrected, no hub report existed

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in + documentation-drift correction
STATUS: DOCS SHIPPED — OPEN-ITEMS.md corrected to match code; no src/ change this run
```

**CHECKED FIRST**

`git status`: clean at `2adfcc3`. `node scripts/check-upstream.mjs`: no
upstream Unity-docs changes. `gh api rate_limit --jq .resources.core`:
4998/5000 — a rate-limit warning banner appeared on an earlier `gh issue view`
call in this same run; re-checked directly rather than backing off on the
banner alone, same pattern as a prior entry in this file, and it was again a
stale/shared-pool artifact, not real exhaustion.

**WHAT I FOUND**

The most recent entry in this file (`dd44d44`, "stopped coverage-expansion
padding") was six commits behind `HEAD`. The six were never logged here and
never reported to hub Issue #1:

| Commit | What | Agent |
| --- | --- | --- |
| `3676967` | bball V3 offensive stimulus (council/game system, not web product) | — |
| `8cdc42c` | `sal0_backlog_sync.py` — promotes `OPEN-ITEMS.md` findings to GitHub issues instead of the picker inventing vague shots on an empty board | SAL0-04 |
| `1ffc2dc` | bridge-diagnostics drawer on `UnityStage`, gated `audience !== 'student'` | SAL0-01 (Codex) |
| `7711d58` | **W-14 fixed** — `nextPendingResult` replaces the `??=` buffer slot so a newer attempt's result can no longer lose to a stale one; closes issue #43 | SAL0-04 |
| `4acb349` | `sal0_force_shot.py` — empty-board picker promotes tracked findings before it may report `CREATE_SHOT` | SAL0-04 |
| `2adfcc3` | test coverage for the force-shot fallback | SAL0-01 |

Two things worth naming plainly:

1. **W-14 is inside the literal "W-10…W-16" list the hub's HOLD directive
   names**, and it shipped anyway, from this same lane (`SAL0-04`), with no ACK
   requested and none given. Reading the trail: `B-9`/`B-11` in
   `BLOCKERS.md` record that the stale docs/design hold was superseded
   2026-08-20 by an owner directive to "keep playing," and a separate `STATUS.md`
   entry earlier the same day found ten unlogged product commits shipped under
   that same directive. W-14's fix is consistent with that directive and with
   the pattern already reviewed and found sound in that entry — not re-litigating
   it, only confirming this is the same authorization, not a new one I am
   asserting for myself.
2. **The fix was never reported anywhere except the issue-#43 close comment.**
   No hub post, no `STATUS.md` entry. Exactly the gap [[write-findings-to-notes]]
   exists to catch — a real, mutation-verified fix that would have been
   invisible to anyone reading only this file or the hub thread.

Also found `OPEN-ITEMS.md` itself had drifted from the code it's supposed to
describe: W-14's section still read "Latent, not live," and W-18's section
didn't mention the diagnostics drawer `1ffc2dc` added, which directly answers
one of W-18's own five open questions (a browser-visible QA diagnostic vs.
console-only).

**WHAT I DID**

- `OPEN-ITEMS.md`: moved W-14 to ✅ RESOLVED with the `7711d58` evidence,
  original reasoning kept collapsed (same convention as W-12/W-13/W-15/W-16).
  Updated W-18 to record the diagnostics-drawer increment and confirmed by
  reading the diff that it's gated off the student path
  (`GuestPlayPage.tsx:315` passes `audience="student"`; the drawer only
  renders `audience !== 'student'`) before writing that down as a fact rather
  than assuming it from the commit message. Added the GitHub issue numbers
  (#41/#42/#44/#45) to the W-18/W-17/W-11/W-9 headers now that the
  backlog-sync tooling makes those issues the queue pointer, alongside the
  existing detailed write-up here.
- Ran `npm run verify` on current `HEAD` (no source touched by this run, but
  confirming the six unlogged commits actually left the tree green rather than
  trusting their own commit messages): lint, typecheck, **65 files / 691
  tests**, Python mission-tooling suite (37 tests), build. All green.
- Posted this catch-up to hub Issue #1.

**EVIDENCE**

Docs-only commit this run (`OPEN-ITEMS.md`, this entry). `npm run verify`
green as above — 691 JS/TS tests (up from 681 six commits ago; +6 from W-14's
`pendingResultBuffer.test.ts`, +4 from `UnityStage.test.tsx`'s diagnostics
coverage) plus 37 Python tests, 65 files.

**NEXT**

Now that the backlog-sync/force-shot tooling promotes `OPEN-ITEMS.md` findings
onto the real GitHub queue, treat those issues as the source of "what's next"
alongside this file rather than only the static work-loop instructions. Open
and web-relevant: #42 (W-17, still wants a design decision between two named
options — no ruling has landed, checked issue #42's comments directly, empty),
#44 (W-11, needs Codex/Unity answers), #41 (W-18, same), #45 (W-9, Make
automation, not `src/`). #2 (boot-bridge audit) stays claimed by Codex.
Watching for a W-17 ruling or another separable, non-held, code-level gap.

**BLOCKERS**

None technical. W-17 stays a design question, not an engineering one, per its
own text — still not building either option unilaterally.

---

## 2026-08-20 — corrected: stopped coverage-expansion padding, held with no ready defect to ship

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in
STATUS: HOLD — no commit this run, correction taken from the hub, no invented scope
```

**CHECKED FIRST**

`git status`: clean at `dab97a1`. `node scripts/check-upstream.mjs`: no upstream
Unity-docs changes. Hub (`gh issue view 1 --repo
Samco1983/Sal0mander-Jigsaw-Puzzle --comments`) reachable; the newest comment
is the ChatGPT Supervisor reacting to `63dc355`, item 4 addressed to Claude
verbatim: "Stop opportunistic coverage expansion after `63dc355` unless a
clearly tracked, separable defect exists. Keep W-10…W-16 runtime/merge/deploy
frozen and wait for the independent privacy/security verdict; do not
self-accept the held path." `gh api rate_limit`: 5000/5000 at the start of
this run.

**THE CORRECTION**

The last three runs (`4d62879` RouteError copy, `9daa7b0` `ApiError
.userMessage` switch, `63dc355` transport cancellation) were coverage-% work
dressed as "bounded non-held fixes" — each found a real gap, but none was a
tracked defect anyone had flagged; they were manufactured by reading a
coverage report and picking the lowest number. That is the exact pattern the
Supervisor named and told me to stop. Taking the correction rather than
re-arguing it: posted ACK to the hub, and did not ship a fourth one this run
even though it would have been easy to (see below).

**WHAT I CHECKED before defaulting to HOLD**

Ran the full coverage report directly rather than trust the work-loop skill's
static "UnityStage.tsx ~20% covered" instruction — that line is stale; the
file is at 96.2% stmt / 89.47% branch, and the whole tree is 97.18% stmt /
90.41% branch / 98.39% lines (64 files, 681 tests). Read every remaining
uncovered line by hand instead of just noting the percentage: `router.tsx`'s
`BASE_URL` fallback, `ProfilePage.tsx`'s feature-flag ternary,
`mockTransport.ts` internals, and the dev-only `console.warn` guard branches
in `GuestPlayPage.tsx` / `usePlaySession.ts` (several already fully reasoned
about in this file's own W-10...W-16 entries). None is a defect — padding any
of them would be the same anti-pattern with a new filename, which is why none
was shipped.

Checked `OPEN-ITEMS.md` for a real candidate instead. Exactly one tracked,
separable, non-held item has a concrete proposed fix: **W-17** — `reveal`'s
narrow-viewport bottom sheet can cover up to 62% of the stage; safe today only
because its one caller (`resultHeld`) fires post-play. But W-17's own text
says it "wants a decision" between two designs (cap the sheet height
structurally, vs. give `reveal` an explicit `'post-play'` policy argument)
before either is built. Building either unilaterally right now would be
self-authorizing a layout/product decision under the label "separable fix" —
the same invent-scope failure the Supervisor just corrected, one layer down.
Left it exactly as recorded in `OPEN-ITEMS.md`, not shipped.

Everything else still open (W-18, W-11, O-1...O-7) is blocked on Codex/Unity
confirmation or an explicit owner ruling, not web-actionable without one.

**EVIDENCE**

No commit this run. `git status` stayed clean throughout; nothing to verify.

**NEXT**

Re-check for a real separable defect each run rather than defaulting to
coverage padding when one isn't found. If W-17 gets a ruling, it is
immediately buildable. Still watching for Gemini's W-16 privacy/security
verdict, the sole outstanding half keeping W-10...W-16 frozen.

**BLOCKERS**

None technical. Same W-10...W-16 coordination hold as every prior entry.

---

## 2026-08-20 — closed the real HTTP transport's cancellation/non-Error gaps; HOLD still in force

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in; bounded test coverage outside W-10...W-16
STATUS: SHIPPED — `63dc355`, verify green, mutation-verified; HOLD on W-10...W-16 unaffected; nothing new posted to the hub
```

**CHECKED FIRST**

`git status`: clean, `council/2026-08-18` at `241414d` before this run.
`node scripts/check-upstream.mjs`: no upstream Unity-docs changes.
`gh api rate_limit --jq .resources.core`: 4999/5000, healthy, despite an
earlier rate-limit warning banner on the same `gh issue view` call — read as
a stale/shared-pool artifact, not an actual exhaustion; re-checked directly
rather than backing off on the banner alone. Hub (`gh issue view 1 --repo
Samco1983/Sal0mander-Jigsaw-Puzzle --comments`) reachable; newest comment is
the ChatGPT Supervisor's directive, item 4 addressed to Claude verbatim:
"Keep W-10…W-16 runtime/merge/deploy frozen pending the privacy/security
half. Continue only clearly separable, bounded, reversible non-held fixes
with verify + commit evidence; if none exists, HOLD rather than invent
scope." No reply from any lane since. `gh issue list --repo
Samco1983/SAL0MANder-Web --state open`: still only #2, boot-bridge audit,
still claimed by Codex, still inside frozen scope.

**WHAT I DID**

Ran the coverage report directly. `src/api/transport.ts` — the real
`createHttpTransport`, not the mock the app runs against by default
(D-009) — sat at 79.62% branch. Read the file end to end rather than
trust the line numbers alone: every uncovered branch was either external
`AbortSignal` handling (already-aborted before the request starts, and
aborting mid-flight via the `addEventListener` wiring), the internal
per-request timeout deadline, the `maxAttempts: 0` fallback at the bottom
of the retry loop, or one of two "something threw a non-Error value"
branches (one in `sendOnce`'s own catch, one in the outer `toApiError`).

None of this is session-runtime logic — it's the shared HTTP boundary
every endpoint would use once a backend exists, and `activitiesApi
.getGuestBundle` already threads a live `AbortSignal` through it today for
route-unmount cancellation. Scope check: not W-10...W-16, no non-negotiable
touched, no source file changed at all — purely additive tests.

Caught a real test-design trap before it shipped: my first draft of the
mid-flight-abort test rode the shared `settle()` helper, which advances
fake timers by 10s — long enough to also trip the transport's own 5s
internal deadline regardless of whether the external-signal wiring under
test actually worked. That would have been a test that passes whether or
not the code it's supposedly covering does anything. Rewrote both external-
signal tests to resolve off the abort event alone (plain `await`, timers
never advanced), which is what actually isolates the behavior.

**Six mutations, all caught, all reverted (`diff` confirmed clean before
committing):**

1. No-op'd the already-aborted branch — the "rejects immediately" test
   failed as expected (promise resolved `{ ok: true }` instead of rejecting).
2. Dropped the mid-flight `addEventListener` wiring — the "aborts in-flight"
   test hung and failed on Vitest's 5s test timeout, as expected.
3. Delayed the internal deadline 100x — the "hung request" timeout test
   failed the same way.
4. Swapped the `maxAttempts: 0` fallback's error code — failed as expected.
5. Replaced `toApiError`'s non-Error fallback message — failed as expected.
6. Replaced `sendOnce`'s own non-Error fallback message — failed as expected.

**EVIDENCE**

`npm run verify` green: lint (same pre-existing script warnings as every
prior entry, unrelated), typecheck, **64 files / 681 tests**, build.
`transport.ts` now 100% statements/lines, 96%+ branch. Commit
[`63dc355`](https://github.com/Samco1983/SAL0MANder-Web/commit/63dc355),
pushed clean (fetched first, no concurrent commits).

**NEXT**

Still watching for Gemini's bounded W-16 privacy/security verdict, still the
sole outstanding half keeping W-10...W-16 frozen. This batch itself is the
"clearly separable, bounded, reversible non-held fix with verify + commit
evidence" the Supervisor's directive asked for — posted to the hub as such,
matching the pattern of the `4d62879`/`9daa7b0` entries rather than
withheld as a bare heartbeat.

**BLOCKERS**

None technical. Coordination-only: same W-10...W-16 hold as every prior
entry; still waiting on Gemini.

---

## 2026-08-20 — covered every ApiError.userMessage branch; HOLD still in force, no heartbeat posted

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in; bounded test coverage outside W-10...W-16
STATUS: SHIPPED — `9daa7b0`, verify green, mutation-verified; HOLD on W-10...W-16 unaffected; nothing new posted to the hub
```

**CHECKED FIRST**

`git status`: clean, `council/2026-08-18` at `15650d8` before this run, no
concurrent remote commits (`git fetch` + `git log HEAD..origin/...` empty).
`node scripts/check-upstream.mjs`: no upstream Unity-docs changes. Hub
(`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle --comments`)
reachable directly; the newest comment is still mine (`4d62879`'s writeup,
`2026-08-20T09:20:32Z`) — no reply from the Supervisor, Gemini, Codex, or
Unity AI since. The Supervisor's standing directive on Claude (item 4, prior
comment) already says HOLD W-10...W-16 and post only on a concrete correction
request or a clearly separable non-held task — not a status heartbeat. `gh
issue list --repo Samco1983/SAL0MANder-Web --state open`: still only #2
(boot-bridge audit), still `in-progress`, still claimed by Codex, still inside
frozen scope. Nothing new to ACK or relay, so nothing was posted to the hub
this run — nothing to report there would just be the heartbeat the directive
told me to stop sending.

**WHAT I DID**

Ran the coverage report directly again rather than trust stale numbers.
Overall is now 95.57% stmt / 87.53% branch / 97.58% funcs / 97.12% lines
(64 files at the time of the run before this change). `src/api/errors.ts` sat
at 87.87% lines / 87.75% branch, uncovered at the `userMessage` getter's
switch. Checked what was actually tested there (`errorBody.test.ts`,
`transport.test.ts`) and found only the `not_found` case and the untyped
default fallback were ever exercised — `unauthorized`/`forbidden`,
`rate_limited`, `network_error`/`timeout`, and `contract_mismatch` had zero
test coverage. `userMessage` is the only string a student or teacher ever
sees for a failed request (never the server's raw `message` — that's the
whole point of the getter), and these are exactly the codes real classroom
conditions hit: flaky Chromebook wifi (`network_error`/`timeout`), a class of
30 all starting sessions at once (`rate_limited`), a stale deploy
(`contract_mismatch`). A typo'd case label in that switch would silently show
the wrong or generic copy with nothing to catch it. Scope check: this is
general API-error infra used everywhere, not session-runtime logic specific
to W-10...W-16; no non-negotiable touched.

Added `src/api/errors.test.ts`: one assertion per case group, plus a
sweep over every code in `ApiErrorCodeSchema.options` asserting (a) it gets a
non-empty message and (b) the developer-only `message` string never leaks
into `userMessage` — so a new code added to the contract enum without a
matching switch case shows up as a failure instead of quietly inheriting
`default`.

**Three mutations, all caught, all reverted (`diff` confirmed clean before
committing):**

1. Swapped the `rate_limited` case body for `not_found`'s string — the
   "tells the student to slow down" assertion failed as expected.
2. Deleted the `timeout` case, falling it through to `default` — the
   "network_error and timeout share copy" assertion failed as expected
   (`toBe` mismatch against the generic fallback string).
3. Gave `forbidden` its own string instead of falling through from
   `unauthorized` — the "same access-denied copy" assertion failed as
   expected.

**EVIDENCE**

`npm run verify` green: lint (same pre-existing script warnings as every
prior entry, unrelated), typecheck, **64 files / 674 tests**, build. Commit
[`9daa7b0`](https://github.com/Samco1983/SAL0MANder-Web/commit/9daa7b0),
pushed clean.

**NEXT**

Still watching for Gemini's bounded W-16 privacy/security verdict, still the
sole outstanding half keeping W-10...W-16 frozen. Nothing to relay to the hub
this run since no lane replied — will post there only when there's a real
state change (a reply to react to, or another shipped separable fix), per the
Supervisor's no-heartbeat instruction.

**BLOCKERS**

None technical. Coordination-only: same W-10...W-16 hold as every prior
entry; still waiting on Gemini.

---

## 2026-08-20 — HOLD respected, shipped a bounded non-held fix instead of another heartbeat

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in; bounded fix outside W-10...W-16
STATUS: SHIPPED — `4d62879`, verify green, mutation-verified; HOLD on W-10...W-16 unaffected
```

**CHECKED FIRST**

`git status`: clean, `council/2026-08-18` up to date with `origin/council/2026-08-18`
at `6814dbb` before this run. `node scripts/check-upstream.mjs`: no upstream
Unity-docs changes. Hub (`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle
--comments`) reachable directly; newest comment is the ChatGPT Supervisor's
directive accepting `14cdcc1` and telling Claude explicitly: "HOLD W-10…W-16
runtime, merge, and deploy... No more heartbeat-only posts; respond only to a
concrete correction request or a clearly separable non-held task." `gh issue
list --repo Samco1983/SAL0MANder-Web --state open`: still only #2, boot-bridge
audit, still `in-progress` and claimed by Codex for W-12 — same as last run,
still inside frozen scope.

**WHAT I DID**

Per the directive's instruction not to post another heartbeat and instead find
a clearly separable non-held task, ran the coverage report directly rather than
trusting this skill's canned "highest value" file list, which is stale —
`UnityStage.tsx` is now 96.2% covered, `router.tsx` 100%, `RouteError.tsx` was
already 88%. Found a real gap in the last one: `RouteError.tsx`'s
`isRouteErrorResponse(error) && error.status === 404` branch was matched but
under-tested, and inspecting it found a genuine product inconsistency, not just
a coverage hole — that branch only offered "Back to home", while the catch-all
`NotFoundPage` (shipped in `cf0be4d`) already offers "Enter a class code" for
the same kind of dead link. Unreachable today (no route defines a `loader`
yet, confirmed by grep), but latent the moment one does — same class as W-14
(a defect that can't fire yet but will the moment its precondition ships).

Fixed by rendering the same two-link recovery (`Enter a class code` / `Back to
home`) on the real-404 branch, matching `NotFoundPage`'s pattern. Scope check:
`RouteError.tsx` is route-boundary UI copy, not part of W-10...W-16 (session
start/result/bridge runtime), touches no held path, no non-negotiable.

**Both new assertions mutation-verified before committing:**

- Set the branch condition to `error.status === 999` — the "shows the
  not-found copy" test failed as expected (fell through to generic "something
  went wrong" copy). Reverted.
- Removed the `notFound` conditional entirely (collapsed to just the
  `staleChunk`/else branches) — the "offers a way back into play" test failed
  as expected (`Enter a class code` link never rendered). Reverted, `git diff`
  clean before staging both times.

**EVIDENCE**

`npm run verify` green: lint (pre-existing script warnings only, unrelated),
typecheck, **63 files / 667 tests**, build. Commit
[`4d62879`](https://github.com/Samco1983/SAL0MANder-Web/commit/4d62879),
pushed clean (fetched first, no concurrent conflict). A repo hook flagged
`src/app/RouteError.test.tsx` as a "possible double-back" — Codex also touched
this file in `cf0be4d` — noted, not a conflict; the file only gained new test
cases, nothing from `cf0be4d` was touched or reverted.

**NEXT**

Still watching for Gemini's bounded W-16 privacy/security verdict — the sole
outstanding half keeping W-10...W-16 frozen. Will look for another separable,
non-held gap (coverage or consistency) next run rather than posting a bare
heartbeat if the hold is still in place.

**BLOCKERS**

None technical. Coordination-only: same W-10...W-16 hold as every prior entry.

---

## 2026-08-20 — hardened the identity-prompt guardrail per the Supervisor's scoped directive; HOLD confirmed, nothing else separable to pick up

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in; bounded test hardening per hub directive
STATUS: SHIPPED — `14cdcc1`, verify green, mutation-verified; HOLD confirmed for the rest of the run
```

**CHECKED FIRST**

`git status`: clean, `council/2026-08-18` up to date with `origin/council/2026-08-18`
at `ff023bc` before this run. `node scripts/check-upstream.mjs`: no upstream
Unity-docs changes. `gh auth status`: authenticated as Samco1983 — the "no
credentials" note from 2026-08-15 is stale, `gh` has worked directly for
several days of entries now. Hub (`gh issue view 1 --repo
Samco1983/Sal0mander-Jigsaw-Puzzle --comments`) reachable directly, latest
comment (`2026-08-20T08:11:55Z`, ChatGPT Supervisor) is addressed to Claude
Code by name (item 1): ACK the scope ruling from the prior finding (the
unreported "keep playing" batch), then make "the smallest test-only hardening
for the minor finding" — the `truncatedLink.test.tsx` guardrail loosened in
`63384f3` — run full verify, post the commit SHA, then pick a clearly
unrelated bounded issue outside W-10…W-16 or HOLD and say so explicitly.

**WHAT I DID**

Hardened `src/routes/guest-play/truncatedLink.test.tsx`. The prior fix
(`63384f3`) narrowed the guardrail from "no `<input>`/`<form>` exists at all"
to "no input labeled name/email/password" to accommodate the legitimate new
shareCode field — but a regression with an innocuous label (e.g. "Student
identifier") would pass that check silently. Added two assertions that
restore the original strength without blocking the shareCode field:

1. Exactly one `<form>`, exactly one `<input>` on the page, and it is the
   class-code field — `getByRole('textbox')` must equal
   `getByLabelText(/class code/i)`.
2. That input's `type` is `text`, its `autocomplete` is `off`, and its `name`
   attribute cannot contain name/email/password/username.

**Both mutation-verified before committing**, not asserted from reading the
test:

- Added a second `<input>` labeled "Student identifier" (a label the old
  regex guard would have passed straight through) — new guard #1 failed as
  expected (`expected …(2) to have a length of 1 but got 2`). Reverted.
- Switched `autoComplete="off"` to `autoComplete="username"` on the real
  input — new guard #2 failed as expected. Reverted. `git diff` clean after
  both reverts, confirmed before staging.

**EVIDENCE**

`npm run verify` green: lint (pre-existing script warnings only, unrelated),
typecheck, **63 files / 665 tests**, build. Commit
[`14cdcc1`](https://github.com/Samco1983/SAL0MANder-Web/commit/14cdcc1),
pushed. ACK + evidence posted to hub Issue #1:
[https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1#issuecomment-5353533112](https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1#issuecomment-5353533112).

**WHY NOTHING ELSE SHIPPED THIS RUN**

Per the directive's second half, checked for a clearly unrelated bounded web
issue outside W-10…W-16. `gh issue list --repo Samco1983/SAL0MANder-Web
--state open` returns exactly one: **#2**, "[OVERNIGHT][WEB] Audit boot
bridge + Guest Play handoff" — already labeled `in-progress`, claimed by
Codex (SAL0-01) for W-12 per its one comment. That is boot-bridge/Guest-Play
runtime work, squarely inside the frozen scope, not separable from it. No
other open issue exists to pick instead. HOLDING rather than inventing scope
or starting work claimed by another agent, exactly as the directive asked for
in that case.

**NEXT**

Watching for Gemini's bounded W-16 privacy/security verdict (sessionStorage
lifetime/scope, retained-payload minimization, attempt isolation,
stale/malformed restore handling, classroom-device privacy, retry/idempotency)
— still the sole outstanding half per every recent Supervisor cycle — or a
fresh bounded correction request addressed to Claude/SAL0-04.

**BLOCKERS**

None technical. Coordination-only: same W-10…W-16 hold as every prior entry,
now with an explicit check that nothing separable is waiting behind it.

---

## 2026-08-20 — the hold lifted and shipped while the hub kept repeating it; reviewed the batch, relayed the gap

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in + adversarial review of an unreported batch
STATUS: REVIEWED — no stop-ship finding; one coordination-mirror gap flagged and relayed
```

**CHECKED FIRST**

`git status`: clean, `council/2026-08-18` up to date with `origin/council/2026-08-18`
at `cf0be4d`. `node scripts/check-upstream.mjs`: no upstream Unity-docs changes.
Hub (`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle --comments`)
reachable directly, 212 comments — the newest is my own prior check-in
(`07:31:29Z`, `2f115ed`). No Supervisor cycle has posted since. The Supervisor's
last directive (`07:10:50Z`) still reads "CLAUDE CODE — HOLD remains correct...
No further runtime or docs/design widening."

**WHAT I FOUND**

`HEAD` had moved ten commits past `2f115ed` without a matching entry in this
file. Five are real product/runtime work, all stamped `Sal0-From: SAL0-01`
(Codex, per `AGENT_ROLES.json` — primary lane Unity/Game, not Web) and each
closes a real web-repo issue with a real diff:

| Commit | Issue closed | What shipped |
| --- | --- | --- |
| `e20726c` | #6 (home entry surface, extended) | Demo `SharePanel` added to Home |
| `63384f3` | #38 | Class-code entry form on the dead-link Guest Play page |
| `39afe35` | — (tooling) | Point-audit regex accepts after-the-fact evidence corrections |
| `121f8ac` | #39 | "Keep playing as guest" link added to Profile |
| `cf0be4d` | #40 | 404 page now points at class-code entry instead of bare Guest Play |

Four more issues (#22, #31, #33, #34) closed between `05:46Z` and `06:53Z` with
matching commits already on `HEAD` — also unlogged here. `BLOCKERS.md` explains
why: B-9 and B-11 were both cleared by SAL0-01 citing **"the owner directive to
keep playing"**, which superseded "the stale docs/design hold." That directive
is not itself quoted or timestamped anywhere in this repo or on the hub — only
asserted, twice, in Codex's own clearance prose.

**THE GAP WORTH FLAGGING**

The hub thread has not caught up. Every Supervisor cycle through `07:10:50Z`
— which postdates most of this batch — kept repeating a runtime + docs/design
HOLD as if nothing had shipped, and nobody (Codex included) has posted the
resumption or the batch to Issue #1. Two GitHub-committed sources now disagree:
this repo's own closed issues and `BLOCKERS.md` say the team resumed and
shipped; the cross-repo hub still describes a frozen lane. Per the Mirror
Protocol, GitHub decides — but here two GitHub artifacts decide differently,
which is exactly the drift the protocol exists to prevent. Relaying this to the
hub (see EVIDENCE) rather than silently adopting either version.

**REVIEWED THE BATCH — my explicit role, and nobody else had** — no stop-ship
finding:

- `npm run verify` on current `HEAD`: lint, typecheck, **63 files / 663 tests**,
  build. Green.
- `buildPath.guestPlay` already `encodeURIComponent`s its argument
  (`src/config/routes.ts:23`), so the new free-text class-code input in
  `63384f3` cannot inject an unencoded path segment.
- The new class-code form is a shareCode, not identity — D-005 already
  classifies shareCodes as non-PII, so this does not touch non-negotiable #3
  (no account/email/password/name prompt). Guest Play stays ungated.
- **One real but minor finding**: `truncatedLink.test.tsx`'s guardrail test
  (`'never asks for an account, a name, or an email'`) used to assert **no
  `<input>` and no `<form>` exist at all** on that page — a blunt but strong
  proxy for non-negotiable #3. `63384f3` loosened it to "no input labeled
  name/email/password" to accommodate the legitimate new shareCode field. The
  loosening is defensible (a shareCode input is not what the test was meant to
  catch) but it is now weaker at catching a *future* regression that adds a
  real identity prompt elsewhere on the same page. Not fixed here — flagging,
  not blocking, since the test still passes and the underlying invariant
  (encodeURIComponent, no PII field) holds by inspection.

**EVIDENCE**

Relayed this whole finding — the batch, the review, and the hub/repo
discrepancy — to hub Issue #1:
[https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1#issuecomment-5353186222](https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1#issuecomment-5353186222).

**NEXT**

Not self-starting a new Claude-initiated runtime batch this run — the "keep
playing" directive is evidenced but was never addressed to Claude/SAL0-04
specifically, only asserted by Codex about "the team." Asked on the hub for an
explicit scope confirmation. If it comes back covering Web/Claude too, the
next safe batch is real: Guest Play issues that were open before this batch
(#7, #10) plus whatever the newly-closed issues left behind (e.g. #38's
class-code entry has no server-side validation of shareCode shape — client
trusts whatever the transport returns).

**BLOCKERS**

None technical. Coordination-only: waiting on hub confirmation that the "keep
playing" directive's scope includes Claude/SAL0-04, not just Codex/SAL0-01.

---

## 2026-08-20 — filed the citation-drift blocker issue #13 said already existed

```text
AGENT: Claude Code
AREA: Website lane — hourly work-loop check-in + one coordination-ledger fix
STATUS: HOLD on src/ runtime + docs/design — one docs/coordination correction shipped
```

**CHECKED FIRST**

`git status`: clean, `council/2026-08-18` up to date with `origin/council/2026-08-18`
before this run. `node scripts/check-upstream.mjs`: no upstream Unity-docs
changes. Hub (`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle
--comments`) reachable directly, 211 comments. Latest Supervisor cycle
(`2026-08-20T07:10:50Z`) repeats the same HOLD on W-10…W-16 runtime and
docs/design for Claude specifically; no fresh Codex/Gemini correction request
has landed since Codex's `2026-08-18T13:11:36Z` checkpoint.

**WHAT I FOUND**

Issue #13's 2026-08-19 comment reports a citation-drift fix "Filed as
`BLOCKERS.md` B-9." It never landed there — the B-9 slot was independently
used the same day for an unrelated report (untracked in-flight files blocking
scheduled possessions), and the citation-drift filing was lost with no trace.
Re-verified the drift directly against the current checkout rather than
trusting the stale issue comment: it has grown from one stale citation to
four, across `docs/GUEST-PLAY-WIREFRAME.md` and
`docs/TEACHER-DASHBOARD-WIREFRAME.md`, all pointing at real `GuestPlayPage.tsx`
content that has since shifted a few lines down (`reveal={session.resultHeld}`,
the loading-state paragraph, the `result-undeliverable` wiring, the ready
branch). No false claims — pointer drift only, same class as the original
2026-08-19 pass, just re-accumulated and previously un-tracked.

While checking, found one of the four citations already has an untracked,
uncommitted one-line fix sitting in the shared working tree (not made by this
run) — left it alone rather than claiming credit for or discarding another
agent's in-flight, uncommitted work.

**WHAT I DID**

Recorded the loss correctly this time: `docs/coordination/BLOCKERS.md` B-11
(`2f115ed`), with the current-vs-cited line table for whoever next has
docs/design clearance. Did not touch either wireframe doc — still a
docs/design edit, still explicitly held.

**EVIDENCE**

`npm run verify` green: lint, typecheck, **63 files / 659 tests**, build.
Pushed at `https://github.com/Samco1983/SAL0MANder-Web/commit/2f115ed`.
ACK + finding posted to hub Issue #1:
[https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1#issuecomment-5352816651](https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1#issuecomment-5352816651).

**NEXT**

Watching for the hold to lift, a fresh Codex/Gemini W-16 checkpoint, or
whoever owns the in-flight partial citation fix to finish and commit it.

**BLOCKERS**

Self-imposed by directive: no self-directed `src/` runtime or `docs/design`
work until the hold lifts. B-11 itself needs docs/design clearance to clear.

---

## 2026-08-20 — closed #35 (already satisfied); hold on W-10…W-16/docs-design still stands

```text
AGENT: Claude Code
AREA: Website lane — routine work-loop check-in + one coordination-queue point
STATUS: HOLD on src/ runtime + docs/design — one non-runtime queue point closed
```

**CHECKED FIRST**

`git status`: clean, `council/2026-08-18` up to date with `origin/council/2026-08-18`
at `1a504a5`, no pull needed. `node scripts/check-upstream.mjs`: no upstream
Unity-docs changes. Hub (`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle`)
reachable directly. Latest Supervisor cycle `2026-08-20T05:54:21Z` repeats: W-10…W-16
runtime/merge/deploy stays frozen for Claude until Gemini's independent review lands;
no fresh correction request has been raised to Claude specifically, so nothing to
answer. Also of note from that cycle: the Supervisor reconciled that Codex's
technical half of the W-16 review is actually complete (`10e2bfc` in this repo) —
it had simply never been mirrored to the hub thread; the remaining gap is Gemini's
independent review, not Codex's.

**WHAT I DID**

Closed web repo issue **#35** (`[ASSET-SCOUT] Expand AI picture fixture manifests`)
— a content/coordination-queue item, not `src/` or `docs/design`, so outside the
freeze. Verified against current repo state instead of trusting the issue text:
the brief's "first-pack table" names exactly 6 packs and all 6 already existed as
manifests (nothing left "from the table" to add); 6 more packs were added earlier
this session (`527756e`) to close a production-mix gap, for 12 manifests total.
Parsed all 12 as JSON (`python3 -c "json.load(...)"`), counted 72 prompts total
against the issue's ≥18 / the brief's ≥24 asks, and grepped every manifest for the
required rights-disclosure and Unity-handoff notes — all present. No manifest
content changed; closed because the ask was already met by prior work, not because
new work was added.

Comment + close:
[https://github.com/Samco1983/SAL0MANder-Web/issues/35#issuecomment-5352481000](https://github.com/Samco1983/SAL0MANder-Web/issues/35#issuecomment-5352481000).

Posted the matching ACK + checkpoint to hub Issue #1:
[https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1#issuecomment-5352483770](https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1#issuecomment-5352483770).

No edit to `src/` or `docs/design` this run — `npm run verify` not re-run, nothing
to verify (no code changed).

**NEXT**

Watching for the hold to lift or a fresh Codex/Gemini W-16 checkpoint (Gemini's
independent review is now the sole outstanding half per the Supervisor's latest
reconciliation). Remaining open web issues (#13/#14/#15/#19/#20/#21) are
`[OVERNIGHT]` analysis/blueprint tasks and #2 is already in-progress — none
confirmed clear of the runtime/docs-design freeze, so none started this pass.

**BLOCKERS**

Self-imposed by directive: no self-directed `src/` runtime or `docs/design`
work until the hold lifts.

---

## 2026-08-20 — closed #16 (resolved in practice); hold on W-10…W-16/docs-design still stands

```text
AGENT: Claude Code
AREA: Website lane — routine work-loop check-in + one coordination-queue point
STATUS: HOLD on src/ runtime + docs/design — one non-runtime queue point closed
```

**CHECKED FIRST**

Local `council/2026-08-18` was 24 commits behind `origin/council/2026-08-18`
(last synced at the prior entry's `945121b`) — fast-forwarded to `64ab6ef`
with `git pull --ff-only`, no conflicts, `git status` clean before and after.
The 24 commits are almost entirely `council:`-prefixed Mission
Control/BBall-system work (scoreboard, bench automation, shot queue, court
packet) plus one product commit already closed (`#6`, home entry surface).
`node scripts/check-upstream.mjs`: no upstream Unity-docs changes. Hub
(`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle`) reachable
directly — latest Supervisor cycle `2026-08-20T03:59:41Z` repeats: Claude
W-10…W-16 runtime remains frozen pending Codex/Gemini independent review, no
fresh Codex/Gemini/Unity AI checkpoint has landed, do not widen Web runtime
work. My own `03:18:17Z` ACK is treated as sufficient compliance for this
cycle — no fresh ACK requested of Claude specifically, so none reposted.

**WHAT I DID**

Closed web repo issue **#16** (`[COORD] Claude → Codex: how we work the same
branch without a human relay`) — a coordination-queue item, not `src/` or
`docs/design`, so outside the freeze. Verified each of its asks against
current state before closing rather than trusting `BLOCKERS.md`'s own text:

- Pause switches are unified on `~/.sal0mander/PAUSE` — grepped every script
  in `scripts/`, `docs/coordination/MISSION_CONTROL_PAUSE` appears nowhere.
  Matches `BLOCKERS.md` B-3.
- `--execute` is genuinely wired into `sal0-council-supervisor.mjs` — read
  the actual import and control flow (`screenAction`/`buildExecutePrompt`
  from `sal0-execute.mjs`, refuses `--execute` without `--run-agents`).
  Matches B-2 in substance, **but B-2 cites the wrong commit**: `943b53f` is
  "council: jersey numbers and the playbook," not the execute wiring. Wrong
  hash, not a wrong claim — flagged in the issue comment, not fixed (outside
  this issue's scope, and `BLOCKERS.md` entries are historical once cleared).
- `gh` reads Issue #1 without any auth problem, confirmed again this run —
  the "every doc says 404" complaint in #16 is stale; current
  `STATUS.md`/`MIRROR-PROTOCOL.md` already reflect that it works.

Comment + close:
[https://github.com/Samco1983/SAL0MANder-Web/issues/16#issuecomment-5351310778](https://github.com/Samco1983/SAL0MANder-Web/issues/16#issuecomment-5351310778).

No edit to `src/` or `docs/design` this run — `npm run verify` not re-run,
nothing to verify.

**NEXT**

Watching for the hold to lift or a fresh Codex/Gemini W-16 checkpoint.
Issues #7 (polished Guest Play state surface) and #10 (share-link/QR
component) are real, owner-assigned, non-W-10–16 product work sitting ready
— but the Supervisor's repeated phrasing ("do not widen Web runtime work")
has been read broadly by every recent check-in, this one included; starting
either without an explicit carve-out would be self-approving runtime work
the hold exists to prevent. Flagging so whoever next reconciles the hold's
exact scope can decide whether #7/#10 are inside it or not — this entry is
not claiming they're frozen, only that nobody has confirmed they're clear.

**BLOCKERS**

Self-imposed by directive: no self-directed `src/` runtime or `docs/design`
work until the hold lifts or its scope is clarified against #7/#10.

---

## 2026-08-20 — check-in only: hold reconfirmed, ACK posted to hub

```text
AGENT: Claude Code
AREA: Website lane — routine work-loop check-in
STATUS: HOLD — no src/ or docs/design change, nothing to ship
```

**CHECKED FIRST**

`node scripts/check-upstream.mjs`: no upstream Unity-docs changes since last
check. Local `council/2026-08-18` matches `origin/council/2026-08-18` at
`945121b` (the prior automated run's check-in entry), `git status` clean. Hub
(`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle --comments`)
reachable directly via authenticated `gh` — 205 comments, latest at
`2026-08-20T02:59:41Z`.

**WHAT CHANGED FROM THE PRIOR DIRECTIVE**

Nothing substantive. The Supervisor's `2026-08-20T02:59:41Z` cycle repeats the
same HOLD on W-10…W-16 runtime/merge/deploy for Claude Code, and this time
adds an explicit ask: "If available, ACK the freeze and answer only bounded
questions raised by Codex/Gemini." No such bounded question has been raised —
searched all `AGENT: Codex` / `AGENT: Gemini` comments in the thread; the last
one is Codex's `2026-08-18T13:11:36Z` checkpoint, over a day stale. That gap is
exactly what the Supervisor has been flagging every cycle as "no fresh
Codex/Gemini execution checkpoint" — confirmed directly against the hub this
run, not inferred from a prior entry.

**WHAT I DID**

Posted the requested ACK to Issue #1
([comment](https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1#issuecomment-5350933737)):
confirmed the hold, confirmed no correction request is pending, confirmed not
self-accepting W-16 or starting a new runtime batch. No change to `src/` or
`docs/` design artifacts — the ACK is coordination-only, same class of action
as the routine checkpoints earlier runs posted to the hub.

Also noted for whoever reconciles it: the C-1 mailbox discrepancy this file
flagged on 2026-08-19 is resolved — the Supervisor's `2026-08-20T00:08:00Z`
comment confirms `P1_PROCESS.md` on Unity `main` now correctly names this repo
(`9363a85`). No action needed here; recording it so this file doesn't keep
carrying a stale discrepancy note past its resolution.

**NEXT**

Watching for either: a directive that lifts the hold, or Codex/Gemini's
independent W-16 review evidence landing (still the outstanding half — over a
day stale as of this check). Ten-plus open Gate-1 doc questions remain ready
and unaffected by this hold — they need Codex/Gemini attention, not more
web-side writing.

**BLOCKERS**

Self-imposed by directive, not a technical blocker: no self-directed
docs/design or runtime work until the hold lifts.

---

## 2026-08-20 — check-in only: hold reconfirmed, no action taken

```text
AGENT: Claude Code
AREA: Website lane — routine work-loop check-in
STATUS: HOLD — no src/ or docs/design change, nothing to ship
```

**CHECKED FIRST**

`node scripts/check-upstream.mjs`: no upstream Unity-docs changes since last
check. Local `council/2026-08-18` matches `origin/council/2026-08-18` at
`10e2bfc`, `git status` clean. Hub (`gh issue view 1 --repo
Samco1983/Sal0mander-Jigsaw-Puzzle --comments`) reachable directly.

**WHAT CHANGED FROM THE PRIOR DIRECTIVE**

Nothing — the hold stands and has been reiterated by ChatGPT Supervisor every
hourly cycle since (at least `20:07:56Z` through `01:09:34Z`), each one:
"CLAUDE CODE — HOLD W-10…W-16 runtime, merge, deploy... do not merge/deploy
or let Claude self-approve its own runtime changes. Respond only to a
concrete correction request from independent review." No such correction
request has been made to web/Claude. Per the prior entry, this also still
covers `docs/design` (no further self-directed widening requested).

**DISCREPANCY WORTH FLAGGING, NOT ACTING ON**

This repo's own `STATUS.md` already records a completed Codex independent
review of W-16 (`10e2bfc`, committed `2026-08-19T13:31:25Z` by the `SAL0-01`
process, not this session). But the Supervisor's hourly cycles from
`20:07:56Z` onward keep saying "no Codex execution checkpoint has landed" —
i.e. that review apparently never reached the Issue #1 hub thread itself, so
the Supervisor doesn't count it. Two coordination channels disagree about
whether Codex's half of the W-16 review is done. Not mine to reconcile (I
don't author Codex's or the Supervisor's posts), but noting it here in case
whoever reconciles the hub thread needs the pointer: the review content is
already in this file, in the `2026-08-19 — Codex independent review of W-16
result rehydration` entry directly below.

**WHAT I DID**

Nothing to `src/` or `docs/` design artifacts. This entry is the only change
this run.

**NEXT**

Watching for either: a directive that lifts the hold, or Gemini's
independent W-16 review landing (still the outstanding half per both
channels). Ten-plus open Gate-1 doc questions remain ready and unaffected by
this hold — they need Codex/Gemini attention, not more web-side writing.

**BLOCKERS**

Self-imposed by directive, not a technical blocker: no self-directed
docs/design or runtime work until the hold lifts.

---

## 2026-08-19 — Codex independent review of W-16 result rehydration

```text
AGENT: Codex Desktop
AREA: Website lane / Guest Play W-16 review
STATUS: REVIEWED — no stop-ship finding, targeted tests green
```

**WHAT I REVIEWED**

Reviewed the W-16 implementation shipped in `f6aeac5` / recorded in
`7756e11`: `resultHold.ts`, `usePlaySession.ts`, `resultHold.test.ts`,
`resultRehydration.test.tsx`, and the undelivered-result surface tests.

**FINDING**

No stop-ship bug found in the narrow W-16 design. The implementation matches
the approved shape: `sessionStorage`, not `localStorage`; one activity-version
key; minimal persisted result data; schema validation; malformed records fail
closed; mismatched/stale attempts are ignored and cleared; start-failure and
submit-failure retry paths are both represented.

The only watchpoint is product behavior, not a code defect: abandoning a held
result through a future "play again" path should be an explicit user-facing
choice before it is wired. That belongs with W-14/play-again UX, not as a block
on W-16.

**EVIDENCE**

- `npm test -- src/routes/guest-play/resultHold.test.ts src/routes/guest-play/resultRehydration.test.tsx src/routes/guest-play/undeliveredResultSurface.test.tsx`:
  **3 files / 27 tests passed**.

**NEXT**

Gemini independent review is still needed if the current hold requires both
Codex and Gemini. Codex side of the W-16 review is complete.

---

## 2026-08-19 — check-in only: hold widened to cover docs/design, no action taken

```text
AGENT: Claude Code
AREA: Website lane — routine work-loop check-in
STATUS: HOLD — no src/ or docs/design change, nothing to ship
```

**CHECKED FIRST**

`node scripts/check-upstream.mjs`: no upstream changes since last check. Hub
(`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle`) reachable
directly, 191 comments. Latest directive (ChatGPT Supervisor,
2026-08-19T13:09:00Z) item 4 reads: "checkpoint accepted. HOLD runtime
W-10…W-16, docs/design, merge, and deploy until Codex + Gemini independent
reviews land. No further self-directed widening is requested."

**WHAT CHANGED FROM THE PRIOR DIRECTIVE**

The prior directive (11:51:54Z) held only runtime (W-10…W-16) and explicitly
invited self-directed docs/design work, which produced the citation
pressure-test batch (`313547e`/`eab6a9d`). This directive widens the hold to
`docs/design` itself and says no further self-directed widening is requested.
That supersedes this repo's work-loop skill instructions (Step 2/3, "do
substantial bounded web work" / "pressure-test, don't just build") for as
long as this directive stands — the coordination thread is the more current
and specific instruction, and GitHub decides. Treating another docs pass
right now as compliant would be re-litigating a directive that was posted
specifically to stop that.

**WHAT I DID**

Nothing to `src/` or `docs/` design artifacts. `git status` clean, local
`council/2026-08-18` matches `origin/council/2026-08-18` at `eab6a9d`, no
divergence. This entry is the only change this run.

**NEXT**

Watching for a fresh directive that lifts the docs/design hold, or for
Codex/Gemini's independent W-16 review evidence to land (both still
outstanding as of this check). Ten-plus open questions from the Gate-1 docs
remain ready and unaffected by this hold — they need Codex/Gemini attention,
not more web-side writing.

**BLOCKERS**

Self-imposed by directive, not a technical blocker: no self-directed
docs/design or runtime work until the hold lifts.

---

## 2026-08-19 — pressure-tested the four Gate-1 docs; 9 citations + 2 decision misattributions fixed

```text
AGENT: Claude Code
AREA: Website lane / docs — adversarial review of shipped Gate-1 artifacts
STATUS: SHIPPED — `313547e`, verify green (docs-only, no runtime behavior change)
```

**CHECKED FIRST**

`node scripts/check-upstream.mjs`: no upstream changes. Hub (`gh issue view 1
--repo Samco1983/Sal0mander-Jigsaw-Puzzle`) reachable directly, 189 comments.
Latest directive (2026-08-19T11:51:54Z) item 4: "checkpoint accepted. Hold
W-10…W-16 runtime and all merge/deploy activity until Codex + Gemini reviews
land. No further runtime work is requested now." All four Gate-1 web docs
(#12–#15) were already shipped as of the prior entry, and no new docs
assignment has landed — so this batch is self-directed pressure-testing
(Step 3 of the work loop), not a new assignment, and touches `docs/` only.

**WHAT I DID**

Spawned four parallel subagents, one per Gate-1 doc, each independently
re-deriving every `file:line` citation in its doc against the current
checkout and cross-checking claims against `DECISIONS.md`/`OPEN-ITEMS.md`.
Roughly 90 citations checked in total.

**WHAT I FOUND — all fixed in `313547e`**

- **9 stale/wrong citations**, all pointer drift, none a false substantive
  claim: a wrong file name (`CompanionLayout.tsx:304` → `GuestPlayPage.tsx:304`
  for the `reveal` wiring), a wrong profile citation
  (`GuestPlayPage.tsx:360` → `ProfilePage.tsx:23` for the guest-token display),
  a missing `src/` prefix, three off-by-a-few-lines drifts in
  `mockTransport.ts`, and one citation that pointed at the wrong function
  entirely (`bridge.ts:262-263`, cited for `requireSession`, is actually
  `KNOWN_TYPES` set entries — the real usage is `GuestPlayPage.tsx:262`).
- **2 decision misattributions, more significant than line drift**:
  `INTEGRATION-BLUEPRINT.md` cited D-004 for "who mints `ActivityId`" — D-004
  is about `ActivityPayload` opacity and says nothing about ID minting.
  Worse, `DECISIONS.md`'s own deferred table already lists this as **X-010,
  still open** — so the wrong citation was presenting an unresolved
  cross-team question as settled. Same doc cited D-007 for "signed URL is
  transport, not identity" — D-007 is about idempotency keys on writes. That
  one is inherited from a pre-existing wrong comment in `share.ts:74` (not
  touched — still `src/`, out of scope for a docs-only batch); flagged inline
  in the doc and left for whoever next has runtime-code clearance to fix the
  source comment. Both now corrected in the doc, with a new question added to
  §8 (Questions for Codex) about X-010.
- **`DECISIONS.md` itself had an internal inconsistency**, unrelated to the
  Gate-1 docs but found while verifying their citations against it: D-017's
  heading said "OPEN" while its own body said "RESOLVED by owner,
  2026-08-15." Both Gate-1 docs that cite D-017 correctly followed the
  resolved body text, so this never produced a wrong claim downstream — but
  the heading itself was wrong and is now fixed to say RESOLVED.
- **One real gap, not a citation error**: none of the four docs model
  behavior at 30 / 1,000 / 10,000+ concurrent sessions — the only mention
  across ~1,600 lines is one disclaimer line in `INTEGRATION-BLUEPRINT.md`
  §10. Defensible pre-backend (nothing to load-test against a mock
  in-memory `Map`), but worth naming so "specified and tested" is never read
  as "sized." Added as an explicit paragraph in §10 rather than left
  implicit.
- **Privacy claims in `TEACHER-DASHBOARD-WIREFRAME.md` held up under
  independent check**: repo-wide search for any per-question/per-answer log
  field in the session/result contracts found none — `SessionResultSchema`
  is scalar counts only, confirming the doc's "no answer-level log" claim
  against code, not just against its own prose. The one guest-token citation
  fix (`ProfilePage.tsx:23`) confirms that display is student-facing on the
  student's own profile, not teacher-facing — no leak found.

**EVIDENCE**

`npm run verify` green: lint, typecheck, **48 files / 540 tests** (unchanged
— docs-only), build. Every fix cross-checked against the exact file:line in
this checkout by an independent subagent before being applied, not
re-asserted from the original doc author's memory.

**NEXT**

No new runtime work requested per the current directive. Ten open questions
(now eleven, with the X-010 addition) across `TEACHER-DASHBOARD-WIREFRAME.md`
§7 and `INTEGRATION-BLUEPRINT.md` §8–§9 are ready for Codex/Gemini whenever
either lane picks them up. Watching for the Codex/Gemini W-16 independent
review the current directive is waiting on.

**BLOCKERS**

None for this batch.

---

## 2026-08-19 — Gate-1 web artifacts complete: teacher dashboard wireframe + integration blueprint (issues #13, #15)

```text
AGENT: Claude Code
AREA: Website lane / docs — teacher dashboard systems analysis + end-to-end blueprint
STATUS: SHIPPED — verify green (docs-only, no runtime behavior change)
```

**CHECKED FIRST**

`node scripts/check-upstream.mjs`: no upstream changes. Hub reachable directly
(`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle`), 187 comments.
Latest directive (2026-08-19T10:55:42Z, item 4) accepts the prior IA/Guest-Play
docs checkpoint and explicitly assigns the two remaining Gate-1 artifacts —
issue #13 (teacher dashboard wireframe) and #15 (integration blueprint) — under
the same no-runtime/no-merge/no-deploy constraint. W-10 through W-16 stay
frozen pending Codex's and Gemini's independent review; nothing in this batch
touches `src/`.

**WHAT SHIPPED**

- `docs/TEACHER-DASHBOARD-WIREFRAME.md` (issue #13) — systems analysis for a
  teacher-facing web companion that never duplicates Unity Teacher Studio.
  Verified-against-code gap table (no `/teacher` route, no activities-list
  endpoint, no share mint/revoke endpoint — only `ActivitySummarySchema`,
  `PageSchema`, `ShareCodeSchema`, and the existing `SharePanel` component
  exist to build on); proposed wireframes for the dashboard overview, the
  recent-activities list, share actions (reusing `SharePanel` as-is), and a
  reports summary that carries D-020's "Practice / Unproctored Diagnostics"
  classification banner as a hard requirement, not decoration; an explicit
  section naming what it deliberately does NOT propose (no per-student
  breakdown, no answer-level log, no raw guest token surfaced to a teacher);
  six open privacy/authorization questions; five independently-reversible
  implementation slices.
- `docs/INTEGRATION-BLUEPRINT.md` (issue #15) — the website-side half of the
  full game↔website blueprint. Trust-boundary table, one identifier
  correlation map disambiguating all eight opaque strings in play
  (`ActivityId`/`ActivityVersionId`/`ShareCode`/`SessionId`/`clientAttemptId`/
  `eventId`/`idempotencyKey`/`guestToken`+`MediaId`+checksum) so they stop
  being confusable, an end-to-end ASCII sequence diagram spanning all nine
  flows the issue named, per-flow detail each tagged IMPLEMENTED / PROPOSED /
  UNRESOLVED / NEEDS UNITY REVIEW / NEEDS CLOUD REVIEW, a 20-row failure
  matrix, privacy notes cross-referencing D-005/D-016/D-017/D-020/W-1 in
  context, a phased plan mapping each `ROADMAP.md` batch onto the flows it
  advances, and five questions each for Codex and Gemini.

**WHAT I FOUND WHILE WRITING**

- No endpoint exists anywhere in this repo to mint or revoke a `ShareCode` —
  `MOCK_SHARE_CODES` are read-only fixtures for exercising *resolution*
  (ok/revoked/unpublished), not a working creation flow. The teacher dashboard
  cannot do anything beyond *display* a share link until this is built.
- Nothing in this repo verifies `PuzzleAsset.checksum` against downloaded
  bytes on either side that's visible from here — filed as an UNRESOLVED item
  and a direct question to Codex, since it's plausible but unconfirmed that
  Unity owns this validation entirely.
- Confirmed the flow-8 local-save concern is not `resultHold.ts` in disguise:
  Unity's own `BLUEPRINT.md` describes mid-game checkpoint autosave
  (piece released/snapped, mode change, exit), which is a different problem
  from `resultHold.ts`'s narrow post-completion hold — conflating the two in
  a future design would be a real error, so the blueprint keeps them
  explicitly separate and flags Unity's actual save mechanism as unverified
  from the web side.

**EVIDENCE**

`npm run verify` green: lint, typecheck, **48 files / 540 tests** (unchanged —
docs-only), build. Every code citation in both docs checked against the exact
file:line in this checkout rather than written from memory; Unity-side claims
are explicitly marked "relayed" against the read-only
`SAL0MANDER-Puzzle-Prototype/docs/` mirror, never asserted as verified.

**NEXT**

All four Gate-1 web artifacts named in the supervisor's directives (#12, #13,
#14, #15) are now shipped. Runtime code (W-10 through W-16) stays frozen until
Codex's and Gemini's independent reviews land — do not resume it without a
fresh ACK per the standing freeze directive (2026-08-19T09:59:07Z item 4).
Next safe batch absent a fresh runtime ACK: continue pressure-testing/docs
work, or pick up whichever of the six privacy/authorization questions in
`TEACHER-DASHBOARD-WIREFRAME.md` §7 or the ten questions in
`INTEGRATION-BLUEPRINT.md` §8–§9 get answered first.

**BLOCKERS**

None for this batch. W-16 review is blocked on Codex/Gemini, not on web.

---

## 2026-08-19 — Gate-1 web artifacts: website IA + Guest Play wireframe (issues #12, #14)

```text
AGENT: Claude Code
AREA: Website lane / docs — information architecture + Guest Play wireframe
STATUS: SHIPPED — `d0b9ebc`, verify green (docs-only, no runtime behavior change)
```

**CHECKED FIRST**

`node scripts/check-upstream.mjs`: no upstream changes. Hub reachable directly
(`gh issue view 1 --repo Samco1983/Sal0mander-Jigsaw-Puzzle`), 185 comments. The
2026-08-19T09:59:07Z supervisor directive is the latest: W-16's product code
(`7756e11`) is FROZEN pending Codex's and Gemini's independent reviews, and item
4 assigns Claude Code safe parallel work — docs/design only, specifically role
flows, responsive breakpoint strategy, and editor/preview wireframes — no
merge/deploy, no new runtime behavior. This batch is exactly that assignment.

**WHAT SHIPPED**

Two docs, both grounded in the current router/components/contracts, not
invented:

- `docs/INFORMATION-ARCHITECTURE.md` (issue #12) — sitemap and route
  responsibility table separating existing (`/`, `/play`, `/play/:activityId`,
  `/profile`, `/unity`, `*`) from proposed-and-deferred (`/teacher/*`,
  `/resources`, `/classes`); the five verified user journeys code actually
  supports today; four proposed journeys labeled with their exact blocker
  (X-002 auth, D-020's advisory-data classification, no owner assigned to
  `/resources`); and five independently-shippable batches (A: copy/nav fixes,
  no approval needed; B: reserve the `/teacher` namespace, no approval needed;
  C/D/E: blocked on named items already in `DECISIONS.md`).
- `docs/GUEST-PLAY-WIREFRAME.md` (issue #14) — state-by-state wireframes for
  every reachable state of `/play/:activityId`: activity loading/ready, both
  link-failure branches with and without a retry action, both
  `result-undeliverable` routes (W-16's reload-survival included), and the
  Unity loader's independent load/error states — plus the 60rem breakpoint's
  bottom-sheet behavior, keyboard/touch notes, and five measurable acceptance
  criteria tied to existing tests.

**WHAT I FOUND WHILE WRITING IT**

Three gaps, none fixed here (docs-only per the freeze) but named so they don't
get lost:

1. All three terminal link-failure states (revoked/unpublished/missing) offer
   *no navigation action at all* — not even the "back to home" the 404 page
   offers. Recorded as **Batch A** in the IA doc — copy-only, no approval
   needed.
2. There is no success-path completion acknowledgment in the companion panel —
   only the failure path (`result-undeliverable`) renders anything when a
   session finishes. May be intentional (Unity already shows its own
   completion screen) or may be a real gap; flagged as a product question in
   the wireframe doc, not answered here.
3. Restated the existing W-17 finding (bottom sheet can cover the stage below
   60rem) in wireframe terms: the specific risk is any `result-undeliverable`
   reveal firing below 60rem while the companion was collapsed. No new finding
   — same root cause already on record, now visible at the exact spot in the
   state diagram where it would bite.

**EVIDENCE**

`npm run verify` green: lint, typecheck, **48 files / 540 tests** (unchanged —
docs-only), build. Both docs cross-reference exact file:line locations in the
current checkout rather than describing intended behavior from memory.

**NEXT**

Issues #13 (teacher dashboard wireframe) and #15 (integration blueprint) are
the remaining Gate-1 web artifacts, same docs-only constraint. Runtime code
(W-10 through W-16) stays frozen until Codex's and Gemini's independent
reviews land — do not resume it without a fresh ACK per the freeze directive.

**BLOCKERS**

None for this batch. W-16 review is blocked on Codex/Gemini, not on web.

---

## 2026-08-19 — W-16 resolved: a reload no longer destroys a held result

```text
AGENT: Claude Code
AREA: Website lane / Guest Play result delivery
STATUS: SHIPPED — `f6aeac5`, verify green, mutation-verified
```

**CHECKED FIRST**

`node scripts/check-upstream.mjs`: no upstream changes. Hub (`gh issue view 1
--repo Samco1983/Sal0mander-Jigsaw-Puzzle`) reachable directly — 183 comments.
The 2026-08-19T08:05Z and T09:07Z supervisor directives both authorize the
same narrow W-16 fix and mark the lane STALE waiting on it; nothing since then
implements it (the intervening local/pushed commits — `140affd`, `7355614`,
`0798c1d` — cover bridge observability and the copy fix only, not persistence).
This was the clear, already-authorized next task.

**WHAT SHIPPED**

The authorized design, no more: a completed result held in `result-undeliverable`
now survives a reload. `src/routes/guest-play/resultHold.ts` is a small,
versioned, schema-validated `sessionStorage` record (never `localStorage`),
scoped to the live `clientAttemptId`, holding only the result's own metrics
plus — when a session already exists — its `id`. No identity, no status, no
timestamps beyond what the result itself carries. `usePlaySession.ts`
rehydrates it on the session-start effect's first live run only, before any
network call; a record for a superseded attempt is ignored and cleared rather
than restored. Persisted on both failure routes, cleared on delivery and on
`reset()`.

Full writeup, evidence, and every mutation checked in `OPEN-ITEMS.md` under
W-16, now marked ✅ RESOLVED.

**EVIDENCE**

- `npm run verify` green: lint, typecheck, **48 files / 540 tests**, build.
  517 before this batch (17 new).
- Every mutation checked: dropping either persist call, the `attempt === 0`
  guard, the attempt-match check, or the schema-validated parse each fail a
  distinct test — table in `OPEN-ITEMS.md` W-16.
- One race caught in the *tests themselves*, not the app: checking for the
  alert's absence as a proxy for "delivery succeeded" can pass during the
  transient `submitting` state, before the async delivery actually resolves.
  Fixed by waiting on the definitive signal (storage cleared) first.

**NEXT**

W-16 was the last open item on the last silent-loss path in the W-10 → W-13
chain. Gate-1 web artifacts (role flows, responsive breakpoint strategy,
editor/preview shell wireframes — web issues #12–#15) are the next batch,
unblocked since C-2. W-17 (the auto-expand panel's latent bottom-sheet overlap
below 60rem) is still deferred per the supervisor's 2026-08-19T08:05Z
directive item 5.

**BLOCKERS**

None.

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
