# Web fix — the host mis-detected fullscreen when Unity asked for it

**Scope:** web lane only. No Unity edits. No Unity binaries replaced. No deploy.
No Studio redesign (paused mid-task on the owner's instruction, nothing
half-changed left behind).

## The defect, confirmed by test before it was fixed

`useFullscreen` decided "are we fullscreen?" with an identity comparison:

```ts
setIsFullscreen(fullscreenElement() === ref.current)   // ref = the stage <div>
```

The host is not the only thing that requests fullscreen on this page. Unity's
`SetFullscreen(1)` reaches `_emscripten_request_fullscreen`, which calls
`target.requestFullscreen()` on **Unity's own canvas** — verified by reading the
shipped `sal0-unity-webgl.framework.js`, not inferred:

```
doRequestFullscreen = (target,strategy) => { ... target.requestFullscreen() ... }
```

That canvas is a **child** of the stage. So `=== ` answered *false* while the
game filled the screen. Four consequences, all student-facing:

1. `data-fullscreen` stayed false, so the stage never took its fullscreen rule.
2. The exit control stayed faded at 55%. The CSS comment already says why that
   is unacceptable: on an iPad there is no Esc key, so that button is the only
   way out.
3. The button still read "Full screen" while already fullscreen.
4. **Pressing it entered fullscreen again instead of leaving** — the toggle took
   its "not currently fullscreen" branch and requested the stage, swapping the
   fullscreen element. The student had to press twice to escape.

Two tests were written first and **both failed against the unfixed hook**, which
is the evidence that they test the defect rather than passing regardless.

## The fix

`src/unity/useFullscreen.ts` — compare with `contains`, not identity:

```ts
function ownsFullscreen(element: Element | null): boolean {
  if (!element) return false
  const active = fullscreenElement()
  return active !== null && (active === element || element.contains(active))
}
```

Used for both the state sync and the exit branch of `toggle`. `contains` is true
for the element itself, so the host's own path is unchanged.

## The regression that fix would have caused, and what stopped it

Making `isFullscreen` true for the canvas case would have applied the stage's
`width: 100vw; height: 100vh` rule while the **canvas** was the element the
browser was scaling. The canvas is `width: 100%; height: 100%` of that stage, so
on exit it would measure itself against a screen-sized box for a frame, and
Unity's canvas-size matching would take that as the new resolution — **a
screen-sized backing store on a stage that is no longer fullscreen.** That is
the "giant puzzle after coming back" shape of bug, and the fix for one defect
would have manufactured it.

So the hook now reports two separate things:

| Flag | True when | Drives |
| --- | --- | --- |
| `isFullscreen` | the stage **or anything inside it** is fullscreen | exit control stays unfaded, button label |
| `isSelfFullscreen` | the stage **itself** is the fullscreen element | the 100vw/100vh sizing rule, and nothing else |

A third test asserts they correctly disagree when Unity owns the fullscreen
element.

**Why a data attribute and not `:fullscreen`:** the first attempt used
`.stage:fullscreen, .stage:-webkit-full-screen`. Checking `dist/` showed the CSS
minifier rewrites the prefixed selector to `:fullscreen` and emits **no**
prefixed selector at all — so older Safari would have silently lost the rule,
and the output carried a duplicate. A selector list is also discarded whole when
one selector fails to parse. `data-fullscreen-self` survives minification
(verified in `dist/`), works in every browser, and is assertable in jsdom.

## Files changed — frozen

| File | Change |
| --- | --- |
| `src/unity/useFullscreen.ts` | `ownsFullscreen`, `isSelfFullscreen` |
| `src/unity/UnityStage.tsx` | emits `data-fullscreen-self` |
| `src/unity/UnityStage.module.css` | sizing rule keyed on the precise attribute |
| `src/unity/useFullscreen.test.tsx` | +3 tests |

All four were clean in git beforehand — no other agent's uncommitted work was
touched.

## Tests actually run

- `useFullscreen`: **8 passed** (was 6).
- `src/unity`: **133 passed**.
- Full suite: **911 passed, 87 files**, `tsc -b --noEmit` clean, `npm run build`
  clean.
- The two new defect tests **failed before the fix and pass after**.

## What this does NOT explain

The owner reports a giant puzzle after returning from a custom activity. The
Studio Preview tab is still a placeholder, so **there is no web preview-return
path** — nothing in the web lane implements that navigation. If the giant board
survives this fix, it is Unity-side framing or navigation, not the host.

The host's own Full screen → Esc → label round trip was confirmed correct in the
browser by the owner during this session.

## Two provenance facts for the team

1. **`public/unity/Build/` in the working tree is no longer HEAD.** Someone
   swapped in **fix-build-2** during this session (I did not):
   `wasm 70525f07 · data fedf7515 · loader 45fb1d91` — all three match
   `/private/tmp/sal0-unity-fix-build-2`. The **framing build is NOT in the
   repo**; it is still only in `/private/tmp/sal0-unity-framing-build`. That
   matches the owner's instruction to leave it alone while he verifies.

2. **When the framing build does go in, copy `framework.js` too.** fix-build-2's
   `framework.js` happens to be byte-identical to HEAD's (`a6f7fcf9`), which is
   why `git status` shows it unmodified and why the current mixed state is safe.
   The framing build's is **different** (`709af0a8`). Copying only
   `wasm`/`data`/`loader.js` next time leaves a framework/wasm mismatch — a
   failure that looks like a corrupt build rather than a missed file.

Earlier uncommitted work is intact: those twelve files were committed during the
session as `b726a43`, `43b72c8`, `5b7ecb3`. Nothing was lost.
