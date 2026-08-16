import { z } from 'zod'
import { ActivityIdSchema, ActivityVersionIdSchema, ProfileIdSchema } from './ids'
import { TimestampSchema, VisibilitySchema } from './common'
import { MediaDescriptorSchema } from './media'

/**
 * DRAFT. What the web platform stores and serves *about* an activity.
 *
 * Deliberately NOT modeled here: questions, puzzle geometry, piece counts, snap
 * tolerances, dock layout, generation parameters. Those are Unity's domain. The
 * authored payload rides along as an opaque, versioned blob (`payload`) that the
 * web app stores, versions, and hands back to Unity without interpreting.
 *
 * This is what keeps the web platform from accidentally re-implementing
 * gameplay: if the web app can't read the payload, it can't fork the rules.
 */

export const ActivityModeSchema = z.enum(['learning-puzzle', 'classic-puzzle'])
export type ActivityMode = z.infer<typeof ActivityModeSchema>

/**
 * The Unity-authored activity body. Opaque to the web platform on purpose.
 * `schemaVersion` is Unity's own versioning, independent of the API contract
 * version, so Unity can iterate on its format without an API release.
 */
export const ActivityPayloadSchema = z.object({
  schemaVersion: z.number().int().positive(),
  /** Unity's serialized activity document. Stored verbatim. */
  body: z.unknown(),
})
export type ActivityPayload = z.infer<typeof ActivityPayloadSchema>

/** Lightweight summary — what a list/card view needs, without the payload. */
export const ActivitySummarySchema = z.object({
  id: ActivityIdSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  mode: ActivityModeSchema,
  visibility: VisibilitySchema,
  authorId: ProfileIdSchema.nullable(),
  authorDisplayName: z.string().optional(),
  thumbnail: MediaDescriptorSchema.nullable().default(null),
  /** Which version a share link currently resolves to. */
  publishedVersionId: ActivityVersionIdSchema.nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})
export type ActivitySummary = z.infer<typeof ActivitySummarySchema>

/**
 * An immutable published snapshot.
 *
 * Versions are append-only: a teacher editing an activity after sending a link
 * to 200 students must never change what those students are already playing.
 * The share link resolves to the activity's *current published version*, and an
 * in-flight session stays pinned to the version it started on.
 */
export const ActivityVersionSchema = z.object({
  id: ActivityVersionIdSchema,
  activityId: ActivityIdSchema,
  versionNumber: z.number().int().positive(),
  payload: ActivityPayloadSchema,
  media: z.array(MediaDescriptorSchema).default([]),
  createdAt: TimestampSchema,
  notes: z.string().max(1000).optional(),
})
export type ActivityVersion = z.infer<typeof ActivityVersionSchema>

/** Full detail: summary + the exact version being served. */
export const ActivityDetailSchema = z.object({
  summary: ActivitySummarySchema,
  version: ActivityVersionSchema,
})
export type ActivityDetail = z.infer<typeof ActivityDetailSchema>

/**
 * What Guest Play receives from a share link. No profile, no PII, no auth —
 * only enough to boot Unity with the right activity.
 */
export const GuestActivityBundleSchema = z.object({
  summary: ActivitySummarySchema.pick({
    id: true,
    title: true,
    description: true,
    mode: true,
    thumbnail: true,
    authorDisplayName: true,
  }),
  version: ActivityVersionSchema,
})
export type GuestActivityBundle = z.infer<typeof GuestActivityBundleSchema>
