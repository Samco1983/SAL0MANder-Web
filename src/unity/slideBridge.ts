import { z } from 'zod'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import type { UnityMessageTarget } from './bridge'
import { MAX_LIBRARY_IMAGE_BYTES, prepareLibraryPicture } from './libraryPicture'

/** Separate from the frozen guest bridge and the existing jigsaw preview wire. */
export const SLIDE_EVENT = 'sal0mander:slide-message'
const requestId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
const attempt = z.number().int().min(1).max(2147483647)
export const SlideBootSchema = z.strictObject({
  type: z.literal('slide-boot'),
  slideVersion: z.literal(1),
  requestId,
  mode: z.literal('cyclic-3x3'),
  picture: z.strictObject({
    key: z
      .string()
      .max(128)
      .refine((key) => PUZZLE_LIBRARY.some((picture) => picture.key === key)),
    pngBase64: z
      .string()
      .min(4)
      .max(Math.ceil(MAX_LIBRARY_IMAGE_BYTES / 3) * 4)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/)
      .refine((value) => value.length % 4 === 0),
  }),
  questions: z.array(z.never()).length(0),
})
export type SlideBoot = z.infer<typeof SlideBootSchema>
const envelope = { slideVersion: z.literal(1), requestId }
export const SlideEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('slide-receiver-ready'),
    slideVersion: z.literal(1),
    requestId: z.literal(''),
    capabilities: z.tuple([z.literal('cyclic-3x3')]),
  }),
  z.strictObject({ ...envelope, type: z.literal('slide-ready'), attempt }),
  z.strictObject({
    ...envelope,
    type: z.literal('slide-finished'),
    attempt,
    moves: z.number().int().min(0).max(2147483647),
    seconds: z.number().finite().min(0),
  }),
  z.strictObject({ ...envelope, type: z.literal('slide-error'), message: z.string().max(2000) }),
  z.strictObject({ ...envelope, type: z.literal('slide-cancelled') }),
])
export type SlideEvent = z.infer<typeof SlideEventSchema>

export function onSlideMessage(callback: (message: SlideEvent) => void): () => void {
  const listener = (event: Event) => {
    const parsed = SlideEventSchema.safeParse((event as CustomEvent<unknown>).detail)
    if (parsed.success) callback(parsed.data)
  }
  window.addEventListener(SLIDE_EVENT, listener)
  return () => window.removeEventListener(SLIDE_EVENT, listener)
}
export function sendSlideBoot(instance: UnityMessageTarget | null, input: SlideBoot): boolean {
  if (!instance?.SendMessage) return false
  try {
    const wire = JSON.stringify(SlideBootSchema.parse(input))
    if (new TextEncoder().encode(wire).byteLength > 3 * 1024 * 1024) return false
    instance.SendMessage('SAL0MANderSlide', 'ReceiveSlideMessage', wire)
    return true
  } catch {
    return false
  }
}
export function cancelSlide(instance: UnityMessageTarget | null, id: string): void {
  if (!instance?.SendMessage || !requestId.safeParse(id).success) return
  try {
    instance.SendMessage(
      'SAL0MANderSlide',
      'ReceiveSlideMessage',
      JSON.stringify({ type: 'slide-cancel', slideVersion: 1, requestId: id }),
    )
  } catch {
    /* An old build may not contain this receiver. */
  }
}
export async function prepareSlide(
  imageKey: string,
  id: string,
  signal: AbortSignal,
): Promise<SlideBoot> {
  requestId.parse(id)
  const picture = await prepareLibraryPicture(imageKey, signal)
  signal.throwIfAborted()
  return SlideBootSchema.parse({
    type: 'slide-boot',
    slideVersion: 1,
    requestId: id,
    mode: 'cyclic-3x3',
    picture,
    questions: [],
  })
}
