# Mission Control Core

Official label: Mission Control Core — Python Supervisor.

This is the local coordinator/orchestrator for our SAL0MANder Mission Control.
It is not a SAL0 agent and should not receive a SAL0 number.

## Job

- Build context packets from durable files and recent repo evidence.
- Check whether local tools, repos, and agent surfaces are reachable.
- Route by SAL0 role id, not vendor or model name.
- Enforce schemas, timeouts, retries, and run logs.
- Write evidence before asking agents to act.
- Open or print the right browser links when a human needs to inspect state.

## Not Its Job

- Make product decisions.
- Make technical judgments.
- Edit Unity gameplay or web product code.
- Store tokens, cookies, auth files, or secrets.
- Change live Make scenarios without explicit confirmation.

## First Command

```bash
npm run mission:preflight
```

That command writes:

- `docs/coordination/ops/PREFLIGHT-<timestamp>-<hash>.json`
- `docs/coordination/ops/PREFLIGHT-LATEST.md`

Use the latest preflight before waking agents, opening browser rooms, changing
Make routes, or asking for manual copy/paste override.

To print the one-screen human status dashboard:

```bash
npm run mission:control-room
```

To print the human/browser links without writing a new preflight report:

```bash
npm run mission:urls
```

To build a redacted packet for manual or external agent handoff:

```bash
npm run council:external-packet
```

That writes `docs/coordination/ops/EXTERNAL-HANDOFF-LATEST.json`. It keeps
source pointers, role names, repo state, and commit evidence, but omits full
document bodies.

See `docs/coordination/COMMUNICATION-LADDER.md` for the rule on when to use
GitHub, terminal, browser links, desktop notifications, Google Docs mirrors,
Make, or manual copy/paste packets.

Use `npm run mission:control-room` as the first human-readable status view
before sending Samuel into raw terminal logs.

## Local Barrier Rules

- Prefer absolute or discovered binary paths so launchd and Codex Desktop do
  not depend on the user's interactive Terminal PATH.
- Prove GitHub CLI auth with `gh auth status`, but never write token lines into
  evidence.
- Use `.mission-control.lock` to stop overlapping council runs.
- Treat `MISSION_CONTROL_PAUSE` as the human kill switch. If the file exists,
  automatic wakeups should stop before touching agents.
- Flag stale locks separately from active locks so routine crashes are visible.
- Check GitHub/Google network reachability before blaming an agent.
- Check local preview ports before sending browser/UX tasks back to an agent.
- Record free disk space before generating more logs, builds, screenshots, or
  evidence.
- Keep Claude/Gemini missing as `UNKNOWN/UNREACHABLE` until their CLI/API
  surface is proven locally.
- Keep Make as `BLOCKED - NEED OWNER` until a live scenario change is explicitly
  approved.

## Routine Recovery Catalog

Agents should request one of these bounded operations instead of improvising
random shell commands:

- `check_auth(role)`
- `check_workspace(role)`
- `check_lock()`
- `check_pause()`
- `check_network()`
- `check_port(name)`
- `refresh_git_state(repo)`
- `rerun_tests(scope)`
- `capture_logs(scope)`
- `print_browser_links()`

Mission Control Core performs the operation and returns structured evidence.
That gives agents more independence without handing them unrestricted desktop
control.
