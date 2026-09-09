import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { newDraft } from '@studio/activityDraft'
import { preparePreview, PreviewBootSchema } from '@unity/previewBridge'
import { StudioPreview } from './StudioPreview'

vi.mock('@unity/previewBridge', async (original) => ({ ...await original<typeof import('@unity/previewBridge')>(), preparePreview: vi.fn() }))
vi.mock('@unity/UnityStage', async () => {
  const { useLocation } = await import('react-router-dom')
  return { UnityStage: ({ preview }: { preview: { config: { title: string } } }) => <div data-testid="preview-game">{preview.config.title} {useLocation().search}</div> }
})
const draft = newDraft('act_teacher', '2026-09-08T00:00:00Z')
draft.config.title = 'Teacher-authored picture'
draft.config.activityType = 'Classic'
draft.meta.imageKey = 'coral-reef'
const packet = PreviewBootSchema.parse({ type: 'preview-boot', previewVersion: 1, requestId: 'preview_test', config: draft.config, questions: [], picture: { key: 'coral-reef', pngBase64: 'aGVsbG8=' } })

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } })
  vi.mocked(preparePreview).mockResolvedValue(packet)
})
afterEach(() => { Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close'); vi.restoreAllMocks(); vi.clearAllMocks() })
const open = (value = draft) => render(<MemoryRouter><StudioPreview draft={value} /></MemoryRouter>)

it('starts a prepared activity with the persistence marker present before Unity loads, and ends explicitly', async () => {
  open()
  expect(screen.queryByTestId('preview-game')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Play preview' }))
  expect(await screen.findByTestId('preview-game')).toHaveTextContent('Teacher-authored picture ?teacherPreview=1')
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Activity preview')
  expect(screen.getByText(/Progress is temporary/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'End preview' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Play preview' })).toBeEnabled()
})

it('explains incomplete drafts without starting a game or fetching a picture', () => {
  open(newDraft('act_empty', '2026-09-08T00:00:00Z'))
  expect(screen.getByRole('button', { name: 'Play preview' })).toBeDisabled()
  expect(screen.getByText(/Choose a puzzle picture/)).toBeVisible()
  expect(preparePreview).not.toHaveBeenCalled()
})

it('keeps the editor usable if image preparation fails', async () => {
  vi.mocked(preparePreview).mockRejectedValueOnce(new Error('Picture could not be loaded'))
  open()
  fireEvent.click(screen.getByRole('button', { name: 'Play preview' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Picture could not be loaded')
  expect(screen.getByRole('button', { name: 'Play preview' })).toBeEnabled()
  expect(screen.queryByTestId('preview-game')).not.toBeInTheDocument()
})

it('cancels pending preparation when the teacher leaves, and ignores its late result', async () => {
  let resolve: (value: typeof packet) => void = () => {}
  vi.mocked(preparePreview).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
  const view = open()
  fireEvent.click(screen.getByRole('button', { name: 'Play preview' }))
  const signal = vi.mocked(preparePreview).mock.calls[0]![2]
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => resolve(packet))
  expect(screen.queryByTestId('preview-game')).not.toBeInTheDocument()
})
