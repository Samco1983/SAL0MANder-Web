import { z } from 'zod'
import { newId } from '@contracts/v1'
import { ActivityDraftSchema, type ActivityDraft } from './activityDraft'

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024

const BackupSchema = z.object({
  format: z.literal('sal0mander-studio-backup'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  drafts: z.array(ActivityDraftSchema).min(1),
})

export class DraftBackupError extends Error {}

function checkSize(size: number) {
  if (size > MAX_BACKUP_BYTES) {
    throw new DraftBackupError('This backup is too large. Choose a file no larger than 5 MB.')
  }
}

/** The saved file includes every activity and its notes, including pending edits. */
export function createDraftBackup(drafts: ActivityDraft[], exportedAt = new Date().toISOString()): string {
  const result = BackupSchema.safeParse({
    format: 'sal0mander-studio-backup', version: 1, exportedAt, drafts,
  })
  if (!result.success) throw new DraftBackupError('These activities could not be backed up. Keep this page open and try again.')
  const text = JSON.stringify(result.data, null, 2)
  checkSize(new TextEncoder().encode(text).byteLength)
  return text
}

/** Reject the whole file, rather than silently dropping a teacher's invalid drafts. */
export function parseDraftBackup(text: string): ActivityDraft[] {
  checkSize(new TextEncoder().encode(text).byteLength)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new DraftBackupError('This file could not be read. Choose a SAL0MANder backup downloaded from Teacher Studio.')
  }
  const header = z.object({ format: z.literal('sal0mander-studio-backup'), version: z.number() }).safeParse(parsed)
  if (header.success && header.data.version !== 1) {
    throw new DraftBackupError('This backup uses a different version of SAL0MANder. Open it with the version that created it.')
  }
  const result = BackupSchema.safeParse(parsed)
  if (!result.success) {
    throw new DraftBackupError('This is not a compatible Teacher Studio backup. Your activities have not been changed.')
  }
  return result.data.drafts
}

/** Check the file before reading it, so an oversized selection is never loaded. */
export async function readDraftBackupFile(file: File): Promise<ActivityDraft[]> {
  checkSize(file.size)
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new DraftBackupError('This file could not be opened. Try downloading the backup again.'))
    reader.readAsText(file)
  })
  return parseDraftBackup(text)
}

/** Import copies; a backup can never replace a current activity with an older one. */
export function copyBackupDrafts(drafts: ActivityDraft[], now = new Date().toISOString()): ActivityDraft[] {
  return drafts.map((draft) => ({
    ...draft,
    config: { ...draft.config, activityId: `act_${newId()}` },
    meta: { ...draft.meta, createdAt: now, updatedAt: now },
  }))
}
