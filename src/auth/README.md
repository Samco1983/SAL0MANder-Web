# `src/auth/` — identity boundary

**No authentication provider has been chosen. That is a pending product/architecture decision.**

What exists today:

- `guestIdentity.ts` — device-local guest token for Guest Play. **Not auth.**

## Principles this boundary must preserve

1. **Guest Play is never gated.** Opening a share link and playing must never
   require an account, an email, or a name. Accounts add persistence (XP,
   credits, badges, history) — they are not an access gate.
2. **The guest token is not a credential.** It is a device-local correlation
   hint with no PII. It must never be accepted by a backend as proof of
   identity, and never sent as an `Authorization` bearer token.
3. **Guest → account is a claim, not a migration.** When a student signs up,
   their guest sessions should be claimable by the new profile. Design the
   session records so that is a later write, not a schema change.
4. **Student data minimization.** SAL0MANder is used by minors in classrooms.
   Collect nothing that isn't needed. Any future auth choice must be evaluated
   against COPPA/FERPA obligations and school-district procurement — this is a
   product/legal decision, not an engineering one.

## Open decisions (require approval)

- Auth provider / model (hosted provider vs. self-managed).
- Whether teachers and students use the same auth path.
- Whether student accounts are teacher-provisioned (likely, for K-12) rather
  than self-serve.
- Session/token lifetime and refresh strategy.
