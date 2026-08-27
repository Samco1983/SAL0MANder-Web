import { useEffect, useRef, useState } from 'react'
import { Button } from '@components/ui/Button'
import { clampDevicePixelRatio, resolveUnityBuildConfig } from './buildConfig'
import {
  BRIDGE_VERSION,
  onUnityMessage,
  sendToUnity,
  summarizeBridgeMismatch,
  type BridgeMismatchSummary,
  type UnityMessageTarget,
  type WebToUnityMessage,
} from './bridge'
import styles from './UnityStage.module.css'

/**
 * Turn a loader failure into something a student can act on.
 *
 * Added alongside the raw loader text, never instead of it. A student needs to
 * know whether to try again; a teacher filing a bug needs the actual reason.
 */
function describeLoadFailure(raw: string): string {
  if (/network|fetch|load|404|failed to load/i.test(raw)) {
    return 'The game files could not be downloaded. This is usually the connection — try again.'
  }
  if (/memory|allocat/i.test(raw)) {
    return 'This device ran out of memory starting the game. Close other tabs and try again.'
  }
  return 'The game could not start. Try again, and tell your teacher if it keeps happening.'
}

/** Everything the host tells Unity at boot, minus the envelope fields. */
export type BootPayload = Omit<Extract<WebToUnityMessage, { type: 'boot' }>, 'type' | 'version'>

export type SessionStartedPayload = Omit<
  Extract<WebToUnityMessage, { type: 'session-started' }>,
  'type' | 'version'
>

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
export function UnityStage({
  activityId,
  boot,
  sessionStarted,
  audience = 'developer',
}: {
  activityId?: string
  /**
   * Who is looking at this surface when something is wrong.
   *
   * The bare /unity route is a developer smoke test and wants the env var
   * name. Guest Play is a student who followed a teacher's link, and showing
   * them `VITE_UNITY_BUILD_BASE_URL` is both useless and slightly alarming.
   * Same component, same states — different reader.
   */
  audience?: 'student' | 'developer'
  boot?: BootPayload
  /**
   * The canonical session, once the web has opened it. Sent on to Unity so it
   * can correlate anything it later emits — Unity cannot know this id, because
   * the web mints it server-side.
   */
  sessionStarted?: SessionStartedPayload
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<LoadState>({ status: 'unconfigured' })
  const config = resolveUnityBuildConfig()

  // The live instance, kept outside state so obtaining it cannot re-render and
  // cannot become a reason to restart the game.
  /**
   * Incremented to ask for a fresh load attempt.
   *
   * A WebGL download that dies on classroom wifi is the most common failure
   * this host has, and until now it was terminal: the student saw "could not
   * start" and the only way forward was reloading the whole page. Retrying
   * through the same effect means the cleanup runs first, so a retry cannot
   * leave a half-initialised instance behind.
   */
  const [retryToken, setRetryToken] = useState(0)
  const instanceRef = useRef<UnityMessageTarget | null>(null)
  const bootedRef = useRef(false)
  const [bridgeDiagnostics, setBridgeDiagnostics] = useState<BridgeMismatchSummary[]>([])

  /**
   * How many times Unity has announced, from inside the build, that its bridge
   * receiver exists.
   *
   * The loader promise resolving is a *different fact*: `createUnityInstance`
   * settles when the WebGL runtime is up, while the C# object `sendToUnity`
   * targets is created by the build's own startup, which has not necessarily
   * run. Unity's `SendMessage` throws when the target does not exist yet, so a
   * first boot can fail for a reason that resolves a moment later — and nothing
   * the boot effect depends on would ever change again. The student is left on
   * an empty board with no error anywhere.
   *
   * Counted rather than flagged so a re-announcement re-runs the send effects;
   * `bootedRef` and `sentSessionRef` are what keep it to once each. The message
   * name is `API_CONTRACT.md` §WebGL bridge's `unity-ready`, which the bridge
   * aliases onto `ready` — nothing new is being asserted about Unity here.
   */
  const [handshakes, setHandshakes] = useState(0)
  useEffect(() => {
    return onUnityMessage(
      (message) => {
        if (message.type !== 'ready') return
        setHandshakes((n) => n + 1)
      },
      {
        onMismatch: (mismatch) => {
          const summary = summarizeBridgeMismatch(mismatch)
          setBridgeDiagnostics((current) => [...current, summary].slice(-3))
        },
      },
    )
  }, [])

  /**
   * Boot Unity once, as soon as both halves exist.
   *
   * The activity fetch and the WebGL load race, and either can win: on a warm
   * cache Unity is ready before the bundle arrives; on classroom wifi it is the
   * other way round. Keying on both means the order does not matter.
   *
   * `bootedRef` makes it exactly once per instance. A second `boot` would ask a
   * running game to reload an activity a student is already playing — so a
   * failed send deliberately leaves the flag alone and is retried, while a
   * delivered one is never repeated.
   */
  useEffect(() => {
    if (!boot || bootedRef.current || state.status !== 'ready') return
    const sent = sendToUnity(instanceRef.current, {
      type: 'boot',
      version: BRIDGE_VERSION,
      ...boot,
    })
    if (sent) bootedRef.current = true
  }, [boot, state.status, handshakes])

  /**
   * Hand Unity the canonical session id once the web has one.
   *
   * Ordered after boot *explicitly*, not by construction. The old reasoning —
   * a session only exists after the bundle resolved, and boot fires the moment
   * the bundle and the instance both do — holds only while boot cannot fail.
   * It can, and a session id reaching a build that never received its activity
   * names a session for a game that was never started.
   *
   * Sent once per session id — resending would tell a running game its session
   * restarted.
   */
  const sentSessionRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!sessionStarted || state.status !== 'ready' || !bootedRef.current) return
    if (sentSessionRef.current === sessionStarted.sessionId) return
    const sent = sendToUnity(instanceRef.current, {
      type: 'session-started',
      version: BRIDGE_VERSION,
      ...sessionStarted,
    })
    if (sent) sentSessionRef.current = sessionStarted.sessionId
  }, [sessionStarted, state.status, handshakes])

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

      createUnityInstance(
        canvasRef.current,
        { ...config, devicePixelRatio: clampDevicePixelRatio(window.devicePixelRatio) },
        (progress) => {
          if (!cancelled) setState({ status: 'loading', progress })
        },
      )
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
      // A fresh instance is an unbooted one — and one that has been told
      // nothing. Resetting only `bootedRef` would boot the replacement into an
      // activity and never tell it which session it is playing.
      bootedRef.current = false
      sentSessionRef.current = undefined
      script.remove()
    }
    // Only the resolved build identity may restart Unity. `config` is derived
    // from build-time env and is stable for the life of the page.
    // oxlint-disable-next-line react/exhaustive-deps
    // retryToken re-runs this effect, and React tears the previous one down
    // first — so Quit() is always called before a new instance is created.
    // That is what makes retry unable to duplicate an instance.
  }, [config?.loaderUrl, retryToken])

  if (!config) {
    if (audience === 'student') {
      // No build deployed. The student did nothing wrong and can do nothing
      // about it, so this says what is true and who can fix it — and never
      // implies the link they followed was bad.
      return (
        <div className={styles.stage}>
          <div className={styles.empty} role="status">
            <h2 className={styles.emptyTitle}>The game isn&apos;t ready yet</h2>
            <p className={styles.emptyBody}>
              This activity&apos;s link works, but the game itself hasn&apos;t been published yet.
              Nothing is wrong on your end — let your teacher know, and try again later.
            </p>
          </div>
        </div>
      )
    }

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
      {/*
        tabIndex 0, not -1: the canvas IS the game. Unity WebGL takes keyboard
        input through the focused canvas, so removing it from the tab order
        means a keyboard-only student — a Chromebook without a working
        trackpad, a switch user — can reach every button on the page except the
        one thing they came to do.
      */}
      <canvas
        ref={canvasRef}
        id="unity-canvas"
        className={styles.canvas}
        tabIndex={0}
        aria-label="SAL0MANder game"
      />
      {state.status === 'loading' ? (
        <div className={styles.empty} role="status">
          <h2 className={styles.emptyTitle}>Loading SAL0MANder…</h2>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.progress * 100)}
            aria-label="Loading SAL0MANder"
          >
            <div
              className={styles.progressBar}
              style={{ width: `${Math.round(state.progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      {state.status === 'error' && audience === 'student' ? (
        /*
          The same reader #17 was about, at the other failure. A build that is
          configured and then fails — wrong deploy path, CDN down, file never
          uploaded — is the first thing a class hits if hosting is off, and the
          developer copy below tells a child that SAL0MANder "could not start"
          and then shows them a fetch error.

          No raw reason here: a student cannot act on it, and it reads as
          something they broke. Retry stays, because a transient network
          failure is the common case and pressing a button is the one useful
          thing they CAN do.
        */
        <div className={styles.empty} role="alert">
          <h2 className={styles.emptyTitle}>The game didn&apos;t load</h2>
          <p className={styles.emptyBody}>
            Something went wrong loading the game — not the link you followed, and nothing you did.
            Try again, and if it keeps happening let your teacher know.
          </p>
          <Button onClick={() => setRetryToken((n) => n + 1)}>Try again</Button>
        </div>
      ) : null}
      {state.status === 'error' && audience !== 'student' ? (
        <div className={styles.empty} role="alert">
          <h2 className={styles.emptyTitle}>SAL0MANder could not start</h2>
          <p className={styles.emptyBody}>{describeLoadFailure(state.message)}</p>
          {/*
            The technical detail stays. Existing tests assert the loader URL and
            the raw reason are surfaced, deliberately: a teacher reporting a
            broken build, or a developer reading a screenshot, needs it. The
            loader URL is build-base plus build-name and carries no activity or
            share code, so there is nothing sensitive to withhold.
          */}
          <p className={styles.hint}>{state.message}</p>
          <Button onClick={() => setRetryToken((n) => n + 1)}>Try again</Button>
        </div>
      ) : null}
      {audience !== 'student' && bridgeDiagnostics.length ? (
        <aside className={styles.diagnostics} role="status" aria-label="Unity bridge diagnostics">
          <h2 className={styles.diagnosticsTitle}>Bridge diagnostics</h2>
          <ol className={styles.diagnosticsList}>
            {bridgeDiagnostics.map((summary, index) => (
              <li key={`${summary.reason}-${index}`}>
                <code>{JSON.stringify(summary)}</code>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
    </div>
  )
}
