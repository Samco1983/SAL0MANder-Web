import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SharePanel } from './SharePanel'

/**
 * The QR code must encode the link, not a link.
 *
 * SharePanel.test.tsx asserts that `toDataURL` was called. It never asserts
 * what it was called *with*, so a QR encoding a different URL than the copy
 * button passes every existing test. That matters more here than anywhere else
 * in the product: a QR code is printed on a worksheet and handed to a class,
 * and it is the one artifact that cannot be corrected after it ships.
 *
 * The failure worth naming: the copy button gets the deploy-prefixed URL and
 * the QR is rebuilt from an activity id without the prefix. On screen both look
 * plausible. In a classroom, thirty phones hit a 404.
 */

// Typed with its parameter on purpose. A zero-arg mock makes `mock.calls[0][0]`
// a type error, and — worse — vitest does not typecheck, so the tests here went
// green against code that would not compile. Only `npm run verify` caught it,
// because it gates on every step's exit code rather than the test summary.
const toDataURL = vi.fn(async (_url: string) => 'data:image/png;base64,QRSTUB')
vi.mock('qrcode', () => ({ default: { toDataURL }, toDataURL }))

beforeEach(() => toDataURL.mockClear())

const openQr = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /show qr code/i }))
  await waitFor(() => expect(toDataURL).toHaveBeenCalled())
  return String(toDataURL.mock.calls[0]?.[0] ?? '')
}

/** What the teacher sees in the field, character for character. */
const shownLink = () =>
  (screen.getByLabelText(/share link/i) as HTMLInputElement).value

describe('the QR code and the copy link', () => {
  it('encode exactly the same string', async () => {
    render(<SharePanel activityId="SUN-42" baseUrl="https://sal0mander.example" />)
    const encoded = await openQr()
    expect(encoded).toBe(shownLink())
  })

  it('agree when the panel is given a prebuilt url instead of an activity id', async () => {
    // The other variant of the component. Two code paths reach the QR; both
    // must land on the same string.
    render(<SharePanel url="https://sal0mander.example/play/ALREADY-BUILT" />)
    const encoded = await openQr()
    expect(encoded).toBe(shownLink())
    expect(encoded).toBe('https://sal0mander.example/play/ALREADY-BUILT')
  })

  it('encode an absolute url, never a bare path', async () => {
    // A relative path in a QR is unopenable — there is no page to resolve it
    // against when a phone camera scans it off paper.
    render(<SharePanel activityId="SUN-42" baseUrl="https://sal0mander.example" />)
    const encoded = await openQr()
    expect(encoded).toMatch(/^https?:\/\//)
  })

  it('preserve an activity id that needs encoding', async () => {
    render(<SharePanel activityId="a b/c" baseUrl="https://sal0mander.example" />)
    const encoded = await openQr()
    expect(encoded).toBe(shownLink())
    expect(() => new URL(encoded)).not.toThrow()
  })
})
