import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SharePanel } from './SharePanel'

const toDataURL = vi.fn(async () => 'data:image/png;base64,QRSTUB')

// The real encoder needs a canvas jsdom does not provide, and this also keeps
// the dynamic import deterministic.
vi.mock('qrcode', () => ({ default: { toDataURL }, toDataURL }))

const URL_UNDER_TEST = 'https://sal0mander.example/play/abc123'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setClipboard(impl?: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: impl ? { writeText: vi.fn(impl) } : undefined,
  })
}

afterEach(() => {
  setClipboard(undefined)
  vi.clearAllMocks()
})

describe('the link itself', () => {
  it('builds the visible share link through the canonical route helper', () => {
    render(<SharePanel activityId="space mission/1" baseUrl="https://sal0mander.example/" />)

    expect(screen.getByLabelText(/share link/i)).toHaveValue(
      'https://sal0mander.example/play/space%20mission%2F1',
    )
  })

  it('still accepts a prebuilt share URL for non-activity callers', () => {
    render(<SharePanel url={URL_UNDER_TEST} />)

    expect(screen.getByLabelText(/share link/i)).toHaveValue(URL_UNDER_TEST)
  })

  it('is always visible and selectable, not just copyable', () => {
    // The manual path has to exist: clipboard access can be denied, and a
    // teacher who cannot select the link has no way to share it.
    render(<SharePanel url={URL_UNDER_TEST} />)
    const input = screen.getByLabelText(/share link/i)
    expect(input).toHaveValue(URL_UNDER_TEST)
    expect(input).toHaveAttribute('readonly')
    expect(input).not.toBeDisabled()
  })

  it('shows an optional subject when given one', () => {
    render(<SharePanel url={URL_UNDER_TEST} title="Fractions warm-up" />)
    expect(screen.getByText('Fractions warm-up')).toBeInTheDocument()
  })
})

describe('copying', () => {
  it('writes the link and confirms it', async () => {
    const user = userEvent.setup()
    // After setup: userEvent installs its own clipboard stub and would
    // otherwise clobber this one.
    setClipboard(async () => {})
    render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /copy link/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(URL_UNDER_TEST)
    expect(await screen.findByText(/copied to your clipboard/i)).toBeInTheDocument()
  })

  it('announces the outcome in a live region, not just on screen', async () => {
    // The copy button's label barely changes, so a screen-reader user learns
    // whether the copy worked only if the result is announced. Asserting the
    // text alone passes even with the live region removed — which is exactly
    // how this regressed past a mutation check.
    const user = userEvent.setup()
    setClipboard(async () => {})
    render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /copy link/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/copied to your clipboard/i)
  })

  it('announces failure in that same live region', async () => {
    const user = userEvent.setup()
    setClipboard(async () => {
      throw new Error('denied by permissions policy')
    })
    render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /copy link/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/copy it manually/i)
  })

  it('admits failure instead of pretending, and points at the manual path', async () => {
    // Silently doing nothing is worse than failing: the teacher walks away
    // believing the link is on their clipboard.
    const user = userEvent.setup()
    setClipboard(async () => {
      throw new Error("denied by permissions policy")
    })
    render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /copy link/i }))

    expect(await screen.findByText(/copy it manually/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy failed/i })).toBeInTheDocument()
    // The link stays available to select by hand.
    expect(screen.getByLabelText(/share link/i)).toHaveValue(URL_UNDER_TEST)
  })

  it('fails gracefully where the clipboard API does not exist at all', async () => {
    // Insecure origin: `navigator.clipboard` is simply absent.
    const user = userEvent.setup()
    setClipboard(undefined)
    render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /copy link/i }))
    expect(await screen.findByText(/copy it manually/i)).toBeInTheDocument()
  })
})

describe('QR code', () => {
  it('is hidden until asked for, so its chunk is never fetched by a student', async () => {
    render(<SharePanel url={URL_UNDER_TEST} />)
    expect(screen.getByRole('button', { name: /show qr code/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(toDataURL).not.toHaveBeenCalled()
  })

  it('encodes the share link at high error correction for print', async () => {
    const user = userEvent.setup()
    render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /show qr code/i }))

    await waitFor(() => expect(toDataURL).toHaveBeenCalled())
    const [url, opts] = toDataURL.mock.calls[0] as unknown as [string, { errorCorrectionLevel: string }]
    expect(url).toBe(URL_UNDER_TEST)
    // Worksheets get photocopied and creased.
    expect(opts.errorCorrectionLevel).toBe('H')
  })

  it('renders the code as decorative, since the link is already text', async () => {
    const user = userEvent.setup()
    render(<SharePanel url={URL_UNDER_TEST} />)
    await user.click(screen.getByRole('button', { name: /show qr code/i }))

    const img = await screen.findByRole('presentation', { hidden: true })
    expect(img).toHaveAttribute('src', 'data:image/png;base64,QRSTUB')
  })

  it('never blocks sharing when the encoder fails', async () => {
    toDataURL.mockRejectedValueOnce(new Error('encode failed'))
    const user = userEvent.setup()
    render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /show qr code/i }))

    expect(await screen.findByText(/qr code unavailable/i)).toBeInTheDocument()
    // The link — the thing that actually matters — is untouched.
    expect(screen.getByLabelText(/share link/i)).toHaveValue(URL_UNDER_TEST)
  })

  it('still copies the link when QR generation fails', async () => {
    toDataURL.mockRejectedValueOnce(new Error('encode failed'))
    const user = userEvent.setup()
    setClipboard(async () => {})
    render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /show qr code/i }))
    expect(await screen.findByText(/qr code unavailable/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /copy link/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(URL_UNDER_TEST)
    expect(await screen.findByText(/copied to your clipboard/i)).toBeInTheDocument()
  })

  it('replaces the QR when the share URL changes', async () => {
    toDataURL
      .mockResolvedValueOnce('data:image/png;base64,OLD')
      .mockResolvedValueOnce('data:image/png;base64,NEW')
    const user = userEvent.setup()
    const { rerender } = render(<SharePanel url="https://sal0mander.example/play/old" />)

    await user.click(screen.getByRole('button', { name: /show qr code/i }))
    expect(await screen.findByRole('presentation', { hidden: true })).toHaveAttribute(
      'src',
      'data:image/png;base64,OLD',
    )

    rerender(<SharePanel url="https://sal0mander.example/play/new" />)

    await waitFor(() =>
      expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
        'src',
        'data:image/png;base64,NEW',
      ),
    )
    expect(toDataURL).toHaveBeenLastCalledWith(
      'https://sal0mander.example/play/new',
      expect.objectContaining({ errorCorrectionLevel: 'H' }),
    )
  })

  it('does not let a slow old encode overwrite a newer QR', async () => {
    const oldQr = deferred<string>()
    const newQr = deferred<string>()
    toDataURL.mockReturnValueOnce(oldQr.promise).mockReturnValueOnce(newQr.promise)
    const user = userEvent.setup()
    const { rerender } = render(<SharePanel url="https://sal0mander.example/play/old" />)

    await user.click(screen.getByRole('button', { name: /show qr code/i }))
    await waitFor(() => expect(toDataURL).toHaveBeenCalledTimes(1))

    rerender(<SharePanel url="https://sal0mander.example/play/new" />)
    await waitFor(() => expect(toDataURL).toHaveBeenCalledTimes(2))

    await act(async () => newQr.resolve('data:image/png;base64,NEW'))
    expect(await screen.findByRole('presentation', { hidden: true })).toHaveAttribute(
      'src',
      'data:image/png;base64,NEW',
    )

    await act(async () => oldQr.resolve('data:image/png;base64,OLD'))
    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
      'src',
      'data:image/png;base64,NEW',
    )
  })

  it('does not update the component after unmounting mid-generation', async () => {
    const pendingQr = deferred<string>()
    toDataURL.mockReturnValueOnce(pendingQr.promise)
    const user = userEvent.setup()
    const { unmount } = render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /show qr code/i }))
    await waitFor(() => expect(toDataURL).toHaveBeenCalledTimes(1))

    unmount()

    await act(async () => pendingQr.resolve('data:image/png;base64,LATE'))

    expect(screen.queryByRole('presentation', { hidden: true })).toBeNull()
    expect(screen.queryByText(/qr code unavailable/i)).toBeNull()
  })

  it('toggles back off', async () => {
    const user = userEvent.setup()
    render(<SharePanel url={URL_UNDER_TEST} />)

    await user.click(screen.getByRole('button', { name: /show qr code/i }))
    await screen.findByText(/point a phone camera/i)

    await user.click(screen.getByRole('button', { name: /hide qr code/i }))
    expect(screen.queryByText(/point a phone camera/i)).toBeNull()
  })
})
