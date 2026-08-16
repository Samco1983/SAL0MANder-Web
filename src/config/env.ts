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

/**
 * Like `boolish`, but absent means ON.
 *
 * Reserved for capabilities the owner has approved by default. Note this fails
 * *open*: a missing or unloaded env leaves the feature enabled. Only use it
 * where that is the intended, decided behavior — never as a convenience.
 */
const boolishOn = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => !(v === 'false' || v === '0'))

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
  /**
   * Custom media upload — photos AND short audio clips. OFF unless explicitly
   * set (D-017). One switch for both: they carry the same review requirement,
   * and audio is the higher risk of the two (D-019).
   *
   * `boolish` treats absent, empty, and unrecognized values as false, so this
   * fails closed: forgetting it, misspelling it, or an env file failing to load
   * all leave uploads disabled. Enabling it has to be deliberate.
   */
  VITE_FEATURE_CUSTOM_MEDIA_UPLOAD: boolish,
  /**
   * Student-to-student sharing. OFF unless explicitly set (D-018).
   *
   * Separate from `VITE_FEATURE_CUSTOM_MEDIA_UPLOAD` on purpose: who may share
   * and what may be shared are independent risks, and collapsing them into one
   * switch would mean enabling one to get the other.
   *
   * When this is on, the per-class toggle that controls it must be reachable by
   * teachers only — never by a student, for their own account or anyone else's.
   * This flag cannot express that; it only decides whether the capability
   * exists at all. The role check is a SERVER-SIDE authorization requirement.
   */
  VITE_FEATURE_STUDENT_SHARING: boolish,
  /**
   * Student → teacher sharing. ON by owner decision (D-018).
   *
   * A student sending their own work to their own teacher is ordinary
   * classroom practice and the safest sharing direction, so it defaults on.
   *
   * It is still the direction that introduces attribution: a teacher receiving
   * work has to know whose it is, and that is the first point a child's name
   * could enter the system. See D-018 — attribution must come from a
   * teacher-managed roster, never a free-text field a child types into.
   */
  VITE_FEATURE_SHARE_TO_TEACHER: boolishOn,

  VITE_TELEMETRY_DSN: z.string().optional().default(''),
  VITE_TELEMETRY_SAMPLE_RATE: numeric(0.1),
})

/**
 * The same fields, but a bad value degrades only *that* field.
 *
 * Parsing the whole object atomically was actively dangerous: because every
 * field is optional with a default, one unrecognized value anywhere (say
 * `VITE_FEATURE_GUEST_PLAY=yes`) failed the entire parse, and the fallback
 * reset *every* field to its default. `VITE_API_BASE_URL` became `''`, which
 * flips `api.isConfigured` to false — so a single typo in an unrelated feature
 * flag silently ran production against the in-memory mock transport, losing
 * every student's work with no error anywhere. Per-field recovery keeps one bad
 * value from taking the rest of the configuration with it.
 *
 * Each field falls back to what it yields for `undefined`, i.e. its own
 * declared default.
 */
const ResilientEnvSchema = z.object(
  Object.fromEntries(
    Object.entries(EnvSchema.shape).map(([key, schema]) => {
      // Widened because `.catch()`'s overloads don't unify across a union of
      // differently-typed field schemas.
      const field = schema as z.ZodType
      return [key, field.catch(() => field.parse(undefined))]
    }),
  ) as Record<string, z.ZodType>,
)

/**
 * `.catch()` changes a field's failure behavior, not its output type, so this
 * parses to exactly what `EnvSchema` infers. Asserted once, here, rather than
 * by pretending the wrapped shape is the original shape.
 */
type RawEnv = z.infer<typeof EnvSchema>

/**
 * Pure so it can be tested against a fabricated environment. `import.meta.env`
 * is a build-time constant and cannot be varied from a test.
 */
export function readEnv(source: unknown) {
  // Strict parse for diagnostics only — it names the offending keys, which
  // per-field recovery would otherwise hide.
  const strict = EnvSchema.safeParse(source)
  if (!strict.success) {
    // Loud in dev; never hard-crashes a student mid-session in prod.
    console.error(
      '[env] Ignoring invalid environment values (each falls back to its default):',
      z.treeifyError(strict.error),
    )
  }

  const raw = ResilientEnvSchema.parse(source ?? {}) as RawEnv

  return {
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
      customMediaUpload: raw.VITE_FEATURE_CUSTOM_MEDIA_UPLOAD,
      studentSharing: raw.VITE_FEATURE_STUDENT_SHARING,
      shareToTeacher: raw.VITE_FEATURE_SHARE_TO_TEACHER,
    },

    telemetry: {
      dsn: raw.VITE_TELEMETRY_DSN,
      sampleRate: raw.VITE_TELEMETRY_SAMPLE_RATE,
      isConfigured: raw.VITE_TELEMETRY_DSN.length > 0,
    },

    isProd: raw.VITE_APP_ENV === 'production',
  } as const
}

export const env = readEnv(import.meta.env)

export type Env = ReturnType<typeof readEnv>
