import { describe, expect, it } from 'vitest'
import {
  ActivityIdSchema,
  GuestActivityBundleSchema,
  GuestIdentitySchema,
  SubmitResultRequestSchema,
  codeFromStatus,
  isRetryable,
  newId,
} from './index'

describe('durable ids', () => {
  it('mints URL-safe ids that satisfy the id schema', () => {
    for (let i = 0; i < 50; i++) {
      const id = newId()
      expect(ActivityIdSchema.safeParse(id).success).toBe(true)
      expect(encodeURIComponent(id)).toBe(id)
    }
  })

  it('rejects ids that would break share links', () => {
    for (const bad of ['', 'short', 'has space', 'has/slash', 'has?query']) {
      expect(ActivityIdSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('guest identity', () => {
  it('accepts a guest with no display name — playing must never require one', () => {
    const parsed = GuestIdentitySchema.safeParse({ kind: 'guest', guestToken: newId() })
    expect(parsed.success).toBe(true)
  })
})

describe('guest activity bundle', () => {
  const bundle = {
    summary: {
      id: newId(),
      title: 'Fractions warm-up',
      description: '',
      mode: 'learning-puzzle',
      thumbnail: null,
      authorDisplayName: 'Ms. Rivera',
    },
    version: {
      id: newId(),
      activityId: newId(),
      versionNumber: 1,
      payload: { schemaVersion: 1, body: { anything: true } },
      media: [],
      createdAt: new Date().toISOString(),
    },
  }

  it('parses a well-formed bundle', () => {
    expect(GuestActivityBundleSchema.safeParse(bundle).success).toBe(true)
  })

  it('keeps the Unity payload opaque so the web app cannot fork gameplay rules', () => {
    const parsed = GuestActivityBundleSchema.parse({
      ...bundle,
      version: {
        ...bundle.version,
        payload: { schemaVersion: 7, body: { pieces: 42, nested: { anything: 'goes' } } },
      },
    })
    expect(parsed.version.payload.schemaVersion).toBe(7)
    expect(parsed.version.payload.body).toEqual({ pieces: 42, nested: { anything: 'goes' } })
  })

  it('rejects a bundle carrying no version', () => {
    const { version: _version, ...withoutVersion } = bundle
    expect(GuestActivityBundleSchema.safeParse(withoutVersion).success).toBe(false)
  })
})

describe('result submission', () => {
  it('requires an idempotency key so a retried submit cannot double-count', () => {
    const result = {
      sessionId: newId(),
      status: 'completed',
      durationMs: 1000,
      questionsAnswered: 4,
      questionsCorrect: 3,
      piecesPlaced: 12,
      piecesTotal: 12,
      completedAt: new Date().toISOString(),
    }
    expect(SubmitResultRequestSchema.safeParse({ result }).success).toBe(false)
    expect(SubmitResultRequestSchema.safeParse({ idempotencyKey: newId(), result }).success).toBe(
      true,
    )
  })
})

describe('error vocabulary', () => {
  it('maps transport statuses to stable codes', () => {
    expect(codeFromStatus(404)).toBe('not_found')
    expect(codeFromStatus(429)).toBe('rate_limited')
    expect(codeFromStatus(503)).toBe('server_error')
  })

  it('marks only transient failures retryable', () => {
    expect(isRetryable('timeout')).toBe(true)
    expect(isRetryable('server_error')).toBe(true)
    expect(isRetryable('not_found')).toBe(false)
    expect(isRetryable('contract_mismatch')).toBe(false)
  })
})
