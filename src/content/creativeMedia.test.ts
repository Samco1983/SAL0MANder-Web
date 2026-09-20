import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PUZZLE_LIBRARY } from './puzzleLibrary'
import { SOUND_LIBRARY, getPictureSound } from './soundLibrary'

const receipt = JSON.parse(
  readFileSync('docs/coordination/CREATIVE-MEDIA-SOURCES-2026-09-14.json', 'utf8'),
)
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex')

describe('September 14 optional creative media', () => {
  it('ships the inspected red-panda derivative with explicit AI labels and its own stable key', () => {
    const picture = PUZZLE_LIBRARY.find((item) => item.key === 'art-red-panda-waterfall')!
    expect(picture.name).toContain('AI artwork')
    expect(picture.alt).toMatch(/^AI-generated realistic artwork/)
    expect(picture.photoCredit).toBeUndefined()
    expect([picture.width, picture.height]).toEqual([720, 720])
    const entry = receipt.pictures.find((item: { key: string }) => item.key === picture.key)
    const bytes = readFileSync(join('public', picture.src))
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
    expect(bytes.toString('ascii', 8, 12)).toBe('WEBP')
    expect(bytes.length).toBeLessThan(200 * 1024)
    expect(bytes.length).toBe(entry.bytes)
    expect(digest(bytes)).toBe(entry.sha256)
    expect(entry.sourceSha256).toBe(
      '44fce5ee65acfd376d846ea6a2801770da8ddcfe642e96cba9e9f622950560f1',
    )
    expect(PUZZLE_LIBRARY.find((item) => item.key === 'red-panda')?.src).toBe(
      '/images/library/square/wildlife/red_panda_forest.webp',
    )
    expect(PUZZLE_LIBRARY[0]?.key).toBe('salamander-forest')
  })

  it('keeps the original cue byte-identical and within the existing PCM audio loader budget', () => {
    const sound = SOUND_LIBRARY.find((item) => item.key === 'streamside_discovery')!
    const entry = receipt.sounds.find((item: { key: string }) => item.key === sound.key)
    const bytes = readFileSync(join('public', sound.src))
    expect(bytes.length).toBeLessThan(12_000_000)
    expect(digest(bytes)).toBe('5ce757951e26a72e06a85af6e521fe574f349717f3157e84bda23d3f98a14c97')
    expect(digest(bytes)).toBe(entry.sha256)
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
    expect(bytes.toString('ascii', 8, 12)).toBe('WAVE')
    expect(bytes.toString('ascii', 12, 16)).toBe('fmt ')
    expect(bytes.readUInt16LE(20)).toBe(1)
    expect(bytes.readUInt16LE(22)).toBe(2)
    expect(bytes.readUInt32LE(24)).toBe(44100)
    expect(bytes.readUInt16LE(34)).toBe(16)
    expect(bytes.toString('ascii', 36, 40)).toBe('data')
    expect(bytes.readUInt32LE(40) / bytes.readUInt16LE(32) / bytes.readUInt32LE(24)).toBe(18)
    let peak = 0
    for (let offset = 44; offset < bytes.length; offset += 2)
      peak = Math.max(peak, Math.abs(bytes.readInt16LE(offset)))
    expect(peak).toBeLessThan(32767)
    expect(bytes.readInt32LE(44)).toBe(0)
    expect(bytes.readInt32LE(bytes.length - 4)).toBe(0)
  })

  it('offers manual preview without remapping the existing completion or picture sounds', () => {
    const sound = SOUND_LIBRARY.find((item) => item.key === 'streamside_discovery')!
    expect(sound.durationSeconds).toBe(18)
    expect(sound.previewSeconds).toBe(12)
    expect(sound.credit).toBeUndefined()
    expect(SOUND_LIBRARY[0]?.key).toBe('victory_warm_magic')
    expect(getPictureSound('art-red-panda-waterfall')).toBeUndefined()
    expect(getPictureSound('art-pug')?.key).toBe('dog-bark')
    expect(receipt.sounds[0].fullVocalSongsCompleted).toBe(false)
  })
})
