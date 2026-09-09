# Teacher Studio playable preview

The Preview tab opens the real Unity game using an immutable snapshot of the
current draft. It includes the chosen library picture, authored questions and
student options. The separate preview connection leaves guest v1 boot intact.
Publish and share links for these local drafts remain unfinished.

## Use

1. Give an activity a title, choose its library picture and piece count, and
   complete its questions. Classic can have no questions; other modes need at
   least as many complete questions as pieces.
2. Open Preview and choose Play preview. The selected image is prepared, then
   the game loads. The canvas stays hidden until Unity acknowledges that exact
   activity. A missing or incompatible game build produces a visible failure.
3. Play the activity. Full screen keeps the same game instance. Escape belongs
   to the game settings; End preview closes the player and returns to editing.
4. Change the draft and play another preview to try the new snapshot.

Preview progress is temporary. Reloading starts a fresh attempt, and Resume
later is unavailable in preview. Draft autosave and Download backup continue to
be the ways to preserve authored activities. A preview does not publish an
activity or create a student report. Custom uploads are still unavailable in
the web editor; preview currently supports its six library pictures.

## Shared extension

Target: `SAL0MANderPreview.ReceivePreviewMessage`. Envelope `previewVersion: 1`
supports draft `config.schemaVersion: 2` only. Send `type: preview-boot`, a stable
`requestId`, selected config fields, questions and `{ key, pngBase64 }` picture.
Private teacher metadata/notes and `imagePresetIndex` never cross this boundary.
The web converts the known same-origin WebP to PNG; Unity checks PNG structure
and dimensions before creating its texture. Limits: 2 MiB decoded PNG, maximum
1024 pixels per side, and 3 MiB UTF-8 JSON. The actual library is currently 640px.

IDs are up to 128 characters (`[A-Za-z0-9][A-Za-z0-9_.:-]*`); title 200;
question/hint 2000; choice 500; at most 64 questions; 2–6 nonblank choices and
exactly one correct choice per question. Question IDs and choice IDs within a
question are unique. Questions use their authored sequential order. Mystery
Reveal forces automatic placement; Both offers Learning and Classic. Unity
owns piece generation, crop/rendering, answers, dragging and completion.

Replies use the independent `sal0mander:preview-message` event, with
`previewVersion`, `type`, `requestId` and optional static explanatory `message`.
Types: `preview-receiver-ready`, `preview-ready`, `preview-error`,
`preview-finished`. Unparseable messages use an empty request ID. The host only
accepts an uncorrelated error while waiting for its sole pending preview.

The host subscribes before boot, tries delivery when the loader resolves, and
retries the identical request after two and five seconds if no acknowledgement
arrives. An accepted duplicate replays its acknowledgement without resetting
the attempt. The 20-second acceptance timeout starts after the WebGL loader is
ready; loader progress/errors are handled separately. Explicit End preview
calls Unity Quit; ordinary layout/fullscreen changes keep the stage mounted.

The URL marker `teacherPreview=1` reflects the active preview route. Persistence
is controlled by the immutable `sal0manderTeacherPreview` boolean passed to each
Unity instance: true for previews, false for ordinary games. Unity latches the
copied Module value during SubsystemRegistration, before scene startup, and
guards its save, archive, preference and custom-image writers. Closing a preview
while its loader is still starting cannot turn it into a persistent student game;
when that cancelled loader resolves, the host quits it. A stale URL marker cannot
turn an ordinary game into a temporary preview.

## Review and verification

Claude Code supplied an independent design review through the signed-in local
CLI. Its central concerns were persistence suppression and lost-acknowledgement
recovery; both have explicit implementation and tests. This was a design review,
not a claim that Claude ran the game. Codex integrates web and Unity changes.

Web tests cover invalid/oversized drafts, privacy, snapshot/image preparation,
event isolation, missed acknowledgements, unsupported builds, preview entry and
cancellation. Unity's `SAL0MANderPreviewTestRunner.Run` checks strict mapping,
validation before mutation, duplicate acknowledgement, and saved-data guards.
The ASUS verification log and final browser/build results are recorded in the
parent project's `sync` directory when those checks finish.

The milestone does not establish production readiness, full cross-device
acceptance, pixel-exact colour/framing equivalence, repeated-preview memory
soak performance, cloud recovery, or publishing. Browser checks must use the
rebuilt Unity player from the same source checkpoint.
