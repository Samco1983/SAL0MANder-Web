import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import { CORRECT_FADE_MS, VOICE_CLIP_PLACEHOLDER_NOTICE, filterPracticeSets } from './curriculum'
import { portalStorage } from './storage'

describe('portal Phase 1 — PR 9 inline hints, 3s Correct fade, explanations, voice clips setting, standards, and set search', () => {
  beforeEach(() => {
    window.localStorage.clear()
    portalStorage.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('filters sets by standard code or keyword accurately', () => {
    const ns1Ids = filterPracticeSets('7.NS.1').map((s) => s.setId)
    expect(ns1Ids).toContain('g7-u1-a')
    expect(ns1Ids).not.toContain('g7-u1-b')
    expect(ns1Ids).not.toContain('g7-u1-c')
    const rp3Ids = filterPracticeSets('7.RP.3').map((s) => s.setId)
    expect(rp3Ids).toEqual(expect.arrayContaining(['g7-u3-a', 'g7-u3-b', 'g7-u3-c']))
    expect(rp3Ids).not.toContain('g7-u1-a')
    expect(filterPracticeSets('7.EE.4b').map((s) => s.setId)).toContain('g7-u5-b')
    expect(filterPracticeSets('inequalities').map((s) => s.setId)).toContain('g7-u5-b')
    expect(filterPracticeSets('percent tax').map((s) => s.setId)).toEqual(['g7-u3-b'])
    expect(filterPracticeSets('zz-no-match-zz')).toEqual([])
  })

  it('shows inline matching hints under the problem with no timer, replaces on new wrong answer, reveals explanation at 3 wrong tries or on correct, and fades ONLY the Correct message after 3s', async () => {
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    // Let lazy PortalPage resolve under real timers before switching to fake timers for fade testing
    const childTab = await screen.findByRole('tab', { name: /^child profile$/i }, { timeout: 10_000 })
    vi.useFakeTimers()

    fireEvent.click(childTab)
    fireEvent.click(screen.getByRole('button', { name: /Sofia \(white\)/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue unfinished set/i }))

    const p1 = screen.getByTestId('problem-g7-u1-a-01') // -3 + 8 = 5; hints: "-11", "-5", "*"
    const p1Input = within(p1).getByRole('textbox')
    const p1Check = within(p1).getByRole('button', { name: /^check$/i })

    // Standard code displayed in small text
    expect(within(p1).getByTestId('problem-standards-g7-u1-a-01')).toHaveTextContent('7.NS.1')

    // Wrong try #1 ("-11") -> specific hint UNDER the problem (no popup dialog), no explanation yet, no auto-play
    fireEvent.change(p1Input, { target: { value: '-11' } })
    fireEvent.click(p1Check)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(p1).getByTestId('hint-box-g7-u1-a-01')).toHaveTextContent(/You kept the minus and added the sizes/i)
    expect(within(p1).queryByTestId('explanation-g7-u1-a-01')).toBeNull()
    expect(within(p1).queryByText(VOICE_CLIP_PLACEHOLDER_NOTICE)).toBeNull()

    // Hint has NO timer (still present after 60s) and stays while typing a new draft before Check
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    fireEvent.change(p1Input, { target: { value: '-5' } })
    expect(within(p1).getByTestId('hint-box-g7-u1-a-01')).toHaveTextContent(/You kept the minus and added the sizes/i)

    // Wrong try #2 ("-5") -> replaces previous hint; still no explanation
    fireEvent.click(p1Check)
    expect(within(p1).getByTestId('hint-box-g7-u1-a-01')).toHaveTextContent(/check the sign/i)
    expect(within(p1).getByTestId('hint-box-g7-u1-a-01')).not.toHaveTextContent(/You kept the minus/i)
    expect(within(p1).queryByTestId('explanation-g7-u1-a-01')).toBeNull()

    // Wrong try #3 ("999") -> generic "*" hint replaces previous hint AND explanation now appears!
    fireEvent.change(p1Input, { target: { value: '999' } })
    fireEvent.click(p1Check)
    expect(within(p1).getByTestId('hint-box-g7-u1-a-01')).toHaveTextContent(/Picture a number line/i)
    expect(within(p1).getByTestId('explanation-g7-u1-a-01')).toHaveTextContent(/Start at -3 and move 8 steps right/i)

    // Voice clip button placeholder + mute toggle beside the hint (never auto-plays)
    const hearBtn = within(p1).getByRole('button', { name: /hear mr\. sam explain/i })
    expect(hearBtn).toBeEnabled()
    fireEvent.click(hearBtn)
    expect(within(p1).getByText(VOICE_CLIP_PLACEHOLDER_NOTICE)).toBeVisible()

    const muteBtn = within(p1).getByRole('button', { name: /^mute$/i })
    fireEvent.click(muteBtn)
    expect(hearBtn).toBeDisabled()
    expect(within(p1).getByTestId('hint-box-g7-u1-a-01')).toHaveTextContent(/Picture a number line/i)

    // Problem #2: Correct answer on try #1 -> shows Correct! AND explanation; ONLY Correct fades after ~3s
    const p2 = screen.getByTestId('problem-g7-u1-a-02') // 6 + (-9) = -3
    const p2Input = within(p2).getByRole('textbox')
    fireEvent.change(p2Input, { target: { value: '-3' } })
    fireEvent.click(within(p2).getByRole('button', { name: /^check$/i }))
    expect(within(p2).getByTestId('correct-msg-g7-u1-a-02')).toHaveTextContent(/Correct!/i)
    expect(within(p2).getByTestId('explanation-g7-u1-a-02')).toHaveTextContent(/Adding -9 moves 9 steps left/i)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CORRECT_FADE_MS - 100)
    })
    expect(within(p2).getByTestId('correct-msg-g7-u1-a-02')).toBeVisible()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(within(p2).queryByTestId('correct-msg-g7-u1-a-02')).toBeNull()
    expect(within(p2).getByTestId('explanation-g7-u1-a-02')).toBeVisible()
    // Meanwhile, P1's hint STILL stayed (no timer on hints)
    expect(within(p1).getByTestId('hint-box-g7-u1-a-01')).toBeVisible()
  }, 20_000)

  it('supports parent setting "Mr. Sam\'s voice clips: On / Off" (default On, written hint shows regardless) and unit picker search by standard code or word', async () => {
    const seed = portalStorage.load()
    expect(seed.children.every((c) => c.voiceClipsEnabled === true)).toBe(true)

    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    // Sign in as Elena in Parent Account and toggle "Mr. Sam's voice clips" Off for Sofia
    await user.click(await screen.findByRole('tab', { name: /parent account/i }, { timeout: 10_000 }))
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))
    await user.click(screen.getByRole('button', { name: /open simulated inbox/i }))
    await user.click(screen.getByRole('button', { name: /open sign-in link/i }))
    await user.click(screen.getByRole('tab', { name: /settings \(5\)/i }))
    await user.click(screen.getByRole('button', { name: /^Sofia$/i }))
    const voiceFieldset = screen.getByRole('group', { name: /5\. Mr\. Sam’s voice clips/i })
    expect(within(voiceFieldset).getByRole('radio', { name: /On \(default/i })).toBeChecked()
    await user.click(within(voiceFieldset).getByRole('radio', { name: /^Off$/i }))
    await user.click(screen.getByRole('button', { name: /save settings/i }))
    expect(portalStorage.load().children.find((c) => c.id === 'child_sofia')?.voiceClipsEnabled).toBe(false)

    // Switch to Child Profile: search unit picker by standard code "7.EE.1" and by word "percent"
    await user.click(screen.getByRole('tab', { name: /^child profile$/i }))
    const searchInput = screen.getByLabelText(/Search sets by standard code or word/i)
    await user.type(searchInput, '7.EE.1')
    expect(screen.getByTestId('set-search-count')).toHaveTextContent(/matching set/i)
    expect(screen.getByTestId('set-card-g7-u4-a')).toBeVisible()
    expect(screen.queryByTestId('set-card-g7-u1-a')).toBeNull()

    // Open Unit 4 Set A as Leo -> problem displays explicit standard codes 7.EE.1, 7.EE.2
    await user.click(screen.getByRole('button', { name: /Leo \(green\)/i }))
    await user.type(screen.getByLabelText(/Search sets by standard code or word/i), '7.EE.1')
    await user.click(within(screen.getByTestId('set-card-g7-u4-a')).getByRole('button', { name: /Set A/i }))
    expect(screen.getByTestId('problem-standards-g7-u4-a-01')).toHaveTextContent('7.EE.1, 7.EE.2')

    // Go back, search by word "percent"
    await user.click(screen.getByRole('button', { name: /back to profile/i }))
    const search2 = screen.getByLabelText(/Search sets by standard code or word/i)
    await user.clear(search2)
    await user.type(search2, 'percent')
    expect(screen.getByTestId('set-card-g7-u3-a')).toBeVisible()
    expect(screen.getByTestId('set-card-g7-u3-b')).toBeVisible()
    expect(screen.getByTestId('set-card-g7-u3-c')).toBeVisible()

    // Switch to Sofia (whose parent turned voice clips Off): written hint STILL shows, voice button hidden
    await user.click(screen.getByRole('button', { name: /Sofia \(white\)/i }))
    await user.click(screen.getByRole('button', { name: /continue unfinished set/i }))
    const p1 = screen.getByTestId('problem-g7-u1-a-01')
    await user.type(within(p1).getByRole('textbox'), '-11')
    await user.click(within(p1).getByRole('button', { name: /^check$/i }))
    expect(within(p1).getByTestId('hint-box-g7-u1-a-01')).toHaveTextContent(/You kept the minus and added the sizes/i)
    expect(within(p1).queryByRole('button', { name: /hear mr\. sam explain/i })).toBeNull()
    expect(within(p1).getByText(/voice clips: Off \(parent setting\)/i)).toBeVisible()
  }, 25_000)
})
