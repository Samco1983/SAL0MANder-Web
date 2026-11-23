// Kid-safety guard for the SAL0MANder Arcade (added by Claude4, Nov 23 2026; owner: Samuel).
// These are Samuel's standing rules. If a change breaks one, this test fails and the site does not deploy.
// Read docs/arcade/KID-SAFETY-RULES.md before changing anything under public/arcade.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const ARCADE = join(ROOT, 'public', 'arcade')
const PICTURE_FILE = 'public/arcade/moon-gate/mask.js' // the ONLY place a picture may be chosen (offline, parent OK)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(js|mjs|html)$/.test(name)) out.push(p)
  }
  return out
}
const files = walk(ARCADE).map(p => ({ path: relative(ROOT, p).split('\\').join('/'), text: readFileSync(p, 'utf8') }))
const offenders = (re, allow = []) => files.filter(f => !allow.includes(f.path) && re.test(f.text)).map(f => f.path)

describe('arcade kid-safety rules', () => {
  it('never uses a camera, microphone or screen/stream recording', () => {
    expect(offenders(/getUserMedia|getDisplayMedia|MediaRecorder|captureStream|navigator\.mediaDevices/)).toEqual([])
  })

  it('only Moon Gate Mask Maker may let a user pick a picture', () => {
    expect(offenders(/type\s*=\s*["']file["']|\.type\s*=\s*['"]file['"]|FileReader|showOpenFilePicker/, [PICTURE_FILE])).toEqual([])
  })

  it('the picture face stays offline, parent-gated and out of the fight state', () => {
    const mask = files.find(f => f.path === PICTURE_FILE)
    if (!mask) return // no picture feature at all is also fine
    expect(mask.text).toMatch(/MoonGateOnline\?\.state\(\)\?\.on/) // online matches always use the classic mask
    expect(mask.text).toMatch(/photo-ok/) // a parent must tick the box first
    expect(mask.text).not.toMatch(/\bmatch\./) // never stored on the match object (online snapshots copy it)
    expect(mask.text).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/) // never uploaded or sent
  })

  it('online multiplayer code never sends pictures or uploads', () => {
    const online = files.filter(f => /WebSocket\(/.test(f.text))
    expect(online.length).toBeGreaterThan(0)
    for (const f of online) {
      expect(f.text, f.path).not.toMatch(/toDataURL|FileReader|createImageBitmap|getImageData/)
    }
  })

  it('Neon Dash sends the face only as a number online', () => {
    const nd = files.find(f => f.path === 'public/arcade/neon-dash/game.js')
    if (!nd) return
    expect(nd.text).toMatch(/fc:myFace/)
    expect(nd.text).toMatch(/Number\.isInteger\(m\.fc\)/)
  })

  it('the privacy page exists and keeps its promises', () => {
    const p = join(ARCADE, 'privacy', 'index.html')
    expect(existsSync(p)).toBe(true)
    const t = readFileSync(p, 'utf8')
    for (const promise of ['No accounts, no names', 'No photos, no camera, no microphone', 'No chat', 'No ads', 'COPPA']) expect(t).toContain(promise)
  })

  it('no chat, names or text messages between players', () => {
    expect(offenders(/["']chat["']|t:\s*['"]msg['"]|t:\s*['"]chat['"]/)).toEqual([])
  })

  it('no third-party brands or characters in public pages', () => {
    expect(offenders(/\bMii\b|Nintendo|\bNFL\b/)).toEqual([])
  })
})
