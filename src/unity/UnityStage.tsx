import { useEffect, useRef, useState } from 'react'
import { resolveUnityBuildConfig } from './buildConfig'
import {
  BRIDGE_VERSION,
  sendToUnity,
  type UnityMessageTarget,
  type WebToUnityMessage,
} from './bridge'
import styles from './UnityStage.module.css'

/** Everything the host tells Unity at boot, minus the envelope fields. */
export type BootPayload = Omit<Extract<WebToUnityMessage, { type: 'boot' }>, 'type' | 'version'>

type LoadState =
  | { status: 'unconfigured' }
  | { status: 'loading'; progress: number }
  | { status: 'ready' }
  | { status: 'error'; message: string }

/**
 * Host surface for the Unity WebGL build.
 *
 * No Unity build exists in this repo yet, and none should be committed —
 * WebGL builds are large binaries that belong on a CDN. When
 * `VITE_UNITY_BUILD_BASE_URL` is empty (the default) this renders an explicit
 * placeholder rather than failing.
 *
 * The canvas element is created once and kept for the component's lifetime.
 * Re-rendering the surrounding layout — including collapsing the 42% companion
 * panel — must never tear down a running game.
 */
export function UnityStage({ activityId, boot }: { activityId?: string; boot?: BootPayload }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<LoadState>({ status: 'unconfigured' })
  const config = resolveUnityBuildConfig()

  // The live instance, kept outside state so obtaining it cannot re-render and
  // cannot become a reason to restart the game.
  const instanceRef = useRef<UnityMessageTarget | null>(null)
  const bootedRef = useRef(false)

  /**
   * Boot Unity once, as soon as both halves exist.
   *
   * The activity fetch and the WebGL load race, and either can win: on a warm
   * cache Unity is ready before the bundle arrives; on classroom wifi it is the
   * other way round. Keying on both means the order does not matter.
   *
   * `bootedRef` makes it exactly once per instance. A second `boot` would ask a
   * running game to reload an activity a student is already playing.
   */
  useEffect(() => {
    if (!boot || bootedRef.current || state.status !== 'ready') return
    const sent = sendToUnity(instanceRef.current, {
      type: 'boot',
      version: BRIDGE_VERSION,
      ...boot,
    })
    if (sent) bootedRef.current = true
  }, [boot, state.status])

  useEffect(() => {
    if (!config || !canvasRef.current) return

    let cancelled = false
    let instance: { Quit: () => Promise<void> } | null = null
    setState({ status: 'loading', progress: 0 })

    // The loader is a plain script Unity emits; it registers a global factory.
    const script = document.createElement('script')
    script.src = config.loaderUrl
    script.async = true

    script.onload = () => {
      const createUnityInstance = (
        window as unknown as {
          createUnityInstance?: (
            canvas: HTMLCanvasElement,
            cfg: Record<string, unknown>,
            onProgress: (p: number) => void,
          ) => Promise<{ Quit: () => Promise<void> }>
        }
      ).createUnityInstance

      if (!createUnityInstance || !canvasRef.current) {
        setState({ status: 'error', message: 'Unity loader did not initialize.' })
        return
      }

      createUnityInstance(canvasRef.current, { ...config }, (progress) => {
        if (!cancelled) setState({ status: 'loading', progress })
      })
        .then((created) => {
          if (cancelled) {
            void created.Quit()
            return
          }
          instance = created
          instanceRef.current = created as unknown as UnityMessageTarget
          setState({ status: 'ready' })
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to start Unity.',
          })
        })
    }

    script.onerror = () => {
      if (!cancelled) {
        setState({ status: 'error', message: `Could not load ${config.loaderUrl}` })
      }
    }

    document.body.appendChild(script)

    return () => {
      cancelled = true
      void instance?.Quit()
      instanceRef.current = null
      // A fresh instance is an unbooted one.
      bootedRef.current = false
      script.remove()
    }
    // Only the resolved build identity may restart Unity. `config` is derived
    // from build-time env and is stable for the life of the page.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [config?.loaderUrl])

  if (!config) {
    return (
      <div className={styles.stage}>
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Unity WebGL host</h2>
          <p className={styles.emptyBody}>
            This is the reserved surface for the SAL0MANder Unity WebGL build. No build is
            configured, so nothing is loaded. Gameplay is owned entirely by Unity — the web platform
            hosts it and provides optional context around it.
          </p>
          <p className={styles.hint}>
            Set VITE_UNITY_BUILD_BASE_URL to a folder or CDN path containing Build/
            {activityId ? ` · activity: ${activityId}` : ''}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.stage}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={-1}
        aria-label="SAL0MANder game"
      />
      {state.status === 'loading' ? (
        <div className={styles.empty} role="status">
          <h2 className={styles.emptyTitle}>Loading SAL0MANder…</h2>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressBar}
              style={{ width: `${Math.round(state.progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div className={styles.empty} role="alert">
          <h2 className={styles.emptyTitle}>SAL0MANder could not start</h2>
          <p className={styles.emptyBody}>{state.message}</p>
        </div>
      ) : null}
    </div>
  )
}
