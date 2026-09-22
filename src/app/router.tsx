import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { paths } from '@config/routes'
import { env } from '@config/env'
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
const DistrictsPage = lazy(() =>
  import('@routes/districts/DistrictsPage').then((m) => ({ default: m.DistrictsPage })),
)
const AccessibilityPage = lazy(() =>
  import('@routes/accessibility/AccessibilityPage').then((m) => ({ default: m.AccessibilityPage })),
)
const GuestPlayIndexPage = lazy(() =>
  import('@routes/guest-play/GuestPlayPage').then((m) => ({ default: m.GuestPlayIndexPage })),
)
const SlideDemoPage = lazy(() =>
  import('@routes/demos/SlideDemoPage').then((m) => ({ default: m.SlideDemoPage })),
)
const StudioPage = lazy(() =>
  import('@routes/studio/StudioPage').then((m) => ({ default: m.StudioPage })),
)
const ClassroomPage = lazy(() =>
  import('@routes/classroom/ClassroomPage').then((m) => ({ default: m.ClassroomPage })),
)
const TutoringLandingPage = lazy(() =>
  import('@routes/tutoring/TutoringLandingPage').then((m) => ({ default: m.TutoringLandingPage })),
)
const GroupBookingPage = lazy(() =>
  import('@routes/classes/GroupBookingPage').then((m) => ({ default: m.GroupBookingPage })),
)
const LearnPage = lazy(() =>
  import('@routes/learn/LearnPage').then((m) => ({ default: m.LearnPage })),
)
const SoundLibraryPage = lazy(() =>
  import('@routes/sounds/SoundLibraryPage').then((m) => ({ default: m.SoundLibraryPage })),
)
const PuzzleGiftsPage = lazy(() =>
  import('@routes/gifts/PuzzleGiftsPage').then((m) => ({ default: m.PuzzleGiftsPage })),
)
const GiftPlayPage = lazy(() =>
  import('@routes/gifts/GiftPlayPage').then((m) => ({ default: m.GiftPlayPage })),
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

const unityHostElement = split(<UnityHostPage />)

/**
 * The route table, separate from the router built out of it.
 *
 * `createBrowserRouter` binds to `window.history` at module scope, which makes
 * the real table unreachable from a test — the routing a student actually
 * travels could only ever be re-declared by hand, and a re-declaration proves
 * nothing about the table that ships. Exporting the array lets a test mount
 * *these* routes in a memory router.
 */
export function createRoutes(siteMode: 'puzzles' | 'tutoring' = env.siteMode): RouteObject[] {
  return [
    {
      path: paths.home,
      element: siteMode === 'tutoring' ? split(<ClassroomPage />) : <HomePage />,
      errorElement: <RouteError />,
    },
    {
      path: paths.classes,
      element: split(<GroupBookingPage />),
      errorElement: <RouteError />,
    },
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
    { path: paths.slideDemo, element: split(<SlideDemoPage />), errorElement: <RouteError /> },
    { path: paths.gifts, element: split(<PuzzleGiftsPage />), errorElement: <RouteError /> },
    { path: paths.tutoring, element: split(<TutoringLandingPage />), errorElement: <RouteError /> },
    { path: paths.classroom, element: split(<ClassroomPage />), errorElement: <RouteError /> },
    { path: paths.learn, element: split(<LearnPage />), errorElement: <RouteError /> },
    { path: paths.sounds, element: split(<SoundLibraryPage />), errorElement: <RouteError /> },
    { path: paths.giftPlay, element: split(<GiftPlayPage />), errorElement: <RouteError /> },
    { path: paths.about, element: split(<AboutPage />), errorElement: <RouteError /> },
    { path: paths.terms, element: split(<TermsPage />), errorElement: <RouteError /> },
    { path: paths.privacy, element: split(<PrivacyPage />), errorElement: <RouteError /> },
    { path: paths.districts, element: split(<DistrictsPage />), errorElement: <RouteError /> },
    {
      path: paths.accessibility,
      element: split(<AccessibilityPage />),
      errorElement: <RouteError />,
    },
    { path: paths.profile, element: split(<ProfilePage />), errorElement: <RouteError /> },
    { path: paths.unity, element: unityHostElement, errorElement: <RouteError /> },
    // A saved link to the former standalone export now uses the same host,
    // without redirecting away its query string or fragment.
    { path: `${paths.unity}/index.html`, element: unityHostElement, errorElement: <RouteError /> },
    { path: paths.console, element: split(<ConsolePage />), errorElement: <RouteError /> },
    // The catch-all needs a boundary too: without one, a throw inside
    // NotFoundPage renders React Router's default blank screen — the exact
    // outcome RouteError exists to prevent.
    { path: paths.notFound, element: <NotFoundPage />, errorElement: <RouteError /> },
  ]
}
export const routes = createRoutes()

// `basename` strips the deploy prefix before matching, so every `path` above
// stays written as if the app were at the root. Without it, project Pages
// serves the app at /SAL0MANder-Web/ and every route falls through to 404.
export const router = createBrowserRouter(routes, {
  basename: (import.meta.env?.BASE_URL as string | undefined) ?? '/',
})
