# Runbook — getting a new Unity build onto sal0mander.com

**The problem this solves.** Changing Unity source does not change the website.
The WebGL build is a separate artifact: someone has to build it, copy it into
this repo, and deploy. On 2026-08-30 that gap was **22 hours** — five Unity
commits (`83892c0`, `8807e81`, `5256266`, `ba9da34`, `d91b9f3`, from 20:18 to
22:49) landed after the deployed build was committed at 00:13, so none of that
day's work was on the live site.

Nobody was wrong. The step simply is not written down.

## Lanes

| Step | Owner |
| --- | --- |
| 1. Produce the WebGL build | **Codex / Unity** |
| 2. Copy the artifact into `SAL0MANder-Web` | handoff |
| 3. Verify, PR, deploy | **Claude / web** |

Web must not run Unity builds; Unity must not write to this repo.

## 1. Build (Codex)

The headless entrypoint already exists: `Assets/Editor/SAL0WebGLBuilder.cs`.

```
Unity -quit -batchmode -projectPath <unity-repo> \
  -executeMethod SAL0WebGLBuilder.Build \
  -logFile /private/tmp/sal0-unity-build.log
```

Output goes to `/private/tmp/sal0-unity-webgl` by default. Override with
`SAL0_WEBGL_BUILD_PATH` or `-sal0BuildPath <dir>`.

**Compression is already correct and must stay that way.** The builder sets
`PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled` and
restores the previous value afterwards, so it emits
`sal0-unity-webgl.{data,framework.js,wasm}` with no `.br` suffix. That matches
`VITE_UNITY_BUILD_COMPRESSION: none` in `deploy.yml`.

If Unity is ever built with Brotli instead, `deploy.yml` must change in the same
release. A mismatch is what broke the site until PR #82: the loader resolved,
the progress bar reached 100%, and every student got "The game didn't load"
while the build and the deploy both reported success.

## 2. Copy (handoff)

Only these two directories move:

```
<build>/Build/            -> SAL0MANder-Web/public/unity/Build/
<build>/StreamingAssets/  -> SAL0MANder-Web/public/unity/StreamingAssets/
```

Leave `public/unity/index.html` and `TemplateData/` alone — the site hosts the
canvas itself and does not use Unity's generated page.

## 3. Verify before opening a PR (web)

```
ls -l public/unity/Build/
```

Expect exactly four files and **no `.br`**:

```
sal0-unity-webgl.data
sal0-unity-webgl.framework.js
sal0-unity-webgl.loader.js
sal0-unity-webgl.wasm
```

Then `npm run verify`, and open a PR. **Do not push straight to `main`** — merging
is what deploys, and deploying is owner-authorized.

The deploy runs its own check ("verify the Unity build the app will request is
present"), which fails loudly on a compression or naming mismatch rather than
shipping a blank game. That guard is a backstop, not a substitute for looking.

## 4. After deploy

Confirm on the live site, not locally:

```
https://sal0mander.com/unity/Build/sal0-unity-webgl.wasm      -> 200
https://sal0mander.com/unity/Build/sal0-unity-webgl.wasm.br   -> 404
```

Then open `https://sal0mander.com/play/demo-activity` and confirm the stage
reaches a playable puzzle.

## Known costs

**Each build is ~87 MB in git history**, and every rebuild adds another copy.
Uncompressed is what makes it that large; Brotli would cut the student's
download to roughly a third. Worth revisiting before rebuilds become routine —
it is also what a school's wifi has to carry.

## Open question for Codex

Should the build be produced in CI rather than by hand? A workflow in the Unity
repo that builds WebGL and opens a PR here would remove this document entirely.
Unity licensing in CI is the blocker, which is why the current build is
described in `deploy.yml` as an "emergency Pages-hosted" artifact.
