/**
 * Did the student actually get the activity the share link asked for?
 *
 * This is the instrument for workflow step 5 — "verify that each share link
 * launches the real Unity activity" — and it exists because that step cannot
 * currently be honoured. See `docs/coordination/BLOCKERS.md` B-11.
 *
 * ## The mirror problem
 *
 * Unity stamps `activityId` onto every outbound message from
 * `SAL0MANderBridge.CreateMessage<T>`:
 *
 *     activityId = activityId,   // the field assigned in ReceiveBoot
 *
 * That field is the value *the web sent in `boot`*. Unity echoes it back
 * unchanged. `ReceiveBoot` never consults `ActivityManager` at all — the whole
 * bridge file contains zero references to it — so the echoed id says nothing
 * about which pack loaded. A verifier that compared `message.activityId` to the
 * requested id would return `confirmed` for every link, including a link that
 * loaded the wrong activity, because it would be comparing the request to
 * itself.
 *
 * So this module deliberately **ignores `activityId` on inbound messages** and
 * reads only {@link RESOLVED_ID_FIELD}, which by construction can only be
 * populated from `ActivityManager.ActiveActivity`. Until a build populates it,
 * the honest verdict is `'unverifiable'` — not `'confirmed'`.
 *
 * ## Why unverifiable is not a pass
 *
 * The failure this guards against is silent: a student opens a link, gets a
 * puzzle, plays it happily, and it is the wrong one. Nothing on screen looks
 * broken. If `'unverifiable'` were folded into success, the demo would report
 * green while the thing it claims to prove was never measured. It is kept as a
 * distinct verdict so a caller must decide what to do about it in the open.
 */

import type { UnityToWebMessage } from './bridge'

/**
 * The field a build must populate from its own activity state.
 *
 * Named distinctly from `activityId` on purpose: two names is what makes the
 * echo separable from the truth. A single shared field cannot express the
 * difference between "you asked for this" and "I loaded this", and the moment
 * they collapse, the mirror problem is back and undetectable.
 *
 * PROPOSED, pending Codex's ruling — see
 * `docs/coordination/CONTRACT-DELTA-ACTIVITY-RESOLUTION.md`. Declared here the
 * same way `mode-selected` was declared in `bridge.ts` before it was accepted:
 * additive, optional, and inert against a build that does not send it.
 */
export const RESOLVED_ID_FIELD = 'resolvedActivityId' as const

/** Companion field for the case Unity already detects but never reports. */
export const RESOLUTION_FAILED_FIELD = 'activityResolutionFailed' as const

export type ActivityResolutionVerdict =
  /** Unity named a loaded activity and it is the one that was requested. */
  | 'confirmed'
  /**
   * Unity named a loaded activity and it is a *different* one. The B-11 failure
   * made visible: the student is playing, and playing the wrong thing.
   */
  | 'wrong-activity'
  /**
   * Unity reported it could not resolve the requested id. Already computed
   * inside the build as `ResolveActiveActivity`'s `isInvalidTarget`, which
   * explicitly does not fall back — it is simply never emitted outward.
   */
  | 'invalid-target'
  /**
   * Unity acknowledged the boot but never said what it loaded. Every build
   * shipping today lands here. Not a pass.
   */
  | 'unverifiable'
  /** Nothing came back. The build never booted, or the bridge never attached. */
  | 'no-response'

export type ActivityResolution = {
  verdict: ActivityResolutionVerdict
  /** What the share link asked for. */
  requested: string
  /** What Unity said it loaded, when it said anything. */
  resolved?: string
  /** Plain-language reason, safe to show in a diagnostics drawer. */
  detail: string
}

export type ActivityResolutionProbe = {
  /** Feed every inbound bridge message. Order does not matter. */
  observe: (message: UnityToWebMessage) => void
  /**
   * The verdict as of now. Callers may read this at any time; it only ever
   * moves from less certain to more certain.
   */
  readonly resolution: ActivityResolution
  /**
   * Declare the observation window closed — a timeout elapsed, or the stage
   * unmounted. Converts a still-silent probe into `'no-response'`. Idempotent,
   * and never downgrades a verdict already reached.
   */
  settle: () => ActivityResolution
}

/** Reads the proposed field without trusting the message's declared shape. */
function readResolvedId(message: UnityToWebMessage): string | undefined {
  const value = (message as Record<string, unknown>)[RESOLVED_ID_FIELD]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readResolutionFailed(message: UnityToWebMessage): boolean {
  return (message as Record<string, unknown>)[RESOLUTION_FAILED_FIELD] === true
}

/**
 * Watch one boot attempt and report what it actually launched.
 *
 * Deliberately has no timer of its own. Time is the caller's concern — a probe
 * that owns a `setTimeout` is a probe that cannot be tested without faking
 * clocks, and worse, one that can fire after the stage it describes is gone.
 */
export function createActivityResolutionProbe(requestedActivityId: string): ActivityResolutionProbe {
  let resolution: ActivityResolution = {
    verdict: 'no-response',
    requested: requestedActivityId,
    detail: 'Unity has not sent anything yet.',
  }
  // Once a build has told us what it loaded, later chatter cannot unsay it.
  let terminal = false

  const set = (next: ActivityResolution) => {
    if (terminal) return
    resolution = next
  }

  return {
    observe(message) {
      if (terminal) return

      if (readResolutionFailed(message)) {
        set({
          verdict: 'invalid-target',
          requested: requestedActivityId,
          detail:
            `Unity could not resolve activity "${requestedActivityId}". ` +
            'The build has no pack with that id.',
        })
        terminal = true
        return
      }

      const resolved = readResolvedId(message)
      if (resolved !== undefined) {
        const matches = resolved === requestedActivityId
        set({
          verdict: matches ? 'confirmed' : 'wrong-activity',
          requested: requestedActivityId,
          resolved,
          detail: matches
            ? `Unity loaded "${resolved}", which is what the link requested.`
            : `The link requested "${requestedActivityId}" but Unity loaded "${resolved}".`,
        })
        terminal = true
        return
      }

      /*
       * Anything that proves the build is alive and talking. `activityId` is
       * NOT consulted here — see this module's header. A build that is clearly
       * running but silent about its activity is the current state of the
       * world, and it upgrades `no-response` to `unverifiable`: we learned the
       * bridge works, and separately that it cannot answer the question.
       */
      if (message.type === 'ready' || message.type === 'activity-loaded') {
        set({
          verdict: 'unverifiable',
          requested: requestedActivityId,
          detail:
            `Unity booted, but reported no ${RESOLVED_ID_FIELD}, so which activity ` +
            'loaded cannot be confirmed. This is expected until B-11 clears.',
        })
      }
    },

    get resolution() {
      return resolution
    },

    settle() {
      terminal = true
      return resolution
    },
  }
}

/**
 * May a share link be presented as verified?
 *
 * The single question the demo surface should ask. Only `'confirmed'` is true,
 * and that is the point of the whole module.
 */
export function isLaunchVerified(resolution: ActivityResolution): boolean {
  return resolution.verdict === 'confirmed'
}
