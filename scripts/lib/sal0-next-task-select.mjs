export const MISSION_MARKER = 'sal0-mission-control:v1'
export const DEFAULT_TRUSTED_AUTHORS = ['Samco1983']

const FINGERPRINT = /^[a-f0-9]{64}$/i

function labelsFor(issue) {
  return (issue.labels || []).map((label) => String(label.name || '').toLowerCase())
}

export function hasMissionMarker(body) {
  return String(body || '').includes(MISSION_MARKER)
}

export function parseMissionEnvelope(body) {
  const match = String(body || '').match(
    /<!--\s*sal0-mission-control:v1\s*\n([\s\S]*?)\n-->/,
  )
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function isIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isTrustedIssueAuthor(issue, authors) {
  const login = issue?.author?.login
  return (
    typeof login === 'string' &&
    authors.some((author) => author.toLowerCase() === login.toLowerCase())
  )
}

export function isQueuedMissionIssue(issue) {
  const envelope = parseMissionEnvelope(issue?.body)
  const mission = envelope?.mission
  const title = typeof mission?.title === 'string' ? mission.title.trim() : ''
  const expectedTitle = `[OVERNIGHT][WEB] ${title}`

  return Boolean(
    envelope &&
      envelope.action === 'fast_break' &&
      typeof envelope.idempotencyKey === 'string' &&
      envelope.idempotencyKey.length > 0 &&
      envelope.idempotencyKey.length <= 300 &&
      FINGERPRINT.test(envelope.requestFingerprint || '') &&
      isIsoDate(envelope.requestedAtUtc) &&
      envelope.source === 'owner_console' &&
      mission &&
      title.length >= 3 &&
      title.length <= 160 &&
      mission.title === title &&
      mission.status === 'queued' &&
      isIsoDate(mission.updatedAtUtc) &&
      mission.updatedAtUtc === envelope.requestedAtUtc &&
      issue.title === expectedTitle,
  )
}

/**
 * Mission Control is the explicit owner queue. A queued mission must outrank
 * the older generic backlog, while malformed or already-active mission
 * envelopes must never fall through and run as ordinary [WEB] issues.
 */
export function selectNextIssue(issues, options = {}) {
  const authors = options.trustedAuthors?.length
    ? options.trustedAuthors
    : DEFAULT_TRUSTED_AUTHORS
  const eligible = issues
    .filter((issue) => isTrustedIssueAuthor(issue, authors))
    .filter((issue) => String(issue.title || '').toUpperCase().includes('[WEB]'))
    .filter((issue) => {
      const labels = labelsFor(issue)
      return !labels.includes('in-progress') && !labels.includes('blocked')
    })

  const queuedMission = eligible
    .filter(isQueuedMissionIssue)
    .sort((a, b) => a.number - b.number)[0]

  if (queuedMission) return queuedMission

  return (
    eligible
      .filter((issue) => !hasMissionMarker(issue.body))
      .sort((a, b) => a.number - b.number)[0] || null
  )
}
