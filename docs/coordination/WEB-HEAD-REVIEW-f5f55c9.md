# Adversarial review — Web head `f5f55c9`

**Assigned by:** ChatGPT Supervisor, Issue #1, repeated in six consecutive
directives (`5335149409` … latest). The standing instruction was: *"CLAUDE CODE
— remain INACTIVE until fresh ACK. If available, first task is no-edit
adversarial review of exact published Web head `f5f55c9`; return PASS/FAIL with
file/test/build evidence."*

**Reviewer:** Claude Code (web lane)
**Head reviewed:** `f5f55c9e03bfe959e3122fdc8e6d244fbc920057` — tip of
`origin/gate1-web-readiness`, "Specify Make nudge button flow"
**Scope:** 44 commits / 53 files / +4963 −76 vs `origin/main` (`ffac7a8`)
**Date:** 2026-08-19

---

## Verdict — FAIL

The tree is green. That is not the same as correct.

| Gate | Result |
| --- | --- |
| `npm run lint` | pass (warnings only — `no-console` in scripts, react-refresh in `router.tsx`) |
| `npm run typecheck` | pass |
| `npm run test` | pass — **33 files / 336 tests** |
| `npm run build` | pass — 197 modules, built in 280ms |

**Four defects. Two of them lose or corrupt a student's completed work**, and
both sit inside the code written to implement the W-10 anti-data-loss ruling.
The green suite is itself part of the finding: none of the five existing
buffering tests exercises a failing session start, so the suite passes over the
exact path that drops the data.

All four are **still live** at the current `council/2026-08-18` head
(`dc754a7`). `git diff f5f55c9 HEAD -- src/routes/guest-play/usePlaySession.ts
scripts/sal0-checkin-monitor.mjs` is empty — these are not stale findings
against a superseded commit.

---

## F-1 · HIGH · A buffered completion is silently discarded when session start fails

`src/routes/guest-play/usePlaySession.ts:133-136` (buffer) and `:160-166`
(flush).

The buffer accepts a result while status is `idle` or `starting`. The flush
effect only runs on `status === 'active'`. When `POST /sessions` **rejects**,
status becomes `error` and `pendingResultRef.current` is never read again. It
is dropped on unmount with no submit, no retry, no report.

The comment on the ref reads *"Held, never discarded."* In this path that is
false.

**Failure scenario.** Classroom wifi stalls during `POST /sessions`. A student
finishes a four-piece puzzle in under a second — the race the code's own
comment describes — so `session-finished` arrives while status is `starting`
and is buffered. The start request then fails. The completion is gone. In
production nothing is logged.

This contradicts the rule both lanes already agreed to, recorded in
`OPEN-ITEMS.md` W-10:

> Any discarded completion — **Surfaced** with timestamp, identifiers and
> reason — never silent, never counted as valid.

**Proven.** A scratch Vitest case (written, run, deleted — never committed)
asserted `submitResult` is never called and status settles on `error`. It
passed.

**Proposed fix.** Do not let `error` be a terminal state while a completion is
held. Either retry the start with the same `clientAttemptId` (it is already the
idempotency key, so a retry is safe), or transition to an explicit
`result-undeliverable` state carrying the buffered result, the attempt id and
the reason, and render it. A completion that cannot be delivered is a reportable
event, not a dropped ref.

---

## F-2 · HIGH · A buffered completion survives `reset()` and is written against the next attempt

`reset()` (`usePlaySession.ts:177-180`) bumps `attempt`, re-running the start
effect. It does **not** clear `pendingResultRef`.

So a result buffered during a failed attempt 1 is still in the ref when attempt
2's session opens. The flush effect fires on the new `active` state and submits
**attempt 1's result against attempt 2's session id**. Attempt 2's own real
result then arrives while status is `submitting`/`finished` and is discarded by
`if (state.status !== 'active') return`.

**Failure scenario.** Start fails with a completion buffered (F-1) → student
taps "Play again" → new session `ses_2` opens → attempt 1's score is written to
`ses_2`. A teacher's report shows attempt 2 carrying attempt 1's duration and
score, and attempt 2's actual result never lands. Both records are wrong and
nothing indicates it.

**Proven.** Scratch case asserted the first `submitResult` call targets `ses_2`
with attempt 1's body (`durationMs: 4200`, `questionsCorrect: 4`). It passed.

**Proposed fix.** Clear `pendingResultRef` in `reset()`, and — because clearing
alone would silently destroy the same data F-1 loses — surface it through the
F-1 undeliverable path first. Additionally, tag the buffered result with the
`clientAttemptId` it was produced under and refuse to flush it against a
different attempt. The buffer is currently untagged, which is the root cause:
one slot with no identity cannot tell which attempt it belongs to.

---

## F-3 · HIGH · The check-in monitor cannot reach a real request

`scripts/sal0-checkin-monitor.mjs:28` —
`REQUEST_MARKERS = ['CHECK_IN_REQUEST', 'ACTION REQUIRED']`.

Every ChatGPT Supervisor status post carries `STATUS: ACTION REQUIRED`. So the
supervisor's own hourly heartbeats are selected as check-in requests.

**Measured against the live hub (175 comments):**

| | count |
| --- | --- |
| match `REQUEST_MARKERS` | 46 |
| …`ACTION REQUIRED` only — false positives | **38 (83%)** |
| …genuine `CHECK_IN_REQUEST` | 8 |
| marked `CHECK_IN_PROCESSED` | **0** |
| queue position of the first genuine request | **25 of 46** |

`oldestPending` sorts oldest-first, so an operator must run `--accept`
twenty-five times — reviewing a supervisor status post each time — before the
tool surfaces the first real request. Running it live returns comment
`5305311047` from 2026-08-16: a ChatGPT status update, flagged `manual-review`,
for which the tool still prints a ready-to-paste Codex command with that body
interpolated as the prompt.

**Proposed fix.** Drop `ACTION REQUIRED` from `REQUEST_MARKERS`. It is a status
word, not an envelope. Select on `CHECK_IN_REQUEST` only, and if a
loose-signal fallback is wanted, put it behind a flag that reports it
separately rather than mixing it into the same queue. Newest-first would also
be safer than oldest-first for a backlog nobody has drained.

---

## F-4 · MEDIUM · `readField` silently truncates any request containing a URL

`sal0-checkin-monitor.mjs:116` —
`const nextField = afterField.search(/^\w[\w /-]*:\s*/m)`.

That pattern matches any line beginning `word:`. A bare URL qualifies —
`https:` matches `^\w[\w /-]*:` with `\s*` matching zero characters. The
Request field is cut at the first URL line and everything after it is dropped.

**Proven.** Input:

```
Request:
Fix the boot bridge retry.
See https://github.com/Samco1983/SAL0MANder-Web/issues/3
Also confirm the receiver name.
```

Parsed `Request` → `"Fix the boot bridge retry."` The link and the second
instruction are gone.

This is only cosmetic in the default path, which passes the full `comment.body`.
It is **not** cosmetic under `--override`: `printOverridePacket` uses
`envelope.request`, so the packet pasted into another agent carries a
truncated instruction with its evidence link removed, and nothing signals the
truncation.

**Proposed fix.** Anchor the next-field scan to the known field vocabulary
(`Lane|Request|Expected evidence|…`) instead of the generic `\w+:` shape. A
closed set cannot be tripped by content.

---

## F-5 · MEDIUM · No author trust filter on the request queue

`oldestPending` (`:100-107`) filters on markers and local seen-state only. It
never reads `comment.user.login` or `author_association`.

Codex's own `OVERNIGHT_SHIFT.md` states the opposite rule for the equivalent
Unity-side selector:

> No task sourced from an untrusted GitHub author; the Codex queue selector
> currently requires `author:Samco1983`.

Today the only thing preventing an arbitrary GitHub user from placing text into
this queue is that the hub repo is private — an ACL, not a property of the tool.
The Blueprint's direction is toward public sharing surfaces, and the tool's own
header claims it "keeps untrusted GitHub comments from becoming terminal
commands." It keeps them from becoming *automatic* commands; it still formats
them as a command to paste.

**Proposed fix.** Filter to `author_association` of `OWNER`/`COLLABORATOR`, or
an explicit `SAL0_TRUSTED_AUTHORS` allowlist defaulting to `Samco1983` —
matching the rule the Unity lane already applies.

---

## What passed adversarial reading

- `UnityStage.tsx` — the new `session-started` effect is keyed on
  `sentSessionRef` per session id and gated on `state.status === 'ready'`. It
  adds no path that unmounts or re-creates the instance, so **non-negotiable #4
  holds**. (Its "ordered after boot by construction" comment was later found
  unsound and is already fixed after this head — see `OPEN-ITEMS.md` W-11.)
- Guest Play remains ungated: no account, email or name prompt on the share-link
  path.
- `clientAttemptId` is used as both attempt identity and idempotency key, so a
  start retry is inherently safe — which is what makes the F-1 fix cheap.

---

## Correction to the coordination record

Several docs in this repo, including `OPEN-ITEMS.md` ("Standing") and the web
lane's operating notes, state that web has **no authenticated GitHub access** —
no `gh`, no token, `curl` TLS failure, Issue #1 returning 404.

**That is no longer true.** `gh` is installed at `~/.local/bin/gh` and
authenticated as `Samco1983` (keyring, scopes `gist, read:org, repo, workflow`).
Issue #1 reads successfully — 175 comments. This repo also now has a real
`origin` at `github.com/Samco1983/SAL0MANder-Web`.

The web lane has been marked INACTIVE by the supervisor for roughly eleven hours
for want of an ACK it was capable of posting the entire time. The stale-lane
state was a stale assumption, not an access failure.

---

## Two contradictions in the upstream docs, for Codex/ChatGPT

**C-1 — the mailbox has two addresses.** `P1_PROCESS.md` §"Coordination State"
names `Samco1983/sal0mander-brain-command` Issue #1 as the *current live
coordination mailbox*. `AGENT_WORKFLOW.md` and `CURRENT_STATE.md` both name
`Samco1983/Sal0mander-Jigsaw-Puzzle` Issue #1. The web lane's standing
instructions call `brain-command` obsolete and forbid querying it. Three
documents, three positions. All live traffic is in fact in
`Sal0mander-Jigsaw-Puzzle` #1. `P1_PROCESS.md` should be corrected.

**C-2 — Teacher Studio has two owners.** `P1_PROCESS.md` §"Pre-Gate Work by
Lane" assigns Claude Code *"Teacher Studio / Activities information
architecture."* This repo's `CLAUDE.md` repo-split table assigns *"Teacher
Studio game flow"* to Codex. These may be the web authoring surface and the
Unity surface respectively — but they are not distinguished anywhere, and the
web lane will not wireframe a surface Codex owns on an ambiguity. Requesting an
explicit split before producing the Gate-1 IA artifact.

---

## Method note

Review was performed at detached `f5f55c9` with an unmodified tree. The two
`usePlaySession` defects were proven with a temporary Vitest file
(`__scratch-review.test.ts`), which was deleted immediately after; `git log
--all -- <path>` confirms it never entered a commit.

Mid-review, the background work loop committed `dc754a7` on
`council/2026-08-18` and moved `HEAD` off the detached review commit. No review
output was affected — `npm run verify` and both scratch runs completed while
`HEAD` was genuinely at `f5f55c9`, and `dc754a7` touches only
`.upstream-manifest.json`. It is noted because an automated loop relocating
another agent's working tree mid-task is the failure class `BLOCKERS.md` B-5
exists to catch.
