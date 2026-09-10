import { describe, expect, it } from 'vitest'
import { readMissionControlBootstrap } from './missionControlBootstrap'

function source(textContent: string | null) {
  return {
    getElementById: () => ({ textContent }),
  } as unknown as Pick<Document, 'getElementById'>
}

describe('mission control bootstrap', () => {
  it('accepts the protected server bootstrap', () => {
    const result = readMissionControlBootstrap(
      source(
        JSON.stringify({
          missionLog: {
            missions: [],
            fetchedAtUtc: '2026-08-23T19:32:00.000Z',
            source: 'github',
          },
          actionForm: {
            url: '/ops/actions/form',
            csrf: 'a'.repeat(48),
            idempotencyKey: 'b'.repeat(48),
          },
        }),
      ),
    )

    expect(result).toMatchObject({
      missionLog: { source: 'github', missions: [] },
      actionForm: { url: '/ops/actions/form' },
    })
  })

  it('rejects malformed or redirected form bootstraps', () => {
    expect(readMissionControlBootstrap(source('{not-json'))).toBeNull()
    expect(
      readMissionControlBootstrap(
        source(
          JSON.stringify({
            missionLog: {
              missions: [],
              fetchedAtUtc: '2026-08-23T19:32:00.000Z',
              source: 'github',
            },
            actionForm: {
              url: 'https://attacker.invalid/launch',
              csrf: 'a'.repeat(48),
              idempotencyKey: 'b'.repeat(48),
            },
          }),
        ),
      ),
    ).toBeNull()
  })
})
