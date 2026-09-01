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
})
