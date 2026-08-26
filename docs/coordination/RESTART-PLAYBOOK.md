# Restart Playbook — 2026-08-25

Paused on school Wi-Fi. Written so the next session starts from **verified
state**, not from today's network symptoms.

School Wi-Fi is the worst possible place to diagnose certificates, Cloudflare,
or `workers.dev`. Everything in the "do not debug here" list below produced a
false reading today.

---

## 1. Verified state — what is actually true

| Thing | State | Evidence |
| --- | --- | --- |
| Unattended work loop | **Alive** | 3 possessions on 2026-08-25; `b63a2aa`, `bae033c` committed and pushed by the loop itself |
| The Aug 20 jam | **Cleared** | runtime clone was 2 commits diverged from 138; reset to origin, backup on branch `wedged-20260820` |
| Championship | **9 of 12** | `OPERATIONAL` 5/5, all independently checkable |
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
npm run mission:championship         # baseline: expect 9/12, maybe 10/12
npm run mission:desktop:resume       # takes the brake off
npm run mission:desktop:status       # confirm: pause off
```

> **Push before resuming.** Three commits sit local-only on this Mac. The
> unattended loop runs from a *second* clone at
> `~/.sal0mander/runtime/SAL0MANder-Web`, which pulls from origin and cannot see
> them. Local-only commits on a branch two copies both track is exactly the
> shape that jammed the loop on 2026-08-20 and cost four days. Push first.

Then check one thing that today's network could not settle:

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
