import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { UnityStage, type BootPayload } from './UnityStage'
import { resolveUnityBuildConfig } from './buildConfig'
import { sendToUnity, UNITY_BRIDGE_TARGET } from './bridge'

vi.mock('./buildConfig', () => ({ resolveUnityBuildConfig: vi.fn() }))
const resolveConfig = vi.mocked(resolveUnityBuildConfig)

const CONFIG = {
  loaderUrl: 'https://cdn.example.com/u/Build/S.loader.js',
  dataUrl: '',
  frameworkUrl: '',
  codeUrl: '',
  streamingAssetsUrl: '',
  companyName: 'SAL0MANder',
  productName: 'SAL0MANder',
  productVersion: '0.0.0',
}

const BOOT: BootPayload = {
  activityId: 'act_1',
  activityVersionId: 'av_1',
  playBundle: { puzzle: { pieceCount: 9 } },
}

const SendMessage = vi.fn()

function stubFactory() {
  let resolveInstance: () => void = () => {}
  vi.stubGlobal(
    'createUnityInstance',
    vi.fn(
      () =>
        new Promise((resolve) => {
          resolveInstance = () => resolve({ Quit: async () => {}, SendMessage })
        }),
    ),
  )
  return { ready: () => act(async () => void resolveInstance()) }
}

const script = () => document.querySelector<HTMLScriptElement>(`script[src="${CONFIG.loaderUrl}"]`)
const fireLoad = () => act(() => void script()?.onload?.(new Event('load')))

/** What actually went across, parsed back out of the SendMessage payload. */
function sentMessages() {
  return SendMessage.mock.calls.map(([, , json]) => JSON.parse(json as string))
}

beforeEach(() => resolveConfig.mockReturnValue(CONFIG))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('sendToUnity', () => {
  it('serializes to the agreed GameObject and method', () => {
    const target = { SendMessage }
    sendToUnity(target, { type: 'set-paused', version: 1, paused: true })

    // Canonical contractVersion rides alongside the legacy version field, so
    // a v1 receiver and a stub receiver both understand the same payload.
    expect(SendMessage).toHaveBeenCalledWith(
      UNITY_BRIDGE_TARGET.gameObject,
      UNITY_BRIDGE_TARGET.method,
      JSON.stringify({ type: 'set-paused', version: 1, paused: true, contractVersion: 1 }),
    )
  })

  it('reports failure instead of throwing when there is no instance', () => {
    expect(sendToUnity(null, { type: 'set-paused', version: 1, paused: true })).toBe(false)
  })

  it('survives a GameObject name mismatch', () => {
    // Unity throws if the target does not exist. The web must not take the
    // page down over a message the game does not need.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = {
      SendMessage: () => {
        throw new Error('SendMessage: object SAL0MANderBridge not found')
      },
    }
    expect(() => sendToUnity(target, { type: 'set-paused', version: 1, paused: true })).not.toThrow()
    expect(sendToUnity(target, { type: 'set-paused', version: 1, paused: true })).toBe(false)
  })
})

describe('booting Unity with the resolved bundle', () => {
  it('sends boot once Unity is ready', async () => {
    const unity = stubFactory()
    render(<UnityStage boot={BOOT} />)
    fireLoad()
    await unity.ready()

    const [message] = sentMessages()
    expect(message).toMatchObject({ type: 'boot', version: 1, ...BOOT })
  })

  it('sends nothing while the instance is still loading', () => {
    // Precisely: there is no instance yet, so there is nothing to send to.
    // The `status === 'ready'` check in the effect is not what this proves —
    // removing it leaves every test green, because `instanceRef` and the
    // status are set together and the guard cannot be falsified on its own.
    // It earns its place as the effect's dependency, not as a condition.
    stubFactory()
    render(<UnityStage boot={BOOT} />)
    fireLoad()
    expect(SendMessage).not.toHaveBeenCalled()
  })

  it('sends when the bundle arrives after Unity is ready', async () => {
    // The warm-cache race: WebGL wins, the fetch is still in flight.
    const unity = stubFactory()
    const { rerender } = render(<UnityStage />)
    fireLoad()
    await unity.ready()
    expect(SendMessage).not.toHaveBeenCalled()

    rerender(<UnityStage boot={BOOT} />)
    expect(sentMessages()[0]).toMatchObject({ type: 'boot' })
  })

  it('boots exactly once, even across re-renders', async () => {
    // A second boot would ask a running game to reload an activity a student
    // is already playing.
    const unity = stubFactory()
    const { rerender } = render(<UnityStage boot={BOOT} />)
    fireLoad()
    await unity.ready()

    rerender(<UnityStage boot={{ ...BOOT }} />)
    rerender(<UnityStage boot={{ ...BOOT }} />)

    expect(SendMessage).toHaveBeenCalledTimes(1)
  })

  it('never sends a boot with no payload', async () => {
    const unity = stubFactory()
    render(<UnityStage />)
    fireLoad()
    await unity.ready()
    expect(SendMessage).not.toHaveBeenCalled()
  })

  it('carries the session id when one exists', async () => {
    const unity = stubFactory()
    render(<UnityStage boot={{ ...BOOT, sessionId: 'ses_1' }} />)
    fireLoad()
    await unity.ready()
    expect(sentMessages()[0]).toMatchObject({ sessionId: 'ses_1' })
  })

  it('omits selectedPlayMode when the caller omits it', async () => {
    // Student Choice: the mode does not exist yet at boot, and guessing would
    // pin the session to something the student never chose.
    const unity = stubFactory()
    render(<UnityStage boot={BOOT} />)
    fireLoad()
    await unity.ready()
    expect(sentMessages()[0]).not.toHaveProperty('selectedPlayMode')
  })
})
