import { describe, expect, it } from 'vitest'
import {
  DEMO_LEVELS,
  DEMO_MATH_COURSES,
  DEMO_CLASSIC_COURSE,
  DEMO_MATCHING_COURSE,
  findDemoLevel,
} from './demoLevels'
import { createMockTransport, MOCK_DEMO_ACTIVITIES } from '@api/mockTransport'
import { GuestActivityBundleSchema } from '@contracts/v1'

const nativeSeries = ['integer', 'inequality', 'linear', 'classic', 'matching'] as const
const ids = nativeSeries.flatMap((series) =>
  [1, 2, 3].map((level) => `act_demo_${series}_${level}`),
)
const transport = createMockTransport()
const resolve = (id: string) =>
  transport.request({ path: `/guest/activities/${id}` }, GuestActivityBundleSchema)

describe('native demo navigation contract', () => {
  it('names exactly the fifteen native IDs, with no aliases or duplicate versions', () => {
    expect(DEMO_LEVELS.map((level) => level.id)).toEqual(ids)
    expect(new Set(DEMO_LEVELS.map((level) => level.title)).size).toBe(15)
    for (const id of ids) expect(findDemoLevel(id)?.id).toBe(id)
  })
  it.each(nativeSeries)(
    '%s has truthful piece/tile counts with bounded same-series links',
    (series) => {
      const levels = DEMO_LEVELS.filter((level) => level.series === series)
      expect(levels.map((level) => level.pieceCount)).toEqual(
        series === 'matching' ? [4, 4, 4] : [4, 9, 16],
      )
      expect(levels.map((level) => level.label)).toEqual(['Warm-up', 'Practice', 'Challenge'])
      expect(levels.map((level) => level.level)).toEqual([1, 2, 3])
      expect(levels.map((level) => level.nextId)).toEqual([levels[1]!.id, levels[2]!.id, undefined])
      expect(levels.map((level) => level.previousId)).toEqual([
        undefined,
        levels[0]!.id,
        levels[1]!.id,
      ])
    },
  )
  it('exposes only three math roots plus separate Classic and Matching roots', () => {
    expect(DEMO_MATH_COURSES.map((level) => level.id)).toEqual([
      'act_demo_integer_1',
      'act_demo_inequality_1',
      'act_demo_linear_1',
    ])
    expect(DEMO_CLASSIC_COURSE.id).toBe('act_demo_classic_1')
    expect(DEMO_MATCHING_COURSE.id).toBe('act_demo_matching_1')
  })
  it.each(ids)(
    'resolves %s without inventing duplicate questions, image URLs or puzzle geometry',
    async (id) => {
      const level = findDemoLevel(id)!
      const bundle = await resolve(id)
      expect(bundle.summary).toMatchObject({ id, title: level.title, mode: level.mode })
      expect(bundle.version).toMatchObject({ id: `${id}-v1`, activityId: id })
      expect(bundle.version.payload.body).toEqual({
        allowedPlayModes: [level.mode],
        defaultPlayMode: level.mode,
      })
      expect(bundle.version.media).toEqual([])
      expect(level.mode).toBe(
        /_(classic|matching)_/.test(id) ? 'classic-puzzle' : 'learning-puzzle',
      )
    },
  )
  it.each([
    'act_demo_integer_0',
    'act_demo_integer_4',
    'act_demo_integer_01',
    'ACT_DEMO_INTEGER_1',
    'act_demo_integer_1-extra',
    ' act_demo_integer_1',
    'act_demo_unknown_1',
    'act_demo_matching_0',
    'act_demo_matching_4',
    'act_demo_matching_01',
    'ACT_DEMO_MATCHING_1',
  ])('rejects %s rather than silently opening another level', async (id) => {
    expect(findDemoLevel(id)).toBeUndefined()
    await expect(resolve(id)).rejects.toMatchObject({ status: 404 })
  })
  it('retains the exact legacy IDs and old opaque payloads', async () => {
    expect(MOCK_DEMO_ACTIVITIES.map((item) => item.id)).toEqual([
      'act_integer_operations',
      'act_one_step_inequalities',
      'act_linear_equations',
    ])
    for (const id of ['demo-activity', ...MOCK_DEMO_ACTIVITIES.map((item) => item.id)]) {
      expect(findDemoLevel(id)).toBeUndefined()
      expect((await resolve(id)).version.payload.body).toEqual({ placeholder: true })
    }
  })
})
