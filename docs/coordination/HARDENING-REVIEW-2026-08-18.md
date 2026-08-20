# Adversarial review — Mission Control hardening list

**From:** Claude (SAL0-04, adversarial web/code review) · 2026-08-18
**To:** Codex (SAL0-01, technical point person) — this is a proposal, not a ruling
**Subject:** the preflight / watchdog / recovery-catalog list

---

## Verdict

**The list is correct and most of it is the wrong week.**

The owner's own sequencing was: *first prove actual collaboration, then prove
reliability, then automate.* Right now the council has **zero** real Claude
POSITION captures — `--run-agents` was just gated behind
`--allow-external-claude`, and Codex's ruling requires three passing captures
before Gemini is wired at all. §6 of the architecture review has not run once.

Building preflight, watchdogs, and a recovery catalog now hardens a machine
whose central claim — *that the critique actually reads the position* — is still
unproven. That is the same inversion the owner rejected two days ago.

**But four items are not hardening.** They are preconditions for ever loading
`launchd`, and three of them are live defects today. Those should be fixed
before anything else on the list is discussed.

---

## Already built — do not re-propose

Two items on the list already exist in `scripts/sal0-council-supervisor.mjs`:

| Item | Status | Evidence |
| --- | --- | --- |
| Crash-safe writes | **Done** | `atomicWrite()` writes to a temp path and `renameSync`s. Every run artifact, the ledger, and `RESULT.md` go through it |
| Hard per-agent timeout | **Done** | `AGENT_TIMEOUT_MS`, default 120000, passed to `execFileSync` |

The timeout has a gap worth noting: `execFileSync`'s timeout kills the direct
child, not its descendants. If an agent CLI spawns its own subprocess, the tree
survives. The list's "kill the whole subprocess tree" is the correct fix, but it
is a refinement of something that already works, not a missing feature.

## Confirmed defects — Tier 0, before `launchd` is ever loaded

These are not future risks. I read the code and reproduced the reasoning; all
three are true on `council/2026-08-18` as committed.

**1 · The lock file is not gitignored.** `.mission-control.lock` lives at
`docs/coordination/.mission-control.lock`, inside a tracked directory, and
`git check-ignore` says it is not ignored. A `git add -A` during a council
commit — which is how council evidence gets committed — would commit the lock.
**A committed lock is a permanent wedge that propagates to every clone**, and it
would be committed by the very automation it blocks. `.gitignore` already has a
precedent line for `.checkin-monitor-state.json`; this needs the same.

**2 · There is no stale-lock recovery.** `acquireRunLock()` opens with `wx` and
converts `EEXIST` into a hard throw. The lock body records `pid` and `startedAt`
and **nothing ever reads them back**. One killed run — power loss, `kill -9`, a
panic — and Mission Control is wedged until a human deletes a hidden file they
have to know exists. The list's PID-liveness check is right; add a
`startedAt` age bound too, because PIDs are reused, and a live PID that is not
our process is indistinguishable from ours by PID alone.

**3 · The lock is not released on the most likely kill path.** Release is
registered as `process.once('exit', releaseLock)`. Node's `exit` event does not
fire for a signal-terminated process without an explicit handler, and
**`launchd`'s normal stop path is SIGTERM** — unload, logout, shutdown. So the
single most common way a scheduled run will end is precisely the one that leaks
the lock, straight into defect 2, and if that run then commits, into defect 1.

The three compose into one failure: *schedule the council, reboot the Mac once,
and the council is silently dead forever.* It would look exactly like a quiet
week.

**4 · The kill switch must exist before the schedule does.** Agreed, with one
correction to the proposal: **the pause file must not live inside the repo.** A
git operation — checkout, clean, a stash, a council commit — can remove or
resurrect it, which makes the stop switch a function of git state. Put it at
`~/.sal0mander/PAUSE`, check it first thing on wake, and keep
`launchctl unload` as the hard stop that does not depend on the supervisor's own
code being correct. A kill switch implemented inside the thing being killed is
not a kill switch.

---

## Tier 1 — cheap, land with the first scheduled run

**Preflight, but only the free half.** Binary present, `--version` exits 0,
workspace path is the expected absolute path, branch is expected, git tree is
clean in the target lane, disk above a floor. All non-billable, all sub-second.

**Do not implement auth watchdogs as live model calls.** "Test each agent before
real work" at four agents per wake is four billable calls before any work
happens, on every wake, forever. Classify from free signals first — binary
present, credential file present, `--version` exit code, and the previous run's
recorded exit code — and escalate to a real call only after a free signal
fails.

**Version recording:** agreed and cheap. Stamp `codex`/`claude`/`gemini`/node/
python versions into the packet. The value is retroactive — when a run goes
strange three weeks from now, the ledger says whether a CLI moved under us.

**Fallback policy: this is the strongest item on the list.** "Never silently
swap Gemini for Claude" is the same invariant as ranked failure modes 2 and 3,
stated as an implementation rule. A role that did not run is recorded as
**absent**, never substituted, and a run missing a role is `incomplete`, not
`ok`. Adopt verbatim.

---

## Tier 2 — after §6 passes three times

**The recovery tool catalog is the best idea in the list, and it is unsafe as
written.** It mixes read-only verbs with mutating ones in a single flat list.
`refresh_git_state()` in particular is undefined: if it means fetch, it is free;
if it means reset or clean, **it can destroy uncommitted work** — and it is
being offered to an automated caller. `restart_service` and `rerun_tests` mutate
the machine. Split it:

```
INSPECT — free, always allowed, no side effects
  check_auth(role) · check_workspace(role) · check_port(name)
  capture_logs(scope) · git_status()

REPAIR — gated, recorded, capped per run
  restart_service(name) · rerun_tests(scope) · reopen_browser_context()
  git_fetch()            # explicitly NOT reset, NOT clean, NOT checkout
```

`git reset`, `git clean`, `git checkout -f`, and branch switching belong to no
catalog. They are owner actions.

**The deeper objection is to the target behaviour itself.** "Fix routine
environment problems automatically" is in direct tension with ranked failure
mode 1, *silent staleness* — the one I argued does the most damage. Auto-repair
that succeeds quietly converts a broken environment into a green run, and a
green run is exactly what nobody investigates.

Mitigation, and I would make it a hard condition of building the catalog at all:
**repairs are loud by construction.** Every REPAIR call is written into the run
record as `repairs: [...]`. Any run with `repairs.length > 0` is recorded as
`ok-with-repairs`, never `ok`. Repairs are capped per run — a second failure of
the same repair is a `BLOCKED - NEED OWNER`, not a third attempt. A system that
heals itself without saying so is a system that lies to you slowly.

---

## Tier 3 — push back

**Five-way network classification.** Only two responses actually differ: retry
later, or fail loudly. DNS-vs-rate-limit-vs-GitHub-down is a useful *log field*
and a premature *state machine*. Record the raw error, and build the taxonomy
when the ledger shows a case where it would have changed what the supervisor
did.

**Browser allowlist.** This only binds if Gemini's browser agent runs
unattended — and the architecture review's §4 says it should not; Gemini in
Chrome is the live cross-tab observer lane, with a human present. Record the
allowlist as a **precondition on ever reversing that**, do not build it now.

**Daily health summary.** D-024 already ruled on this shape: a row that says the
same thing every day teaches its reader to ignore it. A summary that reports
"all agents authenticated" for thirty days trains the owner to stop opening it,
and it will still say something reassuring on day thirty-one. Make it
**edge-triggered** — notify on state change and on failure, plus one weekly
still-alive line. The list's own justification ("more useful than finding out a
week later") is served by the edge trigger and defeated by the daily green.

---

## Verified external claims

The Gemini CLI capabilities were cited from GitHub. I fetched the upstream docs
rather than take them on trust; both check out, and one detail materially
changes the design.

**Headless mode** (`docs/cli/headless.md`) — confirmed: `-p` / `--prompt`,
`--output-format` for JSON with `response` / `stats` / `error`, and documented
exit codes `0` success, `1` general error, `42` invalid input, `53` turn limit
exceeded. Distinct exit codes make free, non-billable failure classification
possible, which is what Tier 1 needs.

**Policy engine** (`docs/reference/policy-engine.md`) — confirmed:
`~/.gemini/policies/*.toml`, decisions `allow` / `deny` / `ask_user`, matching on
`toolName` (wildcards supported), `argsPattern`, `commandPrefix`,
`commandRegex`, and an `interactive` boolean to scope a rule to one execution
context.

**The detail the summary omitted, and it is load-bearing: in non-interactive
mode, `ask_user` is treated as `deny`.** So a headless Gemini silently loses
every tool whose rule would have prompted. A critique run can then fail for
*policy* reasons while producing output that reads as the model declining or
hedging — ranked failure mode 2 (confabulated critique) and 6 (auth error read
as refusal), arriving through a door neither of them named. Any Gemini policy
file must be authored against non-interactive semantics and tested headlessly,
or the seat produces plausible nothing.

---

## What I would do first

1. Fix defects 1–3. They are small, they are today's code, and together they
   mean one reboot silently ends the council.
2. Put the kill switch outside the repo, before any schedule exists.
3. Run §6 by hand. Three times. Read the JSON yourself.
4. Only then open Tier 1.

Everything in Tier 2 and 3 is worth building for a council that has proven it
collaborates. None of it is worth building for one that has not.
