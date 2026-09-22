import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { prepareCustomPhoto, type PreparedCustomPhoto } from '@/gifts/customPhoto'
import { LocalPhotoPicker } from './LocalPhotoPicker'
import { useLocalPhoto } from './useLocalPhoto'

vi.mock('@/gifts/customPhoto', () => ({ prepareCustomPhoto: vi.fn() }))
const first = { png: new Blob(['one']), pngBase64: 'b25l', width: 2, height: 2 }
const second = { png: new Blob(['two']), pngBase64: 'dHdv', width: 3, height: 2 }
function Harness() {
  const state = useLocalPhoto()
  return (
    <LocalPhotoPicker
      id="local-photo"
      state={state}
      onChoose={(file) => void state.choose(file)}
      onClear={state.clear}
    />
  )
}
function choose(name = 'picture.png') {
  fireEvent.change(screen.getByLabelText('Or use your own photo'), {
    target: { files: [new File(['fixture'], name, { type: 'image/png' })] },
  })
}
beforeEach(() => vi.mocked(prepareCustomPhoto).mockReset())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('uses one strict preparation helper without uploading or persisting the result', async () => {
  vi.mocked(prepareCustomPhoto).mockResolvedValue(first)
  const network = vi.spyOn(globalThis, 'fetch')
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  render(<Harness />)
  choose()
  expect(await screen.findByAltText('Your selection, previewed on this device')).toHaveAttribute(
    'src',
    'data:image/png;base64,b25l',
  )
  expect(screen.getByText(/not uploaded or approved/)).toBeVisible()
  expect(prepareCustomPhoto).toHaveBeenCalledOnce()
  expect(network).not.toHaveBeenCalled()
  expect(storage).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Remove local photo' }))
  expect(screen.queryByRole('img')).toBeNull()
})

it('aborts replaced work and ignores an older decoder result that arrives last', async () => {
  let finish: (photo: PreparedCustomPhoto) => void = () => {}
  vi.mocked(prepareCustomPhoto)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValueOnce(second)
  render(<Harness />)
  choose('first.png')
  const signal = vi.mocked(prepareCustomPhoto).mock.calls[0]![1]
  choose('second.png')
  expect(signal.aborted).toBe(true)
  expect(await screen.findByRole('img')).toHaveAttribute('src', 'data:image/png;base64,dHdv')
  await act(async () => finish(first))
  expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,dHdv')
})

it('clears the old photo immediately and does not restore it when a replacement is rejected', async () => {
  vi.mocked(prepareCustomPhoto)
    .mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new Error('Choose a valid PNG'))
  render(<Harness />)
  choose()
  await screen.findByRole('img')
  choose('invalid.png')
  expect(screen.queryByRole('img')).toBeNull()
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a valid PNG')
})

it.each(['remove', 'unmount'])(
  'cancels pending work on %s and discards late results',
  async (action) => {
    let finish: (photo: PreparedCustomPhoto) => void = () => {}
    vi.mocked(prepareCustomPhoto).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const view = render(<Harness />)
    choose()
    const signal = vi.mocked(prepareCustomPhoto).mock.calls[0]![1]
    if (action === 'remove')
      fireEvent.click(screen.getByRole('button', { name: 'Remove local photo' }))
    else view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => finish(first))
    expect(screen.queryByRole('img')).toBeNull()
  },
)
