# Is this repo safe to make public?

**Checked 2026-08-20.** Written because "enable GitHub Pages" is blocked on a
paid plan *only because the repo is private*. Public repos get Pages free, so
the real question is not cost — it is whether going public exposes anything.

## Security: nothing found

| Check | Result |
| --- | --- |
| API keys / tokens / private keys in tracked files | none |
| `.env` committed | only `.env.example`, a template with no values |
| Credential-shaped filenames | none — `src/design/tokens.css` is *design* tokens |
| Email / personal data | none beyond `noreply@` and `example.` |
| Git history, not just HEAD | no sensitive filename ever committed |

The last row matters most: a secret removed from HEAD still lives in history,
and going public exposes history. Nothing was found there either.

**The 19 `VITE_*` variables are already public.** Every one ships inside the
JavaScript bundle that any visitor downloads. A private repo never protected
them, which is exactly why `CLAUDE.md` non-negotiable #5 says secrets do not
belong here.

## What going public *would* expose, and it is not a secret

`docs/coordination/` — 138 files, roughly 21087 lines. That is the
operating doctrine, the agent playbooks, the scoring analysis, the blocker
history, and the content production mix with its business priorities.

None of it is a credential. All of it is **how you run the operation**: which
categories to produce first, what the agents get wrong, how the team is
measured. A competitor could read it.

That is a business judgement, not a security one, and it is the owner's alone.

## Three ways forward

1. **Make the repo public.** Pages becomes free immediately. Costs nothing in
   secrets; publishes the operating doctrine.
2. **GitHub Pro, repo stays private.** $4/month. Nothing is exposed. Note the
   published *site* is public either way — Pages sites always are.
3. **Move `docs/coordination/` to a private repo, then go public.** Keeps the
   doctrine private and Pages free. Costs one migration and splits the evidence
   trail away from the commits it refers to, which is most of its value.

**No agent can make this call.** It is an account, a wallet, or a disclosure
decision. What was in reach was removing the security question from it, and
that is now answered: there is nothing to leak.
