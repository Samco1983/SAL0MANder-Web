import { ActivityDraftSchema, newDraft, type ActivityDraft } from './activityDraft'

/**
 * Where a teacher's work lives while there is no backend.
 *
 * The browser, on their own machine. That is a real limitation and it is worth
 * naming rather than hiding: an activity authored on a classroom desktop is not
 * on the teacher's laptop, and cannot be handed to a colleague.
 *
 * It is not, however, a step backwards. Unity's Teacher Studio stores activities
 * in `PlayerPrefs` (`ActivityManager.cs:125`), which is device-local in exactly
 * the same way. Nothing is lost by authoring here; sharing is what the backend
 * unlocks, and the retrieval contract for it is already written
 * (`PlayBundleSchema`).
 *
 * ## Everything is validated on the way in
 *
 * Local storage holds whatever was there last time — an older shape, a
 * half-written value, another tab's experiment. Parsing through the schema means
 * a draft that no longer fits is discarded and replaced with a fresh one rather
 * than crashing the editor on a field that moved. Losing an unfinished draft is
 * bad; a teacher unable to open Teacher Studio at all is worse.
 */

export const DRAFTS_KEY = 'sal0mander.studio.drafts'

/** Storage can be blocked entirely — private mode, an embedded frame, policy. */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    // Quota exceeded, or storage disabled. The editor keeps working in memory;
    // the caller decides whether to tell the teacher.
    return false
  }
}

/** Every draft on this device, newest first. Unreadable entries are dropped. */
export function loadDrafts(): ActivityDraft[] {
  const raw = safeGet(DRAFTS_KEY)
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .map((entry) => ActivityDraftSchema.safeParse(entry))
    .filter((r): r is { success: true; data: ActivityDraft } => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt))
}

/**
 * Writes the whole set. Returns false when storage refused, so the UI can say
 * "not saved" instead of implying it was.
 */
export function saveDrafts(drafts: ActivityDraft[]): boolean {
  return safeSet(DRAFTS_KEY, JSON.stringify(drafts))
}

/** Inserts or replaces one draft, stamping `updatedAt`. */
export function upsertDraft(draft: ActivityDraft, now: string): ActivityDraft[] {
  const stamped: ActivityDraft = { ...draft, meta: { ...draft.meta, updatedAt: now } }
  const rest = loadDrafts().filter((d) => d.config.activityId !== stamped.config.activityId)
  const next = [stamped, ...rest]
  saveDrafts(next)
  return next
}

export function deleteDraft(activityId: string): ActivityDraft[] {
  const next = loadDrafts().filter((d) => d.config.activityId !== activityId)
  saveDrafts(next)
  return next
}

/** Loads one draft, or creates it. Never returns undefined, so the editor always has something to render. */
export function loadOrCreate(activityId: string, now: string): ActivityDraft {
  return loadDrafts().find((d) => d.config.activityId === activityId) ?? newDraft(activityId, now)
}
