import { StrictMode } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { SOUND_LIBRARY } from '@content/soundLibrary'
import { SoundLibraryPage } from './SoundLibraryPage'

const { owners } = vi.hoisted(() => ({
  owners: [] as {
    unlock: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
    play: ReturnType<typeof vi.fn>
    finish: (ok: boolean) => void
  }[],
}))
vi.mock('@/gifts/giftFeedback', () => ({
  defaultFeedbackOptions: () => ({}),
  GiftFeedback: class {
    unlock = vi.fn()
    dispose = vi.fn()
    finish: (ok: boolean) => void = () => {}
    play = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          this.finish = resolve
        }),
    )
    constructor() {
      owners.push(this)
    }
  },
}))
beforeEach(() => owners.splice(0))
afterEach(() => vi.restoreAllMocks())
function show() {
  return render(
    <StrictMode>
      <ThemeProvider>
        <MemoryRouter>
          <SoundLibraryPage />
        </MemoryRouter>
      </ThemeProvider>
    </StrictMode>,
  )
}

it('lists every shipped clip with truthful recording/synthesis provenance and no audio owner at page load', () => {
  show()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sound library')
  expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(SOUND_LIBRARY.length)
  expect(screen.getAllByText('Original SAL0MANder synthesized effect')).toHaveLength(
    SOUND_LIBRARY.filter((s) => !s.credit).length,
  )
  expect(screen.getAllByText('Source-credited recording')).toHaveLength(
    SOUND_LIBRARY.filter((s) => s.credit).length,
  )
  const ocean = screen.getByRole('heading', { name: 'Ocean Waves' }).closest('li')!
  expect(ocean).toHaveTextContent('12s preview · 47.47s recording')
  expect(within(ocean).getByRole('link', { name: 'Recording by jackmichaelking' })).toHaveAttribute(
    'href',
    SOUND_LIBRARY.find((s) => s.key === 'ocean-waves')!.credit!.source,
  )
  expect(within(ocean).getByRole('link', { name: 'CC0 1.0' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  expect(owners).toHaveLength(0)
  expect(document.querySelector('audio, canvas')).toBeNull()
  expect(screen.getByRole('button', { name: 'Stop preview' })).toBeDisabled()
})

it('filters search and categories, gives empty-result recovery, and never plays from filtering', async () => {
  const user = userEvent.setup()
  show()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'nature')
  expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(2)
  await user.type(screen.getByRole('searchbox', { name: 'Find a sound' }), 'OCEAN')
  expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(1)
  await user.type(screen.getByRole('searchbox', { name: 'Find a sound' }), 'missing')
  expect(screen.getByText(/No sounds match/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Show all sounds' }))
  expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(SOUND_LIBRARY.length)
  expect(owners).toHaveLength(0)
})

it('disposes the previous clip before starting another and ignores its late outcome', async () => {
  const user = userEvent.setup()
  show()
  await user.click(screen.getByRole('button', { name: 'Play Heart Bloom' }))
  expect(owners[0]!.unlock).toHaveBeenCalledTimes(1)
  expect(owners[0]!.play).toHaveBeenCalledWith(expect.objectContaining({ key: 'heart_bloom' }))
  await user.click(screen.getByRole('button', { name: 'Play Ocean Waves' }))
  expect(owners[0]!.dispose).toHaveBeenCalledTimes(1)
  expect(owners[0]!.dispose.mock.invocationCallOrder[0]!).toBeLessThan(
    owners[1]!.play.mock.invocationCallOrder[0]!,
  )
  await act(async () => owners[0]!.finish(false))
  expect(screen.getByRole('status')).toHaveTextContent('Loading or playing Ocean Waves.')
  expect(screen.queryByRole('alert')).toBeNull()
  await act(async () => owners[1]!.finish(true))
  expect(screen.getByRole('status')).toHaveTextContent('Finished Ocean Waves.')
  expect(owners[1]!.dispose).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Stop preview' })).toBeDisabled()
})

it.each(['stop', 'filter', 'unmount'])(
  'cancels active/pending playback on %s and ignores its late finish',
  async (action) => {
    const user = userEvent.setup()
    const view = show()
    await user.click(screen.getByRole('button', { name: 'Play Victory Warm Magic' }))
    if (action === 'stop') await user.click(screen.getByRole('button', { name: 'Stop preview' }))
    else if (action === 'filter')
      await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'animals')
    else view.unmount()
    expect(owners[0]!.dispose).toHaveBeenCalledTimes(1)
    await act(async () => owners[0]!.finish(true))
    expect(screen.queryByText('Finished Victory Warm Magic.')).toBeNull()
    if (action !== 'unmount')
      expect(screen.getByRole('button', { name: 'Stop preview' })).toBeDisabled()
  },
)

it('shows an honest failed preview and lets the next explicit Play retry', async () => {
  const user = userEvent.setup()
  show()
  await user.click(screen.getByRole('button', { name: 'Play Dog Bark' }))
  await act(async () => owners[0]!.finish(false))
  expect(screen.getByRole('alert')).toHaveTextContent(/Could not play Dog Bark/)
  await user.click(screen.getByRole('button', { name: 'Play Dog Bark' }))
  expect(owners).toHaveLength(2)
  expect(screen.queryByRole('alert')).toBeNull()
  await act(async () => owners[1]!.finish(true))
  expect(screen.getByRole('status')).toHaveTextContent('Finished Dog Bark.')
})
