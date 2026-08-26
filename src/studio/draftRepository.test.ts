import { beforeEach, describe, expect, it } from 'vitest'
import { LocalActivityDraftRepository } from './draftRepository'

describe('local activity draft repository', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a valid incomplete draft', () => {
    const repository = new LocalActivityDraftRepository()
    repository.save({
      contractVersion: 1,
      id: 'draft-local',
      revision: 2,
      title: 'Draft',
      puzzle: { rows: 3, columns: 3 },
      questions: [],
      updatedAt: '2026-08-26T12:00:00.000Z',
    })

    expect(repository.load()).toMatchObject({ id: 'draft-local', revision: 2, title: 'Draft' })
  })

  it('refuses malformed saved state instead of hydrating it', () => {
    localStorage.setItem('sal0mander.studio.activity-draft.v1', '{"revision":"old"}')
    expect(new LocalActivityDraftRepository().load()).toBeNull()
  })
})
