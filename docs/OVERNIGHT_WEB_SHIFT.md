# SAL0MANder Web Overnight Shift

## Purpose

Allow bounded website work to continue while Samuel is offline without automatic merges, deployments, cloud mutations, or changes to the Unity repository.

## Roles

- **Claude Code:** web implementation worker for trusted overnight queue issues.
- **Gemini:** independent cloud/cross-system reviewer of Claude overnight draft PRs.
- **Codex:** Unity/game authority and required reviewer when a web change touches a Unity-facing contract or bridge assumption.
- **ChatGPT:** product/UX/QA coordination and cross-system product resolution.
- **Human owner:** merge/acceptance for meaningful changes and any difficult-to-reverse choice.

## Queue

Only open issues in this repository that are authored by `Samco1983` and whose title contains:

`[OVERNIGHT][WEB]`

are eligible for the unattended Claude worker.

One issue is handled per run, oldest first.

## Worker guardrails

Claude must read `CLAUDE.md` and `docs/CHARTER-WEB-POINT-PERSON.md` first.

The unattended publisher permits only changes under:

- `src/`
- `docs/`

It rejects changes to `.github/`, `infra/`, dependency manifests, environment/credential files, or other paths.

Before a draft PR can be published, `npm run verify` must pass.

The worker may not:

- merge or deploy;
- alter billing, secrets, cloud resources, production systems, or provider configuration;
- modify or clone the Unity repository;
- duplicate Unity gameplay logic in React;
- gate Guest Play behind account, email, name, or password requirements;
- import provider SDKs directly into feature code instead of using approved transport/storage boundaries;
- freeze shared cross-client contracts unilaterally;
- claim live Unity, cloud deployment, or production verification that did not happen in the runner.

## Review

A successful Claude change is pushed to an `agent/claude-web-overnight-*` branch and opened as a **draft pull request**.

Gemini then performs a read-only review focused on cloud/API/media boundaries, privacy/auth/moderation/idempotency concerns, Guest Play behavior, provider coupling, cross-system drift, tests, and unsupported runtime claims.

Gemini does not edit files in the review workflow.

## Merge policy

There is **no automatic merge**.

A draft PR must remain for daytime/human review. Changes that affect Unity-facing bridge names, DTO shape, public API behavior, asset semantics, or other shared contracts also require Codex/cross-system review before merge.

## Cost control

The workflows do nothing when no trusted queue issue or eligible draft PR exists. Anthropic and Gemini API usage is therefore task-driven rather than an open-ended autonomous loop.

## Live/production boundary

The overnight web shift is source-code automation only. Production deployment, backend/cloud resource creation, secrets rotation, billing changes, and live Unity Editor work remain outside the unattended workflow.
