export type MissionControlWorkerEnv = {
  MAKE_WEBHOOK_URL: string
  ALLOWED_ORIGINS: string
  OWNER_EMAILS: string
  ALLOW_SERVICE_TOKENS: string
  TEAM_DOMAIN: string
  POLICY_AUD: string
  MISSION_GATE: {
    idFromName(name: string): unknown
    get(id: unknown): { fetch(request: Request): Promise<Response> }
  }
}

export function handleRequest(
  request: Request,
  env: MissionControlWorkerEnv,
  dependencies?: {
    verifyAccessToken?: (
      token: string,
      env: MissionControlWorkerEnv,
    ) => Promise<Record<string, unknown>>
  },
): Promise<Response>
export class MissionGate {
  constructor(state: unknown, env: MissionControlWorkerEnv)
  fetch(request: Request): Promise<Response>
}
export function normalizeAction(payload: unknown): unknown
export function championshipReady(mission: unknown): boolean

declare const worker: { fetch: typeof handleRequest }
export default worker
