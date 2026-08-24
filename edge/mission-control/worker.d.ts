export type MissionControlWorkerEnv = {
  MAKE_WEBHOOK_URL: string
  ALLOWED_ORIGINS: string
  OWNER_EMAILS: string
  ALLOW_SERVICE_TOKENS: string
  OPS_KV: {
    get(key: string, options?: { type?: string }): Promise<unknown>
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  }
}

export function handleRequest(request: Request, env: MissionControlWorkerEnv): Promise<Response>
export function normalizeAction(payload: unknown): unknown
export function championshipReady(mission: unknown): boolean

declare const worker: { fetch: typeof handleRequest }
export default worker

