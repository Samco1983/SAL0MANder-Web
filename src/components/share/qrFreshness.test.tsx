import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

import { ShareQr } from './ShareQr'

/**
 * A QR code is the only artifact in this product that gets printed and handed
 * out. It cannot be recalled, so the failures that matter are the ones where
 * the code on screen looks perfectly fine and encodes the wrong thing.
 *
 * The dangerous one is staleness. If the encoder resolves out of order, or the
 * effect fails to re-run, the displayed QR is the PREVIOUS activity's. A
 * teacher prints a code for the wrong lesson and nothing on screen is visibly
 * wrong — no error, no blank, just a valid QR pointing somewhere else.
 */

type Resolver = (dataUrl: string) => void
const pending: Array<{ url: string; resolve: Resolver; reject: (e: unknown) => void }> = []

const toDataURL = vi.fn(
  (url: string) =>
    new Promise<string>((resolve, reject) => {
      pending.push({ url, resolve, reject })
    }),
)
vi.mock('qrcode', () => ({ default: { toDataURL }, toDataURL }))

/**
 * Settle the Nth outstanding encode, the way a slow network would.
 *
 * A single microtask flush is not enough: the chain is dynamic import -> then
 * -> then -> setState, and resolving inside act() with one `await
 * Promise.resolve()` leaves the component still in its loading state. The
 * first version of this harness did exactly that and failed six tests against
 * a component that was working correctly.
 */
const settle = async (index: number, dataUrl: string) => {
  await act(async () => {
    pending[index]?.resolve(dataUrl)
  })
  await waitFor(() => expect(pending.length).toBeGreaterThan(index))
}

const fail = async (index: number) => {
  await act(async () => {
    pending[index]?.reject(new Error('chunk failed to load'))
  })
}

/** Wait until the encoder has been asked for the Nth url. */
const awaitEncode = (index: number) =>
  waitFor(() => expect(pending.length).toBeGreaterThan(index))

const qrImage = () => document.querySelector('img')

beforeEach(() => {
  pending.length = 0
  toDataURL.mockClear()
})
afterEach(cleanup)

describe('the QR is never stale', () => {
  it('re-encodes when the url changes', async () => {
    const { rerender } = render(<ShareQr url="https://x.test/play/FIRST" />)
    await awaitEncode(0)
    await settle(0, 'data:image/png;base64,FIRST')
    await waitFor(() => expect(qrImage()?.getAttribute('src')).toContain('FIRST'))

    rerender(<ShareQr url="https://x.test/play/SECOND" />)
    await awaitEncode(1)
    await settle(1, 'data:image/png;base64,SECOND')
    await waitFor(() => expect(qrImage()?.getAttribute('src')).toContain('SECOND'))
  })

  it('encodes the new url, not the old one', async () => {
    const { rerender } = render(<ShareQr url="https://x.test/play/FIRST" />)
    await awaitEncode(0)
    await settle(0, 'data:image/png;base64,FIRST')
    rerender(<ShareQr url="https://x.test/play/SECOND" />)
    await awaitEncode(1)

    expect(pending[1]?.url).toBe('https://x.test/play/SECOND')
  })

  it('does not show the old code while the new one is still encoding', async () => {
    // The window where a teacher could screenshot or print the wrong code.
    const { rerender } = render(<ShareQr url="https://x.test/play/FIRST" />)
    await awaitEncode(0)
    await settle(0, 'data:image/png;base64,FIRST')
    await waitFor(() => expect(qrImage()).not.toBeNull())
    rerender(<ShareQr url="https://x.test/play/SECOND" />)

    await waitFor(() => expect(qrImage()?.getAttribute('src') ?? '').not.toContain('FIRST'))
  })

  it('a slow earlier encode cannot overwrite a newer one', async () => {
    // Out-of-order resolution. The first request finishes LAST, and if the
    // component simply took whatever arrived, the QR would silently revert to
    // the previous activity.
    const { rerender } = render(<ShareQr url="https://x.test/play/FIRST" />)
    await awaitEncode(0)
    rerender(<ShareQr url="https://x.test/play/SECOND" />)
    await awaitEncode(1)

    await settle(1, 'data:image/png;base64,SECOND')
    await settle(0, 'data:image/png;base64,FIRST')

    await waitFor(() => expect(qrImage()?.getAttribute('src')).toContain('SECOND'))
  })
})

describe('when the encoder fails', () => {
  it('says so, instead of showing a broken image', async () => {
    render(<ShareQr url="https://x.test/play/FIRST" />)
    await awaitEncode(0)
    await fail(0)
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/QR code unavailable/i),
    )
    expect(qrImage()).toBeNull()
  })

  it('points the teacher at the link, which is the real artifact', async () => {
    render(<ShareQr url="https://x.test/play/FIRST" />)
    await awaitEncode(0)
    await fail(0)
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/use the link instead/i),
    )
  })

  it('recovers when a later url encodes successfully', async () => {
    // A failed QR must not be a permanent state for the panel.
    const { rerender } = render(<ShareQr url="https://x.test/play/FIRST" />)
    await awaitEncode(0)
    await fail(0)
    rerender(<ShareQr url="https://x.test/play/SECOND" />)
    await awaitEncode(1)
    await settle(1, 'data:image/png;base64,SECOND')
    await waitFor(() => expect(qrImage()?.getAttribute('src')).toContain('SECOND'))
  })
})

describe('unmounting mid-encode', () => {
  it('does not update state after the component is gone', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<ShareQr url="https://x.test/play/FIRST" />)
    await awaitEncode(0)
    unmount()
    await settle(0, 'data:image/png;base64,FIRST')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
