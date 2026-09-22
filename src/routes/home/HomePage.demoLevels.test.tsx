import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { HomePage } from './HomePage'
describe('Home native level entry points', () => {
  it('routes public math actions to warm-ups and Classic to its no-question course', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </ThemeProvider>,
    )
    const activities = screen.getByRole('region', { name: 'Activities you can try right now' })
    expect(
      within(activities)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/play/act_demo_integer_1',
      '/play/act_demo_inequality_1',
      '/play/act_demo_linear_1',
    ])
    const options = within(screen.getByRole('region', { name: 'Choose how to play' })).getAllByRole(
      'link',
      { name: 'Open demo options' },
    )
    expect(options.map((link) => link.getAttribute('href'))).toEqual([
      '/play/act_demo_integer_1',
      '/play/act_demo_integer_1',
      '/play/act_demo_classic_1',
    ])
    expect(screen.getByRole('link', { name: /Puzzle Practice.*Play a demo/ })).toHaveAttribute(
      'href',
      '/play/act_demo_integer_1',
    )
    expect(screen.queryByLabelText(/email|password/i)).toBeNull()
  })
})
