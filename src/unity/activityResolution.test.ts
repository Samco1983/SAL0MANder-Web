import { describe, expect, it } from 'vitest'
import { BRIDGE_VERSION, type UnityToWebMessage } from './bridge'
import {
  RESOLUTION_FAILED_FIELD,
  RESOLVED_ID_FIELD,
  createActivityResolutionProbe,
  isLaunchVerified,
} from './activityResolution'

const msg = (type: string, extra: Record<string, unknown> = {}) =>
  ({ type, version: BRIDGE_VERSION, ...extra }) as unknown as UnityToWebMessage

describe('activity resolution probe', () => {
  it('starts at no-response before Unity says anything', () => {
    const probe = createActivityResolutionProbe('act_integer_ops')
    expect(probe.resolution.verdict).toBe('no-response')
  })

  it('confirms when Unity names the activity the link requested', () => {
    const probe = createActivityResolutionProbe('act_integer_ops')
    probe.observe(msg('activity-loaded', { [RESOLVED_ID_FIELD]: 'act_integer_ops' }))
    expect(probe.resolution.verdict).toBe('confirmed')
    expect(isLaunchVerified(probe.resolution)).toBe(true)
  })

  it('catches a link that launched a different activity', () => {
    // The B-11 failure. Nothing looks broken on screen: the student gets a
    // puzzle and plays it. Only the id reveals it is the wrong puzzle.
    const probe = createActivityResolutionProbe('act_integer_ops')
    probe.observe(msg('activity-loaded', { [RESOLVED_ID_FIELD]: 'act_quadratics' }))
    expect(probe.resolution.verdict).toBe('wrong-activity')
    expect(probe.resolution.resolved).toBe('act_quadratics')
    expect(isLaunchVerified(probe.resolution)).toBe(false)
  })

  /**
   * The regression this whole module exists to prevent.
   *
   * Today's build echoes the requested id back on every message via
   * `CreateMessage<T>`. If the probe ever read `activityId`, this test would
   * report `confirmed` for a boot that resolved nothing at all — and every
   * share link would certify itself.
   */
  it('does NOT accept Unity echoing the requested id back as proof', () => {
    const probe = createActivityResolutionProbe('act_integer_ops')
    probe.observe(msg('ready', { activityId: 'act_integer_ops', activityVersionId: 'v1' }))
    expect(probe.resolution.verdict).toBe('unverifiable')
    expect(isLaunchVerified(probe.resolution)).toBe(false)
  })

  it('reports unverifiable — not confirmed — against a build that never answers', () => {
    const probe = createActivityResolutionProbe('act_integer_ops')
    probe.observe(msg('ready'))
    probe.observe(msg('mode-selected', { selectedPlayMode: 'quiz-gated' }))
    probe.observe(
      msg('session-finished', {
        activityId: 'act_integer_ops',
        durationMs: 1000,
        questionsAnswered: 9,
        questionsCorrect: 9,
        piecesPlaced: 9,
        piecesTotal: 9,
      }),
    )
    // A whole session played start to finish still proves nothing about which
    // activity it was.
    expect(probe.resolution.verdict).toBe('unverifiable')
  })

  it('surfaces the invalid-target case Unity already computes internally', () => {
    const probe = createActivityResolutionProbe('act_does_not_exist')
    probe.observe(msg('error', { [RESOLUTION_FAILED_FIELD]: true }))
    expect(probe.resolution.verdict).toBe('invalid-target')
  })

  it('does not let later chatter overturn a verdict already reached', () => {
    const probe = createActivityResolutionProbe('act_integer_ops')
    probe.observe(msg('activity-loaded', { [RESOLVED_ID_FIELD]: 'act_quadratics' }))
    probe.observe(msg('activity-loaded', { [RESOLVED_ID_FIELD]: 'act_integer_ops' }))
    expect(probe.resolution.verdict).toBe('wrong-activity')
  })

  it('settles a silent probe to no-response without downgrading a real verdict', () => {
    const silent = createActivityResolutionProbe('act_integer_ops')
    expect(silent.settle().verdict).toBe('no-response')

    const answered = createActivityResolutionProbe('act_integer_ops')
    answered.observe(msg('activity-loaded', { [RESOLVED_ID_FIELD]: 'act_integer_ops' }))
    expect(answered.settle().verdict).toBe('confirmed')
  })

  it('ignores messages after settling', () => {
    const probe = createActivityResolutionProbe('act_integer_ops')
    probe.settle()
    probe.observe(msg('activity-loaded', { [RESOLVED_ID_FIELD]: 'act_integer_ops' }))
    expect(probe.resolution.verdict).toBe('no-response')
  })
})
