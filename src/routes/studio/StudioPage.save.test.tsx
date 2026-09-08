import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { newDraft } from '@studio/activityDraft'
import { loadDrafts, saveDrafts } from '@studio/draftStorage'
import { StudioPage } from './StudioPage'

beforeEach(() => {
  localStorage.clear()
  const draft = newDraft('act_save_test', '2026-09-02T00:00:00Z')
  draft.config.title = 'Original'
  saveDrafts([draft])
  vi.useFakeTimers()
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
function openStudio() {
  render(<ThemeProvider><MemoryRouter><StudioPage /></MemoryRouter></ThemeProvider>)
}

it('reports failed storage honestly and retries without losing the edit', () => {
  openStudio()
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  fireEvent.change(screen.getByRole('textbox', { name: 'Activity title' }), { target: { value: 'Keep this edit' } })
  act(() => vi.advanceTimersByTime(600))
  expect(screen.getByRole('status')).toHaveTextContent('Not saved')
  expect(screen.getByRole('textbox', { name: 'Activity title' })).toHaveValue('Keep this edit')
  write.mockRestore()
  fireEvent.click(screen.getByRole('button', { name: 'Retry save' }))
  expect(screen.getByRole('status')).toHaveTextContent('All changes saved')
  expect(loadDrafts()[0]?.config.title).toBe('Keep this edit')
})

it('keeps a pending edit when creating another activity before autosave', () => {
  openStudio()
  fireEvent.change(screen.getByRole('textbox', { name: 'Activity title' }), { target: { value: 'Before switching' } })
  fireEvent.click(screen.getByRole('button', { name: /^New$/ }))
  act(() => vi.advanceTimersByTime(600))
  expect(loadDrafts()).toHaveLength(2)
  expect(loadDrafts().find((d) => d.config.activityId === 'act_save_test')?.config.title).toBe('Before switching')
})

it('does not resurrect a deleted draft when an autosave timer was pending', () => {
  openStudio()
  fireEvent.change(screen.getByRole('textbox', { name: 'Activity title' }), { target: { value: 'Delete me' } })
  fireEvent.click(screen.getByRole('button', { name: 'Delete this activity' }))
  act(() => vi.advanceTimersByTime(600))
  expect(loadDrafts()).toHaveLength(0)
})
