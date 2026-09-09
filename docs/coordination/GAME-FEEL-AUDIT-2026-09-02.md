# Does it feel like a game? Read against the code, not the vibe

**2026-09-02 · SAL0-04 Claude · read-only audit of Unity `origin/main`**

Owner asked: does this play professional — sound, music, correct-answer feel,
an entrance when the first question lands, hints, does it earn points and feel
addictive; and should the demo offer modes and puzzle sizes.

Every claim below is from the source. Nothing is impression.

## Sound: it is all synthesized at runtime, and it always will be

`PuzzleManager.cs` declares seven sounds — rotate, drag whoosh, snap, fail,
correct chime, unlock pop, voice complete (`:50-56`).

**None of them are recordings.** Each is generated in C# at startup with
`AudioClip.Create` and hand-written DSP — sine stacks, exponential envelopes,
seeded noise. The correct chime (`:431`) is built from an F7 and C8 ring with a
120x decay envelope. There are roughly 600 lines of synthesis in this file.

The entire repository contains **two** audio files, and one is a generated
blob:

```
Assets/Audio/Voice_Complete.wav
GeneratedAssets/55410657.../019f38a8-....wav
```

### Defect: the one real recording never reaches a student

`PuzzleManager.cs:575-585`:

```csharp
else
{
#if UNITY_EDITOR
    voiceCompleteClip = UnityEditor.AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/Voice_Complete.wav");
#endif
}
```

`UNITY_EDITOR` is not defined in a WebGL build, so that line is compiled out.
Unless `voiceCompleteSound` is wired in the Inspector, every web player falls
through to the synthetic formant voice below it. The only real audio asset in
the project plays in the editor and nowhere else. **That is why it sounds
synthetic — it is, and on the web it cannot be anything else.**

## There is no music

No `AudioSource` loops anything. The only `loop = true` in the codebase are
four `LineRenderer` calls for visual glow (`PuzzleManager.cs:747, :2091`,
`PuzzlePiece.cs:278`, `RotationGizmo.cs:68`). No ambient bed, no menu theme,
no completion sting.

Silence is the default state of this game between sound effects.

## Nothing is earned

There is **no score, no points, no coins, no streak, no stars**. No such field
exists in any script.

The one thing resembling a combo is `comboSnapCount` (`:101, :1824-1836`):
consecutive fast snaps raise playback **pitch** by 0.08 per step, capped at 6.
It is audio feel only. It is not displayed, not accumulated, not persisted, and
not spendable.

So, answering the question directly: **it does not earn points and there is no
loop to be addicted to.** The reward is the picture reveal —
`RevealUnlockedImageSection`, 0.70s (`PuzzleOptionsUI.cs:4426-4436`), with the
comment "the board remains the reward surface." That is a deliberate design and
it is a *satisfying* one, but it is a single reward repeated, not a progression.

## What is already good

- **Hints work.** `allowHints` per activity, `hintText` per question, a
  `[Show Hint]` toggle (`PuzzleOptionsUI.cs:3102`).
- **Combo pitch escalation** is genuine game feel and most prototypes lack it.
- **The reveal-as-reward decision is right.** The picture is the payoff.
- **The silent-3x3 bug is fixed.** `PuzzleManager.cs:2292` now errors and
  returns on an unsupported count instead of quietly drawing 3x3. The
  `LAUNCH-BAR.md` defect list can drop that line.

## No entrance

Nothing animates the first question in. No intro, no deal-in, no tutorial —
searched for entrance/intro/fade-in/tutorial across all 60 scripts. The first
question simply exists.

## Modes and sizes already exist

`ReleaseMode` (`QuizData.cs:12`): `QuestionDriven`, `ManualPreview`,
`AllUnlockedIndependent`.
`QuestionMappingPolicy` (`:19`): `SequentialQueue`, `RandomQueue`,
`ExplicitIndexMap`.
Piece counts: **4, 6, 9, 12, 16**, each with portrait/landscape variants,
default 9 (`PuzzleManager.cs:2300-2312`).

### Recommendation: the demo should expose neither

This is the owner's own rule from `LAUNCH-BAR.md`: *would a teacher change this
for a specific lesson? If not, it has a default and does not appear.*

Mode and piece count are **teacher** decisions made in Teacher Studio, not
student decisions made at the door. A student opening a share link should meet
a board, not a settings screen. "Choose your own mode" in front of a student
adds a decision before the first question and directly contradicts "not a
million options."

Keep 9 as the demo default. Let the teacher pick the size when they build the
activity.

## Sequencing — this is the uncomfortable part

`LAUNCH-BAR.md` (commit 484bae9) explicitly defers **arcade juice, reward
timing, the tutorial, piece cost, and the coin display** behind six things, and
item 4 — drag and re-drag after a wrong drop — is still not in the deployed
build.

Most of what this audit describes as missing is on that deferred list *by the
owner's own instruction*. A game that sounds gorgeous and cannot re-drag a
piece is still not shippable.

**The two exceptions worth doing now, because they are defects and small:**

1. The `#if UNITY_EDITOR` audio load — a one-line fix (serialize the clip)
   turning the only real recording on for the web.
2. No music at all is not "juice", it is an empty channel. One ambient loop is
   not a feature schedule.

Everything else on this page waits for the six.

## Lane

In-game audio, scoring and UI belong to **SAL0-01 Codex** in
`SAL0MANDER-Puzzle-Prototype`. This repo must not implement any of it. This
document is evidence for that lane, not a work order for this one.
