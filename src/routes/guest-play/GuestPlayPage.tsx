import { useParams } from 'react-router-dom'
import { env } from '@config/env'
import { buildShareLink, paths } from '@config/routes'
import { getGuestIdentity } from '@auth/guestIdentity'
import { AppShell } from '@components/layout/AppShell'
import { CompanionLayout } from '@components/layout/CompanionLayout'
import { LinkButton } from '@components/ui/Button'
import { PlaceholderNotice } from '@components/ui/PlaceholderNotice'
import { UnityStage } from '@unity/UnityStage'
import { useGuestActivity } from './useGuestActivity'
import styles from './GuestPlayPage.module.css'

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

  return (
    <AppShell fill contained={false}>
      <CompanionLayout
        companionLabel="Activity context"
        stage={<UnityStage {...(activityId ? { activityId } : {})} />}
        companion={
          <>
            {state.status === 'loading' ? (
              <p className={styles.description}>Loading activity…</p>
            ) : null}

            {state.status === 'error' ? (
              <>
                <h1 className={styles.companionTitle}>Activity unavailable</h1>
                <p className={styles.description}>{state.error.userMessage}</p>
              </>
            ) : null}

            {state.status === 'ready' ? (
              <>
                <h1 className={styles.companionTitle}>{state.bundle.summary.title}</h1>
                {state.bundle.summary.authorDisplayName ? (
                  <p className={styles.byline}>by {state.bundle.summary.authorDisplayName}</p>
                ) : null}
                <p className={styles.description}>{state.bundle.summary.description}</p>
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
              <span>share: {buildShareLink(activityId ?? '', env.publicBaseUrl)}</span>
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
