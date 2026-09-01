import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * Real browser fullscreen for the game stage — address bar and all.
 *
 * ## Why this is safe for a running game
 *
 * The non-negotiable in `CLAUDE.md` is that the Unity stage never unmounts
 * because of a layout change: a remount destroys the WebGL context and
 * restarts a student's puzzle mid-lesson.
 *
 * `requestFullscreen()` cannot cause that. It is a browser-level display
 * change applied to a DOM node that already exists — React's tree is untouched,
 * the `<canvas>` element is the same element before and after, and the WebGL
 * context survives. This is precisely why fullscreen is done by promoting the
 * existing container rather than by conditionally rendering a different one:
 * the tempting `{isFullscreen ? <Overlay><Stage/></Overlay> : <Stage/>}` would
 * reparent the canvas and end the game.
 *
 * Unity reads the canvas's new size through its own resize observer, so nothing
 * needs to be told about the change.
 *
 * ## Why the capability is reported rather than assumed
 *
 * iPhone Safari does not implement element fullscreen at all. iPad does, and so
 * do Chrome, Edge, Firefox and desktop Safari — but a school iPhone would get a
 * button that silently does nothing, which is worse than no button. Callers get
 * {@link FullscreenState.isSupported} and hide the control when it is false.
 *
 * Fullscreen can also be blocked by policy (an iframe without
 * `allow="fullscreen"`, or an enterprise policy on a managed Chromebook). That
 * surfaces as a rejected promise, not an exception, and is reported as
 * `didFail` so the UI can say so instead of appearing broken.
 */

export type FullscreenState = {
  /** Whether this browser can put an element into fullscreen at all. */
  isSupported: boolean
  /** Whether the watched element is currently fullscreen. */
  isFullscreen: boolean
  /** The last request was refused — by the browser, an iframe policy, or the user. */
  didFail: boolean
  /** Enter if out, leave if in. Safe to call when unsupported; it no-ops. */
  toggle: () => void
}

/**
 * Vendor-prefixed shapes still shipping in Safari. Typed narrowly rather than
 * cast to `any` so a typo here is a compile error, not a silent no-op on the
 * one browser most likely to be in a classroom.
 */
type PrefixedElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}
type PrefixedDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

function fullscreenElement(): Element | null {
  const doc = document as PrefixedDocument
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function useFullscreen(ref: RefObject<HTMLElement | null>): FullscreenState {
  /*
    Resolved once on mount rather than at module scope: the test environment
    and SSR both lack `document`, and a module-scope read would crash on import
    rather than degrade to "not supported".
  */
  const [isSupported, setIsSupported] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [didFail, setDidFail] = useState(false)

  useEffect(() => {
    const element = ref.current as PrefixedElement | null
    setIsSupported(
      typeof document !== 'undefined' &&
        Boolean(element?.requestFullscreen ?? element?.webkitRequestFullscreen),
    )
  }, [ref])

  useEffect(() => {
    // Both spellings: Safari fires only the prefixed event.
    const sync = () => setIsFullscreen(fullscreenElement() === ref.current)
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    // Esc and the browser's own exit affordance both land here, so leaving
    // fullscreen by any route keeps the button label truthful.
    sync()
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [ref])

  const toggle = useCallback(() => {
    const element = ref.current as PrefixedElement | null
    if (!element) return
    setDidFail(false)

    const doc = document as PrefixedDocument
    const request = element.requestFullscreen ?? element.webkitRequestFullscreen
    const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen

    try {
      const result =
        fullscreenElement() === element ? exit?.call(doc) : request?.call(element)
      // A rejection here is a refusal, not a crash — an iframe without
      // allow="fullscreen", or a managed-device policy. Never let it reach the
      // window as an unhandled rejection and never let it stop the game.
      void Promise.resolve(result).catch(() => setDidFail(true))
    } catch {
      setDidFail(true)
    }
  }, [ref])

  return { isSupported, isFullscreen, didFail, toggle }
}
