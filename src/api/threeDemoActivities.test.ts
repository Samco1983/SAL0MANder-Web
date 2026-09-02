import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { GuestActivityBundleSchema } from '@contracts/v1'
import {
  DEMO_BOARD_SHAPE,
  DEMO_PIECE_COUNT,
  MOCK_DEMO_ACTIVITIES,
  MOCK_DEMO_ACTIVITY_ID,
  createMockTransport,
} from './mockTransport'

/**
 * The three launch activities, checked against the ids Unity actually seeds.
 *
 * These literals are asserted rather than reviewed because two separate drafts
 * got them wrong in different directions:
 *
 *   - an earlier web draft used `act_integer_ops`
 *   - an independent audit proposed `act_quadratics`, `act_cell_structure` and
 *     `act_vocab_review` — the OLD seeded set, read from Unity `main` instead of
 *     the reconciled branch
 *
 * Both would have shipped the wrong activities, and neither would have failed a
 * test. Unity looks the id up with `ActivityManager.GetActivityById`, so a
 * mismatch is not cosmetic: the student gets a different puzzle than the link
 * named, which is the whole B-11 defect restated.
 */
const UNITY_IDS = [
  'act_integer_operations',
  'act_one_step_inequalities',
  'act_linear_equations',
] as const

const transport = createMockTransport()
const getActivity = (id: string) =>
  transport.request({ path: `/guest/activities/${id}` }, GuestActivityBundleSchema)

describe('the three launch activities', () => {
  it('uses exactly the ids Unity seeds — not aliases, not the old set', () => {
    expect(MOCK_DEMO_ACTIVITIES.map((a) => a.id)).toEqual([...UNITY_IDS])
  })

  it('never reintroduces an id that was wrong before', () => {
    const ids = MOCK_DEMO_ACTIVITIES.map((a) => a.id)
    for (const wrong of [
      'act_integer_ops',
      'act_quadratics',
      'act_cell_structure',
      'act_vocab_review',
    ]) {
      expect(ids, `${wrong} is not one of the three launch activities`).not.toContain(wrong)
    }
  })

  it('resolves each id to its own distinct title', async () => {
    const titles: string[] = []
    for (const id of UNITY_IDS) {
      const bundle = await getActivity(id)
      expect(bundle.summary.id).toBe(id)
      titles.push(bundle.summary.title)
    }
    expect(new Set(titles).size, `titles were not distinct: ${titles.join(', ')}`).toBe(3)
  })

  it('gives each activity its own version id, so two bundles cannot look like one', async () => {
    const versions: string[] = []
    for (const id of UNITY_IDS) {
      const bundle = await getActivity(id)
      expect(bundle.version.activityId).toBe(id)
      versions.push(bundle.version.id)
    }
    expect(new Set(versions).size).toBe(3)
  })

  /**
   * Unity hardcodes both in `CreateDemoActivity(id, title, imagePresetIndex,
   * quiz)`. An audit proposed testing for varied counts (9, 6, 4) — that
   * describes the old seeded activities, not these.
   */
  it('specifies nine pieces and a square board, matching Unity', () => {
    expect(DEMO_PIECE_COUNT).toBe(9)
    expect(DEMO_BOARD_SHAPE).toBe('square')
  })

  it('keeps titles consistent across both resolution paths', async () => {
    for (const activity of MOCK_DEMO_ACTIVITIES) {
      const bundle = await getActivity(activity.id)
      expect(bundle.summary.title).toBe(activity.title)
    }
  })

  /**
   * Fail-closed. The requirement is that an unknown id FAILS rather than
   * opening some other puzzle — so no nearest-match, no default, and above all
   * no silent fallback to `demo-activity`.
   */
  it('rejects an unknown id instead of substituting another activity', async () => {
    await expect(getActivity('act_does_not_exist')).rejects.toBeInstanceOf(ApiError)
    await expect(getActivity('act_integer_operation')).rejects.toBeInstanceOf(ApiError)
    await expect(getActivity('')).rejects.toBeTruthy()
  })

  it('answers 404, not a bundle, for an unknown id', async () => {
    try {
      await getActivity('nope')
      throw new Error('expected a rejection')
    } catch (error) {
      expect((error as ApiError).status).toBe(404)
    }
  })

  it('still serves the legacy demo activity, which other surfaces link to', async () => {
    const bundle = await getActivity(MOCK_DEMO_ACTIVITY_ID)
    expect(bundle.summary.id).toBe(MOCK_DEMO_ACTIVITY_ID)
  })
})
