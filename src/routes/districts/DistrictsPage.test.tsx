import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { DistrictsPage } from './DistrictsPage'

describe('DistrictsPage', () => {
  it('provides an education classification, allowlist domain, and review contact', () => {
    render(<ThemeProvider><MemoryRouter><DistrictsPage /></MemoryRouter></ThemeProvider>)
    expect(screen.getByText('Education / classroom learning')).toBeInTheDocument()
    expect(screen.getAllByText('sal0mander.com').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'samco1983@gmail.com' })).toHaveAttribute('href', 'mailto:samco1983@gmail.com')
    expect(screen.getByText(/do not claim formal WCAG conformance/i)).toBeInTheDocument()
  })
})
