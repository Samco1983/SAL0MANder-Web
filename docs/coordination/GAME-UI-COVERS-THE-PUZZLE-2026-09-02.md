# The game runs, but the question panel covers the puzzle

> **CORRECTION, same day.** The title originally said "the deployed game."
> It was not the deployed game. This was tested against Unity `032e224`,
> the build sitting on branch `feat/three-demo-activities`. The build that
> is actually live is Unity `eb9b056` (Unity PR #29, "direct student
> launch"), shipped in web commit `5f6d4f6`. The `.wasm` and `.data`
> binaries differ. **The findings below are unconfirmed against the live
> build and must be re-tested before anyone acts on them.**

**2026-09-02.** Ran the WebGL build locally (`npm run dev` → `/unity`,
branch `feat/three-demo-activities`) and watched it load and play.

## What works

- The build loads and runs. Splash → playable in ~15s locally.
- **Zero console errors.** No missing files, no 404s, no wasm failures.
- The web host is doing its job: one `<canvas>` at full container width,
  correct devicePixelRatio (1440 CSS px → 2880 backing store at dpr 2).

Nothing here is a web-lane defect. The hosting page is fine.

## What is wrong

Everything visible on screen is inside **one Unity canvas**. So the problems
below are the Unity build's own UI, not the page around it.

1. **The question panel covers the puzzle board.** It occupies roughly the
   left three-quarters of the canvas. The board is a sliver on the right,
   mostly hidden behind the Rotate/Undo/Reset buttons.
2. **Answer options are clipped.** Option C is cut off by the "SHOW PIECES"
   bar at the bottom edge. The student cannot see all the answers.
3. **"▲ SHOW PIECES" does not respond.** Clicked it; the screen did not
   change. Either it is not wired, or its hit target is wrong.

## It is not the container shape

Tried three viewports — 800×450, 1440×900, 1100×1000. The proportions of the
overlap did not meaningfully change. Giving Unity a differently-shaped box
does not fix it, so this is not something the web host can size its way out of.

## Whose lane

Per `CLAUDE.md`, in-game UI, scaling, and reset/rotate controls belong to
**Codex** in `SAL0MANDER-Puzzle-Prototype`. The web lane must not fix this
here, and must not edit that repo. This note exists to hand Codex a precise,
reproducible report rather than "the game looks broken."

## Repro

```
git checkout feat/three-demo-activities
npm run dev
open http://localhost:5173/unity
```

Wait ~15s for the build. The overlap is visible immediately at any window size.
