import { z } from 'zod'
import { MissionLogSchema } from '@contracts/v1'

const MissionControlBootstrapSchema = z.object({
  missionLog: MissionLogSchema,
  actionForm: z.object({
    url: z.literal('/ops/actions/form'),
    csrf: z.string().regex(/^[a-f0-9]{48}$/),
    idempotencyKey: z.string().regex(/^[a-f0-9]{48}$/),
  }),
})

export type MissionControlBootstrap = z.infer<typeof MissionControlBootstrapSchema>

export function readMissionControlBootstrap(
  source: Pick<Document, 'getElementById'> | undefined = typeof document === 'undefined'
    ? undefined
    : document,
): MissionControlBootstrap | null {
  const raw = source?.getElementById('sal0-mission-control-bootstrap')?.textContent
  if (!raw) return null

  try {
    const result = MissionControlBootstrapSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}
