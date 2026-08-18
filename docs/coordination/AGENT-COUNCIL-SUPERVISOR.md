# SAL0MANder Agent Council Supervisor

This is the local proof-of-life for the council architecture.

Current status:
- `npm run council:dry-run` builds a deterministic context packet.
- `npm run council:validate-schemas` proves the strict output schemas without
  calling any models.
- The packet reads `PROBE.md`, `CURRENT_STATE.md`, and the last 10 non-council
  commit messages.
- The packet uses the latest non-council commit as `productHead`, so committing
  council run evidence does not trigger another council run.
- The supervisor computes a SHA-256 hash.
- If the same hash already succeeded, it logs `no change` and exits with zero
  model calls.
- Run evidence is written under `docs/coordination/runs/`.

Important boundary:
- This does not call Claude, Gemini, OpenAI, Make, or GitHub yet.
- This does not edit Unity/Game files.
- This is the step before agent execution, not the agent execution layer.

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
- Wire Claude `POSITION` generation behind `--run-agents`.
- Keep Gemini and OpenAI disabled until the first raw Claude output validates.
