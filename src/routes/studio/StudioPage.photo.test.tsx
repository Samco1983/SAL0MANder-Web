import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { newDraft } from '@studio/activityDraft'
import { loadDrafts, saveDrafts } from '@studio/draftStorage'
import { prepareCustomPhoto } from '@/gifts/customPhoto'
import { StudioPage } from './StudioPage'

vi.mock('@/gifts/customPhoto', () => ({ prepareCustomPhoto: vi.fn() }))
vi.mock('./StudioPreview', () => ({
  StudioPreview: ({
    draft,
    customPicture,
    photoPreparing,
  }: {
    draft: { meta: { imageKey: string } }
    customPicture?: { pngBase64: string }
    photoPreparing: boolean
  }) => (
    <div
      data-testid="preview"
      data-picture={draft.meta.imageKey}
      data-photo={customPicture?.pngBase64}
      data-preparing={photoPreparing}
    />
  ),
}))
const photo = { png: new Blob(['private']), pngBase64: 'cHJpdmF0ZQ==', width: 960, height: 540 }
beforeEach(() => {
  localStorage.clear()
  const draft = newDraft('act_local_photo', '2026-09-12T00:00:00Z')
  draft.config.title = 'Local photo activity'
  draft.config.activityType = 'Classic'
  draft.meta.imageKey = 'coral-reef'
  saveDrafts([draft])
  vi.mocked(prepareCustomPhoto).mockReset().mockResolvedValue(photo)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function open() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <StudioPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}
function choose() {
  fireEvent.click(screen.getByRole('tab', { name: 'Puzzle & image' }))
  fireEvent.change(screen.getByLabelText('Or use your own photo'), {
    target: { files: [new File(['x'], 'local.png', { type: 'image/png' })] },
  })
}
it('uses the local picture across tabs without replacing saved draft media or backup contents', async () => {
  const view = open()
  choose()
  expect(await screen.findByAltText('Your selection, previewed on this device')).toBeVisible()
  expect(screen.getByText(/not uploaded or approved/)).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
  expect(screen.getByTestId('preview')).toHaveAttribute('data-picture', 'custom')
  expect(screen.getByTestId('preview')).toHaveAttribute('data-photo', photo.pngBase64)
  expect(loadDrafts()[0]?.meta.imageKey).toBe('coral-reef')
  expect(JSON.stringify(loadDrafts())).not.toContain(photo.pngBase64)
  view.unmount()
  open()
  fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
  expect(screen.getByTestId('preview')).toHaveAttribute('data-picture', 'coral-reef')
  expect(screen.getByTestId('preview')).not.toHaveAttribute('data-photo')
})
it('cancels pending decoding when an activity is replaced and cannot leak its picture into the next activity', async () => {
  let finish: (value: typeof photo) => void = () => {}
  vi.mocked(prepareCustomPhoto).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  open()
  choose()
  const signal = vi.mocked(prepareCustomPhoto).mock.calls[0]![1]
  fireEvent.click(screen.getByRole('button', { name: /^New$/ }))
  expect(signal.aborted).toBe(true)
  await act(async () => finish(photo))
  fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
  expect(screen.getByTestId('preview')).not.toHaveAttribute('data-photo')
  expect(screen.getByTestId('preview')).not.toHaveAttribute('data-picture', 'custom')
})
