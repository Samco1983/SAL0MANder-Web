import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import { ApiError } from '@api/errors'
import { paths } from '@config/routes'

/**
 * Last line of defense for a route that throws.
 *
 * A student mid-activity should see a recoverable message, never a blank page.
 * Server-supplied text is never rendered directly — copy is chosen from the
 * error's stable code.
 */
export function RouteError() {
  const error = useRouteError()

  let message = 'Something went wrong. Please try again.'
  if (error instanceof ApiError) {
    message = error.userMessage
  } else if (isRouteErrorResponse(error) && error.status === 404) {
    message = "We couldn't find that page."
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '52ch' }} role="alert">
        <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>
          SAL0MANder hit a problem
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
          {message}
        </p>
        <LinkButton to={paths.home}>Back to home</LinkButton>
      </div>
    </AppShell>
  )
}
