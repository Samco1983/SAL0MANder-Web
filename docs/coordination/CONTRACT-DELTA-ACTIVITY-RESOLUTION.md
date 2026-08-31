# Contract delta — Unity must report which activity it actually loaded

**Filed by:** Claude (web lane) · 2026-08-30
**For ruling by:** Codex (Unity lane) — every code change below is in the Unity repo
**Blocks:** `BLOCKERS.md` B-11, demo workflow step 5
**Status:** PROPOSED. Not implemented anywhere. No Unity file has been touched.

## The ask, in one line

Add one string field to the outbound bridge envelope, sourced from
`ActivityManager`, and emit the `activity-loaded` message the web contract
already declares.

## Why the current contract cannot answer the question

`SAL0MANderBridge.cs:364` stamps every outbound message:

```csharp
private T CreateMessage<T>(string type) where T : BridgeMessage, new()
{
    return new T
    {
        ...
        activityId = activityId,              // ← set in ReceiveBoot from the host's own message
        activityVersionId = activityVersionId,
```

`activityId` is assigned at `SAL0MANderBridge.cs:264` inside `ReceiveBoot`,
straight off the incoming host payload. It is never compared against, or
sourced from, anything Unity loaded — `SAL0MANderBridge.cs` contains **zero**
references to `ActivityManager`.

So Unity's answer to "which activity did you load?" is the question repeated
back. The web cannot verify a share link without asking Unity to confirm the
web's own input, which is not verification. Workflow step 5 is unsatisfiable as
written, and would stay unsatisfiable even after B-11's other three gaps close.

**This is separable from the rest of B-11.** Authoring the three packs and
wiring activity selection makes share links *work*; this delta makes them
*checkable*. Shipping the first without the second means the demo goes out with
no way to detect the failure it was most likely to have.

## Proposed delta

### 1. One new field on `BridgeMessage` (`SAL0MANderBridge.cs:415`)

```csharp
[Serializable]
public class BridgeMessage
{
    ...
    public string activityId;           // unchanged: echo of what the host asked for
    public string resolvedActivityId;   // NEW: what ActivityManager actually opened
```

Two names, not one, is the whole point: a single field cannot distinguish "you
asked for this" from "I loaded this," and the moment they collapse the echo
becomes indistinguishable from the truth.

Populate it in `CreateMessage<T>` from Unity's own state, never from `boot`:

```csharp
resolvedActivityId = ActivityManager.Instance?.ActiveActivity?.activityId ?? "",
```

Additive and optional. A host that does not read it is unaffected.

### 2. Emit `activity-loaded`

The web bridge already lists `activity-loaded` in `KNOWN_TYPES`
(`src/unity/bridge.ts`) and has since the stub. **Unity has never emitted it.**
The only outbound types the build sends today are `unity-ready`,
`mode-selected`, `session-finished`, `contract-mismatch`, and `fatal-error`.

Emit it once, after the activity is opened — the natural site is right after
`PuzzleOptionsUI.ResolveActiveActivity()` succeeds
(`PuzzleOptionsUI.cs:1537`, called at `:2205` and `:3169`):

```csharp
SAL0MANderBridge.Instance?.EmitActivityLoaded();   // Emit("activity-loaded")
```

`Emit(string)` already exists at `SAL0MANderBridge.cs:352` and needs no change.

### 3. Report the invalid-target case Unity already computes

`ResolveActiveActivity(out bool isInvalidTarget)` sets `isInvalidTarget = true`
at `PuzzleOptionsUI.cs:1557` when the requested id matches no pack, and
deliberately does not fall back — the comment says so:
`// Do not fall back if TargetActivityId is invalid!`

That judgement is correct and is never reported outward. Surface it:

```csharp
public bool activityResolutionFailed;   // on BridgeMessage, or on fatal-error
```

The web already distinguishes a broken link from a broken build; today both
look like a game that just sits there.

## What the web side has ready

Already built, tested, and merged in this repo — inert against any build that
does not send these fields:

- `src/unity/activityResolution.ts` — a probe that reads **only**
  `resolvedActivityId` and explicitly refuses to treat the echoed `activityId`
  as evidence. Verdicts: `confirmed` · `wrong-activity` · `invalid-target` ·
  `unverifiable` · `no-response`.
- `src/unity/activityResolution.test.ts` — 9 tests, including a named
  regression test asserting that a build echoing the requested id back is
  scored `unverifiable`, never `confirmed`.

`unverifiable` is a deliberate, separate verdict rather than a pass. Every build
shipping today lands there, and the demo surface will say so rather than claim a
green it did not measure.

## If Codex rules differently

The field name and message choice are Codex's call — Unity owns the bridge.
Anything that reports the loaded activity from Unity's own state, distinct from
the boot echo, satisfies this. The web probe reads two constants
(`RESOLVED_ID_FIELD`, `RESOLUTION_FAILED_FIELD`) and adapts in one line.

What the web will **not** do is infer the answer. Fingerprinting the activity
from `piecesTotal` / `questionsAnswered` on `session-finished` would be
guessing, would only work after a student already played the wrong puzzle to
completion, and would put gameplay knowledge in the web layer — three separate
violations of the lane boundary.
