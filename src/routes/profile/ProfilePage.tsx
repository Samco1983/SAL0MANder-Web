import { env } from '@config/env'
import { AppShell } from '@components/layout/AppShell'
import { Card } from '@components/ui/Card'
import { PlaceholderNotice } from '@components/ui/PlaceholderNotice'
import { getGuestIdentity } from '@auth/guestIdentity'

/**
 * Profile placeholder.
 *
 * Accounts are off by default (`VITE_FEATURE_ACCOUNTS=false`) because no auth
 * provider has been chosen. Until then this route shows the device's guest
 * state so the guest → account claim path stays visible in the architecture.
 */
export function ProfilePage() {
  const identity = getGuestIdentity()

  return (
    <AppShell>
      <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)' }}>Profile</h1>

      <Card title="Playing as a guest">
        <p>
          This device has a local guest token (<code>{identity.guestToken.slice(0, 12)}…</code>). It
          carries no personal information, is not an account, and is not used as authentication. It
          exists so a session can resume on this device — and so progress can later be claimed by a
          real profile if the student chooses to sign up.
        </p>
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
