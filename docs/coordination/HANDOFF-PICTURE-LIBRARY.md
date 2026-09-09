# Handoff — Unity needs the picture library

**2026-09-02 · web lane → Codex · blocks Teacher Studio producing a playable activity**

## The gap

```
PuzzleManager.cs:29   public Texture2D[] presetImages;
PuzzleManager.cs:30   // 0=Dog, 1=Cat, 2=Lotus, -1=Custom, -2=Blank Template
PuzzleManager.cs:2796 "PuzzleImages/Dog",
```

Unity ships **three** preset pictures, loaded from `Resources/PuzzleImages/`.

Teacher Studio on the web offers **twelve**, generated for this project and
optimised to 932 KB total. **None of them are the same three.**

So a teacher can now choose a picture in Teacher Studio, and the game cannot
render it. Everything else in the authoring flow works; this is what stops the
result being playable.

## What the web sends

The chosen picture is stored as a **stable key**, not an array position:

```
coral-reef · colosseum · bakery · saturn · dragon-castle · highland-castle
```

**Deliberately not an index.** `imagePresetIndex` is positional, so reordering
`presetImages` would silently repoint every existing activity at a different
picture — no error, no warning, and a teacher meets it in front of a class with
nothing to explain it. A key survives reordering, and an unknown key can fail
loudly and say which one it did not recognise.

## What is being asked

**Bundle the library as presets and resolve by key.** The files are in the web
repository at `public/images/library/<shape>/<style>/<name>.webp`, already
optimised — 640px longest edge, WebP, 50-160 KB each.

A key→texture map is the only new thing needed. Whether that lives beside
`presetImages`, replaces it, or wraps it is entirely Codex's call.

Six of the twelve fit an existing `BoardShape`:

| Key | Shape | Subject |
| --- | --- | --- |
| `coral-reef` | Square | Reef, turtle, clownfish, octopus |
| `colosseum` | Square | Roman Colosseum from the air |
| `bakery` | Landscape | Mice baking in a stone bakery |
| `saturn` | Landscape | Saturn, nebula, galaxies |
| `dragon-castle` | Portrait | Floating castle, dragon, balloons |
| `highland-castle` | Portrait | Scottish castle on a loch |

Teacher Studio offers only these six, because `BoardShape` is
`{Square, Portrait, Landscape}` and the remaining six are `custom-wide` and
`custom-tall`, which no board can display. They are ready if the engine gains
those shapes.

## Why not just send the bytes

It would work — `MediaType.Base64Data` is already handled, and the WebGL picker
already does exactly this. But every activity would then carry its picture
inside it: a 1.2 MB image is roughly 1.6 MB as base64, rewritten on every save
and re-downloaded by every student.

Presets cost nothing per activity. Bytes are the right path for a teacher's
*own* photograph, which is a separate feature and still gated.

## Two things worth knowing while you are in there

**Nothing resizes an uploaded image.** `Sal0manderBridge.jslib` caps the file at
12 MB and does nothing else — no resize, no re-encode. The same photograph
measured 1.2 MB as a source JPEG and **92 KB** at 640px WebP during the art run
on 2026-09-02. The web upload path now optimises automatically
(`optimizeImages`); Unity's own picker does not.

**`GiantBoard_PlayTest.png`** was untracked in the Unity repository at the start
of 2026-09-02 and has since been deleted. Nobody outside that session knows what
it showed. If it was a large-board or high-piece-count test it bears on the
missing `else` in the cols/rows selection — worth saying what it was before the
knowledge is gone.

## Until this lands

Teacher Studio is usable and honest about the gap: the panel states that
uploading is off and why. A teacher can build a complete activity — title,
subject, questions, answers, hints, board, picture — and it saves. It simply
cannot be played until the game can resolve the key.
