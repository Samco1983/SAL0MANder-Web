import { env } from '@config/env'
import { z } from 'zod'
import { createGroupClient, type GroupAccount, type GroupIdentity } from './client'

type FirebaseUser = {
  uid: string
  email: string | null
  emailVerified: boolean
  getIdToken(): Promise<string>
  getIdTokenResult(): Promise<{ claims: Record<string, unknown> }>
}
type FirebaseAuth = {
  currentUser: FirebaseUser | null
  authStateReady?(): Promise<void>
}
type AppSdk = {
  initializeApp(config: Record<string, string>, name: string): unknown
}
type AuthSdk = {
  getAuth(app: unknown): FirebaseAuth
  GoogleAuthProvider: new () => unknown
  signInWithPopup(auth: FirebaseAuth, provider: unknown): Promise<{ user: FirebaseUser }>
  signInWithRedirect(auth: FirebaseAuth, provider: unknown): Promise<void>
  getRedirectResult(auth: FirebaseAuth): Promise<{ user: FirebaseUser } | null>
  setPersistence(auth: FirebaseAuth, persistence: unknown): Promise<void>
  browserSessionPersistence: unknown
}
let firebaseReady: Promise<{ auth: FirebaseAuth; sdk: AuthSdk }> | null = null
export const GOOGLE_SIGN_IN_TIMEOUT_MS = 60_000
export const GOOGLE_SIGN_IN_TIMEOUT_MESSAGE =
  'Google sign-in timed out. Close any sign-in popup, allow popups, and try again in your regular browser.'
export const GOOGLE_SIGN_IN_STORAGE_MESSAGE =
  'Same-tab Google sign-in needs browser session storage. Please use a regular browser that allows it.'
const SAME_TAB_ORIGIN = 'https://sal0mander-math.firebaseapp.com'
const REDIRECT_MARKER = 'sal0:tutoring:google-redirect-pending:v1'
const redirectResults = new WeakMap<
  FirebaseAuth,
  { marker: string; promise: Promise<{ user: FirebaseUser } | null> }
>()
const ProfileSchema = z
  .object({
    uid: z.string().min(1).max(128),
    role: z.enum(['tutor', 'learner']),
    active: z.literal(true),
    createdAt: z.number().int().nonnegative(),
  })
  .strict()
const LearnerSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{32}$/u),
    ownerId: z.string().min(1).max(128),
    createdAt: z.number().int().nonnegative(),
  })
  .strict()
/** Optional dependencies let tests exercise Google/server authorization without loading an SDK or network. */
export function googleIdentity(
  config: {
    apiBase: string
    firebaseApiKey: string
    firebaseAppId: string
    selfEnrollment?: boolean
  },
  dependencies: {
    prepareFirebase?: () => Promise<{ auth: FirebaseAuth; sdk: AuthSdk }>
    fetch?: typeof fetch
    origin?: string
    sessionStorage?: () => Pick<Storage, 'setItem' | 'getItem' | 'removeItem'>
  } = {},
): GroupIdentity {
  let currentUser: FirebaseUser | null = null
  let attempt = 0
  const sameTabEnabled =
    (dependencies.origin ?? (typeof location === 'undefined' ? '' : location.origin)) ===
    SAME_TAB_ORIGIN
  const fetcher = dependencies.fetch ?? fetch
  function prepare() {
    if (!config.firebaseApiKey || !config.firebaseAppId)
      throw new Error('Google sign-in is not configured yet. Please contact SAL0MANder for help.')
    if (dependencies.prepareFirebase) return dependencies.prepareFirebase()
    firebaseReady ??= Promise.all([
      import(
        /* @vite-ignore */ 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'
      ) as Promise<AppSdk>,
      import(
        /* @vite-ignore */ 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'
      ) as Promise<AuthSdk>,
    ])
      .then(async ([appSdk, sdk]) => {
        const app = appSdk.initializeApp(
          {
            apiKey: config.firebaseApiKey,
            appId: config.firebaseAppId,
            projectId: 'sal0mander-math',
            authDomain: 'sal0mander-math.firebaseapp.com',
          },
          'sal0-tutoring',
        )
        const auth = sdk.getAuth(app)
        await sdk.setPersistence(auth, sdk.browserSessionPersistence)
        return { auth, sdk }
      })
      .catch((error) => {
        firebaseReady = null
        throw error
      })
    return firebaseReady
  }
  if (config.firebaseApiKey && config.firebaseAppId) void prepare().catch(() => {})
  function beginAttempt() {
    const currentAttempt = ++attempt
    currentUser = null
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const stopped = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        if (currentAttempt === attempt) attempt++
        reject(new Error(GOOGLE_SIGN_IN_TIMEOUT_MESSAGE))
        controller.abort()
      }, GOOGLE_SIGN_IN_TIMEOUT_MS)
    })
    const assertCurrent = () => {
      if (currentAttempt !== attempt) throw new Error('A newer sign-in attempt replaced this one.')
    }
    const waitFor = async <T>(operation: () => Promise<T>): Promise<T> => {
      assertCurrent()
      const result = await Promise.race([operation(), stopped])
      assertCurrent()
      return result
    }
    return {
      controller,
      assertCurrent,
      waitFor,
      finish: () => clearTimeout(timer),
    }
  }
  function sessionStorage() {
    return dependencies.sessionStorage?.() ?? window.sessionStorage
  }
  function pendingRedirect() {
    try {
      return sessionStorage().getItem(REDIRECT_MARKER)
    } catch {
      return null
    }
  }
  function clearRedirect(marker: string) {
    try {
      const storage = sessionStorage()
      if (storage.getItem(REDIRECT_MARKER) === marker) storage.removeItem(REDIRECT_MARKER)
    } catch {
      // Storage may become blocked after navigation. Never store an alternative copy.
    }
  }
  function checkSessionStorage() {
    // Probe only a temporary nonpersonal value; Firebase owns all sign-in persistence.
    const key = 'sal0:tutoring:storage-check:' + crypto.randomUUID()
    try {
      const storage = sessionStorage()
      try {
        storage.setItem(key, '1')
        if (storage.getItem(key) !== '1') throw new Error('Session storage is unavailable')
      } finally {
        storage.removeItem(key)
      }
    } catch {
      throw new Error(GOOGLE_SIGN_IN_STORAGE_MESSAGE)
    }
  }
  async function signInSameTab(): Promise<void> {
    const { waitFor, finish } = beginAttempt()
    const marker = crypto.randomUUID()
    try {
      checkSessionStorage()
      const { auth, sdk } = await waitFor(prepare)
      await waitFor(() => {
        try {
          const storage = sessionStorage()
          storage.setItem(REDIRECT_MARKER, marker)
          if (storage.getItem(REDIRECT_MARKER) !== marker) throw new Error('Storage unavailable')
        } catch {
          throw new Error(GOOGLE_SIGN_IN_STORAGE_MESSAGE)
        }
        return sdk.signInWithRedirect(auth, new sdk.GoogleAuthProvider())
      })
      // Starting navigation never authorizes an account or starts checkout.
    } catch (error) {
      clearRedirect(marker)
      throw error
    } finally {
      finish()
    }
  }
  async function authenticate(restore = false): Promise<GroupAccount | null> {
    const { controller, assertCurrent, waitFor, finish } = beginAttempt()
    const marker = restore && sameTabEnabled ? pendingRedirect() : null
    try {
      const { auth, sdk } = await waitFor(prepare)
      if (restore && auth.authStateReady) await waitFor(() => auth.authStateReady!())
      let candidate: FirebaseUser | null
      if (restore) {
        // Only an explicitly started redirect uses the helper. Share a result across
        // overlapping restores, without delaying unrelated saved-account restoration.
        if (marker) {
          let returning = redirectResults.get(auth)
          if (returning?.marker !== marker) {
            returning = {
              marker,
              promise: Promise.resolve().then(() => sdk.getRedirectResult(auth)),
            }
            redirectResults.set(auth, returning)
          }
          const pending = returning
          try {
            const result = await waitFor(() => pending.promise)
            candidate = result?.user ?? auth.currentUser
          } finally {
            clearRedirect(marker)
            if (redirectResults.get(auth) === pending) redirectResults.delete(auth)
          }
        } else candidate = auth.currentUser
      } else {
        candidate = (await waitFor(() => sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider())))
          .user
      }
      if (!candidate) return null
      const claims = (await waitFor(() => candidate.getIdTokenResult())).claims
      const enrolling = !Object.hasOwn(claims, 'sal0TutoringRole')
      if (
        !enrolling &&
        claims.sal0TutoringRole !== 'tutor' &&
        claims.sal0TutoringRole !== 'learner'
      )
        throw new Error(
          'This account does not have tutoring access. Please contact SAL0MANder for help.',
        )
      if (enrolling) {
        if (config.selfEnrollment !== true)
          throw new Error(
            'New parent or adult enrollment is not enabled. Please contact SAL0MANder for help.',
          )
        const provider = claims.firebase
        if (
          candidate.emailVerified !== true ||
          claims.email_verified !== true ||
          !provider ||
          typeof provider !== 'object' ||
          !('sign_in_provider' in provider) ||
          provider.sign_in_provider !== 'google.com'
        )
          throw new Error('Use an email-verified Google account for parent or adult enrollment.')
      }
      if (
        claims.firebase &&
        typeof claims.firebase === 'object' &&
        'sign_in_provider' in claims.firebase &&
        claims.firebase.sign_in_provider === 'anonymous'
      )
        throw new Error('Use your parent or adult Google account to continue.')
      const token = await waitFor(() => candidate.getIdToken())
      const post = async (path: string, idempotencyKey: string = crypto.randomUUID()) => {
        const response = await waitFor(() =>
          fetcher(config.apiBase + '/api/tutoring/v1' + path, {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            },
            body: '{}',
            redirect: 'error',
            credentials: 'omit',
            cache: 'no-store',
            signal: controller.signal,
          }),
        )
        if (!response.ok)
          throw new Error(
            'Your parent or adult account is not ready. Please contact SAL0MANder for help.',
          )
        return (await waitFor(() => response.json())).data
      }
      // Only the authenticated server response grants an app role. Browser claims are eligibility hints.
      const checkedProfile = ProfileSchema.safeParse(await post('/profile'))
      if (!checkedProfile.success)
        throw new Error('Your account could not be verified. Please contact SAL0MANder for help.')
      const profile = checkedProfile.data
      if (profile.uid !== candidate.uid || (enrolling && profile.role !== 'learner'))
        throw new Error('Your account could not be verified. Please contact SAL0MANder for help.')
      let learnerId = ''
      if (profile.role === 'learner') {
        const checkedLearner = LearnerSchema.safeParse(
          await post('/learners', 'sal0-primary-learner-v1'),
        )
        if (!checkedLearner.success)
          throw new Error(
            'Your learner record could not be verified. Please contact SAL0MANder for help.',
          )
        const learner = checkedLearner.data
        if (learner.ownerId !== profile.uid)
          throw new Error(
            'Your learner record could not be verified. Please contact SAL0MANder for help.',
          )
        learnerId = learner.id
      }
      assertCurrent()
      currentUser = candidate
      return {
        uid: profile.uid,
        learnerId,
        role: profile.role,
        label: candidate.email ?? 'Your account',
      }
    } finally {
      if (marker) clearRedirect(marker)
      finish()
    }
  }
  return {
    async signIn() {
      const account = await authenticate()
      if (!account) throw new Error('Please sign in to continue.')
      return account
    },
    restore: () => authenticate(true),
    ...(sameTabEnabled ? { signInSameTab } : {}),
    async authorization() {
      const user = currentUser
      const authorizedAttempt = attempt
      if (!user) throw new Error('Please sign in to continue.')
      const token = await user.getIdToken()
      if (currentUser !== user || authorizedAttempt !== attempt)
        throw new Error('Please sign in to continue.')
      return 'Bearer ' + token
    },
  }
}
export function groupRuntime() {
  const config = env.groups
  if (!config?.apiBase) return null
  const local =
    typeof location !== 'undefined' && ['127.0.0.1', 'localhost'].includes(location.hostname)
  if (config.demo && !local) return null
  if (!config.demo) return createGroupClient(config.apiBase, googleIdentity(config))
  let token = ''
  const identity: GroupIdentity = {
    async signIn(role = 'learner', demoParent = 1) {
      const response = await fetch(
        config.apiBase + '/demo/account?role=' + role + '&parent=' + demoParent,
        { credentials: 'omit' },
      )
      if (!response.ok) throw new Error('Local preview server is unavailable.')
      const value = (await response.json()) as {
        token: string
        account: GroupAccount
      }
      token = value.token
      return value.account
    },
    async authorization() {
      if (!token) throw new Error('Choose a preview account first.')
      return 'Bearer ' + token
    },
  }
  return createGroupClient(config.apiBase, identity, true)
}
