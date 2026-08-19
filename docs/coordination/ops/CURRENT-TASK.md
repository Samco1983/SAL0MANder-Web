You are SAL0-01. Work GitHub issue #2.

TITLE:
[OVERNIGHT][WEB] Audit boot bridge + Guest Play handoff

ISSUE BODY:
GOAL:

Perform a bounded overnight audit of the current web-to-Unity boot handoff and Guest Play path at the current main checkpoint. The latest commit wired the resolved bundle into the Unity boot bridge but explicitly left the Unity GameObject/method names provisional pending Codex confirmation.

ALLOWED SCOPE:

- Read `CLAUDE.md`, `docs/CHARTER-WEB-POINT-PERSON.md`, current bridge code/tests, and relevant web docs.
- Inspect the current boot race/once-per-instance behavior, selectedPlayMode handling, error containment, and Guest Play no-account requirement.
- Strengthen tests or documentation only where the current behavior can be proven statically.
- If a safe change is justified, edit only `src/` tests/source directly related to the bridge or `docs/`.

DO NOT:

- Do not invent or hard-freeze Unity GameObject/method names. Record the exact cross-system question for Codex instead.
- Do not modify Unity, cloud infrastructure, auth, billing, dependencies, `.github`, `infra`, or environment configuration.
- Do not deploy anything.
- Do not redesign Guest Play or add account/name/email gates.
- Do not make broad P1 UI changes.

ACCEPTANCE:

- `npm run verify` passes.
- Any change is narrowly tied to boot/Guest Play reliability and includes evidence/tests.
- The report clearly separates what is verified in web tests from what still needs Codex/Unity confirmation.
- If no safe code change is warranted, produce no speculative edit and report the blocker/contract question precisely.

CROSS-SYSTEM REVIEW:

Yes. Any assumption about Unity receiver names or DTO behavior must remain review-ready for Codex rather than silently becoming a web-owned contract.

RULES:
- Work only in /Users/samuel_saldivar/Desktop/SAL0MANder-Web. Never touch /Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype.
- Read CLAUDE.md, docs/CHARTER-WEB-POINT-PERSON.md and
  docs/coordination/AGENT-DOCTRINE.md first. They bind you.
- Change code. Do not write a proposal or a plan document unless the issue
  explicitly asks for a written artifact.
- Scope: one coherent batch toward this issue. Do not start a second issue.
- Never read, print, move, or commit secrets, tokens, .env files, or auth files.
- Never run destructive git: no reset --hard, clean -fd, checkout -f, rebase,
  force push, or remote changes.
- Run `npm run verify`. It must pass. Check the exit code, not the words.
- Do not commit. The loop commits if and only if verify passes.

IF SOMETHING STOPS YOU, publish it rather than waiting. Append an entry to
docs/coordination/BLOCKERS.md in the existing format, with AUTO: yes only for
safe code changes. Then keep working on something else. Never idle.

WHEN YOU FINISH, end your reply with exactly these three lines:
ISSUE: 2
ONE THING THAT CHANGED: <what changed, or NOTHING CHANGED>
ONE THING STILL UNVERIFIED: <what you could not check>
