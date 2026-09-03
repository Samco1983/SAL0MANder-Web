# Black canvas in the host, standalone works — read-only triage

**No code changed.** Web files stay frozen. Findings only.

> **OUTCOME, same day — NOT REPRODUCED.** The owner reports a fresh embedded
> load renders correctly, and native Escape exits fullscreen with the canvas
> intact. The black view occurred once, during initial load combined with a
> fullscreen transition, and did not recur on a freshly loaded game. So this was
> a **transient startup-race symptom, not a standing host defect**, and none of
> the hypotheses below were confirmed. They are kept only as the ruled-out list
> and as the cheap tests to run if it ever returns. Do not cite anything below
> as a known cause.

Symptom: `sal0-unity-tested-final` runs standalone on :5177; the same artifacts
under the React host on :5173 show a black canvas after the runtime copy and a
fullscreen round trip. No runtime errors in the browser.

## Ruled OUT, each with evidence

**1. Partial or inconsistent copy — NO.** All four artifacts are byte-identical
to the source build:

```
wasm         3d95aa3cc340   data 27201101 bytes  d6d2f762e26d
loader.js    f6288d233a72   framework.js         709af0a8ac7e
```

All four match `/private/tmp/sal0-unity-tested-final/Build`. `framework.js` was
copied this time, so there is no framework/wasm mismatch.

**2. Stale server — NO.** The bytes the restarted dev server actually returns
hash identically to the files on disk, all four.

**3. HTTP caching — NO.** Vite sends `Cache-Control: no-cache` with a
`Last-Modified` and a weak `ETag` derived from size and mtime
(`W/"27201101-1788415469280"`). Both size and mtime changed with the new build,
so the browser must revalidate and gets a 200.

**4. Unity's own IndexedDB asset cache — NO.** This one looked likely and is
not. Unity caches below HTTP, so it would have bypassed the header above. Its
policy, read out of the shipped loader:

```js
cacheControl: function(e){
  return e == m.dataUrl || e.match(/\.bundle/) ? "must-revalidate" : "no-store"
}
```

Only the `.data` file is cached at all. For `must-revalidate` the loader sends
`If-None-Match` with the cached ETag and only reuses the cached copy on a 304;
where no ETag exists it issues a HEAD and compares `Last-Modified`/`ETag`. The
ETag changed, so it refetches. **The cache is working correctly — this is not
it.** Recorded because it is the obvious suspect and should not be re-checked.

## What actually differs between :5177 and :5173

Ranked, with a cheap read-only test for each.

### 1. Canvas size and aspect — the top suspect

This build's only change is camera framing, reserving a top header and a bottom
piece tray. The two environments hand Unity very differently shaped canvases:

| | Canvas |
| --- | --- |
| Standalone :5177 | `canvas.style.width = "960px"; height = "600px"` — **fixed**, aspect 1.60, ignores the window |
| Host :5173 | full-bleed, `100%` of `100dvh − 57px` — e.g. **1440×843**, aspect 1.71, and changes with the window |

The standalone is the one shape the framing was tuned against, and it is the
only shape it ever sees. If reserved bands are computed against a different
aspect, content can be pushed outside the visible frame — which renders as
black with no error, because nothing failed.

**Test (DevTools, no edits):** select `#unity-canvas` and read
`clientWidth/clientHeight` and `width/height`. A `0` in the drawing buffer means
sizing; a plausible buffer that is still black means framing, and that is Unity's
lane.

### 2. Host and standalone do not share Unity's saved state

Two independent reasons, both true at once:

- **Different origin.** `:5177` and `:5173` are separate origins, so separate
  IndexedDB. Nothing saved in one is visible to the other.
- **Different Unity identity.** Unity derives its persistent data location from
  company and product:

| | companyName | productName | productVersion |
| --- | --- | --- | --- |
| Host (`buildConfig.ts:69-71`) | `SAL0MANder` | `SAL0MANder` | `0.0.0` |
| Standalone (`public/unity/index.html`) | `DefaultCompany` | `SAL0MANDER-Puzzle-Prototype` | `1.0` |

So the host reads a **different PlayerPrefs store** than the standalone — and
that store still holds whatever older builds wrote at this origin. Unity's
Teacher Studio keeps activities in PlayerPrefs (`ActivityManager.cs:125`), so a
stale pointer to a custom activity that no longer exists in the new build is a
live possibility, and it fits both this black canvas and the earlier "giant
puzzle after returning from a custom activity".

**Test (cheapest of everything, do this first):** DevTools → Application →
IndexedDB on `localhost:5173` → delete the Unity databases → hard reload. If the
game comes back, it was stale persisted state, not the build.

Note `productVersion` is hardcoded `'0.0.0'` in the host and never changes
between builds. That is worth revisiting later, but it is not the cause here —
see ruled-out item 4.

### 3. WebGL context loss across the fullscreen transition

The symptom is "after ... fullscreen", and a lost WebGL context is black with
**no console error** — the browser fires a `webglcontextlost` event instead.

`grep` across `src/unity/` finds no `webglcontextlost`, `contextrestored`, or
`preserveDrawingBuffer` handling: the host cannot currently tell a lost context
from a healthy one, so a student would see black and be told nothing.

**Test:** in the console before going fullscreen —

```js
document.getElementById('unity-canvas')
  .addEventListener('webglcontextlost', () => console.log('CONTEXT LOST'))
```

— then repeat the fullscreen round trip. Also worth knowing: does the black
canvas happen **without** ever entering fullscreen? That single answer splits
hypothesis 3 from 1 and 2.

## Recommendation

Run test 2 first (clear IndexedDB — seconds, reversible), then test 3's "does it
happen without fullscreen at all", then test 1.

I have changed nothing and propose nothing until one of these confirms. If it
turns out to be context loss, the host fix is a listener that reports it instead
of showing silent black — that is genuinely web-lane, and I will not write it
without your go-ahead.
