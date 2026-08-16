import { z } from 'zod'

/** The contract version this module defines. Bumping means a new folder. */
export const CONTRACT_VERSION = 'v1' as const

/** ISO-8601 UTC. Stored as a string so it survives JSON round-trips exactly. */
export const TimestampSchema = z.iso.datetime({ offset: true })
export type Timestamp = z.infer<typeof TimestampSchema>

/**
 * Every successful API response is wrapped. The envelope carries the server's
 * contract version so a client can detect drift instead of mis-parsing silently.
 */
export const EnvelopeSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    contractVersion: z.string(),
    requestId: z.string().optional(),
    data,
  })

/**
 * Cursor pagination, not offset. Offsets skip/duplicate rows under concurrent
 * writes and get slower the deeper you page — both matter at 100k+ users.
 */
export const PageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  })

export type Page<T> = { items: T[]; nextCursor: string | null }

export const VisibilitySchema = z.enum(['private', 'unlisted', 'public'])
export type Visibility = z.infer<typeof VisibilitySchema>
