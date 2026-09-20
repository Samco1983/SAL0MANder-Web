import { afterEach, expect, it, vi } from 'vitest'
import { newDraft } from '@studio/activityDraft'
import { preparePreview, previewProblems, sendPreview } from './previewBridge'

afterEach(() => vi.restoreAllMocks())
it('prepares and sends local photo pixels through the existing native preview without fetching or persisting', async () => {
  const draft = newDraft('act_local', '2026-09-12T00:00:00Z')
  draft.config.title = 'Local preview'
  draft.config.activityType = 'Classic'
  draft.meta.imageKey = 'custom'
  draft.meta.notes = 'Private teacher notes'
  const picture = { key: 'custom', pngBase64: 'bG9jYWw=' }
  const fetch = vi.spyOn(globalThis, 'fetch')
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  expect(previewProblems(draft, picture)).toEqual([])
  const prepared = await preparePreview(
    draft,
    'preview_local',
    new AbortController().signal,
    picture,
  )
  expect(prepared.picture).toEqual(picture)
  const SendMessage = vi.fn()
  expect(sendPreview({ SendMessage }, prepared)).toBe(true)
  const wire = SendMessage.mock.calls[0]![2]
  expect(wire).toContain('bG9jYWw=')
  expect(wire).not.toContain('Private teacher notes')
  expect(fetch).not.toHaveBeenCalled()
  expect(storage).not.toHaveBeenCalled()
})
it('does not mistake a bare custom marker or mismatched image for a ready preview', async () => {
  const draft = newDraft('act_local', '2026-09-12T00:00:00Z')
  draft.config.title = 'Local preview'
  draft.config.activityType = 'Classic'
  draft.meta.imageKey = 'custom'
  expect(previewProblems(draft).length).toBeGreaterThan(0)
  expect(previewProblems(draft, { key: 'custom', pngBase64: '' }).length).toBeGreaterThan(0)
  await expect(
    preparePreview(draft, 'preview_local', new AbortController().signal, {
      key: 'other',
      pngBase64: 'bG9jYWw=',
    }),
  ).rejects.toThrow('does not match')
})
