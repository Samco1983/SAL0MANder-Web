import { afterEach, expect, it, vi } from 'vitest'
import {
  cancelSlide,
  onSlideMessage,
  prepareSlide,
  sendSlideBoot,
  SlideBootSchema,
  SlideEventSchema,
  SLIDE_EVENT,
} from './slideBridge'
import { MAX_LIBRARY_IMAGE_BYTES } from './libraryPicture'

const boot = SlideBootSchema.parse({
  type: 'slide-boot',
  slideVersion: 1,
  requestId: 'slide_test',
  mode: 'cyclic-3x3',
  picture: { key: 'coral-reef', pngBase64: 'aGVsbG8=' },
  questions: [],
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('sends only the separate picture-only wire and cancels on the same receiver', () => {
  const SendMessage = vi.fn()
  expect(sendSlideBoot({ SendMessage }, boot)).toBe(true)
  expect(SendMessage).toHaveBeenCalledWith(
    'SAL0MANderSlide',
    'ReceiveSlideMessage',
    JSON.stringify(boot),
  )
  cancelSlide({ SendMessage }, boot.requestId)
  expect(JSON.parse(SendMessage.mock.calls[1]![2])).toEqual({
    type: 'slide-cancel',
    slideVersion: 1,
    requestId: 'slide_test',
  })
  expect(sendSlideBoot(null, boot)).toBe(false)
  expect(
    sendSlideBoot(
      {
        SendMessage: () => {
          throw new Error('old player')
        },
      },
      boot,
    ),
  ).toBe(false)
})
it.each([
  { ...boot, mode: 'Classic' },
  { ...boot, slideVersion: 2 },
  { ...boot, questions: [{ answer: 'yes' }] },
  { ...boot, config: {} },
  { ...boot, previewVersion: 1 },
  { ...boot, picture: { key: 'unknown', pngBase64: 'aGVsbG8=' } },
  {
    ...boot,
    picture: {
      ...boot.picture,
      pngBase64: 'a'.repeat(Math.ceil(MAX_LIBRARY_IMAGE_BYTES / 3) * 4 + 4),
    },
  },
])('rejects unsupported or contaminated slide payloads', (value) => {
  expect(SlideBootSchema.safeParse(value).success).toBe(false)
})
it.each([
  { attempt: 0, moves: 1, seconds: 1 },
  { attempt: 1.5, moves: 1, seconds: 1 },
  { attempt: 1, moves: -1, seconds: 1 },
  { attempt: 1, moves: 1.5, seconds: 1 },
  { attempt: 1, moves: 1, seconds: Infinity },
  { attempt: 1, moves: 1, seconds: -1 },
  { attempt: NaN, moves: 1, seconds: 1 },
])('rejects invalid completion counters', (metrics) => {
  expect(
    SlideEventSchema.safeParse({
      type: 'slide-finished',
      slideVersion: 1,
      requestId: boot.requestId,
      ...metrics,
    }).success,
  ).toBe(false)
})
it('isolates the event version/channel and removes its listener', () => {
  const listen = vi.fn()
  const stop = onSlideMessage(listen)
  const detail = { type: 'slide-ready', slideVersion: 1, requestId: boot.requestId, attempt: 1 }
  window.dispatchEvent(new CustomEvent('sal0mander:preview-message', { detail }))
  window.dispatchEvent(new CustomEvent(SLIDE_EVENT, { detail: { ...detail, slideVersion: 2 } }))
  expect(listen).not.toHaveBeenCalled()
  window.dispatchEvent(new CustomEvent(SLIDE_EVENT, { detail }))
  expect(listen).toHaveBeenCalledTimes(1)
  stop()
  window.dispatchEvent(new CustomEvent(SLIDE_EVENT, { detail }))
  expect(listen).toHaveBeenCalledTimes(1)
})
it('aborts a late picture decode and always revokes its temporary URL', async () => {
  let decode: () => void = () => {}
  vi.stubGlobal(
    'Image',
    class {
      src = ''
      naturalWidth = 640
      naturalHeight = 640
      decode() {
        return new Promise<void>((resolve) => {
          decode = resolve
        })
      }
    },
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, blob: async () => new Blob(['picture']) })),
  )
  const revokeObjectURL = vi.fn()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:slide')
      static revokeObjectURL = revokeObjectURL
    },
  )
  const controller = new AbortController()
  const result = prepareSlide('coral-reef', 'slide_test', controller.signal)
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled())
  controller.abort()
  decode()
  await rejected
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:slide')
})
