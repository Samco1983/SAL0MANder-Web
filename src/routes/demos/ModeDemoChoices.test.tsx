import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModeDemoChoices } from './ModeDemoChoices'

describe('four public games with one combined swapping game', () => {
  it.each(['/', '/school'])('provides honest sample destinations under %s', (base) => {
    render(
      <MemoryRouter basename={base} initialEntries={[base]}>
        <ModeDemoChoices />
      </MemoryRouter>,
    )
    const region = screen.getByRole('region', { name: 'Try every way to play' })
    const links = within(region).getAllByRole('link')
    const prefix = base === '/' ? '' : base
    expect(links).toHaveLength(4)
    expect(links.map((link) => link.querySelector('strong')?.textContent)).toEqual([
      'Mystery Pictures',
      'Learning Puzzle',
      'Classic Jigsaw',
      'Swap & Solve',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      [
        '/play/act_demo_integer_1',
        '/play/act_demo_integer_1',
        '/play/act_demo_classic_1',
        '/demos/slide',
      ].map((destination) => prefix + destination),
    )
    expect(links[0]).toHaveTextContent('Choose Mystery Reveal in the game')
    expect(links[1]).toHaveTextContent('Choose Learning Puzzle in the game')
    expect(links[3]).toHaveTextContent('8 levels')
    expect(links[3]).toHaveTextContent('blanks → full 3×3 → full 4×4')
    expect(region).not.toHaveTextContent('Matching')
    expect(
      links.every((link) => !/gifts|classes|classroom|login/.test(link.getAttribute('href') ?? '')),
    ).toBe(true)
  })
})
