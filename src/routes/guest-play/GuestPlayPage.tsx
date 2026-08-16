import { useEffect, useMemo } from 'react'
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
import { onUnityMessage } from '@unity/bridge'
import { usePlaySession } from './usePlaySession'
import type { ApiError } from '@api/errors'
import { useGuestActivity } from './useGuestActivity'
import { isRecoverable, linkCopy, linkStateFrom } from './linkState'
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
  // Starts only once there is a pinned version to attribute the play to.
  const session = usePlaySession({
    activityId,
    activityVersionId: bundle?.version.id,
    identity,
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
    const body = bundle.version.payload.body as { allowedPlayModes?: string[] } | undefined
    const allowed = body?.allowedPlayModes
    return {
      activityId: bundle.summary.id,
      activityVersionId: bundle.version.id,
      playBundle: bundle.version.payload.body,
      ...(allowed?.length === 1 ? { selectedPlayMode: allowed[0] } : {}),
      ...(sessionId ? { sessionId } : {}),
    }
  }, [bundle, sessionId])

  // Unity reports a finished game across the bridge; the web layer records it.
  // A submit failure is deliberately silent to the student — the game is over
  // and the result is the teacher's concern, not something to interrupt a
  // child with.
  useEffect(() => {
    return onUnityMessage((message) => {
      if (message.type !== 'session-finished') return
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
        stage={<UnityStage {...(activityId ? { activityId } : {})} {...(boot ? { boot } : {})} />}
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
