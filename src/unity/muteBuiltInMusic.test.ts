import { describe, expect, it, vi } from 'vitest'
import { installUnityMusicGuard, isBuiltInMusic, type StartableSource } from './muteBuiltInMusic'

function makeProto(): StartableSource {
  return { loop: false, buffer: null, disconnect: vi.fn(), start: vi.fn() }
}

function makeSource(proto: StartableSource, loop: boolean, duration: number): StartableSource {
  const source = Object.create(proto) as StartableSource
  source.loop = loop
  source.buffer = { duration }
  source.disconnect = vi.fn()
  return source
}

describe('Unity built-in music guard', () => {
  it('treats only long looping clips as music', () => {
    expect(isBuiltInMusic({ loop: true, buffer: { duration: 22.9 } })).toBe(true)
    expect(isBuiltInMusic({ loop: false, buffer: { duration: 22.9 } })).toBe(false)
    expect(isBuiltInMusic({ loop: true, buffer: { duration: 0.4 } })).toBe(false)
    expect(isBuiltInMusic({ loop: true, buffer: null })).toBe(false)
  })

  it('cuts the Unity song but keeps short sound effects', () => {
    const proto = makeProto()
    const originalStart = proto.start
    expect(installUnityMusicGuard(proto)).toBe(true)

    const song = makeSource(proto, true, 22.9)
    const snap = makeSource(proto, true, 0.4)
    const oneShot = makeSource(proto, false, 22.9)
    song.start(0)
    snap.start(0)
    oneShot.start(0)

    expect(originalStart).toHaveBeenCalledTimes(3)
    expect(song.disconnect).toHaveBeenCalledTimes(1)
    expect(snap.disconnect).not.toHaveBeenCalled()
    expect(oneShot.disconnect).not.toHaveBeenCalled()
  })

  it('installs only once', () => {
    const proto = makeProto()
    installUnityMusicGuard(proto)
    const wrapped = proto.start
    installUnityMusicGuard(proto)
    expect(proto.start).toBe(wrapped)
  })
})
