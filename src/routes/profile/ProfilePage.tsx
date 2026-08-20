import { env } from '@config/env'
import { buildPath, paths } from '@config/routes'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'
import { AppShell } from '@components/layout/AppShell'
import { Card } from '@components/ui/Card'
import { LinkButton } from '@components/ui/Button'
import { PlaceholderNotice } from '@components/ui/PlaceholderNotice'

/**
 * Profile placeholder.
 *
 * Accounts are off by default (`VITE_FEATURE_ACCOUNTS=false`) because no auth
 * provider has been chosen. Until then this route shows the device's guest
 * state so the guest → account claim path stays visible in the architecture.
 */
export function ProfilePage() {
  return (
    <AppShell>
      <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)' }}>Profile</h1>

      <Card title="Playing as a guest">
        <p>
          This browser can keep guest progress on this device. That local session carries no
          personal information, is not an account, and is not used as authentication. It lets play
          resume here — and progress can later be attached to a real profile if profile accounts
          are added.
        </p>
        <p>
          Next step: keep playing from a shared activity. Guest progress stays local until the
          product has an approved profile claim flow.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITY_ID)}>Open sample activity</LinkButton>
          <LinkButton to={paths.guestPlayIndex}>Keep playing as guest</LinkButton>
        </div>
      </Card>

      <div style={{ marginTop: 'var(--space-6)' }}>
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
