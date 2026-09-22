import { expect, it } from 'vitest'
import {
  readGoogleMeetInvitation,
  readGoogleBookingUrl,
  readSiteOrigin,
  readZoomInvitation,
  readZoomBookingUrl,
  PUBLIC_TUTORING_BOOKING_URL,
  readClassMeetingInvitation,
  readLessonInvitation,
} from './classroom'

it('validates the actual public launch booking page without adding a private Meet room', () => {
  expect(readGoogleBookingUrl(PUBLIC_TUTORING_BOOKING_URL)).toBe(PUBLIC_TUTORING_BOOKING_URL)
  expect(readGoogleMeetInvitation(PUBLIC_TUTORING_BOOKING_URL)).toBeNull()
})

it('distinguishes manual invitations from the stricter saved class meeting URL boundary', () => {
  expect(readLessonInvitation('123 456 7890')).toMatchObject({
    provider: 'zoom',
    meetingCode: '1234567890',
  })
  expect(readLessonInvitation('abc-defg-hij')).toMatchObject({ provider: 'google-meet' })
  expect(
    readClassMeetingInvitation('zoom', 'https://us06web.zoom.us/j/12345678901?pwd=Pass_code'),
  ).not.toBeNull()
  expect(
    readClassMeetingInvitation('google-meet', 'https://meet.google.com/abc-defg-hij'),
  ).not.toBeNull()
  for (const value of [
    '1234567890',
    'https://zoom.us/j/0123456789',
    'https://example.zoom.us/j/1234567890',
    'https://us08web.zoom.us/j/1234567890',
    'https://zoom.us/j/1234567890?omn=123456789',
    'https://zoom.us/j/1234567890?pwd=one&pwd=two',
    'https://zoom.us/s/1234567890?zak=host',
    'https://meet.google.com/abc-defg-hij',
  ])
    expect(readClassMeetingInvitation('zoom', value)).toBeNull()
})

it('normalizes only a complete Google Meet code or direct invitation', () => {
  for (const input of [' ABC-DEFG-HIJ\n', 'ABCDEFGHIJ', 'https://meet.google.com/abc-defg-hij/']) {
    expect(readGoogleMeetInvitation(input)).toEqual({
      url: 'https://meet.google.com/abc-defg-hij',
      meetingCode: 'abc-defg-hij',
    })
  }
})

it.each([
  '',
  '1234567890',
  'abc defg hij',
  'abc-defg-hi',
  'abc-defg-hijk',
  'https://meet.google.com.attacker.example/abc-defg-hij',
  'https://attacker.example/abc-defg-hij',
  'https://user:secret@meet.google.com/abc-defg-hij',
  'http://meet.google.com/abc-defg-hij',
  'https://meet.google.com:444/abc-defg-hij',
  'https://meet.google.com/abc-defg-hij?redirect=https://example.com',
  'https://meet.google.com/abc-defg-hij#other',
  'https://meet.google.com/lookup/abc-defg-hij',
  'https://meet.google.com/abc-\ndefg-hij',
  'abc-defg-hij\u0000',
  'https://meet.google.com\\@attacker.example/abc-defg-hij',
  ' '.repeat(2048) + 'abc-defg-hij',
  'https://zoom.us/j/123456789',
])('does not prepare an unsafe or incomplete Google invitation: %s', (value) => {
  expect(readGoogleMeetInvitation(value)).toBeNull()
})

it('allows the official Google Calendar booking-link forms', () => {
  for (const value of [
    'https://calendar.app.google/AbCdEfGh12345678',
    'https://calendar.google.com/calendar/appointments/schedules/AbCdEfGh12345678',
    'https://calendar.google.com/calendar/u/0/appointments/schedules/AbCdEfGh12345678?gv=true',
  ])
    expect(readGoogleBookingUrl(value)).toBe(value)
})

it.each([
  '',
  'https://calendar.google.com/',
  'https://calendar.app.google/',
  'https://calendar.google.com/calendar/u/0/r/eventedit',
  'https://calendar.google.com/url?redirect=elsewhere',
  'https://calendar.app.google.attacker.example/AbCdEfGh12345678',
  'https://user:secret@calendar.app.google/AbCdEfGh12345678',
  'http://calendar.app.google/AbCdEfGh12345678',
  'https://calendar.app.google:444/AbCdEfGh12345678',
  'https://calendar.app.google/AbCdEfGh12345678?redirect=elsewhere',
  'https://calendar.app.google/AbCdEfGh12345678#other',
  'https://calendar.google.com/calendar/appointments/schedules/AbCdEfGh12345678?gv=true&next=elsewhere',
  'https://calendar.app.google/AbCd\nEfGh12345678',
  'https://calendar.app.google/AbCdEfGh12345678\u0000',
  ' '.repeat(2048) + 'https://calendar.app.google/AbCdEfGh12345678',
])('rejects unapproved Calendar targets without following redirects: %s', (value) => {
  expect(readGoogleBookingUrl(value)).toBe('')
})

it('keeps crosslinks unset unless they name the exact approved public origin', () => {
  expect(readSiteOrigin('https://salomandermath.com/', 'salomandermath.com')).toBe(
    'https://salomandermath.com',
  )
  expect(readSiteOrigin('https://sal0mander.com', 'sal0mander.com')).toBe('https://sal0mander.com')
  for (const input of [
    '',
    'http://salomandermath.com',
    'https://salomandermath.com.attacker.example',
    'https://other.example',
    'https://salomandermath.com/redirect',
    'https://salomandermath.com?next=other',
    'https://user@salomandermath.com',
  ]) {
    expect(readSiteOrigin(input, 'salomandermath.com')).toBe('')
  }
})

it('accepts a standard Zoom invitation without changing its passcode, and supplies the app fallback ID', () => {
  const url = 'https://us06web.zoom.us/j/12345678901?pwd=PublicInvite_1&omn=123456789'
  expect(readZoomInvitation(url)).toEqual({ url, meetingId: '12345678901' })
  expect(readZoomInvitation(' 123 456 7890 ')).toEqual({
    url: 'https://zoom.us/j/1234567890',
    meetingId: '1234567890',
  })
  expect(readZoomInvitation('123-456-789')).toHaveProperty('meetingId', '123456789')
})

it.each([
  'https://zoom.us.attacker.example/j/123456789',
  'https://attacker.example/zoom.us/j/123456789',
  'https://user:secret@zoom.us/j/123456789',
  'https://zoom.us:444/j/123456789',
  'http://zoom.us/j/123456789',
  'javascript:alert(1)',
  'zoommtg://zoom.us/join?confno=123456789',
  'https://zoom.us/s/123456789?zak=host',
  'https://zoom.us/j/123456789?zak=host',
  'https://zoom.us/j/123456789?pwd=one&pwd=two',
  'https://zoom.us/j/123456789?pwd=%0Avalue',
  'https://zoom.us/j/123456789#other',
  'https://zoom.us/j/123\n456789',
  'https://zoom.us/j/123456789\u0000',
  '12345678',
  '123456789012',
  'https://zoom.us/j/' + '1'.repeat(2100),
])('does not turn malformed, host-only or foreign input into a joining action: %s', (value) => {
  expect(readZoomInvitation(value)).toBeNull()
})

it('accepts only an explicit Zoom Scheduler booking page, never a guessed schedule', () => {
  expect(readZoomBookingUrl('https://scheduler.zoom.us/tutor/math')).toBe(
    'https://scheduler.zoom.us/tutor/math',
  )
  for (const value of [
    '',
    'https://scheduler.zoom.us/',
    'https://zoom.us/j/123456789',
    'https://scheduler.zoom.us.attacker.example/tutor',
    'https://scheduler.zoom.us/tutor?redirect=elsewhere',
    'https://user:secret@scheduler.zoom.us/tutor',
  ])
    expect(readZoomBookingUrl(value)).toBe('')
})
