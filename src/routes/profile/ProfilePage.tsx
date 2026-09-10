import { env } from '@config/env'
import { buildPath, paths } from '@config/routes'
import { MOCK_DEMO_ACTIVITIES } from '@api/mockTransport'
import { AppShell } from '@components/layout/AppShell'
import { Card } from '@components/ui/Card'
import { LinkButton } from '@components/ui/Button'
import { PlaceholderNotice } from '@components/ui/PlaceholderNotice'
import styles from './ProfilePage.module.css'

/**
 * Guest play entry point. Keep playable routes accessible without promising
 * account features or recovery that this page does not provide.
 */
export function ProfilePage() {
  return (
    <AppShell>
      <h1 className={styles.title}>Profile</h1>

      <Card title="Playing as a guest">
        <p className={styles.lede}>
          You can play shared activities without signing in or creating an account. Pick a sample
          activity below or use a link from your teacher.
        </p>
        <p className={styles.lede}>
          Your guest session is not an account. Accounts and cloud saves are not available, and
          this page does not restore previous games.
        </p>
        {/*
          One primary, then alternatives.

          All three were rendered as primaries, so the card offered three
          equally-weighted dark green buttons and no answer to "which of these
          did you want me to press". Opening an activity is the thing this page
          exists to send someone to; the other two are ways of getting
          somewhere else.
        */}
        <div className={styles.actions}>
          <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITIES[0].id)}>Open sample activity</LinkButton>
          <LinkButton to={paths.guestPlayIndex} variant="secondary">
            Keep playing as guest
          </LinkButton>
          <LinkButton to={paths.unity} variant="secondary">
            Open puzzle player
          </LinkButton>
        </div>
      </Card>

      <div className={styles.pending}>
        <PlaceholderNotice
          title={env.features.accounts ? 'Account UX not designed yet' : 'Accounts are not enabled'}
          pending={[
            'Auth provider and account model — pending architecture approval',
            'Avatar system and customization',
            'XP / level presentation',
            'Credits economy — pending product approval',
            'Badges / achievements — pending product approval',
            'Play history and cloud saves',
          ]}
        >
          Profiles add persistence on top of play; they never gate it. A student must always be able
          to open a shared activity and play without one.
        </PlaceholderNotice>
      </div>
    </AppShell>
  )
}
