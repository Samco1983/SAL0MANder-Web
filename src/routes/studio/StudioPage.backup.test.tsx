import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { newDraft } from '@studio/activityDraft'
import { createDraftBackup, MAX_BACKUP_BYTES, readDraftBackupFile } from '@studio/draftBackup'
import { DRAFTS_KEY, loadDrafts, saveDrafts } from '@studio/draftStorage'
import { StudioPage } from './StudioPage'

const NOW = '2026-09-08T10:00:00.000Z'
const existing = { ...newDraft('act_existing', NOW), config: { ...newDraft('act_existing', NOW).config, title: 'My current activity' } }

beforeEach(() => { saveDrafts([existing]) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function openStudio() {
  return render(<ThemeProvider><MemoryRouter><StudioPage /></MemoryRouter></ThemeProvider>)
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText('Choose an activity backup'), { target: { files: [file] } })
}

it('downloads all activities with the latest unsaved edit, even when browser storage refuses writes', async () => {
  const blobs: Blob[] = []
  const createObjectURL = vi.fn((blob: Blob) => { blobs.push(blob); return 'blob:backup' })
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL
    static revokeObjectURL = revokeObjectURL
  })
  const downloadNames: string[] = []
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloadNames.push(this.download)
  })
  openStudio()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  fireEvent.change(screen.getByRole('textbox', { name: 'Activity title' }), { target: { value: 'My latest edit' } })
  fireEvent.click(screen.getByRole('button', { name: 'Download backup' }))
  const downloaded = await readDraftBackupFile(new File([blobs[0]!], 'backup.json'))
  expect(downloaded[0]!.config.title).toBe('My latest edit')
  expect(click).toHaveBeenCalledOnce()
  expect(downloadNames[0]).toMatch(/^SAL0MANder-activities-\d{4}-\d{2}-\d{2}\.json$/)
  expect(screen.getByText(/Backup download started/)).toBeVisible()
})

it('adds an imported activity as a fresh copy and keeps edits made while its file loads', async () => {
  openStudio()
  const backup = createDraftBackup([existing], NOW)
  chooseFile(new File([backup], 'activities.json', { type: 'application/json' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Activity title' }), { target: { value: 'Keep this new edit' } })
  await screen.findByText('Imported 1 activity as a new copy. Your existing activities are still here.')
  const saved = loadDrafts()
  expect(saved).toHaveLength(2)
  expect(saved.find((d) => d.config.activityId === existing.config.activityId)?.config.title).toBe('Keep this new edit')
  expect(saved.find((d) => d.config.activityId !== existing.config.activityId)?.config.title).toBe('My current activity')
  expect(screen.getByRole('textbox', { name: 'Activity title' })).toHaveValue('My current activity')
})

it.each([
  ['malformed', '{invalid', /could not be read/],
  ['incompatible', JSON.stringify({ format: 'sal0mander-studio-backup', version: 99 }), /different version/],
  ['invalid activity', JSON.stringify({ format: 'sal0mander-studio-backup', version: 1, exportedAt: NOW, drafts: [existing, { invalid: true }] }), /not a compatible/],
] as const)('keeps current work when the import is %s', async (_name, text, message) => {
  openStudio()
  const before = localStorage.getItem(DRAFTS_KEY)
  chooseFile(new File([text], 'backup.json'))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(localStorage.getItem(DRAFTS_KEY)).toBe(before)
  expect(screen.getByRole('textbox', { name: 'Activity title' })).toHaveValue('My current activity')
  expect(screen.getByRole('button', { name: 'Import backup' })).toBeEnabled()
})

it('rejects an oversized import without touching current activities', async () => {
  openStudio()
  const before = localStorage.getItem(DRAFTS_KEY)
  chooseFile(new File(['x'.repeat(MAX_BACKUP_BYTES + 1)], 'large.json'))
  expect(await screen.findByRole('alert')).toHaveTextContent('too large')
  expect(localStorage.getItem(DRAFTS_KEY)).toBe(before)
  expect(screen.getByRole('textbox', { name: 'Activity title' })).toHaveValue('My current activity')
})

it('keeps the existing editor and saved activities if storage rejects the imported copies', async () => {
  openStudio()
  const before = localStorage.getItem(DRAFTS_KEY)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  chooseFile(new File([createDraftBackup([existing], NOW)], 'backup.json'))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not save the imported activities'))
  expect(localStorage.getItem(DRAFTS_KEY)).toBe(before)
  expect(screen.getByRole('textbox', { name: 'Activity title' })).toHaveValue('My current activity')
  expect(loadDrafts()).toHaveLength(1)
})
