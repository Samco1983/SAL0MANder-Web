import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import { paths } from '@config/routes'

/**
 * Unknown route.
 *
 * The most likely visitor here is a student whose teacher's share link was
 * mistyped, truncated by an LMS, or split across a line break — not someone
 * browsing. So the recovery offered is a way back *into play*, not just the
 * marketing home page, and neither route asks for an account.
 */
export function NotFoundPage() {
  return (
    <AppShell>
      <div style={{ maxWidth: '52ch' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>
          We couldn&apos;t find that page
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
          If you followed a share link from a teacher, it may have been mistyped or the activity may
          no longer be published. You can still start playing without an account.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <LinkButton to={paths.guestPlayIndex}>Go to Guest Play</LinkButton>
          <LinkButton to={paths.home} variant="secondary">
            Back to home
          </LinkButton>
        </div>
      </div>
    </AppShell>
  )
}
