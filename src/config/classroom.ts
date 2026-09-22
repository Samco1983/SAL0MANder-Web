/** Public appointment page saved and verified by the owner; never a private Meet room. */
export const PUBLIC_TUTORING_BOOKING_URL =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1bDoU6Ga-udQmcVJiIKEJkG-8LUh_gmpasy-7tnxX98akKdwWkp5qUYcwcl3tNMowEf32ncvGF'

/** Canonical Google Meet invitation; no sign-in or redirect parameters are accepted. */
export function readGoogleMeetInvitation(value: string) {
  if (value.length > 2048 || hasControl(value, true)) return null
  const input = value.trim()
  let code = input
  if (!/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(code) && !/^[a-z]{10}$/i.test(code)) {
    const url = googleUrl(input)
    if (
      !url ||
      url.hostname !== 'meet.google.com' ||
      url.search ||
      !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(url.pathname)
    )
      return null
    code = url.pathname.replace(/^\/|\/$/g, '')
  }
  const letters = code.replaceAll('-', '').toLowerCase()
  const meetingCode = `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`
  return { url: `https://meet.google.com/${meetingCode}`, meetingCode }
}

/** Only Google Calendar appointment pages, never generic Calendar or Google redirects. */
export function readGoogleBookingUrl(value: string) {
  if (value.length > 2048 || hasControl(value, true)) return ''
  const url = googleUrl(value.trim())
  if (!url) return ''
  if (
    url.hostname === 'calendar.app.google' &&
    /^\/[A-Za-z0-9_-]{8,256}\/?$/.test(url.pathname) &&
    !url.search
  )
    return url.href
  if (
    url.hostname !== 'calendar.google.com' ||
    !/^\/calendar(?:\/u\/\d{1,2})?\/appointments\/schedules\/[A-Za-z0-9_-]{8,256}\/?$/.test(
      url.pathname,
    )
  )
    return ''
  if (url.search && url.search !== '?gv=true') return ''
  return url.href
}

/** Optional, approved public site origins. Unset leaves same-app routes intact. */
export function readSiteOrigin(value: string, hostname: 'salomandermath.com' | 'sal0mander.com') {
  if (value.length > 2048 || hasControl(value, true)) return ''
  const url = googleUrl(value.trim())
  return url && url.hostname === hostname && url.pathname === '/' && !url.search ? url.origin : ''
}

function googleUrl(input: string) {
  if (!input || input.length > 2048 || /[\s\\]/.test(input) || hasControl(input)) return null
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash)
      return null
    return url
  } catch {
    return null
  }
}

/** Participant invitation only; never a Zoom host/start link. */
export function readZoomInvitation(value: string) {
  if (value.length > 2048 || hasControl(value, true)) return null
  const input = value.trim()
  if (/^[\d -]+$/.test(input)) {
    const meetingId = input.replace(/[ -]/g, '')
    return /^\d{9,11}$/.test(meetingId)
      ? { url: `https://zoom.us/j/${meetingId}`, meetingId }
      : null
  }
  const url = zoomUrl(input)
  if (!url) return null
  const match = /^\/j\/(\d{9,11})\/?$/.exec(url.pathname)
  if (!match) return null
  const keys = [...url.searchParams.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => !['pwd', 'omn'].includes(key)))
    return null
  if (keys.some((key) => !/^[A-Za-z0-9._~-]{1,256}$/.test(url.searchParams.get(key)!))) return null
  return { url: url.href, meetingId: match[1]! }
}

/** Manual invitations are a local convenience, not proof of a paid reservation. */
export function readLessonInvitation(value: string) {
  const meet = readGoogleMeetInvitation(value)
  if (meet) return { ...meet, provider: 'google-meet' as const }
  const zoom = readZoomInvitation(value)
  return zoom ? { url: zoom.url, meetingCode: zoom.meetingId, provider: 'zoom' as const } : null
}

/** Narrow URL boundary shared by the class setup form and authenticated API responses. */
export function readClassMeetingInvitation(provider: 'zoom' | 'google-meet', value: string) {
  if (value.length > 512) return null
  const pattern =
    provider === 'zoom'
      ? /^https:\/\/(?:zoom\.us|www\.zoom\.us|us0[2-7]web\.zoom\.us)\/j\/[1-9][0-9]{8,10}(?:\?pwd=[A-Za-z0-9._~-]{1,256})?$/
      : /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/
  if (!pattern.test(value)) return null
  const invitation = readLessonInvitation(value)
  if (!invitation || invitation.provider !== provider || invitation.url !== value) return null
  return invitation
}

export function readZoomBookingUrl(value: string) {
  const url = zoomUrl(value.trim())
  if (
    !url ||
    url.hostname !== 'scheduler.zoom.us' ||
    !/^\/[A-Za-z0-9_-][A-Za-z0-9/_-]*$/.test(url.pathname) ||
    url.search
  )
    return ''
  return url.href
}

function zoomUrl(input: string) {
  if (!input || input.length > 2048 || /[\s\\]/.test(input) || hasControl(input)) return null
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash)
      return null
    if (!/^(?:[a-z0-9-]+\.)*zoom\.(?:us|com)$/.test(url.hostname)) return null
    return url
  } catch {
    return null
  }
}

function hasControl(value: string, allowOuterWhitespace = false) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code === 127 || (code < 32 && !(allowOuterWhitespace && [9, 10, 13].includes(code)))
  })
}
