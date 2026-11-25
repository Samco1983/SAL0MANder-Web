import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { SharePanel } from '@components/share/SharePanel'
import { HomePage } from '@routes/home/HomePage'
import { GuestPlayIndexPage, GuestPlayPage } from '@routes/guest-play/GuestPlayPage'
import { PuzzleGiftsPage } from '@routes/gifts/PuzzleGiftsPage'
import { QuestionsPanel } from '@routes/studio/QuestionsPanel'
import { newDraft } from '@studio/activityDraft'
import { addQuestion } from '@studio/questions'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function assertEveryButtonHasAccessibleName(container: HTMLElement) {
  const buttons = container.querySelectorAll('button')
  expect(buttons.length).toBeGreaterThan(0)
  for (const button of buttons) {
    const ariaLabel = button.getAttribute('aria-label')?.trim()
    const labelledBy = button.getAttribute('aria-labelledby')?.trim()
    const text = button.textContent?.trim()
    expect(
      Boolean(ariaLabel || labelledBy || text),
      `Button missing accessible name: ${button.outerHTML}`,
    ).toBe(true)
  }
}

describe('keyboard-only traversal and screen-reader labels across jigsaw and arcade surfaces', () => {
  it('ensures every button has an accessible name on Home, Play index, Jigsaw, Puzzle Gifts, and Studio Questions', () => {
    const surfaces = [
      <HomePage key="home" />,
      <GuestPlayIndexPage key="play-index" />,
      <PuzzleGiftsPage key="gifts" />,
    ]

    for (const surface of surfaces) {
      const view = render(
        <ThemeProvider>
          <MemoryRouter>{surface}</MemoryRouter>
        </ThemeProvider>,
      )
      assertEveryButtonHasAccessibleName(view.container)
      view.unmount()
    }

    const playView = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/play/act_integer_operations']}>
          <Routes>
            <Route path="/play/:activityId" element={<GuestPlayPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )
    assertEveryButtonHasAccessibleName(playView.container)
    playView.unmount()

    const draftWithQ = addQuestion(newDraft('act_a11y', '2026-11-25T00:00:00Z'))
    const qView = render(<QuestionsPanel draft={draftWithQ} onChange={() => {}} />)
    assertEveryButtonHasAccessibleName(qView.container)
    expect(screen.getByRole('button', { name: 'Remove answer 1 for question 1' })).toBeInTheDocument()
    qView.unmount()
  })

  it('connects SharePanel QR disclosure button to its target region via aria-controls and works keyboard-only', async () => {
    const user = userEvent.setup()
    render(<SharePanel activityId="act_integer_operations" baseUrl="https://sal0mander.com" />)

    const toggle = screen.getByRole('button', { name: /show qr code/i })
    const controlsId = toggle.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()
    expect(document.getElementById(controlsId!)).not.toBeNull()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    toggle.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: /hide qr code/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('keeps Jigsaw GuestPlayIndexPage class-code form and demo cards reachable by keyboard', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <MemoryRouter>
          <GuestPlayIndexPage />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(
      screen.getByRole('form', { name: 'Open a class activity by code' }),
    ).toBeInTheDocument()
    const input = screen.getByLabelText('Enter a class code')
    input.focus()
    await user.type(input, 'SUN-42')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('verifies public Arcade HTML pages provide skip links, nav labels, explicit button types, and game-specific play labels', () => {
    const arcadeHtml = readFileSync(
      resolve(__dirname, '../../../public/arcade/index.html'),
      'utf8',
    )
    expect(arcadeHtml).toMatch(/<a[^>]+class="skip"[^>]+href="#play"/)
    const playLinks = [...arcadeHtml.matchAll(/<a\b[^>]*class="play"[^>]*>/g)].map((m) => m[0])
    expect(playLinks.length).toBeGreaterThanOrEqual(8)
    for (const tag of playLinks) {
      expect(tag, `Arcade play link missing game-specific aria-label: ${tag}`).toMatch(
        /aria-label="[^"]{5,}"/,
      )
    }

    const moonGateHtml = readFileSync(
      resolve(__dirname, '../../../public/arcade/moon-gate/index.html'),
      'utf8',
    )
    expect(moonGateHtml).toMatch(/<nav[^>]+aria-label="Game controls"/)
    expect(moonGateHtml).toMatch(/<canvas[^>]+id="arena"[^>]+tabindex="0"/)
    expect(moonGateHtml).not.toMatch(/<button[^>]+id="again"[^>]*><\/button>/)

    const neonDashHtml = readFileSync(
      resolve(__dirname, '../../../public/arcade/neon-dash/index.html'),
      'utf8',
    )
    expect(neonDashHtml).toMatch(/role="toolbar"\s+aria-label="Game tools"/)
    const neonButtons = [...neonDashHtml.matchAll(/<button\b[^>]*>/g)].map((m) => m[0])
    expect(neonButtons.length).toBeGreaterThanOrEqual(10)
    for (const btn of neonButtons) {
      expect(btn, `Neon Dash button missing explicit type="button": ${btn}`).toMatch(
        /type="button"/,
      )
    }
  })
})
