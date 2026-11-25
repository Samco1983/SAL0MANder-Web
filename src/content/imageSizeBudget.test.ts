import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PUZZLE_LIBRARY } from './puzzleLibrary'

/**
 * Parses natural pixel dimensions from a RIFF WebP header (VP8, VP8L, or VP8X)
 * without external native dependencies.
 */
function readWebpDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath)
  expect(buf.toString('ascii', 0, 4), `${filePath} must be RIFF`).toBe('RIFF')
  expect(buf.toString('ascii', 8, 12), `${filePath} must be WEBP`).toBe('WEBP')
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') {
    // Lossy VP8 frame: 10-byte frame header starts at offset 20; width/height at offsets 26 & 28.
    const width = buf.readUInt16LE(26) & 0x3fff
    const height = buf.readUInt16LE(28) & 0x3fff
    return { width, height }
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return { width, height }
  }
  if (chunk === 'VP8X') {
    const width = 1 + buf.readUIntLE(24, 3)
    const height = 1 + buf.readUIntLE(27, 3)
    return { width, height }
  }
  throw new Error(`Unsupported WebP chunk "${chunk}" in ${filePath}`)
}

describe('school-Chromebook image size budgets', () => {
  it('matches declared PUZZLE_LIBRARY dimensions on disk and keeps every picture compact', () => {
    let totalBytes = 0
    for (const picture of PUZZLE_LIBRARY) {
      const fullPath = join('public', picture.src)
      expect(existsSync(fullPath), `${picture.src} must exist`).toBe(true)
      const bytes = statSync(fullPath).size
      totalBytes += bytes
      expect(bytes, `${picture.src} is ${Math.round(bytes / 1024)} KiB`).toBeLessThan(165 * 1024)
      const dims = readWebpDimensions(fullPath)
      expect(dims, `${picture.src} dimensions drifted from metadata`).toEqual({
        width: picture.width,
        height: picture.height,
      })
    }
    expect(totalBytes, `library total is ${Math.round(totalBytes / 1024)} KiB`).toBeLessThan(
      2050 * 1024,
    )
  })

  it('keeps the home hero and default first-game rover picture under 55 KiB', () => {
    const rover = PUZZLE_LIBRARY.find((p) => p.key === 'sal0mander-rover-expedition')
    expect(rover).toBeDefined()
    const bytes = statSync(join('public', rover!.src)).size
    expect(bytes).toBeLessThan(55 * 1024)
  })

  it('serves Moon Gate active stage and cover artwork as compact WebP assets', () => {
    const stageWebp = join('public', 'arcade', 'moon-gate', 'assets', 'stage.webp')
    const posterWebp = join('public', 'arcade', 'moon-gate', 'assets', 'poster.webp')
    expect(existsSync(stageWebp)).toBe(true)
    expect(existsSync(posterWebp)).toBe(true)
    expect(statSync(stageWebp).size).toBeLessThan(25 * 1024)
    expect(statSync(posterWebp).size).toBeLessThan(30 * 1024)
    expect(readWebpDimensions(stageWebp)).toEqual({ width: 960, height: 540 })

    const gameJs = readFileSync(join('public', 'arcade', 'moon-gate', 'game.js'), 'utf8')
    const styleCss = readFileSync(join('public', 'arcade', 'moon-gate', 'style.css'), 'utf8')
    expect(gameJs).toContain('assets/stage.webp')
    expect(gameJs).not.toContain('assets/stage.png')
    expect(styleCss).toContain('assets/stage.webp')
    expect(styleCss).not.toContain('assets/stage.png')
  })

  it('keeps Neon Dash horizon layers and the Arcade hub HTML trimmed for school Wi-Fi', () => {
    for (const file of ['horizon0.webp', 'horizon1.webp', 'horizon2.webp']) {
      const fullPath = join('public', 'arcade', 'neon-dash', file)
      expect(existsSync(fullPath), `${file} must exist`).toBe(true)
      expect(statSync(fullPath).size, `${file} should stay under 20 KiB`).toBeLessThan(20 * 1024)
    }

    const arcadeHubPath = join('public', 'arcade', 'index.html')
    const hubHtml = readFileSync(arcadeHubPath, 'utf8')
    expect(statSync(arcadeHubPath).size).toBeLessThan(70 * 1024)
    expect(hubHtml).not.toContain('data:image/jpeg;base64,')
    expect(hubHtml).toContain('data:image/webp;base64,')
  })
})
