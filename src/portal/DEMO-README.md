# SAL0MANder Tutoring Portal — Phase 1 Demo (PR 1)

**DEMO ONLY — fictional families, local-only storage, simulated email.** Not deployed, not connected to any real account, email service, payment provider, or model API.

## What is simulated in PR 1
- **Accounts & sessions:** Fictional seed actors (3 households, 5 children using first names only, Mr. Sam as owner+admin+mentor, Mentor B assigned to Elena's household, Mentor C unassigned).
- **Storage:** `LocalPortalStorageAdapter` (`localStorage` key `sal0mander.portal.demo.v1` with in-memory fallback) behind the `PortalStorageAdapter` interface so Phase 2 can swap in a real server backend.
- **Email:** In-app `inbox` records inside local state; zero network sends, `.example` addresses only.
- **Drafts:** Static placeholder text (`[Placeholder draft]`); zero AI model calls.
- **Policy enforcement:** Client-side demo of `can(actor, action, record)` for demonstration and testing; Phase 2 enforces the same policy server-side on every request.

## How to run the Access Checks
1. **Browser:** Run `npm run dev` and visit `/portal`. The page runs all 7 access assertions automatically, displays `PASS`/`FAIL`, and includes an interactive **Revoke Mentor B as Mr. Sam** check.
2. **Automated suite:** Run `npm run test` (or `npx vitest run src/portal/portal.test.tsx`) to verify schema guards, `can()` rules, immediate revocation, and route rendering.
