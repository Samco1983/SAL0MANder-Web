/**
 * Silence the background song baked into the Unity builds.
 *
 * The Unity games start their own looping song when a round begins, underneath
 * the site's playlist (GameMusicControl), and the site's Music button cannot
 * reach it. Samuel wants only the site playlist, so any looping Web Audio clip
 * longer than MIN_MUSIC_SECONDS is disconnected as it starts. Short sounds
 * (piece snaps, right/wrong) are untouched.
 *
 * Remove this once the Unity builds ship without their own music.
 */
export const MIN_MUSIC_SECONDS = 10

export type StartableSource = {
  loop: boolean
  buffer: { duration: number } | null
  disconnect: () => void
  start: (...args: unknown[]) => void
}

const GUARD_FLAG = '__sal0UnityMusicGuard'

export function isBuiltInMusic(source: Pick<StartableSource, 'loop' | 'buffer'>): boolean {
  return source.loop === true && (source.buffer?.duration ?? 0) > MIN_MUSIC_SECONDS
}

function defaultProto(): StartableSource | undefined {
  if (typeof AudioBufferSourceNode !== 'function') return undefined
  return AudioBufferSourceNode.prototype as unknown as StartableSource
}

/** Wrap start() once so Unity's built-in music is cut as soon as it begins. */
export function installUnityMusicGuard(proto: StartableSource | undefined = defaultProto()): boolean {
  if (!proto) return false
  const marked = proto as unknown as Record<string, unknown>
  if (marked[GUARD_FLAG]) return true
  const originalStart = proto.start
  proto.start = function guardedStart(this: StartableSource, ...args: unknown[]) {
    originalStart.apply(this, args)
    if (isBuiltInMusic(this)) {
      try {
        this.disconnect()
      } catch {
        // already disconnected
      }
    }
  }
  marked[GUARD_FLAG] = true
  return true
}
