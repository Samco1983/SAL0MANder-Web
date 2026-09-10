import { z } from 'zod'
import { ActivityConfigSchema, type ActivityDraft } from '@studio/activityDraft'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import type { UnityMessageTarget } from './bridge'
import { MAX_LIBRARY_IMAGE_BYTES, prepareLibraryPicture } from './libraryPicture'

/** A local preview extension. The shipped guest v1 contract is unchanged. */
export const PREVIEW_EVENT = 'sal0mander:preview-message'
export const MAX_PREVIEW_IMAGE_BYTES = MAX_LIBRARY_IMAGE_BYTES
const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
const requiredText = (max: number) => z.string().max(max).refine((s) => s.trim().length > 0)
const choice = z.object({ id, text: requiredText(500), isCorrect: z.boolean() })
const question = z.object({
  id, questionText: requiredText(2000), hintText: z.string().max(2000),
  choices: z.array(choice).min(2).max(6)
    .refine((choices) => choices.filter((c) => c.isCorrect).length === 1, 'Choose exactly one correct answer')
    .refine((choices) => new Set(choices.map((c) => c.id)).size === choices.length, 'Answer IDs must be unique'),
})
export const PreviewActivitySchema = z.object({
  config: ActivityConfigSchema.omit({ imagePresetIndex: true }).extend({ activityId: id, title: requiredText(200) }),
  questions: z.array(question).max(64)
    .refine((questions) => new Set(questions.map((q) => q.id)).size === questions.length, 'Question IDs must be unique'),
}).superRefine(({ config, questions }, ctx) => {
  if (config.activityType !== 'Classic' && questions.length < config.pieceCountPreset) {
    ctx.addIssue({ code: 'custom', path: ['questions'], message: `Add at least ${config.pieceCountPreset} complete questions for this puzzle` })
  }
})
export const PreviewBootSchema = z.object({
  type: z.literal('preview-boot'), previewVersion: z.literal(1), requestId: id,
  config: PreviewActivitySchema.shape.config,
  questions: PreviewActivitySchema.shape.questions,
  picture: z.object({ key: id, pngBase64: z.string().min(1).max(Math.ceil(MAX_PREVIEW_IMAGE_BYTES / 3) * 4) }),
}).superRefine((value, ctx) => {
  const parsed = PreviewActivitySchema.safeParse(value)
  if (!parsed.success) parsed.error.issues.forEach((issue) => ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message }))
})
export type PreviewBoot = z.infer<typeof PreviewBootSchema>

const PreviewEventSchema = z.object({
  previewVersion: z.literal(1),
  type: z.enum(['preview-receiver-ready', 'preview-ready', 'preview-error', 'preview-finished']),
  requestId: z.string().max(128), message: z.string().max(2000).optional(),
})
export type PreviewEvent = z.infer<typeof PreviewEventSchema>

export function onPreviewMessage(callback: (message: PreviewEvent) => void): () => void {
  const listener = (event: Event) => {
    const parsed = PreviewEventSchema.safeParse((event as CustomEvent<unknown>).detail)
    if (parsed.success) callback(parsed.data)
  }
  window.addEventListener(PREVIEW_EVENT, listener)
  return () => window.removeEventListener(PREVIEW_EVENT, listener)
}

export function sendPreview(instance: UnityMessageTarget | null, preview: PreviewBoot): boolean {
  if (!instance?.SendMessage) return false
  try {
    const wire = JSON.stringify(PreviewBootSchema.parse(preview))
    if (new TextEncoder().encode(wire).byteLength > 3 * 1024 * 1024) return false
    instance.SendMessage('SAL0MANderPreview', 'ReceivePreviewMessage', wire)
    return true
  } catch { return false }
}

/** Checks the actual game inputs; teacher notes and listing metadata never cross the boundary. */
export function previewProblems(draft: ActivityDraft): string[] {
  const parsed = PreviewActivitySchema.safeParse(draft)
  const problems: string[] = parsed.success ? [] : parsed.error.issues.map((issue) => {
    if (issue.path.includes('title')) return 'Give the activity a title (up to 200 characters).'
    if (issue.path.includes('questions')) return 'Complete each question and answer, choose one correct answer, and provide enough questions for the pieces.'
    return 'Check the activity settings before playing.'
  })
  const picture = PUZZLE_LIBRARY.find((p) => p.key === draft.meta.imageKey)
  if (!picture) problems.push('Choose a puzzle picture from the library.')
  return [...new Set(problems)]
}

/** Decode the selected same-origin library WebP in the browser, then send PNG Unity can read. */
export async function preparePreview(draft: ActivityDraft, requestId: string, signal: AbortSignal): Promise<PreviewBoot> {
  const activity = PreviewActivitySchema.parse(draft)
  const picture = await prepareLibraryPicture(draft.meta.imageKey, signal)
  return PreviewBootSchema.parse({ type: 'preview-boot', previewVersion: 1, requestId, ...activity, picture })
}
