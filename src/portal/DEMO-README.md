# SAL0MANder Tutoring Portal — Phase 1 Demo (PR 1–PR 3)

**DEMO ONLY — fictional families, local-only storage, simulated email.** Not deployed, not connected to any real account, email service, payment provider, or model API.

## What is simulated
- **Accounts & sign-in:** Fictional seed actors (3 households, 5 children using first names only, Mr. Sam as owner+admin+mentor, Mentor B assigned to Elena's household, Mentor C unassigned). Email-link sign-in drops a simulated link into the in-app Inbox panel; zero real email is sent.
- **Consent:** Simulated verification methods (signed form scan or short verification call) with saved notice version and timestamp. Not a legal COPPA verification flow.
- **Storage & work failures:** `LocalPortalStorageAdapter` (`localStorage` key `sal0mander.portal.demo.v1` with in-memory fallback) behind `PortalStorageAdapter` so Phase 2 swaps in a real backend. Worksheet failure buttons simulate a dropped save (`Not saved, retrying…`, no loss) and an external-device edit conflict (newer wins, visible alert).
- **Drafts & policy:** Static `[Placeholder draft]` strings (zero model calls). `can(actor, action, record)` runs client-side in Phase 1 and moves server-side in Phase 2.
- **Mentor access boundary:** Mentor B/C access is fictional-data demo only until counsel reconciles mentor access (`KID-SAFETY-RULES.md` B2/B6 currently limit real access to Samuel).

## How to run the demo & Access Checks
1. **Browser:** Run `npm run dev` and open `/portal`. Switch between **Access Checks**, **Parent Account**, **Child Profile**, and **Simulated Inbox**.
2. **Automated suite:** Run `npm run test` (or `npx vitest run src/portal/`) to verify all 8 access assertions, parent account flows, child profile/worksheet persistence, and route rendering.
