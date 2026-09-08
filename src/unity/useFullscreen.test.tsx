import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useRef } from 'react'
import { useFullscreen } from './useFullscreen'

function Probe() {
  const ref = useRef<HTMLDivElement | null>(null)
  const fs = useFullscreen(ref)
  return (
    <div ref={ref} data-testid="stage">
      <span data-testid="supported">{String(fs.isSupported)}</span>
      <span data-testid="active">{String(fs.isFullscreen)}</span>
      <span data-testid="self">{String(fs.isSelfFullscreen)}</span>
      <span data-testid="failed">{String(fs.didFail)}</span>
      <button onClick={fs.toggle}>toggle</button>
    </div>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen')
  Reflect.deleteProperty(Document.prototype, 'exitFullscreen')
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
})

function installFullscreenApi(request: () => Promise<void>) {
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    value: request,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(Document.prototype, 'exitFullscreen', {
    value: vi.fn().mockResolvedValue(undefined),
    configurable: true,
    writable: true,
  })
}

describe('useFullscreen', () => {
  /**
   * iPhone Safari has no element fullscreen. A button that silently does
   * nothing is worse than no button, so the capability must be reported
   * honestly rather than assumed.
   */
  it('reports unsupported when the browser has no fullscreen API', () => {
    render(<Probe />)
    expect(screen.getByTestId('supported')).toHaveTextContent('false')
  })

  it('reports supported once the API exists on the element', () => {
    installFullscreenApi(vi.fn().mockResolvedValue(undefined))
    render(<Probe />)
    expect(screen.getByTestId('supported')).toHaveTextContent('true')
  })

  it('requests fullscreen on the element it was given', async () => {
    const request = vi.fn().mockResolvedValue(undefined)
    installFullscreenApi(request)
    render(<Probe />)
    await act(async () => {
      screen.getByRole('button', { name: 'toggle' }).click()
    })
    expect(request).toHaveBeenCalledOnce()
  })

  /**
   * The refusal path. An iframe without allow="fullscreen", or a managed
   * Chromebook policy, rejects the promise. That must surface as a message,
   * never as an unhandled rejection and never as a dead button.
   */
  it('reports a refusal instead of throwing', async () => {
    installFullscreenApi(vi.fn().mockRejectedValue(new Error('blocked by policy')))
    render(<Probe />)
    await act(async () => {
      screen.getByRole('button', { name: 'toggle' }).click()
    })
    expect(screen.getByTestId('failed')).toHaveTextContent('true')
  })

  it('tracks leaving fullscreen by any route, including Esc', async () => {
    installFullscreenApi(vi.fn().mockResolvedValue(undefined))
    render(<Probe />)
    const stage = screen.getByTestId('stage')

    Object.defineProperty(document, 'fullscreenElement', {
      value: stage,
      configurable: true,
    })
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(screen.getByTestId('active')).toHaveTextContent('true')

    // Esc does not call our toggle; the browser exits and fires the event.
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    })
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(screen.getByTestId('active')).toHaveTextContent('false')
  })

  it('does nothing at all when unsupported, rather than erroring', async () => {
    render(<Probe />)
    await act(async () => {
      screen.getByRole('button', { name: 'toggle' }).click()
    })
    expect(screen.getByTestId('failed')).toHaveTextContent('false')
  })

  /**
   * Unity does not ask the host before going fullscreen, and it does not ask
   * for the host's element.
   *
   * `SetFullscreen(1)` reaches `_emscripten_request_fullscreen`, which calls
   * `target.requestFullscreen()` on Unity's own canvas — verified in the
   * shipped `sal0-unity-webgl.framework.js`. The canvas is a DESCENDANT of the
   * stage this hook watches, so an identity comparison reports "not
   * fullscreen" while the game fills the screen.
   *
   * What that costs, all of it visible to a student:
   *  - `data-fullscreen` stays false, so the stage never takes its 100vw/100vh
   *    rule and the fullscreen-only styling never applies;
   *  - the exit control stays faded at 55%, which the CSS comment explicitly
   *    calls out as unacceptable on an iPad, where there is no Esc key;
   *  - the button still reads "Full screen" while already fullscreen.
   */
  it('reports fullscreen when Unity promoted the canvas inside the stage, not the stage itself', () => {
    installFullscreenApi(vi.fn().mockResolvedValue(undefined))
    render(<Probe />)

    // Unity's canvas lives inside the stage. This is that element.
    const inner = screen.getByTestId('supported')
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: inner,
        configurable: true,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(screen.getByTestId('active')).toHaveTextContent('true')
  })

  /**
   * The same mismatch turns the exit button into a second enter.
   *
   * With the canvas fullscreen and the stage not, the toggle takes its "not
   * currently fullscreen" branch and requests fullscreen again — swapping the
   * fullscreen element instead of leaving. A student pressing the only visible
   * way out stays trapped and has to press it twice.
   */
  it('exits when anything inside the stage is fullscreen, instead of requesting it again', async () => {
    const request = vi.fn().mockResolvedValue(undefined)
    installFullscreenApi(request)
    render(<Probe />)

    const inner = screen.getByTestId('supported')
    Object.defineProperty(document, 'fullscreenElement', { value: inner, configurable: true })

    await act(async () => {
      screen.getByRole('button', { name: 'toggle' }).click()
    })

    expect(document.exitFullscreen).toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })

  /**
   * The two flags must disagree when Unity owns the fullscreen element, because
   * they drive different things: the exit control stays unfaded whenever a full
   * screen is showing, but only the stage being fullscreen ITSELF may take the
   * 100vw/100vh sizing rule.
   *
   * Collapsing them would stretch the stage to the viewport while the canvas is
   * the element actually being scaled, and on exit the canvas would measure
   * itself against that screen-sized box for a frame — which is how a puzzle
   * comes back from fullscreen far too big.
   */
  it('separates "something inside is fullscreen" from "this element is fullscreen"', () => {
    installFullscreenApi(vi.fn().mockResolvedValue(undefined))
    render(<Probe />)

    const inner = screen.getByTestId('supported')
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', { value: inner, configurable: true })
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(screen.getByTestId('active')).toHaveTextContent('true')
    expect(screen.getByTestId('self')).toHaveTextContent('false')

    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: screen.getByTestId('stage'),
        configurable: true,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(screen.getByTestId('active')).toHaveTextContent('true')
    expect(screen.getByTestId('self')).toHaveTextContent('true')
  })
})
