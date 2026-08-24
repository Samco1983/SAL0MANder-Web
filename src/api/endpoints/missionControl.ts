import {
  MissionActionInputSchema,
  MissionActionResultSchema,
  MissionLogSchema,
  type MissionActionInput,
  type MissionActionResult,
  type MissionLog,
} from '@contracts/v1'
import type { Transport } from '../transport'

export function missionControlApi(transport: Transport) {
  return {
    list(signal?: AbortSignal): Promise<MissionLog> {
      return transport.request(
        { method: 'GET', path: '/ops/missions', ...(signal ? { signal } : {}) },
        MissionLogSchema,
      )
    },

    dispatch(input: MissionActionInput): Promise<MissionActionResult> {
      const payload = MissionActionInputSchema.parse(input)
      return transport.request(
        {
          method: 'POST',
          path: '/ops/actions',
          body: payload,
          idempotencyKey: missionActionKey(payload),
        },
        MissionActionResultSchema,
      )
    },
  }
}

export type MissionControlApi = ReturnType<typeof missionControlApi>

/**
 * A retry uses the same key, but a later possession can proceed after GitHub's
 * mission revision changes. Championship keys bind to that same verified
 * revision, so one artifact cannot be deployed twice by a lost response.
 */
export function missionActionKey(input: MissionActionInput): string {
  if (input.mission.kind === 'existing') {
    return `${input.action}:${input.mission.id}:${input.mission.revision}`
  }

  const minute = new Date().toISOString().slice(0, 16)
  return `${input.action}:new:${minute}:${hash(input.mission.title.trim().toLowerCase())}`
}

function hash(value: string): string {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193) >>> 0
  }
  return result.toString(16).padStart(8, '0')
}

