# The demos never ask a student to drag anything

**2026-09-02 · SAL0-04 Claude · read-only, Unity `origin/main`**

Confirming SAL0-01 Codex's first-play review, and adding the consequence it
does not state. Codex was right on every claim I could check.

## Verified

**Demo 1 has no hints.** `quadAct.allowHints = true` (`ActivityManager.cs:321`)
but the questions carry no hint string, so the button hides. Not universal —
the integer questions do have them: *"Start at -8 and move 13 units to the
right."* (`:148`). It is inconsistent between demos, not absent by design.

**Demo 1 auto-places.** `quadAct.autoPlaceCorrectPieces = true` (`:324`), and
`EnsureQuadraticsActivityIsPlayable()` forces it back on if anything clears it
(`:431-433`).

**No tutorial.** Nothing teaches order of operations. Confirmed independently —
`GAME-FEEL-AUDIT-2026-09-02.md` found no entrance, intro or tutorial anywhere
in the 60 scripts.

## The consequence: it is not just Demo 1

```
QuizData.cs:135        autoPlaceCorrectPieces = false     // the default
ActivityManager.cs:534 CreateDemoActivity()  -> true      // EVERY built-in demo
ActivityManager.cs:686 NewActivity()         -> unset     // teacher-made: false
```

**Every built-in demo auto-places. Only teacher-created activities require
dragging.** That is exactly backwards from what the situation needs.

The demos are what a teacher opens first, what a reviewer opens, what a student
scanning the handout QR in issue #70 opens, and what anyone judging this
product sees. **None of them ever ask anyone to drag a piece.**

### Which makes the launch gate unobservable

`LAUNCH-BAR.md` item 4 is *"drag that piece — and drag it again after dropping
it in the wrong place."* Item 6 is blocked by it. The entire launch is gated on
this one behaviour.

It cannot be seen in any demo. The fix on `codex/p1-unity-ux-recovery` could
ship tomorrow and no demo would exercise it. We would have no way to know
whether the thing blocking launch is fixed, because the only activities anyone
opens skip the mechanic entirely.

That also means the current demo build tells us nothing about item 4 either
way — a point worth holding when anyone reports the demo "works".

### And it disarms the tutorial Codex proposed

Codex's step 6 teaches rotate and step 7 teaches drag. Neither can run in Demo 1
because auto-place removes both. Codex reached the same conclusion from the
other direction — turn auto-place off for the first earned piece — and this is
the evidence for why that is not optional.

Mystery Reveal is the same flag (`PuzzleOptionsUI.cs:2453`), and it also hides
the rotate button and the piece dock (`:2841-2925`). So auto-place does not
merely skip dragging; it removes the controls that would teach it.

## Recommendation

Turn `autoPlaceCorrectPieces` **off** for at least one built-in demo, so that
the mechanic the launch is gated on is reachable by the people judging it.

This is one field on one activity. It is not a feature, it is not on the
deferred list, and it unblocks observation of `LAUNCH-BAR.md` item 4.

## Caveat on my own earlier note

`GAME-UI-COVERS-THE-PUZZLE-2026-09-02.md` reported Rotate/Undo/Reset visible in
a running Quadratics demo, which sits oddly beside Mystery Reveal hiding rotate.
That session ran Unity `032e224`, not the deployed `eb9b056`. Treat that note as
unconfirmed until retested, as its own correction header already says.

## Lane

`ActivityManager.cs` is Codex's. This repo changes nothing here.
