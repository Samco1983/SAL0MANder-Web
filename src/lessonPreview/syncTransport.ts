/**
 * Multi-tab & multi-device real-time sync transport for the private Jigsaw lesson preview.
 *
 * STRICT PRIVACY ISOLATION (Sections 3.21, 3.22, 3.22A):
 *   - Shared board state travels on the shared channel/path (`shared`).
 *   - Private learner answers & scratch work travel ONLY on seat-isolated
 *     channels/paths (`private/<seatId>`).
 *   - A learner tab ONLY subscribes to `shared` and publishes to its OWN
 *     `private/<mySeatId>` channel — it NEVER subscribes to any peer's private channel.
 *   - Only Mr. Sam (role === 'host') subscribes to all 3 private channels.
 *
 * TWO TRANSPORTS:
 *   1. `LocalMultiTabTransport` (default, zero-config): real-time BroadcastChannel +
 *      localStorage fallback across browser tabs on the same device, with instant
 *      `pagehide` / `beforeunload` disconnect beacons and presence heartbeats.
 *   2. `FirebaseRealtimeTransport` (multi-device opt-in): connects separate physical
 *      devices via Firebase Realtime Database REST + EventSource SSE when configured
 *      via `VITE_JIGSAW_PREVIEW_FIREBASE_URL` or `?fb=https://<project>.firebaseio.com`.
 *      No credentials are stored in the repo.
 */

import { SEAT_ORDER } from './lessonEngine'
import type {
  LearnerBoardCommand,
  ParticipantRole,
  PrivateLearnerWork,
  SeatId,
  SharedBoardState,
} from './types'

export type TransportMode = 'local-multitab' | 'firebase-rtdb'

export type SharedWirePayload =
  | { readonly kind: 'state_sync'; readonly state: SharedBoardState }
  | { readonly kind: 'request_sync' }
  | { readonly kind: 'learner_command'; readonly command: LearnerBoardCommand }
  | { readonly kind: 'seat_presence'; readonly seatId: SeatId; readonly connected: boolean; readonly atMs: number }

export type SharedWireMessage = SharedWirePayload & { readonly senderId: string }

export interface PrivateWireMessage {
  readonly kind: 'private_work'
  readonly work: PrivateLearnerWork
  readonly senderId: string
}

export interface SyncTransportCallbacks {
  readonly onSharedMessage: (msg: SharedWireMessage) => void
  readonly onPrivateWork?: (work: PrivateLearnerWork) => void
}

export interface LessonSyncTransport {
  readonly mode: TransportMode
  readonly roomId: string
  readonly endpointLabel: string
  publishShared(msg: SharedWirePayload): void
  publishSharedState(state: SharedBoardState): void
  publishPrivateWork(work: PrivateLearnerWork): void
  sendDisconnectBeacon(seatId: SeatId): void
  close(): void
}

const SHARED_CHANNEL_PREFIX = 'sal0mander.jigsaw.preview.shared.v1:'
const PRIVATE_CHANNEL_PREFIX = 'sal0mander.jigsaw.preview.private.v1:'

/**
 * Validates an opt-in Firebase Realtime Database URL (strictly HTTPS *.firebaseio.com
 * or *.firebasedatabase.app with no embedded credentials).
 */
export function parseFirebasePreviewUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    const host = url.hostname.toLowerCase()
    const allowed =
      host.endsWith('.firebaseio.com') || host.endsWith('.firebasedatabase.app')
    if (!allowed) return null
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

export function resolveFirebasePreviewUrl(search = ''): string | null {
  const params = new URLSearchParams(search)
  const fromQuery = parseFirebasePreviewUrl(params.get('fb'))
  if (fromQuery) return fromQuery
  const fromEnv = parseFirebasePreviewUrl(
    (import.meta.env?.VITE_JIGSAW_PREVIEW_FIREBASE_URL as string | undefined) ?? '',
  )
  return fromEnv
}

function makeSenderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 12)
  }
  return `tab-${Math.random().toString(36).slice(2, 10)}`
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Default zero-config multi-tab real-time transport using BroadcastChannel + localStorage.
 * Every private seat uses its OWN isolated channel so learner tabs never see peer answers.
 */
export class LocalMultiTabTransport implements LessonSyncTransport {
  readonly mode: TransportMode = 'local-multitab'
  readonly roomId: string
  readonly endpointLabel = 'Multi-tab live sync (this browser)'

  private readonly senderId = makeSenderId()
  private readonly sharedChannelName: string
  private readonly sharedStorageKey: string
  private readonly sharedBc: BroadcastChannel | null
  private readonly privateChannels = new Map<SeatId, BroadcastChannel>()
  private readonly callbacks: SyncTransportCallbacks
  private readonly role: ParticipantRole
  private readonly storageHandler: (ev: StorageEvent) => void

  constructor(
    roomId: string,
    role: ParticipantRole,
    mySeatId: SeatId | null,
    callbacks: SyncTransportCallbacks,
  ) {
    this.roomId = roomId
    this.role = role
    this.callbacks = callbacks
    this.sharedChannelName = `${SHARED_CHANNEL_PREFIX}${roomId}`
    this.sharedStorageKey = `${SHARED_CHANNEL_PREFIX}${roomId}:state`

    const hasBc = typeof BroadcastChannel !== 'undefined'
    this.sharedBc = hasBc ? new BroadcastChannel(this.sharedChannelName) : null
    if (this.sharedBc) {
      this.sharedBc.onmessage = (ev: MessageEvent<SharedWireMessage>) => {
        const msg = ev.data
        if (!msg || msg.senderId === this.senderId) return
        this.callbacks.onSharedMessage(msg)
      }
    }

    // Privacy boundary:
    // - Teacher host opens all 3 per-seat private channels to read incoming student work.
    // - A learner tab ONLY opens its OWN seat's private channel to publish to Mr. Sam.
    const seatsToBind: readonly SeatId[] =
      role === 'host' ? SEAT_ORDER : mySeatId ? [mySeatId] : []

    if (hasBc) {
      for (const seatId of seatsToBind) {
        const bc = new BroadcastChannel(`${PRIVATE_CHANNEL_PREFIX}${roomId}:${seatId}`)
        if (role === 'host') {
          bc.onmessage = (ev: MessageEvent<PrivateWireMessage>) => {
            const msg = ev.data
            if (!msg || msg.senderId === this.senderId || msg.kind !== 'private_work') return
            this.callbacks.onPrivateWork?.(msg.work)
          }
        }
        this.privateChannels.set(seatId, bc)
      }
    }

    this.storageHandler = (ev: StorageEvent) => {
      if (!ev.key || !ev.newValue) return
      if (ev.key === this.sharedStorageKey) {
        const state = safeJsonParse<SharedBoardState>(ev.newValue)
        if (state && state.roomId === this.roomId) {
          this.callbacks.onSharedMessage({
            kind: 'state_sync',
            state,
            senderId: 'storage-fallback',
          })
        }
        return
      }
      if (this.role === 'host' && ev.key.startsWith(`${PRIVATE_CHANNEL_PREFIX}${this.roomId}:`)) {
        const work = safeJsonParse<PrivateLearnerWork>(ev.newValue)
        if (work) this.callbacks.onPrivateWork?.(work)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.storageHandler)
    }
  }

  loadCachedSharedState(): SharedBoardState | null {
    try {
      return safeJsonParse<SharedBoardState>(localStorage.getItem(this.sharedStorageKey))
    } catch {
      return null
    }
  }

  loadCachedPrivateWorkForHost(): Partial<Record<SeatId, PrivateLearnerWork>> {
    if (this.role !== 'host') return {}
    const out: Partial<Record<SeatId, PrivateLearnerWork>> = {}
    for (const seatId of SEAT_ORDER) {
      try {
        const parsed = safeJsonParse<PrivateLearnerWork>(
          localStorage.getItem(`${PRIVATE_CHANNEL_PREFIX}${this.roomId}:${seatId}`),
        )
        if (parsed) out[seatId] = parsed
      } catch {
        // Ignore storage unavailable errors
      }
    }
    return out
  }

  publishShared(msg: SharedWirePayload): void {
    const wire: SharedWireMessage = { ...msg, senderId: this.senderId }
    if (wire.kind === 'state_sync') {
      try {
        localStorage.setItem(this.sharedStorageKey, JSON.stringify(wire.state))
      } catch {
        // Ignore quota/private-mode storage errors
      }
    }
    this.sharedBc?.postMessage(wire)
  }

  publishSharedState(state: SharedBoardState): void {
    this.publishShared({ kind: 'state_sync', state })
  }

  publishPrivateWork(work: PrivateLearnerWork): void {
    const key = `${PRIVATE_CHANNEL_PREFIX}${this.roomId}:${work.seatId}`
    try {
      localStorage.setItem(key, JSON.stringify(work))
    } catch {
      // Ignore storage unavailable
    }
    const ch = this.privateChannels.get(work.seatId)
    const msg: PrivateWireMessage = { kind: 'private_work', work, senderId: this.senderId }
    ch?.postMessage(msg)
  }

  sendDisconnectBeacon(seatId: SeatId): void {
    this.publishShared({
      kind: 'seat_presence',
      seatId,
      connected: false,
      atMs: Date.now(),
    })
  }

  close(): void {
    this.sharedBc?.close()
    for (const bc of this.privateChannels.values()) bc.close()
    this.privateChannels.clear()
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageHandler)
    }
  }
}

/**
 * Multi-device Firebase Realtime Database REST + polling/SSE transport.
 * Uses strictly separate RTDB trees:
 *   - `/jigsaw_preview/<roomId>/shared.json` (SharedBoardState only)
 *   - `/jigsaw_preview/<roomId>/commands.json` (ephemeral active-turn command dropbox)
 *   - `/jigsaw_preview/<roomId>/presence/<seatId>.json` (heartbeat timestamp + connected flag)
 *   - `/jigsaw_preview/<roomId>/private/<seatId>.json` (strictly private learner answers -> Host only)
 */
export class FirebaseRealtimeTransport implements LessonSyncTransport {
  readonly mode: TransportMode = 'firebase-rtdb'
  readonly roomId: string
  readonly endpointLabel: string

  private readonly senderId = makeSenderId()
  private readonly baseUrl: string
  private readonly role: ParticipantRole
  private readonly callbacks: SyncTransportCallbacks
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private lastStateRevision = 0
  private lastCommandKey = ''
  private lastPrivateAt: Partial<Record<SeatId, number>> = {}

  constructor(
    baseUrl: string,
    roomId: string,
    role: ParticipantRole,
    callbacks: SyncTransportCallbacks,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.roomId = roomId
    this.role = role
    this.callbacks = callbacks
    this.endpointLabel = `Firebase Realtime sync (${new URL(this.baseUrl).hostname})`
    this.startPolling()
  }

  private roomUrl(subpath: string): string {
    return `${this.baseUrl}/jigsaw_preview/${encodeURIComponent(this.roomId)}/${subpath}.json`
  }

  private startPolling(): void {
    const tick = async () => {
      try {
        const res = await fetch(this.roomUrl('shared'), { cache: 'no-store' })
        if (res.ok) {
          const state = (await res.json()) as SharedBoardState | null
          if (state && state.turnRevision > this.lastStateRevision) {
            this.lastStateRevision = state.turnRevision
            this.callbacks.onSharedMessage({
              kind: 'state_sync',
              state,
              senderId: 'firebase-rtdb',
            })
          }
        }
        if (this.role === 'host') {
          const [cmdRes, presRes, privRes] = await Promise.all([
            fetch(this.roomUrl('lastCommand'), { cache: 'no-store' }),
            fetch(this.roomUrl('presence'), { cache: 'no-store' }),
            fetch(this.roomUrl('private'), { cache: 'no-store' }),
          ])
          if (cmdRes.ok) {
            const cmdPayload = (await cmdRes.json()) as
              | { id: string; command: LearnerBoardCommand; senderId: string }
              | null
            if (cmdPayload && cmdPayload.id && cmdPayload.id !== this.lastCommandKey) {
              this.lastCommandKey = cmdPayload.id
              this.callbacks.onSharedMessage({
                kind: 'learner_command',
                command: cmdPayload.command,
                senderId: cmdPayload.senderId,
              })
            }
          }
          if (presRes.ok) {
            const presMap = (await presRes.json()) as
              | Partial<Record<SeatId, { connected: boolean; atMs: number; senderId: string }>>
              | null
            if (presMap) {
              for (const seatId of SEAT_ORDER) {
                const entry = presMap[seatId]
                if (entry) {
                  this.callbacks.onSharedMessage({
                    kind: 'seat_presence',
                    seatId,
                    connected: Boolean(entry.connected),
                    atMs: Number(entry.atMs) || Date.now(),
                    senderId: entry.senderId || 'firebase-rtdb',
                  })
                }
              }
            }
          }
          if (privRes.ok) {
            const privMap = (await privRes.json()) as Partial<Record<SeatId, PrivateLearnerWork>> | null
            if (privMap) {
              for (const seatId of SEAT_ORDER) {
                const entry = privMap[seatId]
                if (entry && entry.submittedAtMs !== this.lastPrivateAt[seatId]) {
                  this.lastPrivateAt[seatId] = entry.submittedAtMs
                  this.callbacks.onPrivateWork?.(entry)
                }
              }
            }
          }
        }
      } catch {
        // Resilient to transient network hiccups
      }
    }

    void tick()
    this.pollTimer = setInterval(() => {
      void tick()
    }, 900)
  }

  publishShared(msg: SharedWirePayload): void {
    if (msg.kind === 'state_sync') {
      this.publishSharedState(msg.state)
      return
    }
    if (msg.kind === 'learner_command') {
      const payload = {
        id: `${Date.now()}-${this.senderId}`,
        command: msg.command,
        senderId: this.senderId,
      }
      void fetch(this.roomUrl('lastCommand'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {})
      return
    }
    if (msg.kind === 'seat_presence') {
      void fetch(this.roomUrl(`presence/${msg.seatId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connected: msg.connected,
          atMs: msg.atMs,
          senderId: this.senderId,
        }),
      }).catch(() => {})
    }
  }

  publishSharedState(state: SharedBoardState): void {
    this.lastStateRevision = Math.max(this.lastStateRevision, state.turnRevision)
    void fetch(this.roomUrl('shared'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    }).catch(() => {})
  }

  publishPrivateWork(work: PrivateLearnerWork): void {
    // Strictly writes ONLY to this learner's own private seat leaf (never to `shared`).
    void fetch(this.roomUrl(`private/${work.seatId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(work),
    }).catch(() => {})
  }

  sendDisconnectBeacon(seatId: SeatId): void {
    const url = this.roomUrl(`presence/${seatId}`)
    const payload = JSON.stringify({
      connected: false,
      atMs: Date.now(),
      senderId: this.senderId,
    })
    void fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }

  close(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}

export function createLessonSyncTransport(options: {
  roomId: string
  role: ParticipantRole
  mySeatId: SeatId | null
  firebaseUrl: string | null
  callbacks: SyncTransportCallbacks
}): LessonSyncTransport {
  if (options.firebaseUrl) {
    return new FirebaseRealtimeTransport(
      options.firebaseUrl,
      options.roomId,
      options.role,
      options.callbacks,
    )
  }
  return new LocalMultiTabTransport(
    options.roomId,
    options.role,
    options.mySeatId,
    options.callbacks,
  )
}
