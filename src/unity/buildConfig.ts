import { env, type Env } from '@config/env'

/**
 * Resolves the file layout Unity emits for a WebGL build.
 *
 * Unity names its artifacts after the build name: `<name>.loader.js`,
 * `<name>.data`, `<name>.framework.js`, `<name>.wasm` (with `.br`/`.gz`
 * suffixes when compression is enabled). Keeping that convention in one place
 * means pointing at a new build — local folder or CDN path — is a config change.
 */
export type UnityBuildConfig = {
  loaderUrl: string
  dataUrl: string
  frameworkUrl: string
  codeUrl: string
  streamingAssetsUrl: string
  companyName: string
  productName: string
  productVersion: string
}

/**
 * Where the build actually lives, once the deploy path is taken into account.
 *
 * `VITE_UNITY_BUILD_BASE_URL` is a plain string in the env schema — no
 * absolute-URL requirement — so a site-relative value is accepted, and hosting
 * the WebGL build alongside the site is the obvious choice when there is no
 * CDN. But the site is served from `/SAL0MANder-Web/` on project Pages, so
 * `/unity-build` resolves to a path that does not exist and the game never
 * loads. Nothing else in the app reports this: the stage simply shows its
 * "game isn't ready" surface, which looks like a missing build rather than a
 * wrong URL.
 *
 * An absolute or protocol-relative URL is left completely alone — that is a
 * real CDN, and prefixing it would break the case that already works.
 */
export function resolveBuildBase(raw: string, basePath: string = readDeployBase()): string {
  const trimmed = raw.replace(/\/+$/, '')
  if (trimmed === '') return trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) return trimmed

  const prefix = basePath.replace(/\/+$/, '')
  if (prefix === '') return trimmed

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  // Do not double it — the same failure #24 fixed for share links.
  if (path === prefix || path.startsWith(`${prefix}/`)) return path
  return `${prefix}${path}`
}

function readDeployBase(): string {
  return ((import.meta.env?.BASE_URL as string | undefined) ?? '/') || '/'
}

/** `source` is injectable so the URL layout is testable without a real build. */
export function resolveUnityBuildConfig(source: Env = env): UnityBuildConfig | null {
  if (!source.unity.isConfigured) return null

  // Already normalized by `env`, but a caller-supplied source may not be.
  const base = resolveBuildBase(source.unity.buildBaseUrl)
  const name = source.unity.buildName

  return {
    loaderUrl: `${base}/Build/${name}.loader.js`,
    dataUrl: `${base}/Build/${name}.data`,
    frameworkUrl: `${base}/Build/${name}.framework.js`,
    codeUrl: `${base}/Build/${name}.wasm`,
    streamingAssetsUrl: `${base}/StreamingAssets`,
    companyName: 'SAL0MANder',
    productName: source.appName,
    productVersion: '0.0.0',
  }
}
