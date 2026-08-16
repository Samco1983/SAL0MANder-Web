import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { paths } from '@config/routes'
import { HomePage } from '@routes/home/HomePage'
import { NotFoundPage } from '@routes/not-found/NotFoundPage'
import { RouteError } from './RouteError'
import { RouteFallback } from './RouteFallback'

/**
 * Route-level code splitting.
 *
 * Home and the 404 stay eager: they are small, and Home is the most common
 * cold entry after a share link.
 *
 * Everything that pulls in `UnityStage` is split, because the WebGL host is the
 * heaviest thing the bundle can reach and nobody needs it before they are on a
 * play route. `SharePanel` splits again beneath Guest Play so the QR encoder
 * only downloads for someone who actually opens the sharing surface — a student
 * following a link never fetches it.
 */
const GuestPlayPage = lazy(() =>
  import('@routes/guest-play/GuestPlayPage').then((m) => ({ default: m.GuestPlayPage })),
)
const GuestPlayIndexPage = lazy(() =>
  import('@routes/guest-play/GuestPlayPage').then((m) => ({ default: m.GuestPlayIndexPage })),
)
const ProfilePage = lazy(() =>
  import('@routes/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const UnityHostPage = lazy(() =>
  import('@routes/unity/UnityHostPage').then((m) => ({ default: m.UnityHostPage })),
)

/**
 * A split route must never show a student a blank screen while its chunk
 * downloads — on classroom wifi that gap is seconds, not milliseconds.
 */
function split(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  { path: paths.home, element: <HomePage />, errorElement: <RouteError /> },
  {
    path: paths.guestPlayIndex,
    element: split(<GuestPlayIndexPage />),
    errorElement: <RouteError />,
  },
  { path: paths.guestPlay, element: split(<GuestPlayPage />), errorElement: <RouteError /> },
  { path: paths.profile, element: split(<ProfilePage />), errorElement: <RouteError /> },
  { path: paths.unity, element: split(<UnityHostPage />), errorElement: <RouteError /> },
  // The catch-all needs a boundary too: without one, a throw inside
  // NotFoundPage renders React Router's default blank screen — the exact
  // outcome RouteError exists to prevent.
  { path: paths.notFound, element: <NotFoundPage />, errorElement: <RouteError /> },
])
