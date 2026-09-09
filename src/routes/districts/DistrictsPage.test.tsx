import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { DistrictsPage } from './DistrictsPage'

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <DistrictsPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('DistrictsPage', () => {
  it('renders technical summary and allowlist domain', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /technical and data summary/i })).toBeInTheDocument()
    expect(screen.getAllByText('sal0mander.com').length).toBeGreaterThanOrEqual(1)
  })

  it('lists local storage keys without promising accounts', () => {
    renderPage()
    expect(screen.getByText('sal0mander.guest.token')).toBeInTheDocument()
    expect(screen.getByText('sal0mander.guest.displayName')).toBeInTheDocument()
    expect(screen.getByText('sal0mander.theme')).toBeInTheDocument()
    expect(screen.getByText('sal0mander.companion.collapsed')).toBeInTheDocument()
    expect(screen.getByText('sal0mander.studio.drafts')).toBeInTheDocument()
  })

  it('provides contact links for district IT staff', () => {
    renderPage()
    const mailto = screen.getByRole('link', { name: 'samco1983@gmail.com' })
    expect(mailto).toHaveAttribute('href', 'mailto:samco1983@gmail.com')
  })

  it('retains education classification and accessibility review information', () => {
    renderPage()
    expect(screen.getByText('Education / classroom learning')).toBeInTheDocument()
    expect(screen.getByText('www.sal0mander.com')).toBeInTheDocument()
    expect(screen.getByText(/do not claim formal WCAG conformance/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'accessibility page' })).toHaveAttribute(
      'href',
      '/accessibility/',
    )
  })
})
