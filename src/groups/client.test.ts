import { expect, it, vi } from 'vitest'
import {
  ClassSchema,
  OwnedBookingSchema,
  ReservationJoinSchema,
  createGroupClient,
  pacificStart,
  safeCheckoutUrl,
} from './client'
it('uses Pacific DST offsets instead of the device timezone', () => {
  expect(pacificStart('2026-09-14', '16:30')).toBe('2026-09-14T23:30:00.000Z')
  expect(pacificStart('2026-12-14', '16:30')).toBe('2026-12-15T00:30:00.000Z')
  expect(() => pacificStart('2027-03-14', '02:30')).toThrow()
})

const classId = 'a'.repeat(32)
const reservationId = 'b'.repeat(32)
const meeting = {
  provider: 'zoom',
  joinUrl: 'https://us06web.zoom.us/j/12345678901?pwd=Passcode',
  updatedAt: 123,
}
const authorized = {
  signIn: vi.fn(),
  authorization: vi.fn(async () => 'Bearer account-token'),
}

it('lists booked lessons through authenticated GET and rejects mismatched class IDs', async () => {
  const group = {
    id: classId,
    topic: 'Fractions',
    gradeBand: 'Grade 6',
    startsAt: 1000,
    endsAt: 2000,
    timeZone: 'America/Los_Angeles',
    capacity: 6,
    priceCents: 2000,
    currency: 'usd',
    state: 'scheduled',
    seatsAvailable: 5,
    confirmedSeats: 1,
    pendingSeats: 0,
  }
  const reservation = {
    id: reservationId,
    classId,
    learnerId: 'c'.repeat(32),
    state: 'confirmed',
    checkoutUrl: null,
    expiresAt: null,
    priceCents: 2000,
    currency: 'usd',
  }
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: [{ group, reservation }] }))
  const client = createGroupClient('https://classes.example', authorized, false, fetcher)
  expect(await client.bookings!()).toEqual([{ group, reservation }])
  expect(fetcher).toHaveBeenCalledWith(
    'https://classes.example/api/tutoring/groups/v1/bookings',
    expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: 'Bearer account-token' },
    }),
  )
  expect(
    OwnedBookingSchema.safeParse({
      group,
      reservation: { ...reservation, classId: 'd'.repeat(32) },
    }).success,
  ).toBe(false)
  expect(
    OwnedBookingSchema.safeParse({
      group,
      reservation: { ...reservation, state: 'expired' },
    }).success,
  ).toBe(false)
})

it('uses authenticated private meeting routes with no cached responses or assumed payment', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ data: { classId, meeting: null } }))
    .mockResolvedValueOnce(Response.json({ data: { classId, meeting } }))
    .mockResolvedValueOnce(
      Response.json({
        data: {
          classId,
          reservationId,
          topic: 'Algebra',
          startsAt: 1500,
          state: 'not_open',
          opensAt: 1000,
          closesAt: 2000,
          provider: 'zoom',
          joinUrl: null,
        },
      }),
    )
  const client = createGroupClient('https://classes.example', authorized, false, fetcher)
  expect(await client.meeting!(classId)).toEqual({ classId, meeting: null })
  expect(
    await client.saveMeeting!(classId, {
      provider: 'zoom',
      joinUrl: meeting.joinUrl,
    }),
  ).toEqual({ classId, meeting })
  expect(await client.join!(reservationId)).toMatchObject({
    state: 'not_open',
    joinUrl: null,
  })
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    `https://classes.example/api/tutoring/groups/v1/classes/${classId}/meeting`,
    `https://classes.example/api/tutoring/groups/v1/classes/${classId}/meeting`,
    `https://classes.example/api/tutoring/groups/v1/reservations/${reservationId}/join`,
  ])
  expect(fetcher.mock.calls[1]![1]).toMatchObject({
    method: 'PUT',
    body: JSON.stringify({ provider: 'zoom', joinUrl: meeting.joinUrl }),
  })
  for (const [, options] of fetcher.mock.calls)
    expect(options).toMatchObject({
      headers: { Authorization: 'Bearer account-token' },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    })
})

it('fails closed on a mismatched reservation, foreign URL, closed-state URL, or denied access', async () => {
  const open = {
    classId,
    reservationId,
    topic: 'Algebra',
    startsAt: 1500,
    state: 'open',
    opensAt: 1000,
    closesAt: 2000,
    provider: 'zoom',
    joinUrl: meeting.joinUrl,
  }
  expect(ReservationJoinSchema.safeParse(open).success).toBe(true)
  for (const invalid of [
    { ...open, state: 'not_open' },
    { ...open, joinUrl: 'https://evil.example/j/12345678901' },
    { ...open, provider: 'google-meet' },
    { ...open, joinUrl: null },
    { ...open, closesAt: 999 },
  ])
    expect(ReservationJoinSchema.safeParse(invalid).success).toBe(false)
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ data: { ...open, reservationId: 'c'.repeat(32) } }))
    .mockResolvedValueOnce(Response.json({ error: { code: 'forbidden' } }, { status: 403 }))
  const client = createGroupClient('https://classes.example', authorized, false, fetcher)
  await expect(client.join!(reservationId)).rejects.toThrow(/did not match/)
  await expect(client.join!(reservationId)).rejects.toThrow(/does not have access/)
  await expect(
    client.saveMeeting!(classId, {
      provider: 'zoom',
      joinUrl: 'https://zoom.us/s/12345678901?zak=host',
    }),
  ).rejects.toThrow(/participant/)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('accepts only Stripe checkout, with a loopback exception solely for explicit local demos', () => {
  expect(safeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_abc')).toContain(
    'checkout.stripe.com',
  )
  for (const url of [
    'javascript:alert(1)',
    'https://checkout.stripe.com.evil.test/pay',
    'https://user@checkout.stripe.com/pay',
    'http://127.0.0.1:5191/demo/checkout/cs_demo_a',
  ])
    expect(() => safeCheckoutUrl(url)).toThrow()
  expect(safeCheckoutUrl('http://127.0.0.1:5191/demo/checkout/cs_demo_a', true)).toContain('5191')
})
it('rejects an inconsistent six-seat count from the server', () => {
  const value = {
    id: 'a'.repeat(32),
    topic: 'Algebra',
    gradeBand: 'Grade 8',
    startsAt: 1,
    endsAt: 2,
    timeZone: 'America/Los_Angeles',
    capacity: 6,
    priceCents: 2000,
    currency: 'usd',
    seatsAvailable: 6,
    confirmedSeats: 1,
    pendingSeats: 0,
    state: 'scheduled',
  }
  expect(ClassSchema.safeParse(value).success).toBe(false)
  expect(ClassSchema.safeParse({ ...value, seatsAvailable: 5 }).success).toBe(true)
})
