import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { env } from '@config/env'
import { buildShareLink, paths } from '@config/routes'
import { getGuestIdentity } from '@auth/guestIdentity'
import { AppShell } from '@components/layout/AppShell'
import { CompanionLayout } from '@components/layout/CompanionLayout'
import { Button, LinkButton } from '@components/ui/Button'
import { PlaceholderNotice } from '@components/ui/PlaceholderNotice'
import { SharePanel } from '@components/share/SharePanel'
import { UnityStage } from '@unity/UnityStage'
import { correlateAttempt, onUnityMessage } from '@unity/bridge'
import { usePlaySession } from './usePlaySession'
import type { ApiError } from '@api/errors'
import { useGuestActivity } from './useGuestActivity'
import { isRecoverable, linkCopy, linkStateFrom } from './linkState'
import { isModeChange, resolveSelectedMode } from './modeSelection'
import { useClientAttemptId } from './useClientAttemptId'
import styles from './GuestPlayPage.module.css'

/**
 * Why the link didn't work, and whether the student can do anything about it.
 * A retry is offered only when retrying could plausibly succeed — re-running a
 * revoked link teaches a student the app is broken rather than that the link is.
 */
function LinkFailure({ error, retry }: { error: ApiError; retry: () => void }) {
  const state = linkStateFrom(error)
  const { title, body } = linkCopy(state, error)

  return (
    <div role="alert">
      <h1 className={styles.companionTitle}>{title}</h1>
      <p className={styles.description}>{body}</p>
      {isRecoverable(state, error) ? (
        <Button className={styles.retry} onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Guest Play — the distribution-critical route.
 *
 * A teacher's share link lands here. Reaching playable content requires no
 * account, no email, and no form. The Unity stage is always rendered, even
 * while the activity metadata is still loading or has failed, so the companion
 * panel can never block gameplay.
 */
export function GuestPlayPage() {
  const { activityId } = useParams<{ activityId: string }>()
  const state = useGuestActivity(activityId)
  // Minted lazily on the device; not authentication, carries no PII.
  const identity = getGuestIdentity()
  const shareUrl = buildShareLink(activityId ?? '', env.publicBaseUrl)

  const bundle = state.status === 'ready' ? state.bundle : undefined
  const allowedPlayModes = (
    bundle?.version.payload.body as { allowedPlayModes?: string[] } | undefined
  )?.allowedPlayModes

  /**
   * The mode this attempt is pinned to.
   *
   * One mode allowed — known immediately. Student Choice — Unity owns the
   * picker, so the web waits for `mode-selected` rather than guessing. Pinning
   * a session to a mode the student never chose is unfixable after the fact:
   * the value is immutable once set, so a teacher's mode breakdown would be
   * quietly wrong with nothing to reveal it.
   */
  /**
   * Created before boot, not inside the session effect, so Unity is handed an
   * attempt identity from its very first message — for Student Choice the
   * session does not exist until the student picks, which would otherwise
   * leave Unity with nothing to correlate against.
   */
  const { clientAttemptId, renewAttempt } = useClientAttemptId(bundle?.version.id)

  const [chosenMode, setChosenMode] = useState<string | undefined>(undefined)
  const selectedPlayMode = allowedPlayModes?.length === 1 ? allowedPlayModes[0] : chosenMode

  /**
   * Read through a ref so the subscription is never torn down and rebuilt as
   * the pinned mode or the allow-list change — re-subscribing mid-handshake
   * would drop a `mode-selected` arriving in the gap.
   */
  const modeStateRef = useRef<{
    pinned: string | undefined
    allowed: readonly string[] | undefined
    attemptId: string | undefined
  }>({ pinned: undefined, allowed: undefined, attemptId: undefined })
  modeStateRef.current = {
    pinned: chosenMode,
    allowed: allowedPlayModes,
    attemptId: clientAttemptId,
  }

  useEffect(() => {
    return onUnityMessage((message) => {
      if (message.type !== 'mode-selected') return
      const { pinned, allowed, attemptId } = modeStateRef.current

      // Guard 1: a mode from a superseded boot, or with no attempt id at all,
      // must not latch — and therefore must not create a session.
      const correlation = correlateAttempt(message, { clientAttemptId: attemptId })
      if (correlation !== 'match') {
        if (!env.isProd) console.warn('[guest-play] mode-selected dropped:', correlation, message)
        return
      }

      const verdict = resolveSelectedMode(message.selectedPlayMode, pinned, allowed)

      // Only the first valid choice moves anything. Duplicates and conflicts
      // both leave the pin alone, and neither can open a second session.
      if (isModeChange(verdict)) {
        setChosenMode(verdict.mode)
      } else if (verdict.outcome !== 'ignored-duplicate' && !env.isProd) {
        // A rejection means Unity and the web disagree about this activity —
        // silent in production, loud enough to debug anywhere else.
        console.warn('[guest-play] mode-selected rejected', verdict)
      }
    })
  }, [])

  // Starts only once there is a pinned version AND a known mode.
  const session = usePlaySession({
    activityId,
    activityVersionId: bundle?.version.id,
    identity,
    selectedPlayMode,
    clientAttemptId,
    onRenewAttempt: renewAttempt,
    enabled: Boolean(bundle),
  })

  /**
   * What Unity is told at boot.
   *
   * Memoized on the identities it is built from, not the objects: a new object
   * each render would re-fire the boot effect against a running game.
   *
   * `selectedPlayMode` is sent only when the activity allows exactly one mode.
   * For Student Choice the choice does not exist yet at boot — Unity owns the
   * picker — so sending a guess would pin the session to a mode the student
   * never chose. See WEB-INVENTORY.md B-6.
   */
  const sessionId = session.status === 'active' ? session.session.id : undefined
  const boot = useMemo(() => {
    if (!bundle) return undefined
    return {
      activityId: bundle.summary.id,
      activityVersionId: bundle.version.id,
      playBundle: bundle.version.payload.body,
      ...(clientAttemptId ? { clientAttemptId } : {}),
      ...(selectedPlayMode ? { selectedPlayMode } : {}),
      ...(sessionId ? { sessionId } : {}),
    }
  }, [bundle, sessionId, selectedPlayMode, clientAttemptId])

  /**
   * What `session-finished` is checked against. A ref for the same reason the
   * mode guard uses one: re-subscribing when the session id arrives would drop
   * a result landing in the gap.
   */
  const correlationRef = useRef<{ attemptId: string | undefined; sessionId: string | undefined }>({
    attemptId: undefined,
    sessionId: undefined,
  })
  correlationRef.current = { attemptId: clientAttemptId, sessionId }

  /** Handed back to Unity so it can correlate what it later emits. */
  const sessionStarted = useMemo(
    () =>
      sessionId && bundle
        ? {
            sessionId,
            activityVersionId: bundle.version.id,
            ...(clientAttemptId ? { clientAttemptId } : {}),
            ...(selectedPlayMode ? { selectedPlayMode } : {}),
          }
        : undefined,
    [sessionId, bundle, selectedPlayMode, clientAttemptId],
  )

  // Unity reports a finished game across the bridge; the web layer records it.
  // A submit failure is deliberately silent to the student — the game is over
  // and the result is the teacher's concern, not something to interrupt a
  // child with.
  useEffect(() => {
    return onUnityMessage((message) => {
      if (message.type !== 'session-finished') return

      /*
       * Guard 2: a result from a superseded boot looks identical to a real
       * one. Submitting it writes a stale attempt's numbers against the live
       * session, which is unfixable once the result is recorded.
       */
      const correlation = correlateAttempt(message, {
        clientAttemptId: correlationRef.current.attemptId,
        sessionId: correlationRef.current.sessionId,
      })
      if (correlation !== 'match') {
        if (!env.isProd) console.warn('[guest-play] session-finished dropped:', correlation, message)
        return
      }

      void session.submit({
        status: 'completed',
        durationMs: message.durationMs,
        questionsAnswered: message.questionsAnswered,
        questionsCorrect: message.questionsCorrect,
        piecesPlaced: message.piecesPlaced,
        piecesTotal: message.piecesTotal,
        completedAt: new Date().toISOString(),
      })
    })
  }, [session])

  return (
    <AppShell fill contained={false}>
      <CompanionLayout
        companionLabel="Activity context"
        stage={
          <UnityStage
            {...(activityId ? { activityId } : {})}
            {...(boot ? { boot } : {})}
            {...(sessionStarted ? { sessionStarted } : {})}
          />
        }
        companion={
          <>
            {state.status === 'loading' ? (
              <p className={styles.description} role="status">
                Loading activity…
              </p>
            ) : null}

            {state.status === 'error' ? <LinkFailure error={state.error} retry={state.retry} /> : null}

            {state.status === 'ready' ? (
              <>
                <h1 className={styles.companionTitle}>{state.bundle.summary.title}</h1>
                {state.bundle.summary.authorDisplayName ? (
                  <p className={styles.byline}>by {state.bundle.summary.authorDisplayName}</p>
                ) : null}
                <p className={styles.description}>{state.bundle.summary.description}</p>
                {/* No `title` — the heading is directly above; repeating it
                    here would just be noise on this surface. */}
                <SharePanel url={shareUrl} />
              </>
            ) : null}

            <PlaceholderNotice
              label="Companion panel"
              title="Optional context lives here"
              pending={[
                'Lesson context and teacher notes',
                'Linked resources',
                'Player profile, badges, credits',
                'Collaboration tools',
              ]}
            >
              This 42% panel is optional and collapsible. Nothing here is required to play — the
              Unity stage keeps running when it is hidden.
            </PlaceholderNotice>

            <div className={styles.meta}>
              <span>activity: {activityId ?? '—'}</span>
              <span>version: {state.status === 'ready' ? state.bundle.version.id : '—'}</span>
              <span>guest: {identity.guestToken.slice(0, 8)}… (device-local, not an account)</span>
            </div>
          </>
        }
      />
    </AppShell>
  )
}

/** `/play` with no activity — a share link is what normally lands here. */
export function GuestPlayIndexPage() {
  return (
    <AppShell>
      <div className={styles.centeredInner}>
        <h1 className={styles.centeredTitle}>Open a shared activity</h1>
        <p className={styles.centeredBody}>
          Guest Play starts from a teacher's share link. Links look like{' '}
          <code>/play/&lt;activity-id&gt;</code> and never ask a student to sign in.
        </p>
        <LinkButton to={paths.home}>Back to home</LinkButton>
      </div>
    </AppShell>
  )
}
