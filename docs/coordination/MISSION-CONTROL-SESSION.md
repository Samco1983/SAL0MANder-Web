# SAL0MANder Mission Control Session

Saved: 2026-08-19T02:18:34Z

Purpose:
- Main Codex desktop command room for our SAL0MANder Mission Control.
- Technical point-person session for council supervisor architecture,
  role/session fail-safes, automation proof layers, and coordination evidence.

Human-facing name:
- SAL0MANder Mission Control

Internal automation name:
- Council Supervisor

Control layer:
- Mission Control Core — Python Supervisor.
- No SAL0 number because it is not a worker seat.
- Coordinates packets, routing, schemas, retries, logs, and evidence.
- Does not make product or technical judgments.
- Routes by SAL0 role id, not vendor/model name.

Agent roster:
- SAL0-01 Architect — Codex Desktop — Technical Lead
- SAL0-02 Runner — Codex CLI — Local Execution
- SAL0-03 Director — OpenAI API — Product Decision
- SAL0-04 Builder — Claude CLI — Web/Code Work
- SAL0-05 Reviewer — Claude Chat — Manual Critique
- SAL0-06 Scout — Gemini Chat — Google/Browser Review
- SAL0-07 Challenger — Gemini API/CLI — Automated Critique
- SAL0-08 Inspector — Unity MCP — Unity Evidence
- SAL0-09 Signal — Make Cloud — Outside Automation
- SAL0-10 Ledger — GitHub Cloud — Source Of Truth

Current durable pointers:
- Web coordination repo: `/Users/samuel_saldivar/Desktop/SAL0MANder-Web`
- Web coordination branch: `council/2026-08-18`
- Latest saved coordination commit when recorded: `a89adc1`
- Active heartbeat automation id: `sal0mander-agent-nudge-monitor`
- Unity/Game repo: `/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype`
- Unity frozen acceptance head when recorded: `49ac86c`

Session identity note:
- The Codex desktop app does not expose this chat's internal thread/session id
  to the local repo tooling used here.
- A pinned/named desktop chat is useful for humans, but not sufficient for CLI
  automation identity.
- CLI session ids, browser chat ids, GitHub comments, and desktop chat threads
  are different surfaces and must not be assumed to share memory.

Recovery instruction:
- If this desktop chat is lost, restart from this file, `CURRENT_STATE.md`,
  `AGENT_ROLES.json`, `SESSION-FAILSAFES.md`, and the latest
  `docs/coordination/runs/ledger.jsonl`.
- Use GitHub as the durable evidence trail.
- Do not rely on remembered chat context as project truth.
