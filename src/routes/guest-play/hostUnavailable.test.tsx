import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { UnityStage } from '@unity/UnityStage'
import { resolveUnityBuildConfig } from '@unity/buildConfig'

/**
 * What a student sees when the game has not been deployed.
 *
 * A teacher can share a link before the WebGL build is published — the link
 * resolves, the activity loads, and the stage has nothing to run. Until now
 * that surface told the student to
 * "Set VITE_UNITY_BUILD_BASE_URL to a folder or CDN path containing Build/".
 *
 * Environment-variable instructions are the right answer on the bare /unity
 * smoke-test route and the wrong answer for a child who followed a link. Same
 * component, same state, different reader.
 */

vi.mock('@unity/buildConfig', () => ({ resolveUnityBuildConfig: vi.fn() }))
const resolveConfig = vi.mocked(resolveUnityBuildConfig)

const renderStage = (audience?: 'student' | 'developer') =>
  render(
    <ThemeProvider>
      <UnityStage activityId="SUN-42" {...(audience ? { audience } : {})} />
    </ThemeProvider>,
  )

beforeEach(() => resolveConfig.mockReturnValue(null))
afterEach(() => vi.clearAllMocks())

describe('a student on a share link, before the game is published', () => {
  it('is told the game is not ready, in words that mean something', () => {
    renderStage('student')
    expect(screen.getByRole('heading', { name: /game isn.t ready/i })).toBeVisible()
  })

  it('never shows an environment variable', () => {
    renderStage('student')
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/VITE_/)
    expect(text).not.toMatch(/CDN|Build\//)
    expect(text).not.toMatch(/WebGL/)
  })

  it('does not blame the link the student followed', () => {
    // The link is fine. Saying otherwise sends a student back to a teacher
    // with the wrong problem, and the teacher re-sends a link that works.
    renderStage('student')
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/link works|nothing is wrong on your end/i)
    expect(text).not.toMatch(/invalid|expired|not found|mistyped/i)
  })

  it('names who can fix it', () => {
    renderStage('student')
    expect(screen.getByText(/teacher/i)).toBeVisible()
  })

  it('announces the state to assistive technology', () => {
    // Not an alert: nothing failed and nothing is urgent. A status region
    // announces it without interrupting.
    renderStage('student')
    expect(screen.getByRole('status')).toBeVisible()
  })

  it('does not ask for an account, a name, or an email', () => {
    renderStage('student')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText(/sign in|account|email|your name/i)).toBeNull()
  })
})

describe('a developer on the bare host route', () => {
  it('still gets the environment variable, because that is the fix', () => {
    renderStage('developer')
    expect(screen.getByText(/VITE_UNITY_BUILD_BASE_URL/)).toBeVisible()
  })

  it('defaults to developer when no audience is declared', () => {
    // The bare /unity route renders <UnityStage /> with no audience. Defaulting
    // to student there would hide the one thing that surface exists to show.
    renderStage()
    expect(screen.getByText(/VITE_UNITY_BUILD_BASE_URL/)).toBeVisible()
  })

  it('still names the activity, so a share link stays debuggable', () => {
    renderStage('developer')
    expect(screen.getByText(/SUN-42/)).toBeVisible()
  })
})
