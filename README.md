# SAL0MANder Web

The **cloud companion platform** for SAL0MANder.

The SAL0MANder Unity application is a complete, self-contained product. It owns
Teacher Studio, Student Play, Learning Puzzle, Classic Puzzle, activity editing,
questions, puzzle generation and imagery, the Piece Dock, and the whole
answer → unlock → drag → rotate → snap loop.

This repository is everything *around* that: accounts, profiles, cloud activity
storage and versioning, media/CDN, share links, lessons and resources, teacher
web tools, and reporting.

**Two rules govern this repo:**

1. **Unity must remain fully usable without this website.**
2. **Do not duplicate Unity gameplay here.**

## Quick start

```bash
npm install
cp .env.example .env.local   # optional; sensible defaults work offline
npm run dev                  # http://localhost:5173
```

No backend is required. With `VITE_API_BASE_URL` empty (the default) the app
runs against an in-memory mock transport that speaks the real contract.

## Scripts

| Script                  | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Vite dev server                                     |
| `npm run build`         | Typecheck + production build to `dist/`             |
| `npm run preview`       | Serve the production build locally                  |
| `npm run lint`          | oxlint                                              |
| `npm run typecheck`     | `tsc -b --noEmit`                                   |
| `npm run test`          | Vitest (jsdom + Testing Library)                    |
| `npm run test:coverage` | Vitest with v8 coverage                             |
| `npm run format`        | Prettier write                                      |
| `npm run verify`        | lint → typecheck → test → build (use before commit) |

## Stack

Vite 8 · React 19 · TypeScript 6 · React Router 7 · Zod 4 · Vitest 4 · oxlint ·
Prettier. CSS Modules over a design-token layer — no CSS framework, so the
eventual SAL0MANder visual identity is not pre-committed.

**No backend, auth, database, or storage provider has been chosen.** Every such
seam is an interface with a local stand-in behind it. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Project structure

```
src/
  app/          Composition root — providers, router, route-level error boundary
  routes/       Route surfaces (home, guest-play, profile, unity, not-found)
  components/
    layout/     AppShell, CompanionLayout (the optional 42/58 split), ThemeToggle
    ui/         Token-consuming primitives (Button, Card, PlaceholderNotice)
  design/       Design tokens (CSS custom properties), base reset, theme control
  unity/        Unity WebGL host surface, build config, Unity↔Web bridge (stub)
  api/          API client boundary — transport interface, endpoints, mock backend
  contracts/    Versioned shared SAL0MANder data contract (Zod schemas) — DRAFT
  storage/      Media storage abstraction (memory | signed-URL HTTP)
  auth/         Guest identity. Not authentication — see src/auth/README.md
  config/       Validated env access, canonical route paths and share links
  lib/          Shared utilities
  test/         Test setup
docs/           Architecture, charter, decisions, roadmap
```

Import via path aliases (`@api`, `@contracts`, `@design`, …), not deep relative
paths. Aliases are declared in `vite.config.ts` and mirrored in
`tsconfig.app.json`.

## Guest Play

The distribution path this platform is built around:

> Teacher publishes an activity → gets a stable share link → sends it via TPT,
> Google Classroom, an LMS, or a QR code → student opens it → **plays
> immediately, with no account.**

Try it locally: <http://localhost:5173/play/demo-activity>

Guest Play is a hard requirement, not a convenience. A student must never be
asked for an email, a password, or even a name in order to open a shared
activity. Accounts add persistence (XP, credits, badges, history) on top of
play — they never gate it.

## Documentation

- [`docs/CHARTER-WEB-POINT-PERSON.md`](docs/CHARTER-WEB-POINT-PERSON.md) — roles, scope, and decision boundaries
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, boundaries, scale posture
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decision log (what was decided, and what deliberately was not)
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — batch plan and what is explicitly deferred
- [`src/contracts/README.md`](src/contracts/README.md) — contract versioning rules
- [`src/auth/README.md`](src/auth/README.md) — identity boundary and open questions

## Boundaries

This repository does **not** touch the Unity project. Unity engineering and
architecture are owned by Codex. Gameplay stays in Unity; if a feature would
require re-implementing puzzle logic on the web, it is out of scope here.
