import { AppShell } from '@components/layout/AppShell'
import { CompanionLayout } from '@components/layout/CompanionLayout'
import { LinkButton } from '@components/ui/Button'
import { PlaceholderNotice } from '@components/ui/PlaceholderNotice'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'
import { buildPath, paths } from '@config/routes'
import { UnityStage } from '@unity/UnityStage'
import { env } from '@config/env'

/**
 * Bare WebGL host, for smoke-testing a Unity build in isolation from any
 * activity or share link. Uses the same CompanionLayout as Guest Play so the
 * 42/58 split is exercised on the path most likely to be run during a build
 * bring-up.
 */
export function UnityHostPage() {
  return (
    <AppShell fill contained={false}>
      <CompanionLayout
        defaultCollapsed
        companionLabel="Build information"
        stage={<UnityStage />}
        companion={
          <>
            <h1 style={{ fontSize: 'var(--text-xl)' }}>Unity WebGL host</h1>
            <PlaceholderNotice
              title="Reserved hosting surface"
              pending={[
                'No Unity WebGL build is committed to this repo (large binaries belong on a CDN)',
                'Unity ↔ Web message bridge is a stub pending contract agreement with Codex',
                'Compression, caching, and COOP/COEP headers need revisiting at deploy time',
              ]}
            >
              Point <code>VITE_UNITY_BUILD_BASE_URL</code> at a folder containing Unity's{' '}
              <code>Build/</code> output to load a build here. Gameplay is entirely Unity's; this
              page only hosts it.
            </PlaceholderNotice>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
              build base: {env.unity.buildBaseUrl || '(not configured)'}
              <br />
              build name: {env.unity.buildName}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITY_ID)}>
                Open sample activity
              </LinkButton>
              <LinkButton to={paths.home} variant="secondary">
                Back to home
              </LinkButton>
            </div>
          </>
        }
      />
    </AppShell>
  )
}
