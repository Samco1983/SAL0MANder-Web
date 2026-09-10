# Owner game-first integration direction — 2026-09-09

Samuel clarified that the current correction pass must be treated as one integrated student-game target before Teacher Studio testing resumes.

Required target:

1. Preserve the current good Samsung S24 portrait/fullscreen experience.
2. Fix the live Sample Activity Submit Answer touch failure.
3. Fix S24 landscape: all answers and Submit remain reachable, the question panel does not clip, and the puzzle uses substantially more of the available right-side space.
4. Keep Matching as a first-class public game mode and integrate it into the same player/menu/activity flow rather than leaving it as a side prototype.
5. Integrate the Sliding Puzzle (Rubik/15-puzzle-style tile sliding experience) from the current Unity draft into the game as a real selectable mode after it clears regression/runtime checks; do not leave it isolated indefinitely.
6. Preserve existing drag/re-grab/rotate/snap/replay behavior.
7. Replace weak demo/reward artwork with stronger jigsaw-suitable images: one clear focal point, high contrast, low dead space, recognizable at 9/16/25 pieces, classroom-safe/licensable.
8. Do not spend Samuel's time on Teacher Studio acceptance until the student game candidate above is ready for a focused phone retest.

Website consistency correction: public CTAs must not send users to different legacy/sample activities under nearly identical labels. `Try an activity` and `Open sample activity` should resolve to the same canonical launch demo unless the UI explicitly says the choices are different.

This direction authorizes integration work, but not destructive history rewrites, new paid services, credential widening, or unrelated architecture changes.
