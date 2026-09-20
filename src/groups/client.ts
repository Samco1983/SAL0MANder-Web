import { z } from 'zod'
import { readClassMeetingInvitation } from '@config/classroom'

export const ClassSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{32}$/),
    topic: z.string(),
    gradeBand: z.string(),
    startsAt: z.number(),
    endsAt: z.number(),
    breakAfterMinutes: z.number().int().min(0).max(60).optional(),
    timeZone: z.literal('America/Los_Angeles'),
    capacity: z.literal(6),
    priceCents: z.literal(2000),
    currency: z.literal('usd'),
    seatsAvailable: z.number().int().min(0).max(6),
    confirmedSeats: z.number().int().min(0).max(6),
    pendingSeats: z.number().int().min(0).max(6),
    state: z.literal('scheduled'),
  })
  .refine((c) => c.seatsAvailable + c.confirmedSeats + c.pendingSeats === 6)
export const ReservationSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  classId: z.string(),
  learnerId: z.string(),
  state: z.enum(['pending', 'confirmed', 'expired']),
  checkoutUrl: z.string().nullable(),
  expiresAt: z.number().nullable(),
  priceCents: z.literal(2000),
  currency: z.literal('usd'),
})
export type GroupClass = z.infer<typeof ClassSchema>
export type Reservation = z.infer<typeof ReservationSchema>
export const OwnedBookingSchema = z
  .object({
    group: ClassSchema,
    reservation: ReservationSchema,
  })
  .refine(
    (value) =>
      value.group.id === value.reservation.classId && value.reservation.state !== 'expired',
  )
export type OwnedBooking = z.infer<typeof OwnedBookingSchema>
export const ClassMeetingSchema = z
  .object({
    provider: z.enum(['zoom', 'google-meet']),
    joinUrl: z.string(),
    updatedAt: z.number().finite(),
  })
  .refine((m) => !!readClassMeetingInvitation(m.provider, m.joinUrl))
export const ClassMeetingResultSchema = z.object({
  classId: z.string(),
  meeting: ClassMeetingSchema.nullable(),
})
export const ReservationJoinSchema = z
  .object({
    classId: z.string(),
    reservationId: z.string(),
    topic: z.string(),
    startsAt: z.number().finite(),
    state: z.enum(['unconfigured', 'not_open', 'open', 'ended']),
    opensAt: z.number().finite(),
    closesAt: z.number().finite(),
    provider: z.enum(['zoom', 'google-meet']).nullable(),
    joinUrl: z.string().nullable(),
  })
  .refine(
    (value) =>
      value.closesAt > value.opensAt &&
      (value.state === 'open'
        ? !!value.provider &&
          !!value.joinUrl &&
          !!readClassMeetingInvitation(value.provider, value.joinUrl)
        : value.joinUrl === null),
  )
export type ClassMeetingResult = z.infer<typeof ClassMeetingResultSchema>
export type ReservationJoin = z.infer<typeof ReservationJoinSchema>
export type GroupAccount = {
  uid: string
  learnerId: string
  role: 'tutor' | 'learner'
  label: string
}
export interface GroupIdentity {
  signIn(role?: 'tutor' | 'learner', demoParent?: number): Promise<GroupAccount>
  signInSameTab?(): Promise<void>
  restore?(): Promise<GroupAccount | null>
  authorization(): Promise<string>
}
export interface GroupClient {
  readonly demo: boolean
  readonly apiBase: string
  readonly identity: GroupIdentity
  list(): Promise<GroupClass[]>
  bookings?(): Promise<OwnedBooking[]>
  create(
    input: {
      topic: string
      gradeBand: string
      startsAt: string
      breakAfterMinutes?: number
    },
    key: string,
  ): Promise<GroupClass>
  checkout(classId: string, learnerId: string, key: string): Promise<Reservation>
  reservation(id: string): Promise<Reservation>
  meeting?(classId: string): Promise<ClassMeetingResult>
  saveMeeting?(
    classId: string,
    input: { provider: 'zoom' | 'google-meet'; joinUrl: string },
  ): Promise<ClassMeetingResult>
  join?(reservationId: string): Promise<ReservationJoin>
  roster?(classId: string): Promise<{
    classId: string
    learners: {
      learnerId: string
      reservationId: string
      state: 'confirmed'
    }[]
  }>
  createLesson?(
    input: {
      title: string
      learningGoal: string
      content: { activityId: string; activityVersionId: string }
    },
    key: string,
  ): Promise<{ id: string }>
  assignLesson?(
    classId: string,
    input: { learnerId: string; lessonId: string },
    key: string,
  ): Promise<{ id: string }>
}
const messages: Record<string, string> = {
  capacity_reached: 'This class just filled up. Please choose another time.',
  conflict: 'That time or seat is no longer available. Refresh the classes and try again.',
  unauthenticated: 'Please sign in with your parent or adult learner account.',
  forbidden: 'This account does not have access to this student or tutor action.',
  invalid_input: 'Check the class date, time and details, then try again.',
  not_found: 'This class or reservation is not available to this account.',
  provider_unconfigured:
    'Online group booking is still being connected. You can arrange a group with your tutor.',
}
export function safeCheckoutUrl(value: string, demo = false): string {
  const url = new URL(value)
  if (url.username || url.password) throw new Error('Invalid checkout destination.')
  if (url.protocol === 'https:' && url.hostname === 'checkout.stripe.com') return url.href
  if (demo && url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '5191')
    return url.href
  throw new Error('Invalid checkout destination.')
}
export function createGroupClient(
  apiBase: string,
  identity: GroupIdentity,
  demo = false,
  fetcher = fetch,
): GroupClient {
  const base = new URL(apiBase)
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !(
      base.protocol === 'https:' ||
      (base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname))
    )
  ) {
    throw new Error('Invalid group booking configuration.')
  }
  const root = apiBase.replace(/\/$/, '')
  async function call(
    path: string,
    method = 'GET',
    body?: unknown,
    key?: string,
    authenticated = true,
    apiPath = '/api/tutoring/groups/v1',
  ) {
    const headers: Record<string, string> = {}
    if (authenticated) headers.Authorization = await identity.authorization()
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (key) headers['Idempotency-Key'] = key
    const response = await fetcher(root + apiPath + path, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    })
    const json = await response.json()
    if (!response.ok)
      throw new Error(
        messages[json?.error?.code] ?? 'Unable to complete that request. Please retry.',
      )
    return json.data
  }
  return {
    demo,
    apiBase: root,
    identity,
    list: async () =>
      z.array(ClassSchema).parse(await call('/classes', 'GET', undefined, undefined, false)),
    bookings: async () =>
      z
        .array(OwnedBookingSchema)
        .max(1200)
        .parse(await call('/bookings')),
    create: async (input, key) => ClassSchema.parse(await call('/classes', 'POST', input, key)),
    checkout: async (classId, learnerId, key) =>
      ReservationSchema.parse(
        await call(
          '/classes/' + encodeURIComponent(classId) + '/checkout',
          'POST',
          { learnerId },
          key,
        ),
      ),
    reservation: async (id) =>
      ReservationSchema.parse(await call('/reservations/' + encodeURIComponent(id))),
    meeting: async (id) => {
      const result = ClassMeetingResultSchema.parse(
        await call('/classes/' + encodeURIComponent(id) + '/meeting'),
      )
      if (result.classId !== id)
        throw new Error('The meeting did not match this class. Please retry.')
      return result
    },
    saveMeeting: async (id, input) => {
      if (!readClassMeetingInvitation(input.provider, input.joinUrl))
        throw new Error('Paste the participant join link for the selected meeting app.')
      const result = ClassMeetingResultSchema.parse(
        await call('/classes/' + encodeURIComponent(id) + '/meeting', 'PUT', input),
      )
      if (result.classId !== id || !result.meeting)
        throw new Error('The meeting could not be saved for this class. Please retry.')
      return result
    },
    join: async (id) => {
      const result = ReservationJoinSchema.parse(
        await call('/reservations/' + encodeURIComponent(id) + '/join'),
      )
      if (result.reservationId !== id)
        throw new Error('The meeting did not match this reservation. Please retry.')
      return result
    },
    roster: async (id) =>
      z
        .object({
          classId: z.string(),
          learners: z.array(
            z.object({
              learnerId: z.string().regex(/^[a-f0-9]{32}$/),
              reservationId: z.string(),
              state: z.literal('confirmed'),
            }),
          ),
        })
        .parse(await call('/classes/' + encodeURIComponent(id) + '/roster')),
    createLesson: async (input, key) =>
      z
        .object({ id: z.string().regex(/^[a-f0-9]{32}$/) })
        .parse(await call('/lessons', 'POST', input, key, true, '/api/tutoring/v1')),
    assignLesson: async (id, input, key) =>
      z
        .object({ id: z.string().regex(/^[a-f0-9]{32}$/) })
        .parse(
          await call('/classes/' + encodeURIComponent(id) + '/assignments', 'POST', input, key),
        ),
  }
}

/** Interpret the tutor's wall-clock selection in Pacific time, including DST. */
export function pacificStart(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw new Error('Choose a date and time.')
  const desired = date + 'T' + time + ':00'
  const wall = Date.parse(desired + 'Z')
  let instant = wall
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  function local(ms: number) {
    const p = Object.fromEntries(formatter.formatToParts(ms).map((p) => [p.type, p.value]))
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':' + p.second
  }
  for (let i = 0; i < 3; i++) instant += wall - Date.parse(local(instant) + 'Z')
  if (!Number.isFinite(instant) || local(instant) !== desired)
    throw new Error('That local time does not exist. Choose another time.')
  return new Date(instant).toISOString()
}
