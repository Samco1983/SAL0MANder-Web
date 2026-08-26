import { ActivityDraftSchema, type ActivityDraft } from '@contracts/authoring'

const DRAFT_KEY = 'sal0mander.studio.activity-draft.v1'

export interface ActivityDraftRepository {
  load(): ActivityDraft | null
  save(draft: ActivityDraft): void
  clear(): void
}

export class LocalActivityDraftRepository implements ActivityDraftRepository {
  load(): ActivityDraft | null {
    try {
      const stored = localStorage.getItem(DRAFT_KEY)
      if (!stored) return null
      const parsed = ActivityDraftSchema.safeParse(JSON.parse(stored))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  }

  save(draft: ActivityDraft): void {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(ActivityDraftSchema.parse(draft)))
  }

  clear(): void {
    localStorage.removeItem(DRAFT_KEY)
  }
}
