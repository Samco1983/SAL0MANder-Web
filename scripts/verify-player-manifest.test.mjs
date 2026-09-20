import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { playerRootFromSite, verifyPlayer } from './verify-player-manifest.mjs'

const owned = []
afterEach(async () => {
  for (const dir of owned.splice(0)) await rm(dir, { recursive: true, force: true })
})
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'sal0-player-manifest-test-'))
  owned.push(root)
  await mkdir(path.join(root, 'Build'))
  const files = []
  for (const ext of ['loader.js', 'data', 'framework.js', 'wasm']) {
    const bytes = Buffer.from(`accepted ${ext}`)
    const name = `Build/player.${ext}`
    await writeFile(path.join(root, name), bytes)
    files.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  return { root, manifest: { schemaVersion: 1, compression: 'none', buildName: 'player', release: 'beta-1', files } }
}
it('rejects a stale player with the same filenames and byte count', async () => {
  const { root, manifest } = await fixture()
  await expect(verifyPlayer(root, manifest)).resolves.toBe(4)
  await writeFile(path.join(root, 'Build/player.wasm'), 'rejected wasm')
  await expect(verifyPlayer(root, manifest)).rejects.toThrow('accepted player hash differs')
})
it('verifies the exact HTTPS URLs visitors load and normalizes the site root', async () => {
  const { root, manifest } = await fixture()
  const fetcher = vi.fn(async url => {
    const file = url.pathname.replace('/school/unity/', '')
    return { status: 200, arrayBuffer: async () => Uint8Array.from(await readFile(path.join(root, file))).buffer }
  })
  for (const site of ['https://example.test/school', 'https://example.test/school/']) {
    const player = playerRootFromSite(site)
    expect(player).toBe('https://example.test/school/unity/')
    await expect(verifyPlayer(player, manifest, fetcher)).resolves.toBe(4)
  }
  expect(fetcher.mock.calls[0][0].href).toBe('https://example.test/school/unity/Build/player.loader.js?v=beta-1')
  const corrupt = async () => ({ status: 200, arrayBuffer: async () => new Uint8Array(0).buffer })
  await expect(verifyPlayer('https://example.test/unity/', manifest, corrupt)).rejects.toThrow('byte count differs')
})
it('rejects a missing required file and paths outside the player directory', async () => {
  const { root, manifest } = await fixture()
  await expect(verifyPlayer(root, { ...manifest, files: manifest.files.slice(1) })).rejects.toThrow('Required player file missing')
  await expect(verifyPlayer(root, { ...manifest, files: [{ path: '../outside' }] })).rejects.toThrow('Unsafe player path')
})
