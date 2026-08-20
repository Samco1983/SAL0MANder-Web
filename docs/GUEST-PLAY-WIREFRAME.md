# Guest Play — end-to-end wireframe specification

Systems analysis for GitHub issue #14. Docs-only, no `src/` change. Every state
below is tied to a real code seam — file, line, or test — not invented. Where a
state is not yet reachable in the product (no UI path to it today), that is
said explicitly rather than wireframed as if it existed.

Companion doc: `INFORMATION-ARCHITECTURE.md` (issue #12) owns the route-level
map this sits inside; this doc owns the state-by-state detail for the one
route (`/play/:activityId`) that is fully built.

**The one rule every state below obeys, because it is a non-negotiable, not a
preference:** the Unity stage (`<UnityStage>`) renders unconditionally inside
`CompanionLayout`'s `stage` slot regardless of what the companion panel is
doing (`GuestPlayPage.tsx:305-311`). No wireframe in this document ever shows
the stage blocked, hidden, or replaced by a companion-panel state.

---

## 1. State inventory

Two independent state machines run in parallel and are rendered into two
different regions of the same screen:

- **Activity resolution** (`useGuestActivity`, companion panel) —
  `loading | error | ready`.
- **Session lifecycle** (`usePlaySession`, companion panel, additive) — adds
  `result-undeliverable` on top of whatever activity-resolution state is
  showing, once a session exists.
- **Unity loader** (`UnityStage`, stage region, fully independent of both) —
  `unconfigured | loading | ready | error`.

Because these are independent, the wireframes below are combinations, not a
single linear flow. The canonical happy path touches five of them in sequence;
every other combination is a named failure or edge case.

---

## 2. Happy path — state by state

### 2.1 Direct share link lands

```
URL: /play/K7Q4M2XP  (or /play/<activityId>)
┌─────────────────────────────────────────────────────────────────┐
│  SAL0MANder            Home  Play  Profile              [theme] │
├───────────────────────────────┬───────────────────────────────┤
│ COMPANION (42%)                │ STAGE (58%)                    │
│                                 │ [Hide companion]                │
│ Loading activity…               │                                 │
│ (role="status")                 │  Unity WebGL host                │
│                                 │  "Reserved surface... no build   │
│                                 │   configured" — until a build    │
│                                 │   exists, OR the real loader's   │
│                                 │   own `unconfigured|loading`     │
│                                 │   state once one does.           │
└─────────────────────────────────┴───────────────────────────────┘
```
Code: `GuestPlayPage.tsx:314-318` (`state.status === 'loading'`),
`UnityStage.tsx:236-251` (`!config` placeholder) or `:269-286` (`loading`,
determinate progress bar, `role="progressbar"`). These two loaders are
unrelated — the activity metadata fetch and the WebGL download race, and either
can finish first (`UnityStage.tsx:116-118`).

### 2.2 Activity ready, mode fixed (single allowed play mode)

```
┌───────────────────────────────┬───────────────────────────────┐
│ COMPANION                      │ STAGE                          │
│                                 │ [Hide companion]                │
│ # <Activity Title>               │                                 │
│ by <Teacher Display Name>        │   [Unity canvas, tabIndex=0,     │
│ <description>                    │    aria-label="SAL0MANder game"] │
│                                 │                                 │
│ ── Share ──                      │   (gameplay is entirely           │
│ [share URL............] [Copy]   │    Unity-owned from here on;      │
│ [Show QR code]                    │    web sees only coarse           │
│                                 │    lifecycle messages)            │
│ ── Optional context lives here ──│                                 │
│ (PlaceholderNotice: lesson       │                                 │
│  notes, resources, profile,      │                                 │
│  collaboration — all pending)    │                                 │
│                                 │                                 │
│ activity: K7Q4M2XP               │                                 │
│ version: v3                      │                                 │
│ guest: 9f3a21b8… (device-local)  │                                 │
└─────────────────────────────────┴───────────────────────────────┘
```
Code: `GuestPlayPage.tsx:330-341` (ready branch), `SharePanel.tsx` (copy/QR),
`usePlaySession` starts the session as soon as `bundle` exists and a mode is
known (`GuestPlayPage.tsx:166-174`, `enabled: Boolean(bundle)`). Session start
is invisible in this wireframe by design — there is no "starting…" companion
state; the student's attention stays on the stage, which is already animating
its own loader.

### 2.3 Activity ready, Student Choice (mode not yet fixed)

Identical companion panel to 2.2. The difference is entirely inside Unity: the
web does not render a mode picker — Unity owns it (`GuestPlayPage.tsx:102-109`
comment) — and the web's session does not start until a `mode-selected` bridge
message arrives (`GuestPlayPage.tsx:138-163`, `resolveSelectedMode`). **Gap for
review, not a defect**: nothing in the companion panel indicates "waiting for
you to choose a mode in the game" — a student who expects the website to react
to their choice sees no confirmation there ever will be one. This is
correct per the ownership boundary (Unity owns the picker) but is worth a
one-line companion acknowledgment once the mode lands, which does not exist
today. Flagged for a bounded follow-up, not decided here.

### 2.4 Gameplay in progress

Companion panel unchanged from 2.2/2.3 for the entire duration of play — there
is no "in progress" companion state, because nothing about play is web-visible
beyond what already rendered. The stage is fully Unity's.

### 2.5 Completion, successful submit

```
Unity emits session-finished (bridge) ──▶ submitRef.current(...) ──▶
POST /sessions/{id}/result succeeds ──▶ companion panel returns to the
                                          2.2/2.3 ready state, unchanged —
                                          no "you're done!" companion copy
                                          exists today.
```
**Gap, explicit**: there is no completion acknowledgment anywhere in the
companion panel on the success path — only the *failure* path
(`result-undeliverable`) renders anything. A student who finishes successfully
sees nothing change outside the stage itself (which is Unity's own completion
screen, unverified from the web side — see §5). Whether the web should add a
success acknowledgment is a product question this doc raises but does not
answer, since the current design's silence-on-success may be intentional
(Unity already shows completion) rather than an oversight.

---

## 3. Failure and recovery states

### 3.1 Link failure — revoked

```
┌───────────────────────────────┬───────────────────────────────┐
│ COMPANION (role="alert")        │ STAGE (unaffected, still boots)  │
│                                 │                                 │
│ This link was turned off         │   [Unity stage renders exactly   │
│                                 │    as it would on success —      │
│ Your teacher turned off this     │    the game itself has no       │
│ share link. Ask them for a new   │    concept of a broken link,     │
│ one — retyping this one will     │    because it never receives     │
│ not help.                        │    a `boot` message: `boot` is   │
│                                 │    built only from a resolved    │
│ (no retry button — retrying a    │    `bundle`, so it is simply     │
│  revoked link cannot succeed)    │    never sent (`GuestPlayPage    │
│                                 │    .tsx:188-198`).]              │
└─────────────────────────────────┴───────────────────────────────┘
```
Code: `linkState.ts:39-43` (copy), `isRecoverable` returns `false` for
`revoked` (`linkState.ts:60-62`), so `LinkFailure`'s retry button is
conditionally omitted (`GuestPlayPage.tsx:34-38`). **The stage shows its own
`unconfigured`/`loading` placeholder forever in this state** — not an error,
just an idle Unity host with nothing to boot. That is correct behavior (no
false "Unity failed" message for a problem that isn't Unity's) but worth
naming: a student on a revoked link sees an idle game window beside a clear
companion explanation, never a stage-side error.

### 3.2 Link failure — unpublished

Same layout as 3.1. Copy: *"This activity is not available right now... it may
come back, so it is worth checking with them before trying again."*
(`linkState.ts:44-48`). No retry button (`unpublished` is not `unavailable`, so
`isRecoverable` is false).

### 3.3 Link failure — missing / mistyped

Same layout. Copy: *"We couldn't find that activity... a single wrong
character is enough to break it."* (`linkState.ts:49-53`). No retry button —
retrying an identical URL cannot resolve a code that doesn't exist.

**Cross-cutting recovery behavior:** all three terminal link failures withhold
the retry button, because re-running the same dead link cannot succeed, and
offer navigation actions back to Guest Play and home. The copy still tells the
student what to do next — ask the teacher for a corrected or new link — without
putting an account gate between the student and play.

### 3.4 Link failure — transient/unavailable (recoverable)

```
┌───────────────────────────────┬───────────────────────────────┐
│ COMPANION (role="alert")        │ STAGE                          │
│                                 │                                 │
│ Activity unavailable             │   [idle placeholder, as 3.1]     │
│ <error.userMessage — server-     │                                 │
│  chosen safe string, never a     │                                 │
│  raw server error string>        │                                 │
│                                 │                                 │
│ [Try again]                      │                                 │
└─────────────────────────────────┴───────────────────────────────┘
```
Code: `linkState.ts:54-56` (default/`unavailable` branch), `isRecoverable`
returns `error.retryable` (`linkState.ts:61`) — only network/server-class
errors the transport itself flagged retryable get this treatment. `retry`
re-invokes `useGuestActivity`'s fetch (`state.retry`, wired at
`GuestPlayPage.tsx:320`).

### 3.5 Unity WebGL load failure (independent of activity state)

```
┌───────────────────────────────┬───────────────────────────────┐
│ COMPANION (whatever state       │ STAGE (role="alert")             │
│  activity resolution is in —    │                                 │
│  fully independent, e.g. 2.2)   │  SAL0MANder could not start      │
│                                 │  <describeLoadFailure(...) —     │
│                                 │   network/memory/generic         │
│                                 │   pattern-matched studentcopy>   │
│                                 │  <raw technical message, kept    │
│                                 │   for a teacher or dev to read>  │
│                                 │  [Try again]                     │
└─────────────────────────────────┴───────────────────────────────┘
```
Code: `UnityStage.tsx:19-27` (`describeLoadFailure` — network/memory/generic
buckets), `:287-300` (render), retry bumps `retryToken`, which re-runs the
whole load effect and tears down any half-initialized instance first
(`UnityStage.tsx:80-83`, `:216-233` cleanup ordering guarantee). **This can
co-occur with any activity-resolution state** — a student can be looking at a
perfectly ready companion panel (2.2) while the stage independently shows this
error, and vice versa. No wireframe above shows a "both failed at once"
combination because the two panels render fully independently; the reader
should assume any companion state in §2–§3 can appear beside any stage state
in this section.

### 3.6 Result undelivered — submit failed (session existed)

```
┌───────────────────────────────┬───────────────────────────────┐
│ COMPANION — layered ON TOP of   │ STAGE (already showing Unity's   │
│  whatever activity-ready state  │  own completion screen —         │
│  was showing (2.2/2.3), and      │  unaffected, still running)      │
│  the panel AUTO-EXPANDS if it    │                                 │
│  was collapsed (rising edge      │                                 │
│  only — see CompanionLayout      │                                 │
│  `reveal`, W-15)                 │                                 │
│                                 │                                 │
│ role="alert":                    │                                 │
│ Your finished activity isn't     │                                 │
│ saved yet                        │                                 │
│                                 │                                 │
│ You finished — nothing is lost   │                                 │
│ yet. Saving it to your teacher   │                                 │
│ did not go through, so try       │                                 │
│ again when the connection is     │                                 │
│ back. Keep this tab open until   │                                 │
│ it saves.                        │                                 │
│                                 │                                 │
│ [Try saving again]                │                                 │
│ attempt: <clientAttemptId>       │                                 │
│                                 │                                 │
│ (rest of the ready-state panel   │                                 │
│  below it, unchanged — title,    │                                 │
│  share panel, etc.)              │                                 │
└─────────────────────────────────┴───────────────────────────────┘
```
Code: `GuestPlayPage.tsx:55-80` (`UndeliveredResult`), `:322-328` (wired to
`session.status === 'result-undeliverable'`), `GuestPlayPage.tsx:304`
(`reveal={session.resultHeld}`). **Survives a reload** — `resultHold.ts`
persists the held result to `sessionStorage`, scoped to the live
`clientAttemptId`, rehydrated on the session-start effect's first live run
(W-16, `STATUS.md` 2026-08-19).

### 3.7 Result undelivered — start failed (no session ever opened)

Same companion layout as 3.6, but copy branches on `retryable === false`:
*"You finished — nothing is lost yet. Keep this tab open until it can be saved
— closing or reloading it before then will lose the result."* — no retry
button (`GuestPlayPage.tsx:68-76`). **Named in `STATUS.md`'s copy-fix entry as
currently unreachable through any UI path** — `canRetry` is false only when the
held attempt id no longer matches the live one, which needs `renewAttempt`, and
nothing calls it without a "play again" flow (W-14, not built). Included here
because the copy exists and is correct, but flagged so nobody mistakes this
wireframe for evidence the path is exercised today.

---

## 4. Responsive and input notes

### 4.1 Breakpoint — 60rem (960px at default root size)

`CompanionLayout.module.css:71` is the single breakpoint. Above it: fixed
42/58 grid columns, companion and stage side by side. At or below it: the
companion becomes a bottom sheet **over** the stage.

**This is where §3's "stage never blocked" guarantee gets structurally
harder**, not automatically true. Two things keep it true today:

1. `reveal`'s only current caller (`resultHeld`) fires post-play, by
   construction — a student is never mid-gameplay when the bottom sheet
   auto-opens, so it never covers an active game moment (`STATUS.md` W-17).
2. Nothing else calls `reveal` yet.

**This is the exact W-17 finding, restated as a wireframe consequence rather
than a code observation**: if a future feature calls `reveal` during active
play (a mid-game notice, say), the bottom-sheet-over-stage behavior below
60rem would cover up to the companion's full height of the stage — which
non-negotiable #4 and the product ruling on W-15 both forbid. This doc does
not propose the fix (two are already on record in `OPEN-ITEMS.md` W-17); it
records where in the wireframe the risk becomes visible: **any state in §3.6
occurring below 60rem on a screen where the companion was collapsed.**

```
Above 60rem:                      At/below 60rem:
┌───────────┬───────────┐         ┌───────────────────┐
│ companion │   stage   │         │      stage         │
│   42%     │    58%    │         │   (full width)      │
└───────────┴───────────┘         │  ═══════════════   │
                                   │  companion bottom   │
                                   │  sheet (collapsed    │
                                   │  by default;         │
                                   │  auto-opens over      │
                                   │  the stage on a       │
                                   │  reveal rising edge)  │
                                   └───────────────────┘
```

### 4.2 Keyboard and touch

- **Canvas is in the tab order** (`tabIndex={0}`, `UnityStage.tsx:266`),
  deliberately, because Unity WebGL takes keyboard input through the focused
  canvas — removing it would strand a keyboard-only student (Chromebook with a
  broken trackpad, switch access) on every control except the one they came
  for (`UnityStage.tsx:257-262` comment).
- **The companion toggle is a real button** with `aria-expanded` and
  `aria-controls` pointing at the companion panel's id
  (`CompanionLayout.tsx:130-140`) — a screen reader announces both its state
  and what it discloses.
- **No focus is ever stolen** by an auto-reveal (§3.6) — the notice uses
  `role="alert"`, which announces without moving keyboard focus mid-game
  (`CompanionLayout.tsx:100-102` comment). This is asserted in tests for the
  reveal mechanism; the layout-effect-vs-passive-effect timing itself is
  **not** provable in jsdom and is flagged in `STATUS.md` as needing a real
  screen-reader pass, restated here so a QA pass against this wireframe knows
  to check it by hand.
- **Below 60rem**, the collapsed companion is `aria-hidden` + `inert`
  (`CompanionLayout.tsx:122-123`) at every breakpoint, not just the bottom-sheet
  one — so a keyboard user tabbing through a collapsed panel, sheet or
  sidebar, never lands on unreachable-looking controls.

### 4.3 Desktop / tablet / mobile — what actually differs

There is **no separate mobile layout** beyond the single 60rem breakpoint —
no tablet-specific intermediate state exists in the CSS today. Practically:

| Viewport class | Layout | Notes |
| --- | --- | --- |
| Desktop (>60rem) | Side-by-side 42/58 | As wireframed in §2–§3 throughout |
| Tablet landscape (typically >60rem) | Side-by-side 42/58 | Same as desktop — `--companion-min-width: 20rem` (tokens.css) keeps the companion from crushing below a readable width on smaller side-by-side viewports |
| Tablet portrait / phone (≤60rem) | Bottom sheet over stage | §4.1 |

No wireframe distinguishes tablet from desktop beyond this table, because the
code doesn't either — a claim of finer-grained responsive behavior would be
fabricated. If Gate-1 QA needs a tablet-portrait-specific treatment, that is a
new requirement, not something this doc can retroactively document as existing.

---

## 5. Measurable acceptance criteria

Restated from what's already true in code + tests, as concrete pass/fail
checks a reviewer (human or agent) can run against this wireframe:

1. **No blank or dead-end state.** Every companion-panel state in §2–§3 renders
   either content or an explicit next action (even 3.1–3.3's "no retry" states
   render explanatory prose — the one exception is the Batch A gap noted in
   §3.3, which is a missing *navigation* action, not a blank screen).
2. **Guest Play remains the shortest path.** Zero states above request an
   account, email, password, or name — verified structurally, not just by
   inspection, by the existing "no sign-in prompt anywhere on the play path"
   test referenced in `ARCHITECTURE.md` §2.2.
3. **The stage is never blocked by a companion state.** True by construction
   (`CompanionLayout`'s `stage` slot is unconditional) and asserted by the DOM
   node identity test referenced in `ARCHITECTURE.md` §2.3 for the collapse
   case specifically; §3.5 of this doc is the reasoning for why it also holds
   across the two independent state machines generally.
4. **A result is never silently lost.** §3.6/§3.7 exist and persist across a
   reload (W-16); this is the closed state of what `STATUS.md` calls "the last
   silent-loss path in the W-10 → W-13 chain."
5. **Unknown Unity/cloud behavior is visibly marked, not guessed.** §2.5's
   completion-screen gap and §5's real-build caveat below are both named
   rather than wireframed as if verified.

**What this document cannot verify**: everything here is checked against the
mock transport and a Unity **stub** bridge. No Unity WebGL build has been
exercised against this wireframe (`STATUS.md`, "Unity receiver behavior is
still not proven by a real build"). §2.5's silent success state in particular
is exactly the kind of gap a real build might reveal is fine (Unity's own
completion screen already covers it) or might reveal is a real hole — this
doc flags it for review rather than resolving it, per issue #14's own
instruction not to invent session behavior beyond what current drafts support.
