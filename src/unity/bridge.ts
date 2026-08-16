/**
 * Unity ↔ Web message bridge.
 *
 * STUB. The real message set is part of the shared contract and must be agreed
 * with Codex before anything is wired up. What is fixed here is the *shape* of
 * the boundary, chosen so gameplay never depends on the web layer:
 *
 *   - Messages are coarse and few: boot, ready, session finished. Nothing
 *     per-frame, nothing per-piece. Unity owns interaction; the web layer only
 *     learns that something happened.
 *   - Every message is versioned and validated. An unrecognized message is
 *     ignored, not thrown on — a web deploy must never break a running game.
 *   - The bridge is one-way-safe: if the web listener is absent or errors,
 *     Unity continues. Guest Play must work even if the companion panel does
 *     not.
 */

export const BRIDGE_VERSION = 1 as const

/** Web → Unity. Sent via the Unity instance's `SendMessage`. */
export type WebToUnityMessage =
  | { type: 'boot'; version: typeof BRIDGE_VERSION; activityId: string; activityVersionId: string }
  | { type: 'set-paused'; version: typeof BRIDGE_VERSION; paused: boolean }

/** Unity → Web. Delivered on `window` as a CustomEvent. */
export type UnityToWebMessage =
  | { type: 'ready'; version: typeof BRIDGE_VERSION }
  | { type: 'load-progress'; version: typeof BRIDGE_VERSION; progress: number }
  | {
      type: 'session-finished'
      version: typeof BRIDGE_VERSION
      durationMs: number
      questionsAnswered: number
      questionsCorrect: number
      piecesPlaced: number
      piecesTotal: number
    }
  | { type: 'error'; version: typeof BRIDGE_VERSION; message: string }

export const UNITY_EVENT_NAME = 'sal0mander:unity-message'

/**
 * Subscribe to Unity messages. Returns an unsubscribe function.
 * Handler errors are swallowed so a web bug cannot take down the game.
 */
export function onUnityMessage(handler: (message: UnityToWebMessage) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent).detail as UnityToWebMessage | undefined
    if (!detail || typeof detail.type !== 'string' || detail.version !== BRIDGE_VERSION) return
    try {
      handler(detail)
    } catch (error) {
      console.error('[unity-bridge] handler threw; ignoring', error)
    }
  }
  window.addEventListener(UNITY_EVENT_NAME, listener)
  return () => window.removeEventListener(UNITY_EVENT_NAME, listener)
}
