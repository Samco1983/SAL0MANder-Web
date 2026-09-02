import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync('src/design/tokens.css', 'utf8')
const base = readFileSync('src/design/base.css', 'utf8')

/**
 * The scrollbar has to be visible before it can be useful.
 *
 * macOS and iOS hide scrollbars until you are already scrolling, so a list that
 * ran past its container looked finished. These are the three ways the fix
 * silently stops working, all three of which were live at some point while
 * writing it.
 */
describe('scrollbars', () => {
  /**
   * The one that cost the most time. Chrome ignores `::-webkit-scrollbar`
   * entirely on any element where the standard `scrollbar-color` or
   * `scrollbar-width` is set — the standard property wins and the browser draws
   * its own overlay bar. Setting both "for coverage" therefore disables the
   * half that does the work, with no warning anywhere.
   *
   * Measured: with both present, a forced `overflow-y: scroll` element reported
   * `offsetWidth - clientWidth === 0`. Fenced apart, 14px.
   */
  it('never sets the standard scrollbar properties outside a Firefox-only fence', () => {
    // Everything before the @supports fence and outside the forced-colors reset.
    const fenceStart = base.indexOf('@supports not selector(::-webkit-scrollbar)')
    expect(fenceStart, 'the Firefox fence is gone').toBeGreaterThan(-1)

    // Comments stripped, and matched anywhere rather than at the start of a
    // line. The first version of this assertion anchored to `^\s*` and a
    // single-line `* { scrollbar-color: ... }` walked straight past it — the
    // test passed against the exact defect it exists to catch.
    const declarations = base
      .slice(0, fenceStart)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .match(/scrollbar-(color|width)\s*:/g)

    expect(
      declarations,
      'an unfenced scrollbar-color/width disables ::-webkit-scrollbar in Chrome',
    ).toBeNull()
  })

  it('styles the webkit pseudo-elements, which is what defeats overlay scrollbars', () => {
    for (const rule of [
      '::-webkit-scrollbar {',
      '::-webkit-scrollbar-track {',
      '::-webkit-scrollbar-thumb {',
    ]) {
      expect(base).toContain(rule)
    }
    expect(base).toContain('width: var(--scrollbar-size)')
  })

  /**
   * A thumb the same colour as its track, or a track the same colour as the
   * surface behind it, is a scrollbar nobody can see — which is the exact
   * problem this set out to fix.
   *
   * This caught a real one: the dark track was `--neutral-900`, and
   * `--color-surface` in dark is ALSO `--neutral-900`. The groove disappeared
   * into the page and the thumb floated on nothing. Visible in a browser,
   * invisible in a render test, and impossible to spot by reading either
   * declaration alone.
   */
  it('gives every theme a track that differs from its own surface', () => {
    const blocks = tokens.split(/(?=:root|@media \(prefers-color-scheme: dark\))/)
    let checked = 0

    for (const block of blocks) {
      const track = /--color-scrollbar-track:\s*var\((--[\w-]+)\)/.exec(block)?.[1]
      const surface = /--color-surface:\s*var\((--[\w-]+)\)/.exec(block)?.[1]
      if (!track || !surface) continue

      checked += 1
      expect(track, `the scrollbar track resolves to the same value as the surface (${track})`).not.toBe(surface)
    }

    expect(checked, 'no theme block declared both a track and a surface').toBeGreaterThan(0)
  })

  it('hands the scrollbar back to the OS in forced-colours mode', () => {
    // A brand green pushed through High Contrast is no longer the brand green,
    // and can land on a background it does not contrast with.
    expect(base).toContain('@media (forced-colors: active)')
  })

  /**
   * 14px rather than the ~7px default. The people using this are students on
   * school Chromebooks and trackpads, and a 7px grab target is a miss for
   * anyone with imprecise pointing.
   */
  it('keeps the bar wide enough to actually grab', () => {
    const size = /--scrollbar-size:\s*(\d+)px/.exec(tokens)?.[1]
    expect(size, 'no --scrollbar-size declared').toBeDefined()
    expect(Number(size)).toBeGreaterThanOrEqual(12)
  })
})
