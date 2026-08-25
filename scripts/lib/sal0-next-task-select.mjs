export const MISSION_MARKER = 'sal0-mission-control:v1'

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

/**
 * Mission Control is the explicit owner queue. A queued mission must outrank
 * the older generic backlog, while malformed or already-active mission
 * envelopes must never fall through and run as ordinary [WEB] issues.
 */
export function selectNextIssue(issues) {
  const eligible = issues
    .filter((issue) => String(issue.title || '').toUpperCase().includes('[WEB]'))
    .filter((issue) => {
      const labels = labelsFor(issue)
      return !labels.includes('in-progress') && !labels.includes('blocked')
    })

  const queuedMission = eligible
    .filter((issue) => parseMissionEnvelope(issue.body)?.mission?.status === 'queued')
    .sort((a, b) => a.number - b.number)[0]

  if (queuedMission) return queuedMission

  return (
    eligible
      .filter((issue) => !hasMissionMarker(issue.body))
      .sort((a, b) => a.number - b.number)[0] || null
  )
}
