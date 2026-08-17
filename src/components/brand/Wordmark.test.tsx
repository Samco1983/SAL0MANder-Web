import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wordmark } from './Wordmark'

describe('Wordmark', () => {
  it('reads as the company name, not as an image', () => {
    // Drawn from text and SVG, so a screen reader should announce the name
    // rather than "graphic". The letter spans are hidden to stop it being
    // spelled out as "SAL, MAN, der".
    render(<Wordmark />)
    expect(screen.getByRole('img', { name: 'SAL0MANder Studios' })).toBeInTheDocument()
  })

  it('can drop the Studios suffix for tight placements', () => {
    const { container } = render(<Wordmark showStudios={false} />)
    expect(container.textContent).not.toMatch(/studios/i)
    // The name itself is unchanged, so the label still identifies the brand.
    expect(screen.getByRole('img', { name: /SAL0MANder/ })).toBeInTheDocument()
  })

  it('keeps the letterforms out of the accessibility tree', () => {
    const { container } = render(<Wordmark />)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })
})
