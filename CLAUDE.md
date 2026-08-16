# SAL0MANder Web — working notes

Read [`docs/CHARTER-WEB-POINT-PERSON.md`](docs/CHARTER-WEB-POINT-PERSON.md)
first. It defines roles, scope, and what requires approval.

## Non-negotiables

1. **This repo only.** Never touch `/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype`
   (the Unity project). Unity is Codex's.
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
