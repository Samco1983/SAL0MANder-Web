import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaDescriptorSchema } from '@contracts/v1'
import { MediaValidationError } from '../provider'
import { createMemoryStorage } from './memoryStorage'

/**
 * jsdom implements neither createObjectURL nor revokeObjectURL, so both are
 * defined and then spied — the revoke spy is what lets the leak test assert
 * that `remove` actually releases the blob.
 *
 * Only the statics are replaced, never `URL` itself: swapping the whole global
 * for a plain object removes the constructor that Zod's `z.url()` calls, and
 * the contract assertion below then fails for a reason that has nothing to do
 * with the descriptor.
 */
let created: string[]
let revoked: string[]

beforeEach(() => {
  created = []
  revoked = []
  let n = 0

  for (const method of ['createObjectURL', 'revokeObjectURL'] as const) {
    if (!(method in URL)) {
      Object.defineProperty(URL, method, { writable: true, configurable: true, value: () => '' })
    }
  }

  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const url = `blob:http://localhost/mock-${++n}`
    created.push(url)
    return url
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
    revoked.push(url)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function png(bytes = 1024): Blob {
  return { size: bytes, type: 'image/png' } as Blob
}

describe('memory storage', () => {
  it('returns a descriptor that satisfies the real contract', async () => {
    // The mock backend validates its payloads; this provider previously did
    // not, so nothing would have caught it drifting from MediaDescriptor.
    const descriptor = await createMemoryStorage().upload({ file: png(), kind: 'puzzle-image' })
    expect(MediaDescriptorSchema.safeParse(descriptor).success).toBe(true)
    expect(descriptor.kind).toBe('puzzle-image')
    expect(descriptor.byteSize).toBe(1024)
    expect(descriptor.contentType).toBe('image/png')
  })

  it('enforces the shared upload guard', async () => {
    await expect(
      createMemoryStorage().upload({ file: { size: 99e6, type: 'image/png' } as Blob, kind: 'avatar' }),
    ).rejects.toBeInstanceOf(MediaValidationError)
  })

  it('reports progress as complete, since nothing leaves the browser', async () => {
    const onProgress = vi.fn()
    await createMemoryStorage().upload({ file: png(512), kind: 'avatar', onProgress })
    expect(onProgress).toHaveBeenCalledWith({ loaded: 512, total: 512 })
  })

  it('mints a distinct id per upload', async () => {
    const storage = createMemoryStorage()
    const a = await storage.upload({ file: png(), kind: 'avatar' })
    const b = await storage.upload({ file: png(), kind: 'avatar' })
    expect(a.id).not.toBe(b.id)
  })

  it('releases the object URL on remove', async () => {
    const storage = createMemoryStorage()
    const descriptor = await storage.upload({ file: png(), kind: 'avatar' })
    await storage.remove(descriptor.id)
    expect(revoked).toEqual(created)
  })

  it('ignores removal of an unknown id instead of throwing', async () => {
    await expect(createMemoryStorage().remove('never-existed')).resolves.toBeUndefined()
    expect(revoked).toEqual([])
  })

  it('resolves a stored descriptor to its own url', async () => {
    const storage = createMemoryStorage()
    const descriptor = await storage.upload({ file: png(), kind: 'thumbnail' })
    expect(storage.resolveUrl(descriptor)).toBe(descriptor.url)
  })
})
