import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import { paths } from '@config/routes'

export function NotFoundPage() {
  return (
    <AppShell>
      <div style={{ maxWidth: '52ch' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>
          We couldn't find that page
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
          If you followed a share link from a teacher, it may have been mistyped or the activity may
          no longer be published.
        </p>
        <LinkButton to={paths.home}>Back to home</LinkButton>
      </div>
    </AppShell>
  )
}
