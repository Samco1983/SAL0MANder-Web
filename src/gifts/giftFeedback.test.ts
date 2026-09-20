import { expect, it, vi } from 'vitest'
import { GiftFeedback } from './giftFeedback'
import type { SoundDefinition } from '@content/soundLibrary'

const sound = {
  key: 'test',
  name: 'Test cue',
  category: 'UI',
  src: '/audio/test.wav',
  durationSeconds: 0.8,
} as SoundDefinition
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function setup() {
  const sources: {
    buffer: unknown
    onended: (() => void) | null
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }[] = []
  const gains: {
    gain: {
      value: number
      setValueAtTime: ReturnType<typeof vi.fn>
      linearRampToValueAtTime: ReturnType<typeof vi.fn>
      cancelScheduledValues: ReturnType<typeof vi.fn>
    }
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }[] = []
  const context = {
    state: 'running',
    currentTime: 2,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 1 }),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as unknown,
        onended: null as (() => void) | null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      sources.push(source)
      return source
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          value: 0.55,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      gains.push(gain)
      return gain
    }),
  }
  const response = {
    ok: true,
    redirected: false,
    headers: new Headers(),
    get body() {
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(16))
          controller.close()
        },
      })
    },
  }
  const fetchAudio = vi.fn().mockResolvedValue(response)
  const createContext = vi.fn(() => context as unknown as AudioContext)
  const vibrate = vi.fn().mockReturnValue(true)
  const engine = new GiftFeedback({
    createContext,
    fetchAudio,
    origin: 'https://game.example',
    basePath: '/school/',
    vibrate,
  })
  return { engine, context, createContext, fetchAudio, response, vibrate, sources, gains }
}

it('starts no context, fetch, sound or haptics without a user gesture', async () => {
  const s = setup()
  expect(await s.engine.play(sound)).toBe(false)
  expect(s.createContext).not.toHaveBeenCalled()
  expect(s.fetchAudio).not.toHaveBeenCalled()
  expect(s.vibrate).not.toHaveBeenCalled()
  s.engine.unlock()
  expect(s.createContext).toHaveBeenCalledTimes(1)
  expect(s.context.resume).toHaveBeenCalledTimes(1)
  expect(s.fetchAudio).not.toHaveBeenCalled()
  s.engine.dispose()
})

it('plays only same-origin assets after unlock with bounded duration and gain fades', async () => {
  const s = setup()
  s.engine.unlock()
  const done = s.engine.play(sound)
  await vi.waitFor(() => expect(s.sources).toHaveLength(1))
  expect(s.fetchAudio).toHaveBeenCalledWith(
    'https://game.example/school/audio/test.wav',
    expect.objectContaining({
      signal: expect.any(AbortSignal),
      credentials: 'same-origin',
      redirect: 'error',
    }),
  )
  expect(s.sources[0]!.start).toHaveBeenCalledWith(2)
  expect(s.sources[0]!.stop).toHaveBeenCalledWith(2.8)
  expect(s.gains[0]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 2.8)
  s.sources[0]!.onended?.()
  expect(await done).toBe(true)
  expect(s.sources[0]!.disconnect).toHaveBeenCalled()
  expect(await s.engine.play({ ...sound, src: 'https://elsewhere.example/audio.wav' })).toBe(false)
  expect(s.fetchAudio).toHaveBeenCalledTimes(1)
  s.engine.dispose()
})

it('aborts fetch on mute and prevents its late result from starting sound after unmute', async () => {
  const s = setup()
  const pending = deferred<typeof s.response>()
  s.fetchAudio.mockReturnValueOnce(pending.promise)
  s.engine.unlock()
  const done = s.engine.play(sound)
  await vi.waitFor(() => expect(s.fetchAudio).toHaveBeenCalledTimes(1))
  const signal = s.fetchAudio.mock.calls[0]![1].signal as AbortSignal
  s.engine.setSound(false)
  s.engine.setSound(true)
  pending.resolve(s.response)
  expect(await done).toBe(false)
  expect(signal.aborted).toBe(true)
  expect(s.sources).toHaveLength(0)
  s.engine.dispose()
})

it('cancels a late decoder result on replay, then permits a fresh cue', async () => {
  const s = setup()
  const pending = deferred<{ duration: number }>()
  s.context.decodeAudioData.mockReturnValueOnce(pending.promise)
  s.engine.unlock()
  const old = s.engine.play(sound)
  await vi.waitFor(() => expect(s.context.decodeAudioData).toHaveBeenCalledTimes(1))
  s.engine.stop()
  pending.resolve({ duration: 1 })
  expect(await old).toBe(false)
  expect(s.sources).toHaveLength(0)
  const fresh = s.engine.play(sound)
  await vi.waitFor(() => expect(s.sources).toHaveLength(1))
  s.sources[0]!.onended?.()
  expect(await fresh).toBe(true)
  s.engine.dispose()
})

it('fades and stops active sound on mute, and stops haptics independently', async () => {
  const s = setup()
  s.engine.unlock()
  const done = s.engine.play(sound)
  await vi.waitFor(() => expect(s.sources).toHaveLength(1))
  s.engine.pulse([25, 55, 30])
  expect(s.vibrate).toHaveBeenLastCalledWith([25, 55, 30])
  s.engine.setVibration(false)
  s.engine.pulse(90)
  expect(s.vibrate).toHaveBeenLastCalledWith(0)
  s.engine.setSound(false)
  expect(s.sources[0]!.stop).toHaveBeenLastCalledWith(2.04)
  expect(s.gains[0]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 2.035)
  s.sources[0]!.onended?.()
  expect(await done).toBe(false)
  s.engine.dispose()
})

it('contains load failures and oversized responses without preventing another cue', async () => {
  const s = setup()
  s.engine.unlock()
  s.fetchAudio.mockRejectedValueOnce(new Error('Offline'))
  expect(await s.engine.play(sound)).toBe(false)
  s.fetchAudio.mockResolvedValueOnce({
    ...s.response,
    headers: new Headers({ 'Content-Length': '12000001' }),
  })
  expect(await s.engine.play(sound)).toBe(false)
  expect(s.context.decodeAudioData).not.toHaveBeenCalled()
  const next = s.engine.play(sound)
  await vi.waitFor(() => expect(s.sources).toHaveLength(1))
  s.sources[0]!.onended?.()
  expect(await next).toBe(true)
  s.engine.dispose()
})

it('rejects redirects without decoding or playing their body', async () => {
  const s = setup()
  const cancel = vi.fn()
  s.fetchAudio.mockResolvedValueOnce({
    ...s.response,
    redirected: true,
    body: new ReadableStream({ cancel }),
  })
  s.engine.unlock()
  expect(await s.engine.play(sound)).toBe(false)
  expect(s.fetchAudio.mock.calls[0]![1].redirect).toBe('error')
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(s.context.decodeAudioData).not.toHaveBeenCalled()
  expect(s.sources).toHaveLength(0)
  s.engine.dispose()
})

it.each([undefined, '1'])(
  'caps a stream with Content-Length %s before reading the remaining body',
  async (length) => {
    const s = setup()
    const cancel = vi.fn()
    const chunks = [
      new Uint8Array(6_000_000),
      new Uint8Array(6_000_000),
      new Uint8Array(1),
      new Uint8Array(99),
    ]
    let pulls = 0
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          controller.enqueue(chunks[pulls++]!)
          if (pulls === chunks.length) controller.close()
        },
        cancel,
      },
      { highWaterMark: 0 },
    )
    s.fetchAudio.mockResolvedValueOnce({
      ...s.response,
      body,
      headers: new Headers(length ? { 'Content-Length': length } : {}),
    })
    s.engine.unlock()
    expect(await s.engine.play(sound)).toBe(false)
    expect(pulls).toBe(3)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(s.fetchAudio.mock.calls[0]![1].signal.aborted).toBe(true)
    expect(s.context.decodeAudioData).not.toHaveBeenCalled()
    s.engine.dispose()
  },
)

it('cancels a declared oversized body before pulling any audio bytes', async () => {
  const s = setup()
  const pull = vi.fn(),
    cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 })
  s.fetchAudio.mockResolvedValueOnce({
    ...s.response,
    body,
    headers: new Headers({ 'Content-Length': '12000001' }),
  })
  s.engine.unlock()
  expect(await s.engine.play(sound)).toBe(false)
  expect(pull).not.toHaveBeenCalled()
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(s.context.decodeAudioData).not.toHaveBeenCalled()
  s.engine.dispose()
})

it('settles a pending streamed read when muted and never decodes it after unmute', async () => {
  const s = setup()
  const pull = vi.fn(),
    cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 })
  s.fetchAudio.mockResolvedValueOnce({ ...s.response, body })
  s.engine.unlock()
  const done = s.engine.play(sound)
  await vi.waitFor(() => expect(pull).toHaveBeenCalledTimes(1))
  s.engine.setSound(false)
  s.engine.setSound(true)
  expect(await done).toBe(false)
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(s.context.decodeAudioData).not.toHaveBeenCalled()
  expect(s.sources).toHaveLength(0)
  s.engine.dispose()
})

it('closes and settles active playback on disposal; late calls cannot reactivate it', async () => {
  const s = setup()
  s.engine.unlock()
  const done = s.engine.play(sound)
  await vi.waitFor(() => expect(s.sources).toHaveLength(1))
  s.engine.dispose()
  expect(await done).toBe(false)
  expect(s.context.close).toHaveBeenCalledTimes(1)
  expect(s.vibrate).toHaveBeenLastCalledWith(0)
  s.engine.unlock()
  expect(await s.engine.play(sound)).toBe(false)
  expect(s.createContext).toHaveBeenCalledTimes(1)
})
