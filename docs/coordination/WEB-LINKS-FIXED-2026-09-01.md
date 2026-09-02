# The links work — what changed, and what is still broken

**2026-09-01 · web lane · PR #95 · not deployed**

## What was wrong

Three separate things, none of which looked wrong on screen.

**1. Two of the three activities had no link anywhere on the site.** The home
page offered a single action pointing at a generic demo id. Unity ships
`act_integer_operations`, `act_one_step_inequalities` and
`act_linear_equations`. A teacher could not reach two of them.

**2. Every share link returned HTTP 404.** GitHub Pages cannot rewrite URLs, so
a client-side route is served the SPA shell with a 404 status. It renders
perfectly for a student — which is precisely why this went unnoticed — and reads
as missing to every crawler and filter classifier that checks the status code.
On a domain already categorised "Unknown", that matters.

**3. Unity ran behind the error screen.** An unknown activity id showed "We
couldn't find that activity" while the Unity stage mounted and ran anyway.

## What changed

The activity cards are rendered **from `MOCK_DEMO_ACTIVITIES`**, not written out
by hand. Two separate drafts of this work named the ids wrong in two different
directions — `act_integer_ops` in one, the old seeded set (`act_quadratics`,
`act_cell_structure`, `act_vocab_review`) in another — and neither mistake
failed a single test, because a hardcoded string on a page is checked against
nothing.

The three activity URLs are listed in `sitemap.xml`, which is what
`prerender-routes.mjs` derives its file list from, so each now gets a real file
and a 200.

`state.status === 'error'` gates the Unity mount. Gating on `!boot` instead
breaks the handshake — it unmounts and remounts when the bundle arrives.

## Verified in a browser, not only under vitest

| Check | Result |
| --- | --- |
| `/play/act_one_step_inequalities` | "One-Step Inequalities", version `act_one_step_inequalities-v1` |
| `/play/act_linear_equations` | "Linear Equations" |
| `/play/act_integer_operations` | "Integer Operations" |
| `/play/act_integer_ops` (wrong id) | error screen, **0 canvases, 0 loader scripts** |

`npm run verify`: 80 files, 835 tests, build green.

## What this does NOT fix

**The game still does not work.** PLAY does not start, answers cannot be
selected, and the A−/A/A+ controls are absent. That is the deployed Unity
build, not the wrapper, and it is Codex's lane. These links open a broken game
faster and more correctly than before; they do not make it playable.

## The merge decision

Merging deploys. The build on the site predates the reconciled student runtime,
so it does not know these three ids.

Arguments for merging now: the deployed game is already broken at the one link
the home page offers today, so three links to the same broken game is not a
regression — and the 200 statuses help the filter-categorisation problem, which
is actively blocking classroom access right now.

Argument against: the web and Unity halves have never been reviewed together,
and that is exactly how B-11 shipped.

Owner's call. `RUNBOOK-SHIP-A-UNITY-BUILD.md` has the sequence.
