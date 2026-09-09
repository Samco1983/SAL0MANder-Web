import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DRAFTS_KEY, deleteDraft, loadDrafts, loadOrCreate, saveDrafts, upsertDraft } from './draftStorage'
import { newDraft } from './activityDraft'

const T1 = '2026-09-01T10:00:00.000Z'
const T2 = '2026-09-02T10:00:00.000Z'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('a teacher’s work surviving a closed tab', () => {
  it('round-trips a draft', () => {
    upsertDraft({ ...newDraft('act_a', T1), config: { ...newDraft('act_a', T1).config, title: 'Reef' } }, T1)
    expect(loadDrafts()[0]!.config.title).toBe('Reef')
  })

  it('replaces rather than duplicating on re-save', () => {
    upsertDraft(newDraft('act_a', T1), T1)
    upsertDraft(newDraft('act_a', T1), T2)
    expect(loadDrafts()).toHaveLength(1)
  })

  it('lists the most recently edited first', () => {
    upsertDraft(newDraft('act_old', T1), T1)
    upsertDraft(newDraft('act_new', T2), T2)
    expect(loadDrafts().map((d) => d.config.activityId)).toEqual(['act_new', 'act_old'])
  })

  it('deletes one without touching the others', () => {
    upsertDraft(newDraft('act_a', T1), T1)
    upsertDraft(newDraft('act_b', T1), T2)
    expect(deleteDraft('act_a').map((d) => d.config.activityId)).toEqual(['act_b'])
  })
})

/**
 * Local storage holds whatever was there last time — an older shape, another
 * tab's experiment, a half-written value. A teacher who cannot open Teacher
 * Studio at all is worse off than one who lost an unfinished draft.
 */
describe('surviving whatever is already in storage', () => {
  it.each([
    ['not JSON', 'not json at all'],
    ['not an array', '{"config":{}}'],
    ['an array of junk', '[1, 2, "three"]'],
    ['a draft from an older shape', '[{"config":{"title":"old"},"meta":{}}]'],
  ])('returns an empty list rather than throwing on %s', (_label, stored) => {
    localStorage.setItem(DRAFTS_KEY, stored)
    expect(() => loadDrafts()).not.toThrow()
    expect(loadDrafts()).toEqual([])
  })

  it('keeps the valid drafts and drops only the broken ones', () => {
    const good = newDraft('act_good', T1)
    localStorage.setItem(DRAFTS_KEY, JSON.stringify([{ garbage: true }, good]))
    expect(loadDrafts().map((d) => d.config.activityId)).toEqual(['act_good'])
  })
})

describe('when the browser refuses to store anything', () => {
  it('reports failure instead of pretending it saved', () => {
    // Private mode, a quota that is full, or an embedded frame. The editor keeps
    // working in memory; the UI needs to know not to claim "Saved".
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(saveDrafts([newDraft('act_a', T1)])).toBe(false)
  })

  it('still opens the editor with a usable draft', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadOrCreate('act_a', T1).config.activityId).toBe('act_a')
  })
})
