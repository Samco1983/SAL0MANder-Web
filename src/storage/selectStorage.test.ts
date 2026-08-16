import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readEnv } from '@config/env'
import { createMockTransport } from '@api/mockTransport'
import { guardUploads, selectStorage, UploadsDisabledError } from './index'

const transport = createMockTransport()

const png = () => ({ size: 1024, type: 'image/png' }) as Blob

// Only the statics — replacing `URL` itself would remove the constructor that
// Zod's `z.url()` needs. jsdom implements neither, so they are defined first.
beforeEach(() => {
  let n = 0
  for (const method of ['createObjectURL', 'revokeObjectURL'] as const) {
    if (!(method in URL)) {
      Object.defineProperty(URL, method, { writable: true, configurable: true, value: () => '' })
    }
  }
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:http://localhost/mock-${++n}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('storage provider selection', () => {
  it('defaults to memory when nothing is configured', () => {
    expect(selectStorage(readEnv({}), transport).name).toBe('memory')
  })

  it('uses http when both the provider and an API are configured', () => {
    const env = readEnv({
      VITE_STORAGE_PROVIDER: 'http',
      VITE_API_BASE_URL: 'https://api.example.com',
    })
    expect(selectStorage(env, transport).name).toBe('http')
  })

  it('falls back to memory when http is asked for without an API', () => {
    // Deliberate — http storage cannot mint signed URLs without an API — but
    // it is silent, so a deploy that forgets VITE_API_BASE_URL writes uploads
    // to an in-memory map that dies with the tab.
    const env = readEnv({ VITE_STORAGE_PROVIDER: 'http' })
    expect(env.api.isConfigured).toBe(false)
    expect(selectStorage(env, transport).name).toBe('memory')
  })

  it('stays on memory when an API exists but the provider is memory', () => {
    const env = readEnv({ VITE_API_BASE_URL: 'https://api.example.com' })
    expect(selectStorage(env, transport).name).toBe('memory')
  })
})

describe('custom photo upload gate', () => {
  const storage = () => selectStorage(readEnv({}), transport)

  it('rejects uploads when the capability is off', async () => {
    await expect(
      guardUploads(storage(), false).upload({ file: png(), kind: 'puzzle-image' }),
    ).rejects.toBeInstanceOf(UploadsDisabledError)
  })

  it('allows uploads once the capability is switched on', async () => {
    const descriptor = await guardUploads(storage(), true).upload({
      file: png(),
      kind: 'puzzle-image',
    })
    expect(descriptor.byteSize).toBe(1024)
  })

  it('still serves and removes existing media while uploads are off', async () => {
    // Gating the upload path must not make already-stored media unreachable.
    const open = guardUploads(storage(), true)
    const descriptor = await open.upload({ file: png(), kind: 'puzzle-image' })

    const gated = guardUploads(storage(), false)
    expect(gated.resolveUrl(descriptor)).toBe(descriptor.url)
    await expect(gated.remove(descriptor.id)).resolves.toBeUndefined()
  })

  it('is wired to the real app default, which is off', () => {
    expect(readEnv({}).features.customMediaUpload).toBe(false)
  })
})
