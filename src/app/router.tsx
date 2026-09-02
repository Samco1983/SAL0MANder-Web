import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
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
const AboutPage = lazy(() =>
  import('@routes/about/AboutPage').then((m) => ({ default: m.AboutPage })),
)
const TermsPage = lazy(() =>
  import('@routes/terms/TermsPage').then((m) => ({ default: m.TermsPage })),
)
const PrivacyPage = lazy(() =>
  import('@routes/privacy/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
)
const GuestPlayIndexPage = lazy(() =>
  import('@routes/guest-play/GuestPlayPage').then((m) => ({ default: m.GuestPlayIndexPage })),
)
const StudioPage = lazy(() =>
  import('@routes/studio/StudioPage').then((m) => ({ default: m.StudioPage })),
)
const ProfilePage = lazy(() =>
  import('@routes/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const UnityHostPage = lazy(() =>
  import('@routes/unity/UnityHostPage').then((m) => ({ default: m.UnityHostPage })),
)
const ConsolePage = lazy(() =>
  import('@routes/console/ConsolePage').then((m) => ({ default: m.ConsolePage })),
)

/**
 * A split route must never show a student a blank screen while its chunk
 * downloads — on classroom wifi that gap is seconds, not milliseconds.
 */
function split(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

/**
 * The route table, separate from the router built out of it.
 *
 * `createBrowserRouter` binds to `window.history` at module scope, which makes
 * the real table unreachable from a test — the routing a student actually
 * travels could only ever be re-declared by hand, and a re-declaration proves
 * nothing about the table that ships. Exporting the array lets a test mount
 * *these* routes in a memory router.
 */
export const routes: RouteObject[] = [
  { path: paths.home, element: <HomePage />, errorElement: <RouteError /> },
  {
    path: paths.studio,
    element: split(<StudioPage />),
    errorElement: <RouteError />,
  },
  {
    path: paths.guestPlayIndex,
    element: split(<GuestPlayIndexPage />),
    errorElement: <RouteError />,
  },
  { path: paths.guestPlay, element: split(<GuestPlayPage />), errorElement: <RouteError /> },
  { path: paths.about, element: split(<AboutPage />), errorElement: <RouteError /> },
  { path: paths.terms, element: split(<TermsPage />), errorElement: <RouteError /> },
  { path: paths.privacy, element: split(<PrivacyPage />), errorElement: <RouteError /> },
  { path: paths.profile, element: split(<ProfilePage />), errorElement: <RouteError /> },
  { path: paths.unity, element: split(<UnityHostPage />), errorElement: <RouteError /> },
  { path: paths.console, element: split(<ConsolePage />), errorElement: <RouteError /> },
  // The catch-all needs a boundary too: without one, a throw inside
  // NotFoundPage renders React Router's default blank screen — the exact
  // outcome RouteError exists to prevent.
  { path: paths.notFound, element: <NotFoundPage />, errorElement: <RouteError /> },
]

// `basename` strips the deploy prefix before matching, so every `path` above
// stays written as if the app were at the root. Without it, project Pages
// serves the app at /SAL0MANder-Web/ and every route falls through to 404.
export const router = createBrowserRouter(routes, {
  basename: (import.meta.env?.BASE_URL as string | undefined) ?? '/',
})
