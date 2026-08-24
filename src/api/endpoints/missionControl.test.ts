import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { RequestOptions, Transport } from '../transport'
import { missionActionKey, missionControlApi } from './missionControl'

afterEach(() => vi.useRealTimers())

function recorder(response: unknown) {
  const requests: RequestOptions[] = []
  const transport: Transport = {
    async request<T>(options: RequestOptions, schema: z.ZodType<T>) {
      requests.push(options)
      return schema.parse(response)
    },
  }
  return { requests, api: missionControlApi(transport) }
}

describe('missionControlApi', () => {
  it('reads the Mission Log from the protected ops boundary', async () => {
    const { api, requests } = recorder({
      missions: [],
      fetchedAtUtc: '2026-08-23T19:30:00.000Z',
      source: 'github',
    })

    await api.list()
    expect(requests).toEqual([{ method: 'GET', path: '/ops/missions' }])
  })

  it('binds Championship retries to the exact GitHub mission revision', async () => {
    const input = {
      action: 'championship' as const,
      mission: {
        kind: 'existing' as const,
        id: 'mission-52',
        revision: '2026-08-23T19:30:00.000Z',
      },
    }
    const { api, requests } = recorder({
      outcome: 'queued',
      action: 'championship',
      mission: { id: 'mission-52', title: 'Finish lesson', status: 'verified' },
      receipt: {
        id: 'receipt-1',
        url: 'https://github.com/Samco1983/SAL0MANder-Web/issues/52',
        receivedAtUtc: '2026-08-23T19:31:00.000Z',
      },
    })

    await api.dispatch(input)
    expect(requests[0]?.idempotencyKey).toBe(
      'championship:mission-52:2026-08-23T19:30:00.000Z',
    )
    expect(requests[0]?.body).toEqual(input)
  })

  it('collapses repeated new-mission clicks inside one minute', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T19:30:45.000Z'))
    const input = {
      action: 'fast_break' as const,
      mission: { kind: 'new' as const, title: '  Fix the public lesson  ' },
    }

    expect(missionActionKey(input)).toBe(missionActionKey(input))
    expect(missionActionKey(input)).toMatch(/^fast_break:new:2026-08-23T19:30:[0-9a-f]{8}$/)
  })
})

