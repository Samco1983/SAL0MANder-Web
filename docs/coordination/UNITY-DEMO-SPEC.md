# Unity demo spec — what the phone demo needs before handouts ship

Owner requirements, taken from a real phone on the live build, 2026-08-25.
Everything here is Unity's lane per `CLAUDE.md` (drag/rotate/reset/audio/UI
scale). Web has verified it is not the cause of any of it.

**Why this is urgent and not polish:** free printables are going out with a QR
code on them. Every handout points a teacher at this build. A first impression
of unreadable text is spent lead generation, and printables cannot be recalled
once downloaded. See `TPT-RULES.md`.

---

## 1. UI scale — 2.5x. The blocking one.

**Symptom:** on a phone, the question text, the answer choices, the "display
correct" and "reset" buttons, and the "quiz review" header are all too small to
read comfortably. Four symptoms, one cause.

**Root cause:** `Assets/Scenes/SampleScene.unity`, line 2726:

```text
m_UiScaleMode: 1                       # Scale With Screen Size — correct mode
m_ReferenceResolution: {x: 1920, y: 1080}
m_ScreenMatchMode: 0                   # Match Width Or Height
m_MatchWidthOrHeight: 0.5
```

The UI is authored against 1920x1080. A phone canvas is a fraction of that, so
every element renders at roughly half its design size.

**Fix:** for a 16:9 reference with match 0.5, the scale multiplier reduces to
`1920 / referenceWidth`.

| Reference resolution | UI scale |
| --- | --- |
| 1920x1080 (current) | 1.0x |
| 1280x720 | 1.5x |
| **768x432** | **2.5x — the owner's call** |

Check: `sqrt(1920/768) * sqrt(1080/432) = 1.5811 * 1.5811 = 2.50`.

Because it is a ratio it holds on every screen size, not only the phone it was
measured on.

**Tradeoff to verify after:** desktop grows 2.5x too and will likely look too
large on a laptop. Do not let that block the phone fix — an unreadable question
on the device students use is a defect, a chunky desktop is a preference. If it
is unacceptable, fall back to `m_ScreenMatchMode: 1` (Expand) or a runtime
CanvasScaler adjustment keyed on screen size. Prefer the single number first;
its effect is exactly predictable.

---

## 2. Question panel must scroll

**Symptom:** when question or answer text does not fit its slot, it is clipped.
The student simply cannot see the rest.

**Requirement:** overflowing content scrolls rather than clipping. This gets
*more* important after fix #1, not less — 2.5x larger text overflows sooner.

Do #1 and #2 together. Shipping #1 alone converts "too small to read" into "too
big to fit", which is not an improvement.

---

## 3. Puzzle piece controls must work in landscape on a phone

**Symptom / requirement, owner's words:** play controls where the puzzle pieces
move need to work in landscape on a phone — "not get stuck and glitch and such."

This needs a real device pass, not an editor pass. Touch drag on a WebGL canvas
in mobile Safari behaves differently from mouse drag in the editor: pointer
capture, touch-action, multi-touch, and momentum scrolling all interfere.

Web has already removed one class of interference — `UnityStage.module.css` sets
`touch-action: none` on the canvas, so the browser will not steal drags for page
scrolling. Anything remaining is inside the build.

**Acceptance:** a piece can be picked up, dragged across the board, and dropped
in landscape on a real phone, repeatedly, without sticking or dropping input.

---

## 4. Orientation — settle the board shape BEFORE locking anything

`ProjectSettings/ProjectSettings.asset`:

```text
defaultScreenOrientation: 4            # AutoRotation
allowedAutorotateToPortrait: 1         # all four orientations allowed
allowedAutorotateToLandscapeRight: 1
defaultScreenWidthWeb: 960             # landscape canvas, 8:5
defaultScreenHeightWeb: 600
```

The game auto-rotates and is not locked. The default web canvas is
landscape-shaped. The owner's concern is that the board may actually play
vertically, in which case forcing landscape clips it.

**Do not lock landscape until someone confirms the board's real aspect on a
device.** A web-side landscape lock was scoped and deliberately not built for
this reason.

Two facts for whoever picks this up:

- Orientation **cannot** be locked on iOS Safari. `screen.orientation.lock()` is
  unsupported there. The only portable mechanism is a blocking overlay that hides
  the game until the phone is turned — which is worthless until the correct
  orientation is known.
- If the answer is "landscape", web builds the rotate prompt. That is web's lane
  and is ready to go the moment the shape is confirmed.

---

## Order of work

1. **#1 and #2 together.** Scale plus scrolling. Neither is complete alone.
2. **#3.** Real phone, landscape, drag pieces until something breaks.
3. **#4.** Confirm the shape, then web adds the rotate prompt if needed.

## Acceptance for the whole demo

A teacher scans the QR on a printable, on a phone, and:

- reads the question without squinting
- scrolls to any text that does not fit
- drags puzzle pieces in landscape without sticking
- is never told to rotate into an orientation the board does not fit

Until that holds, every handout given away is spent on a first impression that
undersells the product.

---

## What web has already verified, so it is not re-litigated

- The Unity build is live and served: loader, framework, data, and wasm all HTTP
  200, ~30 MB gzipped over the wire.
- `deploy.yml` sets `VITE_UNITY_BUILD_BASE_URL: /unity` and
  `VITE_UNITY_BUILD_NAME: sal0-unity-webgl` at build time. Championship's
  `GAME DONE 0/2` reads local `.env` files and is wrong about the deployed site.
- Share links work. The HTTP 404 on a deep link is the GitHub Pages SPA fallback
  behaving correctly — `404.html` serves the full app and the router recovers the
  path.
- The student path contacts exactly one host, `samco1983.github.io`. No
  `workers.dev`, no Make, no Cloudflare Access — none of the things blocked on
  school Wi-Fi are in a student's way.
- Web is not causing the small text. `UnityStage.module.css` sizes the canvas
  `100%/100%` and defers DPI to Unity by design; nothing in `src/unity/` touches
  `devicePixelRatio`. Do not "fix" the scale by scaling the canvas from web —
  that blurs the render and hides the real defect.
