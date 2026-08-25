# Doors — how to run Fast Break and Championship

Written 2026-08-24, after the Mission Control console spent an evening showing
"Mission Log unavailable" and the answer turned out to be a missing secret.

**There are two doors. Neither one is a back door. The one that always works
does not touch the network at all.**

---

## Door 1 — the terminal. Always open.

```bash
npm run mission:next          # FAST BREAK
npm run mission:championship  # CHAMPIONSHIP
```

Both are Python on this Mac. They do not cross Cloudflare Access, they do not
call Make, they do not resolve `workers.dev`, and school Wi-Fi cannot block
them. Verified working 2026-08-24 — both printed real output while the web
console was still failing.

Add `:json` to either for machine-readable output (`mission:next:json`,
`mission:championship:json`).

This is the door to use when anything else is broken. **It was open the whole
time the console was down.**

## Door 2 — the web console. Convenience, not capability.

`protected console -> Worker -> GitHub Issues API`

Same outcomes, reachable from a phone. It goes through Cloudflare Access on
purpose: the buttons write into the evidence ledger, and a ledger anyone can
write to is not evidence. Access is not the friction — Access was already
succeeding. Make was the friction.

---

## What was actually wrong

The Worker returned **504 within milliseconds**. That number named its own
cause and nobody read it:

| Symptom | What it rules in |
| --- | --- |
| 504, not 502 | The `catch` fired. Make never answered — a Make scenario that is off or erroring answers with an HTTP status, which is a 502 path. |
| Immediate, not 10s | Not the abort timeout. Something threw synchronously. |
| Both together | `fetch(env.MAKE_WEBHOOK_URL)` where the secret is undefined. `fetch(undefined)` throws a `TypeError` instantly. |

The secret was never set on the deployed worker, or was set on a different
worker or environment than the one serving traffic.

The second defect is why it cost an evening: the handler is `catch {` with no
binding. The Worker knew exactly what went wrong and discarded it. Nine minutes
of tracing against a log line that was deleted before it was ever written.

**The rule this earns:** an empty `catch` on a network boundary is a defect on
its own, independent of whatever it was hiding.

Live location of that defect: `edge/mission-control/worker.js` on `main`,
in `makeRequest()` — the `fetch(env.MAKE_WEBHOOK_URL)` and the bare `catch`
returning `504 upstream_unreachable`.

---

## The branch trap that cost this session an hour

There are **two** ops workers in this repo's history and only one is live:

| Worker | Where it exists | Status |
| --- | --- | --- |
| `edge/mission-control/` | `origin/main` | **live** — serves `/ops/missions`, backs both console buttons |
| `edge/ops-endpoint/` | `council/2026-08-18` only | superseded, absent from `main` |

A search for `ops/missions` from `council/2026-08-18` returns **nothing**,
because the file that contains it is not on that branch. That absence reads
exactly like "this endpoint does not exist in this repo" and it is wrong.

**Check `git branch --show-current` before concluding a thing is missing.**
Confirm against `origin/main` with `git ls-tree -r --name-only origin/main`
before believing a negative search result.

Claude patched `edge/ops-endpoint/worker.js` on the stale branch. Codex caught
it. The diagnosis above transferred to the live worker; the patch did not.

---

## Status of the ops-endpoint patch on this branch

`edge/ops-endpoint/worker.js` and its `wrangler.jsonc` now call the GitHub
Issues API directly instead of Make, with a pre-flight config check, per-branch
error logging, and a fenced/sanitized issue body. `npm run verify` passes.

**Do not merge it to `main` as a fix for the buttons.** It would reintroduce a
worker `main` no longer has, and it would not touch the endpoint the console
actually calls. Keep it as a reference implementation for the live fix, or drop
it — those are the only two honest options.

The live fix belongs in `edge/mission-control/worker.js` on `main`. Codex owns
that; Claude is not editing it in parallel.

---

## Door 3 — the unattended loop. Installed, and currently on the brake.

This is the answer to "does Mission Control work without Claude and Codex?"

**Architecturally yes. Right now, no — and not for any reason the console fix
touches.**

`npm run mission:desktop:status` on 2026-08-24 reports:

```text
launchd job: loaded
  state = not running
  runs = 76
  last exit code = 128
pause: ON - auth failure 20260820T131358Z - worker locked out,
             renew with ~/.sal0mander/new-token.sh
claude token file: present, mode 600
```

Read that carefully, because it says four separate things:

1. **The loop is real.** `runs = 76`. It has executed unattended 76 times. This
   is not a thing that needs building.
2. **It is stopped by a deliberate brake**, not a crash. `pause: ON`, set
   2026-08-20, and the pause flag lives outside the repo so no git operation can
   clear it by accident.
3. **The cause is auth**, not the console, not Make, not Cloudflare, not
   `workers.dev`. Exit code 128 is git refusing a credential.
4. **The token file exists and is still wrong.** "present, mode 600" and "worker
   locked out" are not a contradiction — a present token can be an expired one.
   File presence is not authorization, and the Championship board's "the worker
   can authenticate unattended" check tests only presence
   (`scripts/lib/sal0_championship.py`, `os.path.exists`). That check has been
   reporting WON for four days while the worker was locked out.

Championship separately reports no possession in ~5088 minutes — roughly three
and a half days, the same era as the pause. Consistent with one cause, though
the two clocks are not measured the same way.

### What actually restarts autonomy

```bash
~/.sal0mander/new-token.sh          # owner only - renews the worker credential
npm run mission:desktop:resume      # clears the brake
npm run mission:desktop:status      # confirm: pause OFF, then watch runs climb
```

The first is the owner's alone. No agent should run a credential renewal, and
none of this is unblocked by fixing the console.

### The division that answers the question

| Layer | Needs an agent? | State |
| --- | --- | --- |
| Console button -> Worker -> GitHub | No. Plain HTTP and a token. | Being fixed by Codex on `main`. |
| Mission sitting in the queue | No. GitHub holds it. | Fine. |
| **Something executing the mission** | **Yes — a CLI worker.** | **Paused since 2026-08-20.** |

The button records intent. It has never been the thing that does the work. Fix
the console and the buttons will file missions into a queue that nothing is
currently draining.

**The brake is the blocker. The console is the symptom everyone was looking at.**

---

## Where Make still belongs

Make is not useless, it was mis-placed. Per `DESKTOP-MAKE-AUTOMATION.md`, Make
is SAL0-09 Signal — the outside edge, not the coach:

- **Keep:** notifications, external intake (phone/text/voice note becomes an
  issue), the daily "Signal is alive" heartbeat.
- **Remove:** the critical path between a button and the ledger.

A notification layer that fails silently looks exactly like a quiet night. That
is the failure class Make exists to prevent, and it cannot prevent it while it
is also the thing that breaks the buttons.

---

## To finish Door 2 — owner only

```bash
npx wrangler secret put GITHUB_TOKEN
```

Use a **fine-grained** PAT scoped to `Samco1983/SAL0MANder-Web` with exactly one
permission: **Issues -> Read and write**. A classic `repo` token would let a
public endpoint push code, and this endpoint has no business doing that.

This is the owner's to run. No agent should hold that token, and it must never
land in this repo — every `VITE_`-prefixed value ships to the browser, and a
committed token is a public token.

---

## Open, not resolved

**`mission:championship` reports "npm run verify fails" while a direct run of
`npm run verify` passes.** Championship shells out to it at
`scripts/lib/sal0_championship.py:123`. One of the two is wrong about the state
of this repo, and until that is settled the Championship board is reporting a
condition nobody has confirmed. Not fixed here — filed so it is not mistaken
for a passing line item.

Also unmet on the Championship board, unrelated to this work: the site does not
answer at `https://samco1983.github.io/SAL0MANder-Web/` (URLError),
`VITE_UNITY_BUILD_BASE_URL` is unset, and nothing has driven a possession in
5088 minutes.

---

## Test run — "does the button wake and run all the AI?" (2026-08-24)

Answer: **no.** Not one link of the wake chain is live right now. Tested with
read-only commands; the live console button was not pressed, because it still
returns "Mission Log unavailable" and pressing it would launch a real mission.

| Link | Command | Result |
| --- | --- | --- |
| Keep-awake daemon | `mission:awake:status` | `{"status": "inactive"}` |
| Brake | `cat ~/.sal0mander/PAUSE` | present — `auth failure 20260820T131358Z — worker locked out` |
| launchd loop | `mission:desktop:status` | loaded, `state = not running`, `last exit code = 128` |
| Broker queue | `mission:broker:list` | 8 jobs, newest `2026-08-22T17:13` — nothing in two days |

### The finding inside the finding

Broker jobs by status: **3 FAILED, 2 DONE, 3 AWAITING_VERIFICATION.**

The three newest jobs — `make-data-pull`, `trusted-dir-proof`,
`worker-handoff-to-codex`, all `codex-cli`, all **exit code 0** — have sat in
`AWAITING_VERIFICATION` since 2026-08-22.

That is work that ran, succeeded, and never scored. Under BBALL doctrine a point
counts only after *independent* verification, and the independent verifier is
the `claude` lane — the lane the PAUSE file says is locked out. Codex kept
playing after Claude was benched, and three finished possessions have been
sitting unscored ever since.

This is why the scoreboard reads as a quiet night. It was not quiet. Nobody
could sign off.

### Unblock order — this is the sequence that matters

1. `~/.sal0mander/new-token.sh` — **owner only.** Nothing below works first.
2. `npm run mission:desktop:resume` — clears the brake.
3. `npm run mission:broker:list` — verify the three AWAITING_VERIFICATION jobs
   get picked up and scored.
4. Only then does the console fix change anything a human can see.

Fixing the console first files new missions into a queue nothing is draining,
on top of three that are already waiting.

---

## Fixed 2026-08-24

### 1. The board reported a win while the worker was locked out

`scripts/lib/sal0_championship.py` decided "the worker can authenticate
unattended" with `os.path.exists(token)`. **Presence is not authorization.** The
token file existed and had stopped working, so the check reported WON every day
from 2026-08-20 while the launchd loop sat locked out.

The loop already knew. It hit the auth failure, wrote the reason into
`~/.sal0mander/PAUSE`, and stopped. The board was reading the inode instead of
the scheduler's own verdict on its own credential.

Now it reads the verdict. An auth-flavoured pause fails the check and prints the
reason and the remedy. A non-auth pause (an owner calling TIMEOUT) does not —
that is a deliberate stop, and the possession-heartbeat check already covers it.

Before: `WON  the worker can authenticate unattended`
After:  `not  the worker can authenticate unattended`
        `token file present but the loop reported a lockout — auth failure ...`

**This is the same defect class the repo already refuses everywhere else:
claiming DONE with nothing behind it. It was living in the scoreboard.**

### 2. "npm run verify fails" was wrong

Measured three ways: direct run exits **0**; Championship's exact subprocess call
(`subprocess.run(['npm','run','verify'], cwd=REPO)`) exits **0** in 78s; and the
board now prints `WON  the full gate is green`.

No code change was needed — the earlier red was transient. Most likely cause:
another agent was running commands in this same working tree at that moment, so
`tsc`/`vite` read files mid-write. Recorded rather than closed silently, because
"it passes now" is not the same as "it never failed."

**Method note:** the first check of this ran `npm run verify | tail`, which
reports the exit code of `tail`, not of `verify`. A piped verification is not a
verification. Capture the status explicitly.

### Still open, and not an agent's to close

`~/.sal0mander/new-token.sh` — the worker credential renewal. Owner only. No
agent should run a credential renewal, and nothing above unblocks autonomy
without it. The board will keep printing that line, correctly, until it is done.
