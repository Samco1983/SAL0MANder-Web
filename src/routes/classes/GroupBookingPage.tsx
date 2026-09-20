import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import { paths } from '@config/routes'
import { env } from '@config/env'
import { groupRuntime } from '@/groups/runtime'
import {
  pacificStart,
  safeCheckoutUrl,
  type GroupClient,
  type GroupClass,
  type GroupAccount,
  type Reservation,
  type OwnedBooking,
} from '@/groups/client'
import { StudentPrepPanel, createStudentPrepClient } from '@routes/classroom/StudentPrepPanel'
import styles from './GroupBookingPage.module.css'
import { TutorClassPanel } from './TutorClassPanel'
import { ClassMeetingPanel } from './ClassMeetingPanel'
import { ReservationJoinPanel } from './ReservationJoinPanel'
import { YourBookings } from './YourBookings'

const dateLabel = (ms: number) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(ms)
const timeLabel = (ms: number) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ms)
const fullDateLabel = (ms: number) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(ms)
function SeatIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="9" r="5" />
      <path d="M6 28v-5a10 10 0 0 1 20 0v5z" />
    </svg>
  )
}
export function GroupBookingPage({ client: provided }: { client?: GroupClient | null }) {
  const client = useMemo(() => (provided === undefined ? groupRuntime() : provided), [provided])
  const allowEnrollment = !!client && !client.demo && env.groups.selfEnrollment
  const testMode = env.groups.testMode
  const [requestedClassId] = useState(() => {
    const value = new URLSearchParams(location.search).get('class') ?? ''
    return /^[a-f0-9]{32}$/.test(value) ? value : ''
  })
  const [classes, setClasses] = useState<GroupClass[]>([])
  const [selected, setSelected] = useState(requestedClassId)
  const [account, setAccount] = useState<GroupAccount | null>(null)
  const isTutor = account?.role === 'tutor'
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const studioHeading = useRef<HTMLHeadingElement>(null)
  const [reviewLearner, setReviewLearner] = useState('')
  const [reviewRevision, setReviewRevision] = useState(0)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [recoveredGroup, setRecoveredGroup] = useState<GroupClass | null>(null)
  const recoveredGroupId = useRef('')
  const [busy, setBusy] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [signInRole, setSignInRole] = useState<'tutor' | 'learner'>('learner')
  const [restoring, setRestoring] = useState(!!client?.identity.restore)
  const [loading, setLoading] = useState(!!client)
  const [availabilityFailed, setAvailabilityFailed] = useState(false)
  const [error, setError] = useState('')
  const [adult, setAdult] = useState(false)
  const [demoParent, setDemoParent] = useState(1)
  const [showStudio, setShowStudio] = useState(false)
  const [publishMessage, setPublishMessage] = useState('')
  const [topic, setTopic] = useState('Math support')
  const [grade, setGrade] = useState('Grades 6–12')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('16:30')
  const [breakAfterMinutes, setBreakAfterMinutes] = useState(15)
  const [checkoutKeys] = useState(() => new Map<string, string>())
  const [createKey, setCreateKey] = useState(() => crypto.randomUUID())
  const active =
    classes.find((c) => c.id === selected) ??
    (recoveredGroup?.id === selected ? recoveredGroup : undefined)
  const activeBreakMinutes = active?.breakAfterMinutes ?? 15
  const availableDates = Array.from(
    new Map(classes.map((c) => [fullDateLabel(c.startsAt), c.startsAt])),
  )
  const selectedDate = active ? fullDateLabel(active.startsAt) : availableDates[0]?.[0]
  const visibleClasses = classes.filter((c) => fullDateLabel(c.startsAt) === selectedDate)
  function focusStep(element: HTMLElement | null) {
    if (!element) return
    element.focus({ preventScroll: true })
    element.scrollIntoView?.({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    })
  }
  useEffect(() => {
    if (showStudio && isTutor) focusStep(studioHeading.current)
  }, [showStudio, isTutor])
  function chooseClass(id: string, review = false) {
    setRecoveredGroup(null)
    recoveredGroupId.current = ''
    setSelected(id)
    setReviewLearner('')
    setReservation(null)
    if (review) requestAnimationFrame(() => focusStep(reviewHeading.current))
  }
  const activeReservation = reservation?.classId === selected ? reservation : null
  const rememberReservation = useCallback(
    (next: Reservation) => {
      setReservation(next)
      setSelected(next.classId)
      if (next.state === 'expired') checkoutKeys.delete(next.classId + ':' + next.learnerId)
    },
    [checkoutKeys],
  )
  function openBooking(booking: OwnedBooking) {
    recoveredGroupId.current = booking.group.id
    setRecoveredGroup(booking.group)
    setReviewLearner('')
    setError('')
    rememberReservation(booking.reservation)
    try {
      sessionStorage.setItem('sal0-group-pending', booking.reservation.id)
    } catch {
      /* Server discovery works without browser storage. */
    }
    requestAnimationFrame(() => focusStep(reviewHeading.current))
  }
  const prepClient = useMemo(
    () =>
      client
        ? createStudentPrepClient({
            apiBaseUrl: client.apiBase + '/api/tutoring/v1',
            getAuthorization: () => client.identity.authorization(),
          })
        : undefined,
    [client],
  )
  const refresh = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      const next = await client.list()
      setClasses(next)
      setAvailabilityFailed(false)
      setSelected((old) =>
        (recoveredGroupId.current !== '' && old === recoveredGroupId.current) ||
        next.some((c) => c.id === old)
          ? old
          : requestedClassId
            ? ''
            : (next[0]?.id ?? ''),
      )
    } catch (e) {
      console.warn('Group availability could not be loaded.', e)
      setAvailabilityFailed(true)
    } finally {
      setLoading(false)
    }
  }, [client, requestedClassId])
  useEffect(() => {
    void refresh()
  }, [refresh]) // requests do not reserve or purchase seats
  useEffect(() => {
    if (!client?.identity.restore) return
    let current = true
    setRestoring(true)
    void client.identity
      .restore()
      .then(async (next) => {
        if (!current) return
        setAccount(next)
        if (!next || next.role !== 'learner') return
        const id =
          new URLSearchParams(location.search).get('reservation') ??
          sessionStorage.getItem('sal0-group-pending')
        if (id && /^[a-f0-9]{32}$/.test(id)) {
          const checked = await client.reservation(id)
          if (current) rememberReservation(checked)
        }
      })
      .catch(() => {
        if (current)
          setError(
            'We could not restore your account or check your booking. Sign in to verify it; no new payment has been started.',
          )
      })
      .finally(() => {
        if (current) setRestoring(false)
      })
    return () => {
      current = false
    }
  }, [client, rememberReservation])
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Small-group math tutoring — SAL0MANder Math'
    return () => {
      document.title = previousTitle
    }
  }, [])
  async function signIn(role: 'tutor' | 'learner' = 'learner') {
    if (!client) return
    setSignInRole(role)
    setBusy(true)
    setError('')
    setAccount(null)
    setRecoveredGroup(null)
    recoveredGroupId.current = ''
    setReviewLearner('')
    setReservation(null)
    try {
      const next = await client.identity.signIn(role, demoParent)
      setAccount(next)
      if (next.role === 'tutor') setShowStudio(true)
      const id =
        new URLSearchParams(location.search).get('reservation') ??
        sessionStorage.getItem('sal0-group-pending')
      if (next.role === 'learner' && id && /^[a-f0-9]{32}$/.test(id))
        rememberReservation(await client.reservation(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in was not completed.')
    } finally {
      setBusy(false)
    }
  }
  async function signInSameTab(role: 'tutor' | 'learner' = 'learner') {
    if (!client?.identity.signInSameTab || busy || restoring || (role === 'learner' && !adult))
      return
    setSignInRole(role)
    setBusy(true)
    setRedirecting(true)
    setError('')
    setAccount(null)
    setReviewLearner('')
    setReservation(null)
    try {
      const returnUrl = new URL(location.href)
      if (active) returnUrl.searchParams.set('class', active.id)
      else if (requestedClassId) returnUrl.searchParams.set('class', requestedClassId)
      else returnUrl.searchParams.delete('class')
      // The Google SDK returns to this page. Save only the public class choice in its URL.
      window.history.replaceState(window.history.state, '', returnUrl.href)
      await client.identity.signInSameTab()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in could not open. Please try again.')
    } finally {
      setBusy(false)
      setRedirecting(false)
    }
  }
  async function checkout() {
    if (!client || !active || !account?.learnerId || !adult || restoring || busy) return
    setBusy(true)
    setError('')
    try {
      const learnerId = activeReservation?.learnerId ?? account.learnerId
      const fingerprint = active.id + ':' + learnerId
      const key = checkoutKeys.get(fingerprint) ?? crypto.randomUUID()
      checkoutKeys.set(fingerprint, key)
      const next = await client.checkout(active.id, learnerId, key)
      rememberReservation(next)
      await refresh()
      if (next.state === 'pending' && next.checkoutUrl) {
        sessionStorage.setItem('sal0-group-pending', next.id)
        location.assign(safeCheckoutUrl(next.checkoutUrl, client.demo))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout could not start.')
      void refresh()
    } finally {
      setBusy(false)
    }
  }
  async function checkPayment() {
    if (!client || !account || restoring || busy) return
    const id = reservation?.id ?? sessionStorage.getItem('sal0-group-pending')
    if (!id || !/^[a-f0-9]{32}$/.test(id)) {
      setError('No checkout to check yet. Choose a session, then start checkout to reserve a seat.')
      return
    }
    setBusy(true)
    setError('')
    try {
      rememberReservation(await client.reservation(id))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to verify payment.')
    } finally {
      setBusy(false)
    }
  }
  async function publish(event: FormEvent) {
    event.preventDefault()
    if (!client) return
    setBusy(true)
    setError('')
    try {
      const created = await client.create(
        {
          topic: topic.trim() || 'Math support',
          gradeBand: grade.trim() || 'Grades 6–12',
          startsAt: pacificStart(date, time),
          breakAfterMinutes,
        },
        createKey,
      )
      setSelected(created.id)
      setPublishMessage(
        `Session opened: ${dateLabel(created.startsAt)}, ${timeLabel(created.startsAt)}–${timeLabel(created.endsAt)} Pacific. ${created.seatsAvailable} of 6 learner seats are available.`,
      )
      setCreateKey(crypto.randomUUID())
      setShowStudio(false)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create the class.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <AppShell>
      <div className={styles.page}>
        {testMode && (
          <div className={styles.preview} role="note" aria-label="Stripe test mode">
            <strong>Stripe TEST mode — practice checkout only.</strong> Use Stripe test cards. No
            money is charged and no paid lesson is booked.
          </div>
        )}
        {client?.demo && (
          <div className={styles.preview}>
            <strong>Interactive local preview</strong> · Test accounts and simulated payments only.
            No real seats are sold.
          </div>
        )}
        <header className={styles.hero}>
          <p className={styles.eyebrow}>SAL0MANder Math · Small-group tutoring</p>
          <h1>
            A little group.
            <br />
            <span>A lot of understanding.</span>
          </h1>
          <p>
            One shared, 60-minute lesson with your tutor. Up to 6 learners + your tutor attend
            together.{' '}
            {testMode
              ? 'This test page lets you try choosing a date and checking out without booking a paid lesson.'
              : 'Each booking reserves one learner’s seat for the selected date and time.'}
          </p>
          <div className={styles.facts}>
            <span>Full 60-minute lesson</span>
            <span>Live video lesson</span>
            <span>{testMode ? '$20 test amount' : '$20 per student'}</span>
          </div>
        </header>

        {isTutor && (
          <div className={styles.tutorTools}>
            <button
              className={styles.textButton}
              disabled={!client || busy || restoring}
              onClick={() =>
                account?.role === 'tutor' ? setShowStudio((v) => !v) : void signIn('tutor')
              }
            >
              Tutor: open a session
            </button>
          </div>
        )}
        {account?.role === 'tutor' && publishMessage && (
          <p className={styles.success} role="status">
            {publishMessage}
          </p>
        )}

        {showStudio && account?.role === 'tutor' && (
          <form className={styles.studio} onSubmit={publish} aria-label="Open a group session">
            <h2 ref={studioHeading} tabIndex={-1} className={styles.stepHeading}>
              Choose when you can teach
            </h2>
            <p>
              Choose a date and start time to open a group session. Families can book one of six
              learner seats in the times you offer.
            </p>
            <div className={styles.formGrid}>
              <label>
                Date
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Start time · Pacific
                <input
                  required
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
            </div>
            <p className={styles.sessionSummary}>
              60-minute lesson · $20 per learner · 6 learner seats + you
            </p>
            <details className={styles.sessionOptions}>
              <summary>Lesson details &amp; break · {breakAfterMinutes} min</summary>
              <p className={styles.quiet}>
                Your break is protected between sessions. Families cannot change it, and it does not
                shorten the lesson. Blank lesson details use Math support and Grades 6–12.
              </p>
              <div className={styles.formGrid}>
                <label>
                  Math topic
                  <input maxLength={100} value={topic} onChange={(e) => setTopic(e.target.value)} />
                </label>
                <label>
                  Grade or course
                  <input maxLength={60} value={grade} onChange={(e) => setGrade(e.target.value)} />
                </label>
                <label>
                  Break between sessions
                  <select
                    value={breakAfterMinutes}
                    onChange={(e) => setBreakAfterMinutes(Number(e.target.value))}
                  >
                    {[0, 5, 10, 15, 20, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes === 0 ? 'No break' : `${minutes} minutes`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <p className={styles.quiet}>
              Check your Google Calendar before opening a session. Calendar conflict sync is not
              connected yet.
            </p>
            <button className={styles.primary} disabled={busy}>
              {busy
                ? 'Opening session…'
                : client?.demo
                  ? 'Open preview session'
                  : testMode
                    ? 'Open test session'
                    : 'Open session'}
            </button>
          </form>
        )}
        {account?.role === 'learner' && client?.bookings && (
          <YourBookings
            client={client}
            accountId={account.uid}
            selectedId={reservation?.id}
            currentReservation={reservation}
            disabled={busy || restoring}
            testMode={testMode}
            onSelect={openBooking}
          />
        )}
        <div className={styles.topbar}>
          <div>
            <h2>{isTutor ? 'Your open dates' : '1. Choose your date'}</h2>
            <p>All class times are Pacific.</p>
          </div>
          <button
            className={styles.secondary}
            onClick={() => void refresh()}
            disabled={!client || loading}
          >
            Refresh availability
          </button>
        </div>
        {availableDates.length > 0 && (
          <nav className={styles.datePicker} aria-label="Available class dates">
            {availableDates.map(([label, timestamp]) => (
              <button
                key={label}
                className={styles.dateButton}
                aria-label={label}
                aria-pressed={selectedDate === label}
                onClick={() => {
                  const first = classes.find((c) => fullDateLabel(c.startsAt) === label)
                  if (first) chooseClass(first.id)
                }}
              >
                <span>{dateLabel(timestamp).split(',')[0]}</span>
                <strong>{dateLabel(timestamp).split(',').slice(1).join(',').trim()}</strong>
                <small>{selectedDate === label ? 'Selected' : 'View times'}</small>
              </button>
            ))}
          </nav>
        )}
        {error && (
          <div role="alert" className={styles.error}>
            {error}
          </div>
        )}
        {error && signInRole === 'tutor' && !account && client?.identity.signInSameTab && (
          <button
            className={styles.secondary}
            disabled={busy || restoring}
            onClick={() => void signInSameTab('tutor')}
          >
            Continue Google sign-in on this page
          </button>
        )}
        {requestedClassId && !active && !loading && !availabilityFailed && (
          <p role="status">That session is no longer available. Please choose another time.</p>
        )}
        {restoring && <p role="status">Checking your saved account and booking…</p>}
        <div className={styles.layout}>
          <section className={styles.classList} aria-label="Available classes" aria-busy={loading}>
            {loading && <p role="status">Checking available seats…</p>}
            {!loading && availabilityFailed && (
              <div role="alert" className={styles.error}>
                <h3>Availability is temporarily unavailable</h3>
                <p>We couldn’t check the class schedule. Please try again.</p>
                {classes.length > 0 && <p>The times shown may be out of date.</p>}
                <button className={styles.secondary} onClick={() => void refresh()}>
                  Try availability again
                </button>
              </div>
            )}
            {!loading && !availabilityFailed && classes.length === 0 && (
              <div className={styles.empty}>
                <h3>Let’s find the right group for you</h3>
                <p>
                  New groups are being scheduled. Tell your tutor your grade and the topic you want
                  help with.
                </p>
                <a href="mailto:sal@salomandermath.com?subject=Small%20group%20math%20tutoring">
                  Request a group
                </a>
                <p>Prefer a private lesson?</p>
                <LinkButton to={paths.classroom}>Book a $45 private lesson</LinkButton>
              </div>
            )}
            {visibleClasses.length > 0 && (
              <div className={styles.slotHeading}>
                <h3>{isTutor ? 'Your sessions' : '2. Choose your time'}</h3>
                <p>{selectedDate} · Pacific Time</p>
              </div>
            )}
            {visibleClasses.map((c) => (
              <button
                key={c.id}
                className={styles.classCard + ' ' + (selected === c.id ? styles.selected : '')}
                onClick={() => chooseClass(c.id, true)}
                aria-pressed={selected === c.id}
              >
                <span className={styles.dateBlock}>
                  <strong>{dateLabel(c.startsAt)}</strong>
                  <span>{timeLabel(c.startsAt)}</span>
                </span>
                <span className={styles.classInfo}>
                  <span className={styles.grade}>{c.gradeBand}</span>
                  <strong>{c.topic}</strong>
                  <span>
                    {timeLabel(c.startsAt)}–{timeLabel(c.endsAt)} · 60 minutes
                  </span>
                </span>
                <span className={styles.capacity}>
                  {c.seatsAvailable === 0 ? 'Full' : c.seatsAvailable + ' of 6 seats open'}
                  <small>$20 / student</small>
                </span>
              </button>
            ))}
          </section>
          <aside
            className={styles.checkout}
            aria-label={isTutor ? 'Your teaching session' : 'Your class and payment'}
          >
            <p className={styles.eyebrow}>
              {isTutor ? 'Your teaching schedule' : '3. Review your session'}
            </p>
            <h2 ref={reviewHeading} tabIndex={-1} className={styles.stepHeading}>
              {active?.topic ??
                (isTutor ? 'Open your next session' : 'Choose an available session')}
            </h2>
            {!active && (
              <p>Seat availability and session details appear here when a class is available.</p>
            )}
            {active && (
              <p>
                {dateLabel(active.startsAt)} · {timeLabel(active.startsAt)}–
                {timeLabel(active.endsAt)} Pacific
              </p>
            )}
            {active && (
              <div
                className={styles.sessionTimeline}
                aria-label={account?.role === 'tutor' ? 'Lesson and break times' : 'Lesson time'}
              >
                <div>
                  <strong>
                    {timeLabel(active.startsAt)}–{timeLabel(active.endsAt)}
                  </strong>
                  <span>
                    {isTutor
                      ? 'You teach · 60 minutes'
                      : 'Your lesson with your tutor · 60 minutes'}
                  </span>
                </div>
                {account?.role === 'tutor' && activeBreakMinutes > 0 && (
                  <div className={styles.breakTime}>
                    <strong>
                      {timeLabel(active.endsAt)}–
                      {timeLabel(active.endsAt + activeBreakMinutes * 60 * 1000)}
                    </strong>
                    <span>Tutor break · {activeBreakMinutes} minutes</span>
                  </div>
                )}
              </div>
            )}
            {active && (
              <div
                className={styles.seats}
                role="img"
                aria-label={
                  active
                    ? `${active.confirmedSeats} ${testMode ? 'test paid' : 'paid'}, ${active.pendingSeats} in checkout, ${active.seatsAvailable} available. Maximum six students.`
                    : 'Maximum six students'
                }
              >
                {Array.from({ length: 6 }, (_, i) => {
                  const state = active
                    ? i < active.confirmedSeats
                      ? 'paid'
                      : i < active.confirmedSeats + active.pendingSeats
                        ? 'pending'
                        : 'open'
                    : 'open'
                  return (
                    <span key={i} className={styles.seat + ' ' + styles[state]}>
                      <SeatIcon />
                      <small>
                        {state === 'paid'
                          ? testMode
                            ? 'Test paid'
                            : 'Paid'
                          : state === 'pending'
                            ? 'Checkout'
                            : 'Open'}
                      </small>
                    </span>
                  )
                })}
              </div>
            )}
            {!isTutor && active && (
              <>
                <div className={styles.total}>
                  <span>
                    {testMode
                      ? '1 test seat · no paid lesson'
                      : '1 learner’s seat · 1 group session with your tutor'}
                  </span>
                  <strong>
                    $20<small> USD</small>
                  </strong>
                </div>
                <p className={styles.paymentNote}>
                  {testMode
                    ? 'This $20 Stripe TEST checkout is for testing only. Use a Stripe test card; no money is charged and no paid lesson is booked.'
                    : 'Your $20 payment reserves one learner’s seat with your tutor at the date and time above. Up to 5 other learners may join this same session. Your tutor does not count toward the six-learner limit. A seat is confirmed only after successful payment.'}
                </p>
              </>
            )}
            {account && (
              <>
                <p className={styles.account}>Signed in: {account.label}</p>
                <button
                  type="button"
                  className={styles.textButton}
                  disabled={busy || restoring}
                  onClick={() => void signIn(account.role)}
                >
                  Change account
                </button>
              </>
            )}
            {!isTutor && (
              <>
                {client?.demo && (
                  <label className={styles.demoSelect}>
                    Preview parent
                    <select
                      value={demoParent}
                      disabled={busy}
                      onChange={(e) => {
                        setDemoParent(Number(e.target.value))
                        setAccount(null)
                        setReservation(null)
                        setRecoveredGroup(null)
                        recoveredGroupId.current = ''
                        setError('')
                      }}
                    >
                      {Array.from({ length: 8 }, (_, i) => (
                        <option key={i} value={i + 1}>
                          Parent {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className={styles.consent}>
                  <input
                    type="checkbox"
                    checked={adult}
                    onChange={(e) => setAdult(e.target.checked)}
                  />
                  I’m a parent/guardian booking for my child, or an adult learner.
                </label>
                {allowEnrollment && (!account || account.role !== 'learner') && (
                  <p className={styles.paymentNote}>
                    New here? Create your parent or adult learner account with Google, or sign in if
                    you already have one.
                  </p>
                )}
                {!account || account.role !== 'learner' ? (
                  <>
                    <button
                      className={styles.primary}
                      disabled={!client || busy || restoring || !adult}
                      onClick={() => void signIn()}
                    >
                      {redirecting
                        ? 'Opening Google on this page…'
                        : busy || restoring
                          ? 'Opening…'
                          : client?.demo
                            ? 'Use preview parent'
                            : allowEnrollment
                              ? 'Sign in or sign up with Google'
                              : 'Continue with Google'}
                    </button>
                    {client?.identity.signInSameTab && !client.demo && (
                      <div className={styles.paymentNote}>
                        <p>Prefer to sign in without a popup? Google can open in this tab.</p>
                        <button
                          type="button"
                          className={styles.secondary}
                          disabled={busy || restoring || !adult}
                          onClick={() => void signInSameTab()}
                        >
                          Sign in on this page
                        </button>
                        <p>You’ll return here to review your session before paying.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    className={styles.primary}
                    disabled={
                      busy ||
                      restoring ||
                      !adult ||
                      !active ||
                      activeReservation?.state === 'confirmed'
                    }
                    onClick={() => void checkout()}
                  >
                    {restoring
                      ? 'Checking existing booking…'
                      : busy
                        ? 'Checking your seat…'
                        : activeReservation?.state === 'confirmed'
                          ? testMode
                            ? 'Test checkout complete'
                            : 'Seat confirmed'
                          : active?.seatsAvailable === 0
                            ? 'Check availability or resume checkout'
                            : testMode
                              ? 'Start $20 test checkout'
                              : 'Pay $20 to secure a seat'}
                  </button>
                )}
                {!client && (
                  <p className={styles.quiet}>
                    Online group checkout is being connected. Private lessons can already be booked.
                  </p>
                )}
              </>
            )}
            {activeReservation && (
              <div
                role="status"
                className={
                  activeReservation.state === 'confirmed' ? styles.success : styles.pendingNotice
                }
              >
                <strong>
                  {activeReservation.state === 'confirmed'
                    ? testMode
                      ? 'Test payment verified. No paid lesson is booked.'
                      : 'Payment verified. Your seat is confirmed.'
                    : activeReservation.state === 'expired'
                      ? 'Checkout expired. This seat is not booked.'
                      : testMode
                        ? 'Test payment has not been confirmed.'
                        : 'Payment has not been confirmed.'}
                </strong>
                <p>
                  {testMode
                    ? 'This is a Stripe TEST reservation. It does not reserve a paid lesson or include a class invitation.'
                    : activeReservation.state === 'confirmed'
                      ? 'One learner’s seat is booked in the group session with your tutor at the date and time shown above. Check Join your lesson below for your private meeting link when joining opens. Your optional prep is below.'
                      : activeReservation.state === 'pending'
                        ? 'Your place is temporarily held while you complete checkout. It is not a paid booking yet.'
                        : 'Choose an available class to try again.'}
                </p>
                {activeReservation.state === 'pending' && activeReservation.checkoutUrl && (
                  <a href={safeCheckoutUrl(activeReservation.checkoutUrl, client?.demo)}>
                    {testMode ? 'Return to Stripe test checkout' : 'Return to secure checkout'}
                  </a>
                )}
              </div>
            )}
            {account?.role === 'learner' && (
              <button
                className={styles.textButton}
                onClick={() => void checkPayment()}
                disabled={busy || restoring}
              >
                Check my payment status
              </button>
            )}
            {isTutor ? (
              <p className={styles.quiet}>
                Families book only the lesson times you open. Your break begins after the full
                lesson; you choose its length when opening a session. Review paid learners below.
              </p>
            ) : (
              <p className={styles.quiet}>
                Payment or scheduling help?{' '}
                <a href="mailto:sal@salomandermath.com">Contact your tutor</a>.
              </p>
            )}
          </aside>
        </div>
        {account?.role === 'learner' && client && reservation?.state === 'confirmed' && (
          <ReservationJoinPanel
            client={client}
            accountId={account.uid}
            reservationId={reservation.id}
            classId={reservation.classId}
          />
        )}
        {isTutor && client && active && account && (
          <ClassMeetingPanel client={client} group={active} accountId={account.uid} />
        )}
        <section className={styles.prepIntro}>
          <div>
            <p className={styles.eyebrow}>Before we meet</p>
            <h2>{isTutor ? 'Prepare for your learners' : 'Your questions belong here.'}</h2>
            <p>
              {isTutor
                ? 'Choose a paid learner from the roster to review their background, schoolwork, and practice.'
                : 'Optionally share what you are working on, attach schoolwork and keep your assigned practice together. Your classmates cannot see your student records.'}
            </p>
          </div>
          <div className={styles.prepTags}>
            <span>Student background</span>
            <span>Schoolwork & uploads</span>
            <span>Lessons & puzzles</span>
          </div>
        </section>
        {account?.role === 'tutor' && client && active && (
          <TutorClassPanel
            key={active.id}
            client={client}
            group={active}
            onLearnerChange={(id) => {
              setReviewLearner(id)
              setReviewRevision((n) => n + 1)
            }}
          />
        )}
        <StudentPrepPanel
          key={
            (account?.uid ?? '') +
            ':' +
            (account?.role === 'learner'
              ? (activeReservation?.learnerId ?? account.learnerId)
              : reviewLearner) +
            ':' +
            reviewRevision
          }
          readOnly={account?.role === 'tutor'}
          context={
            account?.role === 'learner'
              ? {
                  accountId: account.uid,
                  learnerId: activeReservation?.learnerId ?? account.learnerId,
                }
              : account?.role === 'tutor' && reviewLearner
                ? { accountId: account.uid, learnerId: reviewLearner }
                : undefined
          }
          client={prepClient}
          {...(client?.demo ? { mode: 'local-demo' as const } : {})}
        />

        {!isTutor && (
          <div className={styles.tutorTools}>
            <button
              className={styles.textButton}
              disabled={!client || busy || restoring}
              onClick={() =>
                account?.role === 'tutor' ? setShowStudio((v) => !v) : void signIn('tutor')
              }
            >
              Tutor: open a session
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
