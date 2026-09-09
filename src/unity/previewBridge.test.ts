import { afterEach, describe, expect, it, vi } from 'vitest'
import { newDraft } from '@studio/activityDraft'
import { MAX_PREVIEW_IMAGE_BYTES, onPreviewMessage, preparePreview, PREVIEW_EVENT, PreviewActivitySchema, PreviewBootSchema, previewProblems, sendPreview } from './previewBridge'

function draft() {
  const value = newDraft('act_preview_test', '2026-09-08T00:00:00Z')
  value.config.title = 'My exact activity'
  value.config.pieceCountPreset = 4
  value.meta.imageKey = 'coral-reef'
  value.meta.notes = 'PRIVATE TEACHER NOTES'
  value.questions = Array.from({ length: 4 }, (_, i) => ({
    id: `q_${i}`, questionText: `${i} + 1?`, hintText: 'Count one more',
    choices: [{ id: 'a', text: String(i + 1), isCorrect: true }, { id: 'b', text: '99', isCorrect: false }],
  }))
  return value
}
function packet() {
  return PreviewBootSchema.parse({ ...PreviewActivitySchema.parse(draft()), type: 'preview-boot', previewVersion: 1, requestId: 'preview_test', picture: { key: 'coral-reef', pngBase64: 'aGVsbG8=' } })
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('sends authored values without private notes, metadata or positional image presets', () => {
  const SendMessage = vi.fn()
  expect(sendPreview({ SendMessage }, packet())).toBe(true)
  const [object, method, json] = SendMessage.mock.calls[0]!
  expect([object, method]).toEqual(['SAL0MANderPreview', 'ReceivePreviewMessage'])
  const wire = JSON.parse(json)
  expect(wire.config.title).toBe('My exact activity')
  expect(wire.questions[0].questionText).toBe('0 + 1?')
  expect(wire.picture.key).toBe('coral-reef')
  expect(wire.meta).toBeUndefined()
  expect(wire.config.imagePresetIndex).toBeUndefined()
  expect(json).not.toContain('PRIVATE TEACHER NOTES')
})

describe('runtime draft validation', () => {
  it.each([
    ['too few questions', (d: ReturnType<typeof draft>) => { d.questions.pop() }],
    ['duplicate questions', (d: ReturnType<typeof draft>) => { d.questions[1]!.id = d.questions[0]!.id }],
    ['blank answer', (d: ReturnType<typeof draft>) => { d.questions[0]!.choices[0]!.text = ' ' }],
    ['two correct answers', (d: ReturnType<typeof draft>) => { d.questions[0]!.choices[1]!.isCorrect = true }],
    ['duplicate choices', (d: ReturnType<typeof draft>) => { d.questions[0]!.choices[1]!.id = 'a' }],
    ['too many questions', (d: ReturnType<typeof draft>) => { d.questions = Array.from({ length: 65 }, (_, i) => ({ ...d.questions[0]!, id: `q_${i}` })) }],
  ])('rejects %s', (_name, change) => {
    const value = draft(); change(value)
    expect(PreviewActivitySchema.safeParse(value).success).toBe(false)
    expect(previewProblems(value).length).toBeGreaterThan(0)
  })
  it('allows a Classic activity with no questions', () => {
    const value = draft(); value.config.activityType = 'Classic'; value.questions = []
    expect(previewProblems(value)).toEqual([])
  })
  it('requires a known picture key even when the old preset index is valid', () => {
    const value = draft(); value.meta.imageKey = 'unknown-picture'
    expect(previewProblems(value)).toContain('Choose a puzzle picture from the library.')
  })
  it('rejects future preview or config versions and invalid whole-envelope size', () => {
    expect(PreviewBootSchema.safeParse({ ...packet(), previewVersion: 2 }).success).toBe(false)
    expect(PreviewBootSchema.safeParse({ ...packet(), config: { ...packet().config, schemaVersion: 3 } }).success).toBe(false)
    const value = packet(); value.picture.pngBase64 = 'A'.repeat(Math.ceil(MAX_PREVIEW_IMAGE_BYTES / 3) * 4 + 1)
    expect(sendPreview({ SendMessage: vi.fn() }, value)).toBe(false)
  })
})

it('does not treat a missing receiver or SendMessage exception as success', () => {
  expect(sendPreview(null, packet())).toBe(false)
  expect(sendPreview({ SendMessage: () => { throw new Error('missing') } }, packet())).toBe(false)
})

it('validates and isolates preview events and detaches the listener', () => {
  const listener = vi.fn()
  const stop = onPreviewMessage(listener)
  const emit = (detail: unknown) => window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail }))
  emit({ previewVersion: 99, type: 'preview-ready', requestId: 'preview_test' })
  emit({ contractVersion: 1, type: 'unity-ready' })
  expect(listener).not.toHaveBeenCalled()
  emit({ previewVersion: 1, type: 'preview-ready', requestId: 'preview_test' })
  expect(listener).toHaveBeenCalledOnce()
  stop()
  emit({ previewVersion: 1, type: 'preview-ready', requestId: 'preview_test' })
  expect(listener).toHaveBeenCalledOnce()
})

it('prepares the selected image and an immutable question snapshot, releasing its object URL', async () => {
  const value = draft()
  let finishDecode: () => void = () => {}
  let decodeStarted = false
  vi.stubGlobal('Image', class { src = ''; naturalWidth = 640; naturalHeight = 640; decode() { decodeStarted = true; return new Promise<void>((resolve) => { finishDecode = resolve }) } })
  const fetch = vi.fn(async (_url: string, _options: RequestInit) => ({ ok: true, blob: async () => new Blob(['webp']) }))
  vi.stubGlobal('fetch', fetch)
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:picture'); static revokeObjectURL = revokeObjectURL })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,aGVsbG8=')
  const promise = preparePreview(value, 'preview_test', new AbortController().signal)
  await vi.waitFor(() => expect(decodeStarted).toBe(true))
  value.questions[0]!.questionText = 'Edit made while image loads'
  value.meta.imageKey = 'colosseum'
  finishDecode()
  const prepared = await promise
  expect(fetch.mock.calls[0]![0]).toBe('/images/library/square/cartoon/coral_reef_marine_life.webp')
  expect(prepared.questions[0]!.questionText).toBe('0 + 1?')
  expect(prepared.picture).toEqual({ key: 'coral-reef', pngBase64: 'aGVsbG8=' })
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:picture')
})
