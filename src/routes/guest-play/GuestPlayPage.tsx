import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { env } from '@config/env'
import { buildPath, paths } from '@config/routes'
import { getGuestIdentity } from '@auth/guestIdentity'
import { AppShell } from '@components/layout/AppShell'
import { CompanionLayout } from '@components/layout/CompanionLayout'
import { Button, LinkButton } from '@components/ui/Button'
import { PlaceholderNotice } from '@components/ui/PlaceholderNotice'
import { SharePanel } from '@components/share/SharePanel'
import { UnityStage } from '@unity/UnityStage'
import { QuizPanel, type QuizSubmission } from '@components/quiz/QuizPanel'
import { readQuiz } from '@contracts/v1'
import { correlateAttempt, isUsableFinishedPayload, onUnityMessage } from '@unity/bridge'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'
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
  const recoverable = isRecoverable(state, error)

  return (
    <div role="alert">
      <h1 className={styles.companionTitle}>{title}</h1>
      <p className={styles.description}>{body}</p>
      {recoverable ? (
        <Button className={styles.retry} onClick={retry}>
          Try again
        </Button>
      ) : (
        <div className={styles.failureActions}>
          <LinkButton to={paths.guestPlayIndex}>Open Guest Play</LinkButton>
          <LinkButton to={paths.home} variant="secondary">
            Back to home
          </LinkButton>
        </div>
      )}
    </div>
  )
}

/**
 * A finished result the backend has not accepted yet.
 *
 * Ruled visible-now rather than deferred to teacher/admin reporting: a student
 * who completed an activity and whose result silently vanished has no way to
 * know, and neither has anyone else. Deliberately undramatic — the game is over
 * and nothing the student did was lost — and deliberately in the companion
 * panel, so a save problem never overlays or interrupts the stage.
 *
 * The retry is offered when the hook says it would do something. A button that
 * silently does nothing would be the same defect in a new costume.
 */
function UndeliveredResult({
  attemptId,
  retryable,
  retry,
}: {
  attemptId: string
  retryable: boolean
  retry: () => void
}) {
  return (
    <div className={styles.undelivered} role="alert">
      <h2 className={styles.undeliveredTitle}>Your finished activity isn't saved yet</h2>
      <p className={styles.undeliveredBody}>
        {retryable
          ? 'You finished — nothing is lost yet. Saving it to your teacher did not go through, so try again when the connection is back. Keep this tab open until it saves.'
          : 'You finished — nothing is lost yet. Keep this tab open until it can be saved — closing or reloading it before then will lose the result.'}
      </p>
      {retryable ? (
        <Button className={styles.retry} onClick={retry}>
          Try saving again
        </Button>
      ) : null}
      <p className={styles.undeliveredMeta}>attempt: {attemptId}</p>
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

  /**
   * `submit` through a ref, for a reason the ref above only half covered.
   *
   * `usePlaySession` returns a fresh object every render, so depending on
   * `session` re-subscribed on **every render** — not merely when the session
   * id arrived. `onUnityMessage` mints a per-subscription `eventId` deduper, so
   * the page's dedupe window was thrown away each time, and the `API_CONTRACT`
   * §WebGL bridge requirement that receivers deduplicate `eventId` was met only
   * incidentally, by `usePlaySession` refusing to submit twice from its own
   * state machine. One subscription per page, created once, keeps the window.
   */
  const submitRef = useRef(session.submit)
  submitRef.current = session.submit

  /*
   * The web-playable lesson.
   *
   * Lifted from the otherwise-opaque payload through a schema (see
   * contracts/v1/quiz.ts). Absent or malformed means "no web questions here",
   * which is an ordinary state — plenty of activities will be puzzle-only.
   */
  const quiz = useMemo(() => (bundle ? readQuiz(bundle.version.payload.body) : null), [bundle])
  const [quizDelivered, setQuizDelivered] = useState(false)
  const [quizSubmitting, setQuizSubmitting] = useState(false)

  /*
   * Finished means the result is actually somewhere a teacher can reach, not
   * that a promise resolved. `result-undeliverable` is explicitly NOT finished
   * — it already has a retry surface, and overriding it with a checkmark would
   * hide the one state the student needs to see.
   */
  const quizFinished =
    quizDelivered && session.status !== 'result-undeliverable' && session.status !== 'error'

  const finishQuiz = useCallback(
    async (submission: QuizSubmission) => {
      // Second guard behind the disabled button: `disabled` stops a pointer and
      // nothing else. Without this a double event submits the lesson twice.
      if (quizSubmitting || quizDelivered) return
      setQuizSubmitting(true)
      try {
        await submitRef.current({
          status: 'completed',
          durationMs: submission.durationMs,
          questionsAnswered: submission.questionsAnswered,
          questionsCorrect: submission.questionsCorrect,
          // Unity's numbers. A quiz-only attempt placed no pieces, and claiming
          // otherwise would put fabricated progress in a teacher's record.
          piecesPlaced: 0,
          piecesTotal: 0,
          completedAt: new Date().toISOString(),
        })
        /*
         * AWAITING IS NOT DELIVERING. Rebounded by Codex, and it was right.
         *
         * `usePlaySession.deliver` catches a submitResult rejection, stores
         * `result-undeliverable`, and RESOLVES. It also resolves when the
         * session is idle, starting, or otherwise not active. So this await
         * returning tells us the call finished, never that a teacher will see
         * anything — and the previous version flipped straight to "Finished.
         * Your teacher will see this" on a result that never left the device.
         *
         * The session state is the only honest signal, so it decides. A held,
         * undeliverable result keeps its existing retry path; the quiz simply
         * refuses to claim a delivery it cannot see.
         */
        setQuizDelivered(true)
      } finally {
        setQuizSubmitting(false)
      }
    },
    [quizSubmitting, quizDelivered],
  )

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
  // A submit failure does not interrupt the stage — the game is over — but it
  // is no longer silent either: it surfaces in the companion panel, holding the
  // result and its attempt id, with a retry. See W-13.
  useEffect(() => {
    return onUnityMessage((message) => {
      if (message.type !== 'session-finished') return

      /*
       * Guard 2: a result from a superseded boot looks identical to a real
       * one. Submitting it writes a stale attempt's numbers against the live
       * session, which is unfixable once the result is recorded.
       */
      const correlation = correlateAttempt(
        message,
        {
          clientAttemptId: correlationRef.current.attemptId,
          sessionId: correlationRef.current.sessionId,
        },
        // Stricter than the mode guard once a session exists: a completion
        // must name the exact active session. Before POST /sessions resolves,
        // the matching attempt id is the strongest correlation available and
        // usePlaySession buffers the result for that session-start race.
        { requireSession: correlationRef.current.sessionId !== undefined },
      )
      if (correlation !== 'match') {
        if (!env.isProd)
          console.warn('[guest-play] session-finished dropped:', correlation, message)
        return
      }

      // A known type can still be malformed. Without this a missing metric
      // reaches submitResult as `undefined` and is recorded as a real result.
      if (!isUsableFinishedPayload(message)) {
        if (!env.isProd) console.warn('[guest-play] session-finished malformed', message)
        return
      }

      void submitRef.current({
        status: 'completed',
        durationMs: message.durationMs,
        questionsAnswered: message.questionsAnswered,
        questionsCorrect: message.questionsCorrect,
        piecesPlaced: message.piecesPlaced,
        piecesTotal: message.piecesTotal,
        completedAt: new Date().toISOString(),
      })
    })
  }, [])

  return (
    <AppShell fill contained={false}>
      <CompanionLayout
        companionLabel="Activity context"
        /*
         * A student who collapsed the panel would otherwise never learn their
         * result failed to save — the notice would render into a hidden region
         * and the app would be silent again, one layer further out. Opening the
         * panel is the least the app can do and the most it should: no overlay
         * on the stage, no focus taken, and their preference comes back the
         * moment the result is delivered. See W-15.
         *
         * Keyed on `resultHeld`, not the status: a retry leaves
         * `result-undeliverable` while it is in flight, so watching the status
         * would close the panel and re-open it on every failed retry.
         */
        reveal={session.resultHeld}
        stage={
          <UnityStage
            audience="student"
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

            {state.status === 'error' ? (
              <LinkFailure error={state.error} retry={state.retry} />
            ) : null}

            {session.status === 'result-undeliverable' ? (
              <UndeliveredResult
                attemptId={session.attemptId}
                retryable={session.canRetry}
                retry={() => void session.retryDelivery()}
              />
            ) : null}

            {state.status === 'ready' ? (
              <>
                <h1 className={styles.companionTitle}>{state.bundle.summary.title}</h1>
                {state.bundle.summary.authorDisplayName ? (
                  <p className={styles.byline}>by {state.bundle.summary.authorDisplayName}</p>
                ) : null}
                <p className={styles.description}>{state.bundle.summary.description}</p>
                {/* No `title` — the heading is directly above; repeating it
                    here would just be noise on this surface. */}
                {activityId ? (
                  <SharePanel activityId={activityId} baseUrl={env.publicBaseUrl} />
                ) : null}
              </>
            ) : null}

            {quiz && clientAttemptId ? (
              <QuizPanel
                /*
                 * Keyed by attempt so a renewed attempt REMOUNTS. Without this
                 * the answers state survives the attempt change and is written
                 * straight back out under the new key — attempt B starting
                 * pre-answered with attempt A's answers, and persisting the
                 * contamination. Rebounded by Codex.
                 */
                key={clientAttemptId}
                quiz={quiz}
                attemptId={clientAttemptId}
                onComplete={finishQuiz}
                submitting={quizSubmitting}
                submitted={quizFinished}
              />
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
  /*
    Who actually arrives here: a student whose share link was cut off. The
    routing tests already prove a truncated /play/ lands on this page rather
    than the 404, so this is a real arrival, not a developer browsing.

    It used to show them `/play/<activity-id>` — URL syntax with angle
    brackets, to a child — and a single link back to where they just came from.
    A dead end dressed as an explanation.
  */

  // Only offered while there is no backend. The demo lives in the mock
  // transport, so promising it against a real API would be offering an
  // activity that may not exist — a worse dead end than the one being fixed,
  // because this one looks like it works.
  const canDemo = !env.api.isConfigured
  const [shareCode, setShareCode] = useState('')
  const navigate = useNavigate()
  const cleanedShareCode = shareCode.trim().toUpperCase()

  function submitShareCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cleanedShareCode) return
    navigate(buildPath.guestPlay(cleanedShareCode))
  }

  return (
    <AppShell>
      <div className={styles.centeredInner}>
        <h1 className={styles.centeredTitle}>This link looks incomplete</h1>
        <p className={styles.centeredBody}>
          Share links carry the name of the activity, and this one arrived without it — often
          because a chat app or a class page cut it short. Nothing is wrong on your end. Ask your
          teacher to send the whole link again.
        </p>
        <form className={styles.codeForm} onSubmit={submitShareCode}>
          <label className={styles.codeLabel} htmlFor="guest-share-code">
            Enter a class code
          </label>
          <p className={styles.centeredBody}>
            Use the class code from your teacher or paste the missing end of the link.
          </p>
          <div className={styles.codeControls}>
            <input
              id="guest-share-code"
              className={styles.codeInput}
              value={shareCode}
              onChange={(event) => setShareCode(event.currentTarget.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck="false"
              inputMode="text"
            />
            <Button type="submit" disabled={!cleanedShareCode}>
              Open
            </Button>
          </div>
        </form>
        {canDemo ? (
          <>
            <p className={styles.centeredBody}>In the meantime, you can try a sample puzzle.</p>
            <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITY_ID)}>
              Try a sample activity
            </LinkButton>
          </>
        ) : null}
        <LinkButton to={paths.home}>Back to home</LinkButton>
      </div>
    </AppShell>
  )
}
