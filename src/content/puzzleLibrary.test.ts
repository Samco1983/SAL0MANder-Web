import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PUZZLE_LIBRARY } from './puzzleLibrary'

/**
 * The four ways an image on this page can be wrong.
 *
 * A missing file, a third-party host, a picture heavy enough to hurt a class
 * starting at once on school wifi, and alt text that describes nothing. None of
 * them look wrong in a code review, and the first two do not look wrong in
 * local development either.
 */
describe('the puzzle picture library', () => {
  it('points at files that exist', () => {
    for (const picture of PUZZLE_LIBRARY) {
      const onDisk = join('public', picture.src)
      expect(existsSync(onDisk), `${picture.src} is referenced but not in public/`).toBe(true)
    }
  })

  /**
   * Single origin is one of the stronger things this site has to offer a
   * district: `DistrictsPage` and the privacy page both state that the browser
   * contacts exactly one domain. A CDN-hosted image would quietly make both
   * pages wrong and add a host to every allow-list request.
   */
  it('serves every picture from this domain', () => {
    for (const picture of PUZZLE_LIBRARY) {
      expect(picture.src, `${picture.src} is not same-origin`).toMatch(/^\/images\//)
      expect(picture.src).not.toMatch(/^https?:\/\//)
    }
  })

  /**
   * A class of thirty opening the same link on school wifi is the load this has
   * to survive. The originals were ~1.2 MB each; the ceiling here is what keeps
   * a later "just drop the full-size one in" from going unnoticed.
   */
  it('keeps every picture small enough for a class to load at once', () => {
    let total = 0
    for (const picture of PUZZLE_LIBRARY) {
      const bytes = statSync(join('public', picture.src)).size
      total += bytes
      expect(bytes, `${picture.src} is ${Math.round(bytes / 1024)} KB`).toBeLessThan(200 * 1024)
    }
    expect(total, `the gallery totals ${Math.round(total / 1024)} KB`).toBeLessThan(700 * 1024)
  })

  /**
   * Alt text is what a screen-reader user gets instead of the picture, and it
   * is most of what a filter's classifier can read on a JavaScript-rendered
   * page. "Puzzle image" satisfies a linter and communicates nothing to either.
   */
  it('describes the scene rather than the file', () => {
    for (const picture of PUZZLE_LIBRARY) {
      expect(picture.alt.length, `${picture.src} has thin alt text`).toBeGreaterThan(40)
      expect(picture.alt).not.toMatch(/^(image|picture|photo|puzzle)( of)?$/i)
      expect(picture.alt, 'alt text describes the subject, not the mechanic').not.toMatch(
        /puzzle (image|picture)|jigsaw image/i,
      )
    }
  })

  it('gives every picture the dimensions that stop the page jumping', () => {
    for (const picture of PUZZLE_LIBRARY) {
      expect(picture.width).toBeGreaterThan(0)
      expect(picture.height).toBeGreaterThan(0)
    }
  })

  /**
   * The two images with jigsaw cut lines painted into the pixels.
   *
   * They are a few hundred fake pieces baked into the artwork. SAL0MANder's
   * activities are nine pieces and Unity draws its own edges, so either one
   * shows a student a puzzle inside a puzzle and promises a piece count the
   * product does not have. Named here because the rejection is a judgement
   * nobody would rediscover from the filenames.
   */
  it('excludes the two images with puzzle cuts baked into them', () => {
    const srcs = PUZZLE_LIBRARY.map((p) => p.src).join(' ')
    for (const rejected of ['panther_chameleon_rainforest', 'robot_alien_crystals']) {
      expect(srcs, `${rejected} has jigsaw lines in the artwork`).not.toContain(rejected)
    }
    for (const rejected of [
      'public/images/library/square/photo/panther_chameleon_rainforest.webp',
      'public/images/library/landscape/cartoon/robot_alien_crystals.webp',
    ]) {
      expect(existsSync(rejected), `${rejected} should not have been shipped`).toBe(false)
    }
  })

  /**
   * Unity owns which picture an activity uses, through `imagePresetIndex` in
   * `CreateDemoActivity`. Captioning one of these as a particular activity's
   * puzzle would be a claim this repository cannot check, and would go stale
   * silently the first time a preset changed.
   */
  it('claims no picture belongs to a particular activity', () => {
    for (const picture of PUZZLE_LIBRARY) {
      expect(picture.alt).not.toMatch(/act_[a-z_]+/)
      expect(picture.alt).not.toMatch(/integer operations|inequalit|linear equation/i)
    }
  })
})
