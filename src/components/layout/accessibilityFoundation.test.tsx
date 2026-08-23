import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { AppShell } from './AppShell'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { Button } from '@components/ui/Button'

/**
 * Regression cover for the accessibility foundation.
 *
 * Every invariant asserted here already worked when this file was written. That
 * is the point: they were also entirely unprotected, so a single careless edit
 * would remove any of them with no test turning red and no visible symptom in
 * development. A student on a Chromebook with a dead trackpad finds out first.
 *
 * The CSS assertions read the stylesheet as text because jsdom does not apply
 * media queries. Reading the source is weaker than a browser check, but it does
 * catch the failure that actually happens: someone deletes the rule.
 */

const designDir = resolve(__dirname, '../../design')
const readCss = (file: string) => readFileSync(resolve(designDir, file), 'utf8')

function renderShell(children = <h1>Page</h1>) {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <AppShell>{children}</AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('landmarks', () => {
  it('exposes the standard landmarks so a screen reader can jump between regions', () => {
    renderShell()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('gives main an id, because the skip link is useless without a target', () => {
    renderShell()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('keeps deployment diagnostics available during local development', () => {
    renderShell()
    // Asserts the diagnostics line is PRESENT and complete, not which transport
    // happens to be wired. It previously pinned `api: mock`, which made it fail
    // the moment VITE_API_BASE_URL was set to point at a real endpoint — a
    // legitimate config change, not a regression in diagnostics. The transport
    // in use is deliberately still shown, because "which backend am I talking
    // to" is the first question when a page misbehaves.
    expect(screen.getByText(/env: local/i)).toHaveTextContent(
      /env: local · contract: v1 · api: \w+/,
    )
  })
})

describe('the skip link', () => {
  it('is the first thing a keyboard user reaches', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.tab()
    const focused = document.activeElement as HTMLElement
    expect(focused.tagName).toBe('A')
    expect(focused.getAttribute('href')).toBe('#main')
  })

  it('points at a target that exists in the document', () => {
    renderShell()
    const skip = screen.getByRole('link', { name: /skip/i })
    const target = skip.getAttribute('href')?.replace('#', '')
    expect(target).toBeTruthy()
    expect(document.getElementById(target!)).not.toBeNull()
  })
})

describe('reduced motion', () => {
  const base = readCss('base.css')

  it('honours prefers-reduced-motion globally, not per component', () => {
    // A per-component approach means every new stylesheet is a new chance to
    // forget. The global rule is why UnityStage, CompanionLayout and tokens.css
    // are safe without each carrying its own guard.
    expect(base).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })

  it('neutralises animation, transition and smooth scrolling together', () => {
    const block = base.slice(base.indexOf('prefers-reduced-motion'))
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/)
  })

  it('applies to pseudo-elements, which are easy to miss and do animate', () => {
    const block = base.slice(base.indexOf('prefers-reduced-motion'))
    expect(block).toMatch(/\*::before/)
    expect(block).toMatch(/\*::after/)
  })
})

describe('focus visibility', () => {
  it('keeps a visible focus indicator rather than removing the outline', () => {
    const base = readCss('base.css')
    expect(base).toMatch(/:focus-visible/)
    // `outline: none` with no replacement is the single most common way a
    // keyboard user is stranded with no idea where they are on the page.
    const strippedOutline = /:focus(?!-visible)[^{]*\{[^}]*outline:\s*(none|0)/
    expect(base).not.toMatch(strippedOutline)
  })
})

describe('touch targets', () => {
  const buttonCss = readFileSync(resolve(__dirname, '../ui/Button.module.css'), 'utf8')

  it('gives every button size a minimum height, including the small one', () => {
    const minHeights = [...buttonCss.matchAll(/min-height:\s*([\d.]+)rem/g)].map((m) =>
      Number(m[1]),
    )
    expect(minHeights.length).toBeGreaterThanOrEqual(3)
    // 2.25rem = 36px at default root size. Below that, a finger on a shared
    // classroom tablet misses more often than it hits.
    for (const height of minHeights) {
      expect(height).toBeGreaterThanOrEqual(2.25)
    }
  })

  it('renders a real button element so it is reachable and activatable', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <Button>Press me</Button>
      </ThemeProvider>,
    )
    const button = screen.getByRole('button', { name: /press me/i })
    await user.tab()
    expect(button).toHaveFocus()
  })

  const shellCss = readFileSync(resolve(__dirname, './AppShell.module.css'), 'utf8')

  it('puts the 44px touch floor on the shared Button, not on each caller', () => {
    // Issue #53. #48 scoped its fix to `.navLink`, so every control outside the
    // shell nav stayed at the `sm` size's 36px — the theme toggle and the
    // companion toggle were both found under the floor afterwards, on the
    // student surface.
    //
    // The floor now lives on the shared component, so a NEW small button cannot
    // ship under the minimum. This asserts that, because the alternative is
    // finding the same defect a fourth time in whatever gets built next.
    const coarse = buttonCss.match(/@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\n\}/)
    expect(coarse, 'the pointer: coarse floor was removed from Button').not.toBeNull()
    const minHeight = coarse?.[0].match(/min-height:\s*(\d+)px/)
    expect(Number(minHeight?.[1])).toBeGreaterThanOrEqual(44)
  })

  it('leaves the compact desktop button alone', () => {
    // The floor must apply only to coarse pointers. A mouse keeps the 36px
    // control; fattening every button on desktop is a real regression.
    const outsideCoarse = buttonCss.replace(/@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\n\}/, '')
    expect(outsideCoarse).toMatch(/\.sm\s*\{[\s\S]*?min-height:\s*2\.25rem/)
  })

  it('floors the shell nav links at 44px on touch pointers', () => {
    // Issue #48: measured at 38px on the live site. Every primary nav link
    // (Home, Play, Profile, WebGL Host, System) was under the WCAG 2.5.5 and
    // Apple HIG minimum, for students on shared tablets.
    const coarse = shellCss.match(/@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\n\}/)
    expect(coarse, 'the pointer: coarse block was removed').not.toBeNull()
    expect(coarse?.[0]).toMatch(/\.navLink\b/)
    const minHeight = coarse?.[0].match(/min-height:\s*(\d+)px/)
    expect(Number(minHeight?.[1])).toBeGreaterThanOrEqual(44)
  })

  it('gates the floor on pointer, not width, so landscape tablets are covered', () => {
    // A 10" tablet in landscape is wider than the mobile breakpoint and is
    // still a finger. Gating on max-width would leave the primary device — the
    // one this product is actually used on — unfixed.
    expect(shellCss).toMatch(/@media\s*\(pointer:\s*coarse\)/)
  })

  it('leaves the desktop header alone, so nothing fattens on a mouse', () => {
    // min-height on .navLink must live inside the coarse-pointer block only.
    const outsideCoarse = shellCss.replace(/@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\n\}/, '')
    const navLinkBase = outsideCoarse.match(/\.navLink\s*\{[\s\S]*?\}/)?.[0] ?? ''
    expect(navLinkBase).not.toMatch(/min-height/)
  })
})

describe('the rebrand rule', () => {
  /*
   * CLAUDE.md: components consume SEMANTIC tokens, never primitives, so a
   * rebrand touches design/tokens.css alone.
   *
   * That held everywhere except UnityStage.module.css, which used six
   * primitives — not carelessness, but because the stage had only two
   * on-surface tokens and a dark canvas needs four. The fix was to name the
   * missing roles rather than to scold the file.
   *
   * Asserted across EVERY module stylesheet rather than a named list, because
   * the next violation will be in whatever file is written next.
   */
  it('no component stylesheet reaches for a primitive colour token', () => {
    const dir = resolve(__dirname, '../..')
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? walk(resolve(d, e.name))
          : e.name.endsWith('.module.css')
            ? [resolve(d, e.name)]
            : [],
      )
    const offenders = walk(dir).filter((f) =>
      /var\(--(neutral|blue|green|red|amber|purple)-\d/.test(readFileSync(f, 'utf8')),
    )
    expect(offenders.map((f) => f.replace(dir, ''))).toEqual([])
  })
})
