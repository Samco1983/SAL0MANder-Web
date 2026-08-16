import { describe, expect, it } from 'vitest'
import { readEnv } from '@config/env'
import { createMockTransport } from '@api/mockTransport'
import { selectStorage } from './index'

const transport = createMockTransport()

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
