import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MusicPlaylistSchema, resolveGamePlaylist } from './musicPlaylist'

const ROOT = process.cwd()
const DASH_DIR = resolve(ROOT, 'public', 'arcade', 'sal0mander-dash')
const LEGACY_DIR = resolve(ROOT, 'public', 'arcade', 'neon-dash')
const PLAYLIST_PATH = resolve(ROOT, 'public', 'audio', 'music-playlist.json')

interface DashLevel {
  level: number
  id: string
  name: string
  subtitle: string
  defaultSong: string
  fallbackBpm: number
  speedScale: number
  beatOffset: number
  durationBeats: number
  accentBeats: number[]
  sectors: string[]
  rows: string[]
}

interface CircuitInstance {
  bpm: number
  speed: number
  tick: number
  dead: string
  finished: boolean
  progress: number
  prisms: number
  total: number
  cues: number[]
  jump: () => void
  advance: () => void
}

type CircuitModule = {
  STEP: number
  speedForBpm: (bpm: number, speedScale?: number) => number
  Circuit: new (score: DashLevel, options?: { bpm?: number }) => CircuitInstance
}

async function loadCircuitModule(): Promise<CircuitModule> {
  // Dynamic import of the runtime ES module directly from public/arcade/sal0mander-dash/circuit.js
  const mod = (await import(
    /* @vite-ignore */ pathToFileURL(resolve(DASH_DIR, 'circuit.js')).href
  )) as CircuitModule
  return mod
}

describe('SAL0MANder Dash (5 BPM-matched levels & legacy redirect)', () => {
  it('finishes 100% of all 5 levels cleanly on the beat at their playlist BPMs and up to 150 BPM', async () => {
    const { Circuit, STEP, speedForBpm } = await loadCircuitModule()
    const playlist = MusicPlaylistSchema.parse(JSON.parse(readFileSync(PLAYLIST_PATH, 'utf8')))
    const dashPlaylist = resolveGamePlaylist(playlist, 'sal0mander-dash', '/')
    expect(dashPlaylist).not.toBeNull()

    const coursesData = JSON.parse(readFileSync(resolve(DASH_DIR, 'courses.json'), 'utf8')) as {
      levels: DashLevel[]
    }
    expect(coursesData.levels).toHaveLength(5)

    // Verify faster BPM strictly produces faster scroll speed.
    expect(speedForBpm(106)).toBeGreaterThan(speedForBpm(96))
    expect(speedForBpm(115)).toBeGreaterThan(speedForBpm(106))
    expect(speedForBpm(150)).toBeGreaterThan(speedForBpm(115))

    const runBeatBot = (lvl: DashLevel, bpm: number) => {
      const r = new Circuit(lvl, { bpm })
      const cueTicks = new Set(r.cues.map((t) => Math.round(t / STEP)))
      while (!r.dead && !r.finished) {
        if (cueTicks.has(r.tick)) r.jump()
        r.advance()
      }
      return r
    }

    for (const lvl of coursesData.levels) {
      const mapped = dashPlaylist!.levels?.[String(lvl.level)]
      expect(mapped, `level ${lvl.level} missing in music-playlist.json`).toBeDefined()
      const bpm = mapped!.track.bpm!
      expect(bpm).toBeGreaterThanOrEqual(90)

      const sim = runBeatBot(lvl, bpm)
      expect(sim.dead, `L${lvl.level} ${lvl.name} died at ${bpm} BPM: ${sim.dead}`).toBe('')
      expect(sim.finished, `L${lvl.level} ${lvl.name} did not finish at ${bpm} BPM`).toBe(true)
      expect(sim.prisms, `L${lvl.level} prisms collected`).toBe(sim.total)

      // Stress-test faster BPMs so swapping in a faster song in music-playlist.json stays fair.
      for (const stressBpm of [128, 140, 150]) {
        const stress = runBeatBot(lvl, stressBpm)
        expect(
          stress.dead,
          `L${lvl.level} ${lvl.name} failed stress test at ${stressBpm} BPM: ${stress.dead}`,
        ).toBe('')
        expect(stress.finished).toBe(true)
      }
    }
  })

  it('replays Mr. Sam ghost run (sam-run.json) cleanly on Level 1', async () => {
    const { Circuit } = await loadCircuitModule()
    const coursesData = JSON.parse(readFileSync(resolve(DASH_DIR, 'courses.json'), 'utf8')) as {
      levels: DashLevel[]
    }
    const samRun = JSON.parse(readFileSync(resolve(DASH_DIR, 'sam-run.json'), 'utf8')) as {
      name: string
      level: number
      bpm: number
      jumps: number[]
      progress: number
    }
    expect(samRun.name).toBe('Mr. Sam')
    expect(samRun.level).toBe(1)
    expect(samRun.jumps.length).toBeGreaterThan(10)

    const r = new Circuit(coursesData.levels[0]!, { bpm: samRun.bpm })
    const jumpSet = new Set(samRun.jumps)
    while (!r.dead && !r.finished) {
      if (jumpSet.has(r.tick)) r.jump()
      r.advance()
    }
    expect(r.progress).toBeGreaterThan(0.5)
  })

  it('uses SAL0MANder (with ZERO) and Mr. Sam, drops hyperjump.mp3, and preserves kid-safety + legacy redirect', () => {
    const html = readFileSync(resolve(DASH_DIR, 'index.html'), 'utf8')
    const js = readFileSync(resolve(DASH_DIR, 'game.js'), 'utf8')
    const legacyHtml = readFileSync(resolve(LEGACY_DIR, 'index.html'), 'utf8')

    expect(html).toContain('SAL0MANder Dash')
    expect(html).toContain('SAL<span class="zero">0</span>MANder')
    expect(existsSync(resolve(DASH_DIR, 'hyperjump.mp3'))).toBe(false)

    // No Coach Sam, no hyperjump, no Kings River anywhere in sal0mander-dash/
    for (const file of readdirSync(DASH_DIR)) {
      if (!/\.(html|js|css|json)$/.test(file)) continue
      const content = readFileSync(resolve(DASH_DIR, file), 'utf8')
      expect(content, `${file} contains Coach Sam`).not.toMatch(/coach\s+sam/i)
      expect(content, `${file} references hyperjump`).not.toMatch(/hyperjump/i)
      expect(content, `${file} references forbidden school name`).not.toMatch(/kings\s*river/i)
    }

    // Online face safety invariant: face travels strictly as an integer.
    expect(js).toMatch(/fc:\s*myFace/)
    expect(js).toMatch(/Number\.isInteger\(m\.fc\)/)

    // Legacy /arcade/neon-dash/ redirects cleanly to /arcade/sal0mander-dash/ preserving query + hash.
    expect(legacyHtml).toContain('../sal0mander-dash/')
    expect(legacyHtml).toContain('location.search')
    expect(legacyHtml).toContain('location.hash')
  })
})
