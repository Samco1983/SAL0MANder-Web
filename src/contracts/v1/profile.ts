import { z } from 'zod'
import { ProfileIdSchema } from './ids'
import { TimestampSchema } from './common'
import { MediaDescriptorSchema } from './media'

/**
 * DRAFT — SHAPE ONLY.
 *
 * XP curves, credit earn/spend rules, badge criteria, and any economy design
 * are explicitly OUT OF SCOPE until product approval. These schemas reserve the
 * field names so storage and API surfaces don't have to be reshaped later; they
 * assert nothing about how any of it is earned.
 */

export const ProfileRoleSchema = z.enum(['student', 'teacher'])
export type ProfileRole = z.infer<typeof ProfileRoleSchema>

export const AvatarSchema = z.object({
  media: MediaDescriptorSchema.nullable().default(null),
  /** Opaque customization state; the avatar system is not designed yet. */
  config: z.record(z.string(), z.unknown()).default({}),
})
export type Avatar = z.infer<typeof AvatarSchema>

/** Placeholder. Award criteria are product-owned and not defined here. */
export const BadgeSchema = z.object({
  key: z.string(),
  label: z.string(),
  earnedAt: TimestampSchema,
})
export type Badge = z.infer<typeof BadgeSchema>

export const ProgressionSchema = z.object({
  xp: z.number().int().nonnegative().default(0),
  level: z.number().int().positive().default(1),
  credits: z.number().int().nonnegative().default(0),
  badges: z.array(BadgeSchema).default([]),
})
export type Progression = z.infer<typeof ProgressionSchema>

export const ProfileSchema = z.object({
  id: ProfileIdSchema,
  role: ProfileRoleSchema,
  displayName: z.string().min(1).max(40),
  avatar: AvatarSchema,
  progression: ProgressionSchema,
  createdAt: TimestampSchema,
})
export type Profile = z.infer<typeof ProfileSchema>
