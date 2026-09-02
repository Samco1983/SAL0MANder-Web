import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { MOCK_DEMO_ACTIVITIES, MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'
import { GuestPlayPage } from './GuestPlayPage'

/**
 * An unknown activity id must FAIL, not open another puzzle.
 *
 * The web API answered 404 correctly the whole time, and an audit still found
 * the defect: `{...(boot ? { boot } : {})}` omits the PROP but does not stop
 * `UnityStage` mounting. So a 404 rendered the failure message while the stage
 * still injected the loader, pulled ~88MB of WebGL, and started Unity — which,
 * with no boot to tell it otherwise, opens whichever activity `ActivityManager`
 * already had. A student following a mistyped link saw an error with a
 * different puzzle running behind it.
 *
 * The lesson is in what the old tests asserted. "The error appeared" was true
 * throughout, so it would have passed every day the bug existed. These assert
 * the canvas never mounts and no boot is ever sent — the two things that were
 * actually wrong.
 */

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/play/:activityId" element={<GuestPlayPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

const UNKNOWN = '/play/act_does_not_exist'

describe('an unknown activity id', () => {
  it('tells the student the link did not work', async () => {
    renderAt(UNKNOWN)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  /**
   * The assertion the old tests were missing.
   *
   * Targets the canvas, not the "Game stage" region — that region belongs to
   * `CompanionLayout` and is present whether or not Unity mounts, so asserting
   * on it proves nothing. The canvas is `UnityStage`'s and only exists when
   * Unity does.
   */
  it('never mounts the Unity canvas', async () => {
    const { container } = renderAt(UNKNOWN)
    await screen.findByRole('alert')

    expect(screen.queryByLabelText(/SAL0MANder game/i)).not.toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
    // UnityStage's own output, absent because the component never mounted.
    expect(screen.queryByText(/the game isn.t ready yet/i)).not.toBeInTheDocument()
  })

  /**
   * A canvas is the visible symptom; the loader is the cost. ~88MB of WebGL
   * downloaded behind an error message is bandwidth a school pays for and a
   * student waits on, to be shown a puzzle they did not ask for.
   */
  it('never injects the Unity loader for a link that failed', async () => {
    renderAt(UNKNOWN)
    await screen.findByRole('alert')

    const loaderScripts = [...document.querySelectorAll('script')].filter((s) =>
      /unity|loader\.js/i.test(s.getAttribute('src') ?? ''),
    )
    expect(loaderScripts).toHaveLength(0)
  })

  it('does not fall back to the demo activity or any other puzzle', async () => {
    const { container } = renderAt(UNKNOWN)
    await screen.findByRole('alert')

    const text = container.textContent ?? ''
    expect(text).not.toContain(MOCK_DEMO_ACTIVITY_ID)
    for (const activity of MOCK_DEMO_ACTIVITIES) {
      expect(text, `fell back to ${activity.title}`).not.toContain(activity.title)
    }
  })

  it('still asks for no account while failing', async () => {
    renderAt(UNKNOWN)
    await screen.findByRole('alert')

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in|log in|create account/i })).toBeNull()
  })
})

describe('a known activity id', () => {
  /**
   * The other half. Withholding the stage on failure must not withhold it on
   * success — an earlier attempt gated on `!boot`, which also hid the stage
   * during normal loading and made it unmount and remount when the bundle
   * arrived. A Gate-1 test caught that, and it is a step toward the remount
   * CLAUDE.md forbids.
   */
  /**
   * Asserts on `UnityStage`'s own output, not on the "Game stage" region —
   * that region belongs to `CompanionLayout` and renders whether or not Unity
   * mounts, so an earlier draft of this test would have passed with no Unity
   * at all.
   *
   * No Unity build is configured under test, so there is no canvas to look
   * for; `UnityStage` renders its student-facing unconfigured message instead.
   * That message is the proof the component mounted, and it is the signal that
   * survives regardless of build configuration.
   */
  it('mounts the Unity stage for each of the three, and for the legacy demo', async () => {
    for (const id of [...MOCK_DEMO_ACTIVITIES.map((a) => a.id), MOCK_DEMO_ACTIVITY_ID]) {
      const { unmount } = renderAt(`/play/${id}`)
      await waitFor(() =>
        expect(screen.getByText(/the game isn.t ready yet/i), `no Unity stage for ${id}`)
          .toBeInTheDocument(),
      )
      unmount()
    }
  })

  it('never asks for an account on any of the three routes', async () => {
    for (const activity of MOCK_DEMO_ACTIVITIES) {
      const { unmount } = renderAt(`/play/${activity.id}`)
      await waitFor(() =>
        expect(screen.getByText(/the game isn.t ready yet/i)).toBeInTheDocument(),
      )
      expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /sign in|log in/i })).toBeNull()
      unmount()
    }
  })
})
