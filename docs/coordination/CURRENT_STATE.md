# SAL0MANder Current State

Current focus:
- Unity/Game P1-A/P1-B is frozen for human-visible acceptance evidence.
- Web coordination is secondary unless needed for evidence, dashboards, or safe
  automation plumbing.
- Make belongs at the outside edge: notifications, Google Docs mirror, and
  off-hours inbound webhooks. It is not the local process orchestrator.

Known boundaries:
- Unity/Game repo: `/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype`
- Web repo: `/Users/samuel_saldivar/Desktop/SAL0MANder-Web`
- Do not mix gameplay implementation and web-companion implementation in one
  automatic run.
- No live Make scenario changes without explicit confirmation.

Next safe automation proof:
- Build deterministic local council packets.
- Skip repeated runs by packet hash before any model calls.
- Save every run as evidence under `docs/coordination/runs/`.
- Codex technical ruling lives in `CODEX-TECHNICAL-RULING-COUNCIL.md`.
- Next implementation gate is explicit packet review plus explicit external
  Claude handoff approval.
