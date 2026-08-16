import { describe, expect, it } from 'vitest'
import { PlayBundleSchema, ShareCodeSchema, isStudentChoice } from '@contracts/v1'
import { createMockTransport, MOCK_SHARE_CODE, MOCK_SHARE_CODES } from '@api/mockTransport'
import { playApi } from '@api/endpoints/play'
import { toGuestActivityBundle } from './playBundleAdapter'
import { GuestActivityBundleSchema } from '@contracts/v1'

const play = () => playApi(createMockTransport())

describe('share codes are not activity ids', () => {
  it('accepts a code in the unambiguous alphabet', () => {
    expect(ShareCodeSchema.safeParse(MOCK_SHARE_CODE).success).toBe(true)
  })

  it('rejects look-alike glyphs a student would mistype', () => {
    // I/L/O/U are excluded precisely because a code gets read off a whiteboard.
    for (const bad of ['K7Q4M2XI', 'K7Q4M2XL', 'K7Q4M2XO', 'K7Q4M2XU']) {
      expect(ShareCodeSchema.safeParse(bad).success).toBe(false)
    }
  })

  it('is case-insensitive, since nobody types a code in caps', () => {
    expect(ShareCodeSchema.parse('k7q4m2xp')).toBe('K7Q4M2XP')
  })

  it('does not accept an activity id, which is the whole point', () => {
    // Same string for both makes revoking a link impossible without
    // destroying the activity behind it.
    expect(ShareCodeSchema.safeParse('demo-activity').success).toBe(false)
  })
})

describe('resolving a share code', () => {
  it('returns a bundle matching the contract shape', async () => {
    const bundle = await play().resolve(MOCK_SHARE_CODE)
    expect(PlayBundleSchema.safeParse(bundle).success).toBe(true)
    expect(bundle.activityVersionId).toBeTruthy()
  })

  it('accepts a lowercase code, so a code read aloud still resolves', async () => {
    await expect(play().resolve(MOCK_SHARE_CODE.toLowerCase())).resolves.toBeTruthy()
  })

  it('reports revoked and unpublished distinctly from a typo', async () => {
    await expect(play().resolve(MOCK_SHARE_CODES.revoked)).rejects.toMatchObject({
      serverCode: 'SHARE_LINK_REVOKED',
    })
    await expect(play().resolve(MOCK_SHARE_CODES.unpublished)).rejects.toMatchObject({
      serverCode: 'ACTIVITY_UNPUBLISHED',
    })
    await expect(play().resolve('ZZZZZZZZ')).rejects.toMatchObject({
      code: 'not_found',
      serverCode: undefined,
    })
  })
})

describe('contract constraints are enforced at the boundary', () => {
  const valid = {
    activityId: 'act_demo_1',
    activityVersionId: 'av_demo_1',
    versionNumber: 1,
    title: 'T',
    allowedPlayModes: ['classic-puzzle'],
    defaultPlayMode: 'classic-puzzle',
    puzzle: { pieceCount: 4, boardShape: 'square' },
    puzzleAsset: {
      assetId: 'media_1',
      variant: 'display_1024',
      downloadUrl: 'https://cdn.example.invalid/a.png',
      contentType: 'image/png',
      byteSize: 1,
      width: 1024,
      height: 768,
      checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
    },
    quiz: null,
  }

  it('accepts a Classic activity with no quiz', () => {
    expect(PlayBundleSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a Learning activity with fewer questions than pieces', () => {
    // Otherwise a student is stranded with pieces they can never release.
    const parsed = PlayBundleSchema.safeParse({
      ...valid,
      allowedPlayModes: ['learning-puzzle'],
      defaultPlayMode: 'learning-puzzle',
      quiz: { quizId: 'q', releaseMode: 'question-driven', questions: [] },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a default mode that is not among the allowed modes', () => {
    const parsed = PlayBundleSchema.safeParse({
      ...valid,
      allowedPlayModes: ['classic-puzzle'],
      defaultPlayMode: 'learning-puzzle',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unsupported piece count', () => {
    const parsed = PlayBundleSchema.safeParse({
      ...valid,
      puzzle: { ...valid.puzzle, pieceCount: 7 },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a question with no correct answer, or two', () => {
    const question = (correct: boolean[]) => ({
      questionId: 'q1',
      prompt: 'p',
      choices: correct.map((isCorrect, i) => ({ choiceId: `c${i}`, text: 't', isCorrect })),
    })
    const withQuiz = (qs: unknown[]) => ({
      ...valid,
      puzzle: { ...valid.puzzle, pieceCount: 4 },
      quiz: { quizId: 'q', releaseMode: 'question-driven', questions: qs },
    })
    expect(PlayBundleSchema.safeParse(withQuiz([question([false, false])])).success).toBe(false)
    expect(PlayBundleSchema.safeParse(withQuiz([question([true, true])])).success).toBe(false)
  })

  it('rejects an uppercase or truncated checksum', () => {
    for (const value of ['A'.repeat(64), 'a'.repeat(63)]) {
      const parsed = PlayBundleSchema.safeParse({
        ...valid,
        puzzleAsset: { ...valid.puzzleAsset, checksum: { algorithm: 'sha256', value } },
      })
      expect(parsed.success).toBe(false)
    }
  })
})

describe('adapting the wire bundle to the app model', () => {
  it('produces something the existing UI already understands', async () => {
    const adapted = toGuestActivityBundle(await play().resolve(MOCK_SHARE_CODE))
    expect(GuestActivityBundleSchema.safeParse(adapted).success).toBe(true)
  })

  it('pins the version the resolver returned', async () => {
    const wire = await play().resolve(MOCK_SHARE_CODE)
    const adapted = toGuestActivityBundle(wire)
    expect(adapted.version.id).toBe(wire.activityVersionId)
    expect(adapted.version.activityId).toBe(wire.activityId)
  })

  it('carries asset identity as algorithm:value, not the expiring URL', async () => {
    // `assetId + checksum` is the durable cache identity; the URL rotates.
    const wire = await play().resolve(MOCK_SHARE_CODE)
    const media = toGuestActivityBundle(wire).version.media[0]
    expect(media?.checksum).toBe(`sha256:${wire.puzzleAsset.checksum.value}`)
    expect(media?.id).toBe(wire.puzzleAsset.assetId)
  })

  it('passes the gameplay body through without interpreting it', async () => {
    const wire = await play().resolve(MOCK_SHARE_CODE)
    const body = toGuestActivityBundle(wire).version.payload.body as Record<string, unknown>
    expect(body.quiz).toEqual(wire.quiz)
    expect(body.puzzle).toEqual(wire.puzzle)
  })

  it('projects the default mode, keeping both in the opaque body', async () => {
    const wire = await play().resolve(MOCK_SHARE_CODE)
    const adapted = toGuestActivityBundle(wire)
    expect(adapted.summary.mode).toBe(wire.defaultPlayMode)
    const body = adapted.version.payload.body as { allowedPlayModes: string[] }
    expect(body.allowedPlayModes).toEqual(wire.allowedPlayModes)
  })
})

describe('student choice is derived, never stored', () => {
  it('is true only when both modes are allowed', () => {
    expect(isStudentChoice({ allowedPlayModes: ['learning-puzzle', 'classic-puzzle'] })).toBe(true)
    expect(isStudentChoice({ allowedPlayModes: ['classic-puzzle'] })).toBe(false)
  })
})
