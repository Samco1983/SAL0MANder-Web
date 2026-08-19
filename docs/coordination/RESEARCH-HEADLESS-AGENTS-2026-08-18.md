# Research — can these agents actually be run unattended, and can they do work?

**From:** Claude (SAL0-04) · 2026-08-18 · owner asked for research
**Method:** fetched the vendors' own current docs. Sources at the bottom.

## The short answer

**Yes. All three CLIs support unattended runs that can change files.** This is
not a research problem any more; it is a configuration problem. What was
missing from our supervisor was never a capability — it was that we only ever
asked Claude for an opinion.

Two things I did not know before this, and both change the design:

1. **Both Claude Code and Codex can be forced to return output matching a JSON
   schema.** We currently ask for JSON in the prompt and dig it out of prose.
   That whole failure class can be deleted.
2. **Claude Code prints some in-run failures — including missing auth — as its
   result on stdout, not on stderr.** Our attribution code read stderr only, so
   an unauthenticated CLI would have been recorded as a model judgment. Fixed
   this session; see the note at the bottom.

## What each CLI actually supports

| | Claude Code | Codex CLI | Gemini CLI |
| --- | --- | --- | --- |
| Headless | `claude -p "<task>"` | `codex exec "<task>"` | `gemini -p "<task>"` |
| Can write files unattended | `--permission-mode acceptEdits`, or `--allowedTools "Read,Edit,Bash"` | `--sandbox workspace-write` | tool policy in `~/.gemini/policies/*.toml` |
| No approval prompts | `--permission-mode dontAsk` for locked-down runs | `--ask-for-approval never` | `ask_user` auto-denies when non-interactive |
| Schema-enforced output | `--output-format json --json-schema '<schema>'` → `structured_output` | `--output-schema <path>` | `--output-format json` |
| Exit codes | 0 success, non-zero failure; **143 on SIGTERM** | non-zero on failure | 0, 1, 42 invalid input, 53 turn limit |
| Reproducible CI startup | `--bare` skips hooks, plugins, MCP, CLAUDE.md | — | — |
| Cost visible per run | `--output-format json` includes `total_cost_usd` | — | `stats` in JSON output |

Three details worth knowing before wiring any of it:

- **`--bare` does not use the subscription login.** It never reads OAuth
  credentials or the keychain, so it needs `ANTHROPIC_API_KEY`. Reproducible CI
  and subscription billing are a trade-off, not both.
- **Claude Code handles SIGTERM properly**: it aborts the turn, kills the
  process tree of any running Bash command, and exits 143. Our own supervisor
  had to learn that lesson separately.
- **`--max-turns` caps how much work one run can do.** That is the cost control
  for an executor stage — a bounded number of iterations, not a bounded prompt.

## The off-hours lane is a supported product, not a workaround

`anthropics/claude-code-action@v1` runs Claude Code inside GitHub Actions, on
any GitHub event including `cron`. The App holds Contents, Issues and Pull
requests read/write, so it can commit and open PRs. Auth is either
`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`.

This is the middle lane of the corrected topology, and it is a maintained
integration rather than something we assemble. Two constraints that bite:

- **Scheduled workflows run only from the default branch.** Our council work is
  on `council/2026-08-18`. A cron council would have to be merged to `main`
  first — which is a real decision, not a detail.
- **Public repos disable a schedule after 60 days of inactivity.** Ours is
  private, so this does not apply, but it is the kind of thing that looks like
  "the council quietly stopped" a year from now.
- A bot actor cannot trigger runs unless allow-listed, which is deliberate loop
  protection. Scheduled runs are attributed to whoever last edited the cron.

## What this changes for us

**The executor stage is smaller than proposed.** `PROPOSAL-EXECUTE-STAGE.md`
described building a bounded executor. Most of the envelope already exists as
vendor flags: `--sandbox workspace-write` and `--permission-mode acceptEdits`
bound what can be touched, `--max-turns` bounds how long, and schema-enforced
output bounds the shape. Our job is the worktree, the branch, and the verify
gate — not the sandbox.

**Delete the JSON-scraping.** `--json-schema` on Claude and `--output-schema` on
Codex make `OUTPUT_UNPARSEABLE` largely impossible by construction. That is one
of only three model-attributable failure classes we defined.

**The gap that remains is the one the research cannot close.** Desktop app
sessions still have no headless entry point. Everything above is CLI and API.
Work living in a desktop chat has to be re-expressed as a file or a CLI call
before any of this reaches it.

## Correction landed this session

`classifyOutputFailure` read stderr only. Claude Code documents printing in-run
failures such as missing authentication as the result **on stdout**. An
unauthenticated CLI would therefore have produced prose, failed to parse, and
been recorded as `OUTPUT_UNPARSEABLE` — attribution `model`. That is precisely
the confusion the module was written to prevent, arriving through the one door
I did not check. `detectInfrastructureInOutput` now scans stdout for the same
auth and policy signals before anything is attributed to a model, with tests.

## Sources

- Claude Code, run programmatically: https://code.claude.com/docs/en/headless
- Claude Code GitHub Actions: https://code.claude.com/docs/en/github-actions
- Codex non-interactive mode: https://learn.chatgpt.com/docs/non-interactive-mode.md
- Gemini CLI headless: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md
- Gemini CLI policy engine: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/policy-engine.md

---

## Addendum — what is already running on this Mac

The owner pointed out that Codex has been working on this machine for a while
and would hold useful history. Checking that turned up something bigger than
history.

**The wake-up loop already exists, and it is not ours.** `~/.codex/automations/`
holds two SAL0MANder heartbeat automations:

| Automation | Cadence | Status | What its prompt tells it to do |
| --- | --- | --- | --- |
| `sal0mander-agent-nudge-monitor` | every 10 minutes | **ACTIVE** | classify each lane, report changes, prepare nudges |
| `sal0mander-hourly-agent-accountability` | hourly | **PAUSED** | classify lanes **and continue the next safe bounded engineering or automation task** |

Verified live: the nudge monitor's `target_thread_id` maps to a session file
last written minutes before this was recorded. It is firing now.

**The finding that matters: the automation that produces work is switched off,
and the one that is switched on only produces status.** That is the same
"decision with no consumer" shape as the council, arrived at independently on a
different surface. Turning the hourly one back on is a smaller change than
anything in `PROPOSAL-EXECUTE-STAGE.md`.

Three constraints that came with it:

- **`codex` is not on PATH on this machine.** Neither is `gemini`; `~/.gemini`
  does not exist. Only `claude` resolves. So a local Python supervisor cannot
  invoke Codex CLI here today, and the preflight added this session would block
  such a run rather than fail confusingly. The automations do not use a local
  binary — they run inside Codex's own system against a thread id.
- **The nudge monitor's thread is 80MB and 7,354 lines.** A heartbeat appending
  to one ever-growing thread every ten minutes is the archive-as-context failure
  from the architecture review's §7, already happening. It will get slower and
  more expensive, not cheaper.
- **1.7GB of session history exists** across `sessions/` and
  `archived_sessions/`. Mineable, but §7 still applies: a harvest produces a
  *candidates* file of claims, not decisions. Promote by hand.

This does not make the supervisor work pointless — the lock, preflight, and
attribution fixes apply to anything that runs unattended. It does change what
is scarce. Scheduling is solved. A consumer for the decision is not.
