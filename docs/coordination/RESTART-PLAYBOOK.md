# Restart Playbook — 2026-08-25

Paused by owner. Written so the next session starts from **verified state**,
not from a network symptom.

The pause was called on the belief that school Wi-Fi was corrupting the
readings. Half right: Cloudflare Access and Make genuinely are blocked there.
But the certificate failure — the one that made the board call a live site dead
— was the agent session's own proxy, and reproduces on any network. See §2.

---

## 1. Verified state — what is actually true

| Thing | State | Evidence |
| --- | --- | --- |
| Unattended work loop | **Alive** | 3 possessions on 2026-08-25; `b63a2aa`, `bae033c` committed and pushed by the loop itself |
| The Aug 20 jam | **Cleared** | runtime clone was 2 commits diverged from 138; reset to origin, backup on branch `wedged-20260820` |
| Championship | **9 of 12; 10 once the loop resumes** | WEBSITE 5/5, OPERATIONAL 4/5 — the only red there is "something is driving possessions", which is true while the brake is on |
| Fast Break / Championship (terminal + Desktop app) | **Working** | run repeatedly today |
| Web console buttons | **Not working** | Worker still calls Make; Codex's fix not merged/deployed |
| `samco1983.github.io/SAL0MANder-Web/` | **UP — HTTP 200, check passes** | proven: with `HTTPS_PROXY` set the cert fails; with it unset, `HTTP 200`. WEBSITE DONE is 5/5 |
| Brake | **ON**, deliberately | `owner pause: school Wi-Fi; resume on trusted network` |

**The token was never the problem.** The PAUSE file said "auth failure" for four
days. The real error, in the log underneath it the whole time, was
`fatal: Not possible to fast-forward, aborting.`

---

## 2. Restart sequence — in this order, on a trusted network

```bash
cd ~/Desktop/SAL0MANder-Web
git status -sb                       # expect: 3 commits ahead of origin
git push origin council/2026-08-18   # DO THIS FIRST - see the warning below
npm run mission:championship         # baseline: expect 9/12 (WEBSITE 5/5)
npm run mission:desktop:resume       # takes the brake off
npm run mission:desktop:status       # confirm: pause off
npm run mission:championship         # now expect 10/12 — OPERATIONAL back to 5/5
```

> **Push before resuming.** Three commits sit local-only on this Mac. The
> unattended loop runs from a *second* clone at
> `~/.sal0mander/runtime/SAL0MANder-Web`, which pulls from origin and cannot see
> them. Local-only commits on a branch two copies both track is exactly the
> shape that jammed the loop on 2026-08-20 and cost four days. Push first.

### The site was never down

```bash
curl -I https://samco1983.github.io/SAL0MANder-Web/
```

**Settled 2026-08-25.** The certificate failure was never the network and never
the site. It was the agent session's own proxy:

```text
with    HTTPS_PROXY=relay.lsaccess.me  ->  unable to get local issuer certificate
without HTTPS_PROXY                    ->  HTTP 200
```

Run from a plain terminal, WEBSITE DONE reads **5/5**. Nothing to fix here.
The lesson is narrower and more useful than "school Wi-Fi is bad": **a tool
failure observed inside an agent's sandbox is not evidence about the user's
machine.** Re-test outside the sandbox before filing it as a defect.

---

## 3. What to work on — the path to the final goal

**Final goal:** a student opens a share link and plays the puzzle. Championship
12 of 12.

Three conditions remain. They are not equally hard, and only one is real work.

### Priority 1 — GAME DONE (0/2). This is the whole remaining gap.

```text
not  a Unity build location is configured
       VITE_UNITY_BUILD_BASE_URL is unset — the stage shows 'game isn't ready'
not  the WebGL loader is fetchable
       loader not reachable (no build URL to check)
```

Both collapse into one question: **where does the Unity WebGL build live, and
what URL serves it?** Set `VITE_UNITY_BUILD_BASE_URL` and the second condition
answers itself.

This is the last thing standing between the site and a student actually playing.
Everything else on the board is plumbing that already works.

Needs Codex — the build is Unity's lane. Web's part is only consuming the URL,
and `src/unity/` is already built for it: the bridge, the stage, the diagnostics
for every failure class. It is waiting on an address.

**Start the next session here.** Not on the console, not on Make, not on
certificates.

### Priority 2 — the web console buttons

Order matters, and getting it wrong looks like a token failure:

1. Codex's `codex/mission-control-direct-github` PR merges
2. Deploy the Worker
3. `npx wrangler secret put GITHUB_TOKEN` — fine-grained PAT, scoped to
   `SAL0MANder-Web`, one permission: **Issues → Read and write**
4. `npx wrangler secret delete MAKE_WEBHOOK_URL`
5. One live Fast Break click

Setting the secret before the deploy leaves the old Make-calling Worker in place,
the button keeps failing, and it reads exactly like a bad token.

**This is convenience, not capability.** The terminal and the Desktop app do
everything the buttons do. It is not on the critical path to the final goal.

### Priority 3 — the queue drains itself

With the brake off, the loop works `#51` (companion toggle overlapping the status
heading at 375px — students see the message cut in half). Real, user-visible,
fully web's. Then `#2`.

Nothing to do here but let it run and review what it commits.

---

## 4. Network-shaped false readings

Two different causes got blamed on one thing today. Keep them apart:

- **Certificates — the agent's sandbox proxy, not any Wi-Fi.** Proven above.
  Re-test outside the sandbox before believing it.
- **`workers.dev` / Cloudflare Access / Make — genuinely blocked on the school
  network.** Real, and a real reason not to diagnose the console from school.

The habit that covers both: before calling a remote thing broken, establish
*from where* it looked broken.

---

## 5. Traps that cost real time — do not repeat

**Read the log, not the status message.** The PAUSE file said "auth failure."
The log said non-fast-forward. Four days lost to believing the label.

**Check your branch before believing a negative search.** `grep` for the live
endpoint returned nothing because the file lives on `main` and the session was on
`council/2026-08-18`. That absence read as "this does not exist."

**A piped verification is not a verification.** `npm run verify | tail` reports
`tail`'s exit code. Capture the status explicitly.

**Two operators must not kick the same loop.** The lock makes the loser exit with
an empty log, which reads exactly like a crash and produces two agents describing
different realities. One owner for loop execution.

**A green board is a claim that needs checking too.** Four separate status
surfaces lied today, in both directions. All four are fixed or made honest:

| Surface | Said | Truth |
| --- | --- | --- |
| Championship auth check | WON for 4 days | worker locked out |
| Worker `catch {}` | `504 upstream_unreachable` | discarded the real error |
| Loop `gh issue comment` | `issue comment failed` | discarded the real error |
| Championship heartbeat | dead 5554 min | 3 possessions in 2 hours |
| Championship site check | site does not answer | site returns HTTP 200 |

The pattern underneath all of them: **a boundary that knew exactly what happened
and threw the explanation away.**

---

## 6. Open, unresolved

**Why the loop's `gh issue comment` fails.** Three possessions in a row. During
run `20260825T123937Z` the *worker's own* `gh` calls succeeded — issue #46 was
closed and commented at 12:43:21Z — while the loop's comment failed seconds later
on the same machine with the same auth. Auth, PATH, and `gh`'s presence are all
ruled out. `e0eeaa5` makes it print the real GitHub error instead of a shrug, so
**the next possession will name the cause.** Read it before theorising.

Until then, a possession that cannot comment leaves its issue open and unlabeled,
the picker re-selects it, and the run returns `NOTHING CHANGED` with `exit 0` —
a green log with no progress. That happened to #41. Both #41 and #44 are now
labeled `blocked` with written reasons.

~~Whether Championship's site check passes off-proxy.~~ **Closed 2026-08-25:**
it passes. `HTTP 200` with the proxy unset. WEBSITE DONE is 5/5.

---

## 7. One-line restart

```bash
cd ~/Desktop/SAL0MANder-Web && git push origin council/2026-08-18 && npm run mission:desktop:resume && npm run mission:championship
```

Then go find the Unity build URL. That is the game.

---

## PROVEN 2026-08-25 — the game loads on a real phone

The owner opened the live site on a phone and **the Unity puzzle rendered.**

This retires the entire "Priority 1" section above. `GAME DONE 0/2` was false.
The build was committed, deployed, and live the whole time:

```text
loader       HTTP 200      26,982 bytes
framework.js HTTP 200     434,325 bytes
data         HTTP 200  24,938,655 bytes
wasm         HTTP 200  65,522,692 bytes
```

`.github/workflows/deploy.yml` already sets `VITE_UNITY_BUILD_BASE_URL: /unity`
and `VITE_UNITY_BUILD_NAME: sal0-unity-webgl` at build time. Championship reads
local `.env` files, sees nothing, and reports the game missing. **Sixth false
signal of the night, and the most expensive** — it sent two agents hunting for a
build URL that was already configured and serving 90 MB.

**The lesson, again, sharper:** the board is not the system. Before hunting for
a missing thing, fetch the thing.

### First real user findings — from a phone, not a test

**1. Orientation.** The puzzle needs landscape. Held upright, the phone gives no
indication it should be turned. A student's first experience is a game that
looks broken until they guess to rotate. Needs an explicit portrait prompt
("Turn your phone sideways to play") rather than silence.

**2. Text is too small to read.** The question and answer text does not fill the
slot it sits in. Owner's estimate: **about 1.5x larger, across the board.** On a
phone it is hard to read, which for a learning puzzle is not cosmetic — an
unreadable question is a broken question.

**3. Content that overflows should scroll.** When text does not fit its slot it
is simply cut off. It should scroll instead of clipping.

**4. It is not just the question text — it is the whole UI.** "Display correct",
"Reset", and the "quiz review" header are all undersized too. Findings 2 and 4
are one root cause, not two bugs.

### Root cause found, with the exact fix

`Assets/Scenes/SampleScene.unity` line 2726:

```text
m_UiScaleMode: 1                       # Scale With Screen Size - correct mode
m_ReferenceResolution: {x: 1920, y: 1080}
m_ScreenMatchMode: 0                   # Match Width Or Height
m_MatchWidthOrHeight: 0.5
```

The UI is authored against 1920x1080. A phone canvas is a fraction of that, so
with a 0.5 match every element renders at roughly half its design size. That is
the text, the buttons, and the header in one setting.

**Change the reference resolution.** For a 16:9 reference with match 0.5 the
whole thing collapses to one term:

```text
scale multiplier = 1920 / referenceWidth
```

| Reference resolution | UI gets |
| --- | --- |
| 1920x1080 (current) | 1.0x |
| 1280x720 | 1.5x |
| **768x432** | **2.5x** |

**Owner's revised call after holding the phone: at least 2.5x.** That is
`768 x 432`. Check: sqrt(1920/768) * sqrt(1080/432) = 1.5811 * 1.5811 = 2.50.

Because it is a ratio it applies uniformly on every screen. One number, no
per-element retuning.

### The tradeoff to check before shipping it

That 2.5x is uniform, which means **desktop grows 2.5x too.** On a 1920x1080
laptop the UI would be two and a half times its current size, which will very
likely be too large.

Do not let that block the phone fix — an unreadable question on the device
students actually use is a real defect, and desktop looking chunky is not. But
verify desktop after changing it. If it is unacceptable, the options are:

- `m_ScreenMatchMode: 1` (Expand) — scales to fit, never shrinks below reference
- a runtime CanvasScaler adjustment keyed on screen size, phone vs desktop

Prefer the single number first. Measure, then decide.

**The owner's eyeball estimate and the arithmetic landed on the same values
twice.** Trust the person holding the phone.

These are the first observations from the real product on real hardware. They
outrank everything else in the queue: Fast Break asked for one user-visible
PRODUCT shot, and a real student hitting a real wall is exactly that.

### Lane: all three are Codex's

`CLAUDE.md` assigns drag/rotate/reset/audio/**UI scale** to the Unity repo.
Text size, overflow scrolling, and the orientation the board is designed for are
all Unity UI. Web cannot fix any of them, and checked rather than assumed:

- `src/unity/UnityStage.module.css` sizes the canvas `width: 100%; height: 100%`
  and explicitly defers DPI to Unity — *"Unity handles its own DPI scaling;
  never let CSS smooth the canvas."*
- Nothing in `src/unity/` touches `devicePixelRatio` or sets canvas width/height.

Web is not shrinking the text. Do not "fix" this on the web side by scaling the
canvas; that would blur the render and hide the real defect.

### Orientation — do NOT lock landscape yet

`ProjectSettings.asset` in the Unity repo says:

```text
defaultScreenOrientation: 4            # AutoRotation
allowedAutorotateToPortrait: 1         # all four orientations allowed
allowedAutorotateToLandscapeRight: 1
defaultScreenWidthWeb: 960             # landscape canvas, 8:5
defaultScreenHeightWeb: 600
```

The game auto-rotates; it is not locked. But the default web canvas is
landscape-shaped. The owner's concern — that the board is played vertically and
landscape would clip it — cannot be settled from ProjectSettings. It depends on
the camera and canvas scaler in the scene.

**A web-side landscape lock was scoped and deliberately not built.** If the board
is vertical, forcing landscape ships exactly the clipping bug the owner
predicted. Settle the shape first, then steer students toward it.

Also worth knowing before anyone tries: **orientation cannot be locked on iOS
Safari.** `screen.orientation.lock()` is unsupported there. The only portable
mechanism is a blocking overlay that hides the game until the phone is turned.

### Known, not yet a defect

The build is ~90 MB (65 MB wasm + 25 MB data). On school Wi-Fi or phone data
that is a long wait. Real for classroom use. Not worth solving until the
experience above it is right.

---

## School Wi-Fi — what the student link actually needs

Owner requirement: the share link has to work on school Wi-Fi. Traced rather
than assumed.

### The student path touches ONE host

`https://samco1983.github.io/SAL0MANder-Web/play`

- The deploy sets no `VITE_API_BASE_URL`, so `isConfigured` is false and the app
  runs on the in-memory mock transport.
- No `fetch`, `WebSocket`, or `XMLHttpRequest` anywhere in `src/routes/guest-play/`
  or `src/api/mockTransport.ts`.
- The Unity build is served from the same origin (`/unity`), not a CDN.

**No `workers.dev`. No Make. No Cloudflare Access.** The one `workers.dev`
reference in the deployed bundle belongs to the owner console at `/console`,
which no student visits.

This matters: the three things known to be blocked at school are all on the
owner path, not the student path.

### Download size: ~30 MB, not 90

GitHub Pages gzips on the fly:

```text
sal0-unity-webgl.wasm   65,522,692 on disk  ->  16,722,520 over the wire
sal0-unity-webgl.data   24,938,655 on disk  ->  13,432,310 over the wire
```

Roughly 30 MB total, once per device, then browser-cached. A class of 30 on
first load is still ~900 MB across a shared network — real, but survivable, and
only on day one.

### The one unknown, and it is one test

**Does the school's content filter allow `samco1983.github.io`?** That cannot be
answered from home. Everything else about the student path is now known-good.

The test takes thirty seconds on site:

```text
Open https://samco1983.github.io/SAL0MANder-Web/play on school Wi-Fi.
  loads + puzzle appears  -> the link works for students. Done.
  blocked / filter page    -> github.io is filtered; needs a custom domain
                              on an allowed host, or an IT allowlist request.
  loads but never finishes -> size or throughput, not blocking. Different fix.
```

Those three outcomes have three different owners and three different fixes. Do
not guess between them — the page will say which one it is.

**Do not diagnose anything else on school Wi-Fi.** Cloudflare Access, Make, and
`workers.dev` are genuinely blocked there and will produce false readings, as
they did all through 2026-08-24.
