import { z } from 'zod'
import { MediaIdSchema } from './ids'
import { TimestampSchema } from './common'

/**
 * A stored media object (puzzle image, teacher upload, avatar art).
 *
 * The web app never proxies bytes through its own server: media is uploaded
 * directly to object storage via a short-lived signed URL and then served from
 * a CDN. That keeps the API stateless and keeps image traffic — by far the
 * heaviest payload — off the application tier as usage scales.
 */
export const MediaKindSchema = z.enum(['puzzle-image', 'avatar', 'resource', 'thumbnail'])
export type MediaKind = z.infer<typeof MediaKindSchema>

export const MediaDescriptorSchema = z.object({
  id: MediaIdSchema,
  kind: MediaKindSchema,
  /** Publicly reachable CDN URL once the upload has been finalized. */
  url: z.url(),
  contentType: z.string(),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Content hash — lets a client skip re-uploading an identical image. */
  checksum: z.string().optional(),
  createdAt: TimestampSchema,
})
export type MediaDescriptor = z.infer<typeof MediaDescriptorSchema>

/** Step 1 of upload: the API hands back a place to PUT the bytes. */
export const UploadIntentSchema = z.object({
  mediaId: MediaIdSchema,
  uploadUrl: z.url(),
  method: z.enum(['PUT', 'POST']),
  headers: z.record(z.string(), z.string()).default({}),
  expiresAt: TimestampSchema,
})
export type UploadIntent = z.infer<typeof UploadIntentSchema>

export const UploadRequestSchema = z.object({
  kind: MediaKindSchema,
  contentType: z.string(),
  byteSize: z.number().int().positive(),
  checksum: z.string().optional(),
})
export type UploadRequest = z.infer<typeof UploadRequestSchema>
