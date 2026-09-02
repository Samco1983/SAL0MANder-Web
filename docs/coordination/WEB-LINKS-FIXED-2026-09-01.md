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

---

# Addendum — the puzzle art is on the site

**2026-09-01, later · same PR #95**

Antigravity delivered 12 images in `assets/image_library/`, covering five
aspect ratios in a 50/50 split of illustration and photography. Ten are on the
site; six render on the home page.

## Two were rejected, and the reason matters

`panther_chameleon_rainforest` and `robot_alien_crystals` have **jigsaw cut
lines painted into the pixels** — a few hundred fake pieces baked into the
artwork itself. SAL0MANder's activities are nine pieces and Unity draws its own
edges, so either image would show a student a puzzle inside a puzzle and imply a
piece count the product does not have.

Both are named in `puzzleLibrary.test.ts`, which also asserts neither file is in
`public/`. Without that, the next person regenerating the library from the
manifest puts them straight back.

**For the next art batch:** the generation prompt must say *no puzzle piece
overlays, no cut lines, no piece outlines*. Two in twelve is a 17% waste rate
that costs nothing to avoid.

## Weight

13.9 MB of originals to **932 KB** shipped — 640px wide, WebP, quality 64. The
six on the home page total 561 KB, lazy-loaded below the fold. A test caps any
single picture at 200 KB and the gallery at 700 KB, because a class of thirty
opening the same link on school wifi is the load this has to survive.

The originals stay outside git in `assets/image_library/`. Committing 13.9 MB of
source art to a repository that already carries 87 MB Unity builds is a cost
with no reader.

## What is deliberately NOT claimed

No picture is captioned as belonging to an activity. Unity owns which image an
activity uses via `imagePresetIndex` in `CreateDemoActivity`, so "the Integer
Operations puzzle" would be a claim this repository cannot check, and it would
go stale silently the first time a preset changed. Asserted in both directions.

## Two layout bugs the tests could not see

Both found by measuring the live DOM, not by vitest:

1. Grid cells stretched to the tallest in the row — 316px cells around 175px
   landscape images, so each sat in 141px of empty background.
2. `auto-fit` produced five columns at desktop, so six pictures rendered as a
   row of five and an orphan.

Unit tests confirmed all six images were present, correct, lazy and
same-origin — and every one of those assertions passed while the section looked
broken. Worth remembering the next time a green suite is mistaken for a working
page.

## Note for whoever owns `src/routes/districts/`

`DistrictsPage.test.tsx` appeared at 20:30 today and fails:
`getByText('sal0mander.com')` matches more than one element on the page. Not
touched here — that page is on hold and someone else is actively editing it.
`npm run verify` is red until it is fixed; the rest of the suite is 81 files and
846 tests green.
