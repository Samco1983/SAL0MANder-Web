# Unity Handoff Flow — loader, boot, and lifecycle ownership

Systems analysis for issue #20. Scope is docs-only: no runtime, contract freeze,
Unity gameplay, backend, deployment, or Make changes.

## Status Key

- **Implemented** — present in current source or tests.
- **Draft** — typed in web code, but not proven against a real Unity build.
- **Unresolved** — needs Unity or cloud review before it can be treated as a
  contract.

## Boot Sequence

```text
Student opens /play/<identifier>
  -> web resolves activity bundle
  -> web opens/holds a play session when bundle + mode are known
  -> UnityStage loads the WebGL loader script
  -> createUnityInstance resolves and web marks the instance ready
  -> Unity announces its bridge receiver with ready / unity-ready
  -> web sends boot once
  -> web sends session-started once, and only after boot succeeded
  -> Unity owns gameplay
  -> Unity emits session-finished
  -> web validates correlation + payload shape, then submits result
```

## Handoff Table

| Step | Status | Owner | Evidence |
| --- | --- | --- | --- |
| Resolve play data | **Implemented in web mock/draft.** The page resolves either proposed `shareCode` or legacy `activityId` without auth. | Web + future cloud | `src/routes/guest-play/useGuestActivity.ts:6-20`, `:39-84`. |
| Build boot payload | **Implemented.** Web sends activity id, version id, play bundle, client attempt id, selected mode when known, and session id once available. | Web | `src/routes/guest-play/GuestPlayPage.tsx:184-206`. |
| Load Unity | **Implemented host, unproven real build.** Web appends the Unity loader script, tracks progress, records ready/error, and tears down on retry/unmount. | Web host, Unity build artifact | `src/unity/UnityStage.tsx:169-243`. |
| Wait for Unity receiver | **Implemented.** Loader readiness and receiver readiness are separate. `handshakes` increments on `ready` so a failed early send can retry when Unity later announces the receiver. | Unity announces; web listens | `src/unity/UnityStage.tsx:98-121`. |
| Send boot | **Implemented.** `bootedRef` flips only when `sendToUnity()` returns true, so failed sends remain retryable and delivered sends are not repeated. | Web sends; Unity receives | `src/unity/UnityStage.tsx:123-143`; `src/unity/sendContainment.test.ts:108-129`. |
| Send session id | **Implemented.** `session-started` waits for `bootedRef`, then sends once per `sessionId`. | Web sends; Unity receives | `src/unity/UnityStage.tsx:145-167`. |
| Gameplay | **Unity-owned.** Web does not model pieces, timers, board state, puzzle rules, or per-frame progress. | Unity | Bridge scope says messages are coarse only (`src/unity/bridge.ts:1-17`). |
| Finish event | **Implemented in web harness.** Web drops stale attempts, requires the live session once one exists, rejects malformed metrics, then submits. | Unity emits; web validates/submits | `src/routes/guest-play/GuestPlayPage.tsx:247-294`. |

## Trust Boundary

| Fact | Web can know | Web cannot know |
| --- | --- | --- |
| Loader script fetched | Yes, via script load/error and `createUnityInstance` promise. | Whether the C# bridge receiver exists yet. |
| `sendToUnity()` returned true | The JS `SendMessage` call did not throw. | Whether Unity applied the message, started the activity, or accepted the payload. |
| Unity sent `ready` | A bridge receiver emitted a recognized ready event. | Whether gameplay assets are fully initialized. |
| Unity sent `activity-loaded` | **Draft only.** Web can parse the event if emitted. | It is not currently used as the boot acknowledgement. |
| Unity sent `session-finished` | A valid, correlated completion message arrived. | Whether the in-game experience was correct, fair, or complete beyond the coarse metrics. |

The important rule: **a successful `SendMessage` is delivery to Unity's message
entry point, not an acknowledgement from gameplay.** If a future feature needs
acknowledgement, Unity must emit a separate event (`activity-loaded` or a new
explicit ack). Web must not infer it from the absence of a throw.

## Failure Containment

- No Unity instance or no `SendMessage` returns `false`, logs in development,
  and does not mutate caller state (`src/unity/bridge.ts:183-219`;
  `src/unity/sendContainment.test.ts:41-64`, `:132-145`).
- `SendMessage` throwing is contained and names the GameObject/method in the
  diagnostic (`src/unity/sendContainment.test.ts:66-81`).
- Loader failure renders an audience-specific message and retry path instead of
  blaming the share link (`src/unity/UnityStage.tsx:245-310`).
- A retry tears down the prior instance before creating another one, so retry
  cannot duplicate a WebGL instance (`src/unity/UnityStage.tsx:226-243`).
- Inbound bridge mismatches are summarized without raw payloads, share codes,
  URLs, or result metrics (`src/unity/bridge.ts:295-380`).

## Open Review Questions

1. **Unity:** Does the real build expose `SAL0MANderBridge.ReceiveWebMessage`,
   or does config need to override the target?
2. **Unity:** Should `activity-loaded` become the explicit boot acknowledgement,
   or is `ready` enough for Gate 1?
3. **Unity:** What event proves gameplay accepted the boot payload, distinct
   from the receiver merely existing?
4. **Web/Product:** Should production also surface failed bridge delivery in a
   telemetry endpoint once one exists, since console logging is suppressed?
5. **Cloud:** When a real backend is attached, which fields in `playBundle`
   may contain expiring URLs or signed asset pointers that should not be logged?

## Acceptance

- The boot sequence is readable by web, Unity, and cloud reviewers.
- Exactly-once behavior is tied to `bootedRef` and `sentSessionRef`, not
  assumed from render order.
- The doc says what web cannot know: a `SendMessage` success is not gameplay
  acknowledgement.
- Real-Unity gaps are marked as unresolved rather than asserted.
- Implementation can split into independent batches: loader diagnostics,
  receiver target confirmation, explicit ack event, production telemetry, and
  real-build Gate 1 proof.
