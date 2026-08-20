# Puzzle content production mix

**Owner decision, 2026-08-20.** Recorded here because the previous version of
these percentages was lost and reconstructed from memory. Losing it once is the
reason it now lives in the repository instead of a chat scroll-back.

## The mix

| Share | Category | Notes |
| ---: | --- | --- |
| **30%** | Cute animals / pets | cats, dogs, baby animals |
| 15% | Fantasy / adventure | dragons, castles, magical worlds |
| 15% | Space / science | planets, astronauts, rockets |
| **15%** | **Bonus crossover** | two themes combined |
| 10% | Nature / scenery | oceans, forests, waterfalls |
| 10% | Sports / vehicles / action | |
| 5% | Seasonal / holiday | |

**Produce cute animals first.** They carry across age groups and subjects, so
they are the safest volume. **Space and fantasy make the strongest marketing
screenshots** — highest "wow" per image — so they are the ones to show, not
necessarily the ones to make most of.

## Bonus crossover pictures

Two popular themes in one image. They read as original rather than stock, which
makes them feel collectible:

- Cat astronaut in space
- Dog superhero over a city
- Dragon playing basketball
- Animals exploring an underwater castle
- Robot teacher with animal students
- Dinosaur driving a race car
- Space-themed sports stadium
- Fantasy creatures running science experiments

**The mechanic:** the crossover image is what a student *earns* by finishing the
puzzle or activity. That is the one part of this that touches the web repo —
an unlock is a result, and results already flow through the companion. Everything
else here is Unity-lane content.

## Where the current packs actually sit

Six packs exist in `docs/coordination/assets/`. Against the mix above:

| Category | Target | Existing packs | Gap |
| --- | ---: | --- | --- |
| Cute animals / pets | 30% | `pet-classroom` | **under-produced — the largest category has the fewest packs** |
| Fantasy / adventure | 15% | `crystal-cave`, `desert-ruins` | roughly on target |
| Space / science | 15% | `space-lab` | on target |
| Bonus crossover | 15% | — | **none exist** |
| Nature / scenery | 10% | `ocean-reef`, `jungle-discovery` | **over-produced — 33% of packs against a 10% target** |
| Sports / vehicles | 10% | — | none exist |
| Seasonal / holiday | 5% | — | none exist |

**The correction is the opposite of intuition:** nature reads as the safe,
easy category and it is the one to stop making. Animals is both the largest
share and the thinnest coverage, and it is also the one the owner wants first.

## Constraints that do not move

Inherited from the existing manifests and restated because content work is
where they get quietly dropped:

- Prompts only in this repo. No generated image files are committed here.
- No copyrighted characters, no logos, no realistic child faces, no photoreal
  school children, no scary violence.
- Rights must be verifiable per asset. An image shipped to a classroom with an
  unchecked licence is not a cheap mistake.
- Unity import path, dimensions, compression, and Addressables labels are
  Unity-lane approval, not web.

## Blocked on

**B-10 — Gemini is unreachable** (`API_KEY_INVALID`). Re-probed 2026-08-20 and
still failing. Note also that the Gemini CLI is a *text* agent: it can write and
refine prompts and check licensing, but it does not produce image files. The
generation step needs a different tool than the seat that is currently benched.
