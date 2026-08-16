import { createBrowserRouter } from 'react-router-dom'
import { paths } from '@config/routes'
import { HomePage } from '@routes/home/HomePage'
import { GuestPlayPage, GuestPlayIndexPage } from '@routes/guest-play/GuestPlayPage'
import { ProfilePage } from '@routes/profile/ProfilePage'
import { UnityHostPage } from '@routes/unity/UnityHostPage'
import { NotFoundPage } from '@routes/not-found/NotFoundPage'
import { RouteError } from './RouteError'

/**
 * Routes are eagerly imported today because the app is small. When the Unity
 * host and any future teacher tools grow, split them with `lazy` — the Unity
 * loader in particular should not be in the bundle a student downloads before
 * they reach a play route.
 */
export const router = createBrowserRouter([
  { path: paths.home, element: <HomePage />, errorElement: <RouteError /> },
  { path: paths.guestPlayIndex, element: <GuestPlayIndexPage />, errorElement: <RouteError /> },
  { path: paths.guestPlay, element: <GuestPlayPage />, errorElement: <RouteError /> },
  { path: paths.profile, element: <ProfilePage />, errorElement: <RouteError /> },
  { path: paths.unity, element: <UnityHostPage />, errorElement: <RouteError /> },
  { path: paths.notFound, element: <NotFoundPage /> },
])
