# SAL0MANder Tutoring Portal — Phase 1 Demo (PR 1–PR 6)

**DEMO ONLY — fictional families, local-only storage, simulated email.** Not deployed, not connected to any real account, email service, payment provider, or model API.

## What is simulated
- **Accounts & sign-in:** Fictional seed actors (3 households, 5 children using first names only, Mr. Sam as owner+admin+mentor, Mentor B assigned to Elena's household, Mentor C unassigned). Email-link sign-in drops a simulated link into the in-app Inbox panel; zero real email is sent.
- **Consent:** Simulated verification methods (signed form scan or short verification call) with saved notice version and timestamp. Not a legal COPPA verification flow.
- **Storage & work failures:** `LocalPortalStorageAdapter` (`localStorage` key `sal0mander.portal.demo.v1` with in-memory fallback) behind `PortalStorageAdapter` so Phase 2 swaps in a real backend. Worksheet failure buttons simulate a dropped save (`Not saved, retrying…`, no loss) and an external-device edit conflict (newer wins, visible alert).
- **Ask rail & provider gate:** Text + 1 work photo placeholder ("cover your name", 30-day retention note, never uploaded). Review-first sends to parent inbox only until Forward to Mr. Sam; Auto-send requires simulated provider acceptance of the parent email first; "Simulate parent email rejected" holds questions undelivered away from mentors and sends only a content-free failure notice. Replies go to parent first and reach the child only after "Show to [name]" or opt-in auto-show (off by default, consent-gated).
- **Mentor view, Belts & Admin:** Dedicated Mentor View (`Today`, `Kids`, `Friday`, `Script library`) and admin-only `Admin` tab. Per-course belt ladders (7th grade = 7 units/stripes, belts at 2/4/6/last + live teach-it test for Black), computed stripes on reviewed work, human-only logged belt awards (never automatic), cosmetics-only points, starter badges (`First question`, `Explained it`, `Came back`), and one-sentence parent belt summary (no charts).
- **Mentor access boundary:** Mentor B/C access is fictional-data demo only until counsel reconciles mentor access (`KID-SAFETY-RULES.md` B2/B6 currently limit real access to Samuel).

## How to run the demo & Access Checks
1. **Browser:** Run `npm run dev` and open `/portal`. Switch between **Access Checks**, **Parent Account**, **Child Profile**, **Mentor View**, and **Simulated Inbox**.
2. **Automated suite:** Run `npm run test` (or `npx vitest run src/portal/`) to verify all 10 access assertions, parent account flows, child profile/worksheet persistence, Ask rail delivery gates, Mentor/Admin views, belts/badges, and route rendering.
