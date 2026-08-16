/**
 * Typed, validated access to build-time environment.
 *
 * Every value here is PUBLIC — it is inlined into the browser bundle by Vite.
 * Secrets must never reach this file. See `.env.example`.
 *
 * Consumers should import `env` rather than touching `import.meta.env`, so the
 * set of environment inputs stays enumerable and testable in one place.
 */
import { z } from 'zod'

const boolish = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const numeric = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v)
      return v === undefined || v === '' || Number.isNaN(n) ? fallback : n
    })

/** Trailing slashes cause double-slash URLs when joined; normalize once. */
const url = z
  .string()
  .optional()
  .transform((v) => (v ?? '').replace(/\/+$/, ''))

const EnvSchema = z.object({
  VITE_APP_NAME: z.string().optional().default('SAL0MANder'),
  VITE_APP_ENV: z
    .enum(['local', 'development', 'staging', 'production'])
    .optional()
    .default('local'),
  VITE_PUBLIC_BASE_URL: url,

  VITE_API_BASE_URL: url,
  VITE_API_CONTRACT_VERSION: z.string().optional().default('v1'),
  VITE_API_TIMEOUT_MS: numeric(15_000),

  VITE_UNITY_BUILD_BASE_URL: url,
  VITE_UNITY_BUILD_NAME: z.string().optional().default('SAL0MANder'),

  VITE_STORAGE_PROVIDER: z.enum(['memory', 'http']).optional().default('memory'),
  VITE_MEDIA_CDN_BASE_URL: url,

  VITE_FEATURE_COMPANION_LAYOUT: boolish,
  VITE_FEATURE_GUEST_PLAY: boolish,
  VITE_FEATURE_ACCOUNTS: boolish,

  VITE_TELEMETRY_DSN: z.string().optional().default(''),
  VITE_TELEMETRY_SAMPLE_RATE: numeric(0.1),
})

const parsed = EnvSchema.safeParse(import.meta.env)

if (!parsed.success) {
  // Fail loudly in dev, but never hard-crash a student mid-session in prod.
  console.error('[env] Invalid environment configuration:', z.treeifyError(parsed.error))
}

const raw = parsed.success ? parsed.data : EnvSchema.parse({})

export const env = {
  appName: raw.VITE_APP_NAME,
  appEnv: raw.VITE_APP_ENV,
  publicBaseUrl: raw.VITE_PUBLIC_BASE_URL,

  api: {
    baseUrl: raw.VITE_API_BASE_URL,
    contractVersion: raw.VITE_API_CONTRACT_VERSION,
    timeoutMs: raw.VITE_API_TIMEOUT_MS,
    /** No backend configured yet — the app runs against the mock transport. */
    isConfigured: raw.VITE_API_BASE_URL.length > 0,
  },

  unity: {
    buildBaseUrl: raw.VITE_UNITY_BUILD_BASE_URL,
    buildName: raw.VITE_UNITY_BUILD_NAME,
    isConfigured: raw.VITE_UNITY_BUILD_BASE_URL.length > 0,
  },

  storage: {
    provider: raw.VITE_STORAGE_PROVIDER,
    cdnBaseUrl: raw.VITE_MEDIA_CDN_BASE_URL,
  },

  features: {
    companionLayout: raw.VITE_FEATURE_COMPANION_LAYOUT,
    guestPlay: raw.VITE_FEATURE_GUEST_PLAY,
    accounts: raw.VITE_FEATURE_ACCOUNTS,
  },

  telemetry: {
    dsn: raw.VITE_TELEMETRY_DSN,
    sampleRate: raw.VITE_TELEMETRY_SAMPLE_RATE,
    isConfigured: raw.VITE_TELEMETRY_DSN.length > 0,
  },

  isProd: raw.VITE_APP_ENV === 'production',
} as const

export type Env = typeof env
