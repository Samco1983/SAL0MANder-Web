# Owner approval — SAL0MANder BBall session

Granted 2026-08-19 for `/Users/samuel_saldivar/Desktop/SAL0MANder-Web`.

This file is the durable record. An approval that lives only in a chat window
is one the next agent cannot read, and every scheduled run starts with no
memory of the conversation.

## Approved — do these without asking

- Edit this repo.
- Run tests, build, lint, typecheck, and the `mission:*` commands.
- **Commit verified changes.** Verified means `npm run verify` exited 0 — the
  exit code, not the words in the output.
- Push to the current council branch.
- Bench issues that keep failing the same way.
- Shrink a task and choose a smaller next shot.
- Write evidence into `docs/coordination/`.
- Improve the Python Championship Data layer.

Mechanically expressed in `.claude/settings.json`: 61 allow entries, every one
something an agent was actually stopped on during 2026-08-18/19.

## Not approved — stop and ask, every time

- The Unity gameplay repo, unless specifically assigned.
- Secrets, tokens, auth files, `.env`, keychain entries.
- Destructive git: `reset --hard`, `clean`, `checkout -f`, force push, rebase,
  changing the remote.
- `rm -rf`, `sudo`, `launchctl`, `security`.
- Live Make scenarios.
- **Browser OAuth approval clicks.** A script that clicks through a consent
  screen means anything reaching this machine can approve access to the owner's
  account. This one is not a policy preference; it is the reason consent screens
  exist.
- Deploy or production release.

All eleven are in the `deny` list of `.claude/settings.json`, checked against
this list rather than assumed to match.

## The standing instruction

> Build Championship Data and keep product moving. Bench repeated misses, take
> smaller shots, verify with tests, commit evidence, and do not wait for the
> owner unless secrets, destructive commands, Unity gameplay, or live Make
> changes are involved.

## Why this exists at all

The owner spent a night as the message bus — relaying `chmod`, approving a
commit, carrying a finding from one agent to another. **Eight separate
permission stops in one session**, each costing a possession. The approval
above converts that night into one decision.

The boundary that makes it safe is not trust in any agent. It is the asymmetry
in what is allowed: **everything approved is reversible** — a commit can be
reverted, a bench is a label you remove, a branch can be deleted. Everything
denied is not.
