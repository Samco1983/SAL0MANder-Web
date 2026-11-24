# SAL0MANder Tutoring Portal — Phase 1 Demo (PR 1–PR 2)

**DEMO ONLY — fictional families, local-only storage, simulated email.** Not deployed, not connected to any real account, email service, payment provider, or model API.

## What is simulated
- **Accounts & sign-in:** Fictional seed actors (3 households, 5 children using first names only, Mr. Sam as owner+admin+mentor, Mentor B assigned to Elena's household, Mentor C unassigned). Email-link sign-in drops a simulated link into the in-app Inbox panel; zero real email is sent.
- **Consent:** Simulated verification methods (signed form scan or short verification call) with saved notice version and timestamp. Not a legal COPPA verification flow.
- **Storage:** `LocalPortalStorageAdapter` (`localStorage` key `sal0mander.portal.demo.v1` with in-memory fallback) behind `PortalStorageAdapter` so Phase 2 swaps in a real backend.
- **Drafts & policy:** Static `[Placeholder draft]` strings (zero model calls). `can(actor, action, record)` runs client-side in Phase 1 and moves server-side in Phase 2.
- **Mentor access boundary:** Mentor B/C access is fictional-data demo only until counsel reconciles mentor access (`KID-SAFETY-RULES.md` B2/B6 currently limit real access to Samuel).

## How to run the demo & Access Checks
1. **Browser:** Run `npm run dev` and open `/portal`. Switch between **Parent Account**, **Access Checks**, and **Simulated Inbox**.
2. **Automated suite:** Run `npm run test` (or `npx vitest run src/portal/`) to verify all 8 access assertions, parent account flows, and route rendering.
