import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { AppShell } from '@components/layout/AppShell'
import { Button, LinkButton } from '@components/ui/Button'
import { ApiError } from '@api/errors'
import { paths } from '@config/routes'

/**
 * A route chunk that will not download.
 *
 * Every play route is lazy, so a student's open tab holds the chunk hashes from
 * whenever the page loaded. Deploy while that tab is open and the next
 * navigation asks for a file that no longer exists. The browser's message
 * differs per engine, so match all three.
 */
function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''

  return (
    /failed to fetch dynamically imported module/i.test(message) || // Chrome, Edge
    /error loading dynamically imported module/i.test(message) || // Safari
    /importing a module script failed/i.test(message) || // Safari, older
    /loading chunk \d+ failed/i.test(message) // bundler-generated
  )
}

/**
 * Last line of defense for a route that throws.
 *
 * A student mid-activity should see a recoverable message, never a blank page.
 * Server-supplied text is never rendered directly — copy is chosen from the
 * error's stable code.
 */
export function RouteError() {
  const error = useRouteError()

  const staleChunk = isStaleChunkError(error)
  const notFound = isRouteErrorResponse(error) && error.status === 404

  let title = 'SAL0MANder hit a problem'
  let message = 'Something went wrong. Please try again.'

  if (staleChunk) {
    // "Back to home" cannot fix this — home would request the same missing
    // file. Only a reload fetches the new manifest, so say that plainly rather
    // than offering an action that quietly fails a second time.
    title = 'A new version is available'
    message =
      'This page was updated while you had it open. Reload to get the latest version — your place is saved.'
  } else if (error instanceof ApiError) {
    message = error.userMessage
  } else if (notFound) {
    // A missing page is not a malfunction, and saying so invites a bug report
    // for a mistyped link.
    title = "We couldn't find that page"
    message = 'The link may be incomplete, or the page may have moved.'
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '52ch' }} role="alert">
        <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>{title}</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>{message}</p>
        {staleChunk ? (
          <Button onClick={() => window.location.reload()}>Reload</Button>
        ) : (
          <LinkButton to={paths.home}>Back to home</LinkButton>
        )}
      </div>
    </AppShell>
  )
}
