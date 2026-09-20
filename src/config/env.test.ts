import { afterEach, describe, expect, it, vi } from 'vitest'
import { readEnv } from './env'
import { PUBLIC_TUTORING_BOOKING_URL } from './classroom'

afterEach(() => {
  vi.restoreAllMocks()
})

/** Silences the intentional diagnostic so a failing-parse test isn't noisy. */
function quietly<T>(fn: () => T): T {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  return fn()
}

describe('readEnv defaults', () => {
  it('labels Stripe test checkout only when the dedicated public test flag is enabled', () => {
    expect(readEnv({}).groups.testMode).toBe(false)
    expect(readEnv({ VITE_GROUP_DEMO: 'true' }).groups.testMode).toBe(false)
    for (const value of ['true', '1']) {
      const groups = readEnv({ VITE_GROUP_TEST_MODE: value }).groups
      expect(groups.testMode).toBe(true)
      expect(groups.demo).toBe(false)
      expect(groups.selfEnrollment).toBe(false)
    }
    for (const value of ['false', '0', '']) {
      expect(readEnv({ VITE_GROUP_TEST_MODE: value }).groups.testMode).toBe(false)
    }
    expect(quietly(() => readEnv({ VITE_GROUP_TEST_MODE: 'yes' })).groups.testMode).toBe(false)
  })
  it('keeps parent/adult enrollment off unless its own public flag is explicitly enabled', () => {
    expect(readEnv({}).groups.selfEnrollment).toBe(false)
    expect(readEnv({ VITE_GROUP_DEMO: 'true' }).groups.selfEnrollment).toBe(false)
    expect(readEnv({ VITE_GROUP_SELF_ENROLLMENT: 'true' }).groups.selfEnrollment).toBe(true)
    expect(readEnv({ VITE_GROUP_SELF_ENROLLMENT: '1' }).groups.selfEnrollment).toBe(true)
    expect(readEnv({ VITE_GROUP_SELF_ENROLLMENT: 'false' }).groups.selfEnrollment).toBe(false)
    expect(
      quietly(() => readEnv({ VITE_GROUP_SELF_ENROLLMENT: 'yes' })).groups.selfEnrollment,
    ).toBe(false)
  })
  it('uses the puzzle home unless tutoring mode is explicitly selected', () => {
    expect(readEnv({}).siteMode).toBe('puzzles')
    expect(readEnv({ VITE_SITE_MODE: 'tutoring' }).siteMode).toBe('tutoring')
    expect(quietly(() => readEnv({ VITE_SITE_MODE: 'other' })).siteMode).toBe('puzzles')
  })
  it('defaults only the public booking page, leaves private Meet/API unset and validates overrides', () => {
    expect(readEnv({}).gifts.apiBaseUrl).toBe('')
    expect(readEnv({}).classroom).toEqual({
      invitation: null,
      bookingUrl: PUBLIC_TUTORING_BOOKING_URL,
      payment: { cents: null, required: false },
    })
    expect(readEnv({ VITE_CLASSROOM_BOOKING_URL: '' }).classroom.bookingUrl).toBe('')
    expect(
      readEnv({ VITE_GIFT_API_BASE_URL: 'https://api.example.com/lessons///' }).gifts.apiBaseUrl,
    ).toBe('https://api.example.com/lessons')
    expect(readEnv({ VITE_GIFT_API_BASE_URL: 'http://127.0.0.1:8787' }).gifts.apiBaseUrl).toBe(
      'http://127.0.0.1:8787',
    )
    expect(readEnv({ VITE_GIFT_API_BASE_URL: 'http://[::1]:8787/' }).gifts.apiBaseUrl).toBe(
      'http://[::1]:8787',
    )
    const configured = readEnv({
      VITE_CLASSROOM_JOIN_URL: 'https://meet.google.com/abc-defg-hij',
      VITE_CLASSROOM_BOOKING_URL: 'https://calendar.app.google/AbCdEfGh12345678',
    })
    expect(configured.classroom.invitation?.meetingCode).toBe('abc-defg-hij')
    expect(configured.classroom.bookingUrl).toBe('https://calendar.app.google/AbCdEfGh12345678')
    expect(
      readEnv({
        VITE_CLASSROOM_JOIN_URL: 'https://zoom.us/j/123456789',
        VITE_CLASSROOM_BOOKING_URL: 'https://scheduler.zoom.us/tutor/math',
      }).classroom,
    ).toEqual({ invitation: null, bookingUrl: '', payment: { cents: null, required: false } })
    expect(readEnv({}).sites).toEqual({ tutoring: '', puzzles: '' })
    expect(
      readEnv({
        VITE_TUTORING_SITE_BASE_URL: 'https://salomandermath.com/',
        VITE_PUZZLE_SITE_BASE_URL: 'https://sal0mander.com/',
      }).sites,
    ).toEqual({ tutoring: 'https://salomandermath.com', puzzles: 'https://sal0mander.com' })
  })
  it.each([
    'http://example.com',
    'https://user:secret@example.com',
    'https://example.com?secret=bad',
    'https://example.com#fragment',
    'javascript:alert(1)',
    'https://example.com/\npath',
  ])('keeps unsafe gift API configuration disabled: %s', (url) => {
    expect(readEnv({ VITE_GIFT_API_BASE_URL: url }).gifts.apiBaseUrl).toBe('')
  })
  it('runs against the mock transport when nothing is configured', () => {
    const env = readEnv({})
    expect(env.api.isConfigured).toBe(false)
    expect(env.unity.isConfigured).toBe(false)
    expect(env.ops.isConfigured).toBe(false)
    expect(env.api.contractVersion).toBe('v1')
    expect(env.api.timeoutMs).toBe(15_000)
  })

  it('strips trailing slashes so joined URLs never double up', () => {
    const env = readEnv({
      VITE_API_BASE_URL: 'https://api.example.com///',
      VITE_OPS_API_BASE_URL: 'https://ops.example.com///',
    })
    expect(env.api.baseUrl).toBe('https://api.example.com')
    expect(env.api.isConfigured).toBe(true)
    expect(env.ops.baseUrl).toBe('https://ops.example.com')
    expect(env.ops.isConfigured).toBe(true)
  })

  it('treats only true/1 as an enabled flag', () => {
    expect(readEnv({ VITE_FEATURE_ACCOUNTS: 'true' }).features.accounts).toBe(true)
    expect(readEnv({ VITE_FEATURE_ACCOUNTS: '1' }).features.accounts).toBe(true)
    expect(readEnv({ VITE_FEATURE_ACCOUNTS: 'false' }).features.accounts).toBe(false)
    expect(readEnv({ VITE_FEATURE_ACCOUNTS: '0' }).features.accounts).toBe(false)
  })
})

describe('readEnv resilience', () => {
  it('does not let one bad value reset unrelated configuration', () => {
    // Regression: an atomic parse failed wholesale here, resetting every field
    // to its default. `VITE_API_BASE_URL` became '', `api.isConfigured` flipped
    // to false, and production silently ran on the in-memory mock transport.
    const env = quietly(() =>
      readEnv({
        VITE_API_BASE_URL: 'https://api.example.com',
        VITE_UNITY_BUILD_BASE_URL: 'https://cdn.example.com/unity',
        VITE_FEATURE_GUEST_PLAY: 'yes', // not a recognized boolean
      }),
    )

    expect(env.api.baseUrl).toBe('https://api.example.com')
    expect(env.api.isConfigured).toBe(true)
    expect(env.unity.isConfigured).toBe(true)
    // Only the offending field falls back.
    expect(env.features.guestPlay).toBe(false)
  })

  it('still reports the invalid value so it is fixable', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    readEnv({ VITE_APP_ENV: 'not-an-environment' })
    expect(spy).toHaveBeenCalled()
  })

  it('falls back per field for a bad enum, number, and env name at once', () => {
    const env = quietly(() =>
      readEnv({
        VITE_APP_ENV: 'nope',
        VITE_STORAGE_PROVIDER: 'redis',
        VITE_API_TIMEOUT_MS: 'soon',
        VITE_APP_NAME: 'SAL0MANder Staging',
      }),
    )

    expect(env.appEnv).toBe('local')
    expect(env.storage.provider).toBe('memory')
    expect(env.api.timeoutMs).toBe(15_000)
    // The one valid field survives its neighbours being wrong.
    expect(env.appName).toBe('SAL0MANder Staging')
  })

  it('survives a null or undefined source', () => {
    expect(quietly(() => readEnv(undefined)).api.isConfigured).toBe(false)
    expect(quietly(() => readEnv(null)).api.isConfigured).toBe(false)
  })
})

describe('gated capability flags', () => {
  it('leaves custom media upload and student-to-student sharing off by default', () => {
    const features = readEnv({}).features
    expect(features.customMediaUpload).toBe(false)
    expect(features.studentSharing).toBe(false)
  })

  it('fails closed on a garbled value for a gated capability', () => {
    // Forgetting it, misspelling it, or a broken env file must all leave the
    // capability off. Enabling has to be deliberate.
    const features = quietly(
      () =>
        readEnv({
          VITE_FEATURE_CUSTOM_MEDIA_UPLOAD: 'yes',
          VITE_FEATURE_STUDENT_SHARING: 'on',
        }).features,
    )
    expect(features.customMediaUpload).toBe(false)
    expect(features.studentSharing).toBe(false)
  })

  it('enables a gated capability only on an explicit true', () => {
    expect(readEnv({ VITE_FEATURE_CUSTOM_MEDIA_UPLOAD: 'true' }).features.customMediaUpload).toBe(
      true,
    )
    expect(readEnv({ VITE_FEATURE_STUDENT_SHARING: '1' }).features.studentSharing).toBe(true)
  })

  it('keeps the two sharing capabilities independent', () => {
    // Who may share and what may be shared are separate risks; enabling one
    // must never imply the other.
    const features = readEnv({ VITE_FEATURE_CUSTOM_MEDIA_UPLOAD: 'true' }).features
    expect(features.customMediaUpload).toBe(true)
    expect(features.studentSharing).toBe(false)
  })

  it('has student-to-teacher sharing on by default, and switchable off', () => {
    expect(readEnv({}).features.shareToTeacher).toBe(true)
    expect(readEnv({ VITE_FEATURE_SHARE_TO_TEACHER: 'false' }).features.shareToTeacher).toBe(false)
    expect(readEnv({ VITE_FEATURE_SHARE_TO_TEACHER: '0' }).features.shareToTeacher).toBe(false)
  })
})

describe('readEnv derived flags', () => {
  it('marks production only for the production env', () => {
    expect(readEnv({ VITE_APP_ENV: 'production' }).isProd).toBe(true)
    expect(readEnv({ VITE_APP_ENV: 'staging' }).isProd).toBe(false)
  })

  it('treats an empty telemetry DSN as unconfigured', () => {
    expect(readEnv({}).telemetry.isConfigured).toBe(false)
    expect(readEnv({ VITE_TELEMETRY_DSN: 'https://dsn.example' }).telemetry.isConfigured).toBe(true)
  })
})
