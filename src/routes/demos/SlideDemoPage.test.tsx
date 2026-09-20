import { useEffect, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { createRoutes } from '@app/router'
import { paths } from '@config/routes'
import { SLIDE_EVENT, type SlideBoot } from '@unity/slideBridge'
import { SlideDemoPage } from './SlideDemoPage'

const probe = vi.hoisted(() => ({
  prepare: vi.fn<(imageKey: string, id: string, signal: AbortSignal) => Promise<SlideBoot>>(),
  mounts: 0,
  unmounts: 0,
  slide: undefined as SlideBoot | undefined,
  keys: [] as string[],
}))
vi.mock('@unity/slideBridge', async (load) => ({
  ...(await load<typeof import('@unity/slideBridge')>()),
  prepareSlide: probe.prepare,
}))
vi.mock('@unity/UnityStage', () => ({
  UnityStage: (props: { slide?: SlideBoot; controls?: ReactNode; audience?: string }) => {
    probe.slide = props.slide
    probe.keys = Object.keys(props)
    useEffect(() => {
      probe.mounts++
      return () => {
        probe.unmounts++
      }
    }, [])
    return <div data-testid="direct-slide-stage">{props.controls}</div>
  },
}))
function fixture(requestId: string): SlideBoot {
  return {
    type: 'slide-boot',
    slideVersion: 1,
    requestId,
    mode: 'cyclic-3x3',
    picture: { key: 'fictional-neon-tuner-v1', pngBase64: 'AAAA' },
    questions: [],
  }
}
function page() {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[paths.slideDemo]}>
        <Routes>
          <Route path={paths.slideDemo} element={<SlideDemoPage />} />
          <Route path={paths.guestPlayIndex} element={<h1>Demo picker</h1>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  )
}
beforeEach(() => {
  probe.prepare.mockReset()
  probe.mounts = 0
  probe.unmounts = 0
  probe.slide = undefined
  probe.keys = []
  probe.prepare.mockImplementation(async (_key, id) => fixture(id))
})

describe('direct Slide demo launch', () => {
  it('reveals learning links only on completion and retains the same game on the next level', async () => {
    render(page())
    fireEvent.click(screen.getByRole('button', { name: 'Start easy level' }))
    await screen.findByTestId('direct-slide-stage')
    const boot = probe.slide
    const emit = (type: string, attempt: number) =>
      act(() =>
        window.dispatchEvent(
          new CustomEvent(SLIDE_EVENT, {
            detail: {
              slideVersion: 1,
              requestId: boot!.requestId,
              type,
              attempt,
              ...(type === 'slide-finished' ? { moves: 1, seconds: 2 } : {}),
            },
          }),
        ),
      )
    expect(screen.queryByRole('region', { name: 'Learning with Sam' })).toBeNull()
    emit('slide-ready', 1)
    emit('slide-finished', 1)
    expect(screen.getByRole('region', { name: 'Learning with Sam' })).toBeVisible()
    emit('slide-ready', 2)
    expect(screen.queryByRole('region', { name: 'Learning with Sam' })).toBeNull()
    expect(probe.slide).toBe(boot)
    expect(probe.prepare).toHaveBeenCalledOnce()
    expect(probe.mounts).toBe(1)
    expect(probe.unmounts).toBe(0)
  })
  it('offers labeled original AI artwork and explicit start without a gift, booking or account form', () => {
    render(page())
    expect(screen.getByRole('heading', { name: 'Swap & Solve demo' })).toBeVisible()
    expect(
      screen.getByRole('img', {
        name: /AI-generated concept artwork of a fictional blue tuner/i,
      }),
    ).toHaveAttribute('src', '/images/library/ai/fictional-neon-tuner-v1.webp')
    expect(screen.getByRole('button', { name: 'Start easy level' })).toBeEnabled()
    expect(probe.prepare).not.toHaveBeenCalled()
    expect(probe.mounts).toBe(0)
    expect(screen.queryByTestId('direct-slide-stage')).toBeNull()
    expect(screen.queryByRole('form')).toBeNull()
    expect(screen.queryByLabelText(/email|password|recipient|payment/i)).toBeNull()
  })
  it('prepares once after a click, withholds the stage while pending, then passes the exact native boot', async () => {
    let resolve!: (boot: SlideBoot) => void
    probe.prepare.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    render(page())
    fireEvent.click(screen.getByRole('button', { name: 'Start easy level' }))
    const waiting = screen.getByRole('button', {
      name: 'Preparing your picture…',
    })
    expect(waiting).toBeDisabled()
    expect(waiting).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(waiting)
    expect(probe.prepare).toHaveBeenCalledOnce()
    const [key, id, signal] = probe.prepare.mock.calls[0]!
    expect(key).toBe('fictional-neon-tuner-v1')
    expect(id).toMatch(/^demo_[A-Za-z0-9_-]+$/)
    expect(signal.aborted).toBe(false)
    expect(screen.queryByTestId('direct-slide-stage')).toBeNull()
    const boot = fixture(id)
    await act(async () => resolve(boot))
    expect(screen.getByTestId('direct-slide-stage')).toBeVisible()
    expect(probe.slide).toBe(boot)
    expect(probe.keys.sort()).toEqual(['audience', 'controls', 'slide'])
    expect(screen.getByText('Swap & Solve · 8 levels')).toBeVisible()
    expect(screen.queryByRole('button', { name: /start easy level/i })).toBeNull()
  })
  it('recovers from preparation failure with a new identity and signal, without exposing the internal error', async () => {
    probe.prepare.mockRejectedValueOnce(new Error('private diagnostic: internal fetch failure'))
    render(page())
    fireEvent.click(screen.getByRole('button', { name: 'Start easy level' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The demo picture could not load. Please try again.',
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('private diagnostic')
    expect(screen.queryByTestId('direct-slide-stage')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByTestId('direct-slide-stage')
    expect(probe.prepare).toHaveBeenCalledTimes(2)
    expect(probe.prepare.mock.calls[1]![1]).not.toBe(probe.prepare.mock.calls[0]![1])
    expect(probe.prepare.mock.calls[1]![2]).not.toBe(probe.prepare.mock.calls[0]![2])
    expect(probe.mounts).toBe(1)
  })
  it('aborts preparation on exit and ignores a late result', async () => {
    let resolve!: (boot: SlideBoot) => void
    probe.prepare.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    render(page())
    fireEvent.click(screen.getByRole('button', { name: 'Start easy level' }))
    const [, id, signal] = probe.prepare.mock.calls[0]!
    fireEvent.click(screen.getByRole('link', { name: 'All demos' }))
    expect(await screen.findByRole('heading', { name: 'Demo picker' })).toBeVisible()
    expect(signal.aborted).toBe(true)
    await act(async () => resolve(fixture(id)))
    expect(probe.mounts).toBe(0)
    expect(screen.queryByTestId('direct-slide-stage')).toBeNull()
  })
  it('keeps a ready stage and request stable through ordinary rerenders and theme changes', async () => {
    const view = render(page())
    fireEvent.click(screen.getByRole('button', { name: 'Start easy level' }))
    const stage = await screen.findByTestId('direct-slide-stage')
    const boot = probe.slide
    view.rerender(page())
    fireEvent.click(screen.getByRole('button', { name: /Theme:/ }))
    expect(screen.getByTestId('direct-slide-stage')).toBe(stage)
    expect(probe.slide).toBe(boot)
    expect(probe.prepare).toHaveBeenCalledOnce()
    expect(probe.mounts).toBe(1)
    expect(probe.unmounts).toBe(0)
    fireEvent.click(screen.getByRole('link', { name: 'All demos' }))
    await waitFor(() => expect(probe.unmounts).toBe(1))
  })
})

describe('actual route-table entry', () => {
  it.each([
    ['puzzles', '/'],
    ['tutoring', '/'],
    ['puzzles', '/school'],
    ['tutoring', '/school'],
  ] as const)(
    'opens direct Slide for %s with basename %s, without another form',
    async (siteMode, basename) => {
      const prefix = basename === '/' ? '' : basename
      const router = createMemoryRouter(createRoutes(siteMode), {
        basename,
        initialEntries: [prefix + paths.slideDemo],
      })
      const view = render(
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>,
      )
      expect(await screen.findByRole('heading', { name: 'Swap & Solve demo' })).toBeVisible()
      expect(router.state.location.pathname).toBe(prefix + paths.slideDemo)
      expect(screen.getByRole('link', { name: 'All demos' })).toHaveAttribute(
        'href',
        prefix + paths.guestPlayIndex,
      )
      expect(probe.prepare).not.toHaveBeenCalled()
      expect(screen.queryByRole('form')).toBeNull()
      view.unmount()
      router.dispose()
    },
  )
})
