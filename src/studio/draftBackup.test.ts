import { describe, expect, it, vi } from 'vitest'
import { newDraft } from './activityDraft'
import { copyBackupDrafts, createDraftBackup, MAX_BACKUP_BYTES, parseDraftBackup, readDraftBackupFile } from './draftBackup'

const THEN = '2026-09-01T10:00:00.000Z'
const NOW = '2026-09-08T10:00:00.000Z'

function activity() {
  const draft = newDraft('act_original', THEN)
  draft.config.title = 'A reef 🐢'
  draft.config.boardShape = 'Portrait'
  draft.meta.notes = 'Teacher-only notes'
  draft.meta.imageKey = 'dragon-castle'
  draft.questions = [{ id: 'q_one', questionText: 'What is 2 + 2?', hintText: 'Count pairs', choices: [
    { id: 'a', text: '4', isCorrect: true }, { id: 'b', text: '3', isCorrect: false },
  ] }]
  return draft
}

describe('Teacher Studio backup files', () => {
  it('round-trips pictures, questions, choices, settings, notes and Unicode text', () => {
    const original = activity()
    expect(parseDraftBackup(createDraftBackup([original], NOW))).toEqual([original])
  })

  it('imports fresh copies while keeping content and the original untouched', () => {
    const original = activity()
    const restored = parseDraftBackup(createDraftBackup([original], NOW))
    const copies = copyBackupDrafts([...restored, ...restored], NOW)
    expect(new Set([original.config.activityId, ...copies.map((d) => d.config.activityId)]).size).toBe(3)
    expect(copies[0]).toEqual({ ...original, config: { ...original.config, activityId: copies[0]!.config.activityId }, meta: { ...original.meta, createdAt: NOW, updatedAt: NOW } })
    expect(original.config.activityId).toBe('act_original')
    expect(original.meta.updatedAt).toBe(THEN)
  })

  it.each(['not json', '{', 'null', '[]', '{"drafts":[]}'])('rejects malformed or unrelated input: %s', (text) => {
    expect(() => parseDraftBackup(text)).toThrow()
  })

  it('rejects a future format version', () => {
    const backup = JSON.parse(createDraftBackup([activity()], NOW))
    backup.version = 2
    expect(() => parseDraftBackup(JSON.stringify(backup))).toThrow('different version')
  })

  it('rejects the entire backup if any activity has an incompatible schema', () => {
    const backup = JSON.parse(createDraftBackup([activity()], NOW))
    backup.drafts.push({ ...activity(), config: { ...activity().config, schemaVersion: 99 } })
    expect(() => parseDraftBackup(JSON.stringify(backup))).toThrow('not a compatible')
  })

  it('limits UTF-8 bytes, including multi-byte text', () => {
    expect(() => parseDraftBackup('é'.repeat(MAX_BACKUP_BYTES / 2 + 1))).toThrow('too large')
  })

  it('rejects an oversized file before attempting to read it', async () => {
    const read = vi.spyOn(FileReader.prototype, 'readAsText')
    const file = new File(['x'.repeat(MAX_BACKUP_BYTES + 1)], 'too-large.json')
    await expect(readDraftBackupFile(file)).rejects.toThrow('too large')
    expect(read).not.toHaveBeenCalled()
    read.mockRestore()
  })
})
