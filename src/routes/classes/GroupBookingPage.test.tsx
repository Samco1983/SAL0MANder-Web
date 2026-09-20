import { afterEach, expect, it, vi } from 'vitest'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { GroupBookingPage } from './GroupBookingPage'
import type { GroupClient, GroupClass, Reservation } from '@/groups/client'
import {
  googleIdentity,
  GOOGLE_SIGN_IN_TIMEOUT_MESSAGE,
  GOOGLE_SIGN_IN_TIMEOUT_MS,
} from '@/groups/runtime'
const enrollment = vi.hoisted(() => ({ enabled: false, testMode: false }))
vi.mock('@config/env', async (importOriginal) => {
  const original = await importOriginal<typeof import('@config/env')>()
  return {
    ...original,
    env: {
      ...original.env,
      groups: {
        ...original.env.groups,
        get selfEnrollment() {
          return enrollment.enabled
        },
        get testMode() {
          return enrollment.testMode
        },
      },
    },
  }
})
vi.mock('@/groups/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/groups/runtime')>()),
  groupRuntime: () => null,
}))
vi.mock('@routes/classroom/StudentPrepPanel', () => ({
  StudentPrepPanel: ({ context }: { context?: { accountId: string; learnerId: string } }) => (
    <div
      data-testid="student-prep-context"
      data-account={context?.accountId}
      data-learner={context?.learnerId}
    />
  ),
  createStudentPrepClient: () => ({}),
}))
const classOne: GroupClass = {
  id: 'a'.repeat(32),
  topic: 'Fractions',
  gradeBand: 'Grade 6',
  startsAt: Date.now() + 86400000,
  endsAt: Date.now() + 90000000,
  timeZone: 'America/Los_Angeles',
  capacity: 6,
  priceCents: 2000,
  currency: 'usd',
  state: 'scheduled',
  seatsAvailable: 6,
  confirmedSeats: 0,
  pendingSeats: 0,
}
const classTwo = { ...classOne, id: 'b'.repeat(32), topic: 'Algebra' }
const classesOnDifferentDates: GroupClass[] = [
  {
    ...classOne,
    startsAt: Date.parse('2026-09-14T01:00:00Z'),
    endsAt: Date.parse('2026-09-14T02:00:00Z'),
  },
  {
    ...classTwo,
    startsAt: Date.parse('2026-09-15T01:00:00Z'),
    endsAt: Date.parse('2026-09-15T02:00:00Z'),
  },
  {
    ...classOne,
    id: 'e'.repeat(32),
    topic: 'Geometry',
    startsAt: Date.parse('2026-09-15T02:15:00Z'),
    endsAt: Date.parse('2026-09-15T03:15:00Z'),
  },
]
const res: Reservation = {
  id: 'c'.repeat(32),
  classId: classTwo.id,
  learnerId: 'd'.repeat(32),
  state: 'confirmed',
  checkoutUrl: null,
  expiresAt: null,
  priceCents: 2000,
  currency: 'usd',
}
function client(overrides: Partial<GroupClient> = {}): GroupClient {
  return {
    demo: true,
    apiBase: 'http://127.0.0.1:5191',
    identity: {
      signIn: vi.fn().mockResolvedValue({
        uid: 'parent-1',
        learnerId: res.learnerId,
        role: 'learner',
        label: 'Parent',
      }),
      authorization: vi.fn().mockResolvedValue('Bearer demo'),
    },
    list: vi.fn().mockResolvedValue([classOne, classTwo]),
    create: vi.fn(),
    checkout: vi.fn().mockResolvedValue(res),
    reservation: vi.fn().mockResolvedValue(res),
    ...overrides,
  }
}
function show(c: GroupClient) {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <GroupBookingPage client={c} />
      </MemoryRouter>
    </ThemeProvider>,
  )
}
async function signIn() {
  fireEvent.click(screen.getByRole('checkbox', { name: /parent\/guardian/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Use preview parent' }))
  await screen.findByText('Signed in: Parent')
}

it('recovers an in-progress paid lesson on a fresh device without a new checkout and binds the selected child', async () => {
  const ongoing = {
    ...classTwo,
    startsAt: Date.now() - 60_000,
    endsAt: Date.now() + 3_540_000,
  }
  const otherChild = { ...res, learnerId: 'e'.repeat(32) }
  const c = client({
    list: vi.fn().mockResolvedValue([]),
    bookings: vi.fn().mockResolvedValue([{ group: ongoing, reservation: otherChild }]),
    join: vi.fn().mockResolvedValue({
      classId: ongoing.id,
      reservationId: res.id,
      topic: ongoing.topic,
      startsAt: ongoing.startsAt,
      state: 'open',
      opensAt: ongoing.startsAt - 600_000,
      closesAt: ongoing.endsAt,
      provider: 'google-meet',
      joinUrl: 'https://meet.google.com/abc-defg-hij',
    }),
  })
  sessionStorage.clear()
  show(c)
  await signIn()
  fireEvent.click(await screen.findByRole('button', { name: 'Open booked lesson' }))
  expect(await screen.findByRole('link', { name: 'Join lesson in Google Meet' })).toHaveAttribute(
    'href',
    'https://meet.google.com/abc-defg-hij',
  )
  expect(screen.getByTestId('student-prep-context')).toHaveAttribute(
    'data-learner',
    otherChild.learnerId,
  )
  expect(c.checkout).not.toHaveBeenCalled()
  expect(c.reservation).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh availability' }))
  await waitFor(() => expect(c.list).toHaveBeenCalledTimes(2))
  expect(screen.getByTestId('student-prep-context')).toHaveAttribute(
    'data-learner',
    otherChild.learnerId,
  )
  expect(screen.getByRole('link', { name: 'Join lesson in Google Meet' })).toBeInTheDocument()
})

it('resumes the selected child pending booking instead of creating a seat for the primary child', async () => {
  const pending = { ...res, learnerId: 'e'.repeat(32), state: 'pending' as const }
  const c = client({
    bookings: vi.fn().mockResolvedValue([{ group: classTwo, reservation: pending }]),
    checkout: vi.fn().mockResolvedValue({ ...pending, state: 'confirmed' }),
  })
  show(c)
  await signIn()
  fireEvent.click(await screen.findByRole('button', { name: 'View pending booking' }))
  fireEvent.click(screen.getByRole('button', { name: 'Pay $20 to secure a seat' }))
  await waitFor(() =>
    expect(c.checkout).toHaveBeenCalledWith(classTwo.id, pending.learnerId, expect.any(String)),
  )
  expect(c.checkout).toHaveBeenCalledTimes(1)
  expect(await screen.findByRole('button', { name: 'Seat confirmed' })).toBeDisabled()
  expect(screen.getByTestId('student-prep-context')).toHaveAttribute(
    'data-learner',
    pending.learnerId,
  )
})

it('does not downgrade a newly confirmed booking when reopening a stale pending list row', async () => {
  const pending = { ...res, state: 'pending' as const }
  const c = client({
    bookings: vi.fn().mockResolvedValue([{ group: classTwo, reservation: pending }]),
    reservation: vi.fn().mockResolvedValue(res),
  })
  show(c)
  await signIn()
  fireEvent.click(await screen.findByRole('button', { name: 'View pending booking' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check my payment status' }))
  await screen.findByText('Payment verified. Your seat is confirmed.')
  const open = await screen.findByRole('button', { name: 'Open booked lesson' })
  await waitFor(() => expect(open).toBeEnabled())
  fireEvent.click(open)
  expect(screen.getByText('Payment verified. Your seat is confirmed.')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Join your booked lesson' })).toBeInTheDocument()
  expect(c.checkout).not.toHaveBeenCalled()
})

it('loads the signed-in owner bookings even when a stale reservation URL cannot be restored', async () => {
  window.history.replaceState({}, '', '/classes?reservation=' + 'f'.repeat(32))
  const c = client({
    bookings: vi.fn().mockResolvedValue([{ group: classTwo, reservation: res }]),
    reservation: vi.fn().mockRejectedValue(new Error('Not your old reservation')),
  })
  show(c)
  await signIn()
  const open = await screen.findByRole('button', {
    name: 'Open booked lesson',
  })
  await waitFor(() => expect(open).toBeEnabled())
  fireEvent.click(open)
  expect(screen.getByRole('button', { name: 'Seat confirmed' })).toBeDisabled()
  expect(c.checkout).not.toHaveBeenCalled()
})
afterEach(() => {
  enrollment.enabled = false
  enrollment.testMode = false
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
  sessionStorage.clear()
})
it.each([
  { label: 'available classes', retriedClasses: [classOne] },
  { label: 'a genuinely empty schedule', retriedClasses: [] },
])(
  'shows a friendly load failure until a successful retry returns $label',
  async ({ retriedClasses }) => {
    const failure = new TypeError('Failed to fetch')
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const list = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(retriedClasses)
    const c = client({ list })
    show(c)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Availability is temporarily unavailable')
    expect(alert).toHaveTextContent('We couldn’t check the class schedule. Please try again.')
    expect(screen.queryByText('Failed to fetch')).toBeNull()
    expect(screen.queryByText(/New groups are being scheduled/)).toBeNull()
    expect(
      screen.queryByRole('heading', {
        name: 'Let’s find the right group for you',
      }),
    ).toBeNull()
    expect(warning).toHaveBeenCalledWith('Group availability could not be loaded.', failure)
    await signIn()
    expect(screen.getByRole('button', { name: 'Pay $20 to secure a seat' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Try availability again' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Refresh availability' })).toBeEnabled(),
    )
    expect(list).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
    if (retriedClasses.length > 0) {
      expect(screen.getByRole('button', { name: /Fractions.*of 6 seats/ })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Pay $20 to secure a seat' })).toBeEnabled()
      expect(screen.queryByText(/New groups are being scheduled/)).toBeNull()
    } else {
      expect(screen.getByText(/New groups are being scheduled/)).toBeVisible()
      expect(screen.getByRole('button', { name: 'Pay $20 to secure a seat' })).toBeDisabled()
    }
    expect(c.checkout).not.toHaveBeenCalled()
  },
)
it('keeps a verified reservation visible when refreshing availability fails', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  window.history.replaceState({}, '', '/classes?reservation=' + res.id)
  const c = client({
    list: vi
      .fn()
      .mockResolvedValueOnce([classOne, classTwo])
      .mockRejectedValueOnce(new TypeError('Failed to fetch')),
  })
  show(c)
  await screen.findByRole('button', { name: /Fractions/ })
  await signIn()
  await screen.findByText('Payment verified. Your seat is confirmed.')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh availability' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('The times shown may be out of date.')
  expect(screen.getByText('Payment verified. Your seat is confirmed.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Seat confirmed' })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Algebra.*of 6 seats/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.queryByText(/New groups are being scheduled/)).toBeNull()
  expect(c.checkout).not.toHaveBeenCalled()
})
it('invites optional parent/adult signup only when enrollment is enabled', async () => {
  enrollment.enabled = false
  const signInOnly = show(client({ demo: false }))
  await screen.findByRole('button', { name: /Fractions/ })
  expect(screen.queryByRole('note', { name: 'Stripe test mode' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  expect(screen.queryByText(/Create your parent or adult learner account/)).toBeNull()
  signInOnly.unmount()

  enrollment.enabled = true
  show(client({ demo: false }))
  await screen.findByRole('button', { name: /Fractions/ })
  expect(screen.getByText(/Create your parent or adult learner account with Google/)).toBeVisible()
  const signup = screen.getByRole('button', {
    name: 'Sign in or sign up with Google',
  })
  expect(signup).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /parent\/guardian/ }))
  expect(signup).toBeEnabled()
})
it('labels Stripe TEST checkout and its verified result without claiming a paid lesson', async () => {
  enrollment.testMode = true
  const checkout = vi.fn().mockResolvedValue({ ...res, classId: classOne.id })
  show(client({ demo: false, checkout }))
  await screen.findByRole('button', { name: /Fractions/ })
  const notice = screen.getByRole('note', { name: 'Stripe test mode' })
  expect(notice).toHaveTextContent('Stripe TEST mode — practice checkout only.')
  expect(notice).toHaveTextContent('No money is charged and no paid lesson is booked.')
  fireEvent.click(screen.getByRole('checkbox', { name: /parent\/guardian/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
  await screen.findByText('Signed in: Parent')
  expect(screen.queryByRole('button', { name: 'Pay $20 to secure a seat' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Start $20 test checkout' }))
  await screen.findByText('Test payment verified. No paid lesson is booked.')
  expect(screen.getByRole('button', { name: 'Test checkout complete' })).toBeDisabled()
  expect(screen.queryByText('Payment verified. Your seat is confirmed.')).toBeNull()
  expect(screen.queryByText(/Check Join your lesson below/)).toBeNull()
  expect(notice).toBeVisible()
  expect(checkout).toHaveBeenCalledOnce()
})
it('shows a bounded Google popup failure and restores the sign-in button', async () => {
  const popup = vi.fn(() => new Promise<never>(() => {}))
  const fetcher = vi.fn<typeof fetch>()
  const identity = googleIdentity(
    {
      apiBase: 'https://api.example.test',
      firebaseApiKey: 'synthetic-public-api-key',
      firebaseAppId: 'synthetic-public-app-id',
      selfEnrollment: true,
    },
    {
      prepareFirebase: async () => ({
        auth: { currentUser: null },
        sdk: {
          getAuth: () => ({ currentUser: null }),
          GoogleAuthProvider: class {},
          signInWithPopup: popup,
          signInWithRedirect: async () => undefined,
          getRedirectResult: async () => null,
          setPersistence: async () => undefined,
          browserSessionPersistence: {},
        },
      }),
      fetch: fetcher,
    },
  )
  const c = client({ demo: false, identity })
  show(c)
  await screen.findByRole('button', { name: /Fractions/ })
  fireEvent.click(screen.getByRole('checkbox', { name: /parent\/guardian/ }))
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
  expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(GOOGLE_SIGN_IN_TIMEOUT_MS)
  })
  expect(screen.getByRole('alert')).toHaveTextContent(GOOGLE_SIGN_IN_TIMEOUT_MESSAGE)
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  expect(screen.queryByText('Signed in: Parent')).toBeNull()
  expect(popup).toHaveBeenCalledOnce()
  expect(fetcher).not.toHaveBeenCalled()
  expect(c.checkout).not.toHaveBeenCalled()
  await expect(identity.authorization()).rejects.toThrow('Please sign in')
})
it('offers same-tab sign-in after adult acknowledgement and retains only the chosen session in the return URL', async () => {
  window.history.replaceState({ existing: true }, '', '/classes?reservation=' + res.id)
  let finish!: () => void
  const sameTab = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const base = client({ demo: false })
  const c = client({
    demo: false,
    identity: { ...base.identity, signInSameTab: sameTab },
  })
  show(c)
  const algebra = await screen.findByRole('button', {
    name: /Algebra.*of 6 seats/,
  })
  fireEvent.click(algebra)
  const alternate = screen.getByRole('button', {
    name: 'Sign in on this page',
  })
  expect(alternate).toBeDisabled()
  fireEvent.click(alternate)
  expect(sameTab).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox', { name: /parent\/guardian/ }))
  fireEvent.click(alternate)
  expect(sameTab).toHaveBeenCalledOnce()
  expect(new URLSearchParams(location.search).get('class')).toBe(classTwo.id)
  expect(new URLSearchParams(location.search).get('reservation')).toBe(res.id)
  expect(window.history.state).toEqual({ existing: true })
  expect(screen.getByRole('button', { name: 'Opening Google on this page…' })).toBeDisabled()
  expect(alternate).toBeDisabled()
  await act(async () => finish())
  expect(c.identity.signIn).not.toHaveBeenCalled()
  expect(c.checkout).not.toHaveBeenCalled()
  expect(screen.queryByText('Signed in: Parent')).toBeNull()
  expect(screen.queryByText(/Your seat is confirmed/)).toBeNull()
})
it('restores the selected class after Google returns but still requires an explicit payment action', async () => {
  window.history.replaceState({}, '', '/classes?class=' + classTwo.id)
  const base = client({ demo: false })
  const c = client({
    demo: false,
    identity: {
      ...base.identity,
      restore: vi.fn().mockResolvedValue({
        uid: 'parent-1',
        learnerId: res.learnerId,
        role: 'learner',
        label: 'Parent',
      }),
    },
  })
  show(c)
  await screen.findByText('Signed in: Parent')
  expect(await screen.findByRole('button', { name: /Algebra.*of 6 seats/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: /Fractions.*of 6 seats/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(screen.getByRole('button', { name: 'Pay $20 to secure a seat' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /parent\/guardian/ }))
  expect(screen.getByRole('button', { name: 'Pay $20 to secure a seat' })).toBeEnabled()
  expect(c.checkout).not.toHaveBeenCalled()
  expect(c.identity.signIn).not.toHaveBeenCalled()
})
it('preserves an unavailable requested session when starting same-tab sign-in', async () => {
  const unavailableId = 'f'.repeat(32)
  window.history.replaceState({}, '', '/classes?class=' + unavailableId)
  const base = client({ demo: false })
  const sameTab = vi.fn().mockResolvedValue(undefined)
  const c = client({
    demo: false,
    identity: { ...base.identity, signInSameTab: sameTab },
  })
  show(c)
  await screen.findByText('That session is no longer available. Please choose another time.')
  fireEvent.click(screen.getByRole('checkbox', { name: /parent\/guardian/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign in on this page' }))
  await waitFor(() => expect(sameTab).toHaveBeenCalledOnce())
  expect(new URLSearchParams(location.search).get('class')).toBe(unavailableId)
  expect(c.checkout).not.toHaveBeenCalled()
})
it('blocks another checkout while a returning reservation is still being verified', async () => {
  window.history.replaceState({}, '', '/classes?class=' + classTwo.id + '&reservation=' + res.id)
  let finishReservation!: (value: Reservation) => void
  const base = client({ demo: false })
  const reservation = vi.fn(
    () =>
      new Promise<Reservation>((resolve) => {
        finishReservation = resolve
      }),
  )
  const c = client({
    demo: false,
    reservation,
    identity: {
      ...base.identity,
      restore: vi.fn().mockResolvedValue({
        uid: 'parent-1',
        learnerId: res.learnerId,
        role: 'learner',
        label: 'Parent',
      }),
    },
  })
  show(c)
  await screen.findByText('Signed in: Parent')
  fireEvent.click(screen.getByRole('checkbox', { name: /parent\/guardian/ }))
  const checking = screen.getByRole('button', {
    name: 'Checking existing booking…',
  })
  expect(checking).toBeDisabled()
  fireEvent.click(checking)
  fireEvent.click(screen.getByRole('button', { name: 'Check my payment status' }))
  expect(c.checkout).not.toHaveBeenCalled()
  expect(reservation).toHaveBeenCalledOnce()
  await act(async () => finishReservation(res))
  expect(await screen.findByRole('button', { name: 'Seat confirmed' })).toBeDisabled()
  expect(screen.getByText('Payment verified. Your seat is confirmed.')).toBeVisible()
  expect(c.checkout).not.toHaveBeenCalled()
})
it('does not replace an unavailable return session with a different class', async () => {
  window.history.replaceState({}, '', '/classes?class=' + 'f'.repeat(32))
  const c = client()
  show(c)
  await screen.findByText('That session is no longer available. Please choose another time.')
  expect(screen.getByRole('button', { name: /Fractions.*of 6 seats/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(screen.getByRole('button', { name: /Algebra.*of 6 seats/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await signIn()
  expect(screen.getByRole('button', { name: 'Pay $20 to secure a seat' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Algebra.*of 6 seats/ }))
  expect(screen.getByRole('button', { name: 'Pay $20 to secure a seat' })).toBeEnabled()
  expect(
    screen.queryByText('That session is no longer available. Please choose another time.'),
  ).toBeNull()
  expect(c.checkout).not.toHaveBeenCalled()
})
it('leaves failed same-tab sign-in recoverable without claiming an account or taking payment', async () => {
  const base = client({ demo: false })
  const sameTab = vi
    .fn()
    .mockRejectedValue(new Error('Your browser cannot save the sign-in return.'))
  const c = client({
    demo: false,
    identity: { ...base.identity, signInSameTab: sameTab },
  })
  show(c)
  await screen.findByRole('button', { name: /Fractions/ })
  fireEvent.click(screen.getByRole('checkbox', { name: /parent\/guardian/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign in on this page' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your browser cannot save the sign-in return.',
  )
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Sign in on this page' })).toBeEnabled()
  expect(c.checkout).not.toHaveBeenCalled()
  expect(c.identity.signIn).not.toHaveBeenCalled()
  expect(screen.queryByText('Signed in: Parent')).toBeNull()
})
it('does not offer same-tab sign-in when the runtime does not support this host', async () => {
  show(client({ demo: false }))
  await screen.findByRole('button', { name: /Fractions/ })
  expect(screen.queryByRole('button', { name: 'Sign in on this page' })).toBeNull()
})
it('lets a tutor choose same-tab recovery after a failed popup without a learner checkout', async () => {
  const base = client({ demo: false })
  const sameTab = vi.fn().mockResolvedValue(undefined)
  const popup = vi.fn().mockRejectedValue(new Error('Google popup could not open.'))
  const c = client({
    demo: false,
    identity: { ...base.identity, signIn: popup, signInSameTab: sameTab },
  })
  show(c)
  await screen.findByRole('button', { name: /Fractions/ })
  fireEvent.click(screen.getByRole('button', { name: 'Tutor: open a session' }))
  await screen.findByRole('alert')
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Continue Google sign-in on this page',
    }),
  )
  await waitFor(() => expect(sameTab).toHaveBeenCalledOnce())
  expect(popup).toHaveBeenCalledWith('tutor', 1)
  expect(c.checkout).not.toHaveBeenCalled()
  expect(screen.queryByRole('form', { name: 'Open a group session' })).toBeNull()
})
it('filters time slots by Pacific date and starts checkout only for the chosen slot on payment', async () => {
  const selectedClass = classesOnDifferentDates[2]!
  const checkout = vi.fn().mockResolvedValue({
    ...res,
    classId: selectedClass.id,
    state: 'pending',
  })
  show(
    client({
      list: vi.fn().mockResolvedValue(classesOnDifferentDates),
      checkout,
    }),
  )
  await screen.findByRole('button', { name: /Fractions.*of 6 seats/ })
  const dates = within(screen.getByRole('navigation', { name: 'Available class dates' }))
  const firstDate = dates.getByRole('button', {
    name: 'Sunday, September 13, 2026',
  })
  const secondDate = dates.getByRole('button', {
    name: 'Monday, September 14, 2026',
  })
  expect(dates.getAllByRole('button')).toHaveLength(2)
  expect(firstDate).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: /Algebra.*of 6 seats/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Geometry.*of 6 seats/ })).toBeNull()

  fireEvent.click(secondDate)
  expect(secondDate).toHaveAttribute('aria-pressed', 'true')
  expect(firstDate).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByRole('button', { name: /Fractions.*of 6 seats/ })).toBeNull()
  expect(screen.getByRole('button', { name: /Algebra.*of 6 seats/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  fireEvent.click(screen.getByRole('button', { name: /Geometry.*of 6 seats/ }))
  expect(screen.getByRole('button', { name: /Geometry.*of 6 seats/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const review = within(screen.getByRole('complementary', { name: 'Your class and payment' }))
  expect(review.getByText('3. Review your session')).toBeVisible()
  expect(review.getByRole('heading', { name: 'Geometry' })).toBeVisible()
  expect(review.getByText('Mon, Sep 14 · 7:15 PM–8:15 PM Pacific')).toBeVisible()
  expect(checkout).not.toHaveBeenCalled()

  await signIn()
  expect(checkout).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Pay $20 to secure a seat' }))
  await screen.findByText('Payment has not been confirmed.')
  expect(checkout).toHaveBeenCalledExactlyOnceWith(
    selectedClass.id,
    res.learnerId,
    expect.any(String),
  )
  expect(screen.queryByText('Payment verified. Your seat is confirmed.')).toBeNull()
})
it('restores a paid reservation on another date and never labels another class confirmed', async () => {
  window.history.replaceState({}, '', '/classes?reservation=' + res.id)
  const c = client({
    list: vi.fn().mockResolvedValue(classesOnDifferentDates),
  })
  show(c)
  await screen.findByRole('button', { name: /Fractions/ })
  await signIn()
  expect(await screen.findByText('Payment verified. Your seat is confirmed.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Monday, September 14, 2026' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.queryByRole('button', { name: /Fractions.*of 6 seats/ })).toBeNull()
  expect(screen.getByRole('button', { name: /Algebra.*of 6 seats/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Refresh availability' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Refresh availability' })).toBeEnabled(),
  )
  expect(c.list).toHaveBeenCalledTimes(2)
  expect(screen.getByText('Payment verified. Your seat is confirmed.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Seat confirmed' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Sunday, September 13, 2026' }))
  expect(screen.getByRole('button', { name: /Fractions.*of 6 seats/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.queryByText('Payment verified. Your seat is confirmed.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pay $20 to secure a seat' })).toBeEnabled()
  expect(c.checkout).not.toHaveBeenCalled()
})
it.each([
  { breakAfterMinutes: undefined, expectedMinutes: 15 },
  { breakAfterMinutes: 10, expectedMinutes: 10 },
  { breakAfterMinutes: 0, expectedMinutes: 0 },
])(
  'keeps the tutor’s $expectedMinutes-minute break out of the client’s lesson view',
  async ({ breakAfterMinutes }) => {
    const group = { ...classesOnDifferentDates[0]!, breakAfterMinutes }
    show(client({ list: vi.fn().mockResolvedValue([group]) }))
    await screen.findByRole('button', { name: /Fractions.*of 6 seats/ })
    const review = within(screen.getByRole('complementary', { name: 'Your class and payment' }))
    expect(review.getByText('6:00 PM–7:00 PM')).toBeVisible()
    expect(review.getByText('Your lesson with your tutor · 60 minutes')).toBeVisible()
    expect(review.queryByText(/Tutor break/)).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Break between sessions' })).toBeNull()
  },
)
it.each([0, 10, 30])(
  'submits a tutor-selected %i-minute break when creating a class',
  async (minutes) => {
    const created = {
      ...classesOnDifferentDates[0]!,
      topic: 'Number confidence',
      breakAfterMinutes: minutes,
    }
    const create = vi.fn().mockResolvedValue(created)
    const base = client()
    const tutorSignIn = vi.fn().mockResolvedValue({
      uid: 'tutor-1',
      learnerId: '',
      role: 'tutor',
      label: 'Sam',
    })
    show(
      client({
        create,
        list: vi.fn().mockResolvedValueOnce([]).mockResolvedValue([created]),
        identity: { ...base.identity, signIn: tutorSignIn },
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tutor: open a session' }))
    await screen.findByRole('heading', { name: 'Choose when you can teach' })
    expect(tutorSignIn).toHaveBeenCalledWith('tutor', 1)
    fireEvent.click(screen.getByText(/Lesson details & break/))
    const breakSelect = screen.getByRole('combobox', {
      name: 'Break between sessions',
    })
    expect(breakSelect).toHaveValue('15')
    expect(
      within(breakSelect)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(['0', '5', '10', '15', '20', '30', '45', '60'])
    fireEvent.change(screen.getByLabelText('Math topic'), {
      target: { value: 'Number confidence' },
    })
    fireEvent.change(screen.getByLabelText('Grade or course'), {
      target: { value: 'Grade 6' },
    })
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-09-16' },
    })
    fireEvent.change(screen.getByLabelText('Start time · Pacific'), {
      target: { value: '16:30' },
    })
    fireEvent.change(breakSelect, { target: { value: String(minutes) } })
    expect(create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Open preview session' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledExactlyOnceWith(
        {
          topic: 'Number confidence',
          gradeBand: 'Grade 6',
          startsAt: '2026-09-16T23:30:00.000Z',
          breakAfterMinutes: minutes,
        },
        expect.any(String),
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Choose when you can teach' })).toBeNull(),
    )
  },
)
it('rotates the checkout request key after verified expiry so a retry can create a new hold', async () => {
  const checkout = vi
    .fn()
    .mockResolvedValueOnce({ ...res, classId: classOne.id, state: 'expired' })
    .mockResolvedValueOnce({
      ...res,
      classId: classOne.id,
      state: 'confirmed',
    })
  show(client({ checkout }))
  await screen.findByRole('button', { name: /Fractions/ })
  await signIn()
  fireEvent.click(screen.getByRole('button', { name: 'Pay $20 to secure a seat' }))
  await screen.findByText('Checkout expired. This seat is not booked.')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Pay $20 to secure a seat' })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Pay $20 to secure a seat' }))
  await screen.findByText('Payment verified. Your seat is confirmed.')
  expect(checkout.mock.calls).toHaveLength(2)
  expect(checkout.mock.calls[0]?.[2]).not.toBe(checkout.mock.calls[1]?.[2])
})
it('allows the server to resume an owned pending hold even when every seat is occupied', async () => {
  const checkout = vi.fn().mockResolvedValue({ ...res, classId: classOne.id, state: 'pending' })
  show(
    client({
      checkout,
      list: vi.fn().mockResolvedValue([{ ...classOne, seatsAvailable: 0, pendingSeats: 6 }]),
    }),
  )
  await screen.findByRole('button', { name: /Fractions/ })
  await signIn()
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Check availability or resume checkout',
    }),
  )
  await screen.findByText('Payment has not been confirmed.')
  expect(checkout).toHaveBeenCalledOnce()
})

it('opens a tutor session from only a date and time while retaining the default protected break', async () => {
  const created = {
    ...classOne,
    topic: 'Math support',
    gradeBand: 'Grades 6–12',
    breakAfterMinutes: 15,
  }
  const base = client()
  const create = vi.fn().mockResolvedValue(created)
  show(
    client({
      create,
      list: vi.fn().mockResolvedValue([created]),
      identity: {
        ...base.identity,
        signIn: vi.fn().mockResolvedValue({
          uid: 'tutor-1',
          learnerId: '',
          role: 'tutor',
          label: 'Tutor',
        }),
      },
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Tutor: open a session' }))
  const form = await screen.findByRole('form', {
    name: 'Open a group session',
  })
  expect(screen.queryByRole('checkbox', { name: /parent\/guardian/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Use preview parent' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Pay $20 to secure a seat' })).toBeNull()
  expect(screen.getByRole('complementary', { name: 'Your teaching session' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Choose when you can teach' })).toHaveFocus()
  expect(
    form.compareDocumentPosition(screen.getByRole('heading', { name: 'Your open dates' })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(form.querySelector('details')).not.toHaveAttribute('open')
  expect(create).not.toHaveBeenCalled()
  fireEvent.change(within(form).getByLabelText('Date'), {
    target: { value: '2026-09-16' },
  })
  fireEvent.change(within(form).getByLabelText('Start time · Pacific'), {
    target: { value: '16:30' },
  })
  fireEvent.click(within(form).getByRole('button', { name: 'Open preview session' }))
  await waitFor(() =>
    expect(create).toHaveBeenCalledExactlyOnceWith(
      {
        topic: 'Math support',
        gradeBand: 'Grades 6–12',
        startsAt: '2026-09-16T23:30:00.000Z',
        breakAfterMinutes: 15,
      },
      expect.any(String),
    ),
  )
  expect(await screen.findByText(/Session opened:.*6 of 6 learner seats/)).toBeVisible()
  expect(screen.getByText('Tutor break · 15 minutes')).toBeVisible()
})

it('does not advertise six open seats or a selected price when the schedule is empty', async () => {
  show(client({ list: vi.fn().mockResolvedValue([]) }))
  await screen.findByText(/New groups are being scheduled/)
  const review = within(screen.getByRole('complementary', { name: 'Your class and payment' }))
  expect(review.getByRole('heading', { name: 'Choose an available session' })).toBeVisible()
  expect(review.queryByRole('img')).toBeNull()
  expect(review.queryByText(/Your \$20 payment reserves/)).toBeNull()
  expect(review.queryByText('Open')).toBeNull()
})

it('guides an explicit time choice to review without starting checkout', async () => {
  const c = client()
  show(c)
  const next = await screen.findByRole('button', {
    name: /Algebra.*of 6 seats/,
  })
  fireEvent.click(next)
  const review = within(screen.getByRole('complementary', { name: 'Your class and payment' }))
  await waitFor(() => expect(review.getByRole('heading', { name: 'Algebra' })).toHaveFocus())
  expect(c.checkout).not.toHaveBeenCalled()
})

it('explains payment status when the signed-in learner has not started checkout', async () => {
  const c = client()
  show(c)
  await screen.findByRole('button', { name: /Fractions/ })
  await signIn()
  fireEvent.click(screen.getByRole('button', { name: 'Check my payment status' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No checkout to check yet.')
  expect(c.reservation).not.toHaveBeenCalled()
})

it('restores and verifies a returning booking without opening a popup or charging again', async () => {
  window.history.replaceState({}, '', '/classes?reservation=' + res.id)
  const base = client()
  const restore = vi.fn().mockResolvedValue({
    uid: 'parent-1',
    learnerId: res.learnerId,
    role: 'learner',
    label: 'Parent',
  })
  const c = client({ identity: { ...base.identity, restore } })
  show(c)
  await screen.findByText('Payment verified. Your seat is confirmed.')
  expect(restore).toHaveBeenCalledOnce()
  expect(c.reservation).toHaveBeenCalledExactlyOnceWith(res.id)
  expect(c.identity.signIn).not.toHaveBeenCalled()
  expect(c.checkout).not.toHaveBeenCalled()
})

it('does not turn a returning pending payment into a confirmed booking', async () => {
  sessionStorage.setItem('sal0-group-pending', res.id)
  const base = client()
  const c = client({
    identity: {
      ...base.identity,
      restore: vi.fn().mockResolvedValue({
        uid: 'parent-1',
        learnerId: res.learnerId,
        role: 'learner',
        label: 'Parent',
      }),
    },
    reservation: vi.fn().mockResolvedValue({ ...res, state: 'pending' }),
  })
  show(c)
  await screen.findByText('Payment has not been confirmed.')
  expect(screen.queryByText('Payment verified. Your seat is confirmed.')).toBeNull()
  expect(screen.queryByRole('region', { name: 'Join your booked lesson' })).toBeNull()
  expect(c.checkout).not.toHaveBeenCalled()
})

it('keeps a restored in-progress lesson joinable when it has left the public booking list', async () => {
  window.history.replaceState({}, '', '/classes?reservation=' + res.id)
  const base = client()
  const c = client({
    list: vi.fn().mockResolvedValue([]),
    identity: {
      ...base.identity,
      restore: vi.fn().mockResolvedValue({
        uid: 'parent-1',
        learnerId: res.learnerId,
        role: 'learner',
        label: 'Parent',
      }),
    },
    join: vi.fn().mockResolvedValue({
      classId: res.classId,
      reservationId: res.id,
      topic: 'Algebra',
      startsAt: Date.now() - 15 * 60000,
      state: 'open',
      opensAt: Date.now() - 25 * 60000,
      closesAt: Date.now() + 45 * 60000,
      provider: 'zoom',
      joinUrl: 'https://us02web.zoom.us/j/12345678901?pwd=example',
    }),
  })
  show(c)
  expect(await screen.findByRole('link', { name: 'Join lesson in Zoom' })).toHaveAttribute(
    'href',
    'https://us02web.zoom.us/j/12345678901?pwd=example',
  )
  expect(c.join).toHaveBeenCalledWith(res.id)
  expect(c.checkout).not.toHaveBeenCalled()
})
