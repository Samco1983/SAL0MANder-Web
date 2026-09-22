import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DemoLevelControls } from './DemoLevelControls'
import { findDemoLevel } from '@content/demoLevels'
import { startKeyFor } from '@routes/guest-play/idempotency'

beforeEach(() => sessionStorage.clear())
const show = (id: string, completed: boolean, basename = '/') =>
  render(
    <MemoryRouter
      basename={basename}
      initialEntries={[basename === '/' ? '/play/' + id : basename + '/play/' + id]}
    >
      <DemoLevelControls level={findDemoLevel(id)!} completed={completed} />
    </MemoryRouter>,
  )
function clickWithoutLeaving(link: HTMLElement) {
  document.addEventListener('click', (event) => event.preventDefault(), { once: true })
  fireEvent.click(link)
}
describe('explicit demo progression controls', () => {
  it('labels Matching as four tiles at every level without implying jigsaw growth', () => {
    show('act_demo_matching_2', true)
    expect(screen.getByRole('status')).toHaveTextContent('Level 2 of 3 · Practice')
    expect(screen.getByRole('status')).toHaveTextContent('4 tiles · No questions')
    expect(screen.getByRole('status')).not.toHaveTextContent('9 pieces')
    expect(screen.getByRole('link', { name: 'Next level' })).toHaveAttribute(
      'href',
      '/play/act_demo_matching_3',
    )
    expect(screen.getByRole('link', { name: 'Easier level' })).toHaveAttribute(
      'href',
      '/play/act_demo_matching_1',
    )
  })
  it('shows current difficulty while withholding destructive navigation until completion', () => {
    show('act_demo_integer_1', false)
    expect(screen.getByRole('status')).toHaveTextContent('Level 1 of 3 · Warm-up')
    expect(screen.getByRole('status')).toHaveTextContent('4 pieces')
    expect(screen.queryByRole('link', { name: 'Next level' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Replay level' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Learning with Sam' })).toBeNull()
  })
  it('keeps Next, Replay and Easier in the current native series and deployment base', () => {
    show('act_demo_classic_2', true, '/school')
    expect(screen.getByRole('status')).toHaveTextContent('9 pieces · No questions')
    expect(screen.getByRole('link', { name: 'Next level' })).toHaveAttribute(
      'href',
      '/school/play/act_demo_classic_3',
    )
    expect(screen.getByRole('link', { name: 'Replay level' })).toHaveAttribute(
      'href',
      '/school/play/act_demo_classic_2',
    )
    expect(screen.getByRole('link', { name: 'Easier level' })).toHaveAttribute(
      'href',
      '/school/play/act_demo_classic_1',
    )
  })
  it('clears only the chosen destination attempt on an explicit click', () => {
    const id = 'act_demo_integer_1'
    const version = `${id}-v1`
    startKeyFor(version, () => 'finished-attempt')
    startKeyFor('act_demo_integer_2-v1', () => 'previous-next-attempt')
    startKeyFor('teacher-authored-v1', () => 'teacher-attempt')
    const view = show(id, true)
    view.rerender(
      <MemoryRouter>
        <DemoLevelControls level={findDemoLevel(id)!} completed />
      </MemoryRouter>,
    )
    expect(startKeyFor(version, () => 'unexpected')).toBe('finished-attempt')
    clickWithoutLeaving(screen.getByRole('link', { name: 'Tutoring with Sam' }))
    expect(startKeyFor(version, () => 'unexpected')).toBe('finished-attempt')
    clickWithoutLeaving(screen.getByRole('link', { name: 'Replay level' }))
    expect(startKeyFor(version, () => 'fresh-replay')).toBe('fresh-replay')
    expect(startKeyFor('act_demo_integer_2-v1', () => 'unexpected')).toBe('previous-next-attempt')
    clickWithoutLeaving(screen.getByRole('link', { name: 'Next level' }))
    expect(startKeyFor('act_demo_integer_2-v1', () => 'fresh-next')).toBe('fresh-next')
    expect(startKeyFor('teacher-authored-v1', () => 'unexpected')).toBe('teacher-attempt')
  })
  it('does not claim earlier levels were completed when Challenge was opened directly', () => {
    show('act_demo_linear_3', true)
    expect(screen.queryByRole('link', { name: 'Next level' })).toBeNull()
    expect(screen.getByText('Final level complete!')).toBeVisible()
    expect(screen.queryByText(/all.*levels complete/i)).toBeNull()
    expect(screen.getByRole('link', { name: 'Replay level' })).toBeVisible()
  })
})
