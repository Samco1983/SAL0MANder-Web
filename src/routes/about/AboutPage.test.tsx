import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { AboutPage } from './AboutPage'

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    </ThemeProvider>,
  )

describe('about page', () => {
  /**
   * "I'm a high school math teacher" is checkable in a way that "we believe in
   * engagement" is not, and it is the sentence that makes the rest credible to
   * a district reviewer.
   */
  it('says who wrote it', () => {
    renderPage()
    expect(screen.getByText(/high school math teacher/i)).toBeInTheDocument()
  })

  /**
   * Credibility is math; the product is not. Unity already ships cell biology
   * and vocabulary activities alongside quadratics, so a page implying a
   * math-only tool would be both inaccurate and self-limiting.
   */
  it('does not box the product into one subject', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    expect(text).toMatch(/never meant to stop there|any subject|different subjects/i)
    expect(text).toMatch(/vocabulary/i)
    expect(text).toMatch(/cell structure|science/i)
  })

  /**
   * A reader arriving without context — a filter's crawler, a teacher following
   * a QR code — should learn what this is before the story starts.
   */
  it('says what the product is before it says why', () => {
    const { container } = renderPage()
    const lede = container.querySelector('header p:last-of-type')?.textContent ?? ''
    expect(lede).toMatch(/answer questions/i)
    expect(lede).toMatch(/puzzle/i)
  })

  /**
   * TPT-RULES.md: the page a scanned QR lands on must not sell anything or
   * advertise anything for sale. Same guard as the terms page.
   */
  it('sells nothing', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\bbuy\b|\bpurchase\b|\bprice\b|\bpricing\b|\bsubscri/i)
    expect(text).not.toMatch(/teachers pay teachers|\bTPT\b/i)
  })

  it('claims no compliance it cannot evidence', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    for (const word of [/COPPA/i, /FERPA/i, /WCAG/i, /\bcompliant\b/i, /certified/i]) {
      expect(text).not.toMatch(word)
    }
  })

  /**
   * The line that makes the whole page believable. Anyone tempted to cut it for
   * being off-message should have to delete this test on purpose.
   */
  it('keeps the sentence that makes it credible', () => {
    renderPage()
    // Function matcher: the sentence is split by the {env.appName}
    // interpolation, so a string matcher misses it.
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' && /don.t think .* is the answer to education/i.test(el.textContent ?? ''),
      ),
    ).toBeInTheDocument()
  })

  it('offers a way to reach a person', () => {
    renderPage()
    expect(screen.getAllByRole('link', { name: 'samco1983@gmail.com' })).toHaveLength(2)
  })
})
