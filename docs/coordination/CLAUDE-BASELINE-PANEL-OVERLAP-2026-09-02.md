# Claude baseline — served artifact provenance + host sizing (panel overlap issue)

Role per `PUZZLE-PANEL-SHARED-PLAN.md`: identify the exact served artifact and
its provenance; measure the web container and fullscreen behavior; identify any
host contribution to the overlap. **No edits to source. No deploy. Unity not
touched.** All uncommitted work in both trees preserved.

## 1. Served artifact — proven at the byte level

A dev server was already running (PID 2848, 127.0.0.1:5173) — presumed another
agent's. It was **not** restarted or killed. Only read-only GETs were issued.

| File | HTTP | Bytes | git hash of served bytes | Branch blob at HEAD | Match |
| --- | --- | --- | --- | --- | --- |
| `.wasm` | 200 | 65579133 | `a9b333d0d2bddf0bcafbe80cf77e8d9b7f003914` | same | yes |
| `.data` | 200 | 27195332 | `dff08c2909772fd25933c9cfbc4ca2ed642cf871` | same | yes |
| `.loader.js` | 200 | 26982 | `80f1fd68c9ea50a98adf0aaa9fef66db11d82e4a` | same | yes |
| `.framework.js` | 200 | 435298 | — | — | size match |

The running host serves **exactly** this branch's checked-in artifacts. No
working-tree drift: `git status` shows `public/unity/` clean, and the build
files are tracked (not gitignored — `git check-ignore` exit 1).

Provenance chain: artifacts came in at web commit `ee0a326`, titled
"web: ship Unity 032e224 WebGL build".

**Limit, stated plainly:** "032e224" is a claim in a commit message. Nothing on
the web side proves which Unity source revision produced these bytes. Only
Codex can close that, from the Unity repo and build log. Unity source SHA =
**unknown** from here.

Main's build commit is `5f6d4f6` ("deploy: ship Unity main eb9b056") and its
data/wasm blobs differ from this branch's. That is a repository fact. It is
**not** proof of what production currently serves — this environment has no
network access and no live download was performed.

## 2. Host sizing — the box the web page hands Unity

Computed from the CSS box model in source, **not yet browser-measured**.

Route `/unity` renders `AppShell fill` → `CompanionLayout defaultCollapsed`
→ `UnityStage`.

- Shell: `height: 100dvh; overflow: hidden` (page cannot scroll).
- Header: `min-height: 3.5rem` (56px) + 1px bottom border = **57px**.
- Footer: **not rendered** when `fill` is set.
- Companion collapsed: `grid-template-columns: 0 100%` above 60rem; below
  60rem a single column with the companion off-screen as a bottom sheet.
- Canvas: `width/height: 100%` of the stage. The host sets **no** width/height
  attributes and does **no** DPR math — Unity's loader owns the backing store.

Resulting canvas box:

| Viewport | Canvas CSS box | Aspect | Host chrome cost |
| --- | --- | --- | --- |
| 1440 × 900 | 1440 × 843 | 1.708 | 6.3% height, 0% width |
| 390 × 844 | 390 × 787 | 0.496 | 6.8% height, 0% width |

**Reading:** the host gives Unity the full width and all but 57px of height.
The header is a real but minor vertical cost. It is not large enough to
explain a panel occupying three-quarters of the canvas, and it cannot explain
an overlap whose proportions stay constant across viewports — the host box
changes shape with the window. That points inside the canvas, not at the page
around it.

## 3. Host elements that DO sit on top of the canvas

Two, both host-owned:

1. **Companion toggle** (`CompanionLayout.module.css`, `z-index: 200`).
   At **≤75rem (1200px)** it becomes a 44×44px circle, `rgb(0 0 0 / 72%)`,
   pinned `top: 8px; left: 50%` — **opaque, top-centre, over the canvas**.
   On a 390×844 phone this covers the top-centre of the Unity view, which is
   where a question header would sit. Small, but a genuine host contribution
   to crowding at narrow widths. Above 75rem it is a labelled button at
   top-left instead.
2. **Fullscreen control** (`UnityStage.module.css`, `z-index: 1`), bottom-right,
   55% opacity until hover/focus, always opaque while fullscreen.

Neither can cover three-quarters of the board. Report them as contributors at
narrow widths, not as the cause.

## 4. Confirmed web defect — the `/unity` URL resolves to two different hosts

`public/unity/index.html` is **tracked** (not ignored) and is Unity's own
standalone template — `<title>Unity Web Player | SAL0MANDER-Puzzle-Prototype</title>`,
5677 bytes. It therefore ships into `dist/` as `dist/unity/index.html`
(confirmed present, 5677 bytes, alongside `dist/index.html` at 6985 bytes).

The React route `/unity` is also declared (`routes.ts:28`, wired at
`router.tsx:87`).

- **Vite dev:** `/unity` returns the SPA shell (6817 bytes, React refresh
  preamble present) — the React host wins. Verified by GET.
- **Static hosting:** the SPA fallback is `404.html`, which by definition only
  fires when no file exists at the path. `dist/unity/index.html` **does**
  exist, so `/unity/` is answered by Unity's standalone template and the React
  host page is shadowed.

**Why this matters for this issue, not as separate work:** the template hard-codes

```js
} else {                              // desktop user agent
  canvas.style.width  = "960px";
  canvas.style.height = "600px";
}
```

A canvas locked to 960×600 does not resize with the window. That is a
*separate and sufficient* explanation for "the proportions of the overlap did
not meaningfully change across three viewports." Two agents typing the same
URL can therefore be looking at two different containers — full-bleed vs
fixed 960×600 — and reach contradictory conclusions about sizing.

**Scope discipline:** flagged, not fixed. Any change here touches the web
lane's own files and is not authorised by the current plan. Raising it now so
the team fixes the *measurement* before arguing about the *cause*.

**Honesty limit:** proven from repository and build artifacts plus documented
static-host resolution rules. No live site was fetched — this environment has
no network. Not a claim about what production serves right now.

## 5. What I did not do

- Did not run a browser; §2 numbers are computed, not measured.
- Did not restart, rebuild, or replace any artifact while another agent's dev
  server was live.
- Did not edit Unity, did not edit web source, did not commit, did not deploy.
