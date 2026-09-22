import type { SoundDefinition } from '@content/soundLibrary'

export const GIFT_SOUND_KEY = 'sal0-gift-sound'
export const GIFT_VIBRATION_KEY = 'sal0-gift-vibration'
export const GIFT_TEXT_KEY = 'sal0-gift-text'
export const GIFT_TEXT_SIZES = ['smallest', 'smaller', 'compact', 'normal', 'large'] as const
export type GiftTextSize = (typeof GIFT_TEXT_SIZES)[number]

export function readGiftTextSize(value: unknown): GiftTextSize {
  return GIFT_TEXT_SIZES.includes(value as GiftTextSize) ? (value as GiftTextSize) : 'normal'
}

type Options = {
  createContext: () => AudioContext | null
  fetchAudio: typeof fetch
  origin: string
  basePath: string
  vibrate?: (pattern: VibratePattern) => boolean
}
type Playing = { source: AudioBufferSourceNode; gain: GainNode; finish: (ok: boolean) => void }
const MAX_SOUND_BYTES = 12_000_000

async function readAudio(
  response: Response,
  controller: AbortController,
): Promise<ArrayBuffer | null> {
  const declared = response.headers.get('Content-Length')
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > MAX_SOUND_BYTES) {
    controller.abort()
    void response.body?.cancel().catch(() => undefined)
    return null
  }
  const reader = response.body?.getReader()
  if (!reader) return null
  const cancel = () => {
    void reader.cancel().catch(() => undefined)
  }
  controller.signal.addEventListener('abort', cancel, { once: true })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (!controller.signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_SOUND_BYTES) {
        controller.abort()
        return null
      }
      chunks.push(value)
    }
    if (controller.signal.aborted || size === 0) return null
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes.buffer
  } finally {
    controller.signal.removeEventListener('abort', cancel)
    cancel()
  }
}

export function defaultFeedbackOptions(): Options {
  const Constructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return {
    createContext: () => (Constructor ? new Constructor() : null),
    fetchAudio: (...args) => fetch(...args),
    origin: window.location.origin,
    basePath: import.meta.env.BASE_URL,
    vibrate:
      typeof navigator.vibrate === 'function' ? navigator.vibrate.bind(navigator) : undefined,
  }
}

/** Owns only web gift effects. No context, fetch, sound or vibration is started by construction. */
export class GiftFeedback {
  private context: AudioContext | null = null
  private resumed: Promise<unknown> = Promise.resolve()
  private generation = 0
  private disposed = false
  private sound = true
  private vibration = true
  private pending = new Set<AbortController>()
  private playing = new Set<Playing>()
  private buffers = new Map<string, AudioBuffer>()
  private options: Options

  constructor(options: Options = defaultFeedbackOptions()) {
    this.options = options
  }

  /** Call synchronously from a user gesture; completion events never create a context. */
  unlock() {
    if (this.disposed || !this.sound) return
    try {
      this.context ??= this.options.createContext()
      this.resumed = this.context?.resume().catch(() => undefined) ?? Promise.resolve()
    } catch {
      this.resumed = Promise.resolve()
    }
  }

  setSound(on: boolean) {
    this.sound = on
    if (!on) this.stopAudio()
  }

  setVibration(on: boolean) {
    this.vibration = on
    if (!on) this.cancelVibration()
  }

  pulse(pattern: VibratePattern) {
    if (this.disposed || !this.vibration) return
    try {
      this.options.vibrate?.(pattern)
    } catch {
      /* Unsupported hardware must not interrupt play. */
    }
  }

  private cancelVibration() {
    try {
      this.options.vibrate?.(0)
    } catch {
      /* Best effort device cancellation. */
    }
  }

  async play(sound: SoundDefinition | undefined): Promise<boolean> {
    const context = this.context
    if (!sound || !context || !this.sound || this.disposed) return false
    const generation = this.generation
    const current = () => !this.disposed && this.sound && generation === this.generation
    const controller = new AbortController()
    this.pending.add(controller)
    try {
      await this.resumed
      if (!current() || context.state !== 'running') return false
      const prefix = this.options.basePath.replace(/\/$/, '')
      const path = sound.src.startsWith('/') ? `${prefix}${sound.src}` : sound.src
      const url = new URL(path, this.options.origin + '/')
      if (
        url.origin !== this.options.origin ||
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return false
      let buffer = this.buffers.get(url.href)
      if (!buffer) {
        const response = await this.options.fetchAudio(url.href, {
          signal: controller.signal,
          credentials: 'same-origin',
          redirect: 'error',
        })
        if (!response.ok || response.redirected || !current()) {
          controller.abort()
          void response.body?.cancel().catch(() => undefined)
          return false
        }
        const bytes = await readAudio(response, controller)
        if (!bytes || !current()) return false
        buffer = await context.decodeAudioData(bytes)
        if (!current()) return false
        if (this.buffers.size >= 8) this.buffers.delete(this.buffers.keys().next().value!)
        this.buffers.set(url.href, buffer)
      }
      const duration = Math.min(buffer.duration, sound.previewSeconds ?? sound.durationSeconds, 12)
      if (!current() || !Number.isFinite(duration) || duration <= 0) return false
      return await new Promise<boolean>((resolve) => {
        const source = context.createBufferSource()
        const gain = context.createGain()
        let ended = false
        const item: Playing = {
          source,
          gain,
          finish: (ok) => {
            if (ended) return
            ended = true
            source.onended = null
            try {
              source.disconnect()
              gain.disconnect()
            } catch {
              /* Already disconnected. */
            }
            this.playing.delete(item)
            resolve(ok)
          },
        }
        this.playing.add(item)
        try {
          source.buffer = buffer!
          source.connect(gain)
          gain.connect(context.destination)
          const now = context.currentTime
          gain.gain.setValueAtTime(0, now)
          gain.gain.linearRampToValueAtTime(0.55, now + Math.min(0.018, duration / 4))
          gain.gain.setValueAtTime(0.55, now + Math.max(duration - 0.065, duration / 2))
          gain.gain.linearRampToValueAtTime(0, now + duration)
          source.onended = () => item.finish(current())
          source.start(now)
          source.stop(now + duration)
        } catch {
          item.finish(false)
        }
      })
    } catch {
      return false
    } finally {
      this.pending.delete(controller)
    }
  }

  private stopAudio() {
    this.generation++
    for (const pending of this.pending) pending.abort()
    this.pending.clear()
    for (const item of this.playing) {
      try {
        const now = this.context?.currentTime ?? 0
        item.gain.gain.cancelScheduledValues(now)
        item.gain.gain.setValueAtTime(item.gain.gain.value, now)
        item.gain.gain.linearRampToValueAtTime(0, now + 0.035)
        item.source.stop(now + 0.04)
      } catch {
        item.finish(false)
      }
    }
  }

  stop() {
    this.stopAudio()
    this.cancelVibration()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    for (const item of this.playing) item.finish(false)
    this.buffers.clear()
    try {
      void this.context?.close().catch(() => undefined)
    } catch {
      /* Already closed. */
    }
    this.context = null
  }
}
