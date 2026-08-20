# Codex Technical Ruling — Council Supervisor

Date: 2026-08-18

Status: accepted as the technical direction for the local council scaffold.

## Ruling

The program-manager charter is directionally correct, but only part of it can be
made enforceable in code. The supervisor must be built as a small deterministic
mailroom first, not as a broad multi-agent dashboard.

Codex remains technical point person for:
- supervisor architecture;
- packet shape;
- schema validation;
- model-call gates;
- failure modes;
- evidence requirements;
- technical reconciliation.

ChatGPT/OpenAI remains product/program authority. Samuel remains final owner for
major product forks, destructive actions, spending, privacy/security policy, and
milestone acceptance.

## Enforceable In Code

These rules can be enforced by the supervisor:

- Build a task-specific context packet.
- Hash the packet.
- Skip repeated successful runs with the same hash and same run mode.
- Save every run under `docs/coordination/runs/`.
- Append `runs/ledger.jsonl`.
- Require strict JSON schemas for agent output.
- Reject generic Gemini critique by requiring a specific Claude claim id and
  matching quote.
- Require OpenAI to produce exactly one `selectedNextAction`.
- Fail loudly when an agent CLI is missing or unauthenticated.
- Stop downstream stages after any failed stage.
- Keep dry-run at zero model calls.
- Keep launchd generation separate from launchd activation.

## Policy, Not Code

These rules require discipline, review, or owner judgement:

- Whether a packet is allowed to be sent to an external model.
- Whether an agent's opinion becomes an accepted decision.
- Whether a milestone is human-accepted.
- Whether a product fork is worth pursuing.
- Whether a security/privacy posture is acceptable.
- Whether a Make/Google/GitHub integration should be activated.

The code can force a stop or create evidence; it cannot turn judgement into
truth.

## Current Proof

Already implemented on `council/2026-08-18`:

- `npm run council:dry-run`
- `npm run council:validate-schemas`
- `npm run council:run-agents`
- `npm run council:launchd:plist`

The dry-run path builds a packet, computes SHA-256, writes a run folder, writes
`RESULT.md`, appends the ledger, and skips repeated unchanged packets with zero
model calls.

The schema path validates sample Claude, Gemini, and OpenAI outputs and rejects
a fake Gemini critique that does not cite a real Claude claim.

The Claude stage is gated behind `--run-agents`. It records raw output and parsed
JSON only if the output validates. It fails loudly if Claude is unavailable.

The launchd path only generates a plist for review. It does not install or load
the schedule.

## Smallest Next Proof

Do not wire all agents at once.

Next technical move:

1. Use `npm run --silent council:print-packet` so a human can review the exact
   packet before any external model handoff.
2. Require an explicit `--allow-external-claude` flag so `--run-agents` cannot
   send packet content to Claude by accident.
3. Once a real Claude run is explicitly allowed, require three passing Claude
   POSITION captures before wiring Gemini.

That gives Samuel less coordination burden without creating a hidden machine
that sends project context around without evidence.
