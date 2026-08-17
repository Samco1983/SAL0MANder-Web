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

import { env } from '@config/env'
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
  /**
   * The stable identity of one play attempt, surviving a reload. Sent from
   * `boot` onward so Unity can correlate before a session exists.
   *
   * This supersedes `correlationId`, which named the same thing under a
   * different word. Both travel for now so a build compiled against the older
   * field keeps working; `correlationId` is deprecated and will be removed
   * once no consumer reads it.
   */
  clientAttemptId?: string
  /** @deprecated Use `clientAttemptId`. Kept only for bridge-rollout compatibility. */
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
  /**
   * The canonical session id, sent back after the web opens the session.
   *
   * Unity cannot know it: the web calls `POST /v1/sessions` for embedded WebGL,
   * so the id is minted server-side and returned to the web. Unity needs it to
   * correlate anything it later emits — without this, a `session-finished`
   * carries no session and the web has to infer which attempt it belongs to.
   */
  | ({
      type: 'session-started'
      version: typeof BRIDGE_VERSION
      sessionId: string
      activityVersionId: string
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
  /**
   * The student picked a mode. DRAFT — proposed addition, not in
   * `API_CONTRACT.md` yet.
   *
   * Needed because the two facts are on opposite sides of the bridge:
   * `selectedPlayMode` is declared at `POST /v1/sessions`, which the *web*
   * calls, but Unity owns the picker. For a Student Choice activity the choice
   * does not exist at boot, and the web must not guess — pinning a session to a
   * mode the student never chose corrupts the mode breakdown in reporting.
   *
   * Only meaningful when `allowedPlayModes` has more than one entry; a
   * single-mode activity needs no message because the answer is already known.
   */
  | ({
      type: 'mode-selected'
      version: typeof BRIDGE_VERSION
      selectedPlayMode: string
    } & BridgeCorrelation)
  /**
   * Unity reports it cannot speak this contract version. Distinct from `error`:
   * a mismatch is a deploy-skew problem for an operator, not a gameplay fault.
   */
  | ({
      type: 'contract-mismatch'
      version: typeof BRIDGE_VERSION
      message?: string
    } & BridgeCorrelation)
  | ({ type: 'error'; version: typeof BRIDGE_VERSION; message: string } & BridgeCorrelation)

export const UNITY_EVENT_NAME = 'sal0mander:unity-message'

/**
 * Where a Web → Unity message is delivered inside the running build.
 *
 * CANONICAL — approved by Codex 2026-08-15. Still overridable so a build that
 * relocates the receiver is a config change rather than a code change.
 *
 * Note: no Unity C# receiver exists yet, and Codex reports the legacy `.jslib`
 * uses incompatible DOM event names and shapes. Nothing here has been exercised
 * against a real build, which is exactly why a failed delivery has to be loud
 * (see `sendToUnity`).
 */
export const UNITY_BRIDGE_TARGET = {
  gameObject: 'SAL0MANderBridge',
  method: 'ReceiveWebMessage',
} as const

/** The minimum a Unity instance must expose for the web to talk to it. */
export type UnityMessageTarget = {
  SendMessage: (gameObject: string, method: string, value: string) => void
}

/**
 * Send one message into the running build.
 *
 * Returns whether it went out, and never throws. Unity's `SendMessage` throws
 * if the target GameObject does not exist — which is exactly what a
 * name mismatch looks like — and the web must not take the page down over a
 * message the game does not need to receive. Guest Play works with the
 * companion silent.
 */
export function sendToUnity(
  instance: UnityMessageTarget | null | undefined,
  message: WebToUnityMessage,
  target: { gameObject: string; method: string } = UNITY_BRIDGE_TARGET,
): boolean {
  if (!instance?.SendMessage) {
    reportUndelivered(message, 'no Unity instance is attached')
    return false
  }
  try {
    instance.SendMessage(target.gameObject, target.method, JSON.stringify(message))
    return true
  } catch (error) {
    reportUndelivered(
      message,
      `SendMessage threw — is GameObject "${target.gameObject}" present with method "${target.method}"?`,
      error,
    )
    return false
  }
}

/**
 * An undelivered message is a silent failure by nature, so make it loud.
 *
 * Codex's ruling requires development/QA diagnostics for missing bridge
 * delivery, and the reason is concrete: no Unity C# receiver exists yet, and
 * the legacy `.jslib` uses incompatible event names. A wrong GameObject name
 * produces no error a student or a tester would ever see — boot simply never
 * arrives and the game sits on an empty board. The first person to notice
 * would be someone in a classroom.
 *
 * Loud in development, quiet in production: a teacher mid-lesson must not get
 * console noise, and gameplay continues regardless.
 */
function reportUndelivered(message: WebToUnityMessage, reason: string, error?: unknown): void {
  if (env.isProd) return
  console.error(
    `[unity-bridge] "${message.type}" was NOT delivered to Unity: ${reason}. ` +
      `Gameplay continues, but Unity never received this message.`,
    error ?? '',
  )
}

/** Message types this bridge version understands. Anything else is ignored. */
/**
 * Accepted v1 names plus the aliases this codebase shipped first.
 *
 * `API_CONTRACT.md` names `unity-ready`, `contract-mismatch` and `fatal-error`;
 * the stub here used `ready` and `error`. Both are accepted during the rollout
 * so a build on either vocabulary works, and `normalizeType` collapses them to
 * one internal name — the alternative is every consumer learning both.
 */
const TYPE_ALIASES: Record<string, UnityToWebMessage['type']> = {
  'unity-ready': 'ready',
  'fatal-error': 'error',
  'contract-mismatch': 'contract-mismatch',
}

const KNOWN_TYPES = new Set<UnityToWebMessage['type']>([
  'ready',
  'load-progress',
  'mode-selected',
  'session-finished',
  'contract-mismatch',
  'error',
])

/** Maps an accepted v1 name onto the internal one; passes others through. */
function normalizeType(raw: string): string {
  return TYPE_ALIASES[raw] ?? raw
}

/**
 * The contract version a message declares.
 *
 * `contractVersion` is the accepted v1 field; `version` was the stub's name and
 * is still read so a build compiled against it keeps working. Preferring the
 * new one means a build sending both is treated as v1 rather than as whatever
 * the legacy field happens to say.
 */
function readContractVersion(detail: Record<string, unknown>): unknown {
  return detail.contractVersion ?? detail.version
}

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
    const contractVersion = readContractVersion(detail as Record<string, unknown>)
    if (contractVersion !== BRIDGE_VERSION) {
      reportMismatch({
        reason: 'version',
        type: detail.type,
        received: contractVersion,
        expected: BRIDGE_VERSION,
        detail,
      })
      return
    }

    // Collapse the accepted v1 name onto the internal one before dispatch, so
    // a handler never has to know which vocabulary the build was compiled on.
    const type = normalizeType(detail.type) as UnityToWebMessage['type']
    if (!KNOWN_TYPES.has(type)) {
      reportMismatch({ reason: 'unknown-type', type: detail.type, detail })
      return
    }
    // A redelivered `session-finished` would otherwise submit a student's
    // result twice. Silent by design: a duplicate is not a fault to report.
    if (!deduper.accept(detail.eventId)) return

    try {
      // `version` is normalized too, so a v1 build sending only
      // `contractVersion` still satisfies consumers reading `version`.
      handler({ ...detail, type, version: BRIDGE_VERSION } as UnityToWebMessage)
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
/**
 * Does this message belong to the attempt currently on screen?
 *
 * Supersedes {@link correlateSession} for the Gate-1 guards. Three reasons the
 * older helper does not fit:
 *
 *   - it requires a `sessionId` in `expected`, and at `mode-selected` no
 *     session exists yet — that is the whole point of the handshake;
 *   - it keys on `correlationId`, now deprecated in favour of
 *     `clientAttemptId`;
 *   - it treats a message carrying no correlation as `'uncorrelated'`, i.e.
 *     "cannot tell, caller decides". The Gate-1 ruling reverses that: a
 *     missing attempt id must **not** latch a mode or submit a result.
 *
 * Fail-closed, deliberately. An uncorrelated `session-finished` from a
 * superseded boot looks exactly like a legitimate one, and accepting it writes
 * a stale result against the live session.
 */
export type AttemptVerdict =
  | 'match'
  /** Carries an attempt id, but not the one on screen — a superseded boot. */
  | 'stale-attempt'
  /** Right attempt, wrong session — a restart within the same attempt. */
  | 'stale-session'
  /** No attempt id at all. Cannot be placed, so it is not acted on. */
  | 'missing-attempt'

export function correlateAttempt(
  message: UnityToWebMessage,
  expected: { clientAttemptId: string | undefined; sessionId?: string | undefined },
): AttemptVerdict {
  const actual = message as Partial<BridgeCorrelation>
  // `correlationId` is still read so a build on the old field keeps working.
  const attempt = actual.clientAttemptId ?? actual.correlationId

  if (attempt === undefined || expected.clientAttemptId === undefined) return 'missing-attempt'
  if (attempt !== expected.clientAttemptId) return 'stale-attempt'

  // Session is only checkable once the web has one; before that, matching the
  // attempt is the strongest statement available and is enough.
  if (
    expected.sessionId !== undefined &&
    actual.sessionId !== undefined &&
    actual.sessionId !== expected.sessionId
  ) {
    return 'stale-session'
  }
  return 'match'
}

/**
 * @deprecated Superseded by {@link correlateAttempt}, which keys on
 * `clientAttemptId` and fails closed. Retained for the bridge rollout.
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
