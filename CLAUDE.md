# SAL0MANder Web — working notes

> **Before starting work, read
> [`docs/coordination/STATUS.md`](docs/coordination/STATUS.md) and
> [`docs/coordination/MIRROR-PROTOCOL.md`](docs/coordination/MIRROR-PROTOCOL.md),
> verify the mirror's source commit against GitHub, and follow GitHub whenever
> they disagree.**
>
> **The Doc shows. GitHub decides.**

Then read [`docs/CHARTER-WEB-POINT-PERSON.md`](docs/CHARTER-WEB-POINT-PERSON.md).
It defines roles, scope, and what requires approval.

## Repo split (owner-set, 2026-08-15)

| Repo | Owner | Job |
| --- | --- | --- |
| `/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype` | **Codex** | Learning Puzzle game, Teacher Studio game flow, drag/rotate/reset/audio/UI scale |
| `SAL0MANder-Web` (this repo) | **Claude / Gemini / ChatGPT** | Website, Guest Play, share links, cloud companion, hosting page, web wrapper |

The Unity repo is also the shared coordination hub
(`Samco1983/Sal0mander-Jigsaw-Puzzle`). Its `docs/` is the versioned shared
contract — **read-only reference for web work**:

```
/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype/docs/
```

Read those before filing contract deltas. Never write there. Do not clone a
second copy of either repo — one source of truth.

## Non-negotiables

1. **Write in this repo only.** Never modify
   `/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype`. Unity is Codex's;
   its `docs/` are readable, nothing there is writable.
2. **Don't duplicate Unity gameplay here.** If a feature needs puzzle logic on
   the web, it is out of scope.
3. **Guest Play is never gated.** No account, email, password, or name prompt on
   the path from a share link to playable content.
4. **The Unity stage never unmounts** because of a layout change. Collapsing the
   companion panel must not restart a student's game.
5. **No secrets in this repo.** Every `VITE_`-prefixed variable is public and
   ships in the bundle. Secrets belong to a future server/edge function.

## Before committing

```bash
npm run verify    # lint → typecheck → test → build
```

## Conventions

- Import via path aliases (`@api`, `@contracts`, `@design`, `@unity`, …), not
  deep relative paths. Declared in `vite.config.ts`, mirrored in
  `tsconfig.app.json` — update both together.
- Components consume **semantic** design tokens (`--color-surface`), never
  primitives (`--neutral-700`). A rebrand should touch only `design/tokens.css`.
- Contract types are always `z.infer` of a schema. Never hand-write a type
  alongside its schema.
- `src/contracts/v1/` is frozen once Unity ships against it. Breaking changes
  create `v2/`.
- New backend capability goes behind the `Transport` / `MediaStorage`
  interfaces, never a provider SDK imported into feature code.
- Placeholder surfaces use `<PlaceholderNotice>` so "not designed yet" is never
  mistaken for finished work during review.

## Current state

Foundation only. No backend, auth provider, storage provider, or hosting target
has been chosen — see `docs/DECISIONS.md` for what is deliberately deferred.
The app runs against an in-memory mock transport by default.
