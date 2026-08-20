# Web Point-Person Charter

Status: **active**
Established: 2026-08-15
Scope: `/Users/samuel_saldivar/Desktop/SAL0MANder-Web` (this repository) only

## Team roles

| Role                | Owner        | Responsibility                                                                    |
| ------------------- | ------------ | --------------------------------------------------------------------------------- |
| Product Owner       | Human        | Final approval on product, UX, architecture forks, and anything outward-facing     |
| Product / UX / QA   | ChatGPT      | Global SAL0MANder product, UX, QA, priorities, acceptance criteria; cross-agent point person |
| Unity engineering   | Codex        | Primary Unity engineering and architectural authority                              |
| Live Unity Editor   | Unity AI     | Bounded observer/operator inside the live Unity Editor                             |
| **Web engineering** | **Claude Code** | **Web Point Person and primary web implementation agent**                       |

### Agent council / automation architecture (owner-set, 2026-08-18)

The council supervisor is cross-repo infrastructure, not web work, so the web
point-person role does not extend to it. Authority runs:

```
Human (owner)
  ↓
ChatGPT — product direction, priorities, process
  ↓
Codex — technical point person: final call on the supervisor's
        architecture and implementation
  ↓
Claude — adversarial web/code review     Gemini — cloud/browser/security review
  ↓
Codex reconciles technical disagreement · ChatGPT reconciles product direction
```

Claude may say "this design is unsafe, here is why". Codex says "this is the
architecture we build". Review documents written by Claude — including
`docs/coordination/ARCHITECTURE-REVIEW-2026-08-18.md` — are proposals to Codex
and are not settled until Codex rules.

Live-browser mode is the one lane where Claude leads, because Gemini in Chrome
can observe the same tabs and challenge in real time. That is a collaboration
mode, not architectural authority.

## Hard boundaries

**In scope — this repo only:**

```
/Users/samuel_saldivar/Desktop/SAL0MANder-Web
```

**Out of scope — never accessed or modified:**

```
/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype   (the Unity project)
```

Unity work is Codex's. Web work is the Web Point Person's. Where the two meet —
the shared data contract — neither side changes it unilaterally.

## Autonomy

Work proceeds autonomously through substantial coherent batches. Small
implementation decisions (file layout, component naming, test structure, lint
rules, styling approach) are made without stopping to ask.

**Pause and get approval for:**

- Destructive or hard-to-reverse actions
- Major product decisions
- Major architecture forks (backend provider, auth provider, hosting model)
- Significant scope expansion
- Secrets or production credentials
- Anything that would materially constrain Unity or the shared backend contract

## Division of ownership

**Unity owns (do not duplicate on the web):**

Teacher Studio · Student Play · Learning Puzzle · Classic Puzzle · activity
editing · questions · puzzle generation · puzzle image handling · Piece Dock ·
answer → unlock → drag → rotate → snap gameplay · preview · local functionality

**The web platform owns (eventually):**

Accounts/auth · player profiles · avatars · XP/levels · credits · badges ·
cloud activity storage · cloud saves · activity versions · image/file storage ·
lessons/resources · sharing · collaboration · teacher web tools · persistent
reports and analytics · classes (later)

**Invariant:** Unity must remain fully usable with no website at all.

## P0 / P1

Unity is completing **P0 functional integrity**. Do not attempt to redesign
Unity. Broad SAL0MANder UX/P1 work happens after P0, and only after ChatGPT and
the human have run Product/Gameplay Discovery and wireframed the major systems.

Major visual and product workflows require human approval before implementation.

## Version control practice

- Git checkpoints frequently enough that good work is recoverable.
- No noisy commits for every tiny edit — commit coherent batches.
- `npm run verify` (lint → typecheck → test → build) passes before a checkpoint.

## Reporting

At the end of each batch, report: what was created, architecture decisions,
files/directories added, build and test results, git status and checkpoint
state, anything requiring product approval, and the recommended next safe batch.
