import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { ClassroomPage } from './ClassroomPage'
const { classroom, sites } = vi.hoisted(() => ({
  classroom: { invitation: null as { url: string; meetingCode: string } | null, bookingUrl: '' },
  sites: { tutoring: '', puzzles: '' },
}))
vi.mock('@config/env', () => ({ env: { classroom, sites, appName: 'SAL0MANder', isProd: true } }))
beforeEach(() => {
  classroom.invitation = null
  classroom.bookingUrl = ''
  sites.tutoring = ''
  sites.puzzles = ''
})
afterEach(() => vi.restoreAllMocks())
function show() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <ClassroomPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

it('offers honest tutoring and self-paced entry without invented booking, accounts or a room', () => {
  show()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Private tutoring & small groups of up to 6 students',
  )
  expect(screen.getByText(/groups of 1–6 students are available to request/)).toBeVisible()
  expect(screen.getByText(/Grades 6–12 math/)).toBeVisible()
  expect(screen.getByText(/Google booking link is being set up/)).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Join lesson in Google Meet' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Open Google booking page' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Open puzzle practice' })).toHaveAttribute(
    'href',
    '/play',
  )
  expect(screen.getAllByRole('link', { name: 'Teacher Studio' }).at(-1)).toHaveAttribute(
    'href',
    '/studio',
  )
  expect(screen.queryByRole('textbox', { name: /name|email|password/i })).toBeNull()
})

it('prepares a private invite locally with focus, exact link and code fallback but no automatic launch or storage', async () => {
  const user = userEvent.setup()
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  const writes = vi.spyOn(Storage.prototype, 'setItem')
  const fetcher = vi.spyOn(window, 'fetch')
  show()
  const url = 'https://meet.google.com/abc-defg-hij'
  await user.type(
    screen.getByRole('textbox', { name: 'Zoom or Google Meet link, or meeting code' }),
    url,
  )
  expect(screen.queryByRole('link', { name: 'Join lesson in Google Meet' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Use this invitation' }))
  const join = screen.getByRole('link', { name: 'Join lesson in Google Meet' })
  expect(join).toHaveAttribute('href', url)
  expect(join).toHaveAttribute('rel', 'noopener noreferrer')
  expect(join).toHaveFocus()
  expect(screen.getByRole('textbox', { name: 'Meeting code' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Meeting code' })).toHaveValue('abc-defg-hij')
  expect(screen.getByText(/open Google Meet on the web/)).toBeVisible()
  expect(open).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
  expect(writes).not.toHaveBeenCalled()
})

it('removes an old joining action when editing and retains invalid input for correction', async () => {
  const user = userEvent.setup()
  classroom.invitation = {
    url: 'https://meet.google.com/abc-defg-hij',
    meetingCode: 'abc-defg-hij',
  }
  show()
  const field = screen.getByRole('textbox', { name: 'Zoom or Google Meet link, or meeting code' })
  await user.type(field, 'https://meet.google.com.attacker.example/abc-defg-hij')
  expect(screen.queryByRole('link', { name: 'Join lesson in Google Meet' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Use this invitation' }))
  expect(screen.getByRole('alert')).toHaveTextContent(
    /Zoom or Google Meet participant link or meeting code/,
  )
  expect(field).toHaveValue('https://meet.google.com.attacker.example/abc-defg-hij')
  await user.clear(field)
  await user.type(field, 'ABCDEFGHIJ')
  await user.click(screen.getByRole('button', { name: 'Use this invitation' }))
  expect(screen.getByRole('link', { name: 'Join lesson in Google Meet' })).toHaveAttribute(
    'href',
    'https://meet.google.com/abc-defg-hij',
  )
  expect(screen.queryByRole('alert')).toBeNull()
})

it('opens only the supplied booking service and describes meeting-app chat and saving', async () => {
  const user = userEvent.setup()
  classroom.bookingUrl = 'https://calendar.app.google/AbCdEfGh12345678'
  show()
  expect(screen.getByRole('link', { name: 'Open Google booking page' })).toHaveAttribute(
    'href',
    classroom.bookingUrl,
  )
  expect(screen.queryByText(/booking confirmed/i)).toBeNull()
  expect(screen.getByRole('link', { name: classroom.bookingUrl })).toHaveAttribute(
    'href',
    classroom.bookingUrl,
  )
  expect(screen.getByText(/Video, audio and lesson chat open in Zoom or Google Meet/)).toBeVisible()
  await user.click(screen.getByText('Video, chat and saving your work'))
  expect(screen.getByText(/website does not store that chat or record your call/)).toBeVisible()
})

it('copies only after a click and keeps a selectable code when clipboard access fails', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
  classroom.invitation = {
    url: 'https://meet.google.com/abc-defg-hij',
    meetingCode: 'abc-defg-hij',
  }
  show()
  expect(write).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Copy meeting code' }))
  expect(write).toHaveBeenCalledWith('abc-defg-hij')
  expect(screen.getByRole('status')).toHaveTextContent(/copy it manually/)
  const code = screen.getByRole('textbox', { name: 'Meeting code' }) as HTMLInputElement
  await user.click(code)
  expect(code).toHaveAttribute('readonly')
  expect(code.selectionEnd! - code.selectionStart!).toBe(code.value.length)
})

it('does not show an old clipboard outcome beside a newly prepared meeting', async () => {
  const user = userEvent.setup()
  let finish!: () => void
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  classroom.invitation = {
    url: 'https://meet.google.com/abc-defg-hij',
    meetingCode: 'abc-defg-hij',
  }
  show()
  await user.click(screen.getByRole('button', { name: 'Copy meeting code' }))
  await user.type(
    screen.getByRole('textbox', { name: 'Zoom or Google Meet link, or meeting code' }),
    'klm-nopq-rst',
  )
  await user.click(screen.getByRole('button', { name: 'Use this invitation' }))
  await act(async () => finish())
  expect(screen.getByRole('textbox', { name: 'Meeting code' })).toHaveValue('klm-nopq-rst')
  expect(screen.queryByRole('status')).toBeNull()
})

it('uses the configured scheduler and public puzzle site while keeping joining separate', () => {
  sites.tutoring = 'https://salomandermath.com'
  sites.puzzles = 'https://sal0mander.com'
  classroom.bookingUrl = 'https://calendar.app.google/AbCdEfGh12345678'
  show()
  const nav = within(screen.getByRole('navigation', { name: 'Main' }))
  const booking = nav.getByRole('link', { name: 'Book Tutoring' })
  expect(booking).toHaveAttribute('href', classroom.bookingUrl)
  expect(booking).not.toHaveAttribute('href', sites.tutoring)
  expect(nav.getByRole('link', { name: 'Book Tutoring' })).not.toHaveAttribute('aria-current')
  expect(nav.getByRole('link', { name: 'Puzzle Practice' })).toHaveAttribute(
    'href',
    sites.puzzles + '/play',
  )
  expect(nav.getByRole('link', { name: 'Puzzle Gifts' })).toHaveAttribute(
    'href',
    sites.puzzles + '/gifts',
  )
  expect(screen.getByRole('link', { name: 'Open puzzle practice' })).toHaveAttribute(
    'href',
    sites.puzzles + '/play',
  )
  expect(screen.queryByRole('link', { name: 'Join lesson in Google Meet' })).toBeNull()
})

it('offers one-device and computer/iPad writing without promising a website whiteboard', async () => {
  const user = userEvent.setup()
  show()
  await user.click(screen.getByText('One device or computer + iPad and pen'))
  expect(screen.getByText(/Write on paper and show it to the camera/)).toBeVisible()
  expect(screen.getByText(/iPad microphone muted and speaker volume down/)).toBeVisible()
  expect(screen.getByText(/not a shared whiteboard built into this website/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Google Meet iPad screen sharing' })).toHaveAttribute(
    'href',
    'https://support.google.com/meet/answer/9308856?co=GENIE.Platform%3DiOS&hl=en',
  )
})

it('prepares Zoom locally without treating a pasted invitation as a paid booking', async () => {
  const user = userEvent.setup()
  const writes = vi.spyOn(Storage.prototype, 'setItem')
  const fetcher = vi.spyOn(window, 'fetch')
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  show()
  const field = screen.getByRole('textbox', { name: 'Zoom or Google Meet link, or meeting code' })
  const url = 'https://us06web.zoom.us/j/12345678901?pwd=ParticipantPass'
  await user.type(field, url)
  expect(screen.queryByRole('link', { name: 'Join lesson in Zoom' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Use this invitation' }))
  const join = screen.getByRole('link', { name: 'Join lesson in Zoom' })
  expect(join).toHaveAttribute('href', url)
  expect(join).toHaveAttribute('rel', 'noopener noreferrer')
  expect(join).toHaveFocus()
  expect(screen.getByRole('textbox', { name: 'Meeting code' })).toHaveValue('12345678901')
  expect(screen.getByText(/Pasting a link here does not confirm a booking/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Open my group booking' })).toHaveAttribute(
    'href',
    '/classes',
  )
  expect(open).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
  expect(writes).not.toHaveBeenCalled()
  await user.clear(field)
  await user.type(field, 'https://zoom.us/s/12345678901?zak=host')
  await user.click(screen.getByRole('button', { name: 'Use this invitation' }))
  expect(screen.queryByRole('link', { name: 'Join lesson in Zoom' })).toBeNull()
})
