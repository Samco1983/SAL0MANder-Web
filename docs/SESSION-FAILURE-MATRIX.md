# Session Failure Matrix

Systems analysis for issue #21. Scope is docs-only: no runtime, contract freeze,
Unity gameplay, backend, deployment, or Make changes.

## Status Key

- **Implemented** — current code/test covers the state.
- **Draft** — web has a typed path, but a real Unity/cloud counterpart is not
  proven.
- **Unresolved** — needs Unity, cloud, or product review.
- **Gap** — named because a row with no test is more useful than pretending the
  state is covered.

| Failure | Student sees | Recoverable? | Status | Test / evidence |
| --- | --- | --- | --- | --- |
| Activity link still resolving | `Loading activity...` in the companion panel while the Unity stage independently shows its own loader or placeholder. | N/A | **Implemented** | `GuestPlayPage.tsx:323-327`; `docs/GUEST-PLAY-WIREFRAME.md` §2.1. |
| Invalid, mistyped, or truncated link | "We couldn't find that activity" plus navigation recovery; no retry button. | No, not by retrying the same URL. | **Implemented** | `linkState.ts:24-62`; `GuestPlayPage.test.tsx:38-67`; `linkState.test.ts:35-84`. |
| Revoked link | "This link was turned off"; tells student to ask teacher for a new one; no retry button. | No. | **Implemented** | `linkState.ts:19-43`; `GuestPlayPage.test.tsx:68-76`; `shareResolution.test.ts:44-52`. |
| Unpublished activity | "This activity is not available right now"; says it may come back; no retry button. | Not from the student page. | **Implemented** | `linkState.ts:19-62`; `GuestPlayPage.test.tsx:78-91`; `mockTransport.ts:105-121`. |
| Offline/server-class resolve failure | "Activity unavailable" with server-safe message; retry button only when transport marked it retryable. | Yes, via `state.retry`. | **Implemented** | `linkState.ts:54-62`; `useGuestActivity.ts:28-84`; `useGuestActivity.test.ts:66-73`. |
| Clipboard unavailable | Copy status says the clipboard could not be reached; visible readonly link remains selectable. | Yes, manual copy. | **Implemented** | `SharePanel.tsx:37-56`; `SharePanel.test.tsx`. |
| QR generation failure | "QR code unavailable — use the link instead." | Yes, use visible link. | **Implemented** | `ShareQr.tsx:44-49`; `SharePanel.test.tsx:170-186`. |
| QR becomes stale after URL change | Current QR is replaced; slow old encode must not overwrite the newer URL. | Yes, automatically. | **Implemented** | `qrFreshness.test.tsx`; `SharePanel.test.tsx:194-231`. |
| Deployed route chunk is stale after a new build | Route error gives a stale-build recovery path instead of a generic crash. | Yes, reload/update path. | **Implemented** | `RouteError.test.tsx:112-150`; `deployedRouting.test.tsx:37-48`. |
| Unity build not configured | Student copy: "The game isn't ready yet... let your teacher know"; developer route shows env/setup hint. | Student: no. Developer: configure build. | **Implemented** | `UnityStage.tsx:245-279`; `hostUnavailable.test.tsx`; `buildConfig.test.ts`. |
| Unity loader script fails or instance rejects | Stage says SAL0MANder could not start and offers retry. | Yes, retry reloads Unity after cleanup. | **Implemented** | `UnityStage.tsx:19-27`, `:169-243`, `:296-310`; `hostRecovery.test.tsx:82-214`. |
| Retry creates duplicate Unity instance | Should never happen; retry tears down first and tests assert one canvas/live instance. | N/A | **Implemented** | `UnityStage.tsx:226-243`; `hostRecovery.test.tsx:210-265`. |
| Bridge send has no Unity instance | Web logs in development, returns false, and keeps caller state unchanged. | Yes, next ready handshake can retry boot/session-started. | **Implemented** | `bridge.ts:183-241`; `sendContainment.test.ts:41-64`, `:132-145`. |
| `SendMessage` throws because receiver target is wrong or not ready | Contained; no page crash. Dev diagnostic names GameObject and method. | Yes for boot/session-started retries; still needs real Unity confirmation. | **Implemented host, Draft integration** | `sendContainment.test.ts:66-81`, `:108-129`; `UNITY-HANDOFF-FLOW.md`. |
| Duplicate mode-selected or session-finished event | Duplicate is ignored/deduped; web opens/submits once. | N/A | **Implemented** | `gate1Handshake.test.tsx:182-265`; `eventDedupe.test.ts`. |
| Stale boot/attempt sends a mode or finish event after a newer attempt exists | Web drops stale attempt/session messages before opening a session or submitting result. | N/A | **Implemented** | `gate1Handshake.test.tsx:298-369`; `correlateAttempt.test.ts`. |
| Malformed `session-finished` metrics | Web rejects before submit, preventing `undefined` metrics from becoming a result. | No visible student path yet. | **Implemented guard, UI gap** | `GuestPlayPage.tsx:277-292`; `gate1Handshake.test.tsx`. |
| Result submit fails after game completion | Companion shows "Your finished activity isn't saved yet" with retry when safe; result is held. | Yes, if same attempt can retry. | **Implemented** | `resultDelivery.test.ts:69-185`; `undeliveredResultSurface.test.tsx:103-178`. |
| Result submit fails, then page reloads | Held result rehydrates from session storage; retry can save and clear it. | Yes when retryable. | **Implemented** | `resultRehydration.test.tsx:157-238`; `resultHold.test.ts`. |
| Session start fails before a session opens | Undelivered-result surface can show no-retry copy and hold attempt context. | Partly; some paths are not reachable from UI today. | **Implemented core, Gap in reachability** | `resultDelivery.test.ts:185-238`; `GUEST-PLAY-WIREFRAME.md` §3.7. |
| Contract version mismatch on inbound Unity message | Web reports a mismatch shape and drops the event without raw payload leakage. | No student recovery yet. | **Implemented diagnostic, Draft integration** | `bridge.test.ts:63-153`; `observability.test.ts:27-99`; `bridge.ts:295-380`. |
| Asset version/checksum mismatch | Contract parsing rejects malformed checksum or missing version; no student-facing recovery beyond contract mismatch. | No. | **Implemented parsing, Gap in UX** | `shareResolution.test.ts:127-155`; `contracts.test.ts:71-107`; real cloud/Unity asset mismatch remains unresolved. |
| Real Unity accepts boot but rejects gameplay payload | No current proof path. `SendMessage` success is not acknowledgement. | Unknown. | **Unresolved** | Needs explicit Unity ack or real-build Gate 1 test; see `UNITY-HANDOFF-FLOW.md`. |

## Open Cross-System Questions

1. **Unity:** Which event proves the activity actually loaded and accepted the
   boot payload?
2. **Unity:** Should a contract mismatch render a student-visible stage message,
   or remain an operator/developer diagnostic?
3. **Cloud:** What real backend error codes map to retryable resolve failures,
   idempotency conflicts, and contract mismatches?
4. **Cloud:** How are asset checksum/download mismatches surfaced once assets
   come from CDN or signed URLs?
5. **Product:** Should successful completion have companion-panel confirmation,
   or is Unity's completion screen the only success surface?

## Bounded Follow-Ups

- Add a real-build Gate 1 proof once a Unity WebGL build exists.
- Add explicit `activity-loaded`/boot-ack handling if Unity agrees it is needed.
- Add student-facing treatment for malformed completion or version mismatch only
  after the real build can trigger those states.
- Add cloud-backed tests for resolver retryability, idempotency conflict, and
  checksum/download mismatch when the backend exists.
