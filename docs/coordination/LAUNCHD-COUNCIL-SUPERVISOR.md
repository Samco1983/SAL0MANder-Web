# launchd Council Supervisor

This is the reviewed shape for letting macOS fire the local council supervisor.

Current status:
- A plist can be generated with `npm run council:launchd:plist`.
- The plist runs `npm run council:dry-run` behavior through Node once per hour.
- It writes stdout/stderr logs under `docs/coordination/runs/logs/`.
- It is not installed or loaded automatically.

Activation boundary:
- Do not load this until the dry-run and no-change proofs are accepted.
- Do not switch launchd to `--run-agents` until external model handoff is
  explicitly approved for the current packet shape.
- Do not put secrets, tokens, or auth files in the plist.

Manual review command:

```bash
npm run council:launchd:plist
plutil -lint docs/coordination/launchd/com.sal0mander.council-supervisor.plist
```

Later activation command, when approved:

```bash
cp docs/coordination/launchd/com.sal0mander.council-supervisor.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.sal0mander.council-supervisor.plist
```

