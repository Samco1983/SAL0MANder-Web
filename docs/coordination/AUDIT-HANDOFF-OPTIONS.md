# Audit — how a web-authored activity reaches the game

**2026-09-02 · web lane · audit and recommendation**

The question: if Teacher Studio authoring moves to the website, how does the
activity get into Unity? Five options audited against what already exists in
both repositories.

---

## What the category has settled on

Every established product in this space — teacher authors content, students join
and play — uses the same shape: **authoring on the web, content stored
server-side, runtime retrieves it by id or code at play time.** Kahoot, Quizizz,
Blooket, Gimkit and Quizlet all work this way.

None of them author inside the game runtime. The reason is the one that has been
costing this project weeks: an editor inside the runtime ships on the runtime's
release cycle, and a content tool needs to change faster than an engine build.

That is not proof it is right here, but it is a strong prior, and SAL0MANder's
own contracts were already designed for that shape before tonight.

## What already exists

**The retrieval contract is written.** `src/contracts/v1/share.ts` defines
`PlayBundleSchema` as what `GET /v1/play/{shareCode}` returns, with
`QuizSchema` and `QuestionSchema` beneath it — prompt, hint, choices with
`isCorrect`, and `linkedPieceIndex`.

**The delivery mechanism is written.** `bridge.ts` sends `boot` carrying
`playBundle`, handed to Unity opaquely. Every student activity already travels
this path.

So the handoff is not a thing to design. It is a thing to point at a different
producer.

## The five options

| # | Option | Needs a backend | Works offline | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Boot payload over the bridge, activity held by the web app | no | n/a | **now** |
| 2 | Backend, share-code fetch (`GET /v1/play/{code}`) | yes | no | **later, and the destination** |
| 3 | Activity encoded into the URL | no | n/a | rejected |
| 4 | Teacher exports a JSON file, imports it into the game | no | yes | fallback only |
| 5 | Unity keeps authoring, syncs from `PlayerPrefs` | no | yes | status quo — device-local, unshareable |

### 1. Boot payload — available immediately

The web app builds the bundle and hands it over at boot. Already how a student's
activity arrives; the only change is that the producer is the teacher's own
editor rather than a fetch.

**Available with zero new infrastructure.** A teacher can author and immediately
play their own activity.

Limits: WebGL only, since the bridge does not exist on native. The activity
lives in the teacher's browser, so it cannot be shared or opened on another
machine. Preset images only — see below.

### 2. Backend and share code — the destination

The contract exists; the server does not. This is the industry shape and the
only one that lets a teacher share an activity with a class or a colleague, or
open it on a different device.

Constraint from `DECISION-INPUT-BACKEND-IS-A-PLATFORM-API.md`: it must be
callable by Unity directly, since the bridge is WebGL-only. Bearer tokens, not
cookie sessions.

### 3. Activity encoded into the URL — rejected

Tempting because it needs no server. Fails on practical limits — a quiz with ten
questions plus a custom image exceeds what a URL can carry, and browsers,
learning-management systems and QR codes each truncate at different lengths. A
share link that works for one activity and silently breaks for another is worse
than one that never worked.

### 4. Export and import a file — keep as a fallback

The teacher downloads an activity JSON and loads it into the game. Clunky, and
the only option here that works with no network at all. Worth keeping in mind
for the offline-classroom case, not worth building first.

### 5. Status quo — the ceiling already reached

`ActivityManager.cs:125` reads from `PlayerPrefs`. Device-local, unshareable,
and the reason a teacher who authors on a classroom desktop has nothing on their
laptop.

## Recommendation: 1 now, 2 as the destination

**Phase 1 — no backend required.** Teacher Studio on the web, activity held in
the browser, handed to Unity at boot. A teacher can build and play immediately.
Not shareable yet.

**Phase 2 — backend.** The same bundle served by share code. Sharing, multiple
devices, and native platforms all unlock together, and the contract is already
written.

**The handoff is not blocked on the backend. Only sharing is.** That is the
useful finding: phase 1 can start whenever Codex has capacity, and it exercises
the whole path before any storage decision is made.

## The one genuine blocker: custom images

Preset images are a number (`imagePresetIndex`) and travel free.

Custom images do not. Unity's current mechanism is `MediaType.Base64Data` —
image bytes inside the activity JSON. One 1.2 MB photo becomes roughly 1.6 MB of
text, and it rides inside every save. `MediaType.WebUrl` exists in the enum and
is the right answer, and it needs somewhere to host the file.

So: **questions and options can move in phase 1. Custom images wait for
storage.** This is the first thing genuinely blocked by the backend decision
rather than merely inconvenienced by it.

Upload is currently gated off in the web repo on purpose (`guardUploads`,
D-017), pending a review workflow. That gate should stay closed until it exists.

## Lane

The bridge, the contracts and the web editor are the web lane's. `ActivityData`,
the reader path and anything inside the engine are Codex's. The overlap is the
bundle shape, which `share.ts` already defines and which should not be changed
without a documented joint decision.

---

## Correction — custom images already work locally on WebGL

Found 2026-09-02, after the audit above was written. This section supersedes the
claim that custom image bytes are already stored inside the activity JSON.
They are not. Image selection and local use work; durable sharing does not.

`Assets/Plugins/WebGL/Sal0manderBridge.jslib`:

```js
SAL0OpenPuzzleImagePicker: function (callbackObjectNamePtr) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    ...
    if (file.size > 12 * 1024 * 1024) { /* reject */ }
    var reader = new FileReader();
    reader.onload = function () {
        SendMessage(callbackObjectName, 'OnWebCustomImageSelected', reader.result || '');
    };
}
```

Unity calls out to it at `PuzzleManager.cs:3201`, and receives a base64 data URL
which it decodes at `PuzzleManager.cs:3223`.

### Four consequences

**1. The WebGL picker is JavaScript, but it is still part of the Unity build.**
It creates an HTML `<input type="file">` rather than a native Unity file dialog.
The website can use the same browser capability, but the existing `.jslib` is
not a reusable React upload component and is not currently connected to the
web media provider.

**2. There is a size cap and no processing.** 12 MB is the only guard: no
resize, no re-encode, no format conversion. A teacher's 8 MB phone photo becomes
roughly 11 MB while it is represented as a temporary base64 data URL crossing
the browser-to-Unity boundary. It is then decoded back to bytes. The same image
measured **92 KB** at 640px WebP during tonight's art optimisation — a factor of
about 120.

Whatever else changes, **an uploaded image must be resized and re-encoded before
it is stored.** That is true in every option and should not wait for a storage
decision.

**3. Base64 is transport, not storage.** `OnWebCustomImageSelected` decodes the
data URL, and `SetCustomImage` writes the raw file bytes to
`persistentDataPath/CustomPuzzles/custom_saved.png`. The activity JSON records
only `imagePresetIndex = -1`. On WebGL this remains browser/device-local
persistence; another device or student cannot retrieve that image.

**4. A URL path still needs integration.** `MediaType.WebUrl` exists on
`MediaReference`, but the custom puzzle-image path does not currently resolve a
remote URL. Moving to durable storage therefore requires both the web upload
path and a defined URL/byte handoff into the puzzle runtime. The intended shape
is:

`picker → optimizeImages → media provider/backend → durable URL → Unity`

### Note: `GiantBoard_PlayTest.png`

The file is not lost. The Unity safety stash
`stash@{0}: codex-safety-before-pr23-2026-09-02` contains the PNG, its `.meta`,
and `Assets/Scripts/Tests/GiantBoardPlayTest.cs` plus its `.meta`. Do not apply
the whole stash over current `main`; recover those four paths on a dedicated
branch and review them independently.

The former silent 3×3 fallback for unsupported piece counts has also been fixed.
Wide and tall board shapes remain separate, unbuilt engine work.
