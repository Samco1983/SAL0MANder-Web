/**
 * Unity ↔ Web message bridge.
 *
 * STUB. The real message set is part of the shared contract and must be agreed
 * with Codex before anything is wired up (DECISIONS X-009). What is fixed here
 * is the *shape* of the boundary, chosen so gameplay never depends on the web
 * layer:
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

import { createEventDeduper, type EventDeduper } from './eventDedupe'

export const BRIDGE_VERSION = 1 as const

/**
 * Correlation fields. PROPOSED, pending reconciliation with Codex.
 *
 * Both are optional in every direction, so a Unity build that knows nothing
 * about them stays fully compatible. They exist because "the game finished" is
 * not by itself enough to write a result safely:
 *
 *   - `sessionId` is the web-side `PlaySession` the web layer opened before
 *     booting Unity. Without it, a student who restarts mid-lesson produces two
 *     `session-finished` events the web layer cannot tell apart, and the second
 *     result can be written against the first session.
 *   - `correlationId` identifies one *boot attempt*. Unity echoes back whatever
 *     it was booted with, which is what lets the web layer discard a late event
 *     from a previous, already-superseded boot of the same session.
 *
 * Neither is authentication and neither is a secret: they are opaque strings
 * the web layer minted and is matching against its own state.
 */
export type BridgeCorrelation = {
  sessionId?: string
  correlationId?: string
  /**
   * Per-message identity. `API_CONTRACT.md` §WebGL bridge requires receivers to
   * deduplicate on it — see `eventDedupe.ts` for why that matters most for
   * `session-finished`.
   */
  eventId?: string
  occurredAtUtc?: string
}

/** Web → Unity. Sent via the Unity instance's `SendMessage`. */
export type WebToUnityMessage =
  | ({
      type: 'boot'
      version: typeof BRIDGE_VERSION
      activityId: string
      activityVersionId: string
      /**
       * The sanitized play bundle, per `API_CONTRACT.md`: "boot: contract
       * version, sanitized play bundle, and session correlation."
       *
       * Opaque to the web layer by design — it is handed across, never read.
       * Typed `unknown` so the web cannot start depending on gameplay fields
       * and quietly grow a second implementation of the rules.
       */
      playBundle?: unknown
      /**
       * The mode this session is pinned to, when the activity allows only one.
       * Omitted for Student Choice, where Unity owns the picker and the choice
       * does not exist yet at boot — see the open ownership question in
       * `docs/coordination/WEB-INVENTORY.md` B-6.
       */
      selectedPlayMode?: string
    } & BridgeCorrelation)
  | { type: 'set-paused'; version: typeof BRIDGE_VERSION; paused: boolean }

/** Unity → Web. Delivered on `window` as a CustomEvent. */
export type UnityToWebMessage =
  // `API_CONTRACT.md`: every emitted message should carry contractVersion,
  // eventId and occurredAtUtc — so correlation rides on all of them, not only
  // the ones that name a session.
  | ({ type: 'ready'; version: typeof BRIDGE_VERSION } & BridgeCorrelation)
  | ({
      type: 'load-progress'
      version: typeof BRIDGE_VERSION
      progress: number
    } & BridgeCorrelation)
  | ({
      type: 'session-finished'
      version: typeof BRIDGE_VERSION
      durationMs: number
      questionsAnswered: number
      questionsCorrect: number
      piecesPlaced: number
      piecesTotal: number
    } & BridgeCorrelation)
  | ({ type: 'error'; version: typeof BRIDGE_VERSION; message: string } & BridgeCorrelation)

export const UNITY_EVENT_NAME = 'sal0mander:unity-message'

/** Message types this bridge version understands. Anything else is ignored. */
const KNOWN_TYPES = new Set<UnityToWebMessage['type']>([
  'ready',
  'load-progress',
  'session-finished',
  'error',
])

/**
 * Why a message was dropped.
 *
 * Dropping is still the behavior — this only makes it *observable*. A silent
 * drop is indistinguishable from "Unity never sent anything", which is the
 * single most confusing failure mode to debug during integration: a Unity build
 * compiled against bridge v2 talking to a web deploy on v1 looks exactly like a
 * dead game.
 */
export type BridgeMismatch =
  /** Not a bridge message at all: no detail, or no string `type`. */
  | { reason: 'malformed'; detail: unknown }
  /** Right shape, wrong bridge version — the deploy-skew case. */
  | {
      reason: 'version'
      type: string
      received: unknown
      expected: typeof BRIDGE_VERSION
      detail: unknown
    }
  /** Correct version, but a `type` this build does not know. Forward-compat. */
  | { reason: 'unknown-type'; type: string; detail: unknown }

export type UnityMessageOptions = {
  /** Injectable so the dedupe window is testable and shareable if ever needed. */
  deduper?: EventDeduper
  /**
   * Called instead of `handler` when a message is dropped. Optional: omitting
   * it preserves the original silent-drop behavior exactly.
   *
   * Like `handler`, a throw here is swallowed — diagnostics must never be able
   * to take down a running game.
   */
  onMismatch?: (mismatch: BridgeMismatch) => void
}

/**
 * Subscribe to Unity messages. Returns an unsubscribe function.
 * Handler errors are swallowed so a web bug cannot take down the game.
 */
export function onUnityMessage(
  handler: (message: UnityToWebMessage) => void,
  options: UnityMessageOptions = {},
): () => void {
  const { onMismatch } = options
  // Per-subscription, so one listener's history cannot suppress another's.
  const deduper = options.deduper ?? createEventDeduper()

  // Never let a diagnostic callback escalate into a broken game.
  const reportMismatch = (mismatch: BridgeMismatch) => {
    if (!onMismatch) return
    try {
      onMismatch(mismatch)
    } catch (error) {
      console.error('[unity-bridge] onMismatch threw; ignoring', error)
    }
  }

  const listener = (event: Event) => {
    const detail = (event as CustomEvent).detail as Partial<UnityToWebMessage> | undefined

    if (!detail || typeof detail.type !== 'string') {
      reportMismatch({ reason: 'malformed', detail })
      return
    }
    if (detail.version !== BRIDGE_VERSION) {
      reportMismatch({
        reason: 'version',
        type: detail.type,
        received: detail.version,
        expected: BRIDGE_VERSION,
        detail,
      })
      return
    }
    if (!KNOWN_TYPES.has(detail.type as UnityToWebMessage['type'])) {
      reportMismatch({ reason: 'unknown-type', type: detail.type, detail })
      return
    }
    // A redelivered `session-finished` would otherwise submit a student's
    // result twice. Silent by design: a duplicate is not a fault to report.
    if (!deduper.accept(detail.eventId)) return

    try {
      handler(detail as UnityToWebMessage)
    } catch (error) {
      console.error('[unity-bridge] handler threw; ignoring', error)
    }
  }

  window.addEventListener(UNITY_EVENT_NAME, listener)
  return () => window.removeEventListener(UNITY_EVENT_NAME, listener)
}

/**
 * How a message relates to the session the web layer thinks is running.
 *
 * Three-valued on purpose. `'uncorrelated'` is not a synonym for either of the
 * others: it is what a Unity build that predates correlation sends, and the
 * caller — not this module — decides whether to trust it. Collapsing it into
 * `'match'` would silently mis-attribute results the moment two sessions
 * overlap; collapsing it into `'mismatch'` would drop every result from a build
 * that has not adopted the fields yet.
 */
export type CorrelationVerdict = 'match' | 'mismatch' | 'uncorrelated'

export function correlateSession(
  message: UnityToWebMessage,
  expected: { sessionId: string; correlationId?: string },
): CorrelationVerdict {
  const actual = message as Partial<BridgeCorrelation>
  if (actual.sessionId === undefined && actual.correlationId === undefined) return 'uncorrelated'
  if (actual.sessionId !== undefined && actual.sessionId !== expected.sessionId) return 'mismatch'
  // Only enforced when the caller booted with one; a build that echoes just the
  // session id is still a match.
  if (
    expected.correlationId !== undefined &&
    actual.correlationId !== undefined &&
    actual.correlationId !== expected.correlationId
  ) {
    return 'mismatch'
  }
  // A message carrying only a correlationId can still be placed, but only if it
  // is the boot attempt we are waiting on.
  if (actual.sessionId === undefined && expected.correlationId === undefined) return 'uncorrelated'
  return 'match'
}
