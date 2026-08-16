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

/** `source` is injectable so the URL layout is testable without a real build. */
export function resolveUnityBuildConfig(source: Env = env): UnityBuildConfig | null {
  if (!source.unity.isConfigured) return null

  // Already normalized by `env`, but a caller-supplied source may not be.
  const base = source.unity.buildBaseUrl.replace(/\/+$/, '')
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
