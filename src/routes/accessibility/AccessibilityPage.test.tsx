import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { AccessibilityPage } from './AccessibilityPage'

describe('AccessibilityPage', () => {
  it('states current support and limitations without claiming conformance', () => {
    render(<ThemeProvider><MemoryRouter><AccessibilityPage /></MemoryRouter></ThemeProvider>)
    expect(screen.getByRole('heading', { name: /making sal0mander easier/i })).toBeInTheDocument()
    expect(screen.getByText(/do not claim WCAG conformance/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'samco1983@gmail.com' })).toHaveAttribute('href', 'mailto:samco1983@gmail.com')
  })
})
