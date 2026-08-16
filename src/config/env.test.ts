import { afterEach, describe, expect, it, vi } from 'vitest'
import { readEnv } from './env'

afterEach(() => {
  vi.restoreAllMocks()
})

/** Silences the intentional diagnostic so a failing-parse test isn't noisy. */
function quietly<T>(fn: () => T): T {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  return fn()
}

describe('readEnv defaults', () => {
  it('runs against the mock transport when nothing is configured', () => {
    const env = readEnv({})
    expect(env.api.isConfigured).toBe(false)
    expect(env.unity.isConfigured).toBe(false)
    expect(env.api.contractVersion).toBe('v1')
    expect(env.api.timeoutMs).toBe(15_000)
  })

  it('strips trailing slashes so joined URLs never double up', () => {
    const env = readEnv({ VITE_API_BASE_URL: 'https://api.example.com///' })
    expect(env.api.baseUrl).toBe('https://api.example.com')
    expect(env.api.isConfigured).toBe(true)
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
