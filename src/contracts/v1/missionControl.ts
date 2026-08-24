import { z } from 'zod'

export const MissionStatusSchema = z.enum([
  'queued',
  'active',
  'awaiting_verification',
  'verified',
  'rebound',
  'blocked',
])
export type MissionStatus = z.infer<typeof MissionStatusSchema>

export const MissionProofSchema = z.object({
  command: z.string().trim().min(1).max(500),
  artifact: z.string().trim().min(1).max(200),
  builder: z.string().trim().min(1).max(80),
  verifier: z.string().trim().min(1).max(80),
  missionRevision: z.iso.datetime(),
  verifiedAtUtc: z.iso.datetime(),
})
export type MissionProof = z.infer<typeof MissionProofSchema>

export const MissionSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(160),
    status: MissionStatusSchema,
    updatedAtUtc: z.iso.datetime(),
    issueUrl: z.url(),
    proof: MissionProofSchema.optional(),
  })
  .superRefine((mission, context) => {
    if (mission.status === 'verified' && !mission.proof) {
      context.addIssue({
        code: 'custom',
        path: ['proof'],
        message: 'A verified mission requires rerunnable proof',
      })
    }
    if (mission.proof && mission.proof.builder === mission.proof.verifier) {
      context.addIssue({
        code: 'custom',
        path: ['proof', 'verifier'],
        message: 'The builder cannot verify their own artifact',
      })
    }
    if (mission.proof && mission.proof.missionRevision !== mission.updatedAtUtc) {
      context.addIssue({
        code: 'custom',
        path: ['proof', 'missionRevision'],
        message: 'Proof must name the exact mission revision it verified',
      })
    }
    if (
      mission.proof &&
      Date.parse(mission.proof.verifiedAtUtc) < Date.parse(mission.updatedAtUtc)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['proof', 'verifiedAtUtc'],
        message: 'Proof cannot predate the mission revision',
      })
    }
  })
export type Mission = z.infer<typeof MissionSchema>

export const MissionLogSchema = z.object({
  missions: z.array(MissionSchema).max(100),
  fetchedAtUtc: z.iso.datetime(),
  source: z.literal('github'),
})
export type MissionLog = z.infer<typeof MissionLogSchema>

const ExistingMissionTargetSchema = z.object({
  kind: z.literal('existing'),
  id: z.string().trim().min(1).max(80),
  revision: z.iso.datetime(),
})

const NewMissionTargetSchema = z.object({
  kind: z.literal('new'),
  title: z.string().trim().min(3).max(160),
})

export const MissionActionInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('fast_break'),
    mission: z.union([ExistingMissionTargetSchema, NewMissionTargetSchema]),
  }),
  z.object({
    action: z.literal('championship'),
    mission: ExistingMissionTargetSchema,
  }),
])
export type MissionActionInput = z.infer<typeof MissionActionInputSchema>

export const MissionActionResultSchema = z.object({
  outcome: z.enum(['queued', 'duplicate']),
  action: z.enum(['fast_break', 'championship']),
  mission: z.object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    status: MissionStatusSchema,
  }),
  receipt: z.object({
    id: z.string().trim().min(1),
    url: z.url(),
    receivedAtUtc: z.iso.datetime(),
  }),
})
export type MissionActionResult = z.infer<typeof MissionActionResultSchema>
