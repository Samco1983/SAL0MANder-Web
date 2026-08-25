import { createHash } from 'node:crypto'

export const MISSION_MARKER = 'sal0-mission-control:v1'
export const DEFAULT_TRUSTED_AUTHORS = ['Samco1983']

const MISSION_MARKER_START = '<!-- sal0-mission-control:v1\n'
const MISSION_MARKER_END = '\n-->'
const STRICT_UTC_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

function labelsFor(issue) {
  return (issue.labels || []).map((label) => String(label.name || '').toLowerCase())
}

export function hasMissionMarker(body) {
  return String(body || '').includes(MISSION_MARKER)
}

export function parseMissionEnvelope(body) {
  const value = String(body || '')
  const start = value.indexOf(MISSION_MARKER_START)
  if (start < 0) return null
  const contentStart = start + MISSION_MARKER_START.length
  const end = value.indexOf(MISSION_MARKER_END, contentStart)
  if (end < 0) return null

  try {
    return JSON.parse(value.slice(contentStart, end))
  } catch {
    return null
  }
}

function isIsoDate(value) {
  return (
    typeof value === 'string' &&
    STRICT_UTC_DATE.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

export function missionRequestFingerprint(title) {
  const action = { action: 'fast_break', mission: { kind: 'new', title } }
  return createHash('sha256').update(JSON.stringify(action)).digest('hex')
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
  const idempotencyKey =
    typeof envelope?.idempotencyKey === 'string' ? envelope.idempotencyKey.trim() : ''

  return Boolean(
    envelope &&
      envelope.action === 'fast_break' &&
      idempotencyKey.length > 0 &&
      idempotencyKey.length <= 300 &&
      envelope.idempotencyKey === idempotencyKey &&
      envelope.requestFingerprint === missionRequestFingerprint(title) &&
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
