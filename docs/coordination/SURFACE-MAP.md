# Surface map — which agent can a program actually wake?

**Verified on this Mac, 2026-08-18.** Re-check before trusting it; installs
change.

**The thesis:** the terminal is the execution layer, the desktop is the human
layer, and the recurring mistake is using a desktop surface as infrastructure.

## What is installed here

| Surface | Wakeable by a program? | Evidence |
| --- | --- | --- |
| `claude` CLI | **Yes** | `~/.local/bin/claude`, v2.1.234 |
| Claude for Desktop | No — you open it | running per `launchctl`; no headless entry |
| Claude on the web | Indirectly | `claude --cloud <session-id> -p` queues a message into a cloud session |
| Claude browser chat | No | human navigation only |
| `codex` CLI | **Not installed** | not on PATH anywhere checked |
| Codex for Desktop | Runs automations | `application.com.openai.codex` live in `launchctl` |
| `gemini` CLI | **Not installed**, but exists | `@google/gemini-cli` v0.55.1 on npm; no `~/.gemini` here |
| Gemini in Chrome | No | live observation with a human present |

The important consequence: **Codex's automations fire because the Codex desktop
app is running.** There is no `codex` binary on PATH. Close the app and that
wake-up path is gone. A GUI process is currently load-bearing infrastructure.

## Why the terminal is the right execution layer

- **Exit codes.** A number that means worked or did not. No interpretation.
  Prose in a chat window reads like an answer whether or not anything happened —
  that is silent staleness, and it is a property of the surface, not a bug.
- **Composability.** One agent's stdout is the next agent's stdin. No human in
  the middle copying text between windows.
- **Determinism.** The same invocation at 03:00 and at noon. `--bare` goes
  further and ignores hooks, plugins, MCP, and `CLAUDE.md`.
- **Auditability.** A log you can diff, kept next to the commit it produced.
- **Schema enforcement.** `--json-schema` (Claude) and `--output-schema`
  (Codex) make malformed output structurally impossible, rather than something
  the supervisor scrapes out of prose.

## Where the terminal is the wrong tool

- **OAuth- and browser-shaped work** — Google Docs, Gmail, notifications.
  Unpleasant from a local script, one module in Make. This is Make's one honest
  job.
- **Live cross-tab observation with a human present** — Gemini in Chrome.

Both are edges. Neither is the backbone.

## One practical trade-off

Plain `claude -p` uses the subscription login. `--bare` deliberately does not
read OAuth credentials or the keychain and needs `ANTHROPIC_API_KEY`. So
"identical on every machine" and "billed to the subscription" pull against each
other. Choose knowingly; it is not a blocker.

## Wake-up mechanisms that exist right now

| Mechanism | Produces | State |
| --- | --- | --- |
| Codex `sal0mander-agent-nudge-monitor`, every 10 min | status only | **running** (verified firing) |
| Codex `sal0mander-hourly-agent-accountability` | **work** | paused |
| Claude `sal0mander-claude-review-loop` | **work** | defined; no cron, no launchd entry |
| Python supervisor + `launchd` | dry-run evidence | plist generated, never loaded |

**Both mechanisms written to produce work are switched off. The only one running
takes attendance.** Three independent systems, same failure. Scheduling was
never the scarce thing.
