import { z } from 'zod'

/** Additive replay notifications; legacy preview and guest message shapes are unchanged. */
export const PREVIEW_ATTEMPT_EVENT = 'sal0mander:preview-attempt-message'
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
const attempt = z.number().int().min(1).max(2_147_483_647)
const base = { attemptVersion: z.literal(1), requestId: id, attempt }
export const PreviewAttemptEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('preview-attempt-receiver-ready'),
    attemptVersion: z.literal(1),
    requestId: z.literal(''),
  }),
  z.strictObject({ type: z.literal('preview-attempt-ready'), ...base }),
  z.strictObject({ type: z.literal('preview-attempt-finished'), ...base }),
])
export type PreviewAttemptEvent = z.infer<typeof PreviewAttemptEventSchema>

export function onPreviewAttemptMessage(callback: (message: PreviewAttemptEvent) => void) {
  const listener = (event: Event) => {
    const parsed = PreviewAttemptEventSchema.safeParse((event as CustomEvent<unknown>).detail)
    if (parsed.success) callback(parsed.data)
  }
  window.addEventListener(PREVIEW_ATTEMPT_EVENT, listener)
  return () => window.removeEventListener(PREVIEW_ATTEMPT_EVENT, listener)
}
