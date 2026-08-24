import { describe, expect, it } from 'vitest'
import { MissionSchema } from './missionControl'

const base = {
  id: 'mission-52',
  title: 'Student can finish the lesson',
  status: 'verified' as const,
  updatedAtUtc: '2026-08-23T19:30:00.000Z',
  issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/52',
}

describe('MissionSchema verification gate', () => {
  it('rejects VERIFIED without rerunnable proof', () => {
    expect(MissionSchema.safeParse(base).success).toBe(false)
  })

  it('rejects self-verification even when every proof field is populated', () => {
    const result = MissionSchema.safeParse({
      ...base,
      proof: {
        command: 'npm run verify:deployed',
        artifact: 'd7b9956',
        builder: 'Codex',
        verifier: 'Codex',
        missionRevision: base.updatedAtUtc,
        verifiedAtUtc: '2026-08-23T19:31:00.000Z',
      },
    })

    expect(result.success).toBe(false)
  })

  it('accepts proof checked by someone other than the builder', () => {
    const result = MissionSchema.safeParse({
      ...base,
      proof: {
        command: 'npm run verify:deployed',
        artifact: 'd7b9956',
        builder: 'Codex',
        verifier: 'Claude',
        missionRevision: base.updatedAtUtc,
        verifiedAtUtc: '2026-08-23T19:31:00.000Z',
      },
    })

    expect(result.success).toBe(true)
  })

  it('rejects proof for an older mission revision', () => {
    const result = MissionSchema.safeParse({
      ...base,
      proof: {
        command: 'npm run verify:deployed',
        artifact: 'd7b9956',
        builder: 'Codex',
        verifier: 'Claude',
        missionRevision: '2026-08-23T19:29:00.000Z',
        verifiedAtUtc: '2026-08-23T19:31:00.000Z',
      },
    })

    expect(result.success).toBe(false)
  })

  it('rejects proof recorded before the mission revision', () => {
    const result = MissionSchema.safeParse({
      ...base,
      proof: {
        command: 'npm run verify:deployed',
        artifact: 'd7b9956',
        builder: 'Codex',
        verifier: 'Claude',
        missionRevision: base.updatedAtUtc,
        verifiedAtUtc: '2026-08-23T19:29:00.000Z',
      },
    })

    expect(result.success).toBe(false)
  })
})
