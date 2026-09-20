import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  googleIdentity,
  GOOGLE_SIGN_IN_TIMEOUT_MESSAGE,
  GOOGLE_SIGN_IN_TIMEOUT_MS,
  GOOGLE_SIGN_IN_STORAGE_MESSAGE,
} from './runtime'

afterEach(() => vi.useRealTimers())

const learnerId = 'a'.repeat(32)
const redirectMarkerKey = 'sal0:tutoring:google-redirect-pending:v1'
const originalRedirectMarker = 'b0f93d87-dcc4-4fce-8cf3-3074a65fc61b'
const config = {
  apiBase: 'https://api.example.test',
  firebaseApiKey: 'synthetic-public-api-key',
  firebaseAppId: 'synthetic-public-app-id',
}
const verifiedClaims = {
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
}
function fixture(
  claims: Record<string, unknown> = verifiedClaims,
  options: {
    emailVerified?: boolean
    selfEnrollment?: boolean
    profile?: unknown
    learner?: unknown
    restored?: boolean
    origin?: string
    storageBlocked?: boolean
    storageSilent?: boolean
    pendingRedirect?: boolean
  } = {},
) {
  const user = {
    uid: 'parent',
    email: 'parent@example.test',
    emailVerified: options.emailVerified ?? true,
    getIdToken: vi.fn(async () => 'synthetic.token.signature'),
    getIdTokenResult: vi.fn(async () => ({ claims })),
  }
  const profile = options.profile ?? {
    uid: 'parent',
    role: 'learner',
    active: true,
    createdAt: 1,
  }
  const learner = options.learner ?? {
    id: learnerId,
    ownerId: 'parent',
    createdAt: 1,
  }
  const fetcher = vi.fn<typeof fetch>(
    async (input) =>
      new Response(
        JSON.stringify({
          data: String(input).endsWith('/profile') ? profile : learner,
        }),
        { status: 200 },
      ),
  )
  const sdk = {
    getAuth: () => ({ currentUser: null }),
    GoogleAuthProvider: class {},
    signInWithPopup: vi.fn(async () => ({ user })),
    signInWithRedirect: vi.fn<() => Promise<void>>(async () => undefined),
    getRedirectResult: vi.fn<() => Promise<{ user: typeof user } | null>>(async () => null),
    setPersistence: async () => undefined,
    browserSessionPersistence: {},
  }
  const auth = {
    currentUser: options.restored ? user : null,
    authStateReady: vi.fn(async () => undefined),
  }
  const prepareFirebase = vi.fn(async () => ({ auth, sdk }))
  const stored = new Map<string, string>()
  if (options.pendingRedirect) stored.set(redirectMarkerKey, originalRedirectMarker)
  const storage = {
    setItem: vi.fn((key: string, value: string) => {
      if (!options.storageSilent) stored.set(key, value)
    }),
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    removeItem: vi.fn((key: string) => {
      stored.delete(key)
    }),
  }
  const identity = googleIdentity(
    { ...config, selfEnrollment: options.selfEnrollment },
    {
      prepareFirebase,
      fetch: fetcher,
      origin: options.origin ?? 'https://other.example.test',
      sessionStorage: () => {
        if (options.storageBlocked) throw new Error('SecurityError')
        return storage
      },
    },
  )
  return {
    identity,
    user,
    fetcher,
    sdk,
    prepareFirebase,
    auth,
    storage,
    stored,
  }
}

describe('Google parent/adult enrollment browser flow', () => {
  it('restores an existing account without a popup and rechecks its server role and learner ownership', async () => {
    const f = fixture({ ...verifiedClaims, sal0TutoringRole: 'learner' }, { restored: true })
    expect(await f.identity.restore!()).toMatchObject({
      uid: 'parent',
      role: 'learner',
      learnerId,
    })
    expect(f.auth.authStateReady).toHaveBeenCalled()
    expect(f.sdk.signInWithPopup).not.toHaveBeenCalled()
    expect(f.fetcher).toHaveBeenCalledTimes(2)
    expect(await f.identity.authorization()).toBe('Bearer synthetic.token.signature')
  })
  it('does not create an account or open sign-in when no saved account exists', async () => {
    const f = fixture()
    expect(await f.identity.restore!()).toBeNull()
    expect(f.sdk.signInWithPopup).not.toHaveBeenCalled()
    expect(f.fetcher).not.toHaveBeenCalled()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it('rejects a restored account when the server returns someone else’s learner', async () => {
    const f = fixture(
      { ...verifiedClaims, sal0TutoringRole: 'learner' },
      {
        restored: true,
        learner: { id: learnerId, ownerId: 'someone-else', createdAt: 1 },
      },
    )
    await expect(f.identity.restore!()).rejects.toThrow('Your learner record could not be verified')
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
    expect(f.sdk.signInWithPopup).not.toHaveBeenCalled()
  })
  it('times out a stalled popup, ignores its late result, and permits a fresh verified sign-in', async () => {
    vi.useFakeTimers()
    const f = fixture(verifiedClaims, { selfEnrollment: true })
    let resolvePopup!: (result: { user: typeof f.user }) => void
    f.sdk.signInWithPopup.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePopup = resolve
        }),
    )
    const failure = expect(f.identity.signIn()).rejects.toThrow(GOOGLE_SIGN_IN_TIMEOUT_MESSAGE)
    await vi.advanceTimersByTimeAsync(GOOGLE_SIGN_IN_TIMEOUT_MS)
    await failure
    expect(f.fetcher).not.toHaveBeenCalled()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
    expect(vi.getTimerCount()).toBe(0)

    expect((await f.identity.signIn()).uid).toBe('parent')
    expect(f.fetcher).toHaveBeenCalledTimes(2)
    const tokenChecks = f.user.getIdTokenResult.mock.calls.length
    resolvePopup({ user: f.user })
    await vi.advanceTimersByTimeAsync(0)
    expect(f.fetcher).toHaveBeenCalledTimes(2)
    expect(f.user.getIdTokenResult).toHaveBeenCalledTimes(tokenChecks)
    expect(await f.identity.authorization()).toBe('Bearer synthetic.token.signature')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('bounds SDK preparation before opening any popup', async () => {
    vi.useFakeTimers()
    const f = fixture(verifiedClaims, { selfEnrollment: true })
    f.prepareFirebase.mockImplementationOnce(() => new Promise(() => {}))
    const failure = expect(f.identity.signIn()).rejects.toThrow(GOOGLE_SIGN_IN_TIMEOUT_MESSAGE)
    await vi.advanceTimersByTimeAsync(GOOGLE_SIGN_IN_TIMEOUT_MS)
    await failure
    expect(f.sdk.signInWithPopup).not.toHaveBeenCalled()
    expect(f.fetcher).not.toHaveBeenCalled()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it('aborts a stalled profile request and never creates a learner from its late response', async () => {
    vi.useFakeTimers()
    const f = fixture(verifiedClaims, { selfEnrollment: true })
    let resolveProfile!: (response: Response) => void
    f.fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve
        }),
    )
    const failure = expect(f.identity.signIn()).rejects.toThrow(GOOGLE_SIGN_IN_TIMEOUT_MESSAGE)
    await vi.advanceTimersByTimeAsync(0)
    const signal = f.fetcher.mock.calls[0]![1]!.signal!
    expect(signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(GOOGLE_SIGN_IN_TIMEOUT_MS)
    await failure
    expect(signal.aborted).toBe(true)
    resolveProfile(
      new Response(
        JSON.stringify({
          data: { uid: 'parent', role: 'learner', active: true, createdAt: 1 },
        }),
      ),
    )
    await vi.advanceTimersByTimeAsync(0)
    expect(f.fetcher).toHaveBeenCalledTimes(1)
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('keeps optional signup disabled without its public flag and does not authenticate a failed account', async () => {
    const f = fixture()
    await expect(f.identity.signIn()).rejects.toThrow(
      'New parent or adult enrollment is not enabled',
    )
    expect(f.fetcher).not.toHaveBeenCalled()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it('uses authenticated server profile/learner responses, sends no requested role, and reuses the stable learner key', async () => {
    const f = fixture(verifiedClaims, { selfEnrollment: true })
    // A caller cannot grant itself the tutor role through the GroupIdentity demo argument.
    expect(await f.identity.signIn('tutor')).toEqual({
      uid: 'parent',
      learnerId,
      role: 'learner',
      label: 'parent@example.test',
    })
    expect(f.fetcher).toHaveBeenCalledTimes(2)
    expect(f.fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      config.apiBase + '/api/tutoring/v1/profile',
      config.apiBase + '/api/tutoring/v1/learners',
    ])
    for (const [, request] of f.fetcher.mock.calls) {
      expect(request).toMatchObject({
        body: '{}',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
      })
      expect(new Headers(request?.headers).get('Authorization')).toBe(
        'Bearer synthetic.token.signature',
      )
    }
    expect(new Headers(f.fetcher.mock.calls[1]![1]?.headers).get('Idempotency-Key')).toBe(
      'sal0-primary-learner-v1',
    )
    expect(await f.identity.authorization()).toBe('Bearer synthetic.token.signature')
  })
  it.each([
    {},
    { email_verified: true },
    { ...verifiedClaims, firebase: {} },
    { ...verifiedClaims, firebase: { sign_in_provider: 'anonymous' } },
    { ...verifiedClaims, firebase: { sign_in_provider: 'password' } },
    { ...verifiedClaims, email_verified: false },
    { ...verifiedClaims, email_verified: 'true' },
  ])('rejects ineligible Google enrollment without posting a profile', async (claims) => {
    const f = fixture(claims, { selfEnrollment: true })
    await expect(f.identity.signIn()).rejects.toThrow('email-verified Google account')
    expect(f.fetcher).not.toHaveBeenCalled()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it('also requires verified email on the current Google user and does not accept malformed role claims', async () => {
    const unverified = fixture(verifiedClaims, {
      selfEnrollment: true,
      emailVerified: false,
    })
    await expect(unverified.identity.signIn()).rejects.toThrow('email-verified Google account')
    for (const role of [null, false, 'admin', 'revoked', undefined, { toString: () => 'tutor' }]) {
      const f = fixture({ ...verifiedClaims, sal0TutoringRole: role }, { selfEnrollment: true })
      await expect(f.identity.signIn()).rejects.toThrow('does not have tutoring access')
      expect(f.fetcher).not.toHaveBeenCalled()
    }
  })
  it('allows existing claimed accounts with enrollment off but uses the server role instead of a forged browser tutor hint', async () => {
    const f = fixture({ ...verifiedClaims, sal0TutoringRole: 'tutor' })
    expect((await f.identity.signIn()).role).toBe('learner')
    const tutor = fixture(
      { ...verifiedClaims, sal0TutoringRole: 'tutor' },
      { profile: { uid: 'parent', role: 'tutor', active: true, createdAt: 1 } },
    )
    expect((await tutor.identity.signIn()).role).toBe('tutor')
    expect(tutor.fetcher).toHaveBeenCalledTimes(1)
  })
  it('cannot bypass a disabled server flag or role denial and clears authorization after a failed repeat sign-in', async () => {
    const f = fixture(verifiedClaims, { selfEnrollment: true })
    await f.identity.signIn()
    f.fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'unauthenticated', detail: 'private server message' },
        }),
        { status: 401 },
      ),
    )
    await expect(f.identity.signIn()).rejects.toThrow('parent or adult account is not ready')
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
    expect(f.fetcher).toHaveBeenCalledTimes(3)
  })
  it.each([
    { uid: 'other', role: 'learner', active: true, createdAt: 1 },
    { uid: 'parent', role: 'tutor', active: true, createdAt: 1 },
    { uid: 'parent', role: 'admin', active: true, createdAt: 1 },
    { uid: 'parent', role: 'learner', active: false, createdAt: 1 },
  ])('rejects a mismatched, privileged or inactive enrollment response', async (profile) => {
    const f = fixture(verifiedClaims, { selfEnrollment: true, profile })
    await expect(f.identity.signIn()).rejects.toThrow('account could not be verified')
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it('rejects a learner record that belongs to another account', async () => {
    const f = fixture(verifiedClaims, {
      selfEnrollment: true,
      learner: { id: learnerId, ownerId: 'other', createdAt: 1 },
    })
    await expect(f.identity.signIn()).rejects.toThrow('learner record could not be verified')
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
})

const sameTabOrigin = 'https://sal0mander-math.firebaseapp.com'
describe('optional same-tab Google sign-in', () => {
  it.each([
    'https://sal0mander-math.web.app',
    'https://salomandermath.com',
    'https://sal0mander.com',
    'http://sal0mander-math.firebaseapp.com',
    'https://sal0mander-math.firebaseapp.com.evil.test',
    'http://localhost:5173',
  ])('keeps %s on the existing popup path', async (origin) => {
    const f = fixture(verifiedClaims, { origin, selfEnrollment: true })
    expect(f.identity.signInSameTab).toBeUndefined()
    expect(await f.identity.restore!()).toBeNull()
    await f.identity.signIn()
    expect(f.sdk.signInWithPopup).toHaveBeenCalledOnce()
    expect(f.sdk.signInWithRedirect).not.toHaveBeenCalled()
    expect(f.sdk.getRedirectResult).not.toHaveBeenCalled()
  })
  it('starts only the explicit redirect, clears app authorization and removes its nonpersonal storage probe', async () => {
    const f = fixture(verifiedClaims, {
      origin: sameTabOrigin,
      selfEnrollment: true,
    })
    await f.identity.signIn()
    expect(f.sdk.getRedirectResult).not.toHaveBeenCalled()
    f.fetcher.mockClear()
    const redirect = f.identity.signInSameTab!()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
    await redirect
    expect(f.sdk.signInWithRedirect).toHaveBeenCalledWith(
      f.auth,
      expect.any(f.sdk.GoogleAuthProvider),
    )
    expect(f.fetcher).not.toHaveBeenCalled()
    expect([...f.stored.keys()]).toEqual([redirectMarkerKey])
    expect(f.stored.get(redirectMarkerKey)).toMatch(/^[\da-f-]{36}$/)
    expect(f.storage.setItem).toHaveBeenCalledWith(
      expect.stringMatching(/^sal0:tutoring:storage-check:/),
      '1',
    )
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it.each([{ storageBlocked: true }, { storageSilent: true }])(
    'fails before redirect when session storage is unavailable: %j',
    async (storageOption) => {
      const f = fixture(verifiedClaims, {
        origin: sameTabOrigin,
        ...storageOption,
      })
      await expect(f.identity.signInSameTab!()).rejects.toThrow(GOOGLE_SIGN_IN_STORAGE_MESSAGE)
      expect(f.sdk.signInWithRedirect).not.toHaveBeenCalled()
      expect(f.fetcher).not.toHaveBeenCalled()
      expect(f.stored.size).toBe(0)
      await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
    },
  )
  it('verifies a redirect-return user with the same server role and stable learner flow', async () => {
    const f = fixture(verifiedClaims, {
      origin: sameTabOrigin,
      selfEnrollment: true,
      pendingRedirect: true,
    })
    f.sdk.getRedirectResult.mockResolvedValueOnce({ user: f.user })
    expect(await f.identity.restore!()).toMatchObject({
      uid: 'parent',
      role: 'learner',
      learnerId,
    })
    expect(f.auth.currentUser).toBeNull()
    expect(f.fetcher).toHaveBeenCalledTimes(2)
    expect(new Headers(f.fetcher.mock.calls[1]![1]?.headers).get('Idempotency-Key')).toBe(
      'sal0-primary-learner-v1',
    )
    expect(await f.identity.authorization()).toBe('Bearer synthetic.token.signature')
    expect(f.sdk.signInWithPopup).not.toHaveBeenCalled()
    expect(f.sdk.signInWithRedirect).not.toHaveBeenCalled()
    // A consumed redirect cannot resurrect an account when Firebase has no current user.
    expect(await f.identity.restore!()).toBeNull()
    expect(f.sdk.getRedirectResult).toHaveBeenCalledOnce()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it('uses currentUser only after a null redirect result, and returns null for cancellation with no account', async () => {
    const empty = fixture(verifiedClaims, { origin: sameTabOrigin, pendingRedirect: true })
    expect(await empty.identity.restore!()).toBeNull()
    expect(empty.fetcher).not.toHaveBeenCalled()
    expect(empty.sdk.signInWithRedirect).not.toHaveBeenCalled()
    const restored = fixture(
      { ...verifiedClaims, sal0TutoringRole: 'learner' },
      { origin: sameTabOrigin, restored: true, pendingRedirect: true },
    )
    expect(await restored.identity.restore!()).toMatchObject({
      uid: 'parent',
      learnerId,
    })
    expect(restored.sdk.getRedirectResult).toHaveBeenCalledOnce()
    expect(restored.fetcher).toHaveBeenCalledTimes(2)
  })
  it('propagates provider cancellation without retrying or authorizing', async () => {
    const f = fixture(verifiedClaims, { origin: sameTabOrigin, pendingRedirect: true })
    f.sdk.getRedirectResult.mockRejectedValueOnce(new Error('auth/redirect-cancelled-by-user'))
    await expect(f.identity.restore!()).rejects.toThrow('redirect-cancelled-by-user')
    expect(f.fetcher).not.toHaveBeenCalled()
    expect(f.sdk.signInWithRedirect).not.toHaveBeenCalled()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it('rejects server denial and cross-account learner ownership after redirect return', async () => {
    const denied = fixture(verifiedClaims, {
      origin: sameTabOrigin,
      selfEnrollment: true,
      pendingRedirect: true,
    })
    denied.sdk.getRedirectResult.mockResolvedValueOnce({ user: denied.user })
    denied.fetcher.mockResolvedValueOnce(new Response('{}', { status: 403 }))
    await expect(denied.identity.restore!()).rejects.toThrow('account is not ready')
    await expect(denied.identity.authorization()).rejects.toThrow('Please sign in')
    const crossed = fixture(verifiedClaims, {
      origin: sameTabOrigin,
      selfEnrollment: true,
      pendingRedirect: true,
      learner: { id: learnerId, ownerId: 'other', createdAt: 1 },
    })
    crossed.sdk.getRedirectResult.mockResolvedValueOnce({ user: crossed.user })
    await expect(crossed.identity.restore!()).rejects.toThrow(
      'learner record could not be verified',
    )
    await expect(crossed.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it('bounds preparation and never redirects when it completes after timeout', async () => {
    vi.useFakeTimers()
    const f = fixture(verifiedClaims, { origin: sameTabOrigin })
    let ready!: (value: { auth: typeof f.auth; sdk: typeof f.sdk }) => void
    f.prepareFirebase.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          ready = resolve
        }),
    )
    const failure = expect(f.identity.signInSameTab!()).rejects.toThrow(
      GOOGLE_SIGN_IN_TIMEOUT_MESSAGE,
    )
    await vi.advanceTimersByTimeAsync(GOOGLE_SIGN_IN_TIMEOUT_MS)
    await failure
    ready({ auth: f.auth, sdk: f.sdk })
    await vi.advanceTimersByTimeAsync(0)
    expect(f.sdk.signInWithRedirect).not.toHaveBeenCalled()
    expect(f.fetcher).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('bounds redirect initiation without granting authorization on late completion', async () => {
    vi.useFakeTimers()
    const f = fixture(verifiedClaims, { origin: sameTabOrigin })
    let finish!: () => void
    f.sdk.signInWithRedirect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const failure = expect(f.identity.signInSameTab!()).rejects.toThrow(
      GOOGLE_SIGN_IN_TIMEOUT_MESSAGE,
    )
    await vi.advanceTimersByTimeAsync(GOOGLE_SIGN_IN_TIMEOUT_MS)
    await failure
    finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(f.sdk.signInWithRedirect).toHaveBeenCalledOnce()
    expect(f.fetcher).not.toHaveBeenCalled()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('ignores a redirect return after timeout', async () => {
    vi.useFakeTimers()
    const f = fixture(verifiedClaims, {
      origin: sameTabOrigin,
      selfEnrollment: true,
      pendingRedirect: true,
    })
    let returned!: (value: { user: typeof f.user }) => void
    f.sdk.getRedirectResult.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          returned = resolve
        }),
    )
    const failure = expect(f.identity.restore!()).rejects.toThrow(GOOGLE_SIGN_IN_TIMEOUT_MESSAGE)
    await vi.advanceTimersByTimeAsync(GOOGLE_SIGN_IN_TIMEOUT_MS)
    await failure
    returned({ user: f.user })
    await vi.advanceTimersByTimeAsync(0)
    expect(f.fetcher).not.toHaveBeenCalled()
    expect(f.user.getIdTokenResult).not.toHaveBeenCalled()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
  })
  it('cannot replace a newer popup sign-in with a late superseded redirect return', async () => {
    vi.useFakeTimers()
    const f = fixture(verifiedClaims, {
      origin: sameTabOrigin,
      selfEnrollment: true,
      pendingRedirect: true,
    })
    let returned!: (value: { user: typeof f.user }) => void
    f.sdk.getRedirectResult.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          returned = resolve
        }),
    )
    const failure = expect(f.identity.restore!()).rejects.toThrow('newer sign-in attempt')
    await vi.advanceTimersByTimeAsync(0)
    await f.identity.signIn()
    returned({ user: { ...f.user, uid: 'old-account' } })
    await failure
    expect(f.fetcher).toHaveBeenCalledTimes(2)
    expect(await f.identity.authorization()).toBe('Bearer synthetic.token.signature')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not release an old in-flight authorization token after same-tab sign-in starts', async () => {
    const f = fixture(verifiedClaims, {
      origin: sameTabOrigin,
      selfEnrollment: true,
    })
    await f.identity.signIn()
    let returned!: (token: string) => void
    f.user.getIdToken.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          returned = resolve
        }),
    )
    const failure = expect(f.identity.authorization()).rejects.toThrow('Please sign in')
    await f.identity.signInSameTab!()
    returned('old.token')
    await failure
  })
  it('does not call a stalled redirect helper during ordinary saved-account restoration', async () => {
    const f = fixture(
      { ...verifiedClaims, sal0TutoringRole: 'learner' },
      {
        origin: sameTabOrigin,
        restored: true,
      },
    )
    f.sdk.getRedirectResult.mockImplementation(() => new Promise(() => {}))
    expect(await f.identity.restore!()).toMatchObject({ uid: 'parent', learnerId })
    expect(await f.identity.restore!()).toMatchObject({ uid: 'parent', learnerId })
    expect(f.sdk.getRedirectResult).not.toHaveBeenCalled()
    expect(f.sdk.signInWithRedirect).not.toHaveBeenCalled()
  })
  it('shares one redirect result across overlapping restores and only authorizes the current attempt', async () => {
    vi.useFakeTimers()
    const f = fixture(verifiedClaims, {
      origin: sameTabOrigin,
      selfEnrollment: true,
      pendingRedirect: true,
    })
    let returned!: (value: { user: typeof f.user }) => void
    f.sdk.getRedirectResult.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          returned = resolve
        }),
    )
    const superseded = expect(f.identity.restore!()).rejects.toThrow('newer sign-in attempt')
    await vi.advanceTimersByTimeAsync(0)
    const active = f.identity.restore!()
    await vi.advanceTimersByTimeAsync(0)
    expect(f.sdk.getRedirectResult).toHaveBeenCalledOnce()
    returned({ user: f.user })
    await superseded
    expect(await active).toMatchObject({ uid: 'parent', learnerId })
    expect(f.fetcher).toHaveBeenCalledTimes(2)
    expect(f.stored.size).toBe(0)
    expect(await f.identity.authorization()).toBe('Bearer synthetic.token.signature')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('cannot clear a newer redirect marker when an old return times out or completes late', async () => {
    vi.useFakeTimers()
    const f = fixture(verifiedClaims, {
      origin: sameTabOrigin,
      selfEnrollment: true,
      pendingRedirect: true,
    })
    let returned!: (value: { user: typeof f.user }) => void
    f.sdk.getRedirectResult.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          returned = resolve
        }),
    )
    const failed = expect(f.identity.restore!()).rejects.toThrow(GOOGLE_SIGN_IN_TIMEOUT_MESSAGE)
    await vi.advanceTimersByTimeAsync(0)
    await f.identity.signInSameTab!()
    const newerMarker = f.stored.get(redirectMarkerKey)
    expect(newerMarker).toBeTruthy()
    expect(newerMarker).not.toBe(originalRedirectMarker)
    await vi.advanceTimersByTimeAsync(GOOGLE_SIGN_IN_TIMEOUT_MS)
    await failed
    expect(f.stored.get(redirectMarkerKey)).toBe(newerMarker)
    returned({ user: f.user })
    await vi.advanceTimersByTimeAsync(0)
    expect(f.stored.get(redirectMarkerKey)).toBe(newerMarker)
    expect(f.fetcher).not.toHaveBeenCalled()
    await expect(f.identity.authorization()).rejects.toThrow('Please sign in')
    expect(vi.getTimerCount()).toBe(0)
  })
})
