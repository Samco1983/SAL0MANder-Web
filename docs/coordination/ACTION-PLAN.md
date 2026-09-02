# Action plan

**2026-09-02 · gated: do not start a step until the one above is verified**

---

## STEP 1 — Ship what is already built · TODAY · owner + Codex

**Owner, 10 seconds:**

```bash
gh pr merge 95 --squash --delete-branch
```

Three activities, links that resolve 200, puzzle art, visible scrollbars, the
Unity-behind-a-404 fix. 855 tests green, MERGEABLE.

**Owner:** send Codex `DIRECTIVE-CODEX-2026-09-02.md`.

**Codex:** audit (wrong branch, 22 uncommitted files) → merge #23 → close #22 →
rebuild WebGL from #23 → hand over four files per the runbook.

**Done when:** `sal0mander.com/play/act_integer_operations` loads a puzzle a
student can finish. Not "the build succeeded" — finish an activity yourself.

## STEP 2 — Use it with a real class · THIS WEEK · owner

One period. Your own students. Your own network. A real lesson, not a demo.

Watch for, and write down as it happens:

- how long the first load takes with the whole class starting at once
- whether anyone cannot start, and what they saw
- whether students understand what to do without being told
- whether the picture actually motivates them, or they ignore it
- what they say when they finish

**This step is not optional and cannot be replaced by more design.** Everything
specced on 2026-09-02 — piece cost, tutorial, reward timing, arcade feel — is a
guess until a real class has used the real thing. Forty minutes of watching
beats eight documents.

**Done when:** you have a written list of what actually broke or confused.

## STEP 3 — Fix only what step 2 exposed · owner decides scope

Not the backlog. Not the good ideas. The list from the lesson.

If the list is short, go to step 4. If something on it makes the activity
unusable, that is the whole sprint.

## STEP 4 — Unblock the domain · in parallel, owner only

Nobody else can do these.

- **Lightspeed**, 1-877-447-6244, central time. Identify as the site owner
  requesting categorisation, not as a teacher requesting access.
- Submit `sal0mander.com` to **Securly**, **Cisco Talos**, **FortiGuard**.

Category to request: **Education / Educational Games**.

**Do not send Antigravity's filter report.** It claims COPPA/FERPA compliance,
which is unsupported, and claims zero puzzle cut lines, which is false. Use the
live `/privacy`, `/terms` and `/about` pages instead — every claim on them is
backed by the code.

**Done when:** the site opens on a school-network device.

## STEP 5 — One TPT listing · after steps 1-4 · owner

**One** activity, one subject, finished properly. Not a bundle.

The link in the listing must work — a broken linked resource can deactivate the
product and refund buyers.

**Done when:** a stranger buys it, uses it, and does not ask for a refund.

## STEP 6 — Then build the designed features · Codex, informed by step 2

In this order:

1. **Piece count `else` bug.** Live now — any count outside `{4,6,9,12,16}`
   silently renders 3x3. Small, and it is shipping today.
2. **Contrast.** White on the `CONTINUE` green is 1.21:1.
3. **Reward modal out**, inline snap in.
4. **Mystery Reveal** named as an Activity Type. Engine support already exists.
5. **Undo redesign** — replay from an answer log. Prerequisite for anything
   below it.
6. **Piece cost + auto-assign.** The constraint-remover. Needs 5 first.
7. **Tutorial**, derived from activity options.

Items 1-4 are small and independent. 5-7 are the real work and should wait for
what step 2 teaches.

## Open decisions that gate nothing yet

Answer when they become relevant, not before:

| Decision | Becomes urgent when |
| --- | --- |
| Teacher Studio: Unity or web | Codex has capacity after the rebuild |
| Backend and auth provider | Teachers need to share activities between devices |
| Media storage for custom images | Custom upload is switched on — currently gated |
| Accuracy %, timer direction, text size | Step 2 tells you whether students care |

---

## Who is blocked on what, right now

| | Blocked on |
| --- | --- |
| **Owner** | nothing — step 1 is a single command |
| **Codex** | the directive being sent |
| **Web lane** | the Unity build artifact |

Everything in this repository is finished and waiting. The only thing standing
between today and a working product is two merges.
