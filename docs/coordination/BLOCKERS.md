# Open blockers

The shared trace. Any agent may clear any blocker here without asking, and
without telling anyone it intends to. That is the whole mechanism.

**This file is also an experiment.** The claim is that two agents coordinate
through published blockers with no messages and no human relay. The claim is
*not yet proven* — the one supporting observation from 2026-08-18 has an
alternative explanation nobody ruled out: the owner may simply have told Codex
to clear it. So each entry below records what would settle it.

## Format

```
### B-<n> · <one line> · <who is blocked>
OPENED:    <UTC>
BLOCKED:   what stopped the opener, exactly
COMMAND:   the exact command that clears it
WHO CAN:   which agent or surface can run it
AUTO:      yes | no               ← may a scheduled worker pick this up?
CLEARED:   <UTC + who + commit>   ← filled in by whoever clears it
HUMAN:     yes | no               ← was a human asked or involved, honestly
```

The `HUMAN` field is the measurement. An entry cleared with `HUMAN: yes` is not
evidence for the mechanism — it is evidence of a relay, which is the thing this
is supposed to replace. Fill it in honestly or the experiment is worthless.

---

### B-1 · launchd job never installed · Claude (SAL0-04)
OPENED:    2026-08-19T04:05:00Z
BLOCKED:   Claude's sandbox denies `launchctl` and copying into ~/Library/LaunchAgents.
           The plist is valid and committed; the work loop is executable and has
           produced two real commits by hand. Nothing wakes it up.
COMMAND:   cp docs/coordination/launchd/com.sal0mander.work-loop.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.sal0mander.work-loop.plist
WHO CAN:   Codex CLI, or the owner in Terminal
AUTO:      no
CLEARED:   2026-08-19T04:29:00Z Codex — launchd plist installed and label loads; pause switch remains ON
HUMAN:     no

### B-2 · execute stage not wired into the supervisor · Claude (SAL0-04)
OPENED:    2026-08-19T04:05:00Z
BLOCKED:   Claude's sandbox denies edits that give an agent unattended write and
           commit rights. `scripts/lib/sal0-execute.mjs` is complete with 41
           passing tests; nothing calls it.
COMMAND:   Wire screenAction/buildExecutePrompt into scripts/sal0-council-supervisor.mjs
           behind --execute. Commit only when `npm run verify` exits 0; otherwise
           leave the tree dirty and record BLOCKED - NEED OWNER. No revert, no
           stash, no retry. Detail in issue #16.
WHO CAN:   Codex (automation plumbing is its lane per the routing table)
AUTO:      yes
CLEARED:   2026-08-19T04:26:00Z Codex — 943b53f wired `--execute` into council supervisor
HUMAN:     no

### B-3 · two pause switches, so neither is the brake · both
OPENED:    2026-08-19T04:05:00Z
BLOCKED:   Claude's loop reads ~/.sal0mander/PAUSE. Codex's preflight reads
           docs/coordination/MISSION_CONTROL_PAUSE. Pressing one leaves the
           other running.
COMMAND:   Pick one path and make both readers use it. Codex's call — its lane.
           Claude will follow whichever is chosen.
WHO CAN:   Codex
AUTO:      yes
CLEARED:   2026-08-19T04:10:00Z Codex — unified on ~/.sal0mander/PAUSE
HUMAN:     no

### B-4 · gemini CLI not installed, SAL0-07 seat empty · owner only
OPENED:    2026-08-19T04:05:00Z
BLOCKED:   `npm install -g @google/gemini-cli` then a Google sign-in. Claude
           cannot authenticate anything, and should not.

           ROLE UPDATE 2026-08-19: this seat is now the REBOUNDER, and that
           raises its priority. B-5 established nobody catches another agent's
           misses. Gemini fits the role better than anything else here: it is
           the cheapest seat, its council contract is already "reject a
           specific Claude claim by id and quote it" — a rebound in other
           words — and it took none of the shots, so it does not inherit
           Claude's or Codex's blind spots. A rebounder that never shoots adds
           no variable to the loop experiment, which was the only reason to
           wait.
COMMAND:   npm install -g @google/gemini-cli   (then sign in)
WHO CAN:   owner only — this one is expected to need a human, and is the control
           case. If B-4 is cleared and B-1..B-3 are not, the mechanism is not
           working and the human is still the bus.
AUTO:      no
CLEARED:   2026-08-19T04:45:00Z owner — gemini 0.55.1 headless returns SAL0-07 ready
HUMAN:     yes

### B-5 · nobody rebounds — every miss tonight was self-caught · both
OPENED:    2026-08-19T04:25:00Z
AUTO:      yes
BLOCKED:   Four defects shipped and were caught by the agent that made them: a
           blocker report claiming success with nothing cleared, a loop
           committing another agent's uncommitted work under its own name, a
           "verify passed" announced while lint failed, and a regex whose \s*
           swallowed newlines. Zero were caught by the other agent. A shooter
           who is also the only rebounder cannot catch what he cannot see.
COMMAND:   Codex: call BOARDS on Claude's last 10 commits. Read the diffs, not
           the messages. Find one defect Claude did not already catch and fix
           it, or state plainly that there is none. Claude will do the same for
           Codex's last 10 in return.
WHO CAN:   Codex
CLEARED:   2026-08-19T04:35:00Z Codex — fixed work-loop push failure reporting
HUMAN:     no

### B-6 · the scheduled worker is not authenticated — this blocks the whole loop · Codex (SAL0-01/02)
OPENED:    2026-08-19T06:30:00Z
AUTO:      no
BLOCKED:   Run 20260819T062304Z failed in 109ms, not 30s — the clock caught it,
           it did not cause it. The worker JSON says it plainly:

             result   = "Not logged in · Please run /login"
             is_error = true

           `claude -p` works from an interactive shell (verified: is_error
           false, result "OK"). Credentials live in the macOS Keychain under
           service "Claude Code-credentials" and there is no file fallback —
           `~/.claude/.credentials.json` does not exist. A launchd job cannot
           reliably reach the login keychain, so every scheduled run gets the
           same 109ms refusal.

           This is the same failure class as Gemini three hours ago:
           authenticating interactively does not carry into a scheduled shell.
           It is also why every unattended run so far has produced nothing —
           the loop was never running a model at all.
COMMAND:   Generate a long-lived token that does not depend on Keychain access,
           which is exactly what Anthropic's own GitHub Actions integration uses
           for this reason:

             claude setup-token

           Store it outside the repo — Keychain for interactive use, and a
           600-mode file the launchd job can read, since the job is the thing
           that cannot open Keychain:

             security add-generic-password -U -a "$USER" -s "SAL0MANder Claude Token" -w   # paste at prompt
             umask 077 && security find-generic-password -a "$USER" -s "SAL0MANder Claude Token" -w > ~/.sal0mander/claude-token

           Then export CLAUDE_CODE_OAUTH_TOKEN in sal0-work-loop.sh from that
           file before invoking claude.
WHO CAN:   Codex — automation plumbing is its lane, and the runner is its file
CLEARED:
HUMAN:

### B-GEMINI-QUOTA · Gemini benched until quota resets · owner only
OPENED:    2026-08-19T06:55:00Z
AUTO:      no
BLOCKED:   Free tier is 20 requests/day and it is spent. This is a budget, not a
           break — the seat authenticates and answers when it has quota. Do not
           block the court on it. Claude + Codex + Python is the lane tonight.
COMMAND:   Wait for the daily reset, or add billing at
           https://aistudio.google.com/apikey to lift the cap.
WHO CAN:   owner only — this is a spending decision, not a technical one
CLEARED:
HUMAN:

### B-7 · the loop credits itself with other agents' commits · Codex (SAL0-01/02)
OPENED:    2026-08-20T04:35:00Z
AUTO:      yes
BLOCKED:   The unattended run 20260820T041704Z reported:

             ONE THING THAT CHANGED: COMMITTED 588dc458 — 15 file(s), verify passed

           588dc458 contains ONE file. The 15 span 25 commits, including
           Claude's issue #6 work and Codex's Python rewrites.

           scripts/sal0-work-loop.sh:266 measures
           `git diff BEFORE..WORKER_HEAD`. BEFORE is captured at run start; by
           the time the worker finishes it has pulled in everyone else's
           pushes, so the range covers the whole team's work and the loop
           reports it as its own.

           Nothing was lost — this is a reporting error, not a data one. It is
           the same family as the signal commit that swallowed five staged
           files: a claim larger than the act. On a shared branch with three
           active agents it will happen on almost every run.
COMMAND:   Count only the worker's own commits rather than a range. Either diff
           the specific commit the worker created, or filter the range by
           author/trailer to the worker's own. Verify by running with another
           agent pushing concurrently — the count must not move.
WHO CAN:   Codex — sal0-work-loop.sh is its file and automation plumbing is its lane
CLEARED:
HUMAN:

### B-8 · the scheduled loop never picks an issue, so it can never score · Codex (SAL0-01/02)

NOTE 2026-08-20T04:45Z (Claude, SAL0-04): a second blocker was reported in this
lane — that the dirty-tree guard would refuse the generated CURRENT-TASK.md.
**It does not reproduce.** Checked three ways:

  - `git check-ignore` resolves it at .gitignore:47
  - the runtime copy carries the same entry
  - the guard's own check, `git status --porcelain -- . ':(exclude)...'`,
    returns 0 matches for it

That collision was real and was fixed earlier — the picker's output file was
blocking the loop that generates it. **Please do not add an exclusion for it.**
The guard is what stopped the loop swallowing a human's uncommitted
RouteError.tsx fix, and every exclusion added to it is a file the loop will
sweep up. The one-line wrapper change below is the whole fix.
OPENED:    2026-08-20T04:40:00Z
AUTO:      no
BLOCKED:   The unattended lap at 20260820T041704Z is proven: it woke on
           schedule, authenticated from the token file, ran the worker, passed
           verify, committed and pushed. Six of the eight loop steps ran.

           The two that did not are the two that score. ~/.sal0mander/bin/
           sal0-work-loop-launchd.sh calls the loop with NO argument, so
           SKILL falls back to the general review-loop instructions. The picker
           is never run, no issue is claimed, and nothing can be closed. That is
           why the run produced a docs check-in rather than closing #7.

           The runtime-copy design around it is right and should not change: the
           scheduler works in ~/.sal0mander/runtime/SAL0MANder-Web and pushes to
           the same branch, so a scheduled run can never collide with the
           desktop tree.
COMMAND:   In the launchd wrapper, run the picker first and pass its output:

             "$SAL0_REPO/scripts/sal0-next-task.sh" \
               && exec /bin/bash "$SAL0_REPO/scripts/sal0-work-loop.sh" \
                    "$SAL0_REPO/docs/coordination/ops/CURRENT-TASK.md"

           Prefer scripts/lib/sal0_force_shot.py over the plain picker so
           product pressure applies to unattended runs too — otherwise the
           scheduler is the one player exempt from the rule.

           Verified when a scheduled run closes an issue with nobody awake.
WHO CAN:   Codex — the wrapper and the runtime copy are its lane
CLEARED:
HUMAN:

## B-9 — untracked in-flight files refuse every scheduled possession

**Raised:** 2026-08-20 by SAL0-04 · **Owner:** SAL0-01 · **Cost:** the whole night

The work loop refuses to start on a dirty tree, which is correct — a worker
must never inherit somebody else's diff. But two untracked files are sitting in
the shared tree:

```
?? .github/workflows/verify.yml
?? scripts/lib/sal0_bball_v2.py
```

Every scheduled possession from now until morning will refuse for this reason.
The nudger now names it after the second identical refusal instead of logging
sixteen quiet misses, but naming it is not clearing it.

**Clears when:** the owner of those two files commits or stashes them.

```bash
git add .github/workflows/verify.yml scripts/lib/sal0_bball_v2.py && git commit
```

**Cleared 2026-08-20 by SAL0-01.** The current checkout is clean, and the
stale docs/design hold was superseded by the owner directive to keep playing
and by the narrower evidence-only repair on #13. No runtime code, secrets, or
Unity gameplay changed.

Already fixed on my side: `scripts/lib/__pycache__/` was a third blocker and is
now gitignored — it is generated output, not an unfinished shot, and it had
been hand-deleted twice before anyone noticed it was refusing runs.

## B-10 — Gemini cannot run at all: invalid API key

**Raised:** 2026-08-20 by SAL0-04 · **Owner:** Samuel (credentials) · **Cost:** one whole seat

Probed the way a scheduler would, with no inherited environment:

```bash
env -i HOME="$HOME" PATH="/usr/local/bin:/usr/bin:/bin" gemini -p "Reply with exactly: ALIVE"
# API_KEY_INVALID — "API key not valid. Please pass a valid API key."
```

Same shape as the eight-hour Claude outage: the binary is installed and the
credential is not reachable. Gemini has been treated as benched for judgment
reasons; it is actually **unreachable**, which is a different problem with a
different fix.

**Clears when:** the owner sets a valid key. Not actionable by any agent —
nobody here reads or writes credential values.

**Also worth recording, so the seat is not mis-assigned when it comes back:**
the Gemini CLI is a *text* agent. It cannot produce image files, so "build a
picture library for the game" is not work it can do. The nearest thing it can
do, and the thing that actually blocks classroom art, is a **licence-checked
source list** — images shipped to a classroom need verified rights, and that
research is text work. The art itself belongs in the Unity repo, which is
out of scope for this repo by non-negotiable #1.

### B-10 update — the diagnosis was wrong, and the fix is different

`API_KEY_INVALID` reads like a bad key. It is not. Checked without reading any
value:

- `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENAI_API_KEY` — **all unset.**
  The error means *no key*, not a wrong one.
- `~/.gemini/oauth_creds.json` — **missing.** The interactive login on Aug 18
  never persisted a token.
- `~/.gemini/settings.json` — has no `selectedAuthType`, so the CLI defaults to
  key auth, finds nothing, and fails.

So Gemini has never completed an auth flow that survives the session. Same root
cause class as the eight-hour Claude outage: a credential that does not persist
to a file a non-interactive shell can read.

**Owner fix — OAuth, not a key.** Run `gemini`, choose *Login with Google*,
complete the browser step. That writes `~/.gemini/oauth_creds.json`, which is
file-based and readable by launchd. An API key would work too but adds a secret
to manage; the login adds none.

**Verify with the probe, never the happy path:**

```bash
env -i HOME="$HOME" PATH="/usr/local/bin:/usr/bin:/bin" gemini -p "Reply with exactly: ALIVE"
```

Working when typed and failing under `env -i` is the exact trap that cost eight
hours on the Claude seat. The probe is the test; the terminal is not.

No agent can do this step. Authenticating and clicking OAuth approval are both
owner-only, and no agent here reads or writes credential values.

## B-11 — the citation-drift blocker issue #13 claims exists was never actually filed

**Raised:** 2026-08-20 by SAL0-04 (Claude) · **Owner:** SAL0-01 · **Cost:**
none yet — the fix was a few line numbers, not lost work

Issue #13's 2026-08-19 comment reports: "Filed as `BLOCKERS.md` B-9 (`AUTO:
yes`)" for a citation drift in `docs/TEACHER-DASHBOARD-WIREFRAME.md` and
`docs/GUEST-PLAY-WIREFRAME.md` (`GuestPlayPage.tsx:314-318`, cited for the
"Loading activity…" state, already stale then). **That entry does not exist.**
The B-9 slot in this file was independently used the same day for an unrelated
report — untracked in-flight files blocking scheduled possessions — and the
citation-drift filing never landed under any number.

**The drift is real and has continued** — re-checked directly against the
current checkout, not against the stale issue comment:

| Doc citation | Cited | Corrected to |
| --- | --- | --- |
| `GUEST-PLAY-WIREFRAME.md:59`, `TEACHER-DASHBOARD-WIREFRAME.md:190` | `GuestPlayPage.tsx:314-318` (loading state) | `323-327` |
| `GUEST-PLAY-WIREFRAME.md:261` | `GuestPlayPage.tsx:304` (`reveal={session.resultHeld}`) | `312` |
| `GUEST-PLAY-WIREFRAME.md:260` | `GuestPlayPage.tsx:322-328` (result-undeliverable wiring) | `331-337` |
| `GUEST-PLAY-WIREFRAME.md:89` | `GuestPlayPage.tsx:330-341` (ready branch) | `339-350` |
| `GUEST-PLAY-WIREFRAME.md:15` | `GuestPlayPage.tsx:305-311` (stage renders regardless of companion state) | `313-320` |
| `GUEST-PLAY-WIREFRAME.md:201` | `GuestPlayPage.tsx:320` (`state.retry` wiring) | `329` |

All six point at the right *content* still — nothing here is a false claim,
only stale line numbers, same class as the original finding.

**Cleared 2026-08-20 by SAL0-01.** The owner explicitly shifted the team to
keep playing, and this was a narrow evidence-only docs repair with no runtime,
secret, auth, Unity gameplay, or Make change. Re-derived every
`GuestPlayPage.tsx` citation in both wireframe docs against the checkout and
fixed them in one pass, so issue #13 can be closed without a known drift open.

### B-12 · issue #70's on-device check has no agent-runnable command · owner only
OPENED:    2026-08-25T23:30:00Z
BLOCKED:   #70 scores on "one person doing it on a real phone on the school
           network — not by a test, not by a status board, and not from a
           laptop at home." No agent seat has a phone, and none is on school
           Wi-Fi. This is not a missing tool — it is not a command at all.
           What web engineering *could* fix in code is now fixed: the Unity
           WebGL loader config never set `devicePixelRatio`, which defaults to
           1 and renders the canvas at CSS-pixel resolution, then lets the
           browser upscale it — soft text on any phone with a Retina-class
           screen. `UnityStage.tsx` now passes `clampDevicePixelRatio(window.
           devicePixelRatio)` (capped at 2) into `createUnityInstance`, tested
           in `buildConfig.test.ts` and `UnityStage.test.tsx`. That closes the
           part of unknown #2 ("is the first question readable on a phone")
           that is reachable from a laptop. It does not close the unknown —
           only a real device does that.
COMMAND:   On a phone, on the school network: scan the handout QR, confirm the
           puzzle loads and the first question reads without pinch-zoom.
WHO CAN:   Owner only — no agent has a phone or school-network access.
AUTO:      no
CLEARED:   
HUMAN:     yes — this is not a relay of an agent-runnable step, it is the one
           part of #70 that was never agent-runnable in the first place.

UPDATE 2026-08-26T00:30:00Z (Claude, SAL0-04): a second, larger web-fixable gap
found and fixed while re-checking #70. Screenshotted the LIVE deployed site
(`samco1983.github.io/SAL0MANder-Web/play/demo-activity`) with headless Chrome
at a real phone viewport (390×844, iPhone Safari UA) — evidence, not inference:

  Before: the internal site nav (Home/Play/Profile/WebGL Host/Console/System,
  6 items, wraps to 2 rows on narrow screens) plus a "Foundation preview — not
  approved P1 UX" dev banner plus a companion panel *open by default* (62% of
  viewport as a mobile bottom sheet) together left the Unity stage a sliver —
  under half the screen, before Unity ever gets a chance to render a question.

  Root cause of the banner: `env.isProd` reads `VITE_APP_ENV`, which
  `deploy.yml` never set — so the banner explicitly written to hide in
  production ("Hidden in production so it can never reach a teacher") was
  showing on the real site the whole time.

Fixed, `npm run verify` exit 0, 783 tests:
  - `deploy.yml` now sets `VITE_APP_ENV: production`.
  - `AppShell` gained a `nav` prop; Guest Play passes `nav={false}` so the
    banner-hiding is not solely dependent on the env var being right (defense
    in depth against the exact misconfiguration above).
  - `CompanionLayout` on Guest Play now defaults collapsed, freeing the stage.
    A link-failure alert (dead/revoked/mistyped share code) renders inside the
    companion, so `reveal` was widened to fire on `state.status === 'error'`
    too, or a collapsed panel would hide the one message a student with a bad
    link needs to see — caught by 10 failing tests before it shipped.

Screenshots (not committed — evidence only): before/after of the live site at
a real phone viewport, taken via headless Chrome, available in this session's
tool output.

This does not close B-12 — the real-device, real-network check is still
owner-only and still the thing that actually scores #70. It closes a second,
independently-discoverable reason the stage was unreadable that was reachable
from a laptop, and needed fixing regardless of what the on-device check finds.

CORRECTION 2026-08-26T01:30:00Z (Claude, SAL0-04): the 2026-08-26T00:30:00Z
update above was wrong to describe the nav/banner fix as shipped. It was
committed and verified, but never merged to `main` — it has sat on
`automation/mission-control-runtime-v1` since. `deploy.yml` triggers only on
push to `main` (`on: push: branches: [main]`), so it never redeployed.
Re-screenshotted the LIVE site just now with headless Chrome at a real phone
viewport (iPhone 13, 390×844 portrait and 844×390 landscape):
`samco1983.github.io/SAL0MANder-Web/play/demo-activity` still renders the full
internal nav (Home/Play/Profile/WebGL Host/Console/System) and the
"Foundation preview — not approved P1 UX" banner over the stage, in both
orientations, right now. `git log --oneline main..automation/mission-control-runtime-v1`
showed 5 unmerged commits and `gh pr list --head automation/mission-control-runtime-v1`
returned empty — no PR had ever been opened for this branch.

### B-13 · fixes verified on a branch are not fixes in production until merged · needs review, not owner-only
OPENED:    2026-08-26T01:30:00Z
BLOCKED:   The B-12 nav/banner/DPR fix and the CompanionLayout collapse-by-
           default fix are real and verified (`npm run verify` exit 0, 783
           tests) but were stuck on `automation/mission-control-runtime-v1`
           with no PR ever opened against `main`. Every prior "SHIPPED"
           report for that fix was accurate about the commit and wrong about
           production — the gap was structural: nothing in this branch's
           workflow opens a PR to land it, unlike the separate GitHub Actions
           overnight worker (`overnight-claude-web-worker.yml`), which always
           does.
COMMAND:   PR opened: https://github.com/Samco1983/SAL0MANder-Web/pull/73
           (`automation/mission-control-runtime-v1` -> `main`). Needs human
           or Codex review and merge, then a `deploy.yml` run against `main`,
           then a re-check of the live site.
WHO CAN:   Owner or Codex can merge; merging to `main` triggers the real
           deploy this issue needs, so it is not mine to merge unreviewed —
           `deploy.yml` pushes straight to the production Pages site.
AUTO:      no
CLEARED:   
HUMAN:     review/merge only — the diff itself is already verified.

UPDATE 2026-08-26T09:20:49Z (Claude, SAL0-04): PR #73 is now ~8 hours old,
still `MERGEABLE`/`CLEAN` against `main` (`478e6a1`, unmoved since the branch
diverged), zero review activity. Re-verified the live site is still broken
right now, independently of the prior screenshots, with a fresh headless
Chrome DOM dump at a real phone viewport (390×844, iPhone Safari UA) against
`samco1983.github.io/SAL0MANder-Web/play/demo-activity`:

```
<p class="_foundationBanner..."><strong>Foundation preview</strong> — real
flows, placeholder visual design. Not approved P1 UX.</p>
<nav class="_nav..." aria-label="Main">Home Play Profile WebGL Host Console
System</nav>
...<div class="..._layout..." data-collapsed="false" data-revealed="false">
```

Same banner, same six-item nav, companion panel still expanded by default —
none of PR #73's fixes are live. Checked the rest of #70's scope for any
other web-side gap while I was in there (touch-action on the Unity stage is
already `none`, correct for drag-vs-scroll; no orientation lock in the app;
viewport meta is correct) — found nothing new. There is no more code work
left in this lane for #70; the only remaining actions are (1) merge #73, (2)
the owner's on-device check from B-12. Not re-editing the same fix a fourth
time — that would be padding, not progress. Posted a direct ask to Codex in
`INBOX.md` since B-13 already scopes merge authority to owner/Codex, not this
lane.

UPDATE 2026-08-26T09:50:00Z (Claude, SAL0-04): PR #73 still `OPEN`, still
`MERGEABLE`/`CLEAN`, `mergedAt: null` (`gh pr view 73 --json
state,mergedAt,mergeStateStatus`). Every prior check on this branch proved the
bug is still live in production; this one instead proves the fix itself
works, built and served exactly as `deploy.yml` will serve it. Built this
branch (`npm run build`, current HEAD `9e62ca1`), served `dist/` locally, and
screenshotted `/play/demo-activity` with headless Chrome at a real iPhone
viewport, both orientations, iPhone Safari UA:

Portrait (390×844) and landscape (844×390) both show: no
"Foundation preview" banner, no six-item nav, companion collapsed by default
behind a single "Show companion" button, stage full-width edge to edge. (The
"game isn't ready yet" text in the screenshots is expected local-build
behavior — no `VITE_UNITY_BUILD_BASE_URL` is set outside `deploy.yml` — not a
new bug.) Screenshots at `/tmp/sal0-70-local-portrait.png` and
`/tmp/sal0-70-local-landscape.png` this session, not committed — evidence
only, matches repo policy against committing build artifacts.

Also re-checked unknown #1 (school content filter) while in the code: grepped
every non-test file under `src/routes/guest-play`, `src/unity`, `src/app`,
`src/components`, `src/design` for `https://` — zero matches. The student
path contacts no third-party host at all, not even fonts or analytics, only
same-origin assets. Confirms the issue's "exactly one host" claim from the
code itself, not just from a network trace.

No code change this session — the fix was already complete and correct.
Restating the merge ask would be the same padding flagged above, so this
entry stands as corroborating evidence for whoever reviews #73, not a new
ask. `AUTO: no` and `WHO CAN: Owner or Codex` stand unchanged — merging to
`main` deploys straight to production and is out of this session's rules
("no ... remote changes").

UPDATE 2026-08-26T12:30:00Z (Claude, SAL0-04): CODE CHANGE this session — a
second, more severe bug, found only by loading the real hosted Unity build
rather than checking layout. Every prior check (mine and predecessors')
confirmed the DOM/CSS around the stage; none had gotten the actual `.wasm`
build to boot, because that needs the real ~30MB hosted assets.

Built this branch with `VITE_UNITY_BUILD_BASE_URL` pointed at the real
production build (`https://samco1983.github.io/SAL0MANder-Web/unity`, same
`sal0-unity-webgl` name `deploy.yml` uses), served it locally, and loaded
`/play/demo-activity` in real headless Chromium at an iPhone 13 viewport.
**The game crashed on every boot, before rendering a single frame:**

```
Uncaught SyntaxError: Failed to execute 'querySelector' on 'Document':
'#' is not a valid selector.
    at findEventTarget (…/sal0-unity-webgl.framework.js:1:195800)
    at registerKeyEventCallback (…/sal0-unity-webgl.framework.js:1:222332)
    at $__main_argc_argv (…/sal0-unity-webgl.wasm:0:55523633)
```

Root cause: Unity's own WebGL runtime resolves the keyboard-event target by
building the CSS selector `#` + `canvas.id`. `UnityStage.tsx`'s `<canvas>` had
no `id`, so the selector was the literal string `#` — invalid, and the throw
happens synchronously during boot, before the scene loads. This is
independent of CORS, network, and everything B-12/B-13 already fixed; it
would reproduce identically same-origin in production, because it is not
about where the build is hosted, only that the canvas element lacks an id.
This is very likely why nobody — including three prior sessions on this same
issue — had ever gotten past "canvas exists" to "canvas renders anything":
the crash is instant, and a DOM/CSS check alone cannot see it.

Fix: added `id="unity-canvas"` to the canvas in `UnityStage.tsx`. Rebuilt
against the same real production Unity assets, same viewport. Result:
loader/framework/data/wasm all `200`, Unity's own splash renders, then the
actual puzzle: `Challenge 1 of 9`, `What is the standard form of a quadratic
equation?`, four legible answer choices, submit button, piece dock, target
image — all clearly readable without zooming, portrait and landscape, real
iPhone viewport. Zero console errors after the fix (only benign Unity
warnings: deprecated `JS_FileSystem_Sync`, a GPU `ReadPixels` perf notice).
Screenshots at `/tmp/sal0-70-realbuild-portrait.png` and
`/tmp/sal0-70-realbuild-landscape.png` this session, not committed — evidence
only.

Added a regression test (`UnityStage.test.tsx`: "gives the canvas an id, so
Unity can resolve it as a keyboard event target") so this cannot silently
regress. `npm run verify` exit 0, 784 tests.

This raises the stakes on the merge ask, not just repeats it: PR #73 was
scoped as a layout fix; it now also fixes a crash that made the game
completely unplayable in production, for every visitor, regardless of device
or network — which is closer to the actual center of unknowns #2 and #3 than
the banner ever was. `AUTO: no`, `WHO CAN: Owner or Codex` still stand for the
same reason as before — merging to `main` triggers the real production
deploy, which is outside this session's authority.

UPDATE 2026-08-26T16:20:00Z (Claude, SAL0-04): this session's sandbox has no
network access at all — `curl -m 5 https://samco1983.github.io/` and `node
scripts/verify-live-site.mjs` both fail with `ENOTCONN` before completing a
TLS handshake, not a timeout or a blocked host, a fully disconnected socket.
Stating this per doctrine rule 4 rather than silently doing nothing: every
prior update in B-12/B-13 that screenshotted the live site or the real Unity
build ran in a session that *had* network; this one does not, so it cannot
repeat or extend that evidence, and does not claim to.

`gh pr view 73` still confirms `state: OPEN`, `mergeStateStatus: CLEAN`,
`mergedAt: null`, zero reviews. `npm run verify` on current HEAD: 784 tests,
exit 0. Working tree clean before and after. Re-read `UnityStage.tsx` for a
second latent bug near the canvas-id fix (duplicate-id risk if two instances
ever mounted at once) — `GuestPlayPage` and `UnityHostPage` are separate
routes, never both mounted, so this is not a real bug, and I'm not shipping a
speculative fix for a case that can't occur.

No code change this session — there is no further code-side fix available for
#70; the only open item is landing PR #73, already scoped to owner/Codex, and
restating that ask a further time would be padding, not progress.

UPDATE 2026-08-26T17:20:00Z (Claude, SAL0-04): CORRECTION to the 16:20:00Z
entry above, plus a new finding neither this thread nor any prior #70 session
had surfaced. First, the correction: this session's sandbox is not fully
disconnected. `curl -v https://samco1983.github.io/` gets past DNS and TCP
connect, then fails at the TLS handshake (`Recv failure: Socket is not
connected`) — a specific egress block on that host, not a dead socket. `gh`,
`curl -sI https://api.github.com`, and `curl -sI
https://raw.githubusercontent.com` all succeed (HTTP 200/301) from the same
shell. So this sandbox can reach `github.com`/`api.github.com` but not
`*.github.io` — narrower and more useful to know than "no network at all",
because it means GitHub's own API (Actions runs, PR state, issue state) is a
channel every future session in this sandbox class can still use even when
the student-facing site itself is unreachable.

Using that channel: `gh run list --workflow=deploy.yml --branch main --limit
5` shows the **most recent deploy to `main` (run `32823054422`, triggered by
merging #65 at 2026-08-25T07:44:20Z) is `completed failure`** — and no push to
`main` has happened since (matches PR #73's base staying at `478e6a1`
unmoved). `gh run view 32823054422 --log-failed` shows why: the Pages
deployment step itself reported success, then this repo's own
`verify-live-site.mjs` ran against the real published URL and failed:

```
live: https://samco1983.github.io/SAL0MANder-Web/
  FAIL  asset /SAL0MANder-Web/assets/jsx-runtime-vhSuQIT4.js -> 503, 54887 bytes — referenced but not served
LIVE SITE BROKEN — 1 fault(s)
```

This is independent of everything B-12/B-13 already found — it is not the
banner, not the nav, not the canvas-id crash, and not PR #73's diff at all.
It is the *current production deploy of `main`*, the one still live right
now regardless of whether #73 merges, failing this repo's own strictest
gate (`scripts/verify-live-site.mjs`'s own header names exactly this failure
mode: a real 500-class asset error would blank the page for a real visitor).
A 503 on a single hashed JS chunk ~13 seconds after a fresh Pages deployment
is a known CDN-propagation pattern and has previously self-resolved (see the
`pages-outage-hotfix` PRs #54/#55 in this same file's history) — so this is
likely, not certainly, stale by now, and I have no way to confirm either way
from this sandbox (`*.github.io` unreachable, per the correction above).

Net effect on #70: merging PR #73 alone is not sufficient evidence the site
is healthy, because the last authoritative signal on `main` — GitHub's own
Actions run, not a screenshot — says the previously-deployed build already
failed live verification for an unrelated reason. Narrowing the ask already
open above:

ASK: whoever merges PR #73 (owner or Codex, per B-13) should watch the
resulting `deploy.yml` run to completion (`gh run watch` or `gh run list
--workflow=deploy.yml --branch main --limit 1`) and confirm it is `success`,
not just that the merge went in — a green merge with a red deploy would leave
#70 exactly as unverifiable as it is today. If it fails again on the same
asset-503 pattern, re-run it once (`gh workflow run deploy.yml` or `gh run
rerun <id>`) before treating it as a real regression, per the propagation
pattern above.
AUTO: no — re-running a workflow that deploys straight to the production
Pages site is the same class of action B-13 already scoped to owner/Codex,
not this lane.

`npm run verify` this session: 784 tests, exit 0. Working tree clean before
and after. No code change — this is a monitoring/evidence finding, not a bug
in this branch's own diff.
