# SAL0MANder Agent Council Supervisor

This is the local proof-of-life for the council architecture.

Codex's technical ruling for this layer lives in
`CODEX-TECHNICAL-RULING-COUNCIL.md`.

Agent roles and session fail-safes live in `AGENT_ROLES.json` and
`SESSION-FAILSAFES.md`.

Current status:
- `npm run council:dry-run` builds a deterministic context packet.
- `npm run --silent council:print-packet` prints the exact packet for review
  before any external model handoff.
- `npm run council:validate-schemas` proves the strict output schemas without
  calling any models.
- `npm run council:roles:validate` proves the machine-readable role registry is
  valid.
- `npm run council:run-agents` runs Claude POSITION only, then saves and
  validates raw + parsed output. It refuses to run unless the caller also passes
  `--allow-external-claude`. Gemini and OpenAI stay disabled.
- The packet reads `PROBE.md`, `CURRENT_STATE.md`, and the last 10 non-council
  commit messages.
- The packet also includes `AGENT_ROLES.json` and `SESSION-FAILSAFES.md`, so
  workers receive the role map instead of relying on remembered chat context.
- The packet uses the latest non-council commit as `productHead`, so committing
  council run evidence does not trigger another council run.
- The supervisor computes a SHA-256 hash.
- If the same hash already succeeded, it logs `no change` and exits with zero
  model calls.
- Run evidence is written under `docs/coordination/runs/`.

Important boundary:
- Dry-run does not call Claude, Gemini, OpenAI, Make, or GitHub.
- Agent-run mode calls Claude only and fails loudly if `claude` is not available
  on PATH. Set `SAL0_CLAUDE_BIN` to an explicit CLI path if needed.
- A real `npm run council:run-agents` sends the packet contents to Claude. Use
  it only when that external model handoff is explicitly approved for the
  current packet.
- This does not edit Unity/Game files.
- Gemini, OpenAI, launchd, Make, and Google Docs mirror are still not wired.
- `npm run council:launchd:plist` only generates a launchd plist for review; it
  does not install or load the schedule.

Why this matters:
- Repeated scheduled runs can become cheap and quiet.
- Council-generated commits do not feed back into the next packet.
- Generic critique fails: Gemini must reject a specific Claude claim by id and
  quote matching text from that claim.
- The OpenAI decision has exactly one `selectedNextAction`.
- Failed or stale packets can be audited from disk.
- The council can be upgraded one proof at a time instead of becoming another
  vague dashboard.

Next safe upgrade:
- Add a `--print-packet` review command.
- Add explicit external-handoff approval before any real Claude model call.
- Run `npm run council:run-agents -- --allow-external-claude` only when Claude
  CLI is available and the packet is approved for external handoff.
- Before running it for real, confirm the current packet is allowed to be sent
  to Claude.
- Wire Gemini critique after Claude POSITION validates repeatedly.
- Activate launchd only after the dry-run schedule behavior is accepted.
