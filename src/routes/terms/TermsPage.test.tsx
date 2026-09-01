import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { TermsPage } from './TermsPage'
import { paths } from '@config/routes'

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>
    </ThemeProvider>,
  )

describe('terms page', () => {
  it('grants a teacher permission in plain words', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /what you may do/i })).toBeInTheDocument()
    // Matched on a function: the sentence is split by the {env.appName}
    // interpolation, so a plain string matcher misses it.
    expect(
      screen.getByText((_, el) => /with your own students, in class/i.test(el?.textContent ?? '') &&
        el?.tagName === 'LI'),
    ).toBeInTheDocument()
    expect(screen.getByText(/no permission needs to be requested/i)).toBeInTheDocument()
  })

  /**
   * The rule most Terms pages would break.
   *
   * `docs/coordination/TPT-RULES.md` records TPT's own wording: "TPT should not
   * be used as a way to drive traffic to another website or business," and the
   * practical line is that the page a scanned QR lands on must not sell
   * anything or advertise anything for sale. Rule 4 of that same doc says a
   * violation can get a listing deactivated and buyers refunded.
   *
   * So this page carries no price, no store, and no marketplace.
   */
  it('sells nothing, because a landing page that sells can cost the TPT listing', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\bbuy\b|\bpurchase\b|\bprice\b|\bpricing\b|\bsubscri/i)
    expect(text).not.toMatch(/teachers pay teachers|\bTPT\b/i)
    expect(container.querySelector('a[href*="teacherspayteachers"]')).toBeNull()
  })

  it('claims no compliance it cannot evidence', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    for (const word of [/COPPA/i, /FERPA/i, /WCAG/i, /\bcompliant\b/i, /certified/i]) {
      expect(text).not.toMatch(word)
    }
  })

  /**
   * TPT can deactivate a product whose linked resource stops working, so an
   * invented uptime figure is a promise this project cannot yet measure — and
   * it has already shipped a blank site past a green pipeline for three days.
   */
  it('is honest about availability instead of inventing an uptime promise', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    expect(text).toMatch(/do not promise a specific uptime/i)
    expect(text).not.toMatch(/99\.9|guaranteed uptime|always available/i)
  })

  it('states that students never make accounts, and links the detail', () => {
    renderPage()
    expect(screen.getByText(/students never create an account/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /privacy page/i })).toHaveAttribute(
      'href',
      paths.privacy,
    )
  })

  it('gives both contact addresses', () => {
    renderPage()
    expect(screen.getAllByRole('link', { name: 'support@sal0mander.com' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'privacy@sal0mander.com' })).toBeInTheDocument()
  })
})
