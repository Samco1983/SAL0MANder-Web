import { env } from '@config/env'

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

export function resolveUnityBuildConfig(): UnityBuildConfig | null {
  if (!env.unity.isConfigured) return null

  const base = env.unity.buildBaseUrl.replace(/\/+$/, '')
  const name = env.unity.buildName

  return {
    loaderUrl: `${base}/Build/${name}.loader.js`,
    dataUrl: `${base}/Build/${name}.data`,
    frameworkUrl: `${base}/Build/${name}.framework.js`,
    codeUrl: `${base}/Build/${name}.wasm`,
    streamingAssetsUrl: `${base}/StreamingAssets`,
    companyName: 'SAL0MANder',
    productName: env.appName,
    productVersion: '0.0.0',
  }
}
