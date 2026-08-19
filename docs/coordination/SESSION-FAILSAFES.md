# Session And Fail-Safe Plan

The supervisor must distinguish agent identity, surface, and capability.

## Session Rules

- A pinned browser chat is for human navigation only. It is not automation
  identity.
- A CLI session id is automation identity only for that CLI surface.
- Browser chats, CLI sessions, GitHub comments, and local run folders are
  different surfaces. Do not assume they share memory.
- Every automated run starts from a packet, not from remembered conversation.
- Session ids may be stored only as non-secret references. Do not store tokens,
  auth files, cookies, or credentials.

## Recommended Rooms

- Codex desktop chat: main technical command room.
- Codex CLI: stateless technical worker or explicit consultation.
- Claude CLI: web/code POSITION worker when available.
- Claude browser chat: manual consult only unless copied into run evidence.
- Gemini browser chat: live Google/browser/cloud challenger while Samuel is
  present.
- Gemini CLI/API: future unattended critique worker after proof.
- GitHub Issue/PR: durable evidence hub.
- Make: outside-edge webhook/notification/Google Docs mirror.

## Fail-Safe States

Every agent must end in one of:

- `WORKING`
- `DONE - NEED NEW TASK`
- `BLOCKED - NEED OWNER`
- `WRONG LANE - REASSIGN`
- `UNKNOWN/UNREACHABLE`
- `REVIEW READY`

No silent middle state counts as progress.

## Routing Table

| Problem | First call | Second call | Final authority |
| --- | --- | --- | --- |
| Unity gameplay or tests | Codex | Unity AI | Codex |
| Web UX/code | Claude | Codex | Codex for feasibility |
| Google Drive/Cloud/OAuth | Gemini | Codex | ChatGPT/Samuel for policy |
| Product priority | ChatGPT | Codex for feasibility | Samuel if major fork |
| Automation plumbing | Codex | Claude adversarial review | Codex |
| Off-hours notification/mirror | Make | Codex | Samuel if live scenario changes |

## Hard Stops

Stop the run when:

- a required agent is unauthenticated;
- a packet lacks source commit/timestamp;
- model output fails schema validation;
- Gemini critique does not cite a specific Claude claim;
- the OpenAI decision has more than one next action;
- a repo has unexpected dirty files in the target lane;
- a requested action crosses lanes without a boundary review;
- a destructive or spending action is needed;
- milestone acceptance is required from Samuel.

