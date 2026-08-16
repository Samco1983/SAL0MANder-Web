import type { z } from 'zod'
import type { RequestOptions, Transport } from './transport'
import { ApiError } from './errors'
import { newId } from '@contracts/v1'

/**
 * In-memory transport used when no backend is configured (`VITE_API_BASE_URL`
 * empty), which is the default for foundation work.
 *
 * Its job is to let the whole app — routes, loading states, error states — be
 * built and tested against the real contract before any backend provider is
 * chosen. It is NOT a persistence layer and deliberately forgets everything on
 * reload.
 */

const now = () => new Date().toISOString()

const DEMO_ACTIVITY_ID = 'demo-activity'
const DEMO_VERSION_ID = 'demo-version-1'

/**
 * Link states a share code can resolve to, so each can be built and seen
 * locally. A teacher fielding "the link doesn't work" needs these to be
 * distinguishable, and a student needs to be told which one happened.
 *
 * Carried on `serverCode` rather than as new `ApiErrorCode` members: the shared
 * error vocabulary is still being negotiated (casing is unresolved), and this
 * needs no contract change to be useful today.
 */
/**
 * Share codes, in the code alphabet — not activity ids (P-002).
 *
 * Every link state is reachable by code as well as by id, so the resolution
 * path can be exercised end to end without the older path.
 */
export const MOCK_SHARE_CODES = {
  ok: 'K7Q4M2XP',
  revoked: 'R3V0K3DX',
  unpublished: 'NPB5HED2',
} as const

export const MOCK_SHARE_CODE = MOCK_SHARE_CODES.ok

/** The `PlayBundle` shape from `API_CONTRACT.md`, served by the mock resolver. */
function demoPlayBundle(activityId: string) {
  const pieceCount = 9
  return {
    activityId,
    activityVersionId: DEMO_VERSION_ID,
    versionNumber: 1,
    title: 'Fractions Review',
    description: 'A mock play bundle in the shape API_CONTRACT.md specifies.',
    authorDisplayName: 'Ms. Rivera',
    allowedPlayModes: ['learning-puzzle', 'classic-puzzle'],
    defaultPlayMode: 'learning-puzzle',
    puzzle: {
      pieceCount,
      boardShape: 'square',
      showBoardGuide: true,
      enableCameraZoomAndPan: false,
      allowRestart: true,
      allowResumeLater: true,
      allowHints: true,
      allowCompletedPictureView: false,
      allowClassicCustomization: false,
    },
    puzzleAsset: {
      assetId: 'media_demo_1024',
      variant: 'display_1024',
      downloadUrl: 'https://cdn.example.invalid/puzzles/media_demo_1024/display_1024.png',
      downloadUrlExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      contentType: 'image/png',
      byteSize: 812345,
      width: 1024,
      height: 768,
      checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
    },
    quiz: {
      quizId: 'quiz_demo',
      releaseMode: 'question-driven',
      // A Learning activity needs at least `pieceCount` questions, or a student
      // is stranded with pieces they can never release.
      questions: Array.from({ length: pieceCount }, (_, i) => ({
        questionId: `q_${i + 1}`,
        prompt: `${i + 1} + 1 = ?`,
        linkedPieceIndex: i,
        choices: [
          { choiceId: `q${i + 1}_a`, text: String(i + 2), isCorrect: true },
          { choiceId: `q${i + 1}_b`, text: String(i + 3), isCorrect: false },
        ],
      })),
    },
  }
}

export const MOCK_LINKS = {
  ok: DEMO_ACTIVITY_ID,
  /** The teacher revoked this specific link; the activity may still exist. */
  revoked: 'revoked-link',
  /** The activity exists but is no longer published. */
  unpublished: 'unpublished-activity',
} as const

const LINK_FAILURES: Record<string, { serverCode: string; message: string }> = {
  [MOCK_LINKS.revoked]: {
    serverCode: 'SHARE_LINK_REVOKED',
    message: 'Share link revoked by its owner',
  },
  [MOCK_LINKS.unpublished]: {
    serverCode: 'ACTIVITY_UNPUBLISHED',
    message: 'Activity is not currently published',
  },
  // Same states, reachable by share code.
  [MOCK_SHARE_CODES.revoked]: {
    serverCode: 'SHARE_LINK_REVOKED',
    message: 'Share link revoked by its owner',
  },
  [MOCK_SHARE_CODES.unpublished]: {
    serverCode: 'ACTIVITY_UNPUBLISHED',
    message: 'Activity is not currently published',
  },
}

function demoBundle(activityId: string) {
  return {
    summary: {
      id: activityId,
      title: 'Sample SAL0MANder Activity',
      description:
        'A placeholder activity served by the local mock backend so Guest Play can be built and tested before a real backend exists.',
      mode: 'learning-puzzle' as const,
      thumbnail: null,
      authorDisplayName: 'Demo Teacher',
    },
    version: {
      id: DEMO_VERSION_ID,
      activityId,
      versionNumber: 1,
      payload: { schemaVersion: 1, body: { placeholder: true } },
      media: [],
      createdAt: now(),
    },
  }
}

/**
 * Fingerprint of what a keyed write is asking for. Two requests sharing an
 * idempotency key must be the *same* request; if they aren't, the key was
 * reused by mistake and replaying the first response would hand back a record
 * the caller never asked for.
 */
function requestFingerprint(options: RequestOptions): string {
  return JSON.stringify([options.method ?? 'GET', options.path, options.body ?? null])
}

export function createMockTransport(): Transport {
  const sessions = new Map<string, unknown>()
  /** Replays the stored response for a repeated key — mirrors server behavior. */
  const idempotency = new Map<string, { fingerprint: string; response: unknown }>()

  return {
    async request<T>(options: RequestOptions, schema: z.ZodType<T>): Promise<T> {
      await new Promise((r) => setTimeout(r, 120))

      const fingerprint = requestFingerprint(options)
      const replayed = options.idempotencyKey ? idempotency.get(options.idempotencyKey) : undefined
      if (replayed) {
        // A real server must reject this rather than silently replay, or a key
        // collision quietly returns the wrong record. The mock enforces it so
        // the app is built against the strict behavior from the start.
        if (replayed.fingerprint !== fingerprint) {
          throw new ApiError({
            code: 'conflict',
            message: `Idempotency key ${options.idempotencyKey} was reused with a different request`,
            status: 409,
          })
        }
        return schema.parse(replayed.response)
      }

      const result = route(options, sessions)
      if (options.idempotencyKey) {
        idempotency.set(options.idempotencyKey, { fingerprint, response: result })
      }

      const parsed = schema.safeParse(result)
      if (!parsed.success) {
        throw new ApiError({
          code: 'contract_mismatch',
          message: `Mock transport produced a payload that fails the contract for ${options.path}`,
          details: { issues: parsed.error.issues },
        })
      }
      return parsed.data
    },
  }
}

function route(options: RequestOptions, sessions: Map<string, unknown>): unknown {
  const { path, method = 'GET', body } = options

  // Share-link resolution (API_CONTRACT.md §GET /v1/play/{shareCode}).
  const playResolve = path.match(/^\/v1\/play\/([^/]+)$/)
  if (playResolve && method === 'GET') {
    const code = decodeURIComponent(playResolve[1] ?? '').toUpperCase()

    // Same three link states as the activityId path, so both are exercisable.
    const failure = LINK_FAILURES[code]
    if (failure) {
      throw new ApiError({
        code: 'not_found',
        message: failure.message,
        status: 404,
        serverCode: failure.serverCode,
      })
    }
    if (code !== MOCK_SHARE_CODE) {
      throw new ApiError({ code: 'not_found', message: `No share code ${code}`, status: 404 })
    }
    return demoPlayBundle(DEMO_ACTIVITY_ID)
  }

  const guestActivity = path.match(/^\/guest\/activities\/([^/]+)$/)
  if (guestActivity && method === 'GET') {
    const id = decodeURIComponent(guestActivity[1] ?? '')

    // A revoked or unpublished link is gone on purpose, not mistyped. Same
    // status, different `serverCode`, so the UI can say which happened.
    const failure = LINK_FAILURES[id]
    if (failure) {
      throw new ApiError({
        code: 'not_found',
        message: failure.message,
        status: 404,
        serverCode: failure.serverCode,
      })
    }

    // Only the demo id resolves, so the not-found path is exercisable locally.
    if (id !== DEMO_ACTIVITY_ID) {
      throw new ApiError({ code: 'not_found', message: `No activity ${id}`, status: 404 })
    }
    return demoBundle(id)
  }

  if (path === '/sessions' && method === 'POST') {
    const input = (body ?? {}) as Record<string, unknown>
    const session = {
      id: newId(),
      activityId: input.activityId ?? DEMO_ACTIVITY_ID,
      activityVersionId: input.activityVersionId ?? DEMO_VERSION_ID,
      identity: input.identity ?? { kind: 'guest', guestToken: newId() },
      status: 'in-progress',
      startedAt: now(),
      completedAt: null,
    }
    sessions.set(session.id, session)
    return session
  }

  const sessionResult = path.match(/^\/sessions\/([^/]+)\/result$/)
  if (sessionResult && method === 'POST') {
    const id = decodeURIComponent(sessionResult[1] ?? '')
    const existing = sessions.get(id) as Record<string, unknown> | undefined
    if (!existing) {
      throw new ApiError({ code: 'not_found', message: `No session ${id}`, status: 404 })
    }
    const updated = { ...existing, status: 'completed', completedAt: now() }
    sessions.set(id, updated)
    return updated
  }

  throw new ApiError({
    code: 'not_found',
    message: `Mock transport has no route for ${method} ${path}`,
    status: 404,
  })
}

export const MOCK_DEMO_ACTIVITY_ID = DEMO_ACTIVITY_ID
