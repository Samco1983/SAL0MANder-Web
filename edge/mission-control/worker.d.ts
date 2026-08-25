export type MissionControlWorkerEnv = {
  GITHUB_TOKEN: string
  GITHUB_REPOSITORY?: string
  ALLOWED_ORIGINS: string
  OWNER_EMAILS: string
  ALLOW_SERVICE_TOKENS: string
  TEAM_DOMAIN: string
  POLICY_AUD: string
  PUBLIC_SITE_URL?: string
  MISSION_GATE: {
    idFromName(name: string): unknown
    get(id: unknown): { fetch(request: Request): Promise<Response> }
  }
}

export type MissionRequestResult = {
  ok: boolean
  status: number
  error?: string
  body?: unknown
}

export type MissionRequest = (
  env: MissionControlWorkerEnv,
  body: unknown,
) => Promise<MissionRequestResult>

export function handleRequest(
  request: Request,
  env: MissionControlWorkerEnv,
  dependencies?: {
    verifyAccessToken?: (
      token: string,
      env: MissionControlWorkerEnv,
    ) => Promise<Record<string, unknown>>
    fetchPublicApp?: typeof fetch
    missionRequest?: MissionRequest
  },
): Promise<Response>
export class MissionGate {
  constructor(
    state: unknown,
    env: MissionControlWorkerEnv,
    dependencies?: { missionRequest?: MissionRequest },
  )
  fetch(request: Request): Promise<Response>
}
export function githubMissionRequest(
  env: MissionControlWorkerEnv,
  body: unknown,
  fetchGitHub?: typeof fetch,
): Promise<MissionRequestResult>
export function normalizeAction(payload: unknown): unknown
export function championshipReady(mission: unknown): boolean

declare const worker: { fetch: typeof handleRequest }
export default worker
